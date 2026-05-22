/** Convert ecliptic longitude to SVG angle (radians), given ASC longitude.
 *  ASC is placed at 9 o'clock (left). Signs go counter-clockwise. */
export function eclToSvg(lon: number, asc: number): number {
  const rel = ((lon - asc) % 360 + 360) % 360;
  return ((180 + rel) * Math.PI) / 180;
}

/** Polar → cartesian relative to SVG centre. */
export function polar(cx: number, cy: number, r: number, angleRad: number) {
  return {
    x: cx + r * Math.cos(angleRad),
    y: cy + r * Math.sin(angleRad),
  };
}

/** SVG arc path between two angles (counter-clockwise = astro convention). */
export function arcPath(
  cx: number,
  cy: number,
  r: number,
  startRad: number,
  endRad: number,
  sweepCcw = true
): string {
  const s = polar(cx, cy, r, startRad);
  const e = polar(cx, cy, r, endRad);

  // Span in radians
  let span = endRad - startRad;
  if (sweepCcw) span = ((span % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);

  const largeArc = span > Math.PI ? 1 : 0;
  const sweep = sweepCcw ? 1 : 0; // SVG sweep-flag: 1=clockwise, 0=ccw
  // We go counter-clockwise in astrology but SVG sweeps clockwise by default.
  // Since rel increases counter-clockwise and our svg angles increase that way too,
  // we set sweep=1 (clockwise SVG) for a counter-clockwise astro arc.
  return `M ${s.x} ${s.y} A ${r} ${r} 0 ${largeArc} ${sweep} ${e.x} ${e.y}`;
}

/** Filled sector path (two arcs + lines). */
export function sectorPath(
  cx: number,
  cy: number,
  r1: number,
  r2: number,
  startRad: number,
  endRad: number
): string {
  const s1 = polar(cx, cy, r1, startRad);
  const e1 = polar(cx, cy, r1, endRad);
  const s2 = polar(cx, cy, r2, startRad);
  const e2 = polar(cx, cy, r2, endRad);

  let span = endRad - startRad;
  span = ((span % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  const largeArc = span > Math.PI ? 1 : 0;

  return [
    `M ${s1.x} ${s1.y}`,
    `A ${r1} ${r1} 0 ${largeArc} 1 ${e1.x} ${e1.y}`,
    `L ${e2.x} ${e2.y}`,
    `A ${r2} ${r2} 0 ${largeArc} 0 ${s2.x} ${s2.y}`,
    "Z",
  ].join(" ");
}

/** Format ecliptic longitude as "Sign DD°MM'" string. */
const SIGN_NAMES = [
  "Ari", "Tau", "Gem", "Can", "Leo", "Vir",
  "Lib", "Sco", "Sag", "Cap", "Aqu", "Pis",
];
export function formatLon(lon: number): string {
  const norm = ((lon % 360) + 360) % 360;
  const sign = Math.floor(norm / 30);
  const deg = Math.floor(norm % 30);
  const min = Math.floor(((norm % 30) - deg) * 60);
  return `${SIGN_NAMES[sign]} ${deg}°${String(min).padStart(2, "0")}'`;
}
