"""
Settings Router
=================
Configuration management and init/stats endpoints.
"""

import re
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.dependencies import get_db, check_api_key
from app.services import stats_service
from app.config import logger

router = APIRouter(tags=["Settings"], dependencies=[Depends(check_api_key)])

# Injected by app factory
_app_state = None
_scraper_config = None
_scheduler_mgr = None

DATE_RANGE_MAP = {
    "24h": "Today", "3d": "Last 3 Days", "7d": "Last 7 Days", "14d": "Last 14 Days",
    "1": "Today", "3": "Last 3 Days", "7": "Last 7 Days", "14": "Last 14 Days",
    "ONE": "Today", "THREE": "Last 3 Days", "SEVEN": "Last 7 Days", "FOURTEEN": "Last 14 Days",
}


def configure_settings_router(app_state, scraper_config, scheduler_mgr=None):
    global _app_state, _scraper_config, _scheduler_mgr
    _app_state = app_state
    _scraper_config = scraper_config
    _scheduler_mgr = scheduler_mgr


@router.get("/init")
def get_initial_data(db: Session = Depends(get_db)):
    return stats_service.get_init_data(db, _scraper_config or {}, _app_state)


@router.get("/stats")
def get_stats(db: Session = Depends(get_db)):
    return stats_service.get_stats(db, _scraper_config or {})


@router.get("/settings")
def get_settings_endpoint():
    return _scraper_config or {}


@router.post("/settings")
async def update_settings(payload: dict):
    if _scraper_config is None:
        raise HTTPException(status_code=503, detail="Settings not available")

    allowed = {
        "date_range", "max_search_pages", "max_workers", 
        "request_timeout", "scrape_cooldown", "schedule_enabled", 
        "schedule_time", "cleaner_schedule_time"
    }
    updated = {}

    for key, val in payload.items():
        if key not in allowed:
            continue

        if key == "date_range":
            if val not in DATE_RANGE_MAP:
                raise HTTPException(status_code=400, detail=f"Invalid date_range '{val}'")
            _scraper_config["date_range"] = val
            _scraper_config["date_range_label"] = DATE_RANGE_MAP[val]
            updated[key] = val

        elif key == "schedule_enabled":
            is_enabled = bool(val)
            if _scraper_config.get(key) != is_enabled:
                _scraper_config[key] = is_enabled
                if _scheduler_mgr:
                    try:
                        if is_enabled:
                            await _scheduler_mgr.resume_job("daily_scraper_pipeline")
                            await _scheduler_mgr.resume_job("daily_cleaner_pipeline")
                        else:
                            await _scheduler_mgr.pause_job("daily_scraper_pipeline")
                            await _scheduler_mgr.pause_job("daily_cleaner_pipeline")
                    except:
                        pass
            updated[key] = is_enabled

        elif key == "schedule_time":
            if not re.match(r"^\d{2}:\d{2}$", str(val)):
                raise HTTPException(status_code=400, detail="Time must be HH:MM")
            if _scraper_config.get(key) != str(val):
                _scraper_config[key] = str(val)
                if _scheduler_mgr:
                    try:
                        h, m = map(int, str(val).split(":"))
                        from services.scheduler.jobs import run_scraper_only_pipeline
                        _scheduler_mgr.schedule_cron_job(run_scraper_only_pipeline, h, m, "daily_scraper_pipeline")
                    except:
                        pass
            updated[key] = str(val)

        elif key == "cleaner_schedule_time":
            if not re.match(r"^\d{2}:\d{2}$", str(val)):
                raise HTTPException(status_code=400, detail="Time must be HH:MM")
            if _scraper_config.get(key) != str(val):
                _scraper_config[key] = str(val)
                if _scheduler_mgr:
                    try:
                        h, m = map(int, str(val).split(":"))
                        from services.scheduler.jobs import run_cleaner_pipeline
                        _scheduler_mgr.schedule_cron_job(run_cleaner_pipeline, h, m, "daily_cleaner_pipeline")
                    except:
                        pass
            updated[key] = str(val)
        
        # ... other numeric fields stay same ...
        elif key in ("max_search_pages", "max_workers", "request_timeout", "scrape_cooldown"):
            try:
                v = int(val)
                if v < 1: raise ValueError
                _scraper_config[key] = v
                updated[key] = v
            except:
                raise HTTPException(status_code=400, detail=f"{key} error")

    # Persist
    from services.common import save_settings
    save_settings()
    return {"status": "ok", "updated": updated, "config": _scraper_config}
