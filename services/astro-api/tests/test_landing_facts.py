"""The landing page's trust numbers must match what the backend enforces.

apps/frontend/app/lib/landing-facts.ts states the calculable year range and
the accuracy against Swiss Ephemeris as fact. Neither can be imported by the
frontend, so they are mirrored there — and this test is what stops the
mirror from quietly drifting. Same pattern as test_plan_catalogue.py.
"""
import re
from pathlib import Path

import pytest

from app.schemas.chart import EPHEMERIS_MAX_YEAR, EPHEMERIS_MIN_YEAR

REPO = Path(__file__).resolve().parents[3]
FACTS = REPO / "apps" / "frontend" / "app" / "lib" / "landing-facts.ts"
CROSS_CHECK = Path(__file__).resolve().parent / "test_cross_swisseph.py"


def _ts_number(name: str) -> float:
    match = re.search(rf"\b{name}:\s*([0-9.]+)", FACTS.read_text(encoding="utf-8"))
    assert match, f"{name} not found in {FACTS}"
    return float(match.group(1))


pytestmark = pytest.mark.skipif(not FACTS.exists(), reason="frontend not present")


def test_year_range_matches_the_ephemeris_limits():
    assert _ts_number("yearFrom") == EPHEMERIS_MIN_YEAR
    assert _ts_number("yearTo") == EPHEMERIS_MAX_YEAR


def test_stated_precision_matches_the_swiss_ephemeris_tolerance():
    # Read from the test file rather than imported: importing it would pull
    # in pyswisseph, a dev-only AGPL oracle that may not be installed.
    match = re.search(r"^PLANET_TOL\s*=\s*([0-9.]+)", CROSS_CHECK.read_text(), re.MULTILINE)
    assert match, "PLANET_TOL not found"
    assert _ts_number("precisionDeg") == float(match.group(1))
