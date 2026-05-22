"""
Download cities15000.txt from GeoNames and import into SQLite with FTS5.
Run once: python scripts/import_geonames.py
"""

import io
import sqlite3
import sys
import urllib.request
import zipfile
from pathlib import Path

DB_PATH = Path(__file__).parent.parent / "services" / "astro-api" / "astro.db"
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


def import_db(rows):
    con = sqlite3.connect(DB_PATH)
    cur = con.cursor()

    cur.executescript("""
        DROP TABLE IF EXISTS cities_fts;
        DROP TABLE IF EXISTS cities;

        CREATE TABLE cities (
            id          INTEGER PRIMARY KEY,
            name        TEXT NOT NULL,
            ascii_name  TEXT NOT NULL,
            country     TEXT NOT NULL,
            region      TEXT,
            lat         REAL NOT NULL,
            lon         REAL NOT NULL,
            timezone    TEXT NOT NULL,
            population  INTEGER DEFAULT 0
        );

        CREATE INDEX idx_cities_country ON cities(country);
        CREATE INDEX idx_cities_ascii   ON cities(ascii_name COLLATE NOCASE);

        CREATE VIRTUAL TABLE cities_fts USING fts5(
            city_id UNINDEXED,
            name,
            ascii_name
        );
    """)

    cur.executemany(
        "INSERT INTO cities VALUES (?,?,?,?,?,?,?,?,?)",
        [r[:9] for r in rows],
    )

    cur.executemany(
        "INSERT INTO cities_fts(city_id, name, ascii_name) VALUES (?,?,?)",
        [(r[0], r[1], r[2]) for r in rows],
    )

    con.commit()
    con.close()
    print(f"Imported {len(rows):,} cities into {DB_PATH}")


if __name__ == "__main__":
    raw = download()
    rows = parse(raw)
    print(f"Parsed {len(rows):,} cities")
    import_db(rows)
    print("Done.")
