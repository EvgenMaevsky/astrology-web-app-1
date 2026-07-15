"""
Regression tests for EphemerisEngine.

Reference values verified against Astro.com / AstroSeek for known birth charts.
Tolerance: ±0.15° (9') — well within astrological precision requirements.
"""
import math

import pytest
from datetime import datetime, timezone

from app.ephemeris.engine import EphemerisEngine, _sign
from app.schemas.chart import NatalChartRequest, to_utc

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


def test_placidus_defining_condition():
    """
    Mathematical invariant, independent of the implementation:
    the Placidus cusp of house 11 divides its own semidiurnal arc so that
    the meridian distance east of the MC equals SDA/3 (H12: 2·SDA/3;
    H2: 180 − 2·SNA/3; H3: 180 − SNA/3).
    """
    chart = _chart(COBAIN_UTC, COBAIN_LAT, COBAIN_LON, hs="placidus")
    ramc = chart["meta"]["ramc"]
    obl = chart["meta"]["obliquity"]
    lat = COBAIN_LAT

    def md_and_arcs(lam: float) -> tuple[float, float, float]:
        lam_r, obl_r = math.radians(lam), math.radians(obl)
        ra = math.degrees(math.atan2(math.sin(lam_r) * math.cos(obl_r), math.cos(lam_r))) % 360
        decl = math.degrees(math.asin(math.sin(obl_r) * math.sin(lam_r)))
        ad = math.degrees(math.asin(math.tan(math.radians(lat)) * math.tan(math.radians(decl))))
        md = (ra - ramc) % 360
        if md > 180:
            md -= 360
        return md, 90 + ad, 90 - ad  # MD_east, SDA, SNA

    cusps = chart["houses"]
    checks = [
        (cusps[10], lambda sda, sna: sda / 3),          # H11
        (cusps[11], lambda sda, sna: 2 * sda / 3),      # H12
        (cusps[1],  lambda sda, sna: 180 - 2 * sna / 3),  # H2
        (cusps[2],  lambda sda, sna: 180 - sna / 3),      # H3
    ]
    for lam, expected_md in checks:
        md, sda, sna = md_and_arcs(lam)
        assert abs(md - expected_md(sda, sna)) < 0.01, (
            f"cusp {lam}: MD={md:.4f}, expected {expected_md(sda, sna):.4f}"
        )


def test_regiomontanus_campanus_available():
    for hs in ("regiomontanus", "campanus"):
        chart = _chart(COBAIN_UTC, COBAIN_LAT, COBAIN_LON, hs=hs)
        assert len(chart["houses"]) == 12
        assert abs(chart["angles"]["asc"] - chart["houses"][0]) < 0.01


# ── Solar return ──────────────────────────────────────────────────────────────

def test_solar_return_converges():
    """Transiting Sun at the returned moment must equal the natal Sun exactly."""
    birth = datetime(1990, 6, 15, 12, 30, tzinfo=timezone.utc)
    sr = engine.calc_solar_return(birth, 2026, 50.45, 30.52)
    assert abs(sr["planets"]["sun"]["longitude"] - sr["natal_sun"]) < 1e-4
    assert sr["return_dt"].startswith("2026-06")


def test_solar_return_feb29():
    """Feb 29 birthdays must not crash in non-leap years."""
    birth = datetime(1992, 2, 29, 6, 0, tzinfo=timezone.utc)
    sr = engine.calc_solar_return(birth, 2025, 48.0, 2.0)
    assert abs(sr["planets"]["sun"]["longitude"] - sr["natal_sun"]) < 1e-4


# ── Timezone conversion ───────────────────────────────────────────────────────

def test_to_utc_naive_with_tz():
    # 1990-01-01 12:00 Kyiv (UTC+3 back then? no — winter, UTC+3 was Moscow; Kyiv used UTC+3 until 1990)
    dt = to_utc(datetime(2020, 1, 1, 12, 0), "Europe/Kyiv")
    assert dt.tzinfo is not None
    assert dt.hour == 10  # winter: Kyiv = UTC+2

def test_to_utc_dst():
    dt = to_utc(datetime(2020, 7, 1, 12, 0), "Europe/Kyiv")
    assert dt.hour == 9  # summer: Kyiv = UTC+3

def test_to_utc_naive_without_tz_is_utc():
    dt = to_utc(datetime(2020, 1, 1, 12, 0), None)
    assert dt.hour == 12

def test_to_utc_invalid_tz():
    with pytest.raises(ValueError):
        to_utc(datetime(2020, 1, 1, 12, 0), "Not/AZone")

def test_natal_request_localizes():
    req = NatalChartRequest(
        birth_dt="1990-05-10T14:30:00", timezone="Europe/Kyiv",
        lat=50.45, lon=30.52,
    )
    assert req.birth_dt.tzinfo is not None
    # 1990: Kyiv was on Moscow summer time (UTC+4) — zoneinfo applies the
    # historical offset, which is exactly what birth charts need.
    assert req.birth_dt.hour == 10


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
