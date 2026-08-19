import uuid
from datetime import datetime

from sqlalchemy import ARRAY, Boolean, DateTime, ForeignKey, Integer, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class AlertConfig(Base):
    __tablename__ = "alert_configs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    entity_type: Mapped[str] = mapped_column(String, nullable=False)
    entity_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    days_before: Mapped[list] = mapped_column(
        ARRAY(Integer), nullable=False, default=lambda: [30, 15, 7, 3, 1]
    )
    # WhatsApp is the deployment's working channel - email needs SES and push
    # needs a Firebase service account, neither of which a self-hosted install
    # has by default. See app/notifications/channels/whatsapp.py.
    channels: Mapped[list] = mapped_column(
        ARRAY(String), nullable=False, default=lambda: ["whatsapp"]
    )
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    user = relationship("User", back_populates="alert_configs")
