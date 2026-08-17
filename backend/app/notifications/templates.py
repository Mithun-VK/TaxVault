from datetime import date
from typing import Any

from app.notifications.base import Notification, NotificationChannel

ENTITY_LABEL = {
    "tax": "Tax",
    "insurance": "Insurance premium",
    "bill": "Bill",
}


def _days_label(days: int) -> str:
    if days == 0:
        return "today"
    elif days == 1:
        return "tomorrow"
    return f"in {days} days"


def _amount_label(amount: float | None) -> str:
    """₹12,000 rather than ₹12000.0 — these are read on a phone."""
    if amount in (None, ""):
        return "—"
    try:
        return f"₹{float(amount):,.0f}"
    except (TypeError, ValueError):
        return f"₹{amount}"


def build_whatsapp_body(
    entity_type: str, name: str, due_date: date | None, amount: float | None, days_before: int
) -> str:
    """A WhatsApp reminder: the payable, the money, the date, in that order.

    Deliberately short and unformatted beyond WhatsApp's own *bold* — this is
    read on a lock screen, so the first line has to carry the whole message.
    """
    label = _days_label(days_before)
    heading = "overdue" if days_before == 0 else f"due {label}"
    lines = [
        f"*{ENTITY_LABEL.get(entity_type, 'Payment')} {heading}*",
        "",
        f"*{name}*",
        f"Amount: {_amount_label(amount)}",
        f"Due: {due_date.strftime('%d %b %Y') if due_date else '—'}",
        "",
        "— TaxVault",
    ]
    return "\n".join(lines)


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
    # Prefer the editable `name` column every payable now carries (migration
    # 0010) so the reminder reads with the same label as the calendar and the
    # payments ledger, then fall back to the historical derivation.
    name: str = (
        getattr(entity, "name", None)
        or getattr(entity, "description", None)
        or getattr(entity, "provider_name", None)
        or getattr(entity, "policy_number", None)
        or entity_type
    )

    label = _days_label(days_before)
    subject_map = {
        "tax": f"Tax payment due {label}",
        "insurance": f"Insurance premium due {label}",
        "bill": f"Bill payment due {label}",
    }
    subject = subject_map.get(entity_type, f"Payment due {label}")

    if channel == NotificationChannel.WHATSAPP:
        body = build_whatsapp_body(entity_type, name, due_date, amount, days_before)
    else:
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
