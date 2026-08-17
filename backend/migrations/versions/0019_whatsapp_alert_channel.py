"""make WhatsApp the working alert channel

Revision ID: 0019
Revises: 0018
Create Date: 2026-08-02

Alerts now deliver over WhatsApp (Twilio). Existing alert_configs were created
with the old default of {email, push}, neither of which a self-hosted install
can actually send — email needs SES credentials, push needs a Firebase service
account — so every existing rule would keep silently failing until each one was
edited by hand.

This adds "whatsapp" to every existing config that lacks it, leaving any other
channels the user chose in place. Idempotent: re-running changes nothing.

No schema change — `channels` is already a text[].
"""
from typing import Union

from alembic import op

revision: str = "0019"
down_revision: Union[str, None] = "0018"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        UPDATE alert_configs
        SET channels = array_append(channels, 'whatsapp')
        WHERE NOT ('whatsapp' = ANY(channels))
        """
    )


def downgrade() -> None:
    # Strip WhatsApp back out, and restore a usable channel for any rule that
    # would otherwise be left with an empty list.
    op.execute(
        """
        UPDATE alert_configs
        SET channels = array_remove(channels, 'whatsapp')
        WHERE 'whatsapp' = ANY(channels)
        """
    )
    op.execute(
        """
        UPDATE alert_configs
        SET channels = ARRAY['email', 'push']
        WHERE cardinality(channels) = 0
        """
    )
