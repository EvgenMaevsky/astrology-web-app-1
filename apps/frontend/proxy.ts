import { type NextRequest, NextResponse } from "next/server";

// Paths reachable without a session. Logged-in users may still visit most of
// these (e.g. /verify-email from an email link) — only AUTH_REDIRECT_PATHS
// bounce an already-authenticated user away.
const PUBLIC_PATHS = [
  "/login", "/register", "/forgot-password", "/reset-password", "/verify-email",
  "/privacy", "/terms",
];
const AUTH_REDIRECT_PATHS = ["/login", "/register"];
const API_URL = process.env.API_URL ?? "http://127.0.0.1:8000";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  // "/" is matched exactly, never as a startsWith() prefix — a prefix match
  // on "/" would make every route in the app "public".
  const isPublic = pathname === "/" || PUBLIC_PATHS.some((p) => pathname.startsWith(p));
  const isAuthRedirectPath = pathname === "/" || AUTH_REDIRECT_PATHS.some((p) => pathname.startsWith(p));
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

  if (isAuthRedirectPath && hasAccess) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

async function tryRefresh(
  request: NextRequest,
  refreshToken: string
): Promise<NextResponse | null> {
  // The backend rotates + revokes the refresh token on every call. If two
  // requests race here with no access-token cookie (e.g. two tabs), the
  // second call reuses an already-revoked token and gets 401 → the user is
  // bounced to /login even though the first refresh succeeded. Acceptable
  // for now (rare, self-heals on next login); no grace-window implemented.
  let accessToken: string;
  let newRefreshToken: string | undefined;
  try {
    const res = await fetch(`${API_URL}/api/v1/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const body = await res.json();
    accessToken = body.access_token;
    newRefreshToken = body.refresh_token;
    // Backend rotates refresh tokens on every use; without the new one we
    // can't renew the cookie and the client would be stuck re-using a
    // revoked token on its next expiry.
    if (!accessToken || !newRefreshToken) return null;
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
  response.cookies.set("refresh_token", newRefreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 30 * 24 * 60 * 60,
    path: "/",
  });
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|fonts/|api/).*)",
  ],
};
