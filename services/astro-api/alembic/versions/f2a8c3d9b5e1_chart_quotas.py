"""chart quotas

Revision ID: f2a8c3d9b5e1
Revises: c1b7d2e8f4a9
Create Date: 2026-07-20 00:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "f2a8c3d9b5e1"
down_revision: Union[str, None] = "c1b7d2e8f4a9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "chart_quotas",
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("usage_date", sa.Date(), nullable=False),
        sa.Column("used", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("user_id", "usage_date"),
    )


def downgrade() -> None:
    op.drop_table("chart_quotas")