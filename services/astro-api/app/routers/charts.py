from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.dependencies.auth import get_current_user
from app.dependencies.billing import require_plan
from app.ephemeris.arabic_parts import compute_arabic_parts
from app.ephemeris.engine import EphemerisEngine
from app.ephemeris.terms import add_terms_to_planets
from app.models.chart_log import ChartLog
from app.models.chart_quota import ChartQuota
from app.models.user import User
from app.rate_limit import limiter
from app.schemas.chart import (
    NatalChartRequest, NatalChartResponse,
    TransitRequest, TransitResponse,
    SolarReturnRequest, SolarReturnResponse,
    SynastryRequest, SynastryResponse,
)

router = APIRouter(prefix="/api/v1/charts", tags=["charts"])

_engine = EphemerisEngine()

FREE_DAILY_LIMIT = 3


async def _reserve_free_chart(user: User, db: AsyncSession) -> None:
    """Atomically reserve one free natal chart for the current UTC day."""
    if user.plan != "free":
        return

    usage_date = datetime.now(timezone.utc).date()
    insert = pg_insert if db.get_bind().dialect.name == "postgresql" else sqlite_insert
    statement = (
        insert(ChartQuota)
        .values(user_id=user.id, usage_date=usage_date, used=1)
        .on_conflict_do_update(
            index_elements=["user_id", "usage_date"],
            set_={"used": ChartQuota.used + 1},
            where=ChartQuota.used < FREE_DAILY_LIMIT,
        )
        .returning(ChartQuota.used)
    )
    reserved = (await db.execute(statement)).scalar_one_or_none()
    if reserved is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "code": "plan_limit",
                "message": f"Free plan allows {FREE_DAILY_LIMIT} charts per day. Upgrade to Pro for unlimited access.",
                "current": user.plan,
                "required": "pro",
            },
        )
    await db.commit()


@router.post("/natal", response_model=NatalChartResponse)
@limiter.limit(settings.rate_limit_chart_calc)
async def natal_chart(
    request: Request,
    body: NatalChartRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> NatalChartResponse:
    await _reserve_free_chart(current_user, db)

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


@router.post("/transit", response_model=TransitResponse)
@limiter.limit(settings.rate_limit_chart_calc)
async def transit_chart(
    request: Request,
    body: TransitRequest,
    current_user: User = Depends(require_plan("pro", "expert")),
    db: AsyncSession = Depends(get_db),
) -> TransitResponse:
    data = _engine.calc_transit(
        natal_dt=body.natal_dt, natal_lat=body.natal_lat, natal_lon=body.natal_lon,
        transit_dt=body.transit_dt, transit_lat=body.transit_lat, transit_lon=body.transit_lon,
        house_system=body.house_system, bodies=body.bodies,
    )

    natal_planets = data["natal"]["planets"]
    add_terms_to_planets(natal_planets)
    natal_aspects = _engine.calc_aspects(natal_planets)
    natal_arabic = compute_arabic_parts(natal_planets, data["natal"]["houses"])

    natal_resp = NatalChartResponse(
        planets=natal_planets,
        houses=data["natal"]["houses"],
        angles=data["natal"]["angles"],
        aspects=natal_aspects,
        arabic_parts=natal_arabic,
        meta=data["natal"]["meta"],
    )

    transit_planets = data["transit"]
    add_terms_to_planets(transit_planets)

    db.add(ChartLog(user_id=current_user.id, chart_type="transit"))
    await db.commit()

    return TransitResponse(
        natal=natal_resp,
        transit=transit_planets,
        aspects=data["aspects"],
    )


@router.post("/solar-return", response_model=SolarReturnResponse)
@limiter.limit(settings.rate_limit_chart_calc)
async def solar_return_chart(
    request: Request,
    body: SolarReturnRequest,
    current_user: User = Depends(require_plan("pro", "expert")),
    db: AsyncSession = Depends(get_db),
) -> SolarReturnResponse:
    data = _engine.calc_solar_return(
        birth_dt=body.birth_dt, year=body.year,
        lat=body.lat, lon=body.lon, house_system=body.house_system,
    )

    planets = data["planets"]
    add_terms_to_planets(planets)
    aspects = _engine.calc_aspects(planets)
    arabic_parts = compute_arabic_parts(planets, data["houses"])

    db.add(ChartLog(user_id=current_user.id, chart_type="solar_return"))
    await db.commit()

    return SolarReturnResponse(
        return_dt=data["return_dt"],
        natal_sun=data["natal_sun"],
        planets=planets,
        houses=data["houses"],
        angles=data["angles"],
        aspects=aspects,
        arabic_parts=arabic_parts,
        meta=data["meta"],
    )


@router.post("/synastry", response_model=SynastryResponse)
@limiter.limit(settings.rate_limit_chart_calc)
async def synastry_chart(
    request: Request,
    body: SynastryRequest,
    current_user: User = Depends(require_plan("pro", "expert")),
    db: AsyncSession = Depends(get_db),
) -> SynastryResponse:
    data = _engine.calc_synastry(
        dt1=body.dt1, lat1=body.lat1, lon1=body.lon1,
        dt2=body.dt2, lat2=body.lat2, lon2=body.lon2,
        house_system=body.house_system, bodies=body.bodies,
    )

    for key in ("person1", "person2"):
        add_terms_to_planets(data[key]["planets"])

    p1_planets = data["person1"]["planets"]
    p2_planets = data["person2"]["planets"]
    p1_aspects = _engine.calc_aspects(p1_planets)
    p2_aspects = _engine.calc_aspects(p2_planets)
    p1_arabic = compute_arabic_parts(p1_planets, data["person1"]["houses"])
    p2_arabic = compute_arabic_parts(p2_planets, data["person2"]["houses"])

    db.add(ChartLog(user_id=current_user.id, chart_type="synastry"))
    await db.commit()

    return SynastryResponse(
        person1=NatalChartResponse(
            planets=p1_planets, houses=data["person1"]["houses"],
            angles=data["person1"]["angles"], aspects=p1_aspects,
            arabic_parts=p1_arabic, meta=data["person1"]["meta"],
        ),
        person2=NatalChartResponse(
            planets=p2_planets, houses=data["person2"]["houses"],
            angles=data["person2"]["angles"], aspects=p2_aspects,
            arabic_parts=p2_arabic, meta=data["person2"]["meta"],
        ),
        inter_aspects=data["inter_aspects"],
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
