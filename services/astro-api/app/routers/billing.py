"""
Billing router — Stripe + LiqPay payment integrations.

Stripe flow:
  POST /stripe/checkout  → creates a Checkout Session, returns {url}
  POST /stripe/portal    → creates a Customer Portal session, returns {url}
  POST /stripe/webhook   → receives Stripe webhook events

LiqPay flow (for Ukrainian users):
  POST /liqpay/checkout  → returns {data, signature} for the embedded form
  POST /liqpay/callback  → LiqPay server-to-server callback (IPN)
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import json
import logging
import time
import uuid
from datetime import datetime, timezone

import stripe
from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.dependencies.auth import get_current_user
from app.models.user import Payment, Subscription, User

log = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/billing", tags=["billing"])

# ── Plan catalogue ────────────────────────────────────────────────────────────

PLANS = [
    {
        "id": "free",
        "name": "Free",
        "price_usd": 0,
        "price_uah": 0,
        "features": [
            "3 natal charts",
            "7 major aspects",
            "City search & map",
            "Arabic parts",
            "Terms / bounds",
        ],
        "limits": {"natal_charts_per_day": 3},
    },
    {
        "id": "pro",
        "name": "Pro",
        "price_usd": 9,
        "price_uah": 350,
        "features": [
            "Unlimited natal charts",
            "All aspects + custom orbs",
            "Transits & progressions",
            "Solar return",
            "Synastry",
            "PDF export",
            "Priority support",
        ],
        "limits": {},
        "stripe_price_id": settings.stripe_price_pro_monthly,
    },
    {
        "id": "expert",
        "name": "Expert",
        "price_usd": 19,
        "price_uah": 750,
        "features": [
            "Everything in Pro",
            "Vedic astrology (Dasha, Nakshatras)",
            "Primary directions & Horary",
            "Astrocartography (ACG)",
            "API access",
            "Priority support",
        ],
        "limits": {},
        "stripe_price_id": settings.stripe_price_expert_monthly,
    },
]


@router.get("/plans")
async def list_plans() -> list[dict]:
    return PLANS


# ── Current subscription ──────────────────────────────────────────────────────


@router.get("/subscription")
async def get_subscription(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    plan = next((p for p in PLANS if p["id"] == current_user.plan), PLANS[0])
    return {"plan": current_user.plan, "plan_name": plan["name"]}


# ── Stripe ────────────────────────────────────────────────────────────────────


class StripeCheckoutRequest(BaseModel):
    plan: str  # "pro" | "expert"
    interval: str = "month"  # "month" | "year"


@router.post("/stripe/checkout")
async def stripe_checkout(
    body: StripeCheckoutRequest,
    current_user: User = Depends(get_current_user),
) -> dict:
    if not settings.stripe_secret_key:
        raise HTTPException(status_code=503, detail="Stripe not configured")

    plan_cfg = next((p for p in PLANS if p["id"] == body.plan), None)
    if not plan_cfg or body.plan == "free":
        raise HTTPException(status_code=400, detail="Invalid plan")

    price_id = plan_cfg.get("stripe_price_id", "")
    if not price_id:
        raise HTTPException(status_code=503, detail=f"Stripe price not configured for {body.plan}")

    stripe.api_key = settings.stripe_secret_key

    session_kwargs: dict = dict(
        payment_method_types=["card"],
        line_items=[{"price": price_id, "quantity": 1}],
        mode="subscription",
        success_url=f"{settings.frontend_url}/billing?success=1",
        cancel_url=f"{settings.frontend_url}/pricing?canceled=1",
        metadata={"user_id": current_user.id, "plan": body.plan},
        # Also stamp metadata onto the subscription object itself — Stripe does
        # NOT copy Checkout Session metadata there automatically, and the
        # customer.subscription.* webhooks only see subscription-level metadata.
        subscription_data={"metadata": {"user_id": current_user.id, "plan": body.plan}},
    )
    if current_user.stripe_customer_id:
        session_kwargs["customer"] = current_user.stripe_customer_id
    else:
        session_kwargs["customer_email"] = current_user.email

    session = stripe.checkout.Session.create(**session_kwargs)
    return {"url": session.url}


@router.post("/stripe/portal")
async def stripe_portal(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    if not settings.stripe_secret_key:
        raise HTTPException(status_code=503, detail="Stripe not configured")

    stripe.api_key = settings.stripe_secret_key

    customer_id = current_user.stripe_customer_id
    if not customer_id:
        customers = stripe.Customer.list(email=current_user.email, limit=1)
        if not customers.data:
            raise HTTPException(status_code=404, detail="No Stripe customer found")
        customer_id = customers.data[0].id
        await db.execute(
            update(User).where(User.id == current_user.id).values(stripe_customer_id=customer_id)
        )
        await db.commit()

    session = stripe.billing_portal.Session.create(
        customer=customer_id,
        return_url=f"{settings.frontend_url}/billing",
    )
    return {"url": session.url}


@router.post("/stripe/webhook")
async def stripe_webhook(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> dict:
    payload = await request.body()
    sig = request.headers.get("stripe-signature", "")

    try:
        event = stripe.Webhook.construct_event(
            payload, sig, settings.stripe_webhook_secret
        )
    except (ValueError, stripe.SignatureVerificationError):
        raise HTTPException(status_code=400, detail="Invalid signature")

    await _handle_stripe_event(event, db)
    return {"received": True}


def _ts(value) -> datetime | None:
    return datetime.fromtimestamp(value, tz=timezone.utc) if value else None


async def _upsert_subscription(
    db: AsyncSession, user_id: str, plan: str, status_: str,
    stripe_sub_id: str | None, period_start=None, period_end=None,
) -> None:
    existing = None
    if stripe_sub_id:
        result = await db.execute(select(Subscription).where(Subscription.stripe_sub_id == stripe_sub_id))
        existing = result.scalar_one_or_none()
    if existing:
        existing.plan = plan
        existing.status = status_
        # checkout.session.completed calls this without period dates (Stripe
        # doesn't send them on that event); don't let it blank out real
        # values a subscription.created/updated event may have set earlier —
        # event delivery order isn't guaranteed.
        if period_start is not None:
            existing.period_start = period_start
        if period_end is not None:
            existing.period_end = period_end
    else:
        db.add(Subscription(
            id=str(uuid.uuid4()), user_id=user_id, plan=plan, status=status_,
            stripe_sub_id=stripe_sub_id, period_start=period_start, period_end=period_end,
        ))


async def _handle_stripe_event(event: dict, db: AsyncSession) -> None:
    etype = event["type"]
    # stripe.StripeObject (what construct_event returns) does NOT support
    # .get(...) like a dict — convert to a plain (recursively) dict so the
    # rest of this function can use ordinary dict access.
    data = event["data"]["object"].to_dict()

    if etype == "checkout.session.completed":
        meta = data.get("metadata") or {}
        user_id = meta.get("user_id")
        plan = meta.get("plan", "free")
        customer_id = data.get("customer")
        sub_id = data.get("subscription")
        if user_id:
            await db.execute(
                update(User).where(User.id == user_id).values(plan=plan, stripe_customer_id=customer_id)
            )
            await _upsert_subscription(db, user_id, plan, "active", sub_id)
            await db.commit()
            log.info("Checkout completed: user %s -> plan %s", user_id, plan)

    elif etype in ("customer.subscription.created", "customer.subscription.updated"):
        meta = data.get("metadata") or {}
        user_id = meta.get("user_id")
        plan = meta.get("plan", "free")
        sub_status = data.get("status", "")
        sub_id = data.get("id")
        if user_id:
            if sub_status in ("active", "trialing"):
                await db.execute(
                    update(User).where(User.id == user_id).values(plan=plan)
                )
            await _upsert_subscription(
                db, user_id, plan, sub_status, sub_id,
                period_start=_ts(data.get("current_period_start")),
                period_end=_ts(data.get("current_period_end")),
            )
            await db.commit()
            log.info("Subscription %s for user %s: status=%s plan=%s", sub_id, user_id, sub_status, plan)

    elif etype == "customer.subscription.deleted":
        meta = data.get("metadata") or {}
        user_id = meta.get("user_id")
        sub_id = data.get("id")
        if not user_id and data.get("customer"):
            result = await db.execute(select(User).where(User.stripe_customer_id == data["customer"]))
            found = result.scalar_one_or_none()
            user_id = found.id if found else None
        if user_id:
            await db.execute(
                update(User).where(User.id == user_id).values(plan="free")
            )
            if sub_id:
                result = await db.execute(select(Subscription).where(Subscription.stripe_sub_id == sub_id))
                sub = result.scalar_one_or_none()
                if sub:
                    sub.status = "canceled"
            await db.commit()
            log.info("Downgraded user %s to free", user_id)

    elif etype == "invoice.payment_succeeded":
        customer_id = data.get("customer")
        invoice_id = data.get("id")
        if customer_id and invoice_id:
            result = await db.execute(select(User).where(User.stripe_customer_id == customer_id))
            user = result.scalar_one_or_none()
            if user:
                existing = await db.execute(
                    select(Payment).where(Payment.provider_payment_id == invoice_id)
                )
                if existing.scalar_one_or_none() is None:
                    db.add(Payment(
                        id=str(uuid.uuid4()), user_id=user.id,
                        amount_cents=data.get("amount_paid", 0),
                        currency=data.get("currency", "usd"),
                        provider="stripe", provider_payment_id=invoice_id,
                        status="succeeded",
                    ))
                    await db.commit()
                    log.info("Recorded Stripe payment %s for user %s", invoice_id, user.id)
            else:
                log.warning("invoice.payment_succeeded for unknown Stripe customer %s", customer_id)


# ── LiqPay ───────────────────────────────────────────────────────────────────


class LiqPayCheckoutRequest(BaseModel):
    plan: str
    interval: str = "month"


def _liqpay_sign(data: str) -> str:
    raw = settings.liqpay_private_key + data + settings.liqpay_private_key
    return base64.b64encode(hashlib.sha1(raw.encode()).digest()).decode()


@router.post("/liqpay/checkout")
async def liqpay_checkout(
    body: LiqPayCheckoutRequest,
    current_user: User = Depends(get_current_user),
) -> dict:
    if not settings.liqpay_public_key or not settings.liqpay_private_key:
        raise HTTPException(status_code=503, detail="LiqPay not configured")

    plan_cfg = next((p for p in PLANS if p["id"] == body.plan), None)
    if not plan_cfg or body.plan == "free":
        raise HTTPException(status_code=400, detail="Invalid plan")

    amount = plan_cfg["price_uah"]
    payload = {
        "version": 3,
        "public_key": settings.liqpay_public_key,
        "action": "subscribe",
        "amount": amount,
        "currency": "UAH",
        "description": f"Zorya {plan_cfg['name']} — monthly",
        "order_id": f"{current_user.id}-{body.plan}-{time.time_ns()}",
        "subscribe": 1,
        "subscribe_date_start": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S"),
        "subscribe_periodicity": "month",
        "result_url": f"{settings.frontend_url}/billing?success=1",
        "server_url": f"{settings.api_public_url}/api/v1/billing/liqpay/callback",
        "customer": current_user.email,
        "info": json.dumps({"user_id": current_user.id, "plan": body.plan}),
    }
    data = base64.b64encode(json.dumps(payload).encode()).decode()
    signature = _liqpay_sign(data)
    return {"data": data, "signature": signature}


@router.post("/liqpay/callback")
async def liqpay_callback(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> dict:
    form = await request.form()
    data = form.get("data", "")
    signature = form.get("signature", "")

    expected = _liqpay_sign(str(data))
    if not hmac.compare_digest(expected, str(signature)):
        raise HTTPException(status_code=400, detail="Invalid LiqPay signature")

    payload = json.loads(base64.b64decode(str(data)))
    pay_status = payload.get("status")
    info = json.loads(payload.get("info", "{}"))
    user_id = info.get("user_id")
    plan = info.get("plan", "free")
    order_id = payload.get("order_id")

    if pay_status in ("subscribed", "success") and user_id:
        await db.execute(
            update(User).where(User.id == user_id).values(plan=plan)
        )

        existing_sub = None
        if order_id:
            result = await db.execute(select(Subscription).where(Subscription.liqpay_order_id == order_id))
            existing_sub = result.scalar_one_or_none()
        if existing_sub:
            existing_sub.status = "active"
            existing_sub.plan = plan
        else:
            db.add(Subscription(
                id=str(uuid.uuid4()), user_id=user_id, plan=plan, status="active",
                liqpay_order_id=order_id,
            ))

        payment_id = str(payload.get("payment_id") or "") or None
        existing_payment = None
        if payment_id:
            result = await db.execute(select(Payment).where(Payment.provider_payment_id == payment_id))
            existing_payment = result.scalar_one_or_none()
        if not existing_payment:
            db.add(Payment(
                id=str(uuid.uuid4()), user_id=user_id,
                amount_cents=int(round(float(payload.get("amount", 0)) * 100)),
                currency=payload.get("currency", "UAH"),
                provider="liqpay", provider_payment_id=payment_id,
                status=pay_status,
            ))

        await db.commit()
        log.info("LiqPay: upgraded user %s to %s", user_id, plan)

    elif pay_status in ("unsubscribed", "failure", "error") and user_id:
        await db.execute(
            update(User).where(User.id == user_id).values(plan="free")
        )
        if order_id:
            result = await db.execute(select(Subscription).where(Subscription.liqpay_order_id == order_id))
            sub = result.scalar_one_or_none()
            if sub:
                sub.status = "canceled"
        await db.commit()
        log.info("LiqPay: downgraded user %s to free (status=%s)", user_id, pay_status)

    return {"ok": True}
