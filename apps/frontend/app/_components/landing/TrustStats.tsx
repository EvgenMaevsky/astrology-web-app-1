import { getLocale, getTranslations } from "next-intl/server";
import { LANDING_FACTS } from "@/app/lib/landing-facts";

/**
 * Every number here comes from LANDING_FACTS, which names its source and is
 * guarded against drift by a backend test. Nothing is typed in by hand.
 */
export async function TrustStats() {
  const [t, locale] = await Promise.all([getTranslations("landing.stats"), getLocale()]);
  const fmt = (value: number, digits = 0) =>
    new Intl.NumberFormat(locale, { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value);

  const stats = [
    { value: `${fmt(LANDING_FACTS.precisionDeg, 3)}°`, label: t("precision") },
    { value: `${fmt(LANDING_FACTS.cities)}+`, label: t("cities") },
    { value: fmt(LANDING_FACTS.houseSystems), label: t("houses") },
    { value: `${LANDING_FACTS.yearFrom}–${LANDING_FACTS.yearTo}`, label: t("years") },
  ];

  return (
    <section id="facts" className="scroll-mt-16 border-y border-space-800 bg-space-950">
      <dl className="mx-auto grid max-w-6xl grid-cols-2 gap-y-10 px-6 py-14 lg:grid-cols-4">
        {stats.map((stat) => (
          // dt must precede dd in the markup; column-reverse puts the number
          // on top visually without breaking that.
          <div key={stat.label} className="flex flex-col-reverse text-center">
            <dt className="mt-2 text-sm text-dusk">{stat.label}</dt>
            <dd className="font-display text-4xl font-semibold lining-nums text-gold-400 sm:text-5xl">{stat.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
