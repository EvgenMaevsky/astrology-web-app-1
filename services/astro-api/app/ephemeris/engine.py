"""
EphemerisEngine — apparent geocentric ecliptic positions + house cusps.

Uses the Swiss Ephemeris (pyswisseph) — the same engine as ZET9 and astro.com.
Without SE1 data files it falls back to the built-in Moshier ephemeris
(accuracy ~0.1″ for planets, no Chiron). Set `ephe_path` in settings to a
directory with SE1 files to enable Chiron and full precision.
"""
from __future__ import annotations

import math
from datetime import datetime, timezone

import swisseph as swe

from app.config import settings

if settings.ephe_path:
    swe.set_ephe_path(settings.ephe_path)

_CALC_FLAGS = swe.FLG_SWIEPH | swe.FLG_SPEED

BODY_MAP: dict[str, int] = {
    "sun": swe.SUN,
    "moon": swe.MOON,
    "mercury": swe.MERCURY,
    "venus": swe.VENUS,
    "mars": swe.MARS,
    "jupiter": swe.JUPITER,
    "saturn": swe.SATURN,
    "uranus": swe.URANUS,
    "neptune": swe.NEPTUNE,
    "pluto": swe.PLUTO,
    "true_node": swe.TRUE_NODE,
    "lilith": swe.MEAN_APOG,
    "chiron": swe.CHIRON,  # requires seas_*.se1 file; skipped if unavailable
}

# Nodes/apogee have no meaningful retrograde flag of their own in reports,
# but their speeds are still returned by swisseph, so no special-casing needed.

HOUSE_SYSTEMS: dict[str, bytes] = {
    "placidus": b"P",
    "koch": b"K",
    "equal": b"E",
    "whole_sign": b"W",
    "regiomontanus": b"R",
    "campanus": b"C",
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


def _jd_ut(dt: datetime) -> float:
    """Julian Day (UT1≈UTC) from a datetime; naive datetimes are taken as UTC."""
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    dt = dt.astimezone(timezone.utc)
    _, jd_ut = swe.utc_to_jd(
        dt.year, dt.month, dt.day,
        dt.hour, dt.minute, dt.second + dt.microsecond / 1e6,
        swe.GREG_CAL,
    )
    return jd_ut


def _jd_to_utc(jd_ut: float) -> datetime:
    y, m, d, h, mi, s = swe.jdut1_to_utc(jd_ut, swe.GREG_CAL)
    sec = int(s)
    micro = int(round((s - sec) * 1e6))
    if micro >= 1_000_000:
        sec, micro = sec + 1, 0
    return datetime(y, m, d, h, mi, min(sec, 59), micro, tzinfo=timezone.utc)


def _calc_body(jd_ut: float, body: int) -> dict:
    (lon, lat, dist, lon_speed, _lat_speed, _dist_speed), _ = swe.calc_ut(
        jd_ut, body, _CALC_FLAGS
    )
    return {
        "longitude": round(lon % 360.0, 6),
        "latitude": round(lat, 6),
        "distance": round(dist, 8),
        "speed": round(lon_speed, 6),
    }


def _signed_sep(lon_a: float, lon_b: float) -> float:
    """Signed separation lon_a − lon_b, wrapped to (−180, 180]."""
    return (lon_a - lon_b + 180.0) % 360.0 - 180.0


def _is_applying(lon_a: float, speed_a: float, lon_b: float, speed_b: float,
                 asp_angle: float) -> bool:
    """True if the aspect is applying (deviation from exact is shrinking)."""
    sep = _signed_sep(lon_a, lon_b)
    # d|sep|/dt: |sep| grows when sep and relative speed share sign
    d_abs_sep = math.copysign(1.0, sep or 1.0) * (speed_a - speed_b)
    # deviation = | |sep| − angle |; it shrinks when (|sep| − angle) and d|sep|/dt disagree
    return (abs(sep) - asp_angle) * d_abs_sep < 0


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

        jd = _jd_ut(dt)
        hsys = HOUSE_SYSTEMS.get(house_system, HOUSE_SYSTEMS["placidus"])
        cusps, ascmc = swe.houses_ex(jd, lat, lon, hsys)
        cusps = [c % 360.0 for c in cusps]
        asc, mc, ramc = ascmc[0], ascmc[1], ascmc[2]

        # True obliquity of date
        (obl_true, *_), _ = swe.calc_ut(jd, swe.ECL_NUT)

        planets: dict[str, dict] = {}
        for name in bodies:
            body_id = BODY_MAP.get(name)
            if body_id is None:
                continue
            try:
                pos = _calc_body(jd, body_id)
            except swe.Error:
                continue  # e.g. Chiron without SE1 asteroid files
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
                "obliquity": round(obl_true, 6),
                "house_system": house_system,
            },
        }

    def calc_transit(
        self,
        natal_dt: datetime,
        natal_lat: float,
        natal_lon: float,
        transit_dt: datetime,
        transit_lat: float,
        transit_lon: float,
        house_system: str = "placidus",
        bodies: list[str] | None = None,
    ) -> dict:
        """
        Overlay current (transit) planets on the natal chart.

        Returns:
          natal:    natal chart data (planets, houses, angles)
          transit:  transit planet positions
          aspects:  transit-to-natal aspects (tighter orbs: 3° max)
        """
        natal = self.calc_natal(natal_dt, natal_lat, natal_lon, house_system, bodies)
        transit = self.calc_natal(transit_dt, transit_lat, transit_lon, house_system, bodies)
        aspects = self.calc_cross_aspects(
            transit["planets"], natal["planets"],
            label1="transit", label2="natal",
            orbs={k: min(v, 3.0) for k, v in ASPECT_DEFS.items()},
        )
        return {"natal": natal, "transit": transit["planets"], "aspects": aspects}

    def calc_solar_return(
        self,
        birth_dt: datetime,
        year: int,
        lat: float,
        lon: float,
        house_system: str = "placidus",
    ) -> dict:
        """
        Find the Solar Return moment for a given year and compute its chart.

        Newton's method on JD: correction = diff / sun_speed (~0.9856°/day),
        converges to < 0.001″ in 3–4 iterations.
        """
        natal = self.calc_natal(birth_dt, lat, lon, house_system)
        natal_sun_lon = natal["planets"]["sun"]["longitude"]

        # Seed: same calendar day in the target year
        try:
            seed_dt = birth_dt.replace(year=year)
        except ValueError:  # Feb 29 in a non-leap year
            seed_dt = birth_dt.replace(year=year, day=28)
        jd = _jd_ut(seed_dt)

        for _ in range(20):
            (sun_lon, _lat, _dist, sun_speed, *_), _ = swe.calc_ut(jd, swe.SUN, _CALC_FLAGS)
            diff = _signed_sep(natal_sun_lon, sun_lon)
            if abs(diff) < 1e-7:
                break
            jd += diff / sun_speed

        sr_dt = _jd_to_utc(jd)
        sr_chart = self.calc_natal(sr_dt, lat, lon, house_system)
        return {
            "return_dt": sr_dt.isoformat(),
            "natal_sun": round(natal_sun_lon, 6),
            **sr_chart,
        }

    def calc_synastry(
        self,
        dt1: datetime, lat1: float, lon1: float,
        dt2: datetime, lat2: float, lon2: float,
        house_system: str = "placidus",
        bodies: list[str] | None = None,
    ) -> dict:
        """
        Compute synastry: two natal charts + inter-aspects between them.

        Returns:
          person1:       full natal chart for person 1
          person2:       full natal chart for person 2
          inter_aspects: aspects between person1 planets and person2 planets
        """
        c1 = self.calc_natal(dt1, lat1, lon1, house_system, bodies)
        c2 = self.calc_natal(dt2, lat2, lon2, house_system, bodies)
        inter = self.calc_cross_aspects(
            c1["planets"], c2["planets"],
            label1="person1", label2="person2",
        )
        return {"person1": c1, "person2": c2, "inter_aspects": inter}

    def calc_cross_aspects(
        self,
        planets_a: dict[str, dict],
        planets_b: dict[str, dict],
        label1: str = "a",
        label2: str = "b",
        orbs: dict[str, float] | None = None,
    ) -> list[dict]:
        """Find aspects between two independent sets of planets."""
        results: list[dict] = []
        for name_a, p_a in planets_a.items():
            for name_b, p_b in planets_b.items():
                diff = abs(_signed_sep(p_a["longitude"], p_b["longitude"]))

                for asp_name, (asp_angle, default_orb) in ASPECT_DEFS.items():
                    orb = (orbs or {}).get(asp_name, default_orb)
                    deviation = abs(diff - asp_angle)
                    if deviation <= orb:
                        results.append({
                            label1: name_a,
                            label2: name_b,
                            "aspect": asp_name,
                            "angle": round(asp_angle, 2),
                            "orb": round(deviation, 4),
                            "applying": _is_applying(
                                p_a["longitude"], p_a.get("speed", 0),
                                p_b["longitude"], p_b.get("speed", 0),
                                asp_angle,
                            ),
                        })
        return results

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
                diff = abs(_signed_sep(lon1, lon2))

                for asp_name, (asp_angle, default_orb) in ASPECT_DEFS.items():
                    orb = (orbs or {}).get(asp_name, default_orb)
                    deviation = abs(diff - asp_angle)
                    if deviation <= orb:
                        results.append({
                            "planet1": p1,
                            "planet2": p2,
                            "aspect": asp_name,
                            "angle": round(asp_angle, 2),
                            "orb": round(deviation, 4),
                            "applying": _is_applying(
                                lon1, planets[p1].get("speed", 0),
                                lon2, planets[p2].get("speed", 0),
                                asp_angle,
                            ),
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
