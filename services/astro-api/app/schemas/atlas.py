from pydantic import BaseModel


class CityOut(BaseModel):
    id: int
    name: str
    ascii_name: str
    country: str
    region: str
    lat: float
    lon: float
    timezone: str
    population: int

    model_config = {"from_attributes": True}


class TimezoneOut(BaseModel):
    timezone: str
    lat: float
    lon: float
