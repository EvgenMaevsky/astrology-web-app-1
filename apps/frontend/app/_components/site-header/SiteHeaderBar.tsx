"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export interface HeaderLink {
  href: string;
  label: string;
}

interface Labels {
  signIn: string;
  signUp: string;
  dashboard: string;
  openMenu: string;
  closeMenu: string;
  menu: string;
}

// Past this many pixels the header gets its own background; before it, it
// sits transparently over the hero's sky.
const SCROLLED_AT = 8;

const NAV_LINK = "text-sm text-dusk transition hover:text-starlight";
// gold-950 on gold-400 ≈ 10.2:1
const PRIMARY =
  "rounded-lg bg-gold-400 px-4 py-2 text-sm font-semibold text-gold-950 transition hover:brightness-110";
const SECONDARY =
  "rounded-lg border border-space-600 px-4 py-2 text-sm font-medium text-starlight transition hover:border-dusk";

export function SiteHeaderBar({
  logo,
  languageSwitcher,
  signedIn,
  nav,
  labels,
}: {
  logo: React.ReactNode;
  languageSwitcher: React.ReactNode;
  signedIn: boolean;
  nav: HeaderLink[];
  labels: Labels;
}) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const update = () => setScrolled(window.scrollY > SCROLLED_AT);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    // The panel only exists below lg; widening the window past it with the
    // menu open would otherwise leave it stuck open for the next resize.
    const wide = window.matchMedia("(min-width: 1024px)");
    const onWide = (e: MediaQueryListEvent) => e.matches && setOpen(false);
    document.addEventListener("keydown", onKeyDown);
    wide.addEventListener("change", onWide);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      wide.removeEventListener("change", onWide);
    };
  }, [open]);

  const close = () => setOpen(false);
  const solid = scrolled || open;

  const auth = signedIn ? (
    <Link href="/dashboard" onClick={close} className={PRIMARY}>
      {labels.dashboard}
    </Link>
  ) : (
    <>
      <Link href="/login" onClick={close} className={SECONDARY}>
        {labels.signIn}
      </Link>
      <Link href="/register" onClick={close} className={PRIMARY}>
        {labels.signUp}
      </Link>
    </>
  );

  return (
    <header
      className={`fixed inset-x-0 top-0 z-40 transition-colors duration-300 ${
        solid ? "border-b border-space-800 bg-space-950/85 backdrop-blur-md" : "border-b border-transparent"
      }`}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-6 px-4 sm:px-6">
        <Link href="/" onClick={close} className="shrink-0">
          {logo}
        </Link>

        <nav aria-label={labels.menu} className="hidden items-center gap-7 lg:flex">
          {nav.map((item) => (
            <Link key={item.href} href={item.href} className={NAV_LINK}>
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-3 lg:flex">
          {languageSwitcher}
          {auth}
        </div>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="site-menu"
          aria-label={open ? labels.closeMenu : labels.openMenu}
          className="-mr-2 rounded-lg p-2 text-starlight transition hover:bg-space-800 lg:hidden"
        >
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
            {open ? (
              <path d="M5 5l12 12M17 5L5 17" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            ) : (
              <path d="M3 6h16M3 11h16M3 16h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            )}
          </svg>
        </button>
      </div>

      {open && (
        <div id="site-menu" className="border-t border-space-800 px-4 pb-6 pt-2 sm:px-6 lg:hidden">
          <nav aria-label={labels.menu} className="flex flex-col">
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={close}
                className="border-b border-space-800 py-3.5 text-base text-starlight"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="mt-5 flex items-center justify-between gap-3">
            {languageSwitcher}
            <div className="flex items-center gap-3">{auth}</div>
          </div>
        </div>
      )}
    </header>
  );
}
