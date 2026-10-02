/**
 * The astrological symbols shown before an interpretation title — the same
 * glyphs the chart wheel draws, so a reader can match a text to the wheel at
 * a glance. Pure; see interpretation-glyphs.test.ts.
 */
import { ASPECT_GLYPHS, PLANET_GLYPHS, SIGN_GLYPHS } from "../_components/chart-wheel/constants.ts";

const SIGNS = [
  "aries", "taurus", "gemini", "cancer", "leo", "virgo",
  "libra", "scorpio", "sagittarius", "capricorn", "aquarius", "pisces",
];

const ANGLE_LABELS: Record<string, string> = { asc: "ASC", dsc: "DSC", mc: "MC", ic: "IC" };
const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];

// Elements and modalities have no glyph of their own: show their signs.
const ELEMENT_SIGNS: Record<string, number[]> = { fire: [0, 4, 8], earth: [1, 5, 9], air: [2, 6, 10], water: [3, 7, 11] };
const MODALITY_SIGNS: Record<string, number[]> = { cardinal: [0, 3, 6, 9], fixed: [1, 4, 7, 10], mutable: [2, 5, 8, 11] };

const sign = (name: string) => SIGN_GLYPHS[SIGNS.indexOf(name)] ?? "";
const roman = (n: string) => ROMAN[Number(n) - 1] ?? n;

function body(id: string): string {
  if (id === "north_node") return PLANET_GLYPHS.true_node;
  if (id === "south_node") return "☋";
  if (id in ANGLE_LABELS) return ANGLE_LABELS[id];
  return PLANET_GLYPHS[id] ?? "";
}

/** Symbols for an interpretation key, as separate tokens; [] if unknown. */
export function glyphsFor(key: string): string[] {
  const p = key.split(".");
  switch (p[0]) {
    case "angle":
      return [ANGLE_LABELS[p[1]], sign(p[3])];
    case "cusp":
      return [roman(p[2]), sign(p[4])];
    case "planet":
      return p[2] === "sign" ? [body(p[1]), sign(p[3])] : [body(p[1]), roman(p[3])];
    case "retrograde":
      return [body(p[1]), "℞"];
    case "aspect":
      return [body(p[1]), ASPECT_GLYPHS[p[2]] ?? "", body(p[3])];
    case "synthesis":
      if (p[1] === "element") return ELEMENT_SIGNS[p[2]].map((i) => SIGN_GLYPHS[i]);
      if (p[1] === "modality") return MODALITY_SIGNS[p[2]].map((i) => SIGN_GLYPHS[i]);
      if (p[1] === "stellium") return ["✶", p[2] === "sign" ? sign(p[3]) : roman(p[3])];
      return [];
    default:
      return [];
  }
}
