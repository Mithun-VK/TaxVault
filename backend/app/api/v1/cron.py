"""Serverless replacement for Celery beat's two scheduled tasks.

A Vercel deployment has no persistent worker process, so `celery beat` and
`celery worker` (see docker-compose.prod.yml / docker-compose.selfhost.yml)
never run there. These two routes cover the same ground - the daily alert scan
and the overdue check - by running the scan synchronously inside the request
and delivering each alert inline instead of queueing it onto Celery.

Wired to Vercel Cron Jobs in backend/vercel.json, which issue an authenticated
GET on a schedule. Self-hosted/Docker deployments keep using the real Celery
beat schedule in app/tasks/celery_app.py and never call these routes - CRON_SECRET
is blank there, which these routes treat as "not enabled" rather than open.
"""

import hmac
import logging
import uuid

from fastapi import APIRouter, Header

from app.core.config import settings
from app.core.exceptions import AppException, AuthenticationError
from app.tasks.dispatcher import _dispatch as deliver_alert
from app.tasks.scheduler import _scan, _scan_overdue

logger = logging.getLogger("taxvault.cron")

router = APIRouter(prefix="/cron", tags=["cron"])


def _require_cron_secret(authorization: str | None) -> None:
    if not settings.CRON_SECRET:
        # Not a misconfiguration in every deployment - this is simply unset
        # (and inert) on self-hosted installs that run real Celery beat instead.
        raise AppException(503, "Scheduled endpoints are not enabled on this deployment.")
    expected = f"Bearer {settings.CRON_SECRET}"
    if not authorization or not hmac.compare_digest(authorization, expected):
        raise AuthenticationError("Invalid or missing cron credentials")


async def _inline_dispatch(
    entity_type: str, entity_id: uuid.UUID, channel: str, days_before: int
) -> None:
    """Deliver one alert immediately, in-process.

    Isolated in a try/except: with Celery, one bad send retries on its own and
    never affects the others in the batch. Inline, an unhandled exception here
    would abort every alert still queued behind it in the same request.
    """
    try:
        await deliver_alert(str(entity_type), str(entity_id), channel, days_before)
    except Exception:  # noqa: BLE001
        logger.exception(
            "cron_dispatch_failed entity_type=%s entity_id=%s channel=%s",
            entity_type,
            entity_id,
            channel,
        )


@router.get("/daily-scan")
async def daily_scan(authorization: str | None = Header(None)) -> dict:
    """Mirrors Celery beat's daily-alert-scan (08:00 IST)."""
    _require_cron_secret(authorization)
    await _scan(dispatch=_inline_dispatch)
    return {"status": "ok"}


@router.get("/overdue-check")
async def overdue_check(authorization: str | None = Header(None)) -> dict:
    """Mirrors Celery beat's overdue-check (09:00 IST)."""
    _require_cron_secret(authorization)
    dispatched = await _scan_overdue(dispatch=_inline_dispatch)
    return {"status": "ok", "dispatched": dispatched}
