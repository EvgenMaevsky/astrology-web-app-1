import { test } from "node:test";
import assert from "node:assert/strict";
import {
  starCounts,
  effectiveDpr,
  generateStars,
  parallaxOffset,
  selectLinks,
  twinkleAlpha,
  wrap,
  mulberry32,
  LAYER_RADIUS,
  LINK_DISTANCE,
  LINK_RADIUS,
  MAX_LINKS,
} from "./starfield-math.ts";

test("desktop gets the full count, mobile half", () => {
  assert.deepEqual(starCounts(1280), [180, 90, 40]);
  assert.deepEqual(starCounts(375), [90, 45, 20]);
});

test("density scales the count", () => {
  assert.deepEqual(starCounts(1280, 0.5), [90, 45, 20]);
  assert.deepEqual(starCounts(1280, 0), [0, 0, 0]);
});

test("device pixel ratio is capped at 2 and floored at 1", () => {
  assert.equal(effectiveDpr(3), 2);
  assert.equal(effectiveDpr(1.5), 1.5);
  assert.equal(effectiveDpr(0), 1);
  assert.equal(effectiveDpr(Number.NaN), 1);
});

test("generated stars stay in bounds with layer-correct radii", () => {
  const stars = generateStars(800, 600, 1, mulberry32(42));
  assert.equal(stars.length, 180 + 90 + 40);
  for (const s of stars) {
    assert.ok(s.x >= 0 && s.x <= 800 && s.y >= 0 && s.y <= 600);
    const [lo, hi] = LAYER_RADIUS[s.layer];
    assert.ok(s.r >= lo && s.r <= hi, `r=${s.r} layer=${s.layer}`);
  }
});

test("generation is deterministic for a given seed", () => {
  assert.deepEqual(
    generateStars(400, 300, 1, mulberry32(7)),
    generateStars(400, 300, 1, mulberry32(7)),
  );
});

test("parallax is zero at the centre and without a pointer", () => {
  assert.deepEqual(parallaxOffset({ x: 400, y: 300 }, 800, 600, 2), { x: 0, y: 0 });
  assert.deepEqual(parallaxOffset(null, 800, 600, 2), { x: 0, y: 0 });
});

test("nearer layers move further than distant ones", () => {
  const p = { x: 800, y: 600 };
  const far = parallaxOffset(p, 800, 600, 0);
  const near = parallaxOffset(p, 800, 600, 2);
  assert.ok(Math.abs(near.x) > Math.abs(far.x));
  assert.ok(Math.abs(near.y) > Math.abs(far.y));
});

test("links: none without a pointer", () => {
  assert.deepEqual(selectLinks([{ x: 0, y: 0 }, { x: 10, y: 0 }], null), []);
});

test("links respect radius, distance and the cap", () => {
  const rand = mulberry32(3);
  const pts = Array.from({ length: 200 }, () => ({ x: rand() * 300, y: rand() * 300 }));
  const pointer = { x: 150, y: 150 };
  const links = selectLinks(pts, pointer);
  assert.ok(links.length > 0, "a dense field around the pointer should produce links");
  assert.ok(links.length <= MAX_LINKS);
  for (const l of links) {
    const a = pts[l.a];
    const b = pts[l.b];
    assert.ok(Math.hypot(a.x - b.x, a.y - b.y) <= LINK_DISTANCE);
    assert.ok(Math.hypot(a.x - pointer.x, a.y - pointer.y) <= LINK_RADIUS);
    assert.ok(Math.hypot(b.x - pointer.x, b.y - pointer.y) <= LINK_RADIUS);
    assert.ok(l.alpha > 0 && l.alpha <= 1);
  }
});

test("links are the strongest ones, strongest first", () => {
  const rand = mulberry32(11);
  const pts = Array.from({ length: 300 }, () => ({ x: rand() * 300, y: rand() * 300 }));
  const links = selectLinks(pts, { x: 150, y: 150 });
  for (let i = 1; i < links.length; i++) {
    assert.ok(links[i - 1].alpha >= links[i].alpha);
  }
});

test("twinkle stays visible", () => {
  const star = { x: 0, y: 0, r: 1, layer: 0 as const, color: "#fff", phase: 0, speed: 1 };
  for (let t = 0; t < 20; t += 0.37) {
    const a = twinkleAlpha(star, t);
    assert.ok(a >= 0.1 && a <= 1, `alpha=${a}`);
  }
});

test("wrap keeps drifting stars on the canvas", () => {
  assert.equal(wrap(-5, 100), 95);
  assert.equal(wrap(105, 100), 5);
  assert.equal(wrap(50, 100), 50);
});
