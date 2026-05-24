import logging
import asyncio
import traceback
from datetime import datetime
import redis
from services.scraper.service import run_pipeline_sync
from services.scraper.checker import run_checker_cleaner_sync
from services.common import scraper_config, logger, REDIS_URL

async def clean_dead_jobs():
    """Phase 1: Remove jobs that are no longer active on the source site."""
    logger.info("🧹 Starting phase: clean_dead_jobs")
    try:
        stats = await asyncio.to_thread(run_checker_cleaner_sync)
        logger.info(f"✅ Cleaned {stats.get('total_deleted', 0)} dead jobs.")
    except Exception as e:
        logger.error(f"❌ clean_dead_jobs failed: {e}")
        logger.error(traceback.format_exc())

async def add_new_jobs():
    """Phase 2: Add new keywords or seed links if necessary."""
    logger.info("➕ Starting phase: add_new_jobs")
    # This is a logical placeholder. In the current system, 
    # run_scraper already handles discovery of new jobs from input tables.
    # We could add logic here to sync keywords from an external source.
    await asyncio.sleep(0.1) 
    logger.info("✅ Finished add_new_jobs (discovery handled by scraper).")

async def run_scraper():
    """Phase 3: Run the actual scraping pipeline."""
    logger.info("🚀 Starting phase: run_scraper")
    try:
        cfg = dict(scraper_config)
        results = await asyncio.to_thread(run_pipeline_sync, cfg, "scheduled")
        logger.info(f"✅ Scraper completed. Scraped {results.get('active', 0)} active and {results.get('inactive', 0)} inactive jobs.")
    except Exception as e:
        logger.error(f"❌ run_scraper failed: {e}")
        logger.error(traceback.format_exc())

async def run_cleaner_pipeline():
    """
    Independent cleaner pipeline that remove jobs no longer active.
    """
    lock_name = "scheduler:lock:cleaner_pipeline"
    r = None
    lock_acquired = False
    
    if REDIS_URL:
        try:
            r = redis.from_url(REDIS_URL, decode_responses=True)
            if r.set(lock_name, "locked", nx=True, ex=3600):
                lock_acquired = True
            else:
                logger.info("⏭️ Cleaner already running. Skipping.")
                return
        except Exception as e:
            logger.warning(f"⚠️ Redis lock for cleaner unavailable: {e}")
            lock_acquired = True 
    else:
        lock_acquired = True

    try:
        logger.info("🧹 [CLEANER START]")
        await clean_dead_jobs()
        logger.info("🏁 [CLEANER END]")
    finally:
        if r and lock_acquired:
            try:
                r.delete(lock_name)
            except:
                pass

async def run_scraper_only_pipeline():
    """
    Independent scraper pipeline that adds and scrapes jobs without cleaning.
    """
    lock_name = "scheduler:lock:scraper_pipeline"
    r = None
    lock_acquired = False
    
    if REDIS_URL:
        try:
            r = redis.from_url(REDIS_URL, decode_responses=True)
            if r.set(lock_name, "locked", nx=True, ex=7200):
                lock_acquired = True
            else:
                logger.info("⏭️ Scraper already running. Skipping.")
                return
        except Exception as e:
            logger.warning(f"⚠️ Redis lock for scraper unavailable: {e}")
            lock_acquired = True 
    else:
        lock_acquired = True

    try:
        logger.info("🚀 [SCRAPER START]")
        await add_new_jobs()
        await run_scraper()
        logger.info("🏁 [SCRAPER END]")
    finally:
        if r and lock_acquired:
            try:
                r.delete(lock_name)
            except:
                pass

async def run_maintenance_pipeline():
    """
    Combined maintenance pipeline (Cleaner -> Adder -> Scraper).
    Maintained for manual triggers or combined runs.
    """
    lock_name = "scheduler:lock:maintenance_pipeline"
    r = None
    lock_acquired = False
    
    if REDIS_URL:
        try:
            r = redis.from_url(REDIS_URL, decode_responses=True)
            if r.set(lock_name, "locked", nx=True, ex=7200):
                lock_acquired = True
            else:
                logger.info("⏭️ Maintenance Pipeline already running. Skipping.")
                return
        except Exception as e:
            logger.warning(f"⚠️ Redis lock unavailable: {e}")
            lock_acquired = True 
    else:
        lock_acquired = True

    try:
        logger.info("⚙️ [FULL MAINTENANCE START]")
        await clean_dead_jobs()
        await add_new_jobs()
        await run_scraper()
        logger.info("🏁 [FULL MAINTENANCE END]")
    except Exception as e:
        logger.error(f"🔥 Full Maintenance failed: {e}")
    finally:
        if r and lock_acquired:
            try:
                r.delete(lock_name)
            except:
                pass
