# Deploy checklist (manual steps)

This is a checklist of **human actions** required to take Zorya to production.
The executor agent does not perform any of these — nothing here has been
bought, registered, or run against a live VPS/Vercel/Stripe/Sentry account.

## 1. Domain

- Check availability / buy a domain (e.g. `zorya.app`, `zorya.com.ua`, ...).
- Create an A record: `api.DOMAIN` → the VPS's public IP.

## 2. Hetzner VPS (CX22 is enough)

1. Provision a VPS, install Docker Engine + the Compose plugin.
2. `git clone` this repository onto the VPS.
3. `cd infra && cp .env.example .env`, then fill in the secrets:
   - `POSTGRES_PASSWORD` — any strong random password.
   - `SECRET_KEY` — generate with `openssl rand -hex 32`.
   - `API_DOMAIN`, `FRONTEND_URL`, `API_PUBLIC_URL`, `CORS_ORIGINS` — set to
     the real domain(s) from step 1 / step 4.
   - `SENTRY_DSN`, Stripe and monopay keys — from steps 5–6 below (can be left
     empty initially and filled in later; empty `SENTRY_DSN` disables Sentry).
4. `docker compose up -d` (from `infra/`).

## 3. First run

- The container entrypoint (`services/astro-api/docker-entrypoint.sh`) runs
  `python -m alembic upgrade head` automatically on every start — this step is
  just for verification:
  ```sh
  docker compose exec api python -m alembic current
  ```
- Import the city/timezone atlas. The simplest working option is to run the
  import script inside the running `api` container, since `scripts/` is not
  copied into the image by the Dockerfile — copy it in first:
  ```sh
  docker compose cp ../scripts/import_geonames.py api:/app/import_geonames.py
  docker compose exec api python /app/import_geonames.py
  ```
  (This downloads `cities15000.zip` from GeoNames inside the container and
  populates the `cities` table via SQLAlchemy against `DATABASE_URL`, which in
  this compose setup is already the Postgres `postgresql+asyncpg://...` URL —
  see `infra/docker-compose.yml`.)

## 4. Vercel (frontend)

- Import the repo into Vercel.
- Root Directory: `apps/frontend`.
- Env vars: `API_URL=https://api.DOMAIN`. `NODE_ENV=production` is set
  automatically by Vercel.
- Optionally set `NEXT_PUBLIC_SENTRY_DSN` (step 6) to enable frontend Sentry —
  leaving it unset keeps Sentry fully disabled (no-op).
- Point the frontend's custom domain at `DOMAIN` (the apex/root domain from
  step 1).

## 5. Stripe

- In the Stripe Dashboard, create a webhook endpoint:
  `https://api.DOMAIN/api/v1/billing/stripe/webhook`
- Subscribe to events: `checkout.session.completed`,
  `customer.subscription.*`, `invoice.payment_succeeded`.
- Copy the signing secret into `STRIPE_WEBHOOK_SECRET` in `infra/.env`.
- monopay (monobank acquiring): no dashboard webhook config needed —
  `webHookUrl` is built server-side per-invoice from `API_PUBLIC_URL`, which
  **must be a real, publicly reachable HTTPS URL** for monobank's servers to
  deliver the callback (a localhost URL silently never fires — use `/monopay/sync`
  as the redirect-time fallback, but the webhook is still needed for renewals
  the user doesn't watch happen). Get a live merchant token from the
  monobank acquiring dashboard and set `MONOPAY_TOKEN` in `infra/.env`. The
  webhook's signing public key is fetched automatically from
  `GET /api/merchant/pubkey` — nothing to configure by hand.

## 6. Sentry

- Create two Sentry projects: one `fastapi` (backend), one `nextjs`
  (frontend).
- Backend DSN → `SENTRY_DSN` in `infra/.env` (consumed by
  `services/astro-api/app/config.py`).
- Frontend DSN → `NEXT_PUBLIC_SENTRY_DSN` in the Vercel project's env vars
  (consumed by `apps/frontend/instrumentation.ts` and
  `apps/frontend/instrumentation-client.ts`).

## 7. Uptime monitoring

- Add UptimeRobot (or equivalent) monitors for:
  - `https://api.DOMAIN/health`
  - the frontend's main page (`https://DOMAIN`)

## 8. Backups

- Cron entry on the VPS (see header comment in `scripts/backup_db.sh`):
  ```
  0 3 * * * cd /opt/zorya/infra && sh ../scripts/backup_db.sh >> /var/log/zorya-backup.log 2>&1
  ```
- Do one manual restore rehearsal after the first backup exists:
  ```sh
  gunzip -c FILE | docker compose exec -T db psql -U zorya zorya
  ```
