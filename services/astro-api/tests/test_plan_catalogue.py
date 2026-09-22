"""The advertised catalogue must match what the code actually enforces.

The E4 review found the two failure modes this guards against: Pro sold
"all major & minor aspects" while every plan already received all eleven,
and Free advertised "7 major aspects" when no set of seven exists anywhere
in the engine. Both were invisible because nothing compared the sales copy
to the behaviour. See docs/plans/2026-09-20-e4-plan-rework.md.
"""
import json
from pathlib import Path

import pytest

from app.ephemeris.engine import MAJOR_ASPECT_DEFS, MINOR_ASPECT_DEFS
from app.routers.billing import PLANS
from app.routers.charts import FREE_ADVANCED_DAILY_LIMIT
from app.config import settings

UK_MESSAGES = (
    Path(__file__).resolve().parents[3] / "apps" / "frontend" / "messages" / "uk.json"
)


def _plan(plan_id: str) -> dict:
    return next(p for p in PLANS if p["id"] == plan_id)


def test_no_plan_quotes_a_number_of_aspects():
    # Neither plan caps how many aspects a chart returns — only WHICH TYPES
    # are included. An earlier wording, "5 major aspects", was read as a
    # per-chart quota by the product owner, so it would certainly be read
    # that way by a customer, and it made Free look artificially crippled.
    for plan in PLANS:
        for feature in plan["features"]:
            if "aspect" in feature.lower():
                assert not any(ch.isdigit() for ch in feature), (
                    f"{plan['id']}: {feature!r} reads as a quantity limit"
                )


def test_the_aspect_split_is_what_the_engine_actually_has():
    assert len(MAJOR_ASPECT_DEFS) == 5
    assert len(MINOR_ASPECT_DEFS) == 6
    assert not (set(MAJOR_ASPECT_DEFS) & set(MINOR_ASPECT_DEFS))


def test_minor_aspects_are_sold_by_pro_and_not_by_free():
    assert any("minor" in f.lower() for f in _plan("pro")["features"])
    assert not any("minor" in f.lower() for f in _plan("free")["features"])


def test_advertised_daily_allowance_matches_the_enforced_one():
    assert f"{FREE_ADVANCED_DAILY_LIMIT} advanced charts per day" in _plan("free")["features"]
    assert _plan("free")["limits"]["advanced_charts_per_day"] == FREE_ADVANCED_DAILY_LIMIT


def test_advertised_saved_chart_limit_matches_the_enforced_one():
    assert f"{settings.max_saved_charts_free} saved charts" in _plan("free")["features"]
    assert _plan("free")["limits"]["saved_charts"] == settings.max_saved_charts_free


def test_free_plan_no_longer_advertises_a_natal_cap():
    features = _plan("free")["features"]
    assert "Unlimited natal charts" in features
    assert "natal_charts_per_day" not in _plan("free")["limits"]


@pytest.mark.skipif(not UK_MESSAGES.exists(), reason="frontend messages not present")
def test_every_advertised_feature_has_a_ukrainian_translation():
    # A missing key does not fail loudly — the UI silently prints the English
    # string to a Ukrainian-speaking visitor.
    dictionary = json.loads(UK_MESSAGES.read_text(encoding="utf-8"))["billing"]["features"]
    missing = [
        f for plan in PLANS for f in plan["features"] if f not in dictionary
    ]
    assert not missing, f"no Ukrainian translation for: {missing}"
