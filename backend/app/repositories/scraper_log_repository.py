"""
Scraper Log Repository
=======================
"""

from typing import List
from sqlalchemy.orm import Session
from sqlalchemy.sql import text
from app.models.base import DB_SCHEMA
from app.models.jobs import ScraperLog


def get_scraper_logs(db: Session, limit: int = 50) -> List[dict]:
    result = db.execute(
        text(f"SELECT * FROM {DB_SCHEMA}.scraper_logs ORDER BY start_time DESC LIMIT :limit"),
        {"limit": limit},
    )
    rows = result.fetchall()
    columns = [c.name for c in ScraperLog.__table__.columns]
    return [dict(zip(columns, row)) for row in rows]


def add_scraper_log(db: Session, log_data: dict):
    log = ScraperLog(**log_data)
    db.add(log)
    db.commit()
