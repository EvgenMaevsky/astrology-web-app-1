from httpx import AsyncClient
from sqlalchemy import select

from app.models.chart import Chart
from app.models.chart_log import ChartLog
from app.models.person import Person
from app.models.user import User
from tests.conftest import TestSession

SAMPLE_REQUEST = {"birth_dt": "1990-01-01T12:00:00", "timezone": "Europe/Kyiv", "lat": 50.45, "lon": 30.52}
SAMPLE_RESULT = {"planets": {"sun": {"longitude": 280.5}}, "houses": [0.0] * 12}


async def test_delete_account_wrong_password_rejected(client: AsyncClient):
    reg = await client.post(
        "/api/v1/auth/register", json={"email": "del1@example.com", "password": "password123"}
    )
    token = reg.json()["access_token"]

    r = await client.request(
        "DELETE", "/api/v1/users/me",
        json={"password": "wrongpassword"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 403


async def test_delete_account_removes_everything(client: AsyncClient):
    reg = await client.post(
        "/api/v1/auth/register", json={"email": "del2@example.com", "password": "password123"}
    )
    token = reg.json()["access_token"]
    refresh_token = reg.json()["refresh_token"]
    headers = {"Authorization": f"Bearer {token}"}

    await client.post(
        "/api/v1/persons",
        json={
            "name": "Test Person", "birth_dt": "1990-01-01T12:00:00",
            "timezone": "Europe/Kyiv", "lat": 50.45, "lon": 30.52,
        },
        headers=headers,
    )
    await client.post(
        "/api/v1/saved-charts",
        json={
            "chart_type": "natal", "title": "My chart",
            "request_payload": SAMPLE_REQUEST, "result": SAMPLE_RESULT,
        },
        headers=headers,
    )

    async with TestSession() as session:
        user_result = await session.execute(select(User).where(User.email == "del2@example.com"))
        user_id = user_result.scalar_one().id
        session.add(ChartLog(user_id=user_id, chart_type="natal"))
        await session.commit()

    r = await client.request(
        "DELETE", "/api/v1/users/me",
        json={"password": "password123"},
        headers=headers,
    )
    assert r.status_code == 204

    # session is dead
    login = await client.post(
        "/api/v1/auth/login", json={"email": "del2@example.com", "password": "password123"}
    )
    assert login.status_code == 401

    refresh = await client.post("/api/v1/auth/refresh", json={"refresh_token": refresh_token})
    assert refresh.status_code == 401

    # owned rows are gone
    async with TestSession() as session:
        assert (await session.execute(select(User).where(User.id == user_id))).scalar_one_or_none() is None
        assert (await session.execute(select(Person).where(Person.user_id == user_id))).scalar_one_or_none() is None
        assert (await session.execute(select(Chart).where(Chart.user_id == user_id))).scalar_one_or_none() is None
        assert (await session.execute(select(ChartLog).where(ChartLog.user_id == user_id))).scalar_one_or_none() is None
