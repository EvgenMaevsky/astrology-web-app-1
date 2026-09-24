import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { getPlans } from "@/app/actions/billing";
import { getFeatureTranslator } from "@/app/lib/billing-i18n";

/**
 * Plans come from the API catalogue, never from copy written here — the
 * catalogue test (services/astro-api/tests/test_plan_catalogue.py) is what
 * keeps them honest, and it only works if this page reads the same source.
 */
export async function Pricing() {
  const [t, plans, translateFeature] = await Promise.all([
    getTranslations("landing.pricing"),
    getPlans(),
    getFeatureTranslator(),
  ]);
  if (plans.length === 0) return null;

  return (
    <section id="pricing" className="scroll-mt-16 border-t border-space-800 bg-space-950 px-6 py-24">
      <div className="mx-auto max-w-4xl">
        <div className="text-center">
          <h2 className="font-display text-4xl font-semibold text-starlight sm:text-5xl">{t("title")}</h2>
          <p className="mx-auto mt-4 max-w-xl text-dusk">{t("subtitle")}</p>
        </div>

        <div className="mt-14 grid gap-6 md:grid-cols-2">
          {plans.map((plan) => {
            const featured = plan.price_usd > 0;
            return (
              <article
                key={plan.id}
                className={`relative flex flex-col rounded-2xl p-8 backdrop-blur ${
                  featured
                    ? "border border-gold-400/60 bg-space-900 shadow-[0_0_60px_-20px_rgba(242,197,114,0.45)]"
                    : "border border-space-700 bg-space-900/60"
                }`}
              >
                {featured && (
                  <span className="absolute -top-3 left-8 rounded-md bg-gold-400 px-2.5 py-0.5 text-xs font-semibold text-gold-950">
                    {t("recommended")}
                  </span>
                )}
                <h3 className="text-sm uppercase tracking-[0.2em] text-dusk">{plan.name}</h3>
                <p className="mt-3 font-display text-5xl font-semibold lining-nums text-starlight">
                  ${plan.price_usd}
                  <span className="ml-1 font-sans text-base font-normal text-dusk">{t("perMonth")}</span>
                </p>
                <ul className="mt-6 flex-1 space-y-2.5">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex gap-2.5 text-sm text-starlight">
                      <span aria-hidden="true" className="text-gold-400">✓</span>
                      {translateFeature(feature)}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/register"
                  className={`mt-8 rounded-xl px-6 py-3 text-center font-semibold transition ${
                    featured
                      ? "bg-gold-400 text-gold-950 hover:brightness-110"
                      : "border border-space-600 text-starlight hover:border-dusk"
                  }`}
                >
                  {featured ? t("ctaPro") : t("cta")}
                </Link>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
