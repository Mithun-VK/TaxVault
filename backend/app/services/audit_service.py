import json
import uuid
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.constants import AuditAction
from app.models.audit_log import AuditLog


def _json_safe(changes: dict[str, Any] | None) -> dict[str, Any]:
    """Coerce Decimal/date/datetime/UUID/Enum values into JSON-serializable form."""
    if not changes:
        return {}
    return json.loads(json.dumps(changes, default=str))


async def log_audit(
    db: AsyncSession,
    user_id: uuid.UUID,
    action: AuditAction,
    entity_type: str,
    entity_id: uuid.UUID,
    changes: dict[str, Any] | None = None,
    ip_address: str | None = None,
) -> None:
    entry = AuditLog(
        user_id=user_id,
        action=action.value,
        entity_type=entity_type,
        entity_id=entity_id,
        changes=_json_safe(changes),
        ip_address=ip_address,
    )
    db.add(entry)
