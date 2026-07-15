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

  return (
    <div className="max-w-4xl mx-auto space-y-2">
      <h1 className="text-xl font-semibold text-stone-800">Charts</h1>
      <p className="text-sm text-stone-500 pb-2">Natal, transit, solar return, and synastry charts.</p>
      <ChartTabs persons={persons} selectedPerson={selected} />
    </div>
  );
}
