import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { API_URL, getAccessToken } from "@/app/lib/auth";
import { getSiteSettings, siteImageUrl } from "@/app/lib/site-settings";
import { SeoForm } from "./_SeoForm";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.seo");
  return { title: `${t("title")} — Astrodite` };
}

async function fetchMe(token: string) {
  try {
    const res = await fetch(`${API_URL}/api/v1/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as { email: string; is_admin: boolean };
  } catch {
    return null;
  }
}

export default async function AdminSeoPage() {
  // proxy.ts only checks that *someone* is signed in — it knows nothing about
  // roles — so the admin check has to happen here. The real gate is on the
  // API; this just keeps the page itself out of a non-admin's hands.
  const token = await getAccessToken();
  const user = token ? await fetchMe(token) : null;
  if (!user?.is_admin) notFound();

  const [t, settings] = await Promise.all([
    getTranslations("admin.seo"),
    getSiteSettings(),
  ]);

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold text-ink-900">{t("title")}</h1>
        <p className="text-sm text-ink-600 pb-2">{t("subtitle")}</p>
      </div>

      {settings ? (
        <SeoForm
          settings={settings}
          faviconUrl={settings.favicon ? siteImageUrl(settings.favicon) : null}
          ogImageUrl={settings.og_image ? siteImageUrl(settings.og_image) : null}
        />
      ) : (
        <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          {t("errors.cannotConnect")}
        </p>
      )}
    </div>
  );
}
