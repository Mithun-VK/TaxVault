from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

import structlog
from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
from slowapi.errors import RateLimitExceeded
from starlette.middleware.trustedhost import TrustedHostMiddleware

from app.api.router import api_router
from app.core.config import settings
from app.core.exceptions import (
    AppException,
    AuthenticationError,
    DuplicateError,
    NotFoundError,
    PermissionDeniedError,
)
from app.core.limiter import _rl_enabled, limiter
from app.core.logging import setup_logging
from app.middleware.request_id import RequestIDMiddleware

# ── Logger ───────────────────────────────────────────────────────────────────
setup_logging()
logger = structlog.get_logger("taxvault.app")


# ── Lifespan ─────────────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    logger.info(
        "startup",
        app=settings.APP_NAME,
        version=settings.VERSION,
        environment=settings.ENVIRONMENT,
        docs_enabled=settings.show_docs,
        rate_limiting=_rl_enabled,
    )
    yield
    logger.info("shutdown", app=settings.APP_NAME)


# ── App ──────────────────────────────────────────────────────────────────────
app = FastAPI(
    title=settings.APP_NAME,
    version=settings.VERSION,
    description="Personal Asset & Liability Management System - Private Deployment",
    docs_url="/docs" if settings.show_docs else None,
    redoc_url="/redoc" if settings.show_docs else None,
    openapi_url="/openapi.json" if settings.show_docs else None,
    lifespan=lifespan,
)

app.state.limiter = limiter

# ── Middleware (outermost first) ─────────────────────────────────────────────
if settings.is_production:
    if "*" in settings.CORS_ORIGINS:
        allowed_hosts = ["*"]
    else:
        # TrustedHostMiddleware compares against the Host header with the port
        # already stripped, so an origin like http://192.168.1.50:8080 has to
        # become "192.168.1.50" - keeping the port would reject every request.
        allowed_hosts = [
            origin.split("://", 1)[-1].rstrip("/").split(":", 1)[0]
            for origin in settings.CORS_ORIGINS
        ]
        allowed_hosts += ["localhost", "127.0.0.1"]
    app.add_middleware(TrustedHostMiddleware, allowed_hosts=allowed_hosts)

app.add_middleware(GZipMiddleware, minimum_size=1000)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Request-ID"],
    expose_headers=["X-Request-ID", "X-Response-Time"],
)

app.add_middleware(RequestIDMiddleware)


# ── Exception handlers ───────────────────────────────────────────────────────
@app.exception_handler(RateLimitExceeded)
async def rate_limit_handler(request: Request, exc: RateLimitExceeded) -> JSONResponse:
    return JSONResponse(
        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
        content={"detail": "Too many requests. Please slow down."},
        headers={"Retry-After": "60"},
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(
    request: Request, exc: RequestValidationError
) -> JSONResponse:
    errors = []
    for error in exc.errors():
        field = ".".join(str(loc) for loc in error["loc"] if loc != "body")
        errors.append({"field": field, "message": error["msg"], "type": error["type"]})
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"detail": "Validation error", "errors": errors},
    )


@app.exception_handler(AuthenticationError)
async def auth_error_handler(request: Request, exc: AuthenticationError) -> JSONResponse:
    return JSONResponse(
        status_code=status.HTTP_401_UNAUTHORIZED,
        content={"detail": exc.detail},
        headers={"WWW-Authenticate": "Bearer"},
    )


@app.exception_handler(NotFoundError)
async def not_found_handler(request: Request, exc: NotFoundError) -> JSONResponse:
    return JSONResponse(status_code=status.HTTP_404_NOT_FOUND, content={"detail": exc.detail})


@app.exception_handler(PermissionDeniedError)
async def permission_error_handler(request: Request, exc: PermissionDeniedError) -> JSONResponse:
    return JSONResponse(status_code=status.HTTP_403_FORBIDDEN, content={"detail": exc.detail})


@app.exception_handler(DuplicateError)
async def duplicate_error_handler(request: Request, exc: DuplicateError) -> JSONResponse:
    return JSONResponse(status_code=status.HTTP_409_CONFLICT, content={"detail": exc.detail})


@app.exception_handler(AppException)
async def app_exception_handler(request: Request, exc: AppException) -> JSONResponse:
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    request_id = getattr(request.state, "request_id", "unknown")
    logger.exception(
        "unhandled_exception",
        request_id=request_id,
        path=request.url.path,
        method=request.method,
        exc_type=type(exc).__name__,
    )
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "detail": "An unexpected error occurred. Our team has been notified.",
            "request_id": request_id,
        },
    )


# ── Routes ───────────────────────────────────────────────────────────────────
# api_router already carries the /api/v1 prefix.
app.include_router(api_router)


# ── Health probes ────────────────────────────────────────────────────────────
@app.get("/health", tags=["health"], include_in_schema=False)
async def health_liveness() -> dict:
    return {"status": "ok", "version": settings.VERSION}


@app.get("/health/ready", tags=["health"], include_in_schema=False)
async def health_readiness() -> JSONResponse:
    import redis.asyncio as aioredis
    from sqlalchemy import text

    from app.db.session import engine

    checks: dict[str, str] = {}
    healthy = True

    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        checks["db"] = "ok"
    except Exception as e:  # noqa: BLE001
        checks["db"] = f"error: {type(e).__name__}"
        healthy = False

    try:
        r = aioredis.from_url(settings.REDIS_URL, socket_timeout=2)
        await r.ping()
        await r.aclose()
        checks["redis"] = "ok"
    except Exception as e:  # noqa: BLE001
        checks["redis"] = f"error: {type(e).__name__}"
        healthy = False

    status_code = status.HTTP_200_OK if healthy else status.HTTP_503_SERVICE_UNAVAILABLE
    return JSONResponse(
        status_code=status_code,
        content={"status": "ready" if healthy else "degraded", **checks},
    )
