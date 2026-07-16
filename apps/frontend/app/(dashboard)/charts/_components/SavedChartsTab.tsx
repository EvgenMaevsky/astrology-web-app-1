"use client";

import { useEffect, useState, useTransition } from "react";
import {
  deleteSavedChart,
  getSavedChart,
  listSavedCharts,
  SavedChartFull,
  SavedChartSummary,
} from "@/app/actions/saved-charts";
import { NatalChartResult } from "@/app/actions/charts";
import { ChartWheel } from "@/app/_components/chart-wheel/ChartWheel";
import { PlanetTable, AspectTable, ArabicPartsTable } from "./ResultTables";

const CHART_TYPE_LABELS: Record<string, string> = {
  natal: "Natal",
  solar_return: "Solar Return",
};

export function SavedChartsTab() {
  const [charts, setCharts] = useState<SavedChartSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<SavedChartFull | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    listSavedCharts().then((data) => {
      setCharts(data);
      setLoading(false);
    });
  }, []);

  const handleOpen = (id: string) => {
    startTransition(async () => {
      const full = await getSavedChart(id);
      setSelected(full);
    });
  };

  const handleDelete = (id: string) => {
    startTransition(async () => {
      const res = await deleteSavedChart(id);
      if (res.ok) {
        setCharts((prev) => prev.filter((c) => c.id !== id));
        setSelected((prev) => (prev?.id === id ? null : prev));
      }
    });
  };

  if (loading) {
    return <div className="text-sm text-stone-400">Loading…</div>;
  }

  if (charts.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-stone-200 p-6 text-sm text-stone-500">
        No saved charts yet. Calculate a natal or solar return chart and click &quot;Save chart&quot;.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-stone-100 bg-stone-50">
              <th className="text-left px-4 py-2 text-xs font-semibold text-stone-500 uppercase tracking-wider">Title</th>
              <th className="text-left px-4 py-2 text-xs font-semibold text-stone-500 uppercase tracking-wider">Type</th>
              <th className="text-left px-4 py-2 text-xs font-semibold text-stone-500 uppercase tracking-wider">Saved</th>
              <th className="text-right px-4 py-2 text-xs font-semibold text-stone-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody>
            {charts.map((c) => (
              <tr key={c.id} className="border-b border-stone-50 hover:bg-stone-50">
                <td className="px-4 py-2 font-medium text-stone-800">
                  <button onClick={() => handleOpen(c.id)} className="hover:text-amber-700 text-left">
                    {c.title}
                  </button>
                </td>
                <td className="px-4 py-2 text-stone-600">{CHART_TYPE_LABELS[c.chart_type] ?? c.chart_type}</td>
                <td className="px-4 py-2 text-stone-500">{new Date(c.created_at).toLocaleDateString()}</td>
                <td className="px-4 py-2 text-right">
                  <button
                    onClick={() => handleDelete(c.id)}
                    disabled={pending}
                    className="text-red-600 hover:text-red-800 text-xs disabled:opacity-50"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selected && (() => {
        // The stored result JSON is shaped like NatalChartResult for both
        // chart types; solar_return additionally carries return_dt/natal_sun.
        const result = selected.result as unknown as NatalChartResult & { return_dt?: string };
        return (
          <div className="space-y-6">
            <h3 className="text-sm font-semibold text-stone-700">{selected.title}</h3>
            {selected.chart_type === "solar_return" && result.return_dt && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
                <span className="font-semibold">Solar Return moment: </span>
                {new Date(result.return_dt).toLocaleString(undefined, {
                  dateStyle: "full", timeStyle: "short", timeZone: "UTC",
                })} UTC
              </div>
            )}
            <ChartWheel data={result} />
            <PlanetTable planets={result.planets} />
            <AspectTable aspects={result.aspects} />
            <ArabicPartsTable parts={result.arabic_parts} />
          </div>
        );
      })()}
    </div>
  );
}
