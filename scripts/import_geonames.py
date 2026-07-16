"""
Download cities15000.txt from GeoNames and import into the app database
(SQLite dev or PostgreSQL prod, via SQLAlchemy).

Run from services/astro-api (so the relative sqlite DATABASE_URL resolves
correctly), or export DATABASE_URL explicitly (e.g. for Postgres):

    cd services/astro-api && ../../scripts/import_geonames.py
    # or
    DATABASE_URL=postgresql+asyncpg://... python scripts/import_geonames.py

Requires the `cities` table to already exist — run `alembic upgrade head`
first (this script does not create schema).
"""

import asyncio
import io
import sys
import urllib.request
import zipfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / "services" / "astro-api"))

from sqlalchemy import inspect, text  # noqa: E402

from app.config import settings  # noqa: E402
from app.database import engine  # noqa: E402
from app.models.city import City  # noqa: E402

URL = "https://download.geonames.org/export/dump/cities15000.zip"

COLS = {
    0: "geonameid",  1: "name",      2: "ascii_name",
    4: "lat",        5: "lon",       8: "country",
    10: "region",    14: "population", 17: "timezone",
}


def download() -> bytes:
    print("Downloading cities15000.zip (~5 MB)…", flush=True)
    with urllib.request.urlopen(URL, timeout=120) as r:
        total = int(r.headers.get("Content-Length", 0))
        data = bytearray()
        chunk = 65536
        while True:
            block = r.read(chunk)
            if not block:
                break
            data.extend(block)
            if total:
                pct = len(data) * 100 // total
                print(f"\r  {pct}% ({len(data)//1024} KB)", end="", flush=True)
    print()
    return bytes(data)


def parse(raw: bytes):
    with zipfile.ZipFile(io.BytesIO(raw)) as zf:
        name = next(n for n in zf.namelist() if n.endswith(".txt"))
        text = zf.read(name).decode("utf-8")

    rows = []
    for line in text.splitlines():
        fields = line.split("\t")
        if len(fields) < 18:
            continue
        try:
            lat = float(fields[4])
            lon = float(fields[5])
            pop = int(fields[14]) if fields[14] else 0
        except ValueError:
            continue

        rows.append((
            int(fields[0]),          # id
            fields[1],               # name
            fields[2],               # ascii_name
            fields[8][:2].upper(),   # country (ISO 3166-1 alpha-2)
            fields[10],              # region / admin1_code
            lat, lon,
            fields[17],              # timezone (IANA)
            pop,
            f"{fields[2]} {fields[8]}".lower(),  # search_text
        ))
    return rows


async def import_db(rows):
    dialect = engine.dialect.name

    async with engine.begin() as conn:
        has_table = await conn.run_sync(lambda c: inspect(c).has_table("cities"))
        if not has_table:
            print("Table 'cities' does not exist. run alembic upgrade head first")
            sys.exit(1)

        await conn.execute(text("DELETE FROM cities"))

        row_dicts = [
            {
                "id": r[0],
                "name": r[1],
                "ascii_name": r[2],
                "country": r[3],
                "region": r[4],
                "lat": r[5],
                "lon": r[6],
                "timezone": r[7],
                "population": r[8],
            }
            for r in rows
        ]
        for i in range(0, len(row_dicts), 5000):
            await conn.execute(City.__table__.insert(), row_dicts[i:i + 5000])

        if dialect == "sqlite":
            await conn.execute(text("DROP TABLE IF EXISTS cities_fts"))
            await conn.execute(text("""
                CREATE VIRTUAL TABLE cities_fts USING fts5(
                    city_id UNINDEXED,
                    name,
                    ascii_name
                )
            """))
            fts_rows = [
                {"city_id": r[0], "name": r[1], "ascii_name": r[2]}
                for r in rows
            ]
            for i in range(0, len(fts_rows), 5000):
                await conn.execute(
                    text(
                        "INSERT INTO cities_fts(city_id, name, ascii_name) "
                        "VALUES (:city_id, :name, :ascii_name)"
                    ),
                    fts_rows[i:i + 5000],
                )

    print(f"Imported {len(rows):,} cities into {settings.database_url}")


async def main():
    raw = download()
    rows = parse(raw)
    print(f"Parsed {len(rows):,} cities")
    await import_db(rows)
    print("Done.")


if __name__ == "__main__":
    asyncio.run(main())
