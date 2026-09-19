"""Atlas city search — SQLite FTS5 branch.

Regression coverage for a bug found during the C3 security review: the FTS5
query built from user input mixed an unquoted clause with a quoted one.
Unquoted text is parsed as FTS5 *syntax* (colons are column filters, parens
group, hyphens are NOT-prefixes, apostrophes are string delimiters), so any
special character in it threw a 500 — not just adversarial input, but real
city names like "N'Djamena" or "Wilkes-Barre" too. See
docs/plans/2026-07-19-c3-security-review.md for the full writeup.
"""
import pytest
from httpx import AsyncClient
from sqlalchemy import text

from tests.conftest import test_engine


async def _seed_cities(rows: list[dict]) -> None:
    async with test_engine.begin() as conn:
        await conn.execute(
            text(
                "INSERT INTO cities "
                "(id, name, ascii_name, country, region, lat, lon, timezone, population, alt_names) "
                "VALUES (:id, :name, :ascii_name, :country, :region, :lat, :lon, :timezone, :population, :alt_names)"
            ),
            rows,
        )
        await conn.execute(text("DROP TABLE IF EXISTS cities_fts"))
        await conn.execute(text("""
            CREATE VIRTUAL TABLE cities_fts USING fts5(
                city_id UNINDEXED, name, ascii_name, alt_names
            )
        """))
        await conn.execute(
            text(
                "INSERT INTO cities_fts(city_id, name, ascii_name, alt_names) "
                "VALUES (:id, :name, :ascii_name, :alt_names)"
            ),
            [{"id": r["id"], "name": r["name"], "ascii_name": r["ascii_name"],
              "alt_names": r["alt_names"] or ""} for r in rows],
        )


CITIES = [
    {"id": 1, "name": "Kyiv", "ascii_name": "Kyiv", "country": "UA", "region": "",
     "lat": 50.45, "lon": 30.52, "timezone": "Europe/Kyiv", "population": 2884000,
     "alt_names": "Kiev,Kiew,Київ,Киев"},
    {"id": 2, "name": "N'Djamena", "ascii_name": "N'Djamena", "country": "TD", "region": "",
     "lat": 12.11, "lon": 15.05, "timezone": "Africa/Ndjamena", "population": 1000000,
     "alt_names": "Ndjamena,Нджамена"},
    {"id": 3, "name": "Wilkes-Barre", "ascii_name": "Wilkes-Barre", "country": "US", "region": "PA",
     "lat": 41.25, "lon": -75.88, "timezone": "America/New_York", "population": 40000, "alt_names": None},
    {"id": 4, "name": "New York", "ascii_name": "New York", "country": "US", "region": "NY",
     "lat": 40.71, "lon": -74.01, "timezone": "America/New_York", "population": 8400000,
     "alt_names": "New York City,Нью-Йорк"},
]


@pytest.fixture(autouse=True)
async def seeded(setup_db):
    await _seed_cities(CITIES)


@pytest.mark.parametrize("q,expected_name", [
    ("N'Djamena", "N'Djamena"),
    ("Wilkes-Barre", "Wilkes-Barre"),
    ("Wilkes", "Wilkes-Barre"),
    ("Kyiv", "Kyiv"),
])
async def test_search_finds_names_with_special_characters(client: AsyncClient, q: str, expected_name: str):
    r = await client.get("/api/v1/atlas/search", params={"q": q})
    assert r.status_code == 200
    names = [c["name"] for c in r.json()]
    assert expected_name in names


async def test_search_reordered_tokens_still_matches(client: AsyncClient):
    r = await client.get("/api/v1/atlas/search", params={"q": "York New"})
    assert r.status_code == 200
    names = [c["name"] for c in r.json()]
    assert "New York" in names


@pytest.mark.parametrize("q", [
    "a) OR (b", "a:b", "col:", "((", "))", "a-b", "x OR", "OR OR",
    "NEAR", "a AND b",
])
async def test_search_adversarial_fts5_syntax_does_not_500(client: AsyncClient, q: str):
    r = await client.get("/api/v1/atlas/search", params={"q": q})
    assert r.status_code == 200


async def test_search_whitespace_only_query_returns_empty(client: AsyncClient):
    r = await client.get("/api/v1/atlas/search", params={"q": "  "})
    assert r.status_code == 200
    assert r.json() == []


@pytest.mark.parametrize("q,expected_name", [
    ("Київ", "Kyiv"),
    ("Киев", "Kyiv"),
    ("Нью-Йорк", "New York"),
])
async def test_search_finds_cities_by_local_script_name(
    client: AsyncClient, q: str, expected_name: str
):
    # Regression: name/ascii_name from GeoNames are Latin only, so a
    # Ukrainian user typing "Київ" used to get nothing — even though the UI
    # placeholder suggests exactly that. The local spellings live in
    # GeoNames' alternatenames column, now imported into cities.alt_names
    # and indexed.
    r = await client.get("/api/v1/atlas/search", params={"q": q})
    assert r.status_code == 200
    assert expected_name in [c["name"] for c in r.json()]
