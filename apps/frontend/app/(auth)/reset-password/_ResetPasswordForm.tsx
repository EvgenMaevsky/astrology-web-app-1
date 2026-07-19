"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { resetPassword } from "@/app/actions/auth";

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(resetPassword, undefined);
  const t = useTranslations("auth.resetPassword");

  return (
    <div className="w-full max-w-md">
      <div className="rounded-2xl bg-white/80 backdrop-blur shadow-xl shadow-amber-900/10 border border-stone-200 p-8">
        <div className="mb-8 text-center">
          <p className="text-xs font-semibold tracking-widest text-amber-700 uppercase mb-2">
            Zorya
          </p>
          <h1 className="text-2xl font-semibold text-stone-900">{t("title")}</h1>
        </div>

        {state?.message ? (
          <div className="space-y-5">
            <p className="rounded-lg bg-emerald-50 border border-emerald-200 px-3.5 py-2.5 text-sm text-emerald-700">
              {state.message}
            </p>
            <Link
              href="/login"
              className="block w-full text-center rounded-lg bg-stone-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-stone-800 transition-colors"
            >
              {t("signIn")}
            </Link>
          </div>
        ) : (
          <form action={action} className="space-y-5">
            <input type="hidden" name="token" value={token} />

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-stone-700 mb-1.5">
                {t("newPassword")}
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                className="w-full rounded-lg border border-stone-300 bg-white px-3.5 py-2.5 text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent text-sm"
                placeholder="••••••••"
              />
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-stone-700 mb-1.5">
                {t("confirmPassword")}
              </label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                required
                className="w-full rounded-lg border border-stone-300 bg-white px-3.5 py-2.5 text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent text-sm"
                placeholder="••••••••"
              />
            </div>

            {state?.error && (
              <p className="rounded-lg bg-red-50 border border-red-200 px-3.5 py-2.5 text-sm text-red-700">
                {state.error}
              </p>
            )}

            <button
              type="submit"
              disabled={pending || !token}
              className="w-full rounded-lg bg-stone-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-stone-800 focus:outline-none focus:ring-2 focus:ring-stone-900 focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            >
              {pending ? t("submitPending") : t("submit")}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
