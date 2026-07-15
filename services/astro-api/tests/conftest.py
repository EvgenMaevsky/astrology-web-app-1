"""
Shared pytest fixtures for the whole test suite.

RATE_LIMIT_ENABLED must be set before app.config.settings is instantiated
(first import of any app.* module), otherwise register/login rate limits
(3/min, 5/min) make multi-request test modules flaky.
"""
import os

os.environ["RATE_LIMIT_ENABLED"] = "false"

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.database import Base, get_db
from app.main import app

TEST_DB = "sqlite+aiosqlite:///:memory:"
test_engine = create_async_engine(TEST_DB)
TestSession = async_sessionmaker(test_engine, expire_on_commit=False)


@pytest.fixture(autouse=True)
async def setup_db():
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


async def override_db() -> AsyncSession:
    async with TestSession() as session:
        yield session


app.dependency_overrides[get_db] = override_db


@pytest.fixture
async def client():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c
