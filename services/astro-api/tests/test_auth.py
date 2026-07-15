from httpx import AsyncClient


async def test_health(client: AsyncClient):
    r = await client.get("/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}


async def test_register(client: AsyncClient):
    r = await client.post("/api/v1/auth/register", json={"email": "test@example.com", "password": "password123"})
    assert r.status_code == 201
    data = r.json()
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["token_type"] == "bearer"


async def test_register_duplicate(client: AsyncClient):
    body = {"email": "dup@example.com", "password": "password123"}
    await client.post("/api/v1/auth/register", json=body)
    r = await client.post("/api/v1/auth/register", json=body)
    assert r.status_code == 409


async def test_login(client: AsyncClient):
    await client.post("/api/v1/auth/register", json={"email": "user@example.com", "password": "password123"})
    r = await client.post("/api/v1/auth/login", json={"email": "user@example.com", "password": "password123"})
    assert r.status_code == 200
    assert "access_token" in r.json()


async def test_login_wrong_password(client: AsyncClient):
    await client.post("/api/v1/auth/register", json={"email": "u@example.com", "password": "password123"})
    r = await client.post("/api/v1/auth/login", json={"email": "u@example.com", "password": "wrongpass"})
    assert r.status_code == 401


async def test_me(client: AsyncClient):
    reg = await client.post("/api/v1/auth/register", json={"email": "me@example.com", "password": "password123"})
    token = reg.json()["access_token"]
    r = await client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200
    assert r.json()["email"] == "me@example.com"
    assert r.json()["plan"] == "free"


async def test_refresh(client: AsyncClient):
    reg = await client.post("/api/v1/auth/register", json={"email": "rf@example.com", "password": "password123"})
    refresh_token = reg.json()["refresh_token"]
    r = await client.post("/api/v1/auth/refresh", json={"refresh_token": refresh_token})
    assert r.status_code == 200
    assert "access_token" in r.json()
    assert "refresh_token" in r.json()


async def test_refresh_rotation(client: AsyncClient):
    reg = await client.post("/api/v1/auth/register", json={"email": "rot@example.com", "password": "password123"})
    old_refresh = reg.json()["refresh_token"]

    r1 = await client.post("/api/v1/auth/refresh", json={"refresh_token": old_refresh})
    assert r1.status_code == 200
    new_refresh = r1.json()["refresh_token"]
    assert new_refresh != old_refresh

    # old token is revoked — reusing it must fail
    r2 = await client.post("/api/v1/auth/refresh", json={"refresh_token": old_refresh})
    assert r2.status_code == 401

    # the new token still works
    r3 = await client.post("/api/v1/auth/refresh", json={"refresh_token": new_refresh})
    assert r3.status_code == 200


async def test_logout(client: AsyncClient):
    reg = await client.post("/api/v1/auth/register", json={"email": "lo@example.com", "password": "password123"})
    refresh_token = reg.json()["refresh_token"]
    r = await client.post("/api/v1/auth/logout", json={"refresh_token": refresh_token})
    assert r.status_code == 204
    r2 = await client.post("/api/v1/auth/refresh", json={"refresh_token": refresh_token})
    assert r2.status_code == 401


async def test_settings(client: AsyncClient):
    reg = await client.post("/api/v1/auth/register", json={"email": "s@example.com", "password": "password123"})
    token = reg.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    r = await client.get("/api/v1/settings", headers=headers)
    assert r.status_code == 200
    assert r.json()["house_system"] == "placidus"

    r2 = await client.patch("/api/v1/settings", json={"house_system": "koch"}, headers=headers)
    assert r2.status_code == 200
    assert r2.json()["house_system"] == "koch"
