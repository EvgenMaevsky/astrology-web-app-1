---
status: planned
created: 2026-07-16
updated: 2026-07-16
related: "[[ROADMAP]]"
tags: [plan, stage-c]
---

# План Етапу C «Продуктова готовність» (для виконавця на молодшій моделі)

> Джерело: планувальник (Fable), 2026-07-16. Виконавцю: слідувати дослівно, частини
> по порядку. Кожна частина самодостатня — **комітити дозволено по-частинно**
> (6 комітів краще за один мега-коміт). Definition of Done — внизу. Якщо крок
> неоднозначний або кодова база не відповідає припущенню — ЗУПИНИСЬ і повідом.
>
> **Свідомо винесено за межі цього плану:** локалізація UA/EN (next-intl) — це
> наскрізна зміна кожної сторінки з неперевіреною сумісністю з Next 16; вона буде
> окремим планом C2. Landing і юридичні сторінки в цьому плані пишуться українською
> (цільовий ринок), UI застосунку тимчасово лишається англійським — це прийнятий
> компроміс до C2.
>
> **Факти середовища (перевірені планувальником):**
> - `apps/frontend/app/page.tsx` — зараз жорсткий `redirect("/login")`.
> - `proxy.ts`: `PUBLIC_PATHS = ["/login", "/register"]`, матчинг через `startsWith`;
>   правило `isPublic && hasToken → redirect /dashboard`.
> - ORM-каскади User покривають settings/subscriptions/payments/refresh_tokens.
>   `persons` і `chart_logs` мають лише DB-рівневий `ondelete="CASCADE"`, який
>   **SQLite не форсить** → видалення акаунта потребує явних DELETE.
> - Дашборд-сайдбар — `hidden lg:flex`; що рендериться нижче lg — виконавцю
>   перевірити в браузері (Частина 6).
> - `fetchMe` у `(dashboard)/layout.tsx` типізований як `{email, plan}` — при
>   додаванні `email_verified` оновити і цей тип.
> - Rate-limit декоратори slowapi ВИМАГАЮТЬ параметр `request: Request` у сигнатурі
>   ендпоінта (грабля з Етапу A — не забудь).
> - Тести мокають email через `monkeypatch` — для цього в роутерах імпортувати
>   МОДУЛЬ (`from app import email` … `await email.send_email(...)`), а не функцію.

## Прогрес

- [x] Частина 1 — Email-флоу: forgot/reset password + верифікація email (Resend) —
      dev-режим перевірено наскрізь у браузері (лінк з логу бекенда); знайдено й
      виправлено позаплановий баг: uvicorn не конфігурував root-логер, тож
      dev-режим email (лінк у лозі) мовчки нічого не виводив — додано
      `logging.basicConfig` у main.py; також виправлено server_default для
      email_verified у міграції (без нього падало на непустій БД)
- [ ] Частина 2 — Збереження карт (natal + solar return)
- [ ] Частина 3 — Сторінка /account + видалення акаунта (GDPR)
- [ ] Частина 4 — Landing page + SEO (robots, sitemap, OG)
- [ ] Частина 5 — Юридичні сторінки /privacy і /terms
- [ ] Частина 6 — Мобільна адаптація 375px
- [ ] DoD 1 — pytest 0 failed (з новими тестами)
- [ ] DoD 2 — tsc --noEmit + next build чисті
- [ ] DoD 3 — міграції застосовуються на чистій БД (ланцюжок від 5a88b1e15a4b)
- [ ] DoD 4 — браузерна верифікація (landing, reset-флоу, збереження карти,
      видалення акаунта, 375px)
- [ ] DoD 5 — CI зелений на main після синхронізації

---

## Частина 1 — Email-флоу (Resend): відновлення пароля + верифікація

### 1.1. Залежності й конфіг
- `services/astro-api/pyproject.toml`: перенести/додати `"httpx>=0.28,<1.0"` у
  ОСНОВНІ dependencies (зараз лише в dev). Перевстановити venv.
- `app/config.py` — нові поля:
  ```python
  resend_api_key: str = ""      # порожньо = email вимкнено (dev: лінк у лог)
  email_from: str = "Zorya <noreply@example.com>"
  rate_limit_forgot_password: str = "3/minute"
  ```
- `.env.example` + `infra/.env.example`: `RESEND_API_KEY=`, `EMAIL_FROM=`.

### 1.2. Новий модуль `app/email.py`
```python
import logging
import httpx
from app.config import settings

log = logging.getLogger(__name__)

async def send_email(to: str, subject: str, html: str) -> bool:
    """Send via Resend. With no API key (dev/tests) — log and pretend success."""
    if not settings.resend_api_key:
        log.info("EMAIL (dev, not sent) to=%s subject=%r body:\n%s", to, subject, html)
        return True
    async with httpx.AsyncClient(timeout=10) as client:
        r = await client.post(
            "https://api.resend.com/emails",
            headers={"Authorization": f"Bearer {settings.resend_api_key}"},
            json={"from": settings.email_from, "to": [to],
                  "subject": subject, "html": html},
        )
    if r.status_code >= 400:
        log.error("Resend error %s: %s", r.status_code, r.text[:300])
        return False
    return True
```

### 1.3. Моделі + міграція
- `User`: додати `email_verified: Mapped[bool] = mapped_column(Boolean, default=False)`.
- Нова модель `EmailToken` (в `app/models/user.py` поруч із RefreshToken), таблиця
  `email_tokens`: `id` (Integer pk autoincrement), `user_id` (FK users.id, index),
  `token_hash` (String(256), unique, index), `purpose` (String(16) — "verify"|"reset"),
  `expires_at` (DateTime(timezone=True)), `used` (Boolean default False),
  `created_at` (default _now). Relationship на User НЕ додавати (звертаємось
  завжди по token_hash) — менше каскадної магії.
- `app/models/__init__.py`: додати `EmailToken`.
- Міграція autogenerate ПРОТИ ЧИСТОЇ тимчасової БД (процедура з плану Етапу A,
  крок 2.5): `DATABASE_URL="sqlite+aiosqlite:///./_mig_gen.db" alembic upgrade head`
  → `alembic revision --autogenerate -m "email verification + reset tokens"` →
  перевірити вручну upgrade/downgrade → видалити _mig_gen.db.
  `down_revision` має бути `'5a88b1e15a4b'`.

### 1.4. Ендпоінти (у `app/routers/auth.py`)
Хешування токенів — уже наявним `_token_hash` (sha256). Генерація:
`secrets.token_urlsafe(32)`.

- `POST /api/v1/auth/forgot-password` `{email}` → **завжди 204** (без enumeration!),
  `@limiter.limit(settings.rate_limit_forgot_password)` + `request: Request`.
  Якщо юзер існує: створити EmailToken(purpose="reset", expires 1 год), надіслати
  лист із лінком `{settings.frontend_url}/reset-password?token=<raw>`.
- `POST /api/v1/auth/reset-password` `{token, new_password}` (new_password:
  `Field(min_length=8, max_length=128)`) → знайти EmailToken по хешу
  (purpose="reset", not used, not expired) → 400 якщо ні; інакше: оновити
  password_hash, token.used=True, **ревокнути ВСІ refresh-токени юзера**
  (`update(RefreshToken).where(user_id=...).values(revoked=True)`) → 204.
- `POST /api/v1/auth/send-verification` (авторизований, `get_current_user`) →
  якщо вже verified — 204 одразу; інакше EmailToken(purpose="verify", 24 год),
  лист із лінком `{frontend_url}/verify-email?token=<raw>` → 204.
  Rate limit `3/minute`.
- `POST /api/v1/auth/verify-email` `{token}` → аналогічна валідація
  (purpose="verify") → `user.email_verified = True`, used=True → 204; інакше 400.
- У `register`: після commit — best-effort надіслати верифікаційний лист
  (try/except: помилка email НЕ має валити реєстрацію).
- `UserOut`: додати `email_verified: bool`.
- Схеми: `ForgotPasswordRequest`, `ResetPasswordRequest`, `VerifyEmailRequest`
  у `app/schemas/auth.py`.

### 1.5. Фронтенд
- `proxy.ts`: **обережно з PUBLIC_PATHS** — додати `/forgot-password`,
  `/reset-password`, `/verify-email`. АЛЕ правило «залогінений на публічній
  сторінці → redirect /dashboard» має діяти ЛИШЕ для /login і /register
  (залогінений користувач мусить мати змогу відкрити /verify-email!). Розділити:
  ```ts
  const PUBLIC_PATHS = ["/login", "/register", "/forgot-password", "/reset-password", "/verify-email"];
  const AUTH_REDIRECT_PATHS = ["/login", "/register"]; // тільки ці женуть залогінених на dashboard
  ```
- Сторінка `/(auth)/forgot-password/page.tsx`: email-інпут → server action →
  незалежно від результату показує «Якщо такий акаунт існує — лист надіслано».
- Сторінка `/(auth)/reset-password/page.tsx`: читає `token` із searchParams,
  два поля (новий пароль + повтор) → server action → успіх: посилання на /login.
- Сторінка `/(auth)/verify-email/page.tsx`: **НЕ виконувати верифікацію на GET!**
  Поштові сканери (Outlook SafeLinks тощо) префетчать лінки з листів і спалять
  одноразовий токен. Сторінка показує кнопку «Підтвердити email», клік → server
  action POST verify-email → результат.
- Лінк «Forgot password?» на сторінці логіну.
- Банер у `(dashboard)/layout.tsx`: якщо `!email_verified` — тонка смужка
  «Підтвердьте email» + кнопка resend (server action на send-verification).
  Оновити тип `fetchMe` → `{email, plan, email_verified}`.
- Server actions — у `app/actions/auth.ts` (поруч з існуючими).

### 1.6. Тести (`tests/test_email_flow.py`)
Мокати `app.email.send_email` через `monkeypatch` — capture list з (to, subject,
html); токен діставати regex-ом з html (`token=([A-Za-z0-9_\-]+)`).
- happy path reset: register → forgot → лист captured → reset із токеном → старий
  пароль 401, новий 200;
- reset ревокує refresh: старий refresh_token після reset → 401;
- токен одноразовий: другий reset тим самим токеном → 400;
- прострочений токен → 400 (вставити EmailToken із expires_at у минулому напряму
  через TestSession);
- forgot з неіснуючим email → 204, лист НЕ captured;
- verify-email: register (лист captured) → verify → /auth/me email_verified=true.

---

## Частина 2 — Збереження карт

### 2.1. Модель + міграція
Нова `app/models/chart.py`, клас `Chart`, таблиця `charts`:
`id` (String(36) pk, _uuid), `user_id` (FK users.id, index, nullable=False),
`person_id` (String(36), `ForeignKey("persons.id", ondelete="SET NULL")`,
nullable=True), `chart_type` (String(32)), `title` (String(256)),
`request_payload` (JSON), `result` (JSON), `created_at` (default _now).
Без relationship-ів. `app/models/__init__.py` — додати. Міграція autogenerate
(та сама процедура; down_revision = міграція з Частини 1 — ланцюжок лінійний!).
Можна об'єднати міграції частин 1 і 2 в одну, якщо робиш їх підряд — тоді
одна міграція "stage c models". Виконавцю: обери одне і зазнач у звіті.

### 2.2. Конфіг
`app/config.py`: `max_saved_charts: int = 50`.

### 2.3. Роутер `app/routers/saved_charts.py`, prefix `/api/v1/saved-charts`
За зразком persons.py (той самий патерн `_get_owned`):
- `POST ""` `{chart_type, title, request_payload, result, person_id?}` →
  перед створенням порахувати кількість карт юзера; якщо >= max_saved_charts →
  400 `{"code": "saved_charts_limit", "message": ...}`. 201 → повертає збережене
  (без result — див. схеми).
- `GET ""` → список `{id, chart_type, title, person_id, created_at}` (БЕЗ result
  і request_payload — список має бути легким), сортування created_at desc.
- `GET "/{chart_id}"` → повний об'єкт із result.
- `DELETE "/{chart_id}"` → 204.
Схеми в `app/schemas/saved_chart.py`: SavedChartCreate (chart_type:
Literal["natal","solar_return"] — v1 зберігає лише ці два; transit/synastry
відкладено, БД-модель уже підтримує), SavedChartOut (без result),
SavedChartFull (з result). Зареєструвати роутер у main.py.

### 2.4. Тести (`tests/test_saved_charts.py`)
save → list (без result у відповіді!) → get by id (з result) → delete → 404;
чужу карту не видно (два юзери, 404); ліміт: monkeypatch
`settings.max_saved_charts = 2` → третє збереження 400.

### 2.5. Фронтенд
- `app/actions/saved-charts.ts`: saveChart, listSavedCharts, getSavedChart,
  deleteSavedChart (за зразком persons.ts).
- Витягнути `PlanetTable`, `AspectTable`, `ArabicPartsTable`, `fmtDeg` з
  `ChartForm.tsx` у новий `_components/ResultTables.tsx` — **чистий перенос без
  зміни логіки**; ChartForm імпортує звідти. (TransitForm/SynastryForm мають
  власні копії таблиць — їх НЕ чіпати в цьому плані.)
- `SaveChartButton` (client): props `{chartType, title (дефолт — дата+тип),
  requestPayload, result}` → кнопка «Save» біля результату в ChartForm і
  SolarReturnForm; після збереження — disabled «Saved ✓». requestPayload для
  natal — зібрати ті ж поля, що йдуть у calcNatalChart (datetime, timezone, lat,
  lon, house_system); для solar return — аналогічно. Обидві форми вже мають ці
  значення у state.
- Вкладка «Saved» у ChartTabs: список збережених (назва, тип, дата, Delete),
  клік → завантажити повну карту → рендер `ChartWheel` + таблиці з ResultTables.
  Для solar_return додатково показати return_dt (як у SolarReturnForm).

---

## Частина 3 — /account + видалення акаунта (GDPR)

### 3.1. Бекенд: новий `app/routers/users.py`, prefix `/api/v1/users`
- `DELETE "/me"` body `{password: str}` (авторизований) → перевірити пароль
  (`_verify_password` — імпортувати з routers.auth або перенести хелпери паролів
  у `app/security.py`, якщо перенос — оновити всі імпорти; дешевший варіант:
  імпорт з routers.auth, зазнач у звіті що обрав) → 403 якщо невірний.
  Порядок видалення (SQLite не форсить FK-каскади!):
  1) `delete(Chart).where(user_id=...)` (нова таблиця),
  2) `delete(Person).where(user_id=...)`,
  3) `delete(ChartLog).where(user_id=...)`,
  4) `delete(EmailToken).where(user_id=...)`,
  5) `await db.delete(user_obj)` — ORM-каскади доберуть settings/subscriptions/
     payments/refresh_tokens.
  → 204. Зареєструвати роутер у main.py.
- Тест (`tests/test_account_deletion.py`): register → створити person + saved
  chart → DELETE з хибним паролем 403 → з вірним 204 → login 401, refresh 401;
  прямим запитом у TestSession переконатись, що persons/charts/chart_logs юзера
  зникли.

### 3.2. Фронтенд: сторінка `/(dashboard)/account/page.tsx`
- Секція «Email»: адреса + бейдж Verified/Unverified + кнопка resend
  (перевикористати action з Частини 1).
- Секція «Danger zone»: поле пароля + кнопка «Delete account» з
  підтвердженням (confirm-стан у client-компоненті, БЕЗ window.confirm) →
  server action → при 204: `clearAuthCookies()` + redirect("/login").
- Додати «Account» у масив NAV у `(dashboard)/layout.tsx`.

---

## Частина 4 — Landing page + SEO

### 4.1. `proxy.ts`
`/` зробити публічним **точним збігом** (НЕ startsWith — інакше все стане
публічним!). Залогінений на `/` → redirect /dashboard (додати "/" у
AUTH_REDIRECT_PATHS-логіку, теж точним збігом).
```ts
const isPublic = pathname === "/" || PUBLIC_PATHS.some((p) => pathname.startsWith(p));
```

### 4.2. `app/page.tsx` — статичний landing (server component, без client JS)
Стиль — існуюча система: stone-фон, amber-акценти, ті ж шрифти. Секції:
1. Hero: «Zorya», підзаголовок «Точна натальна астрологія у браузері» +
   1 речення про власний ефемеридний рушій (дані JPL, точність звірена зі Swiss
   Ephemeris). CTA: «Спробувати безкоштовно» → /register, «Увійти» → /login.
2. Фічі (грід 2×3): точність (JPL DE440s, ≤0.003° від Swiss Ephemeris);
   6 систем будинків; транзити/соляри/синастрія; атлас 34 000+ міст з
   історичними часовими поясами; збережені персони й карти; аспекти з орбами.
3. Тарифи-тізер: три картки (Free/Pro/Expert, ціни з /pricing) → CTA /register.
4. Футер: © Zorya, лінки /privacy, /terms, /login.
Ніяких зображень/зовнішніх ресурсів — тільки текст і CSS.

### 4.3. SEO
- `app/layout.tsx` metadata: додати description (укр.), openGraph {title,
  description, type: "website"}.
- `app/robots.ts` і `app/sitemap.ts` — Next-конвенції; ПЕРЕД написанням прочитати
  відповідні доки в `apps/frontend/node_modules/next/dist/docs/` (Next 16 може
  відрізнятись від твоїх знань — AGENTS.md попереджає). sitemap: `/`, `/login`,
  `/register`, `/privacy`, `/terms`. base URL з env `NEXT_PUBLIC_SITE_URL`
  (дефолт `http://localhost:3000`).

### 4.4. Браузерна верифікація
preview_start → відкрити `/` БЕЗ логіну (не має редіректити!) → скріншот;
залогінитись → відкрити `/` → має редіректнути на /dashboard; /privacy і /terms
відкриваються без логіну.

---

## Частина 5 — Юридичні сторінки

### 5.1. `/(auth)/privacy/page.tsx` і `/(auth)/terms/page.tsx`
(в (auth)-групі — публічний layout без сайдбара; додати обидва шляхи в
PUBLIC_PATHS). Статичний текст українською. Privacy покриває: які дані
зберігаємо (email, хеш пароля, дані народження збережених персон, збережені
карти, записи платежів БЕЗ карткових даних — картки обробляють Stripe/LiqPay);
мета обробки; строк зберігання (до видалення акаунта); право на видалення —
лінк на /account; cookies (лише auth-кукі, без трекерів; Sentry — за наявності);
контакт: `TODO(owner): email`. Terms: опис сервісу, тарифи/оплата/скасування
(через Stripe portal / LiqPay), відмова від відповідальності (астрологічний
контент — розважально-довідковий, не є професійною порадою), обмеження
відповідальності, зміни умов.
**У шапці обох сторінок HTML-коментар:** `{/* ЧЕРНЕТКА — не юридична
консультація; власник має вичитати перед публічним запуском */}`. Те саме
зазначити у фінальному звіті виконання.

### 5.2. Футер-лінки
На landing (вже в 4.2) і в (dashboard)/layout.tsx — дрібний футер або лінки
внизу сайдбара: Privacy · Terms.

---

## Частина 6 — Мобільна адаптація (375px)

Порядок: СПОЧАТКУ подивитись, потім чинити. preview_start → resize_window
mobile (375×812) → пройти /login, /dashboard, /charts (natal результат),
/persons, /account, landing — скріншот кожної, зафіксувати проблеми, тоді
правити **тільки класами Tailwind** (без переписування компонентів):
- Навігація: сайдбар `hidden lg:flex` — перевірити, що існує робочий мобільний
  хедер із навігацією; якщо навігації на mobile НЕМАЄ — додати в
  (dashboard)/layout.tsx простий mobile-хедер: логотип + горизонтальний
  скрол-рядок NAV-лінків (`lg:hidden overflow-x-auto flex gap-1`). БЕЗ
  JS-гамбургера.
- Таблиці (Planet/Aspect/ArabicParts + persons): обгорнути в
  `<div className="overflow-x-auto">` там, де вилазять.
- Колесо: `ChartWheel` вже `w-full max-w-2xl` — переконатись, що на 375px
  вписується і тултіпи не обрізаються краєм (виправлення позиції НЕ потрібне —
  clamp уже є).
- Форми: гріди вже `grid-cols-1 sm:*` — перевірити візуально.
Після правок — повторні скріншоти тих самих сторінок (до/після в звіт).

---

## Ризики
1. `proxy.ts` PUBLIC_PATHS через startsWith: `/` як префікс зробить публічним
   УСЕ — тільки точний збіг (4.1). Так само не забудь /privacy, /terms,
   /forgot-password, /reset-password, /verify-email.
2. Верифікація email по GET-лінку спалюється поштовими сканерами — тому
   кнопка+POST (1.5).
3. slowapi без `request: Request` у сигнатурі — рантайм-помилка.
4. Reset пароля БЕЗ ревокації refresh-токенів = вкрадена сесія переживає зміну
   пароля — ревокація обов'язкова (1.4).
5. Каскади: SQLite не форсить FK — явні delete у 3.1, інакше видалення юзера
   лишить сироти або впаде на PG.
6. Міграції частин 1 і 2 мають ланцюжитись лінійно (одна після одної або
   об'єднана) — дві міграції з однаковим down_revision = розгалуження, alembic
   впаде.
7. Перенос таблиць у ResultTables.tsx — суто механічний; якщо тягне за собою
   зміну логіки, зупинись.

## Не робити (поза скоупом)
- Локалізацію next-intl (окремий план C2).
- Не чіпати app/ephemeris/*, білінг-логіку, TransitForm/SynastryForm-таблиці.
- Не додавати збереження transit/synastry карт (тільки natal + solar_return).
- Не форсити верифікацію email (жодних блокувань нефункцій для unverified).
- Не робити редактор/шерінг збережених карт.
- Жодних зовнішніх ресурсів на landing (шрифти/картинки з CDN).

## Definition of Done
1. `cd services/astro-api && ./.venv/bin/python -m pytest -q` — 0 failed
   (нові: test_email_flow, test_saved_charts, test_account_deletion).
2. `cd apps/frontend && npx tsc --noEmit && npm run build` — чисто.
3. Міграції на чистій БД: `DATABASE_URL="sqlite+aiosqlite:///./_mig_check.db"
   ./.venv/bin/python -m alembic upgrade head && rm -f _mig_check.db` — exit 0,
   у схемі є `email_tokens`, `charts`, `users.email_verified`.
4. Браузером (preview tools, живий бекенд):
   a. `/` відкривається без логіну, CTA веде на /register; залогінений на `/`
      редіректиться на /dashboard;
   b. forgot-password флоу: лінк з лога бекенда (dev-режим email) → reset →
      логін новим паролем;
   c. зберегти натальну карту → вкладка Saved → відкрити → колесо і таблиці
      рендеряться → видалити;
   d. /account: видалити тестовий акаунт → редірект на /login, повторний логін
      неможливий;
   e. скріншоти 375px до/після (Частина 6).
5. Коміт(и) + пуш у feature/phase-1-auth, синхронізувати main
   (`git push origin feature/phase-1-auth:main`), дочекатись зеленого CI
   (`gh run watch`) — всі 3 job.
6. Оновити чекбокси цього файлу, `docs/plans/README.md` (статус) і ROADMAP.md
   (Етап C: виконані пункти позначити, i18n → «перенесено в план C2»).
