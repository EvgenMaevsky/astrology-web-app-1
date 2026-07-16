import type { MetadataRoute } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/login", "/register", "/privacy", "/terms"],
      disallow: ["/dashboard", "/charts", "/persons", "/account", "/billing", "/pricing", "/reports"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
