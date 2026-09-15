"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Utensils,
  ChefHat,
  Receipt,
  LayoutDashboard,
  Boxes,
  ShoppingCart,
  Coins,
  QrCode,
  Building2,
  Users,
  Wrench,
  Trash2,
  ClipboardList,
  Lock,
  AlertTriangle,
  ArrowRight,
  TrendingUp,
  Sparkles,
  CheckCircle2,
  CheckSquare,
  Scale,
  ShieldAlert,
  Printer,
  Plus,
  Flame,
  Clock,
  Sliders,
  Wallet,
} from "lucide-react";
import { globalRestaurantStore } from "@/lib/store/restaurant-store";
import { openPrintWindow, generateDayEndReportHtml } from "@/lib/printing/thermal-printer";

export default function HomePage() {
  const store = globalRestaurantStore;
  const [, setTick] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setTick((t) => t + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const summary = store.getOwnerSummary();
  const occupiedTables = store.tables.filter((t) => t.status === "OCCUPIED" || t.status === "SHARED");
  const pendingKots = store.kots.filter((k) => k.status === "NEW" || k.status === "PREPARING");
  const criticalReminders = store.reminders.filter((r) => !r.isDismissed && r.urgency === "CRITICAL");

  const today = new Date().toISOString().split("T")[0];

  const handlePrintDailyReport = () => {
    const report = store.generateDayEndReport(today);
    const html = generateDayEndReportHtml(report);
    openPrintWindow(html, `Owner-Report-${today}`);
  };

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Luxury Royal Hero Banner with Quick Operational Actions */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-white via-[#FAF7F2] to-[#F5EFE6] p-5 sm:p-8 lg:p-10 border border-[#E7E2DA] shadow-[0_4px_25px_-4px_rgba(28,25,23,0.06)]">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-3 max-w-2xl">
            <div className="inline-flex items-center gap-2 bg-gradient-to-r from-red-50 to-amber-50 border border-red-200/80 px-3.5 py-1 rounded-full text-xs font-black text-red-900 shadow-2xs">
              <Sparkles className="w-3.5 h-3.5 text-amber-600" />
              <span>खानावळ मालक दृश्य • Owner Quick Operations View</span>
            </div>

            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight text-stone-900 leading-tight">
              कोल्हापुरी खानावळ, बाणेर
              <span className="block text-sm sm:text-lg font-bold text-amber-900/80 mt-1">
                Baner Authentic Maharashtrian Khanawal Operations Engine
              </span>
            </h1>

            <p className="text-stone-600 text-xs sm:text-sm leading-relaxed font-medium">
              Designed for local daily operations: Chicken/Mutton thalis, wood-fired bhakri, rassa stock control, shared tables, cash drawer tracking, and thermal POS printing.
            </p>
          </div>

          {/* Quick Action Buttons on Desktop / Top Row */}
          <div className="flex flex-wrap sm:flex-nowrap items-center gap-2.5 shrink-0">
            <Link
              href="/settings"
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 rounded-xl border border-stone-300 bg-white px-3.5 py-2.5 text-xs font-bold text-stone-800 shadow-2xs hover:bg-stone-50 active:scale-95 transition-all touch-manipulation"
              title="Configure restaurant profile, thermal POS hardware & backups"
            >
              <Sliders className="w-4 h-4 text-stone-600" />
              <span>Settings</span>
            </Link>

            <button
              type="button"
              onClick={handlePrintDailyReport}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-xs font-bold text-stone-800 shadow-2xs hover:bg-stone-50 active:scale-95 transition-all touch-manipulation"
              title="Quick print current shift summary to thermal receipt"
            >
              <Printer className="w-4 h-4 text-stone-600" />
              <span>Print Z-Report</span>
            </button>

            <Link
              href="/waiter"
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-red-600 via-red-700 to-red-800 hover:from-red-700 hover:to-red-900 text-white px-5 py-2.5 text-xs font-black shadow-md shadow-red-700/20 active:scale-95 transition-all touch-manipulation"
            >
              <Plus className="w-4 h-4 text-amber-200" />
              <span>Seat Party</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Critical Reminders & Unclassified Alerts */}
      <div className="space-y-3">
        {summary.unreviewedExpensesCount > 0 && (
          <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-in fade-in">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0" />
              <div>
                <h4 className="text-xs sm:text-sm font-black text-amber-950">
                  {summary.unreviewedExpensesCount} Unclassified Expense Transaction Pending Review
                </h4>
                <p className="text-[11px] sm:text-xs text-amber-900/80 font-medium">
                  Verify receipts before daily cash closing to keep financial records leak-free.
                </p>
              </div>
            </div>
            <Link
              href="/expenses"
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-black text-xs rounded-xl shadow-xs shrink-0 touch-manipulation"
            >
              Review Now →
            </Link>
          </div>
        )}

        {criticalReminders.map((rem) => (
          <div
            key={rem.id}
            className="p-4 bg-red-500/10 border border-red-500/30 rounded-2xl flex items-center justify-between gap-3 animate-in fade-in"
          >
            <div className="flex items-center gap-3">
              <ShieldAlert className="w-5 h-5 text-red-700 shrink-0" />
              <div>
                <h4 className="text-xs sm:text-sm font-black text-red-950">
                  {rem.title}: <span className="font-medium text-red-900">{rem.message}</span>
                </h4>
              </div>
            </div>
            <Link
              href="/tasks-maintenance"
              className="px-3.5 py-1.5 bg-red-700 hover:bg-red-800 text-white font-bold text-xs rounded-xl shadow-xs shrink-0 touch-manipulation"
            >
              View Log
            </Link>
          </div>
        ))}
      </div>

      {/* THE 5 CORE OWNER QUESTIONS (ANSWERED IN 3 SECONDS) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs sm:text-sm font-black text-stone-900 uppercase tracking-wider flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-red-700" />
            <span>५ मुख्य प्रश्न (5 Core Operational Questions)</span>
          </h2>
          <span className="text-[11px] font-bold text-stone-400">Live Real-time Metrics</span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
          {/* Question 1: Today's Sales (spans 2 columns on mobile) */}
          <div className="col-span-2 md:col-span-1 premium-card p-4 sm:p-5 flex flex-col justify-between space-y-3 border-l-4 border-l-red-600">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-extrabold text-stone-500 uppercase tracking-wide">
                1. आजची विक्री
              </span>
              <span className="text-[10px] font-bold bg-red-50 text-red-800 px-2 py-0.5 rounded-full border border-red-200/60">
                Sales
              </span>
            </div>

            <div>
              <div className="text-2xl sm:text-3xl font-black text-stone-900 font-mono tracking-tight">
                ₹{summary.todaysSales.toLocaleString("en-IN")}
              </div>
              <div className="text-[11px] font-bold text-stone-500 mt-2 flex items-center justify-between border-t border-stone-100 pt-1.5">
                <span className="text-emerald-700 font-bold">Cash: ₹{summary.cashSales}</span>
                <span className="text-blue-700 font-bold">UPI: ₹{summary.upiSales}</span>
              </div>
            </div>
          </div>

          {/* Question 2: Cash in Drawer */}
          <div className="premium-card p-4 sm:p-5 flex flex-col justify-between space-y-3 border-l-4 border-l-emerald-600 bg-emerald-50/20">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-extrabold text-emerald-800 uppercase tracking-wide">
                2. गल्ल्यात रोख
              </span>
              <div className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                <Coins className="w-3.5 h-3.5" />
              </div>
            </div>

            <div>
              <div className="text-2xl sm:text-3xl font-black text-emerald-950 font-mono tracking-tight">
                ₹{summary.cashInDrawer.toLocaleString("en-IN")}
              </div>
              <p className="text-[10px] text-emerald-800 font-medium mt-1">
                Float + Cash sales in box
              </p>
            </div>
          </div>

          {/* Question 3: UPI in Bank */}
          <div className="premium-card p-4 sm:p-5 flex flex-col justify-between space-y-3 border-l-4 border-l-blue-600 bg-blue-50/20">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-extrabold text-blue-800 uppercase tracking-wide">
                3. बँक जमा
              </span>
              <div className="w-6 h-6 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
                <QrCode className="w-3.5 h-3.5" />
              </div>
            </div>

            <div>
              <div className="text-2xl sm:text-3xl font-black text-blue-950 font-mono tracking-tight">
                ₹{summary.upiInBank.toLocaleString("en-IN")}
              </div>
              <p className="text-[10px] text-blue-800 font-medium mt-1">
                Soundbox settled total
              </p>
            </div>
          </div>

          {/* Question 4: Meat Stock */}
          <div className="premium-card p-4 sm:p-5 flex flex-col justify-between space-y-3 border-l-4 border-l-amber-600">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-extrabold text-stone-500 uppercase tracking-wide">
                4. मटण/चिकन साठा
              </span>
              <span className="text-[10px] font-bold bg-amber-50 text-amber-800 px-2 py-0.5 rounded-full border border-amber-200/60">
                Meat
              </span>
            </div>

            <div>
              <div className="space-y-1">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-stone-600">कोंबडी (Chicken):</span>
                  <span className={`font-mono font-black ${summary.chickenStockKg <= 5 ? "text-red-600" : "text-stone-900"}`}>
                    {summary.chickenStockKg} kg
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-stone-600">बोकड (Mutton):</span>
                  <span className={`font-mono font-black ${summary.muttonStockKg <= 6 ? "text-amber-600" : "text-stone-900"}`}>
                    {summary.muttonStockKg} kg
                  </span>
                </div>
              </div>
              <p className="text-[10px] text-stone-400 font-medium mt-1">
                {summary.chickenStockKg <= 5 ? "⚠️ Reorder recommended" : "Stock healthy"}
              </p>
            </div>
          </div>

          {/* Question 5: Thalis Sold */}
          <div className="col-span-2 md:col-span-1 premium-card p-4 sm:p-5 flex flex-col justify-between space-y-3 border-l-4 border-l-purple-600">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-extrabold text-stone-500 uppercase tracking-wide">
                5. एकूण थाळ्या
              </span>
              <span className="text-[10px] font-bold bg-purple-50 text-purple-800 px-2 py-0.5 rounded-full border border-purple-200/60">
                Thalis
              </span>
            </div>

            <div>
              <div className="text-2xl sm:text-3xl font-black text-stone-900 font-mono tracking-tight">
                {summary.thalisSold} <span className="text-xs font-bold text-stone-400">Sold</span>
              </div>
              <div className="text-[11px] font-bold text-stone-600 mt-2 flex items-center justify-between border-t border-stone-100 pt-1.5">
                <span>🍗 {summary.chickenThalisSold} Chicken</span>
                <span>🐐 {summary.muttonThalisSold} Mutton</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 6 CORE OPERATIONAL TOUCHPOINTS (FRONT AND CENTER) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs sm:text-sm font-black text-stone-900 uppercase tracking-wider flex items-center gap-2">
            <Flame className="w-4 h-4 text-red-700" />
            <span>🔥 मुख्य कामकाज (6 Core Operations)</span>
          </h2>
          <span className="text-[11px] font-bold text-red-700 bg-red-50 px-2 py-0.5 rounded-full border border-red-200">
            दैनिक प्राधान्य (Priority)
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-3.5">
          {/* 1. Daily Tasks */}
          <Link
            href="/daily-tasks"
            className="group p-4 rounded-2xl bg-white hover:bg-red-50/40 border-2 border-red-200/80 hover:border-red-500 shadow-sm transition-all space-y-2.5 touch-manipulation active:scale-95"
          >
            <div className="w-10 h-10 rounded-xl bg-red-600 text-white flex items-center justify-center group-hover:scale-105 transition-transform shadow-sm shadow-red-600/20">
              <CheckSquare className="w-5 h-5" />
            </div>
            <div>
              <div className="font-black text-stone-900 text-xs sm:text-sm leading-tight">Daily Tasks</div>
              <div className="text-[10px] text-red-900 font-bold mt-0.5">दैनिक कामे</div>
              <div className="text-[10px] text-stone-500 font-medium mt-1">
                Opening & closing SOPs
              </div>
            </div>
          </Link>

          {/* 2. Table Orders */}
          <Link
            href="/waiter"
            className="group p-4 rounded-2xl bg-white hover:bg-amber-50/40 border-2 border-amber-200/80 hover:border-amber-500 shadow-sm transition-all space-y-2.5 touch-manipulation active:scale-95"
          >
            <div className="w-10 h-10 rounded-xl bg-amber-600 text-white flex items-center justify-center group-hover:scale-105 transition-transform shadow-sm shadow-amber-600/20">
              <Utensils className="w-5 h-5" />
            </div>
            <div>
              <div className="font-black text-stone-900 text-xs sm:text-sm leading-tight">Table Orders</div>
              <div className="text-[10px] text-amber-900 font-bold mt-0.5">टेबल व ऑर्डर्स</div>
              <div className="text-[10px] text-stone-500 font-medium mt-1">
                {occupiedTables.length}/12 Occupied
              </div>
            </div>
          </Link>

          {/* 3. KOT Kitchen Display */}
          <Link
            href="/kitchen"
            className="group p-4 rounded-2xl bg-white hover:bg-red-50/40 border-2 border-red-200/80 hover:border-red-500 shadow-sm transition-all space-y-2.5 touch-manipulation active:scale-95"
          >
            <div className="w-10 h-10 rounded-xl bg-red-700 text-white flex items-center justify-center group-hover:scale-105 transition-transform shadow-sm shadow-red-700/20">
              <ChefHat className="w-5 h-5" />
            </div>
            <div>
              <div className="font-black text-stone-900 text-xs sm:text-sm leading-tight">KOT (Kitchen)</div>
              <div className="text-[10px] text-red-900 font-bold mt-0.5">किचन डिस्प्ले</div>
              <div className="text-[10px] text-stone-500 font-medium mt-1">
                {pendingKots.length > 0 ? `${pendingKots.length} Active` : "Kitchen Ready"}
              </div>
            </div>
          </Link>

          {/* 4. Billing Desk */}
          <Link
            href="/billing"
            className="group p-4 rounded-2xl bg-white hover:bg-emerald-50/40 border-2 border-emerald-200/80 hover:border-emerald-500 shadow-sm transition-all space-y-2.5 touch-manipulation active:scale-95"
          >
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center group-hover:scale-105 transition-transform shadow-sm shadow-emerald-600/20">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <div className="font-black text-stone-900 text-xs sm:text-sm leading-tight">Billing Desk</div>
              <div className="text-[10px] text-emerald-900 font-bold mt-0.5">रोकड व बिलिंग</div>
              <div className="text-[10px] text-stone-500 font-medium mt-1">
                Thermal POS, UPI QR
              </div>
            </div>
          </Link>

          {/* 5. Sell & Sales */}
          <Link
            href="/sell"
            className="group p-4 rounded-2xl bg-white hover:bg-blue-50/40 border-2 border-blue-200/80 hover:border-blue-500 shadow-sm transition-all space-y-2.5 touch-manipulation active:scale-95"
          >
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center group-hover:scale-105 transition-transform shadow-sm shadow-blue-600/20">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <div className="font-black text-stone-900 text-xs sm:text-sm leading-tight">Sell & Sales</div>
              <div className="text-[10px] text-blue-900 font-bold mt-0.5">विक्री व हिशोब</div>
              <div className="text-[10px] text-stone-500 font-medium mt-1">
                Live feed & reprints
              </div>
            </div>
          </Link>

          {/* 6. Hotel Expenses */}
          <Link
            href="/expenses"
            className="group p-4 rounded-2xl bg-white hover:bg-purple-50/40 border-2 border-purple-200/80 hover:border-purple-500 shadow-sm transition-all space-y-2.5 touch-manipulation active:scale-95"
          >
            <div className="w-10 h-10 rounded-xl bg-purple-600 text-white flex items-center justify-center group-hover:scale-105 transition-transform shadow-sm shadow-purple-600/20">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <div className="font-black text-stone-900 text-xs sm:text-sm leading-tight">Hotel Expenses</div>
              <div className="text-[10px] text-purple-900 font-bold mt-0.5">हॉटेल खर्च</div>
              <div className="text-[10px] text-stone-500 font-medium mt-1">
                13 Categories & 1-tap
              </div>
            </div>
          </Link>
        </div>
      </div>

      {/* SEGREGATED BACK-OFFICE & ADMINISTRATION SECTION */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between border-t border-stone-200 pt-5">
          <h2 className="text-xs sm:text-sm font-black text-stone-700 uppercase tracking-wider flex items-center gap-2">
            <Boxes className="w-4 h-4 text-stone-500" />
            <span>📦 इतर व्यवस्थापन व बॅक-ऑफिस (Back-Office & Administration)</span>
          </h2>
          <span className="text-[11px] font-bold text-stone-400">दुय्यम व्यवस्थापन प्रणाली</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3 sm:gap-3">
          <Link
            href="/purchases"
            className="p-3.5 rounded-2xl bg-white hover:bg-stone-50 border border-stone-200 hover:border-stone-400 shadow-2xs transition-all space-y-2 touch-manipulation active:scale-95"
          >
            <div className="w-8 h-8 rounded-lg bg-stone-100 text-stone-800 flex items-center justify-center">
              <ShoppingCart className="w-4 h-4" />
            </div>
            <div>
              <div className="font-bold text-stone-900 text-xs">Fast Purchases</div>
              <div className="text-[10px] text-stone-500 font-medium">खरेदी नोंद व रीऑर्डर</div>
            </div>
          </Link>

          <Link
            href="/inventory"
            className="p-3.5 rounded-2xl bg-white hover:bg-stone-50 border border-stone-200 hover:border-stone-400 shadow-2xs transition-all space-y-2 touch-manipulation active:scale-95"
          >
            <div className="w-8 h-8 rounded-lg bg-stone-100 text-stone-800 flex items-center justify-center">
              <Boxes className="w-4 h-4" />
            </div>
            <div>
              <div className="font-bold text-stone-900 text-xs">Inventory Ledger</div>
              <div className="text-[10px] text-stone-500 font-medium">साठा नियंत्रण व रीऑर्डर</div>
            </div>
          </Link>

          <Link
            href="/suppliers"
            className="p-3.5 rounded-2xl bg-white hover:bg-stone-50 border border-stone-200 hover:border-stone-400 shadow-2xs transition-all space-y-2 touch-manipulation active:scale-95"
          >
            <div className="w-8 h-8 rounded-lg bg-stone-100 text-stone-800 flex items-center justify-center">
              <Coins className="w-4 h-4" />
            </div>
            <div>
              <div className="font-bold text-stone-900 text-xs">Suppliers & Advances</div>
              <div className="text-[10px] text-stone-500 font-medium">व्यापारी हिशोब व आगाऊ</div>
            </div>
          </Link>

          <Link
            href="/purchase-planner"
            className="p-3.5 rounded-2xl bg-white hover:bg-stone-50 border border-stone-200 hover:border-stone-400 shadow-2xs transition-all space-y-2 touch-manipulation active:scale-95"
          >
            <div className="w-8 h-8 rounded-lg bg-stone-100 text-stone-800 flex items-center justify-center">
              <ClipboardList className="w-4 h-4" />
            </div>
            <div>
              <div className="font-bold text-stone-900 text-xs">Purchase Planner</div>
              <div className="text-[10px] text-stone-500 font-medium">सकाळचे खरेदी नियोजन</div>
            </div>
          </Link>

          <Link
            href="/recipes"
            className="p-3.5 rounded-2xl bg-white hover:bg-stone-50 border border-stone-200 hover:border-stone-400 shadow-2xs transition-all space-y-2 touch-manipulation active:scale-95"
          >
            <div className="w-8 h-8 rounded-lg bg-stone-100 text-stone-800 flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <div className="font-bold text-stone-900 text-xs">Recipes & Yields</div>
              <div className="text-[10px] text-stone-500 font-medium">रेसिपी व मार्जिन गणना</div>
            </div>
          </Link>

          <Link
            href="/wastage"
            className="p-3.5 rounded-2xl bg-white hover:bg-stone-50 border border-stone-200 hover:border-stone-400 shadow-2xs transition-all space-y-2 touch-manipulation active:scale-95"
          >
            <div className="w-8 h-8 rounded-lg bg-stone-100 text-stone-800 flex items-center justify-center">
              <Trash2 className="w-4 h-4" />
            </div>
            <div>
              <div className="font-bold text-stone-900 text-xs">Wastage Logger</div>
              <div className="text-[10px] text-stone-500 font-medium">अन्न नासाडी व घट नोंद</div>
            </div>
          </Link>

          <Link
            href="/staff"
            className="p-3.5 rounded-2xl bg-white hover:bg-stone-50 border border-stone-200 hover:border-stone-400 shadow-2xs transition-all space-y-2 touch-manipulation active:scale-95"
          >
            <div className="w-8 h-8 rounded-lg bg-stone-100 text-stone-800 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <div className="font-bold text-stone-900 text-xs">Staff & Payroll</div>
              <div className="text-[10px] text-stone-500 font-medium">कर्मचारी हजेरी व पगार</div>
            </div>
          </Link>

          <Link
            href="/cash-upi"
            className="p-3.5 rounded-2xl bg-white hover:bg-stone-50 border border-stone-200 hover:border-stone-400 shadow-2xs transition-all space-y-2 touch-manipulation active:scale-95"
          >
            <div className="w-8 h-8 rounded-lg bg-stone-100 text-stone-800 flex items-center justify-center">
              <Scale className="w-4 h-4" />
            </div>
            <div>
              <div className="font-bold text-stone-900 text-xs">Cash & UPI Match</div>
              <div className="text-[10px] text-stone-500 font-medium">गल्ला व बँक ताळमेळ</div>
            </div>
          </Link>

          <Link
            href="/daily-closing"
            className="p-3.5 rounded-2xl bg-white hover:bg-stone-50 border border-stone-200 hover:border-stone-400 shadow-2xs transition-all space-y-2 touch-manipulation active:scale-95"
          >
            <div className="w-8 h-8 rounded-lg bg-stone-900 text-white flex items-center justify-center">
              <Lock className="w-4 h-4" />
            </div>
            <div>
              <div className="font-bold text-stone-900 text-xs">Daily Closing</div>
              <div className="text-[10px] text-stone-500 font-medium">१०-मुद्दे तपासणी व Z-रिपोर्ट</div>
            </div>
          </Link>

          <Link
            href="/office-orders"
            className="p-3.5 rounded-2xl bg-white hover:bg-stone-50 border border-stone-200 hover:border-stone-400 shadow-2xs transition-all space-y-2 touch-manipulation active:scale-95"
          >
            <div className="w-8 h-8 rounded-lg bg-stone-100 text-stone-800 flex items-center justify-center">
              <Building2 className="w-4 h-4" />
            </div>
            <div>
              <div className="font-bold text-stone-900 text-xs">Office Orders</div>
              <div className="text-[10px] text-stone-500 font-medium">बाणेर आयटी पार्सल केटरिंग</div>
            </div>
          </Link>

          <Link
            href="/reports"
            className="p-3.5 rounded-2xl bg-white hover:bg-stone-50 border border-stone-200 hover:border-stone-400 shadow-2xs transition-all space-y-2 touch-manipulation active:scale-95"
          >
            <div className="w-8 h-8 rounded-lg bg-stone-100 text-stone-800 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
            <div>
              <div className="font-bold text-stone-900 text-xs">Reports & Analytics</div>
              <div className="text-[10px] text-stone-500 font-medium">P&L, जीएसटी व विक्री अहवाल</div>
            </div>
          </Link>

          <Link
            href="/settings"
            className="p-3.5 rounded-2xl bg-white hover:bg-stone-50 border border-stone-200 hover:border-stone-400 shadow-2xs transition-all space-y-2 touch-manipulation active:scale-95"
          >
            <div className="w-8 h-8 rounded-lg bg-stone-100 text-stone-800 flex items-center justify-center">
              <Sliders className="w-4 h-4" />
            </div>
            <div>
              <div className="font-bold text-stone-900 text-xs">Settings & POS</div>
              <div className="text-[10px] text-stone-500 font-medium">प्रिंटर, हॉटेल माहिती व बॅकअप</div>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
