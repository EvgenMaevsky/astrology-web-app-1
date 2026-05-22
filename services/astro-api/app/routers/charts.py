from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies.auth import get_current_user
from app.ephemeris.arabic_parts import compute_arabic_parts
from app.ephemeris.engine import EphemerisEngine
from app.ephemeris.terms import add_terms_to_planets
from app.models.chart_log import ChartLog
from app.models.user import User
from app.schemas.chart import NatalChartRequest, NatalChartResponse

router = APIRouter(prefix="/api/v1/charts", tags=["charts"])

_engine = EphemerisEngine()

FREE_DAILY_LIMIT = 3


async def _check_free_limit(user: User, db: AsyncSession) -> None:
    """Raise 403 if a free-plan user has exceeded today's chart limit."""
    if user.plan != "free":
        return
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    result = await db.execute(
        select(func.count())
        .select_from(ChartLog)
        .where(ChartLog.user_id == user.id, ChartLog.created_at >= today_start)
    )
    count = result.scalar_one()
    if count >= FREE_DAILY_LIMIT:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "code": "plan_limit",
                "message": f"Free plan allows {FREE_DAILY_LIMIT} charts per day. Upgrade to Pro for unlimited access.",
                "current": user.plan,
                "required": "pro",
            },
        )


@router.post("/natal", response_model=NatalChartResponse)
async def natal_chart(
    body: NatalChartRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> NatalChartResponse:
    await _check_free_limit(current_user, db)

    data = _engine.calc_natal(
        dt=body.birth_dt,
        lat=body.lat,
        lon=body.lon,
        house_system=body.house_system,
        bodies=body.bodies,
    )
    planets = data["planets"]
    houses = data["houses"]

    add_terms_to_planets(planets)
    aspects = _engine.calc_aspects(planets)
    arabic_parts = compute_arabic_parts(planets, houses)

    # Log this calculation for rate limiting
    db.add(ChartLog(user_id=current_user.id, chart_type="natal"))
    await db.commit()

    return NatalChartResponse(
        planets=planets,
        houses=houses,
        angles=data["angles"],
        aspects=aspects,
        arabic_parts=arabic_parts,
        meta=data["meta"],
    )


@router.get("/usage")
async def chart_usage(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Return today's chart count (used for free-plan UI indicator)."""
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    result = await db.execute(
        select(func.count())
        .select_from(ChartLog)
        .where(ChartLog.user_id == current_user.id, ChartLog.created_at >= today_start)
    )
    used = result.scalar_one()
    limit = FREE_DAILY_LIMIT if current_user.plan == "free" else None
    return {"used": used, "limit": limit, "plan": current_user.plan}
