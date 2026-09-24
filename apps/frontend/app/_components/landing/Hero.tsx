import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { LanguageSwitcher } from "@/app/_components/LanguageSwitcher";
import { Starfield } from "@/app/_components/Starfield";

export async function Hero() {
  const t = await getTranslations("landing.hero");

  return (
    <section className="relative isolate flex min-h-[92vh] flex-col overflow-hidden bg-space-950">
      <Starfield />
      {/* A faint nebula behind the headline, so the centre of the sky has
          depth rather than being a flat black field. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_42%,rgba(124,92,255,0.20),transparent_70%)]"
      />

      <header className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-5">
        <Link href="/" className="font-display text-2xl tracking-wide text-starlight">
          Astrodite
        </Link>
        <LanguageSwitcher tone="dark" />
      </header>

      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 pb-24 text-center">
        <p className="mb-6 text-xs uppercase tracking-[0.3em] text-dusk">{t("eyebrow")}</p>
        <h1 className="max-w-4xl font-display text-5xl font-semibold leading-[1.05] text-starlight sm:text-7xl">
          {t("title")}
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-relaxed text-dusk">{t("subtitle")}</p>
        <div className="mt-10 flex w-full flex-col items-center gap-3 sm:w-auto sm:flex-row">
          <Link
            href="/natal"
            className="w-full rounded-xl bg-gold-400 px-7 py-3.5 text-center font-semibold text-gold-950 shadow-[0_0_48px_-10px_rgba(242,197,114,0.7)] transition hover:brightness-110 sm:w-auto"
          >
            {t("cta")}
          </Link>
          <Link
            href="/login"
            className="w-full rounded-xl border border-space-600 px-7 py-3.5 text-center text-starlight transition hover:border-dusk sm:w-auto"
          >
            {t("signIn")}
          </Link>
        </div>
      </div>
    </section>
  );
}
