import base64
import hashlib
import hmac
import json
import time
import uuid
from datetime import datetime, timedelta, timezone

import pytest
from httpx import AsyncClient
from sqlalchemy import select

from app.config import settings
from app.models.user import Payment, Subscription, User
from tests.conftest import TestSession


@pytest.fixture(autouse=True)
def _billing_secrets():
    """Set a fake Stripe webhook secret for the duration of each test, then restore."""
    prev_stripe = settings.stripe_webhook_secret
    settings.stripe_webhook_secret = "whsec_test"
    yield
    settings.stripe_webhook_secret = prev_stripe


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


# ── monopay checkout ─────────────────────────────────────────────────────────

async def test_monopay_checkout_creates_pending_subscription(client: AsyncClient, monkeypatch):
    monkeypatch.setattr(settings, "monopay_token", "test_token")

    async def fake_create_invoice(**kwargs):
        return {"invoiceId": "inv_test_1", "pageUrl": "https://pay.monobank.ua/inv_test_1"}

    monkeypatch.setattr("app.monopay.create_invoice", fake_create_invoice)

    token = await _register(client, "monopay-checkout@example.com")
    user = await _get_user("monopay-checkout@example.com")

    r = await client.post(
        "/api/v1/billing/monopay/checkout",
        json={"plan": "pro"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 200
    assert r.json() == {"url": "https://pay.monobank.ua/inv_test_1"}

    async with TestSession() as session:
        result = await session.execute(select(Subscription).where(Subscription.user_id == user.id))
        sub = result.scalar_one()
        assert sub.status == "pending"
        assert sub.monopay_invoice_id == "inv_test_1"
        assert sub.plan == "pro"


async def test_monopay_checkout_rejects_hidden_plan(client: AsyncClient, monkeypatch):
    monkeypatch.setattr(settings, "monopay_token", "test_token")
    token = await _register(client, "monopay-hidden@example.com")
    r = await client.post(
        "/api/v1/billing/monopay/checkout",
        json={"plan": "expert"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 400


async def test_monopay_checkout_without_token_returns_503(client: AsyncClient, monkeypatch):
    monkeypatch.setattr(settings, "monopay_token", "")
    token = await _register(client, "monopay-notoken@example.com")
    r = await client.post(
        "/api/v1/billing/monopay/checkout",
        json={"plan": "pro"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 503


# ── monopay webhook ──────────────────────────────────────────────────────────

async def test_monopay_webhook_success_activates_subscription(client: AsyncClient, monkeypatch):
    async def fake_verify(raw_body: bytes, x_sign: str) -> bool:
        return True

    monkeypatch.setattr("app.monopay.verify_webhook_signature", fake_verify)

    token = await _register(client, "monopay-success@example.com")
    user = await _get_user("monopay-success@example.com")

    async with TestSession() as session:
        session.add(Subscription(
            id=str(uuid.uuid4()), user_id=user.id, plan="pro", status="pending",
            monopay_invoice_id="inv_success_1",
        ))
        await session.commit()

    body = json.dumps({"invoiceId": "inv_success_1", "status": "success", "amount": 35000}).encode()
    r = await client.post(
        "/api/v1/billing/monopay/webhook", content=body,
        headers={"X-Sign": "irrelevant", "Content-Type": "application/json"},
    )
    assert r.status_code == 200

    updated = await _get_user("monopay-success@example.com")
    assert updated.plan == "pro"

    async with TestSession() as session:
        result = await session.execute(
            select(Subscription).where(Subscription.monopay_invoice_id == "inv_success_1")
        )
        sub = result.scalar_one()
        assert sub.status == "active"
        assert sub.period_start is not None
        assert sub.period_end is not None
        delta = sub.period_end - sub.period_start
        assert timedelta(days=29) < delta < timedelta(days=31)

        result_p = await session.execute(select(Payment).where(Payment.provider_payment_id == "inv_success_1"))
        payments = result_p.scalars().all()
        assert len(payments) == 1
        assert payments[0].provider == "monopay"
        assert payments[0].amount_cents == 35000

    # Redelivery of the same webhook must not duplicate the payment
    r2 = await client.post(
        "/api/v1/billing/monopay/webhook", content=body,
        headers={"X-Sign": "irrelevant", "Content-Type": "application/json"},
    )
    assert r2.status_code == 200
    async with TestSession() as session:
        result_p = await session.execute(select(Payment).where(Payment.provider_payment_id == "inv_success_1"))
        assert len(result_p.scalars().all()) == 1


async def test_monopay_webhook_reversed_downgrades_to_free(client: AsyncClient, monkeypatch):
    async def fake_verify(raw_body: bytes, x_sign: str) -> bool:
        return True

    monkeypatch.setattr("app.monopay.verify_webhook_signature", fake_verify)

    token = await _register(client, "monopay-reversed@example.com")
    user = await _get_user("monopay-reversed@example.com")

    async with TestSession() as session:
        db_user = await session.get(User, user.id)
        db_user.plan = "pro"
        session.add(Subscription(
            id=str(uuid.uuid4()), user_id=user.id, plan="pro", status="active",
            monopay_invoice_id="inv_reversed_1",
            period_start=datetime.now(timezone.utc),
            period_end=datetime.now(timezone.utc) + timedelta(days=30),
        ))
        await session.commit()

    body = json.dumps({"invoiceId": "inv_reversed_1", "status": "reversed"}).encode()
    r = await client.post(
        "/api/v1/billing/monopay/webhook", content=body,
        headers={"X-Sign": "irrelevant", "Content-Type": "application/json"},
    )
    assert r.status_code == 200

    updated = await _get_user("monopay-reversed@example.com")
    assert updated.plan == "free"

    async with TestSession() as session:
        result = await session.execute(
            select(Subscription).where(Subscription.monopay_invoice_id == "inv_reversed_1")
        )
        sub = result.scalar_one()
        assert sub.status == "canceled"


async def test_monopay_webhook_failure_marks_pending_failed(client: AsyncClient, monkeypatch):
    async def fake_verify(raw_body: bytes, x_sign: str) -> bool:
        return True

    monkeypatch.setattr("app.monopay.verify_webhook_signature", fake_verify)

    token = await _register(client, "monopay-failure@example.com")
    user = await _get_user("monopay-failure@example.com")
    assert user.plan == "free"

    async with TestSession() as session:
        session.add(Subscription(
            id=str(uuid.uuid4()), user_id=user.id, plan="pro", status="pending",
            monopay_invoice_id="inv_failure_1",
        ))
        await session.commit()

    body = json.dumps({"invoiceId": "inv_failure_1", "status": "failure"}).encode()
    r = await client.post(
        "/api/v1/billing/monopay/webhook", content=body,
        headers={"X-Sign": "irrelevant", "Content-Type": "application/json"},
    )
    assert r.status_code == 200

    updated = await _get_user("monopay-failure@example.com")
    assert updated.plan == "free"

    async with TestSession() as session:
        result = await session.execute(
            select(Subscription).where(Subscription.monopay_invoice_id == "inv_failure_1")
        )
        sub = result.scalar_one()
        assert sub.status == "failed"


async def test_monopay_webhook_invalid_signature_rejected(client: AsyncClient, monkeypatch):
    # Real ECDSA verification runs here (verify_webhook_signature is NOT
    # mocked) — only the network call to fetch the pubkey is, so a bogus
    # X-Sign header genuinely fails cryptographic verification.
    from cryptography.hazmat.primitives.asymmetric import ec

    key = ec.generate_private_key(ec.SECP256R1())
    pub = key.public_key()

    async def fake_fetch_pubkey(force_refresh: bool = False):
        return pub

    monkeypatch.setattr("app.monopay._fetch_pubkey", fake_fetch_pubkey)

    body = json.dumps({"invoiceId": "inv_bad_sig", "status": "success", "amount": 100}).encode()
    r = await client.post(
        "/api/v1/billing/monopay/webhook", content=body,
        headers={"X-Sign": base64.b64encode(b"not-a-real-signature").decode(), "Content-Type": "application/json"},
    )
    assert r.status_code == 400


# ── monopay sync ─────────────────────────────────────────────────────────────

async def test_monopay_sync_applies_pending_invoice_status(client: AsyncClient, monkeypatch):
    async def fake_get_status(invoice_id: str) -> dict:
        return {"invoiceId": invoice_id, "status": "success", "amount": 35000}

    monkeypatch.setattr("app.monopay.get_invoice_status", fake_get_status)

    token = await _register(client, "monopay-sync@example.com")
    user = await _get_user("monopay-sync@example.com")

    async with TestSession() as session:
        session.add(Subscription(
            id=str(uuid.uuid4()), user_id=user.id, plan="pro", status="pending",
            monopay_invoice_id="inv_sync_1",
        ))
        await session.commit()

    r = await client.post(
        "/api/v1/billing/monopay/sync",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 200
    assert r.json()["plan"] == "pro"

    async with TestSession() as session:
        result = await session.execute(
            select(Subscription).where(Subscription.monopay_invoice_id == "inv_sync_1")
        )
        sub = result.scalar_one()
        assert sub.status == "active"


# ── monopay renewal ──────────────────────────────────────────────────────────

async def test_monopay_renewal_extends_existing_active_subscription(client: AsyncClient, monkeypatch):
    async def fake_verify(raw_body: bytes, x_sign: str) -> bool:
        return True

    monkeypatch.setattr("app.monopay.verify_webhook_signature", fake_verify)

    token = await _register(client, "monopay-renew@example.com")
    user = await _get_user("monopay-renew@example.com")

    original_end = datetime.now(timezone.utc) + timedelta(days=15)
    async with TestSession() as session:
        db_user = await session.get(User, user.id)
        db_user.plan = "pro"
        session.add(Subscription(
            id=str(uuid.uuid4()), user_id=user.id, plan="pro", status="active",
            monopay_invoice_id="inv_renew_original",
            period_start=datetime.now(timezone.utc) - timedelta(days=15),
            period_end=original_end,
        ))
        # A second, still-pending invoice representing the renewal payment.
        session.add(Subscription(
            id=str(uuid.uuid4()), user_id=user.id, plan="pro", status="pending",
            monopay_invoice_id="inv_renew_new",
        ))
        await session.commit()

    body = json.dumps({"invoiceId": "inv_renew_new", "status": "success", "amount": 35000}).encode()
    r = await client.post(
        "/api/v1/billing/monopay/webhook", content=body,
        headers={"X-Sign": "irrelevant", "Content-Type": "application/json"},
    )
    assert r.status_code == 200

    async with TestSession() as session:
        result_orig = await session.execute(
            select(Subscription).where(Subscription.monopay_invoice_id == "inv_renew_original")
        )
        orig = result_orig.scalar_one()
        assert orig.status == "active"
        expected_end = original_end + timedelta(days=30)
        actual_end = orig.period_end
        if actual_end.tzinfo is None:
            actual_end = actual_end.replace(tzinfo=timezone.utc)
        assert abs((actual_end - expected_end).total_seconds()) < 5

        result_new = await session.execute(
            select(Subscription).where(Subscription.monopay_invoice_id == "inv_renew_new")
        )
        new_sub = result_new.scalar_one()
        assert new_sub.status == "merged"


# ── Lazy expiry ──────────────────────────────────────────────────────────────

async def test_lazy_expiry_downgrades_expired_monopay_subscription(client: AsyncClient):
    token = await _register(client, "monopay-expiry@example.com")
    user = await _get_user("monopay-expiry@example.com")

    async with TestSession() as session:
        db_user = await session.get(User, user.id)
        db_user.plan = "pro"
        session.add(Subscription(
            id=str(uuid.uuid4()), user_id=user.id, plan="pro", status="active",
            monopay_invoice_id="inv_expired_1",
            period_start=datetime.now(timezone.utc) - timedelta(days=40),
            period_end=datetime.now(timezone.utc) - timedelta(days=10),
        ))
        await session.commit()

    r = await client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200
    assert r.json()["plan"] == "free"

    async with TestSession() as session:
        result = await session.execute(
            select(Subscription).where(Subscription.monopay_invoice_id == "inv_expired_1")
        )
        sub = result.scalar_one()
        assert sub.status == "expired"


async def test_lazy_expiry_does_not_touch_stripe_subscription(client: AsyncClient):
    # A Stripe subscription's lifecycle belongs to Stripe's own webhook —
    # period_end=None must never be treated as "expired" here.
    token = await _register(client, "stripe-noexpiry@example.com")
    user = await _get_user("stripe-noexpiry@example.com")

    async with TestSession() as session:
        db_user = await session.get(User, user.id)
        db_user.plan = "pro"
        session.add(Subscription(
            id=str(uuid.uuid4()), user_id=user.id, plan="pro", status="active",
            stripe_sub_id="sub_active_forever",
        ))
        await session.commit()

    r = await client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200
    assert r.json()["plan"] == "pro"

    async with TestSession() as session:
        result = await session.execute(
            select(Subscription).where(Subscription.stripe_sub_id == "sub_active_forever")
        )
        sub = result.scalar_one()
        assert sub.status == "active"
