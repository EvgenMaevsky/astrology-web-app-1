export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-stone-900">Overview</h1>
        <p className="mt-1 text-sm text-stone-500">Your astrology workspace.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          { label: "Persons", value: "0", hint: "Saved birth profiles" },
          { label: "Charts", value: "0", hint: "Calculated charts" },
          { label: "Reports", value: "0", hint: "Generated reports" },
        ].map((card) => (
          <div
            key={card.label}
            className="rounded-xl bg-white border border-stone-200 p-5 shadow-sm"
          >
            <p className="text-xs font-semibold uppercase tracking-widest text-stone-400">
              {card.label}
            </p>
            <p className="mt-2 text-3xl font-semibold text-stone-900">{card.value}</p>
            <p className="mt-1 text-xs text-stone-400">{card.hint}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl bg-white border border-stone-200 p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-stone-700 mb-3">Getting started</h2>
        <ul className="space-y-2 text-sm text-stone-600">
          <li>1. Add a person with their birth data</li>
          <li>2. Calculate a natal chart</li>
          <li>3. Explore aspects, houses, and interpretations</li>
        </ul>
      </div>
    </div>
  );
}
