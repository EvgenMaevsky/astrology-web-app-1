"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { calcSynastry, ExtendedChartState, SynastryResult } from "@/app/actions/charts-extended";
import { Person } from "@/app/actions/persons";
import { City } from "@/app/actions/atlas";
import { CityAutocomplete } from "@/app/_components/CityAutocomplete";
import { UpgradePrompt } from "@/app/_components/UpgradePrompt";
import { HOUSE_SYSTEMS } from "@/app/lib/house-systems";
import { useAstroTranslator } from "@/app/lib/astro-i18n";


const initialState: ExtendedChartState<SynastryResult> = { status: "idle" };

const ASPECT_LABELS: Record<string, string> = {
  conjunction: "☌", opposition: "☍", trine: "△", square: "□",
  sextile: "⚹", semisextile: "⚺", semisquare: "∠", sesquisquare: "⚼",
  quincunx: "⚻", quintile: "Q", biquintile: "bQ",
};

interface Props {
  persons?: Person[];
}

function fmtDeg(sign_degree: number): string {
  const d = Math.floor(sign_degree);
  const m = Math.floor((sign_degree % 1) * 60);
  return `${d}°${String(m).padStart(2, "0")}′`;
}

export function SynastryForm({ persons = [] }: Props) {
  const [state, action, pending] = useActionState(calcSynastry, initialState);
  const tf = useTranslations("charts.form");
  const tsy = useTranslations("charts.synastry");

  const [lat1, setLat1] = useState(50.45);
  const [lon1, setLon1] = useState(30.52);
  const [dt1, setDt1] = useState("1990-01-01T12:00");
  const [tz1, setTz1] = useState("Europe/Kyiv");

  const [lat2, setLat2] = useState(50.45);
  const [lon2, setLon2] = useState(30.52);
  const [dt2, setDt2] = useState("1992-06-15T12:00");
  const [tz2, setTz2] = useState("Europe/Kyiv");

  const handlePersonSelect1 = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const p = persons.find((x) => x.id === e.target.value);
    if (!p) return;
    setLat1(p.lat); setLon1(p.lon);
    setDt1(p.birth_dt.replace("Z", "").slice(0, 16));
    setTz1(p.timezone);
  };

  const handlePersonSelect2 = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const p = persons.find((x) => x.id === e.target.value);
    if (!p) return;
    setLat2(p.lat); setLon2(p.lon);
    setDt2(p.birth_dt.replace("Z", "").slice(0, 16));
    setTz2(p.timezone);
  };

  return (
    <div className="space-y-8">
      <form action={action} className="bg-white rounded-xl border border-stone-200 p-6 space-y-6">
        <h2 className="text-sm font-semibold text-stone-700 uppercase tracking-wider">{tsy("title")}</h2>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Person 1 */}
          <div className="space-y-4 border border-stone-100 rounded-xl p-4">
            <h3 className="text-xs font-semibold text-stone-500 uppercase tracking-wider">{tsy("person1")}</h3>

            {persons.length > 0 && (
              <select defaultValue="" onChange={handlePersonSelect1}
                className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white">
                <option value="">{tf("enterManually")}</option>
                {persons.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            )}

            <CityAutocomplete onSelect={(c: City) => { setLat1(parseFloat(c.lat.toFixed(4))); setLon1(parseFloat(c.lon.toFixed(4))); setTz1(c.timezone); }} placeholder={tf("city")} />

            <div>
              <label className="block text-xs font-medium text-stone-500 mb-1">{tsy("birthDateTime")}</label>
              <input type="datetime-local" name="dt1" value={dt1} onChange={e => setDt1(e.target.value)} required
                className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-400" />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-500 mb-1">{tsy("timezoneIana")}</label>
              <input type="text" name="tz1" value={tz1} onChange={e => setTz1(e.target.value)} placeholder={tf("timezonePlaceholder")}
                className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-400" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-stone-500 mb-1">{tf("latitude")}</label>
                <input type="number" name="lat1" step="0.0001" min="-90" max="90" value={lat1}
                  onChange={e => setLat1(parseFloat(e.target.value) || 0)} required
                  className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-400" />
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-500 mb-1">{tf("longitude")}</label>
                <input type="number" name="lon1" step="0.0001" min="-180" max="180" value={lon1}
                  onChange={e => setLon1(parseFloat(e.target.value) || 0)} required
                  className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-400" />
              </div>
            </div>
          </div>

          {/* Person 2 */}
          <div className="space-y-4 border border-stone-100 rounded-xl p-4">
            <h3 className="text-xs font-semibold text-stone-500 uppercase tracking-wider">{tsy("person2")}</h3>

            {persons.length > 0 && (
              <select defaultValue="" onChange={handlePersonSelect2}
                className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white">
                <option value="">{tf("enterManually")}</option>
                {persons.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            )}

            <CityAutocomplete onSelect={(c: City) => { setLat2(parseFloat(c.lat.toFixed(4))); setLon2(parseFloat(c.lon.toFixed(4))); setTz2(c.timezone); }} placeholder={tf("city")} />

            <div>
              <label className="block text-xs font-medium text-stone-500 mb-1">{tsy("birthDateTime")}</label>
              <input type="datetime-local" name="dt2" value={dt2} onChange={e => setDt2(e.target.value)} required
                className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-400" />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-500 mb-1">{tsy("timezoneIana")}</label>
              <input type="text" name="tz2" value={tz2} onChange={e => setTz2(e.target.value)} placeholder={tf("timezonePlaceholder")}
                className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-400" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-stone-500 mb-1">{tf("latitude")}</label>
                <input type="number" name="lat2" step="0.0001" min="-90" max="90" value={lat2}
                  onChange={e => setLat2(parseFloat(e.target.value) || 0)} required
                  className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-400" />
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-500 mb-1">{tf("longitude")}</label>
                <input type="number" name="lon2" step="0.0001" min="-180" max="180" value={lon2}
                  onChange={e => setLon2(parseFloat(e.target.value) || 0)} required
                  className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-400" />
              </div>
            </div>
          </div>
        </div>

        <div className="w-48">
          <label className="block text-xs font-medium text-stone-500 mb-1">{tf("houseSystem")}</label>
          <select name="house_system" defaultValue="placidus"
            className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white">
            {HOUSE_SYSTEMS.map(hs => <option key={hs.value} value={hs.value}>{hs.label}</option>)}
          </select>
        </div>

        {state.status === "error" && (
          <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{state.error}</p>
        )}
        {state.status === "plan_limit" && (
          <UpgradePrompt message={state.message} required={state.required} />
        )}

        <button type="submit" disabled={pending}
          className="rounded-lg bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-sm font-semibold px-5 py-2 transition-colors">
          {pending ? tf("calculating") : tsy("calculateButton")}
        </button>
      </form>

      {state.status === "ok" && (
        <SynastryResultPanel data={state.data} />
      )}
    </div>
  );
}

function SynastryResultPanel({ data }: { data: SynastryResult }) {
  const tsy = useTranslations("charts.synastry");
  const th = useTranslations("charts.table");
  const ta = useTranslations("astro");
  const astro = useAstroTranslator();

  return (
    <div className="space-y-6">
      {/* Side-by-side planet tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {(["person1", "person2"] as const).map((key) => (
          <div key={key} className="bg-white rounded-xl border border-stone-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-stone-100 bg-stone-50">
              <h3 className="text-xs font-semibold text-stone-500 uppercase tracking-wider">
                {key === "person1" ? tsy("person1") : tsy("person2")} — {tsy("planets")}
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-stone-100">
                    <th className="text-left px-4 py-2 text-xs font-semibold text-stone-500 uppercase">{th("planet")}</th>
                    <th className="text-left px-4 py-2 text-xs font-semibold text-stone-500 uppercase">{th("sign")}</th>
                    <th className="text-left px-4 py-2 text-xs font-semibold text-stone-500 uppercase">{th("degree")}</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(data[key].planets).map(([name, p]) => (
                    <tr key={name} className="border-b border-stone-50 hover:bg-stone-50">
                      <td className="px-4 py-1.5 font-medium text-stone-800">
                        {astro("planets", name)}{p.retrograde && <span className="ml-1 text-red-500 text-xs" title={ta("retrograde")}>℞</span>}
                      </td>
                      <td className="px-4 py-1.5 text-stone-600">{astro("signs", p.sign)}</td>
                      <td className="px-4 py-1.5 text-stone-600 font-mono text-xs">{fmtDeg(p.sign_degree)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>

      {/* Inter-aspects */}
      {data.inter_aspects.length > 0 && (
        <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-stone-100 bg-stone-50">
            <h3 className="text-xs font-semibold text-stone-500 uppercase tracking-wider">{tsy("interAspects")}</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-100 bg-stone-50">
                  <th className="text-left px-4 py-2 text-xs font-semibold text-stone-500 uppercase">{tsy("person1")}</th>
                  <th className="text-center px-4 py-2 text-xs font-semibold text-stone-500 uppercase">{th("asp")}</th>
                  <th className="text-left px-4 py-2 text-xs font-semibold text-stone-500 uppercase">{tsy("person2")}</th>
                  <th className="text-right px-4 py-2 text-xs font-semibold text-stone-500 uppercase">{th("orb")}</th>
                  <th className="text-center px-4 py-2 text-xs font-semibold text-stone-500 uppercase">{th("appSep")}</th>
                </tr>
              </thead>
              <tbody>
                {data.inter_aspects.map((a, i) => (
                  <tr key={i} className="border-b border-stone-50 hover:bg-stone-50">
                    <td className="px-4 py-1.5 text-stone-700">{astro("planets", a.person1)}</td>
                    <td className="px-4 py-1.5 text-center text-stone-600">
                      <span title={astro("aspects", a.aspect)}>{ASPECT_LABELS[a.aspect] ?? a.aspect}</span>
                    </td>
                    <td className="px-4 py-1.5 text-stone-700">{astro("planets", a.person2)}</td>
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
