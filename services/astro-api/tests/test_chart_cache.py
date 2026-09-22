"""Ephemeris result cache (plan E5, part 2).

The tests that matter here are the mutation ones. A cache that hands out its
stored object instead of a copy does not crash — it quietly returns charts
carrying data from an earlier request, which is the kind of bug that reaches
users and is very hard to trace back. See app/ephemeris/cache.py.
"""
import pytest
from httpx import AsyncClient
from sqlalchemy import select

from app.ephemeris.cache import ResultCache
from app.models.user import User
from app.routers import charts as charts_router
from tests.conftest import TestSession

NATAL = {
    "birth_dt": "1990-01-01T12:00:00",
    "timezone": "Europe/Kyiv",
    "lat": 50.45,
    "lon": 30.52,
}


# ── the cache object itself ──────────────────────────────────────────────────

def test_mutating_a_returned_value_does_not_corrupt_the_cache():
    cache = ResultCache(maxsize=4)
    cache.put("k", {"planets": {"sun": {"longitude": 1.0}}})

    first = cache.get("k")
    # Exactly what add_terms_to_planets() does to a real result.
    first["planets"]["sun"]["term_ruler"] = "mars"
    first["planets"]["sun"]["longitude"] = 999.0

    second = cache.get("k")
    assert "term_ruler" not in second["planets"]["sun"]
    assert second["planets"]["sun"]["longitude"] == 1.0


def test_mutating_the_value_after_put_does_not_corrupt_the_cache():
    # The caller keeps using the object it handed us — put() must copy too.
    cache = ResultCache(maxsize=4)
    original = {"planets": {"sun": {"longitude": 1.0}}}
    cache.put("k", original)
    original["planets"]["sun"]["longitude"] = 999.0

    assert cache.get("k")["planets"]["sun"]["longitude"] == 1.0


def test_evicts_least_recently_used_beyond_maxsize():
    cache = ResultCache(maxsize=2)
    cache.put("a", 1)
    cache.put("b", 2)
    cache.get("a")          # "a" is now the most recently used
    cache.put("c", 3)       # evicts "b"

    assert cache.get("a") == 1
    assert cache.get("b") is None
    assert cache.get("c") == 3
    assert len(cache) == 2


def test_counts_hits_and_misses():
    cache = ResultCache(maxsize=4)
    cache.get("absent")
    cache.put("k", 1)
    cache.get("k")
    assert (cache.hits, cache.misses) == (1, 1)


# ── through the endpoint ─────────────────────────────────────────────────────

@pytest.fixture
def fresh_cache():
    cache = charts_router._natal_cache
    if cache is not None:
        cache.clear()
    return cache


async def _pro_token(client: AsyncClient, email: str) -> str:
    reg = await client.post(
        "/api/v1/auth/register", json={"email": email, "password": "password123"}
    )
    async with TestSession() as session:
        result = await session.execute(select(User).where(User.email == email))
        result.scalar_one().plan = "pro"
        await session.commit()
    return reg.json()["access_token"]


async def test_repeated_request_is_served_from_cache_and_is_identical(
    client: AsyncClient, fresh_cache
):
    if fresh_cache is None:
        pytest.skip("cache disabled")
    token = await _pro_token(client, "cache1@example.com")
    auth = {"Authorization": f"Bearer {token}"}

    first = await client.post("/api/v1/charts/natal", json=NATAL, headers=auth)
    second = await client.post("/api/v1/charts/natal", json=NATAL, headers=auth)

    assert first.status_code == second.status_code == 200
    # Byte-identical: a cache hit must not produce a subtly different chart,
    # and in particular must not have terms applied twice or missing.
    assert first.json() == second.json()
    assert fresh_cache.hits >= 1


async def test_different_inputs_do_not_share_an_entry(client: AsyncClient, fresh_cache):
    if fresh_cache is None:
        pytest.skip("cache disabled")
    token = await _pro_token(client, "cache2@example.com")
    auth = {"Authorization": f"Bearer {token}"}

    kyiv = await client.post("/api/v1/charts/natal", json=NATAL, headers=auth)
    other = await client.post(
        "/api/v1/charts/natal", json={**NATAL, "lat": 40.71, "lon": -74.01}, headers=auth
    )
    assert kyiv.json()["houses"] != other.json()["houses"]

    later = await client.post(
        "/api/v1/charts/natal", json={**NATAL, "birth_dt": "1990-01-02T12:00:00"},
        headers=auth,
    )
    assert later.json()["planets"]["sun"]["longitude"] != kyiv.json()["planets"]["sun"]["longitude"]


async def test_house_system_is_part_of_the_key(client: AsyncClient, fresh_cache):
    if fresh_cache is None:
        pytest.skip("cache disabled")
    token = await _pro_token(client, "cache3@example.com")
    auth = {"Authorization": f"Bearer {token}"}

    placidus = await client.post(
        "/api/v1/charts/natal", json={**NATAL, "house_system": "placidus"}, headers=auth
    )
    koch = await client.post(
        "/api/v1/charts/natal", json={**NATAL, "house_system": "koch"}, headers=auth
    )
    assert placidus.json()["houses"] != koch.json()["houses"]


async def test_bodies_order_does_not_create_a_second_entry(
    client: AsyncClient, fresh_cache
):
    if fresh_cache is None:
        pytest.skip("cache disabled")
    token = await _pro_token(client, "cache4@example.com")
    auth = {"Authorization": f"Bearer {token}"}

    await client.post(
        "/api/v1/charts/natal", json={**NATAL, "bodies": ["sun", "moon"]}, headers=auth
    )
    before = len(fresh_cache)
    await client.post(
        "/api/v1/charts/natal", json={**NATAL, "bodies": ["moon", "sun"]}, headers=auth
    )
    assert len(fresh_cache) == before, "same request in a different order must hit"
