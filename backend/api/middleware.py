# NEXUS AI - Custom Middleware
"""
Middleware stack for the NEXUS AI FastAPI application.
Includes CORS, rate limiting, request logging, error handling,
and authentication middleware.
"""

import time
import uuid
from collections import defaultdict
from datetime import datetime
from typing import Callable, Dict, List, Optional

from fastapi import FastAPI, Request, Response, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from loguru import logger
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint


# ============================================================
# CORS Configuration
# ============================================================

def configure_cors(app: FastAPI):
    """
    Add CORS middleware with sensible defaults.
    In development, all origins are allowed.
    """
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],  # Restrict in production
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["X-Request-ID", "X-Process-Time"],
    )


# ============================================================
# Request Logging Middleware
# ============================================================

class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """
    Logs every incoming request with method, path, status, and timing.
    Attaches a unique X-Request-ID header.
    """

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        request_id = str(uuid.uuid4())
        start_time = time.time()

        # Attach request_id to state for downstream use
        request.state.request_id = request_id

        # Skip logging for health/docs endpoints to reduce noise
        path = request.url.path
        skip_log = path in ("/health", "/docs", "/openapi.json", "/redoc", "/favicon.ico")

        if not skip_log:
            logger.info(f"→ {request.method} {path} [req:{request_id[:8]}]")

        try:
            response = await call_next(request)
        except Exception as exc:
            elapsed = (time.time() - start_time) * 1000
            logger.error(f"✖ {request.method} {path} — unhandled exception after {elapsed:.1f}ms: {exc}")
            raise

        elapsed = (time.time() - start_time) * 1000

        # Add custom headers
        response.headers["X-Request-ID"] = request_id
        response.headers["X-Process-Time"] = f"{elapsed:.2f}ms"

        if not skip_log:
            logger.info(
                f"← {request.method} {path} {response.status_code} in {elapsed:.1f}ms "
                f"[req:{request_id[:8]}]"
            )

        return response


# ============================================================
# Rate Limiting Middleware
# ============================================================

class RateLimitMiddleware(BaseHTTPMiddleware):
    """
    Simple in-memory rate limiter based on client IP.
    Limits requests per minute per IP address.
    """

    def __init__(self, app: FastAPI, requests_per_minute: int = 120):
        super().__init__(app)
        self.rpm = requests_per_minute
        self._window = 60  # seconds
        self._requests: Dict[str, List[float]] = defaultdict(list)

    def _get_client_ip(self, request: Request) -> str:
        forwarded = request.headers.get("X-Forwarded-For")
        if forwarded:
            return forwarded.split(",")[0].strip()
        return request.client.host if request.client else "unknown"

    def _is_rate_limited(self, client_ip: str) -> bool:
        now = time.time()
        window_start = now - self._window

        # Clean old entries
        self._requests[client_ip] = [
            t for t in self._requests[client_ip] if t > window_start
        ]

        if len(self._requests[client_ip]) >= self.rpm:
            return True

        self._requests[client_ip].append(now)
        return False

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        # Exempt WebSocket upgrades and health checks
        if request.url.path.startswith("/ws") or request.url.path == "/health":
            return await call_next(request)

        client_ip = self._get_client_ip(request)

        if self._is_rate_limited(client_ip):
            logger.warning(f"Rate limit exceeded for {client_ip}")
            return JSONResponse(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                content={
                    "detail": "Rate limit exceeded. Please slow down.",
                    "retry_after_seconds": self._window,
                },
                headers={"Retry-After": str(self._window)},
            )

        return await call_next(request)


# ============================================================
# Error Handling Middleware
# ============================================================

class ErrorHandlingMiddleware(BaseHTTPMiddleware):
    """
    Global exception handler that ensures all errors return
    structured JSON responses rather than raw stack traces.
    """

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        try:
            return await call_next(request)
        except Exception as exc:
            logger.exception(f"Unhandled error on {request.method} {request.url.path}: {exc}")

            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content={
                    "detail": "An internal server error occurred.",
                    "error_type": type(exc).__name__,
                    "path": request.url.path,
                    "timestamp": datetime.utcnow().isoformat(),
                },
            )


# ============================================================
# Authentication Middleware
# ============================================================

class AuthenticationMiddleware(BaseHTTPMiddleware):
    """
    Lightweight authentication middleware.
    In development mode it passes all requests through.
    In production mode it validates a Bearer token or API key.
    """

    # Paths that never require authentication
    PUBLIC_PATHS = {
        "/",
        "/health",
        "/docs",
        "/redoc",
        "/openapi.json",
        "/favicon.ico",
    }

    def __init__(self, app: FastAPI, require_auth: bool = False, api_keys: Optional[List[str]] = None):
        super().__init__(app)
        self.require_auth = require_auth
        self.api_keys = set(api_keys or [])

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        path = request.url.path

        # Allow public paths and WebSocket upgrades
        if path in self.PUBLIC_PATHS or path.startswith("/ws"):
            return await call_next(request)

        if not self.require_auth:
            # Development mode — pass everything
            return await call_next(request)

        # Check for API key
        api_key = request.headers.get("X-API-Key") or request.query_params.get("api_key")
        if api_key and api_key in self.api_keys:
            return await call_next(request)

        # Check for Bearer token
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
            try:
                from core.security import SecurityManager
                sm = SecurityManager()
                payload = sm.verify_token(token)
                if payload:
                    request.state.user_id = payload.get("sub", "")
                    return await call_next(request)
            except Exception:
                pass

        return JSONResponse(
            status_code=status.HTTP_401_UNAUTHORIZED,
            content={"detail": "Authentication required"},
            headers={"WWW-Authenticate": "Bearer"},
        )


# ============================================================
# Apply all middleware in the correct order
# ============================================================

def apply_middleware(app: FastAPI, require_auth: bool = False, api_keys: Optional[List[str]] = None):
    """
    Apply all custom middleware to the FastAPI application.
    Order matters — outermost middleware runs first.
    """
    # 1. CORS (outermost — must handle preflight before other middleware)
    configure_cors(app)

    # 2. Error handling
    app.add_middleware(ErrorHandlingMiddleware)

    # 3. Request logging
    app.add_middleware(RequestLoggingMiddleware)

    # 4. Rate limiting
    app.add_middleware(RateLimitMiddleware, requests_per_minute=120)

    # 5. Authentication (innermost — runs last, closest to route handlers)
    app.add_middleware(AuthenticationMiddleware, require_auth=require_auth, api_keys=api_keys)
