#!/bin/sh
set -e
python -m alembic upgrade head
# single worker on purpose: slowapi rate limiter is per-process in-memory
exec python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 1
