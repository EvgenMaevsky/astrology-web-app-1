import Link from "next/link";
import { getPlans } from "@/app/actions/billing";

const FEATURES = [
  {
    title: "Точність",
    body: "Власний ефемеридний рушій на даних JPL DE440s — позиції планет збігаються зі Swiss Ephemeris із точністю до 0,003°.",
  },
  {
    title: "6 систем будинків",
    body: "Placidus, Koch, Equal, Whole Sign, Regiomontanus, Campanus.",
  },
  {
    title: "Транзити, соляри, синастрія",
    body: "Поточні транзити на натальну карту, соляр (Solar Return) на будь-який рік, порівняння двох карт.",
  },
  {
    title: "Атлас 34 000+ міст",
    body: "Пошук міста з автоматичним визначенням координат і історичного часового поясу.",
  },
  {
    title: "Збережені персони й карти",
    body: "Зберігайте дані народження та розраховані карти, повертайтесь до них будь-коли.",
  },
  {
    title: "Аспекти з орбами",
    body: "Повний набір аспектів з орбами, термінами (bounds) та арабськими частинами.",
  },
];

export default async function LandingPage() {
  const plans = await getPlans();

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,#f5e6c8_0%,#ede0cc_50%,#e5d5b8_100%)]">
      {/* Hero */}
      <header className="max-w-5xl mx-auto px-6 pt-20 pb-16 text-center">
        <p className="text-xs font-semibold tracking-widest text-amber-700 uppercase mb-4">
          Zorya
        </p>
        <h1 className="text-4xl sm:text-5xl font-bold text-stone-900 tracking-tight">
          Точна натальна астрологія у браузері
        </h1>
        <p className="mt-4 text-lg text-stone-600 max-w-2xl mx-auto">
          Власний ефемеридний рушій на даних JPL — точність розрахунків звірена
          зі Swiss Ephemeris, тим самим стандартом, яким користуються професійні
          астрологи.
        </p>
        <div className="mt-8 flex items-center justify-center gap-4">
          <Link
            href="/register"
            className="rounded-lg bg-stone-900 hover:bg-stone-800 text-white text-sm font-semibold px-6 py-3 transition-colors"
          >
            Спробувати безкоштовно
          </Link>
          <Link
            href="/login"
            className="rounded-lg border border-stone-300 hover:bg-white/60 text-stone-700 text-sm font-semibold px-6 py-3 transition-colors"
          >
            Увійти
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
            Тарифи
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
                  <span className="text-sm font-normal text-stone-500">/міс</span>
                </p>
                <ul className="mt-4 space-y-1.5 text-sm text-stone-600 flex-1">
                  {plan.features.map((f) => (
                    <li key={f}>• {f}</li>
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
              Почати безкоштовно
            </Link>
          </div>
        </section>
      )}

      {/* Footer */}
      <footer className="border-t border-stone-200/60">
        <div className="max-w-5xl mx-auto px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-stone-500">
          <span>© {new Date().getFullYear()} Zorya</span>
          <div className="flex items-center gap-6">
            <Link href="/privacy" className="hover:text-stone-800">Privacy</Link>
            <Link href="/terms" className="hover:text-stone-800">Terms</Link>
            <Link href="/login" className="hover:text-stone-800">Sign in</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
