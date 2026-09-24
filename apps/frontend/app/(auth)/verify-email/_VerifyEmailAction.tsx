"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { verifyEmail } from "@/app/actions/auth";
import { THEME } from "@/app/_components/ui/theme";

// Dark marketing surface — docs/plans/2026-09-24-e7-redesign-design.md §5.
const ui = THEME.dark;

// Verification only happens on an explicit user click (POST via server
// action), never on page load — mail-client link scanners (e.g. Outlook
// SafeLinks) prefetch links in emails and would burn a one-time GET token.
export function VerifyEmailAction({ token }: { token: string }) {
  const [state, action, pending] = useActionState(verifyEmail, undefined);
  const t = useTranslations("auth.verifyEmail");

  if (state?.message) {
    return (
      <div className="space-y-5">
        <p className={ui.success}>
          {state.message}
        </p>
        <Link
          href="/dashboard"
          className={`block w-full text-center ${ui.primaryButton}`}
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
  );
}
