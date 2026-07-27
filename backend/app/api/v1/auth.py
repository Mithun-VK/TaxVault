from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.dependencies import get_db
from app.core.limiter import limiter
from app.schemas.auth import (
    ForgotPasswordRequest,
    LoginRequest,
    RefreshRequest,
    RegisterRequest,
    ResetPasswordRequest,
    TokenResponse,
)
from app.services import auth_service

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post(
    "/register", response_model=TokenResponse, status_code=201, summary="Register a new user"
)
@limiter.limit(settings.RATE_LIMIT_REGISTER)
async def register(
    request: Request, payload: RegisterRequest, db: AsyncSession = Depends(get_db)
) -> TokenResponse:
    return await auth_service.register(db, payload)


@router.post("/login", response_model=TokenResponse, summary="Log in and obtain tokens")
@limiter.limit(settings.RATE_LIMIT_LOGIN)
async def login(
    request: Request, payload: LoginRequest, db: AsyncSession = Depends(get_db)
) -> TokenResponse:
    return await auth_service.login(db, payload)


@router.post("/refresh", response_model=TokenResponse, summary="Exchange a refresh token")
@limiter.limit("10/minute")
async def refresh(
    request: Request, payload: RefreshRequest, db: AsyncSession = Depends(get_db)
) -> TokenResponse:
    return await auth_service.refresh(db, payload.refresh_token)


@router.post("/logout", status_code=204, summary="Revoke a refresh token")
async def logout(payload: RefreshRequest) -> None:
    await auth_service.logout(payload.refresh_token)
    return None


@router.post("/forgot-password", status_code=200, summary="Request a password reset link")
@limiter.limit(settings.RATE_LIMIT_FORGOT_PASSWORD)
async def forgot_password(
    request: Request, payload: ForgotPasswordRequest, db: AsyncSession = Depends(get_db)
) -> dict:
    await auth_service.forgot_password(db, payload.email)
    return {"detail": "If that email exists you will receive a reset link"}


@router.post("/reset-password", status_code=200, summary="Reset password with a token")
@limiter.limit("5/minute")
async def reset_password(
    request: Request, payload: ResetPasswordRequest, db: AsyncSession = Depends(get_db)
) -> dict:
    await auth_service.reset_password(db, payload.token, payload.new_password)
    return {"detail": "Password reset successful"}
