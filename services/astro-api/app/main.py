import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI

# uvicorn configures its own (uvicorn.*) loggers but not the root logger, so
# app.* loggers (e.g. app.email's dev-mode "email not sent, see log" fallback)
# are silently dropped without this.
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s")
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.config import settings
from app.database import Base, engine
from app.models import chart_log, person  # noqa: F401 — ensure tables are registered
from app.rate_limit import limiter
from app.routers.atlas import router as atlas_router
from app.routers.auth import router as auth_router
from app.routers.billing import router as billing_router
from app.routers.charts import router as charts_router
from app.routers.persons import router as persons_router
from app.routers.settings import router as settings_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Dev convenience only; production schema is managed by Alembic migrations.
    if settings.environment != "production":
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
    yield


if settings.sentry_dsn:
    import sentry_sdk

    sentry_sdk.init(
        dsn=settings.sentry_dsn,
        environment=settings.environment,
        traces_sample_rate=0.1,
    )

app = FastAPI(
    title="Zorya Astro API",
    version="0.2.0",
    summary="Astrology web platform — backend with auth and ephemeris engine.",
    lifespan=lifespan,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(settings_router)
app.include_router(charts_router)
app.include_router(persons_router)
app.include_router(billing_router)
app.include_router(atlas_router)


@app.get("/health")
async def healthcheck() -> dict[str, str]:
    return {"status": "ok"}
