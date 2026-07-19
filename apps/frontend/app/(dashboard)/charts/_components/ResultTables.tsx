"use client";

import { useTranslations } from "next-intl";
import { NatalChartResult } from "@/app/actions/charts";
import { useAstroTranslator } from "@/app/lib/astro-i18n";

export function fmtDeg(sign_degree: number): string {
  const d = Math.floor(sign_degree);
  const m = Math.floor((sign_degree % 1) * 60);
  return `${d}°${String(m).padStart(2, "0")}′`;
}

export function PlanetTable({ planets }: { planets: NatalChartResult["planets"] }) {
  const th = useTranslations("charts.table");
  const ta = useTranslations("astro");
  const astro = useAstroTranslator();

  const rows = Object.entries(planets).map(([name, p]) => ({
    name: astro("planets", name),
    sign: astro("signs", p.sign),
    degree: fmtDeg(p.sign_degree),
    house: p.house,
    retrograde: p.retrograde,
    term: p.term_ruler ? astro("planets", p.term_ruler) : "—",
  }));

  return (
    <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-stone-100 bg-stone-50">
              <th className="text-left px-4 py-2 text-xs font-semibold text-stone-500 uppercase tracking-wider">{th("planet")}</th>
              <th className="text-left px-4 py-2 text-xs font-semibold text-stone-500 uppercase tracking-wider">{th("sign")}</th>
              <th className="text-left px-4 py-2 text-xs font-semibold text-stone-500 uppercase tracking-wider">{th("degree")}</th>
              <th className="text-left px-4 py-2 text-xs font-semibold text-stone-500 uppercase tracking-wider">{th("house")}</th>
              <th className="text-left px-4 py-2 text-xs font-semibold text-stone-500 uppercase tracking-wider">{th("term")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.name} className="border-b border-stone-50 hover:bg-stone-50">
                <td className="px-4 py-2 font-medium text-stone-800">
                  {r.name}{r.retrograde && <span className="ml-1 text-red-500 text-xs" title={ta("retrograde")}>℞</span>}
                </td>
                <td className="px-4 py-2 text-stone-600">{r.sign}</td>
                <td className="px-4 py-2 text-stone-600 font-mono text-xs">{r.degree}</td>
                <td className="px-4 py-2 text-stone-500">{r.house}</td>
                <td className="px-4 py-2 text-stone-400 text-xs">{r.term}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function ArabicPartsTable({ parts }: { parts: NatalChartResult["arabic_parts"] }) {
  const th = useTranslations("charts.table");
  const astro = useAstroTranslator();
  if (!parts?.length) return null;
  return (
    <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
      <div className="px-4 py-3 border-b border-stone-100 bg-stone-50">
        <h3 className="text-xs font-semibold text-stone-500 uppercase tracking-wider">{th("arabicParts")}</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-stone-100">
              <th className="text-left px-4 py-2 text-xs font-semibold text-stone-500 uppercase tracking-wider">{th("part")}</th>
              <th className="text-left px-4 py-2 text-xs font-semibold text-stone-500 uppercase tracking-wider">{th("sign")}</th>
              <th className="text-left px-4 py-2 text-xs font-semibold text-stone-500 uppercase tracking-wider">{th("degree")}</th>
            </tr>
          </thead>
          <tbody>
            {parts.map((p, i) => (
              <tr key={`${p.name}-${i}`} className="border-b border-stone-50 hover:bg-stone-50">
                {/* Arabic part names are NOT translated (100+ backend strings, out of C2 scope) */}
                <td className="px-4 py-1.5 text-stone-700">{p.name}</td>
                <td className="px-4 py-1.5 text-stone-600">{astro("signs", p.sign)}</td>
                <td className="px-4 py-1.5 text-stone-600 font-mono text-xs">{fmtDeg(p.sign_degree)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const ASPECT_LABELS: Record<string, string> = {
  conjunction: "☌", opposition: "☍", trine: "△", square: "□",
  sextile: "⚹", semisextile: "⚺", semisquare: "∠", sesquisquare: "⚼",
  quincunx: "⚻", quintile: "Q", biquintile: "bQ",
};

export function AspectTable({ aspects }: { aspects: NatalChartResult["aspects"] }) {
  const th = useTranslations("charts.table");
  const ta = useTranslations("astro");
  const astro = useAstroTranslator();
  if (!aspects.length) return null;

  return (
    <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-stone-100 bg-stone-50">
              <th className="text-left px-4 py-2 text-xs font-semibold text-stone-500 uppercase tracking-wider">{th("planet1")}</th>
              <th className="text-center px-4 py-2 text-xs font-semibold text-stone-500 uppercase tracking-wider">{th("aspect")}</th>
              <th className="text-left px-4 py-2 text-xs font-semibold text-stone-500 uppercase tracking-wider">{th("planet2")}</th>
              <th className="text-right px-4 py-2 text-xs font-semibold text-stone-500 uppercase tracking-wider">{th("orb")}</th>
              <th className="text-center px-4 py-2 text-xs font-semibold text-stone-500 uppercase tracking-wider">{th("appSep")}</th>
            </tr>
          </thead>
          <tbody>
            {aspects.map((a, i) => (
              <tr key={i} className="border-b border-stone-50 hover:bg-stone-50">
                <td className="px-4 py-1.5 text-stone-700">{astro("planets", a.planet1)}</td>
                <td className="px-4 py-1.5 text-center text-stone-600">
                  <span title={astro("aspects", a.aspect)}>{ASPECT_LABELS[a.aspect] ?? a.aspect}</span>
                </td>
                <td className="px-4 py-1.5 text-stone-700">{astro("planets", a.planet2)}</td>
                <td className="px-4 py-1.5 text-right text-stone-500 font-mono text-xs">{a.orb.toFixed(2)}°</td>
                <td className="px-4 py-1.5 text-center text-xs text-stone-400" title={a.applying ? ta("applying") : ta("separating")}>
                  {a.applying ? "▲" : "▽"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
