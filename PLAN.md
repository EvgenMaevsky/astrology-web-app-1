# ZET Geo Web — Аналіз і план розробки

> Дата: 2026-05-22  
> Джерело: реверс-інжиніринг `d:\Dev\astrology\Zet9 Geo` + аналіз існуючого `web-app`

---

## 1. Існуючий стан проекту

В `d:\Dev\astrology\web-app` вже закладено перший шар:

| Компонент | Технологія | Статус |
|---|---|---|
| Frontend | Next.js 16 + React 19 + Tailwind CSS 4 | Scaffold + natal form |
| Backend | FastAPI (Python) | Health + stub `/api/v1/charts/natal` |
| Контракт | JSON Schema (`chart-request.schema.json`) | Визначено |
| Перший план | `docs/superpowers/plans/2026-05-22-birth-data-flow.md` | Виконано |

**Висновок:** стек зафіксований — **Next.js + FastAPI**. Весь план нижче будується на цьому.

---

## 2. Аналіз ZET9 Geo (Delphi, ~2001–2013)

### 2.1 Технологічна база оригіналу

- **Мова:** Delphi (Borland/Embarcadero Pascal)
- **GUI:** VCL (Windows-only)
- **Ephemeris:** Swiss Ephemeris (SE1 binary формат, файли в `Swiss/`)
- **БД:** MS Access `.mdb` + власні бінарні `.dat` індекси
- **Конфіг:** INI-файли (1472 рядки в `Main.ini`)
- **Карти:** Google Maps API v2 (застарілий) + власні `.dat` геодані

### 2.2 Функціональні зони (що переносити)

#### Розрахунки (ядро)
- Натальна карта (планети, куспіди, Аscendant/MC)
- Транзити — поточне небо накладається на натал
- Прогресії — вторинні, сонячні дуги
- Соляр (Solar Return) — річна карта
- Синастрія — дві карти разом
- Дирекції (Primary Directions — Kepler/Placidus)
- Гороскоп питань (Horary)
- Мунданна астрологія

#### Системи будинків
Placidus, Regiomontanus, Campanus, Koch, Equal, Morinus, Topocentric, Whole Sign

#### Небесні тіла
- Планети (Sun–Pluto), вузли, Ліліт
- Астероїди: 100+ (Chiron, Ceres, Pallas, Juno, Vesta + нумеровані)
- Зірки: каталог Hipparcos (500+ іменованих), каталог Yale
- Глибокі об'єкти (M31, M42 тощо)
- Супутники планет (60+ місяців, JPL-дані)

#### Аспекти
- Конфігурації: 80+ профілів (Natal, Transit, Horary, Medieval, Vedic...)
- Типи: від кон'юнкції до нонагону
- Орби: змінні по планеті, типу, будинку
- Деклінаційні аспекти (паралелі, контрапаралелі)
- Антисція

#### Системи градусів та тлумачень
| Формат | Системи |
|---|---|
| `.dgr` | Classic, Modern, Paul (Sabian) |
| `.dec` | Chaldean, Hindu, Hindu Moon, Modern, Manilius |
| `.ter` | Beruni, Egyptians, Lilly, Ptolemy, Vettius Valens |
| `.trr` | Dorotean, Morin, Ptolemy (тригонні управителі) |
| `.lat` | Almagest, AstroMtx, ET Astro, Radix4, Winstar |
| `.prs` | Арабські частини: Pauline, Romanov, Globa, Beruni (100+) |

#### Геодані та атлас
- **ATLAS:** 50 `.dat` файлів — міста за країнами
- **ATLASII:** 274 `.dat` файли — глобальний індекс (A–Z)
- **GeoData:** кордони, берегова лінія, річки, озера
- **GTOPO30:** цифрова модель рельєфу
- **Zones:** база часових поясів із DST-правилами
- Загалом: **50 000+** міст зі координатами

#### Звіти та експорт
- HTML-таблиці аспектів (з CSS `zasp.css`)
- Текстові ефемеріди за діапазон дат
- Місячний VoC (Void-of-Course)
- Місячні фази та затемнення
- Планетарні години
- Китайський календар / Тотем
- PDF (через Wrk-буфер)

#### Спеціалізовані функції
- Планетарій / Sky Chart (реальне небо)
- Астрокартографія (ACG — планетарні лінії на карті)
- Ведична астрологія: Vimshottari Dasha, Накшатри, Фірдарія
- Алмутен, Гілег, прийом/диспозиція (середньовічні методи)
- Ректифікація (пошук часу народження)
- Циклічний індекс
- Пошук за подією по ефемеридам

### 2.3 Формати даних для міграції

| Формат ZET9 | Цільовий формат Web |
|---|---|
| `.dat` (Atlas) | PostgreSQL + PostGIS `POINT` |
| `.se1` (Swiss Ephem) | Прямий re-use через `pyswisseph` |
| `.dat` (Zones) | PostgreSQL таблиця + `pytz`/`zoneinfo` |
| `.dgr/.dec/.ter` | JSON-довідники в БД або статичні файли |
| `.prs` (Arabic Parts) | JSON конфіги |
| `.a2/.asp` (аспекти) | JSON профілі |
| `.mdb` (Yale, Planets) | PostgreSQL (one-time import) |
| `Main.ini` (UI прefs) | `user_settings` JSONB колонка |
| `.crt` (Charts) | `charts` таблиця + JSON payload |
| `.zfn` (fonts) | Конвертація в WOFF2 (ZastroCC вже TTF) |

---

## 3. Архітектура веб-застосунку

```
┌──────────────────────────────────────────────────────┐
│  Browser                                             │
│  Next.js 16 (App Router) · React 19 · Tailwind 4   │
│  SVG Chart Wheel · Leaflet Map · shadcn/ui          │
└──────────────────────┬───────────────────────────────┘
                       │ HTTP / WebSocket
┌──────────────────────┴───────────────────────────────┐
│  FastAPI (Python 3.12)                               │
│  Auth · Charts · Atlas · Reports · Billing          │
│  pyswisseph (Swiss Ephemeris binding)               │
└────────┬─────────────┬──────────────┬────────────────┘
         │             │              │
    PostgreSQL       Redis         Celery
    + PostGIS       (cache)       (PDF, heavy calc)
```

### Структура репозиторію (розвиток `web-app`)

```
web-app/
├── apps/
│   └── frontend/               # Next.js (вже є)
│       └── src/app/
│           ├── (auth)/         # login, register, forgot-password
│           ├── (dashboard)/    # persons, charts, reports
│           ├── (billing)/      # plans, checkout
│           └── _components/
├── services/
│   └── astro-api/              # FastAPI (вже є)
│       └── app/
│           ├── routers/
│           │   ├── auth.py
│           │   ├── charts.py
│           │   ├── atlas.py
│           │   ├── reports.py
│           │   └── billing.py
│           ├── ephemeris/      # pyswisseph обгортка
│           ├── models/         # Pydantic + SQLAlchemy
│           └── tasks/          # Celery tasks
├── packages/
│   └── contracts/              # JSON Schema (вже є)
├── scripts/
│   └── migrate-zet9/           # парсери .dat/.dgr/.prs
└── infra/
    ├── docker-compose.yml
    └── nginx.conf
```

---

## 4. Схема бази даних

### 4.1 Акаунти та підписки

```sql
CREATE TABLE users (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email       TEXT UNIQUE NOT NULL,
    password_h  TEXT NOT NULL,
    plan        TEXT NOT NULL DEFAULT 'free',  -- free|pro|expert
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE user_settings (
    user_id         UUID PRIMARY KEY REFERENCES users(id),
    timezone        TEXT DEFAULT 'Europe/Kyiv',
    default_lat     FLOAT,
    default_lon     FLOAT,
    house_system    TEXT DEFAULT 'placidus',
    aspect_profile  TEXT DEFAULT 'natal',
    ui_prefs        JSONB DEFAULT '{}'
);

CREATE TABLE subscriptions (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID REFERENCES users(id),
    plan                TEXT NOT NULL,
    status              TEXT NOT NULL,  -- active|canceled|past_due
    stripe_sub_id       TEXT,
    liqpay_order_id     TEXT,
    period_start        TIMESTAMPTZ,
    period_end          TIMESTAMPTZ,
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE payments (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID REFERENCES users(id),
    amount_cents        INTEGER NOT NULL,
    currency            TEXT NOT NULL DEFAULT 'USD',
    provider            TEXT NOT NULL,  -- stripe|liqpay
    provider_payment_id TEXT,
    status              TEXT NOT NULL,  -- pending|succeeded|failed
    created_at          TIMESTAMPTZ DEFAULT NOW()
);
```

### 4.2 Персони та карти

```sql
CREATE TABLE persons (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    birth_dt    TIMESTAMPTZ NOT NULL,
    timezone    TEXT NOT NULL,
    lat         FLOAT NOT NULL,
    lon         FLOAT NOT NULL,
    city_label  TEXT,
    notes       TEXT,
    is_public   BOOLEAN DEFAULT FALSE,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE charts (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    person_id   UUID REFERENCES persons(id) ON DELETE CASCADE,
    type        TEXT NOT NULL,  -- natal|transit|synastry|solar_return|...
    config      JSONB NOT NULL DEFAULT '{}',  -- house_system, aspect_profile тощо
    data        JSONB,          -- кешований результат розрахунку
    computed_at TIMESTAMPTZ,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE chart_notes (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chart_id    UUID REFERENCES charts(id) ON DELETE CASCADE,
    user_id     UUID REFERENCES users(id),
    body        TEXT NOT NULL,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);
```

### 4.3 Геодані (міграція з ZET9 Atlas)

```sql
CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE cities (
    id          SERIAL PRIMARY KEY,
    name        TEXT NOT NULL,
    name_ru     TEXT,
    country     CHAR(2) NOT NULL,
    region      TEXT,
    location    GEOGRAPHY(POINT, 4326) NOT NULL,
    timezone    TEXT NOT NULL,
    population  INTEGER
);
CREATE INDEX ON cities USING GIST (location);
CREATE INDEX ON cities (name text_pattern_ops);
CREATE INDEX ON cities (country);

CREATE TABLE timezones (
    id          TEXT PRIMARY KEY,  -- 'Europe/Kyiv'
    utc_offset  INTERVAL NOT NULL,
    dst_rules   JSONB
);
```

### 4.4 Астрологічні довідники (міграція з ZET9)

```sql
-- Системи градусів (з .dgr/.dec файлів)
CREATE TABLE degree_systems (
    id      TEXT PRIMARY KEY,  -- 'sabian', 'classic', 'chaldean'...
    name    TEXT NOT NULL,
    source  TEXT              -- 'ptolemy', 'lilly' тощо
);

CREATE TABLE degree_interpretations (
    system_id   TEXT REFERENCES degree_systems(id),
    sign        INTEGER,      -- 0–11
    degree      INTEGER,      -- 0–29
    text        TEXT NOT NULL,
    PRIMARY KEY (system_id, sign, degree)
);

-- Арабські частини (з .prs файлів)
CREATE TABLE arabic_parts (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    system      TEXT,         -- 'pauline', 'globa', 'beruni'
    formula     JSONB NOT NULL -- {asc: 1, plus: 'moon', minus: 'sun'}
);

-- Профілі аспектів (з .a2/.asp файлів)
CREATE TABLE aspect_profiles (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    config      JSONB NOT NULL  -- типи аспектів + орби
);
```

---

## 5. API ендпоінти

### Auth

```
POST   /api/v1/auth/register        { email, password }
POST   /api/v1/auth/login           { email, password } → JWT
POST   /api/v1/auth/refresh
DELETE /api/v1/auth/logout
POST   /api/v1/auth/forgot-password
POST   /api/v1/auth/reset-password
```

### Персони і карти

```
GET    /api/v1/persons              → список персон юзера
POST   /api/v1/persons              { name, birth_dt, timezone, lat, lon }
GET    /api/v1/persons/:id
PUT    /api/v1/persons/:id
DELETE /api/v1/persons/:id

POST   /api/v1/charts/natal         { person_id, house_system, aspect_profile }
POST   /api/v1/charts/transit       { natal_id, target_dt }
POST   /api/v1/charts/synastry      { person1_id, person2_id }
POST   /api/v1/charts/solar-return  { person_id, year }
POST   /api/v1/charts/progression   { person_id, target_dt, type }
GET    /api/v1/charts/:id
```

### Атлас

```
GET    /api/v1/atlas/search?q=Kyiv&limit=10&country=UA
GET    /api/v1/atlas/cities/:id
GET    /api/v1/atlas/timezone?lat=50.45&lon=30.52&dt=2024-01-01
```

### Ефемеріди

```
GET    /api/v1/ephemeris/planets?dt=2026-05-22&lat=50&lon=30
GET    /api/v1/ephemeris/range?from=2026-01-01&to=2026-02-01&bodies=sun,moon
GET    /api/v1/ephemeris/moon-phases?year=2026
GET    /api/v1/ephemeris/void-of-course?from=2026-05-01&to=2026-06-01
```

### Звіти (Pro+)

```
GET    /api/v1/reports/aspects/:chart_id
GET    /api/v1/reports/arabic-parts/:chart_id?system=pauline
GET    /api/v1/reports/degree-interpretation/:chart_id?system=sabian
POST   /api/v1/reports/export/pdf   { chart_id, sections[] } → task_id
GET    /api/v1/reports/export/:task_id/status
GET    /api/v1/reports/export/:task_id/download
```

### Білінг

```
GET    /api/v1/billing/plans
GET    /api/v1/billing/subscription
POST   /api/v1/billing/stripe/checkout   { plan, interval }
POST   /api/v1/billing/stripe/portal
POST   /api/v1/billing/stripe/webhook    (Stripe → сервер)
POST   /api/v1/billing/liqpay/checkout   { plan, interval }
POST   /api/v1/billing/liqpay/callback   (LiqPay → сервер)
```

---

## 6. Монетизація

### 6.1 Тарифи

| Функція | Free | Pro ($9/міс) | Expert ($19/міс) |
|---|:---:|:---:|:---:|
| Натальні карти | 3 | Необмежено | Необмежено |
| Основні аспекти (7) | ✓ | ✓ | ✓ |
| Всі аспекти + орби | — | ✓ | ✓ |
| Транзити | — | ✓ | ✓ |
| Соляр, Прогресії | — | ✓ | ✓ |
| Синастрія | — | ✓ | ✓ |
| PDF export | — | ✓ | ✓ |
| Арабські частини | — | ✓ | ✓ |
| Ведична астрологія | — | — | ✓ |
| Дирекції, Horary | — | — | ✓ |
| Астрокартографія | — | — | ✓ |
| API доступ | — | — | ✓ |
| Пріоритетна підтримка | — | — | ✓ |

### 6.2 Перевірка фіч (FastAPI)

```python
# app/dependencies/billing.py
from fastapi import Depends, HTTPException
from app.models import User

def require_plan(*plans: str):
    def dependency(current_user: User = Depends(get_current_user)):
        if current_user.plan not in plans:
            raise HTTPException(
                status_code=403,
                detail=f"Requires plan: {' or '.join(plans)}"
            )
        return current_user
    return dependency

# Використання
@router.post("/charts/transit")
def create_transit(
    _: User = Depends(require_plan("pro", "expert"))
):
    ...
```

### 6.3 Stripe Webhooks (критичні події)

```
customer.subscription.created    → активувати план
customer.subscription.updated    → змінити план
customer.subscription.deleted    → перевести на free
invoice.payment_succeeded        → записати payment
invoice.payment_failed           → надіслати email
```

---

## 7. Ephemeris Engine (pyswisseph)

```python
# services/astro-api/app/ephemeris/engine.py
import swisseph as swe
from datetime import datetime
from app.ephemeris.types import Planet, HouseSystem, ChartData

class EphemerisEngine:
    PLANETS = {
        "sun": swe.SUN, "moon": swe.MOON,
        "mercury": swe.MERCURY, "venus": swe.VENUS,
        "mars": swe.MARS, "jupiter": swe.JUPITER,
        "saturn": swe.SATURN, "uranus": swe.URANUS,
        "neptune": swe.NEPTUNE, "pluto": swe.PLUTO,
        "chiron": swe.CHIRON, "true_node": swe.TRUE_NODE,
    }

    HOUSE_SYSTEMS = {
        "placidus": b"P", "koch": b"K", "equal": b"E",
        "regiomontanus": b"R", "campanus": b"C",
        "morinus": b"M", "whole_sign": b"W",
    }

    def __init__(self, ephe_path: str):
        swe.set_ephe_path(ephe_path)  # шлях до SE1 файлів з ZET9

    def calc_natal(self, dt: datetime, lat: float, lon: float,
                   house_system: str = "placidus") -> ChartData:
        jd = swe.julday(dt.year, dt.month, dt.day,
                        dt.hour + dt.minute/60 + dt.second/3600)
        planets = {}
        for name, code in self.PLANETS.items():
            pos, _ = swe.calc_ut(jd, code)
            planets[name] = {
                "longitude": pos[0], "latitude": pos[1],
                "distance": pos[2], "speed": pos[3],
            }
        houses, angles = swe.houses(
            jd, lat, lon,
            self.HOUSE_SYSTEMS.get(house_system, b"P")
        )
        return ChartData(planets=planets, houses=list(houses),
                         asc=angles[0], mc=angles[1])
```

**Важливо:** SE1 файли з `Zet9 Geo/Swiss/` можна використовувати напряму — це стандартний Swiss Ephemeris формат.

---

## 8. SVG Рендер карти (Frontend)

```tsx
// apps/frontend/src/app/_components/chart-wheel/ChartWheel.tsx
"use client";
import { ChartData } from "@/types/chart";

const ZODIAC_COLORS = {
  fire: "#e85d4a", earth: "#8b7355",
  air: "#6b9fc4", water: "#7b68ee"
};

export function ChartWheel({ data }: { data: ChartData }) {
  const cx = 300, cy = 300, r = 250;
  return (
    <svg viewBox="0 0 600 600" className="w-full max-w-2xl">
      {/* Зовнішнє кільце зодіаку (12 знаків × 30°) */}
      {/* Кільце будинків (12 куспідів) */}
      {/* Лінії аспектів */}
      {/* Гліфи планет (ZastroCC шрифт) */}
    </svg>
  );
}
```

Шрифти `ZastroCC.ttf`, `ZastroGR.TTF` тощо вже є в ZET9 — конвертувати в WOFF2 і підключити через `next/font/local`.

---

## 9. Фази розробки

### Фаза 1 — Auth + Акаунти (2 тижні)

- [ ] FastAPI: JWT auth (register/login/refresh/logout)
- [ ] FastAPI: SQLAlchemy моделі + Alembic міграції
- [ ] FastAPI: `user_settings` ендпоінти
- [ ] Next.js: сторінки login/register (App Router)
- [ ] Next.js: middleware захисту маршрутів
- [ ] Next.js: dashboard shell (sidebar + header з аватаром)

### Фаза 2 — Ephemeris Engine (2–3 тижні)

- [ ] Встановити `pyswisseph`, підключити SE1 файли з ZET9
- [ ] `EphemerisEngine.calc_natal()` — повний розрахунок
- [ ] `EphemerisEngine.calc_aspects()` — за профілем
- [ ] Тести: порівняти результати з ZET9 Geo для відомих карт
- [ ] Redis кеш (ключ = `natal:{jd}:{lat}:{lon}:{house_sys}`)
- [ ] Ендпоінт `POST /api/v1/charts/natal` повертає реальні дані

### Фаза 3 — SVG Карта (2 тижні)

- [ ] Компонент `ChartWheel` — SVG (зодіак + будинки)
- [ ] Планети з гліфами (ZastroCC.ttf → WOFF2)
- [ ] Лінії аспектів з кольорами (орб → прозорість)
- [ ] Темна/світла тема
- [ ] Tooltip при hover на планету/аспект
- [ ] Адаптивний розмір (mobile-friendly)

### Фаза 4 — Атлас і Геодані (2 тижні)

- [ ] Парсер бінарних Atlas `.dat` файлів → JSON → PostgreSQL
- [ ] Парсер `zones.dat` → timezones таблиця
- [ ] `GET /api/v1/atlas/search` з full-text пошуком (pg `tsvector`)
- [ ] `GET /api/v1/atlas/timezone` — UTC offset для довільних координат і дати
- [ ] Frontend: Leaflet-карта з кліком → вибір координат
- [ ] Frontend: autocomplete-пошук міст

### Фаза 5 — Звіти і Тлумачення (3 тижні)

- [ ] Парсери `.dgr`, `.dec`, `.ter` → JSON довідники → БД
- [ ] Парсери `.prs` → арабські частини → БД
- [ ] Ендпоінт аспектів з текстовими описами
- [ ] Ендпоінт тлумачень градусів (Sabian, Classic)
- [ ] Celery + Celery Beat: фонова генерація PDF (WeasyPrint або Puppeteer)
- [ ] Frontend: сторінка звіту з друком

### Фаза 6 — Монетизація (2 тижні)

- [ ] `require_plan` dependency для захисту ендпоінтів
- [ ] Stripe: Checkout Session + Customer Portal
- [ ] Stripe Webhook handler (`/api/v1/billing/stripe/webhook`)
- [ ] LiqPay: генерація форми оплати + callback
- [ ] Frontend: сторінка тарифів (Pricing)
- [ ] Frontend: Upgrade-промпт при зверненні до Pro-фіч
- [ ] Email після успішної оплати (FastAPI-Mail або Resend)

**→ LAUNCH (MVP)**

### Фаза 7 — Розширені функції (після запуску)

- [ ] Транзити + Прогресії + Соляр
- [ ] Синастрія (2 карти)
- [ ] Ведична астрологія (Dasha, Накшатри)
- [ ] Астрокартографія (ACG лінії на Leaflet)
- [ ] Планетарій (real-time небо)
- [ ] Публічні профілі карт (шерінг)
- [ ] AI-тлумачення (Claude API) — окремий Expert+ тариф

---

## 10. Міграція даних ZET9 → PostgreSQL

### Пріоритети

1. **Атлас міст** (критично для MVP — потрібен для будь-якої карти)
2. **Часові пояси** (критично — без цього неправильний UTC)
3. **SE1 ephemeris файли** (re-use напряму, без конвертації)
4. **Профілі аспектів** (потрібні для розрахунку)
5. **Системи градусів** (потрібні для звітів)
6. **Арабські частини** (Pro-функція)

### Скрипти міграції

```
scripts/migrate-zet9/
├── parse_atlas.py      # Atlas/*.dat → cities таблиця
├── parse_atlas2.py     # ATLASII/*.dat → cities таблиця
├── parse_zones.py      # Zones/zones.dat → timezones таблиця
├── parse_degrees.py    # *.dgr/*.dec → degree_interpretations
├── parse_traditions.py # *.ter/*.trr → традиційні системи
├── parse_aspects.py    # *.a2/*.asp → aspect_profiles
├── parse_arabic.py     # *.prs → arabic_parts
└── verify.py           # перевірка: 10 відомих міст, 5 відомих карт
```

---

## 11. Ризики і рішення

| Ризик | Оцінка | Рішення |
|---|---|---|
| Swiss Ephemeris GPL ліцензія | Середній | `pyswisseph` LGPL-сумісна; для SaaS — купити комерційну ліцензію Astrodienst |
| Бінарний формат Atlas `.dat` невідомий | Високий | Реверс-інжиніринг через HEX-редактор + порівняння з відомими містами |
| Точність != ZET9 | Середній | Написати regression-тести на відомі карти знаменитостей |
| Stripe недоступний в Україні | Низький | LiqPay як основний для UA, Stripe через Paddle/Lemon Squeezy |
| SEO (Next.js SSR) | Низький | App Router підтримує SSR з коробки |
| GDPR / персональні дані | Середній | Шифрування `birth_dt`, право на видалення (`DELETE /users/me`) |

---

## 12. Орієнтовний таймлайн

```
Тиждень 1–2   Фаза 1: Auth + акаунти
Тиждень 3–5   Фаза 2: Ephemeris engine (реальні розрахунки)
Тиждень 6–7   Фаза 3: SVG карта
Тиждень 8–9   Фаза 4: Атлас + геодані
Тиждень 10–12 Фаза 5: Звіти + тлумачення
Тиждень 13–14 Фаза 6: Монетизація
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
              LAUNCH (MVP ~3.5 місяці)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Тиждень 15+   Фаза 7: Розширені функції
```

---

## 13. Наступний крок

Проект `web-app` вже має scaffold і перший план виконаний. Найлогічніший наступний крок:

**→ Фаза 1: Auth** — реалізувати JWT авторизацію в FastAPI + сторінки login/register в Next.js.

Це розблокує всі наступні фази — без auth неможливо прив'язувати карти до акаунтів і перевіряти тарифні плани.
