import uuid
from datetime import date, datetime

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Index,
    String,
    Text,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Individual(Base):
    """A family member / personal profile: identity documents, linked assets."""

    __tablename__ = "individuals"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Core identity
    full_name: Mapped[str] = mapped_column(String(200), nullable=False)
    date_of_birth: Mapped[date | None] = mapped_column(Date)
    relationship_to_owner: Mapped[str | None] = mapped_column(String(100))
    phone_number: Mapped[str | None] = mapped_column(String(20))
    email: Mapped[str | None] = mapped_column(String(200))
    address: Mapped[str | None] = mapped_column(Text)
    photo_key: Mapped[str | None] = mapped_column(String(500))

    # Aadhaar
    aadhaar_number: Mapped[str | None] = mapped_column(String(12))
    aadhaar_photo_key: Mapped[str | None] = mapped_column(String(500))

    # PAN
    pan_number: Mapped[str | None] = mapped_column(String(10))
    pan_photo_key: Mapped[str | None] = mapped_column(String(500))

    # Passport
    passport_number: Mapped[str | None] = mapped_column(String(20))
    passport_expiry: Mapped[date | None] = mapped_column(Date)
    passport_photo_key: Mapped[str | None] = mapped_column(String(500))

    # Other government IDs (primary details)
    driving_license_number: Mapped[str | None] = mapped_column(String(30))
    voter_id_number: Mapped[str | None] = mapped_column(String(20))

    # Airline / travel loyalty membership numbers
    skywards_number: Mapped[str | None] = mapped_column(String(30))
    maharaja_number: Mapped[str | None] = mapped_column(String(30))
    indigo_chip_number: Mapped[str | None] = mapped_column(String(30))

    # Active visas: list of {country, visa_type, visa_number, issue_date, expiry_date}
    visas: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)

    # Metadata
    notes: Mapped[str | None] = mapped_column(Text)
    is_archived: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), onupdate=func.now()
    )

    user = relationship("User", back_populates="individuals")
    assets = relationship(
        "Asset",
        back_populates="individual",
        foreign_keys="Asset.individual_id",
        lazy="noload",
    )

    # PAN is unique per user, but only among rows that actually have one
    # (a partial unique index lets multiple profiles keep a NULL pan_number).
    __table_args__ = (
        Index(
            "uq_individual_pan",
            "user_id",
            "pan_number",
            unique=True,
            postgresql_where=text("pan_number IS NOT NULL"),
        ),
    )
