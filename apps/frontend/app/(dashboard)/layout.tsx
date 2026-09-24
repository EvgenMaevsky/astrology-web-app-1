import { getTranslations } from "next-intl/server";
import { logout } from "@/app/actions/auth";
import { getAccessToken, API_URL } from "@/app/lib/auth";
import Link from "next/link";
import { EmailVerificationBanner } from "./_EmailVerificationBanner";
import { LanguageSwitcher } from "@/app/_components/LanguageSwitcher";
import { NavLinks } from "./_NavLinks";
import { Logo } from "@/app/_components/Logo";

// The service's public contact address, also printed in /privacy and /terms.
// The env var stays an override so a fork or a staging deploy can point
// elsewhere, but the default means the link is never silently missing.
const FEEDBACK_EMAIL = process.env.NEXT_PUBLIC_FEEDBACK_EMAIL || "info@astrodite.cc";

async function fetchMe(token: string) {
  try {
    const res = await fetch(`${API_URL}/api/v1/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!res.ok) return null;
    return res.json() as Promise<{
      email: string;
      plan: string;
      email_verified: boolean;
      is_admin: boolean;
    }>;
  } catch {
    return null;
  }
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const token = await getAccessToken();
  const user = token ? await fetchMe(token) : null;
  const t = await getTranslations("nav");

  const NAV = [
    { href: "/dashboard", label: t("overview") },
    { href: "/persons", label: t("persons") },
    { href: "/charts", label: t("charts") },
    { href: "/pricing", label: t("pricing") },
    { href: "/billing", label: t("billing") },
    { href: "/account", label: t("account") },
    // Hiding this is a convenience, not a control: the page and the API both
    // check is_admin themselves.
    ...(user?.is_admin ? [{ href: "/admin/seo", label: t("seo") }] : []),
  ];

  return (
    <div className="flex min-h-screen bg-mist-50">
      {/* sticky + h-screen: the sidebar stays put while a long chart page
          scrolls, instead of stretching to the page's full height and
          taking the sign-out link off screen. */}
      <aside className="hidden lg:flex flex-col w-56 shrink-0 border-r border-mist-200 bg-white sticky top-0 h-screen">
        <div className="px-5 py-6 border-b border-mist-100">
          <Link href="/dashboard">
            <Logo tone="light" />
          </Link>
        </div>
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-0.5">
          <NavLinks items={NAV} layout="sidebar" />
        </nav>
        <div className="px-3 py-4 border-t border-mist-100">
          <form action={logout}>
            <button
              type="submit"
              className="w-full text-left px-3 py-2 text-sm text-ink-600 hover:text-ink-900 hover:bg-mist-100 rounded-lg transition-colors"
            >
              {t("signOut")}
            </button>
          </form>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 pt-2 text-xs text-ink-600">
            <Link href="/privacy" className="hover:text-ink-900">{t("privacy")}</Link>
            <Link href="/terms" className="hover:text-ink-900">{t("terms")}</Link>
            <a href={`mailto:${FEEDBACK_EMAIL}`} className="hover:text-ink-900">
              {t("feedback")}
            </a>
          </div>
          <div className="px-3 pt-2">
            <LanguageSwitcher />
          </div>
        </div>
      </aside>

      <div className="flex flex-col flex-1 min-w-0">
        <header className="flex items-center justify-between px-6 py-4 bg-white border-b border-mist-200 h-14">
          <Link href="/dashboard" className="lg:hidden">
            <Logo tone="light" size="sm" />
          </Link>
          <div className="flex items-center gap-3 ml-auto">
            {user && (
              <>
                <span className="text-sm text-ink-600 hidden sm:block">{user.email}</span>
                {/* Gold marks what is paid for; the free plan stays neutral. */}
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${
                    user.plan === "free" ? "bg-mist-100 text-ink-700" : "bg-gold-50 text-gold-800"
                  }`}
                >
                  {user.plan}
                </span>
              </>
            )}
            <LanguageSwitcher className="lg:hidden" />
            <form action={logout} className="lg:hidden">
              <button type="submit" className="text-sm text-ink-600 hover:text-ink-900">
                {t("signOut")}
              </button>
            </form>
          </div>
        </header>

        <nav className="lg:hidden flex gap-1 overflow-x-auto px-3 py-2 bg-white border-b border-mist-200">
          <NavLinks items={NAV} layout="strip" />
        </nav>

        {user && !user.email_verified && <EmailVerificationBanner />}

        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
