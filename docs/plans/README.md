---
status: reference
---

# Плани реалізації

Кожен нетривіальний план (свій чи від planner-агента зі скіла `plan-execute-verify`)
зберігається тут як окремий файл, а не лише в чаті — щоб пережити релонч сесії,
зміну моделі чи стиснення контексту.

## Конвенція

- Ім'я файлу: `YYYY-MM-DD-короткий-опис.md`
- Frontmatter: `status: planned | in-progress | done | superseded`, `created`, `updated`,
  за потреби `related: "[[ROADMAP]]"` (посилання на цю теку сумісні з Obsidian wikilinks,
  якщо відкрити репозиторій як vault — backlinks і graph view працюють без налаштувань).
- Блок **Прогрес** на початку файлу — чекбокси по пунктах плану, оновлюються по мірі
  виконання (не переписувати план заново — галочка на місці).
- Коли всі пункти Definition of Done виконані — `status: done`.
- Якщо план замінено новим підходом — `status: superseded` з коротким поясненням чому;
  файл не видаляється (історія рішень має значення для майбутніх сесій).

## Активні / історичні плани

- [2026-07-15 — Stage A Stabilization](2026-07-15-stage-a-stabilization.md) — `done`
- [2026-07-15 — Stage B Infrastructure](2026-07-15-stage-b-infrastructure.md) — `done`
- [2026-07-16 — Stage C Product Readiness](2026-07-16-stage-c-product-readiness.md) — `done`
- [2026-07-16 — Stage D Launch](2026-07-16-stage-d-launch.md) — `in-progress` (частини 1–4 done; 4б superseded → monopay)
- [2026-07-18 — MonoPay Migration](2026-07-18-monopay-migration.md) — `in-progress` (код+тести done; живий цикл оплати картою не пройдено — немає тестових номерів карток monobank)
