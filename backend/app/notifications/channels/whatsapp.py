"""WhatsApp delivery via Twilio's REST API.

Called with `httpx` rather than the `twilio` SDK: the request is a single form
POST, and the SDK is blocking, which would stall the worker's event loop for the
length of every send. This keeps the channel async all the way down and adds no
dependency.

Recipient resolution, in order:

1. ``TWILIO_WHATSAPP_TO`` — the household number the deployment sends to. This
   is the normal setup: one vault, one WhatsApp number, regardless of which
   account owns the record that triggered the alert.
2. the user's own ``phone_number``, when that setting is left blank.

A send with no resolvable recipient is a no-op returning False, which the
notification service records as a failed AlertLog rather than raising.
"""

import logging

import httpx

from app.core.config import settings
from app.notifications.base import BaseChannel, Notification

logger = logging.getLogger(__name__)

# Twilio rejects a body over 1600 chars outright; ours are far shorter, but
# truncate rather than let a long note turn into a 400.
MAX_BODY_CHARS = 1500


def _to_whatsapp_address(number: str) -> str:
    """Twilio addresses WhatsApp endpoints as `whatsapp:+E164`."""
    cleaned = number.strip().replace(" ", "").replace("-", "")
    if not cleaned:
        return ""
    if cleaned.startswith("whatsapp:"):
        return cleaned
    if not cleaned.startswith("+"):
        cleaned = f"+{cleaned}"
    return f"whatsapp:{cleaned}"


def resolve_recipient(user_phone: str | None = None) -> str:
    """The number alerts go to, or "" when none is configured."""
    return (settings.TWILIO_WHATSAPP_TO or user_phone or "").strip()


class WhatsAppChannel(BaseChannel):
    async def send(self, notification: Notification) -> bool:
        if not settings.whatsapp_configured:
            logger.warning(
                "whatsapp_not_configured: set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN "
                "and TWILIO_WHATSAPP_FROM to enable WhatsApp alerts"
            )
            return False

        recipient = resolve_recipient(notification.metadata.get("phone"))
        if not recipient:
            logger.warning(
                "whatsapp_no_recipient: set TWILIO_WHATSAPP_TO, or give the user a phone number"
            )
            return False

        return await send_whatsapp(recipient, notification.body)


async def send_whatsapp(to_number: str, body: str) -> bool:
    """POST one message to Twilio. Returns True only on a 2xx.

    Takes a plain number and normalises it here, so every caller — the alert
    channel and the settings "send test message" action — goes down one path.
    A passing test therefore cannot mean anything other than that alerts will
    deliver.
    """
    to_address = _to_whatsapp_address(to_number)
    if not to_address:
        return False

    url = f"{settings.TWILIO_API_URL}/Accounts/{settings.TWILIO_ACCOUNT_SID}/Messages.json"
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(
                url,
                data={
                    "From": _to_whatsapp_address(settings.TWILIO_WHATSAPP_FROM),
                    "To": to_address,
                    "Body": body[:MAX_BODY_CHARS],
                },
                auth=(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN),
            )
        if resp.status_code >= 400:
            # Twilio puts the actionable reason in the JSON body, not the status
            # line — surface it so the cause is in the log, not just "failed".
            logger.error(
                "whatsapp_send_failed status=%s body=%s", resp.status_code, resp.text[:500]
            )
            return False
        return True
    except Exception as exc:  # noqa: BLE001 — a send must never break the caller
        logger.error("whatsapp_send_error: %s", exc)
        return False
