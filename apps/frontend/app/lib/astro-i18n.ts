"use client";

import { useMessages } from "next-intl";

type AstroCategory = "planets" | "signs" | "aspects";
type AstroMessages = Record<AstroCategory, Record<string, string>>;

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Safe dynamic lookup for backend-driven planet/sign/aspect names — these
 * come from the API as lowercase keys (planets, aspects) or already-capitalized
 * English words (signs), not as translation keys known at compile time, so
 * next-intl's typed t() doesn't fit. Falls back to the capitalized original
 * (which is exactly what the English UI already showed before i18n). */
export function useAstroTranslator() {
  const messages = useMessages() as { astro?: AstroMessages } | undefined;
  const astro = messages?.astro;

  return (category: AstroCategory, raw: string): string => {
    const dict = astro?.[category];
    const hit = dict?.[raw.toLowerCase()];
    return hit ?? capitalize(raw);
  };
}
