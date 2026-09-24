"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { deleteAccount } from "@/app/actions/auth";

/**
 * hasPassword decides how deletion is confirmed. A Google-created account
 * has no password to type, so it confirms by typing its own email address
 * instead — without that path such a user could never delete their account.
 */
export function DangerZone({ hasPassword, email }: { hasPassword: boolean; email: string }) {
  const t = useTranslations("account");
  const [confirming, setConfirming] = useState(false);
  const [state, action, pending] = useActionState(deleteAccount, undefined);

  return (
    <div className="bg-white rounded-xl border border-red-200 p-6 space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-red-700 uppercase tracking-wider">{t("dangerZone")}</h2>
        <p className="mt-1 text-sm text-ink-600">
          {t("dangerZoneText")}
        </p>
      </div>

      {!confirming ? (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="rounded-lg border border-red-300 text-red-700 hover:bg-red-50 text-sm font-medium px-4 py-2 transition-colors"
        >
          {t("deleteAccount")}
        </button>
      ) : (
        <form action={action} className="space-y-3">
          {hasPassword ? (
            <>
              <label htmlFor="delete-password" className="block text-sm font-medium text-ink-700">
                {t("confirmPasswordLabel")}
              </label>
              <input
                id="delete-password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="w-full max-w-sm rounded-lg border border-mist-300 bg-white px-3.5 py-2.5 text-ink-900 placeholder:text-ink-600 focus:outline-none focus:ring-2 focus:ring-red-400 focus:border-transparent text-sm"
                placeholder="••••••••"
              />
            </>
          ) : (
            <>
              <label htmlFor="delete-email" className="block text-sm font-medium text-ink-700">
                {t("confirmEmail")}
              </label>
              <p className="text-xs text-ink-600">{t("noPasswordHint")}</p>
              <input
                id="delete-email"
                name="email"
                type="email"
                autoComplete="off"
                required
                className="w-full max-w-sm rounded-lg border border-mist-300 bg-white px-3.5 py-2.5 text-ink-900 placeholder:text-ink-600 focus:outline-none focus:ring-2 focus:ring-red-400 focus:border-transparent text-sm"
                placeholder={email}
              />
            </>
          )}

          {state?.error && (
            <p className="rounded-lg bg-red-50 border border-red-200 px-3.5 py-2.5 text-sm text-red-700 max-w-sm">
              {state.error}
            </p>
          )}

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={pending}
              className="rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white text-sm font-semibold px-4 py-2 transition-colors"
            >
              {pending ? t("deleting") : t("permanentlyDelete")}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              disabled={pending}
              className="rounded-lg border border-mist-300 text-ink-600 hover:bg-mist-50 text-sm font-medium px-4 py-2 transition-colors"
            >
              {t("cancel")}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
