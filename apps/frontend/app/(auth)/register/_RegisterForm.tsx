"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { register } from "@/app/actions/auth";
import { THEME } from "@/app/_components/ui/theme";

// Dark marketing surface — docs/plans/2026-09-24-e7-redesign-design.md §5.
const ui = THEME.dark;

/**
 * googleButton is passed in from the server page rather than rendered here:
 * deciding whether Google sign-in is configured needs a backend call, which
 * a client component cannot make.
 */
export function RegisterForm({ googleButton }: { googleButton?: React.ReactNode }) {
  const [state, action, pending] = useActionState(register, undefined);
  const t = useTranslations("auth.register");

  return (
    <div className="w-full max-w-md">
      <div className={`${ui.card} p-8 shadow-2xl shadow-black/40`}>
        <div className="mb-8 text-center">
          <h1 className={`${ui.heading} text-3xl`}>{t("title")}</h1>
        </div>

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
            <label htmlFor="password" className={`${ui.label} mb-1.5`}>
              {t("password")}
              <span className="ml-2 font-normal text-dusk">{t("passwordHint")}</span>
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
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
          {t("haveAccount")}{" "}
          <Link href="/login" className={ui.link}>
            {t("signIn")}
          </Link>
        </p>
      </div>
    </div>
  );
}
