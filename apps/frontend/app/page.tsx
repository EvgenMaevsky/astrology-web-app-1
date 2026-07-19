import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { getPlans } from "@/app/actions/billing";
import { LanguageSwitcher } from "@/app/_components/LanguageSwitcher";
import { getFeatureTranslator } from "@/app/lib/billing-i18n";

export default async function LandingPage() {
  const t = await getTranslations("landing");
  const [plans, translateFeature] = await Promise.all([getPlans(), getFeatureTranslator()]);

  const FEATURES = [
    { title: t("features.accuracyTitle"), body: t("features.accuracyBody") },
    { title: t("features.houseSystemsTitle"), body: t("features.houseSystemsBody") },
    { title: t("features.transitsTitle"), body: t("features.transitsBody") },
    { title: t("features.atlasTitle"), body: t("features.atlasBody") },
    { title: t("features.savedTitle"), body: t("features.savedBody") },
    { title: t("features.aspectsTitle"), body: t("features.aspectsBody") },
  ];

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,#f5e6c8_0%,#ede0cc_50%,#e5d5b8_100%)]">
      <div className="max-w-5xl mx-auto px-6 pt-6 flex justify-end">
        <LanguageSwitcher />
      </div>
      {/* Hero */}
      <header className="max-w-5xl mx-auto px-6 pt-14 pb-16 text-center">
        <p className="text-xs font-semibold tracking-widest text-amber-700 uppercase mb-4">
          {t("badge")}
        </p>
        <h1 className="text-4xl sm:text-5xl font-bold text-stone-900 tracking-tight">
          {t("heroTitle")}
        </h1>
        <p className="mt-4 text-lg text-stone-600 max-w-2xl mx-auto">
          {t("heroSubtitle")}
        </p>
        <div className="mt-8 flex items-center justify-center gap-4">
          <Link
            href="/register"
            className="rounded-lg bg-stone-900 hover:bg-stone-800 text-white text-sm font-semibold px-6 py-3 transition-colors"
          >
            {t("tryFree")}
          </Link>
          <Link
            href="/login"
            className="rounded-lg border border-stone-300 hover:bg-white/60 text-stone-700 text-sm font-semibold px-6 py-3 transition-colors"
          >
            {t("signIn")}
          </Link>
        </div>
      </header>

      {/* Features */}
      <section className="max-w-5xl mx-auto px-6 pb-16">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="rounded-2xl bg-white/70 backdrop-blur border border-stone-200 p-6"
            >
              <h3 className="text-sm font-semibold text-stone-900">{f.title}</h3>
              <p className="mt-2 text-sm text-stone-600">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing teaser */}
      {plans.length > 0 && (
        <section className="max-w-5xl mx-auto px-6 pb-20">
          <h2 className="text-center text-2xl font-bold text-stone-900 mb-8">
            {t("pricingTitle")}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {plans.map((plan) => (
              <div
                key={plan.id}
                className="rounded-2xl bg-white/70 backdrop-blur border border-stone-200 p-6 flex flex-col"
              >
                <h3 className="text-sm font-semibold text-stone-900 uppercase tracking-wider">
                  {plan.name}
                </h3>
                <p className="mt-2 text-3xl font-bold text-stone-900">
                  ${plan.price_usd}
                  <span className="text-sm font-normal text-stone-500">{t("perMonth")}</span>
                </p>
                <ul className="mt-4 space-y-1.5 text-sm text-stone-600 flex-1">
                  {plan.features.map((f) => (
                    <li key={f}>• {translateFeature(f)}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="text-center mt-8">
            <Link
              href="/register"
              className="rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold px-6 py-3 transition-colors"
            >
              {t("startFree")}
            </Link>
          </div>
        </section>
      )}

      {/* Footer */}
      <footer className="border-t border-stone-200/60">
        <div className="max-w-5xl mx-auto px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-stone-500">
          <span>{t("footerCopyright", { year: new Date().getFullYear() })}</span>
          <div className="flex items-center gap-6">
            <Link href="/privacy" className="hover:text-stone-800">{t("privacy")}</Link>
            <Link href="/terms" className="hover:text-stone-800">{t("terms")}</Link>
            <Link href="/login" className="hover:text-stone-800">{t("signIn")}</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
