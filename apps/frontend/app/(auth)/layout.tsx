import Link from "next/link";
import { LanguageSwitcher } from "@/app/_components/LanguageSwitcher";
import { Logo } from "@/app/_components/Logo";
import { Starfield } from "@/app/_components/Starfield";

/**
 * Sign-in, registration, password recovery, email verification and the
 * legal pages. Dark marketing surface (docs/plans/2026-09-24-e7-redesign-design.md §5).
 *
 * The sky here is thinner and does not follow the pointer: on a page whose
 * whole job is a form, stars reacting to every mouse movement would compete
 * with it. It still drifts and twinkles, so the page does not feel dead.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative isolate flex min-h-screen items-center justify-center overflow-hidden bg-space-950 p-4 py-20">
      {/* Pinned to the viewport, not the page: on a long page (chart results,
          legal text) a page-sized canvas would allocate a huge backing store
          and thin the stars out, since their count follows width only. */}
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10">
        <Starfield density={0.5} interactive={false} />
      </div>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_55%_45%_at_50%_45%,rgba(124,92,255,0.16),transparent_70%)]"
      />
      <Link href="/" className="absolute left-5 top-4 z-10">
        <Logo tone="dark" size="sm" />
      </Link>
      <div className="absolute right-4 top-4 z-10">
        <LanguageSwitcher tone="dark" />
      </div>
      <div className="relative z-10 flex w-full justify-center">{children}</div>
    </div>
  );
}
