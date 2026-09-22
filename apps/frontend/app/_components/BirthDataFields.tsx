"use client";

import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { City } from "@/app/actions/atlas";
import { CityAutocomplete } from "@/app/_components/CityAutocomplete";

const CoordMap = dynamic(() => import("@/app/_components/CoordMap").then((m) => m.CoordMap), {
  ssr: false,
  loading: () => <div className="w-full h-64 rounded-xl bg-stone-100 animate-pulse" />,
});

const INPUT =
  "w-full rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-800 " +
  "focus:outline-none focus:ring-2 focus:ring-amber-400";

const LABEL = "block text-xs font-medium text-stone-500 mb-1";

export interface BirthData {
  datetime: string;
  lat: number;
  lon: number;
  timezone: string;
}

/**
 * The birth-data half of a chart form: city search, map, date and time,
 * coordinates, timezone.
 *
 * Shared between the signed-in chart page and the public one rather than
 * copied. A copy would drift — the two pages ask for exactly the same facts,
 * and a fix to one would silently miss the other.
 *
 * Field names match what both server actions read from the FormData.
 */
export function BirthDataFields({
  value,
  onChange,
  cityPlaceholder,
}: {
  value: BirthData;
  onChange: (next: BirthData) => void;
  cityPlaceholder: string;
}) {
  const tf = useTranslations("charts.form");

  const patch = (next: Partial<BirthData>) => onChange({ ...value, ...next });

  const handleCitySelect = (city: City) =>
    patch({
      lat: parseFloat(city.lat.toFixed(4)),
      lon: parseFloat(city.lon.toFixed(4)),
      timezone: city.timezone,
    });

  return (
    <>
      <div>
        <label className={LABEL}>{tf("city")}</label>
        <CityAutocomplete onSelect={handleCitySelect} placeholder={cityPlaceholder} />
        <p className="text-xs text-stone-400 mt-1">{tf("selectCityHint")}</p>
      </div>

      <CoordMap
        lat={value.lat}
        lon={value.lon}
        onChange={(lat, lon) => patch({ lat, lon })}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <label className={LABEL}>{tf("dateTime")}</label>
          <input
            type="datetime-local"
            name="datetime"
            value={value.datetime}
            onChange={(e) => patch({ datetime: e.target.value })}
            required
            className={INPUT}
          />
        </div>

        <div>
          <label className={LABEL}>{tf("latitude")}</label>
          <input
            type="number"
            name="lat"
            step="0.0001"
            min="-90"
            max="90"
            value={value.lat}
            onChange={(e) => patch({ lat: parseFloat(e.target.value) || 0 })}
            required
            className={INPUT}
          />
        </div>

        <div>
          <label className={LABEL}>{tf("longitude")}</label>
          <input
            type="number"
            name="lon"
            step="0.0001"
            min="-180"
            max="180"
            value={value.lon}
            onChange={(e) => patch({ lon: parseFloat(e.target.value) || 0 })}
            required
            className={INPUT}
          />
        </div>

        <div className="sm:col-span-2">
          <label className={LABEL}>{tf("timezone")}</label>
          <input
            type="text"
            name="timezone"
            value={value.timezone}
            onChange={(e) => patch({ timezone: e.target.value })}
            placeholder={tf("timezonePlaceholder")}
            className={INPUT}
          />
        </div>
      </div>
    </>
  );
}
