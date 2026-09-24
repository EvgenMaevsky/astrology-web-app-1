from pydantic import BaseModel, Field, field_validator


class SiteSettingsOut(BaseModel):
    """Public payload — every field here is rendered into page metadata
    anyway, so there is nothing to withhold from anonymous callers.
    """

    title_uk: str | None
    title_en: str | None
    description_uk: str | None
    description_en: str | None
    favicon: str | None
    og_image: str | None
    logo_dark: str | None
    logo_light: str | None
    noindex: bool

    model_config = {"from_attributes": True}


class SiteSettingsUpdate(BaseModel):
    """Admin payload. Text fields are optional but nullable on purpose:

    - field absent  -> leave as is
    - field null/"" -> clear it, so the i18n dictionary default applies again

    Images are not set here; they arrive through the upload endpoint.
    """

    title_uk: str | None = Field(None, max_length=200)
    title_en: str | None = Field(None, max_length=200)
    description_uk: str | None = Field(None, max_length=1000)
    description_en: str | None = Field(None, max_length=1000)
    noindex: bool | None = None

    @field_validator("title_uk", "title_en", "description_uk", "description_en")
    @classmethod
    def _blank_to_none(cls, v: str | None) -> str | None:
        # A whitespace-only title would otherwise pass as "set" and render a
        # blank browser tab instead of falling back to the default.
        if v is None:
            return None
        stripped = v.strip()
        return stripped or None
