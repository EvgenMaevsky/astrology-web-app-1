"use client";

import { useLocale, useTranslations } from "next-intl";
import { useTransition } from "react";
import { setLocale } from "@/app/actions/locale";
import type { Locale } from "@/i18n/request";

export function LanguageSwitcher({ className = "" }: { className?: string }) {
  const locale = useLocale();
  const t = useTranslations("common.languageSwitcher");
  const [pending, startTransition] = useTransition();

  const handleSwitch = (next: Locale) => {
    if (next === locale) return;
    startTransition(() => {
      setLocale(next);
    });
  };

  return (
    <div className={`flex items-center gap-1 text-xs ${className}`}>
      {(["uk", "en"] as const).map((code) => (
        <button
          key={code}
          onClick={() => handleSwitch(code)}
          disabled={pending}
          className={`px-1.5 py-0.5 rounded transition-colors disabled:opacity-50 ${
            locale === code
              ? "font-semibold text-amber-700"
              : "text-stone-400 hover:text-stone-600"
          }`}
        >
          {t(code)}
        </button>
      ))}
    </div>
  );
}
