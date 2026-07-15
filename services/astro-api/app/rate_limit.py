from slowapi import Limiter
from slowapi.util import get_remote_address

from app.config import settings

# In-memory storage — per-process. Fine for a single-worker deployment;
# switch to a Redis backend before running multiple uvicorn workers.
limiter = Limiter(key_func=get_remote_address, enabled=settings.rate_limit_enabled)
