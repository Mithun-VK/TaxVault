"""add company module

Revision ID: 0020
Revises: 0019
Create Date: 2026-08-16

Business entities alongside the Individual profiles: `companies` holds the
statutory registrations (CIN/LLPIN/GSTIN/PAN/TAN, foreign licenses, other
registrations), banking, directors and audit details; `company_documents`
holds their filings, one row per document, because annual returns and ITRs
recur every financial year rather than sitting in fixed columns the way an
individual's identity documents do.

`assets.company_id` lets a property be held by a company instead of a person.
It is ON DELETE SET NULL, so archiving/removing a company never takes its
properties with it.

CIN and GSTIN are unique per vault only among rows that carry one — partial
unique indexes, matching `uq_individual_pan` from migration 0005.
"""
from typing import Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0020"
down_revision: Union[str, None] = "0019"
branch_labels = None
depends_on = None

COMPANY_TYPES = (
    "private_limited",
    "public_limited",
    "llp",
    "partnership",
    "proprietorship",
    "trust",
    "section_8",
    "one_person",
    "foreign_subsidiary",
    "branch_office",
    "other",
)
COMPANY_STATUSES = ("active", "dormant", "under_winding", "struck_off", "dissolved")


def _in_list(column: str, values: tuple[str, ...]) -> str:
    return f"{column} IN (" + ", ".join(f"'{v}'" for v in values) + ")"


def upgrade() -> None:
    op.create_table(
        "companies",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        # Core identity
        sa.Column("legal_name", sa.String(length=400), nullable=False),
        sa.Column("trade_name", sa.String(length=400), nullable=True),
        sa.Column(
            "company_type",
            sa.String(length=50),
            nullable=False,
            server_default="private_limited",
        ),
        sa.Column("status", sa.String(length=30), nullable=False, server_default="active"),
        sa.Column("industry", sa.String(length=200), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        # Incorporation
        sa.Column("incorporation_date", sa.Date(), nullable=True),
        sa.Column("incorporation_state", sa.String(length=100), nullable=True),
        sa.Column("cin", sa.String(length=21), nullable=True),
        sa.Column("llpin", sa.String(length=15), nullable=True),
        # Tax registrations
        sa.Column("pan_number", sa.String(length=10), nullable=True),
        sa.Column("tan_number", sa.String(length=10), nullable=True),
        sa.Column("gstin", sa.String(length=15), nullable=True),
        sa.Column("gstin_state_code", sa.String(length=2), nullable=True),
        sa.Column("income_tax_ward", sa.String(length=200), nullable=True),
        # International
        sa.Column("foreign_registration_number", sa.String(length=100), nullable=True),
        sa.Column("foreign_jurisdiction", sa.String(length=200), nullable=True),
        sa.Column("foreign_registration_date", sa.Date(), nullable=True),
        sa.Column("foreign_registration_expiry", sa.Date(), nullable=True),
        sa.Column(
            "other_registrations",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default="[]",
        ),
        # Contact & address
        sa.Column("registered_address", sa.Text(), nullable=True),
        sa.Column("operational_address", sa.Text(), nullable=True),
        sa.Column("phone_number", sa.String(length=20), nullable=True),
        sa.Column("email", sa.String(length=200), nullable=True),
        sa.Column("website", sa.String(length=300), nullable=True),
        # Banking / directors
        sa.Column(
            "bank_accounts",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default="[]",
        ),
        sa.Column(
            "directors",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default="[]",
        ),
        # Capital
        sa.Column("authorized_capital", sa.Numeric(precision=15, scale=2), nullable=True),
        sa.Column("paid_up_capital", sa.Numeric(precision=15, scale=2), nullable=True),
        # Audit & compliance
        sa.Column("auditor_name", sa.String(length=200), nullable=True),
        sa.Column("auditor_firm_number", sa.String(length=20), nullable=True),
        sa.Column(
            "financial_year_end", sa.String(length=5), nullable=True, server_default="03-31"
        ),
        # Logo & metadata
        sa.Column("logo_key", sa.String(length=500), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("is_archived", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.CheckConstraint(_in_list("company_type", COMPANY_TYPES), name="ck_company_type"),
        sa.CheckConstraint(_in_list("status", COMPANY_STATUSES), name="ck_company_status"),
    )
    op.create_index("ix_companies_user_id", "companies", ["user_id"])
    op.create_index(
        "uq_company_cin",
        "companies",
        ["user_id", "cin"],
        unique=True,
        postgresql_where=sa.text("cin IS NOT NULL"),
    )
    op.create_index(
        "uq_company_gstin",
        "companies",
        ["user_id", "gstin"],
        unique=True,
        postgresql_where=sa.text("gstin IS NOT NULL"),
    )

    op.create_table(
        "company_documents",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("category", sa.String(length=50), nullable=False),
        sa.Column("label", sa.String(length=300), nullable=False),
        sa.Column("financial_year", sa.String(length=10), nullable=True),
        sa.Column("storage_key", sa.String(length=500), nullable=False),
        sa.Column("file_name", sa.String(length=300), nullable=False),
        sa.Column("file_size_kb", sa.Integer(), nullable=True),
        sa.Column("mime_type", sa.String(length=100), nullable=True),
        sa.Column("issue_date", sa.Date(), nullable=True),
        sa.Column("expiry_date", sa.Date(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column(
            "uploaded_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_company_documents_company_id", "company_documents", ["company_id"])
    op.create_index("ix_company_documents_user_id", "company_documents", ["user_id"])
    op.create_index("ix_company_docs_category", "company_documents", ["company_id", "category"])
    op.create_index(
        "ix_company_docs_expiry",
        "company_documents",
        ["expiry_date"],
        postgresql_where=sa.text("expiry_date IS NOT NULL AND is_deleted = false"),
    )

    # A property can be held by a company. SET NULL: losing the company must
    # never cascade into losing the property.
    op.add_column("assets", sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.create_foreign_key(
        "fk_assets_company_id",
        "assets",
        "companies",
        ["company_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index("ix_assets_company_id", "assets", ["company_id"])


def downgrade() -> None:
    op.drop_index("ix_assets_company_id", table_name="assets")
    op.drop_constraint("fk_assets_company_id", "assets", type_="foreignkey")
    op.drop_column("assets", "company_id")

    op.drop_index("ix_company_docs_expiry", table_name="company_documents")
    op.drop_index("ix_company_docs_category", table_name="company_documents")
    op.drop_index("ix_company_documents_user_id", table_name="company_documents")
    op.drop_index("ix_company_documents_company_id", table_name="company_documents")
    op.drop_table("company_documents")

    op.drop_index("uq_company_gstin", table_name="companies")
    op.drop_index("uq_company_cin", table_name="companies")
    op.drop_index("ix_companies_user_id", table_name="companies")
    op.drop_table("companies")
