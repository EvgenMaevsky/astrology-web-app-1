/**
 * Absolute base URL for robots.txt and sitemap.xml.
 *
 * NEXT_PUBLIC_SITE_URL was never set on Vercel, so the old `?? localhost`
 * fallback meant production served Google a sitemap of http://localhost:3000
 * URLs — every entry useless, and silently so, because nothing in the app
 * looks wrong when that happens.
 *
 * The fallback is therefore environment-aware rather than a single constant.
 * Setting NEXT_PUBLIC_SITE_URL still overrides it, which is what a preview
 * deployment or a renamed domain would need.
 */
const PRODUCTION_SITE_URL = "https://astrodite.cc";

export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.NODE_ENV === "production" ? PRODUCTION_SITE_URL : "http://localhost:3000");
