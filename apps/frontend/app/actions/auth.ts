"use server";

import { redirect } from "next/navigation";
import { API_URL, clearAuthCookies, getAccessToken, getRefreshToken, setAuthCookies } from "@/app/lib/auth";

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

type MessageState = { message?: string; error?: string } | undefined;

export async function forgotPassword(
  _state: MessageState,
  formData: FormData
): Promise<MessageState> {
  const email = formData.get("email") as string;
  if (!email) return { error: "Email is required" };

  try {
    await fetch(`${API_URL}/api/v1/auth/forgot-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
  } catch {
    return { error: "Cannot connect to server. Please try again." };
  }

  // Always show the same message regardless of whether the account exists.
  return { message: "If an account with that email exists, we've sent a reset link." };
}

export async function resetPassword(
  _state: MessageState,
  formData: FormData
): Promise<MessageState> {
  const token = formData.get("token") as string;
  const password = formData.get("password") as string;
  const confirmPassword = formData.get("confirmPassword") as string;

  if (!token) return { error: "Missing or invalid reset link" };
  if (!password) return { error: "Password is required" };
  if (password.length < 8) return { error: "Password must be at least 8 characters" };
  if (password !== confirmPassword) return { error: "Passwords do not match" };

  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/v1/auth/reset-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, new_password: password }),
    });
  } catch {
    return { error: "Cannot connect to server. Please try again." };
  }

  if (!res.ok) return { error: "This reset link is invalid or has expired." };
  return { message: "Password updated. You can now sign in." };
}

export async function sendVerificationEmail(
  _state: MessageState,
  _formData: FormData
): Promise<MessageState> {
  const token = await getAccessToken();
  if (!token) return { error: "Not authenticated" };

  try {
    await fetch(`${API_URL}/api/v1/auth/send-verification`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {
    return { error: "Cannot connect to server. Please try again." };
  }
  return { message: "Verification email sent." };
}

export async function verifyEmail(
  _state: MessageState,
  formData: FormData
): Promise<MessageState> {
  const token = formData.get("token") as string;
  if (!token) return { error: "Missing or invalid verification link" };

  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/v1/auth/verify-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
  } catch {
    return { error: "Cannot connect to server. Please try again." };
  }

  if (!res.ok) return { error: "This verification link is invalid or has expired." };
  return { message: "Email confirmed. Thanks!" };
}
