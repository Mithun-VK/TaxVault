"""link tax obligations to an individual

Revision ID: 0007
Revises: 0006
Create Date: 2026-07-17

Personal tax obligations (income tax, professional tax, …) belong to a person
rather than a property, so `tax_obligations` gains a nullable `individual_id`
FK alongside the existing `asset_id`.
"""
from typing import Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0007"
down_revision: Union[str, None] = "0006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "tax_obligations",
        sa.Column("individual_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_foreign_key(
        "fk_tax_obligations_individual_id",
        "tax_obligations",
        "individuals",
        ["individual_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index(
        "ix_tax_obligations_individual_id", "tax_obligations", ["individual_id"]
    )


def downgrade() -> None:
    op.drop_index("ix_tax_obligations_individual_id", table_name="tax_obligations")
    op.drop_constraint(
        "fk_tax_obligations_individual_id", "tax_obligations", type_="foreignkey"
    )
    op.drop_column("tax_obligations", "individual_id")
