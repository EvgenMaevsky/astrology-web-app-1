"""
Billing router — Stripe + monopay payment integrations.

Stripe flow:
  POST /stripe/checkout  → creates a Checkout Session, returns {url}
  POST /stripe/portal    → creates a Customer Portal session, returns {url}
  POST /stripe/webhook   → receives Stripe webhook events

monopay flow (monobank acquiring, for Ukrainian users — one-time invoice,
no native subscriptions; a successful payment grants 30 days of the plan
with no auto-renewal):
  POST /monopay/checkout → creates an invoice, returns {url} to redirect to
  POST /monopay/sync     → re-checks the caller's pending invoice status
                            (used right after redirect-back, since a
                            localhost webhook URL is unreachable from mono)
  POST /monopay/webhook  → monobank server-to-server callback
"""
from __future__ import annotations

import json
import logging
import uuid
from datetime import datetime, timedelta, timezone

import stripe
from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app import monopay
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
            "All major & minor aspects",
            "Transits",
            "Solar return",
            "Synastry",
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
        # Not for sale yet — none of the features above are implemented.
        # Kept in the catalogue (not deleted) because get_subscription()
        # falls back to PLANS[0] for an unknown plan id, and any user whose
        # DB row already has plan="expert" must still resolve to a real name.
        "public": False,
    },
]


@router.get("/plans")
async def list_plans() -> list[dict]:
    return [p for p in PLANS if p.get("public", True)]


# ── Current subscription ──────────────────────────────────────────────────────


@router.get("/subscription")
async def get_subscription(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    plan = next((p for p in PLANS if p["id"] == current_user.plan), PLANS[0])

    result = await db.execute(
        select(Subscription)
        .where(Subscription.user_id == current_user.id, Subscription.status == "active")
        .order_by(Subscription.created_at.desc())
    )
    active_sub = result.scalars().first()
    provider = None
    period_end = None
    if active_sub is not None:
        if active_sub.monopay_invoice_id:
            provider = "monopay"
        elif active_sub.stripe_sub_id:
            provider = "stripe"
        period_end = active_sub.period_end.isoformat() if active_sub.period_end else None

    return {
        "plan": current_user.plan, "plan_name": plan["name"],
        "provider": provider, "period_end": period_end,
    }


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
    if not plan_cfg or body.plan == "free" or not plan_cfg.get("public", True):
        raise HTTPException(status_code=400, detail="Invalid plan")

    price_id = plan_cfg.get("stripe_price_id", "")
    if not price_id:
        raise HTTPException(status_code=503, detail=f"Stripe price not configured for {body.plan}")

    stripe.api_key = settings.stripe_secret_key

    session_kwargs: dict = dict(
        # No payment_method_types here on purpose — Stripe dynamically picks
        # eligible payment methods from the Dashboard config. Hardcoding
        # ["card"] locks out other methods that would otherwise improve
        # conversion (per current Stripe subscription-checkout guidance).
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


def _subscription_period(data: dict) -> tuple[datetime | None, datetime | None]:
    """current_period_start/end live on each subscription item, not on the
    top-level Subscription object, as of API version 2026-06-24.dahlia —
    Stripe moved them there to support multiple prices with independent
    billing cycles on one subscription. We only ever attach a single price,
    so the first item's period is the subscription's period.
    """
    items = (data.get("items") or {}).get("data") or []
    if not items:
        return None, None
    item = items[0]
    return _ts(item.get("current_period_start")), _ts(item.get("current_period_end"))


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
            period_start, period_end = _subscription_period(data)
            await _upsert_subscription(
                db, user_id, plan, sub_status, sub_id,
                period_start=period_start,
                period_end=period_end,
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


# ── monopay ──────────────────────────────────────────────────────────────────

MONOPAY_PERIOD = timedelta(days=30)


class MonopayCheckoutRequest(BaseModel):
    plan: str


@router.post("/monopay/checkout")
async def monopay_checkout(
    body: MonopayCheckoutRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    if not settings.monopay_token:
        raise HTTPException(status_code=503, detail="monopay not configured")

    plan_cfg = next((p for p in PLANS if p["id"] == body.plan), None)
    if not plan_cfg or body.plan == "free" or not plan_cfg.get("public", True):
        raise HTTPException(status_code=400, detail="Invalid plan")

    invoice = await monopay.create_invoice(
        amount_kopecks=plan_cfg["price_uah"] * 100,
        reference=f"{current_user.id}-{body.plan}-{uuid.uuid4().hex[:8]}",
        destination=f"Zorya {plan_cfg['name']} — 30 days",
        redirect_url=f"{settings.frontend_url}/billing?monopay=1",
        webhook_url=f"{settings.api_public_url}/api/v1/billing/monopay/webhook",
    )

    # Local mapping of invoiceId -> (user, plan) — the webhook and /sync both
    # look the invoice up here rather than trusting fields on the callback.
    db.add(Subscription(
        id=str(uuid.uuid4()), user_id=current_user.id, plan=body.plan, status="pending",
        monopay_invoice_id=invoice["invoiceId"],
    ))
    await db.commit()

    return {"url": invoice["pageUrl"]}


async def _apply_monopay_status(inv: dict, db: AsyncSession) -> None:
    """Shared status-transition logic for both the webhook and /sync —
    `inv` has the same shape whether it came from the callback body or
    GET /invoice/status (both carry invoiceId, status, amount, ...).
    """
    invoice_id = inv.get("invoiceId")
    if not invoice_id:
        return

    result = await db.execute(
        select(Subscription).where(Subscription.monopay_invoice_id == invoice_id)
    )
    sub = result.scalar_one_or_none()
    if sub is None:
        log.warning("monopay status for unknown invoice %s", invoice_id)
        return

    mono_status = inv.get("status")

    if mono_status == "success":
        if sub.status != "active":
            now = datetime.now(timezone.utc)
            # Renewal: if the user already has a different active monopay
            # subscription, extend ITS period instead of activating this
            # (new) pending row as a second concurrent one.
            existing = await db.execute(
                select(Subscription).where(
                    Subscription.user_id == sub.user_id,
                    Subscription.status == "active",
                    Subscription.monopay_invoice_id.is_not(None),
                    Subscription.id != sub.id,
                )
            )
            active_sub = existing.scalar_one_or_none()
            if active_sub is not None:
                base = active_sub.period_end
                if base is not None and base.tzinfo is None:
                    base = base.replace(tzinfo=timezone.utc)
                active_sub.period_end = max(now, base or now) + MONOPAY_PERIOD
                sub.status = "merged"
            else:
                sub.status = "active"
                sub.period_start = now
                sub.period_end = now + MONOPAY_PERIOD

            user_result = await db.execute(select(User).where(User.id == sub.user_id))
            user = user_result.scalar_one_or_none()
            if user:
                user.plan = sub.plan

        existing_payment = await db.execute(
            select(Payment).where(Payment.provider_payment_id == invoice_id)
        )
        if existing_payment.scalar_one_or_none() is None:
            db.add(Payment(
                id=str(uuid.uuid4()), user_id=sub.user_id,
                amount_cents=inv.get("amount", 0),
                currency="UAH",
                provider="monopay", provider_payment_id=invoice_id,
                status="succeeded",
            ))
        await db.commit()
        log.info("monopay: invoice %s succeeded for user %s -> plan %s", invoice_id, sub.user_id, sub.plan)

    elif mono_status == "reversed":
        sub.status = "canceled"
        # Only downgrade to free if the user has no other active subscription
        # (e.g. a paying Stripe user shouldn't be knocked down by a dead
        # mono invoice).
        other_active = await db.execute(
            select(Subscription).where(
                Subscription.user_id == sub.user_id,
                Subscription.status == "active",
                Subscription.id != sub.id,
            )
        )
        if other_active.scalar_one_or_none() is None:
            user_result = await db.execute(select(User).where(User.id == sub.user_id))
            user = user_result.scalar_one_or_none()
            if user:
                user.plan = "free"
        await db.commit()
        log.info("monopay: invoice %s reversed for user %s", invoice_id, sub.user_id)

    elif mono_status in ("failure", "expired"):
        if sub.status == "pending":
            sub.status = "failed"
            await db.commit()
        log.info("monopay: invoice %s %s", invoice_id, mono_status)

    else:
        log.debug("monopay: invoice %s status=%s (no action)", invoice_id, mono_status)


@router.post("/monopay/sync")
async def monopay_sync(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    result = await db.execute(
        select(Subscription)
        .where(
            Subscription.user_id == current_user.id,
            Subscription.monopay_invoice_id.is_not(None),
            Subscription.status == "pending",
        )
        .order_by(Subscription.created_at.desc())
    )
    sub = result.scalars().first()
    if sub is not None:
        inv = await monopay.get_invoice_status(sub.monopay_invoice_id)
        await _apply_monopay_status(inv, db)
        await db.refresh(current_user)

    return {"plan": current_user.plan}


@router.post("/monopay/webhook")
async def monopay_webhook(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> dict:
    raw_body = await request.body()
    x_sign = request.headers.get("x-sign", "")

    if not await monopay.verify_webhook_signature(raw_body, x_sign):
        raise HTTPException(status_code=400, detail="Invalid signature")

    inv = json.loads(raw_body)
    await _apply_monopay_status(inv, db)
    return {"ok": True}
