import { getTranslations } from "next-intl/server";
import { listPersons } from "@/app/actions/persons";
import { ChartTabs } from "./_components/ChartTabs";

export const metadata = { title: "Charts — Zorya" };

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
