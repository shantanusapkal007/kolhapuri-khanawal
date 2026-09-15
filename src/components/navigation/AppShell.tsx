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

  if (pathname === "/login") {
    return <main className="min-h-screen bg-[#0F172A]">{children}</main>;
  }

  return (
    <div className="min-h-screen flex bg-[#F9F7F4] text-stone-900 selection:bg-red-700 selection:text-amber-100">
      {/* Sideways Navigation Bar (Desktop fixed / Mobile drawer) */}
      <Sidebar
        isMobileOpen={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
      />

      {/* Main App Container offset by sidebar width on large screens */}
      <div className="flex-1 flex flex-col min-w-0 lg:pl-72 transition-all duration-300">
        <TopHeader onOpenMobileSidebar={() => setIsMobileSidebarOpen(true)} />

        {/* Responsive main padding: tailored for waiter floor to fit all 12 tables */}
        <main
          className={`flex-1 ${
            isWaiterFloor
              ? "p-1.5 sm:p-6 lg:p-8 pb-16 lg:pb-8"
              : "p-3.5 sm:p-6 lg:p-8 pb-24 lg:pb-8"
          } max-w-7xl w-full mx-auto`}
        >
          <AuthGuard>{children}</AuthGuard>
        </main>

        {/* Mobile Sticky Thumb-Friendly Bottom Navigation */}
        <MobileBottomNav onOpenMoreDrawer={() => setIsMobileSidebarOpen(true)} />

        {/* Global Floating Toast Alert Manager */}
        <GlobalToastManager />
      </div>
    </div>
  );
}
