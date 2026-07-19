from datetime import datetime, timezone
from typing import Literal
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from pydantic import BaseModel, Field, model_validator

HouseSystem = Literal[
    "placidus", "equal", "whole_sign", "koch", "regiomontanus", "campanus"
]

# de440s.bsp (the loaded ephemeris kernel) only covers 1849-12-26 through
# 2150-01-22 — Skyfield raises an EphemerisRangeError for dates outside
# that, which nothing catches, so it would otherwise surface as an
# unhandled 500. Padded a day inward on both ends to stay clear of the
# exact kernel boundary.
EPHEMERIS_MIN_YEAR = 1850
EPHEMERIS_MAX_YEAR = 2149


def _check_ephemeris_range(dt: datetime, field: str) -> None:
    if not (EPHEMERIS_MIN_YEAR <= dt.year <= EPHEMERIS_MAX_YEAR):
        raise ValueError(
            f"{field} must be between {EPHEMERIS_MIN_YEAR} and {EPHEMERIS_MAX_YEAR} "
            "(outside the loaded ephemeris data range)"
        )


def to_utc(dt: datetime, tz_name: str | None) -> datetime:
    """Interpret a naive datetime as local wall time in tz_name and convert to UTC.

    Aware datetimes are converted as-is; naive without tz_name are taken as UTC.
    """
    if dt.tzinfo is not None:
        return dt.astimezone(timezone.utc)
    if tz_name:
        try:
            tz = ZoneInfo(tz_name)
        except (ZoneInfoNotFoundError, ValueError):
            raise ValueError(f"Unknown IANA timezone: {tz_name!r}")
        return dt.replace(tzinfo=tz).astimezone(timezone.utc)
    return dt.replace(tzinfo=timezone.utc)


class NatalChartRequest(BaseModel):
    birth_dt: datetime
    timezone: str | None = None  # IANA name, e.g. "Europe/Kyiv"
    lat: float = Field(ge=-90, le=90)
    lon: float = Field(ge=-180, le=180)
    house_system: HouseSystem = "placidus"
    bodies: list[str] | None = None

    @model_validator(mode="after")
    def _localize(self) -> "NatalChartRequest":
        self.birth_dt = to_utc(self.birth_dt, self.timezone)
        _check_ephemeris_range(self.birth_dt, "birth_dt")
        return self


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
    natal_tz: str | None = None
    natal_lat: float = Field(ge=-90, le=90)
    natal_lon: float = Field(ge=-180, le=180)
    transit_dt: datetime
    transit_tz: str | None = None
    transit_lat: float = Field(ge=-90, le=90)
    transit_lon: float = Field(ge=-180, le=180)
    house_system: HouseSystem = "placidus"
    bodies: list[str] | None = None

    @model_validator(mode="after")
    def _localize(self) -> "TransitRequest":
        self.natal_dt = to_utc(self.natal_dt, self.natal_tz)
        self.transit_dt = to_utc(self.transit_dt, self.transit_tz)
        _check_ephemeris_range(self.natal_dt, "natal_dt")
        _check_ephemeris_range(self.transit_dt, "transit_dt")
        return self


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
    timezone: str | None = None  # timezone of birth_dt
    year: int
    lat: float = Field(ge=-90, le=90)
    lon: float = Field(ge=-180, le=180)
    house_system: HouseSystem = "placidus"

    @model_validator(mode="after")
    def _localize(self) -> "SolarReturnRequest":
        self.birth_dt = to_utc(self.birth_dt, self.timezone)
        _check_ephemeris_range(self.birth_dt, "birth_dt")
        if not (EPHEMERIS_MIN_YEAR <= self.year <= EPHEMERIS_MAX_YEAR):
            raise ValueError(
                f"year must be between {EPHEMERIS_MIN_YEAR} and {EPHEMERIS_MAX_YEAR} "
                "(outside the loaded ephemeris data range)"
            )
        return self


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
    tz1: str | None = None
    lat1: float = Field(ge=-90, le=90)
    lon1: float = Field(ge=-180, le=180)
    dt2: datetime
    tz2: str | None = None
    lat2: float = Field(ge=-90, le=90)
    lon2: float = Field(ge=-180, le=180)
    house_system: HouseSystem = "placidus"
    bodies: list[str] | None = None

    @model_validator(mode="after")
    def _localize(self) -> "SynastryRequest":
        self.dt1 = to_utc(self.dt1, self.tz1)
        self.dt2 = to_utc(self.dt2, self.tz2)
        _check_ephemeris_range(self.dt1, "dt1")
        _check_ephemeris_range(self.dt2, "dt2")
        return self


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
