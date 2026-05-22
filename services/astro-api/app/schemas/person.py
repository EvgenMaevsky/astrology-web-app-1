from datetime import datetime

from pydantic import BaseModel, Field


class PersonCreate(BaseModel):
    name: str = Field(min_length=1, max_length=256)
    birth_dt: datetime
    timezone: str = Field(min_length=1, max_length=64)
    lat: float = Field(ge=-90, le=90)
    lon: float = Field(ge=-180, le=180)
    city_label: str | None = None
    notes: str | None = None


class PersonUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=256)
    birth_dt: datetime | None = None
    timezone: str | None = None
    lat: float | None = Field(default=None, ge=-90, le=90)
    lon: float | None = Field(default=None, ge=-180, le=180)
    city_label: str | None = None
    notes: str | None = None


class PersonOut(BaseModel):
    id: str
    name: str
    birth_dt: datetime
    timezone: str
    lat: float
    lon: float
    city_label: str | None
    notes: str | None
    created_at: datetime

    model_config = {"from_attributes": True}
