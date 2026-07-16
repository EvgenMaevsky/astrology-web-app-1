"""
Postgres integration tests — run only when TEST_DATABASE_URL is set (CI's
backend-postgres job). Verifies dual-database support: migrations apply
cleanly on PostgreSQL, the dialect-specific atlas search branch works, and
auth (naive/aware datetime handling) round-trips correctly.

conftest.py installs a module-level `app.dependency_overrides[get_db]`
pointing at an in-memory SQLite session for the rest of the suite. This
module MUST NOT leave that override permanently replaced — the per-test
fixture below swaps it for a Postgres session and restores the previous
override on teardown.
"""
import os
import subprocess
import sys

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.database import get_db
from app.main import app

pytestmark = pytest.mark.skipif(
    not os.environ.get("TEST_DATABASE_URL"), reason="no postgres"
)

TEST_DATABASE_URL = os.environ.get("TEST_DATABASE_URL", "")


@pytest.fixture(scope="module", autouse=True)
def _apply_migrations():
    """Apply alembic migrations against TEST_DATABASE_URL once for this module."""
    result = subprocess.run(
        [sys.executable, "-m", "alembic", "upgrade", "head"],
        env={**os.environ, "DATABASE_URL": TEST_DATABASE_URL},
        capture_output=True,
        text=True,
    )
    assert result.returncode == 0, result.stdout + result.stderr


@pytest.fixture(autouse=True)
async def pg_db():
    """Swap the get_db override for a Postgres session, then restore it."""
    pg_engine = create_async_engine(TEST_DATABASE_URL)
    PgSession = async_sessionmaker(pg_engine, expire_on_commit=False)

    async def override_pg_db() -> AsyncSession:
        async with PgSession() as session:
            yield session

    previous_override = app.dependency_overrides.get(get_db)
    app.dependency_overrides[get_db] = override_pg_db

    yield pg_engine

    if previous_override is not None:
        app.dependency_overrides[get_db] = previous_override
    else:
        app.dependency_overrides.pop(get_db, None)
    await pg_engine.dispose()


@pytest.fixture
async def pg_client():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c


async def test_atlas_search_pg(pg_db, pg_client):
    pg_engine = pg_db
    async with pg_engine.begin() as conn:
        await conn.execute(text("DELETE FROM cities"))
        await conn.execute(
            text(
                "INSERT INTO cities "
                "(id, name, ascii_name, country, region, lat, lon, timezone, population) "
                "VALUES (:id, :name, :ascii_name, :country, :region, :lat, :lon, :timezone, :population)"
            ),
            [
                {
                    "id": 1, "name": "Kyiv", "ascii_name": "Kyiv", "country": "UA",
                    "region": "", "lat": 50.45, "lon": 30.52, "timezone": "Europe/Kyiv",
                    "population": 2900000,
                },
                {
                    "id": 2, "name": "Kyustendil", "ascii_name": "Kyustendil", "country": "BG",
                    "region": "", "lat": 42.28, "lon": 22.69, "timezone": "Europe/Sofia",
                    "population": 43000,
                },
                {
                    "id": 3, "name": "London", "ascii_name": "London", "country": "GB",
                    "region": "", "lat": 51.5, "lon": -0.12, "timezone": "Europe/London",
                    "population": 8900000,
                },
            ],
        )

    r = await pg_client.get("/api/v1/atlas/search", params={"q": "Kyi"})
    assert r.status_code == 200
    data = r.json()
    assert data[0]["name"] == "Kyiv"


async def test_auth_roundtrip_pg(pg_db, pg_client):
    r1 = await pg_client.post(
        "/api/v1/auth/register",
        json={"email": "pg-roundtrip@example.com", "password": "password123"},
    )
    assert r1.status_code == 201

    r2 = await pg_client.post(
        "/api/v1/auth/login",
        json={"email": "pg-roundtrip@example.com", "password": "password123"},
    )
    assert r2.status_code == 200
    token = r2.json()["access_token"]

    r3 = await pg_client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert r3.status_code == 200
