import uuid
from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Numeric, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class TaxObligation(Base):
    __tablename__ = "tax_obligations"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    asset_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("assets.id"), nullable=True
    )
    # Personal taxes (income tax, professional tax…) hang off an individual
    # rather than a property.
    individual_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("individuals.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    # Human-readable label shown on the calendar / payments / reports. Falls
    # back to description (then tax_type) when unset.
    name: Mapped[str | None] = mapped_column(String)
    tax_type: Mapped[str] = mapped_column(String, nullable=False)
    # Assessment / property / land / consumer number issued by the authority —
    # e.g. a property-tax assessment ID. Distinct from the internal `id`.
    tax_number: Mapped[str | None] = mapped_column(String)
    jurisdiction: Mapped[str | None] = mapped_column(String)
    assessment_year: Mapped[str | None] = mapped_column(String)
    description: Mapped[str | None] = mapped_column(String)
    total_amount: Mapped[float | None] = mapped_column(Numeric(12, 2))
    due_date: Mapped[date] = mapped_column(Date, nullable=False)
    recurrence_rule: Mapped[str | None] = mapped_column(String)
    status: Mapped[str] = mapped_column(String, nullable=False, default="pending")
    notes: Mapped[str | None] = mapped_column(String)
    is_archived: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), onupdate=func.now()
    )

    user = relationship("User", back_populates="tax_obligations")
    asset = relationship("Asset", back_populates="tax_obligations")
    payments = relationship(
        "Payment",
        primaryjoin="and_(Payment.entity_type == 'tax', foreign(Payment.entity_id) == TaxObligation.id)",  # noqa: E501
        lazy="noload",
        viewonly=True,
    )
