"use client";

import { useEffect, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
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

export function SavedChartsTab() {
  const [charts, setCharts] = useState<SavedChartSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<SavedChartFull | null>(null);
  const [pending, startTransition] = useTransition();
  const locale = useLocale();
  const t = useTranslations("charts.saved");
  const ts = useTranslations("charts.solarReturn");

  const CHART_TYPE_LABELS: Record<string, string> = {
    natal: t("natal"),
    solar_return: t("solarReturn"),
  };

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
    return <div className="text-sm text-ink-600">{t("loading")}</div>;
  }

  if (charts.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-mist-200 p-6 text-sm text-ink-600">
        {t("empty")}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-mist-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-mist-100 bg-mist-50">
                <th className="text-left px-4 py-2 text-xs font-semibold text-ink-600 uppercase tracking-wider">{t("title")}</th>
                <th className="text-left px-4 py-2 text-xs font-semibold text-ink-600 uppercase tracking-wider">{t("type")}</th>
                <th className="text-left px-4 py-2 text-xs font-semibold text-ink-600 uppercase tracking-wider">{t("savedDate")}</th>
                <th className="text-right px-4 py-2 text-xs font-semibold text-ink-600 uppercase tracking-wider">{t("actions")}</th>
              </tr>
            </thead>
            <tbody>
              {charts.map((c) => (
                <tr key={c.id} className="border-b border-mist-100 hover:bg-mist-50">
                  <td className="px-4 py-2 font-medium text-ink-900">
                    <button onClick={() => handleOpen(c.id)} className="hover:text-nebula-600 text-left">
                      {c.title}
                    </button>
                  </td>
                  <td className="px-4 py-2 text-ink-600">{CHART_TYPE_LABELS[c.chart_type] ?? c.chart_type}</td>
                  <td className="px-4 py-2 text-ink-600">{new Date(c.created_at).toLocaleDateString(locale === "uk" ? "uk-UA" : "en-GB")}</td>
                  <td className="px-4 py-2 text-right">
                    <button
                      onClick={() => handleDelete(c.id)}
                      disabled={pending}
                      className="text-red-600 hover:text-red-800 text-xs disabled:opacity-50"
                    >
                      {t("delete")}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selected && (() => {
        // The stored result JSON is shaped like NatalChartResult for both
        // chart types; solar_return additionally carries return_dt/natal_sun.
        const result = selected.result as unknown as NatalChartResult & { return_dt?: string };
        return (
          <div className="space-y-6">
            <h3 className="text-sm font-semibold text-ink-700">{selected.title}</h3>
            {selected.chart_type === "solar_return" && result.return_dt && (
              <div className="bg-mist-100 border border-mist-200 rounded-xl px-4 py-3 text-sm text-ink-700">
                <span className="font-semibold">{ts("returnMoment")}</span>
                {new Date(result.return_dt).toLocaleString(locale === "uk" ? "uk-UA" : "en-GB", {
                  dateStyle: "full", timeStyle: "short", timeZone: "UTC",
                })} UTC
              </div>
            )}
            <div className="rounded-xl border border-mist-200 bg-white p-3 sm:p-6">
              <ChartWheel data={result} />
            </div>
            <PlanetTable planets={result.planets} />
            <AspectTable aspects={result.aspects} />
            <ArabicPartsTable parts={result.arabic_parts} />
          </div>
        );
      })()}
    </div>
  );
}
