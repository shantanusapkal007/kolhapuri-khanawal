import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AppShell } from "@/components/navigation/AppShell";
import { FirebaseAnalytics } from "@/components/analytics/FirebaseAnalytics";

export const metadata: Metadata = {
  title: "कोल्हापुरी खानावळ — Kolhapuri Khanawal Restaurant OS",
  description: "Production Restaurant Operating System, 1-Tap KOT, 3-Tier Stock Ledger, Shared Tables & Multi-Tender POS",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#991B1B",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-stone-900 antialiased font-sans">
        <FirebaseAnalytics />
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
