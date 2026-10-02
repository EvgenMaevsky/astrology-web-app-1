import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { interpretationSections, signOf, type ChartInput } from "./interpretation-keys.ts";

// The landing's sample: 1 Jan 1990, 12:00, Kyiv. ASC 21°29′ Pisces, MC 26°35′ Sagittarius.
const SAMPLE: ChartInput = JSON.parse(
  readFileSync(new URL("../_components/landing/sample-chart.json", import.meta.url), "utf8")
);

const keysOf = (chart: ChartInput, id: string) =>
  interpretationSections(chart).find((s) => s.id === id)?.keys ?? [];

// The same shapes as expected_keys() in services/astro-api/app/interpretations.
const KEY_SHAPES = [
  /^angle\.(asc|dsc|mc|ic)\.sign\.[a-z]+$/,
  /^cusp\.house\.(2|3|5|6|8|9|11|12)\.sign\.[a-z]+$/,
  /^planet\.[a-z_]+\.(sign\.[a-z]+|house\.(1[0-2]|[1-9]))$/,
  /^retrograde\.[a-z]+$/,
  /^aspect\.[a-z_]+\.(conjunction|sextile|square|trine|opposition|quincunx)\.[a-z_]+$/,
  /^synthesis\.(element\.[a-z]+\.(dominant|lacking)|modality\.[a-z]+\.dominant|stellium\.(sign\.[a-z]+|house\.\d+))$/,
];

test("every key has a shape the API knows", () => {
  for (const section of interpretationSections(SAMPLE)) {
    for (const key of section.keys) {
      assert.ok(KEY_SHAPES.some((re) => re.test(key)), key);
    }
  }
});

test("no key appears twice", () => {
  const all = interpretationSections(SAMPLE).flatMap((s) => s.keys);
  assert.equal(new Set(all).size, all.length);
});

test("angles in the sample chart", () => {
  assert.deepEqual(keysOf(SAMPLE, "angles"), [
    "angle.asc.sign.pisces",
    "angle.mc.sign.sagittarius",
    "angle.dsc.sign.virgo",
    "angle.ic.sign.gemini",
  ]);
});

test("planets keep their order, and the engine's true_node becomes north_node", () => {
  const signs = keysOf(SAMPLE, "signs");
  assert.equal(signs[0], "planet.sun.sign.capricorn");
  assert.ok(signs.some((k) => k.startsWith("planet.north_node.sign.")));
  assert.ok(!signs.some((k) => k.includes("true_node")));
});

test("cusps skip the angular houses", () => {
  const cusps = keysOf(SAMPLE, "cusps");
  assert.equal(cusps.length, 8);
  assert.ok(!cusps.some((k) => /\.house\.(1|4|7|10)\./.test(k)));
});

test("aspects follow body order, and opposite the north node reads as on the south node", () => {
  const chart: ChartInput = {
    ...SAMPLE,
    aspects: [
      { planet1: "true_node", planet2: "mars", aspect: "opposition", orb: 1 },
      { planet1: "moon", planet2: "sun", aspect: "trine", orb: 3 },
      { planet1: "sun", planet2: "venus", aspect: "semisextile", orb: 0.5 },
    ],
  };
  const aspects = keysOf(chart, "aspects").filter((k) => !/\.(asc|mc|dsc|ic)$/.test(k));
  assert.deepEqual(aspects, ["aspect.mars.conjunction.south_node", "aspect.sun.trine.moon"]);
});

test("aspects to angles: opposition to ASC reads as on the DSC; quincunx only when the chart has minors", () => {
  const base: ChartInput = {
    planets: {
      sun: { longitude: 180.5, sign: "Libra", house: 7, retrograde: false },
      moon: { longitude: 150.5, sign: "Virgo", house: 6, retrograde: false },
    },
    angles: { asc: 0, mc: 270, dsc: 180, ic: 90 },
    houses: [],
    aspects: [],
  };
  const free = keysOf(base, "aspects");
  assert.ok(free.includes("aspect.sun.conjunction.dsc"));
  assert.ok(!free.some((k) => k.includes("quincunx")));

  const pro = keysOf({ ...base, aspects: [{ planet1: "sun", planet2: "moon", aspect: "semisextile", orb: 0 }] }, "aspects");
  assert.ok(pro.includes("aspect.moon.quincunx.asc"));
});

test("retrograde: only bodies whose retrograde means something", () => {
  const chart: ChartInput = {
    ...SAMPLE,
    planets: {
      ...SAMPLE.planets,
      mercury: { ...SAMPLE.planets.mercury, retrograde: true },
      true_node: { ...SAMPLE.planets.true_node, retrograde: true },
    },
  };
  const retro = keysOf(chart, "retrograde");
  assert.ok(retro.includes("retrograde.mercury"));
  assert.ok(!retro.some((k) => k.includes("node")));
});

test("synthesis: a stellium and a dominant element", () => {
  const p = (longitude: number, sign: string, house: number) => ({ longitude, sign, house, retrograde: false });
  const chart: ChartInput = {
    planets: {
      sun: p(5, "Aries", 1), moon: p(8, "Aries", 1), mercury: p(12, "Aries", 1),
      venus: p(130, "Leo", 5), mars: p(250, "Sagittarius", 9),
      jupiter: p(40, "Taurus", 2), saturn: p(100, "Cancer", 4), uranus: p(70, "Gemini", 3),
      neptune: p(160, "Virgo", 6), pluto: p(200, "Libra", 7),
    },
    angles: { asc: 0, mc: 270, dsc: 180, ic: 90 },
    houses: [],
    aspects: [],
  };
  const synthesis = keysOf(chart, "synthesis");
  assert.ok(synthesis.includes("synthesis.element.fire.dominant"));
  assert.ok(synthesis.includes("synthesis.stellium.sign.aries"));
  assert.ok(synthesis.includes("synthesis.stellium.house.1"));
  assert.ok(!synthesis.some((k) => k.includes("water.lacking")));
});

test("signOf wraps around", () => {
  assert.equal(signOf(359.9), "pisces");
  assert.equal(signOf(360), "aries");
  assert.equal(signOf(-1), "pisces");
});
