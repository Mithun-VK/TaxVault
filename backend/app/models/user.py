import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, String, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String, unique=True, nullable=False, index=True)
    hashed_password: Mapped[str] = mapped_column(String, nullable=False)
    full_name: Mapped[str | None] = mapped_column(String)
    phone_number: Mapped[str | None] = mapped_column(String)
    device_tokens: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    # RBAC role: "super_admin" (full CRUD), "admin" (view everything + add
    # records) or "user" (payables desk). See app.core.permissions.
    role: Mapped[str] = mapped_column(
        String, nullable=False, default="user", server_default="user"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), onupdate=func.now()
    )

    assets = relationship("Asset", back_populates="user", lazy="noload")
    gold_categories = relationship("GoldCategory", back_populates="user", lazy="noload")
    individuals = relationship("Individual", back_populates="user", lazy="noload")
    companies = relationship("Company", back_populates="user", lazy="noload")
    insurance_policies = relationship("InsurancePolicy", back_populates="user", lazy="noload")
    tax_obligations = relationship("TaxObligation", back_populates="user", lazy="noload")
    recurring_bills = relationship("RecurringBill", back_populates="user", lazy="noload")
    payments = relationship("Payment", back_populates="user", lazy="noload")
    documents = relationship("Document", back_populates="user", lazy="noload")
    alert_configs = relationship("AlertConfig", back_populates="user", lazy="noload")
    alert_logs = relationship("AlertLog", back_populates="user", lazy="noload")
    audit_logs = relationship("AuditLog", back_populates="user", lazy="noload")
