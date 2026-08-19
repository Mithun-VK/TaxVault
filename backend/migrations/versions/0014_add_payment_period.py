"""add a free-text `period` to payments

Revision ID: 0014
Revises: 0013
Create Date: 2026-07-27

Payments gain a nullable `period` column - a manually entered, free-text label
describing the period the payment covers. It has no fixed format: an annual
insurance premium is recorded as e.g. "2026-27", while a bi-monthly electricity
(EB) bill is recorded as e.g. "Mar-May 2026". Purely additive; existing rows
stay NULL.
"""
from typing import Union

import sqlalchemy as sa
from alembic import op

revision: str = "0014"
down_revision: Union[str, None] = "0013"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("payments", sa.Column("period", sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column("payments", "period")
