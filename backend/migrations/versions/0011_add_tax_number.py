"""add `tax_number` to tax obligations

Revision ID: 0011
Revises: 0010
Create Date: 2026-07-24

Tax obligations gain a nullable `tax_number` - the assessment / property /
consumer number issued by the authority (e.g. a property-tax assessment ID),
distinct from the row's internal UUID. Back-filled from the "Tax ID: …" hint
the seed data carries in `notes` (the text after "Tax ID:" up to the next
" | "); rows without that hint stay NULL.
"""
from typing import Union

import sqlalchemy as sa
from alembic import op

revision: str = "0011"
down_revision: Union[str, None] = "0010"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("tax_obligations", sa.Column("tax_number", sa.String(), nullable=True))
    op.execute(
        r"UPDATE tax_obligations "
        r"SET tax_number = NULLIF(btrim(substring(notes FROM 'Tax ID:\s*([^|]+)')), '') "
        r"WHERE notes ~ 'Tax ID:'"
    )


def downgrade() -> None:
    op.drop_column("tax_obligations", "tax_number")
