import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class GoldCategory(Base):
    """A user-defined jewellery category for the Gold vault (e.g. Bracelet,
    Waist chain). Built-in categories live in the frontend constants; only the
    user's custom additions are persisted here. `value` is the slug stored on a
    gold asset's ``asset_metadata.category``; `label` is the display name."""

    __tablename__ = "gold_categories"
    __table_args__ = (
        UniqueConstraint("user_id", "value", name="uq_gold_categories_user_value"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    value: Mapped[str] = mapped_column(String(40), nullable=False)
    label: Mapped[str] = mapped_column(String(80), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    user = relationship("User", back_populates="gold_categories")
