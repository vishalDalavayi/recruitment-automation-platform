"""
FastAPI Application Factory
==============================
Creates the app with zero blocking startup logic.
Startup time: < 3 seconds.
"""

import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from app.middleware.error_handler import register_exception_handlers
from app.middleware.logging_middleware import RequestLoggingMiddleware
from app.models.base import dispose_engine
from app.config import logger


def create_app(mode: str = None) -> FastAPI:
    """FastAPI Application Factory (API-only mode)."""

    # Shared state for routers
    from services.common import app_state, scraper_config
    scheduler_mgr = None

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        logger.info(f"Starting KonfigAI API (mode={mode})...")
        from services.common import load_settings
        load_settings()

        # Simplified, delayed warmup to avoid contention on refresh
        async def _warmup():
            await asyncio.sleep(3) # Wait for initial frontend burst
            try:
                from sqlalchemy import text
                from app.models.base import engine
                
                # Lightweight ping only
                with engine.connect() as conn:
                    conn.execute(text("SELECT 1"))
                logger.info("Database connection verified (background).")
            except Exception as e:
                logger.warning(f"Background DB ping failed: {e}")

        # Start non-blocking warmup task
        asyncio.create_task(_warmup())

        logger.info("KonfigAI API ready.")
        yield

        # Shutdown logic
        dispose_engine()
        logger.info("KonfigAI API shut down.")

    app = FastAPI(
        title="KonfigAI Job Digger",
        version="3.0",
        lifespan=lifespan,
    )

    # --- Middleware (order matters: last added = first executed) ---
    app.add_middleware(GZipMiddleware, minimum_size=1000)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.add_middleware(RequestLoggingMiddleware)

    # --- Exception handlers ---
    register_exception_handlers(app)

    # --- Configure routers with shared state ---
    from app.routers.scraper import configure_scraper_router
    from app.routers.settings import configure_settings_router
    from services.scheduler.manager import get_scheduler
    
    sm = get_scheduler()
    configure_scraper_router(app_state, scraper_config, sm)
    configure_settings_router(app_state, scraper_config, sm)

    # --- Include routers ---
    from app.routers import health, jobs, candidates, scraper, settings, admin

    app.include_router(health.router)
    app.include_router(jobs.router)
    app.include_router(candidates.router)
    app.include_router(scraper.router)
    app.include_router(settings.router)
    app.include_router(admin.router)

    return app
