"use client";

import { useLocale, useTranslations } from "next-intl";
import { useTransition } from "react";
import { setLocale } from "@/app/actions/locale";
import type { Locale } from "@/i18n/request";

const TONES = {
  // The dashboard and the beige pages until E7c moves them over.
  // nebula-700 / ink-600 on white ≈ 6.6 / 6.6:1
  light: { active: "font-semibold text-nebula-700", idle: "text-ink-600 hover:text-ink-900" },
  // The dark marketing surfaces (docs/plans/2026-09-24-e7-redesign-design.md).
  dark: { active: "font-semibold text-gold-400", idle: "text-dusk hover:text-starlight" },
} as const;

export function LanguageSwitcher({
  className = "",
  tone = "light",
}: {
  className?: string;
  tone?: keyof typeof TONES;
}) {
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
            locale === code ? TONES[tone].active : TONES[tone].idle
          }`}
        >
          {t(code)}
        </button>
      ))}
    </div>
  );
}
