from datetime import datetime, timezone

from httpx import AsyncClient
from sqlalchemy import select

from app.ephemeris.engine import MAJOR_ASPECTS, MINOR_ASPECTS
from app.models.chart_quota import ChartQuota
from app.routers.charts import FREE_ADVANCED_DAILY_LIMIT
from app.models.user import User
from tests.conftest import TestSession

TRANSIT_BODY = {
    "natal_dt": "1990-01-01T12:00:00",
    "natal_lat": 50.45,
    "natal_lon": 30.52,
    "transit_dt": "2026-01-01T12:00:00",
    "transit_lat": 50.45,
    "transit_lon": 30.52,
}

NATAL_BODY = {
    "birth_dt": "1990-01-01T12:00:00",
    "timezone": "Europe/Kyiv",
    "lat": 50.45,
    "lon": 30.52,
}

SOLAR_BODY = {
    "birth_dt": "1990-01-01T12:00:00",
    "year": 2026,
    "lat": 50.45,
    "lon": 30.52,
}

SYNASTRY_BODY = {
    "dt1": "1990-01-01T12:00:00", "lat1": 50.45, "lon1": 30.52,
    "dt2": "1992-06-15T08:30:00", "lat2": 40.71, "lon2": -74.01,
}


async def test_free_user_gets_a_daily_allowance_of_advanced_charts(client: AsyncClient):
    # Changed requirement, not a broken test: transits used to be closed to
    # the free plan entirely (403 plan_required). They are now available with
    # a daily allowance, because letting someone reach the wall after seeing
    # the feature converts better than hiding it.
    reg = await client.post(
        "/api/v1/auth/register", json={"email": "free-gate@example.com", "password": "password123"}
    )
    token = reg.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    for _ in range(FREE_ADVANCED_DAILY_LIMIT):
        r = await client.post("/api/v1/charts/transit", json=TRANSIT_BODY, headers=headers)
        assert r.status_code == 200

    r = await client.post("/api/v1/charts/transit", json=TRANSIT_BODY, headers=headers)
    assert r.status_code == 403
    assert r.json()["detail"]["code"] == "plan_limit"


async def test_pro_user_can_use_transit(client: AsyncClient):
    reg = await client.post(
        "/api/v1/auth/register", json={"email": "pro-gate@example.com", "password": "password123"}
    )
    token = reg.json()["access_token"]

    async with TestSession() as session:
        result = await session.execute(select(User).where(User.email == "pro-gate@example.com"))
        user = result.scalar_one()
        user.plan = "pro"
        await session.commit()

    r = await client.post(
        "/api/v1/charts/transit", json=TRANSIT_BODY,
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 200
    assert "natal" in r.json()


async def test_natal_charts_are_unlimited_on_the_free_plan(client: AsyncClient):
    # Used to be capped at 3/day. Natal is the entry point to the whole
    # product, so metering it discouraged exactly the people we want.
    reg = await client.post(
        "/api/v1/auth/register", json={"email": "free-quota@example.com", "password": "password123"}
    )
    headers = {"Authorization": f"Bearer {reg.json()['access_token']}"}

    for _ in range(6):
        r = await client.post("/api/v1/charts/natal", json=NATAL_BODY, headers=headers)
        assert r.status_code == 200

    # Nothing is metered, so no quota row should have appeared either.
    async with TestSession() as session:
        user_result = await session.execute(select(User).where(User.email == "free-quota@example.com"))
        user = user_result.scalar_one()
        quota = await session.get(ChartQuota, (user.id, datetime.now(timezone.utc).date()))
        assert quota is None


async def test_advanced_quota_is_shared_across_the_three_chart_types(client: AsyncClient):
    # The allowance is two per day TOTAL, not two of each: one transit plus
    # one solar return exhausts it, and synastry is then refused.
    reg = await client.post(
        "/api/v1/auth/register", json={"email": "shared-quota@example.com", "password": "password123"}
    )
    headers = {"Authorization": f"Bearer {reg.json()['access_token']}"}

    assert (await client.post("/api/v1/charts/transit", json=TRANSIT_BODY, headers=headers)).status_code == 200
    assert (await client.post("/api/v1/charts/solar-return", json=SOLAR_BODY, headers=headers)).status_code == 200

    r = await client.post("/api/v1/charts/synastry", json=SYNASTRY_BODY, headers=headers)
    assert r.status_code == 403
    assert r.json()["detail"]["code"] == "plan_limit"

    async with TestSession() as session:
        user_result = await session.execute(select(User).where(User.email == "shared-quota@example.com"))
        user = user_result.scalar_one()
        quota = await session.get(ChartQuota, (user.id, datetime.now(timezone.utc).date()))
        assert quota.used == FREE_ADVANCED_DAILY_LIMIT


async def test_pro_plan_has_no_advanced_quota(client: AsyncClient):
    reg = await client.post(
        "/api/v1/auth/register", json={"email": "pro-noquota@example.com", "password": "password123"}
    )
    headers = {"Authorization": f"Bearer {reg.json()['access_token']}"}
    async with TestSession() as session:
        result = await session.execute(select(User).where(User.email == "pro-noquota@example.com"))
        result.scalar_one().plan = "pro"
        await session.commit()

    for _ in range(FREE_ADVANCED_DAILY_LIMIT + 2):
        r = await client.post("/api/v1/charts/transit", json=TRANSIT_BODY, headers=headers)
        assert r.status_code == 200


# ── minor aspects ────────────────────────────────────────────────────────────

async def _token(client: AsyncClient, email: str, plan: str = "free") -> dict:
    reg = await client.post(
        "/api/v1/auth/register", json={"email": email, "password": "password123"}
    )
    if plan != "free":
        async with TestSession() as session:
            result = await session.execute(select(User).where(User.email == email))
            result.scalar_one().plan = plan
            await session.commit()
    return {"Authorization": f"Bearer {reg.json()['access_token']}"}


async def test_free_natal_response_contains_no_minor_aspects(client: AsyncClient):
    # Checked in the RESPONSE BODY, not the UI. Shipping all eleven aspects
    # and hiding six in the frontend would put the paid content one devtools
    # panel away — which is exactly the state this plan was written to fix.
    headers = await _token(client, "minor-free@example.com")
    r = await client.post("/api/v1/charts/natal", json=NATAL_BODY, headers=headers)
    assert r.status_code == 200

    names = {a["aspect"] for a in r.json()["aspects"]}
    assert names, "sanity: the chart should have some aspects at all"
    assert not (names & MINOR_ASPECTS), f"minor aspects leaked to a free user: {names & MINOR_ASPECTS}"
    assert names <= MAJOR_ASPECTS


async def test_pro_natal_response_does_contain_minor_aspects(client: AsyncClient):
    headers = await _token(client, "minor-pro@example.com", plan="pro")
    r = await client.post("/api/v1/charts/natal", json=NATAL_BODY, headers=headers)
    names = {a["aspect"] for a in r.json()["aspects"]}
    assert names & MINOR_ASPECTS, "Pro pays for these and must receive them"


async def test_minor_aspects_are_filtered_in_every_chart_type(client: AsyncClient):
    # Four endpoints and, in synastry, two separate aspect sets plus the
    # inter-chart one. Missing a single spot leaks the paid feature.
    headers = await _token(client, "minor-all@example.com", plan="pro")
    async with TestSession() as session:
        result = await session.execute(select(User).where(User.email == "minor-all@example.com"))
        result.scalar_one().plan = "free"
        await session.commit()

    transit = await client.post("/api/v1/charts/transit", json=TRANSIT_BODY, headers=headers)
    solar = await client.post("/api/v1/charts/solar-return", json=SOLAR_BODY, headers=headers)
    assert transit.status_code == solar.status_code == 200

    t = transit.json()
    assert not ({a["aspect"] for a in t["natal"]["aspects"]} & MINOR_ASPECTS)
    assert not ({a["aspect"] for a in t["aspects"]} & MINOR_ASPECTS)

    s = solar.json()
    assert not ({a["aspect"] for a in s["aspects"]} & MINOR_ASPECTS)


async def test_synastry_filters_both_charts_and_the_inter_aspects(client: AsyncClient):
    headers = await _token(client, "minor-syn@example.com")
    r = await client.post("/api/v1/charts/synastry", json=SYNASTRY_BODY, headers=headers)
    assert r.status_code == 200
    body = r.json()
    for key in ("person1", "person2"):
        assert not ({a["aspect"] for a in body[key]["aspects"]} & MINOR_ASPECTS)
    assert not ({a["aspect"] for a in body["inter_aspects"]} & MINOR_ASPECTS)
