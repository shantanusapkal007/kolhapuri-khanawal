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

  const itemsToRender = isWaiter
    ? waiterNavItems
    : [
        ...adminNavItems.slice(1, 4),
        {
          href: "/menu",
          label: "Menu",
          localLabel: "Menu",
          icon: UtensilsCrossed,
          isActive: pathname.startsWith("/menu"),
        },
      ];

  return (
    <nav
      aria-label="Mobile Navigation Bar"
      className="fixed bottom-0 left-0 right-0 z-40 lg:hidden glass-bottom-bar bg-[#FCFAF7]/95 backdrop-blur-2xl border-t border-[#E8E1D7] shadow-[0_-8px_30px_rgba(40,25,15,0.08)] px-1 pt-1 pb-[max(0.55rem,env(safe-area-inset-bottom))]"
    >
      <div
        className={`grid ${
          isWaiter ? "grid-cols-3 max-w-xs" : "grid-cols-5 max-w-md"
        } items-stretch mx-auto gap-0.5`}
      >
        {itemsToRender.map((item) => {
          const Icon = item.icon;
          const active = item.isActive;

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => triggerHaptic("tap")}
              className={`relative flex flex-col items-center justify-center min-h-[46px] py-1 px-0.5 rounded-xl transition-all touch-manipulation active:scale-95 ${
                active
                  ? "text-red-700 font-black"
                  : "text-stone-500 hover:text-stone-900 font-bold"
              }`}
            >
              {/* Active Indicator Backdrop */}
              {active && (
                <div className="absolute inset-x-1 inset-y-1 bg-gradient-to-b from-red-50/90 to-amber-50/40 rounded-xl -z-10 border border-red-200/60 shadow-2xs" />
              )}

              <div className="relative flex items-center justify-center">
                <Icon
                  className={`w-4 h-4 sm:w-5 sm:h-5 transition-transform ${
                    active ? "scale-110 text-red-700 stroke-[2.5]" : "text-stone-500 stroke-[2]"
                  }`}
                />

                {/* Badge indicator */}
                {item.badge && (
                  <span
                    className={`absolute -top-1.5 -right-2.5 min-w-[14px] h-[14px] px-1 rounded-full text-[8px] font-black leading-none flex items-center justify-center ring-2 ring-[#FCFAF7] shadow-xs ${item.badgeColor}`}
                  >
                    {item.badge}
                  </span>
                )}
              </div>

              <span className="text-[10px] leading-tight mt-1 font-extrabold tracking-tight truncate max-w-full text-center">
                {item.label}
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
          className="relative flex flex-col items-center justify-center min-h-[46px] py-1 px-0.5 rounded-xl text-stone-500 hover:text-stone-900 transition-all touch-manipulation active:scale-95 font-bold cursor-pointer"
          aria-label="Open staff & back-office options"
        >
          <div className="relative flex items-center justify-center">
            <div className="w-4 h-4 sm:w-5 sm:h-5 flex items-center justify-center rounded-lg bg-stone-100 border border-stone-200/80 text-stone-700">
              {isWaiter ? <KeyRound className="w-3 h-3" /> : <LayoutGrid className="w-3 h-3" />}
            </div>
          </div>
          <span className="text-[10px] leading-tight mt-1 font-extrabold tracking-tight truncate max-w-full text-center">
            {isWaiter ? "Staff" : "More"}
          </span>
        </button>
      </div>
    </nav>
  );
}
