"""Natal interpretation texts: coverage, uniqueness and language.

The owner's base (docs/plans/2026-10-02-e10-interpretations.md) was built by
filling one template per section, so the same sentence recurred hundreds of
times and nouns were never declined. These tests exist so the rewrite cannot
slide back into either.
"""
import re
from collections import Counter

import pytest
from httpx import AsyncClient

from app.interpretations import expected_keys, load

TEXTS = load("uk")
EXPECTED = set(expected_keys())


def _sentences(text: str) -> list[str]:
    return [s.strip() for s in re.split(r"(?<=[.!?…])\s+", text) if s.strip()]


def test_every_key_in_the_data_is_one_the_app_can_ask_for():
    # A typo in a key is a text nobody will ever see.
    assert set(TEXTS) <= EXPECTED, sorted(set(TEXTS) - EXPECTED)[:20]


@pytest.mark.xfail(reason="E10: texts are being written section by section", strict=False)
def test_every_key_the_app_can_ask_for_has_a_text():
    missing = sorted(EXPECTED - set(TEXTS))
    assert not missing, f"{len(missing)} missing, e.g. {missing[:10]}"


def test_entries_are_well_formed():
    for key, entry in TEXTS.items():
        assert set(entry) == {"title", "text"}, key
        assert entry["title"].strip(), key
        paragraphs = entry["text"].split("\n\n")
        # Prose, not bullet points: the competitor's style the owner chose.
        assert all(not p.lstrip().startswith(("-", "*", "•")) for p in paragraphs), key
        assert all(p.strip() == p and p for p in paragraphs), key
        words = len(entry["text"].split())
        # Floor raised as sections were finished: short texts read as filler
        # next to the competitor's, which the owner set as the bar.
        assert 40 <= words <= 320, f"{key}: {words} words"


def test_no_paragraph_appears_twice():
    counts = Counter(p for e in TEXTS.values() for p in e["text"].split("\n\n"))
    repeated = [p[:80] for p, n in counts.items() if n > 1]
    assert not repeated, repeated[:5]


def test_no_long_sentence_appears_in_two_entries():
    # The base repeated one "integration" sentence across all 546 aspects.
    seen: dict[str, str] = {}
    clashes = []
    for key, entry in TEXTS.items():
        for sentence in set(_sentences(entry["text"])):
            if len(sentence) < 60:
                continue
            if sentence in seen and seen[sentence] != key:
                clashes.append((seen[sentence], key, sentence[:80]))
            seen.setdefault(sentence, key)
    assert not clashes, clashes[:5]


def _five_grams(text: str) -> set[str]:
    words = text.lower().split()
    return {" ".join(words[i : i + 5]) for i in range(len(words) - 4)}


def test_planet_on_an_angle_is_not_a_reworded_house_text():
    # A planet conjunct an angle reads close to the same planet in the
    # matching house; the first drafts copied sentences across. Allow a
    # couple of shared phrases, not a paraphrase.
    house_of = {"asc": 1, "ic": 4, "dsc": 7, "mc": 10}
    clashes = []
    for key, entry in TEXTS.items():
        parts = key.split(".")
        if parts[0] == "aspect" and parts[2] == "conjunction" and parts[3] in house_of:
            house = f"planet.{parts[1]}.house.{house_of[parts[3]]}"
            if house in TEXTS:
                shared = _five_grams(entry["text"]) & _five_grams(TEXTS[house]["text"])
                if len(shared) >= 3:
                    clashes.append((key, house, len(shared)))
    assert not clashes, clashes


SIGN_NOMINATIVE = "Овен|Телець|Близнюки|Рак|Лев|Діва|Терези|Скорпіон|Стрілець|Козеріг|Водолій|Риби"
LANGUAGE_REGRESSIONS = {
    # The base's errors, found in the 2026-10-02 audit.
    "Козоріг instead of Козеріг": r"Козоріг",
    "sign left in the nominative after в/у": rf"\b[уВв] ({SIGN_NOMINATIVE})\b(?! —)",
    "angle not in the instrumental after з": r"\bз (Асцендент|Десцендент)\b",
    "retrograde gender": r"Ретроградний Венера",
    "planet name in lower case": r"\b(тему|якості|на рівні) (сонце|місяць|меркурій|венера|марс|юпітер|сатурн|уран|нептун|плутон)\b",
    # Editorial principles of the base itself.
    "fatalistic wording": r"(приречен|обов’язково станеться|обов'язково станеться|точно буде розлучення)",
    "Russian-style quote marks": r"[„“”]",
    # "Людина" is grammatically feminine, which made "вона може стати
    # вчителькою" read as if every reader were a woman. Keep roles neutral.
    "gendered role nouns": (
        r"\b(вчительк|викладачк|дослідниц|мандрівниц|шукачк|лідерк|керівниц|підприємиц|"
        r"спортсменк|проповідниц|працівниц|помічниц|цілительк|оповідачк|слухачк|наставниц|"
        r"провідниц|втішниц|майстрин|авторк|організаторк|посередниц)(я|а|і|и|ею|ою|ю|у|ям|ями|ах)\b"
    ),
}


@pytest.mark.parametrize("name,pattern", LANGUAGE_REGRESSIONS.items())
def test_language_regressions(name, pattern):
    hits = [
        (k, m.group(0))
        for k, e in TEXTS.items()
        for m in re.finditer(pattern, e["title"] + "\n" + e["text"])
    ]
    assert not hits, f"{name}: {hits[:5]}"


async def test_endpoint_returns_known_keys_and_skips_unknown(client: AsyncClient):
    known = next(iter(TEXTS), None)
    if known is None:
        pytest.skip("no texts yet")
    r = await client.get("/api/v1/interpretations", params={"keys": f"{known},planet.nope.sign.aries"})
    assert r.status_code == 200
    assert list(r.json()) == [known]
    assert r.headers["cache-control"] == "public, max-age=3600"


async def test_endpoint_rejects_unknown_language_and_too_many_keys(client: AsyncClient):
    r = await client.get("/api/v1/interpretations", params={"keys": "a", "lang": "xx"})
    assert r.status_code == 422
    r = await client.get("/api/v1/interpretations", params={"keys": ",".join(f"k{i}" for i in range(201))})
    assert r.status_code == 422
