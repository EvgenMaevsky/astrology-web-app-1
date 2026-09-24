"""site logos for the dark and the light surface

Revision ID: e3a7d5c1f9b2
Revises: c9f4b7e30a15
Create Date: 2026-09-24 18:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "e3a7d5c1f9b2"
down_revision: Union[str, None] = "c9f4b7e30a15"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Nullable with no default: NULL means "show the text wordmark", which is
    # exactly what every existing deployment shows today.
    op.add_column("site_settings", sa.Column("logo_dark", sa.String(length=128), nullable=True))
    op.add_column("site_settings", sa.Column("logo_light", sa.String(length=128), nullable=True))


def downgrade() -> None:
    # batch mode: SQLite cannot drop a column in place.
    with op.batch_alter_table("site_settings") as batch:
        batch.drop_column("logo_light")
        batch.drop_column("logo_dark")
