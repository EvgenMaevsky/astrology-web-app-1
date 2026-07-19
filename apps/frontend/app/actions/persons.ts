"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { API_URL, getAccessToken } from "@/app/lib/auth";

export interface Person {
  id: string;
  name: string;
  birth_dt: string;
  timezone: string;
  lat: number;
  lon: number;
  city_label: string | null;
  notes: string | null;
  created_at: string;
}

async function authHeaders(): Promise<Record<string, string>> {
  const token = await getAccessToken();
  return token
    ? { "Content-Type": "application/json", Authorization: `Bearer ${token}` }
    : { "Content-Type": "application/json" };
}

export async function listPersons(): Promise<Person[]> {
  const token = await getAccessToken();
  if (!token) return [];
  try {
    const res = await fetch(`${API_URL}/api/v1/persons`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

export async function getPersonCount(): Promise<number> {
  const token = await getAccessToken();
  if (!token) return 0;
  try {
    const res = await fetch(`${API_URL}/api/v1/persons/count`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!res.ok) return 0;
    const data = await res.json();
    return data.count ?? 0;
  } catch {
    return 0;
  }
}

export type PersonFormState =
  | { status: "idle" }
  | { status: "error"; error: string }
  | { status: "ok"; person: Person };

export async function createPerson(
  _prev: PersonFormState,
  formData: FormData
): Promise<PersonFormState> {
  const t = await getTranslations("persons.errors");
  const token = await getAccessToken();
  if (!token) return { status: "error", error: t("notAuthenticated") };

  const name = (formData.get("name") as string)?.trim();
  const birth_dt = formData.get("birth_dt") as string;
  const timezone = formData.get("timezone") as string;
  const lat = parseFloat(formData.get("lat") as string);
  const lon = parseFloat(formData.get("lon") as string);
  const city_label = (formData.get("city_label") as string) || null;
  const notes = (formData.get("notes") as string) || null;

  if (!name) return { status: "error", error: t("nameRequired") };
  if (!birth_dt) return { status: "error", error: t("birthDateRequired") };
  if (!timezone) return { status: "error", error: t("timezoneRequired") };
  if (isNaN(lat) || isNaN(lon)) return { status: "error", error: t("invalidCoordinates") };

  try {
    const res = await fetch(`${API_URL}/api/v1/persons`, {
      method: "POST",
      headers: await authHeaders(),
      body: JSON.stringify({ name, birth_dt, timezone, lat, lon, city_label, notes }),
      cache: "no-store",
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return { status: "error", error: body?.detail ?? `Error ${res.status}` };
    }
    revalidatePath("/persons");
    revalidatePath("/dashboard");
    return { status: "ok", person: await res.json() };
  } catch {
    return { status: "error", error: t("cannotConnect") };
  }
}

export async function deletePerson(id: string): Promise<{ ok: boolean }> {
  const token = await getAccessToken();
  if (!token) return { ok: false };
  try {
    const res = await fetch(`${API_URL}/api/v1/persons/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (res.ok) {
      revalidatePath("/persons");
      revalidatePath("/dashboard");
    }
    return { ok: res.ok };
  } catch {
    return { ok: false };
  }
}
