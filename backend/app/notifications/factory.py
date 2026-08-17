import logging
import os
from functools import lru_cache

from app.notifications.base import NotificationChannel
from app.notifications.channels.email import EmailChannel
from app.notifications.channels.push import PushChannel
from app.notifications.channels.sms import SMSChannel
from app.notifications.channels.whatsapp import WhatsAppChannel
from app.notifications.service import NotificationService

logger = logging.getLogger("taxvault.notifications")


def _init_firebase() -> None:
    from app.core.config import settings

    try:
        import firebase_admin
        from firebase_admin import credentials

        if firebase_admin._apps:
            return
        if not os.path.exists(settings.FIREBASE_SERVICE_ACCOUNT_PATH):
            logger.info(
                "firebase_not_configured: service account file %s not found; push disabled",
                settings.FIREBASE_SERVICE_ACCOUNT_PATH,
            )
            return
        cred = credentials.Certificate(settings.FIREBASE_SERVICE_ACCOUNT_PATH)
        firebase_admin.initialize_app(cred)
        logger.info("firebase_initialized")
    except Exception as exc:  # noqa: BLE001 — never block app startup on FCM
        logger.error("firebase_init_failed: %s", exc)


@lru_cache(maxsize=1)
def get_notification_service() -> NotificationService:
    _init_firebase()
    svc = NotificationService()
    svc.register(NotificationChannel.WHATSAPP, WhatsAppChannel())
    svc.register(NotificationChannel.EMAIL, EmailChannel())
    svc.register(NotificationChannel.SMS, SMSChannel())
    svc.register(NotificationChannel.PUSH, PushChannel())
    return svc
