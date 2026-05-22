# ZET Geo Web

Web rewrite of ZET9 Geo astrology desktop app.  
Stack: Next.js 16 + FastAPI + SQLite (dev) / PostgreSQL (prod).

## Quick start

### Backend (terminal 1)
```powershell
cd services/astro-api
python -m uvicorn app.main:app --reload --port 8000
```

### Frontend (terminal 2)
```powershell
cd apps/frontend
npm run dev
```

Open http://localhost:3000 — redirects to /login.

## Phases
- [x] **Phase 1** — JWT Auth: register/login/refresh/logout, dashboard shell
- [ ] **Phase 2** — Ephemeris engine (pyswisseph + real natal chart)
- [ ] **Phase 3** — SVG chart wheel
- [ ] **Phase 4** — Atlas (50k cities) + timezone lookup
- [ ] **Phase 5** — Reports & interpretations (.dgr/.prs migration)
- [ ] **Phase 6** — Monetization (Stripe + LiqPay)
