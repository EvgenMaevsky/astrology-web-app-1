"""The unauthenticated natal endpoint (plan E3).

Two properties carry the weight here. The response must contain only what
an anonymous visitor is entitled to — checked in the BODY, because hiding
fields in the UI would leave the paid content one devtools panel away. And
the endpoint must write nothing at all: a date, time and place of birth
from someone who has consented to nothing has no business in our database.
"""
import pytest
from httpx import AsyncClient
from sqlalchemy import func, select

from app.ephemeris.engine import MAJOR_ASPECTS, MINOR_ASPECTS
from app.models.chart_log import ChartLog
from app.models.chart_quota import ChartQuota
from tests.conftest import TestSession

PUBLIC = "/api/v1/charts/natal/public"
BODY = {
    "birth_dt": "1990-01-01T12:00:00",
    "timezone": "Europe/Kyiv",
    "lat": 50.45,
    "lon": 30.52,
}


async def test_works_without_any_token(client: AsyncClient):
    r = await client.post(PUBLIC, json=BODY)
    assert r.status_code == 200
    body = r.json()
    assert body["planets"] and body["houses"] and body["angles"]


# ── what must NOT be in the response ─────────────────────────────────────────

async def test_response_has_no_arabic_parts(client: AsyncClient):
    body = (await client.post(PUBLIC, json=BODY)).json()
    assert "arabic_parts" not in body


async def test_response_has_no_term_rulers(client: AsyncClient):
    # Not merely null — the field must not exist. PublicPlanetPos does not
    # declare it, so terms cannot appear even if something upstream started
    # computing them.
    body = (await client.post(PUBLIC, json=BODY)).json()
    for name, planet in body["planets"].items():
        assert "term_ruler" not in planet, f"{name} carries a term ruler"


async def test_response_has_no_minor_aspects(client: AsyncClient):
    body = (await client.post(PUBLIC, json=BODY)).json()
    names = {a["aspect"] for a in body["aspects"]}
    assert names, "sanity: the chart should have aspects at all"
    assert not (names & MINOR_ASPECTS)
    assert names <= MAJOR_ASPECTS


async def test_house_system_cannot_be_chosen(client: AsyncClient):
    # Choosing a system is something an account buys. An extra field is
    # ignored rather than honoured.
    body = (await client.post(PUBLIC, json={**BODY, "house_system": "koch"})).json()
    assert body["meta"]["house_system"] == "placidus"

    placidus = (await client.post(PUBLIC, json=BODY)).json()
    assert body["houses"] == placidus["houses"]


# ── what must NOT be written ─────────────────────────────────────────────────

async def test_nothing_is_persisted(client: AsyncClient):
    async with TestSession() as session:
        before_logs = (await session.execute(select(func.count()).select_from(ChartLog))).scalar_one()
        before_quotas = (await session.execute(select(func.count()).select_from(ChartQuota))).scalar_one()

    for _ in range(3):
        assert (await client.post(PUBLIC, json=BODY)).status_code == 200

    async with TestSession() as session:
        after_logs = (await session.execute(select(func.count()).select_from(ChartLog))).scalar_one()
        after_quotas = (await session.execute(select(func.count()).select_from(ChartQuota))).scalar_one()

    assert after_logs == before_logs, "an anonymous chart must leave no log row"
    assert after_quotas == before_quotas


async def test_no_daily_cap(client: AsyncClient):
    # Unlimited per day, matching every plan. Only the rate limit applies,
    # and it is disabled in tests.
    for _ in range(8):
        assert (await client.post(PUBLIC, json=BODY)).status_code == 200


# ── validation ───────────────────────────────────────────────────────────────

@pytest.mark.parametrize("payload,reason", [
    ({**BODY, "birth_dt": "1700-01-01T12:00:00"}, "before the ephemeris range"),
    ({**BODY, "birth_dt": "2200-01-01T12:00:00"}, "after the ephemeris range"),
    ({**BODY, "lat": 120.0}, "latitude out of range"),
    ({**BODY, "lon": -400.0}, "longitude out of range"),
    ({"lat": 50.45, "lon": 30.52}, "no birth time at all"),
])
async def test_bad_input_is_rejected_not_crashed(client: AsyncClient, payload, reason):
    r = await client.post(PUBLIC, json=payload)
    assert r.status_code == 422, reason


async def test_unknown_timezone_is_rejected(client: AsyncClient):
    r = await client.post(PUBLIC, json={**BODY, "timezone": "Mars/Olympus_Mons"})
    assert r.status_code == 422


async def test_matches_the_authenticated_chart_for_the_same_input(client: AsyncClient):
    # The anonymous chart must be the same astronomy, just less of it — not
    # a cheaper or different calculation.
    reg = await client.post(
        "/api/v1/auth/register", json={"email": "cmp@example.com", "password": "password123"}
    )
    token = reg.json()["access_token"]

    public = (await client.post(PUBLIC, json=BODY)).json()
    private = (await client.post(
        "/api/v1/charts/natal", json=BODY, headers={"Authorization": f"Bearer {token}"}
    )).json()

    assert public["houses"] == private["houses"]
    assert public["angles"] == private["angles"]
    for name, planet in public["planets"].items():
        assert planet["longitude"] == private["planets"][name]["longitude"]
