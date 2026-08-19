import asyncio
import logging
from datetime import date
from typing import Any

from sqlalchemy import select

from app.db.session import AsyncSessionLocal
from app.models.alert_config import AlertConfig
from app.models.alert_log import AlertLog
from app.models.insurance import InsurancePolicy
from app.models.recurring_bill import RecurringBill
from app.models.tax_obligation import TaxObligation
from app.tasks.celery_app import celery_app

logger = logging.getLogger(__name__)


async def _scan() -> None:
    today = date.today()

    async with AsyncSessionLocal() as db:
        configs = (
            (await db.execute(select(AlertConfig).where(AlertConfig.is_active == True)))
            .scalars()
            .all()
        )

        for config in configs:
            # entity/row are polymorphic across the three payable tables.
            entity: Any = None
            due_date: date | None = None
            row: Any = None

            if config.entity_type == "tax":
                row = (
                    await db.execute(
                        select(TaxObligation).where(TaxObligation.id == config.entity_id)
                    )
                ).scalar_one_or_none()
                if row and row.status == "pending":
                    entity = row
                    due_date = row.due_date

            elif config.entity_type == "insurance":
                row = (
                    await db.execute(
                        select(InsurancePolicy).where(InsurancePolicy.id == config.entity_id)
                    )
                ).scalar_one_or_none()
                if row and row.status == "active" and row.next_premium_date:
                    entity = row
                    due_date = row.next_premium_date

            elif config.entity_type == "bill":
                row = (
                    await db.execute(
                        select(RecurringBill).where(RecurringBill.id == config.entity_id)
                    )
                ).scalar_one_or_none()
                if row and row.is_active:
                    entity = row
                    due_date = row.next_due_date

            if entity is None or due_date is None:
                continue

            days_diff = (due_date - today).days

            for days_before in config.days_before:
                if days_diff == days_before or (days_diff < 0 and days_before == 0):
                    for channel in config.channels:
                        sent_date = today.strftime("%Y-%m-%d")
                        existing = (
                            await db.execute(
                                select(AlertLog).where(
                                    AlertLog.entity_type == config.entity_type,
                                    AlertLog.entity_id == config.entity_id,
                                    AlertLog.channel == channel,
                                    AlertLog.days_before == days_before,
                                    AlertLog.sent_date == sent_date,
                                )
                            )
                        ).scalar_one_or_none()

                        if not existing:
                            from app.tasks.dispatcher import dispatch_alert

                            dispatch_alert.delay(
                                str(config.entity_type),
                                str(config.entity_id),
                                channel,
                                days_before,
                            )


@celery_app.task(name="app.tasks.scheduler.run_daily_scan")
def run_daily_scan() -> None:
    asyncio.run(_scan())


# Terminal statuses per entity type - an entity in one of these is not "overdue".
_TERMINAL_STATUS = {"paid", "exempt", "surrendered", "matured", "lapsed"}


async def _scan_overdue() -> int:
    today = date.today()
    sent_date = today.strftime("%Y-%m-%d")
    dispatched = 0

    async with AsyncSessionLocal() as db:
        configs = (
            (await db.execute(select(AlertConfig).where(AlertConfig.is_active == True)))
            .scalars()
            .all()
        )

        for config in configs:
            entity: Any = None
            due_date: date | None = None
            row: Any = None

            if config.entity_type == "tax":
                row = (
                    await db.execute(
                        select(TaxObligation).where(TaxObligation.id == config.entity_id)
                    )
                ).scalar_one_or_none()
                if row:
                    entity, due_date = row, row.due_date
            elif config.entity_type == "insurance":
                row = (
                    await db.execute(
                        select(InsurancePolicy).where(InsurancePolicy.id == config.entity_id)
                    )
                ).scalar_one_or_none()
                if row:
                    entity, due_date = row, row.next_premium_date
            elif config.entity_type == "bill":
                row = (
                    await db.execute(
                        select(RecurringBill).where(RecurringBill.id == config.entity_id)
                    )
                ).scalar_one_or_none()
                if row:
                    entity, due_date = row, row.next_due_date

            if entity is None or due_date is None or due_date >= today:
                continue

            status = (getattr(entity, "status", None) or "active").lower()
            if status in _TERMINAL_STATUS:
                continue

            for channel in config.channels:
                existing = (
                    await db.execute(
                        select(AlertLog).where(
                            AlertLog.entity_type == config.entity_type,
                            AlertLog.entity_id == config.entity_id,
                            AlertLog.channel == channel,
                            AlertLog.days_before == 0,
                            AlertLog.sent_date == sent_date,
                        )
                    )
                ).scalar_one_or_none()
                if not existing:
                    from app.tasks.dispatcher import dispatch_alert

                    dispatch_alert.delay(str(config.entity_type), str(config.entity_id), channel, 0)
                    dispatched += 1

    logger.info("overdue_check_complete dispatched=%d date=%s", dispatched, sent_date)
    return dispatched


@celery_app.task(name="app.tasks.scheduler.check_overdue")
def check_overdue() -> int:
    return asyncio.run(_scan_overdue())
