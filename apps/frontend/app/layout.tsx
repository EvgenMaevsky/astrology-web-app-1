import type { Metadata } from "next";
import { Cormorant_Garamond, Geist } from "next/font/google";
import Script from "next/script";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import { getSiteSettings, siteImageUrl } from "@/app/lib/site-settings";
import "./globals.css";

// `subsets` only decides what gets PRELOADED — the Cyrillic @font-face is
// served either way. It is listed because Ukrainian is the default locale:
// without the preload, Ukrainian text first paints in the fallback font and
// then visibly swaps once the Cyrillic file arrives.
const geist = Geist({ subsets: ["latin", "cyrillic"], variable: "--font-geist" });

// Display face for headings (docs/plans/2026-09-24-e7-redesign-design.md §2).
// Plain "cyrillic" already covers every Ukrainian letter, ґ (U+0491)
// included — verified in the browser against the loaded faces' ranges.
const cormorant = Cormorant_Garamond({
  subsets: ["latin", "cyrillic"],
  weight: ["500", "600"],
  variable: "--font-cormorant",
});

export async function generateMetadata(): Promise<Metadata> {
  const [t, locale, site] = await Promise.all([
    getTranslations("common.meta"),
    getLocale(),
    getSiteSettings(),
  ]);

  // Admin-set values win; anything left blank — or the whole object, if the
  // backend is unreachable — falls back to the i18n dictionaries, so the page
  // always has a title.
  const title = (locale === "en" ? site?.title_en : site?.title_uk) || t("title");
  const description =
    (locale === "en" ? site?.description_en : site?.description_uk) || t("description");
  const ogImage = site?.og_image ? siteImageUrl(site.og_image) : undefined;

  return {
    title,
    description,
    // Always exactly one icon. The bundled default lives in public/ rather
    // than as app/favicon.ico on purpose: the file convention emits its own
    // <link rel="icon">, and a second tag alongside this one leaves the
    // browser to pick between them.
    icons: { icon: site?.favicon ? siteImageUrl(site.favicon) : "/favicon.ico" },
    openGraph: {
      title,
      description,
      type: "website",
      ...(ogImage ? { images: [ogImage] } : {}),
    },
    ...(site?.noindex ? { robots: { index: false, follow: false } } : {}),
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();

  return (
    <html
      lang={locale}
      className={`${geist.variable} ${cormorant.variable} h-full`}
      data-scroll-behavior="smooth"
    >
      <head>
        <link
          rel="stylesheet"
          href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
          crossOrigin=""
        />
      </head>
      <body className="min-h-full antialiased font-[family-name:var(--font-geist)]">
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
      {process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN && (
        <Script
          defer
          data-domain={process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN}
          src="https://plausible.io/js/script.js"
          strategy="afterInteractive"
        />
      )}
    </html>
  );
}
