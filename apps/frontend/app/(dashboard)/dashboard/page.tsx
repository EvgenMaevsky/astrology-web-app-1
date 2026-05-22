import Link from "next/link";
import { getPersonCount } from "@/app/actions/persons";

export default async function DashboardPage() {
  const personCount = await getPersonCount();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-stone-900">Overview</h1>
        <p className="mt-1 text-sm text-stone-500">Your astrology workspace.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Link
          href="/persons"
          className="rounded-xl bg-white border border-stone-200 p-5 shadow-sm hover:border-amber-300 transition-colors"
        >
          <p className="text-xs font-semibold uppercase tracking-widest text-stone-400">Persons</p>
          <p className="mt-2 text-3xl font-semibold text-stone-900">{personCount}</p>
          <p className="mt-1 text-xs text-stone-400">Saved birth profiles</p>
        </Link>

        <Link
          href="/charts"
          className="rounded-xl bg-white border border-stone-200 p-5 shadow-sm hover:border-amber-300 transition-colors"
        >
          <p className="text-xs font-semibold uppercase tracking-widest text-stone-400">Charts</p>
          <p className="mt-2 text-3xl font-semibold text-stone-900">—</p>
          <p className="mt-1 text-xs text-stone-400">Calculate natal chart</p>
        </Link>

        <div className="rounded-xl bg-white border border-stone-200 p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-widest text-stone-400">Reports</p>
          <p className="mt-2 text-3xl font-semibold text-stone-400">—</p>
          <p className="mt-1 text-xs text-stone-400">Coming soon</p>
        </div>
      </div>

      <div className="rounded-xl bg-white border border-stone-200 p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-stone-700 mb-3">Getting started</h2>
        <ol className="space-y-2 text-sm text-stone-600 list-decimal list-inside">
          <li>
            <Link href="/persons" className="text-amber-700 hover:underline">Add a person</Link>
            {" "}with their birth data
          </li>
          <li>
            <Link href="/charts" className="text-amber-700 hover:underline">Calculate a natal chart</Link>
            {" "}— load a saved person or enter data manually
          </li>
          <li>Explore planets, aspects, terms, and Arabic parts</li>
        </ol>
      </div>
    </div>
  );
}
