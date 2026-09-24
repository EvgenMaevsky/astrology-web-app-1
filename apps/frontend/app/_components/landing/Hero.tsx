import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Starfield } from "@/app/_components/Starfield";
import { hasSession } from "@/app/lib/auth";

export async function Hero() {
  const [t, th, signedIn] = await Promise.all([
    getTranslations("landing.hero"),
    getTranslations("siteHeader"),
    hasSession(),
  ]);

  return (
    // svh, not vh: on phones vh counts the area under the browser's toolbar,
    // so a 100vh hero hides its own bottom — here, the arrow.
    <section className="relative isolate flex min-h-[100svh] flex-col overflow-hidden bg-space-950">
      <Starfield />
      {/* A faint nebula behind the headline, so the centre of the sky has
          depth rather than being a flat black field. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_42%,rgba(124,92,255,0.20),transparent_70%)]"
      />

      {/* pt-24 clears the fixed site header; pb-28 keeps the arrow off the
          buttons on short screens. */}
      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 pb-28 pt-24 text-center">
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
            href={signedIn ? "/dashboard" : "/login"}
            className="w-full rounded-xl border border-space-600 px-7 py-3.5 text-center text-starlight transition hover:border-dusk sm:w-auto"
          >
            {signedIn ? th("dashboard") : t("signIn")}
          </Link>
        </div>
      </div>

      <a
        href="#facts"
        aria-label={th("scrollDown")}
        className="absolute bottom-8 left-1/2 z-10 -translate-x-1/2 rounded-full p-2 text-dusk transition hover:text-starlight"
      >
        {/* motion-safe: with reduced motion the arrow simply stays put. */}
        <svg
          width="28"
          height="28"
          viewBox="0 0 28 28"
          fill="none"
          aria-hidden="true"
          className="motion-safe:animate-nudge"
        >
          <path d="M7 11l7 7 7-7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </a>
    </section>
  );
}
