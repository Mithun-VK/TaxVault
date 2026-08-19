import logging

from fastapi import HTTPException, Request
from fastapi.responses import JSONResponse

logger = logging.getLogger("taxvault")


class AppException(HTTPException):
    """Generic application error with an explicit status code (e.g. 413/415)."""

    def __init__(self, status_code: int = 400, detail: str = "Application error") -> None:
        super().__init__(status_code=status_code, detail=detail)


class NotFoundError(HTTPException):
    def __init__(self, detail: str = "Resource not found") -> None:
        super().__init__(status_code=404, detail=detail)


class DuplicateError(HTTPException):
    def __init__(self, detail: str = "Resource already exists") -> None:
        super().__init__(status_code=409, detail=detail)


class AuthenticationError(HTTPException):
    def __init__(self, detail: str = "Authentication failed") -> None:
        super().__init__(status_code=401, detail=detail, headers={"WWW-Authenticate": "Bearer"})


class PermissionDeniedError(HTTPException):
    def __init__(self, detail: str = "Insufficient permissions") -> None:
        super().__init__(status_code=403, detail=detail)


class AppValidationError(HTTPException):
    def __init__(self, detail: str = "Validation error") -> None:
        super().__init__(status_code=422, detail=detail)


async def not_found_handler(request: Request, exc: NotFoundError) -> JSONResponse:
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})


async def duplicate_handler(request: Request, exc: DuplicateError) -> JSONResponse:
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})


async def auth_handler(request: Request, exc: AuthenticationError) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail},
        headers=exc.headers or {},
    )


async def permission_handler(request: Request, exc: PermissionDeniedError) -> JSONResponse:
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})


async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    # Last line of defence: log the full trace (Sentry captures it if configured)
    # and return a generic, conformant body - never leak internals to the client.
    logger.exception("Unhandled error on %s %s", request.method, request.url.path)
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})
