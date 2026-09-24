import Link from "next/link";
import { THEME } from "@/app/_components/ui/theme";

// Dark marketing surface — docs/plans/2026-09-24-e7-redesign-design.md §5.
const ui = THEME.dark;

export const metadata = { title: "Terms — Astrodite" };

export default function TermsPage() {
  return (
    <div className="w-full max-w-2xl">
      {/* ЧЕРНЕТКА — не юридична консультація; власник має вичитати перед публічним запуском */}
      <div className={`${ui.card} space-y-6 p-8 text-sm text-starlight shadow-2xl shadow-black/40`}>
        <div>
          <h1 className={`${ui.heading} text-3xl`}>Умови користування</h1>
          <p className="mt-2 text-xs text-dusk">Чернетка. Останнє оновлення: 2026-07-16.</p>
        </div>

        <section className="space-y-2">
          <h2 className="font-semibold text-starlight">Опис сервісу</h2>
          <p className="text-dusk">
            Astrodite — веб-сервіс для розрахунку натальних, транзитних, соляр- та синастрійних
            астрологічних карт. Доступ надається на умовах, викладених нижче.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-semibold text-starlight">Тарифи, оплата і скасування</h2>
          <p className="text-dusk">
            Сервіс має безкоштовний план з обмеженнями та платний план Pro з
            оплатою щомісяця або за рік. Оплата обробляється через Stripe (підписка
            з автопродовженням на той самий період — місяць або рік) або monobank
            (разовий платіж — 30 або 365 днів доступу, без автопродовження).
            Stripe-підписку можна скасувати будь-коли через Customer Portal — доступ
            до платних функцій зберігається до кінця оплаченого періоду. Платіж
            через monobank не потребує скасування: доступ просто закінчується в кінці
            оплаченого періоду, і ви можете продовжити його новим платежем у
            будь-який момент.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-semibold text-starlight">Відмова від відповідальності</h2>
          <p className="text-dusk">
            Астрологічний контент, який надає сервіс, має розважально-довідковий характер і не
            є професійною психологічною, медичною, фінансовою чи юридичною консультацією.
            Рішення, прийняті на основі цього контенту, — виключно на вашу відповідальність.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-semibold text-starlight">Обмеження відповідальності</h2>
          <p className="text-dusk">
            Сервіс надається "як є". Ми докладаємо зусиль для точності астрономічних розрахунків,
            але не гарантуємо безперебійну роботу чи відсутність помилок і не несемо
            відповідальності за непрямі збитки, пов'язані з використанням сервісу.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-semibold text-starlight">Зміни умов</h2>
          <p className="text-dusk">
            Ми можемо оновлювати ці умови. Суттєві зміни будуть повідомлені через сервіс або на
            вказану вами email-адресу.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-semibold text-starlight">Контакти</h2>
          <p className="text-dusk">
            З питань щодо цих умов пишіть на{" "}
            <a href="mailto:info@astrodite.cc" className={ui.link}>
              info@astrodite.cc
            </a>
            .
          </p>
        </section>

        <p className="border-t border-space-700 pt-4 text-center">
          <Link href="/" className={ui.link}>
            На головну
          </Link>
        </p>
      </div>
    </div>
  );
}
