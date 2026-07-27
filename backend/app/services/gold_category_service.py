import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.constants import AuditAction
from app.core.exceptions import DuplicateError, NotFoundError
from app.models.gold_category import GoldCategory
from app.schemas.gold_category import (
    GoldCategoryCreate,
    GoldCategoryListResponse,
    GoldCategoryOut,
    GoldCategoryUpdate,
)
from app.services.audit_service import log_audit


async def list_gold_categories(
    db: AsyncSession, user_id: uuid.UUID
) -> GoldCategoryListResponse:
    result = await db.execute(
        select(GoldCategory)
        .where(GoldCategory.user_id == user_id)
        .order_by(GoldCategory.label)
    )
    return GoldCategoryListResponse(
        items=[GoldCategoryOut.model_validate(c) for c in result.scalars()]
    )


async def create_gold_category(
    db: AsyncSession, user_id: uuid.UUID, payload: GoldCategoryCreate
) -> GoldCategoryOut:
    existing = (
        await db.execute(
            select(GoldCategory).where(
                GoldCategory.user_id == user_id, GoldCategory.value == payload.value
            )
        )
    ).scalar_one_or_none()
    if existing:
        raise DuplicateError("That gold category already exists")

    category = GoldCategory(user_id=user_id, value=payload.value, label=payload.label)
    db.add(category)
    await db.flush()
    await log_audit(
        db, user_id, AuditAction.create, "gold_category", category.id, payload.model_dump()
    )
    await db.commit()
    await db.refresh(category)
    return GoldCategoryOut.model_validate(category)


async def _get_owned(
    db: AsyncSession, user_id: uuid.UUID, category_id: uuid.UUID
) -> GoldCategory:
    category = (
        await db.execute(
            select(GoldCategory).where(
                GoldCategory.id == category_id, GoldCategory.user_id == user_id
            )
        )
    ).scalar_one_or_none()
    if not category:
        raise NotFoundError("Gold category not found")
    return category


async def update_gold_category(
    db: AsyncSession, user_id: uuid.UUID, category_id: uuid.UUID, payload: GoldCategoryUpdate
) -> GoldCategoryOut:
    category = await _get_owned(db, user_id, category_id)
    old = {"label": {"old": category.label, "new": payload.label}}
    category.label = payload.label
    await log_audit(db, user_id, AuditAction.update, "gold_category", category.id, old)
    await db.commit()
    await db.refresh(category)
    return GoldCategoryOut.model_validate(category)


async def delete_gold_category(
    db: AsyncSession, user_id: uuid.UUID, category_id: uuid.UUID
) -> None:
    category = await _get_owned(db, user_id, category_id)
    await log_audit(db, user_id, AuditAction.delete, "gold_category", category.id)
    await db.delete(category)
    await db.commit()
