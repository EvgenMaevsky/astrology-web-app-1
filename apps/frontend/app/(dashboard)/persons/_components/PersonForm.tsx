"use client";

import dynamic from "next/dynamic";
import { useActionState, useState } from "react";
import { createPerson, PersonFormState } from "@/app/actions/persons";
import { City } from "@/app/actions/atlas";
import { CityAutocomplete } from "@/app/_components/CityAutocomplete";

const CoordMap = dynamic(
  () => import("@/app/_components/CoordMap").then((m) => m.CoordMap),
  { ssr: false, loading: () => <div className="w-full h-48 rounded-xl bg-stone-100 animate-pulse" /> }
);

const initialState: PersonFormState = { status: "idle" };

interface Props {
  onCreated?: () => void;
}

export function PersonForm({ onCreated }: Props) {
  const [state, action, pending] = useActionState(createPerson, initialState);
  const [lat, setLat] = useState(50.45);
  const [lon, setLon] = useState(30.52);
  const [timezone, setTimezone] = useState("Europe/Kyiv");
  const [cityLabel, setCityLabel] = useState("");

  const handleCitySelect = (city: City) => {
    setLat(parseFloat(city.lat.toFixed(4)));
    setLon(parseFloat(city.lon.toFixed(4)));
    setTimezone(city.timezone);
    setCityLabel(`${city.name}${city.country ? `, ${city.country}` : ""}`);
  };

  const handleMapChange = (newLat: number, newLon: number) => {
    setLat(newLat);
    setLon(newLon);
  };

  if (state.status === "ok" && onCreated) {
    onCreated();
  }

  return (
    <form action={action} className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-stone-500 mb-1">Full Name</label>
        <input
          type="text"
          name="name"
          required
          placeholder="e.g. John Smith"
          className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-400"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-stone-500 mb-1">City</label>
        <CityAutocomplete onSelect={handleCitySelect} placeholder="Search city…" />
      </div>

      <CoordMap lat={lat} lon={lon} onChange={handleMapChange} />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-stone-500 mb-1">Date &amp; Time (local)</label>
          <input
            type="datetime-local"
            name="birth_dt"
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
            onChange={(e) => setLat(parseFloat(e.target.value) || 0)}
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
            onChange={(e) => setLon(parseFloat(e.target.value) || 0)}
            required
            className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
        </div>

        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-stone-500 mb-1">Timezone</label>
          <input
            type="text"
            name="timezone"
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            required
            className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
        </div>
      </div>

      <input type="hidden" name="city_label" value={cityLabel} />

      {state.status === "error" && (
        <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{state.error}</p>
      )}
      {state.status === "ok" && (
        <p className="text-sm text-green-700 bg-green-50 rounded-lg px-3 py-2">
          Saved: <strong>{state.person.name}</strong>
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-sm font-semibold px-5 py-2 transition-colors"
      >
        {pending ? "Saving…" : "Save Person"}
      </button>
    </form>
  );
}
