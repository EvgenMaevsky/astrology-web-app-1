"use server";

import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { API_URL, clearAuthCookies, getAccessToken, getRefreshToken, setAuthCookies } from "@/app/lib/auth";

type AuthState = { error?: string } | undefined;

export async function register(
  _state: AuthState,
  formData: FormData
): Promise<AuthState> {
  const t = await getTranslations("auth.errors");
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  if (!email || !password) return { error: t("emailPasswordRequired") };
  if (password.length < 8) return { error: t("passwordTooShort") };

  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/v1/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
  } catch {
    return { error: t("cannotConnect") };
  }

  if (res.status === 409) return { error: t("emailAlreadyRegistered") };
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    return { error: body?.detail ?? t("registrationFailed") };
  }

  const { access_token, refresh_token } = await res.json();
  await setAuthCookies(access_token, refresh_token);
  redirect("/dashboard");
}

export async function login(
  _state: AuthState,
  formData: FormData
): Promise<AuthState> {
  const t = await getTranslations("auth.errors");
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  if (!email || !password) return { error: t("emailPasswordRequired") };

  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/v1/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
  } catch {
    return { error: t("cannotConnect") };
  }

  if (res.status === 401) return { error: t("invalidCredentials") };
  if (!res.ok) return { error: t("loginFailed") };

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
  const t = await getTranslations("auth");
  const email = formData.get("email") as string;
  if (!email) return { error: t("errors.emailRequired") };

  try {
    await fetch(`${API_URL}/api/v1/auth/forgot-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
  } catch {
    return { error: t("errors.cannotConnect") };
  }

  // Always show the same message regardless of whether the account exists.
  return { message: t("forgotPassword.successMessage") };
}

export async function resetPassword(
  _state: MessageState,
  formData: FormData
): Promise<MessageState> {
  const t = await getTranslations("auth");
  const token = formData.get("token") as string;
  const password = formData.get("password") as string;
  const confirmPassword = formData.get("confirmPassword") as string;

  if (!token) return { error: t("errors.missingResetLink") };
  if (!password) return { error: t("errors.passwordRequired") };
  if (password.length < 8) return { error: t("errors.passwordTooShort") };
  if (password !== confirmPassword) return { error: t("errors.passwordsDoNotMatch") };

  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/v1/auth/reset-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, new_password: password }),
    });
  } catch {
    return { error: t("errors.cannotConnect") };
  }

  if (!res.ok) return { error: t("errors.resetLinkInvalid") };
  return { message: t("resetPassword.successMessage") };
}

export async function sendVerificationEmail(
  _state: MessageState,
  _formData: FormData
): Promise<MessageState> {
  const t = await getTranslations("auth");
  const token = await getAccessToken();
  if (!token) return { error: t("errors.notAuthenticated") };

  try {
    await fetch(`${API_URL}/api/v1/auth/send-verification`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {
    return { error: t("errors.cannotConnect") };
  }
  return { message: t("verificationBanner.resentMessage") };
}

export async function deleteAccount(
  _state: MessageState,
  formData: FormData
): Promise<MessageState> {
  const t = await getTranslations("auth");
  const password = formData.get("password") as string;
  if (!password) return { error: t("errors.passwordRequired") };

  const token = await getAccessToken();
  if (!token) return { error: t("errors.notAuthenticated") };

  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/v1/users/me`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ password }),
    });
  } catch {
    return { error: t("errors.cannotConnect") };
  }

  if (res.status === 403) return { error: t("errors.incorrectPassword") };
  if (!res.ok) return { error: t("errors.deleteAccountFailed", { status: res.status }) };

  await clearAuthCookies();
  redirect("/login");
}

export async function verifyEmail(
  _state: MessageState,
  formData: FormData
): Promise<MessageState> {
  const t = await getTranslations("auth");
  const token = formData.get("token") as string;
  if (!token) return { error: t("errors.missingVerificationLink") };

  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/v1/auth/verify-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
  } catch {
    return { error: t("errors.cannotConnect") };
  }

  if (!res.ok) return { error: t("errors.verificationLinkInvalid") };
  return { message: t("verifyEmail.successMessage") };
}
