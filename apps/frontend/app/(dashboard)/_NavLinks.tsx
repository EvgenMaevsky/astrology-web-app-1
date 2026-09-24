"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export interface NavItem {
  href: string;
  label: string;
}

const LAYOUTS = {
  sidebar: "flex items-center px-3 py-2 text-sm rounded-lg",
  strip: "shrink-0 px-3 py-1.5 text-sm rounded-lg whitespace-nowrap",
} as const;

/**
 * The dashboard's navigation, in the sidebar (wide screens) and in the
 * horizontal strip (narrow ones). A client component only because marking
 * the current page needs the pathname, which a server layout cannot read.
 */
export function NavLinks({ items, layout }: { items: NavItem[]; layout: keyof typeof LAYOUTS }) {
  const pathname = usePathname();

  return items.map((item) => {
    // Prefix match so a page nested under a section still marks it.
    const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
    return (
      <Link
        key={item.href}
        href={item.href}
        aria-current={active ? "page" : undefined}
        className={`${LAYOUTS[layout]} transition-colors ${
          // nebula-700 on mist-100 ≈ 5.7:1
          active
            ? "bg-mist-100 font-medium text-nebula-700"
            : "text-ink-600 hover:bg-mist-100 hover:text-ink-900"
        }`}
      >
        {item.label}
      </Link>
    );
  });
}
