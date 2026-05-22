import Link from "next/link";

interface Props {
  message?: string;
  required?: string;
}

export function UpgradePrompt({ message, required }: Props) {
  const planName = required === "pro" ? "Pro" : required === "expert" ? "Expert" : "Pro";
  return (
    <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 flex flex-col sm:flex-row items-start sm:items-center gap-3">
      <div className="flex-1">
        <p className="text-sm font-semibold text-amber-900">
          {planName} plan required
        </p>
        <p className="text-sm text-amber-700 mt-0.5">
          {message ?? `Upgrade to ${planName} to access this feature.`}
        </p>
      </div>
      <Link
        href="/pricing"
        className="shrink-0 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold px-4 py-2 transition-colors"
      >
        View plans
      </Link>
    </div>
  );
}
