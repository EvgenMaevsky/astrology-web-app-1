"use server";

import { getTranslations } from "next-intl/server";
import { API_URL, getAccessToken } from "@/app/lib/auth";

export interface NatalChartResult {
  planets: Record<string, {
    longitude: number;
    sign: string;
    sign_degree: number;
    house: number;
    retrograde: boolean;
    speed: number;
    term_ruler: string | null;
  }>;
  houses: number[];
  angles: { asc: number; mc: number; dsc: number; ic: number };
  aspects: {
    planet1: string;
    planet2: string;
    aspect: string;
    angle: number;
    orb: number;
    applying: boolean;
  }[];
  arabic_parts: {
    name: string;
    longitude: number;
    sign: string;
    sign_degree: number;
  }[];
}

export type ChartState =
  | { status: "idle" }
  | { status: "error"; error: string }
  | { status: "plan_limit"; message: string; required: string }
  | { status: "ok"; data: NatalChartResult };

export async function calcNatalChart(
  _prev: ChartState,
  formData: FormData
): Promise<ChartState> {
  const t = await getTranslations("charts.errors");
  const token = await getAccessToken();
  if (!token) return { status: "error", error: t("notAuthenticated") };

  const birth_dt = formData.get("datetime") as string;
  const timezone = (formData.get("timezone") as string)?.trim() || null;
  const lat = parseFloat(formData.get("lat") as string);
  const lon = parseFloat(formData.get("lon") as string);
  const house_system = (formData.get("house_system") as string) || "placidus";

  if (!birth_dt || isNaN(lat) || isNaN(lon)) {
    return { status: "error", error: t("fillAllFields") };
  }
  if (lat < -90 || lat > 90) return { status: "error", error: t("latRange") };
  if (lon < -180 || lon > 180) return { status: "error", error: t("lonRange") };

  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/v1/charts/natal`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ birth_dt, timezone, lat, lon, house_system }),
      cache: "no-store",
    });
  } catch {
    return { status: "error", error: t("cannotConnect") };
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const detail = body?.detail;
    if (res.status === 403 && detail?.code === "plan_limit") {
      return { status: "plan_limit", message: detail.message, required: detail.required };
    }
    return { status: "error", error: extractDetail(detail) ?? `Server error ${res.status}` };
  }

  const data: NatalChartResult = await res.json();
  return { status: "ok", data };
}

/** FastAPI error detail: string, {message}, or a 422 validation list. */
function extractDetail(detail: unknown): string | undefined {
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) return detail[0]?.msg;
  if (detail && typeof detail === "object" && "message" in detail) {
    return (detail as { message?: string }).message;
  }
  return undefined;
}
