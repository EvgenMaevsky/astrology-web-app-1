from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field

SavedChartType = Literal["natal", "solar_return"]


class SavedChartCreate(BaseModel):
    chart_type: SavedChartType
    title: str = Field(min_length=1, max_length=256)
    request_payload: dict[str, Any]
    result: dict[str, Any]
    person_id: str | None = None


class SavedChartOut(BaseModel):
    id: str
    chart_type: str
    title: str
    person_id: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class SavedChartFull(SavedChartOut):
    request_payload: dict[str, Any]
    result: dict[str, Any]
