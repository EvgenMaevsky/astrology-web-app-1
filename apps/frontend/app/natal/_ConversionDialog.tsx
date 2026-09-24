"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";

const LOCK_SECONDS = 3;

type Cell = string | boolean;

function Mark({ value, yes, no }: { value: Cell; yes: string; no: string }) {
  if (value === true) return <span className="text-emerald-300">✓ {yes}</span>;
  if (value === false) return <span className="text-dusk">{no}</span>;
  return <span className="text-starlight">{value}</span>;
}

/**
 * Shown once per browser session after a chart is calculated, comparing what
 * the visitor just got against what an account adds.
 *
 * It stays closed for LOCK_SECONDS by design (the product owner's call). Two
 * things make that deliberate rather than hostile:
 *
 * - a visible countdown, because a dialog that ignores every click for three
 *   seconds reads as broken, and people leave rather than wait;
 * - the usual dialog semantics regardless — focus is trapped, focus returns
 *   to the result afterwards, and Escape works the moment the lock lifts.
 *   Without those a keyboard or screen-reader user is simply stuck.
 */
export function ConversionDialog({
  onClose,
  returnFocusTo,
}: {
  onClose: () => void;
  returnFocusTo: React.RefObject<HTMLElement | null>;
}) {
  const t = useTranslations("charts.popup");
  const [remaining, setRemaining] = useState(LOCK_SECONDS);
  const locked = remaining > 0;
  const dialogRef = useRef<HTMLDivElement>(null);
  const registerRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    if (!locked) return;
    const id = setInterval(() => setRemaining((n) => n - 1), 1000);
    return () => clearInterval(id);
  }, [locked]);

  // Move focus in on open and back out on close, so keyboard users are not
  // dropped at the top of the document.
  useEffect(() => {
    registerRef.current?.focus();
    const previous = returnFocusTo;
    return () => previous.current?.focus();
  }, [returnFocusTo]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !locked) {
        onClose();
        return;
      }
      if (e.key !== "Tab") return;

      // Focus trap: without it Tab walks out of the dialog into the page
      // behind, which is still there and still interactive.
      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [locked, onClose]);

  const rows: { label: string; anon: Cell; free: Cell; pro: Cell }[] = [
    { label: t("rowChart"), anon: true, free: true, pro: true },
    { label: t("rowMajor"), anon: true, free: true, pro: true },
    { label: t("rowParts"), anon: false, free: true, pro: true },
    { label: t("rowHouseSystems"), anon: false, free: true, pro: true },
    { label: t("rowSave"), anon: false, free: t("valueFreeSaved"), pro: t("valueProSaved") },
    { label: t("rowAdvanced"), anon: false, free: t("valueFreeAdvanced"), pro: t("valueProAdvanced") },
    { label: t("rowMinor"), anon: false, free: false, pro: true },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-space-950/80 p-4 backdrop-blur-sm">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="conversion-heading"
        className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-space-700 bg-space-900 p-6 shadow-2xl shadow-black/60 sm:p-8"
      >
        {!locked && (
          <button
            type="button"
            onClick={onClose}
            aria-label={t("close")}
            className="absolute right-4 top-4 rounded-full p-1.5 text-dusk transition hover:bg-space-800 hover:text-starlight"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        )}

        <div className="text-center mb-6">
          <h2 id="conversion-heading" className="font-display text-3xl font-semibold text-starlight">
            {t("heading")}
          </h2>
          <p className="mt-2 text-sm text-dusk">{t("subheading")}</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-space-700 text-xs uppercase tracking-wider text-dusk">
                <th className="py-2 text-left font-medium" />
                <th className="py-2 px-2 text-center font-medium">{t("colAnonymous")}</th>
                <th className="py-2 px-2 text-center font-medium text-gold-400">{t("colFree")}</th>
                <th className="py-2 px-2 text-center font-medium">{t("colPro")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.label} className="border-b border-space-800">
                  <td className="py-2.5 pr-3 text-starlight">{row.label}</td>
                  {([row.anon, row.free, row.pro] as Cell[]).map((cell, i) => (
                    <td key={i} className="py-2.5 px-2 text-center whitespace-nowrap">
                      <Mark value={cell} yes={t("valueYes")} no={t("valueNo")} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-7 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            ref={registerRef}
            href="/register"
            className="w-full rounded-lg bg-gold-400 px-5 py-2.5 text-center text-sm font-semibold text-gold-950 transition hover:brightness-110 sm:w-auto"
          >
            {t("ctaRegister")}
          </Link>

          <button
            type="button"
            onClick={onClose}
            disabled={locked}
            className="w-full rounded-lg border border-space-600 px-5 py-2.5 text-sm font-medium text-starlight transition hover:border-dusk disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
          >
            {locked ? t("waiting", { seconds: remaining }) : t("ctaContinue")}
          </button>
        </div>

        {/* Announced to screen readers as it changes, so the wait is audible
            as well as visible. */}
        <p aria-live="polite" className="sr-only">
          {locked ? t("waiting", { seconds: remaining }) : t("ctaContinue")}
        </p>
      </div>
    </div>
  );
}
