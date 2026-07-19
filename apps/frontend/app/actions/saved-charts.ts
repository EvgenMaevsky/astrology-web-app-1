"use server";

import { getTranslations } from "next-intl/server";
import { API_URL, getAccessToken } from "@/app/lib/auth";

export interface SavedChartSummary {
  id: string;
  chart_type: string;
  title: string;
  person_id: string | null;
  created_at: string;
}

export interface SavedChartFull extends SavedChartSummary {
  request_payload: Record<string, unknown>;
  result: Record<string, unknown>;
}

async function authHeaders(): Promise<Record<string, string>> {
  const token = await getAccessToken();
  return token
    ? { "Content-Type": "application/json", Authorization: `Bearer ${token}` }
    : { "Content-Type": "application/json" };
}

export async function listSavedCharts(): Promise<SavedChartSummary[]> {
  const token = await getAccessToken();
  if (!token) return [];
  try {
    const res = await fetch(`${API_URL}/api/v1/saved-charts`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

export async function getSavedChart(id: string): Promise<SavedChartFull | null> {
  const token = await getAccessToken();
  if (!token) return null;
  try {
    const res = await fetch(`${API_URL}/api/v1/saved-charts/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export type SaveChartResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

export async function saveChart(
  chartType: "natal" | "solar_return",
  title: string,
  requestPayload: object,
  result: object
): Promise<SaveChartResult> {
  const t = await getTranslations("charts.errors");
  const token = await getAccessToken();
  if (!token) return { ok: false, error: t("notAuthenticated") };

  try {
    const res = await fetch(`${API_URL}/api/v1/saved-charts`, {
      method: "POST",
      headers: await authHeaders(),
      body: JSON.stringify({
        chart_type: chartType, title,
        request_payload: requestPayload, result,
      }),
      cache: "no-store",
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const detail = body?.detail;
      const message = typeof detail === "string" ? detail : detail?.message;
      return { ok: false, error: message ?? `Server error ${res.status}` };
    }
    const data = await res.json();
    return { ok: true, id: data.id };
  } catch {
    return { ok: false, error: t("cannotConnect") };
  }
}

export async function deleteSavedChart(id: string): Promise<{ ok: boolean }> {
  const token = await getAccessToken();
  if (!token) return { ok: false };
  try {
    const res = await fetch(`${API_URL}/api/v1/saved-charts/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    return { ok: res.ok };
  } catch {
    return { ok: false };
  }
}
