import sys
import os
import asyncio
from datetime import datetime
import uvicorn
from fastapi import FastAPI, HTTPException, Header, Body
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

sys.path.insert(
    0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
)

from services.common import (
    logger, 
    scraper_config, 
    API_KEY
)
from services.scheduler.manager import get_scheduler
from services.scheduler.jobs import run_scraper_only_pipeline, run_cleaner_pipeline
from services.matching_automation import start_matching_scheduler

@asynccontextmanager
async def lifespan(app: FastAPI):
    from services.common import load_settings
    load_settings()
    await scheduler_mgr.start()
    
    # 1. Scraper Daily Schedule
    scraper_time = scraper_config.get("schedule_time", "08:30")
    try:
        sh, sm = map(int, scraper_time.split(":"))
        scheduler_mgr.schedule_cron_job(
            run_scraper_only_pipeline,
            hour=sh,
            minute=sm,
            job_id="daily_scraper_pipeline"
        )
    except:
        scheduler_mgr.schedule_cron_job(run_scraper_only_pipeline, 8, 30, "daily_scraper_pipeline")

    # 2. Cleaner Daily Schedule
    cleaner_time = scraper_config.get("cleaner_schedule_time", "08:00")
    try:
        ch, cm = map(int, cleaner_time.split(":"))
        scheduler_mgr.schedule_cron_job(
            run_cleaner_pipeline,
            hour=ch,
            minute=cm,
            job_id="daily_cleaner_pipeline"
        )
    except:
        scheduler_mgr.schedule_cron_job(run_cleaner_pipeline, 8, 0, "daily_cleaner_pipeline")

    # Start matcher daily scheduler (separate thread) alongside APScheduler.
    start_matching_scheduler()

    yield
    await scheduler_mgr.stop()

app = FastAPI(title="KonfigAI Maintenance Scheduler", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize production-grade scheduler
scheduler_mgr = get_scheduler()

def check_auth(x_api_key: str):
    if API_KEY and x_api_key != API_KEY:
        raise HTTPException(
            status_code=401, detail="Invalid or missing X-API-Key header"
        )

@app.get("/")
async def health():
    return {"status": "ok", "service": "Maintenance Scheduler"}

@app.get("/status")
async def get_status(x_api_key: str = Header(None)):
    check_auth(x_api_key)
    return {
        "scraper": await scheduler_mgr.get_job_status("daily_scraper_pipeline"),
        "cleaner": await scheduler_mgr.get_job_status("daily_cleaner_pipeline")
    }

@app.post("/trigger/scraper")
async def trigger_scraper(x_api_key: str = Header(None)):
    check_auth(x_api_key)
    success = await scheduler_mgr.trigger_job_now("daily_scraper_pipeline")
    return {"message": "Scraper triggered" if success else "Fallback started"}

@app.post("/trigger/cleaner")
async def trigger_cleaner(x_api_key: str = Header(None)):
    check_auth(x_api_key)
    success = await scheduler_mgr.trigger_job_now("daily_cleaner_pipeline")
    return {"message": "Cleaner triggered" if success else "Fallback started"}

@app.post("/reschedule")
async def reschedule(payload: dict = Body(...), x_api_key: str = Header(None)):
    check_auth(x_api_key)
    time_str = payload.get("time") # Expected "HH:MM"
    if not time_str or ":" not in time_str:
        raise HTTPException(status_code=400, detail="Missing or invalid 'time' (HH:MM)")
    
    try:
        h, m = map(int, time_str.split(":"))
        scheduler_mgr.schedule_cron_job(
            run_maintenance_pipeline,
            hour=h,
            minute=m,
            job_id="daily_maintenance_pipeline"
        )
        return {"message": f"Rescheduled to {time_str}"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid time format: {e}")

if __name__ == "__main__":
    p = int(os.environ.get("SCHEDULER_PORT", 8002))
    uvicorn.run(app, host="0.0.0.0", port=p)
