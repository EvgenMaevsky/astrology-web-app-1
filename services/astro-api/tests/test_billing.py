import base64
import hashlib
import hmac
import json
import time

import pytest
from httpx import AsyncClient
from sqlalchemy import select

from app.config import settings
from app.models.user import Payment, Subscription, User
from tests.conftest import TestSession


@pytest.fixture(autouse=True)
def _billing_secrets():
    """Set fake webhook/signing secrets for the duration of each test, then restore."""
    prev_stripe = settings.stripe_webhook_secret
    prev_liqpay = settings.liqpay_private_key
    settings.stripe_webhook_secret = "whsec_test"
    settings.liqpay_private_key = "test_private"
    yield
    settings.stripe_webhook_secret = prev_stripe
    settings.liqpay_private_key = prev_liqpay


def _stripe_signed_payload(event: dict) -> tuple[bytes, str]:
    # Real Stripe events always carry a top-level "object": "event" field —
    # the SDK's construct_event() reads it before touching anything else.
    full_event = {"object": "event", "id": "evt_test", **event}
    payload = json.dumps(full_event).encode()
    t = int(time.time())
    sig = hmac.new(
        settings.stripe_webhook_secret.encode(),
        f"{t}.".encode() + payload,
        hashlib.sha256,
    ).hexdigest()
    return payload, f"t={t},v1={sig}"


def _liqpay_signed_form(payload: dict) -> dict:
    data = base64.b64encode(json.dumps(payload).encode()).decode()
    raw = settings.liqpay_private_key + data + settings.liqpay_private_key
    signature = base64.b64encode(hashlib.sha1(raw.encode()).digest()).decode()
    return {"data": data, "signature": signature}


async def _get_user(email: str) -> User:
    async with TestSession() as session:
        result = await session.execute(select(User).where(User.email == email))
        return result.scalar_one()


async def _register(client: AsyncClient, email: str) -> str:
    r = await client.post("/api/v1/auth/register", json={"email": email, "password": "password123"})
    return r.json()["access_token"]


# ── Stripe webhook signature ────────────────────────────────────────────────

async def test_stripe_webhook_invalid_signature_rejected(client: AsyncClient):
    payload, _ = _stripe_signed_payload({"type": "checkout.session.completed", "data": {"object": {}}})
    r = await client.post(
        "/api/v1/billing/stripe/webhook",
        content=payload,
        headers={"stripe-signature": "t=1,v1=deadbeef"},
    )
    assert r.status_code == 400


async def test_stripe_webhook_malformed_payload_rejected(client: AsyncClient):
    r = await client.post(
        "/api/v1/billing/stripe/webhook",
        content=b"not json",
        headers={"stripe-signature": "t=1,v1=deadbeef"},
    )
    assert r.status_code == 400


# ── Stripe checkout.session.completed ───────────────────────────────────────

async def test_checkout_session_completed_upgrades_plan(client: AsyncClient):
    await _register(client, "stripe1@example.com")
    user = await _get_user("stripe1@example.com")

    event = {
        "type": "checkout.session.completed",
        "data": {"object": {
            "metadata": {"user_id": user.id, "plan": "pro"},
            "customer": "cus_test123",
            "subscription": "sub_test123",
        }},
    }
    payload, sig = _stripe_signed_payload(event)
    r = await client.post(
        "/api/v1/billing/stripe/webhook", content=payload, headers={"stripe-signature": sig}
    )
    assert r.status_code == 200

    updated = await _get_user("stripe1@example.com")
    assert updated.plan == "pro"
    assert updated.stripe_customer_id == "cus_test123"

    async with TestSession() as session:
        result = await session.execute(select(Subscription).where(Subscription.user_id == user.id))
        sub = result.scalar_one()
        assert sub.status == "active"
        assert sub.stripe_sub_id == "sub_test123"


# ── Stripe customer.subscription.created/updated ────────────────────────────

async def test_subscription_created_reads_period_from_items(client: AsyncClient):
    # As of API version 2026-06-24.dahlia, Stripe moved current_period_start/
    # end off the top-level Subscription object onto each item in
    # items.data[] — this reproduces that shape (confirmed against a real
    # event pulled from the Stripe CLI during live E2E testing).
    await _register(client, "stripe-period@example.com")
    user = await _get_user("stripe-period@example.com")

    event = {
        "type": "customer.subscription.created",
        "data": {"object": {
            "id": "sub_period_test",
            "status": "active",
            "metadata": {"user_id": user.id, "plan": "pro"},
            "items": {"data": [{
                "current_period_start": 1784357910,
                "current_period_end": 1787036310,
            }]},
        }},
    }
    payload, sig = _stripe_signed_payload(event)
    r = await client.post(
        "/api/v1/billing/stripe/webhook", content=payload, headers={"stripe-signature": sig}
    )
    assert r.status_code == 200

    async with TestSession() as session:
        result = await session.execute(
            select(Subscription).where(Subscription.stripe_sub_id == "sub_period_test")
        )
        sub = result.scalar_one()
        assert sub.period_start is not None
        assert sub.period_end is not None
        assert sub.period_start < sub.period_end


# ── Stripe invoice.payment_succeeded ────────────────────────────────────────

async def test_invoice_payment_succeeded_records_payment(client: AsyncClient):
    await _register(client, "stripe2@example.com")
    user = await _get_user("stripe2@example.com")
    async with TestSession() as session:
        db_user = await session.get(User, user.id)
        db_user.stripe_customer_id = "cus_test456"
        await session.commit()

    event = {
        "type": "invoice.payment_succeeded",
        "data": {"object": {
            "id": "in_test456", "customer": "cus_test456",
            "amount_paid": 900, "currency": "usd",
        }},
    }
    payload, sig = _stripe_signed_payload(event)
    r = await client.post(
        "/api/v1/billing/stripe/webhook", content=payload, headers={"stripe-signature": sig}
    )
    assert r.status_code == 200

    async with TestSession() as session:
        result = await session.execute(select(Payment).where(Payment.user_id == user.id))
        payments = result.scalars().all()
        assert len(payments) == 1
        assert payments[0].amount_cents == 900
        assert payments[0].provider == "stripe"

    # Redelivery of the same invoice event must not duplicate the payment
    payload2, sig2 = _stripe_signed_payload(event)
    r2 = await client.post(
        "/api/v1/billing/stripe/webhook", content=payload2, headers={"stripe-signature": sig2}
    )
    assert r2.status_code == 200
    async with TestSession() as session:
        result = await session.execute(select(Payment).where(Payment.user_id == user.id))
        assert len(result.scalars().all()) == 1


# ── LiqPay ───────────────────────────────────────────────────────────────────

async def test_liqpay_success_upgrades_and_records_payment(client: AsyncClient):
    await _register(client, "liqpay1@example.com")
    user = await _get_user("liqpay1@example.com")

    payload = {
        "status": "success", "order_id": f"{user.id}-pro-1",
        "amount": 350, "currency": "UAH", "payment_id": "lp_1",
        "info": json.dumps({"user_id": user.id, "plan": "pro"}),
    }
    form = _liqpay_signed_form(payload)
    r = await client.post("/api/v1/billing/liqpay/callback", data=form)
    assert r.status_code == 200

    updated = await _get_user("liqpay1@example.com")
    assert updated.plan == "pro"

    async with TestSession() as session:
        result = await session.execute(select(Payment).where(Payment.user_id == user.id))
        payments = result.scalars().all()
        assert len(payments) == 1
        assert payments[0].provider == "liqpay"
        assert payments[0].amount_cents == 35000


@pytest.mark.parametrize("bad_status", ["unsubscribed", "failure", "error"])
async def test_liqpay_cancellation_downgrades_to_free(client: AsyncClient, bad_status):
    await _register(client, f"liqpay-{bad_status}@example.com")
    user = await _get_user(f"liqpay-{bad_status}@example.com")
    async with TestSession() as session:
        db_user = await session.get(User, user.id)
        db_user.plan = "pro"
        await session.commit()

    payload = {
        "status": bad_status, "order_id": f"{user.id}-pro-1",
        "info": json.dumps({"user_id": user.id, "plan": "pro"}),
    }
    form = _liqpay_signed_form(payload)
    r = await client.post("/api/v1/billing/liqpay/callback", data=form)
    assert r.status_code == 200

    updated = await _get_user(f"liqpay-{bad_status}@example.com")
    assert updated.plan == "free"


async def test_liqpay_invalid_signature_rejected(client: AsyncClient):
    payload = {"status": "success", "info": "{}"}
    data = base64.b64encode(json.dumps(payload).encode()).decode()
    r = await client.post(
        "/api/v1/billing/liqpay/callback", data={"data": data, "signature": "bogus"}
    )
    assert r.status_code == 400


# ── Plan catalogue: honest pricing ──────────────────────────────────────────

async def test_list_plans_hides_expert_and_unimplemented_features(client: AsyncClient):
    r = await client.get("/api/v1/billing/plans")
    assert r.status_code == 200
    plans = r.json()
    assert [p["id"] for p in plans] == ["free", "pro"]

    all_features = " ".join(f for p in plans for f in p["features"]).lower()
    for unimplemented in ("pdf export", "progression", "custom orb"):
        assert unimplemented not in all_features


async def test_stripe_checkout_rejects_hidden_plan(client: AsyncClient, monkeypatch):
    monkeypatch.setattr(settings, "stripe_secret_key", "sk_test_fake")
    token = await _register(client, "hidden-stripe@example.com")
    r = await client.post(
        "/api/v1/billing/stripe/checkout",
        json={"plan": "expert"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 400


async def test_liqpay_checkout_rejects_hidden_plan(client: AsyncClient, monkeypatch):
    monkeypatch.setattr(settings, "liqpay_public_key", "pub_test_fake")
    token = await _register(client, "hidden-liqpay@example.com")
    r = await client.post(
        "/api/v1/billing/liqpay/checkout",
        json={"plan": "expert"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 400
