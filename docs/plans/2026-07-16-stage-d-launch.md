---
status: planned
created: 2026-07-16
updated: 2026-07-16
related: "[[ROADMAP]]"
tags: [plan, stage-d]
---

# План Етапу D «Запуск» (для виконавця на молодшій моделі)

Мета: зняти launch-блокери (чесні тарифи, security-харденінг), прогнати живий
платіжний цикл Stripe у test mode, підключити аналітику і зібрати чекліст
ручних кроків запуску. Локалізації тут НЕМАЄ (окремий план C2). Реальний деплой
на VPS/Vercel, купівля домену і набір бета-користувачів — ручні дії власника:
модель їх не виконує, лише документує в docs/LAUNCH.md.

Виконуй частини по порядку. Коміт (з детальним повідомленням) + пуш у
`feature/phase-1-auth` після кожної частини. Якщо крок неоднозначний або код
не відповідає фактам нижче — зупинись і спитай, не імпровізуй.

## Ключові факти середовища (перевірено 2026-07-16)

> - Бекенд: `services/astro-api`, venv `./.venv/bin/python`, тести
>   `-m pytest -q` (зараз: 98 passed, 2 skipped). Фронтенд: `apps/frontend`,
>   `npx tsc --noEmit && npm run build`. Dev-сервери: бекенд — фонова Bash-задача
>   uvicorn, фронтенд — ТІЛЬКИ через preview_start (launch.json name: frontend).
> - Тести вимикають rate limiting через `os.environ["RATE_LIMIT_ENABLED"]="false"`
>   у conftest.py ДО імпорту settings — нові rate-limited ендпоінти сьют не зламають.
> - slowapi-декоратори ВИМАГАЮТЬ параметр `request: Request` у сигнатурі
>   ендпоінта — інакше рантайм-помилка (грабля вже з двох етапів, A і C).
> - Каталог тарифів: `services/astro-api/app/routers/billing.py:40` (PLANS) —
>   єдине джерело істини; landing (`app/page.tsx` → getPlans) і /pricing
>   рендерять фічі саме звідти, хардкоду фіч на фронтенді немає.
> - `get_subscription` (billing.py ≈104) має fallback `PLANS[0]`, якщо план
>   юзера не знайдено в каталозі: якщо ПРОСТО ВИДАЛИТИ Expert зі списку,
>   юзер із plan="expert" побачить "Free". Тому public-прапорець, не видалення.
> - Stripe-обробники checkout.session.completed / invoice.payment_succeeded /
>   customer.subscription.updated / customer.subscription.deleted уже існують
>   і покриті mocked-тестами (test_billing.py, 7 тестів). Живий E2E не ганявся.
> - `next.config.ts` порожній — security-заголовків зараз немає взагалі.
> - Rate limit Є на login/register/forgot-password/send-verification;
>   НЕМАЄ на reset-password і verify-email (знахідка ревʼю Етапу C).
> - `terms/page.tsx` (≈рядок 29) текстом згадує «плани Pro і Expert»;
>   `UpgradePrompt.tsx` має фолбек-текст із "Expert".
> - Рішення власника (2026-07-16, AskUserQuestion): Expert прибрати з продажу
>   повністю; Stripe test-ключі користувач надасть у сесії виконання;
>   LiqPay sandbox-ключів НЕМАЄ — жива перевірка LiqPay заблокована.

## Прогрес

- [x] Частина 1 — Чесні тарифи: Pro без нереалізованих фіч (прибрано "custom orbs",
      "progressions", "PDF export"), Expert схований з продажу через
      `"public": False` (запис НЕ видалено — fallback у get_subscription лишається
      коректним для існуючих expert-юзерів); /billing/plans повертає лише
      public-плани; обидва checkout-ендпоінти (Stripe, LiqPay) відхиляють
      прихований план 400-кою. ПОЗАПЛАНОВА знахідка й фікс: повідомлення
      require_plan() у app/dependencies/billing.py будувалось як
      "This feature requires: expert or pro" (алфавітний сортинг) — тобто
      живцем показувало слово "expert" вільному юзеру на пейволі transit/
      synastry/solar_return. Виправлено на "This feature requires the Pro
      plan or higher" (назва лише найдешевшого дозволеного плану). Перевірено
      наскрізь у браузері: /pricing і /billing/plans показують рівно 2 тарифи;
      /terms згадує тільки Pro; пейвол на Transit-вкладці (вільний юзер) більше
      не згадує Expert. 3 нових тести, 101 passed/2 skipped, tsc чисто.
- [x] Частина 2 — Security-харденінг бекенда: rate limit `10/minute` додано на
      `/reset-password` і `/verify-email` (`rate_limit_token_check`) — живо
      перевірено curl-циклом ×12 на реальному сервері: запити 1-10 → 400
      (bogus token), запити 11-12 → 429; пароль обмежено 72 байтами
      (RegisterRequest.password, ResetPasswordRequest.new_password) —
      bcrypt мовчки обрізає довші паролі. pip-audit: 1 вразливість
      (pytest 8.4.2 → PYSEC-2026-1845, фікс лише в 9.0.3 — major-бамп
      усупереч поточному пінові `<9.0`) — НЕ бампали, зафіксовано як відоме.
      npm audit --omit=dev: 3 moderate через постарілий postcss усередині
      власного `node_modules/next` (не наш прямий пакет); офіційний фікс —
      примусовий даунгрейд до `next@9.3.3`, що зламало б весь застосунок.
      Застосовано точковий `overrides.postcss: "^8.5.10"` у package.json
      замість цього — npm audit тепер 0 вразливостей, tsc + `next build`
      підтверджено чисті після перевстановлення. Ручний чек 2.4: `.env`
      і `.env.*` в .gitignore (root), жодного `.env`-файлу в git ls-files;
      `/docs` лишається відкритим — свідоме рішення (публічний API).
- [x] Частина 3 — Security-заголовки фронтенда: `next.config.ts` → `headers()`
      для `/(.*)`, усі 5 заголовків (X-Content-Type-Options, X-Frame-Options,
      Referrer-Policy, Permissions-Policy, мінімальний CSP без script-src/
      style-src/img-src). Живо перевірено `curl -sI http://localhost:3000/login`
      — усі 5 присутні. Браузером: /charts — Leaflet-мапа з OSM-тайлами
      рендериться повністю, розрахунок натальної карти (форма → server action
      → бекенд → таблиці) пройшов наскрізь без жодної CSP-помилки в консолі.
      tsc --noEmit + next build чисті (потрібен був рестарт dev-сервера —
      зміни next.config.ts не хот-релоадяться).
- [x] Частина 4 — Живий E2E Stripe test mode: користувач надав STRIPE_SECRET_KEY
      і Price ID (спершу помилково вставив Product ID `prod_...` замість Price ID
      `price_...` — виправлено через `stripe prices list --product`); Stripe CLI
      вже був залогінений (`stripe login` виконано заздалегідь). Живий цикл:
      реєстрація → /pricing → "Upgrade with Card (Stripe)" → Stripe Checkout з
      тестовою карткою 4242 4242 4242 4242 → редірект на /billing з "Payment
      successful" → бейдж Pro. Всі вебхуми (checkout.session.completed,
      customer.subscription.created, invoice.payment_succeeded і т.д.) — 200 у
      stripe listen. У БД: user.plan=pro, payment.amount_cents=900,
      subscription.status=active. Скасування: `stripe subscriptions cancel` →
      customer.subscription.deleted → user.plan=free, subscription.status=canceled.
      ПОЗАПЛАНОВА знахідка й фікс (підтверджено користувачем): у API-версії
      2026-06-24.dahlia Stripe переніс `current_period_start`/`current_period_end`
      з верхнього рівня Subscription у `items.data[]` — обробник читав старий шлях
      і мовчки писав NULL у обидва поля. Додано `_subscription_period()`, що читає
      з `items.data[0]`; підтверджено і юніт-тестом (реальний payload з Stripe CLI),
      і повторним живим циклом — нова підписка отримала коректні period_start/end.
      Заодно прибрано `payment_method_types=["card"]` з checkout-сесії (актуальна
      best-practice Stripe: не хардкодити, дати Stripe динамічно підбирати методи —
      підтверджено, що Apple Pay зʼявився на чекауті після цього). 102 passed/2 skipped.
- [ ] Частина 4б — LiqPay sandbox — ЗАБЛОКОВАНО (немає ключів; mocked-тести — чинне покриття)
- [ ] Частина 5 — Plausible analytics (gated на env, без cookie-банера)
- [ ] Частина 6 — Бета-готовність: feedback-лінк + docs/LAUNCH.md + ROADMAP
- [ ] DoD 1 — pytest 0 failed (з новими тестами)
- [ ] DoD 2 — tsc --noEmit + next build чисті
- [ ] DoD 3 — 5 security-заголовків присутні; Leaflet-мапа з OSM-тайлами працює
- [ ] DoD 4 — /billing/plans: 2 тарифи, жодної нереалізованої фічі; landing/pricing відповідають
- [ ] DoD 5 — живий Stripe-цикл checkout → webhook → pro → cancel → free зафіксований
- [ ] DoD 6 — без NEXT_PUBLIC_PLAUSIBLE_DOMAIN нуль запитів до plausible.io
- [ ] DoD 7 — docs/LAUNCH.md існує; ROADMAP.md оновлено
- [ ] DoD 8 — синк main + зелений CI (gh run watch, всі 3 job)

---

## Частина 1 — Чесні тарифи (ROADMAP-блокер №2: «реалізувати або прибрати»)

### 1.1. Бекенд — `app/routers/billing.py`
- Pro.features → лишити тільки реалізоване:
  `["Unlimited natal charts", "All major & minor aspects", "Transits",
  "Solar return", "Synastry", "Priority support"]`
  (ПРИБРАТИ: "custom orbs", "progressions", "PDF export" — їх немає в коді;
  транзити реалізовані, тому "Transits & progressions" → "Transits").
- Запис Expert: додати ключ `"public": False` (сам запис НЕ видаляти —
  див. факт про fallback у get_subscription; `require_plan("pro","expert")`
  у charts.py не чіпати — юзери з plan="expert" у БД мають лишатись валідними).
- `list_plans`: віддавати лише плани з `p.get("public", True)`.
- `stripe_checkout` (≈124) і LiqPay-checkout (≈337): якщо обраний план
  не public — 400 "Invalid plan" (щоб прямий API-виклик не купив прихований тариф).

### 1.2. Фронтенд
- `terms/page.tsx`: прибрати згадку Expert («платні плани Pro і Expert» →
  «платний план Pro»).
- `UpgradePrompt.tsx`: перевірити фолбек-текст — якщо він показує "Expert",
  спростити до Pro.

### 1.3. Тести (`tests/test_billing.py` або новий файл)
- `/billing/plans` не містить id="expert" і не містить рядків
  "PDF"/"progressions"/"custom orbs".
- POST checkout із plan="expert" → 400.
- Перевір, чи існуючі тести не зав'язані на склад PLANS — якщо так, оновити.

### 1.4. Верифікація браузером
/pricing і landing показують рівно 2 картки (Free, Pro); список фіч Pro — без
обіцянок неіснуючого.

---

## Частина 2 — Security-харденінг бекенда

### 2.1. Rate limit на token-ендпоінти
- `app/config.py`: нове поле `rate_limit_token_check: str = "10/minute"`.
- Застосувати `@limiter.limit(...)` до POST `/reset-password` і `/verify-email`
  в auth.py. НЕ ЗАБУДЬ додати `request: Request` першим параметром обох.
- Тест: із увімкненим лімітом (окремий client-фікстур або monkeypatch settings +
  свіжий Limiter — подивись, як простіше з наявною архітектурою; якщо надто
  дорого — мінімум перевір, що ендпоінти працюють, і зафіксуй, що ліміт
  верифіковано вручну curl-ом ×11).

### 2.2. Ліміт довжини пароля під bcrypt
- `schemas/auth.py`: `RegisterRequest.password` і
  `ResetPasswordRequest.new_password` — `max_length=128` → `max_length=72`
  (bcrypt мовчки обрізає на 72 байтах; довший пароль створює хибне відчуття
  ентропії). `LoginRequest` НЕ чіпати — раптом хтось уже зареєстрував
  довший пароль.

### 2.3. Аудит залежностей
- `.venv/bin/pip install pip-audit && .venv/bin/pip-audit` — зафіксувати звіт
  у Прогресі. Фіксити ТІЛЬКИ вразливості з доступним сумісним фіксом
  (patch/minor bump у pyproject.toml), кожен bump окремо + повний pytest.
- `cd apps/frontend && npm audit --omit=dev` — так само; після кожного фікса
  tsc + build.
- Якщо фікс вимагає major-бампа — НЕ бампати, зафіксувати як відоме в Прогресі.

### 2.4. Швидкий ручний чек (зафіксувати результат у Прогресі)
- `.env` у .gitignore обох частин репо; `git status` перед комітами не показує
  секретів.
- FastAPI `/docs` лишається відкритим свідомо (API публічний) — просто
  зафіксувати рішення.

---

## Частина 3 — Security-заголовки фронтенда

### 3.1. `next.config.ts` → `async headers()` для `"/(.*)"`:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`
- `Content-Security-Policy: frame-ancestors 'none'; object-src 'none'; base-uri 'self'`

НЕ додавати повний CSP (script-src/style-src/img-src): зламає інлайн-скрипти
гідратації Next і зовнішні OSM-тайли Leaflet. Строгий CSP із nonce — свідомо
пост-launch задача, не тут.

### 3.2. Верифікація
- `curl -sI http://localhost:3000/login` — всі 5 заголовків присутні.
- Браузером: /persons або /charts — мапа Leaflet рендериться, тайли вантажаться.

---

## Частина 4 — Живий E2E Stripe (test mode)

**СТОП-ТОЧКА.** Попроси користувача самостійно вписати в
`services/astro-api/.env` (НЕ в чат, НЕ в коміт):
`STRIPE_SECRET_KEY=sk_test_...`, `STRIPE_PRICE_PRO_MONTHLY=price_...`;
`STRIPE_WEBHOOK_SECRET=whsec_...` — з'явиться на кроці 4.2. Перевір
`which stripe` (Stripe CLI); якщо нема — попроси користувача
`brew install stripe/stripe-cli/stripe` і `stripe login`.

### 4.1. Підняти бекенд (фонова Bash-задача, лог у scratchpad) і фронтенд (preview_start).
### 4.2. `stripe listen --forward-to localhost:8000/api/v1/billing/stripe/webhook`
— теж фонова задача; whsec_ із його виводу → користувач кладе в .env → рестарт бекенда.
### 4.3. Браузером: свіжий тест-юзер → /pricing → Upgrade Pro → Stripe Checkout:
картка `4242 4242 4242 4242`, будь-яка майбутня дата, будь-який CVC → редірект назад.
### 4.4. Перевірити: `/auth/me` → plan="pro"; у БД записи payments
(status=succeeded) і subscriptions; у лозі stripe listen — checkout.session.completed
та invoice.payment_succeeded по 200.
### 4.5. Скасування: `stripe subscriptions list` → `stripe subscriptions cancel sub_...`
→ дочекатись customer.subscription.deleted у listen-лозі → перевірити plan="free".
### 4.6. Зафіксувати повний ланцюжок у Прогресі (ID сесій/подій — можна, секрети — ні).

## Частина 4б — LiqPay sandbox — ЗАБЛОКОВАНО
Ключів немає (підтверджено користувачем). Нічого не робити. Mocked-тести
(5 шт. у test_billing.py) — чинне покриття callback-логіки. Відмітити в
Прогресі як заблоковане, у LAUNCH.md — як обов'язковий ручний крок перед
прийомом гривневих платежів.

---

## Частина 5 — Plausible analytics

### 5.1. `apps/frontend/app/layout.tsx`
Якщо задано `process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN` — рендерити
`<Script defer data-domain={...} src="https://plausible.io/js/script.js"
strategy="afterInteractive" />` (import з `next/script`). Без env — нічого.
Plausible cookie-less → cookie-банер НЕ потрібен.

### 5.2. Документація
- `.env.example` фронтенда (створити, якщо нема): `NEXT_PUBLIC_PLAUSIBLE_DOMAIN=`.
- docs/DEPLOY.md: абзац про змінну.
- `/privacy`: один абзац про cookie-less аналітику Plausible (без персональних
  даних, без кук) — сторінка вже позначена як чернетка, стиль зберегти.

### 5.3. Верифікація
- Без env: read_network_requests — НУЛЬ запитів до plausible.io.
- З тимчасовим `NEXT_PUBLIC_PLAUSIBLE_DOMAIN=localhost` (перезапуск dev-сервера):
  script-тег присутній у DOM (сам запит може падати 404/блокуватись — це ок,
  домен не зареєстрований у Plausible). Прибрати тимчасовий env після перевірки.

---

## Частина 6 — Бета-готовність

### 6.1. Feedback-лінк
У `(dashboard)/layout.tsx` поруч із Privacy/Terms — лінк "Feedback" на
`mailto:${process.env.NEXT_PUBLIC_FEEDBACK_EMAIL}`; без env — не рендериться.
Додати змінну в .env.example фронтенда.

### 6.2. `docs/LAUNCH.md` — чекліст РУЧНИХ кроків власника
Домен (перевірити/купити — блокер №3 ROADMAP); Vercel-деплой фронтенда;
VPS-деплой бекенда за docs/DEPLOY.md; DNS; Stripe live-ключі + webhook endpoint
у Stripe Dashboard (не CLI!); LiqPay прод-ключі + sandbox-прогін; SENTRY_DSN
обох частин; NEXT_PUBLIC_PLAUSIBLE_DOMAIN + реєстрація сайту в Plausible;
uptime-моніторинг; NEXT_PUBLIC_FEEDBACK_EMAIL; запрошення 10–20 бета-юзерів
(насамперед астрологи-практики — зловлять розбіжності точності); вичитка
privacy/terms юристом або власником.

### 6.3. ROADMAP.md
Відмітити виконане в Етапі D; чесно зафіксувати, що лишилось ручним
(деплой, домен, бета, LiqPay sandbox).

---

## Ризики
1. slowapi без `request: Request` — рантайм-помилка. Третій етап поспіль ця
   грабля в плані — не наступи.
2. Видалення Expert зі списку PLANS замість public-прапорця зламає
   get_subscription-fallback для існуючих expert-юзерів (покажуть "Free").
3. Масові бампи залежностей після audit ламають більше, ніж чинять — тільки
   точкові фікси вразливостей, кожен окремо + тести.
4. Повний CSP зламає гідратацію Next та OSM-тайли — тільки мінімальний набір 3.1.
5. `stripe listen` у форграунді заблокує сесію — тільки фонова Bash-задача.
6. Stripe-ключі не мають потрапити в чат, лог-файли, коміти. Перед кожним
   комітом — `git status` і переконайся, що .env не в staged.
7. Не перейменовуй id тарифів ("pro"/"expert") — стрінги зашиті в require_plan
   і в records у БД.

## Не робити (поза скоупом)
- Локалізація UA/EN — план C2.
- PDF export / progressions / custom orbs / фічі Expert — Етап E (це фічі, не запуск).
- Строгий CSP із nonce.
- Реальний деплой, купівля домену, набір бета-користувачів — ручні дії власника.
- Не чіпати app/ephemeris/* і логіку webhook-обробників (Частина 4 лише
  ВЕРИФІКУЄ їх живим трафіком; якщо E2E виявить баг — зупинись і опиши, не фікси мовчки).
- Self-hosted Plausible.

## Definition of Done
1. `cd services/astro-api && ./.venv/bin/python -m pytest -q` — 0 failed
   (нові тести: public-фільтр тарифів, checkout прихованого тарифу → 400).
2. `cd apps/frontend && npx tsc --noEmit && npm run build` — чисто.
3. `curl -sI` будь-якої сторінки: всі 5 заголовків з 3.1; Leaflet-мапа працює.
4. `/billing/plans` → рівно 2 тарифи; жодної згадки нереалізованих фіч у
   бекенді, на landing, /pricing і /terms.
5. Живий Stripe-цикл (checkout → webhook → pro → cancel → free) зафіксовано
   в Прогресі; LiqPay — задокументовано як blocked.
6. Без NEXT_PUBLIC_PLAUSIBLE_DOMAIN — нуль запитів до plausible.io.
7. docs/LAUNCH.md існує; ROADMAP.md оновлено.
8. Коміт по кожній частині + пуш у feature/phase-1-auth, синк main
   (`git push origin feature/phase-1-auth:main`), `gh run watch` — всі 3 job зелені.
