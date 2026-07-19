---
status: in-progress
created: 2026-07-18
updated: 2026-07-19
related: "[[2026-07-16-stage-d-launch]]"
tags: [plan, billing, monopay]
---

# План: міграція UAH-платежів з LiqPay на monopay (для виконавця на молодшій моделі)

Рішення власника (2026-07-18): замість LiqPay (ПриватБанк) для гривневих платежів
використовуємо **monopay — еквайринг monobank** (api.monobank.ua). LiqPay-код
видаляється повністю: живого тестування він так і не пройшов (sandbox-ключів
немає), мерчант-акаунта немає, тож це мертвий код, а не працююча інтеграція.

**Рекомендований порядок виконання:** Етап D Частина 5 (Plausible) → ЦЕЙ план →
Етап D Частина 6 (LAUNCH.md/ROADMAP) — щоб LAUNCH.md одразу писався з monopay,
а не переписувався після.

## Ключова відмінність моделі оплати — ЧИТАТИ ПЕРШИМ

LiqPay мав нативні підписки (`action: subscribe`, щомісячне автосписання).
**monopay нативних підписок НЕ має** — це разові інвойси. Токенізація картки
(wallet) + власний планувальник для автосписань = окрема пост-launch задача
(потребує cron-інфраструктури, якої немає).

**Модель для запуску:** разовий платіж = 30 днів Pro, БЕЗ автопродовження.
Юзер платить знову, коли захоче продовжити (кнопка Renew на /billing).
Це чесно і просто; в усіх текстах (pricing, terms) прямо пишемо
«без автопродовження». Після закінчення періоду юзер лениво (lazy)
понижується до free — див. Частину 3.

## Ключові факти середовища (перевірено 2026-07-18)

> - Всі LiqPay-точки в коді: `services/astro-api/app/routers/billing.py`
>   (LiqPayCheckoutRequest, `_liqpay_sign`, `/liqpay/checkout` ≈329,
>   `/liqpay/callback` ≈363), `app/config.py` (liqpay_public_key,
>   liqpay_private_key), 5 тестів у `tests/test_billing.py` (success,
>   3×cancellation, invalid signature) + `_liqpay_signed_form` хелпер +
>   monkeypatch у `test_liqpay_checkout_rejects_hidden_plan`;
>   фронтенд: `app/actions/billing.ts` (`getLiqPayForm` ≈101),
>   `PricingCard.tsx` (`LiqPayButton`, проп `liqpayAvailable`),
>   `pricing/page.tsx` (рядки 15-16, 37, 43), `terms/page.tsx`,
>   `privacy/page.tsx` (≈26); env-приклади: `services/astro-api/.env.example`
>   (42-44), `infra/.env.example` (17-19); `docs/DEPLOY.md` (21, 63).
> - Історичні згадки LiqPay у README.md, PLAN.md, ROADMAP.md (Етапи A/B/C),
>   старих планах — НЕ ЧІПАТИ (історія). Оновити тільки ROADMAP Етап D
>   («E2E-тест оплати: … LiqPay sandbox» → monopay).
> - `Subscription` (app/models/user.py ≈51): має `stripe_sub_id`,
>   `liqpay_order_id`, `period_start/end` (DateTime(timezone=True)).
>   Колонку `liqpay_order_id` НЕ видаляти (історія, зайвий churn) —
>   додати нову `monopay_invoice_id`.
> - `/billing` сторінка (app/(dashboard)/billing/page.tsx) зараз НЕ показує
>   period_end — треба буде показати для monopay-підписки.
> - `payments`: dedupe по `provider_payment_id` (унікальний індекс НЕ стоїть,
>   дедуп у коді — тримати той самий патерн: SELECT перед INSERT).
> - `httpx` вже в основних залежностях. `cryptography` — НЕМАЄ (потрібна для
>   перевірки ECDSA-підпису вебхука). bcrypt є, але це не заміна.
> - Останні граблі зі Stripe (та сама пастка тут): API-версії дрейфують від
>   training data. НЕ покладайся на памʼять про поля monopay API — під час
>   виконання звіряй реальні відповіді (`curl` з X-Token) і логуй payload
>   першого живого вебхука/статусу перед тим, як фіксувати парсер.
> - Обробник Stripe нещодавно виправлено: period-дати тепер у
>   `items.data[]`. Stripe-логіку НЕ ЧІПАТИ взагалі.
> - Тести вимикають rate limiting через env у conftest.py; вебхук monopay
>   rate limiting не потребує.
> - `api_public_url` у settings вже існує (використовувався для LiqPay
>   server_url) — переїде у webHookUrl monopay.

## Факти про monopay API (звірити живцем на кроці 2.1!)

- База: `https://api.monobank.ua`. Авторизація: заголовок `X-Token`
  (мерчант-токен). Тестовий токен видається в кабінеті еквайрингу monobank
  (web.monobank.ua / fop.monobank.ua → Еквайринг → тестовий токен).
- Створення інвойса: `POST /api/merchant/invoice/create` →
  `{invoiceId, pageUrl}`. Тіло: `amount` У КОПІЙКАХ (price_uah × 100),
  `ccy: 980`, `redirectUrl`, `webHookUrl`, `validity` (сек),
  `merchantPaymInfo: {reference, destination}`.
- Статус: `GET /api/merchant/invoice/status?invoiceId=...` — ті самі поля,
  що у вебхуку: `status` ∈ created | processing | hold | success | failure |
  reversed | expired.
- Вебхук: POST з сирим JSON-тілом; заголовок `X-Sign` — base64
  ECDSA-SHA256-підпис САМЕ сирих байтів тіла. Публічний ключ:
  `GET /api/merchant/pubkey` (base64). Ключ кешувати; при невалідному
  підписі — один раз перезавантажити ключ і повторити перевірку
  (mono ротує ключі), потім 400.
- Скасування/повернення: `POST /api/merchant/invoice/cancel` (для
  успішного платежу → згодом статус reversed).

## Прогрес

- [x] Частина 1 — Бекенд: `cryptography>=44,<46` додано, venv перевстановлено;
      `monopay_token` замінив liqpay_public/private_key у config.py;
      `.env.example` (обох частин) оновлено; `Subscription.monopay_invoice_id`
      (String(64), nullable, indexed) + автогенерована міграція на чистій
      тимчасовій БД (down_revision=ee0a96658a6f, без server_default —
      колонка nullable); `app/monopay.py` (create_invoice/get_invoice_status/
      verify_webhook_signature). Живо звірено з реальним API (тестовий
      токен): create_invoice → `{invoiceId, pageUrl}`, status → `{status:
      "created", amount, ccy, ...}` — точно як у фактах плану;
      `/pubkey` → base64 PEM secp256r1, завантажується напряму через
      `cryptography.load_pem_public_key`.
- [x] Частина 2 — `/monopay/checkout` (валідація плану, створює інвойс,
      pending-рядок Subscription з monopay_invoice_id), `_apply_monopay_status`
      (спільна логіка success/reversed/failure/expired), `/monopay/sync`
      (шукає останню pending-підписку юзера, для dev/redirect-time),
      `/monopay/webhook` (сирі байти → verify → apply). `/billing/subscription`
      розширено — тепер повертає `provider` (stripe|monopay|null) і
      `period_end` активної підписки. LiqPay видалено повністю (роутер,
      конфіг, обидва ендпоінти, imports base64/hashlib/hmac/time — усі
      використовувались ЛИШЕ в LiqPay-коді). docs/DEPLOY.md: розділ 5
      (Stripe) оновлено — монопей не потребує ручного налаштування вебхука
      в кабінеті, але наголошено, що `API_PUBLIC_URL` має бути реальним
      публічним HTTPS для доставки вебхука.
- [x] Частина 3 — Lazy-експірація: `_expire_stale_monopay_subscriptions` у
      `app/dependencies/auth.py` → `get_current_user`, викликається на
      кожен authed-запит платного юзера. Прострочені monopay-рядки
      (`period_end` у минулому) → status="expired"; юзера понижує до
      free ЛИШЕ якщо не лишилось інших чинних підписок (Stripe-рядок з
      period_end=None завжди вважається чинним — тестами підтверджено,
      що lazy-експірація його не чіпає).
- [x] Частина 4 — `startMonopayCheckout`/`syncMonopay` замінили `getLiqPayForm`
      у actions/billing.ts; `PricingCard` — проп `monopayAvailable`, кнопка
      «Pay with monobank (UAH)» викликає checkout напряму (без окремого
      form-POST компонента, на відміну від LiqPay — monopay віддає звичайний
      redirect-URL); `/billing`: `?monopay=1` → серверний `syncMonopay()`
      перед рендером + банер успіху (спільний із Stripe `?success=1`);
      для monopay-підписки показує «Active until DD/MM/YYYY — no
      auto-renewal» + `RenewButton` замість `ManageButton`; Stripe-гілка
      не чіпалась. Тексти pricing/terms/privacy — чесно про «30 днів без
      автопродовження» для monobank проти автопродовження Stripe.
- [x] Частина 5 — 5 liqpay-тестів + `_liqpay_signed_form` видалено; 10 нових
      monopay-тестів: checkout (pending-рядок, hidden-план 400, без токена
      503), webhook (success активує + дедуп Payment, reversed → free,
      failure → pending/failed, невалідний підпис 400 — це ЄДИНИЙ тест, де
      справжня ECDSA-перевірка виконується насправді, з фіктивним ключем
      замість мережевого виклику), sync (застосовує статус пендінг-інвойса),
      продовження (друга оплата подовжує ІСНУЮЧУ активну підписку, а не
      створює другу), lazy-експірація ×2 (monopay понижує, Stripe — ні).
      107 passed/2 skipped (було 102; -5 liqpay +10 monopay).
- [x] Частина 6 — Живий E2E з тестовим токеном: користувач надав
      MONOPAY_TOKEN у сесії, Stripe CLI вже був залогінений з попередньої
      частини. Живо звірено 2.1 ДО написання коду (create_invoice, status,
      pubkey — усі три збіглись з фактами плану). Знайдено й виправлено
      позапланову граблю: dev SQLite (`astro.db`) не має auto-migrate —
      юніт-тести генерують схему через `create_all` в памʼяті і не ловлять
      відсутню міграцію на реальній БД; перший живий чекаут впав 500-кою
      ("table subscriptions has no column named monopay_invoice_id") —
      виправлено запуском `alembic upgrade head` на dev-БД (продакшн-деплой
      не постраждав би: docker-entrypoint.sh уже робить це автоматично).
      Другий чекаут: кнопка «Pay with monobank» → редірект на РЕАЛЬНУ
      сторінку оплати pay.monobank.ua з правильною сумою (350₴) і описом
      («Zorya Pro — 30 days») — підтверджено скріншотом.

      ОБМЕЖЕННЯ (рішення користувача через AskUserQuestion): сторінка
      оплати monobank показує форму справжньої картки/Apple/Google
      Pay/QR без очевидної «тестової» кнопки, і в користувача не було
      задокументованих тестових номерів карток — тому повний цикл
      «оплата → success-вебхук → активація» НЕ пройдено живою карткою
      (на відміну від Stripe, де є публічний стандарт 4242…). Замість
      цього перевірено те, що можна перевірити без грошового переказу:
      /monopay/sync на неоплаченому інвойсі — коректно НІЧОГО не змінює
      (план лишився free, підписка лишилась pending); статус того самого
      інвойса після спливання `validity` (3600с) — коректно "expired";
      `/invoice/cancel` на неоплаченому інвойсі — реальна відповідь
      `{"errCode":"1004","errText":"invoice not paid"}`, що збігається з
      документованою поведінкою (cancel діє лише на успішні платежі).
      Success/reversed/failure переходи станів лишаються верифікованими
      ЛИШЕ юніт-тестами (Частина 5) — не живим платежем.

      ПОЗАПЛАНОВА знахідка й фікс: банер на /billing показував «Payment
      successful!» для БУДЬ-ЯКОГО повернення з `?monopay=1`, незалежно
      від реального результату sync — побачено живцем саме на цьому
      неоплаченому інвойсі (банер показав "успіх", хоча план лишився
      Free). Виправлено: банер тепер прив'язаний до фактичного
      результату `syncMonopay()` (`plan !== "free"`), і додано чесне
      повідомлення на випадок неоплаченого/скасованого/простроченого
      інвойсу замість мовчазної відсутності фідбеку. tsc чисто після
      фіксу, живо перевірено повторним заходом на /billing?monopay=1.
- [ ] DoD — див. внизу

---

## Частина 1 — Конфіг, модель, міграція, клієнт

### 1.1. Залежність
`pyproject.toml` → основні deps: `"cryptography>=44,<46"`. Перевстановити venv
(uv). Це для ECDSA-перевірки підпису вебхука.

### 1.2. Конфіг (`app/config.py`)
- ПРИБРАТИ: `liqpay_public_key`, `liqpay_private_key`.
- ДОДАТИ: `monopay_token: str = ""` (порожньо = monopay вимкнено, 503 на
  checkout — той самий патерн, що у Stripe).
- `.env.example` і `infra/.env.example`: замінити LiqPay-блок на
  `MONOPAY_TOKEN=` з коментарем, де взяти тестовий токен.

### 1.3. Модель + міграція
- `Subscription`: додати `monopay_invoice_id: Mapped[str | None] =
  mapped_column(String(64), nullable=True, index=True)`.
- Alembic-міграція на чистій тимчасовій БД, `down_revision` — від поточного
  head (`ee0a96658a6f` або новіший — перевір `alembic heads`). Колонка
  nullable → server_default не потрібен (грабля з Етапу C тут не стріляє).

### 1.4. Клієнт monopay (новий модуль `app/monopay.py`)
Функції (усі через httpx.AsyncClient, timeout=10, заголовок X-Token):
- `create_invoice(amount_kopecks, reference, destination, redirect_url,
  webhook_url) -> dict` (повертає invoiceId, pageUrl)
- `get_invoice_status(invoice_id) -> dict`
- `fetch_pubkey() -> bytes` (base64-декодований DER/PEM — подивись живцем
  формат) + модульний кеш
- `verify_webhook_signature(raw_body: bytes, x_sign_b64: str) -> bool` —
  ECDSA-SHA256 через cryptography; при провалі — рефетч ключа й одна
  повторна спроба.
Дев-режим як у email: якщо `monopay_token` порожній — checkout повертає 503,
жодних моків усередині клієнта (моки — у тестах).

---

## Частина 2 — Ендпоінти: checkout, webhook, sync; видалення LiqPay

### 2.1. Перед кодом — звірка API живцем
Коли зʼявиться тестовий токен (СТОП-точка Частини 6 можна виконати раніше):
`curl -H "X-Token: ..." -d '{"amount":100,"ccy":980}' .../invoice/create` —
подивитись реальну форму відповіді й статусу. Якщо поля відрізняються від
фактів вище — СПОЧАТКУ виправити план/код під реальність, потім рухатись далі.

### 2.2. `POST /api/v1/billing/monopay/checkout` (authed)
- Валідація плану: як у Stripe (public, не free) — та сама перевірка, що
  вже стоїть.
- Створити інвойс: amount = `plan_cfg["price_uah"] * 100`, ccy 980,
  `redirectUrl = f"{settings.frontend_url}/billing?monopay_invoice={{invoiceId}}"`
  — УВАГА: invoiceId відомий тільки ПІСЛЯ create, тому спершу create з
  redirectUrl на `/billing?monopay=pending`, потім... НІ — простіше:
  monopay дозволяє задати redirectUrl до створення, а invoiceId у ньому
  не потрібен, бо sync-ендпоінт знайде pending-підписку юзера сам
  (див. 2.4). Отже `redirectUrl = f"{settings.frontend_url}/billing?monopay=1"`.
- `webHookUrl = f"{settings.api_public_url}/api/v1/billing/monopay/webhook"`.
- Записати pending-рядок: `Subscription(user_id, plan, status="pending",
  monopay_invoice_id=invoiceId)` + commit. Це локальний mapping
  invoiceId → (user, plan) — вебхук і sync працюють через нього, а не
  через довіру до полів вебхука.
- Повернути `{"url": pageUrl}` — той самий контракт, що у Stripe-checkout.

### 2.3. Спільна логіка переходів `_apply_monopay_status(inv: dict, db)`
Вхід — обʼєкт статусу/вебхука monopay. Знайти підписку по
`monopay_invoice_id == inv["invoiceId"]`; якщо нема — залогувати warning і
вийти (чужий/старий інвойс).
- `success`: якщо підписка вже active — ідемпотентний вихід (але Payment
  дедупнути окремо). Інакше: `status="active"`,
  `period_start = max(now, попередній period_end активної monopay-підписки
  юзера, якщо така є)` — простіше: якщо у юзера вже є active monopay-підписка,
  продовжити ЇЇ (`period_end += 30 днів`, нову pending позначити
  `status="merged"`), інакше `period_start=now, period_end=now+30 днів`.
  `user.plan = plan`. Payment: provider="monopay",
  provider_payment_id=invoiceId, amount_cents=inv["amount"] (це копійки —
  назва колонки amount_cents лишиться, семантика «мінорні одиниці»),
  currency="UAH", status="succeeded", з дедупом по provider_payment_id.
- `reversed`: підписку → "canceled", `user.plan="free"` (якщо інших active
  підписок немає — перевір і Stripe-підписки теж, не понизь платного
  Stripe-юзера через мертвий mono-інвойс).
- `failure` / `expired`: pending-підписку → "failed". Юзера НЕ чіпати
  (платіж просто не відбувся — на відміну від LiqPay, де unsubscribed
  означав скасування діючої підписки).
- `created` / `processing` / `hold`: нічого (лог debug).

### 2.4. `POST /api/v1/billing/monopay/sync` (authed, без тіла)
Знайти ОСТАННЮ підписку юзера з `monopay_invoice_id != None` і статусом
`pending`; якщо є — `get_invoice_status()` → `_apply_monopay_status()`.
Повернути `{"plan": user.plan}`. Це шлях для локального dev (вебхук з
інтернету на localhost не долетить) і страховка в проді, якщо вебхук
запізнюється: юзер повернувся з оплати → сторінка сама синкнулась.

### 2.5. `POST /api/v1/billing/monopay/webhook` (public)
Сирі байти тіла → `verify_webhook_signature` → 400 якщо невалідний.
Далі json.loads → `_apply_monopay_status`. Відповідь `{"ok": true}`.

### 2.6. Видалити LiqPay
`LiqPayCheckoutRequest`, `_liqpay_sign`, обидва ендпоінти, імпорти base64/hmac
якщо більше не потрібні (base64 потрібен для pubkey — перевір), конфіг-ключі,
env-приклади (замінені в 1.2). У `docs/DEPLOY.md` — рядки 21 і 63: LiqPay →
monopay (для вебхука ПОТРІБЕН публічний API_PUBLIC_URL — окремо наголосити).

---

## Частина 3 — Lazy-експірація (без cron)

У `app/dependencies/auth.py` → `get_current_user` (або окрема функція, яку
він викликає) після завантаження юзера:
- Якщо `user.plan != "free"`: SELECT active-підписки юзера. Юзер лишається
  на плані, якщо існує хоч одна active-підписка, яка НЕ є простроченою
  monopay (`monopay_invoice_id != None and period_end < now(utc)`).
  Stripe-підписка з `period_end == None` вважається чинною (її життєвий
  цикл керує вебхук Stripe — НЕ наша справа).
- Якщо чинних не лишилось: прострочені monopay-підписки → `status="expired"`,
  `user.plan="free"`, commit. Лог info.
- Вартість: один додатковий SELECT на запит ТІЛЬКИ для платних юзерів —
  прийнятно для запуску; TODO-коментар про кеш, якщо колись стане боляче.
- ОБЕРЕЖНО: datetime-порівняння — `expires/period_end` у SQLite наївні;
  використай той самий патерн `.replace(tzinfo=timezone.utc)`, що вже є
  в auth.py для refresh-токенів.

---

## Частина 4 — Фронтенд

### 4.1. `app/actions/billing.ts`
Видалити `getLiqPayForm`. Додати `startMonopayCheckout(plan)` — POST
`/billing/monopay/checkout`, redirect на `url` (скопіювати патерн
`startStripeCheckout` — там уже є redirect-логіка). Додати
`syncMonopay()` — POST `/billing/monopay/sync`.

### 4.2. `PricingCard.tsx`
`LiqPayButton` (форма-POST на liqpay.ua) видалити повністю. Замість неї
кнопка «Pay with monobank (UAH)» у тому ж стилі (зелену рамку можна
лишити), onClick → `startMonopayCheckout(plan.id)`. Проп `liqpayAvailable`
перейменувати на `monopayAvailable` (у `pricing/page.tsx` теж).

### 4.3. `/billing` сторінка
- Якщо URL має `?monopay=1` — серверно викликати `syncMonopay()` перед
  рендером і показати банер «Payment successful…» (той самий, що для
  Stripe `?success=1`).
- Показати дату закінчення для monopay-підписки: «Pro до DD.MM.YYYY —
  без автопродовження» + кнопка «Продовжити ще на 30 днів» (= той самий
  monopay-checkout). Дані: розширити `/api/v1/billing/subscription`,
  щоб повертав `period_end` і `provider` (stripe|monopay|None) поточної
  active-підписки.
- Для Stripe-підписки нічого не змінювати (Manage subscription → портал).

### 4.4. Тексти (чесність!)
- `pricing/page.tsx` рядок 43: «Ukrainian users may pay in UAH via
  monobank (30 days per payment, no auto-renewal).»
- `terms/page.tsx`: «Оплата обробляється через Stripe (підписка з
  автопродовженням) або monobank (разовий платіж за 30 днів доступу,
  без автопродовження). Stripe-підписку можна скасувати через Customer
  Portal; monobank-платіж не потребує скасування — доступ просто
  закінчується.»
- `privacy/page.tsx` ≈26: «Stripe і LiqPay» → «Stripe і monobank».
- ROADMAP Етап D: «LiqPay sandbox» → «monopay (тестовий токен)».

---

## Частина 5 — Тести

Видалити 5 liqpay-тестів + `_liqpay_signed_form` + monkeypatch
`liqpay_public_key` у `test_liqpay_checkout_rejects_hidden_plan` (сам тест
переробити на monopay: monkeypatch `monopay_token`).

Нові (мок httpx-викликів — monkeypatch функцій `app.monopay.create_invoice`
/ `get_invoice_status`; підпис вебхука — monkeypatch
`verify_webhook_signature` → True, окрім тесту на invalid signature):
1. checkout → 200 `{url}`, у БД pending-підписка з monopay_invoice_id.
2. checkout прихованого плану (expert) → 400; без токена → 503.
3. webhook success → підписка active, period_end ≈ now+30d, user.plan=pro,
   Payment записаний; повторна доставка → без дублю Payment (ідемпотентність).
4. webhook reversed → user.plan=free, підписка canceled.
5. webhook failure → pending → failed, user.plan НЕ змінився.
6. webhook з невалідним підписом (verify не замокано, ключ замокано на
   фіксований) → 400.
7. sync: pending + get_invoice_status(success-мок) → active (той самий
   ефект, що вебхук).
8. Lazy-експірація: active monopay-підписка з period_end у минулому →
   будь-який authed-запит → user.plan=free, підписка expired; а Stripe-
   підписка з period_end=None → НЕ експірується.
9. Продовження: друга оплата при активній monopay-підписці →
   period_end += 30 днів (а не з now).

---

## Частина 6 — Живий E2E (СТОП-точка) + доки

**СТОП-ТОЧКА:** попроси користувача отримати ТЕСТОВИЙ токен monopay
(кабінет monobank → Еквайринг → тестовий токен) і вписати в
`services/astro-api/.env`: `MONOPAY_TOKEN=...` (не в чат). Якщо токена
поки немає — частину позначити blocked (як LiqPay раніше), mocked-тести
лишаються покриттям, і це чесно записати.

З токеном:
1. Рестарт бекенда → браузером: свіжий юзер → /pricing → «Pay with
   monobank» → тестова платіжна сторінка mono → оплатити тестовою карткою
   (дані тестових карток — у доках еквайрингу; якщо тестова сторінка
   пропонує «успішна оплата» — натиснути).
2. Редірект на /billing?monopay=1 → банер успіху → бейдж Pro → у БД:
   підписка active з period_start/end (30 днів), Payment з amount у
   копійках (35000 для 350 грн).
3. `POST /invoice/cancel` через curl → дочекатись/синкнути reversed →
   plan=free. (Вебхук на localhost не долетить — перевіряємо через sync;
   зафіксувати це обмеження. За бажанням користувача — cloudflared-тунель
   для живої перевірки вебхука, окремим кроком.)
4. Лог сирого payload статусу зберегти в scratchpad і звірити з парсером
   (грабля Stripe-періодів — не повторити).
5. `docs/DEPLOY.md`: секція monopay — токен, ПУБЛІЧНИЙ api_public_url для
   вебхука, згадка що ключ підпису тягнеться з /pubkey автоматично.
6. Оновити цей файл (Прогрес), Stage D план (4б-посилання), ROADMAP,
   плани README. Коміт(и) по частинах + пуш + синк main + `gh run watch`.

---

## Ризики
1. Поля/формати monopay API можуть відрізнятись від фактів у цьому плані —
   звіряй живцем (2.1) ПЕРШ ніж писати парсер; лог першого реального
   payload обовʼязковий (уже наступили на це зі Stripe-періодами).
2. Підпис вебхука рахується від СИРИХ байтів тіла — `await request.body()`,
   НЕ від перепарсеного JSON. Той самий патерн, що у Stripe-вебхука.
3. amount у копійках: 350 грн = 35000. Не переплутати з гривнями (LiqPay
   приймав гривні з плаваючою крапкою!).
4. Lazy-експірація НЕ повинна чіпати Stripe-підписки (period_end=None =
   чинна) — інакше понизимо платних Stripe-юзерів.
5. `redirectUrl` без invoiceId — sync шукає pending-підписку юзера; якщо
   юзер відкриє два чекаути паралельно, синкнеться остання — прийнятно
   (обидві або оплачені (обидві застосуються вебхуком у проді), або
   зайва лишиться pending і сфейлиться по validity).
6. Naive datetime у SQLite — `.replace(tzinfo=utc)` перед порівнянням.
7. Не видали випадково Stripe-логіку поруч — LiqPay-код у тому ж файлі.

## Не робити (поза скоупом)
- Токенізацію картки (wallet) і автосписання — пост-launch, потребує cron.
- Річні тарифи, проміжні періоди, пропорційний перерахунок.
- Видалення колонки `liqpay_order_id` (лишається як історія).
- Будь-які зміни Stripe-флоу.
- Чистку історичних згадок LiqPay у README/PLAN/старих планах.

## Definition of Done
1. [x] `pytest -q` — 107 passed/2 skipped; жодного liqpay-тесту, всі 10
   monopay-сценаріїв є (9 заплановані + невиконаний-live "invalid signature"
   рахувався окремо в плані, фактично зроблено 10 — checkout×3, webhook×5,
   sync, renewal, lazy-expiry×2 — сумарно 10 нових тестів).
2. [x] `tsc --noEmit && next build` — чисто.
3. [x] Міграція застосовується на чистій БД; `monopay_invoice_id` у схемі
   (перевірено і на чистій тимчасовій БД, і виявлено+виправлено прогалину
   на dev-БД `astro.db`, яка не мігрувалась автоматично поза Docker).
4. [x] `grep -ri liqpay` по `apps/frontend/app` і `services/astro-api/app` +
   `tests` — нуль збігів, крім свідомо залишеної колонки `liqpay_order_id`
   (дозволений виняток за "Не робити").
5. [~] Живий цикл з тестовим токеном — ЧАСТКОВО: checkout → реальний
   інвойс → редірект на справжню сторінку оплати monobank з правильною
   сумою/описом — підтверджено; sync/status/cancel на неоплаченому
   інвойсі — підтверджено, поведінка відповідає документації. Повний
   цикл "оплата карткою → success-вебхук → Pro" НЕ пройдено живою
   карткою — рішення користувача (немає задокументованих monobank
   test-номерів карток, ризикувати реальною оплатою не варто); ця
   гілка лишається верифікованою лише юніт-тестами. Позапланово
   знайдено й виправлено баг: банер /billing показував "успіх" для
   будь-якого повернення з ?monopay=1 незалежно від реального
   результату sync.
6. [ ] Тексти pricing/terms/privacy кажуть правду про «30 днів без
   автопродовження» (зроблено); ROADMAP ще не оновлено — наступний крок.
7. Коміти по частинах + пуш, синк main, CI зелений (3 job).
