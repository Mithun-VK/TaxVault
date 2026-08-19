import uuid
from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Numeric, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class RecurringBill(Base):
    __tablename__ = "recurring_bills"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    # Human-readable label shown on the calendar / payments / reports. Falls
    # back to provider_name (then bill_type) when unset. Lets the user tell
    # apart otherwise-identical bills - e.g. several "TNEB" electricity bills.
    name: Mapped[str | None] = mapped_column(String)
    bill_type: Mapped[str] = mapped_column(String, nullable=False)
    provider_name: Mapped[str | None] = mapped_column(String)
    account_number: Mapped[str | None] = mapped_column(String)
    billing_cycle: Mapped[str] = mapped_column(String, nullable=False)
    average_amount: Mapped[float | None] = mapped_column(Numeric(10, 2))
    next_due_date: Mapped[date] = mapped_column(Date, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    notes: Mapped[str | None] = mapped_column(String)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), onupdate=func.now()
    )

    user = relationship("User", back_populates="recurring_bills")
    payments = relationship(
        "Payment",
        primaryjoin="and_(Payment.entity_type == 'bill', foreign(Payment.entity_id) == RecurringBill.id)",  # noqa: E501
        lazy="noload",
        viewonly=True,
    )
