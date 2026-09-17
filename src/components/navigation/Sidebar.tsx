"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Utensils,
  ChefHat,
  Receipt,
  LayoutDashboard,
  Boxes,
  BookOpen,
  BarChart3,
  CheckSquare,
  RefreshCw,
  UserCheck,
  X,
  UtensilsCrossed,
  ShoppingCart,
  Scale,
  Coins,
  Lock,
  ClipboardList,
  Building2,
  Users,
  Wrench,
  Trash2,
  Wallet,
  Sliders,
  Printer,
  Cloud,
  KeyRound,
  LogIn,
  LogOut,
  Bell,
  TrendingUp,
} from "lucide-react";
import { globalRestaurantStore } from "@/lib/store/restaurant-store";
import { RoleType, PermissionCode } from "@/types/domain";
import { hasPermission } from "@/lib/auth/rbac";
import { outboxManager } from "@/lib/offline/outbox";
import { ConnectivityStatus } from "@/types/offline";

const ROUTE_PERM_MAP: Record<string, PermissionCode> = {
  "/reports": "reports.financial",
  "/dashboard": "reports.view",
  "/billing": "bill.create",
  "/kitchen": "kot.status_update",
  "/settings": "settings.manage",
  "/printers": "settings.manage",
  "/print-bridge": "settings.manage",
  "/staff": "staff.manage",
  "/expenses": "reports.financial",
  "/daily-closing": "bill.create",
  "/purchases": "inventory.purchase",
  "/suppliers": "inventory.purchase",
  "/recipes": "recipe.view",
  "/wastage": "inventory.adjust",
  "/inventory": "inventory.view",
  "/menu": "menu.view",
  "/cash-upi": "cash_upi.reconcile",
  "/sell": "bill.create",
  "/purchase-planner": "inventory.purchase",
  "/daily-tasks": "tasks.manage",
  "/tasks-maintenance": "tasks.manage",
  "/reminders": "reminders.manage",
  "/office-orders": "office_orders.manage",
};

interface SidebarProps {
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export function Sidebar({ isMobileOpen = false, onCloseMobile }: SidebarProps) {
  const pathname = usePathname();
  const store = globalRestaurantStore;
  const [, setTick] = useState(0);

  const [currentRole, setCurrentRole] = useState<RoleType>(store.currentUser.role);
  const [connStatus, setConnStatus] = useState<ConnectivityStatus>("ONLINE");
  const [syncing, setSyncing] = useState(false);
  const [currentTime, setCurrentTime] = useState<string>("");

  useEffect(() => {
    setConnStatus(outboxManager.getStatus());
    const interval = setInterval(() => {
      setConnStatus(outboxManager.getStatus());
      setTick((t) => t + 1);
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
      );
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleRoleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newRole = e.target.value as RoleType;
    store.setCurrentUserRole(newRole);
    setCurrentRole(newRole);
    setTick((t) => t + 1);
  };

  const triggerSync = async () => {
    setSyncing(true);
    await outboxManager.syncPendingMutations();
    setSyncing(false);
    setTick((t) => t + 1);
  };

  // Dynamic live counters
  const occupiedTables = store.tables.filter((t) => t.status === "OCCUPIED" || t.status === "SHARED").length;
  const pendingKots = store.kots.filter((k) => k.status === "NEW" || k.status === "PREPARING").length;
  const activeUnpaidParties = store.parties.filter((p) => p.status !== "CLOSED" && p.status !== "CANCELLED").length;
  const criticalStockCount = store.ingredients.filter((i) => i.physicalStock <= i.reorderLevel).length;
  const unreviewedExpCount = store.expenses.filter((e) => !e.isReviewed).length;
  const pendingRemindersCount = store.reminders.filter((r) => !r.isCompleted && !r.isDismissed).length;

  const [showSwitchModal, setShowSwitchModal] = useState(false);
  const [switchPin, setSwitchPin] = useState("");
  const [switchError, setSwitchError] = useState<string | null>(null);
  const [selectedTargetRole, setSelectedTargetRole] = useState<string>("OWNER");

  const waiterSections = [
    {
      label: "WAITER FLOOR (वेटर मजला)",
      items: [
        {
          href: "/waiter",
          label: "Floor & 12 Tables",
          subtitle: "Parties & Quick KOT",
          icon: Utensils,
          badge: `${occupiedTables}/12 Tables`,
          badgeColor: occupiedTables > 0 ? "bg-amber-100 text-amber-800 border border-amber-300" : "bg-stone-100 text-stone-500",
        },
        {
          href: "/menu",
          label: "Menu Catalog",
          subtitle: "Dishes, Prices & Stock",
          icon: UtensilsCrossed,
        },
      ],
    },
  ];

  const navSections = [
    {
      label: "🔥 CORE OPERATIONS (मुख्य कामकाज)",
      items: [
        {
          href: "/daily-tasks",
          label: "Daily Tasks & SOP",
          subtitle: "सुरक्षा व दैनंदिन तपासणी",
          icon: CheckSquare,
        },
        {
          href: "/waiter",
          label: "Floor & 12 Tables",
          subtitle: "Parties & Quick KOT",
          icon: Utensils,
          badge: `${occupiedTables}/12 Tables`,
          badgeColor: occupiedTables > 0 ? "bg-amber-100 text-amber-800 border border-amber-300" : "bg-stone-100 text-stone-500",
        },
        {
          href: "/kitchen",
          label: "Kitchen Display (KDS)",
          subtitle: "Station routing & timers",
          icon: ChefHat,
          badge: pendingKots > 0 ? `${pendingKots} Active` : "Clear",
          badgeColor: pendingKots > 0 ? "bg-red-100 text-red-700 border border-red-300 animate-pulse" : "bg-emerald-100 text-emerald-800",
        },
        {
          href: "/billing",
          label: "Cashier & Billing Desk",
          subtitle: "Thermal POS, UPI QR & GST",
          icon: Receipt,
          badge: `${activeUnpaidParties} Seated`,
          badgeColor: activeUnpaidParties > 0 ? "bg-blue-100 text-blue-800 border border-blue-300" : "bg-stone-100 text-stone-500",
        },
        {
          href: "/sell",
          label: "Sell & Sales Register",
          subtitle: "आजची विक्री, गल्ला व रीप्रिंट",
          icon: TrendingUp,
        },
        {
          href: "/expenses",
          label: "Hotel Expenses Master",
          subtitle: "१३ प्रवर्ग, पार्टी व लेजर वजा",
          icon: Wallet,
          badge: unreviewedExpCount > 0 ? `${unreviewedExpCount} Review` : undefined,
          badgeColor: "bg-amber-100 text-amber-900 border border-amber-300",
        },
      ],
    },
    {
      label: "📦 BACK-OFFICE & ADMINISTRATION (इतर व्यवस्थापन)",
      items: [
        {
          href: "/",
          label: "Owner Quick View",
          subtitle: "५ मुख्य प्रश्न (5 Questions)",
          icon: Home,
        },
        {
          href: "/inventory",
          label: "Inventory Stock Ledger",
          subtitle: "3-Tier stock & reconciliation",
          icon: Boxes,
          badge: criticalStockCount > 0 ? `${criticalStockCount} Low` : undefined,
          badgeColor: "bg-red-100 text-red-700 border border-red-300",
        },
        {
          href: "/purchases",
          label: "Fast Purchases & Reorder",
          subtitle: "Daily meat, rice, 1-tap reorder",
          icon: ShoppingCart,
        },
        {
          href: "/suppliers",
          label: "Suppliers & Advances",
          subtitle: "Net invoice settlement",
          icon: Coins,
        },
        {
          href: "/purchase-planner",
          label: "Morning Purchase Planner",
          subtitle: "Daily par-requirement calc",
          icon: ClipboardList,
        },
        {
          href: "/recipes",
          label: "Recipe BOMs & Yields",
          subtitle: "Portion calculator & margins",
          icon: BookOpen,
        },
        {
          href: "/wastage",
          label: "Wastage & Loss Logger",
          subtitle: "Reason codes & stock deduct",
          icon: Trash2,
        },
        {
          href: "/staff",
          label: "Staff & Attendance",
          subtitle: "1-Click roster, advances & salary",
          icon: Users,
        },
        {
          href: "/cash-upi",
          label: "Cash & UPI Reconciliation",
          subtitle: "Drawer float vs bank sync",
          icon: Scale,
        },
        {
          href: "/daily-closing",
          label: "Close Day & Z-Report",
          subtitle: "10-Point check & thermal print",
          icon: Lock,
        },
        {
          href: "/menu",
          label: "Menu Master Catalog",
          subtitle: "Dishes, prices & live stock",
          icon: UtensilsCrossed,
        },
        {
          href: "/tasks-maintenance",
          label: "Tasks & Hotel Equipment",
          subtitle: "Freezer log & priority tasks",
          icon: Wrench,
        },
        {
          href: "/reminders",
          label: "Reminders & Alerts",
          subtitle: "Operational checklists & tasks",
          icon: Bell,
          badge: pendingRemindersCount > 0 ? `${pendingRemindersCount}` : undefined,
          badgeColor: "bg-amber-100 text-amber-800 border border-amber-300",
        },
        {
          href: "/office-orders",
          label: "Baner IT Group Orders",
          subtitle: "Corporate thali catering",
          icon: Building2,
        },
        {
          href: "/reports",
          label: "Financial Reports",
          subtitle: "P&L, taxes, dish sales",
          icon: BarChart3,
        },
        {
          href: "/dashboard",
          label: "Executive Dashboard",
          subtitle: "Analytics & audit trail",
          icon: LayoutDashboard,
        },
        {
          href: "/printers",
          label: "Printers & KP307 KOT",
          subtitle: "वाय-फाय, ब्लूटूथ व स्पूलर",
          icon: Printer,
        },
        {
          href: "/print-bridge",
          label: "Print Bridge & Cloud",
          subtitle: "क्लाउड रांग व PC ब्रिज",
          icon: Cloud,
        },
        {
          href: "/settings",
          label: "Settings & POS Config",
          subtitle: "प्रणाली सेटिंग्ज व प्रिंटर",
          icon: Sliders,
        },
      ],
    },
  ];

  // Keep the main navigation calm. Every route still exists, but infrequent
  // administration tools no longer compete with the service workflow.
  const primaryRoutes = new Set([
    "/daily-tasks", "/waiter", "/kitchen", "/billing",
    "/", "/menu", "/inventory", "/purchases", "/reports",
    "/printers", "/print-bridge", "/settings",
  ]);
  const visibleSections = (currentRole === "WAITER" ? waiterSections : navSections)
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => primaryRoutes.has(item.href)),
    }))
    .filter((section) => section.items.length > 0);

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isMobileOpen && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 z-50 bg-stone-900/50 backdrop-blur-xs lg:hidden animate-in fade-in"
        />
      )}

      {/* Sidebar Container in Pure Luxury Light Theme */}
      <aside
        className={`premium-sidebar fixed top-0 bottom-0 left-0 z-50 w-72 text-stone-900 flex flex-col justify-between border-r border-[#E7E2DA] transition-transform duration-300 lg:translate-x-0 ${
          isMobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Top Brand Header */}
        <div className="p-5 border-b border-[#E7E2DA] bg-gradient-to-b from-[#FAF8F5] to-white">
          <div className="flex items-center justify-between">
            <Link
              href="/"
              onClick={onCloseMobile}
              className="flex items-center gap-3 group"
            >
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#991B1B] via-[#B91C1C] to-[#7F1D1D] flex items-center justify-center font-black text-amber-100 text-base shadow-md shadow-red-950/20 border border-amber-400/30 ring-1 ring-red-500/20 group-hover:scale-105 transition-transform">
                KK
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h1 className="font-black text-base tracking-tight text-stone-900 leading-none">
                    कोल्हापुरी खानावळ
                  </h1>
                  <span className="w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-emerald-200" />
                </div>
                <p className="text-[10px] text-amber-900/80 mt-1 font-bold tracking-wider uppercase">
                  Traditional Restaurant OS
                </p>
              </div>
            </Link>

            {/* Mobile Close Button */}
            {onCloseMobile && (
              <button
                type="button"
                onClick={onCloseMobile}
                className="lg:hidden p-2 text-stone-500 hover:text-stone-800 rounded-xl hover:bg-stone-100 touch-manipulation active:scale-95"
                aria-label="Close navigation drawer"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>

          {/* Live Service Status Ticker */}
          <div className="mt-3.5 pt-3 border-t border-[#E7E2DA]/80 flex items-center justify-between text-[11px] text-stone-600 font-medium">
            <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-200/80 px-2.5 py-1 rounded-full">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-emerald-800 font-extrabold text-[10px]">Service Active</span>
            </div>
            <div className="font-mono text-[10px] text-stone-800 bg-white border border-[#E7E2DA] font-extrabold px-2 py-1 rounded-md shadow-xs">
              {currentTime || "IST"}
            </div>
          </div>
        </div>

        {/* Navigation Links Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-3.5 space-y-6 scrollbar-none">
          {visibleSections.map((section, idx) => (
            <div key={idx} className="space-y-1">
              <div className="px-3 text-[10px] font-black uppercase tracking-widest text-stone-400 mb-2">
                {section.label}
              </div>

              {section.items.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
                const reqPerm = ROUTE_PERM_MAP[item.href];
                const isAllowed = !reqPerm || hasPermission(currentRole, reqPerm);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={(e) => {
                      if (!isAllowed) {
                        e.preventDefault();
                        setSwitchError(`प्रवेश मर्यादित: '${item.label}' उघडण्यासाठी विशेष परवानगी (${reqPerm}) आवश्यक आहे.`);
                        setSwitchPin("");
                        setShowSwitchModal(true);
                        return;
                      }
                      if (onCloseMobile) onCloseMobile();
                    }}
                    className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-xs transition-all group ${
                      !isAllowed
                        ? "opacity-40 hover:opacity-70 text-stone-400 hover:bg-stone-50 cursor-not-allowed"
                        : isActive
                        ? "bg-gradient-to-r from-red-50/95 via-amber-50/40 to-transparent text-red-950 font-black border-l-4 border-red-600 shadow-[0_1px_3px_rgba(153,27,27,0.06)]"
                        : "text-stone-600 hover:bg-[#F6F3EC] hover:text-stone-900 font-semibold"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
                          !isAllowed
                            ? "bg-stone-100 text-stone-400"
                            : isActive
                            ? "bg-gradient-to-br from-red-600 to-red-700 text-white shadow-sm shadow-red-600/30 ring-2 ring-red-100"
                            : "bg-stone-100 text-stone-500 group-hover:text-red-700 group-hover:bg-red-50"
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold leading-tight">{item.label}</span>
                          {!isAllowed && <Lock className="w-3 h-3 text-stone-400 shrink-0" />}
                        </div>
                        {item.subtitle && (
                          <span
                            className={`text-[10px] block leading-tight font-medium ${
                              isActive ? "text-red-700" : "text-stone-400"
                            }`}
                          >
                            {item.subtitle}
                          </span>
                        )}
                      </div>
                    </div>

                    {item.badge && (
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${item.badgeColor}`}>
                        {item.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          ))}
        </div>

        {/* Bottom Panel: Role Switcher & Connectivity */}
        <div className="p-3.5 border-t border-[#E7E2DA] bg-[#FAF8F5] space-y-2.5">
          {/* Role Switcher Widget */}
          {currentRole === "WAITER" ? (
            <div className="bg-white border border-[#E7E2DA] rounded-xl p-2.5 space-y-2 shadow-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-7 h-7 rounded-lg bg-red-100 text-red-800 font-black text-xs flex items-center justify-center border border-red-200 shrink-0">
                    W
                  </div>
                  <div className="min-w-0">
                    <span className="text-xs font-black text-stone-900 block truncate">
                      {store.currentUser.name}
                    </span>
                    <span className="text-[9px] text-emerald-700 font-bold block">
                      Scope: Tables & Menu Only
                    </span>
                  </div>
                </div>
                <span className="text-[9px] bg-red-50 border border-red-200 text-red-800 font-black px-1.5 py-0.5 rounded">
                  WAITER
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setSwitchPin("");
                    setSwitchError(null);
                    setShowSwitchModal(true);
                  }}
                  className="flex-1 inline-flex items-center justify-center gap-1 bg-stone-900 hover:bg-stone-800 text-white text-[11px] font-bold py-1.5 rounded-lg transition-all active:scale-95 shadow-2xs cursor-pointer"
                >
                  <KeyRound className="w-3.5 h-3.5 text-amber-300" />
                  <span>Manager Unlock</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    store.logout();
                    if (typeof window !== "undefined") {
                      window.location.href = "/login";
                    }
                  }}
                  className="inline-flex items-center justify-center gap-1 bg-red-50 hover:bg-red-100 text-red-700 text-[11px] font-bold py-1.5 px-2.5 rounded-lg transition-all active:scale-95 border border-red-200 cursor-pointer"
                  title="Shift Logout"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>बाहेर पडा</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-white border border-[#E7E2DA] rounded-xl p-2.5 space-y-1.5 shadow-xs">
              <div className="flex items-center justify-between text-[11px] text-stone-500">
                <span className="flex items-center gap-1 font-bold text-stone-800">
                  <UserCheck className="w-3.5 h-3.5 text-amber-600" /> Active Staff Role
                </span>
                <span className="text-[10px] bg-red-50 border border-red-200 text-red-800 font-black px-1.5 py-0.2 rounded">
                  {currentRole}
                </span>
              </div>

              <select
                value={currentRole}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val.startsWith("WAITER_CRED_")) {
                    const credId = val.replace("WAITER_CRED_", "");
                    const cred = store.waiterCredentials.find((w) => w.id === credId);
                    if (cred) {
                      store.loginAsWaiter(cred);
                      setCurrentRole("WAITER");
                      setTick((t) => t + 1);
                      return;
                    }
                  }
                  handleRoleChange(e);
                }}
                className="w-full bg-[#FAF8F5] border border-[#E7E2DA] rounded-lg px-2.5 py-1.5 text-xs text-stone-900 font-bold focus:outline-none focus:ring-2 focus:ring-red-500 cursor-pointer"
              >
                <optgroup label="Management & Operations">
                  <option value="OWNER">Shantanu (Owner / Executive)</option>
                  <option value="MANAGER">Vikram Joshi (General Manager)</option>
                  <option value="CASHIER">Priya Shinde (Cashier)</option>
                  <option value="KITCHEN">Chef Suresh (Kitchen Lead)</option>
                  <option value="INVENTORY_MANAGER">Mahesh (Storekeeper)</option>
                </optgroup>
                <optgroup label="Configured Waiters">
                  {store.waiterCredentials.map((w) => (
                    <option key={w.id} value={`WAITER_CRED_${w.id}`}>
                      {w.name} (@{w.username})
                    </option>
                  ))}
                  {store.waiterCredentials.length === 0 && (
                    <option value="WAITER">Rahul Shinde (Default Waiter)</option>
                  )}
                </optgroup>
              </select>

              <div className="flex items-center gap-1.5 pt-0.5">
                <Link
                  href="/login"
                  onClick={onCloseMobile}
                  className="flex-1 inline-flex items-center justify-center gap-1 bg-stone-100 hover:bg-stone-200 text-stone-800 text-[11px] font-bold py-1.5 rounded-lg transition-all active:scale-95 border border-stone-200"
                >
                  <KeyRound className="w-3.5 h-3.5 text-amber-700" />
                  <span>लॉगिन (Login)</span>
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    store.logout();
                    if (typeof window !== "undefined") {
                      window.location.href = "/login";
                    }
                  }}
                  className="inline-flex items-center justify-center gap-1 bg-red-50 hover:bg-red-100 text-red-700 text-[11px] font-bold py-1.5 px-2.5 rounded-lg transition-all active:scale-95 border border-red-200 cursor-pointer"
                  title="लॉगआउट करा"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>बाहेर पडा</span>
                </button>
              </div>
            </div>
          )}

          {/* Offline Sync Status & Manual Sync Button */}
          <div className="flex items-center justify-between bg-white border border-[#E7E2DA] rounded-xl px-3 py-2 text-xs shadow-xs">
            <div className="flex items-center gap-2">
              {connStatus === "ONLINE" ? (
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 ring-4 ring-emerald-500/20" />
              ) : connStatus === "SYNCING" || syncing ? (
                <RefreshCw className="w-3.5 h-3.5 text-amber-500 animate-spin" />
              ) : (
                <div className="w-2.5 h-2.5 rounded-full bg-red-500 ring-4 ring-red-500/20" />
              )}
              <div>
                <span className="text-[11px] font-extrabold block text-stone-900 leading-tight">
                  {syncing ? "Syncing..." : connStatus}
                </span>
                <span className="text-[10px] text-stone-400 block leading-tight font-medium">
                  IndexedDB Outbox
                </span>
              </div>
            </div>

            <button
              onClick={triggerSync}
              disabled={syncing}
              title="Click to flush outbox mutations"
              className="text-[11px] font-bold text-stone-700 hover:text-stone-900 bg-stone-100 hover:bg-stone-200 border border-stone-200 px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1 active:scale-95"
            >
              <RefreshCw className={`w-3 h-3 ${syncing ? "animate-spin text-amber-600" : ""}`} />
              <span>Sync</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Switch Staff / Manager PIN Modal */}
      {showSwitchModal && (
        <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white max-w-sm w-full rounded-2xl p-5 text-left space-y-4 shadow-2xl border border-stone-200 animate-in fade-in">
            <div className="flex items-center justify-between border-b pb-2.5">
              <h3 className="font-black text-stone-900 text-sm flex items-center gap-1.5">
                <KeyRound className="w-4 h-4 text-red-600" />
                Staff Role Switch / Unlock
              </h3>
              <button
                onClick={() => setShowSwitchModal(false)}
                className="text-stone-400 hover:text-stone-700 text-xs p-1"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-stone-600">
              Enter <strong>Manager PIN</strong> (Default: <code>1234</code>) to switch back to Owner/Manager, or enter another <strong>Waiter PIN</strong>.
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                setSwitchError(null);
                const pin = switchPin.trim();

                // Check manager PIN
                if (pin === store.settings.billing.managerPin || pin === "1234" || pin === "admin123") {
                  store.setCurrentUserRole("OWNER");
                  setCurrentRole("OWNER");
                  setShowSwitchModal(false);
                  setTick((t) => t + 1);
                  return;
                }

                // Check other waiter PINs
                const waiterMatch = store.waiterCredentials.find((w) => w.pin === pin);
                if (waiterMatch) {
                  store.loginAsWaiter(waiterMatch);
                  setCurrentRole("WAITER");
                  setShowSwitchModal(false);
                  setTick((t) => t + 1);
                  return;
                }

                setSwitchError("Invalid PIN! Enter Manager PIN (admin123 / 1234) or valid Waiter PIN.");
              }}
              className="space-y-3"
            >
              <input
                type="password"
                maxLength={12}
                placeholder="Enter PIN (admin123 / 1234)"
                value={switchPin}
                onChange={(e) => {
                  setSwitchPin(e.target.value);
                  setSwitchError(null);
                }}
                className="w-full bg-stone-50 border border-stone-300 rounded-xl px-3 py-2 text-center text-base font-black tracking-widest focus:ring-2 focus:ring-red-500 focus:outline-none font-mono"
                autoFocus
              />

              {switchError && (
                <p className="text-[11px] text-red-600 font-bold text-center bg-red-50 p-1.5 rounded-lg border border-red-200">
                  {switchError}
                </p>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setShowSwitchModal(false)}
                  className="px-3.5 py-2 text-xs font-bold text-stone-600 hover:bg-stone-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-gradient-to-r from-red-600 to-red-800 text-white rounded-xl text-xs font-black shadow-xs active:scale-95 transition-all"
                >
                  Verify & Unlock
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
