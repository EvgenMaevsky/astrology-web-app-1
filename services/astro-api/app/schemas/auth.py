from pydantic import BaseModel, EmailStr, Field


class RegisterRequest(BaseModel):
    email: EmailStr
    # bcrypt silently truncates at 72 bytes — capping here avoids the false
    # sense of entropy a longer password would otherwise imply.
    password: str = Field(min_length=8, max_length=72)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshRequest(BaseModel):
    refresh_token: str


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str = Field(min_length=8, max_length=72)


class VerifyEmailRequest(BaseModel):
    token: str


class GoogleConfigOut(BaseModel):
    """Public: lets the frontend decide whether to render the button."""

    enabled: bool
    # Not a secret — it travels to Google in the browser's address bar.
    client_id: str


class GoogleCallbackRequest(BaseModel):
    code: str
    code_verifier: str
    nonce: str
    # redirect_uri is deliberately NOT accepted from the client — the server
    # derives it from frontend_url, so a caller cannot influence which URI
    # the code is redeemed against.


class UserOut(BaseModel):
    id: str
    email: str
    plan: str
    email_verified: bool
    is_admin: bool
    # Google-only accounts have no password, so the UI must not ask for one
    # when deleting the account or offer to change it.
    has_password: bool

    model_config = {"from_attributes": True}
