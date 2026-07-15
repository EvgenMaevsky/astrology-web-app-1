"""
House cusp calculations: Placidus, Koch, Equal, Whole Sign, Regiomontanus, Campanus.

License-clean replacement for the Swiss Ephemeris house engine. Every system is
cross-validated against pyswisseph in tests/test_cross_swisseph.py (dev oracle);
agreement is exact to < 0.001° at all non-circumpolar latitudes.

Inputs everywhere: ramc (deg), obl = true obliquity of date (deg), lat (deg).
Output: [H1..H12] ecliptic longitudes in degrees, H1 = ASC, H10 = MC.
"""
from __future__ import annotations

import math

import numpy as np


def _norm(deg: float) -> float:
    return deg % 360


def _ecl_lon_of_ra(ra: float, obl: float) -> float:
    """Ecliptic longitude of the ecliptic point with right ascension `ra`."""
    lam = math.degrees(math.atan2(
        math.sin(math.radians(ra)),
        math.cos(math.radians(ra)) * math.cos(math.radians(obl)),
    ))
    lam = _norm(lam)
    # atan2 can land in the opposite quadrant family; RA and λ never differ by >90°
    if abs(_norm(ra) - lam) > 90 and abs(abs(_norm(ra) - lam) - 360) > 90:
        lam = _norm(lam + 180)
    return lam


def _decl_of_lon(lon: float, obl: float) -> float:
    """Declination of a point on the ecliptic."""
    return math.degrees(math.asin(
        math.sin(math.radians(obl)) * math.sin(math.radians(lon))
    ))


def _asc_diff(decl: float, lat: float) -> float:
    """Ascensional difference; argument clamped for circumpolar degrees."""
    arg = math.tan(math.radians(lat)) * math.tan(math.radians(decl))
    return math.degrees(math.asin(max(-1.0, min(1.0, arg))))


def get_mc(ramc: float, obl: float) -> float:
    """Ecliptic longitude of the Midheaven."""
    r, e = math.radians(ramc), math.radians(obl)
    return _norm(math.degrees(math.atan2(math.sin(r), math.cos(r) * math.cos(e))))


def get_asc(ramc: float, obl: float, lat: float) -> float:
    """Ecliptic longitude of the Ascendant."""
    r, e, f = math.radians(ramc), math.radians(obl), math.radians(lat)
    return _norm(math.degrees(math.atan2(
        math.cos(r),
        -(math.sin(r) * math.cos(e) + math.tan(f) * math.sin(e)),
    )))


# ── Placidus ──────────────────────────────────────────────────────────────────

def _placidus_cusp(ramc: float, obl: float, lat: float,
                   offset: float, frac: float) -> float:
    """Fixed-point solve of the Placidus condition RA(λ) = RAMC + offset + frac·AD(λ)."""
    lam = _ecl_lon_of_ra(_norm(ramc + offset), obl)
    for _ in range(60):
        ad = _asc_diff(_decl_of_lon(lam, obl), lat)
        new_lam = _ecl_lon_of_ra(_norm(ramc + offset + frac * ad), obl)
        if abs(_norm(new_lam - lam + 180) - 180) < 1e-10:
            return _norm(new_lam)
        lam = new_lam
    return _norm(lam)


def placidus(ramc: float, obl: float, lat: float) -> list[float]:
    asc, mc = get_asc(ramc, obl, lat), get_mc(ramc, obl)
    h11 = _placidus_cusp(ramc, obl, lat, 30, 1 / 3)
    h12 = _placidus_cusp(ramc, obl, lat, 60, 2 / 3)
    h2 = _placidus_cusp(ramc, obl, lat, 120, 2 / 3)
    h3 = _placidus_cusp(ramc, obl, lat, 150, 1 / 3)
    return _assemble(asc, mc, h11, h12, h2, h3)


# ── Koch (Birthplace) ─────────────────────────────────────────────────────────

def koch(ramc: float, obl: float, lat: float) -> list[float]:
    """Koch: ascendants taken at RAMC shifted by thirds of the MC's
    ascensional difference (formula verified against Swiss Ephemeris)."""
    asc, mc = get_asc(ramc, obl, lat), get_mc(ramc, obl)
    ad = _asc_diff(_decl_of_lon(mc, obl), lat)
    h11 = get_asc(_norm(ramc - 60 - 2 * ad / 3), obl, lat)
    h12 = get_asc(_norm(ramc - 30 - ad / 3), obl, lat)
    h2 = get_asc(_norm(ramc + 30 + ad / 3), obl, lat)
    h3 = get_asc(_norm(ramc + 60 + 2 * ad / 3), obl, lat)
    return _assemble(asc, mc, h11, h12, h2, h3)


# ── Regiomontanus & Campanus (exact vector geometry) ──────────────────────────
#
# Both systems define intermediate cusps as intersections of the ecliptic with
# great circles through the north/south points of the horizon:
#   Regiomontanus — circles through equal 30° divisions of the celestial equator;
#   Campanus      — circles through equal 30° divisions of the prime vertical.
# Cusps 11/12 always lie above the horizon, cusps 2/3 below — that invariant
# picks the right one of the two ecliptic intersections.

def _house_circle_cusp(Q: np.ndarray, Z: np.ndarray, Nh: np.ndarray,
                       obl: float, above: bool) -> float:
    n = np.cross(Nh, Q)                                    # house-circle normal
    e = math.radians(obl)
    ecl_pole = np.array([0.0, -math.sin(e), math.cos(e)])
    d = np.cross(ecl_pole, n)                              # ecliptic intersection
    if (np.dot(d, Z) > 0) != above:
        d = -d
    x_ecl = np.array([1.0, 0.0, 0.0])
    y_ecl = np.array([0.0, math.cos(e), math.sin(e)])
    return _norm(math.degrees(math.atan2(np.dot(d, y_ecl), np.dot(d, x_ecl))))


def _local_frame(ramc: float, lat: float) -> tuple[np.ndarray, np.ndarray]:
    """Zenith and horizon-north unit vectors in the equatorial frame of date."""
    r, f = math.radians(ramc), math.radians(lat)
    Z = np.array([math.cos(f) * math.cos(r), math.cos(f) * math.sin(r), math.sin(f)])
    P = np.array([0.0, 0.0, 1.0])
    Nh = P - math.sin(f) * Z
    return Z, Nh / np.linalg.norm(Nh)


def regiomontanus(ramc: float, obl: float, lat: float) -> list[float]:
    asc, mc = get_asc(ramc, obl, lat), get_mc(ramc, obl)
    Z, Nh = _local_frame(ramc, lat)

    def eq_point(h: float) -> np.ndarray:
        a = math.radians(ramc + h)
        return np.array([math.cos(a), math.sin(a), 0.0])

    h11 = _house_circle_cusp(eq_point(30), Z, Nh, obl, above=True)
    h12 = _house_circle_cusp(eq_point(60), Z, Nh, obl, above=True)
    h2 = _house_circle_cusp(eq_point(120), Z, Nh, obl, above=False)
    h3 = _house_circle_cusp(eq_point(150), Z, Nh, obl, above=False)
    return _assemble(asc, mc, h11, h12, h2, h3)


def campanus(ramc: float, obl: float, lat: float) -> list[float]:
    asc, mc = get_asc(ramc, obl, lat), get_mc(ramc, obl)
    Z, Nh = _local_frame(ramc, lat)
    E = np.cross(Z, Nh)

    def pv_point(theta: float) -> np.ndarray:
        t = math.radians(theta)
        return math.cos(t) * E + math.sin(t) * Z

    # θ mapping and hemisphere rule verified against Swiss Ephemeris
    h11 = _house_circle_cusp(pv_point(-60), Z, Nh, obl, above=True)
    h12 = _house_circle_cusp(pv_point(-30), Z, Nh, obl, above=True)
    h2 = _house_circle_cusp(pv_point(30), Z, Nh, obl, above=False)
    h3 = _house_circle_cusp(pv_point(60), Z, Nh, obl, above=False)
    return _assemble(asc, mc, h11, h12, h2, h3)


# ── Simple systems ────────────────────────────────────────────────────────────

def equal(ramc: float, obl: float, lat: float) -> list[float]:
    asc = get_asc(ramc, obl, lat)
    return [_norm(asc + i * 30) for i in range(12)]


def whole_sign(ramc: float, obl: float, lat: float) -> list[float]:
    asc = get_asc(ramc, obl, lat)
    start = int(asc / 30) * 30.0
    return [_norm(start + i * 30) for i in range(12)]


def _assemble(asc: float, mc: float, h11: float, h12: float,
              h2: float, h3: float) -> list[float]:
    return [
        asc, h2, h3, _norm(mc + 180), _norm(h11 + 180), _norm(h12 + 180),
        _norm(asc + 180), _norm(h2 + 180), _norm(h3 + 180), mc, h11, h12,
    ]


HOUSE_SYSTEMS: dict[str, callable] = {
    "placidus": placidus,
    "koch": koch,
    "equal": equal,
    "whole_sign": whole_sign,
    "regiomontanus": regiomontanus,
    "campanus": campanus,
}
