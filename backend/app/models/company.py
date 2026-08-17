import enum
import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Numeric,
    String,
    Text,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class CompanyType(str, enum.Enum):
    private_limited = "private_limited"  # Pvt Ltd
    public_limited = "public_limited"  # Ltd
    llp = "llp"  # Limited Liability Partnership
    partnership = "partnership"  # Partnership firm
    proprietorship = "proprietorship"  # Sole proprietorship
    trust = "trust"  # Charitable / religious trust
    section_8 = "section_8"  # Section 8 / NGO
    one_person = "one_person"  # OPC
    foreign_subsidiary = "foreign_subsidiary"  # Indian sub of a foreign company
    branch_office = "branch_office"  # Branch / liaison office
    other = "other"


class CompanyStatus(str, enum.Enum):
    active = "active"
    dormant = "dormant"
    under_winding = "under_winding"
    struck_off = "struck_off"
    dissolved = "dissolved"


class ExporterType(str, enum.Enum):
    merchant = "merchant"  # Buys from manufacturers and exports
    manufacturer = "manufacturer"  # Exports its own production
    both = "both"


COMPANY_TYPES: tuple[str, ...] = tuple(t.value for t in CompanyType)
COMPANY_STATUSES: tuple[str, ...] = tuple(s.value for s in CompanyStatus)
EXPORTER_TYPES: tuple[str, ...] = tuple(e.value for e in ExporterType)


class Company(Base):
    """A business entity in the vault: registrations, filings, linked assets.

    The Individual profile's sibling — a company holds statutory registrations
    (CIN/GSTIN/PAN/TAN) instead of identity documents, and its paperwork is a
    real table (``company_documents``) rather than a fixed set of key columns,
    because annual filings recur every financial year.
    """

    __tablename__ = "companies"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # ── Core identity ────────────────────────────────────────────────────────
    legal_name: Mapped[str] = mapped_column(String(400), nullable=False)
    # DBA / brand name, when it differs from the registered legal name.
    trade_name: Mapped[str | None] = mapped_column(String(400))
    company_type: Mapped[str] = mapped_column(
        String(50), nullable=False, default=CompanyType.private_limited.value
    )
    status: Mapped[str] = mapped_column(
        String(30), nullable=False, default=CompanyStatus.active.value
    )
    # e.g. "Textile Export", "Food Processing", "Real Estate"
    industry: Mapped[str | None] = mapped_column(String(200))
    description: Mapped[str | None] = mapped_column(Text)

    # ── Incorporation ────────────────────────────────────────────────────────
    incorporation_date: Mapped[date | None] = mapped_column(Date)
    incorporation_state: Mapped[str | None] = mapped_column(String(100))
    # Corporate Identity Number — U12345MH2020PTC123456
    cin: Mapped[str | None] = mapped_column(String(21))
    # LLP Identification Number (LLPs carry this instead of a CIN)
    llpin: Mapped[str | None] = mapped_column(String(15))

    # ── Tax registrations ────────────────────────────────────────────────────
    pan_number: Mapped[str | None] = mapped_column(String(10))  # AABCC1234D
    tan_number: Mapped[str | None] = mapped_column(String(10))  # CHEN12345A
    gstin: Mapped[str | None] = mapped_column(String(15))  # 33AABCC1234D1Z5
    # First two digits of the GSTIN; derived by the service, never sent by the client.
    gstin_state_code: Mapped[str | None] = mapped_column(String(2))
    income_tax_ward: Mapped[str | None] = mapped_column(String(200))

    # ── Export & trade registrations ─────────────────────────────────────────
    # Import Export Code. Since 2017 the IEC is the entity's PAN, but it is
    # kept separate: a company can hold a PAN long before it starts exporting.
    iec_code: Mapped[str | None] = mapped_column(String(10))
    # merchant | manufacturer | both — decides which export incentives and
    # which AEPC/Textile Committee registrations actually apply.
    exporter_type: Mapped[str | None] = mapped_column(String(20))
    # Apparel Export Promotion Council registration.
    aepc_code: Mapped[str | None] = mapped_column(String(50))
    textile_committee_code: Mapped[str | None] = mapped_column(String(50))

    # ── Statutory registrations ──────────────────────────────────────────────
    # Udyam (MSME) registration, e.g. UDYAM-TN-01-0012345.
    msme_number: Mapped[str | None] = mapped_column(String(30))
    esi_number: Mapped[str | None] = mapped_column(String(30))
    epf_number: Mapped[str | None] = mapped_column(String(30))
    professional_tax_number: Mapped[str | None] = mapped_column(String(30))

    # ── International (JAFZA / Dubai operations) ─────────────────────────────
    foreign_registration_number: Mapped[str | None] = mapped_column(String(100))
    foreign_jurisdiction: Mapped[str | None] = mapped_column(String(200))
    foreign_registration_date: Mapped[date | None] = mapped_column(Date)
    foreign_registration_expiry: Mapped[date | None] = mapped_column(Date)

    # ── Other registrations ──────────────────────────────────────────────────
    # [{name, number, issuing_authority, issue_date, expiry_date, notes}] —
    # FSSAI, Spice Board, AEPC, IEC, Textiles Committee, and anything else.
    other_registrations: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)

    # ── Contact & address ────────────────────────────────────────────────────
    registered_address: Mapped[str | None] = mapped_column(Text)
    operational_address: Mapped[str | None] = mapped_column(Text)
    phone_number: Mapped[str | None] = mapped_column(String(20))
    email: Mapped[str | None] = mapped_column(String(200))
    website: Mapped[str | None] = mapped_column(String(300))

    # ── Banking ──────────────────────────────────────────────────────────────
    # [{bank_name, branch, account_number, ifsc_code, account_type, is_primary}]
    bank_accounts: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)

    # ── Directors / partners / trustees ──────────────────────────────────────
    # [{individual_id, name, din, designation, appointed_date, is_active}]
    directors: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)

    # ── Share capital ────────────────────────────────────────────────────────
    authorized_capital: Mapped[Decimal | None] = mapped_column(Numeric(15, 2))
    paid_up_capital: Mapped[Decimal | None] = mapped_column(Numeric(15, 2))

    # ── Audit & compliance ───────────────────────────────────────────────────
    auditor_name: Mapped[str | None] = mapped_column(String(200))
    auditor_firm_number: Mapped[str | None] = mapped_column(String(20))  # ICAI FRN
    # MM-DD. India defaults to 03-31; UAE-aligned entities often use 09-30.
    financial_year_end: Mapped[str | None] = mapped_column(String(5), default="03-31")

    # ── Logo ─────────────────────────────────────────────────────────────────
    logo_key: Mapped[str | None] = mapped_column(String(500))

    # ── Metadata ─────────────────────────────────────────────────────────────
    notes: Mapped[str | None] = mapped_column(Text)
    is_archived: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), onupdate=func.now()
    )

    user = relationship("User", back_populates="companies")
    documents = relationship(
        "CompanyDocument",
        back_populates="company",
        cascade="all, delete-orphan",
        lazy="noload",
    )
    assets = relationship(
        "Asset",
        back_populates="company",
        foreign_keys="Asset.company_id",
        lazy="noload",
    )

    # CIN and GSTIN are unique per vault, but only among rows that carry one —
    # partial unique indexes, so any number of companies may leave them NULL
    # (the same shape as `uq_individual_pan`).
    __table_args__ = (
        CheckConstraint(
            "company_type IN ("
            + ", ".join(f"'{t}'" for t in COMPANY_TYPES)
            + ")",
            name="ck_company_type",
        ),
        CheckConstraint(
            "status IN (" + ", ".join(f"'{s}'" for s in COMPANY_STATUSES) + ")",
            name="ck_company_status",
        ),
        CheckConstraint(
            "exporter_type IS NULL OR exporter_type IN ("
            + ", ".join(f"'{e}'" for e in EXPORTER_TYPES)
            + ")",
            name="ck_company_exporter_type",
        ),
        Index(
            "uq_company_cin",
            "user_id",
            "cin",
            unique=True,
            postgresql_where=text("cin IS NOT NULL"),
        ),
        Index(
            "uq_company_gstin",
            "user_id",
            "gstin",
            unique=True,
            postgresql_where=text("gstin IS NOT NULL"),
        ),
        Index(
            "uq_company_iec",
            "user_id",
            "iec_code",
            unique=True,
            postgresql_where=text("iec_code IS NOT NULL"),
        ),
    )
