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
