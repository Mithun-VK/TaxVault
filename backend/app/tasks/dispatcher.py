import asyncio
import logging
import uuid
from datetime import date
from typing import Any

from sqlalchemy import select

from app.db.session import AsyncSessionLocal
from app.models.alert_log import AlertLog
from app.models.insurance import InsurancePolicy
from app.models.recurring_bill import RecurringBill
from app.models.tax_obligation import TaxObligation
from app.models.user import User
from app.notifications.base import NotificationChannel
from app.notifications.factory import get_notification_service
from app.notifications.templates import build_notification
from app.tasks.celery_app import celery_app

logger = logging.getLogger(__name__)


async def _dispatch(entity_type: str, entity_id: str, channel: str, days_before: int) -> None:
    entity_uuid = uuid.UUID(entity_id)
    sent_date = date.today().strftime("%Y-%m-%d")

    async with AsyncSessionLocal() as db:
        existing = (
            await db.execute(
                select(AlertLog).where(
                    AlertLog.entity_type == entity_type,
                    AlertLog.entity_id == entity_uuid,
                    AlertLog.channel == channel,
                    AlertLog.days_before == days_before,
                    AlertLog.sent_date == sent_date,
                )
            )
        ).scalar_one_or_none()
        if existing:
            logger.info(
                "Duplicate alert skipped: %s %s %s %s", entity_type, entity_id, channel, sent_date
            )
            return

        entity: Any = None
        user_id: uuid.UUID | None = None
        row: Any = None

        if entity_type == "tax":
            row = (
                await db.execute(select(TaxObligation).where(TaxObligation.id == entity_uuid))
            ).scalar_one_or_none()
            if row:
                entity = row
                user_id = row.user_id
        elif entity_type == "insurance":
            row = (
                await db.execute(select(InsurancePolicy).where(InsurancePolicy.id == entity_uuid))
            ).scalar_one_or_none()
            if row:
                entity = row
                user_id = row.user_id
        elif entity_type == "bill":
            row = (
                await db.execute(select(RecurringBill).where(RecurringBill.id == entity_uuid))
            ).scalar_one_or_none()
            if row:
                entity = row
                user_id = row.user_id

        if not entity or not user_id:
            return

        user = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
        if not user:
            return

        notification = build_notification(
            entity_type=entity_type,
            entity=entity,
            user=user,
            days_before=days_before,
            channel=NotificationChannel(channel),
        )

        svc = get_notification_service()
        await svc.send(notification, db)


@celery_app.task(
    name="app.tasks.dispatcher.dispatch_alert",
    bind=True,
    max_retries=3,
    default_retry_delay=300,
)
def dispatch_alert(
    self: Any, entity_type: str, entity_id: str, channel: str, days_before: int
) -> None:
    try:
        asyncio.run(_dispatch(entity_type, entity_id, channel, days_before))
    except Exception as exc:
        logger.error("dispatch_alert failed: %s", exc)
        raise self.retry(exc=exc) from exc
