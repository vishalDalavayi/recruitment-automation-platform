"""
Stats Service
===============
Aggregates statistics with aggressive caching.
"""

import time as _time
from datetime import datetime, UTC
from sqlalchemy.orm import Session
from sqlalchemy import func
from sqlalchemy.sql import text
from app.models.base import DB_SCHEMA, CANDIDATE_SCHEMA
from app.models.jobs import ActiveScrapedData, InactiveScrapedData
from app.repositories import job_repository
from app.cache.redis_client import cache
from app.config import logger

_STATS_TTL = 30  # seconds — stats rarely change faster than this


def _fast_candidate_count(db: Session) -> int:
    """Use pg_class estimate for candidate count (instant)."""
    try:
        result = db.execute(
            text("SELECT reltuples::bigint FROM pg_class WHERE relname = 'candidate_basic_info'")
        )
        row = result.fetchone()
        return max(row[0], 0) if row else 0
    except Exception:
        try:
            from app.repositories.candidate_repository import get_candidate_count
            return get_candidate_count(db)
        except Exception:
            return 0


def _fast_today_count(db: Session) -> int:
    """Count jobs scraped today — uses indexed scraped_at column."""
    try:
        today_str = datetime.now(UTC).strftime("%Y-%m-%d")
        result = db.execute(text(f"""
            SELECT
                (SELECT COUNT(*) FROM {DB_SCHEMA}.active_scraped_data WHERE scraped_at >= :today)
                +
                (SELECT COUNT(*) FROM {DB_SCHEMA}.inactive_scraped_data WHERE scraped_at >= :today)
        """), {"today": today_str})
        return result.fetchone()[0] or 0
    except Exception as e:
        logger.warning(f"Today's count query failed: {e}")
        return 0


def get_stats(db: Session, scraper_config: dict) -> dict:
    """Get application stats with caching (30s TTL)."""
    cached = cache.get("app:stats")
    if cached:
        return cached

    try:
        active = job_repository.get_fast_count(db, "active_scraped_data")
        inactive = job_repository.get_fast_count(db, "inactive_scraped_data")
        candidates = _fast_candidate_count(db)
        today = _fast_today_count(db)

        next_run = "Disabled"
        if scraper_config.get("schedule_enabled"):
            next_run = scraper_config.get("schedule_time", "Unknown")

        result = {
            "jobs_scraped_today": today,
            "total_jobs": active + inactive,
            "total_active": active,
            "total_inactive": inactive,
            "matched_candidates": candidates,
            "tailored_resumes": 0,
            "discovery_active": job_repository.get_fast_count(db, "active_dice_jobs"),
            "discovery_inactive": job_repository.get_fast_count(db, "inactive_dice_jobs"),
            "scheduler_next_run": next_run,
        }
        cache.set("app:stats", result, ttl=_STATS_TTL)
        return result
    except Exception as e:
        logger.error(f"Failed to compute stats: {e}")
        return {"error": str(e), "jobs_scraped_today": 0, "total_jobs": 0}


def get_init_data(db: Session, scraper_config: dict, app_state) -> dict:
    """Consolidated init endpoint data."""
    now = _time.time()

    status = app_state.to_dict() if app_state else {"status": "idle"}
    stats = get_stats(db, scraper_config)

    return {
        "status": status,
        "stats": stats,
        "settings": scraper_config,
        "timestamp": now,
    }
