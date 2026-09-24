from datetime import datetime, timezone

from sqlalchemy import Boolean, CheckConstraint, DateTime, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


def _now() -> datetime:
    return datetime.now(timezone.utc)


class SiteSettings(Base):
    """Site-wide SEO settings, editable by an admin without a redeploy.

    A singleton: exactly one row, always id=1. The CHECK constraint is what
    keeps it that way — without it a second row could appear and which one
    the site rendered would come down to row order.

    Every text column is nullable, and NULL means "fall back to the i18n
    dictionaries" rather than "empty". That distinction matters: an admin
    who clears the title should get the built-in default back, not a blank
    browser tab.
    """

    __tablename__ = "site_settings"
    __table_args__ = (CheckConstraint("id = 1", name="ck_site_settings_singleton"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)

    # Per-locale, because the site is bilingual (see the C2 i18n work).
    title_uk: Mapped[str | None] = mapped_column(String(200), nullable=True)
    title_en: Mapped[str | None] = mapped_column(String(200), nullable=True)
    description_uk: Mapped[str | None] = mapped_column(Text, nullable=True)
    description_en: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Stored filenames only (never client-supplied paths) — see
    # routers/site_settings.py for how they are generated and served.
    favicon: Mapped[str | None] = mapped_column(String(128), nullable=True)
    og_image: Mapped[str | None] = mapped_column(String(128), nullable=True)
    # Two logos because the site has two surfaces: the dark marketing pages
    # and the light dashboard. NULL = the text wordmark.
    logo_dark: Mapped[str | None] = mapped_column(String(128), nullable=True)
    logo_light: Mapped[str | None] = mapped_column(String(128), nullable=True)

    # Lets the owner pull the site out of search results with one switch,
    # e.g. while the content is still a work in progress.
    noindex: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_now, onupdate=_now, nullable=False
    )
