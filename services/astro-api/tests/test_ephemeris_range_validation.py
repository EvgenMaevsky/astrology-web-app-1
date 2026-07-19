"""
Regression coverage for a bug found during the C3 security review: chart
requests with a date outside the loaded ephemeris kernel's coverage
(de440s.bsp: 1849-12-26 through 2150-01-22) raised an unhandled
Skyfield EphemerisRangeError -> unhandled 500, since nothing validated
the date against the kernel's range before it reached Skyfield. Pydantic
schema validators now reject out-of-range dates with a clean 422.
See docs/plans/2026-07-19-c3-security-review.md for the full writeup.
"""
from httpx import AsyncClient


async def _register(client: AsyncClient, email: str) -> str:
    r = await client.post("/api/v1/auth/register", json={"email": email, "password": "password123"})
    return r.json()["access_token"]


async def test_natal_chart_rejects_out_of_range_birth_year(client: AsyncClient):
    token = await _register(client, "range-natal@example.com")
    r = await client.post(
        "/api/v1/charts/natal",
        json={"birth_dt": "1700-01-01T12:00:00", "lat": 50.45, "lon": 30.52},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 422


async def test_natal_chart_rejects_far_future_birth_year(client: AsyncClient):
    token = await _register(client, "range-natal-future@example.com")
    r = await client.post(
        "/api/v1/charts/natal",
        json={"birth_dt": "2500-01-01T12:00:00", "lat": 50.45, "lon": 30.52},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 422


async def test_natal_chart_accepts_boundary_year(client: AsyncClient):
    token = await _register(client, "range-natal-ok@example.com")
    r = await client.post(
        "/api/v1/charts/natal",
        json={"birth_dt": "1990-01-01T12:00:00", "lat": 50.45, "lon": 30.52},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 200


async def test_solar_return_rejects_out_of_range_year(client: AsyncClient):
    from sqlalchemy import select
    from app.models.user import User
    from tests.conftest import TestSession

    token = await _register(client, "range-sr@example.com")
    async with TestSession() as session:
        result = await session.execute(select(User).where(User.email == "range-sr@example.com"))
        user = result.scalar_one()
        user.plan = "pro"
        await session.commit()

    r = await client.post(
        "/api/v1/charts/solar-return",
        json={
            "birth_dt": "1990-01-01T12:00:00", "year": 999999999,
            "lat": 50.45, "lon": 30.52,
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 422


async def test_synastry_rejects_out_of_range_second_person(client: AsyncClient):
    from sqlalchemy import select
    from app.models.user import User
    from tests.conftest import TestSession

    token = await _register(client, "range-synastry@example.com")
    async with TestSession() as session:
        result = await session.execute(select(User).where(User.email == "range-synastry@example.com"))
        user = result.scalar_one()
        user.plan = "pro"
        await session.commit()

    r = await client.post(
        "/api/v1/charts/synastry",
        json={
            "dt1": "1990-01-01T12:00:00", "lat1": 50.45, "lon1": 30.52,
            "dt2": "1600-01-01T12:00:00", "lat2": 50.45, "lon2": 30.52,
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 422
