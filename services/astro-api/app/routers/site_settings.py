import logging
import re
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings as app_settings
from app.database import get_db
from app.dependencies.admin import require_admin
from app.models.site_settings import SiteSettings
from app.models.user import User
from app.schemas.site_settings import SiteSettingsOut, SiteSettingsUpdate

log = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/site-settings", tags=["site-settings"])

# Upload limits. Deliberately small: a favicon, a social preview card and two
# logos, not a photo gallery.
_MAX_BYTES = {
    "favicon": 256 * 1024,
    "og_image": 1024 * 1024,
    "logo_dark": 512 * 1024,
    "logo_light": 512 * 1024,
}
# ICO is a favicon format; as a logo it would render blurry or not at all.
_ALLOWED_EXTS = {
    "favicon": {".png", ".jpg", ".ico", ".webp"},
    "og_image": {".png", ".jpg", ".ico", ".webp"},
    "logo_dark": {".png", ".jpg", ".webp"},
    "logo_light": {".png", ".jpg", ".webp"},
}
_INVALID_KIND = {
    "code": "invalid_kind",
    "message": "kind must be one of: " + ", ".join(_MAX_BYTES) + ".",
}
_CHUNK = 64 * 1024

# Accepted formats, keyed by magic bytes. The declared Content-Type is
# attacker-controlled and is therefore ignored entirely — the file's own
# leading bytes decide both whether we accept it and what extension it gets.
#
# SVG is absent on purpose: it can carry script, and we serve these files
# ourselves, so an uploaded SVG would be a stored-XSS vector.
_MAGIC: list[tuple[bytes, str, str]] = [
    (b"\x89PNG\r\n\x1a\n", ".png", "image/png"),
    (b"\xff\xd8\xff", ".jpg", "image/jpeg"),
    (b"\x00\x00\x01\x00", ".ico", "image/x-icon"),
]
_MEDIA_TYPES = {ext: mime for _, ext, mime in _MAGIC} | {".webp": "image/webp"}

# Matches only names this module generates, which is what makes path
# traversal impossible regardless of what the client sends.
_FILENAME_RE = re.compile(r"^[0-9a-f]{32}\.(png|jpg|ico|webp)$")


def _uploads_dir() -> Path:
    path = Path(app_settings.uploads_dir)
    path.mkdir(parents=True, exist_ok=True)
    return path


def _sniff(head: bytes) -> str | None:
    """Return the file extension implied by the leading bytes, or None."""
    for magic, ext, _ in _MAGIC:
        if head.startswith(magic):
            return ext
    # WebP is a RIFF container: "RIFF" <4-byte size> "WEBP".
    if head.startswith(b"RIFF") and head[8:12] == b"WEBP":
        return ".webp"
    return None


async def get_or_create_settings(db: AsyncSession) -> SiteSettings:
    """Load the singleton row, creating it on first use.

    Two concurrent callers would otherwise race on the insert, so the insert
    is an upsert — same pattern as chart quotas in routers/charts.py.
    """
    result = await db.execute(select(SiteSettings).where(SiteSettings.id == 1))
    row = result.scalar_one_or_none()
    if row is not None:
        return row

    insert = pg_insert if db.get_bind().dialect.name == "postgresql" else sqlite_insert
    await db.execute(insert(SiteSettings).values(id=1).on_conflict_do_nothing(index_elements=["id"]))
    await db.commit()

    result = await db.execute(select(SiteSettings).where(SiteSettings.id == 1))
    return result.scalar_one()


@router.get("", response_model=SiteSettingsOut)
async def read_site_settings(db: AsyncSession = Depends(get_db)) -> SiteSettingsOut:
    """Public: page metadata is rendered for anonymous visitors too."""
    return SiteSettingsOut.model_validate(await get_or_create_settings(db))


@router.put("", response_model=SiteSettingsOut)
async def update_site_settings(
    body: SiteSettingsUpdate,
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> SiteSettingsOut:
    row = await get_or_create_settings(db)
    # exclude_unset, not exclude_none: an explicit null means "clear this and
    # go back to the dictionary default", which exclude_none would swallow.
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(row, field, value)
    await db.commit()
    await db.refresh(row)
    return SiteSettingsOut.model_validate(row)


@router.post("/upload", response_model=SiteSettingsOut)
async def upload_image(
    kind: str = Form(...),
    file: UploadFile = File(...),
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> SiteSettingsOut:
    if kind not in _MAX_BYTES:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail=_INVALID_KIND)
    limit = _MAX_BYTES[kind]

    # Read with a hard cap rather than file.read(): an unbounded read would
    # let one request spool an arbitrarily large body to disk.
    data = bytearray()
    while chunk := await file.read(_CHUNK):
        data.extend(chunk)
        if len(data) > limit:
            raise HTTPException(
                status_code=status.HTTP_413_CONTENT_TOO_LARGE,
                detail={
                    "code": "file_too_large",
                    "max_bytes": limit,
                    "message": f"File must be {limit // 1024} KB or smaller.",
                },
            )

    ext = _sniff(bytes(data[:16]))
    if ext is None or ext not in _ALLOWED_EXTS[kind]:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail={
                "code": "unsupported_image",
                "message": (
                    "File must be a PNG, JPEG, ICO or WebP image."
                    if ".ico" in _ALLOWED_EXTS[kind]
                    else "File must be a PNG, JPEG or WebP image."
                ),
            },
        )

    name = f"{uuid.uuid4().hex}{ext}"
    (_uploads_dir() / name).write_bytes(bytes(data))

    row = await get_or_create_settings(db)
    previous = getattr(row, kind)
    setattr(row, kind, name)
    await db.commit()
    await db.refresh(row)

    # Best-effort cleanup; a leftover file is harmless, a failed request is not.
    if previous and _FILENAME_RE.match(previous):
        try:
            (_uploads_dir() / previous).unlink(missing_ok=True)
        except OSError:
            log.warning("Could not remove replaced upload %s", previous, exc_info=True)

    return SiteSettingsOut.model_validate(row)


@router.delete("/image/{kind}", response_model=SiteSettingsOut)
async def delete_image(
    kind: str,
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> SiteSettingsOut:
    if kind not in _MAX_BYTES:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail=_INVALID_KIND)

    row = await get_or_create_settings(db)
    previous = getattr(row, kind)
    setattr(row, kind, None)
    await db.commit()
    await db.refresh(row)

    if previous and _FILENAME_RE.match(previous):
        try:
            (_uploads_dir() / previous).unlink(missing_ok=True)
        except OSError:
            log.warning("Could not remove upload %s", previous, exc_info=True)

    return SiteSettingsOut.model_validate(row)


@router.get("/file/{name}")
async def serve_image(name: str) -> FileResponse:
    """Public: the favicon, OG image and logos are fetched by browsers and
    crawlers that have no session.
    """
    if not _FILENAME_RE.match(name):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")

    path = _uploads_dir() / name
    if not path.is_file():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")

    return FileResponse(
        path,
        media_type=_MEDIA_TYPES[path.suffix],
        headers={
            # Don't let a browser second-guess the type we declare.
            "X-Content-Type-Options": "nosniff",
            # Names are content-addressed by uuid: replacing an image mints a
            # new name, so the old one can be cached indefinitely.
            "Cache-Control": "public, max-age=31536000, immutable",
        },
    )
