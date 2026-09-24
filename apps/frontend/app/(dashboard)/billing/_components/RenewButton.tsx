"use client";

import { startMonopayCheckout } from "@/app/actions/billing";
import type { Interval } from "@/app/lib/offers";

export function RenewButton({ plan, interval, label }: { plan: string; interval: Interval; label: string }) {
  const handle = async () => {
    try {
      await startMonopayCheckout(plan, interval);
    } catch (e) {
      alert((e as Error).message);
    }
  };

  return (
    <button
      onClick={handle}
      className="rounded-lg border border-green-600 text-green-700 hover:bg-green-50 text-sm font-semibold px-4 py-2 transition-colors"
    >
      {label}
    </button>
  );
}
