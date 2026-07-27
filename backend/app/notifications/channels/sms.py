import logging

import requests

from app.core.config import settings
from app.notifications.base import BaseChannel, Notification

logger = logging.getLogger(__name__)

MSG91_URL = "https://control.msg91.com/api/v5/flow/"


class SMSChannel(BaseChannel):
    async def send(self, notification: Notification) -> bool:
        phone = notification.metadata.get("phone")
        if not phone:
            return False

        body_text = notification.body[:160]
        try:
            resp = requests.post(
                MSG91_URL,
                json={
                    "template_id": settings.MSG91_TEMPLATE_ID,
                    "sender": settings.MSG91_SENDER_ID,
                    "short_url": "0",
                    "mobiles": phone,
                    "VAR1": body_text,
                },
                headers={
                    "authkey": settings.MSG91_AUTH_KEY,
                    "Content-Type": "application/json",
                },
                timeout=10,
            )
            resp.raise_for_status()
            return True
        except Exception as exc:
            logger.error("MSG91 send failed: %s", exc)
            return False
