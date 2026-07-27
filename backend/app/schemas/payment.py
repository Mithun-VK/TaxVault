import uuid
from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field

from app.core.constants import EntityType, PaymentMethod


class PaymentCreate(BaseModel):
    entity_type: EntityType
    entity_id: uuid.UUID
    amount_paid: Decimal = Field(gt=0)
    payment_date: date
    payment_method: PaymentMethod | None = None
    reference_number: str | None = Field(default=None, max_length=100)
    period: str | None = Field(default=None, max_length=100)
    notes: str | None = Field(default=None, max_length=2000)
    receipt_document_id: uuid.UUID | None = None


class PaymentUpdate(BaseModel):
    amount_paid: Decimal | None = Field(default=None, gt=0)
    payment_date: date | None = None
    payment_method: PaymentMethod | None = None
    reference_number: str | None = Field(default=None, max_length=100)
    period: str | None = Field(default=None, max_length=100)
    notes: str | None = Field(default=None, max_length=2000)
    receipt_document_id: uuid.UUID | None = None


class PaymentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    entity_type: str
    entity_id: uuid.UUID
    amount_paid: Decimal
    payment_date: date
    payment_method: str | None
    reference_number: str | None
    period: str | None
    notes: str | None
    receipt_document_id: uuid.UUID | None
    created_at: datetime


class PaymentListResponse(BaseModel):
    items: list[PaymentOut]
    total: int
    skip: int
    limit: int
