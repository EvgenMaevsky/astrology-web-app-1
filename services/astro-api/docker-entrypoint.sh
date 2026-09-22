#!/bin/sh
set -e
python -m alembic upgrade head
# single worker on purpose: slowapi rate limiter is per-process in-memory
#
# --proxy-headers makes uvicorn read X-Forwarded-For, which Caddy sets. Without
# it every request arrives as Caddy's own container address, so slowapi keys
# every rate limit on one value — a single shared bucket for the whole
# internet, where five failed logins from anyone lock out everybody.
#
# Trusting that header is only safe because this service publishes no ports:
# nothing can reach it except through Caddy. PUBLISH A PORT ON THIS CONTAINER
# AND THIS BECOMES A HOLE — anyone could then forge X-Forwarded-For and walk
# past every limit.
exec python -m uvicorn app.main:app \
    --host 0.0.0.0 --port 8000 --workers 1 \
    --proxy-headers --forwarded-allow-ips='*'
