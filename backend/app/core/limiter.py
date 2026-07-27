"""Shared slowapi rate limiter.

Lives in its own module so route files can import it without creating a circular
import through app.main. Disabled in local development (the shared test-client IP
would otherwise trip limits and the dev Redis is a placeholder); uses Redis
storage in staging/production so counters are shared across worker processes.
"""

from slowapi import Limiter
from slowapi.util import get_remote_address

from app.core.config import settings

_rl_enabled = not settings.is_development

limiter = Limiter(
    key_func=get_remote_address,
    default_limits=[settings.RATE_LIMIT_GLOBAL],
    storage_uri=settings.REDIS_URL if _rl_enabled else "memory://",
    enabled=_rl_enabled,
)
