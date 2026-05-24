import logging
import asyncio
from datetime import datetime
from typing import Callable, Optional, Dict, Any
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

# Configure specialized logger for scheduler
logger = logging.getLogger("scheduler")
if not logger.handlers:
    handler = logging.StreamHandler()
    formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
    handler.setFormatter(formatter)
    logger.addHandler(handler)
    logger.setLevel(logging.INFO)

class SchedulerManager:
    """
    Production-ready scheduler manager using APScheduler (AsyncIOScheduler).
    Uses direct function references and CronTrigger for reliable execution.
    """
    def __init__(self):
        # We use MemoryJobStore (default) to support direct function references.
        # This means jobs are NOT persistent across process restarts, which
        # is often preferred in containerized environments where we want 
        # a clean state and explicit registration on startup.
        self.scheduler = AsyncIOScheduler()
        self._is_running = False

    async def start(self):
        if not self._is_running:
            self.scheduler.start()
            self._is_running = True
            logger.info("🚀 Scheduler service started.")

    async def stop(self):
        if self._is_running:
            self.scheduler.shutdown()
            self._is_running = False
            logger.info("🛑 Scheduler service shut down.")

    def schedule_cron_job(
        self, 
        job_func: Callable, 
        hour: int, 
        minute: int, 
        job_id: str, 
        args: tuple = None, 
        kwargs: dict = None
    ):
        """
        Schedules a job using CronTrigger with specific hour and minute.
        """
        trigger = CronTrigger(hour=hour, minute=minute)
        
        self.scheduler.add_job(
            job_func,
            trigger,
            id=job_id,
            args=args,
            kwargs=kwargs,
            replace_existing=True,
            misfire_grace_time=3600,
            coalesce=True,
            max_instances=1
        )
        
        job = self.scheduler.get_job(job_id)
        next_run = job.next_run_time if job else None
        logger.info(f"✅ Registered job '{job_id}'. Next run scheduled for: {next_run}")

    def schedule_interval_job(self, job_func: Callable, hours: int, job_id: str):
        """Register a job that runs every N hours."""
        from apscheduler.triggers.interval import IntervalTrigger
        trigger = IntervalTrigger(hours=hours)
        self.scheduler.add_job(
            job_func,
            trigger,
            id=job_id,
            replace_existing=True,
            max_instances=1,
            coalesce=True,
        )
        
        job = self.scheduler.get_job(job_id)
        next_run = job.next_run_time if job else None
        logger.info(f"✅ Registered job '{job_id}'. Next run scheduled for: {next_run}")

    async def get_job_status(self, job_id: str) -> Dict[str, Any]:
        job = self.scheduler.get_job(job_id)
        if not job:
            return {"status": "not_found"}
        
        return {
            "job_id": job.id,
            "next_run": job.next_run_time.isoformat() if job.next_run_time else None,
            "trigger": str(job.trigger),
            "pending": getattr(job, 'pending', False)
        }

    async def trigger_job_now(self, job_id: str):
        """Manually trigger a job by its ID."""
        job = self.scheduler.get_job(job_id)
        if job:
            logger.info(f"⚡ Manually triggering job: {job_id}")
            job.modify(next_run_time=datetime.now())
            return True
        return False

    async def pause_job(self, job_id: str):
        """Pause a scheduled job."""
        self.scheduler.pause_job(job_id)
        logger.info(f"⏸️ Paused job '{job_id}'")

    async def resume_job(self, job_id: str):
        """Resume a paused job."""
        self.scheduler.resume_job(job_id)
        logger.info(f"▶️ Resumed job '{job_id}'")

# Global instance helper
scheduler_manager: Optional[SchedulerManager] = None

def get_scheduler():
    global scheduler_manager
    if scheduler_manager is None:
        scheduler_manager = SchedulerManager()
    return scheduler_manager
