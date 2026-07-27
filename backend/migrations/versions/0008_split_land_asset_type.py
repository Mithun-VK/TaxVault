"""split the 'land' asset type into agricultural_land / vacant_land

Revision ID: 0008
Revises: 0007
Create Date: 2026-07-21

`assets.asset_type` is a String column guarded by a CHECK constraint
(assets_asset_type_check, last set in 0005). To add the two new land kinds we
drop that constraint, migrate existing 'land' rows to 'vacant_land' (the agreed
default when splitting Land into Agricultural land and Vacant land), then re-add
the constraint with the expanded value set. Downgrade folds both back to 'land'.
"""
from typing import Union

from alembic import op

revision: str = "0008"
down_revision: Union[str, None] = "0007"
branch_labels = None
depends_on = None

_NEW_TYPES = (
    "'land','agricultural_land','vacant_land','building','vehicle','gold','other'"
)
_OLD_TYPES = "'land','building','vehicle','gold','other'"


def upgrade() -> None:
    op.execute("ALTER TABLE assets DROP CONSTRAINT IF EXISTS assets_asset_type_check")
    op.execute("UPDATE assets SET asset_type = 'vacant_land' WHERE asset_type = 'land'")
    op.execute(
        "ALTER TABLE assets ADD CONSTRAINT assets_asset_type_check "
        f"CHECK (asset_type IN ({_NEW_TYPES}))"
    )


def downgrade() -> None:
    op.execute("ALTER TABLE assets DROP CONSTRAINT IF EXISTS assets_asset_type_check")
    op.execute(
        "UPDATE assets SET asset_type = 'land' "
        "WHERE asset_type IN ('vacant_land', 'agricultural_land')"
    )
    op.execute(
        "ALTER TABLE assets ADD CONSTRAINT assets_asset_type_check "
        f"CHECK (asset_type IN ({_OLD_TYPES}))"
    )
