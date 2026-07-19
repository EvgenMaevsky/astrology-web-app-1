import Link from "next/link";

export const metadata = { title: "Privacy — Zorya" };

export default function PrivacyPage() {
  return (
    <div className="w-full max-w-2xl">
      {/* ЧЕРНЕТКА — не юридична консультація; власник має вичитати перед публічним запуском */}
      <div className="rounded-2xl bg-white/80 backdrop-blur shadow-xl shadow-amber-900/10 border border-stone-200 p-8 space-y-6 text-sm text-stone-700">
        <div>
          <p className="text-xs font-semibold tracking-widest text-amber-700 uppercase mb-2">
            Zorya
          </p>
          <h1 className="text-2xl font-semibold text-stone-900">Політика конфіденційності</h1>
          <p className="mt-2 text-xs text-stone-400">Чернетка. Останнє оновлення: 2026-07-16.</p>
        </div>

        <section className="space-y-2">
          <h2 className="font-semibold text-stone-900">Які дані ми зберігаємо</h2>
          <ul className="list-disc pl-5 space-y-1 text-stone-600">
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
          <h2 className="font-semibold text-stone-900">Мета обробки</h2>
          <p className="text-stone-600">
            Дані використовуються виключно для надання функціоналу сервісу: розрахунку
            астрологічних карт, збереження ваших профілів і карт, обробки підписки.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-semibold text-stone-900">Строк зберігання</h2>
          <p className="text-stone-600">
            Дані зберігаються, поки існує ваш акаунт. Ви можете видалити акаунт і всі пов'язані
            дані в будь-який момент на сторінці{" "}
            <Link href="/account" className="text-amber-700 hover:text-amber-800 font-medium">
              Account
            </Link>.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-semibold text-stone-900">Право на видалення</h2>
          <p className="text-stone-600">
            Видалення акаунта незворотно видаляє ваші персони, збережені карти та підтверджує
            пароль перед виконанням.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-semibold text-stone-900">Cookies</h2>
          <p className="text-stone-600">
            Ми використовуємо лише технічні cookies для автентифікації (сесія/оновлення токена).
            Рекламних чи трекінгових cookies немає. За наявності — помилки можуть надсилатись у
            Sentry для діагностики збоїв.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-semibold text-stone-900">Аналітика</h2>
          <p className="text-stone-600">
            За наявності може бути підключена Plausible Analytics — сервіс без cookies, який
            не збирає персональні дані й не відстежує користувачів між сайтами. Використовується
            лише для агрегованої статистики відвідувань (кількість переглядів сторінок, звідки
            прийшли відвідувачі) — без банера згоди, оскільки персональні дані не обробляються.
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
