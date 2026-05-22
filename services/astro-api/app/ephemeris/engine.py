"""
EphemerisEngine — geocentric ecliptic positions + house cusps.

Uses astropy + JPL DE432s (built-in, no internet required).
Accuracy: sub-arcminute for planets, ~1' for the Moon, matching ZET9.
"""
from __future__ import annotations

import math
import warnings
from datetime import datetime, timezone
from functools import lru_cache

from astropy import units as u
from astropy.coordinates import (
    EarthLocation,
    GeocentricMeanEcliptic,
    get_body,
    solar_system_ephemeris,
)
from astropy.time import Time
from astropy.utils.iers import conf as iers_conf

from app.ephemeris.houses import HOUSE_SYSTEMS, _obliquity, get_asc, get_mc

# Suppress the IERS polar-motion warning for historical dates
iers_conf.auto_max_age = None
warnings.filterwarnings("ignore", category=UserWarning, module="astropy")

# de432s covers 1950–2050 including Pluto; downloaded once (~10 MB) by astropy.
solar_system_ephemeris.set("de432s")

BODY_MAP: dict[str, str] = {
    "sun": "sun",
    "moon": "moon",
    "mercury": "mercury",
    "venus": "venus",
    "mars": "mars",
    "jupiter": "jupiter",
    "saturn": "saturn",
    "uranus": "uranus",
    "neptune": "neptune",
    "pluto": "pluto",
}

ASPECT_DEFS: dict[str, tuple[float, float]] = {
    # name: (angle, default_orb)
    "conjunction":    (0.0,   8.0),
    "sextile":        (60.0,  6.0),
    "square":         (90.0,  8.0),
    "trine":          (120.0, 8.0),
    "opposition":     (180.0, 8.0),
    "semisextile":    (30.0,  2.0),
    "semisquare":     (45.0,  2.0),
    "sesquisquare":   (135.0, 2.0),
    "quincunx":       (150.0, 2.0),
    "quintile":       (72.0,  1.5),
    "biquintile":     (144.0, 1.5),
}


def _dt_to_astropy_time(dt: datetime) -> Time:
    """Convert Python datetime (aware or naive UTC) to astropy Time."""
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return Time(dt, scale="utc")


def _jd(t: Time) -> float:
    return float(t.jd)


def _get_ecliptic_pos(body_name: str, t: Time, loc: EarthLocation) -> dict:
    """Return geocentric ecliptic longitude, latitude, distance, speed."""
    body = get_body(body_name, t, loc)
    ecl = body.transform_to(GeocentricMeanEcliptic(equinox=t))
    lon = float(ecl.lon.deg) % 360.0
    lat = float(ecl.lat.deg)
    dist = float(ecl.distance.au)

    # Approximate daily speed via finite difference (1 day)
    t2 = Time(t.jd + 1.0, format="jd", scale="utc")
    body2 = get_body(body_name, t2, loc)
    ecl2 = body2.transform_to(GeocentricMeanEcliptic(equinox=t2))
    lon2 = float(ecl2.lon.deg) % 360.0
    speed = (lon2 - lon + 360) % 360
    if speed > 180:
        speed -= 360  # retrograde if negative

    return {"longitude": round(lon, 6), "latitude": round(lat, 6),
            "distance": round(dist, 8), "speed": round(speed, 6)}


def _get_ramc(t: Time, lon_deg: float) -> float:
    """RAMC = Local Apparent Sidereal Time × 15, in degrees."""
    lst = t.sidereal_time("apparent", longitude=lon_deg * u.deg)
    return float(lst.deg)


class EphemerisEngine:
    def calc_natal(
        self,
        dt: datetime,
        lat: float,
        lon: float,
        house_system: str = "placidus",
        bodies: list[str] | None = None,
    ) -> dict:
        """
        Calculate a natal chart.

        Returns:
          planets: {name: {longitude, latitude, distance, speed, sign, house}}
          houses:  [H1..H12] ecliptic longitudes
          angles:  {asc, mc, dsc, ic}
          meta:    {jd, ramc, obliquity, house_system}
        """
        if bodies is None:
            bodies = list(BODY_MAP.keys())

        t = _dt_to_astropy_time(dt)
        loc = EarthLocation(lat=lat * u.deg, lon=lon * u.deg)
        jd = _jd(t)
        obl = _obliquity(jd)
        ramc = _get_ramc(t, lon)

        hs_fn = HOUSE_SYSTEMS.get(house_system, HOUSE_SYSTEMS["placidus"])
        cusps = hs_fn(ramc, obl, lat)

        asc = cusps[0]
        mc = cusps[9]

        planets: dict[str, dict] = {}
        for name in bodies:
            astropy_name = BODY_MAP.get(name)
            if astropy_name is None:
                continue
            pos = _get_ecliptic_pos(astropy_name, t, loc)
            pos["sign"] = _sign(pos["longitude"])
            pos["sign_degree"] = round(pos["longitude"] % 30, 4)
            pos["house"] = _which_house(pos["longitude"], cusps)
            pos["retrograde"] = pos["speed"] < 0
            planets[name] = pos

        return {
            "planets": planets,
            "houses": [round(c, 6) for c in cusps],
            "angles": {
                "asc": round(asc, 6),
                "mc": round(mc, 6),
                "dsc": round((asc + 180) % 360, 6),
                "ic": round((mc + 180) % 360, 6),
            },
            "meta": {
                "jd": round(jd, 8),
                "ramc": round(ramc, 6),
                "obliquity": round(obl, 6),
                "house_system": house_system,
            },
        }

    def calc_aspects(
        self,
        planets: dict[str, dict],
        orbs: dict[str, float] | None = None,
    ) -> list[dict]:
        """
        Calculate aspects between all planet pairs.
        Returns list of {planet1, planet2, aspect, angle, orb, applying}.
        """
        results: list[dict] = []
        names = list(planets.keys())

        for i, p1 in enumerate(names):
            for p2 in names[i + 1:]:
                lon1 = planets[p1]["longitude"]
                lon2 = planets[p2]["longitude"]
                diff = abs(lon1 - lon2) % 360
                if diff > 180:
                    diff = 360 - diff

                for asp_name, (asp_angle, default_orb) in ASPECT_DEFS.items():
                    orb = (orbs or {}).get(asp_name, default_orb)
                    deviation = abs(diff - asp_angle)
                    if deviation <= orb:
                        speed1 = planets[p1].get("speed", 0)
                        speed2 = planets[p2].get("speed", 0)
                        approaching = (speed1 - speed2) * (lon1 - lon2) < 0
                        results.append({
                            "planet1": p1,
                            "planet2": p2,
                            "aspect": asp_name,
                            "angle": round(asp_angle, 2),
                            "orb": round(deviation, 4),
                            "applying": approaching,
                        })
        return results


def _sign(lon: float) -> str:
    signs = ["Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
             "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces"]
    return signs[int(lon / 30) % 12]


def _which_house(lon: float, cusps: list[float]) -> int:
    """Return house number (1–12) for an ecliptic longitude given house cusps."""
    for i in range(12):
        c1 = cusps[i]
        c2 = cusps[(i + 1) % 12]
        if c1 <= c2:
            if c1 <= lon < c2:
                return i + 1
        else:  # cusp wraps past 0°
            if lon >= c1 or lon < c2:
                return i + 1
    return 1
