# Zorya

Zorya — web rewrite of the ZET9 Geo astrology desktop app.
Stack: Next.js 16 + FastAPI + SQLite (dev) / PostgreSQL (prod).
Ephemeris: **Swiss Ephemeris** (pyswisseph) — the same engine as ZET9 / astro.com.

## Quick start

### Backend (terminal 1)
```bash
cd services/astro-api
uv venv --python 3.12 .venv          # or: python3.12 -m venv .venv
uv pip install --python .venv/bin/python -e ".[dev]"
.venv/bin/python -m alembic upgrade head          # create DB schema
.venv/bin/python ../../scripts/import_geonames.py # one-time: city atlas (~5 MB download)
.venv/bin/python -m uvicorn app.main:app --reload --port 8000
```

### Frontend (terminal 2)
```bash
cd apps/frontend
npm install
npm run dev
```

Open http://localhost:3000 — redirects to /login.

### Tests
```bash
cd services/astro-api && .venv/bin/python -m pytest
```

## Accuracy notes

- Birth time is entered as **local wall time** + IANA timezone; the backend
  converts to UT using the historical tz database (incl. pre-1990 Soviet offsets).
- Planets are apparent geocentric positions (true equinox of date).
- Without SE1 data files pyswisseph uses the built-in Moshier ephemeris
  (~0.1″ planets; Chiron unavailable). Point `EPHE_PATH` at a directory with
  SE1 files (e.g. from ZET9 `Swiss/`) for full precision + Chiron.
- House systems: Placidus, Koch, Equal, Whole Sign, Regiomontanus, Campanus.
- Regression tests pin planet longitudes to astro.com references and verify
  the Placidus semi-arc condition and solar-return convergence.

## Phases
- [x] **Phase 1** — JWT Auth: register/login/refresh/logout, dashboard shell
- [x] **Phase 2** — Ephemeris engine (Swiss Ephemeris natal charts)
- [x] **Phase 3** — SVG chart wheel
- [x] **Phase 4** — Atlas (GeoNames cities + timezone + Leaflet map)
- [x] **Phase 5** — Arabic parts + terms/bounds
- [~] **Phase 6** — Monetization (Stripe + LiqPay) — wired, needs webhook fixes before launch
- [x] **Phase 7** — Transits, solar returns, synastry
