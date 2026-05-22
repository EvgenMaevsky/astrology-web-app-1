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

import stripe
from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.dependencies.auth import get_current_user
from app.models.user import User

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

    session = stripe.checkout.Session.create(
        customer_email=current_user.email,
        payment_method_types=["card"],
        line_items=[{"price": price_id, "quantity": 1}],
        mode="subscription",
        success_url=f"{settings.frontend_url}/billing?success=1",
        cancel_url=f"{settings.frontend_url}/pricing?canceled=1",
        metadata={"user_id": current_user.id, "plan": body.plan},
    )
    return {"url": session.url}


@router.post("/stripe/portal")
async def stripe_portal(
    current_user: User = Depends(get_current_user),
) -> dict:
    if not settings.stripe_secret_key:
        raise HTTPException(status_code=503, detail="Stripe not configured")

    stripe.api_key = settings.stripe_secret_key

    # Find the Stripe customer by email
    customers = stripe.Customer.list(email=current_user.email, limit=1)
    if not customers.data:
        raise HTTPException(status_code=404, detail="No Stripe customer found")

    session = stripe.billing_portal.Session.create(
        customer=customers.data[0].id,
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
    except stripe.errors.SignatureVerificationError:
        raise HTTPException(status_code=400, detail="Invalid signature")

    await _handle_stripe_event(event, db)
    return {"received": True}


async def _handle_stripe_event(event: dict, db: AsyncSession) -> None:
    from sqlalchemy import select, update
    from app.models.user import User as UserModel

    etype = event["type"]
    data = event["data"]["object"]

    if etype in ("customer.subscription.created", "customer.subscription.updated"):
        meta = data.get("metadata", {})
        user_id = meta.get("user_id")
        plan = meta.get("plan", "free")
        sub_status = data.get("status", "")
        if user_id and sub_status in ("active", "trialing"):
            await db.execute(
                update(UserModel).where(UserModel.id == user_id).values(plan=plan)
            )
            await db.commit()
            log.info("Upgraded user %s to plan %s", user_id, plan)

    elif etype == "customer.subscription.deleted":
        meta = data.get("metadata", {})
        user_id = meta.get("user_id")
        if user_id:
            await db.execute(
                update(UserModel).where(UserModel.id == user_id).values(plan="free")
            )
            await db.commit()
            log.info("Downgraded user %s to free", user_id)


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
        "description": f"ZET Geo {plan_cfg['name']} — monthly",
        "order_id": f"{current_user.id}-{body.plan}-{__import__('time').time_ns()}",
        "subscribe": 1,
        "subscribe_date_start": __import__('datetime').datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S"),
        "subscribe_periodicity": "month",
        "result_url": f"{settings.frontend_url}/billing?success=1",
        "server_url": f"{settings.frontend_url.replace('3000', '8000')}/api/v1/billing/liqpay/callback",
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

    if pay_status in ("subscribed", "success") and user_id:
        from sqlalchemy import update
        from app.models.user import User as UserModel

        await db.execute(
            update(UserModel).where(UserModel.id == user_id).values(plan=plan)
        )
        await db.commit()
        log.info("LiqPay: upgraded user %s to %s", user_id, plan)

    return {"ok": True}
