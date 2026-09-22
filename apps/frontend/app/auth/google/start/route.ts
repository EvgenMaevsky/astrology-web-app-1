import { createHash, randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { API_URL } from "@/app/lib/auth";

const GOOGLE_AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";

// Only what a sign-in needs. Anything beyond openid/email/profile is a
// "sensitive" scope in Google's terms and drags the app into app review.
const SCOPES = "openid email profile";

function base64url(input: Buffer): string {
  return input.toString("base64url");
}

/**
 * Cookies that outlive the round trip to Google and are read back by the
 * callback. Short-lived and httpOnly: the browser never reads them, and a
 * stale one cannot be reused tomorrow.
 */
function setFlowCookie(res: NextResponse, name: string, value: string) {
  res.cookies.set(name, value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 10 * 60,
    path: "/",
  });
}

export async function GET(request: NextRequest) {
  let clientId: string;
  try {
    const res = await fetch(`${API_URL}/api/v1/auth/google/config`, { cache: "no-store" });
    const config = (await res.json()) as { enabled: boolean; client_id: string };
    if (!config.enabled) return NextResponse.redirect(new URL("/login?error=google", request.url));
    clientId = config.client_id;
  } catch {
    return NextResponse.redirect(new URL("/login?error=google", request.url));
  }

  // state  — ties the callback to this browser. Without it an attacker can
  //          feed a victim their own authorization code and silently bind
  //          the victim's session to the attacker's Google account.
  // nonce  — ends up inside the ID token; the backend checks it, so an old
  //          token cannot be replayed.
  // PKCE   — the code is worthless to anyone who intercepts it without the
  //          verifier, which never leaves this server.
  const state = base64url(randomBytes(32));
  const nonce = base64url(randomBytes(32));
  const codeVerifier = base64url(randomBytes(64));
  const codeChallenge = base64url(createHash("sha256").update(codeVerifier).digest());

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: new URL("/auth/google/callback", request.nextUrl.origin).toString(),
    response_type: "code",
    scope: SCOPES,
    state,
    nonce,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });

  const response = NextResponse.redirect(`${GOOGLE_AUTH_ENDPOINT}?${params}`);
  setFlowCookie(response, "g_state", state);
  setFlowCookie(response, "g_nonce", nonce);
  setFlowCookie(response, "g_verifier", codeVerifier);
  return response;
}
