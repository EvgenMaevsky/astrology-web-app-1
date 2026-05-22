from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class NatalChartRequest(BaseModel):
    birth_dt: datetime
    lat: float = Field(ge=-90, le=90)
    lon: float = Field(ge=-180, le=180)
    house_system: Literal["placidus", "equal", "whole_sign", "koch"] = "placidus"
    bodies: list[str] | None = None


class PlanetPos(BaseModel):
    longitude: float
    latitude: float
    distance: float
    speed: float
    sign: str
    sign_degree: float
    house: int
    retrograde: bool
    term_ruler: str | None = None


class ArabicPart(BaseModel):
    name: str
    longitude: float
    sign: str
    sign_degree: float


class Angles(BaseModel):
    asc: float
    mc: float
    dsc: float
    ic: float


class ChartMeta(BaseModel):
    jd: float
    ramc: float
    obliquity: float
    house_system: str


class AspectEntry(BaseModel):
    planet1: str
    planet2: str
    aspect: str
    angle: float
    orb: float
    applying: bool


class NatalChartResponse(BaseModel):
    planets: dict[str, PlanetPos]
    houses: list[float]
    angles: Angles
    aspects: list[AspectEntry]
    arabic_parts: list[ArabicPart] = []
    meta: ChartMeta
