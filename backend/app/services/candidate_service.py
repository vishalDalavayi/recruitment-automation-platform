"""
Candidate Service — Business Logic
=====================================
Serialization, validation, and formatting orchestration.
"""

import re
from datetime import datetime
from decimal import Decimal, InvalidOperation
from typing import Optional
from fastapi import HTTPException
from sqlalchemy.orm import Session
from app.models.candidates import Candidate
from app.services.azure_service import build_blob_access_url, get_blob_service_client_safe
from app.config import logger

VISA_STATUS_OPTIONS = {"US Citizen", "Green Card", "H1B", "OPT", "CPT", "L2", "EAD", "Other"}
RELOCATION_OPTIONS = {"Yes", "No"}
EMPLOYMENT_TYPE_OPTIONS = {"Existing", "New"}
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
CONTACT_RE = re.compile(r"^[0-9+\-() ]+$")


def validate_candidate_payload(payload: dict, require_all: bool = True) -> dict:
    """Validate candidate form data. Raises HTTPException on invalid input."""
    required_fields = (
        "first_name", "last_name", "contact", "email", "visa_status",
        "skill_set", "relocation", "graduation_year", "employment_type",
    )

    for field in required_fields:
        value = payload.get(field)
        if require_all and (value is None or str(value).strip() == ""):
            raise HTTPException(status_code=400, detail=f"{field} is required for candidate registration.")

    if payload.get("email") is not None:
        email = str(payload["email"]).strip()
        if not EMAIL_RE.match(email):
            raise HTTPException(status_code=400, detail="A valid email address is required.")
        payload["email"] = email

    if payload.get("contact") is not None:
        contact = str(payload["contact"]).strip()
        if not CONTACT_RE.match(contact):
            raise HTTPException(status_code=400, detail="contact may contain only digits, spaces, +, -, and parentheses.")
        payload["contact"] = contact

    if payload.get("visa_status") is not None and payload["visa_status"] not in VISA_STATUS_OPTIONS:
        raise HTTPException(status_code=400, detail=f"visa_status must be one of: {', '.join(sorted(VISA_STATUS_OPTIONS))}.")

    if payload.get("relocation") is not None and payload["relocation"] not in RELOCATION_OPTIONS:
        raise HTTPException(status_code=400, detail=f"relocation must be one of: {', '.join(sorted(RELOCATION_OPTIONS))}.")

    if payload.get("employment_type") is not None and payload["employment_type"] not in EMPLOYMENT_TYPE_OPTIONS:
        raise HTTPException(status_code=400, detail=f"employment_type must be one of: {', '.join(sorted(EMPLOYMENT_TYPE_OPTIONS))}.")

    if payload.get("graduation_year") is not None:
        try:
            gy = int(payload["graduation_year"])
        except (TypeError, ValueError):
            raise HTTPException(status_code=400, detail="graduation_year must be an integer.")
        if gy < 1950 or gy > 2100:
            raise HTTPException(status_code=400, detail="graduation_year must be between 1950 and 2100.")
        payload["graduation_year"] = gy

    bill_rate = payload.get("bill_rate")
    if bill_rate is not None:
        if str(bill_rate).strip() == "":
            payload["bill_rate"] = None
        else:
            try:
                parsed = Decimal(str(bill_rate))
            except (InvalidOperation, ValueError):
                raise HTTPException(status_code=400, detail="bill_rate must be a valid decimal value.")
            if parsed <= 0:
                raise HTTPException(status_code=400, detail="bill_rate must be a positive value.")
            payload["bill_rate"] = parsed

    return payload


def serialize_candidate(candidate: Candidate, blob_service_client=None, include_content: bool = True) -> dict:
    """Serialize a Candidate ORM object to API response dict."""
    full_name = " ".join(p for p in [candidate.first_name, candidate.last_name] if p).strip()

    # We use proxy URLs by default to avoid expensive SAS generation for every row in lists.
    # However, if blob_service_client is provided (detail view), we generate real SAS URLs.
    def get_doc_url(doc_type, raw_value):
        if not raw_value: return None
        
        # Sanitize path/URL to get the actual blob name
        from app.services.azure_service import get_blob_name_from_url
        path = get_blob_name_from_url(raw_value)
        if not path: return None

        ext = path.split('.')[-1].lower() if '.' in path else 'bin'
        
        if blob_service_client:
            try:
                from app.services.azure_service import build_blob_access_url
                url = build_blob_access_url(blob_service_client, path)
                # Append extension hint for frontend detection logic
                separator = "&" if "?" in url else "?"
                return f"{url}{separator}file_ext={ext}"
            except Exception as e:
                logger.warning(f"Failed to generate SAS URL for {path}: {e}")
        
        # Fallback to proxy (already has .ext in the path)
        return f"/candidates/{candidate.unique_id}/documents/{doc_type}/view/file.{ext}"

    resume_url = get_doc_url("resume", candidate.raw_resume_path)
    formatted_resume_url = get_doc_url("formatted_resume", candidate.formatted_resume_path)
    passport_url = get_doc_url("passport", candidate.passport_url)
    work_authorization_url = get_doc_url("work_authorization", candidate.work_authorization_url)
    id_proof_url = get_doc_url("id_proof", candidate.id_proof_url)

    result = {
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
        "formatted_resume_content": candidate.formatted_resume_content if include_content else None,
        "formatted_resume_missing_field_details": candidate.formatted_resume_missing_field_details or [],
        "formatted_resume_llm_info": candidate.formatted_resume_llm_info,
        "formatted_resume_error": candidate.formatted_resume_error,
        "formatted_resume_processed_at": (
            candidate.formatted_resume_processed_at.isoformat()
            if candidate.formatted_resume_processed_at
            else None
        ),
        "passport_url": passport_url,
        "work_authorization_url": work_authorization_url,
        "id_proof_url": id_proof_url,
    }
    return result


def launch_resume_formatter(unique_id: str, raw_resume_path: str):
    """Background task to format a candidate's resume via LLM."""
    try:
        from services.resume_formatter import CandidateResumeFormatterService
        formatter_service = CandidateResumeFormatterService()
        formatter_service.process_candidate_resume(unique_id, raw_resume_path)
    except Exception as exc:
        logger.error(f"Resume formatter failed for candidate {unique_id}: {exc}")
        from app.models.base import SessionLocal
        from app.repositories import candidate_repository
        db = SessionLocal()
        try:
            candidate_repository.update_candidate(db, unique_id, {
                "formatted_resume_status": "failed",
                "formatted_resume_error": str(exc),
                "formatted_resume_processed_at": datetime.utcnow(),
            })
        finally:
            db.close()
