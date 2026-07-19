import type { Metadata } from "next";
import { Geist } from "next/font/google";
import Script from "next/script";
import { NextIntlClientProvider } from "next-intl";
import { getLocale } from "next-intl/server";
import "./globals.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist" });

export const metadata: Metadata = {
  title: "Zorya — Astrology Platform",
  description: "Точна натальна астрологія у браузері: власний ефемеридний рушій, звірений зі Swiss Ephemeris, транзити, соляри, синастрія.",
  openGraph: {
    title: "Zorya — Astrology Platform",
    description: "Точна натальна астрологія у браузері: власний ефемеридний рушій, звірений зі Swiss Ephemeris, транзити, соляри, синастрія.",
    type: "website",
  },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();

  return (
    <html lang={locale} className={`${geist.variable} h-full`}>
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
