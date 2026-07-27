from datetime import date
from typing import Any

from app.notifications.base import Notification, NotificationChannel


def _days_label(days: int) -> str:
    if days == 0:
        return "today"
    elif days == 1:
        return "tomorrow"
    return f"in {days} days"


def build_notification(
    entity_type: str,
    entity: Any,
    user: Any,
    days_before: int,
    channel: NotificationChannel,
) -> Notification:
    due_date: date | None = (
        getattr(entity, "due_date", None)
        or getattr(entity, "next_premium_date", None)
        or getattr(entity, "next_due_date", None)
    )
    amount: float | None = (
        getattr(entity, "total_amount", None)
        or getattr(entity, "premium_amount", None)
        or getattr(entity, "average_amount", None)
    )
    name: str = (
        getattr(entity, "description", None)
        or getattr(entity, "policy_number", None)
        or getattr(entity, "provider_name", None)
        or entity_type
    )

    label = _days_label(days_before)
    subject_map = {
        "tax": f"Tax payment due {label}",
        "insurance": f"Insurance premium due {label}",
        "bill": f"Bill payment due {label}",
    }
    subject = subject_map.get(entity_type, f"Payment due {label}")

    body = (
        f"Hi {user.full_name or user.email},\n\n"
        f"Your {entity_type} '{name}' is due {label}.\n"
        f"Due date: {due_date}\n"
        f"Amount: ₹{amount or 'N/A'}\n\n"
        f"Please make the payment on time to avoid penalties.\n"
    )

    html_body = f"""<html><body>
<p>Hi {user.full_name or user.email},</p>
<p>Your <strong>{entity_type}</strong> <em>{name}</em> is due <strong>{label}</strong>.</p>
<ul>
<li><strong>Due Date:</strong> {due_date}</li>
<li><strong>Amount:</strong> ₹{amount or 'N/A'}</li>
</ul>
<p>Please make the payment on time to avoid penalties.</p>
</body></html>"""

    metadata: dict[str, Any] = {
        "email": user.email,
        "phone": user.phone_number or "",
        "device_tokens": user.device_tokens or [],
        "user_name": user.full_name or user.email,
        "entity_name": name,
        "amount": str(amount or ""),
        "due_date": str(due_date or ""),
        "days_remaining": days_before,
    }

    return Notification(
        user_id=user.id,
        entity_type=entity_type,
        entity_id=entity.id,
        channel=channel,
        subject=subject,
        body=body,
        html_body=html_body,
        days_before=days_before,
        metadata=metadata,
    )
