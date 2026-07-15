# План Етапу A "Стабілізація" (згенеровано planner/Fable, 2026-07-15)

> Статус: ЗАТВЕРДЖЕНИЙ ПЛАН, ще не виконаний.
> Виконавцю: слідувати дослівно, кроки по порядку. Definition of Done — внизу.

## Передумови (0)

**0.1. Закомітити untracked-міграцію.**
Файл `services/astro-api/alembic/versions/955ec162720e_initial_schema.py` зараз НЕ в git.
Без нього CI і перевірка міграцій на чистому checkout не працюють. Додати в коміт.

## Частина 1 — CI (GitHub Actions)

**1.1. Створити `.github/workflows/ci.yml`** (директорії `.github/` немає). Зміст:

```yaml
name: CI
on:
  push:
    branches: [main]
  pull_request:
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  backend:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: services/astro-api
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: "3.12"
          cache: pip
          cache-dependency-path: services/astro-api/pyproject.toml
      - name: Cache Skyfield ephemeris (de440s.bsp ~32 MB)
        uses: actions/cache@v4
        with:
          path: services/astro-api/skyfield-data
          key: skyfield-de440s-v1        # статичний ключ: файл незмінний
      - run: pip install -e ".[dev]"     # dev extras містять pyswisseph (оракул) + pytest
      - run: python -m pytest

  frontend:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: apps/frontend
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "22"             # Next.js 16 вимагає Node >= 20.9
          cache: npm
          cache-dependency-path: apps/frontend/package-lock.json
      - run: npm ci
      - run: npx tsc --noEmit
      - run: npm run build
```

Ризики: (а) перший запуск (cache miss) залежить від сервера NAIF — разова флейкість;
(б) push у feature-гілки без PR не тригерить CI (свідомий компроміс).

## Частина 2 — Білінг (`services/astro-api`)

**2.1. `app/config.py` — нові поля Settings** (після блоку LiqPay):
- `api_public_url: str = "http://localhost:8000"`
- `rate_limit_enabled: bool = True`
- `rate_limit_login: str = "5/minute"`
- `rate_limit_register: str = "3/minute"`

**2.2. `.env.example`** — додати:
```
API_PUBLIC_URL=http://localhost:8000
RATE_LIMIT_ENABLED=true
RATE_LIMIT_LOGIN=5/minute
RATE_LIMIT_REGISTER=3/minute
```

**2.3. `app/models/user.py`:**
- У `User` додати `stripe_customer_id: Mapped[str | None] = mapped_column(String(256), nullable=True, index=True)`.
- Додати модель `Payment` (таблиця `payments`): `id` (String(36), pk, default=_uuid),
  `user_id` (String(36), FK users.id, index), `amount_cents` (Integer, nullable=False),
  `currency` (String(8), nullable=False), `provider` (String(16), nullable=False — "stripe"|"liqpay"),
  `provider_payment_id` (String(256), nullable=True, index), `status` (String(32), nullable=False),
  `created_at` (DateTime(timezone=True), default=_now). Relationship `payments` на User
  з `cascade="all, delete-orphan"` (за зразком `subscriptions`).

**2.4. `app/models/__init__.py`** — додати `Payment` в імпорт і `__all__`.

**2.5. Нова alembic-міграція** (`down_revision = '955ec162720e'`):
`./.venv/bin/python -m alembic revision --autogenerate -m "stripe_customer_id + payments"`
— генерувати проти ЧИСТОЇ тимчасової БД (env var DATABASE_URL), не проти робочої astro.db.
Перевірити вручну: batch_alter_table users + create_table payments + індекси + downgrade.

**2.6. `app/routers/billing.py` — Stripe checkout:**
- Додати `subscription_data={"metadata": {"user_id": current_user.id, "plan": body.plan}}`
  до `stripe.checkout.Session.create(...)` (session-level `metadata=` лишити — його читає
  `checkout.session.completed`).
- Якщо `current_user.stripe_customer_id` заповнений — передавати `customer=...` замість
  `customer_email` (уникає дублів customer'ів).

**2.7. Webhook exception (рядок ~175):**
`except (ValueError, stripe.SignatureVerificationError):` → HTTPException(400).
(Перевірено: stripe==15.3.0 у venv, `stripe.errors` НЕ існує; `construct_event` кидає
ValueError на битому payload.)

**2.8. `_handle_stripe_event` переписати:**
- **`checkout.session.completed`** (нова гілка): meta = data.get("metadata") or {};
  user_id, plan; customer_id = data.get("customer"); sub_id = data.get("subscription").
  Якщо user_id: update(User).values(plan=plan, stripe_customer_id=customer_id);
  створити Subscription(user_id, plan, status="active", stripe_sub_id=sub_id), якщо з таким
  stripe_sub_id ще нема. Commit.
- **`customer.subscription.created|updated`**: як зараз (metadata тепер приходить завдяки 2.6);
  додатково upsert Subscription по stripe_sub_id (status з data["status"], period_start/end
  з current_period_start/end через datetime.fromtimestamp(..., tz=utc), обидва через .get() —
  у нових версіях Stripe API поля переїхали).
- **`customer.subscription.deleted`**: як зараз + фолбек: якщо metadata без user_id — знайти
  користувача по data.get("customer") через User.stripe_customer_id; виставити відповідній
  Subscription status="canceled".
- **`invoice.payment_succeeded`** (нова гілка): користувач по data.get("customer") →
  User.stripe_customer_id; якщо знайдено і Payment з provider_payment_id == data["id"] ще
  нема (ідемпотентність — Stripe ретраїть) — створити Payment(user_id,
  amount_cents=data.get("amount_paid", 0), currency=data.get("currency", "usd"),
  provider="stripe", provider_payment_id=data["id"], status="succeeded").
  Якщо користувача не знайдено — log.warning.
- Імпорти (select, update, моделі) підняти на рівень модуля.

**2.9. `stripe_portal`:**
Спершу customer_id = current_user.stripe_customer_id; якщо порожньо — існуючий фолбек
stripe.Customer.list(email=...), при знаходженні зберегти id у current_user.stripe_customer_id
(додати db: AsyncSession = Depends(get_db) + commit). 404 якщо ніде не знайдено.

**2.10. LiqPay server_url:**
`"server_url": f"{settings.api_public_url}/api/v1/billing/liqpay/callback"`.

**2.11. LiqPay callback:**
- Успіх (subscribed, success): як зараз + Subscription(user_id, plan, status="active",
  liqpay_order_id=payload.get("order_id")) якщо активної з цим order_id нема +
  Payment(user_id, amount_cents=int(round(float(payload.get("amount", 0)) * 100)),
  currency=payload.get("currency", "UAH"), provider="liqpay",
  provider_payment_id=str(payload.get("payment_id") or "") or None, status=pay_status)
  з перевіркою ідемпотентності по provider_payment_id.
- Нова гілка: pay_status in ("unsubscribed", "failure", "error") and user_id →
  update(User).values(plan="free") + status="canceled" останній Subscription юзера
  з liqpay_order_id (якщо є). Commit + log.
- Проміжні статуси (wait_accept тощо) свідомо ігноруються.

**2.12. Дедуплікація require_plan:**
Видалити require_plan з `app/dependencies/auth.py` (ніхто не імпортує — перевірено).
Єдина версія — в `app/dependencies/billing.py` (з detail.code="plan_required").

**2.13. `app/routers/charts.py` — plan gates:**
- `from app.dependencies.billing import require_plan`.
- У transit_chart, solar_return_chart, synastry_chart: `Depends(require_plan("pro", "expert"))`
  замість get_current_user; ПРИБРАТИ `await _check_free_limit(...)` з цих трьох.
  ChartLog-логування лишити. natal_chart НЕ чіпати.

**2.14. `apps/frontend/app/actions/charts-extended.ts`:**
handlePlanLimit: приймати code === "plan_limit" || code === "plan_required";
required може бути string | string[] — нормалізувати
(Array.isArray(required) ? required[0] ?? "pro" : required ?? "pro").
Стан лишається { status: "plan_limit", ... } — форми/типи не змінювати. charts.ts не чіпати.

## Частина 3 — Auth

**3.1. `pyproject.toml`** — dependencies += `"slowapi>=0.1.9,<1.0"`. Перевстановити deps.

**3.2. Новий `app/rate_limit.py`:**
```python
from slowapi import Limiter
from slowapi.util import get_remote_address
from app.config import settings

limiter = Limiter(key_func=get_remote_address, enabled=settings.rate_limit_enabled)
```

**3.3. `app/main.py`:**
```python
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from app.rate_limit import limiter

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
```

**3.4. `app/routers/auth.py` — rate limiting:**
- register: `@limiter.limit(settings.rate_limit_register)`; login: `@limiter.limit(settings.rate_limit_login)`
  (декоратор ПІД @router.post).
- ОБОВ'ЯЗКОВО додати `request: Request` у сигнатури обох ендпоінтів (slowapi вимагає) —
  імпорт Request з fastapi.
- Коментар: in-memory limiter — per-process; redis backend для multi-worker — поза скоупом.

**3.5. `app/routers/auth.py` — ротація refresh:**
Після успішної валідації у refresh: 1) stored.revoked = True; 2) new_refresh =
_make_refresh_token(user_id) + db.add(RefreshToken(...)); 3) commit; 4) повернути
TokenResponse(access_token=..., refresh_token=new_refresh). response_model=TokenResponse.
Видалити AccessTokenResponse зі schemas/auth.py і його імпорт (єдиний споживач).

**3.6. `apps/frontend/proxy.ts`:**
tryRefresh: читати з відповіді і refresh_token; після set access_token додати
response.cookies.set("refresh_token", ..., {httpOnly, secure: prod, sameSite: "lax",
maxAge: 30*24*60*60, path: "/"}). Якщо refresh_token відсутній у відповіді — return null.
Коментар про гонку паралельних refresh (другий отримає 401 → /login; прийнятно).

## Частина 4 — Тести (backend)

**4.1. Новий `tests/conftest.py`:**
- ПЕРШИМ рядком (до імпортів app.*): `os.environ["RATE_LIMIT_ENABLED"] = "false"`.
- Перенести з test_auth.py: test_engine, TestSession, autouse setup_db, override_db,
  dependency_overrides, фікстуру client. З test_auth.py перенесене видалити.

**4.2. test_auth.py — test_refresh_rotation:**
register → /refresh (старий) → 200 + обидва токени, новий != старий → /refresh зі СТАРИМ →
401 → /refresh з НОВИМ → 200.

**4.3. Новий tests/test_billing.py:**
- Фікстура: settings.stripe_webhook_secret = "whsec_test", settings.liqpay_private_key =
  "test_private" (з відновленням після тесту!).
- Stripe-підпис: t = int(time.time()); sig = hmac.new(secret, f"{t}.{payload}", sha256).hexdigest();
  header = f"t={t},v1={sig}".
- LiqPay: data = b64(json), signature = b64(sha1(priv + data + priv)).
- Тести: a) checkout.session.completed → plan="pro", stripe_customer_id, Subscription створено;
  b) невалідний підпис → 400; підписаний не-JSON → 400; c) invoice.payment_succeeded →
  Payment створено; повторна доставка → Payment один (ідемпотентність);
  d) parametrize("unsubscribed","failure","error"): pro-юзер → free;
  e) LiqPay success → upgrade + Payment(provider="liqpay").

**4.4. Тест plan gate:**
free-юзер → POST /api/v1/charts/transit (валідне тіло за TransitRequest) → 403,
detail.code == "plan_required". Опційно: UPDATE до pro → 200.

## Ризики (зведення)
1. slowapi без `request: Request` у сигнатурі падає в рантаймі.
2. Stripe current_period_* — через .get(), толерувати None.
3. Гонка паралельних refresh — задокументувати коментарем.
4. Alembic autogenerate — тільки проти чистої БД.
5. CI: перше завантаження de440s.bsp може флейкнути; далі кеш.
6. Мутація settings у тестах — обов'язково відновлювати.

## Не робити (поза скоупом)
- Не чіпати app/ephemeris/* (Skyfield-рушій).
- Не міняти ExtendedChartState/форми фронтенду.
- Без redis для rate limit, без grace-window для refresh, без annual-прайсингу.

## Definition of Done
1. `cd services/astro-api && ./.venv/bin/python -m pytest` — 0 failed (було 73, стане більше),
   включно з новими тестами webhook/downgrade/plan-gate/rotation.
2. `cd apps/frontend && npx tsc --noEmit` — чисто.
3. `cd services/astro-api && DATABASE_URL="sqlite+aiosqlite:///./_mig_check.db" ./.venv/bin/python -m alembic upgrade head && rm -f _mig_check.db`
   — exit 0; у схемі users.stripe_customer_id і таблиця payments.
4. `.github/workflows/ci.yml` — валідний YAML; міграція 955ec162720e закомічена.

## Прийняті дефолти (QUESTIONS планера)
1. ChartLog для pro/expert на transit/SR/synastry — лишаємо (використовує /charts/usage).
2. CI: push лише main + усі PR.
3. stripe_checkout з існуючим stripe_customer_id → customer= замість customer_email.
