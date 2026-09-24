import { getTranslations } from "next-intl/server";
import { LANDING_FACTS } from "@/app/lib/landing-facts";
import { FULL_SCREEN } from "./section";

/**
 * The three techniques, badged with the allowances from plan E4: natal is
 * free and unlimited, the other two are 2 a day on Free and unlimited on Pro.
 */
export async function Techniques() {
  const t = await getTranslations("landing.techniques");

  const items = [
    {
      glyph: "☉",
      title: t("natalTitle"),
      body: t("natalBody", { from: LANDING_FACTS.yearFrom, to: LANDING_FACTS.yearTo }),
      badge: t("badgeFree"),
      free: true,
    },
    { glyph: "♃", title: t("transitsTitle"), body: t("transitsBody"), badge: t("badgeAdvanced"), free: false },
    { glyph: "☌", title: t("synastryTitle"), body: t("synastryBody"), badge: t("badgeAdvanced"), free: false },
  ];

  return (
    <section id="features" className={`${FULL_SCREEN} bg-space-950 px-6 py-24`}>
      <div className="mx-auto max-w-6xl">
        <h2 className="text-center font-display text-4xl font-semibold text-starlight sm:text-5xl">{t("title")}</h2>
        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {items.map((item) => (
            <article
              key={item.title}
              className="flex flex-col rounded-2xl border border-space-700 bg-space-900/60 p-7 backdrop-blur transition hover:border-space-600 hover:bg-space-900"
            >
              <span aria-hidden="true" className="font-display text-5xl leading-none text-starlight">
                {item.glyph}
              </span>
              <h3 className="mt-6 text-xl font-semibold text-starlight">{item.title}</h3>
              <p className="mt-3 flex-1 leading-relaxed text-dusk">{item.body}</p>
              <span
                className={`mt-6 self-start rounded-md px-2.5 py-1 text-xs ${
                  item.free ? "border border-space-600 text-starlight" : "bg-gold-400/15 text-gold-400"
                }`}
              >
                {item.badge}
              </span>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
