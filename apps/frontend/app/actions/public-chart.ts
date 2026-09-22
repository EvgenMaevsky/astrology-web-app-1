"use server";

import { getTranslations } from "next-intl/server";
import { API_URL } from "@/app/lib/auth";

/**
 * Narrower than NatalChartResult on purpose: the public endpoint returns no
 * Arabic parts and no term rulers, and this type says so. If either ever
 * appears here, something upstream started handing out paid data.
 */
export interface PublicNatalResult {
  planets: Record<string, {
    longitude: number;
    sign: string;
    sign_degree: number;
    house: number;
    retrograde: boolean;
    speed: number;
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
}

export type PublicChartState =
  | { status: "idle" }
  | { status: "error"; error: string }
  | { status: "ok"; data: PublicNatalResult };

export async function calcPublicNatalChart(
  _prev: PublicChartState,
  formData: FormData
): Promise<PublicChartState> {
  const t = await getTranslations("charts.errors");

  const birth_dt = formData.get("datetime") as string;
  const timezone = (formData.get("timezone") as string)?.trim() || null;
  const lat = parseFloat(formData.get("lat") as string);
  const lon = parseFloat(formData.get("lon") as string);

  if (!birth_dt || isNaN(lat) || isNaN(lon)) {
    return { status: "error", error: t("fillAllFields") };
  }
  if (lat < -90 || lat > 90) return { status: "error", error: t("latRange") };
  if (lon < -180 || lon > 180) return { status: "error", error: t("lonRange") };

  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/v1/charts/natal/public`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ birth_dt, timezone, lat, lon }),
      cache: "no-store",
    });
  } catch {
    return { status: "error", error: t("cannotConnect") };
  }

  if (res.status === 429) return { status: "error", error: t("tooManyRequests") };
  if (res.status === 422) {
    const body = await res.json().catch(() => ({}));
    // Pydantic reports the ephemeris range here; anything else is a field the
    // form should have caught.
    const detail = Array.isArray(body?.detail) ? body.detail[0]?.msg : null;
    return { status: "error", error: detail ?? t("invalidInput") };
  }
  if (!res.ok) return { status: "error", error: t("calculationFailed") };

  return { status: "ok", data: (await res.json()) as PublicNatalResult };
}
