"use client";

import { startStripeCheckout } from "@/app/actions/billing";
import { Plan } from "@/app/actions/billing";

interface Props {
  plan: Plan;
  currentPlan: string;
  liqpayAvailable: boolean;
}

export function PricingCard({ plan, currentPlan, liqpayAvailable }: Props) {
  const isCurrent = plan.id === currentPlan;
  const isUpgrade = plan.price_usd > 0 && plan.id !== currentPlan;

  const handleStripe = async () => {
    try {
      await startStripeCheckout(plan.id);
    } catch (e) {
      alert((e as Error).message);
    }
  };

  return (
    <div
      className={`rounded-2xl border p-6 flex flex-col gap-5 ${
        plan.id === "pro"
          ? "border-amber-400 shadow-lg shadow-amber-100"
          : "border-stone-200"
      }`}
    >
      {plan.id === "pro" && (
        <span className="self-start rounded-full bg-amber-100 text-amber-800 text-xs font-semibold px-3 py-1">
          Most popular
        </span>
      )}

      <div>
        <h2 className="text-xl font-bold text-stone-900">{plan.name}</h2>
        {plan.price_usd === 0 ? (
          <p className="text-3xl font-semibold text-stone-900 mt-2">Free</p>
        ) : (
          <div className="mt-2">
            <p className="text-3xl font-semibold text-stone-900">
              ${plan.price_usd}
              <span className="text-base font-normal text-stone-500">/mo</span>
            </p>
            <p className="text-sm text-stone-400 mt-0.5">≈ {plan.price_uah} UAH/month</p>
          </div>
        )}
      </div>

      <ul className="flex-1 space-y-2">
        {plan.features.map((f) => (
          <li key={f} className="flex items-start gap-2 text-sm text-stone-600">
            <span className="text-amber-500 mt-0.5">✓</span>
            {f}
          </li>
        ))}
      </ul>

      {isCurrent ? (
        <div className="rounded-lg bg-stone-100 text-stone-500 text-sm font-semibold px-4 py-2.5 text-center">
          Current plan
        </div>
      ) : isUpgrade ? (
        <div className="flex flex-col gap-2">
          <button
            onClick={handleStripe}
            className="rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold px-4 py-2.5 transition-colors"
          >
            Upgrade with Card (Stripe)
          </button>
          {liqpayAvailable && (
            <LiqPayButton plan={plan.id} />
          )}
        </div>
      ) : null}
    </div>
  );
}

function LiqPayButton({ plan }: { plan: string }) {
  const handleLiqPay = async () => {
    const { getLiqPayForm } = await import("@/app/actions/billing");
    const form = await getLiqPayForm(plan);
    if (!form) { alert("LiqPay unavailable"); return; }

    const f = document.createElement("form");
    f.method = "POST";
    f.action = "https://www.liqpay.ua/api/3/checkout";
    f.target = "_blank";
    f.style.display = "none";

    const addField = (name: string, value: string) => {
      const i = document.createElement("input");
      i.type = "hidden"; i.name = name; i.value = value;
      f.appendChild(i);
    };
    addField("data", form.data);
    addField("signature", form.signature);

    document.body.appendChild(f);
    f.submit();
    document.body.removeChild(f);
  };

  return (
    <button
      onClick={handleLiqPay}
      className="rounded-lg border border-green-600 text-green-700 hover:bg-green-50 text-sm font-semibold px-4 py-2.5 transition-colors"
    >
      Upgrade with LiqPay (UAH)
    </button>
  );
}
