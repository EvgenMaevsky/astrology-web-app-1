import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import {
  ACCESS_COOKIE,
  ACCESS_COOKIE_OPTIONS,
  API_URL,
  REFRESH_COOKIE,
  REFRESH_COOKIE_OPTIONS,
} from "@/app/lib/auth";

const FLOW_COOKIES = ["g_state", "g_nonce", "g_verifier"] as const;

function sameString(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  // Length differences are visible anyway, but timingSafeEqual throws on
  // mismatched lengths, so check that first.
  return left.length === right.length && timingSafeEqual(left, right);
}

function failure(request: NextRequest): NextResponse {
  const response = NextResponse.redirect(new URL("/login?error=google", request.url));
  for (const name of FLOW_COOKIES) response.cookies.delete(name);
  return response;
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;

  // The user pressed "cancel" on Google's consent screen, or Google refused.
  if (params.get("error")) return failure(request);

  const code = params.get("code");
  const returnedState = params.get("state");
  const jar = request.cookies;
  const state = jar.get("g_state")?.value;
  const nonce = jar.get("g_nonce")?.value;
  const codeVerifier = jar.get("g_verifier")?.value;

  if (!code || !returnedState || !state || !nonce || !codeVerifier) return failure(request);

  // The CSRF check. A callback whose state does not match the one this
  // browser started with is somebody else's login attempt being pushed at
  // this user — never exchange its code.
  if (!sameString(returnedState, state)) return failure(request);

  let tokens: { access_token?: string; refresh_token?: string };
  try {
    const res = await fetch(`${API_URL}/api/v1/auth/google/callback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, code_verifier: codeVerifier, nonce }),
      cache: "no-store",
    });
    if (!res.ok) return failure(request);
    tokens = await res.json();
  } catch {
    return failure(request);
  }

  if (!tokens.access_token || !tokens.refresh_token) return failure(request);

  const response = NextResponse.redirect(new URL("/dashboard", request.url));
  // Set on the response itself rather than through cookies() from
  // next/headers: this handler also deletes cookies on the response, and
  // relying on the two mechanisms merging correctly is a silent-failure risk
  // — a session cookie that never reaches the browser looks exactly like a
  // login that did not happen.
  response.cookies.set(ACCESS_COOKIE, tokens.access_token, ACCESS_COOKIE_OPTIONS);
  response.cookies.set(REFRESH_COOKIE, tokens.refresh_token, REFRESH_COOKIE_OPTIONS);
  // One-shot values: leaving them behind would let a replay reuse them.
  for (const name of FLOW_COOKIES) response.cookies.delete(name);
  return response;
}
