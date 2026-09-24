import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Starfield } from "@/app/_components/Starfield";

export async function FinalCta() {
  const t = await getTranslations("landing.final");

  return (
    <section className="relative isolate overflow-hidden border-t border-space-800 bg-space-950 px-6 py-32 text-center">
      {/* A second sky. It only animates while on screen, so it and the
          hero's never run at the same time. */}
      <Starfield density={0.6} />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_50%_60%_at_50%_50%,rgba(79,139,255,0.14),transparent_70%)]"
      />
      <div className="relative z-10 mx-auto max-w-2xl">
        <h2 className="font-display text-4xl font-semibold text-starlight sm:text-6xl">{t("title")}</h2>
        <p className="mt-5 text-lg text-dusk">{t("subtitle")}</p>
        <Link
          href="/natal"
          className="mt-10 inline-block rounded-xl bg-gold-400 px-8 py-4 font-semibold text-gold-950 shadow-[0_0_48px_-10px_rgba(242,197,114,0.7)] transition hover:brightness-110"
        >
          {t("cta")}
        </Link>
      </div>
    </section>
  );
}
