"""pg_trgm_city_search

Revision ID: 5a88b1e15a4b
Revises: ad058419ca40
Create Date: 2026-07-15 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '5a88b1e15a4b'
down_revision: Union[str, None] = 'ad058419ca40'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    if op.get_bind().dialect.name != "postgresql":
        return
    op.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm")
    op.execute("CREATE INDEX IF NOT EXISTS ix_cities_name_trgm ON cities USING gin (name gin_trgm_ops)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_cities_ascii_trgm ON cities USING gin (ascii_name gin_trgm_ops)")


def downgrade() -> None:
    if op.get_bind().dialect.name != "postgresql":
        return
    op.execute("DROP INDEX IF EXISTS ix_cities_ascii_trgm")
    op.execute("DROP INDEX IF EXISTS ix_cities_name_trgm")
