"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { calcPublicNatalChart, PublicChartState } from "@/app/actions/public-chart";
import { BirthDataFields, type BirthData } from "@/app/_components/BirthDataFields";
import { ChartWheel } from "@/app/_components/chart-wheel/ChartWheel";
import { PlanetTable, AspectTable } from "@/app/(dashboard)/charts/_components/ResultTables";
import { ConversionDialog } from "./_ConversionDialog";

const initialState: PublicChartState = { status: "idle" };

// Shown once per browser session. Firing it on every recalculation would
// punish exactly the people who are engaged enough to try a second chart.
const SEEN_KEY = "astrodite.conversionDialogSeen";

function alreadySeen(): boolean {
  try {
    return sessionStorage.getItem(SEEN_KEY) === "1";
  } catch {
    // Private mode, blocked storage — treat as unseen rather than crashing.
    return false;
  }
}

function markSeen() {
  try {
    sessionStorage.setItem(SEEN_KEY, "1");
  } catch {
    /* nothing to do; the dialog simply shows again next time */
  }
}

export function PublicNatalForm({ showDialog }: { showDialog: boolean }) {
  const t = useTranslations("charts.public");
  const tc = useTranslations("charts");
  const [state, action, pending] = useActionState(calcPublicNatalChart, initialState);

  const [birth, setBirth] = useState<BirthData>({
    datetime: "1990-01-01T12:00",
    lat: 50.45,
    lon: 30.52,
    timezone: "Europe/Kyiv",
  });

  const [dialogOpen, setDialogOpen] = useState(false);
  const resultRef = useRef<HTMLDivElement>(null);
  const handledResult = useRef<PublicChartState | null>(null);

  useEffect(() => {
    // Only on a fresh successful result, and never for someone who is
    // already signed in — they have nothing to be sold.
    if (state.status !== "ok" || handledResult.current === state) return;
    handledResult.current = state;
    if (showDialog && !alreadySeen()) {
      setDialogOpen(true);
      markSeen();
    }
  }, [state, showDialog]);

  return (
    <div className="space-y-8">
      <form action={action} className="bg-white rounded-xl border border-stone-200 p-6 space-y-5">
        <BirthDataFields
          value={birth}
          onChange={setBirth}
          cityPlaceholder={tc("natal.cityPlaceholder")}
        />

        {state.status === "error" && (
          <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{state.error}</p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-sm font-semibold px-5 py-2.5 transition-colors"
        >
          {pending ? t("calculating") : t("calculate")}
        </button>
      </form>

      {state.status === "ok" && (
        <div ref={resultRef} tabIndex={-1} className="space-y-6">
          <h2 className="text-lg font-semibold text-stone-800">{t("resultTitle")}</h2>
          <ChartWheel data={state.data} />
          <PlanetTable planets={state.data.planets} showTerms={false} />
          <AspectTable aspects={state.data.aspects} />
        </div>
      )}

      {dialogOpen && (
        <ConversionDialog onClose={() => setDialogOpen(false)} returnFocusTo={resultRef} />
      )}
    </div>
  );
}
