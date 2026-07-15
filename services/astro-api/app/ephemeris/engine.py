"""
EphemerisEngine — apparent geocentric ecliptic positions + house cusps.

License-clean stack: Skyfield (MIT) + JPL DE440s (public domain) — the same
raw data Swiss Ephemeris compresses into its SE1 files. Positions are apparent
(light-time, aberration, nutation) referred to the true ecliptic and equinox
of date, matching ZET9 / astro.com conventions.

Every released change is cross-validated against pyswisseph (dev-only oracle)
in tests/test_cross_swisseph.py.

Bodies:
  Sun–Pluto            DE440s (outer planets via system barycenters, < 0.1″ off)
  true_node            osculating node of the geocentric lunar orbit (from r × v)
  mean_node*, lilith   Meeus polynomials, mean equinox of date
  chiron               optional Horizons SPK (settings.chiron_spk)

* mean_node is computed internally for parity checks; the public body set keeps
  true_node + lilith as before.
"""
from __future__ import annotations

import math
from datetime import datetime, timezone
from functools import lru_cache
from pathlib import Path

import numpy as np
from skyfield.api import Loader
from skyfield.framelib import ecliptic_frame
from skyfield.nutationlib import iau2000b

from app.config import settings
from app.ephemeris.houses import HOUSE_SYSTEMS, get_asc, get_mc  # noqa: F401

_SPEED_STEP_DAYS = 0.25  # central difference half-step for daily motion

BODY_TARGETS: dict[str, str] = {
    "sun": "sun",
    "moon": "moon",
    "mercury": "mercury",
    "venus": "venus",
    "mars": "mars barycenter",
    "jupiter": "jupiter barycenter",
    "saturn": "saturn barycenter",
    "uranus": "uranus barycenter",
    "neptune": "neptune barycenter",
    "pluto": "pluto barycenter",
}

BODY_ORDER = [*BODY_TARGETS.keys(), "true_node", "lilith", "chiron"]

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


@lru_cache(maxsize=1)
def _sky():
    """Lazy singletons: loader, timescale, planetary ephemeris, optional Chiron."""
    load = Loader(settings.skyfield_dir, verbose=False)
    ts = load.timescale()
    eph = load("de440s.bsp")
    chiron = None
    if settings.chiron_spk and Path(settings.chiron_spk).exists():
        spk = load_file_safe(settings.chiron_spk)
        if spk is not None:
            for seg_id in (2002060, 20002060):
                if seg_id in spk:
                    chiron = eph["sun"] + spk[seg_id]
                    break
    return ts, eph, chiron


def load_file_safe(path: str):
    from skyfield.api import load_file
    try:
        return load_file(path)
    except Exception:
        return None


def _time_from_dt(dt: datetime):
    """Build a Skyfield Time treating the civil UTC instant as UT1.

    This is the convention of all astrological references (Swiss Ephemeris,
    astro.com): the difference is < 0.9 s for modern dates, and for pre-1972
    dates it sidesteps the ill-defined rubber-second UTC entirely.
    """
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    dt = dt.astimezone(timezone.utc)
    ts, _, _ = _sky()
    return ts.ut1(dt.year, dt.month, dt.day,
                  dt.hour, dt.minute, dt.second + dt.microsecond / 1e6)


def _norm(x: float) -> float:
    return x % 360


def _signed_sep(lon_a: float, lon_b: float) -> float:
    """Signed separation lon_a − lon_b, wrapped to (−180, 180]."""
    return (lon_a - lon_b + 180.0) % 360.0 - 180.0


def _mean_obliquity(tt_jd: float) -> float:
    T = (tt_jd - 2451545.0) / 36525.0
    return (84381.406 - 46.836769 * T - 0.0001831 * T**2 + 0.00200340 * T**3) / 3600.0


def _true_obliquity(t) -> float:
    _, deps = iau2000b(t.tt)          # units: 0.1 microarcsecond
    return _mean_obliquity(t.tt) + deps * 1e-7 / 3600.0


def _apparent_lon_series(observer, target, t3) -> np.ndarray:
    """Apparent ecliptic-of-date longitudes at a vector of times."""
    app = observer.at(t3).observe(target).apparent()
    _lat, lon, _dist = app.frame_latlon(ecliptic_frame)
    return lon.degrees


def _planet_position(eph, target_key: str, t, t3, chiron_target=None) -> dict:
    earth = eph["earth"]
    target = chiron_target if chiron_target is not None else eph[target_key]
    app = earth.at(t).observe(target).apparent()
    lat, lon, dist = app.frame_latlon(ecliptic_frame)

    lons = _apparent_lon_series(earth, target, t3)
    speed = _signed_sep(float(lons[2]), float(lons[0])) / (2 * _SPEED_STEP_DAYS)

    return {
        "longitude": round(float(lon.degrees) % 360.0, 6),
        "latitude": round(float(lat.degrees), 6),
        "distance": round(float(dist.au), 8),
        "speed": round(speed, 6),
    }


def _true_node(eph, t, t3) -> dict:
    """Osculating ascending node of the geocentric lunar orbit."""
    rel = eph["moon"] - eph["earth"]

    def node_lon(ti) -> float:
        pos = rel.at(ti)
        r, v = pos.frame_xyz_and_velocity(ecliptic_frame)
        h = np.cross(r.au, v.au_per_d)
        n = np.cross([0.0, 0.0, 1.0], h)   # ascending node direction
        return _norm(math.degrees(math.atan2(n[1], n[0])))

    lon = node_lon(t)
    lon_m = node_lon(_shift(t, -_SPEED_STEP_DAYS))
    lon_p = node_lon(_shift(t, +_SPEED_STEP_DAYS))
    speed = _signed_sep(lon_p, lon_m) / (2 * _SPEED_STEP_DAYS)

    pos = rel.at(t)
    return {
        "longitude": round(lon, 6),
        "latitude": 0.0,
        "distance": round(float(pos.distance().au), 8),
        "speed": round(speed, 6),
    }


_LUNAR_INCLINATION = 5.145396  # degrees


def _mean_apogee_ecliptic(tt_jd: float) -> tuple[float, float]:
    """Black Moon Lilith: mean lunar apogee projected onto the ecliptic.

    Mean elements (Meeus/ELP-2000) give the apogee as an angle measured
    along the inclined lunar orbit; like Swiss Ephemeris, we convert that
    to true ecliptic longitude/latitude (differences reach ~0.11°).
    """
    T = (tt_jd - 2451545.0) / 36525.0
    node = (125.0445479 - 1934.1362891 * T + 0.0020754 * T**2
            + T**3 / 467441.0 - T**4 / 60616000.0)
    perigee = (83.3532465 + 4069.0137287 * T - 0.0103200 * T**2
               - T**3 / 80053.0 + T**4 / 18999000.0)
    u = math.radians(perigee + 180.0 - node)   # apogee, argument from the node
    i = math.radians(_LUNAR_INCLINATION)
    lon = _norm(node + math.degrees(math.atan2(math.cos(i) * math.sin(u), math.cos(u))))
    lat = math.degrees(math.asin(math.sin(i) * math.sin(u)))
    return lon, lat


def _mean_lunar_apogee(t) -> dict:
    lon, lat = _mean_apogee_ecliptic(t.tt)
    lon_m, _ = _mean_apogee_ecliptic(t.tt - _SPEED_STEP_DAYS)
    lon_p, _ = _mean_apogee_ecliptic(t.tt + _SPEED_STEP_DAYS)
    speed = _signed_sep(lon_p, lon_m) / (2 * _SPEED_STEP_DAYS)
    return {"longitude": round(lon, 6), "latitude": round(lat, 6),
            "distance": 0.0, "speed": round(speed, 6)}


def _shift(t, days: float):
    ts, _, _ = _sky()
    return ts.tt_jd(t.tt + days)


def _t3(t):
    ts, _, _ = _sky()
    return ts.tt_jd(t.tt + np.array([-_SPEED_STEP_DAYS, 0.0, _SPEED_STEP_DAYS]))


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
            bodies = list(BODY_ORDER)

        _, eph, chiron = _sky()
        t = _time_from_dt(dt)
        t3 = _t3(t)

        obl = _true_obliquity(t)
        ramc = _norm(float(t.gast) * 15.0 + lon)

        hs_fn = HOUSE_SYSTEMS.get(house_system, HOUSE_SYSTEMS["placidus"])
        cusps = hs_fn(ramc, obl, lat)
        # true angles, independent of the house system (in Equal/Whole Sign
        # cusps[0]/cusps[9] are not the actual ASC/MC)
        asc = get_asc(ramc, obl, lat)
        mc = get_mc(ramc, obl)

        planets: dict[str, dict] = {}
        for name in bodies:
            if name in BODY_TARGETS:
                pos = _planet_position(eph, BODY_TARGETS[name], t, t3)
            elif name == "true_node":
                pos = _true_node(eph, t, t3)
            elif name == "lilith":
                pos = _mean_lunar_apogee(t)
            elif name == "chiron":
                if chiron is None:
                    continue  # optional SPK not configured
                pos = _planet_position(eph, "", t, t3, chiron_target=chiron)
            else:
                continue
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
                "jd": round(float(t.ut1), 8),
                "ramc": round(ramc, 6),
                "obliquity": round(obl, 6),
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
            orbs={k: min(orb, 3.0) for k, (_angle, orb) in ASPECT_DEFS.items()},
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

        Newton's method on JD with the true solar speed — converges in 3–4 steps.
        """
        natal = self.calc_natal(birth_dt, lat, lon, house_system)
        natal_sun_lon = natal["planets"]["sun"]["longitude"]

        try:
            seed_dt = birth_dt.replace(year=year)
        except ValueError:  # Feb 29 in a non-leap year
            seed_dt = birth_dt.replace(year=year, day=28)

        _, eph, _ = _sky()
        earth, sun = eph["earth"], eph["sun"]
        t = _time_from_dt(seed_dt)

        for _ in range(20):
            t3 = _t3(t)
            lons = _apparent_lon_series(earth, sun, t3)
            sun_lon = float(lons[1])
            speed = _signed_sep(float(lons[2]), float(lons[0])) / (2 * _SPEED_STEP_DAYS)
            diff = _signed_sep(natal_sun_lon, sun_lon)
            if abs(diff) < 1e-7:
                break
            t = _shift(t, diff / speed)

        sr_dt = t.utc_datetime()
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


def _is_applying(lon_a: float, speed_a: float, lon_b: float, speed_b: float,
                 asp_angle: float) -> bool:
    """True if the aspect is applying (deviation from exact is shrinking)."""
    sep = _signed_sep(lon_a, lon_b)
    d_abs_sep = math.copysign(1.0, sep or 1.0) * (speed_a - speed_b)
    return (abs(sep) - asp_angle) * d_abs_sep < 0


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
