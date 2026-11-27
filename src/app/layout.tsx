import "@fontsource-variable/jetbrains-mono";
import "./globals.css";
import { GeistSans } from "geist/font/sans";
import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export const metadata: Metadata = {
  title: "Network · Admin",
  description: "AdGuard Home Steuerzentrale mit Roaming-Schutz, Block-Page-Studio und Live-Query-Log.",
  manifest: `${base}/manifest.webmanifest`,
  icons: { icon: `${base}/icon.svg`, apple: `${base}/icon-192.png` },
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Network" },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#050505",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="de" className={GeistSans.variable}>
      <body className="font-sans">{children}</body>
    </html>
  );
}
