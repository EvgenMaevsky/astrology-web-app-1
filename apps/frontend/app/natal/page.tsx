import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { LanguageSwitcher } from "@/app/_components/LanguageSwitcher";
import { getAccessToken } from "@/app/lib/auth";
import { PublicNatalForm } from "./_PublicNatalForm";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("charts.public");
  return {
    title: `${t("title")} — Astrodite`,
    description: t("subtitle"),
  };
}

/**
 * The entry point for search traffic: a natal chart with no account needed.
 *
 * Deliberately outside the (dashboard) group — it has its own minimal frame,
 * and the dashboard layout assumes a signed-in user.
 */
export default async function PublicNatalPage() {
  const [t, token] = await Promise.all([getTranslations("charts.public"), getAccessToken()]);
  const signedIn = Boolean(token);

  return (
    <div className="min-h-screen bg-stone-50">
      <header className="flex items-center justify-between border-b border-stone-200 bg-white px-4 sm:px-6 py-3">
        <Link href="/" className="text-xs font-semibold uppercase tracking-widest text-amber-700">
          Astrodite
        </Link>
        <div className="flex items-center gap-3">
          <LanguageSwitcher />
          {signedIn ? (
            <Link
              href="/charts"
              className="rounded-lg bg-stone-900 px-3.5 py-1.5 text-sm font-medium text-white hover:bg-stone-800"
            >
              {t("fullVersion")}
            </Link>
          ) : (
            <>
              <Link href="/login" className="text-sm text-stone-600 hover:text-stone-900">
                {t("signIn")}
              </Link>
              <Link
                href="/register"
                className="rounded-lg bg-amber-600 px-3.5 py-1.5 text-sm font-medium text-white hover:bg-amber-700"
              >
                {t("signUp")}
              </Link>
            </>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 sm:px-6 py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-stone-900">{t("title")}</h1>
          <p className="mt-1 text-sm text-stone-500">{t("subtitle")}</p>
        </div>

        {/* Nothing to sell to someone who already has an account, so they get
            the chart without the interruption. */}
        <PublicNatalForm showDialog={!signedIn} />
      </main>
    </div>
  );
}
