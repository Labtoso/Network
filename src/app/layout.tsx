import type { Metadata, Viewport } from "next";
import { Geist, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

export const viewport: Viewport = {
  themeColor: "#050505",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export const metadata: Metadata = {
  title: "Labtoso Network // Zero-Trust, AdGuard 1:1 & Anti-Bypass Control Suite",
  description:
    "Zero-Trust Admin Panel, Bidirectional 1:1 AdGuard Home Mirror, 5G/Hotspot Roaming Anti-Bypass & Custom Block Page Studio (admin.labtoso.de).",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "LT Network",
  },
  icons: {
    icon: "/icon.svg",
    apple: "/icon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="de"
      className={`dark ${geistSans.variable} ${jetbrainsMono.variable}`}
    >
      <body className="min-h-screen bg-[#050505] text-slate-100 font-sans selection:bg-sky-500/20 selection:text-sky-300">
        {children}
      </body>
    </html>
  );
}
