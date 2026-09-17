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
    <div className="min-h-screen flex bg-[#F7F4EF] text-stone-900 selection:bg-red-700 selection:text-amber-100">
      {/* Sideways Navigation Bar (Desktop fixed / Mobile drawer) */}
      <Sidebar
        isMobileOpen={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
      />

      {/* Main App Container offset by sidebar width on large screens */}
      <div className="flex-1 flex flex-col min-w-0 lg:pl-72 transition-all duration-300">
        <TopHeader onOpenMobileSidebar={() => setIsMobileSidebarOpen(true)} />

        {/* Responsive main padding: tailored for waiter floor, order screen, and other views */}
        <main
          className={`flex-1 ${
            isOrderScreen
              ? "p-2.5 sm:p-6 lg:p-8 pb-36 lg:pb-8"
              : isWaiterFloor
              ? "p-2 sm:p-6 lg:p-8 pb-24 lg:pb-8"
              : "p-3.5 sm:p-6 lg:p-8 pb-28 lg:pb-8"
          } premium-page max-w-7xl w-full mx-auto`}
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
