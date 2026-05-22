"use server";

import { API_URL, getAccessToken } from "@/app/lib/auth";

export interface NatalChartResult {
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

export type ChartState =
  | { status: "idle" }
  | { status: "error"; error: string }
  | { status: "ok"; data: NatalChartResult };

export async function calcNatalChart(
  _prev: ChartState,
  formData: FormData
): Promise<ChartState> {
  const token = await getAccessToken();
  if (!token) return { status: "error", error: "Not authenticated" };

  const birth_dt = formData.get("datetime") as string;
  const lat = parseFloat(formData.get("lat") as string);
  const lon = parseFloat(formData.get("lon") as string);
  const house_system = (formData.get("house_system") as string) || "placidus";

  if (!birth_dt || isNaN(lat) || isNaN(lon)) {
    return { status: "error", error: "Please fill in all fields" };
  }
  if (lat < -90 || lat > 90) return { status: "error", error: "Latitude must be between -90 and 90" };
  if (lon < -180 || lon > 180) return { status: "error", error: "Longitude must be between -180 and 180" };

  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/v1/charts/natal`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ birth_dt, lat, lon, house_system }),
      cache: "no-store",
    });
  } catch {
    return { status: "error", error: "Cannot connect to server" };
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    return { status: "error", error: body?.detail ?? `Server error ${res.status}` };
  }

  const data: NatalChartResult = await res.json();
  return { status: "ok", data };
}
