"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Utensils,
  ChefHat,
  Receipt,
  TrendingUp,
  Wallet,
  CheckSquare,
  LayoutDashboard,
  Boxes,
  BookOpen,
  BarChart3,
  Wifi,
  WifiOff,
  RefreshCw,
  UserCheck,
  ChevronDown,
  ShoppingCart,
  Coins,
  Trash2,
  Users,
  Lock,
  UtensilsCrossed,
  Sliders,
} from "lucide-react";
import { globalRestaurantStore } from "@/lib/store/restaurant-store";
import { RoleType } from "@/types/domain";
import { outboxManager } from "@/lib/offline/outbox";
import { ConnectivityStatus } from "@/types/offline";

export function TopNavbar() {
  const pathname = usePathname();
  const [currentRole, setCurrentRole] = useState<RoleType>(globalRestaurantStore.currentUser.role);
  const [connStatus, setConnStatus] = useState<ConnectivityStatus>("ONLINE");
  const [syncing, setSyncing] = useState(false);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setConnStatus(outboxManager.getStatus());
    const interval = setInterval(() => {
      setConnStatus(outboxManager.getStatus());
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(event.target as Node)) {
        setIsMoreMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleRoleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newRole = e.target.value as RoleType;
    globalRestaurantStore.setCurrentUserRole(newRole);
    setCurrentRole(newRole);
  };

  const triggerSync = async () => {
    setSyncing(true);
    await outboxManager.syncPendingMutations();
    setSyncing(false);
  };

  // The 6 Core Operations front-and-center
  const coreNavLinks = [
    { href: "/daily-tasks", label: "Daily Tasks", localLabel: "कामे", icon: CheckSquare },
    { href: "/waiter", label: "Table Orders", localLabel: "ऑर्डर्स", icon: Utensils },
    { href: "/kitchen", label: "KOT (Kitchen)", localLabel: "किचन", icon: ChefHat },
    { href: "/billing", label: "Billing", localLabel: "बिलिंग", icon: Receipt },
    { href: "/sell", label: "Sell", localLabel: "विक्री", icon: TrendingUp },
    { href: "/expenses", label: "Expenses", localLabel: "खर्च", icon: Wallet },
  ];

  // Back-office / Administrative links segregated under "More"
  const backOfficeLinks = [
    { href: "/inventory", label: "Stock Ledger", icon: Boxes },
    { href: "/purchases", label: "Purchases & Reorder", icon: ShoppingCart },
    { href: "/suppliers", label: "Suppliers & Advances", icon: Coins },
    { href: "/recipes", label: "Recipes & Yield", icon: BookOpen },
    { href: "/wastage", label: "Wastage & Loss", icon: Trash2 },
    { href: "/staff", label: "Staff & Attendance", icon: Users },
    { href: "/daily-closing", label: "Close Day & Z-Report", icon: Lock },
    { href: "/menu", label: "Menu Master", icon: UtensilsCrossed },
    { href: "/reports", label: "Financial Reports", icon: BarChart3 },
    { href: "/dashboard", label: "Executive Dashboard", icon: LayoutDashboard },
    { href: "/settings", label: "System Settings", icon: Sliders },
  ];

  const isBackOfficeActive = backOfficeLinks.some((l) => pathname.startsWith(l.href));

  return (
    <header className="sticky top-0 z-50 bg-stone-900 text-white shadow-md border-b border-stone-800">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 flex items-center justify-between h-14">
        {/* Brand & Title */}
        <Link href="/" className="flex items-center gap-2 font-bold tracking-wide text-base sm:text-lg shrink-0">
          <span className="bg-red-600 text-white p-1.5 rounded-lg text-xs font-black">KK</span>
          <span className="text-amber-400 font-black">कोल्हापुरी खानावळ</span>
          <span className="hidden lg:inline text-xs text-stone-400 font-normal">| Restaurant OS</span>
        </Link>

        {/* 6 Core Operations Navigation Tabs */}
        <nav className="flex items-center gap-1 overflow-x-auto py-1 max-w-[55%] scrollbar-none text-xs font-medium">
          {coreNavLinks.map((link) => {
            const Icon = link.icon;
            const isActive = pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg whitespace-nowrap transition-colors ${
                  isActive
                    ? "bg-red-600 text-white font-black shadow-xs"
                    : "text-stone-300 hover:bg-stone-800 hover:text-white"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{link.label}</span>
              </Link>
            );
          })}

          {/* Segregated Back-Office Dropdown */}
          <div className="relative shrink-0" ref={moreMenuRef}>
            <button
              type="button"
              onClick={() => setIsMoreMenuOpen(!isMoreMenuOpen)}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg whitespace-nowrap transition-colors text-xs font-bold ${
                isBackOfficeActive
                  ? "bg-stone-800 text-amber-300 border border-stone-700"
                  : "text-stone-400 hover:bg-stone-800 hover:text-white"
              }`}
            >
              <span>बॅक-ऑफिस (More)</span>
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isMoreMenuOpen ? "rotate-180" : ""}`} />
            </button>

            {isMoreMenuOpen && (
              <div className="absolute right-0 mt-2 w-56 bg-stone-900 border border-stone-700 rounded-2xl shadow-2xl py-2 z-50 animate-in fade-in-80 zoom-in-95">
                <div className="px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-stone-400 border-b border-stone-800 mb-1">
                  📦 BACK-OFFICE & ADMINISTRATION
                </div>
                {backOfficeLinks.map((link) => {
                  const Icon = link.icon;
                  const active = pathname.startsWith(link.href);
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={() => setIsMoreMenuOpen(false)}
                      className={`flex items-center gap-2.5 px-3 py-2 text-xs font-semibold transition-colors ${
                        active
                          ? "bg-red-600/30 text-amber-300 font-black border-l-2 border-l-amber-400"
                          : "text-stone-300 hover:bg-stone-800 hover:text-white"
                      }`}
                    >
                      <Icon className="w-4 h-4 text-stone-400" />
                      <span>{link.label}</span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </nav>

        {/* Right Controls: Connectivity & Role Selector */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {/* Offline / Online Status */}
          <div
            onClick={triggerSync}
            title="Click to manually trigger outbox sync"
            className={`cursor-pointer flex items-center gap-1 px-2 py-1 rounded text-[11px] font-semibold uppercase tracking-wider ${
              connStatus === "ONLINE"
                ? "bg-emerald-950 text-emerald-400 border border-emerald-800"
                : connStatus === "SYNCING" || syncing
                ? "bg-amber-950 text-amber-400 border border-amber-800 animate-pulse"
                : "bg-red-950 text-red-400 border border-red-800"
            }`}
          >
            {connStatus === "ONLINE" ? (
              <Wifi className="w-3 h-3 text-emerald-400" />
            ) : connStatus === "SYNCING" || syncing ? (
              <RefreshCw className="w-3 h-3 animate-spin text-amber-400" />
            ) : (
              <WifiOff className="w-3 h-3 text-red-400" />
            )}
            <span className="hidden sm:inline">{syncing ? "SYNCING" : connStatus}</span>
          </div>

          {/* Active Role Selector */}
          <div className="flex items-center gap-1 bg-stone-800 border border-stone-700 rounded-md px-2 py-1">
            <UserCheck className="w-3.5 h-3.5 text-amber-400" />
            <select
              value={currentRole}
              onChange={handleRoleChange}
              className="bg-transparent text-white text-xs font-medium focus:outline-none cursor-pointer"
              title="Switch user role for simulation"
            >
              <option value="WAITER" className="bg-stone-900 text-white">Waiter (Rahul)</option>
              <option value="KITCHEN" className="bg-stone-900 text-white">Kitchen (Chef Suresh)</option>
              <option value="CASHIER" className="bg-stone-900 text-white">Cashier (Priya)</option>
              <option value="OWNER" className="bg-stone-900 text-white">Owner (Shantanu)</option>
              <option value="MANAGER" className="bg-stone-900 text-white">Manager (Vikram)</option>
              <option value="INVENTORY_MANAGER" className="bg-stone-900 text-white">Storekeeper (Mahesh)</option>
            </select>
          </div>
        </div>
      </div>
    </header>
  );
}
