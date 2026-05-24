"""
Candidates Router
==================
All candidate CRUD, document access, and resume formatting endpoints.
"""

import os
from datetime import datetime
import httpx
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Header, Form, File, UploadFile, Body
from fastapi.responses import Response, RedirectResponse
from sqlalchemy.orm import Session
from app.dependencies import get_db, check_api_key
from app.repositories import candidate_repository
from app.services import candidate_service, azure_service
from app.config import get_settings, logger
from services.matching_integration import get_candidate_matches, run_candidate_matching

router = APIRouter(tags=["Candidates"])


@router.get("/candidates")
def get_candidates(
    search: str = None,
    tier: str = None,
    page: int = 1,
    limit: int = 20,
    sort_by: str = "recent",  # "recent" | "alphabetical"
    db: Session = Depends(get_db),
    _ = Depends(check_api_key)
):
    from app.cache.redis_client import cache
    cache_key = f"candidates_v6:{page}:{limit}:{sort_by}:{search or ''}:{tier or ''}"
    cached = cache.get(cache_key)
    if cached:
        return cached

    try:
        from app.models.candidates import Candidate, FormattingResumeInfo
        query = db.query(
            Candidate.unique_id,
            Candidate.first_name,
            Candidate.last_name,
            Candidate.email,
            Candidate.contact,
            Candidate.visa_status,
            Candidate.skill_set,
            Candidate.relocation,
            Candidate.graduation_year,
            Candidate.employment_type,
            Candidate.bill_rate,
            Candidate.raw_resume_path,
            Candidate.passport_url,
            Candidate.work_authorization_url,
            Candidate.id_proof_url,
            Candidate.created_at,
            FormattingResumeInfo.formatted_resume_status,
        ).outerjoin(
            FormattingResumeInfo,
            Candidate.unique_id == FormattingResumeInfo.unique_id,
        )

        if search:
            search_term = f"%{search}%"
            query = query.filter(
                (Candidate.first_name.ilike(search_term)) |
                (Candidate.last_name.ilike(search_term)) |
                (Candidate.email.ilike(search_term)) |
                (Candidate.skill_set.ilike(search_term))
            )
        
        total = query.count()
        
        # Apply Sorting
        if sort_by == "alphabetical":
            query = query.order_by(Candidate.first_name.asc(), Candidate.last_name.asc())
        else:
            # Default: Recent on top
            query = query.order_by(Candidate.created_at.desc())

        candidates = query.offset((page - 1) * limit).limit(limit).all()
        
        # Note: Since we selected specific columns, the objects in 'candidates' are row tuples,
        # but our serialize_candidate helper expects a model instance. 
        # For simplicity in this refactor, we'll use a direct dict mapping for the list.
        serialized = []
        for c in candidates:
            # Reconstruct basic dict similar to serialize_candidate
            full_name = " ".join(p for p in [c.first_name, c.last_name] if p).strip()
            
            # Helper for proxy URLs with correct extensions
            def get_proxy_url(doc_type, path):
                if not path: return None
                ext = path.split('.')[-1].lower() if '.' in path else 'bin'
                return f"/candidates/{c.unique_id}/documents/{doc_type}/view/file.{ext}"

            serialized.append({
                "unique_id": c.unique_id,
                "serial_no": c.unique_id,  # Frontend alias
                "first_name": c.first_name,
                "last_name": c.last_name,
                "full_name": full_name,
                "email": c.email,
                "phone": c.contact,
                "contact": c.contact,
                "visa_status": c.visa_status,
                "skill_set": c.skill_set,
                "skills": c.skill_set,
                "relocation": c.relocation,
                "graduation_year": c.graduation_year,
                "employment_type": c.employment_type,
                "bill_rate": float(c.bill_rate) if c.bill_rate is not None else None,
                "resume_url": get_proxy_url("resume", c.raw_resume_path),
                "passport_url": get_proxy_url("passport", c.passport_url),
                "id_proof_url": get_proxy_url("id_proof", c.id_proof_url),
                "work_authorization_url": get_proxy_url("work_authorization", c.work_authorization_url),
                "created_at": c.created_at.isoformat() if c.created_at else None,
                "formatted_resume_status": c.formatted_resume_status or "not_started",
            })

        result = {
            "candidates": serialized,
            "total": total,
            "page": page,
            "limit": limit,
        }
        # Cache list for a short duration
        cache.set(cache_key, result, ttl=300)
        return result
    except Exception as e:
        logger.error(f"Failed to fetch candidates: {e}")
        return {"candidates": [], "total": 0, "page": page, "limit": limit, "error": str(e)}


@router.get("/candidates/{unique_id}")
def get_candidate_detail(unique_id: str, db: Session = Depends(get_db), _ = Depends(check_api_key)):
    """Fetch full candidate details including real SAS URLs for documents."""
    candidate = candidate_repository.get_candidate_by_id(db, unique_id)
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")
    
    # Initialize blob client to generate real SAS URLs for the detail view
    blob_service_client = None
    try:
        blob_service_client = azure_service.get_blob_service_client()
    except Exception as e:
        logger.warning(f"Could not initialize blob service client for detail view: {e}")

    return candidate_service.serialize_candidate(candidate, blob_service_client=blob_service_client, include_content=True)


@router.get("/candidates/{unique_id}/matches")
def get_candidate_match_results(
    unique_id: str,
    limit: int = 5,
    _ = Depends(check_api_key),
):
    try:
        return {
            "status": "ok",
            "candidate_id": unique_id,
            **get_candidate_matches(unique_id, limit=limit),
        }
    except Exception as exc:
        logger.error(f"Failed to fetch candidate matches for {unique_id}: {exc}")
        raise HTTPException(
            status_code=500,
            detail="Unable to fetch candidate match results.",
        ) from exc


@router.post("/candidates/{unique_id}/matches/run")
async def run_candidate_match_results(
    unique_id: str,
    payload: dict = Body(default={}),
    _ = Depends(check_api_key),
):
    try:
        result = await run_candidate_matching(
            unique_id,
            job_limit=payload.get("job_limit"),
            top_k=payload.get("top_k"),
            vector_top_n=payload.get("vector_top_n"),
            persist=payload.get("persist", True),
        )
        return {
            "status": "ok",
            "candidate_id": unique_id,
            **result,
        }
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except httpx.HTTPStatusError as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Matcher service returned {exc.response.status_code}: {exc.response.text}",
        ) from exc
    except httpx.HTTPError as exc:
        raise HTTPException(
            status_code=502,
            detail="Matcher service is unavailable.",
        ) from exc
    except Exception as exc:
        logger.error(f"Failed to run candidate matching for {unique_id}: {exc}")
        raise HTTPException(
            status_code=500,
            detail="Unable to run candidate matching.",
        ) from exc


@router.post("/candidates/upload")
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
    db: Session = Depends(get_db),
    _ = Depends(check_api_key)
):
    settings = get_settings()
    data = candidate_service.validate_candidate_payload({
        "first_name": first_name.strip(), "last_name": last_name.strip(),
        "contact": contact.strip(), "email": email.strip(),
        "visa_status": visa_status, "skill_set": skill_set.strip(),
        "relocation": relocation, "graduation_year": graduation_year,
        "employment_type": employment_type, "bill_rate": bill_rate,
    }, require_all=True)

    if candidate_repository.get_candidate_by_email(db, data["email"]):
        raise HTTPException(status_code=400, detail=f"A candidate with email '{data['email']}' already exists.")

    unique_id = candidate_repository.generate_unique_id(db)
    blob_client = azure_service.get_blob_service_client()

    raw_path = f"{settings.azure_raw_resume_path}{unique_id}/{resume.filename}"
    resume_url = await azure_service.upload_blob_file(blob_client, raw_path, resume)

    passport_url = work_auth_url = id_proof_url = None
    if passport and passport.filename:
        passport_url = await azure_service.upload_blob_file(blob_client, f"{settings.azure_confidential_documents_path}{unique_id}/passport/{passport.filename}", passport)
    if work_authorization and work_authorization.filename:
        work_auth_url = await azure_service.upload_blob_file(blob_client, f"{settings.azure_confidential_documents_path}{unique_id}/work auth/{work_authorization.filename}", work_authorization)
    if id_proof and id_proof.filename:
        id_proof_url = await azure_service.upload_blob_file(blob_client, f"{settings.azure_confidential_documents_path}{unique_id}/id proof/{id_proof.filename}", id_proof)

    data.update({
        "unique_id": unique_id, "raw_resume_path": raw_path,
        "formatted_resume_status": "processing", "formatted_resume_path": None,
        "formatted_resume_content": None, "formatted_resume_missing_field_details": [],
        "formatted_resume_llm_info": None, "formatted_resume_error": None,
        "formatted_resume_processed_at": datetime.utcnow(),
        "passport_url": passport_url, "work_authorization_url": work_auth_url, "id_proof_url": id_proof_url,
    })
    candidate_repository.add_candidate(db, data)
    background_tasks.add_task(candidate_service.launch_resume_formatter, unique_id, raw_path)

    # FIX 5: Invalidate caches
    from app.cache.redis_client import cache
    cache.delete_pattern("candidates_v5:*")
    cache.delete_pattern("candidates_v6:*")

    return {"status": "ok", "candidate_id": unique_id, "resume_url": resume_url, "raw_resume_path": raw_path,
            "passport_url": passport_url, "work_authorization_url": work_auth_url, "id_proof_url": id_proof_url}


@router.put("/candidates/{unique_id}")
@router.post("/candidates/update/{unique_id}")
async def update_candidate(
    background_tasks: BackgroundTasks,
    unique_id: str,
    first_name: str = Form(None), last_name: str = Form(None),
    contact: str = Form(None), email: str = Form(None),
    visa_status: str = Form(None), skill_set: str = Form(None),
    relocation: str = Form(None), graduation_year: int = Form(None),
    employment_type: str = Form(None), bill_rate: str = Form(None),
    resume: UploadFile = File(None), passport: UploadFile = File(None),
    work_authorization: UploadFile = File(None), id_proof: UploadFile = File(None),
    db: Session = Depends(get_db),
    _ = Depends(check_api_key)
):
    settings = get_settings()
    update_data = candidate_service.validate_candidate_payload({
        "first_name": first_name.strip() if first_name else None,
        "last_name": last_name.strip() if last_name else None,
        "contact": contact.strip() if contact else None,
        "email": email.strip() if email else None,
        "visa_status": visa_status, "skill_set": skill_set.strip() if skill_set else None,
        "relocation": relocation, "graduation_year": graduation_year,
        "employment_type": employment_type, "bill_rate": bill_rate,
    }, require_all=False)
    update_data = {k: v for k, v in update_data.items() if v is not None}

    existing = candidate_repository.get_candidate_by_id(db, unique_id)
    if not existing:
        raise HTTPException(status_code=404, detail=f"Candidate (ID: {unique_id}) not found.")

    if email and candidate_repository.check_duplicate_email(db, update_data["email"], exclude_id=unique_id):
        raise HTTPException(status_code=400, detail=f"Email '{update_data['email']}' already in use.")

    if resume and resume.filename:
        blob_client = azure_service.get_blob_service_client()
        raw_path = f"{settings.azure_raw_resume_path}{unique_id}/{resume.filename}"
        await azure_service.upload_blob_file(blob_client, raw_path, resume)
        azure_service.keep_only_latest_blob(blob_client, f"{settings.azure_raw_resume_path}{unique_id}/", raw_path)
        update_data.update({
            "raw_resume_path": raw_path, "formatted_resume_status": "processing",
            "formatted_resume_path": None, "formatted_resume_content": None,
            "formatted_resume_missing_field_details": [], "formatted_resume_llm_info": None,
            "formatted_resume_error": None, "formatted_resume_processed_at": datetime.utcnow(),
        })

    for doc_type, upload, sub in [("passport", passport, "passport"), ("work_authorization", work_authorization, "work auth"), ("id_proof", id_proof, "id proof")]:
        if upload and upload.filename:
            blob_client = azure_service.get_blob_service_client()
            blob_name = f"{settings.azure_confidential_documents_path}{unique_id}/{sub}/{upload.filename}"
            update_data[f"{doc_type}_url"] = await azure_service.upload_blob_file(blob_client, blob_name, upload)
            azure_service.keep_only_latest_blob(blob_client, f"{settings.azure_confidential_documents_path}{unique_id}/{sub}/", blob_name)

    if not candidate_repository.update_candidate(db, unique_id, update_data):
        raise HTTPException(status_code=404, detail=f"Candidate (ID: {unique_id}) not found.")

    if resume and resume.filename:
        background_tasks.add_task(candidate_service.launch_resume_formatter, unique_id, update_data["raw_resume_path"])

    # FIX 5: Invalidate caches after update
    from app.cache.redis_client import cache
    cache.delete_pattern("candidates_v5:*")
    cache.delete_pattern("candidates_v6:*")
    cache.delete_pattern(f"sas:{unique_id}:*")

    return {"status": "ok", "message": "Candidate updated successfully"}


@router.delete("/candidates/{unique_id}")
def delete_candidate_endpoint(unique_id: str, db: Session = Depends(get_db), _ = Depends(check_api_key)):
    candidate = candidate_repository.get_candidate_by_id(db, unique_id)
    if not candidate:
        raise HTTPException(status_code=404, detail=f"Candidate (ID: {unique_id}) not found.")

    try:
        blob_client = azure_service.get_blob_service_client()
        azure_service.delete_candidate_blobs(blob_client, unique_id)
    except Exception as e:
        logger.warning(f"Failed to clean up storage for candidate {unique_id}: {e}")

    if not candidate_repository.delete_candidate(db, unique_id):
        raise HTTPException(status_code=404, detail=f"Candidate (ID: {unique_id}) not found.")

    # FIX 5: Invalidate caches after deletion
    from app.cache.redis_client import cache
    cache.delete("candidates:*")
    cache.delete_pattern("candidates_v6:*")
    cache.delete(f"sas:{unique_id}:*")

    return {"status": "ok", "message": f"Candidate {unique_id} deleted successfully."}


@router.get("/candidates/{unique_id}/documents/{document_type}/view/{filename:path}")
@router.get("/candidates/{unique_id}/documents/{document_type}/view")
def view_candidate_document(unique_id: str, document_type: str, filename: str = None, db: Session = Depends(get_db)):
    """Generate a temporary SAS URL for a document and redirect to it (with 1h cache)."""
    from app.cache.redis_client import cache
    cache_key = f"sas:{unique_id}:{document_type}"
    cached_url = cache.get(cache_key)
    if cached_url:
        return RedirectResponse(url=cached_url)

    candidate = candidate_repository.get_candidate_by_id(db, unique_id)
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found.")

    blob_name = azure_service.get_document_blob_name(candidate, document_type)
    if not blob_name:
        raise HTTPException(status_code=404, detail=f"No {document_type} found for this candidate.")

    try:
        blob_service_client = azure_service.get_blob_service_client()
        
        # build_blob_access_url now handles existence check and fails loudly if SAS fails
        sas_url = azure_service.build_blob_access_url(blob_service_client, blob_name)
        
        # FIX 4: SAS URLs cached for 30 minutes max (1800s)
        cache.set(cache_key, sas_url, ttl=1800)
        return RedirectResponse(url=sas_url)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error generating SAS URL for {blob_name}: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate document access URL.")


@router.get("/candidates/{unique_id}/documents/{document_type}")
def get_candidate_document(unique_id: str, document_type: str, db: Session = Depends(get_db)):
    from fastapi.responses import StreamingResponse
    candidate = candidate_repository.get_candidate_by_id(db, unique_id)
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found.")

    blob_name = azure_service.get_document_blob_name(candidate, document_type)
    blob_client = azure_service.get_blob_service_client()
    client = blob_client.get_blob_client(container=get_settings().azure_container_name, blob=blob_name)
    
    try:
        props = client.get_blob_properties()
        media_type = azure_service.guess_media_type(blob_name, getattr(props.content_settings, "content_type", None))
        
        # Use StreamingResponse instead of readall() to be memory efficient and more reliable
        stream = client.download_blob()
        return StreamingResponse(
            stream.chunks(), 
            media_type=media_type, 
            headers={
                "Content-Disposition": f'inline; filename="{os.path.basename(blob_name)}"',
                "Cache-Control": "max-age=3600",
            }
        )
    except Exception as e:
        logger.error(f"Failed to stream blob {blob_name}: {e}")
        raise HTTPException(status_code=404, detail="Document not found or inaccessible.")


@router.post("/candidates/{unique_id}/formatted-resume/complete")
def complete_formatted_resume(unique_id: str, payload: dict = Body(...), db: Session = Depends(get_db), _ = Depends(check_api_key)):
    try:
        from services.resume_formatter import CandidateResumeFormatterService
        CandidateResumeFormatterService().complete_candidate_resume(unique_id, payload)

        candidate = candidate_repository.get_candidate_by_id(db, unique_id)
        if not candidate:
            raise HTTPException(status_code=404, detail="Candidate not found.")

        blob_client = azure_service.get_blob_service_client_safe()
        return {"status": "ok", "candidate": candidate_service.serialize_candidate(candidate, blob_client)}
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"Failed to complete formatted resume for {unique_id}: {exc}")
        raise HTTPException(status_code=500, detail="Unable to complete the formatted resume.")


@router.get("/candidates/{unique_id}/documents/{doc_type}")
def get_candidate_document(unique_id: str, doc_type: str, db: Session = Depends(get_db), _ = Depends(check_api_key)):
    """Proxy endpoint to stream candidate documents to the frontend for inline preview."""
    candidate = candidate_repository.get_candidate_by_id(db, unique_id)
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")
    
    blob_name = azure_service.get_document_blob_name(candidate, doc_type)
    blob_service_client = azure_service.get_blob_service_client()
    
    content = azure_service.download_blob(blob_service_client, blob_name)
    media_type = azure_service.guess_media_type(blob_name)
    
    return Response(content=content, media_type=media_type)
