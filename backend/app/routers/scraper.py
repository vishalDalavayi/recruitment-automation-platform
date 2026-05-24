"""
Scraper Router
================
Trigger, stop, status, checker, and scheduler endpoints.
"""

import threading
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.dependencies import get_db, check_api_key
from app.repositories import scraper_log_repository
from app.config import logger

router = APIRouter(tags=["Scraper"], dependencies=[Depends(check_api_key)])

# These are injected by the app factory based on run mode
_app_state = None
_scraper_config = None
_state_lock = threading.Lock()
_scheduler_mgr = None


def configure_scraper_router(app_state, scraper_config, scheduler_mgr=None):
    """Called by app factory to inject shared state."""
    global _app_state, _scraper_config, _scheduler_mgr
    _app_state = app_state
    _scraper_config = scraper_config
    _scheduler_mgr = scheduler_mgr


@router.get("/status")
async def get_status():
    res = {"status": "idle", "task": "Ready"}
    if _app_state:
        res = _app_state.to_dict()
    
    # Inject scheduler status if available
    if _scheduler_mgr:
        res["scraper"] = await _scheduler_mgr.get_job_status("daily_scraper_pipeline")
        res["cleaner"] = await _scheduler_mgr.get_job_status("daily_cleaner_pipeline")
    
    # Inject live cleaner progress if running
    from services.scraper.checker import cleaner_state
    res["cleaner_progress"] = cleaner_state.to_dict()
        
    return res


@router.post("/trigger")
def trigger_scrape():
    if _app_state is None:
        raise HTTPException(status_code=503, detail="Scraper not available in API-only mode")

    with _state_lock:
        if _app_state.status in ("running", "starting"):
            return {"message": "Scraper already running"}
        _app_state.update(status="starting")

    from services.scraper.service import run_pipeline_sync
    threading.Thread(
        target=lambda: run_pipeline_sync(dict(_scraper_config), triggered_by="manual"),
        daemon=True,
    ).start()
    return {"message": "Scraper started"}


@router.post("/stop")
def stop_scrape():
    if _app_state is None:
        raise HTTPException(status_code=503, detail="Scraper not available in API-only mode")

    with _state_lock:
        if _app_state.status in ("running", "starting"):
            _app_state.update(stop_requested=True)
            return {"message": "Stop requested"}
    return {"message": "Scraper is not running"}


@router.post("/checker/start")
def start_checker():
    from services.scraper.checker import run_checker_cleaner_sync
    threading.Thread(target=run_checker_cleaner_sync, daemon=True).start()
    return {"message": "Job Checker + Cleaner started in background"}


@router.get("/scraper/logs")
def get_scraper_logs(limit: int = 50, db: Session = Depends(get_db)):
    try:
        return scraper_log_repository.get_scraper_logs(db, limit)
    except Exception as e:
        logger.error(f"Failed to fetch scraper logs: {e}")
        raise HTTPException(status_code=500, detail="Failed to load scraper logs")


@router.get("/scheduler/status")
async def get_scheduler_status():
    if _scheduler_mgr is None:
        return {"status": "not_available", "message": "Scheduler not running in this service"}
    return {
        "scraper": await _scheduler_mgr.get_job_status("daily_scraper_pipeline"),
        "cleaner": await _scheduler_mgr.get_job_status("daily_cleaner_pipeline")
    }

@router.post("/trigger/scraper")
async def trigger_scraper():
    if not _scheduler_mgr:
        raise HTTPException(status_code=503, detail="Scheduler not available")
    success = await _scheduler_mgr.trigger_job_now("daily_scraper_pipeline")
    return {"message": "Scraper triggered" if success else "Job not found"}

@router.post("/trigger/cleaner")
async def trigger_cleaner():
    if not _scheduler_mgr:
        raise HTTPException(status_code=503, detail="Scheduler not available")
    success = await _scheduler_mgr.trigger_job_now("daily_cleaner_pipeline")
    return {"message": "Cleaner triggered" if success else "Job not found"}
