"use client";

import { useEffect, useRef } from "react";
import {
  DRIFT_PX_PER_SEC,
  PARALLAX_EASING,
  effectiveDpr,
  generateStars,
  lerp,
  parallaxOffset,
  selectLinks,
  twinkleAlpha,
  wrap,
  type Layer,
  type Point,
  type Star,
} from "@/app/lib/starfield-math";

// Constellation line colour: nebula-500. Lines only — never text (it sits
// just under WCAG AA on space-950).
const LINK_COLOUR = "#7C5CFF";

/**
 * Decorative, interactive starfield on a 2D canvas.
 *
 * All the maths lives in starfield-math.ts and is unit-tested; this
 * component only owns the canvas, the animation loop and the things that
 * decide whether the loop should run at all:
 *
 * - prefers-reduced-motion → one static frame, no loop, no pointer listener;
 * - off screen (IntersectionObserver) or tab hidden → the loop is STOPPED,
 *   not merely drawing nothing, so it costs no battery;
 * - backing store scaled by devicePixelRatio, capped at 2.
 *
 * The canvas is aria-hidden and pointer-events:none: every word on the page
 * stays real text outside it, for screen readers, for search engines and so
 * the hero headline never waits on the animation.
 *
 * data-frames and data-frame-ms on the canvas are read by manual
 * verification (is the loop paused? what does a frame cost?).
 */
export function Starfield({
  density = 1,
  interactive = true,
  className = "",
}: {
  /** Star-count multiplier; the auth pages use a thinner sky. */
  density?: number;
  /** Follow the pointer (parallax and constellations), or just drift. */
  interactive?: boolean;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let width = 0;
    let height = 0;
    let stars: Star[] = [];
    const offsets: Point[] = [{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }];
    let pointer: Point | null = null;

    let rafId = 0;
    let running = false;
    let onScreen = true;
    let pageVisible = !document.hidden;
    let lastTick = performance.now();
    const startedAt = lastTick;
    let frames = 0;
    let frameMsAvg = 0;

    const draw = (now: number) => {
      const t = (now - startedAt) / 1000;
      ctx.clearRect(0, 0, width, height);

      const positions: Point[] = new Array(stars.length);
      for (let i = 0; i < stars.length; i++) {
        const star = stars[i];
        const offset = offsets[star.layer];
        const x = wrap(star.x + offset.x, width);
        const y = wrap(star.y + offset.y, height);
        positions[i] = { x, y };

        ctx.globalAlpha = reduceMotion ? 0.85 : twinkleAlpha(star, t);
        ctx.fillStyle = star.color;
        ctx.beginPath();
        ctx.arc(x, y, star.r, 0, Math.PI * 2);
        ctx.fill();
      }

      if (interactive && pointer && !reduceMotion) {
        // Only the middle and near layers form constellations: the far
        // layer's pinpricks would make the lines look random.
        const linkable: Point[] = [];
        for (let i = 0; i < stars.length; i++) {
          if (stars[i].layer > 0) linkable.push(positions[i]);
        }
        ctx.strokeStyle = LINK_COLOUR;
        ctx.lineWidth = 0.8;
        for (const link of selectLinks(linkable, pointer)) {
          const a = linkable[link.a];
          const b = linkable[link.b];
          ctx.globalAlpha = link.alpha * 0.9;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;
    };

    const tick = (now: number) => {
      // Clamp so a long pause (tab switched away) does not jump the sky.
      const dt = Math.min(0.05, (now - lastTick) / 1000);
      lastTick = now;

      // Nearer layers drift faster, which is what reads as depth.
      for (const star of stars) {
        star.x = wrap(star.x + DRIFT_PX_PER_SEC * dt * (0.4 + star.layer * 0.3), width);
      }
      for (let layer = 0 as Layer; layer <= 2; layer = (layer + 1) as Layer) {
        const target = parallaxOffset(interactive ? pointer : null, width, height, layer);
        offsets[layer].x = lerp(offsets[layer].x, target.x, PARALLAX_EASING);
        offsets[layer].y = lerp(offsets[layer].y, target.y, PARALLAX_EASING);
      }

      const drawStart = performance.now();
      draw(now);
      const drawMs = performance.now() - drawStart;
      frameMsAvg = frames === 0 ? drawMs : frameMsAvg * 0.95 + drawMs * 0.05;
      frames++;
      canvas.dataset.frames = String(frames);
      canvas.dataset.frameMs = frameMsAvg.toFixed(3);

      rafId = requestAnimationFrame(tick);
    };

    const startLoop = () => {
      if (running || reduceMotion || !onScreen || !pageVisible) return;
      running = true;
      lastTick = performance.now();
      rafId = requestAnimationFrame(tick);
    };

    const stopLoop = () => {
      running = false;
      cancelAnimationFrame(rafId);
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      const dpr = effectiveDpr(window.devicePixelRatio);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      stars = generateStars(width, height, density);
      // Keep a correct frame on screen even while the loop is stopped.
      if (!running) draw(performance.now());
    };

    resize();
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas);

    if (reduceMotion) {
      // One static frame; resizing redraws it. No loop, no pointer tracking.
      return () => resizeObserver.disconnect();
    }

    const intersectionObserver = new IntersectionObserver(([entry]) => {
      onScreen = entry.isIntersecting;
      if (onScreen) startLoop();
      else stopLoop();
    });
    intersectionObserver.observe(canvas);

    const onVisibility = () => {
      pageVisible = !document.hidden;
      if (pageVisible) startLoop();
      else stopLoop();
    };
    document.addEventListener("visibilitychange", onVisibility);

    // On window, not the canvas: the canvas sits under the hero content with
    // pointer-events:none, so it never receives pointer events itself.
    // pointermove covers mouse and touch drags alike.
    const onPointerMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      pointer = x >= 0 && y >= 0 && x <= rect.width && y <= rect.height ? { x, y } : null;
    };
    // A lifted finger leaves no hover state, so clear the constellation.
    const onPointerEnd = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") pointer = null;
    };
    const onPointerLeave = () => {
      pointer = null;
    };
    if (interactive) {
      window.addEventListener("pointermove", onPointerMove, { passive: true });
      window.addEventListener("pointerup", onPointerEnd, { passive: true });
      window.addEventListener("pointercancel", onPointerEnd, { passive: true });
      document.documentElement.addEventListener("pointerleave", onPointerLeave);
    }

    startLoop();

    return () => {
      stopLoop();
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerEnd);
      window.removeEventListener("pointercancel", onPointerEnd);
      document.documentElement.removeEventListener("pointerleave", onPointerLeave);
    };
  }, [density, interactive]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 h-full w-full ${className}`}
    />
  );
}
