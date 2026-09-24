"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { login } from "@/app/actions/auth";
import { THEME } from "@/app/_components/ui/theme";

// Dark marketing surface — docs/plans/2026-09-24-e7-redesign-design.md §5.
const ui = THEME.dark;

/**
 * googleButton is passed in from the server page rather than rendered here:
 * deciding whether Google sign-in is configured needs a backend call, which
 * a client component cannot make.
 */
export function LoginForm({
  googleButton,
  googleError,
}: {
  googleButton?: React.ReactNode;
  googleError?: string;
}) {
  const [state, action, pending] = useActionState(login, undefined);
  const t = useTranslations("auth.login");

  return (
    <div className="w-full max-w-md">
      <div className={`${ui.card} p-8 shadow-2xl shadow-black/40`}>
        <div className="mb-8 text-center">
          <h1 className={`${ui.heading} text-3xl`}>{t("title")}</h1>
        </div>

        {googleError && (
          <p className={`mb-5 ${ui.error}`}>
            {googleError}
          </p>
        )}

        <form action={action} className="space-y-5">
          <div>
            <label htmlFor="email" className={`${ui.label} mb-1.5`}>
              {t("email")}
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              className={ui.input}
              placeholder="you@example.com"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="password" className={ui.label}>
                {t("password")}
              </label>
              <Link href="/forgot-password" className={`text-xs ${ui.link}`}>
                {t("forgotPassword")}
              </Link>
            </div>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className={ui.input}
              placeholder="••••••••"
            />
          </div>

          {state?.error && (
            <p className={ui.error}>
              {state.error}
            </p>
          )}

          <button
            type="submit"
            disabled={pending}
            className={`w-full ${ui.primaryButton}`}
          >
            {pending ? t("submitPending") : t("submit")}
          </button>
        </form>

        {googleButton && <div className="mt-6">{googleButton}</div>}

        <p className="mt-6 text-center text-sm text-dusk">
          {t("noAccount")}{" "}
          <Link href="/register" className={ui.link}>
            {t("createOne")}
          </Link>
        </p>
      </div>
    </div>
  );
}
