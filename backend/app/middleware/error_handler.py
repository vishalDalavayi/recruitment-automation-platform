"""
Global Exception Handler
==========================
Ensures all unhandled exceptions return proper HTTP status codes.
"""

import uuid
import logging
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from sqlalchemy.exc import SQLAlchemyError

logger = logging.getLogger("KonfigAI")


def register_exception_handlers(app: FastAPI):
    """Register global exception handlers on the app."""

    @app.exception_handler(SQLAlchemyError)
    async def sqlalchemy_exception_handler(request: Request, exc: SQLAlchemyError):
        request_id = getattr(request.state, "request_id", "unknown")
        logger.error(f"[{request_id}] Database error on {request.method} {request.url.path}: {exc}")
        return JSONResponse(
            status_code=500,
            content={"detail": "A database error occurred. Please try again later.", "request_id": request_id},
        )

    @app.exception_handler(Exception)
    async def generic_exception_handler(request: Request, exc: Exception):
        request_id = getattr(request.state, "request_id", "unknown")
        logger.error(f"[{request_id}] Unhandled error on {request.method} {request.url.path}: {exc}")
        return JSONResponse(
            status_code=500,
            content={"detail": "An internal server error occurred.", "request_id": request_id},
        )
