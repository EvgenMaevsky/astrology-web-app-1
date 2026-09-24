"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { calcNatalChart, ChartState } from "@/app/actions/charts";
import { Person } from "@/app/actions/persons";
import { BirthDataFields, type BirthData } from "@/app/_components/BirthDataFields";
import { ChartWheel } from "@/app/_components/chart-wheel/ChartWheel";
import { UpgradePrompt } from "@/app/_components/UpgradePrompt";
import { HOUSE_SYSTEMS } from "@/app/lib/house-systems";
import { PlanetTable, AspectTable, ArabicPartsTable } from "./ResultTables";
import { SaveChartButton } from "./SaveChartButton";

const initialState: ChartState = { status: "idle" };

interface Props {
  persons?: Person[];
  selectedPerson?: Person | null;
}

export function ChartForm({ persons = [], selectedPerson = null }: Props) {
  const [state, action, pending] = useActionState(calcNatalChart, initialState);
  const t = useTranslations("charts");
  const tf = useTranslations("charts.form");

  // The birth fields themselves live in BirthDataFields, shared with the
  // public /natal page — the two forms ask for exactly the same facts, and
  // a copy of them would drift.
  const [birth, setBirth] = useState<BirthData>({
    datetime: selectedPerson
      ? selectedPerson.birth_dt.replace("Z", "").slice(0, 16)
      : "1990-01-01T12:00",
    lat: selectedPerson?.lat ?? 50.45,
    lon: selectedPerson?.lon ?? 30.52,
    timezone: selectedPerson?.timezone ?? "Europe/Kyiv",
  });

  const handlePersonSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const p = persons.find((x) => x.id === e.target.value);
    if (!p) return;
    setBirth({
      datetime: p.birth_dt.replace("Z", "").slice(0, 16),
      lat: p.lat,
      lon: p.lon,
      timezone: p.timezone,
    });
  };

  return (
    <div className="space-y-8">
      <form action={action} className="bg-white rounded-xl border border-mist-200 p-6 space-y-5">
        <h2 className="text-sm font-semibold text-ink-700 uppercase tracking-wider">{t("natal.title")}</h2>

        {/* Saved persons selector */}
        {persons.length > 0 && (
          <div>
            <label className="block text-xs font-medium text-ink-600 mb-1">{tf("loadSavedPerson")}</label>
            <select
              defaultValue={selectedPerson?.id ?? ""}
              onChange={handlePersonSelect}
              className="w-full rounded-lg border border-mist-300 px-3 py-2 text-sm text-ink-900 focus:outline-none focus:ring-2 focus:ring-nebula-600 bg-white"
            >
              <option value="">{tf("enterManually")}</option>
              {persons.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
        )}

        <BirthDataFields
          value={birth}
          onChange={setBirth}
          cityPlaceholder={t("natal.cityPlaceholder")}
        />

        {/* Signed-in only: the public chart is always Placidus. */}
        <div className="sm:max-w-xs">
          <label className="block text-xs font-medium text-ink-600 mb-1">{tf("houseSystem")}</label>
          <select
            name="house_system"
            defaultValue="placidus"
            className="w-full rounded-lg border border-mist-300 px-3 py-2 text-sm text-ink-900 focus:outline-none focus:ring-2 focus:ring-nebula-600 bg-white"
          >
            {HOUSE_SYSTEMS.map((hs) => (
              <option key={hs.value} value={hs.value}>{hs.label}</option>
            ))}
          </select>
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
          className="rounded-lg bg-nebula-600 hover:bg-nebula-700 disabled:opacity-50 text-white text-sm font-semibold px-5 py-2 transition-colors"
        >
          {pending ? tf("calculating") : tf("calculate")}
        </button>
      </form>

      {state.status === "ok" && (
        <div className="space-y-6">
          <div className="flex justify-end">
            <SaveChartButton
              chartType="natal"
              defaultTitle={`Natal chart — ${birth.datetime}`}
              requestPayload={{
                birth_dt: birth.datetime,
                timezone: birth.timezone,
                lat: birth.lat,
                lon: birth.lon,
              }}
              result={state.data}
            />
          </div>
          <div className="rounded-xl border border-mist-200 bg-white p-3 sm:p-6">
            <ChartWheel data={state.data} />
          </div>
          <PlanetTable planets={state.data.planets} />
          <AspectTable aspects={state.data.aspects} />
          <ArabicPartsTable parts={state.data.arabic_parts} />
        </div>
      )}
    </div>
  );
}
