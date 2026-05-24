"""
Candidate Repository — Data Access Layer
==========================================
"""

import os
import secrets
from typing import Optional, List
from sqlalchemy.orm import Session, joinedload, defer
from sqlalchemy import func
from app.models.candidates import Candidate, FormattingResumeInfo
from app.models.base import CANDIDATE_SCHEMA
from app.config import logger

FORMATTED_RESUME_CANDIDATE_COLUMNS = {
    "formatted_resume_status", "formatted_resume_path", "formatted_resume_content",
    "formatted_resume_missing_field_details", "formatted_resume_llm_info",
    "formatted_resume_error", "formatted_resume_processed_at",
}


def generate_unique_id(db: Session) -> str:
    for _ in range(10):
        uid = f"{secrets.randbelow(10 ** 20):020d}"
        exists = db.query(Candidate.unique_id).filter(Candidate.unique_id == uid).first()
        if not exists:
            return uid
    raise RuntimeError("Unable to generate a unique candidate identifier")


def get_candidate_by_id(db: Session, unique_id: str) -> Optional[Candidate]:
    return db.query(Candidate).filter(Candidate.unique_id == unique_id).first()


def get_candidate_by_email(db: Session, email: str) -> Optional[Candidate]:
    return db.query(Candidate.unique_id).filter(Candidate.email == email).first()


def check_duplicate_email(db: Session, email: str, exclude_id: Optional[str] = None):
    q = db.query(Candidate.unique_id).filter(Candidate.email == email)
    if exclude_id:
        q = q.filter(Candidate.unique_id != exclude_id)
    return q.first()


def get_candidates_paginated(
    db: Session,
    search: Optional[str] = None,
    page: int = 1,
    limit: int = 20,
):
    from sqlalchemy.sql import text

    offset = (page - 1) * limit
    schema = CANDIDATE_SCHEMA

    where_clauses = ["1=1"]
    params = {"limit": limit, "offset": offset}

    if search:
        where_clauses.append(
            "(CONCAT(c.first_name, ' ', c.last_name) ILIKE :search"
            " OR c.email ILIKE :search"
            " OR c.contact ILIKE :search"
            " OR c.skill_set ILIKE :search"
            " OR c.visa_status ILIKE :search"
            " OR c.unique_id ILIKE :search)"
        )
        params["search"] = f"%{search}%"

    where = " AND ".join(where_clauses)

    # Fast count: pg_class estimate if no filter, else COUNT
    if search:
        try:
            count_result = db.execute(
                text(f'SELECT COUNT(*) FROM "{schema}".candidate_basic_info c WHERE {where}'),
                params,
            )
            total = count_result.fetchone()[0]
        except Exception:
            db.rollback()
            total = 0
    else:
        total = get_candidate_count(db)

    query = text(f"""
        SELECT c.unique_id, c.first_name, c.last_name, c.contact, c.email,
               c.visa_status, c.skill_set, c.relocation, c.graduation_year,
               c.employment_type, c.bill_rate, c.raw_resume_path,
               c.passport_url, c.work_authorization_url, c.id_proof_url, c.created_at
        FROM "{schema}".candidate_basic_info c
        WHERE {where}
        ORDER BY c.created_at DESC
        LIMIT :limit OFFSET :offset
    """)

    # Retry once on connection failure (remote DB drops connections)
    for attempt in range(2):
        try:
            result = db.execute(query, params)
            rows = result.fetchall()
            candidates = [_CandidateRow(row._mapping) for row in rows]
            return candidates, total
        except Exception as e:
            db.rollback()  # Reset the dead connection
            if attempt == 0:
                logger.warning(f"Candidate query failed (retrying): {e}")
                import time
                time.sleep(1)
            else:
                raise


class _CandidateRow:
    """Lightweight stand-in for the Candidate ORM object for list serialization."""
    def __init__(self, mapping):
        self.unique_id = mapping["unique_id"]
        self.first_name = mapping.get("first_name")
        self.last_name = mapping.get("last_name")
        self.contact = mapping.get("contact")
        self.email = mapping.get("email")
        self.visa_status = mapping.get("visa_status")
        self.skill_set = mapping.get("skill_set")
        self.relocation = mapping.get("relocation")
        self.graduation_year = mapping.get("graduation_year")
        self.employment_type = mapping.get("employment_type")
        self.bill_rate = mapping.get("bill_rate")
        self.raw_resume_path = mapping.get("raw_resume_path")
        self.passport_url = mapping.get("passport_url")
        self.work_authorization_url = mapping.get("work_authorization_url")
        self.id_proof_url = mapping.get("id_proof_url")
        self.created_at = mapping.get("created_at")
        # Formatting fields — not loaded in list (fetched on detail view)
        self.formatted_resume_status = "not_started"
        self.formatted_resume_path = None
        self.formatted_resume_file_name = None
        self.formatted_resume_content = None
        self.formatted_resume_missing_field_details = []
        self.formatted_resume_llm_info = None
        self.formatted_resume_error = None
        self.formatted_resume_processed_at = None


def add_candidate(db: Session, candidate_data: dict) -> str:
    data = dict(candidate_data)
    data.setdefault("unique_id", generate_unique_id(db))

    candidate_columns = {c.name for c in Candidate.__table__.columns}
    formatter_data = {
        k: data.pop(k)
        for k in list(data.keys())
        if k in FORMATTED_RESUME_CANDIDATE_COLUMNS
        or k == "source_raw_resume_path"
        or k == "formatted_resume_file_name"
    }

    candidate = Candidate(**{k: v for k, v in data.items() if k in candidate_columns})
    candidate.formatted_resume_info = FormattingResumeInfo(
        unique_id=candidate.unique_id,
        source_raw_resume_path=formatter_data.get("source_raw_resume_path") or candidate.raw_resume_path,
        formatted_resume_status=formatter_data.get("formatted_resume_status", "not_started"),
        formatted_resume_path=formatter_data.get("formatted_resume_path"),
        formatted_resume_content=formatter_data.get("formatted_resume_content"),
        missing_field_details=formatter_data.get("formatted_resume_missing_field_details", []),
        llm_info=formatter_data.get("formatted_resume_llm_info"),
        processing_error=formatter_data.get("formatted_resume_error"),
        formatted_resume_processed_at=formatter_data.get("formatted_resume_processed_at"),
    )
    db.add(candidate)
    db.commit()
    return candidate.unique_id


def update_candidate(db: Session, unique_id: str, data: dict) -> bool:
    candidate = db.query(Candidate).filter(Candidate.unique_id == unique_id).first()
    if not candidate:
        return False

    formatter_data = {}
    for key, value in data.items():
        if hasattr(candidate, key):
            setattr(candidate, key, value)
        elif key in FORMATTED_RESUME_CANDIDATE_COLUMNS or key == "source_raw_resume_path":
            formatter_data[key] = value

    if "raw_resume_path" in data and "source_raw_resume_path" not in formatter_data:
        formatter_data["source_raw_resume_path"] = data["raw_resume_path"]

    if formatter_data:
        info = candidate._ensure_formatted_resume_info()
        field_mapping = {
            "formatted_resume_status": "formatted_resume_status",
            "formatted_resume_path": "formatted_resume_path",
            "formatted_resume_content": "formatted_resume_content",
            "formatted_resume_missing_field_details": "missing_field_details",
            "formatted_resume_llm_info": "llm_info",
            "formatted_resume_error": "processing_error",
            "formatted_resume_processed_at": "formatted_resume_processed_at",
            "source_raw_resume_path": "source_raw_resume_path",
        }
        for key, value in formatter_data.items():
            mapped = field_mapping.get(key)
            if mapped:
                setattr(info, mapped, value)
    db.commit()
    return True


def delete_candidate(db: Session, unique_id: str) -> bool:
    candidate = db.query(Candidate).filter(Candidate.unique_id == unique_id).first()
    if not candidate:
        return False
    db.delete(candidate)
    db.commit()
    return True


def get_candidate_count(db: Session) -> int:
    """Use pg_class estimate for instant count (< 1ms)."""
    from sqlalchemy.sql import text
    try:
        result = db.execute(
            text("SELECT reltuples::bigint FROM pg_class WHERE relname = 'candidate_basic_info'")
        )
        row = result.fetchone()
        return max(row[0], 0) if row else 0
    except Exception:
        return db.query(func.count(Candidate.unique_id)).scalar() or 0


def get_tailored_resume_count(db: Session) -> int:
    return (
        db.query(func.count(Candidate.unique_id))
        .join(FormattingResumeInfo, Candidate.unique_id == FormattingResumeInfo.unique_id)
        .filter(FormattingResumeInfo.formatted_resume_status == "completed")
        .scalar() or 0
    )
