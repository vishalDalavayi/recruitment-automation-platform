"""
Request Logging Middleware
===========================
Injects request ID and logs structured request/response data.
"""

import uuid
import time
import logging
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

logger = logging.getLogger("KonfigAI")


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        request_id = request.headers.get("X-Request-ID", str(uuid.uuid4())[:8])
        request.state.request_id = request_id

        start = time.time()
        response: Response = await call_next(request)
        duration_ms = (time.time() - start) * 1000

        # Skip noisy health-check logs
        if request.url.path not in ("/", "/health"):
            logger.info(
                f"[{request_id}] {request.method} {request.url.path} "
                f"→ {response.status_code} ({duration_ms:.0f}ms)"
            )

        response.headers["X-Request-ID"] = request_id
        return response
