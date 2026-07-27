import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user, get_db, require_admin
from app.core.exceptions import AuthenticationError, NotFoundError, PermissionDeniedError
from app.core.security import hash_password, verify_password
from app.models.user import User
from app.schemas.user import (
    PasswordChange,
    RoleUpdate,
    UserListResponse,
    UserOut,
    UserUpdate,
)

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me", response_model=UserOut)
async def me(current_user: User = Depends(get_current_user)):
    return UserOut.model_validate(current_user)


@router.patch("/me", response_model=UserOut)
async def update_me(
    payload: UserUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    for k, v in payload.model_dump(exclude_none=True).items():
        setattr(current_user, k, v)
    await db.commit()
    await db.refresh(current_user)
    return UserOut.model_validate(current_user)


@router.patch("/me/password", status_code=200)
async def change_password(
    payload: PasswordChange,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not verify_password(payload.current_password, current_user.hashed_password):
        raise AuthenticationError("Current password is incorrect")
    current_user.hashed_password = hash_password(payload.new_password)
    await db.commit()
    return {"detail": "Password changed successfully"}


# ── Admin: user management ──────────────────────────────────────────────────
@router.get("/", response_model=UserListResponse, dependencies=[Depends(require_admin)])
async def list_users(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    total = await db.scalar(select(func.count()).select_from(User)) or 0
    result = await db.execute(
        select(User).order_by(User.created_at.asc()).offset(skip).limit(limit)
    )
    users = result.scalars().all()
    return UserListResponse(items=[UserOut.model_validate(u) for u in users], total=total)


@router.patch("/{user_id}/role", response_model=UserOut)
async def set_user_role(
    user_id: uuid.UUID,
    payload: RoleUpdate,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    result = await db.execute(select(User).where(User.id == user_id))
    target = result.scalar_one_or_none()
    if target is None:
        raise NotFoundError("User not found")

    # Never allow the deployment to end up with zero admins: block demoting the
    # last remaining admin (covers an admin demoting themselves too).
    if target.role == "admin" and payload.role != "admin":
        admin_count = await db.scalar(
            select(func.count()).select_from(User).where(User.role == "admin")
        )
        if (admin_count or 0) <= 1:
            raise PermissionDeniedError("Cannot remove the last admin")

    target.role = payload.role
    await db.commit()
    await db.refresh(target)
    return UserOut.model_validate(target)
