"""split buildings into residential/commercial; rename vacant→non-agricultural land

Revision ID: 0012
Revises: 0011
Create Date: 2026-07-24

`assets.asset_type` is a String column guarded by a CHECK constraint
(assets_asset_type_check, last set in 0008). This migration:

  * splits 'building' → 'residential_building' (all existing buildings default
    to residential; commercial is a new, separate kind);
  * renames 'vacant_land' → 'non_agricultural_land';

then re-adds the constraint with the expanded value set. Legacy values
('land', 'building', 'vacant_land') stay allowed for safety, matching the
pattern used when land was first split in 0008. Downgrade folds the new values
back to their predecessors.
"""
from typing import Union

from alembic import op

revision: str = "0012"
down_revision: Union[str, None] = "0011"
branch_labels = None
depends_on = None

_NEW_TYPES = (
    "'land','agricultural_land','vacant_land','non_agricultural_land',"
    "'building','residential_building','commercial_building',"
    "'vehicle','gold','other'"
)
_OLD_TYPES = (
    "'land','agricultural_land','vacant_land','building','vehicle','gold','other'"
)


def upgrade() -> None:
    op.execute("ALTER TABLE assets DROP CONSTRAINT IF EXISTS assets_asset_type_check")
    op.execute("UPDATE assets SET asset_type = 'residential_building' WHERE asset_type = 'building'")
    op.execute(
        "UPDATE assets SET asset_type = 'non_agricultural_land' WHERE asset_type = 'vacant_land'"
    )
    op.execute(
        "ALTER TABLE assets ADD CONSTRAINT assets_asset_type_check "
        f"CHECK (asset_type IN ({_NEW_TYPES}))"
    )


def downgrade() -> None:
    op.execute("ALTER TABLE assets DROP CONSTRAINT IF EXISTS assets_asset_type_check")
    op.execute(
        "UPDATE assets SET asset_type = 'building' "
        "WHERE asset_type IN ('residential_building', 'commercial_building')"
    )
    op.execute(
        "UPDATE assets SET asset_type = 'vacant_land' WHERE asset_type = 'non_agricultural_land'"
    )
    op.execute(
        "ALTER TABLE assets ADD CONSTRAINT assets_asset_type_check "
        f"CHECK (asset_type IN ({_OLD_TYPES}))"
    )
