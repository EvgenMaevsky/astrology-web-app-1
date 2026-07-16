import Link from "next/link";

export const metadata = { title: "Terms — Zorya" };

export default function TermsPage() {
  return (
    <div className="w-full max-w-2xl">
      {/* ЧЕРНЕТКА — не юридична консультація; власник має вичитати перед публічним запуском */}
      <div className="rounded-2xl bg-white/80 backdrop-blur shadow-xl shadow-amber-900/10 border border-stone-200 p-8 space-y-6 text-sm text-stone-700">
        <div>
          <p className="text-xs font-semibold tracking-widest text-amber-700 uppercase mb-2">
            Zorya
          </p>
          <h1 className="text-2xl font-semibold text-stone-900">Умови користування</h1>
          <p className="mt-2 text-xs text-stone-400">Чернетка. Останнє оновлення: 2026-07-16.</p>
        </div>

        <section className="space-y-2">
          <h2 className="font-semibold text-stone-900">Опис сервісу</h2>
          <p className="text-stone-600">
            Zorya — веб-сервіс для розрахунку натальних, транзитних, соляр- та синастрійних
            астрологічних карт. Доступ надається на умовах, викладених нижче.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-semibold text-stone-900">Тарифи, оплата і скасування</h2>
          <p className="text-stone-600">
            Сервіс має безкоштовний план з обмеженнями та платний план Pro. Оплата
            обробляється через Stripe або LiqPay. Підписку можна скасувати будь-коли через
            Customer Portal (Stripe) або звернувшись до підтримки (LiqPay) — доступ до платних
            функцій зберігається до кінця оплаченого періоду.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-semibold text-stone-900">Відмова від відповідальності</h2>
          <p className="text-stone-600">
            Астрологічний контент, який надає сервіс, має розважально-довідковий характер і не
            є професійною психологічною, медичною, фінансовою чи юридичною консультацією.
            Рішення, прийняті на основі цього контенту, — виключно на вашу відповідальність.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-semibold text-stone-900">Обмеження відповідальності</h2>
          <p className="text-stone-600">
            Сервіс надається "як є". Ми докладаємо зусиль для точності астрономічних розрахунків,
            але не гарантуємо безперебійну роботу чи відсутність помилок і не несемо
            відповідальності за непрямі збитки, пов'язані з використанням сервісу.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-semibold text-stone-900">Зміни умов</h2>
          <p className="text-stone-600">
            Ми можемо оновлювати ці умови. Суттєві зміни будуть повідомлені через сервіс або на
            вказану вами email-адресу.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-semibold text-stone-900">Контакти</h2>
          <p className="text-stone-600">TODO(owner): контактний email власника сервісу.</p>
        </section>

        <p className="pt-4 border-t border-stone-100 text-center">
          <Link href="/" className="text-amber-700 hover:text-amber-800 font-medium">
            На головну
          </Link>
        </p>
      </div>
    </div>
  );
}
