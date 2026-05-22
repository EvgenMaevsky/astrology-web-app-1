"use server";

import { redirect } from "next/navigation";
import { API_URL, clearAuthCookies, getRefreshToken, setAuthCookies } from "@/app/lib/auth";

type AuthState = { error?: string } | undefined;

export async function register(
  _state: AuthState,
  formData: FormData
): Promise<AuthState> {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  if (!email || !password) return { error: "Email and password are required" };
  if (password.length < 8) return { error: "Password must be at least 8 characters" };

  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/v1/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
  } catch {
    return { error: "Cannot connect to server. Please try again." };
  }

  if (res.status === 409) return { error: "Email is already registered" };
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    return { error: body?.detail ?? "Registration failed" };
  }

  const { access_token, refresh_token } = await res.json();
  await setAuthCookies(access_token, refresh_token);
  redirect("/dashboard");
}

export async function login(
  _state: AuthState,
  formData: FormData
): Promise<AuthState> {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  if (!email || !password) return { error: "Email and password are required" };

  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/v1/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
  } catch {
    return { error: "Cannot connect to server. Please try again." };
  }

  if (res.status === 401) return { error: "Invalid email or password" };
  if (!res.ok) return { error: "Login failed. Please try again." };

  const { access_token, refresh_token } = await res.json();
  await setAuthCookies(access_token, refresh_token);
  redirect("/dashboard");
}

export async function logout() {
  const refresh = await getRefreshToken();
  if (refresh) {
    await fetch(`${API_URL}/api/v1/auth/logout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refresh }),
    }).catch(() => {});
  }
  await clearAuthCookies();
  redirect("/login");
}
