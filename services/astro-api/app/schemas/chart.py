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


# ── Transit ───────────────────────────────────────────────────────────────────

class TransitRequest(BaseModel):
    natal_dt: datetime
    natal_lat: float = Field(ge=-90, le=90)
    natal_lon: float = Field(ge=-180, le=180)
    transit_dt: datetime
    transit_lat: float = Field(ge=-90, le=90)
    transit_lon: float = Field(ge=-180, le=180)
    house_system: Literal["placidus", "equal", "whole_sign", "koch"] = "placidus"
    bodies: list[str] | None = None


class CrossAspectEntry(BaseModel):
    transit: str
    natal: str
    aspect: str
    angle: float
    orb: float
    applying: bool


class TransitResponse(BaseModel):
    natal: NatalChartResponse
    transit: dict[str, PlanetPos]
    aspects: list[CrossAspectEntry]


# ── Solar Return ──────────────────────────────────────────────────────────────

class SolarReturnRequest(BaseModel):
    birth_dt: datetime
    year: int
    lat: float = Field(ge=-90, le=90)
    lon: float = Field(ge=-180, le=180)
    house_system: Literal["placidus", "equal", "whole_sign", "koch"] = "placidus"


class SolarReturnResponse(BaseModel):
    return_dt: str
    natal_sun: float
    planets: dict[str, PlanetPos]
    houses: list[float]
    angles: Angles
    aspects: list[AspectEntry]
    arabic_parts: list[ArabicPart] = []
    meta: ChartMeta


# ── Synastry ──────────────────────────────────────────────────────────────────

class SynastryRequest(BaseModel):
    dt1: datetime
    lat1: float = Field(ge=-90, le=90)
    lon1: float = Field(ge=-180, le=180)
    dt2: datetime
    lat2: float = Field(ge=-90, le=90)
    lon2: float = Field(ge=-180, le=180)
    house_system: Literal["placidus", "equal", "whole_sign", "koch"] = "placidus"
    bodies: list[str] | None = None


class SynastryInterAspect(BaseModel):
    person1: str
    person2: str
    aspect: str
    angle: float
    orb: float
    applying: bool


class SynastryResponse(BaseModel):
    person1: NatalChartResponse
    person2: NatalChartResponse
    inter_aspects: list[SynastryInterAspect]
