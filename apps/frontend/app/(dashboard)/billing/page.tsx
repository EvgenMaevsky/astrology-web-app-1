import Link from "next/link";
import { getSubscription, getChartUsage, getPlans, syncMonopay } from "@/app/actions/billing";
import { ManageButton } from "./_components/ManageButton";
import { RenewButton } from "./_components/RenewButton";

export const metadata = { title: "Billing — Zorya" };

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; monopay?: string }>;
}) {
  const { success, monopay } = await searchParams;
  // A localhost webhook URL is unreachable from monobank's servers during
  // dev, and the production webhook can lag — re-check the pending invoice
  // right when the user lands back here from the payment page.
  if (monopay) {
    await syncMonopay();
  }
  const [sub, usage, plans] = await Promise.all([
    getSubscription(),
    getChartUsage(),
    getPlans(),
  ]);

  const planDetails = plans.find((p) => p.id === (sub?.plan ?? "free"));
  const isPaid = sub?.plan && sub.plan !== "free";
  const periodEndDate = sub?.period_end ? new Date(sub.period_end) : null;

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-semibold text-stone-900">Billing</h1>
        <p className="mt-1 text-sm text-stone-500">Manage your subscription.</p>
      </div>

      {(success || monopay) && (
        <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">
          Payment successful! Your plan has been upgraded.
        </div>
      )}

      {/* Current plan */}
      <div className="bg-white rounded-xl border border-stone-200 p-6 space-y-4">
        <h2 className="text-sm font-semibold text-stone-700 uppercase tracking-wider">Current plan</h2>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-2xl font-bold text-stone-900">{planDetails?.name ?? "Free"}</p>
            <p className="text-sm text-stone-500 mt-1">
              {planDetails?.price_usd === 0
                ? "Free forever"
                : sub?.provider === "monopay" && periodEndDate
                ? `Active until ${periodEndDate.toLocaleDateString()} — no auto-renewal`
                : `$${planDetails?.price_usd}/month`}
            </p>
          </div>
          <div className="flex gap-3">
            {sub?.provider === "monopay" ? (
              <RenewButton plan={sub.plan} />
            ) : isPaid ? (
              <ManageButton />
            ) : (
              <Link
                href="/pricing"
                className="rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold px-4 py-2 transition-colors"
              >
                Upgrade
              </Link>
            )}
          </div>
        </div>

        {planDetails && (
          <ul className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {planDetails.features.map((f) => (
              <li key={f} className="flex items-start gap-2 text-sm text-stone-600">
                <span className="text-amber-500 mt-0.5">✓</span>{f}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Usage */}
      {usage && (
        <div className="bg-white rounded-xl border border-stone-200 p-6 space-y-3">
          <h2 className="text-sm font-semibold text-stone-700 uppercase tracking-wider">Today&apos;s usage</h2>
          <div className="flex items-center gap-4">
            <div>
              <p className="text-2xl font-bold text-stone-900">{usage.used}</p>
              <p className="text-xs text-stone-500">
                charts calculated today{usage.limit != null ? ` / ${usage.limit} limit` : ""}
              </p>
            </div>
            {usage.limit != null && (
              <div className="flex-1 bg-stone-100 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-amber-500 h-full rounded-full transition-all"
                  style={{ width: `${Math.min(100, (usage.used / usage.limit) * 100)}%` }}
                />
              </div>
            )}
          </div>
          {usage.plan === "free" && usage.limit != null && usage.used >= usage.limit && (
            <p className="text-sm text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
              Daily limit reached.{" "}
              <Link href="/pricing" className="underline font-medium">Upgrade to Pro</Link>{" "}
              for unlimited charts.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
