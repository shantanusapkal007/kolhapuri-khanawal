"use client";

import React, { useState } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "./Sidebar";
import { TopHeader } from "./TopHeader";
import { MobileBottomNav } from "./MobileBottomNav";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { GlobalToastManager } from "@/components/notifications/GlobalToastManager";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const pathname = usePathname();
  const isWaiterFloor = pathname === "/waiter";
  const isOrderScreen = pathname.startsWith("/waiter/order");

  if (pathname === "/login" || pathname === "/admin/login") {
    return <main className="min-h-screen bg-[#0F172A]">{children}</main>;
  }

  return (
    <div className="min-h-[100dvh] w-full overflow-x-hidden flex bg-[#F7F4EF] text-stone-900 selection:bg-red-700 selection:text-amber-100">
      {/* Sideways Navigation Bar (Desktop fixed / Mobile drawer) */}
      <Sidebar
        isMobileOpen={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
      />

      {/* Main App Container offset by sidebar width on large screens */}
      <div className="flex-1 w-full flex flex-col min-w-0 lg:pl-72 transition-all duration-300">
        <TopHeader onOpenMobileSidebar={() => setIsMobileSidebarOpen(true)} />

        {/* Responsive main padding: full window vertical scrolling with safe clearance above mobile bottom nav */}
        <main
          className={`flex-1 w-full max-w-7xl min-w-0 mx-auto premium-page ${
            isOrderScreen
              ? "p-2 sm:p-5 lg:p-8 pb-36 lg:pb-12"
              : "p-2.5 sm:p-5 lg:p-8 pb-32 sm:pb-28 lg:pb-12"
          }`}
        >
          <AuthGuard>{children}</AuthGuard>
        </main>

        {/* Mobile Sticky Thumb-Friendly Bottom Navigation (Hidden on focused order taking screen to prevent overlap) */}
        {!isOrderScreen && (
          <MobileBottomNav onOpenMoreDrawer={() => setIsMobileSidebarOpen(true)} />
        )}

        {/* Global Floating Toast Alert Manager */}
        <GlobalToastManager />
      </div>
    </div>
  );
}
