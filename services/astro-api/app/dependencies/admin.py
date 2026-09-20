from fastapi import Depends, HTTPException, status

from app.dependencies.auth import get_current_user
from app.models.user import User


async def require_admin(current_user: User = Depends(get_current_user)) -> User:
    """FastAPI dependency that restricts an endpoint to administrators.

    Mirrors require_plan() in dependencies/billing.py. This is the only
    admin gate that matters — the frontend hides the admin UI from
    non-admins, but that is cosmetic and must never be relied upon.
    """
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "admin_required", "message": "Administrator access required."},
        )
    return current_user
