"use client";

import { useTranslations } from "next-intl";
import { startStripeCheckout, startMonopayCheckout } from "@/app/actions/billing";
import { Plan } from "@/app/actions/billing";
import { useFeatureTranslator } from "@/app/lib/billing-i18n";

interface Props {
  plan: Plan;
  currentPlan: string;
  monopayAvailable: boolean;
}

export function PricingCard({ plan, currentPlan, monopayAvailable }: Props) {
  const t = useTranslations("pricing");
  const translateFeature = useFeatureTranslator();
  const isCurrent = plan.id === currentPlan;
  const isUpgrade = plan.price_usd > 0 && plan.id !== currentPlan;

  const handleStripe = async () => {
    try {
      await startStripeCheckout(plan.id);
    } catch (e) {
      alert((e as Error).message);
    }
  };

  const handleMonopay = async () => {
    try {
      await startMonopayCheckout(plan.id);
    } catch (e) {
      alert((e as Error).message);
    }
  };

  return (
    <div
      className={`rounded-2xl border p-6 flex flex-col gap-5 ${
        plan.id === "pro"
          ? "border-gold-400 shadow-lg shadow-gold-50"
          : "border-mist-200"
      }`}
    >
      {plan.id === "pro" && (
        <span className="self-start rounded-full bg-gold-50 text-gold-800 text-xs font-semibold px-3 py-1">
          {t("mostPopular")}
        </span>
      )}

      <div>
        <h2 className="text-xl font-bold text-ink-900">{plan.name}</h2>
        {plan.price_usd === 0 ? (
          <p className="text-3xl font-semibold text-ink-900 mt-2">{t("free")}</p>
        ) : (
          <div className="mt-2">
            <p className="text-3xl font-semibold text-ink-900">
              ${plan.price_usd}
              <span className="text-base font-normal text-ink-600">{t("perMonth")}</span>
            </p>
            <p className="text-sm text-ink-600 mt-0.5">{t("approxUah", { uah: plan.price_uah })}</p>
          </div>
        )}
      </div>

      <ul className="flex-1 space-y-2">
        {plan.features.map((f) => (
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
      ) : isUpgrade ? (
        <div className="flex flex-col gap-2">
          <button
            onClick={handleStripe}
            className="rounded-lg bg-gold-400 hover:brightness-105 text-gold-950 text-sm font-semibold px-4 py-2.5 transition-colors"
          >
            {t("upgradeStripe")}
          </button>
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
