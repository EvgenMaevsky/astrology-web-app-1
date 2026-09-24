"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { calcPublicNatalChart, PublicChartState } from "@/app/actions/public-chart";
import { BirthDataFields, type BirthData } from "@/app/_components/BirthDataFields";
import { ChartWheel } from "@/app/_components/chart-wheel/ChartWheel";
import { PlanetTable, AspectTable } from "@/app/(dashboard)/charts/_components/ResultTables";
import { ConversionDialog } from "./_ConversionDialog";
import { THEME } from "@/app/_components/ui/theme";

// Dark marketing surface — docs/plans/2026-09-24-e7-redesign-design.md §5.
const ui = THEME.dark;

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
      <form action={action} className={`${ui.card} space-y-5 p-6 sm:p-8`}>
        <BirthDataFields
          value={birth}
          onChange={setBirth}
          cityPlaceholder={tc("natal.cityPlaceholder")}
          tone="dark"
        />

        {state.status === "error" && (
          <p className={ui.error}>{state.error}</p>
        )}

        <button
          type="submit"
          disabled={pending}
          className={`${ui.primaryButton} px-6`}
        >
          {pending ? t("calculating") : t("calculate")}
        </button>
      </form>

      {state.status === "ok" && (
        <div ref={resultRef} tabIndex={-1} className="space-y-6">
          <h2 className="font-display text-3xl font-semibold text-starlight">{t("resultTitle")}</h2>
          {/* The wheel and tables sit on light cards even on this dark page:
              one set of wheel colours then works everywhere (spec §4). */}
          <div className="rounded-3xl bg-white p-3 shadow-[0_0_80px_-24px_rgba(124,92,255,0.55)] sm:p-6">
            <ChartWheel data={state.data} />
          </div>
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
