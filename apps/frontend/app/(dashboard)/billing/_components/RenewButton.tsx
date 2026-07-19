"use client";

import { startMonopayCheckout } from "@/app/actions/billing";

export function RenewButton({ plan }: { plan: string }) {
  const handle = async () => {
    try {
      await startMonopayCheckout(plan);
    } catch (e) {
      alert((e as Error).message);
    }
  };

  return (
    <button
      onClick={handle}
      className="rounded-lg border border-green-600 text-green-700 hover:bg-green-50 text-sm font-semibold px-4 py-2 transition-colors"
    >
      Renew for 30 more days
    </button>
  );
}
