// ZastroCC Private Use Area codepoints (U+F0xx)
export const PLANET_GLYPHS: Record<string, string> = {
  sun:     "",
  moon:    "",
  mercury: "",
  venus:   "",
  mars:    "",
  jupiter: "",
  saturn:  "",
  uranus:  "",
  neptune: "",
  pluto:   "",
  asc:     "",
  mc:      "",
};

export const SIGN_GLYPHS: string[] = [
  "", // Aries
  "", // Taurus
  "", // Gemini
  "", // Cancer
  "", // Leo
  "", // Virgo
  "", // Libra
  "", // Scorpio
  "", // Sagittarius
  "", // Capricorn
  "", // Aquarius
  "", // Pisces
];

export const ASPECT_GLYPHS: Record<string, string> = {
  conjunction:  "",
  opposition:   "",
  trine:        "",
  square:       "",
  sextile:      "",
  semisquare:   "",
  semisextile:  "",
  quincunx:     "",
  quintile:     "",
  biquintile:   "",
  sesquisquare: "",
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
