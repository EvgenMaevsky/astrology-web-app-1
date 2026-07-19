import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { listPersons } from "@/app/actions/persons";
import { ChartTabs } from "./_components/ChartTabs";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("charts");
  return { title: `${t("pageTitle")} — Zorya` };
}

export default async function ChartsPage({
  searchParams,
}: {
  searchParams: Promise<{ person?: string }>;
}) {
  const { person: personId } = await searchParams;
  const persons = await listPersons();
  const selected = personId ? persons.find((p) => p.id === personId) ?? null : null;
  const t = await getTranslations("charts");

  return (
    <div className="max-w-4xl mx-auto space-y-2">
      <h1 className="text-xl font-semibold text-stone-800">{t("pageTitle")}</h1>
      <p className="text-sm text-stone-500 pb-2">{t("pageSubtitle")}</p>
      <ChartTabs persons={persons} selectedPerson={selected} />
    </div>
  );
}
