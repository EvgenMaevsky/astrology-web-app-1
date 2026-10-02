import { test } from "node:test";
import assert from "node:assert/strict";
import { glyphsFor } from "./interpretation-glyphs.ts";

test("planet in a sign and in a house", () => {
  assert.deepEqual(glyphsFor("planet.sun.sign.capricorn"), ["☉", "♑︎"]);
  assert.deepEqual(glyphsFor("planet.moon.house.12"), ["☽", "XII"]);
  assert.deepEqual(glyphsFor("planet.north_node.sign.aquarius"), ["☊", "♒︎"]);
});

test("angles and cusps", () => {
  assert.deepEqual(glyphsFor("angle.asc.sign.pisces"), ["ASC", "♓︎"]);
  assert.deepEqual(glyphsFor("cusp.house.8.sign.scorpio"), ["VIII", "♏︎"]);
});

test("aspects between bodies, to angles and to the south node", () => {
  assert.deepEqual(glyphsFor("aspect.sun.trine.moon"), ["☉", "△", "☽"]);
  assert.deepEqual(glyphsFor("aspect.venus.conjunction.dsc"), ["♀", "☌", "DSC"]);
  assert.deepEqual(glyphsFor("aspect.mars.conjunction.south_node"), ["♂", "☌", "☋"]);
});

test("retrograde and synthesis", () => {
  assert.deepEqual(glyphsFor("retrograde.mercury"), ["☿", "℞"]);
  assert.equal(glyphsFor("synthesis.element.fire.dominant").length, 3);
  assert.equal(glyphsFor("synthesis.modality.fixed.dominant").length, 4);
  assert.deepEqual(glyphsFor("synthesis.stellium.house.10"), ["✶", "X"]);
});

test("no token is ever empty for a real key", () => {
  for (const key of [
    "planet.chiron.house.1", "planet.lilith.sign.leo", "aspect.pluto.quincunx.mc",
    "aspect.north_node.sextile.chiron", "synthesis.stellium.sign.aries",
  ]) {
    assert.ok(glyphsFor(key).every((g) => g.length > 0), key);
  }
});
