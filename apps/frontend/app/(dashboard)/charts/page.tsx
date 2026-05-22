import { ChartForm } from "./_components/ChartForm";

export const metadata = { title: "Charts — ZET Geo" };

export default function ChartsPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-2">
      <h1 className="text-xl font-semibold text-stone-800">Natal Chart</h1>
      <p className="text-sm text-stone-500 pb-2">Enter birth data to calculate the natal chart.</p>
      <ChartForm />
    </div>
  );
}
