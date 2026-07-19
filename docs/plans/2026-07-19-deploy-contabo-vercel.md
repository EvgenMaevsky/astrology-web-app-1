---
status: planned
created: 2026-07-19
updated: 2026-07-19
related: "[[ROADMAP]]"
tags: [plan, deploy, ops, contabo, vercel]
---

# План деплою: Contabo VPS (бекенд) + Vercel (фронтенд)

Покроковий **runbook**, за яким молодша модель веде власника через увесь
деплой. Це НЕ автоматичний скрипт: частина кроків — у браузері (реєстратор
домену, панелі Vercel/Stripe/monobank/Sentry), їх робить людина. Модель дає
готові блоки команд, перевіряє вивід і не переходить далі, поки крок не
підтверджено.

Канонічні чеклісти вже є — цей план їх НЕ дублює, а адаптує під **Contabo**
(замість Hetzner) і додає перевірки після кожного кроку:
- [docs/DEPLOY.md](../DEPLOY.md) — технічні кроки деплою
- [docs/LAUNCH.md](../LAUNCH.md) — go-live кроки (live-ключі, бета)

## Умовні позначки в кроках

- 🤖 **Модель** — команда, яку виконує виконавець (через `ssh` на VPS, якщо
  ключ налаштовано, АБО віддає людині скопіпастити на VPS і повертає вивід).
- 🧍 **Людина** — дія в браузері/панелі, яку модель зробити не може
  (купівля домену, DNS, кліки в дашбордах, введення платіжних ключів).
  Модель СТОП і чекає підтвердження.
- ✅ **Перевірка** — гейт: не йти далі, поки не зійшлося.

> **Межа безпеки:** введення платіжних/секретних ключів у панелі й `.env` на
> VPS — виключно дії 🧍 людини. Модель НЕ вводить чужі секрети, не купує
> домен, не тисне «оплатити». Модель готує значення (напр. `openssl rand`),
> людина вставляє.

## Ключові архітектурні рішення (прийняті, не переглядати без згоди власника)

1. **Розподіл: бекенд — на Contabo VPS у Docker Compose; фронтенд — на
   Vercel.** Так уже задумано в `infra/docker-compose.yml` (db+api+caddy) і
   DEPLOY.md. Фронтенд (Next 16) на VPS НЕ ставимо — Vercel дає CDN, білди,
   TLS і нуль навантаження на VPS.
2. **Contabo замість Hetzner** — стек той самий (будь-який Ubuntu-VPS з
   Docker). Відмінності лише в підготовці ОС: у Contabo НЕМАЄ cloud-
   firewall → фаєрвол через `ufw`; образ часто з root+пароль → хардейнинг
   SSH обов'язковий; диск великий (100–200+ ГБ) → місця з надлишком.
3. **Один uvicorn-воркер навмисно** (`docker-entrypoint.sh --workers 1`) —
   slowapi rate-limit тримає стан у пам'яті процесу. Мульти-воркер = Redis,
   поза скоупом деплою (зафіксовано в rate_limit.py і в C3-плані).
4. **Caddy сам випускає TLS** (Let's Encrypt) для `API_DOMAIN`, щойно DNS
   вказує на VPS і порти 80/443 доступні. Ніяких ручних сертифікатів.
5. **Співіснування з hermes-агентом:** не чіпаємо його. Єдина точка
   конфлікту — порти 80/443 (Caddy) і RAM/диск. Перевіряємо на старті
   (Частина 1.3), і якщо порти зайняті — гілкуємось (варіанти в кроці).

## Ключові факти середовища (перевірено 2026-07-19)

> **Ресурсний бюджет бекенд-стека на VPS (фронтенд — на Vercel, VPS не
> навантажує):**
> - Postgres 16-alpine (атлас ~30k міст + юзери): RAM ~40–150 МБ.
> - api (1 uvicorn + skyfield/numpy + de440s.bsp ~32 МБ у пам'яті):
>   RSS ~250–450 МБ.
> - caddy: ~20–40 МБ.
> - **Разом стабільно ~0.5 ГБ, пік до ~1 ГБ.** Диск: образи (python-slim
>   ~150 МБ + postgres-alpine ~80 МБ + caddy ~50 МБ + білд-шари) + дані +
>   бекапи ≈ **3–5 ГБ**.
> - **Hermes без ollama** — процес-оркестратор, десятки МБ. Важким його
>   робить ollama (ваги моделі, кілька ГБ) — без неї конкуренції за RAM
>   практично немає. Висновок: навіть найменший Contabo VPS (більший за
>   Hetzner CX22, який DEPLOY.md уже називає достатнім) вистачить.
>   Рекомендація: мати вільними **≥1 ГБ RAM і ≥10 ГБ диска** під стек +
>   запас. Реальні цифри — зняти командами в Частині 1.3, не вірити оцінці.
> - **Реальний ризик співіснування — порти, не пам'ять.** Якщо щось уже
>   слухає 80/443, Caddy не підніметься. Перевірка — Частина 1.3.
>
> **Що вже готове в репозиторії (не створювати заново):**
> - `infra/docker-compose.yml` — db (postgres:16-alpine, healthcheck) +
>   api (build ../services/astro-api, ENVIRONMENT=production, том apidata:
>   /data під skyfield) + caddy (порти 80/443, том Caddyfile+caddydata).
> - `infra/Caddyfile` — `{$API_DOMAIN:api.localhost} { reverse_proxy
>   api:8000 }`. API_DOMAIN підставляється з `.env`.
> - `infra/.env.example` — усі ключі: POSTGRES_PASSWORD, SECRET_KEY,
>   API_DOMAIN, FRONTEND_URL, API_PUBLIC_URL, CORS_ORIGINS (JSON-масив!),
>   RESEND_API_KEY, EMAIL_FROM, STRIPE_*, MONOPAY_TOKEN, SENTRY_DSN.
> - `services/astro-api/Dockerfile` + `docker-entrypoint.sh` — на старті
>   `alembic upgrade head`, потім uvicorn --workers 1. SKYFIELD_DIR=/data/
>   skyfield (том apidata) — de440s.bsp (~32 МБ) авто-качається туди при
>   першому розрахунку карти.
> - `scripts/import_geonames.py` — імпорт атласу міст; НЕ копіюється в
>   образ, заливається в контейнер вручну (DEPLOY.md крок 3).
> - `scripts/backup_db.sh` — pg_dump+gzip+ротація 14 днів (шапка з cron-
>   рядком усередині).
> - config.py: fail-fast на дефолтний SECRET_KEY при ENVIRONMENT=production
>   (тобто без валідного SECRET_KEY контейнер НЕ стартує — це фіча).
> - CORS_ORIGINS у config.py — `list[str]`, у `.env` задається JSON-ом:
>   `CORS_ORIGINS=["https://ДОМЕН"]`. З credentials `*` заборонено —
>   мусить бути точний домен фронтенда.
> - Фронтенд на Vercel потребує env `API_URL=https://api.ДОМЕН` (server
>   actions + proxy.ts middleware ходять на бекенд саме через нього).
>   Опційні: NEXT_PUBLIC_SENTRY_DSN, NEXT_PUBLIC_PLAUSIBLE_DOMAIN,
>   NEXT_PUBLIC_FEEDBACK_EMAIL (без них — фічі просто вимкнені, no-op).
> - Vercel Root Directory = `apps/frontend` (монорепо).
> - Гілка деплою: `main` (актуальна, C2 злито). CI зелений (3 job).

## Прогрес

- [ ] Частина 1 — Передумови: домен, DNS, доступ до VPS, хардейнинг, ресурси/порти
- [ ] Частина 2 — Docker + клон репо + `.env` (secrets)
- [ ] Частина 3 — Перший запуск: compose up, міграції, атлас, TLS від Caddy
- [ ] Частина 4 — Vercel: імпорт, Root Dir, env, прив'язка домену
- [ ] Частина 5 — Live-ключі: Stripe, monopay, пошта, Sentry, Plausible, feedback
- [ ] Частина 6 — Моніторинг, бекапи, наскрізна перевірка живого циклу
- [ ] DoD — див. внизу

---

## Частина 1 — Передумови: домен, DNS, доступ, ресурси

### 1.1. Домен 🧍
- Купити домен у реєстратора (напр. `zorya.app`, `zorya.com.ua`). Див.
  LAUNCH.md крок 1 (назви пропонувались, але не перевірялись на зайнятість/
  торгову марку — це на власнику).
- ✅ Домен куплений, є доступ до його DNS-панелі.

### 1.2. DNS-записи 🧍
Потрібен публічний IPv4 VPS (у панелі Contabo, розділ сервера).
- `A` запис: `api.ДОМЕН` → `<IPv4 VPS>` (бекенд за Caddy).
- Апекс `ДОМЕН` (і `www`) → Vercel налаштуємо в Частині 4 (Vercel дасть
  цільові записи). Поки що досить `api.`.
- ✅ `dig +short api.ДОМЕН` (🤖 з будь-де) повертає IP VPS. TTL міг ще не
  розійтись — якщо порожньо, зачекати й повторити.

### 1.3. Доступ до VPS + ресурси/порти (тут відповідь на «чи вистачить») 🤖
Підключення: `ssh root@<IPv4>` (Contabo дає root; пароль — у листі/панелі).
Виконати на VPS і повернути вивід:
```sh
free -h              # RAM: під стек треба ~1 ГБ вільних + запас
df -h /              # диск: треба ~10 ГБ вільних під образи+дані+бекапи
nproc                # ядра (1 воркер api — вистачить і 1–2)
ss -tlnp | grep -E ':80|:443|:5432|:8000' || echo "порти вільні"
docker --version 2>/dev/null || echo "docker ще не встановлено"
```
- ✅ **Гейт по ресурсах:** вільно ≥1 ГБ RAM і ≥10 ГБ диска → ок. Якщо
  менше — зупинити hermes/зайві процеси або апгрейднути план; НЕ
  продовжувати впритул до межі.
- ✅ **Гейт по портах:**
  - `80/443` вільні → добре, Caddy їх візьме.
  - `80/443` зайняті (напр. hermes-агент має свій веб/проксі) → РОЗВИЛКА,
    обрати з людиною:
    1. Зупинити той листенер, якщо він не потрібен назовні.
    2. Поставити app-Caddy за наявний реверс-проксі (тоді в compose
       прибрати публікацію 80/443 у caddy і проксувати з наявного
       проксі на порт api; складніше — лишити на потім).
    3. Дати наявному проксі також обслуговувати `api.ДОМЕН` → `api:8000`.
    За замовчуванням — варіант 1, якщо порти вільні можна не гілкуватись.
  - `5432` зайнятий іншим Postgres → наш іде у своєму контейнері й НЕ
    публікує 5432 назовні (лише всередині compose-мережі) — конфлікту
    нема, але зафіксувати, щоб не плутати бекапи.

### 1.4. Хардейнинг ОС (Contabo-образ часто root+пароль) 🤖
```sh
apt update && apt -y upgrade
adduser --gecos "" zoryadmin && usermod -aG sudo zoryadmin
mkdir -p /home/zoryadmin/.ssh && chmod 700 /home/zoryadmin/.ssh
# 🧍 вставити СВІЙ публічний SSH-ключ (~/.ssh/id_ed25519.pub з локальної машини):
#   echo 'ssh-ed25519 AAAA... you@mac' > /home/zoryadmin/.ssh/authorized_keys
chmod 600 /home/zoryadmin/.ssh/authorized_keys
chown -R zoryadmin:zoryadmin /home/zoryadmin/.ssh
```
- Перевірити вхід НОВОЮ сесією `ssh zoryadmin@<IP>` ДО того, як вимикати
  пароль (щоб не замкнути себе).
- Після успіху — вимкнути root-логін і парольну автентифікацію:
  `sudo sed -i 's/^#\?PermitRootLogin.*/PermitRootLogin no/; s/^#\?PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config && sudo systemctl restart ssh`
- Фаєрвол (Contabo без cloud-firewall!):
  `sudo ufw allow OpenSSH && sudo ufw allow 80/tcp && sudo ufw allow 443/tcp && sudo ufw --force enable`
- ✅ `ssh zoryadmin@<IP>` працює по ключу; `sudo ufw status` показує
  дозволені 22/80/443; root-логін і паролі вимкнені.

---

## Частина 2 — Docker + репозиторій + secrets

### 2.1. Docker Engine + Compose plugin 🤖 (від zoryadmin)
```sh
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker zoryadmin      # перелогінитись, щоб група застосувалась
docker --version && docker compose version
```
- ✅ Обидві команди друкують версії; `docker run --rm hello-world` проходить.

### 2.2. Клон репозиторію 🤖
```sh
sudo mkdir -p /opt/zorya && sudo chown zoryadmin:zoryadmin /opt/zorya
git clone <URL_РЕПО> /opt/zorya && cd /opt/zorya && git checkout main
```
- ✅ `/opt/zorya/infra/docker-compose.yml` існує; гілка `main`.

### 2.3. Secrets у `infra/.env` 🤖 готує, 🧍 вставляє значення
```sh
cd /opt/zorya/infra && cp .env.example .env
openssl rand -hex 32     # 🤖 згенерувати — це SECRET_KEY
openssl rand -hex 24     # 🤖 згенерувати — це POSTGRES_PASSWORD (без спецсимволів)
```
Заповнити `infra/.env` (🧍 редактором `nano .env`):
- `POSTGRES_PASSWORD` = згенерований вище.
- `SECRET_KEY` = згенерований вище (БЕЗ нього при ENVIRONMENT=production
  контейнер НЕ стартує — це навмисний fail-fast).
- `API_DOMAIN=api.ДОМЕН`
- `FRONTEND_URL=https://ДОМЕН` (апекс на Vercel; у листах і monopay-
  редіректі).
- `API_PUBLIC_URL=https://api.ДОМЕН` (ОБОВ'ЯЗКОВО реальний HTTPS —
  monobank шле вебхук саме сюди; localhost мовчки не спрацює).
- `CORS_ORIGINS=["https://ДОМЕН"]` — точний домен фронтенда, JSON-масив,
  НЕ `*` (з credentials `*` заборонено браузером).
- Платіжні/пошта/Sentry ключі — поки лишити порожніми або test; live —
  Частина 5. Порожній SENTRY_DSN/MONOPAY_TOKEN просто вимикає фічу.
- ✅ `grep -c '=' .env` показує заповнені рядки; SECRET_KEY і
  POSTGRES_PASSWORD не порожні; CORS_ORIGINS — валідний JSON
  (`python3 -c "import json,os; json.loads(os.environ['x'])"` з підстановкою
  — або просто візуально масив у лапках).

---

## Частина 3 — Перший запуск

### 3.1. Підняти стек 🤖
```sh
cd /opt/zorya/infra && docker compose up -d --build
docker compose ps         # db (healthy), api (up), caddy (up)
docker compose logs api --tail=40
```
- entrypoint сам виконує `alembic upgrade head` на старті.
- ✅ `docker compose ps` — усі три сервіси up, db healthy. У логах api:
  `Uvicorn running on http://0.0.0.0:8000`, без трейсбеків. Якщо api
  рестартиться в циклі — майже завжди порожній/невалідний SECRET_KEY або
  DATABASE_URL (перечитати лог, це явна помилка конфіга).

### 3.2. Перевірити міграції 🤖
```sh
docker compose exec api python -m alembic current   # має бути head-ревізія
```
- ✅ Друкує поточну ревізію (не порожньо).

### 3.3. Імпорт атласу міст 🤖 (скрипт не в образі — залити в контейнер)
```sh
cd /opt/zorya/infra
docker compose cp ../scripts/import_geonames.py api:/app/import_geonames.py
docker compose exec api python /app/import_geonames.py
```
- Качає cities15000 з GeoNames усередині контейнера й пише в `cities`
  через DATABASE_URL (у compose — Postgres).
- ✅ Скрипт завершується без помилки; швидка перевірка:
  `docker compose exec db psql -U zorya -d zorya -c "select count(*) from cities;"`
  → десятки тисяч рядків.

### 3.4. TLS + доступність бекенда 🤖
Caddy випускає сертифікат для `API_DOMAIN` автоматично (DNS з 1.2 + порти
80/443 з 1.4). Дати ~30–60 с на видачу, тоді:
```sh
curl -fsS https://api.ДОМЕН/health        # {"status":"ok"}
curl -sI https://api.ДОМЕН/health | head  # HTTP/2 200, валідний TLS
```
- ✅ `/health` віддає `{"status":"ok"}` по HTTPS без попереджень про
  сертифікат. Якщо TLS не піднявся: перевірити `docker compose logs caddy`
  (типово — DNS ще не розійшовся або 80/443 зайняті/закриті ufw).

---

## Частина 4 — Vercel (фронтенд)

### 4.1. Імпорт проєкту 🧍
- Vercel → Add New → Project → імпорт цього репо.
- **Root Directory: `apps/frontend`** (монорепо — критично).
- Framework: Next.js (визначиться сам).

### 4.2. Env-змінні проєкту Vercel 🧍
- `API_URL=https://api.ДОМЕН` (обов'язково — server actions і proxy.ts
  ходять на бекенд через нього). `NODE_ENV=production` Vercel ставить сам.
- Опційно (можна пізніше): `NEXT_PUBLIC_SENTRY_DSN`,
  `NEXT_PUBLIC_PLAUSIBLE_DOMAIN`, `NEXT_PUBLIC_FEEDBACK_EMAIL` — Частина 5.
- Deploy.
- ✅ Білд Vercel зелений; превʼю-URL відкривається, лендинг рендериться
  українською (дефолтна локаль).

### 4.3. Прив'язати домен фронтенда 🧍
- Vercel → Project → Domains → додати `ДОМЕН` (апекс) і `www.ДОМЕН`.
- Vercel покаже цільові DNS-записи (A/ALIAS для апекса, CNAME для www) —
  внести їх у DNS-панелі реєстратора (🧍).
- ✅ `https://ДОМЕН` відкривається по HTTPS; у DevTools запити з фронтенда
  йдуть на `https://api.ДОМЕН` без CORS-помилок (якщо CORS-помилка —
  перевірити `CORS_ORIGINS` у `infra/.env`, має точно збігатися з доменом
  фронтенда, і перезапустити api: `docker compose up -d api`).

### 4.4. Наскрізний sanity (без платежів) 🤖+🧍
- Реєстрація нового акаунта на `https://ДОМЕН/register` → редірект у
  дашборд. Лист підтвердження в dev-режимі не шлеться (RESEND порожній) —
  це очікувано до Частини 5.
- Розрахунок натальної карти (persons → chart) — перший розрахунок
  тягне de440s.bsp у том apidata (~32 МБ, кілька секунд).
- ✅ Карта рахується, таблиці/колесо рендеряться; у `docker compose logs
  api` видно `POST /api/v1/charts/natal 200`.

---

## Частина 5 — Live-ключі (робити, коли готові платити/слати листи)

Детальні кроки — LAUNCH.md 3–8. Після кожної зміни `infra/.env`:
`docker compose up -d api` (перечитати env). Це все 🧍 (панелі + ключі).

- **Stripe (live):** live-ключі, вебхук
  `https://api.ДОМЕН/api/v1/billing/stripe/webhook` на події
  `checkout.session.completed`, `customer.subscription.*`,
  `invoice.payment_succeeded`; `STRIPE_SECRET_KEY`,
  `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_PRO_MONTHLY` у `.env`.
- **monopay (live):** live merchant-токен → `MONOPAY_TOKEN`. Вебхук
  налаштовувати НЕ треба (URL будується сервером per-invoice з
  API_PUBLIC_URL — тому він мусить бути реальний HTTPS). **Обов'язково**
  зробити один реальний малий платіж і підтвердити апгрейд плану + рядок
  у `payments` (живий цикл оплата→вебхук картою НЕ перевірено — немає
  тестових карток mono; LAUNCH.md 4 «Known gap»).
- **Пошта (Resend):** `RESEND_API_KEY`, `EMAIL_FROM` з підтвердженого
  домену. Порожній ключ = листи лише в лог (dev).
- **Sentry:** два проєкти (fastapi/nextjs). Backend DSN → `SENTRY_DSN`
  (`infra/.env`); frontend DSN → `NEXT_PUBLIC_SENTRY_DSN` (Vercel env).
- **Plausible:** додати сайт у дашборді, `NEXT_PUBLIC_PLAUSIBLE_DOMAIN`
  у Vercel (cookie-less, без банера).
- **Feedback:** `NEXT_PUBLIC_FEEDBACK_EMAIL` у Vercel → у сайдбарі
  зʼявиться лінк «Зворотний зв'язок».
- ✅ Тестовий Stripe-платіж (test-режим) або реальний малий live: план
  апгрейдиться, вебхук `200` у логах api, рядок у `payments`.

---

## Частина 6 — Моніторинг, бекапи, фінал

### 6.1. Uptime 🧍
- UptimeRobot (або аналог): монітори на `https://api.ДОМЕН/health` і
  `https://ДОМЕН`.
- ✅ Обидва монітори «up».

### 6.2. Бекапи БД 🤖
Cron (рядок — у шапці `scripts/backup_db.sh`):
```sh
crontab -e
# додати:
0 3 * * * cd /opt/zorya/infra && sh ../scripts/backup_db.sh >> /var/log/zorya-backup.log 2>&1
```
- Одна ручна репетиція відновлення ПІСЛЯ появи першого дампа (на порожній/
  тестовій БД, не на проді наосліп):
  `gunzip -c FILE | docker compose exec -T db psql -U zorya zorya`
- ✅ Перший бекап-файл існує; репетиція відновлення пройшла без помилок.

### 6.3. Автозапуск після ребута 🤖
- Сервіси мають `restart: unless-stopped` — після ребута VPS стек
  підніметься сам (Docker daemon вмикається systemd). Перевірити:
  `sudo reboot`, за хвилину `curl -fsS https://api.ДОМЕН/health`.
- ✅ Після ребута `/health` знову `{"status":"ok"}` без ручного втручання.

### 6.4. Фінальна наскрізна перевірка 🤖+🧍
- Реєстрація → лист підтвердження реально приходить (Resend live) →
  підтвердження email працює.
- Розрахунок карти обома локалями (uk/en).
- Один реальний платіж (Stripe і/або monopay) → апгрейд плану видно в
  /billing; рядок у `payments`.
- `curl -sI https://api.ДОМЕН/health` — TLS валідний; фронтенд по HTTPS.
- ✅ Усе вище зелене. Оновити ROADMAP (зняти блокери домену/деплою) і за
  потреби LAUNCH.md (позначити виконане).

---

## Ризики
1. **Порти 80/443 зайняті hermes/іншим проксі** → Caddy не підніметься.
   Ловиться в 1.3; розвилка там же. Не піднімати compose, не розібравшись.
2. **DNS не розійшовся** → Caddy не випустить TLS, `/health` недоступний.
   Не діагностувати як «зламаний деплой» — спершу `dig +short api.ДОМЕН`.
3. **Порожній/невалідний SECRET_KEY** у prod → api рестартиться в циклі
   (навмисний fail-fast). Перший підозрюваний при crash-loop api.
4. **CORS-помилки на фронтенді** → `CORS_ORIGINS` не збігається з доменом
   Vercel (JSON-масив, точний домен, не `*`). Після правки — `up -d api`.
5. **Замкнути себе по SSH** — вимикати пароль/root ЛИШЕ після
   підтвердженого входу по ключу новою сесією (1.4).
6. **monopay живий цикл** не перевірено тестовою карткою (немає таких у
   mono) → обов'язковий один реальний малий платіж перед публічним
   анонсом mono-опції (LAUNCH.md 4).
7. **API_PUBLIC_URL не реальний HTTPS** → monopay-вебхук мовчки не
   доходить (без помилки будь-де). Перевірити значення в `.env`.
8. **ufw без правил 80/443** → TLS/сайт недоступні ззовні, хоча контейнери
   up. Contabo не має cloud-firewall, тож ufw — єдиний бар'єр, легко забути.

## Не робити (поза скоупом)
- Фронтенд на VPS (їде на Vercel; SSR-навантаження на VPS не потрібне).
- Мульти-воркер uvicorn / Redis для rate-limit (окрема інфра-задача;
  1 воркер навмисно).
- Kubernetes/оркестрація — Compose достатньо для одного VPS.
- Строгий CSP з nonce (окрема пост-launch задача, див. C3-план).
- Автодеплой бекенда (CI→VPS) — поки ручний `git pull && docker compose
  up -d --build`; конвеєр — за потреби пізніше.
- Реплікація/HA БД — рано; бекап+ротація достатньо для бети.

## Definition of Done
1. `api.ДОМЕН` віддає `{"status":"ok"}` по валідному HTTPS; стек
   (db+api+caddy) up, db healthy, автозапуск після ребута працює.
2. Атлас міст імпортовано (cities — десятки тисяч рядків); міграції на head.
3. Фронтенд на Vercel (Root `apps/frontend`) по `https://ДОМЕН`; `API_URL`
   вказує на бекенд; реєстрація + розрахунок карти обома локалями працюють
   без CORS-помилок.
4. SSH захищено (ключ, без root/пароля), ufw дозволяє лише 22/80/443.
5. Live-ключі (Stripe/monopay/Resend/Sentry/Plausible/feedback) внесені за
   потреби; хоча б один реальний платіж підтвердив апгрейд плану +
   `payments`-рядок.
6. Uptime-монітори активні; cron-бекап налаштовано, репетиція відновлення
   пройдена.
7. ROADMAP/LAUNCH.md оновлені (зняті блокери домену/деплою).

---

## Журнал деплою (заповнюється під час виконання)

| Крок | Дата | Значення/нотатки (без секретів!) |
|------|------|----------------------------------|
| Домен | _ | _ |
| VPS IPv4 | _ | _ |
| RAM/диск вільно (1.3) | _ | _ |
| Порти 80/443 (1.3) | _ | вільні / зайняті → варіант N |
| Стек up (3.1) | _ | _ |
| TLS api.ДОМЕН (3.4) | _ | _ |
| Vercel домен (4.3) | _ | _ |
| Live-платіж (5/6.4) | _ | _ |
