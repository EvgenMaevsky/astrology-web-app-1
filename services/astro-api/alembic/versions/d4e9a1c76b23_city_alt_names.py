"""city alt_names (local-script city names for search)

Revision ID: d4e9a1c76b23
Revises: f2a8c3d9b5e1
Create Date: 2026-09-19 16:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "d4e9a1c76b23"
down_revision: Union[str, None] = "f2a8c3d9b5e1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("cities", sa.Column("alt_names", sa.Text(), nullable=True))
    # Postgres searches alt_names with ILIKE '%q%', which needs a trigram
    # index to stay fast; SQLite covers it through the cities_fts virtual
    # table that import_geonames.py rebuilds.
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        op.execute(
            "CREATE INDEX IF NOT EXISTS ix_cities_alt_names_trgm "
            "ON cities USING gin (alt_names gin_trgm_ops)"
        )


def downgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        op.execute("DROP INDEX IF EXISTS ix_cities_alt_names_trgm")
    op.drop_column("cities", "alt_names")
