import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { getAccessToken, API_URL } from "@/app/lib/auth";
import { EmailSection } from "./_EmailSection";
import { DangerZone } from "./_DangerZone";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("account");
  return { title: `${t("title")} — Zorya` };
}

async function fetchMe(token: string) {
  try {
    const res = await fetch(`${API_URL}/api/v1/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!res.ok) return null;
    return res.json() as Promise<{ email: string; plan: string; email_verified: boolean }>;
  } catch {
    return null;
  }
}

export default async function AccountPage() {
  const [t, token] = await Promise.all([getTranslations("account"), getAccessToken()]);
  const user = token ? await fetchMe(token) : null;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-stone-800">{t("title")}</h1>
        <p className="text-sm text-stone-500 pb-2">{t("subtitle")}</p>
      </div>

      {user && <EmailSection email={user.email} verified={user.email_verified} />}

      <DangerZone />
    </div>
  );
}
