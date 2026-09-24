import { cache } from "react";
import { API_URL } from "@/app/lib/auth";

export type SiteSettings = {
  title_uk: string | null;
  title_en: string | null;
  description_uk: string | null;
  description_en: string | null;
  favicon: string | null;
  og_image: string | null;
  logo_dark: string | null;
  logo_light: string | null;
  noindex: boolean;
};

// Uploaded images are fetched by the *browser* (and by crawlers), so their URL
// has to be one the outside world can resolve. API_URL doubles as that here:
// the frontend runs on Vercel, which has no private path to the backend, so
// the value it is given is already the public one. NEXT_PUBLIC_API_URL is an
// escape hatch for a deployment where those two differ.
const PUBLIC_API_URL = process.env.NEXT_PUBLIC_API_URL ?? API_URL;

export function siteImageUrl(name: string): string {
  return `${PUBLIC_API_URL}/api/v1/site-settings/file/${name}`;
}

/**
 * Site-wide SEO settings, or null if they cannot be read.
 *
 * Callers must treat null as "use the built-in defaults": page metadata is
 * rendered on every request, and a backend hiccup must not take the whole
 * page down with it.
 *
 * no-store is deliberate — a cached copy would mean an admin's change only
 * appears at the next deploy, which defeats the point of having this page.
 * React's cache() still dedupes within one request: metadata, the header
 * logo and the footer logo all ask, and no-store fetches are not deduped
 * on their own.
 */
export const getSiteSettings = cache(async (): Promise<SiteSettings | null> => {
  try {
    const res = await fetch(`${API_URL}/api/v1/site-settings`, { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as SiteSettings;
  } catch {
    return null;
  }
});
