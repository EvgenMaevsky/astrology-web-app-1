"""admin flag and site-wide SEO settings

Revision ID: a7c3f81d2e64
Revises: d4e9a1c76b23
Create Date: 2026-09-20 10:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "a7c3f81d2e64"
down_revision: Union[str, None] = "d4e9a1c76b23"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # server_default is required, not cosmetic: existing rows would otherwise
    # get NULL, and the column is NOT NULL. The ORM-side default only applies
    # to rows inserted through the ORM.
    op.add_column(
        "users",
        sa.Column("is_admin", sa.Boolean(), nullable=False, server_default=sa.false()),
    )

    op.create_table(
        "site_settings",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("title_uk", sa.String(length=200), nullable=True),
        sa.Column("title_en", sa.String(length=200), nullable=True),
        sa.Column("description_uk", sa.Text(), nullable=True),
        sa.Column("description_en", sa.Text(), nullable=True),
        sa.Column("favicon", sa.String(length=128), nullable=True),
        sa.Column("og_image", sa.String(length=128), nullable=True),
        sa.Column("noindex", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.func.now()),
        sa.PrimaryKeyConstraint("id"),
        # Singleton: one row, always id=1.
        sa.CheckConstraint("id = 1", name="ck_site_settings_singleton"),
    )


def downgrade() -> None:
    op.drop_table("site_settings")
    op.drop_column("users", "is_admin")
