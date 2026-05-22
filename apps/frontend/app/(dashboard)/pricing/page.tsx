import { getPlans, getSubscription } from "@/app/actions/billing";
import { PricingCard } from "./_components/PricingCard";

export const metadata = { title: "Pricing — ZET Geo" };

export default async function PricingPage({
  searchParams,
}: {
  searchParams: Promise<{ canceled?: string }>;
}) {
  const { canceled } = await searchParams;
  const [plans, sub] = await Promise.all([getPlans(), getSubscription()]);
  const currentPlan = sub?.plan ?? "free";

  // LiqPay is available when LIQPAY env is configured (server checks internally)
  const liqpayAvailable = true;

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-stone-900">Plans &amp; Pricing</h1>
        <p className="mt-2 text-stone-500">Choose the plan that fits your practice.</p>
      </div>

      {canceled && (
        <div className="rounded-lg bg-stone-50 border border-stone-200 px-4 py-3 text-sm text-stone-600 text-center">
          Payment was canceled — you were not charged.
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {plans.map((plan) => (
          <PricingCard
            key={plan.id}
            plan={plan}
            currentPlan={currentPlan}
            liqpayAvailable={liqpayAvailable}
          />
        ))}
      </div>

      <p className="text-center text-xs text-stone-400">
        All prices shown in USD. Ukrainian users may pay in UAH via LiqPay.
        Subscriptions renew monthly and can be canceled at any time.
      </p>
    </div>
  );
}
