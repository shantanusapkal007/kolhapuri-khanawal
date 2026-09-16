import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AppShell } from "@/components/navigation/AppShell";
import { FirebaseAnalytics } from "@/components/analytics/FirebaseAnalytics";
import { PwaRegister } from "@/components/pwa/PwaRegister";
import { PwaInstallPrompt } from "@/components/pwa/PwaInstallPrompt";
import { GlobalErrorBoundary } from "@/components/common/GlobalErrorBoundary";

export const metadata: Metadata = {
  title: "कोल्हापुरी खानावळ — Kolhapuri Khanawal Restaurant OS",
  description: "Production Restaurant Operating System, 1-Tap KOT, 3-Tier Stock Ledger, Shared Tables & Multi-Tender POS",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "खानावळ POS",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512x512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
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
        <PwaRegister />
        <PwaInstallPrompt />
        <FirebaseAnalytics />
        <GlobalErrorBoundary>
          <AppShell>{children}</AppShell>
        </GlobalErrorBoundary>
      </body>
    </html>
  );
}
