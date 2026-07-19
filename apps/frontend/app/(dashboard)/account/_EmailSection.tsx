"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { sendVerificationEmail } from "@/app/actions/auth";

export function EmailSection({ email, verified }: { email: string; verified: boolean }) {
  const t = useTranslations("account");
  const [state, action, pending] = useActionState(sendVerificationEmail, undefined);

  return (
    <div className="bg-white rounded-xl border border-stone-200 p-6 space-y-3">
      <h2 className="text-sm font-semibold text-stone-700 uppercase tracking-wider">{t("email")}</h2>
      <div className="flex items-center gap-3">
        <span className="text-sm text-stone-800">{email}</span>
        {verified ? (
          <span className="rounded-full bg-emerald-100 text-emerald-800 text-xs font-semibold px-2.5 py-1">
            {t("verified")}
          </span>
        ) : (
          <span className="rounded-full bg-amber-100 text-amber-800 text-xs font-semibold px-2.5 py-1">
            {t("unverified")}
          </span>
        )}
      </div>

      {!verified && (
        <form action={action} className="flex items-center gap-3">
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg border border-stone-300 bg-white hover:bg-stone-50 disabled:opacity-50 text-stone-700 text-sm font-medium px-3.5 py-1.5 transition-colors"
          >
            {pending ? t("sending") : t("resend")}
          </button>
          {state?.message && <span className="text-sm text-emerald-700">{state.message}</span>}
        </form>
      )}
    </div>
  );
}
