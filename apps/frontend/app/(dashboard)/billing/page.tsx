import Link from "next/link";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { getSubscription, getChartUsage, getPlans, syncMonopay } from "@/app/actions/billing";
import { getFeatureTranslator } from "@/app/lib/billing-i18n";
import { ManageButton } from "./_components/ManageButton";
import { RenewButton } from "./_components/RenewButton";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("billing");
  return { title: `${t("title")} — Astrodite` };
}

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; monopay?: string }>;
}) {
  const { success, monopay } = await searchParams;
  const [t, locale, translateFeature] = await Promise.all([
    getTranslations("billing"),
    getLocale(),
    getFeatureTranslator(),
  ]);
  // A localhost webhook URL is unreachable from monobank's servers during
  // dev, and the production webhook can lag — re-check the pending invoice
  // right when the user lands back here from the payment page. The invoice
  // may not actually be paid yet (canceled, still pending, or expired), so
  // the banner below reflects the real sync result, not just the redirect.
  let monopayUpgraded = false;
  if (monopay) {
    const result = await syncMonopay();
    monopayUpgraded = !!result && result.plan !== "free";
  }
  const [sub, usage, plans] = await Promise.all([
    getSubscription(),
    getChartUsage(),
    getPlans(),
  ]);

  const planDetails = plans.find((p) => p.id === (sub?.plan ?? "free"));
  const isPaid = sub?.plan && sub.plan !== "free";
  const yearly = sub?.interval === "year";
  const periodEndDate = sub?.period_end ? new Date(sub.period_end) : null;

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="font-display text-3xl font-semibold text-ink-900">{t("title")}</h1>
        <p className="mt-1 text-sm text-ink-600">{t("subtitle")}</p>
      </div>

      {(success || monopayUpgraded) && (
        <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">
          {t("paymentSuccess")}
        </div>
      )}

      {monopay && !monopayUpgraded && (
        <div className="rounded-lg bg-mist-50 border border-mist-200 px-4 py-3 text-sm text-ink-600">
          {t("monopayPending")}
        </div>
      )}

      {/* Current plan */}
      <div className="bg-white rounded-xl border border-mist-200 p-6 space-y-4">
        <h2 className="text-sm font-semibold text-ink-700 uppercase tracking-wider">{t("currentPlan")}</h2>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-2xl font-bold text-ink-900">
              {planDetails?.name ?? "Free"}
              {isPaid && yearly && (
                <span className="ml-2 text-base font-medium text-ink-600">{t("yearlySuffix")}</span>
              )}
            </p>
            <p className="text-sm text-ink-600 mt-1">
              {planDetails?.price_usd === 0
                ? t("freeForever")
                : sub?.provider === "monopay" && periodEndDate
                ? t("activeUntil", { date: periodEndDate.toLocaleDateString(locale === "uk" ? "uk-UA" : "en-GB") })
                : yearly
                ? t("perYear", { price: planDetails?.price_usd_yearly ?? 0 })
                : t("perMonth", { price: planDetails?.price_usd ?? 0 })}
            </p>
          </div>
          <div className="flex gap-3">
            {sub?.provider === "monopay" ? (
              // monobank has no auto-renewal, so both periods are offered
              // here — this is also how a monthly buyer switches to yearly.
              <div className="flex flex-col items-end gap-2">
                <RenewButton plan={sub.plan} interval="month" label={t("renew")} />
                {planDetails?.price_usd_yearly ? (
                  <RenewButton
                    plan={sub.plan}
                    interval="year"
                    label={t("renewYear", { price: planDetails.price_usd_yearly })}
                  />
                ) : null}
              </div>
            ) : isPaid ? (
              <ManageButton />
            ) : (
              <Link
                href="/pricing"
                className="rounded-lg bg-gold-400 hover:brightness-105 text-gold-950 text-sm font-semibold px-4 py-2 transition-colors"
              >
                {t("upgrade")}
              </Link>
            )}
          </div>
        </div>

        {planDetails && (
          <ul className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {planDetails.features.map((f) => (
              <li key={f} className="flex items-start gap-2 text-sm text-ink-600">
                <span className="text-nebula-600 mt-0.5">✓</span>{translateFeature(f)}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Usage */}
      {usage && (
        <div className="bg-white rounded-xl border border-mist-200 p-6 space-y-3">
          <h2 className="text-sm font-semibold text-ink-700 uppercase tracking-wider">{t("usage")}</h2>
          <div className="flex items-center gap-4">
            <div>
              <p className="text-2xl font-bold text-ink-900">{usage.used}</p>
              <p className="text-xs text-ink-600">
                {t("chartsToday")}{usage.limit != null ? ` ${t("limitSuffix", { limit: usage.limit })}` : ""}
              </p>
            </div>
            {usage.limit != null && (
              <div className="flex-1 bg-mist-100 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-nebula-600 h-full rounded-full transition-all"
                  style={{ width: `${Math.min(100, (usage.used / usage.limit) * 100)}%` }}
                />
              </div>
            )}
          </div>
          {usage.plan === "free" && usage.limit != null && usage.used >= usage.limit && (
            <p className="text-sm text-gold-800 bg-gold-50 rounded-lg px-3 py-2">
              {t("dailyLimitReached")}{" "}
              <Link href="/pricing" className="underline font-medium">{t("upgradeToPro")}</Link>{" "}
              {t("forUnlimitedCharts")}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
