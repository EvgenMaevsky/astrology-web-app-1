"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { getInterpretations, type InterpretationText } from "@/app/actions/interpretations";
import { CollapsibleCard } from "@/app/_components/ui/CollapsibleCard";
import { interpretationSections, type ChartInput } from "@/app/lib/interpretation-keys";

/**
 * "Interpretation" under a natal chart's tables: pre-written texts for the
 * placements this chart actually has. Groups fold like the tables do, the
 * first one open.
 */
export function Interpretation({ chart }: { chart: ChartInput }) {
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
        <h2 id="interpretation-heading" className="font-display text-3xl font-semibold text-ink-900">
          {t("title")}
        </h2>
        <p className="mt-1 text-sm text-ink-600">{t("disclaimer")}</p>
      </div>
      {filled.map((section, i) => (
        <CollapsibleCard key={section.id} title={t(`sections.${section.id}`)} defaultOpen={i === 0}>
          <div className="divide-y divide-mist-100">
            {section.entries.map((entry) => (
              <article key={entry.key} className="px-5 py-5 sm:px-6">
                <h4 className="font-display text-xl font-semibold text-ink-900">{entry.title}</h4>
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
