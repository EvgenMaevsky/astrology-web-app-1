"""
Planetary terms (bounds) lookup.

Data parsed from ZET9 .ter files (Ptolemy, Egyptians, Lilly).
Each sign has 5 terms; we return which planet rules the given degree.
"""
from __future__ import annotations

import json
from pathlib import Path

_DATA = Path(__file__).parent.parent / "data" / "terms.json"

_TERMS: dict | None = None


def _load() -> dict:
    with open(_DATA, encoding="utf-8") as f:
        return json.load(f)


def get_terms(system: str = "ptolemy") -> list[list[dict]]:
    global _TERMS
    if _TERMS is None:
        _TERMS = _load()
    return _TERMS.get(system, _TERMS.get("ptolemy", []))


def get_term_ruler(longitude: float, system: str = "ptolemy") -> str | None:
    """Return the planet name that rules the term at the given ecliptic longitude."""
    terms = get_terms(system)
    sign_idx = int(longitude / 30) % 12
    if sign_idx >= len(terms):
        return None
    sign_degree = longitude % 30
    for term in terms[sign_idx]:
        if sign_degree < term["end"]:
            return term["planet"]
    return None


def add_terms_to_planets(planets: dict, system: str = "ptolemy") -> dict:
    """Annotate each planet dict with its term ruler."""
    for p in planets.values():
        p["term_ruler"] = get_term_ruler(p["longitude"], system)
    return planets
