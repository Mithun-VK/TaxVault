"""Redis-backed refresh-token blocklist for logout / revocation.

Gated behind ``settings.ENABLE_TOKEN_BLOCKLIST`` so dev and tests (which point at
a placeholder Redis) don't pay a network round-trip. Calls fail open: if Redis is
unreachable we log and treat the token as not-blocklisted rather than locking
everyone out - availability of auth is prioritised, and access tokens are short.
"""

import logging

import redis.asyncio as redis

from app.core.config import settings

logger = logging.getLogger("taxvault")

_PREFIX = "blocklist:jti:"
_client: redis.Redis | None = None


def _get_client() -> redis.Redis:
    global _client
    if _client is None:
        _client = redis.from_url(settings.REDIS_URL, decode_responses=True)
    return _client


async def block_token(jti: str, ttl_seconds: int) -> None:
    if not settings.ENABLE_TOKEN_BLOCKLIST or not jti or ttl_seconds <= 0:
        return
    try:
        await _get_client().set(f"{_PREFIX}{jti}", "1", ex=ttl_seconds)
    except Exception:  # noqa: BLE001 - never let revocation bookkeeping break logout
        logger.exception("Failed to blocklist token jti=%s", jti)


async def is_blocked(jti: str | None) -> bool:
    if not settings.ENABLE_TOKEN_BLOCKLIST or not jti:
        return False
    try:
        return await _get_client().exists(f"{_PREFIX}{jti}") == 1
    except Exception:  # noqa: BLE001 - fail open on Redis outage
        logger.exception("Blocklist lookup failed for jti=%s", jti)
        return False
