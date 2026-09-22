import hashlib
import logging
import secrets
import uuid
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from starlette.concurrency import run_in_threadpool

from app import email as email_module
from app import google_oauth
from app.config import settings
from app.database import get_db
from app.dependencies.auth import get_current_user
from app.models.user import EmailToken, RefreshToken, User, UserSettings
from app.rate_limit import limiter
from app.schemas.auth import (
    ForgotPasswordRequest,
    GoogleCallbackRequest,
    GoogleConfigOut,
    LoginRequest,
    RefreshRequest,
    RegisterRequest,
    ResetPasswordRequest,
    TokenResponse,
    UserOut,
    VerifyEmailRequest,
)

log = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/auth", tags=["auth"])


def _hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def _verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode(), hashed.encode())


# bcrypt.checkpw is the dominant cost in a login attempt (tens of ms); only
# running it when a user exists makes "no such account" measurably faster
# than "wrong password", leaking account existence via response timing even
# though both return the same 401. Hashing against this fixed dummy value
# when there's no real user keeps the two cases' timing indistinguishable.
_DUMMY_PASSWORD_HASH = bcrypt.hashpw(b"no-such-user-timing-normalization", bcrypt.gensalt()).decode()


def _make_access_token(user_id: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.access_token_expire_minutes)
    return jwt.encode(
        {"sub": user_id, "type": "access", "exp": expire},
        settings.secret_key,
        algorithm=settings.algorithm,
    )


def _make_refresh_token(user_id: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(days=settings.refresh_token_expire_days)
    return jwt.encode(
        {"sub": user_id, "type": "refresh", "exp": expire, "jti": str(uuid.uuid4())},
        settings.secret_key,
        algorithm=settings.algorithm,
    )


def _token_hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


async def _issue_email_token(db: AsyncSession, user_id: str, purpose: str, ttl: timedelta) -> str:
    raw = secrets.token_urlsafe(32)
    db.add(EmailToken(
        user_id=user_id,
        token_hash=_token_hash(raw),
        purpose=purpose,
        expires_at=datetime.now(timezone.utc) + ttl,
    ))
    return raw


VERIFY_EMAIL_SUBJECT = "Підтвердіть акаунт Astrodite / Confirm your Astrodite account"
RESET_PASSWORD_SUBJECT = "Скидання пароля Astrodite / Reset your Astrodite password"


def _verify_email_html(link: str) -> str:
    # Bilingual (uk block, then en) — the backend doesn't know the user's
    # frontend locale, and persisting it is out of scope for this change.
    return (
        f"<p>Підтвердіть свій email: <a href='{link}'>{link}</a></p>"
        f"<p>Посилання дійсне 24 години.</p>"
        f"<hr>"
        f"<p>Confirm your email: <a href='{link}'>{link}</a></p>"
        f"<p>This link is valid for 24 hours.</p>"
    )


def _reset_password_html(link: str) -> str:
    return (
        f"<p>Скиньте пароль: <a href='{link}'>{link}</a></p>"
        f"<p>Посилання дійсне 1 годину.</p>"
        f"<hr>"
        f"<p>Reset your password: <a href='{link}'>{link}</a></p>"
        f"<p>This link is valid for 1 hour.</p>"
    )


async def _consume_email_token(db: AsyncSession, raw_token: str, purpose: str) -> EmailToken | None:
    # An atomic UPDATE...WHERE used=false (not a SELECT followed by a later
    # commit) so two concurrent requests for the same token can't both pass
    # the "not used yet" check — the second one's WHERE simply matches zero
    # rows once the first has flipped the flag, even before either commits.
    result = await db.execute(
        update(EmailToken)
        .where(
            EmailToken.token_hash == _token_hash(raw_token),
            EmailToken.purpose == purpose,
            EmailToken.used.is_(False),
        )
        .values(used=True)
        .returning(EmailToken)
    )
    token = result.scalar_one_or_none()
    if token is None or token.expires_at.replace(tzinfo=timezone.utc) < datetime.now(timezone.utc):
        return None
    return token


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit(settings.rate_limit_register)
async def register(request: Request, body: RegisterRequest, db: AsyncSession = Depends(get_db)) -> TokenResponse:
    existing = await db.execute(select(User).where(User.email == body.email))
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")

    user = User(email=body.email, password_hash=_hash_password(body.password))
    db.add(user)
    await db.flush()

    db.add(UserSettings(user_id=user.id))

    refresh_raw = _make_refresh_token(user.id)
    db.add(RefreshToken(
        user_id=user.id,
        token_hash=_token_hash(refresh_raw),
        expires_at=datetime.now(timezone.utc) + timedelta(days=settings.refresh_token_expire_days),
    ))
    verify_raw = await _issue_email_token(db, user.id, "verify", timedelta(hours=24))
    await db.commit()

    try:
        link = f"{settings.frontend_url}/verify-email?token={verify_raw}"
        await email_module.send_email(user.email, VERIFY_EMAIL_SUBJECT, _verify_email_html(link))
    except Exception:
        log.exception("Failed to send verification email to %s", user.email)

    return TokenResponse(
        access_token=_make_access_token(user.id),
        refresh_token=refresh_raw,
    )


@router.post("/login", response_model=TokenResponse)
@limiter.limit(settings.rate_limit_login)
async def login(request: Request, body: LoginRequest, db: AsyncSession = Depends(get_db)) -> TokenResponse:
    result = await db.execute(select(User).where(User.email == body.email))
    user = result.scalar_one_or_none()
    # Always run bcrypt — see _DUMMY_PASSWORD_HASH. The dummy is used both for
    # a nonexistent user and for a Google-only account, which has no hash to
    # check. Returning early in either case would make those responses
    # measurably faster than "wrong password" and reopen the timing leak C3
    # closed, this time also revealing which accounts are Google-only.
    stored_hash = user.password_hash if user is not None and user.password_hash else None
    password_ok = _verify_password(body.password, stored_hash or _DUMMY_PASSWORD_HASH)
    if user is None or stored_hash is None or not password_ok:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account disabled")

    refresh_raw = _make_refresh_token(user.id)
    db.add(RefreshToken(
        user_id=user.id,
        token_hash=_token_hash(refresh_raw),
        expires_at=datetime.now(timezone.utc) + timedelta(days=settings.refresh_token_expire_days),
    ))
    await db.commit()

    return TokenResponse(
        access_token=_make_access_token(user.id),
        refresh_token=refresh_raw,
    )


@router.get("/google/config", response_model=GoogleConfigOut)
async def google_config() -> GoogleConfigOut:
    """Public: the frontend needs this to decide whether to show the button."""
    return GoogleConfigOut(
        enabled=google_oauth.is_enabled(),
        client_id=settings.google_client_id,
    )


async def _google_user(identity: google_oauth.GoogleIdentity, db: AsyncSession) -> User:
    """Find, link or create the account behind a verified Google identity.

    Order matters, and so does the email_verified check in the middle branch.
    Linking on email alone would mean anyone able to create a mailbox at a
    given address — trivially, the owner of a Workspace domain — could take
    over the matching account here. Google's own email_verified claim is what
    stands between that and us, so an unverified Google email never links.
    """
    result = await db.execute(select(User).where(User.google_sub == identity.sub))
    user = result.scalar_one_or_none()
    if user is not None:
        return user

    result = await db.execute(select(User).where(User.email == identity.email))
    existing = result.scalar_one_or_none()
    if existing is not None:
        if not identity.email_verified:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "code": "google_email_unverified",
                    "message": "Google has not verified this address. Sign in with your password instead.",
                },
            )
        existing.google_sub = identity.sub
        existing.email_verified = True
        await db.commit()
        return existing

    # New account. password_hash stays NULL — this user has no password and
    # is not meant to. email_verified mirrors Google rather than assuming
    # True, so we never claim a verification that did not happen.
    user = User(
        email=identity.email,
        password_hash=None,
        google_sub=identity.sub,
        email_verified=identity.email_verified,
    )
    db.add(user)
    await db.flush()
    # Without this row GET /settings answers 404 for the new user.
    db.add(UserSettings(user_id=user.id))
    await db.commit()
    await db.refresh(user)
    return user


@router.post("/google/callback", response_model=TokenResponse)
@limiter.limit(settings.rate_limit_login)
async def google_callback(
    request: Request,
    body: GoogleCallbackRequest,
    db: AsyncSession = Depends(get_db),
) -> TokenResponse:
    if not google_oauth.is_enabled():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Google sign-in is not configured.",
        )

    redirect_uri = f"{settings.frontend_url}/auth/google/callback"
    try:
        raw_id_token = await google_oauth.exchange_code(
            body.code, body.code_verifier, redirect_uri
        )
        # verify_id_token may fetch Google's JWKS over the network, which is
        # a blocking call — keep it off the event loop.
        identity = await run_in_threadpool(
            google_oauth.verify_id_token, raw_id_token, body.nonce
        )
    except google_oauth.GoogleAuthError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc))

    user = await _google_user(identity, db)
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account disabled")

    refresh_raw = _make_refresh_token(user.id)
    db.add(RefreshToken(
        user_id=user.id,
        token_hash=_token_hash(refresh_raw),
        expires_at=datetime.now(timezone.utc) + timedelta(days=settings.refresh_token_expire_days),
    ))
    await db.commit()

    return TokenResponse(
        access_token=_make_access_token(user.id),
        refresh_token=refresh_raw,
    )


@router.post("/refresh", response_model=TokenResponse)
async def refresh(body: RefreshRequest, db: AsyncSession = Depends(get_db)) -> TokenResponse:
    exc = HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")

    try:
        payload = jwt.decode(body.refresh_token, settings.secret_key, algorithms=[settings.algorithm])
        if payload.get("type") != "refresh":
            raise exc
        user_id: str = payload["sub"]
    except jwt.InvalidTokenError:
        raise exc

    h = _token_hash(body.refresh_token)
    result = await db.execute(
        select(RefreshToken).where(RefreshToken.token_hash == h, RefreshToken.revoked.is_(False))
    )
    stored = result.scalar_one_or_none()
    if stored is None or stored.expires_at.replace(tzinfo=timezone.utc) < datetime.now(timezone.utc):
        raise exc

    user_result = await db.execute(select(User).where(User.id == user_id))
    user = user_result.scalar_one_or_none()
    if user is None or not user.is_active:
        raise exc

    # Rotate: revoke the used refresh token and issue a fresh one, so a stolen
    # token only survives a single use before the legitimate client's next
    # refresh call invalidates it.
    stored.revoked = True
    new_refresh = _make_refresh_token(user_id)
    db.add(RefreshToken(
        user_id=user_id,
        token_hash=_token_hash(new_refresh),
        expires_at=datetime.now(timezone.utc) + timedelta(days=settings.refresh_token_expire_days),
    ))
    await db.commit()

    return TokenResponse(
        access_token=_make_access_token(user_id),
        refresh_token=new_refresh,
    )


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(
    body: RefreshRequest,
    db: AsyncSession = Depends(get_db),
) -> None:
    h = _token_hash(body.refresh_token)
    result = await db.execute(select(RefreshToken).where(RefreshToken.token_hash == h))
    token = result.scalar_one_or_none()
    if token:
        token.revoked = True
        await db.commit()


@router.get("/me", response_model=UserOut)
async def me(current_user: User = Depends(get_current_user)) -> UserOut:
    return UserOut.model_validate(current_user)


@router.post("/forgot-password", status_code=status.HTTP_204_NO_CONTENT)
@limiter.limit(settings.rate_limit_forgot_password)
async def forgot_password(
    request: Request, body: ForgotPasswordRequest, db: AsyncSession = Depends(get_db)
) -> None:
    # Always 204 regardless of whether the account exists — avoids leaking
    # which emails are registered.
    result = await db.execute(select(User).where(User.email == body.email))
    user = result.scalar_one_or_none()
    if user is not None:
        raw = await _issue_email_token(db, user.id, "reset", timedelta(hours=1))
        await db.commit()
        try:
            link = f"{settings.frontend_url}/reset-password?token={raw}"
            await email_module.send_email(user.email, RESET_PASSWORD_SUBJECT, _reset_password_html(link))
        except Exception:
            log.exception("Failed to send reset email to %s", user.email)


@router.post("/reset-password", status_code=status.HTTP_204_NO_CONTENT)
@limiter.limit(settings.rate_limit_token_check)
async def reset_password(
    request: Request, body: ResetPasswordRequest, db: AsyncSession = Depends(get_db)
) -> None:
    token = await _consume_email_token(db, body.token, "reset")
    if token is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired token")

    result = await db.execute(select(User).where(User.id == token.user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired token")

    user.password_hash = _hash_password(body.new_password)
    # A password reset must invalidate any session an attacker may hold.
    await db.execute(
        update(RefreshToken).where(RefreshToken.user_id == user.id).values(revoked=True)
    )
    await db.commit()


@router.post("/send-verification", status_code=status.HTTP_204_NO_CONTENT)
@limiter.limit(settings.rate_limit_forgot_password)
async def send_verification(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    if current_user.email_verified:
        return
    raw = await _issue_email_token(db, current_user.id, "verify", timedelta(hours=24))
    await db.commit()
    try:
        link = f"{settings.frontend_url}/verify-email?token={raw}"
        await email_module.send_email(current_user.email, VERIFY_EMAIL_SUBJECT, _verify_email_html(link))
    except Exception:
        log.exception("Failed to send verification email to %s", current_user.email)


@router.post("/verify-email", status_code=status.HTTP_204_NO_CONTENT)
@limiter.limit(settings.rate_limit_token_check)
async def verify_email(
    request: Request, body: VerifyEmailRequest, db: AsyncSession = Depends(get_db)
) -> None:
    token = await _consume_email_token(db, body.token, "verify")
    if token is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired token")

    result = await db.execute(select(User).where(User.id == token.user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired token")

    user.email_verified = True
    await db.commit()
