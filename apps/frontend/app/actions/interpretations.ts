"use server";

import { API_URL } from "@/app/lib/auth";

export interface InterpretationText {
  title: string;
  text: string;
}

/**
 * Texts for the given keys; keys without a text are simply absent. Returns
 * an empty map on any failure — the chart is the product, the interpretation
 * is extra, and must not take the result page down with it.
 */
export async function getInterpretations(keys: string[]): Promise<Record<string, InterpretationText>> {
  if (keys.length === 0) return {};
  try {
    const params = new URLSearchParams({ keys: keys.join(","), lang: "uk" });
    const res = await fetch(`${API_URL}/api/v1/interpretations?${params}`, { cache: "no-store" });
    if (!res.ok) return {};
    return (await res.json()) as Record<string, InterpretationText>;
  } catch {
    return {};
  }
}
