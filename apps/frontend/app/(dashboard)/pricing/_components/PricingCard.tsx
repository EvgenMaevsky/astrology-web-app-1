"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { startStripeCheckout, startMonopayCheckout } from "@/app/actions/billing";
import { useFeatureTranslator } from "@/app/lib/billing-i18n";
import type { Interval, Offer } from "@/app/lib/offers";

interface Props {
  offer: Offer;
  currentPlan: string;
  /** Interval of the active paid subscription; null for free or none. */
  currentInterval: Interval | null;
  monopayAvailable: boolean;
}

export function PricingCard({ offer, currentPlan, currentInterval, monopayAvailable }: Props) {
  const t = useTranslations("pricing");
  const locale = useLocale();
  const translateFeature = useFeatureTranslator();
  const paid = offer.priceUsd > 0;
  const onThisPlan = offer.planId === currentPlan;
  // A paid plan with no subscription row (e.g. granted by hand) counts as monthly.
  const isCurrent = onThisPlan && (!paid || (currentInterval ?? "month") === offer.interval);
  // Already on Pro, looking at the other billing period: switching goes
  // through the Stripe portal or a monobank renewal, both on /billing.
  const otherInterval = onThisPlan && !isCurrent;
  const isUpgrade = paid && !onThisPlan;
  const yearly = offer.interval === "year";

  const handleStripe = async () => {
    try {
      await startStripeCheckout(offer.planId, offer.interval);
    } catch (e) {
      alert((e as Error).message);
    }
  };

  const handleMonopay = async () => {
    try {
      await startMonopayCheckout(offer.planId, offer.interval);
    } catch (e) {
      alert((e as Error).message);
    }
  };

  const cents = new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const badge = !yearly
    ? null
    : offer.freeMonths
      ? t("freeMonths", { months: offer.freeMonths })
      : offer.savingUsd
        ? t("saving", { saving: offer.savingUsd })
        : null;

  return (
    <div
      className={`rounded-2xl border bg-white p-6 flex flex-col gap-5 ${
        yearly ? "border-gold-400 shadow-lg shadow-gold-50" : "border-mist-200"
      }`}
    >
      {badge && (
        <span className="self-start rounded-full bg-gold-50 text-gold-800 text-xs font-semibold px-3 py-1">
          {badge}
        </span>
      )}

      <div>
        <h2 className="text-xl font-bold text-ink-900">
          {offer.name}
          {paid && (
            <span className="ml-2 text-sm font-medium text-ink-600">{yearly ? t("yearly") : t("monthly")}</span>
          )}
        </h2>
        {!paid ? (
          <p className="text-3xl font-semibold text-ink-900 mt-2">{t("free")}</p>
        ) : (
          <div className="mt-2">
            <p className="text-3xl font-semibold text-ink-900">
              ${offer.priceUsd}
              <span className="text-base font-normal text-ink-600">{yearly ? t("perYear") : t("perMonth")}</span>
            </p>
            {offer.perMonthUsd !== undefined && (
              <p className="text-sm text-ink-600 mt-0.5">
                {t("perMonthEquiv", { price: cents.format(offer.perMonthUsd) })}
              </p>
            )}
            <p className="text-sm text-ink-600 mt-0.5">
              {yearly ? t("approxUahYear", { uah: offer.priceUah }) : t("approxUah", { uah: offer.priceUah })}
            </p>
          </div>
        )}
      </div>

      <ul className="flex-1 space-y-2">
        {offer.features.map((f) => (
          <li key={f} className="flex items-start gap-2 text-sm text-ink-600">
            <span className="text-nebula-600 mt-0.5">✓</span>
            {translateFeature(f)}
          </li>
        ))}
      </ul>

      {isCurrent ? (
        <div className="rounded-lg bg-mist-100 text-ink-600 text-sm font-semibold px-4 py-2.5 text-center">
          {t("currentPlanLabel")}
        </div>
      ) : otherInterval ? (
        <Link href="/billing" className="text-center text-sm font-medium text-nebula-600 hover:underline">
          {t("switchInterval")}
        </Link>
      ) : isUpgrade ? (
        <div className="flex flex-col gap-2">
          {/* Hidden, not broken: the yearly Stripe price may not exist yet. */}
          {offer.stripeAvailable && (
            <button
              onClick={handleStripe}
              className="rounded-lg bg-gold-400 hover:brightness-105 text-gold-950 text-sm font-semibold px-4 py-2.5 transition-colors"
            >
              {t("upgradeStripe")}
            </button>
          )}
          {monopayAvailable && (
            <button
              onClick={handleMonopay}
              className="rounded-lg border border-green-600 text-green-700 hover:bg-green-50 text-sm font-semibold px-4 py-2.5 transition-colors"
            >
              {t("payMonopay")}
            </button>
          )}
        </div>
      ) : null}
    </div>
  );
}
