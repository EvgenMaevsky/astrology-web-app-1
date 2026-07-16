from httpx import AsyncClient

from app.config import settings

SAMPLE_REQUEST = {"birth_dt": "1990-01-01T12:00:00", "timezone": "Europe/Kyiv", "lat": 50.45, "lon": 30.52}
SAMPLE_RESULT = {"planets": {"sun": {"longitude": 280.5, "sign": "Capricorn"}}, "houses": [0.0] * 12}


async def _register(client: AsyncClient, email: str) -> str:
    r = await client.post("/api/v1/auth/register", json={"email": email, "password": "password123"})
    return r.json()["access_token"]


async def test_save_list_get_delete_chart(client: AsyncClient):
    token = await _register(client, "saved1@example.com")
    headers = {"Authorization": f"Bearer {token}"}

    r = await client.post(
        "/api/v1/saved-charts",
        json={
            "chart_type": "natal", "title": "My natal chart",
            "request_payload": SAMPLE_REQUEST, "result": SAMPLE_RESULT,
        },
        headers=headers,
    )
    assert r.status_code == 201
    chart_id = r.json()["id"]
    assert "result" not in r.json()

    r_list = await client.get("/api/v1/saved-charts", headers=headers)
    assert r_list.status_code == 200
    items = r_list.json()
    assert len(items) == 1
    assert items[0]["id"] == chart_id
    assert "result" not in items[0]
    assert "request_payload" not in items[0]

    r_get = await client.get(f"/api/v1/saved-charts/{chart_id}", headers=headers)
    assert r_get.status_code == 200
    full = r_get.json()
    assert full["result"] == SAMPLE_RESULT
    assert full["request_payload"] == SAMPLE_REQUEST

    r_del = await client.delete(f"/api/v1/saved-charts/{chart_id}", headers=headers)
    assert r_del.status_code == 204

    r_get2 = await client.get(f"/api/v1/saved-charts/{chart_id}", headers=headers)
    assert r_get2.status_code == 404


async def test_cannot_see_other_users_chart(client: AsyncClient):
    token1 = await _register(client, "owner@example.com")
    token2 = await _register(client, "intruder@example.com")

    r = await client.post(
        "/api/v1/saved-charts",
        json={
            "chart_type": "natal", "title": "Private",
            "request_payload": SAMPLE_REQUEST, "result": SAMPLE_RESULT,
        },
        headers={"Authorization": f"Bearer {token1}"},
    )
    chart_id = r.json()["id"]

    r2 = await client.get(
        f"/api/v1/saved-charts/{chart_id}", headers={"Authorization": f"Bearer {token2}"}
    )
    assert r2.status_code == 404


async def test_saved_charts_limit(client: AsyncClient, monkeypatch):
    monkeypatch.setattr(settings, "max_saved_charts", 2)
    token = await _register(client, "limited@example.com")
    headers = {"Authorization": f"Bearer {token}"}

    for i in range(2):
        r = await client.post(
            "/api/v1/saved-charts",
            json={
                "chart_type": "natal", "title": f"Chart {i}",
                "request_payload": SAMPLE_REQUEST, "result": SAMPLE_RESULT,
            },
            headers=headers,
        )
        assert r.status_code == 201

    r3 = await client.post(
        "/api/v1/saved-charts",
        json={
            "chart_type": "natal", "title": "Chart 3",
            "request_payload": SAMPLE_REQUEST, "result": SAMPLE_RESULT,
        },
        headers=headers,
    )
    assert r3.status_code == 400
    assert r3.json()["detail"]["code"] == "saved_charts_limit"


async def test_save_solar_return_chart(client: AsyncClient):
    token = await _register(client, "solarreturn@example.com")
    headers = {"Authorization": f"Bearer {token}"}

    r = await client.post(
        "/api/v1/saved-charts",
        json={
            "chart_type": "solar_return", "title": "2026 Solar Return",
            "request_payload": {**SAMPLE_REQUEST, "year": 2026}, "result": SAMPLE_RESULT,
        },
        headers=headers,
    )
    assert r.status_code == 201
    assert r.json()["chart_type"] == "solar_return"
