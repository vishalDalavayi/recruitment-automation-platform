"""
Health Check Router
=====================
Liveness and readiness probes.
"""

from fastapi import APIRouter
from sqlalchemy.sql import text
from app.models.base import SessionLocal
from app.cache.redis_client import get_redis

router = APIRouter(tags=["Health"])


@router.get("/")
def root():
    return {"status": "ok", "service": "KonfigAI Job Digger", "version": "3.0"}


@router.get("/health")
def health():
    """Liveness probe — always returns OK if process is alive."""
    return {"status": "ok"}


@router.get("/ready")
def ready():
    """Readiness probe — checks DB and Redis connectivity."""
    checks = {"database": "ok", "redis": "skipped"}

    # DB check
    try:
        db = SessionLocal()
        try:
            db.execute(text("SELECT 1"))
        finally:
            db.close()
    except Exception as e:
        checks["database"] = f"error: {e}"

    # Redis check
    r = get_redis()
    if r:
        try:
            r.ping()
            checks["redis"] = "ok"
        except Exception as e:
            checks["redis"] = f"error: {e}"

    all_ok = all(v == "ok" or v == "skipped" for v in checks.values())
    return {"status": "ready" if all_ok else "degraded", "checks": checks}
