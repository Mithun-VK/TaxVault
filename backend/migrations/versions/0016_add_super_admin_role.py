"""introduce the super_admin role

Revision ID: 0016
Revises: 0015
Create Date: 2026-07-30

Widens RBAC from two roles to three: "super_admin" (full CRUD everywhere and
user management), "admin" (sees everything and may add records, but never edit
or delete) and "user" (payables desk only). See app/core/permissions.py for the
full matrix.

The role column already exists (migration 0004) and stays a plain String, so
this migration only rewrites data: the earliest-created admin becomes the
super admin, which is also the account that owns the shared vault every other
login reads (see dependencies.get_vault_owner_id). Remaining admins keep the
now-narrower "admin" role. If a deployment somehow has no admin at all, the
earliest account is promoted so the vault always has an owner.
"""
from typing import Union

from alembic import op

revision: str = "0016"
down_revision: Union[str, None] = "0015"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        UPDATE users
        SET role = 'super_admin'
        WHERE id = (
            SELECT id FROM users WHERE role = 'admin' ORDER BY created_at ASC LIMIT 1
        )
        """
    )
    # Fallback for a deployment with zero admins — the vault needs an owner.
    op.execute(
        """
        UPDATE users
        SET role = 'super_admin'
        WHERE NOT EXISTS (SELECT 1 FROM users WHERE role = 'super_admin')
          AND id = (SELECT id FROM users ORDER BY created_at ASC LIMIT 1)
        """
    )


def downgrade() -> None:
    # Collapse back to the two-role model: super admins become admins.
    op.execute("UPDATE users SET role = 'admin' WHERE role = 'super_admin'")
