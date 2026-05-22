import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist" });

export const metadata: Metadata = {
  title: "ZET Geo — Astrology Platform",
  description: "Professional astrology calculations and chart analysis",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uk" className={`${geist.variable} h-full`}>
      <body className="min-h-full antialiased font-[family-name:var(--font-geist)]">
        {children}
      </body>
    </html>
  );
}
