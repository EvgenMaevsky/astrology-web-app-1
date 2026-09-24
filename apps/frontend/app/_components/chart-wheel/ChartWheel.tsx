"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  ANGLE_GOLD,
  ASPECT_COLORS,
  CHROME,
  ASPECT_GLYPHS,
  ELEMENT_COLORS,
  ELEMENT_INDEX,
  PLANET_GLYPHS,
  SIGN_GLYPHS,
} from "./constants";
import { eclToSvg, formatLon, polar, sectorPath, spreadAngles } from "./utils";
import { useAstroTranslator } from "@/app/lib/astro-i18n";

// ── Geometry ──────────────────────────────────────────────────────────────────
const CX = 300, CY = 300;
const R_OUTER     = 285; // outermost edge
const R_ZODIAC_O  = 272; // outer zodiac ring
const R_ZODIAC_I  = 240; // inner zodiac ring
const R_HOUSE_O   = 238; // outer house ring
const R_HOUSE_I   = 210; // inner house ring
const R_DOT       = 203; // exact planet position marker, hugging the house ring
const R_PLANET    = 185; // planet glyph radius, right next to its dot
const R_INNER     = 168; // inner circle (aspect lines inside)

// viewBox origin and extent, kept in named constants because svgTipPos()
// below has to use exactly the same numbers — when they were literals in
// two places, changing the viewBox silently moved every tooltip.
const VIEW_MIN = -42;
const VIEW_SIZE = 684;

interface PlanetData {
  longitude: number;
  sign: string;
  sign_degree: number;
  house: number;
  retrograde: boolean;
  speed: number;
}

interface Aspect {
  planet1: string;
  planet2: string;
  aspect: string;
  angle: number;
  orb: number;
  applying: boolean;
}

interface ChartData {
  planets: Record<string, PlanetData>;
  houses: number[];
  angles: { asc: number; mc: number; dsc: number; ic: number };
  aspects: Aspect[];
}

interface Tooltip {
  x: number;
  y: number;
  text: string[];
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ZodiacRing({ asc }: { asc: number }) {
  const signs = Array.from({ length: 12 }, (_, i) => {
    const lon = i * 30;
    const startRad = eclToSvg(lon, asc);
    const endRad = eclToSvg(lon + 30, asc);
    const midRad = eclToSvg(lon + 15, asc);
    const midPt = polar(CX, CY, (R_ZODIAC_O + R_ZODIAC_I) / 2, midRad);
    const elemIdx = ELEMENT_INDEX[i] as 0 | 1 | 2 | 3;

    return (
      <g key={i}>
        <path
          d={sectorPath(CX, CY, R_ZODIAC_I, R_ZODIAC_O, startRad, endRad)}
          fill={ELEMENT_COLORS[elemIdx]}
          fillOpacity={0.15}
          stroke={CHROME.soft}
          strokeWidth={1.2}
        />
        <text
          x={midPt.x}
          y={midPt.y}
          textAnchor="middle"
          dominantBaseline="central"
          fontFamily="serif"
          fontSize={26}
          fill={ELEMENT_COLORS[elemIdx]}
        >
          {SIGN_GLYPHS[i]}
        </text>
      </g>
    );
  });
  return <g>{signs}</g>;
}

/**
 * Degree scale around the rim: a tick every degree, longer every fifth and
 * longer still every tenth. Purely decorative, but it is what makes a wheel
 * read as an instrument rather than a pie chart, and it gives the eye a way
 * to judge positions between the labelled cusps.
 */
function DegreeTicks({ asc }: { asc: number }) {
  const ticks = [];
  for (let deg = 0; deg < 360; deg++) {
    const rad = eclToSvg(deg, asc);
    const length = deg % 10 === 0 ? 11 : deg % 5 === 0 ? 7 : 4;
    const a = polar(CX, CY, R_OUTER, rad);
    const b = polar(CX, CY, R_OUTER - length, rad);
    ticks.push(
      <line
        key={deg}
        x1={a.x} y1={a.y} x2={b.x} y2={b.y}
        stroke={deg % 10 === 0 ? CHROME.mid : CHROME.light}
        strokeWidth={deg % 10 === 0 ? 1.4 : deg % 5 === 0 ? 1 : 0.7}
      />
    );
  }
  return <g>{ticks}</g>;
}

/** Degree within the sign, e.g. 187.15° → "7°09′". */
function fmtDegMin(lon: number): string {
  const inSign = ((lon % 30) + 30) % 30;
  const d = Math.floor(inSign);
  const m = Math.floor((inSign - d) * 60);
  return `${d}°${String(m).padStart(2, "0")}′`;
}

function HouseRing({ houses, asc }: { houses: number[]; asc: number }) {
  return (
    <g>
      {houses.map((lon, i) => {
        const startRad = eclToSvg(lon, asc);
        const nextLon = houses[(i + 1) % 12];
        const endRad = eclToSvg(nextLon, asc);
        // midpoint measured along the zodiac, safe across the 0° Aries wrap
        const midRad = eclToSvg(lon + ((nextLon - lon + 360) % 360) / 2, asc);
        const midPt = polar(CX, CY, (R_HOUSE_O + R_HOUSE_I) / 2, midRad);
        const isAngular = [0, 3, 6, 9].includes(i);

        return (
          <g key={i}>
            <path
              d={sectorPath(CX, CY, R_HOUSE_I, R_HOUSE_O, startRad, endRad)}
              fill={isAngular ? ANGLE_GOLD : "transparent"}
              fillOpacity={isAngular ? 0.08 : 0}
              stroke={isAngular ? ANGLE_GOLD : CHROME.light}
              strokeWidth={isAngular ? 2 : 1}
            />
            {/* Cusp tick — runs from the house ring out to the outer circle */}
            {(() => {
              const p1 = polar(CX, CY, R_HOUSE_I - 8, startRad);
              const p2 = polar(CX, CY, R_OUTER, startRad);
              return (
                <line
                  x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y}
                  stroke={isAngular ? ANGLE_GOLD : CHROME.strong}
                  strokeWidth={isAngular ? 3.5 : 1.4}
                />
              );
            })()}
            {/* Cusp degree just outside the outer circle
                (angular cusps get theirs from AngleMarkers) */}
            {!isAngular && (() => {
              const pt = polar(CX, CY, R_OUTER + 12, startRad);
              return (
                <text
                  x={pt.x} y={pt.y}
                  textAnchor="middle" dominantBaseline="central"
                  fontSize={10} fill={CHROME.mid} fontFamily="sans-serif"
                >
                  {fmtDegMin(lon)}
                </text>
              );
            })()}
            {/* House number */}
            <text
              x={midPt.x} y={midPt.y}
              textAnchor="middle" dominantBaseline="central"
              fontSize={13} fill={CHROME.mid} fontFamily="sans-serif"
            >
              {i + 1}
            </text>
          </g>
        );
      })}
    </g>
  );
}

// Badges are drawn for major aspects only — minor-aspect lines stay,
// but their badges would swamp charts with stelliums.
const BADGE_ASPECTS = new Set([
  "conjunction", "sextile", "square", "trine", "opposition",
]);

/** Mouse position in viewBox units (see VIEW_MIN / VIEW_SIZE). */
function svgTipPos(e: React.MouseEvent<Element>): { x: number; y: number } {
  const rect = (e.currentTarget as Element).closest("svg")!.getBoundingClientRect();
  return {
    x: ((e.clientX - rect.left) / rect.width) * VIEW_SIZE + VIEW_MIN,
    y: ((e.clientY - rect.top) / rect.height) * VIEW_SIZE + VIEW_MIN,
  };
}

function AspectLines({
  planets,
  aspects,
  asc,
  onHover,
}: {
  planets: Record<string, PlanetData>;
  aspects: Aspect[];
  asc: number;
  onHover: (tip: Tooltip | null) => void;
}) {
  const astro = useAstroTranslator();
  const ta = useTranslations("astro");
  const th = useTranslations("charts.table");

  return (
    <g>
      {aspects.map((asp, i) => {
        const p1 = planets[asp.planet1];
        const p2 = planets[asp.planet2];
        if (!p1 || !p2) return null;

        const a1 = eclToSvg(p1.longitude, asc);
        const a2 = eclToSvg(p2.longitude, asc);
        const pt1 = polar(CX, CY, R_INNER, a1);
        const pt2 = polar(CX, CY, R_INNER, a2);
        const color = ASPECT_COLORS[asp.aspect] ?? CHROME.light;
        const opacity = Math.max(0.25, 1 - asp.orb / 10);
        const mid = { x: (pt1.x + pt2.x) / 2, y: (pt1.y + pt2.y) / 2 };
        const len = Math.hypot(pt2.x - pt1.x, pt2.y - pt1.y);
        // Badge only fits on a reasonably long line; short chords
        // (conjunctions inside a stellium) would just pile up badges.
        const glyph =
          len >= 30 && BADGE_ASPECTS.has(asp.aspect)
            ? ASPECT_GLYPHS[asp.aspect]
            : undefined;

        const showTip = (e: React.MouseEvent<SVGGElement>) => {
          onHover({
            ...svgTipPos(e),
            text: [
              `${astro("planets", asp.planet1)} ${ASPECT_GLYPHS[asp.aspect] ?? ""} ${astro("planets", asp.planet2)}`,
              `${astro("aspects", asp.aspect)} (${asp.angle}°)`,
              `${th("orb")} ${asp.orb.toFixed(2)}°`,
              asp.applying ? ta("applying") : ta("separating"),
            ],
          });
        };

        return (
          <g
            key={i}
            opacity={opacity}
            onMouseEnter={showTip}
            onMouseLeave={() => onHover(null)}
            style={{ cursor: "default" }}
          >
            {/* invisible fat line so the thin aspect line is easy to hover */}
            <line
              x1={pt1.x} y1={pt1.y} x2={pt2.x} y2={pt2.y}
              stroke="transparent"
              strokeWidth={9}
              pointerEvents="stroke"
            />
            <line
              x1={pt1.x} y1={pt1.y} x2={pt2.x} y2={pt2.y}
              stroke={color}
              strokeWidth={1.6}
            />
            {glyph && (
              <>
                <circle cx={mid.x} cy={mid.y} r={8.5} fill="white" stroke={color} strokeWidth={0.8} />
                <text
                  x={mid.x} y={mid.y}
                  textAnchor="middle" dominantBaseline="central"
                  fontSize={11} fill={color} fontFamily="serif"
                >
                  {glyph}
                </text>
              </>
            )}
          </g>
        );
      })}
    </g>
  );
}

function PlanetLayer({
  planets,
  asc,
  onHover,
}: {
  planets: Record<string, PlanetData>;
  asc: number;
  onHover: (tip: Tooltip | null) => void;
}) {
  const astro = useAstroTranslator();
  const ta = useTranslations("astro");

  // Glyphs of tightly conjunct planets are fanned out; dots stay exact.
  const displayLon = spreadAngles(
    Object.entries(planets).map(([name, p]) => ({ name, lon: p.longitude }))
  );

  return (
    <g>
      {Object.entries(planets).map(([name, p]) => {
        const exactRad = eclToSvg(p.longitude, asc);
        const glyphRad = eclToSvg(displayLon[name] ?? p.longitude, asc);
        const dot = polar(CX, CY, R_DOT, exactRad);
        const pt = polar(CX, CY, R_PLANET, glyphRad);
        const glyph = PLANET_GLYPHS[name] ?? name[0].toUpperCase();

        // connector from just under the dot to the glyph's edge
        const c1 = polar(CX, CY, R_DOT - 3, exactRad);
        const c2 = polar(CX, CY, R_PLANET + 9, glyphRad);

        return (
          <g
            key={name}
            onMouseEnter={(e) => {
              onHover({
                ...svgTipPos(e),
                text: [
                  astro("planets", name),
                  formatLon(p.longitude),
                  ta("house", { n: p.house }),
                  p.retrograde ? `℞ ${ta("retrograde")}` : "",
                ].filter(Boolean),
              });
            }}
            onMouseLeave={() => onHover(null)}
            style={{ cursor: "default" }}
          >
            {/* Exact position dot, hugging the house ring */}
            <circle cx={dot.x} cy={dot.y} r={3.2} fill={CHROME.strong} />
            {/* Dot → glyph connector */}
            <line x1={c1.x} y1={c1.y} x2={c2.x} y2={c2.y} stroke={CHROME.light} strokeWidth={1} />
            {/* Glyph */}
            <text
              x={pt.x} y={pt.y}
              textAnchor="middle" dominantBaseline="central"
              fontFamily="serif" fontSize={24}
              fill={p.retrograde ? "#c0392b" : CHROME.strong}
            >
              {glyph}
            </text>
          </g>
        );
      })}
    </g>
  );
}

function AngleMarkers({ angles, asc }: { angles: ChartData["angles"]; asc: number }) {
  const markers = [
    { label: "ASC", lon: angles.asc, color: ANGLE_GOLD },
    { label: "DSC", lon: angles.dsc, color: ANGLE_GOLD },
    { label: "MC",  lon: angles.mc,  color: "#1a5c8e" },
    { label: "IC",  lon: angles.ic,  color: "#1a5c8e" },
  ];
  return (
    <g>
      {markers.map(({ label, lon, color }) => {
        const rad = eclToSvg(lon, asc);
        const p1 = polar(CX, CY, R_ZODIAC_I - 2, rad);
        const p2 = polar(CX, CY, R_OUTER + 4, rad);
        // MC/IC rays are ~vertical: the label is centred on the ray and the
        // degrees stack further out. ASC/DSC rays are ~horizontal, where a
        // centred label is half inside the outer ring; there the text starts
        // at the end of the ray and runs outwards, degrees directly beneath.
        const vertical = Math.abs(Math.sin(rad)) > 0.5;
        const pt = vertical
          ? polar(CX, CY, R_OUTER + 14, rad)
          : polar(CX, CY, R_OUTER + 8, rad);
        const anchor = vertical ? "middle" : Math.cos(rad) < 0 ? "end" : "start";
        const degPt = vertical
          ? polar(CX, CY, R_OUTER + 26, rad)
          : { x: pt.x, y: pt.y + 13 };
        return (
          <g key={label}>
            <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke={color} strokeWidth={4} />
            <text x={pt.x} y={pt.y} textAnchor={anchor} dominantBaseline="central"
              fontSize={14} fontWeight="700" fill={color} fontFamily="sans-serif">
              {label}
            </text>
            <text x={degPt.x} y={degPt.y} textAnchor={anchor} dominantBaseline="central"
              fontSize={11} fill={color} fontFamily="sans-serif">
              {fmtDegMin(lon)}
            </text>
          </g>
        );
      })}
    </g>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function ChartWheel({ data }: { data: ChartData }) {
  const [tooltip, setTooltip] = useState<Tooltip | null>(null);
  const asc = data.angles.asc;

  return (
    <div className="relative w-full max-w-4xl mx-auto select-none">
      <svg
        viewBox={`${VIEW_MIN} ${VIEW_MIN} ${VIEW_SIZE} ${VIEW_SIZE}`}
        className="w-full h-full"
        style={{ fontFamily: "serif" }}
      >
        <defs>
          <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.12" />
          </filter>
        </defs>

        {/* Background */}
        <circle cx={CX} cy={CY} r={R_OUTER} fill="white" filter="url(#shadow)" />

        {/* Aspect lines (behind everything) */}
        <AspectLines planets={data.planets} aspects={data.aspects} asc={asc} onHover={setTooltip} />

        {/* Inner circle */}
        <circle cx={CX} cy={CY} r={R_INNER} fill="none" stroke={CHROME.faint} strokeWidth={1.2} />
        <circle cx={CX} cy={CY} r={R_HOUSE_I} fill="none" stroke={CHROME.faint} strokeWidth={1.2} />

        {/* House ring */}
        <HouseRing houses={data.houses} asc={asc} />

        {/* Zodiac ring */}
        <ZodiacRing asc={asc} />

        {/* Outer ring border */}
        <DegreeTicks asc={asc} />
        <circle cx={CX} cy={CY} r={R_ZODIAC_O} fill="none" stroke={CHROME.mid} strokeWidth={2.2} />
        <circle cx={CX} cy={CY} r={R_OUTER} fill="none" stroke={CHROME.strong} strokeWidth={3} />

        {/* Angle markers (ASC/DSC/MC/IC) */}
        <AngleMarkers angles={data.angles} asc={asc} />

        {/* Planets */}
        <PlanetLayer planets={data.planets} asc={asc} onHover={setTooltip} />

        {/* Tooltip */}
        {tooltip && (() => {
          const tipW = Math.max(...tooltip.text.map((t) => t.length)) * 6.2 + 18;
          const tipH = tooltip.text.length * 16 + 12;
          const tx = Math.max(-28, Math.min(tooltip.x + 10, 628 - tipW));
          const ty = Math.max(-28, Math.min(tooltip.y - tipH - 6, 628 - tipH));
          return (
            <g pointerEvents="none">
              <rect
                x={tx} y={ty}
                width={tipW} height={tipH}
                rx={5} fill="white" stroke={CHROME.faint} strokeWidth={1}
                filter="url(#shadow)"
              />
              {tooltip.text.map((line, i) => (
                <text
                  key={i}
                  x={tx + 9} y={ty + 14 + i * 16}
                  fontSize={11} fill={CHROME.strong} fontFamily="sans-serif"
                  dominantBaseline="middle"
                >
                  {line}
                </text>
              ))}
            </g>
          );
        })()}
      </svg>
    </div>
  );
}
