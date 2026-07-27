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
