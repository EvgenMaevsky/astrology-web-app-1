import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { getPlans } from "@/app/actions/billing";
import { getFeatureTranslator } from "@/app/lib/billing-i18n";
import { buildOffers, type Offer } from "@/app/lib/offers";
import { FULL_SCREEN } from "./section";

/**
 * Plans come from the API catalogue, never from copy written here — the
 * catalogue test (services/astro-api/tests/test_plan_catalogue.py) is what
 * keeps them honest, and it only works if this page reads the same source.
 * The yearly discount is computed from the prices by buildOffers().
 */
export async function Pricing() {
  const [t, plans, translateFeature, locale] = await Promise.all([
    getTranslations("landing.pricing"),
    getPlans(),
    getFeatureTranslator(),
    getLocale(),
  ]);
  if (plans.length === 0) return null;
  const offers = buildOffers(plans);
  const cents = new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // The yearly card is the best deal, so it is the one that stands out.
  const badge = (offer: Offer) =>
    offer.interval !== "year"
      ? null
      : offer.freeMonths
        ? t("freeMonths", { months: offer.freeMonths })
        : offer.savingUsd
          ? t("saving", { saving: offer.savingUsd })
          : null;

  return (
    <section id="pricing" className={`${FULL_SCREEN} border-t border-space-800 bg-space-950 px-6 py-24`}>
      <div className="mx-auto w-full max-w-6xl">
        <div className="text-center">
          <h2 className="font-display text-4xl font-semibold text-starlight sm:text-5xl">{t("title")}</h2>
          <p className="mx-auto mt-4 max-w-xl text-dusk">{t("subtitle")}</p>
        </div>

        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {offers.map((offer) => {
            const featured = offer.interval === "year";
            const label = badge(offer);
            const paid = offer.priceUsd > 0;
            return (
              <article
                key={offer.key}
                className={`relative flex flex-col rounded-2xl p-8 backdrop-blur ${
                  featured
                    ? "border border-gold-400/60 bg-space-900 shadow-[0_0_60px_-20px_rgba(242,197,114,0.45)]"
                    : "border border-space-700 bg-space-900/60"
                }`}
              >
                {label && (
                  <span className="absolute -top-3 left-8 rounded-md bg-gold-400 px-2.5 py-0.5 text-xs font-semibold text-gold-950">
                    {label}
                  </span>
                )}
                <h3 className="text-sm uppercase tracking-[0.2em] text-dusk">
                  {offer.name}
                  {paid && (
                    <span className="normal-case tracking-normal"> · {offer.interval === "year" ? t("yearly") : t("monthly")}</span>
                  )}
                </h3>
                <p className="mt-3 font-display text-5xl font-semibold lining-nums text-starlight">
                  ${offer.priceUsd}
                  <span className="ml-1 font-sans text-base font-normal text-dusk">
                    {offer.interval === "year" ? t("perYear") : t("perMonth")}
                  </span>
                </p>
                {offer.perMonthUsd !== undefined && (
                  <p className="mt-1 text-sm text-dusk">{t("perMonthEquiv", { price: cents.format(offer.perMonthUsd) })}</p>
                )}
                <ul className="mt-6 flex-1 space-y-2.5">
                  {offer.features.map((feature) => (
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
                  {!paid ? t("cta") : offer.interval === "year" ? t("ctaProYear") : t("ctaPro")}
                </Link>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
