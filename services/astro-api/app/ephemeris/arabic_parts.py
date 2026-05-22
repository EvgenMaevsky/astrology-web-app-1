"""
Arabic parts (Lots) calculator.

Formula syntax (from ZET9 .prs files):
  H1+[Lun-Sun]        ASC + Moon - Sun (day) / ASC + Sun - Moon (night)
  H1+Sat-Mar          ASC + Saturn - Mars  (no day/night reversal)
  H1-Sun+Lun+[Jup-H1] composite formula with bracket group
  H10                 just MC longitude
"""
from __future__ import annotations

import json
import re
from pathlib import Path

_DATA = Path(__file__).parent.parent / "data" / "arabic_parts.json"

# Planet abbreviation → engine key
_PLANET = {
    "Sun": "sun", "Lun": "moon", "Sel": "moon",
    "Mer": "mercury", "Ven": "venus", "Mar": "mars",
    "Jup": "jupiter", "Sat": "saturn", "Ura": "uranus",
    "Nep": "neptune", "Plu": "pluto",
}

_SIGNS = [
    "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
    "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces",
]

_TOKEN_RE = re.compile(
    r"([+\-]?)"
    r"(H\d{1,2}|D\d{1,2}|Sun|Lun|Sel|Mer|Ven|Mar|Jup|Sat|Ura|Nep|Plu|Chi|Lil|Pro|\d+(?:\.\d+)?)"
)


def _load_parts() -> list[dict]:
    with open(_DATA, encoding="utf-8") as f:
        return json.load(f)


_PARTS: list[dict] | None = None


def get_parts() -> list[dict]:
    global _PARTS
    if _PARTS is None:
        _PARTS = _load_parts()
    return _PARTS


def _is_day_chart(planets: dict, houses: list[float]) -> bool:
    """Day chart: Sun is in houses 7–12 (above the horizon)."""
    sun_lon = planets.get("sun", {}).get("longitude", 0.0)
    for i in range(12):
        c1 = houses[i]
        c2 = houses[(i + 1) % 12]
        in_house = (c1 <= sun_lon < c2) if c1 <= c2 else (sun_lon >= c1 or sun_lon < c2)
        if in_house:
            return i + 1 >= 7
    return True


def _resolve_token(token: str, planets: dict, houses: list[float]) -> float | None:
    """Return ecliptic longitude for a single token (planet/house/number)."""
    m = re.match(r"^[HD](\d{1,2})$", token)
    if m:
        idx = int(m.group(1)) - 1
        return houses[idx] if 0 <= idx < len(houses) else None
    if token in _PLANET:
        p = planets.get(_PLANET[token])
        return p["longitude"] if p else None
    try:
        return float(token)
    except ValueError:
        return None


def _expand_brackets(formula: str, is_day: bool) -> str:
    """Replace [A-B] with +A-B (day) or +B-A (night)."""
    def _sub(m: re.Match) -> str:
        inner = m.group(1)
        halves = inner.split("-", 1)
        if len(halves) == 2:
            a, b = halves
            return f"+{a}-{b}" if is_day else f"+{b}-{a}"
        return f"+{inner}"
    return re.sub(r"\[([^\]]+)\]", _sub, formula)


def calc_part(formula: str, planets: dict, houses: list[float], is_day: bool) -> float | None:
    """Compute Arabic part longitude (0–360) from a formula string."""
    expanded = _expand_brackets(formula.replace(" ", ""), is_day)
    tokens = _TOKEN_RE.findall(expanded)
    if not tokens:
        return None

    result = 0.0
    for idx, (sign, token) in enumerate(tokens):
        # Unknown / unsupported bodies (Chiron, Lilith, Fortune-recursive)
        if token in ("Chi", "Lil", "Pro"):
            return None
        val = _resolve_token(token, planets, houses)
        if val is None:
            return None
        if idx == 0 and sign in ("", "+"):
            result = val
        elif sign == "-":
            result -= val
        else:
            result += val

    return result % 360


def compute_arabic_parts(
    planets: dict, houses: list[float]
) -> list[dict]:
    """Compute all Arabic parts for a natal chart."""
    is_day = _is_day_chart(planets, houses)
    results: list[dict] = []
    for part in get_parts():
        formula = part.get("formula", "")
        if not formula:
            continue
        lon = calc_part(formula, planets, houses, is_day)
        if lon is None:
            continue
        sign_idx = int(lon / 30) % 12
        results.append({
            "name": part["name"],
            "longitude": round(lon, 4),
            "sign": _SIGNS[sign_idx],
            "sign_degree": round(lon % 30, 4),
        })
    return results
