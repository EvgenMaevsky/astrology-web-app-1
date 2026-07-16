from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies.auth import get_current_user
from app.models.chart import Chart
from app.models.chart_log import ChartLog
from app.models.person import Person
from app.models.user import EmailToken, User
from app.routers.auth import _verify_password
from app.schemas.user import DeleteAccountRequest

router = APIRouter(prefix="/api/v1/users", tags=["users"])


@router.delete("/me", status_code=status.HTTP_204_NO_CONTENT)
async def delete_account(
    body: DeleteAccountRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    if not _verify_password(body.password, current_user.password_hash):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Incorrect password")

    # SQLite doesn't enforce the FK-level ondelete="CASCADE" these tables
    # declare, so rows without an ORM relationship must be deleted explicitly.
    # Tables covered by User's ORM relationships (settings, subscriptions,
    # payments, refresh_tokens) are handled by db.delete(current_user) below.
    await db.execute(delete(Chart).where(Chart.user_id == current_user.id))
    await db.execute(delete(Person).where(Person.user_id == current_user.id))
    await db.execute(delete(ChartLog).where(ChartLog.user_id == current_user.id))
    await db.execute(delete(EmailToken).where(EmailToken.user_id == current_user.id))
    await db.delete(current_user)
    await db.commit()
