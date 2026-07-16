import { logout } from "@/app/actions/auth";
import { getAccessToken, API_URL } from "@/app/lib/auth";
import Link from "next/link";
import { EmailVerificationBanner } from "./_EmailVerificationBanner";

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

const NAV = [
  { href: "/dashboard", label: "Overview" },
  { href: "/persons", label: "Persons" },
  { href: "/charts", label: "Charts" },
  { href: "/reports", label: "Reports" },
  { href: "/pricing", label: "Pricing" },
  { href: "/billing", label: "Billing" },
];

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const token = await getAccessToken();
  const user = token ? await fetchMe(token) : null;

  return (
    <div className="flex min-h-screen bg-stone-50">
      <aside className="hidden lg:flex flex-col w-56 shrink-0 border-r border-stone-200 bg-white">
        <div className="px-5 py-6 border-b border-stone-100">
          <span className="text-xs font-semibold tracking-widest text-amber-700 uppercase">
            Zorya
          </span>
        </div>
        <nav className="flex-1 py-4 px-3 space-y-0.5">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center px-3 py-2 text-sm rounded-lg text-stone-600 hover:text-stone-900 hover:bg-stone-100 transition-colors"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="px-3 py-4 border-t border-stone-100">
          <form action={logout}>
            <button
              type="submit"
              className="w-full text-left px-3 py-2 text-sm text-stone-500 hover:text-stone-800 hover:bg-stone-100 rounded-lg transition-colors"
            >
              Sign out
            </button>
          </form>
        </div>
      </aside>

      <div className="flex flex-col flex-1 min-w-0">
        <header className="flex items-center justify-between px-6 py-4 bg-white border-b border-stone-200 h-14">
          <span className="lg:hidden text-xs font-semibold tracking-widest text-amber-700 uppercase">
            Zorya
          </span>
          <div className="flex items-center gap-3 ml-auto">
            {user && (
              <>
                <span className="text-sm text-stone-500 hidden sm:block">{user.email}</span>
                <span className="rounded-full bg-amber-100 text-amber-800 text-xs font-semibold px-2.5 py-1 capitalize">
                  {user.plan}
                </span>
              </>
            )}
            <form action={logout} className="lg:hidden">
              <button type="submit" className="text-sm text-stone-500 hover:text-stone-900">
                Sign out
              </button>
            </form>
          </div>
        </header>

        {user && !user.email_verified && <EmailVerificationBanner />}

        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
