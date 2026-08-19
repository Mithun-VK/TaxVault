"""add individuals table and asset gold type

Revision ID: 0005
Revises: 0004
Create Date: 2026-07-15

Adds:
  * individuals table - personal profiles (identity docs, visas) per user.
  * assets.individual_id - links an asset to the individual who owns it.
  * a CHECK constraint pinning asset_type to the known set, now including
    "gold" (asset_type is a plain VARCHAR, so the allowed values are
    enforced by constraint rather than a Postgres enum).
"""
from typing import Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0005"
down_revision: Union[str, None] = "0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. individuals table (created first so the assets FK below resolves).
    op.create_table(
        "individuals",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("full_name", sa.String(200), nullable=False),
        sa.Column("date_of_birth", sa.Date(), nullable=True),
        sa.Column("relationship_to_owner", sa.String(100), nullable=True),
        sa.Column("phone_number", sa.String(20), nullable=True),
        sa.Column("email", sa.String(200), nullable=True),
        sa.Column("address", sa.Text(), nullable=True),
        sa.Column("photo_key", sa.String(500), nullable=True),
        sa.Column("aadhaar_number", sa.String(12), nullable=True),
        sa.Column("aadhaar_photo_key", sa.String(500), nullable=True),
        sa.Column("pan_number", sa.String(10), nullable=True),
        sa.Column("pan_photo_key", sa.String(500), nullable=True),
        sa.Column("passport_number", sa.String(20), nullable=True),
        sa.Column("passport_expiry", sa.Date(), nullable=True),
        sa.Column("passport_photo_key", sa.String(500), nullable=True),
        sa.Column(
            "visas",
            postgresql.JSONB(),
            nullable=False,
            server_default=sa.text("'[]'::jsonb"),
        ),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column(
            "is_archived",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_individuals_user_id", "individuals", ["user_id"])
    op.create_index(
        "uq_individual_pan",
        "individuals",
        ["user_id", "pan_number"],
        unique=True,
        postgresql_where=sa.text("pan_number IS NOT NULL"),
    )

    # 2. Link assets to individuals.
    op.add_column(
        "assets",
        sa.Column(
            "individual_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("individuals.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.create_index("ix_assets_individual_id", "assets", ["individual_id"])

    # 3. Pin asset_type to the known set (now including "gold").
    op.execute("ALTER TABLE assets DROP CONSTRAINT IF EXISTS assets_asset_type_check")
    op.execute(
        "ALTER TABLE assets ADD CONSTRAINT assets_asset_type_check "
        "CHECK (asset_type IN ('land','building','vehicle','gold','other'))"
    )


def downgrade() -> None:
    op.execute("ALTER TABLE assets DROP CONSTRAINT IF EXISTS assets_asset_type_check")
    op.drop_index("ix_assets_individual_id", table_name="assets")
    op.drop_column("assets", "individual_id")
    op.drop_index("uq_individual_pan", table_name="individuals")
    op.drop_index("ix_individuals_user_id", table_name="individuals")
    op.drop_table("individuals")
