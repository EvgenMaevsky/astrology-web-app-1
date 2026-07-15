import { type NextRequest, NextResponse } from "next/server";

const PUBLIC_PATHS = ["/login", "/register"];
const API_URL = process.env.API_URL ?? "http://127.0.0.1:8000";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));
  const hasAccess = request.cookies.has("access_token");
  const refreshToken = request.cookies.get("refresh_token")?.value;

  // Access token expired but a refresh token remains → renew it transparently
  if (!isPublic && !hasAccess && refreshToken) {
    const renewed = await tryRefresh(request, refreshToken);
    if (renewed) return renewed;
  }

  if (!isPublic && !hasAccess) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", pathname);
    const response = NextResponse.redirect(loginUrl);
    // refresh failed (revoked/expired) — drop the stale cookie
    if (refreshToken) response.cookies.delete("refresh_token");
    return response;
  }

  if (isPublic && hasAccess) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

async function tryRefresh(
  request: NextRequest,
  refreshToken: string
): Promise<NextResponse | null> {
  let accessToken: string;
  try {
    const res = await fetch(`${API_URL}/api/v1/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
      cache: "no-store",
    });
    if (!res.ok) return null;
    ({ access_token: accessToken } = await res.json());
  } catch {
    return null;
  }

  // Forward the new token to this request's server components/actions too,
  // not just to the browser via Set-Cookie.
  const requestHeaders = new Headers(request.headers);
  const existingCookie = requestHeaders.get("cookie") ?? "";
  requestHeaders.set(
    "cookie",
    existingCookie
      ? `${existingCookie}; access_token=${accessToken}`
      : `access_token=${accessToken}`
  );

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.cookies.set("access_token", accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 30 * 60,
    path: "/",
  });
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|fonts/|api/).*)",
  ],
};
