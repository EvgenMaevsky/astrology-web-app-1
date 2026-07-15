"""
Cross-validation of the Skyfield-based engine against Swiss Ephemeris.

pyswisseph is a DEV-ONLY oracle (AGPL — never imported by runtime code).
If it is not installed, these tests are skipped and the regular golden-value
tests in test_ephemeris.py still guard accuracy.
"""
from datetime import datetime, timezone

import pytest

swe = pytest.importorskip("swisseph")

from app.ephemeris.engine import BODY_TARGETS, EphemerisEngine

engine = EphemerisEngine()

# name → swisseph body id
SWE_BODIES = {
    "sun": swe.SUN, "moon": swe.MOON, "mercury": swe.MERCURY,
    "venus": swe.VENUS, "mars": swe.MARS, "jupiter": swe.JUPITER,
    "saturn": swe.SATURN, "uranus": swe.URANUS, "neptune": swe.NEPTUNE,
    "pluto": swe.PLUTO, "true_node": swe.TRUE_NODE, "lilith": swe.MEAN_APOG,
}

CHARTS = [
    # (dt UTC, lat, lon) — spread over dates, hemispheres, latitudes
    (datetime(1967, 2, 20, 19, 20, tzinfo=timezone.utc), 46.9756, -123.8153),
    (datetime(1990, 1, 1, 9, 0, tzinfo=timezone.utc), 50.45, 30.52),
    (datetime(2004, 8, 12, 3, 45, tzinfo=timezone.utc), -33.87, 151.21),
    (datetime(2026, 7, 15, 12, 0, tzinfo=timezone.utc), 0.35, 32.58),
    (datetime(1955, 11, 3, 22, 10, tzinfo=timezone.utc), 59.93, 10.75),
]

PLANET_TOL = 0.003   # deg ≈ 11″ — DE440s vs SE1-compressed DE431 + ΔT model diffs
NODE_TOL = 0.02      # osculating-element conventions differ slightly
CUSP_TOL = 0.01      # houses: RAMC uses real UT1 vs swisseph's UT — sub-arcminute


def _jd(dt: datetime) -> float:
    return swe.julday(dt.year, dt.month, dt.day,
                      dt.hour + dt.minute / 60 + dt.second / 3600)


def _diff(a: float, b: float) -> float:
    return abs((a - b + 180) % 360 - 180)


@pytest.mark.parametrize("dt,lat,lon", CHARTS)
def test_planet_longitudes_match_swisseph(dt, lat, lon):
    chart = engine.calc_natal(dt, lat, lon)
    jd = _jd(dt)
    for name, body in SWE_BODIES.items():
        (swe_lon, *_), _ = swe.calc_ut(jd, body, swe.FLG_SWIEPH | swe.FLG_SPEED)
        tol = NODE_TOL if name in ("true_node", "lilith") else PLANET_TOL
        d = _diff(chart["planets"][name]["longitude"], swe_lon)
        assert d < tol, f"{name}: skyfield={chart['planets'][name]['longitude']} swe={swe_lon} diff={d}"


@pytest.mark.parametrize("dt,lat,lon", CHARTS)
def test_speeds_match_swisseph(dt, lat, lon):
    chart = engine.calc_natal(dt, lat, lon)
    jd = _jd(dt)
    for name, body in SWE_BODIES.items():
        res, _ = swe.calc_ut(jd, body, swe.FLG_SWIEPH | swe.FLG_SPEED)
        swe_speed = res[3]
        my = chart["planets"][name]["speed"]
        # central difference vs instantaneous: generous tolerance, retrograde
        # flags must never disagree away from stations
        assert abs(my - swe_speed) < 0.05, f"{name}: speed {my} vs {swe_speed}"


HOUSE_BYTES = {
    "placidus": b"P", "koch": b"K", "equal": b"E",
    "whole_sign": b"W", "regiomontanus": b"R", "campanus": b"C",
}


@pytest.mark.parametrize("dt,lat,lon", CHARTS)
@pytest.mark.parametrize("system", list(HOUSE_BYTES))
def test_house_cusps_match_swisseph(dt, lat, lon, system):
    if system in ("placidus", "koch") and abs(lat) > 66:
        pytest.skip("undefined above the polar circle")
    chart = engine.calc_natal(dt, lat, lon, house_system=system)
    cusps, ascmc = swe.houses_ex(_jd(dt), lat, lon, HOUSE_BYTES[system])
    for i in range(12):
        d = _diff(chart["houses"][i], cusps[i])
        assert d < CUSP_TOL, f"{system} H{i+1}: skyfield={chart['houses'][i]} swe={cusps[i]} diff={d}"
    assert _diff(chart["angles"]["asc"], ascmc[0]) < CUSP_TOL
    assert _diff(chart["angles"]["mc"], ascmc[1]) < CUSP_TOL


def test_obliquity_matches_swisseph():
    dt = datetime(1995, 6, 20, 8, 30, tzinfo=timezone.utc)
    chart = engine.calc_natal(dt, 48.6, 30.52)
    res, _ = swe.calc_ut(_jd(dt), swe.ECL_NUT)
    assert abs(chart["meta"]["obliquity"] - res[0]) < 1e-4
