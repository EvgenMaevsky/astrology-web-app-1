"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { forgotPassword } from "@/app/actions/auth";
import { THEME } from "@/app/_components/ui/theme";

// Dark marketing surface — docs/plans/2026-09-24-e7-redesign-design.md §5.
const ui = THEME.dark;

export default function ForgotPasswordPage() {
  const [state, action, pending] = useActionState(forgotPassword, undefined);
  const t = useTranslations("auth.forgotPassword");

  return (
    <div className="w-full max-w-md">
      <div className={`${ui.card} p-8 shadow-2xl shadow-black/40`}>
        <div className="mb-8 text-center">
          <h1 className={`${ui.heading} text-3xl`}>{t("title")}</h1>
          <p className="mt-2 text-sm text-dusk">
            {t("subtitle")}
          </p>
        </div>

        {state?.message ? (
          <p className={ui.success}>
            {state.message}
          </p>
        ) : (
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
        )}

        <p className="mt-6 text-center text-sm text-dusk">
          <Link href="/login" className={ui.link}>
            {t("backToSignIn")}
          </Link>
        </p>
      </div>
    </div>
  );
}
