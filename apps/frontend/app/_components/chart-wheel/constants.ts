// Standard Unicode astrological symbols — no custom font required
export const PLANET_GLYPHS: Record<string, string> = {
  sun:     "☉",  // U+2609
  moon:    "☽",  // U+263D
  mercury: "☿",  // U+263F
  venus:   "♀",  // U+2640
  mars:    "♂",  // U+2642
  jupiter: "♃",  // U+2643
  saturn:  "♄",  // U+2644
  uranus:  "♅",  // U+2645
  neptune: "♆",  // U+2646
  pluto:   "♇",  // U+2647
  true_node: "☊", // U+260A (North Node)
  lilith:  "⚸",  // U+26B8 (Black Moon Lilith)
  chiron:  "⚷",  // U+26B7
  asc:     "AC",
  mc:      "MC",
};

// Zodiac signs U+2648–U+2653 + U+FE0E (text variation selector, prevents emoji rendering)
export const SIGN_GLYPHS: string[] = [
  "♈︎", // Aries
  "♉︎", // Taurus
  "♊︎", // Gemini
  "♋︎", // Cancer
  "♌︎", // Leo
  "♍︎", // Virgo
  "♎︎", // Libra
  "♏︎", // Scorpio
  "♐︎", // Sagittarius
  "♑︎", // Capricorn
  "♒︎", // Aquarius
  "♓︎", // Pisces
];

export const ASPECT_GLYPHS: Record<string, string> = {
  conjunction:  "☌",  // U+260C
  opposition:   "☍",  // U+260D
  trine:        "△",  // U+25B3
  square:       "□",  // U+25A1
  sextile:      "⚹",  // U+26B9
  semisextile:  "⚺",  // U+26BA
  semisquare:   "∠",  // U+2220
  sesquisquare: "⚼",  // U+26BC
  quincunx:     "⚻",  // U+26BB
  quintile:     "Q",
  biquintile:   "bQ",
};

// Neutral "chrome" of the wheel — rings, ticks, cusps, labels — in the
// dashboard's ink/mist palette (docs/plans/2026-09-24-e7-redesign-design.md §6).
// Element and aspect colours below are semantic and deliberately untouched.
// Contrast on white: strong 16.8, mid 6.6, soft 3.4 (≥ 3:1 for graphics).
export const CHROME = {
  strong: "#1B1840", // ink-900: outer ring, cusp lines, planet glyphs and dots
  mid: "#5B5690",    // ink-600: zodiac ring edge, 10° ticks, cusp degrees, house numbers
  soft: "#8A85B8",   // sign sector borders
  light: "#A49ED0",  // 1° ticks, house-ring cusps, planet-to-dot connectors
  faint: "#CBC5EE",  // inner rings, degree-label boxes
} as const;

// ASC/DSC and the angular cusps: gold marks what matters most (gold-800).
export const ANGLE_GOLD = "#7A5410";

// Element colors for zodiac rings
export const ELEMENT_COLORS: Record<number, string> = {
  0: "#e05c3a", // Fire  — Aries, Leo, Sagittarius
  1: "#7a6540", // Earth — Taurus, Virgo, Capricorn
  2: "#4a8fc4", // Air   — Gemini, Libra, Aquarius
  3: "#5a6abe", // Water — Cancer, Scorpio, Pisces
};

export const ELEMENT_INDEX = [0, 1, 2, 3, 0, 1, 2, 3, 0, 1, 2, 3]; // by sign index

// Aspect line colors
export const ASPECT_COLORS: Record<string, string> = {
  conjunction:  "#c0392b",
  opposition:   "#c0392b",
  square:       "#c0392b",
  trine:        "#2980b9",
  sextile:      "#27ae60",
  semisextile:  "#8e44ad",
  semisquare:   "#d35400",
  sesquisquare: "#d35400",
  quincunx:     "#7f8c8d",
  quintile:     "#16a085",
  biquintile:   "#16a085",
};
