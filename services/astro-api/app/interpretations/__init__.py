"""Pre-written natal interpretations, looked up by key.

See docs/plans/2026-10-02-e10-interpretations.md. The texts live in
app/interpretations/<lang>/*.json as {key: {"title": ..., "text": ...}};
paragraphs inside "text" are separated by a blank line. Splitting across
files is only for editing convenience — the loader merges them and refuses
a key defined twice.

The key grammar is defined once, in expected_keys(): the coverage test
checks every key it lists exists, and the frontend's interpretationKeys()
only ever produces keys of these shapes.
"""
from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path

DATA_DIR = Path(__file__).parent
LANGUAGES = ("uk",)

SIGNS = (
    "aries", "taurus", "gemini", "cancer", "leo", "virgo",
    "libra", "scorpio", "sagittarius", "capricorn", "aquarius", "pisces",
)
# The engine's true_node is shown as north_node: the texts treat the nodes as
# an axis, so the south node has no sign/house texts of its own.
BODIES = (
    "sun", "moon", "mercury", "venus", "mars", "jupiter", "saturn",
    "uranus", "neptune", "pluto", "north_node", "lilith", "chiron",
)
# Bodies that can be retrograde in a meaningful sense (the nodes and the mean
# Lilith are excluded: their "retrograde" is a computational artefact).
RETROGRADE_BODIES = (
    "mercury", "venus", "mars", "jupiter", "saturn", "uranus", "neptune", "pluto", "chiron",
)
# Five majors plus the quincunx — the only aspect types the base has pair
# texts for. The quincunx is minor in this app, so it only appears for Pro.
ASPECT_TYPES = ("conjunction", "sextile", "square", "trine", "opposition", "quincunx")
ANGLES = ("asc", "dsc", "mc", "ic")
# Houses whose cusp is not itself an angle (1/4/7/10 are ASC/IC/DSC/MC).
CUSP_HOUSES = (2, 3, 5, 6, 8, 9, 11, 12)
ELEMENTS = ("fire", "earth", "air", "water")
MODALITIES = ("cardinal", "fixed", "mutable")


# Mercury never strays more than ~28° from the Sun and Venus ~48°, so these
# pairs can only form the listed aspects; texts for the rest would never show.
POSSIBLE_ONLY: dict[tuple[str, str], tuple[str, ...]] = {
    ("sun", "mercury"): ("conjunction",),
    ("sun", "venus"): ("conjunction",),
    ("mercury", "venus"): ("conjunction", "sextile"),
}


def expected_keys() -> list[str]:
    keys: list[str] = []
    keys += [f"angle.{a}.sign.{s}" for a in ANGLES for s in SIGNS]
    keys += [f"cusp.house.{h}.sign.{s}" for h in CUSP_HOUSES for s in SIGNS]
    keys += [f"planet.{b}.sign.{s}" for b in BODIES for s in SIGNS]
    keys += [f"planet.{b}.house.{h}" for b in BODIES for h in range(1, 13)]
    keys += [f"retrograde.{b}" for b in RETROGRADE_BODIES]
    for i, a in enumerate(BODIES):
        for b in BODIES[i + 1:]:
            types = POSSIBLE_ONLY.get((a, b), ASPECT_TYPES)
            # Opposite the north node is read as on the south node (below).
            if b == "north_node":
                types = tuple(t for t in types if t != "opposition")
            keys += [f"aspect.{a}.{t}.{b}" for t in types]
    # A body on the south node is read in its own right; every other aspect
    # to the south node mirrors one to the north node, which is shown instead.
    keys += [f"aspect.{b}.conjunction.south_node" for b in BODIES if b != "north_node"]
    # Aspects to ASC and MC; the opposition to either is shown as the
    # conjunction with DSC / IC, which is the more telling reading.
    for b in BODIES:
        keys += [f"aspect.{b}.{t}.{a}" for a in ("asc", "mc") for t in ASPECT_TYPES if t != "opposition"]
        keys += [f"aspect.{b}.conjunction.{a}" for a in ("dsc", "ic")]
    keys += [f"synthesis.element.{e}.{k}" for e in ELEMENTS for k in ("dominant", "lacking")]
    keys += [f"synthesis.modality.{m}.dominant" for m in MODALITIES]
    keys += [f"synthesis.stellium.sign.{s}" for s in SIGNS]
    keys += [f"synthesis.stellium.house.{h}" for h in range(1, 13)]
    return keys


@lru_cache(maxsize=len(LANGUAGES))
def load(lang: str) -> dict[str, dict[str, str]]:
    """All texts for a language. Cached: the files only change on deploy."""
    if lang not in LANGUAGES:
        raise ValueError(f"unsupported language: {lang}")
    merged: dict[str, dict[str, str]] = {}
    for path in sorted((DATA_DIR / lang).glob("*.json")):
        for key, entry in json.loads(path.read_text(encoding="utf-8")).items():
            if key in merged:
                raise ValueError(f"{key} defined twice (second time in {path.name})")
            merged[key] = entry
    return merged
