"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Utensils,
  ChefHat,
  Receipt,
  LayoutGrid,
  UtensilsCrossed,
  KeyRound,
  CheckSquare,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { globalRestaurantStore } from "@/lib/store/restaurant-store";
import { triggerHaptic } from "@/lib/mobile/haptics";

interface MobileBottomNavProps {
  onOpenMoreDrawer: () => void;
}

export function MobileBottomNav({ onOpenMoreDrawer }: MobileBottomNavProps) {
  const pathname = usePathname();
  const store = globalRestaurantStore;
  const [, setTick] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setTick((t) => t + 1);
    }, 1000);

    const handleSync = () => {
      setTick((t) => t + 1);
    };
    window.addEventListener("kk-state-changed", handleSync);

    return () => {
      clearInterval(interval);
      window.removeEventListener("kk-state-changed", handleSync);
    };
  }, []);

  const occupiedTables = store.tables.filter(
    (t) => t.status === "OCCUPIED" || t.status === "SHARED"
  ).length;
  const pendingKots = store.kots.filter(
    (k) => k.status === "NEW" || k.status === "PREPARING"
  ).length;
  const activeParties = store.parties.filter(
    (p) => p.status !== "CLOSED" && p.status !== "CANCELLED"
  ).length;

  const isWaiter = store.currentUser.role === "WAITER";

  const waiterNavItems = [
    {
      href: "/waiter",
      label: "Tables",
      localLabel: "टेबल्स",
      icon: Utensils,
      isActive: pathname.startsWith("/waiter"),
      badge: occupiedTables > 0 ? `${occupiedTables}` : undefined,
      badgeColor: "bg-amber-600 text-white",
    },
    {
      href: "/menu",
      label: "Menu",
      localLabel: "मेनू",
      icon: UtensilsCrossed,
      isActive: pathname.startsWith("/menu"),
    },
  ];

  // The 6 Core Operations for Admin / Cashier / Manager
  const adminNavItems = [
    {
      href: "/daily-tasks",
      label: "Tasks",
      localLabel: "कामे",
      icon: CheckSquare,
      isActive: pathname.startsWith("/daily-tasks"),
    },
    {
      href: "/waiter",
      label: "Tables",
      localLabel: "मजला",
      icon: Utensils,
      isActive: pathname.startsWith("/waiter"),
      badge: occupiedTables > 0 ? `${occupiedTables}` : undefined,
      badgeColor: "bg-amber-600 text-white",
    },
    {
      href: "/kitchen",
      label: "KOT",
      localLabel: "किचन",
      icon: ChefHat,
      isActive: pathname.startsWith("/kitchen"),
      badge: pendingKots > 0 ? `${pendingKots}` : undefined,
      badgeColor: "bg-red-600 text-white animate-pulse",
    },
    {
      href: "/billing",
      label: "Billing",
      localLabel: "बिलिंग",
      icon: Receipt,
      isActive: pathname.startsWith("/billing"),
      badge: activeParties > 0 ? `${activeParties}` : undefined,
      badgeColor: "bg-blue-600 text-white",
    },
    {
      href: "/sell",
      label: "Sell",
      localLabel: "विक्री",
      icon: TrendingUp,
      isActive: pathname.startsWith("/sell"),
    },
    {
      href: "/expenses",
      label: "Expenses",
      localLabel: "खर्च",
      icon: Wallet,
      isActive: pathname.startsWith("/expenses"),
    },
  ];

  const itemsToRender = isWaiter ? waiterNavItems : adminNavItems;

  return (
    <nav
      aria-label="Mobile Navigation Bar"
      className="fixed bottom-0 left-0 right-0 z-40 lg:hidden glass-bottom-bar bg-white/95 backdrop-blur-lg border-t border-[#E7E2DA] shadow-[0_-4px_25px_rgba(28,25,23,0.08)] px-1.5 pt-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))]"
    >
      <div
        className={`grid ${
          isWaiter ? "grid-cols-3 max-w-sm" : "grid-cols-7 max-w-xl"
        } items-center mx-auto`}
      >
        {itemsToRender.map((item) => {
          const Icon = item.icon;
          const active = item.isActive;

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => triggerHaptic("tap")}
              className={`relative flex flex-col items-center justify-center min-h-[44px] py-1 px-1 rounded-xl transition-all touch-manipulation active:scale-95 ${
                active
                  ? "text-red-700 font-black"
                  : "text-stone-500 hover:text-stone-900 font-semibold"
              }`}
            >
              {/* Active Indicator Backdrop */}
              {active && (
                <div className="absolute inset-x-0.5 inset-y-0.5 bg-red-50/80 rounded-lg -z-10 border border-red-200/50" />
              )}

              <div className="relative">
                <Icon
                  className={`w-4 h-4 sm:w-5 sm:h-5 transition-transform ${
                    active ? "scale-110 text-red-700" : "text-stone-500"
                  }`}
                />

                {/* Badge indicator */}
                {item.badge && (
                  <span
                    className={`absolute -top-1.5 -right-2 min-w-3.5 h-3.5 px-0.5 rounded-full text-[8px] font-black flex items-center justify-center shadow-2xs ${item.badgeColor}`}
                  >
                    {item.badge}
                  </span>
                )}
              </div>

              <span className="text-[9.5px] leading-tight mt-0.5 font-bold truncate max-w-[50px] text-center">
                {item.label}
              </span>
              <span className="text-[7.5px] leading-none text-stone-400 font-medium truncate max-w-[50px] text-center">
                {item.localLabel}
              </span>
            </Link>
          );
        })}

        {/* More / Back-Office Drawer Trigger */}
        <button
          type="button"
          onClick={() => {
            triggerHaptic("tap");
            onOpenMoreDrawer();
          }}
          className="flex flex-col items-center justify-center min-h-[44px] py-1 px-1 rounded-xl text-stone-500 hover:text-stone-900 transition-all touch-manipulation active:scale-95 font-semibold"
          aria-label="Open staff & back-office options"
        >
          <div className="w-4 h-4 sm:w-5 sm:h-5 flex items-center justify-center rounded-lg bg-stone-100 border border-stone-200 text-stone-700">
            {isWaiter ? <KeyRound className="w-3 h-3" /> : <LayoutGrid className="w-3 h-3" />}
          </div>
          <span className="text-[9.5px] leading-tight mt-0.5 font-bold">
            {isWaiter ? "Staff" : "More"}
          </span>
          <span className="text-[7.5px] leading-none text-stone-400 font-medium">
            {isWaiter ? "खाते" : "इतर"}
          </span>
        </button>
      </div>
    </nav>
  );
}
