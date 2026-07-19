from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.city import City
from app.schemas.atlas import CityOut, TimezoneOut

router = APIRouter(prefix="/api/v1/atlas", tags=["atlas"])

_SEARCH_SQL = text("""
    SELECT c.id, c.name, c.ascii_name, c.country, c.region,
           c.lat, c.lon, c.timezone, c.population
    FROM cities c
    WHERE c.id IN (
        SELECT city_id FROM cities_fts WHERE cities_fts MATCH :q
    )
    ORDER BY c.population DESC
    LIMIT :limit
""")

_SEARCH_SQL_PG = text("""
    SELECT c.id, c.name, c.ascii_name, c.country, c.region,
           c.lat, c.lon, c.timezone, c.population
    FROM cities c
    WHERE c.name ILIKE :prefix OR c.ascii_name ILIKE :prefix
       OR similarity(c.ascii_name, :q) > 0.35
    ORDER BY (c.ascii_name ILIKE :prefix) DESC, c.population DESC
    LIMIT :limit
""")

_TZ_SQL = text("""
    SELECT timezone
    FROM cities
    WHERE lat BETWEEN :lat_lo AND :lat_hi
      AND lon BETWEEN :lon_lo AND :lon_hi
    ORDER BY (lat - :lat) * (lat - :lat) + (lon - :lon) * (lon - :lon)
    LIMIT 1
""")


def _fts5_quote(token: str) -> str:
    """Wrap a token as a literal FTS5 phrase, doubling embedded quotes.

    FTS5's query grammar treats unquoted text as syntax (colons are column
    filters, parens group, hyphens are NOT-prefixes, apostrophes are string
    delimiters, ...), so any unquoted user input can throw a syntax error —
    this broke real city names like "N'Djamena" or "Wilkes-Barre" with a 500,
    not just adversarial input. Quoting makes the content fully literal.
    """
    return '"' + token.replace('"', '""') + '"'


@router.get("/search", response_model=list[CityOut])
async def search_cities(
    q: str = Query(min_length=2, max_length=100),
    limit: int = Query(10, ge=1, le=50),
    country: str | None = Query(None, min_length=2, max_length=2),
    db: AsyncSession = Depends(get_db),
):
    q_clean = q.strip()
    if not q_clean:
        # min_length=2 counts whitespace, so "  " passes validation but has
        # nothing left to search for.
        return []

    dialect = db.get_bind().dialect.name
    if dialect == "postgresql":
        rows = await db.execute(
            _SEARCH_SQL_PG,
            {"prefix": q_clean + "%", "q": q_clean, "limit": limit * 3},
        )
    else:
        # Phrase-prefix match (adjacent, in order) OR'd with an AND of each
        # token individually prefix-matched (any order/position) — the
        # latter is what finds e.g. "Sącz Nowy" for "Nowy Sącz". Every token
        # is FTS5-quoted so special characters can never be parsed as query
        # syntax.
        tokens = q_clean.split()
        and_of_prefixes = " ".join(f"{_fts5_quote(t)}*" for t in tokens)
        fts_query = f"{_fts5_quote(q_clean)}* OR {and_of_prefixes}"
        rows = await db.execute(_SEARCH_SQL, {"q": fts_query, "limit": limit * 3})
    cities = rows.fetchall()

    if country:
        cc = country.upper()
        cities = [r for r in cities if r.country == cc]

    result = []
    seen = set()
    for r in cities:
        key = (r.ascii_name.lower(), r.country)
        if key not in seen:
            seen.add(key)
            result.append(CityOut(
                id=r.id,
                name=r.name,
                ascii_name=r.ascii_name,
                country=r.country,
                region=r.region or "",
                lat=r.lat,
                lon=r.lon,
                timezone=r.timezone,
                population=r.population,
            ))
        if len(result) >= limit:
            break

    return result


@router.get("/timezone", response_model=TimezoneOut)
async def get_timezone(
    lat: float = Query(ge=-90, le=90),
    lon: float = Query(ge=-180, le=180),
    db: AsyncSession = Depends(get_db),
):
    # Search in ±5° box, fall back to ±15° if nothing found
    for radius in (5.0, 15.0, 90.0):
        row = await db.execute(_TZ_SQL, {
            "lat": lat, "lon": lon,
            "lat_lo": lat - radius, "lat_hi": lat + radius,
            "lon_lo": lon - radius, "lon_hi": lon + radius,
        })
        result = row.fetchone()
        if result:
            return TimezoneOut(timezone=result[0], lat=lat, lon=lon)

    raise HTTPException(status_code=404, detail="No timezone found for these coordinates")


@router.get("/cities/{city_id}", response_model=CityOut)
async def get_city(city_id: int, db: AsyncSession = Depends(get_db)):
    row = await db.execute(select(City).where(City.id == city_id))
    city = row.scalar_one_or_none()
    if not city:
        raise HTTPException(status_code=404, detail="City not found")
    return CityOut(
        id=city.id,
        name=city.name,
        ascii_name=city.ascii_name,
        country=city.country,
        region=city.region or "",
        lat=city.lat,
        lon=city.lon,
        timezone=city.timezone,
        population=city.population,
    )
