"""add other government IDs and airline membership numbers to individuals

Revision ID: 0015
Revises: 0014
Create Date: 2026-07-27

Individuals gain two more primary government-ID fields - `driving_license_number`
and `voter_id_number` - and three airline/travel loyalty membership numbers:
`skywards_number` (Emirates Skywards), `maharaja_number` (Air India Maharaja
Club) and `indigo_chip_number` (IndiGo). All are nullable free-text columns;
purely additive, existing rows stay NULL.
"""
from typing import Union

import sqlalchemy as sa
from alembic import op

revision: str = "0015"
down_revision: Union[str, None] = "0014"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("individuals", sa.Column("driving_license_number", sa.String(length=30), nullable=True))
    op.add_column("individuals", sa.Column("voter_id_number", sa.String(length=20), nullable=True))
    op.add_column("individuals", sa.Column("skywards_number", sa.String(length=30), nullable=True))
    op.add_column("individuals", sa.Column("maharaja_number", sa.String(length=30), nullable=True))
    op.add_column("individuals", sa.Column("indigo_chip_number", sa.String(length=30), nullable=True))


def downgrade() -> None:
    op.drop_column("individuals", "indigo_chip_number")
    op.drop_column("individuals", "maharaja_number")
    op.drop_column("individuals", "skywards_number")
    op.drop_column("individuals", "voter_id_number")
    op.drop_column("individuals", "driving_license_number")
