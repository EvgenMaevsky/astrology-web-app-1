"use client";

import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { City } from "@/app/actions/atlas";
import { CityAutocomplete } from "@/app/_components/CityAutocomplete";
import { THEME, type Tone } from "@/app/_components/ui/theme";

const CoordMap = dynamic(() => import("@/app/_components/CoordMap").then((m) => m.CoordMap), {
  ssr: false,
  loading: () => <div className="h-64 w-full animate-pulse rounded-xl bg-dusk/20" />,
});

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
  tone = "light",
}: {
  value: BirthData;
  onChange: (next: BirthData) => void;
  cityPlaceholder: string;
  /** "dark" on the public /natal page, "light" in the dashboard. */
  tone?: Tone;
}) {
  const tf = useTranslations("charts.form");
  const theme = THEME[tone];
  const INPUT = theme.input;
  const LABEL = `${theme.label} mb-1.5`;

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
        <CityAutocomplete onSelect={handleCitySelect} placeholder={cityPlaceholder} tone={tone} />
        <p className={`mt-1.5 text-xs ${theme.muted}`}>{tf("selectCityHint")}</p>
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
