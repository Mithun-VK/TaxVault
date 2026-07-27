"""add property detail columns to assets

Revision ID: 0006
Revises: 0005
Create Date: 2026-07-17

Promotes the canonical Property Details fields from the schemaless
``asset_metadata`` JSONB blob to first-class columns on ``assets``:
owner_name, address, deed_number, deed_date, registration_office,
survey_number, land_area, patta_number, chitta, adangal, eb_numbers.

Columns are added here; existing rows are backfilled from asset_metadata by
``scripts/backfill_property_details.py`` (handles legacy aliases and joins
multi-value arrays), run right after this migration.
"""
from typing import Union

import sqlalchemy as sa
from alembic import op

revision: str = "0006"
down_revision: Union[str, None] = "0005"
branch_labels = None
depends_on = None

_COLUMNS = [
    ("owner_name", sa.String()),
    ("address", sa.Text()),
    ("deed_number", sa.String()),
    ("deed_date", sa.String()),
    ("registration_office", sa.String()),
    ("survey_number", sa.String()),
    ("land_area", sa.String()),
    ("patta_number", sa.String()),
    ("chitta", sa.String()),
    ("adangal", sa.String()),
    ("eb_numbers", sa.String()),
]


def upgrade() -> None:
    for name, type_ in _COLUMNS:
        op.add_column("assets", sa.Column(name, type_, nullable=True))


def downgrade() -> None:
    for name, _ in reversed(_COLUMNS):
        op.drop_column("assets", name)
