"""repurpose chart_quotas from natal to advanced charts

Revision ID: c9f4b7e30a15
Revises: b5e21a94c7f8
Create Date: 2026-09-22 15:00:00.000000

The table's shape is unchanged; its MEANING is. It used to count natal
charts (3/day on the free plan); natal is now unlimited on every plan and
the counter meters transits, solar returns and synastry instead (2/day,
shared between all three).

Today's rows therefore hold numbers that mean something else. Left in place,
someone who calculated three natal charts this morning would open the app
to a transit allowance already spent. The rows are a daily counter with no
historical value, so they are simply cleared.

"""
from typing import Sequence, Union

from alembic import op


revision: str = "c9f4b7e30a15"
down_revision: Union[str, None] = "b5e21a94c7f8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("DELETE FROM chart_quotas")


def downgrade() -> None:
    # Symmetrical: going back means the counter means natal charts again,
    # and today's advanced-chart counts would be just as wrong.
    op.execute("DELETE FROM chart_quotas")
