"use client";

import { openStripePortal } from "@/app/actions/billing";

export function ManageButton() {
  const handle = async () => {
    try {
      await openStripePortal();
    } catch {
      alert("Stripe Customer Portal is not available yet. Contact support.");
    }
  };

  return (
    <button
      onClick={handle}
      className="rounded-lg border border-stone-300 hover:bg-stone-50 text-stone-700 text-sm font-semibold px-4 py-2 transition-colors"
    >
      Manage subscription
    </button>
  );
}
