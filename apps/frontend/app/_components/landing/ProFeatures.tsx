import { getTranslations } from "next-intl/server";

export async function ProFeatures() {
  const t = await getTranslations("landing.pro");

  const items = [
    { glyph: "♄", title: t("termsTitle"), body: t("termsBody") },
    { glyph: "⊗", title: t("arabicTitle"), body: t("arabicBody") },
    { glyph: "⚻", title: t("minorTitle"), body: t("minorBody") },
    { glyph: "◷", title: t("timezonesTitle"), body: t("timezonesBody") },
    { glyph: "☊", title: t("personsTitle"), body: t("personsBody") },
  ];

  return (
    <section className="border-t border-space-800 bg-space-950 px-6 py-24">
      <div className="mx-auto grid max-w-6xl gap-14 lg:grid-cols-[1fr_1.4fr]">
        <div>
          <h2 className="font-display text-4xl font-semibold text-starlight sm:text-5xl">{t("title")}</h2>
          <p className="mt-4 max-w-md leading-relaxed text-dusk">{t("subtitle")}</p>
        </div>
        <ul className="grid gap-x-10 gap-y-8 sm:grid-cols-2">
          {items.map((item) => (
            <li key={item.title} className="flex gap-4">
              <span
                aria-hidden="true"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-nebula-500/40 text-lg text-starlight"
              >
                {item.glyph}
              </span>
              <div>
                <p className="font-semibold text-starlight">{item.title}</p>
                <p className="mt-1 text-sm leading-relaxed text-dusk">{item.body}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
