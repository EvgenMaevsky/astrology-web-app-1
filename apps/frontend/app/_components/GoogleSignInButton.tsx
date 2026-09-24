import { getTranslations } from "next-intl/server";
import { API_URL } from "@/app/lib/auth";

async function googleEnabled(): Promise<boolean> {
  try {
    const res = await fetch(`${API_URL}/api/v1/auth/google/config`, { cache: "no-store" });
    if (!res.ok) return false;
    return ((await res.json()) as { enabled: boolean }).enabled;
  } catch {
    // Backend unreachable — render the password form alone rather than a
    // button that leads nowhere.
    return false;
  }
}

/**
 * Renders nothing unless the backend reports Google sign-in as configured,
 * so a deployment without credentials simply has no button.
 *
 * A plain link, not a client-side SDK: the whole flow is server-driven
 * because the session ends up in httpOnly cookies the browser cannot read.
 */
export async function GoogleSignInButton({ label }: { label: "signIn" | "signUp" }) {
  const [enabled, t] = await Promise.all([googleEnabled(), getTranslations("auth.google")]);
  if (!enabled) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <span className="h-px flex-1 bg-space-700" />
        <span className="text-xs uppercase tracking-wider text-dusk">{t("or")}</span>
        <span className="h-px flex-1 bg-space-700" />
      </div>

      <a
        href="/auth/google/start"
        className="flex w-full items-center justify-center gap-3 rounded-lg border border-stone-300 bg-white px-3.5 py-2.5 text-sm font-medium text-stone-700 transition-colors hover:bg-stone-50"
      >
        {/* Google's own mark, as their branding guidelines require. */}
        <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
          <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z" />
          <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.02-3.7H.96v2.34A9 9 0 0 0 9 18Z" />
          <path fill="#FBBC05" d="M3.98 10.72a5.4 5.4 0 0 1 0-3.44V4.94H.96a9 9 0 0 0 0 8.12l3.02-2.34Z" />
          <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.46 3.44 1.35l2.58-2.58C13.46.9 11.43 0 9 0A9 9 0 0 0 .96 4.94l3.02 2.34C4.68 5.16 6.66 3.58 9 3.58Z" />
        </svg>
        {t(label)}
      </a>
    </div>
  );
}
