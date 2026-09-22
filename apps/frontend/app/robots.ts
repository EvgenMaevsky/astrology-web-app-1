import type { MetadataRoute } from "next";
import { getSiteSettings } from "@/app/lib/site-settings";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const site = await getSiteSettings();

  // The admin's "hide from search engines" switch has to be honoured here as
  // well as in the page meta tag — a crawler that reads robots.txt first would
  // otherwise never see the tag.
  if (site?.noindex) {
    return { rules: { userAgent: "*", disallow: "/" } };
  }

  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/natal", "/login", "/register", "/privacy", "/terms"],
      disallow: ["/dashboard", "/charts", "/persons", "/account", "/billing", "/pricing"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
