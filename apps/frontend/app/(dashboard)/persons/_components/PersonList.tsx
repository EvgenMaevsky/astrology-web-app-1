"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Person, deletePerson } from "@/app/actions/persons";

function fmtDate(dt: string) {
  return new Date(dt).toLocaleDateString("en-GB", {
    year: "numeric", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export function PersonList({ persons }: { persons: Person[] }) {
  const router = useRouter();

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}"?`)) return;
    await deletePerson(id);
    router.refresh();
  };

  if (persons.length === 0) {
    return (
      <div className="text-center py-12 text-stone-400 text-sm">
        No persons yet — add one to get started.
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {persons.map((p) => (
        <li key={p.id} className="bg-white rounded-xl border border-stone-200 p-4 flex items-start justify-between gap-4 shadow-sm">
          <div className="min-w-0">
            <p className="font-semibold text-stone-800 truncate">{p.name}</p>
            <p className="text-xs text-stone-500 mt-0.5">{fmtDate(p.birth_dt)}</p>
            {p.city_label && (
              <p className="text-xs text-stone-400 mt-0.5">{p.city_label}</p>
            )}
          </div>
          <div className="flex gap-2 shrink-0">
            <Link
              href={`/charts?person=${p.id}`}
              className="rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold px-3 py-1.5 transition-colors"
            >
              Chart
            </Link>
            <button
              onClick={() => handleDelete(p.id, p.name)}
              className="rounded-lg border border-stone-200 hover:bg-red-50 hover:border-red-200 hover:text-red-600 text-stone-500 text-xs font-medium px-3 py-1.5 transition-colors"
            >
              Delete
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}
