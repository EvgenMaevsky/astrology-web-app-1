import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { LanguageSwitcher } from "@/app/_components/LanguageSwitcher";

// The service's public contact address — same one /privacy, /terms and the
// dashboard sidebar print.
const CONTACT_EMAIL = "info@astrodite.cc";

export async function Footer() {
  const t = await getTranslations("landing.footer");

  return (
    <footer className="border-t border-space-800 bg-space-950 px-6 py-12">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-display text-xl text-starlight">Astrodite</p>
          <p className="mt-1 text-sm text-dusk">{t("tagline")}</p>
          <p className="mt-4 text-xs text-dusk">{t("copyright", { year: new Date().getFullYear() })}</p>
        </div>
        <nav className="flex flex-wrap items-center gap-x-6 gap-y-3 text-sm">
          <Link href="/privacy" className="text-dusk transition hover:text-starlight">{t("privacy")}</Link>
          <Link href="/terms" className="text-dusk transition hover:text-starlight">{t("terms")}</Link>
          <a href={`mailto:${CONTACT_EMAIL}`} className="text-dusk transition hover:text-starlight">{t("contact")}</a>
          <LanguageSwitcher tone="dark" />
        </nav>
      </div>
    </footer>
  );
}
