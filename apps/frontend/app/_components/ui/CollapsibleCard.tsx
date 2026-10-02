/**
 * A result card that folds away: the owner's call is that only the first
 * table of a result is open, so the page reads as a summary rather than a
 * wall of numbers.
 *
 * Native <details>/<summary>: keyboard, screen readers and "find in page"
 * (which opens a closed details) all work with no script. `defaultOpen` is
 * only the initial state — after that the browser owns it.
 */
export function CollapsibleCard({
  title,
  defaultOpen = false,
  children,
}: {
  title: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details open={defaultOpen} className="group overflow-hidden rounded-xl border border-mist-200 bg-white">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 bg-mist-50 px-4 py-3 transition-colors hover:bg-mist-100 [&::-webkit-details-marker]:hidden">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-600">{title}</h3>
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          aria-hidden="true"
          className="shrink-0 text-ink-600 transition-transform group-open:rotate-180"
        >
          <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </summary>
      <div className="border-t border-mist-100">{children}</div>
    </details>
  );
}
