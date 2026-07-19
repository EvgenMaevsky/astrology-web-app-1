"use client";

import dynamic from "next/dynamic";
import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { calcTransit, ExtendedChartState, TransitResult } from "@/app/actions/charts-extended";
import { NatalChartResult } from "@/app/actions/charts";
import { Person } from "@/app/actions/persons";
import { City } from "@/app/actions/atlas";
import { ChartWheel } from "@/app/_components/chart-wheel/ChartWheel";
import { CityAutocomplete } from "@/app/_components/CityAutocomplete";
import { UpgradePrompt } from "@/app/_components/UpgradePrompt";
import { HOUSE_SYSTEMS } from "@/app/lib/house-systems";
import { useAstroTranslator } from "@/app/lib/astro-i18n";

const CoordMap = dynamic(() => import("@/app/_components/CoordMap").then(m => m.CoordMap), {
  ssr: false,
  loading: () => <div className="w-full h-64 rounded-xl bg-stone-100 animate-pulse" />,
});


const initialState: ExtendedChartState<TransitResult> = { status: "idle" };

const now = new Date();
const nowLocal = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
  .toISOString()
  .slice(0, 16);

interface Props {
  persons?: Person[];
}

export function TransitForm({ persons = [] }: Props) {
  const [state, action, pending] = useActionState(calcTransit, initialState);
  const tf = useTranslations("charts.form");
  const tt = useTranslations("charts.transit");

  const [natalLat, setNatalLat] = useState(50.45);
  const [natalLon, setNatalLon] = useState(30.52);
  const [natalDt, setNatalDt] = useState("1990-01-01T12:00");
  const [natalTz, setNatalTz] = useState("Europe/Kyiv");

  const [transitLat, setTransitLat] = useState(50.45);
  const [transitLon, setTransitLon] = useState(30.52);
  const [transitDt, setTransitDt] = useState(nowLocal);
  const [transitTz, setTransitTz] = useState("Europe/Kyiv");

  const handlePersonSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const p = persons.find((x) => x.id === e.target.value);
    if (!p) return;
    setNatalLat(p.lat);
    setNatalLon(p.lon);
    setNatalDt(p.birth_dt.replace("Z", "").slice(0, 16));
    setNatalTz(p.timezone);
  };

  const handleNatalCity = (city: City) => {
    setNatalLat(parseFloat(city.lat.toFixed(4)));
    setNatalLon(parseFloat(city.lon.toFixed(4)));
    setNatalTz(city.timezone);
  };

  const handleTransitCity = (city: City) => {
    setTransitLat(parseFloat(city.lat.toFixed(4)));
    setTransitLon(parseFloat(city.lon.toFixed(4)));
    setTransitTz(city.timezone);
  };

  return (
    <div className="space-y-8">
      <form action={action} className="bg-white rounded-xl border border-stone-200 p-6 space-y-6">
        <h2 className="text-sm font-semibold text-stone-700 uppercase tracking-wider">{tt("title")}</h2>

        {/* Natal section */}
        <div className="space-y-4">
          <h3 className="text-xs font-semibold text-stone-500 uppercase tracking-wider border-b border-stone-100 pb-2">{tt("natalData")}</h3>

          {persons.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-stone-500 mb-1">{tf("loadSavedPerson")}</label>
              <select
                defaultValue=""
                onChange={handlePersonSelect}
                className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
              >
                <option value="">{tf("enterManually")}</option>
                {persons.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-stone-500 mb-1">{tt("natalCity")}</label>
            <CityAutocomplete onSelect={handleNatalCity} placeholder={tt("searchNatalCity")} />
          </div>

          <CoordMap lat={natalLat} lon={natalLon} onChange={(la, lo) => { setNatalLat(la); setNatalLon(lo); }} />

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-1">
              <label className="block text-xs font-medium text-stone-500 mb-1">{tt("birthDateTime")}</label>
              <input
                type="datetime-local"
                name="natal_dt"
                value={natalDt}
                onChange={e => setNatalDt(e.target.value)}
                required
                className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-500 mb-1">{tf("latitude")}</label>
              <input type="number" name="natal_lat" step="0.0001" min="-90" max="90"
                value={natalLat} onChange={e => setNatalLat(parseFloat(e.target.value) || 0)} required
                className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-400" />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-500 mb-1">{tf("longitude")}</label>
              <input type="number" name="natal_lon" step="0.0001" min="-180" max="180"
                value={natalLon} onChange={e => setNatalLon(parseFloat(e.target.value) || 0)} required
                className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-400" />
            </div>
            <div className="sm:col-span-3">
              <label className="block text-xs font-medium text-stone-500 mb-1">{tt("birthTimezone")}</label>
              <input type="text" name="natal_tz" value={natalTz}
                onChange={e => setNatalTz(e.target.value)} placeholder={tf("timezonePlaceholder")}
                className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-400" />
            </div>
          </div>
        </div>

        {/* Transit section */}
        <div className="space-y-4">
          <h3 className="text-xs font-semibold text-stone-500 uppercase tracking-wider border-b border-stone-100 pb-2">{tt("transitDate")}</h3>

          <div>
            <label className="block text-xs font-medium text-stone-500 mb-1">{tt("transitLocation")}</label>
            <CityAutocomplete onSelect={handleTransitCity} placeholder={tt("searchTransitCity")} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-1">
              <label className="block text-xs font-medium text-stone-500 mb-1">{tt("transitDateTime")}</label>
              <input
                type="datetime-local"
                name="transit_dt"
                value={transitDt}
                onChange={e => setTransitDt(e.target.value)}
                required
                className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-500 mb-1">{tf("latitude")}</label>
              <input type="number" name="transit_lat" step="0.0001" min="-90" max="90"
                value={transitLat} onChange={e => setTransitLat(parseFloat(e.target.value) || 0)} required
                className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-400" />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-500 mb-1">{tf("longitude")}</label>
              <input type="number" name="transit_lon" step="0.0001" min="-180" max="180"
                value={transitLon} onChange={e => setTransitLon(parseFloat(e.target.value) || 0)} required
                className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-400" />
            </div>
            <div className="sm:col-span-3">
              <label className="block text-xs font-medium text-stone-500 mb-1">{tt("transitTimezone")}</label>
              <input type="text" name="transit_tz" value={transitTz}
                onChange={e => setTransitTz(e.target.value)} placeholder={tf("timezonePlaceholder")}
                className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-400" />
            </div>
          </div>

          <div className="w-48">
            <label className="block text-xs font-medium text-stone-500 mb-1">{tf("houseSystem")}</label>
            <select name="house_system" defaultValue="placidus"
              className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white">
              {HOUSE_SYSTEMS.map(hs => <option key={hs.value} value={hs.value}>{hs.label}</option>)}
            </select>
          </div>
        </div>

        {state.status === "error" && (
          <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{state.error}</p>
        )}
        {state.status === "plan_limit" && (
          <UpgradePrompt message={state.message} required={state.required} />
        )}

        <button type="submit" disabled={pending}
          className="rounded-lg bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-sm font-semibold px-5 py-2 transition-colors">
          {pending ? tf("calculating") : tt("calculateButton")}
        </button>
      </form>

      {state.status === "ok" && (
        <TransitResultPanel data={state.data} />
      )}
    </div>
  );
}

function fmtDeg(sign_degree: number): string {
  const d = Math.floor(sign_degree);
  const m = Math.floor((sign_degree % 1) * 60);
  return `${d}°${String(m).padStart(2, "0")}′`;
}

const ASPECT_LABELS: Record<string, string> = {
  conjunction: "☌", opposition: "☍", trine: "△", square: "□",
  sextile: "⚹", semisextile: "⚺", semisquare: "∠", sesquisquare: "⚼",
  quincunx: "⚻", quintile: "Q", biquintile: "bQ",
};

function TransitResultPanel({ data }: { data: TransitResult }) {
  const tt = useTranslations("charts.transit");
  const th = useTranslations("charts.table");
  const ta = useTranslations("astro");
  const astro = useAstroTranslator();

  return (
    <div className="space-y-6">
      <ChartWheel data={data.natal} />

      {/* Transit planets table */}
      <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-stone-100 bg-stone-50">
          <h3 className="text-xs font-semibold text-stone-500 uppercase tracking-wider">{tt("transitPlanets")}</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-100 bg-stone-50">
                <th className="text-left px-4 py-2 text-xs font-semibold text-stone-500 uppercase tracking-wider">{th("planet")}</th>
                <th className="text-left px-4 py-2 text-xs font-semibold text-stone-500 uppercase tracking-wider">{th("sign")}</th>
                <th className="text-left px-4 py-2 text-xs font-semibold text-stone-500 uppercase tracking-wider">{th("degree")}</th>
                <th className="text-left px-4 py-2 text-xs font-semibold text-stone-500 uppercase tracking-wider">{th("house")}</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(data.transit).map(([name, p]) => (
                <tr key={name} className="border-b border-stone-50 hover:bg-stone-50">
                  <td className="px-4 py-2 font-medium text-stone-800">
                    {astro("planets", name)}{p.retrograde && <span className="ml-1 text-red-500 text-xs" title={ta("retrograde")}>℞</span>}
                  </td>
                  <td className="px-4 py-2 text-stone-600">{astro("signs", p.sign)}</td>
                  <td className="px-4 py-2 text-stone-600 font-mono text-xs">{fmtDeg(p.sign_degree)}</td>
                  <td className="px-4 py-2 text-stone-500">{p.house}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Transit-to-natal aspects */}
      {data.aspects.length > 0 && (
        <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-stone-100 bg-stone-50">
            <h3 className="text-xs font-semibold text-stone-500 uppercase tracking-wider">{tt("transitAspects")}</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-100 bg-stone-50">
                  <th className="text-left px-4 py-2 text-xs font-semibold text-stone-500 uppercase tracking-wider">{th("transit")}</th>
                  <th className="text-center px-4 py-2 text-xs font-semibold text-stone-500 uppercase tracking-wider">{th("asp")}</th>
                  <th className="text-left px-4 py-2 text-xs font-semibold text-stone-500 uppercase tracking-wider">{th("natal")}</th>
                  <th className="text-right px-4 py-2 text-xs font-semibold text-stone-500 uppercase tracking-wider">{th("orb")}</th>
                  <th className="text-center px-4 py-2 text-xs font-semibold text-stone-500 uppercase tracking-wider">{th("appSep")}</th>
                </tr>
              </thead>
              <tbody>
                {data.aspects.map((a, i) => (
                  <tr key={i} className="border-b border-stone-50 hover:bg-stone-50">
                    <td className="px-4 py-1.5 text-stone-700">{astro("planets", a.transit)}</td>
                    <td className="px-4 py-1.5 text-center text-stone-600">
                      <span title={astro("aspects", a.aspect)}>{ASPECT_LABELS[a.aspect] ?? a.aspect}</span>
                    </td>
                    <td className="px-4 py-1.5 text-stone-700">{astro("planets", a.natal)}</td>
                    <td className="px-4 py-1.5 text-right text-stone-500 font-mono text-xs">{a.orb.toFixed(2)}°</td>
                    <td className="px-4 py-1.5 text-center text-xs text-stone-400" title={a.applying ? ta("applying") : ta("separating")}>{a.applying ? "▲" : "▽"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
