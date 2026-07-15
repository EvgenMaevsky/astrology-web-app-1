from httpx import AsyncClient
from sqlalchemy import select

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


async def test_free_user_blocked_from_transit(client: AsyncClient):
    reg = await client.post(
        "/api/v1/auth/register", json={"email": "free-gate@example.com", "password": "password123"}
    )
    token = reg.json()["access_token"]

    r = await client.post(
        "/api/v1/charts/transit", json=TRANSIT_BODY,
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 403
    assert r.json()["detail"]["code"] == "plan_required"


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
