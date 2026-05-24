"""
Dependency Injection
=====================
FastAPI dependencies for request-scoped DB sessions, auth, and services.
"""

from typing import Generator, Optional
from fastapi import Depends, Header, HTTPException
from sqlalchemy.orm import Session
from app.models.base import SessionLocal
from app.config import get_settings


def get_db() -> Generator[Session, None, None]:
    """Request-scoped database session. Automatically closed after each request."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def check_api_key(x_api_key: Optional[str] = Header(None)) -> None:
    """Validates X-API-Key header if one is configured."""
    settings = get_settings()
    if settings.scraper_api_key and x_api_key != settings.scraper_api_key:
        raise HTTPException(
            status_code=401, detail="Invalid or missing X-API-Key header"
        )
