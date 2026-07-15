"use server";

import { API_URL, getAccessToken } from "@/app/lib/auth";
import { NatalChartResult } from "@/app/actions/charts";

export interface CrossAspect {
  transit: string;
  natal: string;
  aspect: string;
  angle: number;
  orb: number;
  applying: boolean;
}

export interface SynastryInterAspect {
  person1: string;
  person2: string;
  aspect: string;
  angle: number;
  orb: number;
  applying: boolean;
}

export interface TransitResult {
  natal: NatalChartResult;
  transit: NatalChartResult["planets"];
  aspects: CrossAspect[];
}

export interface SolarReturnResult extends NatalChartResult {
  return_dt: string;
  natal_sun: number;
}

export interface SynastryResult {
  person1: NatalChartResult;
  person2: NatalChartResult;
  inter_aspects: SynastryInterAspect[];
}

export type ExtendedChartState<T> =
  | { status: "idle" }
  | { status: "error"; error: string }
  | { status: "plan_limit"; message: string; required: string }
  | { status: "ok"; data: T };

async function authFetch(path: string, body: object): Promise<Response> {
  const token = await getAccessToken();
  if (!token) throw new Error("Not authenticated");
  return fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
    cache: "no-store",
  });
}

function handlePlanLimit(body: { detail?: { code?: string; message?: string; required?: string } }) {
  if (body.detail?.code === "plan_limit") {
    return { status: "plan_limit" as const, message: body.detail.message ?? "", required: body.detail.required ?? "pro" };
  }
  return null;
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

function tzField(formData: FormData, name: string): string | null {
  return (formData.get(name) as string)?.trim() || null;
}

export async function calcTransit(
  _prev: ExtendedChartState<TransitResult>,
  formData: FormData
): Promise<ExtendedChartState<TransitResult>> {
  const token = await getAccessToken();
  if (!token) return { status: "error", error: "Not authenticated" };

  const natal_dt = formData.get("natal_dt") as string;
  const natal_tz = tzField(formData, "natal_tz");
  const natal_lat = parseFloat(formData.get("natal_lat") as string);
  const natal_lon = parseFloat(formData.get("natal_lon") as string);
  const transit_dt = formData.get("transit_dt") as string;
  const transit_tz = tzField(formData, "transit_tz");
  const transit_lat = parseFloat(formData.get("transit_lat") as string);
  const transit_lon = parseFloat(formData.get("transit_lon") as string);
  const house_system = (formData.get("house_system") as string) || "placidus";

  if (!natal_dt || !transit_dt || isNaN(natal_lat) || isNaN(natal_lon) || isNaN(transit_lat) || isNaN(transit_lon)) {
    return { status: "error", error: "Please fill in all fields" };
  }

  let res: Response;
  try {
    res = await authFetch("/api/v1/charts/transit", {
      natal_dt, natal_tz, natal_lat, natal_lon,
      transit_dt, transit_tz, transit_lat, transit_lon, house_system,
    });
  } catch {
    return { status: "error", error: "Cannot connect to server" };
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const limit = handlePlanLimit(body);
    if (limit) return limit;
    return { status: "error", error: extractDetail(body?.detail) ?? `Server error ${res.status}` };
  }

  const data: TransitResult = await res.json();
  return { status: "ok", data };
}

export async function calcSolarReturn(
  _prev: ExtendedChartState<SolarReturnResult>,
  formData: FormData
): Promise<ExtendedChartState<SolarReturnResult>> {
  const token = await getAccessToken();
  if (!token) return { status: "error", error: "Not authenticated" };

  const birth_dt = formData.get("birth_dt") as string;
  const timezone = tzField(formData, "timezone");
  const year = parseInt(formData.get("year") as string);
  const lat = parseFloat(formData.get("lat") as string);
  const lon = parseFloat(formData.get("lon") as string);
  const house_system = (formData.get("house_system") as string) || "placidus";

  if (!birth_dt || isNaN(year) || isNaN(lat) || isNaN(lon)) {
    return { status: "error", error: "Please fill in all fields" };
  }

  let res: Response;
  try {
    res = await authFetch("/api/v1/charts/solar-return", { birth_dt, timezone, year, lat, lon, house_system });
  } catch {
    return { status: "error", error: "Cannot connect to server" };
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const limit = handlePlanLimit(body);
    if (limit) return limit;
    return { status: "error", error: extractDetail(body?.detail) ?? `Server error ${res.status}` };
  }

  const data: SolarReturnResult = await res.json();
  return { status: "ok", data };
}

export async function calcSynastry(
  _prev: ExtendedChartState<SynastryResult>,
  formData: FormData
): Promise<ExtendedChartState<SynastryResult>> {
  const token = await getAccessToken();
  if (!token) return { status: "error", error: "Not authenticated" };

  const dt1 = formData.get("dt1") as string;
  const tz1 = tzField(formData, "tz1");
  const lat1 = parseFloat(formData.get("lat1") as string);
  const lon1 = parseFloat(formData.get("lon1") as string);
  const dt2 = formData.get("dt2") as string;
  const tz2 = tzField(formData, "tz2");
  const lat2 = parseFloat(formData.get("lat2") as string);
  const lon2 = parseFloat(formData.get("lon2") as string);
  const house_system = (formData.get("house_system") as string) || "placidus";

  if (!dt1 || !dt2 || isNaN(lat1) || isNaN(lon1) || isNaN(lat2) || isNaN(lon2)) {
    return { status: "error", error: "Please fill in all fields" };
  }

  let res: Response;
  try {
    res = await authFetch("/api/v1/charts/synastry", { dt1, tz1, lat1, lon1, dt2, tz2, lat2, lon2, house_system });
  } catch {
    return { status: "error", error: "Cannot connect to server" };
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const limit = handlePlanLimit(body);
    if (limit) return limit;
    return { status: "error", error: extractDetail(body?.detail) ?? `Server error ${res.status}` };
  }

  const data: SynastryResult = await res.json();
  return { status: "ok", data };
}
