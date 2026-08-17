import logging
import uuid
from datetime import datetime, timezone

import boto3
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.exceptions import AuthenticationError, DuplicateError
from app.core.permissions import ROLE_SUPER_ADMIN, ROLE_USER
from app.core.security import (
    create_access_token,
    create_refresh_token,
    create_reset_token,
    decode_token,
    hash_password,
    verify_password,
)
from app.core.token_blocklist import block_token, is_blocked
from app.models.user import User
from app.schemas.auth import LoginRequest, RegisterRequest, TokenResponse

logger = logging.getLogger("taxvault")


async def register(db: AsyncSession, payload: RegisterRequest) -> TokenResponse:
    existing = await db.execute(select(User).where(User.email == payload.email))
    if existing.scalar_one_or_none():
        raise DuplicateError("Email already registered")

    # First account to register bootstraps the deployment's super admin and
    # owns the shared vault; everyone after that is a plain user until a super
    # admin promotes them.
    user_count = await db.scalar(select(func.count()).select_from(User))
    role = ROLE_SUPER_ADMIN if not user_count else ROLE_USER

    user = User(
        email=payload.email,
        hashed_password=hash_password(payload.password),
        full_name=payload.full_name,
        phone_number=payload.phone_number,
        role=role,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    return TokenResponse(
        access_token=create_access_token(str(user.id)),
        refresh_token=create_refresh_token(str(user.id)),
    )


async def login(db: AsyncSession, payload: LoginRequest) -> TokenResponse:
    result = await db.execute(
        select(User).where(User.email == payload.email, User.is_active == True)
    )
    user = result.scalar_one_or_none()
    if not user or not verify_password(payload.password, user.hashed_password):
        raise AuthenticationError("Invalid email or password")

    return TokenResponse(
        access_token=create_access_token(str(user.id)),
        refresh_token=create_refresh_token(str(user.id)),
    )


async def refresh(db: AsyncSession, refresh_token: str) -> TokenResponse:
    try:
        payload = decode_token(refresh_token)
    except ValueError as exc:
        raise AuthenticationError("Invalid refresh token") from exc

    if payload.get("type") != "refresh":
        raise AuthenticationError("Not a refresh token")

    if await is_blocked(payload.get("jti")):
        raise AuthenticationError("Refresh token has been revoked")

    user_id = payload.get("sub")
    if not user_id:
        raise AuthenticationError("Token missing subject")

    result = await db.execute(
        select(User).where(User.id == uuid.UUID(user_id), User.is_active == True)
    )
    if not result.scalar_one_or_none():
        raise AuthenticationError("User not found")

    return TokenResponse(
        access_token=create_access_token(user_id),
        refresh_token=create_refresh_token(user_id),
    )


async def logout(refresh_token: str) -> None:
    # Revoke the refresh token by blocklisting its jti until it would expire.
    try:
        payload = decode_token(refresh_token)
    except ValueError:
        return  # nothing to revoke for a bad/expired token
    if payload.get("type") != "refresh":
        return
    jti = payload.get("jti")
    exp = payload.get("exp")
    if jti and exp:
        ttl = int(exp - datetime.now(timezone.utc).timestamp())
        await block_token(jti, ttl)


async def forgot_password(db: AsyncSession, email: str) -> None:
    # Always succeed silently to avoid email enumeration.
    result = await db.execute(select(User).where(User.email == email, User.is_active == True))
    user = result.scalar_one_or_none()
    if user:
        token = create_reset_token(str(user.id))
        reset_link = f"{settings.FRONTEND_URL}/reset-password?token={token}"
        _send_reset_email(user.email, reset_link)


async def reset_password(db: AsyncSession, token: str, new_password: str) -> None:
    try:
        payload = decode_token(token)
    except ValueError as exc:
        raise AuthenticationError("Invalid or expired reset token") from exc

    if payload.get("type") != "reset":
        raise AuthenticationError("Not a password reset token")

    user_id = payload.get("sub")
    if not user_id:
        raise AuthenticationError("Token missing subject")

    result = await db.execute(select(User).where(User.id == uuid.UUID(user_id)))
    user = result.scalar_one_or_none()
    if not user:
        raise AuthenticationError("User not found")

    user.hashed_password = hash_password(new_password)
    await db.commit()


def _send_reset_email(to_email: str, reset_link: str) -> None:
    """Best-effort SES send; never raise into the request path."""
    if not settings.AWS_ACCESS_KEY_ID:
        logger.info("SES not configured; password reset link for %s: %s", to_email, reset_link)
        return
    try:
        ses = boto3.client(
            "ses",
            region_name=settings.AWS_REGION,
            aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
            aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
        )
        ses.send_email(
            Source=settings.EMAIL_FROM,
            Destination={"ToAddresses": [to_email]},
            Message={
                "Subject": {"Data": "TaxVault password reset"},
                "Body": {
                    "Html": {
                        "Data": (
                            f"<p>Reset your password using the link below "
                            f"(valid for {settings.RESET_TOKEN_EXPIRE_MINUTES} minutes):</p>"
                            f'<p><a href="{reset_link}">Reset password</a></p>'
                        )
                    }
                },
            },
        )
    except Exception:  # noqa: BLE001
        logger.exception("Failed to send password reset email to %s", to_email)
