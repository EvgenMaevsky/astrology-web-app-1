import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { SiteHeader } from "@/app/_components/site-header/SiteHeader";
import { Starfield } from "@/app/_components/Starfield";
import { hasSession } from "@/app/lib/auth";
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
  const [t, signedIn] = await Promise.all([getTranslations("charts.public"), hasSession()]);

  return (
    <div className="relative isolate min-h-screen overflow-hidden bg-space-950">
      {/* Pinned to the viewport, not the page: on a long page (chart results,
          legal text) a page-sized canvas would allocate a huge backing store
          and thin the stars out, since their count follows width only. */}
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10">
        <Starfield density={0.45} interactive={false} />
      </div>
      <SiteHeader />

      <main className="relative z-10 mx-auto max-w-3xl space-y-8 px-4 pb-20 pt-28 sm:px-6">
        <div>
          <h1 className="font-display text-4xl font-semibold text-starlight sm:text-5xl">{t("title")}</h1>
          <p className="mt-3 text-dusk">{t("subtitle")}</p>
        </div>

        {/* Nothing to sell to someone who already has an account, so they get
            the chart without the interruption. */}
        <PublicNatalForm showDialog={!signedIn} />
      </main>
    </div>
  );
}
