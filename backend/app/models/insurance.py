import uuid
from datetime import date, datetime

from sqlalchemy import Date, DateTime, ForeignKey, Numeric, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class InsurancePolicy(Base):
    __tablename__ = "insurance_policies"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    asset_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("assets.id"), nullable=True
    )
    # Life / health / term policies cover a person rather than a property.
    individual_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("individuals.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    # Human-readable label shown on the calendar / payments / reports. Falls
    # back to "provider_name - policy_number" when unset. Lets the user name a
    # policy for what it covers — e.g. "Ciaz Car Insurance".
    name: Mapped[str | None] = mapped_column(String)
    policy_number: Mapped[str] = mapped_column(String, nullable=False)
    provider_name: Mapped[str] = mapped_column(String, nullable=False)
    insurance_type: Mapped[str] = mapped_column(String, nullable=False)
    sum_insured: Mapped[float | None] = mapped_column(Numeric(14, 2))
    premium_amount: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False)
    premium_frequency: Mapped[str] = mapped_column(String, nullable=False)
    next_premium_date: Mapped[date | None] = mapped_column(Date)
    policy_start_date: Mapped[date | None] = mapped_column(Date)
    policy_end_date: Mapped[date | None] = mapped_column(Date)
    maturity_date: Mapped[date | None] = mapped_column(Date)
    nominee_name: Mapped[str | None] = mapped_column(String)
    nominee_relation: Mapped[str | None] = mapped_column(String)
    status: Mapped[str] = mapped_column(String, nullable=False, default="active")
    notes: Mapped[str | None] = mapped_column(String)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), onupdate=func.now()
    )

    user = relationship("User", back_populates="insurance_policies")
    asset = relationship("Asset", back_populates="insurance_policies")
    payments = relationship(
        "Payment",
        primaryjoin="and_(Payment.entity_type == 'insurance', foreign(Payment.entity_id) == InsurancePolicy.id)",  # noqa: E501
        lazy="noload",
        viewonly=True,
    )
