import { getLocale, getTranslations } from "next-intl/server";
import { LANDING_FACTS } from "@/app/lib/landing-facts";
import { FULL_SCREEN } from "./section";

/**
 * "Why Astrodite": four figures, each with one line saying why it matters.
 *
 * Every number comes from LANDING_FACTS, which names its source and is
 * guarded against drift by a backend test. Nothing is typed in by hand —
 * and the notes only restate what those sources show.
 */
export async function TrustStats() {
  const [t, locale] = await Promise.all([getTranslations("landing.stats"), getLocale()]);
  const fmt = (value: number, digits = 0) =>
    new Intl.NumberFormat(locale, { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value);

  const stats = [
    { value: `${fmt(LANDING_FACTS.precisionDeg, 3)}°`, label: t("precision"), note: t("precisionNote") },
    { value: `${fmt(LANDING_FACTS.cities)}+`, label: t("cities"), note: t("citiesNote") },
    { value: fmt(LANDING_FACTS.houseSystems), label: t("houses"), note: t("housesNote") },
    { value: `${LANDING_FACTS.yearFrom}–${LANDING_FACTS.yearTo}`, label: t("years"), note: t("yearsNote") },
  ];

  return (
    <section
      id="facts"
      className={`${FULL_SCREEN} relative isolate overflow-hidden border-y border-space-800 bg-space-950 px-6 py-24`}
    >
      {/* A low glow behind the figures, echoing the hero's nebula. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_55%_45%_at_50%_60%,rgba(79,139,255,0.10),transparent_70%)]"
      />

      <div className="mx-auto w-full max-w-6xl">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs uppercase tracking-[0.3em] text-dusk">{t("eyebrow")}</p>
          <h2 className="mt-4 font-display text-4xl font-semibold text-starlight sm:text-5xl">{t("title")}</h2>
          <p className="mt-4 text-lg leading-relaxed text-dusk">{t("subtitle")}</p>
        </div>

        <dl className="mt-16 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => (
            // dt must precede its dd's in the markup (label, figure, note —
            // also the order a screen reader reads them); `order` shows the
            // figure first.
            <div
              key={stat.label}
              className="flex flex-col rounded-2xl border border-space-700 bg-space-900/60 p-6 text-center backdrop-blur"
            >
              <dt className="order-2 mt-3 text-sm font-medium text-starlight">{stat.label}</dt>
              <dd className="order-1 font-display text-4xl font-semibold lining-nums text-gold-400 sm:text-5xl">
                {stat.value}
              </dd>
              {/* dusk on the card ≈ 6.3:1 */}
              <dd className="order-3 mt-2 text-sm leading-relaxed text-dusk">{stat.note}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
