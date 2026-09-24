import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import JSON

from app.database import Base


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _uuid() -> str:
    return str(uuid.uuid4())


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    email: Mapped[str] = mapped_column(String(320), unique=True, nullable=False, index=True)
    # Nullable since Google sign-in: an account created through Google has no
    # password at all. Every code path that touches it must handle None —
    # see routers/auth.py::login and routers/users.py::delete_account.
    password_hash: Mapped[str | None] = mapped_column(Text, nullable=True)
    plan: Mapped[str] = mapped_column(String(32), nullable=False, default="free")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    email_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    # Grants access to the admin area (site SEO settings). Deliberately a
    # column rather than an env-var allowlist, so admins can be granted
    # without a redeploy.
    is_admin: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    # Google's immutable subject identifier. UNIQUE is load-bearing: without
    # it two accounts could latch onto the same Google profile. Matching is
    # done on this, never on email — an address can change hands, a sub cannot.
    google_sub: Mapped[str | None] = mapped_column(String(255), nullable=True, unique=True, index=True)
    stripe_customer_id: Mapped[str | None] = mapped_column(String(256), nullable=True, unique=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)

    @property
    def has_password(self) -> bool:
        """False for accounts created through Google, which never had one."""
        return self.password_hash is not None

    settings: Mapped["UserSettings"] = relationship(back_populates="user", uselist=False, cascade="all, delete-orphan")
    subscriptions: Mapped[list["Subscription"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    payments: Mapped[list["Payment"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    refresh_tokens: Mapped[list["RefreshToken"]] = relationship(back_populates="user", cascade="all, delete-orphan")


class UserSettings(Base):
    __tablename__ = "user_settings"

    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), primary_key=True)
    timezone: Mapped[str] = mapped_column(String(64), default="Europe/Kyiv")
    default_lat: Mapped[float | None] = mapped_column(Float, nullable=True)
    default_lon: Mapped[float | None] = mapped_column(Float, nullable=True)
    house_system: Mapped[str] = mapped_column(String(32), default="placidus")
    aspect_profile: Mapped[str] = mapped_column(String(64), default="natal")
    ui_prefs: Mapped[dict] = mapped_column(JSON, default=dict)

    user: Mapped["User"] = relationship(back_populates="settings")


class Subscription(Base):
    __tablename__ = "subscriptions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=False)
    plan: Mapped[str] = mapped_column(String(32), nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False)  # active|canceled|past_due
    stripe_sub_id: Mapped[str | None] = mapped_column(String(256), nullable=True, unique=True)
    liqpay_order_id: Mapped[str | None] = mapped_column(String(256), nullable=True)
    monopay_invoice_id: Mapped[str | None] = mapped_column(String(64), nullable=True, unique=True, index=True)
    period_start: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    period_end: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    # "month" | "year". Separate from `plan` on purpose: access checks look
    # at the plan only, and a yearly Pro is still Pro.
    billing_interval: Mapped[str] = mapped_column(
        String(8), nullable=False, default="month", server_default="month"
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)

    user: Mapped["User"] = relationship(back_populates="subscriptions")


class Payment(Base):
    __tablename__ = "payments"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    amount_cents: Mapped[int] = mapped_column(Integer, nullable=False)
    currency: Mapped[str] = mapped_column(String(8), nullable=False)
    provider: Mapped[str] = mapped_column(String(16), nullable=False)  # stripe|monopay
    provider_payment_id: Mapped[str | None] = mapped_column(String(256), nullable=True, unique=True, index=True)
    status: Mapped[str] = mapped_column(String(32), nullable=False)  # pending|succeeded|failed
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)

    user: Mapped["User"] = relationship(back_populates="payments")


class RefreshToken(Base):
    __tablename__ = "refresh_tokens"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=False)
    token_hash: Mapped[str] = mapped_column(String(256), unique=True, nullable=False, index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    revoked: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)

    user: Mapped["User"] = relationship(back_populates="refresh_tokens")


class EmailToken(Base):
    __tablename__ = "email_tokens"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    token_hash: Mapped[str] = mapped_column(String(256), unique=True, nullable=False, index=True)
    purpose: Mapped[str] = mapped_column(String(16), nullable=False)  # verify|reset
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    used: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
