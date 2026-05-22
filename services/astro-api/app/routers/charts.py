from fastapi import APIRouter, Depends

from app.dependencies.auth import get_current_user
from app.ephemeris.engine import EphemerisEngine
from app.models.user import User
from app.schemas.chart import NatalChartRequest, NatalChartResponse

router = APIRouter(prefix="/api/v1/charts", tags=["charts"])

_engine = EphemerisEngine()


@router.post("/natal", response_model=NatalChartResponse)
async def natal_chart(
    body: NatalChartRequest,
    current_user: User = Depends(get_current_user),
) -> NatalChartResponse:
    data = _engine.calc_natal(
        dt=body.birth_dt,
        lat=body.lat,
        lon=body.lon,
        house_system=body.house_system,
        bodies=body.bodies,
    )
    aspects = _engine.calc_aspects(data["planets"])
    return NatalChartResponse(
        planets=data["planets"],
        houses=data["houses"],
        angles=data["angles"],
        aspects=aspects,
        meta=data["meta"],
    )
