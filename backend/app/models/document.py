import uuid
from datetime import datetime

from sqlalchemy import ARRAY, Boolean, DateTime, ForeignKey, Integer, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Document(Base):
    __tablename__ = "documents"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    entity_type: Mapped[str | None] = mapped_column(String)
    entity_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    category: Mapped[str | None] = mapped_column(String)
    label: Mapped[str] = mapped_column(String, nullable=False)
    financial_year: Mapped[str | None] = mapped_column(String)
    tags: Mapped[list] = mapped_column(ARRAY(String), nullable=False, default=list)
    storage_key: Mapped[str] = mapped_column(String, nullable=False)
    file_name: Mapped[str | None] = mapped_column(String)
    file_size_kb: Mapped[int | None] = mapped_column(Integer)
    mime_type: Mapped[str | None] = mapped_column(String)
    uploaded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    is_deleted: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    user = relationship("User", back_populates="documents")
    asset = relationship(
        "Asset",
        primaryjoin="and_(Document.entity_type == 'asset', foreign(Document.entity_id) == Asset.id)",  # noqa: E501
        viewonly=True,
        lazy="noload",
    )
