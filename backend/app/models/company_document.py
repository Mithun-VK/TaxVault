import enum
import uuid
from datetime import date, datetime

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class CompanyDocumentCategory(str, enum.Enum):
    # Incorporation
    moa = "moa"  # Memorandum of Association
    aoa = "aoa"  # Articles of Association
    coi = "coi"  # Certificate of Incorporation
    llp_agreement = "llp_agreement"
    partnership_deed = "partnership_deed"
    trust_deed = "trust_deed"

    # Tax registrations
    pan_card = "pan_card"
    gst_certificate = "gst_certificate"
    tan_allotment = "tan_allotment"

    # Annual filings
    annual_return = "annual_return"  # ROC annual return (MGT-7 / MGT-7A)
    financial_stmt = "financial_stmt"  # Audited financial statements
    directors_report = "directors_report"
    audit_report = "audit_report"

    # Tax filings
    itr = "itr"
    gst_return = "gst_return"  # GSTR-9
    tds_certificate = "tds_certificate"  # Form 16A / 27D

    # Licenses & renewals
    trade_license = "trade_license"
    fssai_license = "fssai_license"
    import_export = "import_export"  # IEC
    spice_board = "spice_board"
    aepc_cert = "aepc_cert"
    textiles_cert = "textiles_cert"

    # Foreign entity
    jafza_license = "jafza_license"
    foreign_reg = "foreign_reg"
    vat_certificate = "vat_certificate"  # UAE VAT

    # Banking
    bank_statement = "bank_statement"
    cancelled_cheque = "cancelled_cheque"

    # HR
    epf_certificate = "epf_certificate"
    esi_certificate = "esi_certificate"
    pt_certificate = "pt_certificate"  # Professional tax

    # Other
    board_resolution = "board_resolution"
    power_of_attorney = "power_of_attorney"
    other = "other"


COMPANY_DOCUMENT_CATEGORIES: tuple[str, ...] = tuple(c.value for c in CompanyDocumentCategory)

# Annual filings repeat every year, so their rows are keyed by financial year as
# well as category. Everything else is a standing document.
FILING_CATEGORIES: frozenset[str] = frozenset(
    {
        CompanyDocumentCategory.annual_return.value,
        CompanyDocumentCategory.financial_stmt.value,
        CompanyDocumentCategory.directors_report.value,
        CompanyDocumentCategory.audit_report.value,
        CompanyDocumentCategory.itr.value,
        CompanyDocumentCategory.gst_return.value,
        CompanyDocumentCategory.tds_certificate.value,
    }
)


class CompanyDocument(Base):
    """One filed document belonging to a company.

    Unlike an Individual's identity documents — a fixed handful of key columns
    on the profile row — a company accumulates a new set of filings every
    financial year, so each document is its own row with a category, an
    optional financial year, and an optional expiry for renewable licenses.
    """

    __tablename__ = "company_documents"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("companies.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    category: Mapped[str] = mapped_column(String(50), nullable=False)
    label: Mapped[str] = mapped_column(String(300), nullable=False)
    # "2025-26" for annual filings; NULL for standing documents.
    financial_year: Mapped[str | None] = mapped_column(String(10))

    storage_key: Mapped[str] = mapped_column(String(500), nullable=False)
    file_name: Mapped[str] = mapped_column(String(300), nullable=False)
    file_size_kb: Mapped[int | None] = mapped_column(Integer)
    mime_type: Mapped[str | None] = mapped_column(String(100))

    issue_date: Mapped[date | None] = mapped_column(Date)
    # Set for renewable licenses (FSSAI, JAFZA, trade license, …).
    expiry_date: Mapped[date | None] = mapped_column(Date)

    notes: Mapped[str | None] = mapped_column(Text)
    is_deleted: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    uploaded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), onupdate=func.now()
    )

    company = relationship("Company", back_populates="documents")

    __table_args__ = (
        Index("ix_company_docs_category", "company_id", "category"),
        # Partial: the expiry sweep only ever asks about live, dated rows.
        Index(
            "ix_company_docs_expiry",
            "expiry_date",
            postgresql_where=text("expiry_date IS NOT NULL AND is_deleted = false"),
        ),
    )
