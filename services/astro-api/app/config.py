from pydantic import SecretStr, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

_DEV_SECRET = "dev-secret-change-in-production-please"


class Settings(BaseSettings):
    """Application configuration.

    Credentials are declared as SecretStr so they never appear in a repr.
    This is not decoration: pytest prints the whole Settings object in an
    assertion failure, so before this a single failing test dumped the live
    Stripe key and monopay token straight into the output — and into CI logs
    with it. SecretStr renders as ``**********`` and the real value is only
    reachable through .get_secret_value().
    """

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    environment: str = "development"  # development | production

    database_url: str = "sqlite+aiosqlite:///./astro.db"
    sentry_dsn: str = ""
    secret_key: SecretStr = SecretStr(_DEV_SECRET)
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
    # Chart calculation is CPU-heavy (Skyfield ephemeris + house/aspect
    # math); the daily free-tier limit (chart_log-based) doesn't bound
    # request RATE, only same-day count, and only applies to free-plan
    # natal charts — nothing else throttled how fast an authenticated user
    # (any plan) could fire calculation requests.
    rate_limit_chart_calc: str = "20/minute"
    # The public (unauthenticated) natal endpoint. Abuse protection, not a
    # product tier: the daily count is unlimited on every plan, and this only
    # bounds how fast one address can fire requests. It relies on uvicorn
    # seeing the real client address (see docker-entrypoint.sh).
    rate_limit_chart_public: str = "20/minute"

    # Resend (https://resend.com) — empty key = dev mode, emails are logged not sent
    resend_api_key: SecretStr = SecretStr("")
    email_from: str = "Astrodite <noreply@example.com>"
    # Where replies to transactional email go. Empty = no Reply-To header, in
    # which case replies land on the unroutable sending subdomain and vanish.
    email_reply_to: str = ""

    # Saved charts: a free-plan ceiling, unlimited on Pro. Existing accounts
    # already over the limit keep every chart they have — the limit only
    # applies to saving a new one.
    max_saved_charts_free: int = 5

    # In-process cache of raw natal calculations. 0 disables it. Bounded on
    # purpose — an unbounded cache is a memory leak with a friendly name.
    chart_cache_size: int = 512

    # Where admin-uploaded site images (favicon, OG card) are stored. Must be
    # on a persistent volume — rebuilding the image would otherwise wipe them.
    uploads_dir: str = "./uploads"

    # Directory for JPL ephemeris files (de440s.bsp auto-downloads there, ~32 MB).
    skyfield_dir: str = "./skyfield-data"
    # Optional SPK file with 2060 Chiron from JPL Horizons (see scripts/fetch_chiron_spk.py).
    chiron_spk: str = ""

    # Stripe
    stripe_secret_key: SecretStr = SecretStr("")
    stripe_webhook_secret: SecretStr = SecretStr("")
    stripe_price_pro_monthly: str = ""
    # Recurring $99/year price of the same Pro product. Empty = yearly card
    # payment is not offered (monopay yearly still works).
    stripe_price_pro_yearly: str = ""
    stripe_price_expert_monthly: str = ""

    # monopay (monobank acquiring, https://api.monobank.ua) — empty token =
    # monopay disabled, checkout returns 503 (same pattern as Stripe)
    monopay_token: SecretStr = SecretStr("")

    # Google Sign-In (https://console.cloud.google.com). Empty = disabled:
    # the button is not shown and the endpoints return 503, so local
    # development needs no credentials.
    google_client_id: str = ""
    google_client_secret: SecretStr = SecretStr("")

    @model_validator(mode="after")
    def _no_dev_secret_in_production(self) -> "Settings":
        if self.environment == "production" and self.secret_key.get_secret_value() == _DEV_SECRET:
            raise ValueError(
                "SECRET_KEY is still the dev default. "
                "Generate one with: openssl rand -hex 32"
            )
        return self


settings = Settings()
