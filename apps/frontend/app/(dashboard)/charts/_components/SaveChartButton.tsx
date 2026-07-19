"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { saveChart } from "@/app/actions/saved-charts";

interface Props {
  chartType: "natal" | "solar_return";
  defaultTitle: string;
  requestPayload: object;
  result: object;
}

export function SaveChartButton({ chartType, defaultTitle, requestPayload, result }: Props) {
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const t = useTranslations("charts.save");

  const handleClick = () => {
    setError(null);
    startTransition(async () => {
      const res = await saveChart(chartType, defaultTitle, requestPayload, result);
      if (res.ok) {
        setSaved(true);
      } else {
        setError(res.error);
      }
    });
  };

  if (saved) {
    return (
      <span className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-1.5">
        {t("saved")}
      </span>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {error && <span className="text-xs text-red-600">{error}</span>}
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        className="rounded-lg border border-stone-300 bg-white hover:bg-stone-50 disabled:opacity-50 text-stone-700 text-sm font-medium px-3.5 py-1.5 transition-colors"
      >
        {pending ? t("saving") : t("button")}
      </button>
    </div>
  );
}
