"use client";

import dynamic from "next/dynamic";
import { useActionState, useState } from "react";
import { calcSolarReturn, ExtendedChartState, SolarReturnResult } from "@/app/actions/charts-extended";
import { Person } from "@/app/actions/persons";
import { City } from "@/app/actions/atlas";
import { ChartWheel } from "@/app/_components/chart-wheel/ChartWheel";
import { CityAutocomplete } from "@/app/_components/CityAutocomplete";
import { UpgradePrompt } from "@/app/_components/UpgradePrompt";
import { HOUSE_SYSTEMS } from "@/app/lib/house-systems";

const CoordMap = dynamic(() => import("@/app/_components/CoordMap").then(m => m.CoordMap), {
  ssr: false,
  loading: () => <div className="w-full h-64 rounded-xl bg-stone-100 animate-pulse" />,
});


const initialState: ExtendedChartState<SolarReturnResult> = { status: "idle" };

interface Props {
  persons?: Person[];
}

export function SolarReturnForm({ persons = [] }: Props) {
  const [state, action, pending] = useActionState(calcSolarReturn, initialState);

  const [lat, setLat] = useState(50.45);
  const [lon, setLon] = useState(30.52);
  const [birthDt, setBirthDt] = useState("1990-01-01T12:00");
  const [birthTz, setBirthTz] = useState("Europe/Kyiv");
  const [year, setYear] = useState(new Date().getFullYear());

  const handlePersonSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const p = persons.find((x) => x.id === e.target.value);
    if (!p) return;
    setLat(p.lat);
    setLon(p.lon);
    setBirthDt(p.birth_dt.replace("Z", "").slice(0, 16));
    setBirthTz(p.timezone);
  };

  const handleCitySelect = (city: City) => {
    setLat(parseFloat(city.lat.toFixed(4)));
    setLon(parseFloat(city.lon.toFixed(4)));
  };

  return (
    <div className="space-y-8">
      <form action={action} className="bg-white rounded-xl border border-stone-200 p-6 space-y-5">
        <h2 className="text-sm font-semibold text-stone-700 uppercase tracking-wider">Solar Return Chart</h2>
        <p className="text-xs text-stone-400">Find the moment the Sun returns to its natal position in a given year.</p>

        {persons.length > 0 && (
          <div>
            <label className="block text-xs font-medium text-stone-500 mb-1">Load saved person</label>
            <select
              defaultValue=""
              onChange={handlePersonSelect}
              className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
            >
              <option value="">— Enter manually —</option>
              {persons.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className="block text-xs font-medium text-stone-500 mb-1">Location for return chart</label>
          <CityAutocomplete onSelect={handleCitySelect} placeholder="Search city…" />
        </div>

        <CoordMap lat={lat} lon={lon} onChange={(la, lo) => { setLat(la); setLon(lo); }} />

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-stone-500 mb-1">Birth date &amp; time (local)</label>
            <input
              type="datetime-local"
              name="birth_dt"
              value={birthDt}
              onChange={e => setBirthDt(e.target.value)}
              required
              className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-500 mb-1">Birth timezone (IANA)</label>
            <input type="text" name="timezone" value={birthTz}
              onChange={e => setBirthTz(e.target.value)} placeholder="e.g. Europe/Kyiv"
              className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-400" />
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-500 mb-1">Return year</label>
            <input
              type="number"
              name="year"
              value={year}
              onChange={e => setYear(parseInt(e.target.value) || new Date().getFullYear())}
              min="1900"
              max="2100"
              required
              className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-500 mb-1">House System</label>
            <select name="house_system" defaultValue="placidus"
              className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white">
              {HOUSE_SYSTEMS.map(hs => <option key={hs.value} value={hs.value}>{hs.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-500 mb-1">Latitude</label>
            <input type="number" name="lat" step="0.0001" min="-90" max="90"
              value={lat} onChange={e => setLat(parseFloat(e.target.value) || 0)} required
              className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-400" />
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-500 mb-1">Longitude</label>
            <input type="number" name="lon" step="0.0001" min="-180" max="180"
              value={lon} onChange={e => setLon(parseFloat(e.target.value) || 0)} required
              className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-400" />
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
          {pending ? "Calculating…" : "Calculate Solar Return"}
        </button>
      </form>

      {state.status === "ok" && (
        <div className="space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
            <span className="font-semibold">Solar Return moment: </span>
            {new Date(state.data.return_dt).toLocaleString(undefined, {
              dateStyle: "full", timeStyle: "short", timeZone: "UTC",
            })} UTC
          </div>
          <ChartWheel data={state.data} />
        </div>
      )}
    </div>
  );
}
