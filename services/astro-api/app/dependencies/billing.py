from fastapi import Depends, HTTPException, status

from app.dependencies.auth import get_current_user
from app.models.user import User

PLAN_RANK = {"free": 0, "pro": 1, "expert": 2}


def require_plan(*plans: str):
    """FastAPI dependency that enforces a minimum plan level.

    Usage:
        @router.post("/transit")
        def create_transit(_: User = Depends(require_plan("pro", "expert"))):
            ...
    """
    allowed = set(plans)

    def _check(current_user: User = Depends(get_current_user)) -> User:
        if current_user.plan not in allowed:
            ranked = sorted(allowed, key=lambda p: PLAN_RANK.get(p, 99))
            # Message names only the cheapest allowed plan — never a plan
            # that isn't currently for sale (e.g. "expert" is hidden from
            # /billing/plans but still a valid value here for existing users).
            cheapest = ranked[0]
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "code": "plan_required",
                    "required": ranked,
                    "current": current_user.plan,
                    "message": f"This feature requires the {cheapest.capitalize()} plan or higher.",
                },
            )
        return current_user

    return _check
