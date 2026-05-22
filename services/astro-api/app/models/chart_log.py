import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _uuid() -> str:
    return str(uuid.uuid4())


class ChartLog(Base):
    __tablename__ = "chart_logs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    chart_type: Mapped[str] = mapped_column(String(32), nullable=False, default="natal")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, index=True)
