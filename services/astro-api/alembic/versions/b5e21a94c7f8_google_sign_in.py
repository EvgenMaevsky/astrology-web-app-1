"""google sign-in: nullable password, google_sub

Revision ID: b5e21a94c7f8
Revises: a7c3f81d2e64
Create Date: 2026-09-22 10:00:00.000000

WARNING — downgrade() is not safely reversible in practice. Once a single
account has been created through Google it has no password at all, so
restoring NOT NULL on users.password_hash would fail (or, worse, require
inventing a value). Treat the upgrade as one-way on production.

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "b5e21a94c7f8"
down_revision: Union[str, None] = "a7c3f81d2e64"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # batch_alter_table so this works on SQLite too, which cannot ALTER a
    # column in place; on Postgres alembic issues a plain ALTER.
    with op.batch_alter_table("users") as batch:
        batch.alter_column("password_hash", existing_type=sa.Text(), nullable=True)
        batch.add_column(sa.Column("google_sub", sa.String(length=255), nullable=True))
        batch.create_unique_constraint("uq_users_google_sub", ["google_sub"])

    op.create_index("ix_users_google_sub", "users", ["google_sub"])


def downgrade() -> None:
    op.drop_index("ix_users_google_sub", table_name="users")
    with op.batch_alter_table("users") as batch:
        batch.drop_constraint("uq_users_google_sub", type_="unique")
        batch.drop_column("google_sub")
        # Fails if any Google-only account exists. That is deliberate: it is
        # better to stop here than to silently lock those users out.
        batch.alter_column("password_hash", existing_type=sa.Text(), nullable=False)
