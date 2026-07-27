"""add user role for RBAC

Revision ID: 0004
Revises: 0003
Create Date: 2026-07-13

Adds a `role` column to users ("admin" | "user", default "user") backing the
role-based access system. On upgrade, the earliest-registered account is
promoted to admin so an existing deployment retains a full-access user.
"""
from typing import Union

import sqlalchemy as sa
from alembic import op

revision: str = "0004"
down_revision: Union[str, None] = "0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("role", sa.String(), nullable=False, server_default="user"),
    )
    # Promote the first-registered user to admin so the deployment keeps an
    # admin after this migration (new deployments handle this at registration).
    op.execute(
        """
        UPDATE users
        SET role = 'admin'
        WHERE id = (SELECT id FROM users ORDER BY created_at ASC LIMIT 1)
        """
    )


def downgrade() -> None:
    op.drop_column("users", "role")
