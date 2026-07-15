# Zorya

Zorya — web rewrite of the ZET9 Geo astrology desktop app.
Stack: Next.js 16 + FastAPI + SQLite (dev) / PostgreSQL (prod).
Ephemeris: **own license-clean engine** — Skyfield (MIT) + JPL DE440s (public
domain), the same raw data Swiss Ephemeris is built on. Every change is
cross-validated in CI against pyswisseph (dev-only AGPL oracle, never shipped).

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
- Planets are apparent geocentric positions (true equinox of date) straight
  from JPL DE440s; agreement with Swiss Ephemeris is ≤ 0.003° (≈ 11″).
- True lunar node from the osculating geocentric orbit; Lilith (mean apogee)
  via Meeus elements projected onto the ecliptic — both match Swiss Ephemeris.
- Chiron is optional: `python scripts/fetch_chiron_spk.py` downloads a free
  SPK from JPL Horizons, then set `CHIRON_SPK` in `.env`.
- House systems: Placidus, Koch, Equal, Whole Sign, Regiomontanus, Campanus —
  all cross-validated against Swiss Ephemeris to < 0.01°.
- Test suite: golden planet longitudes (astro.com), the Placidus semi-arc
  invariant, solar-return convergence, and a full cross-validation run against
  pyswisseph (skipped automatically if it isn't installed).

## Roadmap

Подальший план розвитку та виходу в продакшен: [ROADMAP.md](ROADMAP.md)

## Phases
- [x] **Phase 1** — JWT Auth: register/login/refresh/logout, dashboard shell
- [x] **Phase 2** — Ephemeris engine (Swiss Ephemeris natal charts)
- [x] **Phase 3** — SVG chart wheel
- [x] **Phase 4** — Atlas (GeoNames cities + timezone + Leaflet map)
- [x] **Phase 5** — Arabic parts + terms/bounds
- [~] **Phase 6** — Monetization (Stripe + LiqPay) — wired, needs webhook fixes before launch
- [x] **Phase 7** — Transits, solar returns, synastry
