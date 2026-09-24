"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { resetPassword } from "@/app/actions/auth";
import { THEME } from "@/app/_components/ui/theme";

// Dark marketing surface — docs/plans/2026-09-24-e7-redesign-design.md §5.
const ui = THEME.dark;

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(resetPassword, undefined);
  const t = useTranslations("auth.resetPassword");

  return (
    <div className="w-full max-w-md">
      <div className={`${ui.card} p-8 shadow-2xl shadow-black/40`}>
        <div className="mb-8 text-center">
          <h1 className={`${ui.heading} text-3xl`}>{t("title")}</h1>
        </div>

        {state?.message ? (
          <div className="space-y-5">
            <p className={ui.success}>
              {state.message}
            </p>
            <Link
              href="/login"
              className={`block w-full text-center ${ui.primaryButton}`}
            >
              {t("signIn")}
            </Link>
          </div>
        ) : (
          <form action={action} className="space-y-5">
            <input type="hidden" name="token" value={token} />

            <div>
              <label htmlFor="password" className={`${ui.label} mb-1.5`}>
                {t("newPassword")}
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                className={ui.input}
                placeholder="••••••••"
              />
            </div>

            <div>
              <label htmlFor="confirmPassword" className={`${ui.label} mb-1.5`}>
                {t("confirmPassword")}
              </label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
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
              disabled={pending || !token}
              className={`w-full ${ui.primaryButton}`}
            >
              {pending ? t("submitPending") : t("submit")}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
