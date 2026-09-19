import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Menu,
  Utensils,
  ChefHat,
  Receipt,
  LayoutDashboard,
  Boxes,
  BookOpen,
  BarChart3,
  CheckSquare,
  Sparkles,
  Plus,
  UtensilsCrossed,
  ShoppingCart,
  Building2,
  Wallet,
  Coins,
  Lock,
  ClipboardList,
  Trash2,
  Users,
  Wrench,
  Sliders,
  Bell,
  LogOut,
  KeyRound,
  User,
  Printer,
  Cloud,
} from "lucide-react";
import { globalRestaurantStore } from "@/lib/store/restaurant-store";
import { NotificationCenterDrawer } from "@/components/notifications/NotificationCenterDrawer";
import { PrinterSettingsModal } from "@/components/printing/PrinterSettingsModal";
import { subscribeToBridgeStatus, isBridgeOnline } from "@/lib/printing/cloud-print-queue";

interface TopHeaderProps {
  onOpenMobileSidebar: () => void;
}

export function TopHeader({ onOpenMobileSidebar }: TopHeaderProps) {
  const pathname = usePathname();
  const store = globalRestaurantStore;
  const [, setTick] = React.useState(0);
  const [isNotificationDrawerOpen, setIsNotificationDrawerOpen] = React.useState(false);
  const [isOnline, setIsOnline] = React.useState(true);
  const [isPrinterModalOpen, setIsPrinterModalOpen] = React.useState(false);
  const [isBridgeOnlineState, setIsBridgeOnlineState] = React.useState(false);

  React.useEffect(() => {
    if (typeof window !== "undefined") {
      setIsOnline(navigator.onLine);
      const handleOnline = () => setIsOnline(true);
      const handleOffline = () => setIsOnline(false);
      const handleSync = () => {
        store.evaluateLiveOperationalAlerts();
        setTick((t) => t + 1);
      };

      window.addEventListener("online", handleOnline);
      window.addEventListener("offline", handleOffline);
      window.addEventListener("kk-state-changed", handleSync);

      return () => {
        window.removeEventListener("online", handleOnline);
        window.removeEventListener("offline", handleOffline);
        window.removeEventListener("kk-state-changed", handleSync);
      };
    }
  }, []);

  // Bridge status listener
  React.useEffect(() => {
    const unsub = subscribeToBridgeStatus((bridges) => {
      setIsBridgeOnlineState(isBridgeOnline(bridges));
    });
    return () => unsub();
  }, []);

  React.useEffect(() => {
    // Immediate first check
    store.evaluateLiveOperationalAlerts();

    const interval = setInterval(() => {
      store.evaluateLiveOperationalAlerts();
      setTick((t) => t + 1);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  const occupiedTables = store.tables.filter((t) => t.status === "OCCUPIED" || t.status === "SHARED").length;
  const pendingKots = store.kots.filter((k) => k.status === "NEW" || k.status === "PREPARING").length;
  const unreadNotifCount = store.notifications.filter((n) => !n.isRead).length;
  const pendingRemindersCount = store.reminders.filter((r) => !r.isCompleted && !r.isDismissed).length;
  const totalAlertCount = unreadNotifCount + (pendingRemindersCount > 0 ? 1 : 0);

  const getPageMeta = () => {
    if (pathname.startsWith("/waiter/order")) {
      return { title: "Order Entry & KOT", shortTitle: "Order KOT", marathi: "ऑर्डर व केओटी", subtitle: "Seat tagging, modifiers & 1-tap kitchen send", icon: Utensils };
    }
    if (pathname.startsWith("/waiter")) {
      return { title: "Floor & 12 Dining Tables", shortTitle: "Dining Tables", marathi: "मजला व टेबल", subtitle: "12 tables, shared parties & live occupancy", icon: Utensils };
    }
    if (pathname.startsWith("/kitchen")) {
      return { title: "Kitchen Display System", shortTitle: "Kitchen KDS", marathi: "स्वयंपाकघर KDS", subtitle: "Station routing (Thali, Bhakri, Sukka, Solkadhi)", icon: ChefHat };
    }
    if (pathname.startsWith("/billing")) {
      return { title: "Cashier Billing Desk", shortTitle: "Billing Desk", marathi: "रोकड व बिलिंग", subtitle: "Itemized GST, multi-tender split & thermal POS", icon: Receipt };
    }
    if (pathname.startsWith("/purchases")) {
      return { title: "Fast Purchases Entry", shortTitle: "Purchases", marathi: "खरेदी नोंद", subtitle: "Daily chicken, mutton, spices & 1-tap re-order", icon: ShoppingCart };
    }
    if (pathname.startsWith("/suppliers")) {
      return { title: "Suppliers & Advances", shortTitle: "Suppliers", marathi: "व्यापारी व ॲडव्हान्स", subtitle: "Directory, advance tracking & net invoice settlement", icon: Building2 };
    }
    if (pathname.startsWith("/expenses")) {
      return { title: "Categorized Expenses", shortTitle: "Expenses", marathi: "दैनिक खर्च", subtitle: "Gas, electricity, repairs, kirana & review alerts", icon: Wallet };
    }
    if (pathname.startsWith("/cash-upi")) {
      return { title: "Cash Drawer & UPI Reconcile", shortTitle: "Cash & UPI", marathi: "गल्ला व युपीआय", subtitle: "Soundbox reconciliation & variance tracking", icon: Coins };
    }
    if (pathname.startsWith("/daily-closing")) {
      return { title: "Daily Closing & Z-Report", shortTitle: "Daily Closing", marathi: "दिवस सांगता हिशोब", subtitle: "10-point audit, drawer balance & thermal Z-report", icon: Lock };
    }
    if (pathname.startsWith("/purchase-planner")) {
      return { title: "Morning Purchase Planner", shortTitle: "Planner", marathi: "सकाळचे नियोजन", subtitle: "Par levels & recommended daily quantities", icon: ClipboardList };
    }
    if (pathname.startsWith("/wastage")) {
      return { title: "Food Loss & Scrap Logger", shortTitle: "Wastage", marathi: "अन्न नासाडी नोंद", subtitle: "Spoilage tracking & live inventory deduction", icon: Trash2 };
    }
    if (pathname.startsWith("/staff")) {
      return { title: "Staff Roster & Salary", shortTitle: "Staff Roster", marathi: "कर्मचारी हजेरी व पगार", subtitle: "1-click attendance, advances & salary slips", icon: Users };
    }
    if (pathname.startsWith("/tasks-maintenance")) {
      return { title: "Tasks & Maintenance", shortTitle: "Tasks", marathi: "कामे व देखभाल", subtitle: "Deep freezer log, gas valves & equipment", icon: Wrench };
    }
    if (pathname.startsWith("/office-orders")) {
      return { title: "Baner IT Office Orders", shortTitle: "Office Orders", marathi: "ऑफिस ऑर्डर्स", subtitle: "Bulk thali catering & group order schedule", icon: Building2 };
    }
    if (pathname.startsWith("/dashboard")) {
      return { title: "Executive Operations", shortTitle: "Dashboard", marathi: "कार्यकारी डॅशबोर्ड", subtitle: "Live revenue, guest count & critical stock metrics", icon: LayoutDashboard };
    }
    if (pathname.startsWith("/settings")) {
      return { title: "System Settings & POS Config", shortTitle: "Settings", marathi: "प्रणाली सेटिंग्ज", subtitle: "Restaurant profile, thermal POS, GST policies & backups", icon: Sliders };
    }
    if (pathname.startsWith("/inventory")) {
      return { title: "Inventory Stock Ledger", shortTitle: "Inventory", marathi: "साठा नोंदवही", subtitle: "Double-entry transactions & physical count audit", icon: Boxes };
    }
    if (pathname.startsWith("/recipes")) {
      return { title: "Recipe Engine & Yields", shortTitle: "Recipes", marathi: "पाककृती व घटक", subtitle: "Bill of materials, portions & margin analysis", icon: BookOpen };
    }
    if (pathname.startsWith("/menu")) {
      return { title: "Menu & Pricing Catalog", shortTitle: "Menu Catalog", marathi: "मेनू व दर", subtitle: "Dish prices, out-of-stock toggles & thalis", icon: UtensilsCrossed };
    }
    if (pathname.startsWith("/reports")) {
      return { title: "Stock Variance Reports", shortTitle: "Reports", marathi: "तफावत अहवाल", subtitle: "Theoretical vs Actual formula & financial leakage", icon: BarChart3 };
    }
    if (pathname.startsWith("/checklists")) {
      return { title: "Operational Checklists", shortTitle: "Checklists", marathi: "सुरक्षा तपासणी", subtitle: "Opening safety, gas lines & night audit", icon: CheckSquare };
    }
    return { title: "कोल्हापुरी खानावळ", shortTitle: "खानावळ POS", marathi: "बाणेर, पुणे", subtitle: "Authentic Maharashtrian Khanawal Operating System", icon: Sparkles };
  };

  const pageMeta = getPageMeta();
  const Icon = pageMeta.icon;

  return (
    <header className="premium-header sticky top-0 z-30 backdrop-blur-xl border-b border-[#E7E2DA] px-3 sm:px-6 lg:px-8 py-2 sm:py-3 flex items-center justify-between">
      {/* Left: Mobile Menu Drawer Toggle & Title */}
      <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0">
        <button
          onClick={onOpenMobileSidebar}
          className="lg:hidden w-10 h-10 min-w-[40px] min-h-[40px] flex items-center justify-center text-stone-700 hover:text-stone-950 hover:bg-[#F5F2EC] rounded-xl transition-colors border border-[#E7E2DA] shrink-0 touch-manipulation active:scale-95 cursor-pointer"
          aria-label="Open sidebar navigation"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-br from-red-50 to-amber-50 text-red-700 flex items-center justify-center border border-red-200/70 shadow-2xs shrink-0">
            <Icon className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h1 className="text-sm sm:text-base lg:text-lg font-black text-stone-900 leading-tight tracking-tight truncate">
                <span className="sm:hidden">{(pageMeta as any).shortTitle || pageMeta.title}</span>
                <span className="hidden sm:inline">{pageMeta.title}</span>
              </h1>
              {pageMeta.marathi && (
                <span className="hidden md:inline-block text-[10px] font-bold text-amber-900/80 bg-amber-50/80 px-2 py-0.5 rounded-full border border-amber-200/60">
                  {pageMeta.marathi}
                </span>
              )}
            </div>
            <p className="hidden sm:block text-[11px] text-stone-500 font-medium leading-tight mt-0.5 truncate">
              {pageMeta.subtitle}
            </p>
          </div>
        </div>
      </div>

      {/* Right: Quick Operational Indicators & Seat Party Action */}
      <div className="flex items-center gap-1.5 sm:gap-2.5 lg:gap-3 shrink-0">
        {/* Occupancy Indicator - Large Screens */}
        <div className="hidden xl:flex items-center gap-2 bg-[#FAF8F5] border border-[#E7E2DA] px-3 py-1.5 rounded-xl text-xs shadow-2xs">
          <div className="w-2 h-2 rounded-full bg-emerald-500 ring-3 ring-emerald-100 animate-pulse" />
          <span className="font-bold text-stone-800">
            {occupiedTables}/{store.tables.length} Tables
          </span>
        </div>

        {/* Waiter Mode Active Badge - Large Screens */}
        {store.currentUser.role === "WAITER" ? (
          <div className="hidden xl:flex items-center gap-1.5 bg-red-50 border border-red-200/80 px-3 py-1.5 rounded-xl text-xs font-bold text-red-900 shadow-2xs">
            <span className="w-2 h-2 rounded-full bg-red-600 animate-ping" />
            <span>{store.currentUser.name}</span>
          </div>
        ) : (
          /* Pending KOTs Pill (Kitchen only for non-waiters) */
          pendingKots > 0 && (
            <Link
              href="/kitchen"
              className="hidden xl:flex items-center gap-1.5 bg-red-50 hover:bg-red-100/80 border border-red-200/80 text-red-800 px-2.5 sm:px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shadow-2xs animate-urgent touch-manipulation"
            >
              <ChefHat className="w-3.5 h-3.5 text-red-700" />
              <span>{pendingKots} KOTs</span>
            </Link>
          )
        )}

        {/* Real-time Local Sync Pill - Tablet and Desktop only */}
        <div
          className={`hidden sm:flex items-center gap-1 sm:gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-black border transition-all ${
            isOnline
              ? "bg-emerald-50 text-emerald-800 border-emerald-200"
              : "bg-amber-50 text-amber-900 border-amber-300 animate-pulse"
          }`}
          title={isOnline ? "Local Wi-Fi Mesh & Sync Active" : "Operating in Offline Mode"}
        >
          <span
            className={`w-2 h-2 rounded-full ${
              isOnline ? "bg-emerald-500 ring-2 ring-emerald-200" : "bg-amber-500 ring-2 ring-amber-200"
            }`}
          />
          <span className="hidden lg:inline">{isOnline ? "Wi-Fi Sync" : "Offline"}</span>
        </div>

        {/* Quick Printer Status & Settings Toggle - Mobile compact icon, Tablet+ with text */}
        <button
          type="button"
          onClick={() => setIsPrinterModalOpen(true)}
          className={`flex items-center justify-center p-2 sm:px-2.5 sm:py-1.5 min-w-[40px] min-h-[40px] rounded-xl text-[10px] sm:text-xs font-black border transition-all touch-manipulation active:scale-95 cursor-pointer shrink-0 ${
            isBridgeOnlineState
              ? "bg-emerald-50 text-emerald-900 border-emerald-300 hover:bg-emerald-100 shadow-2xs"
              : "bg-[#FAF8F5] text-stone-700 border-[#E7E2DA] hover:bg-stone-100"
          }`}
          title={
            isBridgeOnlineState
              ? "🖨️ प्रिंटर ब्रिज चालू (Online) — सेटिंग्ज उघडा"
              : "🖨️ प्रिंटर सेटिंग्ज — सेटिंग्ज उघडा"
          }
          aria-label="Open printer settings"
        >
          <div className="relative flex items-center justify-center">
            <Printer className="w-4 h-4 text-stone-700" />
            <span
              className={`absolute -top-1 -right-1 w-2 h-2 rounded-full ring-2 ring-white ${
                isBridgeOnlineState
                  ? "bg-emerald-500 animate-pulse"
                  : "bg-stone-400"
              }`}
            />
          </div>
          <span className="hidden sm:inline-block ml-1.5 font-bold">प्रिंटर</span>
        </button>

        {/* Real-time Notification & Reminder Bell */}
        <button
          onClick={() => setIsNotificationDrawerOpen(true)}
          className={`relative p-2 min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl transition-all border touch-manipulation active:scale-95 cursor-pointer shrink-0 ${
            totalAlertCount > 0
              ? "bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100 shadow-2xs"
              : "bg-[#FAF8F5] text-stone-600 border-[#E7E2DA] hover:bg-stone-100"
          }`}
          title="Notifications & Reminders (सूचना व स्मरण)"
          aria-label="Open notifications"
        >
          <Bell className="w-4 h-4 text-stone-800" />
          {totalAlertCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-600 text-white font-black text-[9px] min-w-4 h-4 px-1 rounded-full flex items-center justify-center shadow-xs animate-pulse">
              {totalAlertCount > 9 ? "9+" : totalAlertCount}
            </span>
          )}
        </button>

        {/* Staff Profile & Logout / Login Button */}
        {store.currentUser && store.currentUser.isActive && store.currentUser.id !== "guest" ? (
          <div className="hidden xl:flex items-center bg-[#FAF8F5] border border-[#E7E2DA] rounded-xl p-1 shadow-2xs">
            <Link
              href="/login"
              className="flex items-center gap-1.5 px-1.5 py-0.5 rounded-lg hover:bg-stone-100 transition-colors"
              title="Switch user account (खाते बदला)"
            >
              <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-red-600 to-amber-600 text-white flex items-center justify-center text-[11px] font-black shrink-0 shadow-2xs">
                {store.currentUser.role === "OWNER" ? "👑" : store.currentUser.role === "WAITER" ? "🍽️" : store.currentUser.role === "KITCHEN" ? "👨‍🍳" : store.currentUser.role === "CASHIER" ? "🧾" : "👤"}
              </div>
              <div className="hidden lg:block text-left">
                <span className="text-[11px] font-extrabold text-stone-900 block leading-tight max-w-[90px] truncate">
                  {store.currentUser.name}
                </span>
                <span className="text-[9px] text-amber-900/80 font-bold block leading-tight">
                  {store.currentUser.role}
                </span>
              </div>
            </Link>
            <button
              type="button"
              onClick={() => {
                store.logout();
                if (typeof window !== "undefined") {
                  window.location.href = "/login";
                }
              }}
              className="p-1.5 text-stone-400 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
              title="बाहेर पडा (Logout)"
              aria-label="Logout"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <Link
            href="/login"
            className="hidden sm:flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-xs shrink-0"
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>लॉगिन</span>
          </Link>
        )}

        {/* Quick Seating Action - Tablet & Desktop only (Hidden on narrow mobile phones) */}
        <Link
          href="/waiter"
          className="hidden sm:inline-flex items-center gap-1.5 bg-gradient-to-r from-red-600 via-red-700 to-red-800 hover:from-red-700 hover:to-red-900 text-white font-black text-xs px-3 sm:px-4 py-2 rounded-xl shadow-sm shadow-red-700/20 border border-red-600 active:scale-95 transition-all touch-manipulation shrink-0"
        >
          <Plus className="w-3.5 h-3.5 text-amber-200" />
          <span>Seat Party</span>
        </Link>
      </div>

      {/* Global Slide-Over Notification & Reminder Center */}
      <NotificationCenterDrawer
        isOpen={isNotificationDrawerOpen}
        onClose={() => setIsNotificationDrawerOpen(false)}
      />

      {/* Quick Access Printer Settings Modal */}
      <PrinterSettingsModal
        isOpen={isPrinterModalOpen}
        onClose={() => setIsPrinterModalOpen(false)}
      />
    </header>
  );
}
