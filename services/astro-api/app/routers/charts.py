from fastapi import APIRouter, Depends

from app.dependencies.auth import get_current_user
from app.ephemeris.arabic_parts import compute_arabic_parts
from app.ephemeris.engine import EphemerisEngine
from app.ephemeris.terms import add_terms_to_planets
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
    planets = data["planets"]
    houses = data["houses"]

    add_terms_to_planets(planets)
    aspects = _engine.calc_aspects(planets)
    arabic_parts = compute_arabic_parts(planets, houses)

    return NatalChartResponse(
        planets=planets,
        houses=houses,
        angles=data["angles"],
        aspects=aspects,
        arabic_parts=arabic_parts,
        meta=data["meta"],
    )
