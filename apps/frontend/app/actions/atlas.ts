"use server";

import { API_URL, getAccessToken } from "@/app/lib/auth";

export interface City {
  id: number;
  name: string;
  ascii_name: string;
  country: string;
  region: string;
  lat: number;
  lon: number;
  timezone: string;
  population: number;
}

export async function searchCities(q: string, country?: string): Promise<City[]> {
  if (q.length < 2) return [];

  const token = await getAccessToken();
  const params = new URLSearchParams({ q, limit: "8" });
  if (country) params.set("country", country);

  try {
    const res = await fetch(`${API_URL}/api/v1/atlas/search?${params}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      cache: "no-store",
    });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

export async function getTimezone(lat: number, lon: number): Promise<string | null> {
  try {
    const res = await fetch(
      `${API_URL}/api/v1/atlas/timezone?lat=${lat}&lon=${lon}`,
      { cache: "no-store" }
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data.timezone ?? null;
  } catch {
    return null;
  }
}
