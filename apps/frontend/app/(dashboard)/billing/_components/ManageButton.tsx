"use client";

import { useTranslations } from "next-intl";
import { openStripePortal } from "@/app/actions/billing";

export function ManageButton() {
  const t = useTranslations("billing");

  const handle = async () => {
    try {
      await openStripePortal();
    } catch {
      alert(t("stripePortalUnavailable"));
    }
  };

  return (
    <button
      onClick={handle}
      className="rounded-lg border border-stone-300 hover:bg-stone-50 text-stone-700 text-sm font-semibold px-4 py-2 transition-colors"
    >
      {t("manageSubscription")}
    </button>
  );
}
