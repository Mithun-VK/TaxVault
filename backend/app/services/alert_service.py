import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.exceptions import NotFoundError
from app.models.alert_config import AlertConfig
from app.models.alert_log import AlertLog
from app.notifications.channels.whatsapp import resolve_recipient, send_whatsapp
from app.schemas.alert import (
    AlertBulkUpdateResult,
    AlertConfigBulkUpdate,
    AlertConfigListResponse,
    AlertConfigOut,
    AlertConfigUpdate,
    AlertLogListResponse,
    AlertLogOut,
    WhatsAppStatus,
    WhatsAppTestResult,
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


async def bulk_update_configs(
    db: AsyncSession, user_id: uuid.UUID, payload: AlertConfigBulkUpdate
) -> AlertBulkUpdateResult:
    """Apply one change across every rule in the vault (optionally one type).

    The settings page uses this for the household-wide controls - reminder
    schedule, channels, all-on/all-off - so a change is one request rather than
    one per payable.
    """
    q = select(AlertConfig).where(AlertConfig.user_id == user_id)
    if payload.entity_type:
        q = q.where(AlertConfig.entity_type == payload.entity_type)

    configs = (await db.execute(q)).scalars().all()
    updates = payload.model_dump(exclude_none=True, exclude={"entity_type"})
    if not updates:
        return AlertBulkUpdateResult(updated=0)

    for config in configs:
        for k, v in updates.items():
            if k == "channels":
                config.channels = [ch.value if hasattr(ch, "value") else ch for ch in v]
            else:
                setattr(config, k, v)

    await db.commit()
    return AlertBulkUpdateResult(updated=len(configs))


def _mask_number(number: str | None) -> str | None:
    """+919876543210 -> +91••••3210. Confirms the right number without
    printing it in full to anyone who opens the settings page."""
    if not number:
        return None
    cleaned = number.strip()
    if len(cleaned) <= 6:
        return cleaned
    return f"{cleaned[:3]}••••{cleaned[-4:]}"


def whatsapp_status() -> WhatsAppStatus:
    missing = [
        name
        for name, value in (
            ("TWILIO_ACCOUNT_SID", settings.TWILIO_ACCOUNT_SID),
            ("TWILIO_AUTH_TOKEN", settings.TWILIO_AUTH_TOKEN),
            ("TWILIO_WHATSAPP_FROM", settings.TWILIO_WHATSAPP_FROM),
        )
        if not value
    ]
    return WhatsAppStatus(
        configured=settings.whatsapp_configured,
        recipient=_mask_number(resolve_recipient()),
        sender=_mask_number(settings.TWILIO_WHATSAPP_FROM),
        missing=missing,
    )


async def send_whatsapp_test(user_phone: str | None) -> WhatsAppTestResult:
    """Send a real message down the real path, so a pass proves alerts work."""
    if not settings.whatsapp_configured:
        return WhatsAppTestResult(
            sent=False,
            detail="WhatsApp is not configured. Set the Twilio values in backend/.env.",
        )

    recipient = resolve_recipient(user_phone)
    if not recipient:
        return WhatsAppTestResult(
            sent=False,
            detail="No recipient. Set TWILIO_WHATSAPP_TO, or add a phone number to your profile.",
        )

    body = (
        "*TaxVault test message*\n\n"
        "WhatsApp alerts are working. Payment reminders will arrive here.\n\n"
        "- TaxVault"
    )
    ok = await send_whatsapp(recipient, body)
    return WhatsAppTestResult(
        sent=ok,
        detail=(
            f"Test message sent to {_mask_number(recipient)}."
            if ok
            else "Twilio rejected the message. Check the API logs for the reason."
        ),
    )


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
