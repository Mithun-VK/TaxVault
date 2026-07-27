import uuid

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import AuthenticationError, PermissionDeniedError
from app.core.security import decode_token
from app.db.session import get_db  # re-exported: canonical definition lives in db.session
from app.models.user import User

bearer_scheme = HTTPBearer()

__all__ = ["get_db", "get_current_user", "require_admin", "bearer_scheme"]


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    try:
        payload = decode_token(credentials.credentials)
    except ValueError as exc:
        raise AuthenticationError(str(exc)) from exc

    if payload.get("type") != "access":
        raise AuthenticationError("Invalid token type")

    user_id_str = payload.get("sub")
    if not user_id_str:
        raise AuthenticationError("Token missing subject")

    try:
        user_id = uuid.UUID(user_id_str)
    except ValueError as exc:
        raise AuthenticationError("Invalid user ID in token") from exc

    result = await db.execute(select(User).where(User.id == user_id, User.is_active == True))
    user = result.scalar_one_or_none()
    if user is None:
        raise AuthenticationError("User not found or inactive")

    return user


async def require_admin(current_user: User = Depends(get_current_user)) -> User:
    """Gate a route to admins. Depends on get_current_user (cached per request),
    so gating a write route adds no extra DB round-trip."""
    if current_user.role != "admin":
        raise PermissionDeniedError("Admin privileges required")
    return current_user
