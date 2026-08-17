"""add export, statutory and director registration numbers to companies

Revision ID: 0021
Revises: 0020
Create Date: 2026-08-17

The client tracks more identifiers than the first cut of the company module
carried. Export paperwork (IEC, exporter type, AEPC and Textile Committee
codes) and the statutory registrations (MSME/Udyam, ESI, EPF, professional
tax) each get a first-class column, because they are looked up by number
rather than browsed as documents.

Directors gain a DSC number and a share percentage, but `directors` is already
JSONB, so those need no DDL — only the schema layer changes.
"""
from typing import Union

import sqlalchemy as sa
from alembic import op

revision: str = "0021"
down_revision: Union[str, None] = "0020"
branch_labels = None
depends_on = None

EXPORTER_TYPES = ("merchant", "manufacturer", "both")

NEW_COLUMNS = (
    ("iec_code", sa.String(length=10)),
    ("exporter_type", sa.String(length=20)),
    ("aepc_code", sa.String(length=50)),
    ("textile_committee_code", sa.String(length=50)),
    ("msme_number", sa.String(length=30)),
    ("esi_number", sa.String(length=30)),
    ("epf_number", sa.String(length=30)),
    ("professional_tax_number", sa.String(length=30)),
)


def upgrade() -> None:
    for name, type_ in NEW_COLUMNS:
        op.add_column("companies", sa.Column(name, type_, nullable=True))

    op.create_check_constraint(
        "ck_company_exporter_type",
        "companies",
        "exporter_type IS NULL OR exporter_type IN ("
        + ", ".join(f"'{v}'" for v in EXPORTER_TYPES)
        + ")",
    )

    # IEC is unique per vault among the rows that carry one — the same partial
    # index shape as cin/gstin from migration 0020.
    op.create_index(
        "uq_company_iec",
        "companies",
        ["user_id", "iec_code"],
        unique=True,
        postgresql_where=sa.text("iec_code IS NOT NULL"),
    )


def downgrade() -> None:
    op.drop_index("uq_company_iec", table_name="companies")
    op.drop_constraint("ck_company_exporter_type", "companies", type_="check")
    for name, _ in reversed(NEW_COLUMNS):
        op.drop_column("companies", name)
