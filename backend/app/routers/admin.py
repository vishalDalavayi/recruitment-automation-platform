"""
Admin Router
==============
Database table management and data clearing endpoints.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.dependencies import get_db, check_api_key
from app.repositories import job_repository
from app.config import logger

router = APIRouter(tags=["Admin"], dependencies=[Depends(check_api_key)])

VALID_TABLES = [
    "input_active", "input_inactive", "active_dice_jobs", "inactive_dice_jobs",
    "active_scraped_data", "inactive_scraped_data", "scraper_logs", "candidates",
]


def _validate_table(table_name: str):
    if table_name not in VALID_TABLES:
        raise HTTPException(status_code=400, detail=f"Invalid table name. Must be one of: {VALID_TABLES}")


@router.post("/clear-data")
def clear_data(db: Session = Depends(get_db)):
    try:
        job_repository.clear_table(db, "active_scraped_data")
        job_repository.clear_table(db, "inactive_scraped_data")
        logger.info("Cleared all scraped data tables")
        return {"status": "ok", "message": "All scraped data cleared"}
    except Exception as e:
        logger.error(f"Failed to clear data: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/db/tables")
def get_db_tables(db: Session = Depends(get_db)):
    try:
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
        counts = {}
        for t in tables:
            try:
                if t["name"] == "candidates":
                    from app.repositories.candidate_repository import get_candidate_count
                    counts[t["name"]] = get_candidate_count(db)
                else:
                    counts[t["name"]] = job_repository.get_fast_count(db, t["name"])
            except Exception:
                counts[t["name"]] = 0
        return {"tables": tables, "counts": counts}
    except Exception as e:
        logger.error(f"Failed to fetch tables: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/db/tables/{table_name}")
def get_table_data(table_name: str, page: int = 1, limit: int = 50, db: Session = Depends(get_db)):
    _validate_table(table_name)
    try:
        records, total, columns = job_repository.get_table_data(db, table_name, page, limit)
        return {"records": records, "columns": columns, "total": total, "page": page, "limit": limit}
    except Exception as e:
        logger.error(f"Failed to fetch table {table_name}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/db/tables/{table_name}")
def delete_table_data(table_name: str, db: Session = Depends(get_db)):
    _validate_table(table_name)
    try:
        job_repository.clear_table(db, table_name)
        return {"status": "ok", "message": f"Cleared all data from {table_name}"}
    except Exception as e:
        logger.error(f"Failed to clear table {table_name}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/db/tables/{table_name}/info")
def get_table_info(table_name: str, db: Session = Depends(get_db)):
    _validate_table(table_name)
    try:
        info = job_repository.get_table_info(db, table_name)
        if not info:
            raise HTTPException(status_code=404, detail="Table not found")
        return info
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get table info for {table_name}: {e}")
        raise HTTPException(status_code=500, detail=str(e))
