import sys
import os
import re
import mimetypes
from urllib.parse import urlparse, unquote

sys.path.insert(
    0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
)

import time
import threading
from datetime import datetime
from decimal import Decimal, InvalidOperation
from fastapi import FastAPI, BackgroundTasks, HTTPException, Header, Body, Form, File, UploadFile
from fastapi.responses import Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
import httpx
import uvicorn

from services.common import (
    logger,
    app_state,
    scraper_config,
    DATE_RANGE_MAP,
    API_KEY,
    AZURE_STORAGE_CONNECTION_STRING,
    AZURE_CONTAINER_NAME,
    AZURE_RAW_RESUME_PATH,
    AZURE_CONFIDENTIAL_DOCUMENTS_PATH,
    AZURE_CLIENT_ID,
    AZURE_CLIENT_SECRET,
    AZURE_TENANT_ID,
    AZURE_STORAGE_ACCOUNT_NAME,
)
from database import (
    DBManager,
    ActiveScrapedData,
    InactiveScrapedData,
    text,
    DB_SCHEMA,
    func,
    Candidate,
    init_db,
    dispose_db_engine,
)

app = FastAPI(title="Dice Scraper API Gateway")

@app.on_event("startup")
def startup_event():
    try:
        init_db()
        dm = DBManager()
        try:
            dm.create_indexes()
        finally:
            dm.close()
        logger.info("Database initialized and indexed successfully")
    except Exception as e:
        logger.error(f"Failed to initialize database on startup: {e}")


@app.on_event("shutdown")
def shutdown_event():
    dispose_db_engine()

app.add_middleware(GZipMiddleware, minimum_size=1000)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

SCRAPER_SERVICE_URL = os.getenv("SCRAPER_SERVICE_URL", "http://localhost:8001")
state_lock = threading.Lock()

_stats_cache = {"data": None, "expires": 0}
_stats_cache_ttl = 5
_db_tables_cache = {"data": None, "expires": 0}


def check_auth(x_api_key: str):
    if API_KEY and x_api_key != API_KEY:
        raise HTTPException(
            status_code=401, detail="Invalid or missing X-API-Key header"
        )


VISA_STATUS_OPTIONS = {
    "US Citizen",
    "Green Card",
    "H1B",
    "OPT",
    "CPT",
    "L2",
    "EAD",
    "Other",
}
RELOCATION_OPTIONS = {"Yes", "No"}
EMPLOYMENT_TYPE_OPTIONS = {"Existing", "New"}
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
CONTACT_RE = re.compile(r"^[0-9+\-() ]+$")


def get_blob_service_client():
    if AZURE_CLIENT_ID and AZURE_CLIENT_SECRET and AZURE_TENANT_ID:
        from azure.identity import ClientSecretCredential
        from azure.storage.blob import BlobServiceClient

        cred = ClientSecretCredential(
            tenant_id=AZURE_TENANT_ID,
            client_id=AZURE_CLIENT_ID,
            client_secret=AZURE_CLIENT_SECRET,
        )
        account_url = f"https://{AZURE_STORAGE_ACCOUNT_NAME}.blob.core.windows.net"
        return BlobServiceClient(account_url, credential=cred)

    if AZURE_STORAGE_CONNECTION_STRING:
        from azure.storage.blob import BlobServiceClient

        return BlobServiceClient.from_connection_string(
            AZURE_STORAGE_CONNECTION_STRING
        )

    raise HTTPException(
        status_code=500,
        detail="Azure Storage is not configured. Please add Service Principal credentials or AZURE_STORAGE_CONNECTION_STRING.",
    )


_USER_DELEGATION_KEY_CACHE = {"key": None, "expiry": None}

def build_blob_access_url(blob_service_client, blob_name):
    blob_client = blob_service_client.get_blob_client(
        container=AZURE_CONTAINER_NAME, blob=blob_name
    )

    try:
        from datetime import UTC, timedelta
        from datetime import datetime as dt
        from azure.storage.blob import BlobSasPermissions, generate_blob_sas

        if AZURE_CLIENT_ID and AZURE_CLIENT_SECRET and AZURE_TENANT_ID:
            now = dt.now(UTC)
            
            if _USER_DELEGATION_KEY_CACHE["key"] is None or _USER_DELEGATION_KEY_CACHE["expiry"] is None or now >= _USER_DELEGATION_KEY_CACHE["expiry"] - timedelta(hours=1):
                start_time = now
                expiry_time = start_time + timedelta(days=6, hours=23)
                _USER_DELEGATION_KEY_CACHE["key"] = blob_service_client.get_user_delegation_key(
                    key_start_time=start_time,
                    key_expiry_time=expiry_time,
                )
                _USER_DELEGATION_KEY_CACHE["expiry"] = expiry_time

            sas_token = generate_blob_sas(
                account_name=AZURE_STORAGE_ACCOUNT_NAME,
                container_name=AZURE_CONTAINER_NAME,
                blob_name=blob_name,
                user_delegation_key=_USER_DELEGATION_KEY_CACHE["key"],
                permission=BlobSasPermissions(read=True),
                expiry=_USER_DELEGATION_KEY_CACHE["expiry"],
            )
            return f"{blob_client.url}?{sas_token}"

        if AZURE_STORAGE_CONNECTION_STRING:
            match = re.search(r"AccountKey=([^;]+)", AZURE_STORAGE_CONNECTION_STRING)
            if match:
                account_key = match.group(1)
                sas_token = generate_blob_sas(
                    account_name=AZURE_STORAGE_ACCOUNT_NAME,
                    container_name=AZURE_CONTAINER_NAME,
                    blob_name=blob_name,
                    account_key=account_key,
                    permission=BlobSasPermissions(read=True),
                    expiry=datetime.now(UTC) + timedelta(days=365),
                )
                return f"{blob_client.url}?{sas_token}"
    except Exception as sas_err:
        logger.warning(f"SAS generation failed for {blob_name}: {sas_err}")

    return blob_client.url


async def upload_blob_file(blob_service_client, blob_name, upload_file):
    blob_client = blob_service_client.get_blob_client(
        container=AZURE_CONTAINER_NAME, blob=blob_name
    )
    contents = await upload_file.read()
    blob_client.upload_blob(contents, overwrite=True)
    return build_blob_access_url(blob_service_client, blob_name)


def keep_only_latest_blob_in_prefix(blob_service_client, prefix, latest_blob_name):
    container_client = blob_service_client.get_container_client(
        AZURE_CONTAINER_NAME
    )
    for blob in container_client.list_blobs(name_starts_with=prefix):
        if blob.name == latest_blob_name:
            continue
        try:
            container_client.delete_blob(blob.name, delete_snapshots="include")
        except TypeError:
            container_client.delete_blob(blob.name)


def get_blob_name_from_document_url(document_url):
    if not document_url:
        return None

    parsed = urlparse(document_url)
    blob_path = parsed.path.lstrip("/")
    container_prefix = f"{AZURE_CONTAINER_NAME}/"
    if blob_path.startswith(container_prefix):
        blob_path = blob_path[len(container_prefix):]

    return unquote(blob_path)


def guess_media_type(blob_name, existing_content_type=None):
    if existing_content_type and existing_content_type != "application/octet-stream":
        return existing_content_type

    guessed_type, _ = mimetypes.guess_type(blob_name)
    return guessed_type or "application/octet-stream"


def get_candidate_document_blob_name(candidate, document_type):
    document_map = {
        "resume": candidate.raw_resume_path,
        "formatted_resume": candidate.formatted_resume_path,
        "passport": get_blob_name_from_document_url(candidate.passport_url),
        "work_authorization": get_blob_name_from_document_url(
            candidate.work_authorization_url
        ),
        "id_proof": get_blob_name_from_document_url(candidate.id_proof_url),
    }

    if document_type not in document_map:
        raise HTTPException(status_code=400, detail="Unsupported document type.")

    blob_name = document_map[document_type]
    if not blob_name:
        raise HTTPException(
            status_code=404,
            detail=f"No {document_type.replace('_', ' ')} document found for this candidate.",
        )

    return blob_name


def validate_candidate_payload(payload, require_all=True):
    required_fields = (
        "first_name",
        "last_name",
        "contact",
        "email",
        "visa_status",
        "skill_set",
        "relocation",
        "graduation_year",
        "employment_type",
    )

    for field in required_fields:
        value = payload.get(field)
        if require_all and (value is None or str(value).strip() == ""):
            raise HTTPException(
                status_code=400,
                detail=f"{field} is required for candidate registration.",
            )

    if payload.get("email") is not None:
        email = str(payload["email"]).strip()
        if not EMAIL_RE.match(email):
            raise HTTPException(status_code=400, detail="A valid email address is required.")
        payload["email"] = email

    if payload.get("contact") is not None:
        contact = str(payload["contact"]).strip()
        if not CONTACT_RE.match(contact):
            raise HTTPException(
                status_code=400,
                detail="contact may contain only digits, spaces, +, -, and parentheses.",
            )
        payload["contact"] = contact

    if payload.get("visa_status") is not None and payload["visa_status"] not in VISA_STATUS_OPTIONS:
        raise HTTPException(
            status_code=400,
            detail=f"visa_status must be one of: {', '.join(sorted(VISA_STATUS_OPTIONS))}.",
        )

    if payload.get("relocation") is not None and payload["relocation"] not in RELOCATION_OPTIONS:
        raise HTTPException(
            status_code=400,
            detail=f"relocation must be one of: {', '.join(sorted(RELOCATION_OPTIONS))}.",
        )

    if payload.get("employment_type") is not None and payload["employment_type"] not in EMPLOYMENT_TYPE_OPTIONS:
        raise HTTPException(
            status_code=400,
            detail=f"employment_type must be one of: {', '.join(sorted(EMPLOYMENT_TYPE_OPTIONS))}.",
        )

    if payload.get("graduation_year") is not None:
        try:
            graduation_year = int(payload["graduation_year"])
        except (TypeError, ValueError):
            raise HTTPException(status_code=400, detail="graduation_year must be an integer.")
        if graduation_year < 1950 or graduation_year > 2100:
            raise HTTPException(
                status_code=400,
                detail="graduation_year must be between 1950 and 2100.",
            )
        payload["graduation_year"] = graduation_year

    bill_rate = payload.get("bill_rate")
    if bill_rate is not None:
        if str(bill_rate).strip() == "":
            payload["bill_rate"] = None
        else:
            try:
                parsed_bill_rate = Decimal(str(bill_rate))
            except (InvalidOperation, ValueError):
                raise HTTPException(status_code=400, detail="bill_rate must be a valid decimal value.")
            if parsed_bill_rate <= 0:
                raise HTTPException(status_code=400, detail="bill_rate must be a positive value.")
            payload["bill_rate"] = parsed_bill_rate

    return payload


def serialize_candidate(candidate, blob_service_client=None):
    full_name = " ".join(
        part for part in [candidate.first_name, candidate.last_name] if part
    ).strip()
    resume_url = None
    formatted_resume_url = None
    if blob_service_client and candidate.raw_resume_path:
        resume_url = build_blob_access_url(blob_service_client, candidate.raw_resume_path)
    if blob_service_client and candidate.formatted_resume_path:
        formatted_resume_url = build_blob_access_url(
            blob_service_client, candidate.formatted_resume_path
        )

    return {
        "serial_no": candidate.unique_id,
        "unique_id": candidate.unique_id,
        "first_name": candidate.first_name,
        "last_name": candidate.last_name,
        "full_name": full_name,
        "contact": candidate.contact,
        "phone": candidate.contact,
        "email": candidate.email,
        "visa_status": candidate.visa_status,
        "skill_set": candidate.skill_set,
        "skills": candidate.skill_set,
        "relocation": candidate.relocation,
        "graduation_year": candidate.graduation_year,
        "employment_type": candidate.employment_type,
        "bill_rate": float(candidate.bill_rate) if candidate.bill_rate is not None else None,
        "raw_resume_path": candidate.raw_resume_path,
        "resume_url": resume_url,
        "formatted_resume_status": candidate.formatted_resume_status,
        "formatted_resume_path": candidate.formatted_resume_path,
        "formatted_resume_file_name": candidate.formatted_resume_file_name,
        "formatted_resume_url": formatted_resume_url,
        "formatted_resume_content": candidate.formatted_resume_content,
        "formatted_resume_missing_field_details": candidate.formatted_resume_missing_field_details
        or [],
        "formatted_resume_llm_info": candidate.formatted_resume_llm_info,
        "formatted_resume_error": candidate.formatted_resume_error,
        "formatted_resume_processed_at": candidate.formatted_resume_processed_at.isoformat()
        if candidate.formatted_resume_processed_at
        else None,
        "passport_url": candidate.passport_url,
        "work_authorization_url": candidate.work_authorization_url,
        "id_proof_url": candidate.id_proof_url,
    }


def launch_candidate_resume_formatter(unique_id: str, raw_resume_path: str):
    try:
        from services.resume_formatter import CandidateResumeFormatterService

        formatter_service = CandidateResumeFormatterService()
        formatter_service.process_candidate_resume(unique_id, raw_resume_path)
    except Exception as exc:
        logger.error(
            f"Unable to launch resume formatter for candidate {unique_id}: {exc}"
        )
        dm = DBManager()
        try:
            dm.update_candidate(
                unique_id,
                {
                    "formatted_resume_status": "failed",
                    "formatted_resume_error": str(exc),
                    "formatted_resume_processed_at": datetime.utcnow(),
                },
            )
        finally:
            dm.close()


@app.get("/")
def health():
    return {"status": "ok", "service": "Dice Scraper API Gateway", "version": "2.0"}


@app.get("/init")
def get_initial_data(x_api_key: str = Header(None)):
    """Consolidated endpoint for ultra-fast app startup (<500ms)"""
    check_auth(x_api_key)
    now = time.time()
    
    # 1. Get Status (Fast)
    status = app_state.to_dict()
    
    # 2. Get Stats (Cached or Fast Count)
    stats = _stats_cache["data"]
    if not stats or now >= _stats_cache["expires"]:
        # Inline fast stats logic
        dm = DBManager()
        try:
            def get_fast_count(table_name):
                return dm.get_fast_count(table_name)
            
            active = get_fast_count("active_scraped_data")
            inactive = get_fast_count("inactive_scraped_data")
            stats = {
                "jobs_scraped_today": 0, # Approximation or skip for init
                "total_jobs": active + inactive,
                "total_active": active,
                "total_inactive": inactive,
                "matched_candidates": get_fast_count("candidates"),
                "scheduler_next_run": scraper_config.get("schedule_time", "Unknown") if scraper_config.get("schedule_enabled") else "Disabled"
            }
            _stats_cache["data"] = stats
            _stats_cache["expires"] = now + 30
        finally:
            dm.close()
        
    return {
        "status": status,
        "stats": stats,
        "settings": scraper_config,
        "timestamp": now
    }


@app.get("/status")
def get_status(x_api_key: str = Header(None)):
    check_auth(x_api_key)
    return app_state.to_dict()


@app.get("/jobs")
def get_jobs(
    page: int = 1,
    limit: int = 20,
    last_id: int = None,
    search: str = None,
    company: str = None,
    location: str = None,
    vendor: str = None,
    job_type: str = None,
    x_api_key: str = Header(None),
):
    check_auth(x_api_key)
    dm = None
    try:
        dm = DBManager()
        jobs, total, next_last_id = dm.get_jobs_union_paginated(
            page=page,
            limit=limit,
            get_total=True,
            search=search,
            company=company,
            location=location,
            vendor=vendor,
            job_type=job_type,
            last_id=last_id,
        )
        dm.close()
        return {
            "jobs": jobs,
            "page": page,
            "limit": limit,
            "total": total,
            "next_last_id": next_last_id,
        }
    except Exception as e:
        logger.error(f"Failed to fetch jobs: {e}")
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
    finally:
        if dm is not None:
            dm.close()


@app.get("/stats")
def get_stats(x_api_key: str = Header(None)):
    check_auth(x_api_key)
    now = time.time()
    if _stats_cache["data"] and now < _stats_cache["expires"]:
        return _stats_cache["data"]

    dm = None
    try:
        dm = DBManager()
        
        # Optimized counts using pg_class estimates (instant)
        def get_fast_count(table_name):
            return dm.get_fast_count(table_name)

        active_count = get_fast_count("active_scraped_data")
        inactive_count = get_fast_count("inactive_scraped_data")
        matched_candidates_count = get_fast_count("candidates")

        # Today's count still needs a query, but we'll optimize it
        today_str = datetime.now().strftime("%Y-%m-%d")
        
        from database import InactiveScrapedData
        
        count_active = (
            dm.session.query(func.count(ActiveScrapedData.serial_no))
            .filter(ActiveScrapedData.scraped_at >= today_str)
            .scalar() or 0
        )
        
        count_inactive = (
            dm.session.query(func.count(InactiveScrapedData.serial_no))
            .filter(InactiveScrapedData.scraped_at >= today_str)
            .scalar() or 0
        )
        
        jobs_today = count_active + count_inactive

        result = {
            "jobs_scraped_today": jobs_today,
            "total_jobs": active_count + inactive_count,
            "total_active": active_count,
            "total_inactive": inactive_count,
            "matched_candidates": matched_candidates_count,
            "tailored_resumes": 0,
            "scheduler_next_run": scraper_config.get("schedule_time", "Unknown") if scraper_config.get("schedule_enabled") else "Disabled",
        }

        _stats_cache["data"] = result
        _stats_cache["expires"] = now + 5
        return result
    except Exception as e:
        logger.error(f"Failed to fetch stats: {e}")
        return { "error": "Failed to sync statistics.", "jobs_scraped_today": 0, "total_jobs": 0 }
    finally:
        if dm is not None:
            dm.close()


@app.get("/jobs/{serial_no}")
def get_job_detail(serial_no: int, job_type: str, x_api_key: str = Header(None)):
    check_auth(x_api_key)
    dm = None
    try:
        dm = DBManager()
        job = dm.get_job_detail(serial_no, job_type)
        if job:
            job["type"] = job_type
            return {"job": job}
        return {"error": "Job not found", "job": None}
    except Exception as e:
        logger.error(f"Failed to fetch job detail: {e}")
        return {"job": None, "error": str(e)}
    finally:
        if dm is not None:
            dm.close()


@app.post("/candidates/upload")
async def upload_candidate(
    background_tasks: BackgroundTasks,
    first_name: str = Form(...),
    last_name: str = Form(...),
    contact: str = Form(...),
    email: str = Form(...),
    visa_status: str = Form(...),
    skill_set: str = Form(...),
    relocation: str = Form(...),
    graduation_year: int = Form(...),
    employment_type: str = Form(...),
    bill_rate: str = Form(None),
    resume: UploadFile = File(...),
    passport: UploadFile = File(None),
    work_authorization: UploadFile = File(None),
    id_proof: UploadFile = File(None),
    x_api_key: str = Header(None),
):
    check_auth(x_api_key)
    dm = DBManager()
    try:
        candidate_data = validate_candidate_payload(
            {
                "first_name": first_name.strip(),
                "last_name": last_name.strip(),
                "contact": contact.strip(),
                "email": email.strip(),
                "visa_status": visa_status,
                "skill_set": skill_set.strip(),
                "relocation": relocation,
                "graduation_year": graduation_year,
                "employment_type": employment_type,
                "bill_rate": bill_rate,
            },
            require_all=True,
        )

        existing_candidate = (
            dm.session.query(Candidate.unique_id)
            .filter(Candidate.email == candidate_data["email"])
            .first()
        )
        if existing_candidate:
            raise HTTPException(
                status_code=400,
                detail=f"Registration failed: A candidate with the email '{candidate_data['email']}' is already in our talent pool.",
            )

        unique_id = dm.generate_candidate_unique_id()
        blob_service_client = get_blob_service_client()

        raw_resume_path = f"{AZURE_RAW_RESUME_PATH}{unique_id}/{resume.filename}"
        resume_url = await upload_blob_file(blob_service_client, raw_resume_path, resume)

        passport_url = None
        work_authorization_url = None
        id_proof_url = None

        if passport and passport.filename:
            passport_url = await upload_blob_file(
                blob_service_client,
                f"{AZURE_CONFIDENTIAL_DOCUMENTS_PATH}{unique_id}/passport/{passport.filename}",
                passport,
            )
        if work_authorization and work_authorization.filename:
            work_authorization_url = await upload_blob_file(
                blob_service_client,
                f"{AZURE_CONFIDENTIAL_DOCUMENTS_PATH}{unique_id}/work auth/{work_authorization.filename}",
                work_authorization,
            )
        if id_proof and id_proof.filename:
            id_proof_url = await upload_blob_file(
                blob_service_client,
                f"{AZURE_CONFIDENTIAL_DOCUMENTS_PATH}{unique_id}/id proof/{id_proof.filename}",
                id_proof,
            )

        candidate_data.update(
            {
                "unique_id": unique_id,
                "raw_resume_path": raw_resume_path,
                "formatted_resume_status": "processing",
                "formatted_resume_path": None,
                "formatted_resume_content": None,
                "formatted_resume_missing_field_details": [],
                "formatted_resume_llm_info": None,
                "formatted_resume_error": None,
                "formatted_resume_processed_at": datetime.utcnow(),
                "passport_url": passport_url,
                "work_authorization_url": work_authorization_url,
                "id_proof_url": id_proof_url,
            }
        )
        dm.add_candidate(candidate_data)
        background_tasks.add_task(
            launch_candidate_resume_formatter, unique_id, raw_resume_path
        )

        return {
            "status": "ok",
            "candidate_id": unique_id,
            "resume_url": resume_url,
            "raw_resume_path": raw_resume_path,
            "passport_url": passport_url,
            "work_authorization_url": work_authorization_url,
            "id_proof_url": id_proof_url,
        }
    except HTTPException as he:
        raise he
    except Exception as e:
        logger.error(f"Candidate upload failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        dm.close()


@app.get("/candidates")
def get_candidates(
    search: str = None,
    tier: str = None,
    page: int = 1,
    limit: int = 20,
    x_api_key: str = Header(None),
):
    check_auth(x_api_key)
    dm = None
    try:
        dm = DBManager()

        offset = (page - 1) * limit

        query = dm.session.query(Candidate)
        if search:
            search_term = f"%{search}%"
            query = query.filter(
                (func.concat(Candidate.first_name, " ", Candidate.last_name).ilike(search_term))
                | (Candidate.email.ilike(search_term))
                | (Candidate.contact.ilike(search_term))
                | (Candidate.skill_set.ilike(search_term))
                | (Candidate.visa_status.ilike(search_term))
                | (Candidate.unique_id.ilike(search_term))
            )

        total = dm.session.query(func.count()).select_from(query.subquery()).scalar() or 0

        candidates = (
            query.order_by(Candidate.unique_id.desc()).offset(offset).limit(limit).all()
        )
        blob_service_client = None
        try:
            blob_service_client = get_blob_service_client()
        except HTTPException:
            blob_service_client = None

        result = {
            "candidates": [serialize_candidate(c, blob_service_client) for c in candidates],
            "total": total,
            "page": page,
            "limit": limit,
        }
        return result
    except Exception as e:
        logger.error(f"Failed to fetch candidates: {e}")
        return {
            "candidates": [],
            "total": 0,
            "page": page,
            "limit": limit,
            "error": str(e),
        }
    finally:
        if dm is not None:
            dm.close()


@app.get("/candidates/{unique_id}/documents/{document_type}")
def get_candidate_document(
    unique_id: str,
    document_type: str,
    x_api_key: str = Header(None),
):
    check_auth(x_api_key)
    dm = DBManager()
    try:
        candidate = (
            dm.session.query(Candidate)
            .filter(Candidate.unique_id == unique_id)
            .first()
        )
        if not candidate:
            raise HTTPException(status_code=404, detail="Candidate not found.")

        blob_name = get_candidate_document_blob_name(candidate, document_type)
        blob_service_client = get_blob_service_client()
        blob_client = blob_service_client.get_blob_client(
            container=AZURE_CONTAINER_NAME, blob=blob_name
        )
        blob_properties = blob_client.get_blob_properties()
        media_type = guess_media_type(
            blob_name,
            getattr(blob_properties.content_settings, "content_type", None),
        )
        content = blob_client.download_blob().readall()
        filename = os.path.basename(blob_name)

        return Response(
            content=content,
            media_type=media_type,
            headers={
                "Content-Disposition": f'inline; filename="{filename}"',
                "Cache-Control": "no-store",
            },
        )
    except HTTPException as he:
        raise he
    except Exception as e:
        logger.error(
            f"Failed to fetch {document_type} document for candidate {unique_id}: {e}"
        )
        raise HTTPException(
            status_code=500,
            detail="Unable to load the requested candidate document.",
        )
    finally:
        dm.close()


@app.post("/candidates/{unique_id}/formatted-resume/complete")
def complete_candidate_formatted_resume(
    unique_id: str,
    payload: dict = Body(...),
    x_api_key: str = Header(None),
):
    check_auth(x_api_key)
    try:
        from services.resume_formatter import CandidateResumeFormatterService

        formatter_service = CandidateResumeFormatterService()
        formatter_service.complete_candidate_resume(unique_id, payload)

        dm = DBManager()
        try:
            candidate = (
                dm.session.query(Candidate)
                .filter(Candidate.unique_id == unique_id)
                .first()
            )
            if not candidate:
                raise HTTPException(status_code=404, detail="Candidate not found.")

            blob_service_client = None
            try:
                blob_service_client = get_blob_service_client()
            except HTTPException:
                blob_service_client = None

            response_payload = serialize_candidate(candidate, blob_service_client)
            return {"status": "ok", "candidate": response_payload}
        finally:
            dm.close()
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except HTTPException as he:
        raise he
    except Exception as exc:
        logger.error(
            f"Failed to complete formatted resume for candidate {unique_id}: {exc}"
        )
        raise HTTPException(
            status_code=500,
            detail="Unable to complete the formatted resume with the provided values.",
        ) from exc

@app.get("/settings")
def get_settings(x_api_key: str = Header(None)):
    check_auth(x_api_key)
    return scraper_config


@app.put("/candidates/{unique_id}")
@app.post("/candidates/update/{unique_id}")
async def update_candidate(
    background_tasks: BackgroundTasks,
    unique_id: str,
    first_name: str = Form(None),
    last_name: str = Form(None),
    contact: str = Form(None),
    email: str = Form(None),
    visa_status: str = Form(None),
    skill_set: str = Form(None),
    relocation: str = Form(None),
    graduation_year: int = Form(None),
    employment_type: str = Form(None),
    bill_rate: str = Form(None),
    resume: UploadFile = File(None),
    passport: UploadFile = File(None),
    work_authorization: UploadFile = File(None),
    id_proof: UploadFile = File(None),
    x_api_key: str = Header(None),
):
    check_auth(x_api_key)
    dm = None
    try:
        dm = DBManager()
        update_data = validate_candidate_payload(
            {
                "first_name": first_name.strip() if first_name else None,
                "last_name": last_name.strip() if last_name else None,
                "contact": contact.strip() if contact else None,
                "email": email.strip() if email else None,
                "visa_status": visa_status,
                "skill_set": skill_set.strip() if skill_set else None,
                "relocation": relocation,
                "graduation_year": graduation_year,
                "employment_type": employment_type,
                "bill_rate": bill_rate,
            },
            require_all=False,
        )
        update_data = {
            key: value for key, value in update_data.items() if value is not None
        }

        existing_candidate = (
            dm.session.query(Candidate)
            .filter(Candidate.unique_id == unique_id)
            .first()
        )
        if not existing_candidate:
            raise HTTPException(
                status_code=404,
                detail=f"Candidate Intelligence Portfolio (ID: {unique_id}) not found in database.",
            )

        if email:
            duplicate_email = (
                dm.session.query(Candidate.unique_id)
                .filter(
                    Candidate.email == update_data["email"],
                    Candidate.unique_id != unique_id,
                )
                .first()
            )
            if duplicate_email:
                raise HTTPException(
                    status_code=400,
                    detail=f"Registration failed: A candidate with the email '{update_data['email']}' is already in our talent pool.",
                )

        if resume and resume.filename:
            blob_service_client = get_blob_service_client()
            resume_prefix = f"{AZURE_RAW_RESUME_PATH}{unique_id}/"
            raw_resume_path = f"{AZURE_RAW_RESUME_PATH}{unique_id}/{resume.filename}"
            await upload_blob_file(blob_service_client, raw_resume_path, resume)
            keep_only_latest_blob_in_prefix(
                blob_service_client, resume_prefix, raw_resume_path
            )
            update_data["raw_resume_path"] = raw_resume_path
            update_data["formatted_resume_status"] = "processing"
            update_data["formatted_resume_path"] = None
            update_data["formatted_resume_content"] = None
            update_data["formatted_resume_missing_field_details"] = []
            update_data["formatted_resume_llm_info"] = None
            update_data["formatted_resume_error"] = None
            update_data["formatted_resume_processed_at"] = datetime.utcnow()

        if passport and passport.filename:
            blob_service_client = get_blob_service_client()
            passport_blob_name = (
                f"{AZURE_CONFIDENTIAL_DOCUMENTS_PATH}{unique_id}/passport/{passport.filename}"
            )
            update_data["passport_url"] = await upload_blob_file(
                blob_service_client,
                passport_blob_name,
                passport,
            )
            keep_only_latest_blob_in_prefix(
                blob_service_client,
                f"{AZURE_CONFIDENTIAL_DOCUMENTS_PATH}{unique_id}/passport/",
                passport_blob_name,
            )

        if work_authorization and work_authorization.filename:
            blob_service_client = get_blob_service_client()
            work_auth_blob_name = (
                f"{AZURE_CONFIDENTIAL_DOCUMENTS_PATH}{unique_id}/work auth/{work_authorization.filename}"
            )
            update_data["work_authorization_url"] = await upload_blob_file(
                blob_service_client,
                work_auth_blob_name,
                work_authorization,
            )
            keep_only_latest_blob_in_prefix(
                blob_service_client,
                f"{AZURE_CONFIDENTIAL_DOCUMENTS_PATH}{unique_id}/work auth/",
                work_auth_blob_name,
            )

        if id_proof and id_proof.filename:
            blob_service_client = get_blob_service_client()
            id_proof_blob_name = (
                f"{AZURE_CONFIDENTIAL_DOCUMENTS_PATH}{unique_id}/id proof/{id_proof.filename}"
            )
            update_data["id_proof_url"] = await upload_blob_file(
                blob_service_client,
                id_proof_blob_name,
                id_proof,
            )
            keep_only_latest_blob_in_prefix(
                blob_service_client,
                f"{AZURE_CONFIDENTIAL_DOCUMENTS_PATH}{unique_id}/id proof/",
                id_proof_blob_name,
            )

        success = dm.update_candidate(unique_id, update_data)
        if not success:
            raise HTTPException(status_code=404, detail=f"Candidate Intelligence Portfolio (ID: {unique_id}) not found in database.")
        if resume and resume.filename:
            background_tasks.add_task(
                launch_candidate_resume_formatter,
                unique_id,
                update_data["raw_resume_path"],
            )
        return {"status": "ok", "message": "Candidate updated successfully"}
    except HTTPException as he:
        raise he
    except Exception as e:
        logger.error(f"Candidate update failed: {e}")
        raise HTTPException(status_code=500, detail=f"Synchronization failed: {str(e)}")
    finally:
        if dm is not None:
            dm.close()


@app.delete("/candidates/{unique_id}")
def delete_candidate_endpoint(unique_id: str, x_api_key: str = Header(None)):
    check_auth(x_api_key)
    dm = DBManager()
    try:
        candidate = (
            dm.session.query(Candidate)
            .filter(Candidate.unique_id == unique_id)
            .first()
        )
        if not candidate:
            raise HTTPException(
                status_code=404,
                detail=f"Candidate (ID: {unique_id}) not found.",
            )

        # Clean up Azure blob storage files
        try:
            blob_service_client = get_blob_service_client()
            container_client = blob_service_client.get_container_client(AZURE_CONTAINER_NAME)

            prefixes_to_delete = [
                f"{AZURE_RAW_RESUME_PATH}{unique_id}/",
                f"{AZURE_CONFIDENTIAL_DOCUMENTS_PATH}{unique_id}/",
            ]

            # Also clean formatted resume blobs if a path config is available
            from config import AZURE_FORMATTED_RESUME_PATH
            prefixes_to_delete.append(f"{AZURE_FORMATTED_RESUME_PATH}{unique_id}/")

            for prefix in prefixes_to_delete:
                for blob in container_client.list_blobs(name_starts_with=prefix):
                    try:
                        container_client.delete_blob(blob.name, delete_snapshots="include")
                    except TypeError:
                        container_client.delete_blob(blob.name)
                    except Exception as blob_err:
                        logger.warning(f"Failed to delete blob {blob.name}: {blob_err}")
        except Exception as storage_err:
            logger.warning(f"Failed to clean up storage for candidate {unique_id}: {storage_err}")

        success = dm.delete_candidate(unique_id)
        if not success:
            raise HTTPException(
                status_code=404,
                detail=f"Candidate (ID: {unique_id}) not found.",
            )

        return {"status": "ok", "message": f"Candidate {unique_id} deleted successfully."}
    except HTTPException as he:
        raise he
    except Exception as e:
        logger.error(f"Candidate deletion failed for {unique_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Deletion failed: {str(e)}")
    finally:
        dm.close()


@app.post("/settings")
def update_settings(payload: dict, x_api_key: str = Header(None)):
    check_auth(x_api_key)
    allowed = {
        "date_range",
        "max_search_pages",
        "max_workers",
        "request_timeout",
        "scrape_cooldown",
        "schedule_enabled",
        "schedule_time",
    }
    updated = {}
    for key, val in payload.items():
        if key not in allowed:
            continue

        if key == "date_range":
            if val not in DATE_RANGE_MAP:
                raise HTTPException(
                    status_code=400, detail=f"Invalid date_range '{val}'"
                )
            scraper_config["date_range"] = val
            scraper_config["date_range_label"] = DATE_RANGE_MAP[val]
            updated[key] = val
        elif key == "schedule_enabled":
            scraper_config[key] = bool(val)
            updated[key] = bool(val)
        elif key == "schedule_time":
            import re

            if not re.match(r"^\d{2}:\d{2}$", str(val)):
                raise HTTPException(
                    status_code=400, detail="schedule_time must be HH:MM format"
                )
            scraper_config[key] = str(val)
            updated[key] = str(val)
        elif key in (
            "max_search_pages",
            "max_workers",
            "request_timeout",
            "scrape_cooldown",
        ):
            try:
                v = int(val)
                if v < 1:
                    raise ValueError
                scraper_config[key] = v
                updated[key] = v
            except (ValueError, TypeError):
                raise HTTPException(
                    status_code=400, detail=f"{key} must be a positive integer"
                )

    logger.info(f"Settings updated: {updated}")
    return {"status": "ok", "updated": updated, "config": scraper_config}


@app.post("/trigger")
async def trigger_scrape(
    x_api_key: str = Header(None), background_tasks: BackgroundTasks = None
):
    check_auth(x_api_key)

    with state_lock:
        if app_state.status in ("running", "starting"):
            return {"message": "Scraper is already running"}
        app_state.update(status="starting")

    try:
        async with httpx.AsyncClient(timeout=300.0) as client:
            response = await client.post(
                f"{SCRAPER_SERVICE_URL}/run",
                json={"config": dict(scraper_config)},
                headers={"X-API-Key": API_KEY} if API_KEY else {},
            )
            if response.status_code == 200:
                return {
                    "message": "Scraper started",
                    "task_id": response.json().get("task_id"),
                }
            else:
                app_state.update(status="idle")
                return {"message": "Failed to start scraper", "error": response.text}
    except httpx.ConnectError:
        logger.warning("Scraper service not available, running inline")
        from services.scraper.service import run_pipeline_sync

        threading.Thread(
            target=run_pipeline_sync, args=(dict(scraper_config),), daemon=True
        ).start()
        return {"message": "Scraper started inline"}
    except Exception as e:
        logger.error(f"Failed to trigger scrape: {e}")
        app_state.update(status="idle")
        return {"message": f"Failed to start scraper: {str(e)}"}


@app.post("/stop")
def stop_scrape(x_api_key: str = Header(None)):
    check_auth(x_api_key)
    with state_lock:
        if app_state.status in ("running", "starting"):
            app_state.update(stop_requested=True)
            return {"message": "Stop requested. Pipeline will terminate safely soon."}
    return {"message": "Scraper is not running"}


@app.post("/clear-data")
def clear_data(x_api_key: str = Header(None)):
    check_auth(x_api_key)
    dm = None
    try:
        dm = DBManager()
        dm.clear_all_data("active_scraped_data")
        dm.clear_all_data("inactive_scraped_data")
        return {
            "status": "ok",
            "message": "Cleared active and inactive scraped data tables",
        }
    except Exception as e:
        logger.error(f"Failed to clear data: {e}")
        return {"status": "error", "message": str(e)}
    finally:
        if dm is not None:
            dm.close()


@app.get("/db/tables/{table_name}/info")
def get_table_info(table_name: str, x_api_key: str = Header(None)):
    check_auth(x_api_key)
    dm = None
    try:
        dm = DBManager()
        info = dm.get_table_info(table_name)
        if not info:
             raise HTTPException(status_code=404, detail="Table info not found")
        return info
    except Exception as e:
        logger.error(f"Failed to fetch table info for {table_name}: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if dm is not None:
            dm.close()


@app.get("/db/tables")
def get_db_tables(x_api_key: str = Header(None)):
    check_auth(x_api_key)
    
    # Check cache (1 minute TTL)
    now = time.time()
    if _db_tables_cache["data"] and now < _db_tables_cache["expires"]:
        return _db_tables_cache["data"]

    dm = None
    try:
        dm = DBManager()
        tables = [
            {"name": "input_active", "description": "Active vendor search links", "type": "input"},
            {"name": "input_inactive", "description": "Inactive vendor job links", "type": "input"},
            {"name": "active_dice_jobs", "description": "Discovered jobs from active vendors", "type": "discovery"},
            {"name": "inactive_dice_jobs", "description": "Discovered jobs from inactive vendors", "type": "discovery"},
            {"name": "active_scraped_data", "description": "Scraped job details (active vendors)", "type": "scraped"},
            {"name": "inactive_scraped_data", "description": "Scraped job details (inactive vendors)", "type": "scraped"},
            {"name": "scraper_logs", "description": "Historical scraper execution logs", "type": "system"},
            {"name": "candidates", "description": "Registered candidate talent pool", "type": "talent"},
        ]
        
        # Highly optimized count using Postgres system catalogs for instant results
        table_counts = {}
        for t in tables:
            try:
                table_counts[t["name"]] = dm.get_fast_count(t["name"])
            except Exception:
                table_counts[t["name"]] = 0
        
        result = {"tables": tables, "counts": table_counts}
        _db_tables_cache["data"] = result
        _db_tables_cache["expires"] = now + 5  # Cache for 5 seconds
        return result
    except Exception as e:
        logger.error(f"Failed to fetch tables: {e}")
        return {"tables": [], "counts": {}, "error": str(e)}
    finally:
        if dm is not None:
            dm.close()


@app.get("/db/tables/{table_name}")
def get_table_data(
    table_name: str, page: int = 1, limit: int = 50, x_api_key: str = Header(None)
):
    check_auth(x_api_key)
    valid_tables = [
        "input_active", "input_inactive", "active_dice_jobs", 
        "inactive_dice_jobs", "active_scraped_data", "inactive_scraped_data",
        "scraper_logs", "candidates"
    ]
    if table_name not in valid_tables:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid table name. Must be one of: {valid_tables}",
        )
    dm = None
    try:
        dm = DBManager()
        records, total, columns = dm.get_table_data(table_name, page, limit)
        return {
            "records": records,
            "columns": columns,
            "total": total,
            "page": page,
            "limit": limit,
        }
    except Exception as e:
        logger.error(f"Failed to fetch table {table_name}: {e}")
        return {
            "records": [], "columns": [], "total": 0,
            "page": page, "limit": limit, "error": str(e),
        }
    finally:
        if dm is not None:
            dm.close()


@app.delete("/db/tables/{table_name}")
def delete_table_data(table_name: str, x_api_key: str = Header(None)):
    check_auth(x_api_key)
    valid_tables = [
        "input_active", "input_inactive", "active_dice_jobs",
        "inactive_dice_jobs", "active_scraped_data", "inactive_scraped_data",
        "scraper_logs", "candidates"
    ]
    if table_name not in valid_tables:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid table name. Must be one of: {valid_tables}",
        )
    dm = None
    try:
        dm = DBManager()
        dm.clear_all_data(table_name)
        return {"status": "ok", "message": f"Cleared all data from {table_name}"}
    except Exception as e:
        logger.error(f"Failed to clear table {table_name}: {e}")
        return {"status": "error", "message": str(e)}
    finally:
        if dm is not None:
            dm.close()


if __name__ == "__main__":
    p = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=p)
