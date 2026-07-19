"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { register } from "@/app/actions/auth";

export default function RegisterPage() {
  const [state, action, pending] = useActionState(register, undefined);
  const t = useTranslations("auth.register");

  return (
    <div className="w-full max-w-md">
      <div className="rounded-2xl bg-white/80 backdrop-blur shadow-xl shadow-amber-900/10 border border-stone-200 p-8">
        <div className="mb-8 text-center">
          <p className="text-xs font-semibold tracking-widest text-amber-700 uppercase mb-2">
            Zorya
          </p>
          <h1 className="text-2xl font-semibold text-stone-900">{t("title")}</h1>
        </div>

        <form action={action} className="space-y-5">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-stone-700 mb-1.5">
              {t("email")}
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              className="w-full rounded-lg border border-stone-300 bg-white px-3.5 py-2.5 text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent text-sm"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-stone-700 mb-1.5">
              {t("password")}
              <span className="ml-2 font-normal text-stone-400">{t("passwordHint")}</span>
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
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
            disabled={pending}
            className="w-full rounded-lg bg-stone-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-stone-800 focus:outline-none focus:ring-2 focus:ring-stone-900 focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
          >
            {pending ? t("submitPending") : t("submit")}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-stone-500">
          {t("haveAccount")}{" "}
          <Link href="/login" className="font-medium text-amber-700 hover:text-amber-800">
            {t("signIn")}
          </Link>
        </p>
      </div>
    </div>
  );
}
