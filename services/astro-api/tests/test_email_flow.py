import hashlib
import re
from datetime import datetime, timedelta, timezone

import pytest
from httpx import AsyncClient
from sqlalchemy import select

from app import email as email_module
from app.models.user import EmailToken, User
from tests.conftest import TestSession

TOKEN_RE = re.compile(r"token=([A-Za-z0-9_\-]+)")


@pytest.fixture
def sent_emails(monkeypatch):
    captured = []

    async def fake_send(to, subject, html):
        captured.append((to, subject, html))
        return True

    monkeypatch.setattr(email_module, "send_email", fake_send)
    return captured


def _extract_token(html: str) -> str:
    m = TOKEN_RE.search(html)
    assert m, f"no token found in email body: {html!r}"
    return m.group(1)


async def test_forgot_password_reset_roundtrip(client: AsyncClient, sent_emails):
    await client.post(
        "/api/v1/auth/register", json={"email": "reset1@example.com", "password": "oldpassword1"}
    )
    sent_emails.clear()  # drop the verification email from registration

    r = await client.post("/api/v1/auth/forgot-password", json={"email": "reset1@example.com"})
    assert r.status_code == 204
    assert len(sent_emails) == 1
    token = _extract_token(sent_emails[0][2])

    r2 = await client.post(
        "/api/v1/auth/reset-password", json={"token": token, "new_password": "newpassword1"}
    )
    assert r2.status_code == 204

    # old password no longer works
    old = await client.post(
        "/api/v1/auth/login", json={"email": "reset1@example.com", "password": "oldpassword1"}
    )
    assert old.status_code == 401

    # new password works
    new = await client.post(
        "/api/v1/auth/login", json={"email": "reset1@example.com", "password": "newpassword1"}
    )
    assert new.status_code == 200


async def test_reset_revokes_existing_refresh_tokens(client: AsyncClient, sent_emails):
    reg = await client.post(
        "/api/v1/auth/register", json={"email": "reset2@example.com", "password": "oldpassword1"}
    )
    old_refresh = reg.json()["refresh_token"]
    sent_emails.clear()

    await client.post("/api/v1/auth/forgot-password", json={"email": "reset2@example.com"})
    token = _extract_token(sent_emails[0][2])
    await client.post(
        "/api/v1/auth/reset-password", json={"token": token, "new_password": "newpassword1"}
    )

    r = await client.post("/api/v1/auth/refresh", json={"refresh_token": old_refresh})
    assert r.status_code == 401


async def test_reset_token_is_single_use(client: AsyncClient, sent_emails):
    await client.post(
        "/api/v1/auth/register", json={"email": "reset3@example.com", "password": "oldpassword1"}
    )
    sent_emails.clear()

    await client.post("/api/v1/auth/forgot-password", json={"email": "reset3@example.com"})
    token = _extract_token(sent_emails[0][2])

    r1 = await client.post(
        "/api/v1/auth/reset-password", json={"token": token, "new_password": "newpassword1"}
    )
    assert r1.status_code == 204

    r2 = await client.post(
        "/api/v1/auth/reset-password", json={"token": token, "new_password": "anotherpass1"}
    )
    assert r2.status_code == 400


async def test_reset_expired_token_rejected(client: AsyncClient):
    await client.post(
        "/api/v1/auth/register", json={"email": "reset4@example.com", "password": "oldpassword1"}
    )
    raw_token = "known-raw-token-for-expiry-test"
    token_hash = hashlib.sha256(raw_token.encode()).hexdigest()

    async with TestSession() as session:
        result = await session.execute(select(User).where(User.email == "reset4@example.com"))
        user_id = result.scalar_one().id
        session.add(EmailToken(
            user_id=user_id,
            token_hash=token_hash,
            purpose="reset",
            expires_at=datetime.now(timezone.utc) - timedelta(hours=1),
        ))
        await session.commit()

    r = await client.post(
        "/api/v1/auth/reset-password",
        json={"token": raw_token, "new_password": "newpassword1"},
    )
    assert r.status_code == 400

    # a syntactically bogus token is rejected the same way (never issued)
    r2 = await client.post(
        "/api/v1/auth/reset-password",
        json={"token": "never-issued-token", "new_password": "newpassword1"},
    )
    assert r2.status_code == 400


async def test_forgot_password_unknown_email_no_email_sent(client: AsyncClient, sent_emails):
    r = await client.post("/api/v1/auth/forgot-password", json={"email": "nobody@example.com"})
    assert r.status_code == 204
    assert len(sent_emails) == 0


async def test_verify_email_flow(client: AsyncClient, sent_emails):
    reg = await client.post(
        "/api/v1/auth/register", json={"email": "verify1@example.com", "password": "password123"}
    )
    access_token = reg.json()["access_token"]
    assert len(sent_emails) == 1  # verification email sent on register
    token = _extract_token(sent_emails[0][2])

    me_before = await client.get(
        "/api/v1/auth/me", headers={"Authorization": f"Bearer {access_token}"}
    )
    assert me_before.json()["email_verified"] is False

    r = await client.post("/api/v1/auth/verify-email", json={"token": token})
    assert r.status_code == 204

    me_after = await client.get(
        "/api/v1/auth/me", headers={"Authorization": f"Bearer {access_token}"}
    )
    assert me_after.json()["email_verified"] is True


async def test_send_verification_noop_when_already_verified(client: AsyncClient, sent_emails):
    reg = await client.post(
        "/api/v1/auth/register", json={"email": "verify2@example.com", "password": "password123"}
    )
    access_token = reg.json()["access_token"]
    token = _extract_token(sent_emails[0][2])
    await client.post("/api/v1/auth/verify-email", json={"token": token})
    sent_emails.clear()

    r = await client.post(
        "/api/v1/auth/send-verification", headers={"Authorization": f"Bearer {access_token}"}
    )
    assert r.status_code == 204
    assert len(sent_emails) == 0
