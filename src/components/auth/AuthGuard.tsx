"use client";

import React, { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { ShieldAlert, ArrowLeft, AlertTriangle, Utensils, UtensilsCrossed, Lock, KeyRound, ChefHat, LogIn } from "lucide-react";
import { globalRestaurantStore } from "@/lib/store/restaurant-store";
import { hasPermission } from "@/lib/auth/rbac";
import { PermissionCode, RoleType } from "@/types/domain";

interface RouteRule {
  pathPrefix: string;
  requiredPermission: PermissionCode;
  moduleName: string;
  moduleNameMr: string;
  allowedRoles: RoleType[];
}

const ROUTE_RULES: RouteRule[] = [
  {
    pathPrefix: "/reports",
    requiredPermission: "reports.financial",
    moduleName: "Financial & Leakage Reports",
    moduleNameMr: "आर्थिक अहवाल व नफा-तोटा",
    allowedRoles: ["OWNER", "MANAGER"],
  },
  {
    pathPrefix: "/dashboard",
    requiredPermission: "reports.view",
    moduleName: "Executive Dashboard",
    moduleNameMr: "मालक नियंत्रण कक्ष",
    allowedRoles: ["OWNER", "MANAGER", "INVENTORY_MANAGER"],
  },
  {
    pathPrefix: "/billing",
    requiredPermission: "bill.create",
    moduleName: "Cashier & Billing Desk",
    moduleNameMr: "गल्ला व बिलिंग काउंटर",
    allowedRoles: ["OWNER", "MANAGER", "CASHIER"],
  },
  {
    pathPrefix: "/sell",
    requiredPermission: "bill.create",
    moduleName: "Sell & Sales Register",
    moduleNameMr: "विक्री नोंदवही",
    allowedRoles: ["OWNER", "MANAGER", "CASHIER"],
  },
  {
    pathPrefix: "/cash-upi",
    requiredPermission: "cash_upi.reconcile",
    moduleName: "Cash & UPI Reconciliation",
    moduleNameMr: "गल्ला व बँक ताळमेळ",
    allowedRoles: ["OWNER", "MANAGER", "CASHIER"],
  },
  {
    pathPrefix: "/office-orders",
    requiredPermission: "office_orders.manage",
    moduleName: "Baner IT Office Orders",
    moduleNameMr: "ऑफिस पार्सल व केटरिंग",
    allowedRoles: ["OWNER", "MANAGER", "CASHIER"],
  },
  {
    pathPrefix: "/kitchen",
    requiredPermission: "kot.status_update",
    moduleName: "Kitchen Display System (KDS)",
    moduleNameMr: "स्वयंपाकघर स्क्रीन (KDS)",
    allowedRoles: ["OWNER", "MANAGER", "KITCHEN"],
  },
  {
    pathPrefix: "/settings",
    requiredPermission: "settings.manage",
    moduleName: "Hotel POS & Hardware Settings",
    moduleNameMr: "प्रणाली व प्रिंटर सेटिंग्ज",
    allowedRoles: ["OWNER"],
  },
  {
    pathPrefix: "/printers",
    requiredPermission: "settings.manage",
    moduleName: "POS & Thermal Printers",
    moduleNameMr: "थर्मल प्रिंटर व्यवस्थापन",
    allowedRoles: ["OWNER"],
  },
  {
    pathPrefix: "/staff",
    requiredPermission: "staff.manage",
    moduleName: "Staff Roster & Payroll",
    moduleNameMr: "कर्मचारी हजेरी व पगार",
    allowedRoles: ["OWNER", "MANAGER"],
  },
  {
    pathPrefix: "/expenses",
    requiredPermission: "reports.financial",
    moduleName: "Operating Expenses & Ledger",
    moduleNameMr: "दैनिक हॉटेल खर्च",
    allowedRoles: ["OWNER", "MANAGER"],
  },
  {
    pathPrefix: "/daily-closing",
    requiredPermission: "bill.create",
    moduleName: "Daily Closing & Z-Report",
    moduleNameMr: "दिवस सांगता व झेड-रिपोर्ट",
    allowedRoles: ["OWNER", "MANAGER", "CASHIER"],
  },
  {
    pathPrefix: "/purchases",
    requiredPermission: "inventory.purchase",
    moduleName: "Meat & Ingredient Purchases",
    moduleNameMr: "खरेदी नोंद",
    allowedRoles: ["OWNER", "MANAGER", "INVENTORY_MANAGER", "PURCHASE_STAFF"],
  },
  {
    pathPrefix: "/purchase-planner",
    requiredPermission: "inventory.purchase",
    moduleName: "Morning Purchase Planner",
    moduleNameMr: "खरेदी नियोजन",
    allowedRoles: ["OWNER", "MANAGER", "INVENTORY_MANAGER", "PURCHASE_STAFF"],
  },
  {
    pathPrefix: "/suppliers",
    requiredPermission: "inventory.purchase",
    moduleName: "Suppliers & Advances Ledger",
    moduleNameMr: "व्यापारी हिशोब",
    allowedRoles: ["OWNER", "MANAGER", "INVENTORY_MANAGER", "PURCHASE_STAFF"],
  },
  {
    pathPrefix: "/inventory",
    requiredPermission: "inventory.view",
    moduleName: "Inventory Stock Ledger",
    moduleNameMr: "साठा नोंदवही",
    allowedRoles: ["OWNER", "MANAGER", "INVENTORY_MANAGER", "PURCHASE_STAFF", "CASHIER"],
  },
  {
    pathPrefix: "/recipes",
    requiredPermission: "recipe.view",
    moduleName: "Recipe BOMs & Yields",
    moduleNameMr: "पाककृती व घटक प्रमाण",
    allowedRoles: ["OWNER", "MANAGER", "KITCHEN", "INVENTORY_MANAGER"],
  },
  {
    pathPrefix: "/wastage",
    requiredPermission: "inventory.adjust",
    moduleName: "Food Wastage Logger",
    moduleNameMr: "अन्न नासाडी नोंद",
    allowedRoles: ["OWNER", "MANAGER", "INVENTORY_MANAGER"],
  },
  {
    pathPrefix: "/daily-tasks",
    requiredPermission: "tasks.manage",
    moduleName: "Daily Operational Tasks & SOP",
    moduleNameMr: "दैनिक कामे व तपासणी",
    allowedRoles: ["OWNER", "MANAGER"],
  },
  {
    pathPrefix: "/tasks-maintenance",
    requiredPermission: "tasks.manage",
    moduleName: "Equipment & Maintenance Log",
    moduleNameMr: "कामे व देखभाल",
    allowedRoles: ["OWNER", "MANAGER"],
  },
  {
    pathPrefix: "/reminders",
    requiredPermission: "reminders.manage",
    moduleName: "Operational Reminders & Alerts",
    moduleNameMr: "स्मरणपत्रे व सूचना",
    allowedRoles: ["OWNER", "MANAGER"],
  },
  {
    pathPrefix: "/menu",
    requiredPermission: "menu.view",
    moduleName: "Menu & Price Catalog",
    moduleNameMr: "मेनू व दर सूची",
    allowedRoles: ["OWNER", "MANAGER", "CASHIER", "WAITER", "KITCHEN", "INVENTORY_MANAGER", "PURCHASE_STAFF", "OTHER_STAFF"],
  },
];

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const store = globalRestaurantStore;
  const [currentUser, setCurrentUser] = useState(store.currentUser);
  const [managerPinInput, setManagerPinInput] = useState("");
  const [unlockError, setUnlockError] = useState<string | null>(null);
  const [showUnlockModal, setShowUnlockModal] = useState(false);

  useEffect(() => {
    const checkAuth = () => {
      if (store.currentUser !== currentUser) {
        setCurrentUser(store.currentUser);
      }
    };
    const interval = setInterval(checkAuth, 500);
    return () => clearInterval(interval);
  }, [currentUser, store]);

  // Allow login page without restrictions
  if (pathname === "/login" || pathname === "/admin/login") {
    return <>{children}</>;
  }

  // 1. Unauthenticated / Guest Gate -> Redirect to /login
  const isAuthenticated = currentUser && currentUser.isActive && currentUser.id !== "guest";
  if (!isAuthenticated) {
    if (typeof window !== "undefined") {
      router.replace("/login");
    }
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center p-6 text-center space-y-4 animate-in fade-in">
        <div className="w-16 h-16 rounded-3xl bg-red-100 text-red-700 flex items-center justify-center shadow-lg border border-red-200 animate-pulse">
          <Lock className="w-8 h-8" />
        </div>
        <div>
          <h2 className="text-base sm:text-lg font-black text-stone-900">
            प्रवेशासाठी लॉगिन आवश्यक आहे
          </h2>
          <p className="text-xs text-stone-500 mt-1">
            Authentication Required • Redirecting to Login Portal...
          </p>
        </div>
        <Link
          href="/login"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-red-600 to-red-800 hover:from-red-700 hover:to-red-900 text-white font-black text-xs rounded-xl shadow-md transition-all active:scale-95"
        >
          <LogIn className="w-4 h-4" />
          <span>Go to Login Screen (लॉगिन पोर्टल) →</span>
        </Link>
      </div>
    );
  }

  const currentRole = currentUser.role;

  // 2. Strict Waiter Isolation: Waiters can ONLY see /waiter and /menu
  if (currentRole === "WAITER") {
    if (pathname === "/") {
      if (typeof window !== "undefined") {
        router.replace("/waiter");
      }
      return null;
    }

    const isWaiterAllowed =
      pathname === "/waiter" ||
      pathname.startsWith("/waiter/") ||
      pathname === "/menu" ||
      pathname.startsWith("/menu/");

    if (!isWaiterAllowed) {
      return (
        <div className="max-w-2xl mx-auto my-12 p-6 sm:p-10 rounded-3xl bg-white border border-amber-300 shadow-xl space-y-6 text-center animate-in fade-in">
          <div className="w-16 h-16 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center mx-auto shadow-inner border border-amber-200">
            <Lock className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <span className="inline-flex items-center gap-1.5 bg-amber-50 border border-amber-200 px-3 py-1 rounded-full text-xs font-black text-amber-900">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-700" />
              <span>वेटर प्रवेश मर्यादा • WAITER TERMINAL RESTRICTION</span>
            </span>

            <h2 className="text-xl sm:text-2xl font-black text-stone-900">
              Restricted Area: Tables & Menu Only
            </h2>
            <p className="text-sm font-bold text-amber-900">
              केवळ टेबल व मेनू पाहण्याची परवानगी आहे
            </p>

            <p className="text-xs sm:text-sm text-stone-600 max-w-md mx-auto mt-2 leading-relaxed">
              Logged in as <strong className="text-red-700 font-black">{currentUser.name}</strong>.
              Waiter accounts have strict operational scope and are only authorized to operate <strong>Dining Tables</strong> and <strong>Menu</strong>.
              All financial reports, ledger, purchases, and settings are locked.
            </p>
          </div>

          <div className="pt-4 border-t border-stone-200 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/waiter"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-red-800 text-white text-xs font-black shadow-md shadow-red-700/20 active:scale-95 transition-all"
            >
              <Utensils className="w-4 h-4" />
              <span>Go to Dining Tables (मजला) →</span>
            </Link>

            <Link
              href="/menu"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-xs font-bold shadow-xs active:scale-95 transition-all"
            >
              <UtensilsCrossed className="w-4 h-4" />
              <span>View Menu Catalog (मेनू)</span>
            </Link>

            <button
              type="button"
              onClick={() => setShowUnlockModal(true)}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl border border-stone-300 text-stone-700 text-xs font-bold hover:bg-stone-50 active:scale-95 transition-all cursor-pointer"
            >
              <KeyRound className="w-3.5 h-3.5 text-stone-500" />
              <span>Admin Unlock</span>
            </button>
          </div>

          {/* Manager Unlock Modal */}
          {showUnlockModal && renderUnlockModal()}
        </div>
      );
    }

    return <>{children}</>;
  }

  // 3. Strict Kitchen Isolation: Chefs can ONLY see /kitchen, /recipes, and /menu
  if (currentRole === "KITCHEN") {
    if (pathname === "/") {
      if (typeof window !== "undefined") {
        router.replace("/kitchen");
      }
      return null;
    }

    const isKitchenAllowed =
      pathname === "/kitchen" ||
      pathname.startsWith("/kitchen/") ||
      pathname === "/recipes" ||
      pathname.startsWith("/recipes/") ||
      pathname === "/menu" ||
      pathname.startsWith("/menu/");

    if (!isKitchenAllowed) {
      return (
        <div className="max-w-2xl mx-auto my-12 p-6 sm:p-10 rounded-3xl bg-white border border-red-200 shadow-xl space-y-6 text-center animate-in fade-in">
          <div className="w-16 h-16 rounded-2xl bg-red-100 text-red-800 flex items-center justify-center mx-auto shadow-inner border border-red-200">
            <ChefHat className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <span className="inline-flex items-center gap-1.5 bg-red-50 border border-red-200 px-3 py-1 rounded-full text-xs font-black text-red-900">
              <AlertTriangle className="w-3.5 h-3.5 text-red-700" />
              <span>किचन प्रवेश मर्यादा • KITCHEN TERMINAL RESTRICTION</span>
            </span>

            <h2 className="text-xl sm:text-2xl font-black text-stone-900">
              Kitchen Display & Recipes Only
            </h2>
            <p className="text-sm font-bold text-red-900">
              केवळ स्वयंपाकघर KDS व पाककृती पाहण्याची परवानगी आहे
            </p>

            <p className="text-xs sm:text-sm text-stone-600 max-w-md mx-auto mt-2 leading-relaxed">
              Logged in as <strong className="text-red-700 font-black">{currentUser.name}</strong>.
              Kitchen chef accounts are restricted to the <strong>Kitchen Display Screen (KDS)</strong>, <strong>Recipes & Yields</strong>, and <strong>Menu Catalog</strong>.
              Financial reports, billing desk, customer data, and administrative settings are locked.
            </p>
          </div>

          <div className="pt-4 border-t border-stone-200 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/kitchen"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-red-700 to-red-900 text-white text-xs font-black shadow-md shadow-red-700/20 active:scale-95 transition-all"
            >
              <ChefHat className="w-4 h-4" />
              <span>Go to Kitchen Display (KDS) →</span>
            </Link>

            <Link
              href="/recipes"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-xs font-bold shadow-xs active:scale-95 transition-all"
            >
              <span>View Recipes (पाककृती)</span>
            </Link>

            <button
              type="button"
              onClick={() => setShowUnlockModal(true)}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl border border-stone-300 text-stone-700 text-xs font-bold hover:bg-stone-50 active:scale-95 transition-all cursor-pointer"
            >
              <KeyRound className="w-3.5 h-3.5 text-stone-500" />
              <span>Admin Unlock</span>
            </button>
          </div>

          {/* Manager Unlock Modal */}
          {showUnlockModal && renderUnlockModal()}
        </div>
      );
    }

    return <>{children}</>;
  }

  // 4. Check Granular Route Permission Rules
  const matchedRule = ROUTE_RULES.find((rule) =>
    pathname === rule.pathPrefix || pathname.startsWith(`${rule.pathPrefix}/`)
  );

  if (!matchedRule) {
    return <>{children}</>;
  }

  const isAuthorized = hasPermission(currentRole, matchedRule.requiredPermission);

  if (!isAuthorized) {
    return (
      <div className="max-w-2xl mx-auto my-12 p-6 sm:p-10 rounded-3xl bg-white border border-red-200 shadow-xl space-y-6 text-center animate-in fade-in">
        <div className="w-16 h-16 rounded-2xl bg-red-100 text-red-700 flex items-center justify-center mx-auto shadow-inner">
          <ShieldAlert className="w-8 h-8" />
        </div>

        <div className="space-y-2">
          <span className="inline-flex items-center gap-1.5 bg-red-50 border border-red-200 px-3 py-1 rounded-full text-xs font-black text-red-800">
            <AlertTriangle className="w-3.5 h-3.5 text-red-800" />
            <span>प्रवेश मर्यादित • ACCESS DENIED (RBAC SECURE)</span>
          </span>

          <h2 className="text-xl sm:text-2xl font-black text-stone-900">
            Restricted Module: {matchedRule.moduleName}
          </h2>
          <p className="text-sm font-bold text-amber-900/80">
            {matchedRule.moduleNameMr}
          </p>

          <p className="text-xs sm:text-sm text-stone-600 max-w-md mx-auto mt-2 leading-relaxed">
            Your current active role is <strong className="text-red-700 font-black">{currentRole}</strong>.
            This area requires permission <code className="bg-stone-100 px-1.5 py-0.5 rounded text-stone-800 font-mono text-xs">{matchedRule.requiredPermission}</code>, authorized only for:
          </p>

          <div className="flex justify-center gap-2 flex-wrap pt-2">
            {matchedRule.allowedRoles.map((r) => (
              <span key={r} className="px-2.5 py-1 bg-stone-100 text-stone-800 rounded-lg text-xs font-extrabold border border-stone-200">
                {r}
              </span>
            ))}
          </div>
        </div>

        <div className="pt-4 border-t border-stone-200 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-xs font-bold shadow-xs active:scale-95 transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to Home</span>
          </Link>

          {currentRole === "CASHIER" && (
            <Link
              href="/billing"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-black shadow-xs active:scale-95 transition-all"
            >
              <span>Go to Billing Desk →</span>
            </Link>
          )}

          <button
            type="button"
            onClick={() => setShowUnlockModal(true)}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl border border-stone-300 text-stone-700 text-xs font-bold hover:bg-stone-50 active:scale-95 transition-all cursor-pointer"
          >
            <KeyRound className="w-3.5 h-3.5 text-stone-500" />
            <span>Admin PIN Unlock</span>
          </button>
        </div>

        {/* Manager Unlock Modal */}
        {showUnlockModal && renderUnlockModal()}
      </div>
    );
  }

  return <>{children}</>;

  function renderUnlockModal() {
    return (
      <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4">
        <div className="bg-white max-w-sm w-full rounded-2xl p-5 text-left space-y-4 shadow-2xl border border-stone-200 animate-in fade-in">
          <div className="flex items-center justify-between border-b pb-2">
            <h3 className="font-black text-stone-900 text-sm flex items-center gap-1.5">
              <KeyRound className="w-4 h-4 text-red-600" />
              Manager PIN Unlock
            </h3>
            <button
              onClick={() => setShowUnlockModal(false)}
              className="text-stone-400 hover:text-stone-700 text-xs p-1"
            >
              ✕
            </button>
          </div>
          <p className="text-xs text-stone-600">
            Enter Manager or Owner PIN (Default: <code>1234</code>) to switch session to Owner role.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const pin = managerPinInput.trim();
              if (pin === "admin123" || pin === store.settings.billing.managerPin || pin === "1234") {
                store.setCurrentUserRole("OWNER");
                setCurrentUser(store.currentUser);
                setShowUnlockModal(false);
              } else {
                setUnlockError("Incorrect PIN! (Default: admin123 or 1234)");
              }
            }}
            className="space-y-3"
          >
            <input
              type="password"
              maxLength={12}
              placeholder="Enter PIN (admin123 / 1234)"
              value={managerPinInput}
              onChange={(e) => {
                setManagerPinInput(e.target.value);
                setUnlockError(null);
              }}
              className="w-full bg-stone-50 border border-stone-300 rounded-xl px-3 py-2 text-center text-base font-black tracking-widest focus:ring-2 focus:ring-red-500 focus:outline-none font-mono"
              autoFocus
            />
            {unlockError && (
              <p className="text-[11px] text-red-600 font-bold text-center bg-red-50 p-1.5 rounded-lg border border-red-200">
                {unlockError}
              </p>
            )}
            <div className="flex justify-end gap-2 pt-2 border-t border-stone-100">
              <button
                type="button"
                onClick={() => setShowUnlockModal(false)}
                className="px-3.5 py-1.5 text-xs text-stone-600 hover:bg-stone-100 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-black shadow-xs active:scale-95 transition-all"
              >
                Unlock Owner
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }
}
