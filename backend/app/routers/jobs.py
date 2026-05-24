"""
Jobs Router
=============
Endpoints for job listing, detail, and filters.
"""

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.dependencies import get_db, check_api_key
from app.repositories import job_repository
from app.config import logger

router = APIRouter(tags=["Jobs"], dependencies=[Depends(check_api_key)])


@router.get("/jobs")
def get_jobs(
    page: int = 1,
    limit: int = 20,
    last_id: Optional[int] = None,
    search: Optional[str] = None,
    company: Optional[str] = None,
    location: Optional[str] = None,
    vendor: Optional[str] = None,
    job_type: Optional[str] = None,
    db: Session = Depends(get_db),
):
    from app.cache.redis_client import cache
    cache_key = f"jobs:list:{page}:{limit}:{search}:{company}:{location}:{vendor}:{job_type}:{last_id}"
    cached = cache.get(cache_key)
    if cached:
        return cached

    try:
        jobs, total, next_last_id = job_repository.get_jobs_paginated(
            db, page=page, limit=limit, get_total=True,
            search=search, company=company, location=location,
            vendor=vendor, job_type=job_type, last_id=last_id,
        )
        result = {"jobs": jobs, "page": page, "limit": limit, "total": total, "next_last_id": next_last_id}
        cache.set(cache_key, result, ttl=60) # Increased to 60s for stability
        return result
    except Exception as e:
        logger.error(f"Failed to fetch jobs: {e}")
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")


@router.get("/jobs/filters")
def get_job_filters(db: Session = Depends(get_db)):
    try:
        return job_repository.get_unique_filters(db)
    except Exception as e:
        logger.error(f"Failed to fetch filters: {e}")
        raise HTTPException(status_code=500, detail="Failed to load filters")


@router.get("/jobs/{serial_no}")
def get_job_detail(serial_no: int, job_type: str, db: Session = Depends(get_db)):
    try:
        job = job_repository.get_job_detail(db, serial_no, job_type)
        if job:
            job["type"] = job_type
            return {"job": job}
        raise HTTPException(status_code=404, detail="Job not found")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to fetch job detail: {e}")
        raise HTTPException(status_code=500, detail="Failed to load job detail")
