"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";

interface Props {
  message?: string;
  required?: string;
}

export function UpgradePrompt({ message, required: _required }: Props) {
  const t = useTranslations("common.upgradePrompt");
  // Only "pro" is ever purchasable right now — "expert" is hidden from sale
  // (see billing.py PLANS), so there's no other plan name to show here.
  const planName = "Pro";
  return (
    <div className="rounded-xl bg-gold-50 border border-gold-400/60 p-4 flex flex-col sm:flex-row items-start sm:items-center gap-3">
      <div className="flex-1">
        <p className="text-sm font-semibold text-gold-950">
          {t("planRequired", { plan: planName })}
        </p>
        <p className="text-sm text-gold-800 mt-0.5">
          {message ?? t("defaultMessage", { plan: planName })}
        </p>
      </div>
      <Link
        href="/pricing"
        className="shrink-0 rounded-lg bg-gold-400 hover:brightness-105 text-gold-950 text-sm font-semibold px-4 py-2 transition-colors"
      >
        {t("viewPlans")}
      </Link>
    </div>
  );
}
