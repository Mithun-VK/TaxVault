import logging

from app.notifications.base import BaseChannel, Notification

logger = logging.getLogger(__name__)


class PushChannel(BaseChannel):
    async def send(self, notification: Notification) -> bool:
        tokens: list[str] = notification.metadata.get("device_tokens", [])
        if not tokens:
            return False

        try:
            from firebase_admin import messaging

            message = messaging.MulticastMessage(
                notification=messaging.Notification(
                    title=notification.subject,
                    body=notification.body,
                ),
                data={
                    "entity_type": notification.entity_type,
                    "entity_id": str(notification.entity_id),
                },
                tokens=tokens,
            )
            response = messaging.send_each_for_multicast(message)
            success = response.success_count > 0
            if response.failure_count:
                logger.warning("Push: %d failures", response.failure_count)
            return success
        except Exception as exc:
            logger.error("Firebase push failed: %s", exc)
            return False
