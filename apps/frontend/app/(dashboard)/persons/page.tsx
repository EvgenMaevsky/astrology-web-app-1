import { getTranslations } from "next-intl/server";
import { listPersons } from "@/app/actions/persons";
import { PersonList } from "./_components/PersonList";
import { PersonForm } from "./_components/PersonForm";

export default async function PersonsPage() {
  const persons = await listPersons();
  const t = await getTranslations("persons");

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl font-semibold text-ink-900">{t("title")}</h1>
        <p className="mt-1 text-sm text-ink-600">{t("subtitle")}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div>
          <h2 className="text-sm font-semibold text-ink-700 uppercase tracking-wider mb-4">
            {t("addNew")}
          </h2>
          <div className="bg-white rounded-xl border border-mist-200 p-6">
            <PersonForm />
          </div>
        </div>

        <div>
          <h2 className="text-sm font-semibold text-ink-700 uppercase tracking-wider mb-4">
            {t("savedCount", { count: persons.length })}
          </h2>
          <PersonList persons={persons} />
        </div>
      </div>
    </div>
  );
}
