import logging
from datetime import datetime, timezone

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.models.user import Subscription, User

log = logging.getLogger(__name__)
bearer_scheme = HTTPBearer()


async def _expire_stale_monopay_subscriptions(db: AsyncSession, user: User) -> None:
    """monopay has no native subscriptions — a paid invoice just grants 30
    days. There's no cron, so expiry is lazy: checked here, on every authed
    request for a non-free user. A Stripe subscription's lifecycle is owned
    by Stripe's own webhook (period_end stays None for those), so it's never
    touched here — only monopay-backed rows with a period_end in the past.
    """
    if user.plan == "free":
        return

    now = datetime.now(timezone.utc)
    result = await db.execute(
        select(Subscription).where(Subscription.user_id == user.id, Subscription.status == "active")
    )
    active_subs = result.scalars().all()

    stale: list[Subscription] = []
    has_current = False
    for sub in active_subs:
        if sub.monopay_invoice_id is None:
            has_current = True
            continue
        if sub.period_end is not None and sub.period_end.replace(tzinfo=timezone.utc) < now:
            stale.append(sub)
        else:
            has_current = True

    if not stale:
        return

    for sub in stale:
        sub.status = "expired"
    if not has_current:
        user.plan = "free"
    await db.commit()
    log.info(
        "Expired %d stale monopay subscription(s) for user %s%s",
        len(stale), user.id, " -> downgraded to free" if not has_current else "",
    )


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    token = credentials.credentials
    exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired token",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        # jwt.decode verifies signature and exp
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
        user_id: str | None = payload.get("sub")
        if user_id is None or payload.get("type") != "access":
            raise exc
    except jwt.InvalidTokenError:
        raise exc

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None or not user.is_active:
        raise exc
    await _expire_stale_monopay_subscriptions(db, user)
    return user
