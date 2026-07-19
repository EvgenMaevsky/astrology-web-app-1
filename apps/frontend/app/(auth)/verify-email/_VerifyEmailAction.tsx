"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { verifyEmail } from "@/app/actions/auth";

// Verification only happens on an explicit user click (POST via server
// action), never on page load — mail-client link scanners (e.g. Outlook
// SafeLinks) prefetch links in emails and would burn a one-time GET token.
export function VerifyEmailAction({ token }: { token: string }) {
  const [state, action, pending] = useActionState(verifyEmail, undefined);
  const t = useTranslations("auth.verifyEmail");

  if (state?.message) {
    return (
      <div className="space-y-5">
        <p className="rounded-lg bg-emerald-50 border border-emerald-200 px-3.5 py-2.5 text-sm text-emerald-700">
          {state.message}
        </p>
        <Link
          href="/dashboard"
          className="block w-full text-center rounded-lg bg-stone-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-stone-800 transition-colors"
        >
          {t("goToDashboard")}
        </Link>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="token" value={token} />
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
  );
}
