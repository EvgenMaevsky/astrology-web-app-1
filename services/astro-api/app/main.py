from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import Base, engine
from app.routers.atlas import router as atlas_router
from app.routers.auth import router as auth_router
from app.routers.charts import router as charts_router
from app.routers.persons import router as persons_router
from app.routers.settings import router as settings_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield


app = FastAPI(
    title="ZET Geo Astro API",
    version="0.2.0",
    summary="Astrology web platform — backend with auth and ephemeris engine.",
    lifespan=lifespan,
)

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
app.include_router(atlas_router)


@app.get("/health")
async def healthcheck() -> dict[str, str]:
    return {"status": "ok"}
