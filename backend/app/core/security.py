import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

import bcrypt
from jose import JWTError, jwt

from app.core.config import settings

ALGORITHM = "HS256"

# bcrypt hard-limits the input to 72 bytes; truncate so longer passwords
# (or multi-byte UTF-8) never raise ValueError.
_BCRYPT_MAX_BYTES = 72


def _to_bytes(password: str) -> bytes:
    return password.encode("utf-8")[:_BCRYPT_MAX_BYTES]


def hash_password(password: str) -> str:
    return bcrypt.hashpw(_to_bytes(password), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(_to_bytes(plain), hashed.encode("utf-8"))
    except (ValueError, TypeError):
        return False


def _create_token(
    subject: str, expires_delta: timedelta, extra: dict[str, Any] | None = None
) -> str:
    expire = datetime.now(timezone.utc) + expires_delta
    payload: dict[str, Any] = {"sub": subject, "exp": expire}
    if extra:
        payload.update(extra)
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=ALGORITHM)


def create_access_token(user_id: str) -> str:
    return _create_token(
        user_id,
        timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
        {"type": "access"},
    )


def create_refresh_token(user_id: str) -> str:
    # jti enables per-token revocation (logout) via the Redis blocklist.
    return _create_token(
        user_id,
        timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
        {"type": "refresh", "jti": uuid.uuid4().hex},
    )


def create_reset_token(user_id: str) -> str:
    return _create_token(
        user_id,
        timedelta(minutes=settings.RESET_TOKEN_EXPIRE_MINUTES),
        {"type": "reset"},
    )


def decode_token(token: str) -> dict[str, Any]:
    try:
        return jwt.decode(token, settings.SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError as exc:
        raise ValueError("Invalid or expired token") from exc
