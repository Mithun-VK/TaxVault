import uuid
from datetime import date, datetime

from sqlalchemy import Date, DateTime, ForeignKey, Numeric, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Payment(Base):
    __tablename__ = "payments"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    entity_type: Mapped[str] = mapped_column(String, nullable=False)
    entity_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    amount_paid: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    payment_date: Mapped[date] = mapped_column(Date, nullable=False)
    payment_method: Mapped[str | None] = mapped_column(String)
    reference_number: Mapped[str | None] = mapped_column(String)
    # Free-text period this payment covers, entered manually — e.g. "2026-27"
    # for an annual insurance premium, or "Mar-May 2026" for a bi-monthly EB bill.
    period: Mapped[str | None] = mapped_column(String)
    notes: Mapped[str | None] = mapped_column(String)
    # Soft reference to documents.id — the receipt uploaded for this payment.
    # Kept as a plain nullable column (no hard FK) in line with the polymorphic
    # entity_type/entity_id style used across payments/documents/alerts.
    receipt_document_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    user = relationship("User", back_populates="payments")
