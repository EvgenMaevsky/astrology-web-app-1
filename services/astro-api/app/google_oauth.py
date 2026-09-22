"""Google Sign-In: authorization-code exchange and ID-token verification.

Kept out of the router for the same reason as monopay.py and email.py —
everything that talks to an outside service lives in its own module.

The security of this whole flow rests on verify_id_token() below. Read the
comments there before changing anything in it.
"""
import logging
from dataclasses import dataclass

import httpx
import jwt
from jwt import PyJWKClient

from app.config import settings

log = logging.getLogger(__name__)

TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token"
JWKS_URI = "https://www.googleapis.com/oauth2/v3/certs"

# Google still issues both spellings. PyJWT only accepts a single issuer
# string, so the check is done by hand below against this set.
_ALLOWED_ISSUERS = {"accounts.google.com", "https://accounts.google.com"}

# Caches the fetched keys; Google rotates them, and the client refetches
# when it sees an unknown key id.
_jwks_client = PyJWKClient(JWKS_URI, cache_keys=True)


class GoogleAuthError(Exception):
    """Anything that makes a Google response untrustworthy or unusable."""


@dataclass(frozen=True)
class GoogleIdentity:
    sub: str
    email: str
    email_verified: bool


def is_enabled() -> bool:
    return bool(settings.google_client_id and settings.google_client_secret)


async def exchange_code(code: str, code_verifier: str, redirect_uri: str) -> str:
    """Trade an authorization code for an ID token. Returns the raw ID token."""
    async with httpx.AsyncClient(timeout=10) as client:
        r = await client.post(
            TOKEN_ENDPOINT,
            data={
                "code": code,
                "client_id": settings.google_client_id,
                "client_secret": settings.google_client_secret,
                "redirect_uri": redirect_uri,
                "grant_type": "authorization_code",
                "code_verifier": code_verifier,
            },
        )
    if r.status_code >= 400:
        # Log Google's own error code — never the body, which echoes back the
        # authorization code and redirect_uri. The code alone is what makes
        # this diagnosable: "invalid_client" means the client id/secret pair
        # is wrong, "redirect_uri_mismatch" means the registered URI differs,
        # "invalid_grant" means the code was already used or expired. Without
        # it every one of those looks like the same generic failure.
        try:
            error_code = r.json().get("error", "unknown")
        except ValueError:
            error_code = "unparseable"
        log.warning("Google token exchange failed: HTTP %s, error=%s", r.status_code, error_code)
        raise GoogleAuthError("Could not exchange the authorization code.")

    id_token = r.json().get("id_token")
    if not id_token:
        raise GoogleAuthError("Google returned no ID token.")
    return id_token


def verify_id_token(raw_token: str, expected_nonce: str) -> GoogleIdentity:
    """Verify an ID token fully and return the identity it asserts.

    Every check here matters:

    * signature against Google's JWKS — without it the token is just text
      the client handed us, and anyone could forge one;
    * `aud` == our client id — this is the big one. A token is issued *to a
      specific application*. Skipping this check would accept a valid Google
      token minted for somebody else's app, so anyone with their own Google
      client could sign in as any of our users;
    * `iss` — must actually be Google;
    * `exp` — enforced by PyJWT;
    * `nonce` — ties the token to the login attempt we started, so an old
      token cannot be replayed.
    """
    try:
        signing_key = _jwks_client.get_signing_key_from_jwt(raw_token)
        claims = jwt.decode(
            raw_token,
            signing_key.key,
            algorithms=["RS256"],
            audience=settings.google_client_id,
            options={"require": ["exp", "iss", "aud", "sub"], "verify_iss": False},
        )
    except jwt.InvalidTokenError as exc:
        log.warning("Google ID token rejected: %s", type(exc).__name__)
        raise GoogleAuthError("Invalid Google token.") from exc

    if claims.get("iss") not in _ALLOWED_ISSUERS:
        raise GoogleAuthError("Invalid Google token.")

    # Compared rather than merely present: a token from a different login
    # attempt would otherwise be accepted.
    if not expected_nonce or claims.get("nonce") != expected_nonce:
        raise GoogleAuthError("Invalid Google token.")

    email = claims.get("email")
    if not email:
        raise GoogleAuthError("Google returned no email address.")

    # Google sends a bool, but some flows have historically sent the string
    # "true"; anything else must read as not verified.
    raw_verified = claims.get("email_verified")
    email_verified = raw_verified is True or raw_verified == "true"

    return GoogleIdentity(sub=claims["sub"], email=email.lower(), email_verified=email_verified)
