"""billing interval (month/year) on subscriptions

Revision ID: f6b2c8d4a1e7
Revises: e3a7d5c1f9b2
Create Date: 2026-09-24 20:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "f6b2c8d4a1e7"
down_revision: Union[str, None] = "e3a7d5c1f9b2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # server_default is required: the column is NOT NULL and every existing
    # subscription was sold monthly, which is exactly what "month" says.
    op.add_column(
        "subscriptions",
        sa.Column("billing_interval", sa.String(length=8), nullable=False, server_default="month"),
    )


def downgrade() -> None:
    # batch mode: SQLite cannot drop a column in place.
    with op.batch_alter_table("subscriptions") as batch:
        batch.drop_column("billing_interval")
