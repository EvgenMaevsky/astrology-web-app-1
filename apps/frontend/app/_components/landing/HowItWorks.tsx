import { getTranslations } from "next-intl/server";

export async function HowItWorks() {
  const t = await getTranslations("landing.how");

  const steps = [
    { title: t("step1Title"), body: t("step1Body") },
    { title: t("step2Title"), body: t("step2Body") },
    { title: t("step3Title"), body: t("step3Body") },
  ];

  return (
    <section id="how" className="scroll-mt-16 border-t border-space-800 bg-space-950 px-6 py-24">
      <div className="mx-auto max-w-6xl">
        <h2 className="text-center font-display text-4xl font-semibold text-starlight sm:text-5xl">{t("title")}</h2>
        <div className="relative mt-16">
          {/* The thread joining the three steps on wide screens. Outside the
              <ol>, whose children may only be <li>. A line, so nebula is
              allowed here — it is never used for text. */}
          <div
            aria-hidden="true"
            className="absolute left-[16.6%] right-[16.6%] top-6 hidden h-px bg-gradient-to-r from-nebula-500/0 via-nebula-500/60 to-nebula-500/0 md:block"
          />
          <ol className="relative grid gap-12 md:grid-cols-3">
          {steps.map((step, index) => (
            <li key={step.title} className="relative text-center">
              <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-space-600 bg-space-900 font-display text-2xl font-semibold lining-nums text-gold-400">
                {index + 1}
              </span>
              <h3 className="mt-6 text-lg font-semibold text-starlight">{step.title}</h3>
              <p className="mx-auto mt-2 max-w-xs leading-relaxed text-dusk">{step.body}</p>
            </li>
          ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
