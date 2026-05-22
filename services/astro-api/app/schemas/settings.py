from pydantic import BaseModel, Field


class UserSettingsOut(BaseModel):
    timezone: str
    default_lat: float | None
    default_lon: float | None
    house_system: str
    aspect_profile: str
    ui_prefs: dict

    model_config = {"from_attributes": True}


class UserSettingsUpdate(BaseModel):
    timezone: str | None = Field(None, min_length=2, max_length=64)
    default_lat: float | None = Field(None, ge=-90, le=90)
    default_lon: float | None = Field(None, ge=-180, le=180)
    house_system: str | None = None
    aspect_profile: str | None = None
    ui_prefs: dict | None = None
