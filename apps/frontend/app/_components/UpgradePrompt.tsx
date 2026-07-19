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
    <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 flex flex-col sm:flex-row items-start sm:items-center gap-3">
      <div className="flex-1">
        <p className="text-sm font-semibold text-amber-900">
          {t("planRequired", { plan: planName })}
        </p>
        <p className="text-sm text-amber-700 mt-0.5">
          {message ?? t("defaultMessage", { plan: planName })}
        </p>
      </div>
      <Link
        href="/pricing"
        className="shrink-0 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold px-4 py-2 transition-colors"
      >
        {t("viewPlans")}
      </Link>
    </div>
  );
}
