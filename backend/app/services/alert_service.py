import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError
from app.models.alert_config import AlertConfig
from app.models.alert_log import AlertLog
from app.schemas.alert import (
    AlertConfigListResponse,
    AlertConfigOut,
    AlertConfigUpdate,
    AlertLogListResponse,
    AlertLogOut,
)


async def list_configs(
    db: AsyncSession,
    user_id: uuid.UUID,
    entity_type: str | None,
    skip: int,
    limit: int,
) -> AlertConfigListResponse:
    q = select(AlertConfig).where(AlertConfig.user_id == user_id)
    if entity_type:
        q = q.where(AlertConfig.entity_type == entity_type)
    total = (await db.execute(select(func.count()).select_from(q.subquery()))).scalar_one()
    result = await db.execute(q.offset(skip).limit(limit))
    return AlertConfigListResponse(
        items=[AlertConfigOut.model_validate(c) for c in result.scalars()],
        total=total,
        skip=skip,
        limit=limit,
    )


async def get_config(db: AsyncSession, user_id: uuid.UUID, config_id: uuid.UUID) -> AlertConfigOut:
    result = await db.execute(
        select(AlertConfig).where(AlertConfig.id == config_id, AlertConfig.user_id == user_id)
    )
    config = result.scalar_one_or_none()
    if not config:
        raise NotFoundError("Alert config not found")
    return AlertConfigOut.model_validate(config)


async def update_config(
    db: AsyncSession, user_id: uuid.UUID, config_id: uuid.UUID, payload: AlertConfigUpdate
) -> AlertConfigOut:
    result = await db.execute(
        select(AlertConfig).where(AlertConfig.id == config_id, AlertConfig.user_id == user_id)
    )
    config = result.scalar_one_or_none()
    if not config:
        raise NotFoundError("Alert config not found")

    updates = payload.model_dump(exclude_none=True)
    for k, v in updates.items():
        if k == "channels":
            setattr(config, k, [ch.value if hasattr(ch, "value") else ch for ch in v])
        else:
            setattr(config, k, v)

    await db.commit()
    await db.refresh(config)
    return AlertConfigOut.model_validate(config)


async def list_logs(
    db: AsyncSession,
    user_id: uuid.UUID,
    entity_type: str | None,
    status: str | None,
    skip: int,
    limit: int,
) -> AlertLogListResponse:
    q = select(AlertLog).where(AlertLog.user_id == user_id)
    if entity_type:
        q = q.where(AlertLog.entity_type == entity_type)
    if status:
        q = q.where(AlertLog.status == status)
    total = (await db.execute(select(func.count()).select_from(q.subquery()))).scalar_one()
    result = await db.execute(q.order_by(AlertLog.sent_at.desc()).offset(skip).limit(limit))
    return AlertLogListResponse(
        items=[AlertLogOut.model_validate(row) for row in result.scalars()],
        total=total,
        skip=skip,
        limit=limit,
    )
