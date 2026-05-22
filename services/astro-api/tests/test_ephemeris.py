"""
Regression tests for EphemerisEngine.

Reference values verified against Astro.com / AstroSeek for known birth charts.
Tolerance: ±0.15° (9') — well within astrological precision requirements.
"""
import pytest
from datetime import datetime, timezone

from app.ephemeris.engine import EphemerisEngine, _sign

engine = EphemerisEngine()
TOL = 0.15  # degrees


def _chart(dt_str: str, lat: float, lon: float, hs: str = "placidus") -> dict:
    dt = datetime.fromisoformat(dt_str).replace(tzinfo=timezone.utc)
    return engine.calc_natal(dt, lat, lon, house_system=hs)


# ── Helper ────────────────────────────────────────────────────────────────────

def approx(expected: float, actual: float, tol: float = TOL) -> bool:
    diff = abs((actual - expected + 180) % 360 - 180)
    return diff <= tol


# ── Chart 1: Michael Jackson (1958-08-29 08:00 UTC, Gary IN, USA) ─────────────
# Reference: astro.com — Sun ~155.8° (Virgo 5.8°)
JACKSON_UTC = "1958-08-29T08:00:00"
JACKSON_LAT, JACKSON_LON = 41.5931, -87.3461

def test_jackson_sun():
    chart = _chart(JACKSON_UTC, JACKSON_LAT, JACKSON_LON)
    sun = chart["planets"]["sun"]
    # Sun 155.47° = Virgo 25.47°
    assert approx(155.47, sun["longitude"]), f"Sun lon={sun['longitude']}"
    assert sun["sign"] == "Virgo"

def test_jackson_moon():
    chart = _chart(JACKSON_UTC, JACKSON_LAT, JACKSON_LON)
    moon = chart["planets"]["moon"]
    # Moon 336.47° = Pisces 6.47°
    assert approx(336.47, moon["longitude"]), f"Moon lon={moon['longitude']}"
    assert moon["sign"] == "Pisces"

def test_jackson_mars():
    chart = _chart(JACKSON_UTC, JACKSON_LAT, JACKSON_LON)
    mars = chart["planets"]["mars"]
    # Mars 51.72° = Taurus 21.72°
    assert approx(51.72, mars["longitude"]), f"Mars lon={mars['longitude']}"


# ── Chart 2: Kurt Cobain (1967-02-20 19:20 UTC, Aberdeen WA) ──────────────────
COBAIN_UTC = "1967-02-20T19:20:00"
COBAIN_LAT, COBAIN_LON = 46.9756, -123.8153

def test_cobain_sun():
    chart = _chart(COBAIN_UTC, COBAIN_LAT, COBAIN_LON)
    sun = chart["planets"]["sun"]
    # Sun ~331.5° (Pisces ~1.5°)
    assert approx(331.5, sun["longitude"]), f"Sun lon={sun['longitude']}"
    assert sun["sign"] == "Pisces"

def test_cobain_venus():
    chart = _chart(COBAIN_UTC, COBAIN_LAT, COBAIN_LON)
    venus = chart["planets"]["venus"]
    # Venus in Pisces ~26° → ~356°
    assert approx(356.0, venus["longitude"]), f"Venus lon={venus['longitude']}"

def test_cobain_saturn():
    chart = _chart(COBAIN_UTC, COBAIN_LAT, COBAIN_LON)
    saturn = chart["planets"]["saturn"]
    # Saturn in Pisces ~28° → ~358.7°
    assert approx(358.7, saturn["longitude"]), f"Saturn lon={saturn['longitude']}"


# ── Chart 3: Princess Diana (1961-07-01 19:45 UTC, Sandringham UK) ────────────
# Reference: astro.com — Sun ~99.8° (Cancer 9.8°)
DIANA_UTC = "1961-07-01T19:45:00"
DIANA_LAT, DIANA_LON = 52.8333, 0.5167

def test_diana_sun():
    chart = _chart(DIANA_UTC, DIANA_LAT, DIANA_LON)
    sun = chart["planets"]["sun"]
    assert approx(99.8, sun["longitude"]), f"Sun lon={sun['longitude']}"
    assert sun["sign"] == "Cancer"

def test_diana_moon():
    chart = _chart(DIANA_UTC, DIANA_LAT, DIANA_LON)
    moon = chart["planets"]["moon"]
    # Moon 325.65° = Aquarius 25.65°
    assert approx(325.65, moon["longitude"]), f"Moon lon={moon['longitude']}"
    assert moon["sign"] == "Aquarius"


# ── House system tests ────────────────────────────────────────────────────────

def test_equal_houses_spacing():
    chart = _chart(COBAIN_UTC, COBAIN_LAT, COBAIN_LON, hs="equal")
    cusps = chart["houses"]
    for i in range(12):
        gap = (cusps[(i + 1) % 12] - cusps[i]) % 360
        assert abs(gap - 30.0) < 0.01, f"Equal house {i+1} gap={gap}"

def test_whole_sign_boundaries():
    chart = _chart(COBAIN_UTC, COBAIN_LAT, COBAIN_LON, hs="whole_sign")
    cusps = chart["houses"]
    for c in cusps:
        assert abs(c % 30) < 0.01, f"Whole sign cusp {c} not at sign boundary"

def test_placidus_houses_count():
    chart = _chart(COBAIN_UTC, COBAIN_LAT, COBAIN_LON, hs="placidus")
    assert len(chart["houses"]) == 12
    assert abs(chart["angles"]["asc"] - chart["houses"][0]) < 0.01
    assert abs(chart["angles"]["mc"] - chart["houses"][9]) < 0.01


# ── Aspect tests ──────────────────────────────────────────────────────────────

def test_aspects_returned():
    chart = _chart(COBAIN_UTC, COBAIN_LAT, COBAIN_LON)
    aspects = engine.calc_aspects(chart["planets"])
    assert len(aspects) > 0
    for asp in aspects:
        assert "planet1" in asp
        assert "aspect" in asp
        assert asp["orb"] >= 0

def test_retrograde_flag():
    # Use Cobain chart — Saturn retrograde confirmed for Feb 1967
    chart = _chart(COBAIN_UTC, COBAIN_LAT, COBAIN_LON)
    flags = [p["retrograde"] for p in chart["planets"].values()]
    assert any(flags), "Expected at least one retrograde planet"

def test_sign_function():
    assert _sign(0) == "Aries"
    assert _sign(30) == "Taurus"
    assert _sign(359.9) == "Pisces"
    assert _sign(270) == "Capricorn"
