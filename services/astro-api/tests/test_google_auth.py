"""Google Sign-In: account linking and the checks that make it safe.

The two tests that matter most here are the rejections — an unverified
Google email must never link to an existing account, and a token minted for
somebody else's Google app must never be accepted. Everything else in this
flow is plumbing; those two are the difference between "sign in with Google"
and "sign in as anyone". See docs/plans/2026-09-20-e2-google-oauth.md.

Google itself is never contacted: the code exchange and the JWKS lookup are
both stubbed, and the tests assert on what our own logic does with the
identity that comes back.
"""
from pydantic import SecretStr
import pytest
from httpx import AsyncClient
from sqlalchemy import select

from app import google_oauth
from app.config import settings
from app.models.user import User, UserSettings
from tests.conftest import TestSession

CALLBACK = "/api/v1/auth/google/callback"
BODY = {"code": "auth-code", "code_verifier": "verifier", "nonce": "nonce-123"}


@pytest.fixture
def google_enabled(monkeypatch):
    monkeypatch.setattr(settings, "google_client_id", "our-client-id.apps.googleusercontent.com")
    monkeypatch.setattr(settings, "google_client_secret", SecretStr("our-secret"))


@pytest.fixture
def google_identity(monkeypatch, google_enabled):
    """Stub the network calls; return a setter for the identity Google asserts."""
    async def _fake_exchange(code, code_verifier, redirect_uri):
        return "raw.id.token"

    monkeypatch.setattr(google_oauth, "exchange_code", _fake_exchange)

    def _set(sub="google-sub-1", email="person@gmail.com", email_verified=True):
        monkeypatch.setattr(
            google_oauth,
            "verify_id_token",
            lambda raw, nonce: google_oauth.GoogleIdentity(
                sub=sub, email=email, email_verified=email_verified
            ),
        )

    _set()
    return _set


async def _register(client: AsyncClient, email: str) -> str:
    r = await client.post(
        "/api/v1/auth/register", json={"email": email, "password": "password123"}
    )
    return r.json()["access_token"]


async def _user(email: str) -> User | None:
    async with TestSession() as session:
        result = await session.execute(select(User).where(User.email == email))
        return result.scalar_one_or_none()


# ── the checks that carry the security ───────────────────────────────────────

async def test_unverified_google_email_does_not_link_to_existing_account(
    client: AsyncClient, google_identity
):
    # The takeover scenario: someone stands up a mailbox at an address that
    # already has an account here. Google says it has NOT verified it, and
    # that claim is the only thing standing between them and the account.
    await _register(client, "victim@example.com")
    google_identity(email="victim@example.com", email_verified=False)

    r = await client.post(CALLBACK, json=BODY)
    assert r.status_code == 403
    assert r.json()["detail"]["code"] == "google_email_unverified"

    victim = await _user("victim@example.com")
    assert victim.google_sub is None


@pytest.fixture(scope="module")
def rsa_keys():
    """A real RSA keypair, so tokens below are signed the way Google signs.

    Using an HMAC key here would be a trap: every token would be rejected on
    the algorithm check alone, and the tests would pass while proving nothing
    about the claim checks they are named after.
    """
    from cryptography.hazmat.primitives import serialization
    from cryptography.hazmat.primitives.asymmetric import rsa

    private = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    private_pem = private.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption(),
    ).decode()
    public_pem = private.public_key().public_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PublicFormat.SubjectPublicKeyInfo,
    ).decode()
    return private_pem, public_pem


@pytest.fixture
def signed_token(monkeypatch, rsa_keys, google_enabled):
    """Return a factory for RS256 ID tokens that our JWKS lookup will trust."""
    import jwt

    private_pem, public_pem = rsa_keys
    monkeypatch.setattr(
        google_oauth._jwks_client,
        "get_signing_key_from_jwt",
        lambda raw: type("Key", (), {"key": public_pem})(),
    )

    def _make(**overrides):
        claims = {
            "iss": "https://accounts.google.com",
            "aud": settings.google_client_id,
            "sub": "google-sub-1",
            "email": "person@gmail.com",
            "email_verified": True,
            "nonce": "nonce-123",
            "exp": 9999999999,
        }
        claims.update(overrides)
        return jwt.encode(claims, private_pem, algorithm="RS256")

    return _make


async def test_valid_token_is_accepted(signed_token):
    # Establishes the baseline: everything below differs from this by exactly
    # one claim, so a rejection can only be caused by that claim.
    identity = google_oauth.verify_id_token(signed_token(), "nonce-123")
    assert identity.sub == "google-sub-1"
    assert identity.email == "person@gmail.com"
    assert identity.email_verified is True


async def test_token_for_another_google_app_is_rejected(signed_token):
    # Properly signed by Google, valid in every way — but issued TO A
    # DIFFERENT application. Without the aud check this is a complete
    # authentication bypass: anyone who registers their own Google client
    # could mint tokens and sign in as any of our users.
    token = signed_token(aud="someone-elses-app.apps.googleusercontent.com")
    with pytest.raises(google_oauth.GoogleAuthError):
        google_oauth.verify_id_token(token, "nonce-123")


async def test_mismatched_nonce_is_rejected(signed_token):
    token = signed_token(nonce="a-different-login-attempt")
    with pytest.raises(google_oauth.GoogleAuthError):
        google_oauth.verify_id_token(token, "nonce-123")


async def test_wrong_issuer_is_rejected(signed_token):
    token = signed_token(iss="https://accounts.evil.example")
    with pytest.raises(google_oauth.GoogleAuthError):
        google_oauth.verify_id_token(token, "nonce-123")


async def test_expired_token_is_rejected(signed_token):
    token = signed_token(exp=1000000000)
    with pytest.raises(google_oauth.GoogleAuthError):
        google_oauth.verify_id_token(token, "nonce-123")


async def test_token_signed_by_someone_else_is_rejected(signed_token, rsa_keys):
    import jwt
    from cryptography.hazmat.primitives import serialization
    from cryptography.hazmat.primitives.asymmetric import rsa

    other = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    other_pem = other.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption(),
    ).decode()
    forged = jwt.encode(
        {
            "iss": "https://accounts.google.com", "aud": settings.google_client_id,
            "sub": "attacker", "email": "a@b.c", "email_verified": True,
            "nonce": "nonce-123", "exp": 9999999999,
        },
        other_pem, algorithm="RS256",
    )
    with pytest.raises(google_oauth.GoogleAuthError):
        google_oauth.verify_id_token(forged, "nonce-123")


@pytest.mark.parametrize("raw,expected", [
    (True, True), ("true", True), (False, False), ("false", False), (None, False),
])
async def test_email_verified_claim_forms(signed_token, raw, expected):
    identity = google_oauth.verify_id_token(signed_token(email_verified=raw), "nonce-123")
    assert identity.email_verified is expected


# ── normal flow ──────────────────────────────────────────────────────────────

async def test_new_google_user_is_created_with_settings_row(
    client: AsyncClient, google_identity
):
    google_identity(sub="sub-new", email="fresh@gmail.com")

    r = await client.post(CALLBACK, json=BODY)
    assert r.status_code == 200
    assert r.json()["access_token"]

    user = await _user("fresh@gmail.com")
    assert user.google_sub == "sub-new"
    assert user.password_hash is None
    assert user.email_verified is True

    # Missing this row makes GET /settings 404 for the new account.
    async with TestSession() as session:
        result = await session.execute(
            select(UserSettings).where(UserSettings.user_id == user.id)
        )
        assert result.scalar_one_or_none() is not None


async def test_second_sign_in_reuses_the_same_account(client: AsyncClient, google_identity):
    google_identity(sub="sub-repeat", email="repeat@gmail.com")
    await client.post(CALLBACK, json=BODY)
    first = await _user("repeat@gmail.com")

    await client.post(CALLBACK, json=BODY)
    async with TestSession() as session:
        result = await session.execute(select(User).where(User.google_sub == "sub-repeat"))
        assert len(result.scalars().all()) == 1
    assert (await _user("repeat@gmail.com")).id == first.id


async def test_verified_google_email_links_to_existing_password_account(
    client: AsyncClient, google_identity
):
    await _register(client, "both@example.com")
    before = await _user("both@example.com")
    google_identity(sub="sub-link", email="both@example.com", email_verified=True)

    r = await client.post(CALLBACK, json=BODY)
    assert r.status_code == 200

    after = await _user("both@example.com")
    assert after.id == before.id, "must link, not create a duplicate"
    assert after.google_sub == "sub-link"
    assert after.password_hash is not None, "existing password must survive"
    assert after.email_verified is True


async def test_google_email_is_matched_case_insensitively(
    client: AsyncClient, google_identity
):
    # GoogleIdentity lowercases the address; registration stores what was typed.
    await _register(client, "mixed@example.com")
    google_identity(sub="sub-case", email="mixed@example.com")
    r = await client.post(CALLBACK, json=BODY)
    assert r.status_code == 200
    assert (await _user("mixed@example.com")).google_sub == "sub-case"


async def test_new_user_with_unverified_google_email_is_not_marked_verified(
    client: AsyncClient, google_identity
):
    google_identity(sub="sub-unv", email="unverified@gmail.com", email_verified=False)
    r = await client.post(CALLBACK, json=BODY)
    assert r.status_code == 200
    # No account existed, so nothing can be hijacked — but we must not claim
    # a verification Google did not make.
    assert (await _user("unverified@gmail.com")).email_verified is False


# ── feature switch ───────────────────────────────────────────────────────────

async def test_disabled_without_credentials(client: AsyncClient, monkeypatch):
    # Cleared explicitly rather than relying on the ambient .env: a developer
    # with local Google credentials configured would otherwise see this test
    # fail for no reason related to the code.
    monkeypatch.setattr(settings, "google_client_id", "")
    monkeypatch.setattr(settings, "google_client_secret", SecretStr(""))

    r = await client.get("/api/v1/auth/google/config")
    assert r.status_code == 200
    assert r.json()["enabled"] is False

    assert (await client.post(CALLBACK, json=BODY)).status_code == 503


async def test_config_reports_enabled_and_client_id(client: AsyncClient, google_enabled):
    r = await client.get("/api/v1/auth/google/config")
    assert r.json()["enabled"] is True
    assert r.json()["client_id"] == settings.google_client_id


# ── what a passwordless account breaks ───────────────────────────────────────

async def test_password_login_into_google_only_account_is_401_not_500(
    client: AsyncClient, google_identity
):
    google_identity(sub="sub-nopw", email="nopw@gmail.com")
    await client.post(CALLBACK, json=BODY)

    r = await client.post(
        "/api/v1/auth/login", json={"email": "nopw@gmail.com", "password": "anything"}
    )
    assert r.status_code == 401
    # Same message as a wrong password: must not reveal that this account is
    # a Google one.
    assert r.json()["detail"] == "Invalid credentials"


async def test_google_only_account_can_be_deleted_by_typing_its_email(
    client: AsyncClient, google_identity
):
    google_identity(sub="sub-del", email="del@gmail.com")
    token = (await client.post(CALLBACK, json=BODY)).json()["access_token"]
    auth = {"Authorization": f"Bearer {token}"}

    wrong = await client.request(
        "DELETE", "/api/v1/users/me", json={"email": "someone-else@gmail.com"}, headers=auth
    )
    assert wrong.status_code == 403

    ok = await client.request(
        "DELETE", "/api/v1/users/me", json={"email": "del@gmail.com"}, headers=auth
    )
    assert ok.status_code == 204
    assert await _user("del@gmail.com") is None


async def test_me_reports_has_password(client: AsyncClient, google_identity):
    google_identity(sub="sub-hp", email="hp@gmail.com")
    token = (await client.post(CALLBACK, json=BODY)).json()["access_token"]
    r = await client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert r.json()["has_password"] is False

    pw_token = await _register(client, "withpw@example.com")
    r = await client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {pw_token}"})
    assert r.json()["has_password"] is True
