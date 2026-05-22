from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.dependencies.auth import get_current_user
from app.models.user import User, UserSettings
from app.schemas.settings import UserSettingsOut, UserSettingsUpdate

router = APIRouter(prefix="/api/v1/settings", tags=["settings"])


async def _load_settings(user_id: str, db: AsyncSession) -> UserSettings:
    result = await db.execute(
        select(UserSettings).where(UserSettings.user_id == user_id)
    )
    s = result.scalar_one_or_none()
    if s is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Settings not found")
    return s


@router.get("", response_model=UserSettingsOut)
async def get_settings(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> UserSettingsOut:
    s = await _load_settings(current_user.id, db)
    return UserSettingsOut.model_validate(s)


@router.patch("", response_model=UserSettingsOut)
async def update_settings(
    body: UserSettingsUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> UserSettingsOut:
    s = await _load_settings(current_user.id, db)
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(s, field, value)
    await db.commit()
    await db.refresh(s)
    return UserSettingsOut.model_validate(s)
