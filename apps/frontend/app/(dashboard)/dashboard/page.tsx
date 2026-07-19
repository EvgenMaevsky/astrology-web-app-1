import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { getPersonCount } from "@/app/actions/persons";

export default async function DashboardPage() {
  const personCount = await getPersonCount();
  const t = await getTranslations("dashboard");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-stone-900">{t("overview")}</h1>
        <p className="mt-1 text-sm text-stone-500">{t("subtitle")}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Link
          href="/persons"
          className="rounded-xl bg-white border border-stone-200 p-5 shadow-sm hover:border-amber-300 transition-colors"
        >
          <p className="text-xs font-semibold uppercase tracking-widest text-stone-400">{t("persons")}</p>
          <p className="mt-2 text-3xl font-semibold text-stone-900">{personCount}</p>
          <p className="mt-1 text-xs text-stone-400">{t("personsSubtitle")}</p>
        </Link>

        <Link
          href="/charts"
          className="rounded-xl bg-white border border-stone-200 p-5 shadow-sm hover:border-amber-300 transition-colors"
        >
          <p className="text-xs font-semibold uppercase tracking-widest text-stone-400">{t("charts")}</p>
          <p className="mt-2 text-3xl font-semibold text-stone-900">—</p>
          <p className="mt-1 text-xs text-stone-400">{t("chartsSubtitle")}</p>
        </Link>

        <div className="rounded-xl bg-white border border-stone-200 p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-widest text-stone-400">{t("reports")}</p>
          <p className="mt-2 text-3xl font-semibold text-stone-400">—</p>
          <p className="mt-1 text-xs text-stone-400">{t("reportsSubtitle")}</p>
        </div>
      </div>

      <div className="rounded-xl bg-white border border-stone-200 p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-stone-700 mb-3">{t("gettingStarted")}</h2>
        <ol className="space-y-2 text-sm text-stone-600 list-decimal list-inside">
          <li>
            {t.rich("step1", {
              link: (chunks) => (
                <Link href="/persons" className="text-amber-700 hover:underline">{chunks}</Link>
              ),
            })}
          </li>
          <li>
            {t.rich("step2", {
              link: (chunks) => (
                <Link href="/charts" className="text-amber-700 hover:underline">{chunks}</Link>
              ),
            })}
          </li>
          <li>{t("step3")}</li>
        </ol>
      </div>
    </div>
  );
}
