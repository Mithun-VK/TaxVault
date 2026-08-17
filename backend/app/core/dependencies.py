import uuid

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import AuthenticationError, PermissionDeniedError
from app.core.permissions import ROLE_SUPER_ADMIN, has_permission
from app.core.security import decode_token
from app.db.session import get_db  # re-exported: canonical definition lives in db.session
from app.models.user import User

bearer_scheme = HTTPBearer()

__all__ = [
    "get_db",
    "get_current_user",
    "get_vault_owner_id",
    "require",
    "require_super_admin",
    "bearer_scheme",
]


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


async def get_vault_owner_id(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> uuid.UUID:
    """The account that owns the deployment's single shared vault.

    TaxVault holds one household/company vault that several logins look at
    through different roles, so every record hangs off one owning account
    rather than off whoever happens to be signed in. That owner is the
    earliest-created super admin; a deployment that predates the super_admin
    role falls back to its earliest-created account, which migration 0016
    promotes anyway.

    Routes take this instead of ``current_user.id`` for data scoping — what the
    caller may *do* with that data is decided separately by ``require()``.
    """
    owner_id = await db.scalar(
        select(User.id)
        .where(User.role == ROLE_SUPER_ADMIN, User.is_active == True)
        .order_by(User.created_at.asc())
        .limit(1)
    )
    if owner_id is None:
        owner_id = await db.scalar(select(User.id).order_by(User.created_at.asc()).limit(1))
    if owner_id is None:  # pragma: no cover — get_current_user guarantees a row
        return current_user.id
    return owner_id


def require(*permissions: str):
    """Gate a route on one or more permissions from ``core.permissions``.

    Depends on ``get_current_user``, which FastAPI caches per request, so
    gating a route costs no extra DB round-trip.
    """

    async def _check(current_user: User = Depends(get_current_user)) -> User:
        missing = [p for p in permissions if not has_permission(current_user.role, p)]
        if missing:
            raise PermissionDeniedError(
                f"Your role ({current_user.role}) is not allowed to {missing[0]}"
            )
        return current_user

    return _check


async def require_super_admin(current_user: User = Depends(get_current_user)) -> User:
    """Gate a route to the vault owner role itself, independent of any single
    permission (used for user administration)."""
    if current_user.role != ROLE_SUPER_ADMIN:
        raise PermissionDeniedError("Super admin privileges required")
    return current_user
