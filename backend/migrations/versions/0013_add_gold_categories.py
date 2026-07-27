"""add gold_categories table

Revision ID: 0013
Revises: 0012
Create Date: 2026-07-24

User-defined jewellery categories for the Gold vault, previously kept only in
the browser's localStorage. Each row is a custom category (built-ins stay in
the frontend constants); `value` is the slug written to a gold asset's
``asset_metadata.category`` and is unique per user.
"""
from typing import Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0013"
down_revision: Union[str, None] = "0012"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "gold_categories",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("value", sa.String(length=40), nullable=False),
        sa.Column("label", sa.String(length=80), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "value", name="uq_gold_categories_user_value"),
    )
    op.create_index(
        "ix_gold_categories_user_id", "gold_categories", ["user_id"]
    )


def downgrade() -> None:
    op.drop_index("ix_gold_categories_user_id", table_name="gold_categories")
    op.drop_table("gold_categories")
