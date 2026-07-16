from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.dependencies.auth import get_current_user
from app.models.chart import Chart
from app.models.user import User
from app.schemas.saved_chart import SavedChartCreate, SavedChartFull, SavedChartOut

router = APIRouter(prefix="/api/v1/saved-charts", tags=["saved-charts"])


@router.get("", response_model=list[SavedChartOut])
async def list_saved_charts(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[Chart]:
    result = await db.execute(
        select(Chart)
        .where(Chart.user_id == current_user.id)
        .order_by(Chart.created_at.desc())
    )
    return list(result.scalars().all())


@router.post("", response_model=SavedChartOut, status_code=status.HTTP_201_CREATED)
async def create_saved_chart(
    body: SavedChartCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Chart:
    count_result = await db.execute(
        select(func.count()).where(Chart.user_id == current_user.id).select_from(Chart)
    )
    if count_result.scalar_one() >= settings.max_saved_charts:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "code": "saved_charts_limit",
                "message": f"You can save up to {settings.max_saved_charts} charts. Delete one to save a new chart.",
            },
        )

    chart = Chart(user_id=current_user.id, **body.model_dump())
    db.add(chart)
    await db.commit()
    await db.refresh(chart)
    return chart


@router.get("/{chart_id}", response_model=SavedChartFull)
async def get_saved_chart(
    chart_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Chart:
    return await _get_owned(chart_id, current_user.id, db)


@router.delete("/{chart_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_saved_chart(
    chart_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    chart = await _get_owned(chart_id, current_user.id, db)
    await db.delete(chart)
    await db.commit()


async def _get_owned(chart_id: str, user_id: str, db: AsyncSession) -> Chart:
    result = await db.execute(
        select(Chart).where(Chart.id == chart_id, Chart.user_id == user_id)
    )
    chart = result.scalar_one_or_none()
    if not chart:
        raise HTTPException(status_code=404, detail="Chart not found")
    return chart
