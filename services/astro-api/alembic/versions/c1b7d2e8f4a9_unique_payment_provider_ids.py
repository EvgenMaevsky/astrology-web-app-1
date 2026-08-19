"""unique payment provider ids

Revision ID: c1b7d2e8f4a9
Revises: bd01facb7481
Create Date: 2026-07-20 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op


revision: str = "c1b7d2e8f4a9"
down_revision: Union[str, None] = "bd01facb7481"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("users", schema=None) as batch_op:
        batch_op.drop_index(batch_op.f("ix_users_stripe_customer_id"))
        batch_op.create_index(batch_op.f("ix_users_stripe_customer_id"), ["stripe_customer_id"], unique=True)

    with op.batch_alter_table("subscriptions", schema=None) as batch_op:
        batch_op.create_unique_constraint("uq_subscriptions_stripe_sub_id", ["stripe_sub_id"])
        batch_op.drop_index(batch_op.f("ix_subscriptions_monopay_invoice_id"))
        batch_op.create_index(
            batch_op.f("ix_subscriptions_monopay_invoice_id"), ["monopay_invoice_id"], unique=True
        )

    with op.batch_alter_table("payments", schema=None) as batch_op:
        batch_op.drop_index(batch_op.f("ix_payments_provider_payment_id"))
        batch_op.create_index(
            batch_op.f("ix_payments_provider_payment_id"), ["provider_payment_id"], unique=True
        )


def downgrade() -> None:
    with op.batch_alter_table("payments", schema=None) as batch_op:
        batch_op.drop_index(batch_op.f("ix_payments_provider_payment_id"))
        batch_op.create_index(
            batch_op.f("ix_payments_provider_payment_id"), ["provider_payment_id"], unique=False
        )

    with op.batch_alter_table("subscriptions", schema=None) as batch_op:
        batch_op.drop_index(batch_op.f("ix_subscriptions_monopay_invoice_id"))
        batch_op.create_index(
            batch_op.f("ix_subscriptions_monopay_invoice_id"), ["monopay_invoice_id"], unique=False
        )
        batch_op.drop_constraint("uq_subscriptions_stripe_sub_id", type_="unique")

    with op.batch_alter_table("users", schema=None) as batch_op:
        batch_op.drop_index(batch_op.f("ix_users_stripe_customer_id"))
        batch_op.create_index(batch_op.f("ix_users_stripe_customer_id"), ["stripe_customer_id"], unique=False)