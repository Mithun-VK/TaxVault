import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.core.constants import AlertChannel


class AlertConfigOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    entity_type: str
    entity_id: uuid.UUID
    days_before: list[int]
    channels: list[str]
    is_active: bool
    created_at: datetime


class AlertConfigUpdate(BaseModel):
    days_before: list[int] | None = None
    channels: list[AlertChannel] | None = None
    is_active: bool | None = None


class AlertConfigBulkUpdate(AlertConfigUpdate):
    """Apply one setting to every rule at once.

    The reminder schedule and channels are a household-wide preference, not a
    per-bill one - editing them individually across dozens of payables was the
    main friction in the old settings page. `entity_type` narrows the sweep to
    one kind of payable; omit it for all.
    """

    entity_type: str | None = None


class AlertBulkUpdateResult(BaseModel):
    updated: int


class WhatsAppStatus(BaseModel):
    """What the settings page needs to explain the delivery setup, without
    ever returning the auth token."""

    configured: bool
    # Masked (+91••••3210) - enough to confirm the right number, useless if leaked.
    recipient: str | None
    sender: str | None
    # Set when `configured` is false: which env vars are still missing.
    missing: list[str] = []


class WhatsAppTestResult(BaseModel):
    sent: bool
    detail: str


class AlertLogOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    entity_type: str
    entity_id: uuid.UUID
    channel: str
    days_before: int | None
    sent_date: str
    status: str
    error_message: str | None
    sent_at: datetime


class AlertConfigListResponse(BaseModel):
    items: list[AlertConfigOut]
    total: int
    skip: int
    limit: int


class AlertLogListResponse(BaseModel):
    items: list[AlertLogOut]
    total: int
    skip: int
    limit: int
