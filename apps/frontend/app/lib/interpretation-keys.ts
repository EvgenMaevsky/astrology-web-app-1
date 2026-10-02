/**
 * Which interpretation texts a natal chart shows, as keys into the texts the
 * API serves (services/astro-api/app/interpretations — the key grammar is
 * defined there, in expected_keys()). Pure, so it is unit-tested in
 * interpretation-keys.test.ts. Design: docs/plans/2026-10-02-e10-interpretations.md.
 *
 * Only what the chart already contains is interpreted: a Free chart carries
 * no minor aspects, so it gets no quincunx texts, with no plan check here.
 */

export interface ChartInput {
  planets: Record<string, { longitude: number; sign: string; house: number; retrograde: boolean }>;
  angles: { asc: number; mc: number; dsc: number; ic: number };
  houses: number[];
  aspects: { planet1: string; planet2: string; aspect: string; orb: number }[];
}

export type SectionId = "angles" | "signs" | "houses" | "retrograde" | "cusps" | "aspects" | "synthesis";

export interface Section {
  id: SectionId;
  keys: string[];
}

export const SIGNS = [
  "aries", "taurus", "gemini", "cancer", "leo", "virgo",
  "libra", "scorpio", "sagittarius", "capricorn", "aquarius", "pisces",
] as const;

/** Order of importance, which is also the display order. */
export const BODIES = [
  "sun", "moon", "mercury", "venus", "mars", "jupiter", "saturn",
  "uranus", "neptune", "pluto", "north_node", "lilith", "chiron",
] as const;

const RETROGRADE_BODIES = new Set(["mercury", "venus", "mars", "jupiter", "saturn", "uranus", "neptune", "pluto", "chiron"]);
const ASPECT_TYPES = new Set(["conjunction", "sextile", "square", "trine", "opposition", "quincunx"]);
const MINOR_TYPES = new Set(["semisextile", "semisquare", "sesquisquare", "quincunx", "quintile", "biquintile"]);
const CUSP_HOUSES = [2, 3, 5, 6, 8, 9, 11, 12];
/** The ten planets: element, modality and stellium counts use only these. */
const PLANETS = BODIES.slice(0, 10) as readonly string[];

const ELEMENTS = ["fire", "earth", "air", "water"] as const;
const MODALITIES = ["cardinal", "fixed", "mutable"] as const;

/**
 * Orbs for aspects to the angles, tighter than planet-to-planet ones: an
 * angle moves a degree every four minutes, so a wide orb would read a
 * birth-time guess as a fact.
 */
export const ANGLE_ORBS: Record<string, [number, number]> = {
  conjunction: [0, 7],
  sextile: [60, 4],
  square: [90, 6],
  trine: [120, 6],
  opposition: [180, 7],
  quincunx: [150, 2],
};

/** Element dominant at this many of the ten planets; lacking at zero. */
export const ELEMENT_DOMINANT = 4;
export const MODALITY_DOMINANT = 5;
export const STELLIUM = 3;

/** The engine's name for the north node is true_node. */
function bodyId(name: string): string {
  return name === "true_node" ? "north_node" : name;
}

export function signOf(longitude: number): (typeof SIGNS)[number] {
  return SIGNS[Math.floor((((longitude % 360) + 360) % 360) / 30)];
}

function separation(a: number, b: number): number {
  const d = Math.abs((((a - b) % 360) + 360) % 360);
  return d > 180 ? 360 - d : d;
}

function bodyRank(id: string): number {
  const i = (BODIES as readonly string[]).indexOf(id);
  return i === -1 ? Number.MAX_SAFE_INTEGER : i;
}

function aspectKeys(chart: ChartInput): string[] {
  const found: { key: string; orb: number }[] = [];
  for (const a of chart.aspects) {
    if (!ASPECT_TYPES.has(a.aspect)) continue;
    let [p, q] = [bodyId(a.planet1), bodyId(a.planet2)];
    if (bodyRank(p) === Number.MAX_SAFE_INTEGER || bodyRank(q) === Number.MAX_SAFE_INTEGER) continue;
    if (bodyRank(p) > bodyRank(q)) [p, q] = [q, p];
    // Opposite the north node is ON the south node — the telling reading.
    const key =
      q === "north_node" && a.aspect === "opposition"
        ? `aspect.${p}.conjunction.south_node`
        : `aspect.${p}.${a.aspect}.${q}`;
    found.push({ key, orb: a.orb });
  }
  return found.sort((x, y) => x.orb - y.orb).map((f) => f.key);
}

function angleAspectKeys(chart: ChartInput, includeQuincunx: boolean): string[] {
  const found: { key: string; orb: number; rank: number }[] = [];
  for (const [name, p] of Object.entries(chart.planets)) {
    const id = bodyId(name);
    if (bodyRank(id) === Number.MAX_SAFE_INTEGER) continue;
    for (const angle of ["asc", "mc"] as const) {
      const sep = separation(p.longitude, chart.angles[angle]);
      for (const [type, [exact, orb]] of Object.entries(ANGLE_ORBS)) {
        if (type === "quincunx" && !includeQuincunx) continue;
        const off = Math.abs(sep - exact);
        if (off > orb) continue;
        // Opposite ASC is on the DSC; opposite MC is on the IC.
        const key =
          type === "opposition"
            ? `aspect.${id}.conjunction.${angle === "asc" ? "dsc" : "ic"}`
            : `aspect.${id}.${type}.${angle}`;
        found.push({ key, orb: off, rank: bodyRank(id) });
      }
    }
  }
  return found.sort((x, y) => x.orb - y.orb || x.rank - y.rank).map((f) => f.key);
}

function synthesisKeys(chart: ChartInput): string[] {
  const keys: string[] = [];
  const planets = PLANETS.filter((id) => chart.planets[id]).map((id) => chart.planets[id]);
  const signIndex = (sign: string) => (SIGNS as readonly string[]).indexOf(sign.toLowerCase());

  const elements = [0, 0, 0, 0];
  const modalities = [0, 0, 0];
  const bySign = new Map<string, number>();
  const byHouse = new Map<number, number>();
  for (const p of planets) {
    const i = signIndex(p.sign);
    if (i < 0) continue;
    elements[i % 4]++;
    modalities[i % 3]++;
    bySign.set(SIGNS[i], (bySign.get(SIGNS[i]) ?? 0) + 1);
    byHouse.set(p.house, (byHouse.get(p.house) ?? 0) + 1);
  }
  ELEMENTS.forEach((e, i) => {
    if (elements[i] >= ELEMENT_DOMINANT) keys.push(`synthesis.element.${e}.dominant`);
  });
  ELEMENTS.forEach((e, i) => {
    if (elements[i] === 0) keys.push(`synthesis.element.${e}.lacking`);
  });
  MODALITIES.forEach((m, i) => {
    if (modalities[i] >= MODALITY_DOMINANT) keys.push(`synthesis.modality.${m}.dominant`);
  });
  for (const sign of SIGNS) if ((bySign.get(sign) ?? 0) >= STELLIUM) keys.push(`synthesis.stellium.sign.${sign}`);
  for (let h = 1; h <= 12; h++) if ((byHouse.get(h) ?? 0) >= STELLIUM) keys.push(`synthesis.stellium.house.${h}`);
  return keys;
}

export function interpretationSections(chart: ChartInput): Section[] {
  const planet = (id: string) => chart.planets[id === "north_node" ? "true_node" : id];
  const bodies = BODIES.filter((id) => planet(id));
  // A Pro chart always carries some minor aspect; a Free one never does.
  const includeQuincunx = chart.aspects.some((a) => MINOR_TYPES.has(a.aspect));

  const sections: Section[] = [
    {
      id: "angles",
      keys: (["asc", "mc", "dsc", "ic"] as const).map((a) => `angle.${a}.sign.${signOf(chart.angles[a])}`),
    },
    { id: "signs", keys: bodies.map((id) => `planet.${id}.sign.${planet(id).sign.toLowerCase()}`) },
    { id: "houses", keys: bodies.map((id) => `planet.${id}.house.${planet(id).house}`) },
    { id: "retrograde", keys: bodies.filter((id) => RETROGRADE_BODIES.has(id) && planet(id).retrograde).map((id) => `retrograde.${id}`) },
    {
      id: "cusps",
      keys: chart.houses.length === 12 ? CUSP_HOUSES.map((h) => `cusp.house.${h}.sign.${signOf(chart.houses[h - 1])}`) : [],
    },
    { id: "aspects", keys: [...angleAspectKeys(chart, includeQuincunx), ...aspectKeys(chart)] },
    { id: "synthesis", keys: synthesisKeys(chart) },
  ];
  return sections.filter((s) => s.keys.length > 0);
}
