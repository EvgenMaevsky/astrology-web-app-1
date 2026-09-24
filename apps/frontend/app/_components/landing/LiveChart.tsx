"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { ChartWheel } from "@/app/_components/chart-wheel/ChartWheel";
import sample from "./sample-chart.json";

/**
 * The real ChartWheel, on a fixed made-up chart generated once from our own
 * public endpoint. No request at render time, so the section is always
 * there and never depends on the backend.
 *
 * The wheel sits on a light card even on this dark page: that keeps one set
 * of wheel colours working everywhere, and a chart traditionally reads on a
 * light ground (spec §4).
 */
export function LiveChart() {
  const t = useTranslations("landing.liveChart");

  const legend = [
    { marker: "ASC", title: t("ascTitle"), body: t("ascBody") },
    { marker: "MC", title: t("mcTitle"), body: t("mcBody") },
    { marker: "1–12", title: t("housesTitle"), body: t("housesBody") },
    { marker: "△ □", title: t("aspectsTitle"), body: t("aspectsBody") },
  ];

  return (
    <section className="bg-space-950 px-6 py-24">
      <div className="mx-auto max-w-6xl">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-display text-4xl font-semibold text-starlight sm:text-5xl">{t("title")}</h2>
          <p className="mt-4 text-dusk">{t("subtitle")}</p>
        </div>

        <div className="mt-14 grid items-center gap-12 lg:grid-cols-[1.25fr_1fr]">
          <figure>
            <div className="rounded-3xl bg-white p-3 shadow-[0_0_90px_-24px_rgba(124,92,255,0.55)] sm:p-6">
              <ChartWheel data={sample} />
            </div>
            <figcaption className="mt-3 text-center text-xs text-dusk">{t("caption")}</figcaption>
          </figure>

          <div>
            <ul className="space-y-6">
              {legend.map((item) => (
                <li key={item.title} className="flex gap-4">
                  <span className="flex h-10 min-w-10 shrink-0 items-center justify-center rounded-lg border border-space-700 bg-space-900 px-2 font-display text-sm text-gold-400">
                    {item.marker}
                  </span>
                  <div>
                    <p className="font-semibold text-starlight">{item.title}</p>
                    <p className="mt-1 text-sm leading-relaxed text-dusk">{item.body}</p>
                  </div>
                </li>
              ))}
            </ul>
            <Link
              href="/natal"
              className="mt-10 inline-block rounded-xl bg-gold-400 px-6 py-3 font-semibold text-gold-950 transition hover:brightness-110"
            >
              {t("cta")}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
