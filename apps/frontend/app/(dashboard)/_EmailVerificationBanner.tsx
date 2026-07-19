"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { sendVerificationEmail } from "@/app/actions/auth";

export function EmailVerificationBanner() {
  const [state, action, pending] = useActionState(sendVerificationEmail, undefined);
  const t = useTranslations("auth.verificationBanner");

  return (
    <div className="flex items-center justify-between gap-3 bg-amber-50 border-b border-amber-200 px-6 py-2 text-sm text-amber-800">
      <span>{state?.message ?? t("message")}</span>
      {!state?.message && (
        <form action={action}>
          <button
            type="submit"
            disabled={pending}
            className="font-medium text-amber-900 hover:underline disabled:opacity-60"
          >
            {pending ? t("resendPending") : t("resend")}
          </button>
        </form>
      )}
    </div>
  );
}
