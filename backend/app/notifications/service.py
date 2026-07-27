import logging
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.alert_log import AlertLog
from app.notifications.base import BaseChannel, Notification, NotificationChannel

logger = logging.getLogger(__name__)


class NotificationService:
    def __init__(self) -> None:
        self._channels: dict[NotificationChannel, BaseChannel] = {}

    def register(self, channel: NotificationChannel, handler: BaseChannel) -> None:
        self._channels[channel] = handler

    async def send(self, notification: Notification, db: AsyncSession) -> bool:
        handler = self._channels.get(notification.channel)
        if not handler:
            logger.warning("No handler for channel %s", notification.channel)
            return False

        sent_date = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        success = await handler.send(notification)

        log = AlertLog(
            user_id=notification.user_id,
            entity_type=notification.entity_type,
            entity_id=notification.entity_id,
            channel=notification.channel.value,
            days_before=notification.days_before,
            sent_date=sent_date,
            status="sent" if success else "failed",
            error_message=None,
        )
        db.add(log)
        await db.commit()
        return success

    async def broadcast(self, notifications: list[Notification], db: AsyncSession) -> None:
        for n in notifications:
            await self.send(n, db)
