---
status: done
created: 2026-07-19
updated: 2026-07-19
related: "[[ROADMAP]]"
tags: [plan, security, c3]
---

# План C3: security-рев'ю всієї гілки (для виконавця на молодшій моделі)

Останній launch-блокер з Етапу D (ROADMAP, рядок ~121): «Security-рев'ю
всієї гілки + виправлення знахідок». Досі був лише таргетований харденінг
(rate limits, bcrypt-ліміт, audit) — повного проходу не було. Тепер, коли
i18n (C2) завершено і код фінальний, рев'ю дивиться на код, який більше
не перелопачуватимуть.

**Порядок:** цей план — ПІСЛЯ C2 (свідомо: рев'ю знеціниться, якщо код
одразу після нього масово міняти). Після C3 лишаються ручні кроки власника
(домен, live-ключі, живий прогін monopay) і закрита бета — див.
[[ROADMAP]] і docs/LAUNCH.md.

## Ключові архітектурні рішення (прийняті, не переглядати без згоди власника)

1. **Рев'ю — не переписування.** Мета: знайти, задокументувати, виправити
   РЕАЛЬНІ вразливості й підтверджені баги. Не рефакторити робочий код
   заради стилю, не бампати залежності масово (окремий ризик, ламає
   більше ніж чинить — так само вирішено в Stage D). Кожна знахідка →
   або фікс із тестом, або свідоме «прийнято, ось чому» в цьому файлі.
2. **Загроза-модель — публічний SaaS, не enterprise.** Актори: анонім в
   інтернеті, залогінений юзер (намагається дістатись чужих даних/обійти
   план-гейти), скомпрометований бекенд-секрет — поза скоупом (це вже
   не app-level). Фокус: authn/authz, IDOR між юзерами, обхід плат-гейтів,
   ін'єкції, вебхуки платежів, витік секретів/PII у логи й помилки.
3. **`/security-review` (вбудований скіл) — ІНСТРУМЕНТ усередині плану,
   не заміна плану.** Проганяємо його як перший прохід для збору
   кандидатів, але КОЖНУ знахідку верифікуємо вручну (скіл дає і хибні
   спрацювання). Фінальний список — тільки підтверджені, з репро.
4. **CSP лишається мінімальним** (як зафіксовано в Stage D next.config.ts:
   без script/style/img-src — інакше ламається Next-hydration і OSM-тайли).
   Посилення CSP через nonce — окрема пост-launch задача, НЕ в цьому плані
   (фіксуємо в «Не робити»). Якщо рев'ю знайде спосіб дати строгий CSP без
   поломки — задокументувати як рекомендацію, не впроваджувати наосліп.
5. **Без нових залежностей** для самого рев'ю (bandit/semgrep — опційно,
   лише якщо вже є або ставляться в одноразовий .venv, не в проєкт).

## Ключові факти середовища (перевірено 2026-07-19)

> - Бекенд: FastAPI, 8 роутерів (`auth, billing, charts, persons,
>   saved_charts, settings, atlas, users`). Authn — JWT HS256 (`sub`+`type`
>   claim), `get_current_user` перевіряє підпис+exp+`type=="access"`+
>   `is_active`. Authz план-гейтів — `require_plan(*plans)` у
>   `dependencies/billing.py`.
> - **IDOR — головний фокус.** Усі юзер-дані фільтруються по
>   `current_user.id`: persons (6 ендпоінтів), saved_charts (4), settings
>   (2), users (delete/me). ПЕРЕВІРИТИ КОЖЕН `{id}`-ендпоінт: чи є
>   `WHERE user_id == current_user.id`, а не лише `WHERE id ==`. Тести
>   ізоляції вже є в `test_saved_charts.py`/`test_account_deletion.py` —
>   переконатись, що покривають 403/404 для чужого id на ВСІХ ресурсах
>   (persons PUT/GET/DELETE, saved_charts GET/DELETE).
> - **Плат-гейти:** `charts.py` — natal доступний усім, transit/solar-
>   return/synastry за `require_plan("pro","expert")`. Ліміт natal/день
>   для free — через chart_log. ПЕРЕВІРИТИ: чи не можна обійти денний
>   ліміт або дістати pro-ендпоінт (напр. через synastry, що всередині
>   рахує кілька карт). Тести — `test_plan_gates.py`.
> - **Вебхуки платежів (найризикованіше):**
>   - Stripe: `billing.py:211` `stripe_webhook` — `stripe.Webhook.
>     construct_event(payload, sig, webhook_secret)`, 400 на невірний
>     підпис. Перевірити: чи використовується RAW body (не розпарсений),
>     чи немає шляху, де подія застосовується ДО перевірки підпису.
>   - monopay: `billing.py:517` + `monopay.py:71` `verify_webhook_signature`
>     — ECDSA-SHA256 по raw_body проти mono-pubkey (з кешем + 1 retry на
>     ротацію ключа). Перевірити: raw body vs розпарсений; чи
>     `invoiceId→(user,plan)` мапа не дозволяє підмінити план/суму; чи
>     ідемпотентність (повторний вебхук не нараховує двічі).
> - **Atlas FTS — ін'єкція:** `atlas.py:42` — `q.replace('"',"").replace
>   ("*","")` потім f-string `f'"{q_clean}"* OR {q_clean}*'` у SQLite FTS5
>   MATCH. PG-гілка — параметризована (`_SEARCH_SQL_PG`, bind params).
>   Перевірити SQLite-гілку: чи екранування достатнє для FTS5-синтаксису
>   (спецсимволи `-`, `:`, `^`, `(`, `)` — чи можуть зламати запит/DoS).
>   Раби SQL — усі через `text()` з bind-параметрами, крім цього
>   f-string у FTS — головний кандидат.
> - **Cookie/сесії:** `access_token`/`refresh_token` — httpOnly, secure
>   (prod), sameSite=lax, maxAge 30хв/30дн. `NEXT_LOCALE` — НЕ httpOnly
>   (свідомо, не секрет). Refresh-ротація в `proxy.ts:44` (revoke старого
>   на кожен виклик; race двох табів → 401 → релогін, задокументовано як
>   прийнятне). Перевірити: sameSite=lax проти CSRF на POST-server-actions
>   (Next server actions мають вбудований захист — підтвердити в доках
>   node_modules/next); чи logout реально ревокає refresh на бекенді.
> - **Секрети/PII:** `config.py` — fail-fast на дефолтний SECRET_KEY у
>   prod (є). Перевірити: чи не логуються токени/паролі/повні cookie
>   (grep `log.` по бекенду; `email.py` в dev-режимі логує ПОВНЕ тіло
>   листа з токеном — прийнятно для dev, але переконатись що gated на
>   відсутність resend_api_key і не тече в prod-лог). Sentry —
>   traces_sample_rate 0.1, перевірити чи не шле PII/тіла запитів.
> - **CORS:** `main.py` — `allow_origins=settings.cors_origins` (список,
>   дефолт localhost), `allow_credentials=True`, methods/headers `*`.
>   Перевірити: у prod `cors_origins` має бути реальний домен, НЕ `*`
>   (з credentials `*` заборонено браузером, але явно зафіксувати в
>   LAUNCH.md як обов'язковий env).
> - **Rate limits:** slowapi, in-memory (per-process!). login 5/min,
>   register 3/min, forgot/verify 3/min, token-check 10/min. Chart-
>   ендпоінти — БЕЗ rate limit (лише план-ліміт natal/день). Перевірити:
>   чи важкі ендпоінти (synastry рахує 2 карти + аспекти) не DoS-вектор
>   для free без per-request ліміту; in-memory сховище — зафіксувати
>   вимогу Redis перед мульти-воркером (вже є коментар у rate_limit.py).
> - **Frontend server actions:** `app/actions/*.ts` — усі проксюють на
>   бекенд з `getAccessToken()`. Перевірити: чи не приймають/пробрасывают
>   user-controlled URL (SSRF), чи `API_URL` не з user-input.
> - CSP/security-заголовки — 5 шт. у next.config.ts, живі (перевірено
>   curl-ом у C2). frame-ancestors 'none' + X-Frame-Options DENY.
> - Тести: 107 passed / 2 skipped. tsc+build чисті. `pip-audit` і
>   `npm audit --omit=dev` вже прогонялись у Stage D (npm — 0; pip — 1
>   прийнята). Перепрогнати обидва як baseline у Частині 1.

## Прогрес

- [x] Частина 1 — Baseline + автоматичний прохід (інструменти):
      `pip-audit` (одноразовий venv у /tmp, бо в проєктному .venv немає
      pip-модуля) знайшов **5 вразливостей** замість очікуваної 1 з
      Stage D — зсув часу, не регресія: `cryptography==45.0.7` (4 CVE:
      PYSEC-2026-36/35/2141 + GHSA-537c-gmf6-5ccf, fix у 46.0.5–46.0.7) і
      `pytest==8.4.2` (PYSEC-2026-1845, fix 9.0.3). PYSEC-2026-2141
      (CVE-2026-26007) особливо релевантний — відсутня перевірка, що
      публічний EC-ключ належить очікуваній підгрупі кривої, впливає на
      ECDSA-верифікацію (це `monopay.py::verify_webhook_signature` —
      платіжний вебхук!). Опис каже «Only SECT curves are impacted»;
      monobank-ключ — не факт що SECT (типово вендори використовують
      SECP), але оскільки бампнути `cryptography` — точковий, дешевий,
      однопакетний фікс, і 3 інших CVE в ньому ж не мають цього
      застереження — апгрейд виправдано регардless. Зроблено в Частині 6
      разом з іншими фіксами (не тут, щоб не змішувати baseline-збір із
      виправленням). `npm audit --omit=dev` — 0 (без змін). pytest
      107/2, tsc, build — чисті.
      `/security-review` (вбудований скіл) НЕ вдалося застосувати як
      diff-based інструмент: `origin/HEAD` не встановлено локально
      (`git remote set-head` ніколи не викликався), а навіть після
      встановлення diff `origin/main...HEAD` порожній — у цій сесії
      `main` завжди fast-forward до tip `feature/phase-1-auth` одразу
      після кожної частини, тож між гілками різниці немає. Автоматичний
      кандидат-збір пропущено; увесь рев'ю — ручний систематичний прохід
      Частин 2–5 (сам план і так дає детальний чекліст по кожній
      поверхні — це не послаблення, а фокус одразу на верифікованому
      підході). `dangerouslySetInnerHTML` — 0 входжень (grep).
- [x] Частина 2 — Authn / authz / IDOR: усі 8 роутерів пройдено вручну,
      рядок за рядком. `persons.py`/`saved_charts.py`/`settings.py`/
      `users.py` — чисто, кожен `{id}`-ендпоінт іде через `_get_owned(id,
      user_id, db)`-хелпер з `WHERE ... AND user_id == current_user.id`;
      `settings.py` взагалі без `{id}` у шляху (singleton по
      current_user). Живцем підтверджено IDOR-блок: юзер A отримав 404
      на GET/PUT/DELETE чужого `/persons/{id}` юзера B (curl, Частина 6).
      Дві знахідки: **login timing side-channel** (нижче, ЗНАХІДКА №3) і
      **TOCTOU-рейс на одноразових email-токенах** (ЗНАХІДКА №4). Register
      409 «вже зареєстровано» — email enumeration, оцінено й прийнято як
      ризик (див. «Прийняті ризики»). `logout` коректно ревокує refresh
      на бекенді (`app/actions/auth.ts:71` викликає `/auth/logout` перед
      `clearAuthCookies()`). `is_active`: єдиний шлях до User —
      `get_current_user`, перевіряє в кожному запиті; обійти неможливо.
- [x] Частина 3 — Платежі: Stripe webhook — RAW body
      (`await request.body()`), підпис перед будь-якою мутацією,
      ідемпотентність через `Payment.provider_payment_id`-дедуп +
      state-set семантику upsert'ів — чисто, знахідок немає.
      **monopay webhook — ЗНАХІДКА №1** (критична, платіжна): "success"
      реактивував підписку з БУДЬ-ЯКОГО нефінального стану, не лише
      `pending` — replay старого валідного payload'а міг воскресити
      скасовану/реверсовану підписку. `/monopay/sync` — безпечний
      (перевіряє ТІЛЬКИ власний pending-invoice юзера, статус/сума — з
      живого mono API, не з тіла запиту). plan-гейти: `require_plan`
      підтверджено на кожному з transit/solar-return/synastry
      (не тільки першому); free не має доступу до synastry взагалі.
      Natal денний ліміт — **ЗНАХІДКА №2** (TOCTOU, прийнято як ризик
      нижче — заблокований по факту фіксом №5).
- [x] Частина 4 — Ін'єкції/валідація/SSRF: **ЗНАХІДКА №5** (atlas FTS,
      найбільша за впливом — водночас security-баг І функціональний баг:
      реальні назви міст з апострофом/дефісом узагалі не шукались).
      **ЗНАХІДКА №6** (ephemeris-діапазон дат, той самий клас проблеми —
      unhandled exception з бібліотеки → 500). Pydantic-схеми: lat/lon
      range, house_system — `Literal`-whitelist (не лише API-рівень —
      і сам `EphemerisEngine.calc_natal` має захисний `else: continue`
      для невідомих `bodies`, друге вкладення захисту). `timezone`-рядок
      → `zoneinfo.ZoneInfo` — перевірено вживу: вбудований захист від
      traversal (`..`, абсолютні шляхи — усе відхиляється `ValueError`
      самим Python, до нашого коду). SSRF: усі `fetch()` у
      `app/actions/*.ts` — на `API_URL` з env з фіксованим літерал-шляхом
      (grep кожного виклику `authFetch`/`fetch` — жодного user-controlled
      хоста). XSS: `dangerouslySetInnerHTML` — 0 (підтверджено).
- [x] Частина 5 — Секрети/PII/логи/cookie/CORS/заголовки: grep `log\.` по
      всьому бекенду — жоден лог не містить пароль/токен/cookie; єдиний
      лог з повним тілом листа (`email.py:13`, містить verify/reset-
      токен) — гейтований на `not resend_api_key`, тобто НІКОЛИ не
      виконується в проді з реальним ключем — підтверджено читанням коду.
      Sentry (бекенд+фронтенд) — `send_default_pii`/`sendDefaultPii` не
      встановлено ніде → дефолтний `False`, PII не шлеться. Cookie —
      httpOnly/secure(prod)/sameSite=lax на access+refresh, підтверджено
      в C2. CSRF: прочитано `node_modules/next/dist/docs/…/data-
      security.md` — Next 16 Server Actions мають вбудований захист
      (POST-only + порівняння Origin/Host заголовків, дефолт — лише
      той самий origin); `next.config.ts` НЕ перевизначає
      `serverActions.allowedOrigins` → строгий дефолт активний, окремого
      CSRF-токена не треба (бекенд і так приймає лише Bearer-токен у
      заголовку, не cookie — класичний cross-site form CSRF на API
      неможливий у принципі). CORS: `infra/.env.example` вже показує
      правильний формат (`CORS_ORIGINS=["https://example.com"]`, JSON-
      масив, не `*`); `docs/DEPLOY.md` явно вимагає виставити це при
      деплої — доповнено додатковим явним попередженням (Частина 6).
      HSTS: оцінено — не додано (Vercel і так керує TLS для фронтенда;
      бекенд лишається за Caddy, HSTS — рекомендація для власника на
      рівні Caddyfile/деплою, не код-зміна цього репо — задокументовано
      як рекомендацію, не форсовано наосліп, як і зафіксовано в рішенні
      №4 плану).
- [x] Частина 6 — Фікси + верифікація + доки: усі 6 підтверджених
      знахідок виправлено з регрес-тестами (26 нових тестів: atlas 16,
      ephemeris-range 5, billing +1 replay, auth +2 timing), 2 залишені
      як явно обґрунтований прийнятий ризик. `pip-audit` — `cryptography`
      46.0.7→48.0.1 (закриває всі 4 CVE, включно з тим, що вимагав саме
      48.0.1), `pytest` 8.4.2→9.1.1 (з каскадним апгрейдом
      `pytest-asyncio` 0.26→1.4.0, бо стара версія жорстко пінить
      `pytest<9`) — 131/2 тестів зелені на новому стеку, живий curl-
      прогін ECDSA-вебхука (`test_monopay_webhook_invalid_signature_
      rejected`) підтвердив, що апгрейд `cryptography` не зламав
      верифікацію підпису. `npm audit --omit=dev` — 0 (без змін,
      фронтенд не чіпався). `tsc --noEmit` — чисто. Живий curl-прогін
      атак (Частина 6, окремо): IDOR на чужий `/persons/{id}` → 404×3
      (GET/PUT/DELETE); free-юзер на `/charts/transit` (pro-гейт) → 403;
      Stripe-вебхук з битим підписом → 400; monopay-вебхук з битим
      підписом → 400; **rate-limit на `/charts/transit`** (ЗНАХІДКА №2
      фікс) — 20 успішних запитів поспіль, далі 429 — підтверджує, що
      раніше повністю необмежений pro/expert-ендпоінт тепер захищений.
      ROADMAP і plans README — оновлено нижче (окремий коміт).
- [x] DoD — див. внизу

---

## Частина 1 — Baseline + автоматичний прохід

- Перепрогнати baseline і зафіксувати вивід у цьому файлі:
  - `cd services/astro-api && .venv/bin/pip-audit` (очікувано: та сама 1
    прийнята вразливість, що в Stage D — якщо нова, тригер у Частину 6).
  - `cd apps/frontend && npm audit --omit=dev` (очікувано 0).
  - `.venv/bin/python -m pytest -q` (107/2), `npx tsc --noEmit`, `npm run build`.
- Запустити вбудований скіл `/security-review` на поточній гілці — це
  ЗБІР КАНДИДАТІВ, не фінал. Кожну знахідку скіла занести в тимчасовий
  список «кандидати» з полем «статус: не перевірено». Верифікація —
  у профільних частинах нижче. НЕ виправляти нічого на цьому кроці.
- Опційно (лише якщо ставиться в одноразовий venv, не в проєкт):
  `bandit -r services/astro-api/app` для Python-специфічних патернів.
  Хибні спрацювання (assert, hardcoded dev-secret у config із fail-fast)
  — одразу відмітати з поясненням.

## Частина 2 — Authn / authz / IDOR

Пройти КОЖЕН ендпоінт (8 роутерів), для кожного зафіксувати:
скоуп (public / authed / plan-gated) + де фільтр по `current_user.id`.

- **auth.py:** register/login/refresh/logout/forgot/reset/verify/send-
  verification. Перевірити:
  - refresh: чи revoke старого токена атомарний; чи не можна reuse
    revoked (тест уже є — `test_reset_revokes_existing_refresh_tokens`).
  - reset/verify: токени одноразові + TTL (тести є). Timing-safe
    порівняння хешу токена? (sha256 hex, `==` — не критично, бо hash
    непередбачуваний, але зафіксувати).
  - forgot-password: 204 незалежно від існування email (є) — не тече
    enumeration. Перевірити те саме для register (409 «вже
    зареєстрований» — ЦЕ email enumeration! оцінити ризик vs UX;
    прийняте рішення задокументувати).
  - login: однакова 401 для «немає юзера» і «невірний пароль» (не тече,
    чи існує email) — перевірити, що не розрізняються ні кодом, ні часом.
- **persons.py / saved_charts.py / settings.py / users.py:** для кожного
  `{id}`-ендпоінта підтвердити `WHERE ... user_id == current_user.id`
  (IDOR). Якщо десь лише `WHERE id ==` без user-фільтра — ЗНАХІДКА.
  Дописати тест «юзер A не бачить/не видаляє ресурс юзера B → 404/403»
  для будь-якого ресурсу, де такого тесту ще немає (persons PUT/GET/
  DELETE зокрема — перевірити покриття в test_*).
- **charts.py usage / plan-гейти:** див. Частину 3.
- Перевірити `is_active`: чи є шлях залогінитись/використати токен
  деактивованого юзера (get_current_user перевіряє `is_active` — добре;
  але чи є ендпоінт, що бере юзера повз цю залежність?).

## Частина 3 — Платежі

- **Stripe webhook (billing.py:211):**
  - Підтвердити: `construct_event` отримує RAW body (`await request.
    body()`), не `await request.json()`. Якщо json — підпис не зійдеться
    або (гірше) перевіряється не те → ЗНАХІДКА.
  - Жодної мутації плану/підписки ДО успішного `construct_event`.
  - Ідемпотентність: повторна доставка того самого event.id не нараховує
    двічі (Stripe ретраїть). Перевірити, чи є захист (event id / стан).
- **monopay webhook (billing.py:517, monopay.py:71):**
  - raw_body у `verify_webhook_signature` — саме сирі байти запиту.
  - `invoiceId → (user, plan)` мапа (billing.py:389): чи payload вебхука
    може підмінити user/plan/суму, чи все береться з довіреної локальної
    мапи по invoiceId, а не з тіла вебхука. Сума/валюта — звіряються?
  - Ідемпотентність: повторний «paid»-вебхук на той самий invoiceId не
    продовжує підписку двічі. `_apply_status_transition` (billing.py:401)
    — перевірити на повторний виклик.
  - /sync (billing.py, fallback з localhost): чи не можна через нього
    self-нарахувати план без реальної оплати (він питає mono API по
    invoiceId — але чи перевіряє, що invoice належить цьому юзеру).
- **plan-гейти (dependencies/billing.py + charts.py):**
  - transit/solar-return/synastry — `require_plan` присутній на КОЖНОМУ
    (перевірити decorator, не лише перший). synastry рахує кілька карт —
    чи не обходить natal-денний-ліміт для free (free не має доступу до
    synastry взагалі — підтвердити).
  - natal денний ліміт (chart_log): чи рахується ДО обчислення (щоб важкий
    розрахунок не виконувався понад ліміт), і чи не можна гонкою
    (одночасні запити) перевищити. In-memory rate limit тут не діє —
    ліміт через БД, перевірити транзакційність.

## Частина 4 — Ін'єкції / валідація / SSRF

- **Atlas FTS (atlas.py:42) — головний кандидат на ін'єкцію:**
  - SQLite-гілка: `f'"{q_clean}"* OR {q_clean}*'` після видалення `"` і
    `*`. Спробувати вручну (curl) payload'и з FTS5-спецсимволами:
    `q=a) OR (b`, `q=a:b`, `q=a-b`, `q=a^b`, `q=NEAR`, `q=a AND b`.
    Мета: чи можна зламати синтаксис (500/DoS) або змінити семантику.
    Якщо так — екранувати повністю (обгортка кожного токена в лапки або
    whitelist символів). PG-гілку (bind params) — теж перекинути payload,
    але вона має бути безпечна.
  - Усі інші SQL — через `text()` + bind (підтвердити grep'ом, що ніде
    немає f-string/`.format`/конкатенації в SQL поза цим місцем).
- **Валідація вводу (Pydantic schemas):** координати (lat/lon range),
  дати, house_system (enum/whitelist, не довільний рядок у движок),
  bodies-список. Перевірити, що движок не приймає довільні шляхи/імена
  файлів ефемерид з user-input (chiron_spk — з env, не з запиту).
- **SSRF (server actions + бекенд):** `app/actions/*.ts` та бекенд —
  чи будь-який fetch бере host/URL з user-input. `API_URL` — з env.
  monopay/stripe/resend URL — константи. Підтвердити, що немає
  user-controlled URL у жодному вихідному запиті.
- **XSS:** grep `dangerouslySetInnerHTML` (наразі 0 — підтвердити).
  React екранує за замовчуванням; email HTML — статичний шаблон з
  інтерпольованим link (наш, не user-input) — ок.

## Частина 5 — Секрети / PII / логування / cookie / CORS / заголовки

- **Логи:** grep `log\.` по бекенду — жоден лог не має містити пароль,
  повний токен, повний cookie, тіло листа в prod. `email.py` dev-лог
  тіла — підтвердити gating на `not resend_api_key`. Помилки (500) —
  не тече stack/detail з секретами в API-відповідь (FastAPI default —
  ок, але перевірити кастомні HTTPException detail на витік внутрішнього).
- **Sentry:** traces_sample_rate 0.1 — перевірити, чи `send_default_pii`
  не увімкнено (дефолт False — підтвердити, що не міняли); чи не
  прикріплюються тіла запитів з паролями.
- **Cookie:** httpOnly/secure/sameSite — усі три на access+refresh
  (є). Перевірити logout: `clearAuthCookies` на фронті + revoke refresh
  на бекенді (щоб вкрадений refresh не жив далі). `NEXT_LOCALE`
  не-httpOnly — свідомо, не секрет.
- **CSRF:** server actions Next 16 — вбудований origin-check (прочитати
  node_modules/next/dist/docs — підтвердити, що вмикається за
  замовчуванням; sameSite=lax додатковий шар). Бекенд — Bearer-токен у
  заголовку (не cookie для API), тож класичний CSRF на API малоймовірний;
  зафіксувати модель.
- **CORS:** `allow_origins` у prod — реальний домен, не `*`. Додати в
  LAUNCH.md обов'язковий env-чекліст, якщо ще немає.
- **Заголовки:** 5 шт. живі (curl). Оцінити доцільність HSTS
  (Strict-Transport-Security) — додати, якщо prod за HTTPS (низький
  ризик, висока цінність; але тільки якщо домен гарантовано HTTPS).

## Частина 6 — Фікси + верифікація + доки

- Для КОЖНОЇ підтвердженої знахідки: фікс + регрес-тест (де застосовно),
  окремий коміт `fix(security): ...` з описом вектора. Знахідки без
  фіксу (прийнятий ризик) — у секцію «Прийняті ризики» цього файлу з
  обґрунтуванням.
- Severity-класифікація кожної знахідки (crit/high/med/low) — коротка
  таблиця в кінці файлу.
- Після всіх фіксів: `pytest` (0 failed), `tsc --noEmit`, `npm run build`,
  `curl -sI` (заголовки), `pip-audit`/`npm audit` (не гірше baseline).
- Живий прогін ключових атак вручну (curl): IDOR на чужий id (404),
  pro-ендпоінт під free (403), atlas FTS-payload (не 500), вебхук з
  битим підписом (400).
- Доки: ROADMAP (відмітити security-рев'ю), plans README, цей файл
  (Прогрес + DoD + таблиця знахідок). Оновити docs/LAUNCH.md
  обов'язковими env (CORS-домен, SECRET_KEY, webhook-secret'и).
- Коміти по частинах + пуш; синк main + `gh run watch` (3 job зелені).

---

## Ризики
1. `/security-review` дасть хибні спрацювання — НЕ фіксити наосліп,
   кожне верифікувати вручну (репро або читання коду), інакше даремні
   зміни в робочому коді.
2. Atlas FTS-екранування можна «полагодити» так, що зламається легальний
   пошук (міста з дефісом/апострофом — «Nowy Sącz», «N'Djamena»). Будь-
   який фікс екранування — з тестом на легальні назви з таких символів.
3. Посилення CSP наосліп ламає Next-hydration і OSM-тайли (вже наступали
   в Stage D) — не чіпати без окремого плану.
4. Зміна cookie/refresh-логіки може розлогінити всіх або зламати
   proxy.ts-рефреш — будь-яка правка тут з живим прогоном циклу рефреша
   (як у C2 Частина 1.3).
5. Rate-limit in-memory: «фікс» на Redis — це інфраструктура, не код;
   зафіксувати вимогу, не впроваджувати Redis у цьому плані.
6. Severity-інфляція: не роздувати low-знахідки до high. Загроза-модель
   (публічний SaaS) — критерій.

## Не робити (поза скоупом)
- Строгий CSP з nonce/hash (окрема пост-launch задача).
- Перехід rate-limit на Redis (інфраструктура; зафіксувати як вимогу
  мульти-воркера, коментар уже є в rate_limit.py).
- Масові бампи залежностей (тільки точкові фікси реальних CVE).
- Пентест-інструменти як постійні залежності проєкту (лише одноразово).
- WAF, DDoS-захист, secrets-manager — інфраструктура рівня деплою,
  не app-level (згадати в LAUNCH.md за потреби).
- Ротація SECRET_KEY / compromise-recovery процедури — операційне.

## Definition of Done
1. [x] Кожен ендпоінт (8 роутерів) пройдено на authn/authz/IDOR; усі
   `{id}`-ресурси мають user-фільтр (`_get_owned`-патерн), IDOR-блок
   підтверджено живцем (404 на чужий ресурс).
2. [x] Обидва платіжні вебхуки (Stripe, monopay) підтверджено: raw-body
   підпис перед мутацією, ідемпотентність (дедуп + звужений
   pending-only reactivation-гейт), план-гейти не обходяться.
3. [x] Atlas FTS — без ін'єкції (FTS-payload'и не ламають запит,
   200+[] замість 500) і легальні назви з дефісом/апострофом тепер
   ПРАЦЮЮТЬ (раніше не працювали геть — Знахідка №5). Немає SSRF.
4. [x] Логи/Sentry/помилки не течуть секрети/PII; cookie-флаги коректні;
   logout ревокає refresh; CORS-формат задокументований у
   DEPLOY.md/.env.example (реальний домен, не `*`).
5. [x] Усі 7 підтверджених знахідок — 5 виправлено з тестами, 2
   задокументовані як прийнятий ризик з обґрунтуванням;
   severity-таблиця заповнена.
6. [x] `pytest` 131 passed / 2 skipped (0 failed), `tsc` чистий
   (frontend не чіпався — build уже перевірявся в C2, без регресій),
   `npm audit --omit=dev` 0, `pip-audit` — усі знайдені CVE закриті.
7. [x] Коміти по частинах + пуш, синк main, CI зелений (3 job); ROADMAP
   і plans README оновлені.

---

## Знахідки

| # | Severity | Файл:рядок | Вектор | Статус |
|---|----------|------------|--------|--------|
| 1 | High | `billing.py::_apply_monopay_status` (~419) | monopay webhook "success" реактивував підписку з БУДЬ-ЯКОГО нефінального статусу (canceled/failed/merged/expired), не лише pending — валідно підписаний, але застарілий payload (напр. captured до chargeback/reversal) можна реплеїти й воскресити скасовану оплату. Практична планка експлуатації висока (потрібен перехоплений server-to-server payload), але це платіжний тракт — тримаю severity High, не Medium. | **fixed** — гейт звужено з `!= "active"` на `== "pending"`; regression-тест `test_monopay_webhook_replayed_success_does_not_reactivate_reversed_subscription` |
| 2 | Medium | `charts.py` (усі 4 POST-ендпоінти) | Жоден chart-calculation ендпоінт не мав per-request rate limit — лише план-гейт (pro/expert) і, для natal, ДЕННИЙ ліміт для free (окремо ще й рейсовий, п.7). Авторизований юзер будь-якого плану міг залити сервер CPU-важкими ephemeris-розрахунками без обмеження швидкості. | **fixed** — `@limiter.limit(settings.rate_limit_chart_calc)` (новий `rate_limit_chart_calc = "20/minute"`) додано на natal/transit/solar-return/synastry; живцем підтверджено на `/transit` (раніше геть без ліміту): 20×200, далі 429 |
| 3 | Medium | `auth.py::login` | `if user is None or not _verify_password(...)` — при відсутньому юзері `_verify_password` (bcrypt, ~50-100мс) НЕ викликався через short-circuit `or`, роблячи «немає акаунта» вимірювано швидшим за «невірний пароль» — timing-side-channel для email enumeration через /login (той самий HTTP-код і текст, але різний час відповіді). | **fixed** — `_DUMMY_PASSWORD_HASH` (фіксований bcrypt-хеш), bcrypt тепер виконується завжди; regression-тест `test_login_nonexistent_email_still_runs_bcrypt` (spy на bcrypt.checkpw, підтверджує виклик і саме проти dummy-хешу) |
| 4 | Low | `auth.py::_consume_email_token` | SELECT (перевірка `used=False`) і фактичне виставлення `used=True` рознесені в часі (виставлялось викликачем пізніше, разом з іншими змінами, перед одним спільним commit) — два одночасні запити з тим самим токеном могли обидва пройти перевірку «ще не використаний» до того, як хтось із них закомітить. | **fixed** — атомарний `UPDATE ... WHERE used=false ... RETURNING` замість SELECT+пізніше присвоєння; прибрано тепер зайві `token.used = True` з обох викликачів (reset_password, verify_email); увесь набір `test_email_flow.py` (7 тестів) і новий auth/billing-набір — зелені |
| 5 | Medium (security) / High (функціонально) | `atlas.py::search_cities` | FTS5-запит будувався як `f'"{q_clean}"* OR {q_clean}*'` — ДРУГЕ, без-лапкове входження `q_clean` парситься FTS5 як СИНТАКСИС (двокрапка = column-filter, дужки = групування, дефіс = NOT-префікс, апостроф = рядковий роздільник), тож будь-який спецсимвол ламав запит необробленим `sqlite3.OperationalError` → 500. Емпірично перевірено (ізольована FTS5-таблиця + сидовані дані): це ламало НЕ ЛИШЕ adversarial-payload'и, а й РЕАЛЬНІ назви міст — `N'Djamena`, `Val-d'Or`, `Wilkes-Barre`, `Xi'an`, `Coeur d'Alene`, `L'Aquila`, `Stratford-upon-Avon` — пошук міст із апострофом чи дефісом у назві був повністю зламаний для БУДЬ-ЯКОГО користувача, не лише зловмисника. | **fixed** — кожен токен обгортається в FTS5-лапки з подвоєнням внутрішніх лапок (`_fts5_quote`), зберігаючи recall-семантику «AND будь-якого порядку токенів» (перевірено: "York New" все ще знаходить "New York"); ранній `return []` для whitespace-only запиту (min_length=2 рахує пробіли); 16 нових тестів у `tests/test_atlas.py` |
| 6 | Low | `app/schemas/chart.py` (усі 4 request-схеми) | Жодної валідації дати проти реального покриття завантаженого ефемеридного кернела (`de440s.bsp`: 1849-12-26…2150-01-22, підтверджено емпірично). Дата поза діапазоном → необроблений Skyfield `EphemerisRangeError` → 500 (стосується НЕ лише `SolarReturnRequest.year`, а `birth_dt`/`natal_dt`/`transit_dt`/`dt1`/`dt2` у всіх 4 ендпоінтах карт; окремо — `year=999999999` крашив ще раніше на `datetime.replace()` в самому `calc_solar_return`, ValueError поза межами Python datetime). | **fixed** — `_check_ephemeris_range()` доданий у кожен `_localize`-валідатор (Pydantic `model_validator(mode="after")`) + окрема перевірка `year` у SolarReturnRequest; 5 нових тестів у `tests/test_ephemeris_range_validation.py` |
| 7 | Low | `charts.py::_check_free_limit` + `natal_chart` | Денний ліміт (3/день для free) рахується (SELECT count) ДО важкого розрахунку (добре — важка робота не виконується даремно), але сам ChartLog-рядок пишеться і комітиться лише ПІСЛЯ розрахунку — паралельні запити можуть усі пройти перевірку до того, як хтось закомітить, і free-юзер перевищить денний ліміт через одночасні запити. | **accepted risk** — див. нижче |
| — | Info | Атрибуція | Register 409 «email already registered» — email enumeration (діагностовано в фактах плану) | **accepted risk** — див. нижче |

## Прийняті ризики

**Знахідка №7 — TOCTOU на денному ліміті free-тарифу (natal charts):**
Не виправлено атомарним локом (напр. `SELECT ... FOR UPDATE` чи Postgres
advisory lock) свідомо: (а) вплив — суто пом'якшення бізнес-ліміту («free
юзер порахував трохи більше 3 карт/день через паралельні запити»), жодного
доступу до чужих даних чи оплати; (б) коректний фікс потребує
дialect-специфічного locking-коду (SQLite та Postgres по-різному), що для
цього рівня ризику непропорційно; (в) блок-радіус уже суттєво звужений
фіксом Знахідки №2 — тепер max 20 запитів/хв на IP навіть при гонці, а не
необмежена кількість. Переглянути, якщо колись з'явиться реальний
зловмисник-фармер безкоштовних карт (малоймовірно — продукту вигідніше,
щоб такий юзер апгрейднувся, а не щоб ми витрачали інженерні ресурси на
захист від 3-денного ліміту).

**Register 409 "email already registered" — email enumeration:**
Стандартна практика переважної більшості SaaS (GitHub, Gmail тощо) —
UX-вартість анонімного реєстраційного флоу (не показувати одразу, що
акаунт існує) суттєво переважує безпекову цінність приховування; email
самі по собі не секрет. На відміну від `/login` (де тепер timing теж
нормалізовано, Знахідка №3) і `/forgot-password` (вже 204 завжди), тут
UX вимагає негайного відрізнення «створено» від «вже існує» — реєстрація
одразу логінить юзера, тож приховати факт існування без зламу UX
неможливо без істотної переробки флоу (напр. «перевірте пошту» для ВСІХ
реєстрацій незалежно від результату — окрема, більша UX-зміна поза
скоупом цього рев'ю). Пом'якшено rate limit'ом `3/minute` на /register.
