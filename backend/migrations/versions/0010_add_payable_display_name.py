"""add a display `name` to bills / taxes / insurance

Revision ID: 0010
Revises: 0009
Create Date: 2026-07-24

Recurring bills, tax obligations and insurance policies gain a nullable
`name` column - the human-readable label shown on the payment calendar,
the payments list and the reports. Previously the label was derived on the
fly (``provider_name``/``bill_type`` for bills, ``description``/``tax_type``
for taxes, ``provider_name - policy_number`` for policies), which made
several otherwise-identical rows ambiguous - e.g. six "TNEB" electricity
bills, or a wall of "Insurance Company" policies.

The column is back-filled from the descriptive text the seed data already
carries: the meaningful label is the part of ``notes`` before the first
" | " with any trailing "(…)" date/hint stripped (taxes use their
``description`` instead). Rows whose source text is empty fall back to
``provider_name`` (bills / insurance) or ``description`` (taxes). Display
code still coalesces to the old derivation when ``name`` is NULL, so this
change is purely additive.
"""
from typing import Union

import sqlalchemy as sa
from alembic import op

revision: str = "0010"
down_revision: Union[str, None] = "0009"
branch_labels = None
depends_on = None

# Text before the first " | ", trimmed, with a trailing parenthetical removed.
# The `$`-anchored `\([^()]*\)` only strips the LAST group, so an inner note
# like "Innova Car (Allwyn) Insurance … (June 12)" keeps "(Allwyn)".
_LABEL = (
    r"NULLIF(btrim(regexp_replace("
    r"split_part(COALESCE({src}, ''), ' | ', 1), '\s*\([^()]*\)\s*$', '')), '')"
)


def upgrade() -> None:
    op.add_column("recurring_bills", sa.Column("name", sa.String(), nullable=True))
    op.add_column("tax_obligations", sa.Column("name", sa.String(), nullable=True))
    op.add_column("insurance_policies", sa.Column("name", sa.String(), nullable=True))

    # Bills / insurance derive the label from `notes`; taxes from `description`.
    op.execute(
        f"UPDATE recurring_bills SET name = COALESCE({_LABEL.format(src='notes')}, provider_name)"
    )
    op.execute(
        f"UPDATE insurance_policies SET name = COALESCE({_LABEL.format(src='notes')}, provider_name)"
    )
    op.execute(
        "UPDATE tax_obligations SET name = "
        f"COALESCE({_LABEL.format(src='description')}, description, tax_type)"
    )


def downgrade() -> None:
    op.drop_column("insurance_policies", "name")
    op.drop_column("tax_obligations", "name")
    op.drop_column("recurring_bills", "name")
