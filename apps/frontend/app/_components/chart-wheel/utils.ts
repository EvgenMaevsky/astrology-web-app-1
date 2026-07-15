/** Convert ecliptic longitude to SVG angle (radians), given ASC longitude.
 *  ASC is placed at 9 o'clock (left). Signs go counter-clockwise.
 *  SVG's y-axis points down, so increasing screen angle runs clockwise —
 *  we negate rel to make growing longitude sweep counter-clockwise
 *  (ASC left, IC bottom, DSC right, MC top). */
export function eclToSvg(lon: number, asc: number): number {
  const rel = ((lon - asc) % 360 + 360) % 360;
  return ((180 - rel) * Math.PI) / 180;
}

/** Polar → cartesian relative to SVG centre. */
export function polar(cx: number, cy: number, r: number, angleRad: number) {
  return {
    x: cx + r * Math.cos(angleRad),
    y: cy + r * Math.sin(angleRad),
  };
}

/** SVG arc path from startRad to endRad along decreasing screen angle
 *  (= counter-clockwise visually = increasing ecliptic longitude). */
export function arcPath(
  cx: number,
  cy: number,
  r: number,
  startRad: number,
  endRad: number
): string {
  const s = polar(cx, cy, r, startRad);
  const e = polar(cx, cy, r, endRad);

  // eclToSvg maps growing longitude to decreasing screen angle,
  // so the arc's span is startRad − endRad.
  const span = ((startRad - endRad) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
  const largeArc = span > Math.PI ? 1 : 0;
  // sweep=0: decreasing screen angle (counter-clockwise on a y-down canvas)
  return `M ${s.x} ${s.y} A ${r} ${r} 0 ${largeArc} 0 ${e.x} ${e.y}`;
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

  const span = ((startRad - endRad) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
  const largeArc = span > Math.PI ? 1 : 0;

  return [
    `M ${s1.x} ${s1.y}`,
    `A ${r1} ${r1} 0 ${largeArc} 0 ${e1.x} ${e1.y}`,
    `L ${e2.x} ${e2.y}`,
    `A ${r2} ${r2} 0 ${largeArc} 1 ${s2.x} ${s2.y}`,
    "Z",
  ].join(" ");
}

/** Spread crowded longitudes so glyphs don't overlap (stelliums).
 *  Returns a display longitude per name; exact positions stay untouched
 *  (dots/aspect lines keep using the real longitude). */
export function spreadAngles(
  points: { name: string; lon: number }[],
  minSep = 7
): Record<string, number> {
  const n = points.length;
  if (n <= 1) return Object.fromEntries(points.map((p) => [p.name, p.lon]));

  const sorted = points
    .map((p) => ({ name: p.name, lon: ((p.lon % 360) + 360) % 360 }))
    .sort((a, b) => a.lon - b.lon);

  // Cut the circle at the largest gap so relaxation never wraps around it
  let seam = 0;
  let maxGap = -1;
  for (let i = 0; i < n; i++) {
    const gap = (sorted[(i + 1) % n].lon - sorted[i].lon + 360) % 360;
    if (gap > maxGap) {
      maxGap = gap;
      seam = (i + 1) % n;
    }
  }
  const order = Array.from({ length: n }, (_, k) => sorted[(seam + k) % n]);
  const adj = order.map((p) => p.lon);
  for (let i = 1; i < n; i++) while (adj[i] < adj[i - 1]) adj[i] += 360;

  // Symmetric relaxation: push overlapping neighbours apart equally
  for (let iter = 0; iter < 40; iter++) {
    let moved = false;
    for (let i = 1; i < n; i++) {
      const d = adj[i] - adj[i - 1];
      if (d < minSep) {
        const shift = (minSep - d) / 2;
        adj[i - 1] -= shift;
        adj[i] += shift;
        moved = true;
      }
    }
    if (!moved) break;
  }

  return Object.fromEntries(order.map((p, i) => [p.name, ((adj[i] % 360) + 360) % 360]));
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
