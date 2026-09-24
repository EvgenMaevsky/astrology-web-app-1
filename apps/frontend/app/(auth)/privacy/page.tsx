import Link from "next/link";
import { THEME } from "@/app/_components/ui/theme";

// Dark marketing surface — docs/plans/2026-09-24-e7-redesign-design.md §5.
const ui = THEME.dark;

export const metadata = { title: "Privacy — Astrodite" };

export default function PrivacyPage() {
  return (
    <div className="w-full max-w-2xl">
      {/* ЧЕРНЕТКА — не юридична консультація; власник має вичитати перед публічним запуском */}
      <div className={`${ui.card} space-y-6 p-8 text-sm text-starlight shadow-2xl shadow-black/40`}>
        <div>
          <h1 className={`${ui.heading} text-3xl`}>Політика конфіденційності</h1>
          <p className="mt-2 text-xs text-dusk">Чернетка. Останнє оновлення: 2026-07-16.</p>
        </div>

        <section className="space-y-2">
          <h2 className="font-semibold text-starlight">Які дані ми зберігаємо</h2>
          <ul className="list-disc space-y-1 pl-5 text-dusk">
            <li>Email та хеш пароля (сам пароль ніде не зберігається у відкритому вигляді).</li>
            <li>Дані народження збережених персон (ім'я, дата/час, часовий пояс, координати).</li>
            <li>Збережені астрологічні карти (розрахункові дані).</li>
            <li>
              Записи про платежі (сума, валюта, дата, статус) — без даних банківської картки:
              оплату обробляють Stripe і monobank, ми не бачимо і не зберігаємо номери карток.
            </li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="font-semibold text-starlight">Мета обробки</h2>
          <p className="text-dusk">
            Дані використовуються виключно для надання функціоналу сервісу: розрахунку
            астрологічних карт, збереження ваших профілів і карт, обробки підписки.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-semibold text-starlight">Строк зберігання</h2>
          <p className="text-dusk">
            Дані зберігаються, поки існує ваш акаунт. Ви можете видалити акаунт і всі пов'язані
            дані в будь-який момент на сторінці{" "}
            <Link href="/account" className={ui.link}>
              Account
            </Link>.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-semibold text-starlight">Право на видалення</h2>
          <p className="text-dusk">
            Видалення акаунта незворотно видаляє ваші персони, збережені карти та підтверджує
            пароль перед виконанням.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-semibold text-starlight">Cookies</h2>
          <p className="text-dusk">
            Ми використовуємо лише технічні cookies для автентифікації (сесія/оновлення токена).
            Рекламних чи трекінгових cookies немає. За наявності — помилки можуть надсилатись у
            Sentry для діагностики збоїв.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-semibold text-starlight">Аналітика</h2>
          <p className="text-dusk">
            За наявності може бути підключена Plausible Analytics — сервіс без cookies, який
            не збирає персональні дані й не відстежує користувачів між сайтами. Використовується
            лише для агрегованої статистики відвідувань (кількість переглядів сторінок, звідки
            прийшли відвідувачі) — без банера згоди, оскільки персональні дані не обробляються.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-semibold text-starlight">Контакти</h2>
          <p className="text-dusk">
            Питання щодо ваших даних, зокрема запити на доступ, виправлення чи
            видалення, надсилайте на{" "}
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
