"""Admin-only site SEO settings, and the image upload that feeds them.

The upload endpoint is the security-sensitive part: it accepts a file from
the network and later serves it back from our own origin. The tests below
therefore lean on the two things that must hold — the declared Content-Type
is never trusted, and the stored filename is never taken from the client.
See docs/plans/2026-09-19-e1-admin-seo-settings.md.
"""
import struct

import pytest
from httpx import AsyncClient
from sqlalchemy import select

from app.models.user import User
from tests.conftest import TestSession

PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 64
JPEG = b"\xff\xd8\xff\xe0" + b"\x00" * 64
ICO = b"\x00\x00\x01\x00" + b"\x00" * 64
WEBP = b"RIFF" + struct.pack("<I", 64) + b"WEBP" + b"\x00" * 52


@pytest.fixture(autouse=True)
def uploads_tmp(tmp_path, monkeypatch):
    # Without this the suite would litter the repo with uploaded files.
    monkeypatch.setattr("app.config.settings.uploads_dir", str(tmp_path / "uploads"))


async def _token(client: AsyncClient, email: str, *, admin: bool = False) -> str:
    reg = await client.post(
        "/api/v1/auth/register", json={"email": email, "password": "password123"}
    )
    if admin:
        async with TestSession() as session:
            result = await session.execute(select(User).where(User.email == email))
            result.scalar_one().is_admin = True
            await session.commit()
    return reg.json()["access_token"]


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


# ── access control ───────────────────────────────────────────────────────────

async def test_read_settings_is_public(client: AsyncClient):
    # Page metadata renders for anonymous visitors, so this must not 401.
    r = await client.get("/api/v1/site-settings")
    assert r.status_code == 200
    assert r.json()["title_uk"] is None
    assert r.json()["noindex"] is False


async def test_update_rejects_anonymous(client: AsyncClient):
    r = await client.put("/api/v1/site-settings", json={"title_uk": "x"})
    assert r.status_code == 401


async def test_update_rejects_non_admin(client: AsyncClient):
    token = await _token(client, "plain@example.com")
    r = await client.put("/api/v1/site-settings", json={"title_uk": "x"}, headers=_auth(token))
    assert r.status_code == 403
    assert r.json()["detail"]["code"] == "admin_required"


async def test_upload_rejects_non_admin(client: AsyncClient):
    token = await _token(client, "plain-upload@example.com")
    r = await client.post(
        "/api/v1/site-settings/upload",
        data={"kind": "favicon"},
        files={"file": ("f.png", PNG, "image/png")},
        headers=_auth(token),
    )
    assert r.status_code == 403


async def test_me_exposes_is_admin(client: AsyncClient):
    token = await _token(client, "admin-me@example.com", admin=True)
    r = await client.get("/api/v1/auth/me", headers=_auth(token))
    assert r.status_code == 200
    assert r.json()["is_admin"] is True


# ── updating values ──────────────────────────────────────────────────────────

async def test_admin_updates_both_locales(client: AsyncClient):
    token = await _token(client, "admin1@example.com", admin=True)
    r = await client.put(
        "/api/v1/site-settings",
        json={
            "title_uk": "Астродіт", "title_en": "Astrodite",
            "description_uk": "Опис", "description_en": "Description",
            "noindex": True,
        },
        headers=_auth(token),
    )
    assert r.status_code == 200
    body = r.json()
    assert body["title_uk"] == "Астродіт"
    assert body["title_en"] == "Astrodite"
    assert body["noindex"] is True

    # Persisted, not just echoed back.
    assert (await client.get("/api/v1/site-settings")).json()["title_en"] == "Astrodite"


async def test_partial_update_leaves_other_fields_alone(client: AsyncClient):
    token = await _token(client, "admin2@example.com", admin=True)
    await client.put(
        "/api/v1/site-settings",
        json={"title_uk": "Перший", "title_en": "First"},
        headers=_auth(token),
    )
    r = await client.put(
        "/api/v1/site-settings", json={"title_uk": "Другий"}, headers=_auth(token)
    )
    assert r.json()["title_uk"] == "Другий"
    assert r.json()["title_en"] == "First"


@pytest.mark.parametrize("blank", ["", "   "])
async def test_blank_title_clears_to_null_for_fallback(client: AsyncClient, blank: str):
    # NULL means "use the i18n default". A whitespace-only title stored as-is
    # would render an empty browser tab instead.
    token = await _token(client, f"admin3{len(blank)}@example.com", admin=True)
    await client.put("/api/v1/site-settings", json={"title_uk": "Щось"}, headers=_auth(token))
    r = await client.put("/api/v1/site-settings", json={"title_uk": blank}, headers=_auth(token))
    assert r.json()["title_uk"] is None


async def test_title_too_long_rejected(client: AsyncClient):
    token = await _token(client, "admin4@example.com", admin=True)
    r = await client.put(
        "/api/v1/site-settings", json={"title_uk": "x" * 201}, headers=_auth(token)
    )
    assert r.status_code == 422


# ── uploads ──────────────────────────────────────────────────────────────────

@pytest.mark.parametrize("content,expected_ext", [
    (PNG, "png"), (JPEG, "jpg"), (ICO, "ico"), (WEBP, "webp"),
])
async def test_upload_accepts_supported_formats(
    client: AsyncClient, content: bytes, expected_ext: str
):
    token = await _token(client, f"up-{expected_ext}@example.com", admin=True)
    r = await client.post(
        "/api/v1/site-settings/upload",
        data={"kind": "favicon"},
        files={"file": ("whatever.bin", content, "application/octet-stream")},
        headers=_auth(token),
    )
    assert r.status_code == 200
    # Name comes from us, not from the client's "whatever.bin", and the
    # extension is decided by the bytes, not by the declared content type.
    assert r.json()["favicon"].endswith(f".{expected_ext}")


async def test_uploaded_file_is_served_back(client: AsyncClient):
    token = await _token(client, "up-serve@example.com", admin=True)
    up = await client.post(
        "/api/v1/site-settings/upload",
        data={"kind": "og_image"},
        files={"file": ("card.png", PNG, "image/png")},
        headers=_auth(token),
    )
    name = up.json()["og_image"]

    r = await client.get(f"/api/v1/site-settings/file/{name}")
    assert r.status_code == 200
    assert r.content == PNG
    assert r.headers["content-type"] == "image/png"
    assert r.headers["x-content-type-options"] == "nosniff"


async def test_upload_rejects_disguised_svg(client: AsyncClient):
    # The classic stored-XSS attempt: an SVG claiming to be a PNG. We serve
    # these files from our own origin, so this must never be written to disk.
    token = await _token(client, "up-svg@example.com", admin=True)
    svg = b'<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'
    r = await client.post(
        "/api/v1/site-settings/upload",
        data={"kind": "favicon"},
        files={"file": ("icon.png", svg, "image/png")},
        headers=_auth(token),
    )
    assert r.status_code == 422
    assert r.json()["detail"]["code"] == "unsupported_image"


async def test_upload_rejects_non_image_with_image_content_type(client: AsyncClient):
    token = await _token(client, "up-html@example.com", admin=True)
    r = await client.post(
        "/api/v1/site-settings/upload",
        data={"kind": "favicon"},
        files={"file": ("x.png", b"<html>hi</html>", "image/png")},
        headers=_auth(token),
    )
    assert r.status_code == 422


async def test_upload_rejects_oversized_file(client: AsyncClient):
    token = await _token(client, "up-big@example.com", admin=True)
    big = PNG + b"\x00" * (256 * 1024 + 1)
    r = await client.post(
        "/api/v1/site-settings/upload",
        data={"kind": "favicon"},
        files={"file": ("big.png", big, "image/png")},
        headers=_auth(token),
    )
    assert r.status_code == 413
    assert r.json()["detail"]["code"] == "file_too_large"


async def test_upload_rejects_unknown_kind(client: AsyncClient):
    token = await _token(client, "up-kind@example.com", admin=True)
    r = await client.post(
        "/api/v1/site-settings/upload",
        data={"kind": "../../etc/passwd"},
        files={"file": ("f.png", PNG, "image/png")},
        headers=_auth(token),
    )
    assert r.status_code == 422
    assert r.json()["detail"]["code"] == "invalid_kind"


@pytest.mark.parametrize("name", [
    "../../../etc/passwd", "..%2f..%2fetc%2fpasswd", "notahex.png",
    "0123456789abcdef0123456789abcdef.svg", "0123456789abcdef0123456789abcdef.png.exe",
])
async def test_serve_rejects_names_we_did_not_generate(client: AsyncClient, name: str):
    r = await client.get(f"/api/v1/site-settings/file/{name}")
    assert r.status_code == 404


async def test_admin_can_remove_an_image(client: AsyncClient):
    token = await _token(client, "up-del@example.com", admin=True)
    up = await client.post(
        "/api/v1/site-settings/upload",
        data={"kind": "favicon"},
        files={"file": ("a.png", PNG, "image/png")},
        headers=_auth(token),
    )
    name = up.json()["favicon"]

    r = await client.delete("/api/v1/site-settings/image/favicon", headers=_auth(token))
    assert r.status_code == 200
    assert r.json()["favicon"] is None
    assert (await client.get(f"/api/v1/site-settings/file/{name}")).status_code == 404


async def test_delete_image_rejects_non_admin(client: AsyncClient):
    token = await _token(client, "up-del-plain@example.com")
    r = await client.delete("/api/v1/site-settings/image/favicon", headers=_auth(token))
    assert r.status_code == 403


async def test_replacing_an_image_removes_the_old_file(client: AsyncClient):
    token = await _token(client, "up-replace@example.com", admin=True)
    first = await client.post(
        "/api/v1/site-settings/upload",
        data={"kind": "favicon"},
        files={"file": ("a.png", PNG, "image/png")},
        headers=_auth(token),
    )
    old = first.json()["favicon"]

    second = await client.post(
        "/api/v1/site-settings/upload",
        data={"kind": "favicon"},
        files={"file": ("b.jpg", JPEG, "image/jpeg")},
        headers=_auth(token),
    )
    new = second.json()["favicon"]
    assert new != old

    assert (await client.get(f"/api/v1/site-settings/file/{new}")).status_code == 200
    assert (await client.get(f"/api/v1/site-settings/file/{old}")).status_code == 404
