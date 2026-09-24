---
status: in-progress
created: 2026-09-24
updated: 2026-09-24
related: "[[2026-09-24-e7-redesign-design]]"
tags: [plan, redesign, landing, e7a]
---

# E7a: токени, шрифти, зоряне небо, лендинг — план реалізації

**Мета:** нова синьо-фіолетова дизайн-система й лендинг із девʼяти секцій
з інтерактивним зоряним небом, за специфікацією
[[2026-09-24-e7-redesign-design]].

**Архітектура:** токени — у `@theme` Tailwind v4 в `globals.css`. Логіка
неба — чиста функціональна частина (`starfield-math.ts`, покрита
юніт-тестами) і тонка обгортка Canvas (`Starfield.tsx`). Лендинг —
композиція окремих компонентів-секцій, щоб `page.tsx` лишався коротким.

**Стек:** Next.js 16, Tailwind v4, next-intl, `next/font/google`,
`node:test` (вбудований, без нових залежностей).

> **Виконання:** inline в цій сесії — власник сказав «роби все». Повний код
> наведено для логіки, токенів і тестів. Презентаційна розмітка секцій
> описана точно (файл, пропси, ключі i18n, токени, критерії приймання), але
> не дублюється тут цілком: вона пишеться одразу у файли й перевіряється
> знімками екрана, а не тестами.

## Відхилення від специфікації

- **«Виноски» на живій карті → пояснення поруч із картою.** Позиціювати
  бейджі поверх SVG означає звʼязати лендинг із внутрішньою геометрією
  `ChartWheel` (viewBox, `eclToSvg`). Легенда поруч дає те саме пояснення
  без цієї залежності.

## Знахідки перед стартом

- **Geist підключено лише з `latin`**, хоча Google Fonts має для нього
  `cyrillic`. Отже, увесь український текст сайту зараз малюється запасним
  шрифтом. Виправляється в Задачі 2.
- **`LanguageSwitcher`** має жорстко прописані бурштинові класи — на темному
  hero не читатиметься. Потрібен параметр `tone`.
- **Node 22.22 запускає `.ts` нативно** (`node --test file.test.ts`) —
  юніт-тести без vitest/jest. Перевірено в ізоляції.

## Карта файлів

| Файл | Відповідальність |
|---|---|
| `app/lib/starfield-math.ts` | **новий.** Чиста математика неба: кількість, генерація, паралакс, сузірʼя, мерехтіння |
| `app/lib/starfield-math.test.ts` | **новий.** Юніт-тести до неї |
| `app/_components/Starfield.tsx` | **новий.** Canvas, цикл, спостерігачі, reduced motion |
| `app/lib/landing-facts.ts` | **новий.** Цифри довіри з посиланнями на джерела |
| `services/astro-api/tests/test_landing_facts.py` | **новий.** Звіряє цифри з бекендом |
| `app/_components/landing/*.tsx` | **нові.** Девʼять секцій |
| `app/_components/landing/sample-chart.json` | **новий.** Статичний приклад для живої карти |
| `app/globals.css` | токени, шрифт `display`, прибрати auto dark mode |
| `app/layout.tsx` | Cormorant + кирилиця Geist |
| `app/_components/LanguageSwitcher.tsx` | параметр `tone` |
| `app/page.tsx` | композиція секцій |
| `messages/{uk,en}.json` | ключі лендингу |
| `tsconfig.json`, `package.json` | запуск `.ts`-тестів |
| `.github/workflows/ci.yml` | крок `npm test` (окремим комітом) |

---

### Задача 1: Інфраструктура тестів фронтенду

**Файли:** `tsconfig.json`, `package.json`

- [ ] Додати в `compilerOptions`: `"allowImportingTsExtensions": true`
  (безпечно, бо вже `"noEmit": true`; інакше `tsc` відхилить
  `import ... from "./starfield-math.ts"` у тесті).
- [ ] Додати скрипт: `"test": "node --test \"app/**/*.test.ts\""`
  (Node 22 сам розкриває glob; оболонка `sh` у npm-скриптах `**` не вміє).
- [ ] Перевірка: `npm test` → «tests 0» без помилок (тестів ще немає).

### Задача 2: Шрифти

**Файли:** `app/layout.tsx`, `app/globals.css`

- [ ] Geist: `subsets: ["latin", "cyrillic"]`.
- [ ] Cormorant Garamond:
  ```ts
  const cormorant = Cormorant_Garamond({
    subsets: ["latin", "cyrillic", "cyrillic-ext"],
    weight: ["500", "600"],
    variable: "--font-cormorant",
  });
  ```
  змінну додати на `<html>` поряд із `geist.variable`.
- [ ] У `@theme`: `--font-display: var(--font-cormorant), Georgia, serif;`
  → утиліта `font-display`.
- [ ] **Перевірка кирилиці (обовʼязкова, spec §2):** відрендерити «ї є ґ і
  Ї Є Ґ І» класом `font-display` і через
  `document.fonts.check('600 32px "Cormorant Garamond"', 'їєґ')` та
  `getComputedStyle` переконатися, що використано саме Cormorant, а не
  fallback.

### Задача 3: Токени кольору

**Файл:** `app/globals.css`

- [ ] Замінити блок `:root` / `@theme inline` / `@media dark` на:
  ```css
  @theme {
    --color-space-950: #0B0A1F;
    --color-space-900: #16143A;
    --color-space-800: #221E4E;
    --color-space-700: #2E2966;
    --color-space-600: #4A4580;
    --color-starlight: #E8E6FF;
    --color-dusk: #9A95C9;
    --color-nebula-500: #7C5CFF;
    --color-nebula-600: #6C4DF5;
    --color-azure-500: #4F8BFF;
    --color-azure-600: #3F7BF2;
    --color-gold-50: #FBF1DC;
    --color-gold-400: #F2C572;
    --color-gold-800: #7A5410;
    --color-gold-950: #2A1D05;
    --color-mist-50: #F6F4FF;
    --color-mist-200: #E4E0FA;
    --color-mist-300: #D6D0F5;
    --color-ink-600: #5B5690;
    --color-ink-900: #1B1840;
    --font-display: var(--font-cormorant), Georgia, serif;
  }
  ```
- [ ] Прибрати `@media (prefers-color-scheme: dark)` (spec §1: вітрина
  завжди темна, дашборд завжди світлий).
- [ ] `body` — прибрати `font-family: Arial…`: шрифт уже задає клас на
  `<body>` у `layout.tsx`.
- [ ] Перевірка: `npm run build` чистий; стара бежева палітра дашборду не
  зламалася (вона на вбудованих `stone-*`/`amber-*`, яких ми не чіпали).

### Задача 4: `starfield-math.ts` — тест спершу

**Файли:** `app/lib/starfield-math.test.ts`, `app/lib/starfield-math.ts`

- [ ] **Тест** (повний код):
  ```ts
  import { test } from "node:test";
  import assert from "node:assert/strict";
  import {
    starCounts, effectiveDpr, generateStars, parallaxOffset,
    selectLinks, twinkleAlpha, wrap, mulberry32,
    LAYER_RADIUS, LINK_DISTANCE, LINK_RADIUS, MAX_LINKS,
  } from "./starfield-math.ts";

  test("desktop gets the full count, mobile half", () => {
    assert.deepEqual(starCounts(1280), [180, 90, 40]);
    assert.deepEqual(starCounts(375), [90, 45, 20]);
  });

  test("density scales the count", () => {
    assert.deepEqual(starCounts(1280, 0.5), [90, 45, 20]);
    assert.deepEqual(starCounts(1280, 0), [0, 0, 0]);
  });

  test("device pixel ratio is capped at 2 and floored at 1", () => {
    assert.equal(effectiveDpr(3), 2);
    assert.equal(effectiveDpr(1.5), 1.5);
    assert.equal(effectiveDpr(0), 1);
    assert.equal(effectiveDpr(Number.NaN), 1);
  });

  test("generated stars stay in bounds with layer-correct radii", () => {
    const stars = generateStars(800, 600, 1, mulberry32(42));
    assert.equal(stars.length, 180 + 90 + 40);
    for (const s of stars) {
      assert.ok(s.x >= 0 && s.x <= 800 && s.y >= 0 && s.y <= 600);
      const [lo, hi] = LAYER_RADIUS[s.layer];
      assert.ok(s.r >= lo && s.r <= hi, `r=${s.r} layer=${s.layer}`);
    }
  });

  test("generation is deterministic for a given seed", () => {
    assert.deepEqual(
      generateStars(400, 300, 1, mulberry32(7)),
      generateStars(400, 300, 1, mulberry32(7)),
    );
  });

  test("parallax is zero at the centre and without a pointer", () => {
    assert.deepEqual(parallaxOffset({ x: 400, y: 300 }, 800, 600, 2), { x: 0, y: 0 });
    assert.deepEqual(parallaxOffset(null, 800, 600, 2), { x: 0, y: 0 });
  });

  test("nearer layers move further than distant ones", () => {
    const p = { x: 800, y: 600 };
    const far = parallaxOffset(p, 800, 600, 0);
    const near = parallaxOffset(p, 800, 600, 2);
    assert.ok(Math.abs(near.x) > Math.abs(far.x));
    assert.ok(Math.abs(near.y) > Math.abs(far.y));
  });

  test("links: none without a pointer", () => {
    assert.deepEqual(selectLinks([{ x: 0, y: 0 }, { x: 10, y: 0 }], null), []);
  });

  test("links respect radius, distance and the cap", () => {
    const rand = mulberry32(3);
    const pts = Array.from({ length: 200 }, () => ({ x: rand() * 300, y: rand() * 300 }));
    const pointer = { x: 150, y: 150 };
    const links = selectLinks(pts, pointer);
    assert.ok(links.length <= MAX_LINKS);
    for (const l of links) {
      const a = pts[l.a], b = pts[l.b];
      assert.ok(Math.hypot(a.x - b.x, a.y - b.y) <= LINK_DISTANCE);
      assert.ok(Math.hypot(a.x - pointer.x, a.y - pointer.y) <= LINK_RADIUS);
      assert.ok(Math.hypot(b.x - pointer.x, b.y - pointer.y) <= LINK_RADIUS);
      assert.ok(l.alpha > 0 && l.alpha <= 1);
    }
  });

  test("twinkle stays visible", () => {
    const star = { x: 0, y: 0, r: 1, layer: 0 as const, color: "#fff", phase: 0, speed: 1 };
    for (let t = 0; t < 20; t += 0.37) {
      const a = twinkleAlpha(star, t);
      assert.ok(a >= 0.1 && a <= 1);
    }
  });

  test("wrap keeps drifting stars on the canvas", () => {
    assert.equal(wrap(-5, 100), 95);
    assert.equal(wrap(105, 100), 5);
    assert.equal(wrap(50, 100), 50);
  });
  ```
- [ ] Запуск: `npm test` → **FAIL** (модуля ще немає).
- [ ] **Реалізація** `starfield-math.ts`: константи зі специфікації §3
  (`LAYER_COUNTS [180,90,40]`, `LAYER_RADIUS`, `PARALLAX [0.01,0.025,0.05]`,
  `LINK_RADIUS 140`, `LINK_DISTANCE 90`, `MAX_LINKS 12`, `MAX_DPR 2`,
  `MOBILE_BREAKPOINT 640`, `DRIFT_PX_PER_SEC 6`) і функції з сигнатурами,
  що їх використовує тест. `selectLinks` — кандидати в радіусі від
  курсора, пари не далі `LINK_DISTANCE`, `alpha = (1 − d/LINK_DISTANCE) ×
  близькість середини пари до курсора`, сортування за `alpha`, перші
  `MAX_LINKS`.
- [ ] Запуск: `npm test` → **PASS**.
- [ ] Коміт.

### Задача 5: `Starfield.tsx`

**Файл:** `app/_components/Starfield.tsx` (клієнтський)

- [ ] Пропси: `density?: number = 1`, `interactive?: boolean = true`,
  `className?: string`.
- [ ] `<canvas aria-hidden>` на весь батьківський блок (`absolute inset-0`).
- [ ] Буфер = CSS-розмір × `effectiveDpr(devicePixelRatio)`, `ctx.scale`.
- [ ] `ResizeObserver` → перегенерувати зірки.
- [ ] `prefers-reduced-motion: reduce` → один статичний кадр, **без**
  циклу й слухачів.
- [ ] Цикл `requestAnimationFrame`: дрейф (`wrap`), мерехтіння, паралакс з
  lerp 0.06, сузірʼя (якщо `interactive`).
- [ ] `pointermove` на `window`, координати відносно `getBoundingClientRect`
  канвасу; `pointerleave` документа → курсор `null`.
- [ ] **Пауза циклу** (не просто порожні кадри): `IntersectionObserver`
  (канвас поза екраном) і `visibilitychange`. Лічильник кадрів для
  перевірки.
- [ ] Прибирання всіх слухачів і спостерігачів при демонтажі.

### Задача 6: Цифри довіри з джерелами

**Файли:** `app/lib/landing-facts.ts`, `services/astro-api/tests/test_landing_facts.py`

- [ ] `landing-facts.ts`:
  ```ts
  import { HOUSE_SYSTEMS } from "@/app/lib/house-systems";

  // Each number here is a claim on the landing page, so each names its
  // source. Values the frontend cannot import are mirrored and guarded by
  // services/astro-api/tests/test_landing_facts.py.
  export const LANDING_FACTS = {
    // tests/test_cross_swisseph.py → PLANET_TOL
    precisionDeg: 0.003,
    // 34,146 cities after the GeoNames import; rounded down on purpose.
    cities: 34000,
    houseSystems: HOUSE_SYSTEMS.length,
    // app/schemas/chart.py → EPHEMERIS_MIN_YEAR / EPHEMERIS_MAX_YEAR
    yearFrom: 1850,
    yearTo: 2149,
  } as const;
  ```
- [ ] Тест на бекенді (парсить TS-файл регулярками, як
  `test_plan_catalogue.py` читає `uk.json`): `yearFrom == EPHEMERIS_MIN_YEAR`,
  `yearTo == EPHEMERIS_MAX_YEAR`, `precisionDeg == PLANET_TOL` з
  `tests/test_cross_swisseph.py`.
- [ ] Запуск: `pytest tests/test_landing_facts.py` → PASS.

### Задача 7: Приклад для живої карти

- [ ] Згенерувати `sample-chart.json` із локального
  `POST /api/v1/charts/natal/public` для `1990-01-01T12:00`,
  `Europe/Kyiv`, `50.45 / 30.52` (вигадані дані, spec §4).
- [ ] Переконатися, що форма відповідає `ChartData` у `ChartWheel`
  (`planets`, `houses`, `angles`, `aspects`).

### Задача 8: `LanguageSwitcher` — параметр `tone`

- [ ] `tone?: "light" | "dark" = "light"`; для `dark` активна мова
  `text-gold-400`, неактивна `text-dusk hover:text-starlight`. Поведінка
  без змін.

### Задача 9: Секції лендингу

**Каталог:** `app/_components/landing/`. Спільні правила: фон вітрини
`bg-space-950`, текст `text-starlight` / `text-dusk`, заголовки
`font-display`, скляна картка `bg-space-900/60 backdrop-blur border
border-space-700 rounded-2xl`, головна кнопка `bg-gold-400 text-gold-950`,
другорядна `border border-space-600 text-starlight`. **`nebula-500` — лише
лінії й рамки, ніколи текст** (spec §1).

| Файл | Зміст | Ключі i18n |
|---|---|---|
| `Hero.tsx` | `Starfield` на тлі, шапка (лого, мова `tone="dark"`, «Увійти»), заголовок, підзаголовок, CTA → `/natal` | `landing.hero.*` |
| `TrustStats.tsx` | 4 цифри з `LANDING_FACTS`, числа через `Intl.NumberFormat(locale)` | `landing.stats.*` |
| `LiveChart.tsx` (клієнт) | `ChartWheel` на **світлій** картці + легенда з 4 пояснень + CTA | `landing.liveChart.*` |
| `Techniques.tsx` | 3 картки з бейджами Free / Pro за моделлю E4 | `landing.techniques.*` |
| `ProFeatures.tsx` | 5 пунктів для професіоналів | `landing.pro.*` |
| `HowItWorks.tsx` | 3 кроки | `landing.how.*` |
| `Pricing.tsx` | з `getPlans()`, Pro — золота рамка, CTA → `/register` | `landing.pricing.*` |
| `FinalCta.tsx` | `Starfield` + заклик → `/natal` | `landing.final.*` |
| `Footer.tsx` | контакт, правові, мова | `landing.footer.*` |

- [ ] Нові ключі в **обох** словниках; старі невживані ключі лендингу
  прибрати.
- [ ] `page.tsx` — лише композиція секцій.

### Задача 10: Перевірка

- [ ] `npm test`, `npx tsc --noEmit`, `npm run build`, `pytest` — чисто.
- [ ] Браузер, десктоп: сузірʼя біля курсора, паралакс, мерехтіння.
- [ ] Емуляція 375×812: небо дрейфує, макет не ламається.
- [ ] **Reduced motion** (емуляція): статичний кадр, цикл не працює.
- [ ] **Пауза:** прокрутити hero з екрана → лічильник кадрів стоїть.
- [ ] **Бюджет кадру:** виміряти середній час кадру, записати сюди.
- [ ] Кирилиця Cormorant — див. Задачу 2.
- [ ] Консоль без помилок, обидві мови.
- [ ] Деплой, перевірка на проді.

### Задача 11: CI

- [ ] `.github/workflows/ci.yml`: крок `- run: npm test` після `npm ci`
  у джобі `frontend`. **Окремим комітом**: пуш змін у `.github/workflows`
  може вимагати окремого OAuth-скоупу `workflow` — якщо пуш відхилять, це
  не має блокувати решту роботи.
