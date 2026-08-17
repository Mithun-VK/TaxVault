import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

ChangeEntityType = Literal["bill", "tax", "insurance"]
ChangeAction = Literal["update", "delete"]
ChangeStatus = Literal["pending", "approved", "rejected", "cancelled", "expired"]


class ChangeRequestCreate(BaseModel):
    entity_type: ChangeEntityType
    entity_id: uuid.UUID
    action: ChangeAction
    # The requested patch, in the same shape the entity's PATCH body takes.
    # Must be empty for a delete; validated in the service against the real
    # update schema so an approval can never apply an unvalidated payload.
    payload: dict = Field(default_factory=dict)
    reason: str | None = Field(default=None, max_length=1000)


class ChangeRequestReview(BaseModel):
    note: str | None = Field(default=None, max_length=1000)


class ChangeRequestOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    entity_type: ChangeEntityType
    entity_id: uuid.UUID
    action: ChangeAction
    payload: dict
    reason: str | None
    status: ChangeStatus
    requested_by_id: uuid.UUID
    requested_by_name: str | None = None
    reviewed_by_id: uuid.UUID | None
    reviewed_by_name: str | None = None
    reviewed_at: datetime | None
    review_note: str | None
    created_at: datetime
    # When a still-pending request lapses. Null once it has been reviewed.
    expires_at: datetime | None
    # Human-readable label for the record the request targets, so the review
    # queue reads as "TNEB electricity" rather than a bare UUID.
    entity_label: str | None = None


class ChangeRequestListResponse(BaseModel):
    items: list[ChangeRequestOut]
    total: int
    skip: int
    limit: int
