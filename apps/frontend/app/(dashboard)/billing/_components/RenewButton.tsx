"use client";

import { useTranslations } from "next-intl";
import { startMonopayCheckout } from "@/app/actions/billing";

export function RenewButton({ plan }: { plan: string }) {
  const t = useTranslations("billing");

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
      {t("renew")}
    </button>
  );
}
