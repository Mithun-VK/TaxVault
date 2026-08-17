import uuid
from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Numeric, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Asset(Base):
    __tablename__ = "assets"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    individual_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("individuals.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    # A property may be held by a company instead of (or alongside) a person.
    company_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("companies.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    asset_type: Mapped[str] = mapped_column(String, nullable=False)
    name: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str | None] = mapped_column(String)
    acquisition_date: Mapped[date | None] = mapped_column(Date)
    acquisition_cost: Mapped[float | None] = mapped_column(Numeric(14, 2))
    current_value: Mapped[float | None] = mapped_column(Numeric(14, 2))
    status: Mapped[str] = mapped_column(String, nullable=False, default="active")

    # ── Property Details (land & building) — first-class columns. Values are
    # stored as text; multi-value fields (patta/EB numbers) are comma-joined.
    # asset_metadata still holds extras (deed_type, tax ids, lease notes, …).
    owner_name: Mapped[str | None] = mapped_column(String)
    address: Mapped[str | None] = mapped_column(Text)
    deed_number: Mapped[str | None] = mapped_column(String)
    deed_date: Mapped[str | None] = mapped_column(String)
    registration_office: Mapped[str | None] = mapped_column(String)
    survey_number: Mapped[str | None] = mapped_column(String)
    land_area: Mapped[str | None] = mapped_column(String)
    patta_number: Mapped[str | None] = mapped_column(String)
    chitta: Mapped[str | None] = mapped_column(String)
    adangal: Mapped[str | None] = mapped_column(String)
    eb_numbers: Mapped[str | None] = mapped_column(String)

    asset_metadata: Mapped[dict] = mapped_column(
        "asset_metadata", JSONB, nullable=False, default=dict
    )
    notes: Mapped[str | None] = mapped_column(String)
    is_archived: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), onupdate=func.now()
    )

    user = relationship("User", back_populates="assets")
    individual = relationship(
        "Individual",
        back_populates="assets",
        foreign_keys="Asset.individual_id",
        lazy="noload",
    )
    company = relationship(
        "Company",
        back_populates="assets",
        foreign_keys="Asset.company_id",
        lazy="noload",
    )
    tax_obligations = relationship("TaxObligation", back_populates="asset", lazy="noload")
    insurance_policies = relationship("InsurancePolicy", back_populates="asset", lazy="noload")
    documents = relationship(
        "Document",
        primaryjoin="and_(foreign(Document.entity_id) == Asset.id, Document.entity_type == 'asset')",  # noqa: E501
        viewonly=True,
        lazy="noload",
    )
