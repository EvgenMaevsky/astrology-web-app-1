import { cookies } from "next/headers";

export const ACCESS_COOKIE = "access_token";
export const REFRESH_COOKIE = "refresh_token";
const API_URL = process.env.API_URL ?? "http://127.0.0.1:8000";

export { API_URL };

// Shared so the server actions and the OAuth route handler cannot drift
// apart on flags like httpOnly or maxAge.
const BASE_COOKIE = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/",
} as const;

export const ACCESS_COOKIE_OPTIONS = { ...BASE_COOKIE, maxAge: 30 * 60 };
export const REFRESH_COOKIE_OPTIONS = { ...BASE_COOKIE, maxAge: 30 * 24 * 60 * 60 };

export async function setAuthCookies(access: string, refresh: string) {
  const jar = await cookies();
  jar.set(ACCESS_COOKIE, access, ACCESS_COOKIE_OPTIONS);
  jar.set(REFRESH_COOKIE, refresh, REFRESH_COOKIE_OPTIONS);
}

export async function setAccessCookie(access: string) {
  const jar = await cookies();
  jar.set(ACCESS_COOKIE, access, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 30 * 60,
    path: "/",
  });
}

export async function clearAuthCookies() {
  const jar = await cookies();
  jar.delete(ACCESS_COOKIE);
  jar.delete(REFRESH_COOKIE);
}

export async function getAccessToken(): Promise<string | undefined> {
  return (await cookies()).get(ACCESS_COOKIE)?.value;
}

export async function getRefreshToken(): Promise<string | undefined> {
  return (await cookies()).get(REFRESH_COOKIE)?.value;
}
