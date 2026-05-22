"use client";

import dynamic from "next/dynamic";
import { useActionState, useState } from "react";
import { calcNatalChart, ChartState, NatalChartResult } from "@/app/actions/charts";
import { City } from "@/app/actions/atlas";
import { ChartWheel } from "@/app/_components/chart-wheel/ChartWheel";
import { CityAutocomplete } from "@/app/_components/CityAutocomplete";

const CoordMap = dynamic(() => import("@/app/_components/CoordMap").then(m => m.CoordMap), {
  ssr: false,
  loading: () => <div className="w-full h-64 rounded-xl bg-stone-100 animate-pulse" />,
});

const HOUSE_SYSTEMS = [
  { value: "placidus", label: "Placidus" },
  { value: "koch", label: "Koch" },
  { value: "equal", label: "Equal" },
  { value: "whole_sign", label: "Whole Sign" },
];

const initialState: ChartState = { status: "idle" };

export function ChartForm() {
  const [state, action, pending] = useActionState(calcNatalChart, initialState);
  const [lat, setLat] = useState(50.45);
  const [lon, setLon] = useState(30.52);
  const [timezone, setTimezone] = useState("Europe/Kyiv");

  const handleCitySelect = (city: City) => {
    setLat(parseFloat(city.lat.toFixed(4)));
    setLon(parseFloat(city.lon.toFixed(4)));
    setTimezone(city.timezone);
  };

  const handleMapChange = (newLat: number, newLon: number) => {
    setLat(newLat);
    setLon(newLon);
  };

  return (
    <div className="space-y-8">
      <form action={action} className="bg-white rounded-xl border border-stone-200 p-6 space-y-5">
        <h2 className="text-sm font-semibold text-stone-700 uppercase tracking-wider">Natal Chart</h2>

        {/* City search */}
        <div>
          <label className="block text-xs font-medium text-stone-500 mb-1">City</label>
          <CityAutocomplete onSelect={handleCitySelect} placeholder="Search city (e.g. Kyiv, London, New York)…" />
          <p className="text-xs text-stone-400 mt-1">Select a city to auto-fill coordinates and timezone</p>
        </div>

        {/* Map */}
        <CoordMap lat={lat} lon={lon} onChange={handleMapChange} />

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-stone-500 mb-1">
              Date &amp; Time (local)
            </label>
            <input
              type="datetime-local"
              name="datetime"
              defaultValue="1990-01-01T12:00"
              required
              className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-stone-500 mb-1">Latitude</label>
            <input
              type="number"
              name="lat"
              step="0.0001"
              min="-90"
              max="90"
              value={lat}
              onChange={e => setLat(parseFloat(e.target.value) || 0)}
              required
              className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-stone-500 mb-1">Longitude</label>
            <input
              type="number"
              name="lon"
              step="0.0001"
              min="-180"
              max="180"
              value={lon}
              onChange={e => setLon(parseFloat(e.target.value) || 0)}
              required
              className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-stone-500 mb-1">House System</label>
            <select
              name="house_system"
              defaultValue="placidus"
              className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
            >
              {HOUSE_SYSTEMS.map((hs) => (
                <option key={hs.value} value={hs.value}>{hs.label}</option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-stone-500 mb-1">Timezone</label>
            <input
              type="text"
              name="timezone"
              value={timezone}
              onChange={e => setTimezone(e.target.value)}
              placeholder="e.g. Europe/Kyiv"
              className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>
        </div>

        {state.status === "error" && (
          <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{state.error}</p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-sm font-semibold px-5 py-2 transition-colors"
        >
          {pending ? "Calculating…" : "Calculate"}
        </button>
      </form>

      {state.status === "ok" && (
        <div className="space-y-6">
          <ChartWheel data={state.data} />
          <PlanetTable planets={state.data.planets} />
          <AspectTable aspects={state.data.aspects} />
          <ArabicPartsTable parts={state.data.arabic_parts} />
        </div>
      )}
    </div>
  );
}

function fmtDeg(sign_degree: number): string {
  const d = Math.floor(sign_degree);
  const m = Math.floor((sign_degree % 1) * 60);
  return `${d}°${String(m).padStart(2, "0")}′`;
}

function PlanetTable({ planets }: { planets: NatalChartResult["planets"] }) {
  const rows = Object.entries(planets).map(([name, p]) => ({
    name: name.charAt(0).toUpperCase() + name.slice(1),
    sign: p.sign,
    degree: fmtDeg(p.sign_degree),
    house: p.house,
    retrograde: p.retrograde,
    term: p.term_ruler ? p.term_ruler.charAt(0).toUpperCase() + p.term_ruler.slice(1) : "—",
  }));

  return (
    <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-stone-100 bg-stone-50">
            <th className="text-left px-4 py-2 text-xs font-semibold text-stone-500 uppercase tracking-wider">Planet</th>
            <th className="text-left px-4 py-2 text-xs font-semibold text-stone-500 uppercase tracking-wider">Sign</th>
            <th className="text-left px-4 py-2 text-xs font-semibold text-stone-500 uppercase tracking-wider">Degree</th>
            <th className="text-left px-4 py-2 text-xs font-semibold text-stone-500 uppercase tracking-wider">House</th>
            <th className="text-left px-4 py-2 text-xs font-semibold text-stone-500 uppercase tracking-wider">Term</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.name} className="border-b border-stone-50 hover:bg-stone-50">
              <td className="px-4 py-2 font-medium text-stone-800">
                {r.name}{r.retrograde && <span className="ml-1 text-red-500 text-xs">℞</span>}
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
  );
}

function ArabicPartsTable({ parts }: { parts: NatalChartResult["arabic_parts"] }) {
  if (!parts?.length) return null;
  return (
    <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
      <div className="px-4 py-3 border-b border-stone-100 bg-stone-50">
        <h3 className="text-xs font-semibold text-stone-500 uppercase tracking-wider">Arabic Parts</h3>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-stone-100">
            <th className="text-left px-4 py-2 text-xs font-semibold text-stone-500 uppercase tracking-wider">Part</th>
            <th className="text-left px-4 py-2 text-xs font-semibold text-stone-500 uppercase tracking-wider">Sign</th>
            <th className="text-left px-4 py-2 text-xs font-semibold text-stone-500 uppercase tracking-wider">Degree</th>
          </tr>
        </thead>
        <tbody>
          {parts.map((p) => (
            <tr key={p.name} className="border-b border-stone-50 hover:bg-stone-50">
              <td className="px-4 py-1.5 text-stone-700">{p.name}</td>
              <td className="px-4 py-1.5 text-stone-600">{p.sign}</td>
              <td className="px-4 py-1.5 text-stone-600 font-mono text-xs">{fmtDeg(p.sign_degree)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const ASPECT_LABELS: Record<string, string> = {
  conjunction: "☌", opposition: "☍", trine: "△", square: "□",
  sextile: "⚹", semisextile: "⚺", semisquare: "∠", sesquisquare: "⚼",
  quincunx: "⚻", quintile: "Q", biquintile: "bQ",
};

function AspectTable({ aspects }: { aspects: NatalChartResult["aspects"] }) {
  if (!aspects.length) return null;

  return (
    <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-stone-100 bg-stone-50">
            <th className="text-left px-4 py-2 text-xs font-semibold text-stone-500 uppercase tracking-wider">Planet 1</th>
            <th className="text-center px-4 py-2 text-xs font-semibold text-stone-500 uppercase tracking-wider">Aspect</th>
            <th className="text-left px-4 py-2 text-xs font-semibold text-stone-500 uppercase tracking-wider">Planet 2</th>
            <th className="text-right px-4 py-2 text-xs font-semibold text-stone-500 uppercase tracking-wider">Orb</th>
            <th className="text-center px-4 py-2 text-xs font-semibold text-stone-500 uppercase tracking-wider">App/Sep</th>
          </tr>
        </thead>
        <tbody>
          {aspects.map((a, i) => (
            <tr key={i} className="border-b border-stone-50 hover:bg-stone-50">
              <td className="px-4 py-1.5 text-stone-700 capitalize">{a.planet1}</td>
              <td className="px-4 py-1.5 text-center text-stone-600">
                <span title={a.aspect}>{ASPECT_LABELS[a.aspect] ?? a.aspect}</span>
              </td>
              <td className="px-4 py-1.5 text-stone-700 capitalize">{a.planet2}</td>
              <td className="px-4 py-1.5 text-right text-stone-500 font-mono text-xs">{a.orb.toFixed(2)}°</td>
              <td className="px-4 py-1.5 text-center text-xs text-stone-400">
                {a.applying ? "▲" : "▽"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
