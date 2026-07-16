import type { Metadata } from "next";
import { Geist } from "next/font/google";
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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uk" className={`${geist.variable} h-full`}>
      <head>
        <link
          rel="stylesheet"
          href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
          crossOrigin=""
        />
      </head>
      <body className="min-h-full antialiased font-[family-name:var(--font-geist)]">
        {children}
      </body>
    </html>
  );
}
