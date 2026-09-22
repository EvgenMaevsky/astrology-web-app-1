from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.concurrency import run_in_threadpool

from app.config import settings
from app.database import get_db
from app.dependencies.auth import get_current_user
from app.ephemeris.arabic_parts import compute_arabic_parts
from app.ephemeris.cache import ResultCache
from app.ephemeris.engine import MAJOR_ASPECTS, EphemerisEngine
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

# Natal only, on purpose: it is the one that repeats — the same well-known
# birth data, a page reloaded, and (once the public page lands) whatever a
# script decides to send over and over. Transits and synastry carry a second
# varying date, so they would mostly miss and only cost memory.
_natal_cache = ResultCache(settings.chart_cache_size) if settings.chart_cache_size else None

# Natal charts are unlimited on every plan. What the free plan is metered on
# is the advanced techniques, and the allowance is SHARED across all three —
# two per day in total, not two of each.
FREE_ADVANCED_DAILY_LIMIT = 2

ADVANCED_CHART_TYPES = ("transit", "solar_return", "synastry")


async def _reserve_advanced_chart(user: User, db: AsyncSession) -> None:
    """Atomically reserve one advanced chart for the current UTC day.

    Kept as a single UPSERT with the limit in its WHERE clause rather than a
    read-then-write: two simultaneous requests would otherwise both read the
    same count and both be allowed through. This is the same pattern the C3
    review put in place for the old natal quota.
    """
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
            where=ChartQuota.used < FREE_ADVANCED_DAILY_LIMIT,
        )
        .returning(ChartQuota.used)
    )
    reserved = (await db.execute(statement)).scalar_one_or_none()
    if reserved is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "code": "plan_limit",
                "message": (
                    f"The Free plan includes {FREE_ADVANCED_DAILY_LIMIT} transit, solar return "
                    "or synastry charts per day. Upgrade to Pro for unlimited access."
                ),
                "current": user.plan,
                "required": "pro",
            },
        )
    await db.commit()


def _visible_aspects(aspects: list[dict], include_minor: bool) -> list[dict]:
    """Drop minor aspects for plans that do not include them.

    Filtered on the server, never in the UI: shipping all eleven and hiding
    six of them would put the paid content one devtools panel away, and the
    Pro plan sells exactly this.
    """
    if include_minor:
        return aspects
    return [a for a in aspects if a["aspect"] in MAJOR_ASPECTS]


def includes_minor_aspects(user: User) -> bool:
    return user.plan in ("pro", "expert")


# ── Pure computation ─────────────────────────────────────────────────────────
#
# These are deliberately plain synchronous functions with no database or
# network access, so the endpoints below can hand them to run_in_threadpool in
# one hop. Called directly from an `async def` they would block the event
# loop for their whole duration (18-40 ms measured), during which the worker
# serves nothing at all — not a login, not a city search, not /health.
#
# To be clear about what this does and does not buy: it fixes RESPONSIVENESS,
# not throughput. The GIL still serialises the pure-Python parts (the
# iterative Placidus house solver above all), so total charts per second
# barely moves. Real parallelism needs multiple worker processes.


def _calc_natal_cached(body: NatalChartRequest) -> dict:
    """calc_natal() with an in-process cache in front of it.

    The key must contain everything that changes the astronomical result and
    nothing that does not. `bodies` is sorted because ["sun","moon"] and
    ["moon","sun"] ask the same question, and birth_dt is already normalised
    to UTC by the request validator, so two clients in different timezones
    asking about the same instant share an entry.
    """
    if _natal_cache is None:
        return _engine.calc_natal(
            dt=body.birth_dt, lat=body.lat, lon=body.lon,
            house_system=body.house_system, bodies=body.bodies,
        )

    key = (
        body.birth_dt,
        body.lat,
        body.lon,
        body.house_system,
        tuple(sorted(body.bodies)) if body.bodies else None,
    )
    cached = _natal_cache.get(key)
    if cached is not None:
        return cached

    data = _engine.calc_natal(
        dt=body.birth_dt, lat=body.lat, lon=body.lon,
        house_system=body.house_system, bodies=body.bodies,
    )
    _natal_cache.put(key, data)
    return data


def _compute_natal(body: NatalChartRequest, include_minor: bool) -> NatalChartResponse:
    data = _calc_natal_cached(body)
    planets = data["planets"]
    houses = data["houses"]

    add_terms_to_planets(planets)
    aspects = _visible_aspects(_engine.calc_aspects(planets), include_minor)
    arabic_parts = compute_arabic_parts(planets, houses)

    return NatalChartResponse(
        planets=planets,
        houses=houses,
        angles=data["angles"],
        aspects=aspects,
        arabic_parts=arabic_parts,
        meta=data["meta"],
    )


def _compute_transit(body: TransitRequest, include_minor: bool) -> TransitResponse:
    data = _engine.calc_transit(
        natal_dt=body.natal_dt, natal_lat=body.natal_lat, natal_lon=body.natal_lon,
        transit_dt=body.transit_dt, transit_lat=body.transit_lat, transit_lon=body.transit_lon,
        house_system=body.house_system, bodies=body.bodies,
    )

    natal_planets = data["natal"]["planets"]
    add_terms_to_planets(natal_planets)
    natal_aspects = _visible_aspects(_engine.calc_aspects(natal_planets), include_minor)
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

    return TransitResponse(
        natal=natal_resp,
        transit=transit_planets,
        aspects=_visible_aspects(data["aspects"], include_minor),
    )


def _compute_solar_return(body: SolarReturnRequest, include_minor: bool) -> SolarReturnResponse:
    data = _engine.calc_solar_return(
        birth_dt=body.birth_dt, year=body.year,
        lat=body.lat, lon=body.lon, house_system=body.house_system,
    )

    planets = data["planets"]
    add_terms_to_planets(planets)
    aspects = _visible_aspects(_engine.calc_aspects(planets), include_minor)
    arabic_parts = compute_arabic_parts(planets, data["houses"])

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


def _compute_synastry(body: SynastryRequest, include_minor: bool) -> SynastryResponse:
    data = _engine.calc_synastry(
        dt1=body.dt1, lat1=body.lat1, lon1=body.lon1,
        dt2=body.dt2, lat2=body.lat2, lon2=body.lon2,
        house_system=body.house_system, bodies=body.bodies,
    )

    for key in ("person1", "person2"):
        add_terms_to_planets(data[key]["planets"])

    p1_planets = data["person1"]["planets"]
    p2_planets = data["person2"]["planets"]
    p1_aspects = _visible_aspects(_engine.calc_aspects(p1_planets), include_minor)
    p2_aspects = _visible_aspects(_engine.calc_aspects(p2_planets), include_minor)
    p1_arabic = compute_arabic_parts(p1_planets, data["person1"]["houses"])
    p2_arabic = compute_arabic_parts(p2_planets, data["person2"]["houses"])

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
        inter_aspects=_visible_aspects(data["inter_aspects"], include_minor),
    )


# ── Endpoints ────────────────────────────────────────────────────────────────


@router.post("/natal", response_model=NatalChartResponse)
@limiter.limit(settings.rate_limit_chart_calc)
async def natal_chart(
    request: Request,
    body: NatalChartRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> NatalChartResponse:
    response = await run_in_threadpool(
        _compute_natal, body, includes_minor_aspects(current_user)
    )

    # Log this calculation for rate limiting
    db.add(ChartLog(user_id=current_user.id, chart_type="natal"))
    await db.commit()

    return response


@router.post("/transit", response_model=TransitResponse)
@limiter.limit(settings.rate_limit_chart_calc)
async def transit_chart(
    request: Request,
    body: TransitRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TransitResponse:
    await _reserve_advanced_chart(current_user, db)

    response = await run_in_threadpool(
        _compute_transit, body, includes_minor_aspects(current_user)
    )

    db.add(ChartLog(user_id=current_user.id, chart_type="transit"))
    await db.commit()

    return response


@router.post("/solar-return", response_model=SolarReturnResponse)
@limiter.limit(settings.rate_limit_chart_calc)
async def solar_return_chart(
    request: Request,
    body: SolarReturnRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SolarReturnResponse:
    await _reserve_advanced_chart(current_user, db)

    response = await run_in_threadpool(
        _compute_solar_return, body, includes_minor_aspects(current_user)
    )

    db.add(ChartLog(user_id=current_user.id, chart_type="solar_return"))
    await db.commit()

    return response


@router.post("/synastry", response_model=SynastryResponse)
@limiter.limit(settings.rate_limit_chart_calc)
async def synastry_chart(
    request: Request,
    body: SynastryRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SynastryResponse:
    await _reserve_advanced_chart(current_user, db)

    response = await run_in_threadpool(
        _compute_synastry, body, includes_minor_aspects(current_user)
    )

    db.add(ChartLog(user_id=current_user.id, chart_type="synastry"))
    await db.commit()

    return response


@router.get("/usage")
async def chart_usage(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Today's advanced-chart usage, for the free-plan indicator in the UI.

    Counts only transits, solar returns and synastry — natal charts are
    unlimited on every plan, so including them would show a number that
    means nothing and a limit that does not exist.
    """
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    result = await db.execute(
        select(func.count())
        .select_from(ChartLog)
        .where(
            ChartLog.user_id == current_user.id,
            ChartLog.created_at >= today_start,
            ChartLog.chart_type.in_(ADVANCED_CHART_TYPES),
        )
    )
    used = result.scalar_one()
    limit = FREE_ADVANCED_DAILY_LIMIT if current_user.plan == "free" else None
    return {"used": used, "limit": limit, "plan": current_user.plan}
