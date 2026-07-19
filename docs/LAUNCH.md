# Launch checklist (manual steps)

Everything here is a **human action** the owner needs to take before Zorya
is live for real users. Nothing here has been done by the executor agent —
no domain bought, no live keys generated, no beta invites sent. See
[DEPLOY.md](DEPLOY.md) for the technical deploy steps this checklist assumes
are already done (or does alongside).

## 1. Domain

- Check availability / buy a domain (ROADMAP blocker #3 — `zorya.app`,
  `zorya.com.ua`, or similar were proposed but never verified against a
  registrar or trademark search).

## 2. Deploy

- Follow [DEPLOY.md](DEPLOY.md) start to finish: Hetzner VPS + Docker Compose
  for the backend, Vercel for the frontend, DNS pointed at both.

## 3. Stripe — go live

- Switch from test-mode to live-mode keys in the Stripe Dashboard.
- Create a **live** webhook endpoint in the Stripe Dashboard (not via
  `stripe listen` — that was only for local test-mode verification):
  `https://api.DOMAIN/api/v1/billing/stripe/webhook`, subscribed to
  `checkout.session.completed`, `customer.subscription.*`,
  `invoice.payment_succeeded`.
- Copy the live `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and the live
  Price ID for `STRIPE_PRICE_PRO_MONTHLY` into `infra/.env`.

## 4. monopay (monobank acquiring) — go live

See [docs/plans/2026-07-18-monopay-migration.md](plans/2026-07-18-monopay-migration.md)
for the full integration writeup.

- Get a **live** (not test) merchant token from the monobank acquiring
  dashboard and set `MONOPAY_TOKEN` in `infra/.env`.
- Confirm `API_PUBLIC_URL` in `infra/.env` is the real, publicly reachable
  HTTPS backend URL — monobank's webhook delivery silently fails against
  `localhost` or an unreachable host, with no error surfaced anywhere.
- No dashboard webhook config needed (unlike Stripe) — the callback URL is
  built server-side per-invoice.
- **Known gap:** the full pay → webhook → upgrade cycle was verified with
  Stripe's public test card (`4242...`) but NOT with a real monobank
  payment — the monobank payment page has no documented test-card path.
  Do at least one real (small) live payment after going live and confirm
  the plan actually upgrades and the payment row lands in the `payments`
  table before announcing the monobank option publicly.

## 5. Sentry

- Create two Sentry projects: `fastapi` (backend), `nextjs` (frontend).
- Backend DSN → `SENTRY_DSN` in `infra/.env`.
- Frontend DSN → `NEXT_PUBLIC_SENTRY_DSN` in Vercel's project env vars.

## 6. Plausible Analytics

- Add the site in the [Plausible dashboard](https://plausible.io).
- Set `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` in Vercel's project env vars to the
  registered domain. No cookie banner needed — Plausible is cookie-less.

## 7. Uptime monitoring

- Add UptimeRobot (or equivalent) monitors for `https://api.DOMAIN/health`
  and the frontend's main page.

## 8. Feedback channel

- Set `NEXT_PUBLIC_FEEDBACK_EMAIL` in Vercel's project env vars to an inbox
  someone actually reads — a "Feedback" link appears in the dashboard
  sidebar once this is set.

## 9. Legal review

- `/privacy` and `/terms` are both marked as drafts in the page content
  ("ЧЕРНЕТКА — не юридична консультація") and were written by the executor
  agent, not a lawyer. Have the owner (and ideally a lawyer, given this
  handles payment data and birth data of natal-chart users) read and sign
  off on both before any public launch.

## 10. Closed beta

- Invite 10–20 beta users — prioritize practicing astrologers over general
  users. They're the ones who will actually notice a calculation
  discrepancy against ZET9/astro.com, and accuracy is the product's core
  value proposition, not a nice-to-have.
- Watch Sentry + the uptime monitors closely during the beta window before
  opening up publicly.

## 11. Public launch

- Once the beta surfaces no blocking issues, remove any remaining
  "invite-only" gates and announce.
