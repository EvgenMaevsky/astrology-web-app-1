from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

_DEV_SECRET = "dev-secret-change-in-production-please"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    environment: str = "development"  # development | production

    database_url: str = "sqlite+aiosqlite:///./astro.db"
    sentry_dsn: str = ""
    secret_key: str = _DEV_SECRET
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 30

    cors_origins: list[str] = ["http://localhost:3000", "http://127.0.0.1:3000"]
    frontend_url: str = "http://localhost:3000"
    api_public_url: str = "http://localhost:8000"

    rate_limit_enabled: bool = True
    rate_limit_login: str = "5/minute"
    rate_limit_register: str = "3/minute"
    rate_limit_forgot_password: str = "3/minute"
    rate_limit_token_check: str = "10/minute"

    # Resend (https://resend.com) — empty key = dev mode, emails are logged not sent
    resend_api_key: str = ""
    email_from: str = "Zorya <noreply@example.com>"

    max_saved_charts: int = 50

    # Directory for JPL ephemeris files (de440s.bsp auto-downloads there, ~32 MB).
    skyfield_dir: str = "./skyfield-data"
    # Optional SPK file with 2060 Chiron from JPL Horizons (see scripts/fetch_chiron_spk.py).
    chiron_spk: str = ""

    # Stripe
    stripe_secret_key: str = ""
    stripe_webhook_secret: str = ""
    stripe_price_pro_monthly: str = ""
    stripe_price_expert_monthly: str = ""

    # monopay (monobank acquiring, https://api.monobank.ua) — empty token =
    # monopay disabled, checkout returns 503 (same pattern as Stripe)
    monopay_token: str = ""

    @model_validator(mode="after")
    def _no_dev_secret_in_production(self) -> "Settings":
        if self.environment == "production" and self.secret_key == _DEV_SECRET:
            raise ValueError(
                "SECRET_KEY is still the dev default. "
                "Generate one with: openssl rand -hex 32"
            )
        return self


settings = Settings()
