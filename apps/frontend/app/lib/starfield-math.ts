/**
 * Pure maths behind the landing-page starfield (see Starfield.tsx).
 *
 * Kept free of the DOM and of canvas so it can be unit-tested with
 * `node --test` — the parts that are easy to get subtly wrong (how many
 * stars a phone gets, which pairs become a "constellation", how far each
 * depth layer drifts) live here, and the component only draws them.
 *
 * Numbers follow docs/plans/2026-09-24-e7-redesign-design.md §3.
 */

export type Layer = 0 | 1 | 2;

export interface Point {
  x: number;
  y: number;
}

export interface Star extends Point {
  /** Radius in CSS pixels. */
  r: number;
  /** 0 = far, 1 = middle, 2 = near. */
  layer: Layer;
  color: string;
  /** Twinkle phase and angular speed, randomised per star. */
  phase: number;
  speed: number;
}

export interface Link {
  /** Indices into the points array given to selectLinks. */
  a: number;
  b: number;
  /** Opacity in (0, 1]. */
  alpha: number;
}

/** Stars per layer on a desktop-width canvas: far, middle, near. */
export const LAYER_COUNTS = [180, 90, 40] as const;

/** Radius range per layer, CSS pixels. Nearer stars are larger. */
export const LAYER_RADIUS: readonly (readonly [number, number])[] = [
  [0.4, 0.9],
  [0.8, 1.4],
  [1.2, 2.0],
];

/** How far each layer shifts per pixel of pointer offset from the centre. */
export const PARALLAX = [0.01, 0.025, 0.05] as const;

/** Mostly white, with a lavender and a pale blue for depth. */
export const STAR_COLORS = ["#FFFFFF", "#FFFFFF", "#FFFFFF", "#FFFFFF", "#C9C2FF", "#9DB8FF"] as const;

/** Below this canvas width the field is thinned out. */
export const MOBILE_BREAKPOINT = 640;

/**
 * Upper bound on the backing-store scale. A DPR-3 phone would otherwise
 * paint nine times the pixels of a DPR-1 screen for no visible gain.
 */
export const MAX_DPR = 2;

/** Stars within this distance of the pointer can join a constellation. */
export const LINK_RADIUS = 140;
/** Two stars further apart than this are never linked. */
export const LINK_DISTANCE = 90;
/** Beyond a dozen lines the effect turns into a scribble. */
export const MAX_LINKS = 12;

/** Slow drift so the sky is alive without a pointer — and on touch screens. */
export const DRIFT_PX_PER_SEC = 6;

/** Per-frame easing towards the pointer-driven parallax target. */
export const PARALLAX_EASING = 0.06;

export function starCounts(width: number, density = 1): number[] {
  const scale = (width < MOBILE_BREAKPOINT ? 0.5 : 1) * Math.max(0, density);
  return LAYER_COUNTS.map((n) => Math.round(n * scale));
}

export function effectiveDpr(dpr: number): number {
  if (!Number.isFinite(dpr) || dpr < 1) return 1;
  return Math.min(dpr, MAX_DPR);
}

/**
 * Small seeded PRNG. The component uses Math.random; tests pass a seed so a
 * generated field is reproducible.
 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function generateStars(
  width: number,
  height: number,
  density = 1,
  rand: () => number = Math.random,
): Star[] {
  const stars: Star[] = [];
  starCounts(width, density).forEach((count, index) => {
    const layer = index as Layer;
    const [lo, hi] = LAYER_RADIUS[layer];
    for (let i = 0; i < count; i++) {
      stars.push({
        x: rand() * width,
        y: rand() * height,
        r: lo + rand() * (hi - lo),
        layer,
        color: STAR_COLORS[Math.floor(rand() * STAR_COLORS.length)],
        phase: rand() * Math.PI * 2,
        speed: 0.6 + rand() * 1.6,
      });
    }
  });
  return stars;
}

/** Target shift of a layer for a pointer position; zero without a pointer. */
export function parallaxOffset(
  pointer: Point | null,
  width: number,
  height: number,
  layer: Layer,
): Point {
  if (!pointer) return { x: 0, y: 0 };
  const factor = PARALLAX[layer];
  return {
    x: (pointer.x - width / 2) * factor,
    y: (pointer.y - height / 2) * factor,
  };
}

export function lerp(from: number, to: number, t: number): number {
  return from + (to - from) * t;
}

/**
 * Pairs of stars near the pointer to connect with a line.
 *
 * A pair qualifies when both stars are within LINK_RADIUS of the pointer
 * and within LINK_DISTANCE of each other. Its opacity falls off both with
 * the length of the line and with how far its midpoint sits from the
 * pointer, so the constellation is densest right under the cursor and fades
 * out towards the edge of the radius. Only the MAX_LINKS strongest survive.
 */
export function selectLinks(
  points: readonly Point[],
  pointer: Point | null,
  maxLinks = MAX_LINKS,
): Link[] {
  if (!pointer) return [];

  const near: number[] = [];
  for (let i = 0; i < points.length; i++) {
    if (Math.hypot(points[i].x - pointer.x, points[i].y - pointer.y) <= LINK_RADIUS) {
      near.push(i);
    }
  }

  const links: Link[] = [];
  for (let i = 0; i < near.length; i++) {
    for (let j = i + 1; j < near.length; j++) {
      const a = points[near[i]];
      const b = points[near[j]];
      const length = Math.hypot(a.x - b.x, a.y - b.y);
      if (length > LINK_DISTANCE) continue;

      const midX = (a.x + b.x) / 2;
      const midY = (a.y + b.y) / 2;
      const proximity = 1 - Math.min(1, Math.hypot(midX - pointer.x, midY - pointer.y) / LINK_RADIUS);
      const alpha = (1 - length / LINK_DISTANCE) * proximity;
      if (alpha > 0) links.push({ a: near[i], b: near[j], alpha });
    }
  }

  links.sort((x, y) => y.alpha - x.alpha);
  return links.slice(0, maxLinks);
}

/** Star opacity at time t (seconds). Never drops below 0.1, so no star blinks out. */
export function twinkleAlpha(star: Star, t: number): number {
  const value = 0.6 + 0.4 * Math.sin(t * star.speed + star.phase);
  return Math.min(1, Math.max(0.1, value));
}

/** Wrap a coordinate into [0, max) so drifting stars re-enter from the other side. */
export function wrap(value: number, max: number): number {
  return ((value % max) + max) % max;
}
