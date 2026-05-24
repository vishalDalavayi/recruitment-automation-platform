"""
Job Repository — Data Access Layer
====================================
All job-related database queries. Takes Session as parameter.
"""

import time
from typing import Optional, List, Tuple, Any, Dict
from sqlalchemy.orm import Session
from sqlalchemy.sql import text
from app.models.base import DB_SCHEMA
from app.models.jobs import (
    InputActive, InputInactive, ActiveDiceJobs, InactiveDiceJobs,
    ActiveScrapedData, InactiveScrapedData, ScraperLog,
)
from app.config import logger

# Simple in-memory cache for filters
_FILTER_CACHE = {"data": None, "timestamp": 0}
CACHE_TTL = 300


MODEL_MAP = {
    "input_active": InputActive,
    "input_inactive": InputInactive,
    "active_dice_jobs": ActiveDiceJobs,
    "inactive_dice_jobs": InactiveDiceJobs,
    "active_scraped_data": ActiveScrapedData,
    "inactive_scraped_data": InactiveScrapedData,
    "scraper_logs": ScraperLog,
}

VALID_TABLE_NAMES = list(MODEL_MAP.keys()) + ["candidates"]


def _get_model(table_name: str):
    return MODEL_MAP.get(table_name)


def _get_schema_and_table(table_name: str):
    model = _get_model(table_name)
    if not model:
        return None, None, None
    table = model.__table__
    schema = table.schema or DB_SCHEMA
    return model, schema, table.name


def get_fast_count(db: Session, table_name: str) -> int:
    """Use pg_class reltuples for instant row count estimate (< 1ms)."""
    model, schema, actual = _get_schema_and_table(table_name)
    if not model:
        return 0
    try:
        result = db.execute(
            text("SELECT reltuples::bigint FROM pg_class WHERE relname = :table_name"),
            {"table_name": actual},
        )
        row = result.fetchone()
        count = row[0] if row else 0
        return max(count, 0)
    except Exception as e:
        logger.warning(f"pg_class count failed for {table_name}, falling back to COUNT: {e}")
        try:
            result = db.execute(text(f'SELECT COUNT(*) FROM "{schema}"."{actual}"'))
            return result.fetchone()[0]
        except Exception:
            return 0


def get_jobs_paginated(
    db: Session,
    page: int = 1,
    limit: int = 20,
    get_total: bool = True,
    search: Optional[str] = None,
    company: Optional[str] = None,
    location: Optional[str] = None,
    vendor: Optional[str] = None,
    job_type: Optional[str] = None,
    last_id: Optional[int] = None,
) -> Tuple[List[dict], int, Optional[int]]:
    """Fetches jobs with server-side filtering and pagination."""
    cols = "s.title, s.company, s.location, s.job_type, s.posted_date, s.keyword"

    where_active = ["1=1"]
    where_inactive = ["1=1"]
    params: Dict[str, Any] = {"limit": limit}

    include_active = job_type in [None, "active", "both"]
    include_inactive = job_type in [None, "inactive", "both"]

    if search:
        where_active.append("(s.title ILIKE :search OR s.company ILIKE :search)")
        where_inactive.append("(s.title ILIKE :search OR s.company ILIKE :search)")
        params["search"] = f"%{search}%"
    if company:
        where_active.append("s.company = :company")
        where_inactive.append("s.company = :company")
        params["company"] = company
    if location:
        where_active.append("s.location = :location")
        where_inactive.append("s.location = :location")
        params["location"] = location
    if vendor:
        where_active.append("i.vendor_name = :vendor")
        where_inactive.append("i.vendor_name = :vendor")
        params["vendor"] = vendor
    if last_id is not None:
        where_active.append("s.serial_no < :last_id")
        where_inactive.append("s.serial_no < :last_id")
        params["last_id"] = last_id

    wa = " AND ".join(where_active)
    wi = " AND ".join(where_inactive)

    parts = []
    if include_active:
        parts.append(f"""
            SELECT {cols}, i.vendor_name as vendor, 'active' as type, s.serial_no as serial_no
            FROM {DB_SCHEMA}.active_scraped_data s
            LEFT JOIN {DB_SCHEMA}.input_active i ON s.keyword = i.dice_search_link
            WHERE {wa}
        """)
    if include_inactive:
        parts.append(f"""
            SELECT {cols}, i.vendor_name as vendor, 'inactive' as type, s.serial_no as serial_no
            FROM {DB_SCHEMA}.inactive_scraped_data s
            LEFT JOIN {DB_SCHEMA}.input_inactive i ON s.keyword = i.dice_job_link
            WHERE {wi}
        """)

    if not parts:
        return [], 0, None

    offset = (page - 1) * limit
    params["offset"] = offset

    query = " UNION ALL ".join(parts) + " ORDER BY serial_no DESC LIMIT :limit OFFSET :offset"

    # Execute with retry logic
    for attempt in range(2):
        try:
            result = db.execute(text(query), params)
            rows = result.fetchall()
            break
        except Exception as e:
            db.rollback()
            if attempt == 0:
                logger.warning(f"Jobs query failed (retrying): {e}")
                import time
                time.sleep(1)
            else:
                raise

    total = 0
    if get_total and page == 1:
        # Optimization: Use fast estimate if no search/vendor filtering
        if not search and not vendor and not company and not location:
            active_count = get_fast_count(db, "active_scraped_data") if include_active else 0
            inactive_count = get_fast_count(db, "inactive_scraped_data") if include_inactive else 0
            total = active_count + inactive_count
        else:
            count_parts = []
            if include_active:
                join_clause = f"LEFT JOIN {DB_SCHEMA}.input_active i ON s.keyword = i.dice_search_link" if vendor else ""
                count_parts.append(
                    f"SELECT COUNT(*) FROM {DB_SCHEMA}.active_scraped_data s {join_clause} WHERE {wa.replace('s.serial_no < :last_id', '1=1')}"
                )
            if include_inactive:
                join_clause = f"LEFT JOIN {DB_SCHEMA}.input_inactive i ON s.keyword = i.dice_job_link" if vendor else ""
                count_parts.append(
                    f"SELECT COUNT(*) FROM {DB_SCHEMA}.inactive_scraped_data s {join_clause} WHERE {wi.replace('s.serial_no < :last_id', '1=1')}"
                )
            count_query = "SELECT (" + ") + (".join(count_parts) + ") as total"
            count_params = {k: v for k, v in params.items() if k != "last_id"}
            
            # Count also gets a retry
            for attempt in range(2):
                try:
                    total_result = db.execute(text(count_query), count_params)
                    total = total_result.fetchone()[0]
                    break
                except Exception:
                    db.rollback()
                    if attempt == 1: total = 0
                    import time
                    time.sleep(1)

    records = []
    next_last_id = None
    for row in rows:
        rec = dict(row._mapping)
        next_last_id = rec.get("serial_no")
        records.append(rec)

    return records, total, next_last_id


def get_job_detail(db: Session, serial_no: int, job_type: str) -> Optional[dict]:
    """Get full job details including heavy fields."""
    if job_type == "active":
        result = db.execute(
            text(f"""
                SELECT s.*, i.vendor_name as vendor
                FROM {DB_SCHEMA}.active_scraped_data s
                LEFT JOIN {DB_SCHEMA}.input_active i ON s.keyword = i.dice_search_link
                WHERE s.serial_no = :serial_no
            """),
            {"serial_no": serial_no},
        )
    else:
        result = db.execute(
            text(f"""
                SELECT s.*, i.vendor_name as vendor
                FROM {DB_SCHEMA}.inactive_scraped_data s
                LEFT JOIN {DB_SCHEMA}.input_inactive i ON s.keyword = i.dice_job_link
                WHERE s.serial_no = :serial_no
            """),
            {"serial_no": serial_no},
        )

    row = result.fetchone()
    return dict(row._mapping) if row else None


def get_unique_filters(db: Session) -> dict:
    """Get unique filter values — cached for 5 minutes."""
    global _FILTER_CACHE
    now = time.time()
    if _FILTER_CACHE["data"] and (now - _FILTER_CACHE["timestamp"]) < CACHE_TTL:
        return _FILTER_CACHE["data"]

    companies_q = f"""
        SELECT DISTINCT company FROM {DB_SCHEMA}.active_scraped_data WHERE company IS NOT NULL
        UNION
        SELECT DISTINCT company FROM {DB_SCHEMA}.inactive_scraped_data WHERE company IS NOT NULL
    """
    companies = [r[0] for r in db.execute(text(companies_q)).fetchall() if r[0]]

    locations_q = f"""
        SELECT DISTINCT location FROM {DB_SCHEMA}.active_scraped_data WHERE location IS NOT NULL
        UNION
        SELECT DISTINCT location FROM {DB_SCHEMA}.inactive_scraped_data WHERE location IS NOT NULL
    """
    locations = [r[0] for r in db.execute(text(locations_q)).fetchall() if r[0]]

    vendors_q = f"""
        SELECT DISTINCT vendor_name FROM {DB_SCHEMA}.input_active i
        WHERE EXISTS (SELECT 1 FROM {DB_SCHEMA}.active_scraped_data s WHERE s.keyword = i.dice_search_link)
        UNION
        SELECT DISTINCT vendor_name FROM {DB_SCHEMA}.input_inactive i
        WHERE EXISTS (SELECT 1 FROM {DB_SCHEMA}.inactive_scraped_data s WHERE s.keyword = i.dice_job_link)
    """
    vendors = [r[0] for r in db.execute(text(vendors_q)).fetchall() if r[0]]

    res = {
        "companies": sorted(set(companies)),
        "locations": sorted(set(locations)),
        "vendors": sorted(set(vendors)),
    }
    _FILTER_CACHE["data"] = res
    _FILTER_CACHE["timestamp"] = now
    return res


def get_table_data(db: Session, table_name: str, page: int = 1, limit: int = 50):
    """Generic table data retrieval using ORM for robustness."""
    from app.models.candidates import Candidate
    if table_name == "candidates":
        model = Candidate
    else:
        model = _get_model(table_name)
    
    if not model:
        return [], 0, []

    # Use ORM query for automatic quoting and schema handling
    query = db.query(model)
    
    # Identify primary key for sorting
    pk = next(iter(model.__table__.primary_key.columns), None)
    if pk is not None:
        query = query.order_by(pk.desc())
    else:
        # Fallback to first column
        first_col = model.__table__.columns[0]
        query = query.order_by(first_col.desc())

    total = 0
    if page == 1:
        total = query.count()

    offset = (page - 1) * limit
    records_obj = query.offset(offset).limit(limit).all()
    
    columns = [c.name for c in model.__table__.columns]
    records = []
    for obj in records_obj:
        # Convert ORM object to dict, including only table columns
        rec = {col: getattr(obj, col) for col in columns}
        records.append(rec)

    return records, total, columns


def get_table_info(db: Session, table_name: str) -> Optional[dict]:
    from app.models.candidates import Candidate
    if table_name == "candidates":
        model = Candidate
    else:
        model = _get_model(table_name)
    
    if not model:
        return None

    col_info = [
        {"name": c.name, "type": str(c.type), "nullable": c.nullable, "primary_key": c.primary_key}
        for c in model.__table__.columns
    ]
    row_count = db.query(model).count()
    
    # Extract schema and name from table metadata
    actual_table_name = model.__table__.name
    from app.models.base import DB_SCHEMA
    schema = getattr(model.__table__, "schema", None) or DB_SCHEMA

    return {"columns": col_info, "row_count": row_count, "table_name": actual_table_name, "schema": schema}


def clear_table(db: Session, table_name: str):
    from app.models.candidates import Candidate
    if table_name == "candidates":
        model = Candidate
    else:
        model = _get_model(table_name)
    
    if not model:
        return
    
    db.query(model).delete(synchronize_session=False)
    db.commit()
