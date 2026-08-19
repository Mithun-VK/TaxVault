import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class ChangeRequest(Base):
    """A member's pending edit or delete, awaiting an admin's approval.

    Members may add bills, taxes and insurance policies outright, but changing
    or removing one is not theirs to do: the attempt is recorded here and only
    reaches the vault when an admin or super admin approves it. `payload` holds
    the requested patch for an update and is empty for a delete.

    `user_id` is the vault owner (the usual scoping column, so the queue lives
    with the data it acts on); `requested_by_id` is the person who filed it.
    """

    __tablename__ = "change_requests"
    __table_args__ = (
        Index("ix_change_requests_user_status", "user_id", "status"),
        Index("ix_change_requests_entity", "entity_type", "entity_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    requested_by_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # "bill" | "tax" | "insurance"
    entity_type: Mapped[str] = mapped_column(String(20), nullable=False)
    entity_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    # "update" | "delete"
    action: Mapped[str] = mapped_column(String(10), nullable=False)
    # The requested patch (empty for a delete), stored as submitted.
    payload: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    # Why the member wants the change - shown to the reviewer.
    reason: Mapped[str | None] = mapped_column(Text)

    # "pending" | "approved" | "rejected" | "cancelled" | "expired"
    status: Mapped[str] = mapped_column(
        String(12), nullable=False, default="pending", server_default="pending"
    )
    # A request nobody reviews in time lapses rather than lingering in the
    # queue. Set at creation from CHANGE_REQUEST_TTL_MINUTES; the service
    # sweeps overdue rows whenever the queue is read or reviewed.
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), index=True)
    reviewed_by_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL")
    )
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    review_note: Mapped[str | None] = mapped_column(Text)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    requested_by = relationship("User", foreign_keys=[requested_by_id], lazy="noload")
    reviewed_by = relationship("User", foreign_keys=[reviewed_by_id], lazy="noload")
