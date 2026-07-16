---
status: done
created: 2026-07-15
updated: 2026-07-16
related: "[[ROADMAP]]"
tags: [plan, stage-b]
---

# План Етапу B «Інфраструктура» (для виконавця на молодшій моделі)

> Джерело: планувальник (Fable), 2026-07-15. Виконано: 2026-07-16 (виконавець —
> executor-агент; верифіковано напряму головним потоком після видалення
> plan-execute-verify скіла — planner/executor-агенти більше недоступні в цій
> сесії, тож перевірка diff + реальний прогін команд зроблені без субагента).
>
> **Ключовий факт середовища:** Docker на цій машині НЕ встановлений. Усе, що потребує
> живого Postgres, верифікується через CI (GitHub Actions service containers) — локально
> лише синтаксична валідація конфігів. Не намагайся встановити Docker.
>
> **Архітектурний факт:** усі виклики API з фронтенду — server-side (server actions +
> middleware). Браузер у проді НЕ звертається до бекенда напряму → CORS у проді
> некритичний, кукі first-party на домені фронтенду. Нічого в цій схемі не міняти.

## Прогрес

- [x] 1.1–1.4 Dual-database: asyncpg, конфіг, сумісність моделей
- [x] 2.1–2.3 Атлас на Postgres: pg_trgm міграція + dialect-гілки пошуку
      (SQLite-шлях підтверджено byte-identical до оригіналу)
- [x] 3.1 Переписати import_geonames.py на SQLAlchemy (обидва діалекти) —
      download/parse логіка не змінена; локально імпортовано 34 006 міст
- [x] 4.1–4.2 Postgres-інтеграційні тести + CI job із service container —
      перевірено, що per-test fixture коректно зберігає й повертає
      module-level `dependency_overrides[get_db]` з conftest.py
- [x] 5.1–5.4 Docker-артефакти: Dockerfile, compose, Caddyfile, entrypoint —
      `pip install .` (без `[dev]`) підтверджено НЕ тягне pyswisseph у образ
- [x] 6.1–6.2 Sentry backend (обов'язково) + frontend (опційно, з умовою відкату) —
      6.2 виконано, tsc/build чисті, відкату не знадобилось; обидва файли
      підтверджено no-op на порожньому DSN
- [x] 7.1 Бекап-скрипт + документація відновлення (обидва скрипти +x)
- [x] 8.1 docs/DEPLOY.md — покрокова інструкція ручних дій для користувача
- [x] DoD 1 — pytest локально (SQLite): 85 passed, 2 skipped
- [x] DoD 2 — tsc --noEmit + next build: чисто
- [x] DoD 3 — ci.yml + infra/docker-compose.yml: валідний YAML
- [x] DoD 4 — локальний імпорт атласу новим скриптом: 34 006 міст, live-перевірка
      пошуку `/api/v1/atlas/search?q=Kyiv` через запущений uvicorn — працює
- [ ] DoD 5 — після пушу: CI job backend-postgres зелений (перевіряє користувач або
      наступна сесія через `gh run list`)

## Знахідка поза скоупом (не блокер)

Таблиця `cities` (створена в міграції `955ec162720e`, Етап A) не має btree-індексів
на `country`/`ascii_name`, які раніше створював старий sqlite3-скрипт напряму поза
alembic. Це успадковано з Етапу A, план Етапу B цього не просив і не мав на меті
(PostgreSQL-шлях уже покритий новими pg_trgm gin-індексами з міграції 2.1; SQLite-шлях
працює через FTS5, якому btree-індекс на ascii_name не потрібен). Не виправлено
свідомо — поза межами цього плану.

---

## Частина 1 — Dual-database (SQLite dev / PostgreSQL prod)

**1.1. `services/astro-api/pyproject.toml`** — у `[project].dependencies` додати:
```
"asyncpg>=0.29,<1.0",
"sentry-sdk[fastapi]>=2.0,<3.0",
```
Потім перевстановити: `cd services/astro-api && uv pip install --python .venv/bin/python -e ".[dev]"`.

**1.2. `services/astro-api/app/config.py`** — додати поля (після `database_url`):
```python
sentry_dsn: str = ""
```
`database_url` не чіпати — прод задає `DATABASE_URL=postgresql+asyncpg://...` через env.

**1.3. `services/astro-api/.env.example`** — після рядка DATABASE_URL додати коментар:
```
# Production example: DATABASE_URL=postgresql+asyncpg://zorya:PASSWORD@db:5432/zorya
```
і в кінець секції Core: `SENTRY_DSN=` (порожній = вимкнено).

**1.4. Сумісність моделей — НЕ міняти нічого.** `sqlalchemy.types.JSON`,
`DateTime(timezone=True)`, `String(N)` працюють на обох діалектах.
`stored.expires_at.replace(tzinfo=timezone.utc)` в auth.py коректний для обох
(naive SQLite → додає utc; aware PG → значення не змінюється). Якщо під час роботи
здасться, що щось «треба поправити» в моделях — зупинись і повідом.

## Частина 2 — Атлас на Postgres

**2.1. Нова alembic-міграція** (`down_revision = 'ad058419ca40'`), файл створити ВРУЧНУ
(не autogenerate — extension/індекси poza моделями), ім'я `<rev>_pg_trgm_city_search.py`,
rev згенеруй `python -c "import uuid; print(uuid.uuid4().hex[:12])"`:
```python
def upgrade() -> None:
    if op.get_bind().dialect.name != "postgresql":
        return
    op.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm")
    op.execute("CREATE INDEX IF NOT EXISTS ix_cities_name_trgm ON cities USING gin (name gin_trgm_ops)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_cities_ascii_trgm ON cities USING gin (ascii_name gin_trgm_ops)")

def downgrade() -> None:
    if op.get_bind().dialect.name != "postgresql":
        return
    op.execute("DROP INDEX IF EXISTS ix_cities_ascii_trgm")
    op.execute("DROP INDEX IF EXISTS ix_cities_name_trgm")
```
(Extension не дропати в downgrade — нею можуть користуватись інші.)

**2.2. `services/astro-api/app/routers/atlas.py` — dialect-гілки в `search_cities`:**
Визначення діалекту: `dialect = db.get_bind().dialect.name`.
- `sqlite` → існуючий `_SEARCH_SQL` (FTS5) БЕЗ ЗМІН.
- `postgresql` → новий `_SEARCH_SQL_PG`:
```sql
SELECT c.id, c.name, c.ascii_name, c.country, c.region,
       c.lat, c.lon, c.timezone, c.population
FROM cities c
WHERE c.name ILIKE :prefix OR c.ascii_name ILIKE :prefix
   OR similarity(c.ascii_name, :q) > 0.35
ORDER BY (c.ascii_name ILIKE :prefix) DESC, c.population DESC
LIMIT :limit
```
з параметрами `{"prefix": q_clean + "%", "q": q_clean, "limit": limit * 3}`.
Решта функції (дедуплікація, фільтр country) — спільна, не дублювати.

**2.3. `get_timezone` і `get_city`** — уже діалект-незалежні (звичайний SQL/ORM),
не чіпати.

## Частина 3 — import_geonames.py на SQLAlchemy

**3.1. Переписати `scripts/import_geonames.py`:** download/parse лишити як є; секцію
`import_db` замінити на SQLAlchemy async (працює з обома діалектами):
- `sys.path.insert(0, str(Path(__file__).parent.parent / "services" / "astro-api"))`,
  потім `from app.database import engine` і `from app.config import settings`
  (скрипт запускається з будь-якого cwd, але БД-шлях sqlite відносний — задокументуй
  у docstring, що запускати треба з `services/astro-api` або з DATABASE_URL env).
- Логіка: `DELETE FROM cities`; вставка чанками по 5000 через
  `conn.execute(City.__table__.insert(), rows_dicts)`; на діалекті sqlite додатково
  `DROP TABLE IF EXISTS cities_fts` → `CREATE VIRTUAL TABLE cities_fts ...` → заповнення
  (як у старому коді, через `text()`).
- Обгорнути в `asyncio.run(main())`.
- Перед вставкою: `alembic upgrade head` НЕ викликати зі скрипта; просто перевірити,
  що таблиця cities існує, і, якщо ні, — вийти з повідомленням «run alembic upgrade head first».

Верифікація локально (sqlite): `cd services/astro-api && ./.venv/bin/python ../../scripts/import_geonames.py`
→ має завершитись «Imported 34,00X cities», і `curl` пошук міста після старту uvicorn
(або простіше — існуючі ручні перевірки не потрібні, це покриє інтеграційний тест 4.1
на CI; локально досить успішного імпорту і `pytest`).

## Частина 4 — Postgres-інтеграційні тести + CI

**4.1. Новий `services/astro-api/tests/test_postgres_integration.py`:**
Весь модуль під `pytestmark = pytest.mark.skipif(not os.environ.get("TEST_DATABASE_URL"), reason="no postgres")`.
УВАГА: conftest.py робить module-level `app.dependency_overrides[get_db] = override_db`
(SQLite in-memory) — для цього модуля потрібен ВЛАСНИЙ engine на TEST_DATABASE_URL і
локальний override через fixture, яка на вході підміняє `app.dependency_overrides[get_db]`
на PG-сесію, а на виході ПОВЕРТАЄ попередній override (інакше зламаєш сусідні тести).
Тести:
  a. `test_migrations_apply`: `alembic upgrade head` на TEST_DATABASE_URL
     (через `subprocess.run([...], env={**os.environ, "DATABASE_URL": url})`, check exit 0).
  b. `test_atlas_search_pg`: вставити 3 міста напряму в PG (серед них "Kyiv"),
     викликати `GET /api/v1/atlas/search?q=Kyi` через httpx client з PG-override →
     200, перший результат Kyiv.
  c. `test_auth_roundtrip_pg`: register → login → /me через PG → 200/200/200
     (ловить проблеми naive/aware datetime на PG).
Порядок: міграції — першим тестом (b і c залежать від схеми). Використай
`pytest.mark.order`? НІ — плагіна немає; просто зроби застосування міграцій
session-scoped autouse fixture цього модуля, а не окремим тестом.

**4.2. `.github/workflows/ci.yml`** — додати job:
```yaml
  backend-postgres:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: services/astro-api
    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_USER: zorya
          POSTGRES_PASSWORD: zorya
          POSTGRES_DB: zorya
        ports: ["5432:5432"]
        options: >-
          --health-cmd "pg_isready -U zorya" --health-interval 5s
          --health-timeout 5s --health-retries 10
    env:
      TEST_DATABASE_URL: postgresql+asyncpg://zorya:zorya@localhost:5432/zorya
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: "3.12"
          cache: pip
          cache-dependency-path: services/astro-api/pyproject.toml
      - run: pip install -e ".[dev]"
      - run: python -m pytest tests/test_postgres_integration.py -q
```
Існуючі jobs не чіпати.

## Частина 5 — Docker-артефакти (створити, локально лише синтакс-перевірка)

**5.1. `services/astro-api/Dockerfile`:**
```dockerfile
FROM python:3.12-slim
WORKDIR /app
COPY pyproject.toml README.md ./
COPY app ./app
COPY alembic ./alembic
COPY alembic.ini ./
RUN pip install --no-cache-dir .
ENV SKYFIELD_DIR=/data/skyfield
VOLUME /data
EXPOSE 8000
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh
CMD ["/docker-entrypoint.sh"]
```
УВАГА: `README.md` в services/astro-api може не існувати — перевір; якщо його нема,
прибери з pyproject поле `readme` АБО створи мінімальний README.md у services/astro-api
(другий варіант кращий: 3 рядки про сервіс).

**5.2. `services/astro-api/docker-entrypoint.sh`:**
```sh
#!/bin/sh
set -e
python -m alembic upgrade head
# single worker on purpose: slowapi rate limiter is per-process in-memory
exec python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 1
```

**5.3. `infra/docker-compose.yml`** (нова тека в корені):
```yaml
services:
  db:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_USER: zorya
      POSTGRES_DB: zorya
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:?set in .env}
    volumes: ["pgdata:/var/lib/postgresql/data"]
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U zorya"]
      interval: 5s
      retries: 10
  api:
    build: ../services/astro-api
    restart: unless-stopped
    env_file: .env
    environment:
      DATABASE_URL: postgresql+asyncpg://zorya:${POSTGRES_PASSWORD}@db:5432/zorya
      ENVIRONMENT: production
    volumes: ["apidata:/data"]
    depends_on:
      db:
        condition: service_healthy
  caddy:
    image: caddy:2-alpine
    restart: unless-stopped
    ports: ["80:80", "443:443"]
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - caddydata:/data
    depends_on: [api]
volumes: {pgdata: {}, apidata: {}, caddydata: {}}
```

**5.4. `infra/Caddyfile`:**
```
{$API_DOMAIN:api.localhost} {
    reverse_proxy api:8000
}
```
І `infra/.env.example`: `POSTGRES_PASSWORD=`, `API_DOMAIN=api.example.com`,
`SECRET_KEY=`, `SENTRY_DSN=`, `FRONTEND_URL=https://example.com`,
`API_PUBLIC_URL=https://api.example.com`, `CORS_ORIGINS=["https://example.com"]`,
плюс Stripe/LiqPay ключі (скопіюй імена з services/astro-api/.env.example).

Локальна перевірка (без Docker): docker недоступний, тому:
`./services/astro-api/.venv/bin/python -c "import yaml; yaml.safe_load(open('infra/docker-compose.yml'))"` +
візуальний рев'ю Dockerfile. Реальний build перевірить деплой (див. DEPLOY.md).

## Частина 6 — Sentry

**6.1. Backend (обов'язково).** У `app/main.py`, ДО створення `app`:
```python
if settings.sentry_dsn:
    import sentry_sdk
    sentry_sdk.init(
        dsn=settings.sentry_dsn,
        environment=settings.environment,
        traces_sample_rate=0.1,
    )
```
Порожній DSN (дефолт) = повністю вимкнено, тести не зачеплені.

**6.2. Frontend (опційно — з жорсткою умовою відкату).** Next.js 16 може мати breaking
changes проти твоїх знань (див. apps/frontend/AGENTS.md!). Порядок:
1. Прочитай `apps/frontend/node_modules/next/dist/docs/` розділ про instrumentation.
2. Якщо там підтверджено підтримку `instrumentation-client.ts` / `instrumentation.ts` —
   `npm install @sentry/nextjs`, створи мінімальні файли ініціалізації, gated на
   `process.env.NEXT_PUBLIC_SENTRY_DSN` (порожній = no-op).
3. Запусти `npx tsc --noEmit && npm run build`. Якщо БУДЬ-ЩО впало і фікс не очевидний
   за 2 спроби — ПОВНІСТЮ відкоти крок 6.2 (npm uninstall, видали файли) і зазнач
   у звіті «frontend Sentry deferred»; це не блокер DoD.

## Частина 7 — Бекапи

**7.1. `scripts/backup_db.sh`** (+x, POSIX sh):
```sh
#!/bin/sh
# Daily Postgres backup. Cron on the VPS:
#   0 3 * * * cd /opt/zorya/infra && sh ../scripts/backup_db.sh >> /var/log/zorya-backup.log 2>&1
set -eu
STAMP=$(date +%Y%m%d-%H%M%S)
DIR="${BACKUP_DIR:-./backups}"
mkdir -p "$DIR"
docker compose exec -T db pg_dump -U zorya zorya | gzip > "$DIR/zorya-$STAMP.sql.gz"
# keep last 14
ls -t "$DIR"/zorya-*.sql.gz | tail -n +15 | xargs -r rm
# optional offsite copy: uncomment after `rclone config` on the VPS
# rclone copy "$DIR/zorya-$STAMP.sql.gz" b2:zorya-backups/
echo "backup done: zorya-$STAMP.sql.gz"
```
Відновлення задокументувати в DEPLOY.md: `gunzip -c FILE | docker compose exec -T db psql -U zorya zorya`.

## Частина 8 — docs/DEPLOY.md (ручні дії користувача)

**8.1.** Створити `docs/DEPLOY.md` — покроковий чекліст ЛЮДСЬКИХ дій (виконавець НЕ
робить їх сам, лише пише документ):
1. Домен: перевірити/купити (zorya.app / zorya.com.ua...), A-запис api.DOMAIN → IP VPS.
2. Hetzner VPS (CX22 достатньо): встановити docker + compose plugin, `git clone`,
   `cd infra && cp .env.example .env` → заповнити секрети (`openssl rand -hex 32` для
   SECRET_KEY), `docker compose up -d`.
3. Перший запуск: `docker compose exec api python -m alembic upgrade head` (entrypoint
   робить це сам — пункт лише для перевірки), імпорт атласу:
   `docker compose exec api python - <<'EOF'` … (вкажи точну команду виклику
   import_geonames всередині контейнера АБО простіше: задокументуй копіювання скрипта;
   виконавцю — вибрати робочий варіант і зафіксувати його в DEPLOY.md).
4. Vercel: імпорт репо, Root Directory = `apps/frontend`, env `API_URL=https://api.DOMAIN`,
   `NODE_ENV=production` (автоматично). Домен фронтенду → DOMAIN.
5. Stripe Dashboard: webhook endpoint `https://api.DOMAIN/api/v1/billing/stripe/webhook`,
   події: checkout.session.completed, customer.subscription.*, invoice.payment_succeeded;
   secret → STRIPE_WEBHOOK_SECRET. LiqPay: server_url вже формується з API_PUBLIC_URL.
6. Sentry: створити 2 проєкти (fastapi, nextjs), DSN → env.
7. Uptime: UptimeRobot на `https://api.DOMAIN/health` + головну сторінку.
8. Бекапи: cron-рядок із scripts/backup_db.sh + разова перевірка відновлення.

## Ризики
1. conftest.py має module-level override get_db — PG-тести МУСЯТЬ акуратно
   підміняти/повертати його (4.1), інакше флейки в усій сьюті.
2. `similarity()` без extension впаде — тому PG-гілка пошуку працює лише після
   міграції 2.1 (на SQLite гілка не виконується взагалі).
3. Dockerfile COPY README.md — перевірити існування (5.1).
4. Rate limiter — in-memory: у compose СВІДОМО 1 worker (коментар в entrypoint).
5. Frontend Sentry — Next 16 невідомої сумісності: правило відкату в 6.2 обов'язкове.
6. import_geonames тепер залежить від app.* — запускати з services/astro-api cwd
   або з явним DATABASE_URL (задокументувати в docstring скрипта).

## Не робити (поза скоупом)
- Не купувати/не реєструвати нічого (домен, акаунти) — тільки документація.
- Не чіпати app/ephemeris/* і математику карт.
- Не додавати Redis (rate limit лишається per-process, 1 worker).
- Не переписувати тести існуючої сьюти (лише додати нові PG-тести + conftest не ламати).
- Не робити Kubernetes/Terraform/CD-пайплайн — лише compose + docs.

## Definition of Done
1. `cd services/astro-api && ./.venv/bin/python -m pytest -q` — 0 failed
   (PG-тести локально skipped — це очікувано, немає TEST_DATABASE_URL).
2. `cd apps/frontend && npx tsc --noEmit && npm run build` — чисто.
3. `./services/astro-api/.venv/bin/python -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml')); yaml.safe_load(open('infra/docker-compose.yml')); print('YAML OK')"` — OK.
4. Локальний імпорт атласу на SQLite новим скриптом завершується успішно
   (перевіряє, що рефакторинг 3.1 не зламав dev-флоу).
5. Після коміту й пушу: job `backend-postgres` у GitHub Actions зелений —
   перевірити `gh run watch` або повідомити користувачу перевірити.
