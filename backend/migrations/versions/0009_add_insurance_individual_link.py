"""link insurance policies to an individual

Revision ID: 0009
Revises: 0008
Create Date: 2026-07-22

Life / term / health / medical policies cover a person, not a property, so
`insurance_policies` gains a nullable `individual_id` FK alongside `asset_id`.
The two links are mutually exclusive (enforced in the service layer).
"""
from typing import Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0009"
down_revision: Union[str, None] = "0008"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "insurance_policies",
        sa.Column("individual_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_foreign_key(
        "fk_insurance_policies_individual_id",
        "insurance_policies",
        "individuals",
        ["individual_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index(
        "ix_insurance_policies_individual_id",
        "insurance_policies",
        ["individual_id"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_insurance_policies_individual_id", table_name="insurance_policies"
    )
    op.drop_constraint(
        "fk_insurance_policies_individual_id",
        "insurance_policies",
        type_="foreignkey",
    )
    op.drop_column("insurance_policies", "individual_id")
