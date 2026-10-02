"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { getInterpretations, type InterpretationText } from "@/app/actions/interpretations";
import { CollapsibleCard } from "@/app/_components/ui/CollapsibleCard";
import { interpretationSections, type ChartInput } from "@/app/lib/interpretation-keys";
import { glyphsFor } from "@/app/lib/interpretation-glyphs";
import type { Tone } from "@/app/_components/ui/theme";

// The heading and the note sit on the page itself — dark on /natal, light in
// the dashboard. The cards below are white on both, like the result tables.
const HEADING: Record<Tone, { title: string; note: string }> = {
  // starlight / dusk on space-950 ≈ 16.0 / 7.0:1
  dark: { title: "text-starlight", note: "text-dusk" },
  // ink-900 / ink-600 on mist-50 ≈ 15.4 / 6.1:1
  light: { title: "text-ink-900", note: "text-ink-600" },
};

/**
 * "Interpretation" under a natal chart's tables: pre-written texts for the
 * placements this chart actually has. Groups fold like the tables do, the
 * first one open.
 */
export function Interpretation({ chart, tone = "light" }: { chart: ChartInput; tone?: Tone }) {
  const t = useTranslations("charts.interpretation");
  const sections = useMemo(() => interpretationSections(chart), [chart]);
  const [texts, setTexts] = useState<Record<string, InterpretationText> | null>(null);

  useEffect(() => {
    let cancelled = false;
    setTexts(null);
    getInterpretations(sections.flatMap((s) => s.keys)).then((result) => {
      if (!cancelled) setTexts(result);
    });
    return () => {
      cancelled = true;
    };
  }, [sections]);

  if (texts === null) {
    return <div className="h-24 animate-pulse rounded-xl bg-mist-100" aria-hidden="true" />;
  }

  const filled = sections
    .map((s) => ({ ...s, entries: s.keys.filter((k) => texts[k]).map((k) => ({ key: k, ...texts[k] })) }))
    .filter((s) => s.entries.length > 0);
  if (filled.length === 0) return null;

  return (
    <section aria-labelledby="interpretation-heading" className="space-y-4">
      <div>
        <h2 id="interpretation-heading" className={`font-display text-3xl font-semibold ${HEADING[tone].title}`}>
          {t("title")}
        </h2>
        <p className={`mt-1 text-sm ${HEADING[tone].note}`}>{t("disclaimer")}</p>
      </div>
      {filled.map((section, i) => (
        <CollapsibleCard key={section.id} title={t(`sections.${section.id}`)} defaultOpen={i === 0}>
          <div className="divide-y divide-mist-100">
            {section.entries.map((entry) => (
              <article key={entry.key} className="px-5 py-5 sm:px-6">
                <h4 className="flex flex-wrap items-baseline gap-x-3 gap-y-1 font-display text-xl font-semibold text-ink-900">
                  {/* Decorative: the title already names every symbol. Sans for
                      the glyphs — the display serif lacks most of them, and the
                      fallback mix looked uneven. nebula-600 on white ≈ 5.2:1 */}
                  <span aria-hidden="true" className="font-sans text-lg font-normal tracking-wide text-nebula-600">
                    {glyphsFor(entry.key).join(" ")}
                  </span>
                  <span>{entry.title}</span>
                </h4>
                {entry.text.split("\n\n").map((paragraph, j) => (
                  <p key={j} className="mt-2 text-[15px] leading-relaxed text-ink-700">
                    {paragraph}
                  </p>
                ))}
              </article>
            ))}
          </div>
        </CollapsibleCard>
      ))}
    </section>
  );
}
