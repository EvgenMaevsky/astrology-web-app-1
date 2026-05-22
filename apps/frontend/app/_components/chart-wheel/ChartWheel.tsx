"use client";

import { useState } from "react";
import {
  ASPECT_COLORS,
  ELEMENT_COLORS,
  ELEMENT_INDEX,
  PLANET_GLYPHS,
  SIGN_GLYPHS,
} from "./constants";
import { eclToSvg, formatLon, polar, sectorPath } from "./utils";

// ── Geometry ──────────────────────────────────────────────────────────────────
const CX = 300, CY = 300;
const R_OUTER     = 285; // outermost edge
const R_ZODIAC_O  = 272; // outer zodiac ring
const R_ZODIAC_I  = 240; // inner zodiac ring
const R_HOUSE_O   = 238; // outer house ring
const R_HOUSE_I   = 210; // inner house ring
const R_PLANET    = 190; // planet glyph radius
const R_INNER     = 120; // inner circle (aspect lines inside)

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
          stroke="#888"
          strokeWidth={0.5}
        />
        <text
          x={midPt.x}
          y={midPt.y}
          textAnchor="middle"
          dominantBaseline="central"
          fontFamily="ZastroCC"
          fontSize={15}
          fill={ELEMENT_COLORS[elemIdx]}
        >
          {SIGN_GLYPHS[i]}
        </text>
      </g>
    );
  });
  return <g>{signs}</g>;
}

function HouseRing({ houses, asc }: { houses: number[]; asc: number }) {
  return (
    <g>
      {houses.map((lon, i) => {
        const startRad = eclToSvg(lon, asc);
        const nextLon = houses[(i + 1) % 12];
        const endRad = eclToSvg(nextLon, asc);
        const midRad = eclToSvg((lon + nextLon) / 2, asc);
        const midPt = polar(CX, CY, (R_HOUSE_O + R_HOUSE_I) / 2, midRad);
        const isAngular = [0, 3, 6, 9].includes(i);

        return (
          <g key={i}>
            <path
              d={sectorPath(CX, CY, R_HOUSE_I, R_HOUSE_O, startRad, endRad)}
              fill={isAngular ? "#8b6914" : "transparent"}
              fillOpacity={isAngular ? 0.08 : 0}
              stroke={isAngular ? "#8b6914" : "#aaa"}
              strokeWidth={isAngular ? 1 : 0.5}
            />
            {/* Cusp tick */}
            {(() => {
              const p1 = polar(CX, CY, R_HOUSE_I - 8, startRad);
              const p2 = polar(CX, CY, R_HOUSE_O + (isAngular ? 8 : 2), startRad);
              return (
                <line
                  x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y}
                  stroke={isAngular ? "#8b6914" : "#999"}
                  strokeWidth={isAngular ? 1.5 : 0.7}
                />
              );
            })()}
            {/* House number */}
            <text
              x={midPt.x} y={midPt.y}
              textAnchor="middle" dominantBaseline="central"
              fontSize={9} fill="#666" fontFamily="sans-serif"
            >
              {i + 1}
            </text>
          </g>
        );
      })}
    </g>
  );
}

function AspectLines({
  planets,
  aspects,
  asc,
}: {
  planets: Record<string, PlanetData>;
  aspects: Aspect[];
  asc: number;
}) {
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
        const color = ASPECT_COLORS[asp.aspect] ?? "#999";
        const opacity = Math.max(0.1, 1 - asp.orb / 10);

        return (
          <line
            key={i}
            x1={pt1.x} y1={pt1.y} x2={pt2.x} y2={pt2.y}
            stroke={color}
            strokeWidth={0.8}
            opacity={opacity}
          />
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
  return (
    <g>
      {Object.entries(planets).map(([name, p]) => {
        const rad = eclToSvg(p.longitude, asc);
        const pt = polar(CX, CY, R_PLANET, rad);
        const glyph = PLANET_GLYPHS[name] ?? name[0].toUpperCase();

        return (
          <g
            key={name}
            onMouseEnter={(e) => {
              const svg = e.currentTarget.closest("svg")!.getBoundingClientRect();
              onHover({
                x: e.clientX - svg.left,
                y: e.clientY - svg.top,
                text: [
                  `${name.charAt(0).toUpperCase() + name.slice(1)}`,
                  formatLon(p.longitude),
                  `House ${p.house}`,
                  p.retrograde ? "℞ Retrograde" : "",
                ].filter(Boolean),
              });
            }}
            onMouseLeave={() => onHover(null)}
            style={{ cursor: "default" }}
          >
            {/* Dot on house ring */}
            {(() => {
              const dotRad = eclToSvg(p.longitude, asc);
              const dot = polar(CX, CY, R_INNER, dotRad);
              return <circle cx={dot.x} cy={dot.y} r={2} fill="#444" />;
            })()}
            {/* Glyph */}
            <text
              x={pt.x} y={pt.y}
              textAnchor="middle" dominantBaseline="central"
              fontFamily="ZastroCC" fontSize={18}
              fill={p.retrograde ? "#c0392b" : "#1a1a2e"}
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
    { label: "ASC", lon: angles.asc, color: "#8b6914" },
    { label: "DSC", lon: angles.dsc, color: "#8b6914" },
    { label: "MC",  lon: angles.mc,  color: "#1a5c8e" },
    { label: "IC",  lon: angles.ic,  color: "#1a5c8e" },
  ];
  return (
    <g>
      {markers.map(({ label, lon, color }) => {
        const rad = eclToSvg(lon, asc);
        const p1 = polar(CX, CY, R_ZODIAC_I - 2, rad);
        const p2 = polar(CX, CY, R_OUTER + 4, rad);
        const pt = polar(CX, CY, R_OUTER + 16, rad);
        return (
          <g key={label}>
            <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke={color} strokeWidth={2} />
            <text x={pt.x} y={pt.y} textAnchor="middle" dominantBaseline="central"
              fontSize={10} fontWeight="700" fill={color} fontFamily="sans-serif">
              {label}
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
    <div className="relative w-full max-w-2xl mx-auto select-none">
      <svg
        viewBox="0 0 600 600"
        className="w-full h-full"
        style={{ fontFamily: "ZastroCC" }}
      >
        <defs>
          <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.12" />
          </filter>
        </defs>

        {/* Background */}
        <circle cx={CX} cy={CY} r={R_OUTER} fill="white" filter="url(#shadow)" />

        {/* Aspect lines (behind everything) */}
        <AspectLines planets={data.planets} aspects={data.aspects} asc={asc} />

        {/* Inner circle */}
        <circle cx={CX} cy={CY} r={R_INNER} fill="none" stroke="#ddd" strokeWidth={0.5} />
        <circle cx={CX} cy={CY} r={R_HOUSE_I} fill="none" stroke="#ccc" strokeWidth={0.5} />

        {/* House ring */}
        <HouseRing houses={data.houses} asc={asc} />

        {/* Zodiac ring */}
        <ZodiacRing asc={asc} />

        {/* Outer ring border */}
        <circle cx={CX} cy={CY} r={R_ZODIAC_O} fill="none" stroke="#888" strokeWidth={1} />
        <circle cx={CX} cy={CY} r={R_OUTER} fill="none" stroke="#666" strokeWidth={1.5} />

        {/* Angle markers (ASC/DSC/MC/IC) */}
        <AngleMarkers angles={data.angles} asc={asc} />

        {/* Planets */}
        <PlanetLayer planets={data.planets} asc={asc} onHover={setTooltip} />

        {/* Tooltip */}
        {tooltip && (
          <g>
            <rect
              x={tooltip.x + 8} y={tooltip.y - 10}
              width={120} height={tooltip.text.length * 16 + 10}
              rx={5} fill="white" stroke="#ccc" strokeWidth={1}
              filter="url(#shadow)"
            />
            {tooltip.text.map((line, i) => (
              <text
                key={i}
                x={tooltip.x + 16} y={tooltip.y + i * 16}
                fontSize={11} fill="#222" fontFamily="sans-serif"
                dominantBaseline="middle"
              >
                {line}
              </text>
            ))}
          </g>
        )}
      </svg>
    </div>
  );
}
