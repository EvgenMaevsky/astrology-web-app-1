"use server";

import { redirect } from "next/navigation";
import { API_URL, getAccessToken } from "@/app/lib/auth";

export interface Plan {
  id: string;
  name: string;
  price_usd: number;
  price_uah: number;
  features: string[];
  limits: Record<string, number>;
}

export interface Subscription {
  plan: string;
  plan_name: string;
  provider: "stripe" | "monopay" | null;
  period_end: string | null;
}

export interface ChartUsage {
  used: number;
  limit: number | null;
  plan: string;
}

export async function getPlans(): Promise<Plan[]> {
  try {
    const res = await fetch(`${API_URL}/api/v1/billing/plans`, { cache: "no-store" });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

export async function getSubscription(): Promise<Subscription | null> {
  const token = await getAccessToken();
  if (!token) return null;
  try {
    const res = await fetch(`${API_URL}/api/v1/billing/subscription`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function getChartUsage(): Promise<ChartUsage | null> {
  const token = await getAccessToken();
  if (!token) return null;
  try {
    const res = await fetch(`${API_URL}/api/v1/charts/usage`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function startStripeCheckout(plan: string): Promise<void> {
  const token = await getAccessToken();
  if (!token) redirect("/login");

  const res = await fetch(`${API_URL}/api/v1/billing/stripe/checkout`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ plan }),
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.detail ?? "Stripe checkout failed");
  }

  const { url } = await res.json();
  redirect(url);
}

export async function openStripePortal(): Promise<void> {
  const token = await getAccessToken();
  if (!token) redirect("/login");

  const res = await fetch(`${API_URL}/api/v1/billing/stripe/portal`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  if (!res.ok) throw new Error("Portal unavailable");
  const { url } = await res.json();
  redirect(url);
}

export async function startMonopayCheckout(plan: string): Promise<void> {
  const token = await getAccessToken();
  if (!token) redirect("/login");

  const res = await fetch(`${API_URL}/api/v1/billing/monopay/checkout`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ plan }),
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.detail ?? "monobank checkout failed");
  }

  const { url } = await res.json();
  redirect(url);
}

/** Re-checks the caller's pending monopay invoice against monobank and
 * applies its status — needed right after redirect-back, since a localhost
 * webhook URL is unreachable from mono's servers during dev. */
export async function syncMonopay(): Promise<{ plan: string } | null> {
  const token = await getAccessToken();
  if (!token) return null;
  try {
    const res = await fetch(`${API_URL}/api/v1/billing/monopay/sync`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}
