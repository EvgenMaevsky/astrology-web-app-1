"use client";

import dynamic from "next/dynamic";
import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { calcNatalChart, ChartState } from "@/app/actions/charts";
import { City } from "@/app/actions/atlas";
import { Person } from "@/app/actions/persons";
import { ChartWheel } from "@/app/_components/chart-wheel/ChartWheel";
import { CityAutocomplete } from "@/app/_components/CityAutocomplete";
import { UpgradePrompt } from "@/app/_components/UpgradePrompt";
import { HOUSE_SYSTEMS } from "@/app/lib/house-systems";
import { PlanetTable, AspectTable, ArabicPartsTable } from "./ResultTables";
import { SaveChartButton } from "./SaveChartButton";

const CoordMap = dynamic(() => import("@/app/_components/CoordMap").then(m => m.CoordMap), {
  ssr: false,
  loading: () => <div className="w-full h-64 rounded-xl bg-stone-100 animate-pulse" />,
});


const initialState: ChartState = { status: "idle" };

interface Props {
  persons?: Person[];
  selectedPerson?: Person | null;
}

export function ChartForm({ persons = [], selectedPerson = null }: Props) {
  const [state, action, pending] = useActionState(calcNatalChart, initialState);
  const t = useTranslations("charts");
  const tf = useTranslations("charts.form");

  const initLat = selectedPerson?.lat ?? 50.45;
  const initLon = selectedPerson?.lon ?? 30.52;
  const initTz = selectedPerson?.timezone ?? "Europe/Kyiv";
  const initDt = selectedPerson
    ? selectedPerson.birth_dt.replace("Z", "").slice(0, 16)
    : "1990-01-01T12:00";

  const [lat, setLat] = useState(initLat);
  const [lon, setLon] = useState(initLon);
  const [timezone, setTimezone] = useState(initTz);
  const [datetime, setDatetime] = useState(initDt);

  const handlePersonSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const p = persons.find((x) => x.id === e.target.value);
    if (!p) return;
    setLat(p.lat);
    setLon(p.lon);
    setTimezone(p.timezone);
    setDatetime(p.birth_dt.replace("Z", "").slice(0, 16));
  };

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
        <h2 className="text-sm font-semibold text-stone-700 uppercase tracking-wider">{t("natal.title")}</h2>

        {/* Saved persons selector */}
        {persons.length > 0 && (
          <div>
            <label className="block text-xs font-medium text-stone-500 mb-1">{tf("loadSavedPerson")}</label>
            <select
              defaultValue={selectedPerson?.id ?? ""}
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

        {/* City search */}
        <div>
          <label className="block text-xs font-medium text-stone-500 mb-1">{tf("city")}</label>
          <CityAutocomplete onSelect={handleCitySelect} placeholder={t("natal.cityPlaceholder")} />
          <p className="text-xs text-stone-400 mt-1">{tf("selectCityHint")}</p>
        </div>

        {/* Map */}
        <CoordMap lat={lat} lon={lon} onChange={handleMapChange} />

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-stone-500 mb-1">
              {tf("dateTime")}
            </label>
            <input
              type="datetime-local"
              name="datetime"
              value={datetime}
              onChange={(e) => setDatetime(e.target.value)}
              required
              className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-stone-500 mb-1">{tf("latitude")}</label>
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
            <label className="block text-xs font-medium text-stone-500 mb-1">{tf("longitude")}</label>
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
            <label className="block text-xs font-medium text-stone-500 mb-1">{tf("houseSystem")}</label>
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
            <label className="block text-xs font-medium text-stone-500 mb-1">{tf("timezone")}</label>
            <input
              type="text"
              name="timezone"
              value={timezone}
              onChange={e => setTimezone(e.target.value)}
              placeholder={tf("timezonePlaceholder")}
              className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>
        </div>

        {state.status === "error" && (
          <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{state.error}</p>
        )}
        {state.status === "plan_limit" && (
          <UpgradePrompt message={state.message} required={state.required} />
        )}

        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-sm font-semibold px-5 py-2 transition-colors"
        >
          {pending ? tf("calculating") : tf("calculate")}
        </button>
      </form>

      {state.status === "ok" && (
        <div className="space-y-6">
          <div className="flex justify-end">
            <SaveChartButton
              chartType="natal"
              defaultTitle={`Natal chart — ${datetime}`}
              requestPayload={{ birth_dt: datetime, timezone, lat, lon }}
              result={state.data}
            />
          </div>
          <ChartWheel data={state.data} />
          <PlanetTable planets={state.data.planets} />
          <AspectTable aspects={state.data.aspects} />
          <ArabicPartsTable parts={state.data.arabic_parts} />
        </div>
      )}
    </div>
  );
}
