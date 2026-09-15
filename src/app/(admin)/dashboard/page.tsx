"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  TrendingUp,
  Boxes,
  Utensils,
  Clock,
  ArrowRight,
  Users,
  PieChart,
  LayoutDashboard,
  ShieldCheck,
  History,
  AlertTriangle,
  CheckSquare,
  CheckCircle2,
  X,
  Receipt,
  ChefHat,
  Bell,
  Settings,
} from "lucide-react";
import { globalRestaurantStore } from "@/lib/store/restaurant-store";
import { formatQuantityWithUnit } from "@/lib/inventory/unit-converter";
import { generateStockAlerts } from "@/lib/inventory/alerts";

export default function AdminDashboardPage() {
  const store = globalRestaurantStore;
  const [, setTick] = useState(0);

  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setTick((t) => t + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const totalSalesToday = store.payments.reduce((sum, p) => sum + p.amount, 0);
  const activeParties = store.parties.filter((p) => p.status !== "CLOSED" && p.status !== "CANCELLED");
  const occupiedTables = store.tables.filter((t) => t.status === "OCCUPIED" || t.status === "SHARED");
  const totalGuests = activeParties.reduce((sum, p) => sum + p.guestCount, 0);

  // Stock Alerts Engine
  const stockAlerts = generateStockAlerts(store.ingredients);

  // Checklist Completion
  const openingItems = store.checklistItems.filter((i) => i.shift === "OPENING");
  const openingDone = openingItems.filter((i) => i.isCompleted).length;
  const openingPct = openingItems.length > 0 ? Math.round((openingDone / openingItems.length) * 100) : 0;

  const closingItems = store.checklistItems.filter((i) => i.shift === "CLOSING");
  const closingDone = closingItems.filter((i) => i.isCompleted).length;
  const closingPct = closingItems.length > 0 ? Math.round((closingDone / closingItems.length) * 100) : 0;

  // Payment Breakdown
  const upiSales = store.payments.filter((p) => p.paymentMethod === "UPI").reduce((sum, p) => sum + p.amount, 0);
  const cashSales = store.payments.filter((p) => p.paymentMethod === "CASH").reduce((sum, p) => sum + p.amount, 0);
  const cardSales = store.payments.filter((p) => p.paymentMethod === "CARD").reduce((sum, p) => sum + p.amount, 0);

  return (
    <div className="space-y-6">
      {/* Luxury Hero Header */}
      <div className="luxury-card rounded-2xl p-5 sm:p-6 border border-[#E7E2DA] flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-white via-[#FAF8F5] to-white">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-red-600 to-red-700 text-white flex items-center justify-center shadow-md shadow-red-600/20 border border-red-500/30 shrink-0">
            <LayoutDashboard className="w-6 h-6 text-amber-100" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black text-stone-900 tracking-tight">
                Executive Operations Dashboard
              </h1>
              <span className="bg-red-50 text-red-900 text-[10px] font-black px-2.5 py-0.5 rounded-full border border-red-200 uppercase tracking-wider">
                Live Service
              </span>
            </div>
            <p className="text-xs text-stone-500 font-medium mt-0.5">
              Realtime metrics across 12 tables, active KOTs, multi-tender revenue, and critical ingredient stocks.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsAuditModalOpen(true)}
            className="flex items-center gap-1.5 bg-stone-900 hover:bg-stone-800 text-amber-300 text-xs font-bold px-3.5 py-2.5 rounded-xl shadow-xs active:scale-95 transition-all"
          >
            <History className="w-3.5 h-3.5 text-amber-400" />
            <span>Audit Trail ({store.auditLogs.length})</span>
          </button>
          <Link
            href="/reports"
            className="flex items-center gap-1.5 bg-gradient-to-r from-red-600 via-red-700 to-red-800 hover:from-red-700 hover:to-red-900 text-white text-xs font-black px-4 py-2.5 rounded-xl shadow-sm shadow-red-700/20 active:scale-95 transition-all"
          >
            <span>Stock Report</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* Quick Operations Launchpad */}
      <div className="luxury-card rounded-2xl p-3 sm:p-4 border border-[#E7E2DA] bg-white shadow-2xs">
        <div className="flex items-center justify-between mb-2.5">
          <span className="text-[10px] font-black uppercase tracking-wider text-stone-500">
            Quick Operations Launchpad (जलद कार्यप्रणाली)
          </span>
          <span className="text-[10px] text-stone-400 font-bold">1-Tap Station Access</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 text-xs">
          <Link
            href="/waiter"
            className="flex items-center gap-2 p-2.5 rounded-xl bg-[#FAF8F5] hover:bg-stone-100 text-stone-800 border border-[#E7E2DA] font-bold shadow-2xs active:scale-95 transition-all"
          >
            <div className="w-7 h-7 rounded-lg bg-red-600 text-white flex items-center justify-center shrink-0">
              <Utensils className="w-3.5 h-3.5 text-amber-200" />
            </div>
            <div className="truncate">
              <span className="block font-black text-stone-900 leading-tight">12 Tables</span>
              <span className="text-[10px] text-stone-500 font-medium">Floor & KOT</span>
            </div>
          </Link>

          <Link
            href="/billing"
            className="flex items-center gap-2 p-2.5 rounded-xl bg-[#FAF8F5] hover:bg-stone-100 text-stone-800 border border-[#E7E2DA] font-bold shadow-2xs active:scale-95 transition-all"
          >
            <div className="w-7 h-7 rounded-lg bg-emerald-700 text-white flex items-center justify-center shrink-0">
              <Receipt className="w-3.5 h-3.5" />
            </div>
            <div className="truncate">
              <span className="block font-black text-stone-900 leading-tight">Billing POS</span>
              <span className="text-[10px] text-stone-500 font-medium">Cash & UPI</span>
            </div>
          </Link>

          <Link
            href="/kitchen"
            className="flex items-center gap-2 p-2.5 rounded-xl bg-[#FAF8F5] hover:bg-stone-100 text-stone-800 border border-[#E7E2DA] font-bold shadow-2xs active:scale-95 transition-all"
          >
            <div className="w-7 h-7 rounded-lg bg-stone-900 text-amber-300 flex items-center justify-center shrink-0">
              <ChefHat className="w-3.5 h-3.5" />
            </div>
            <div className="truncate">
              <span className="block font-black text-stone-900 leading-tight">Kitchen KDS</span>
              <span className="text-[10px] text-stone-500 font-medium">Live Tickets</span>
            </div>
          </Link>

          <Link
            href="/inventory"
            className="flex items-center gap-2 p-2.5 rounded-xl bg-[#FAF8F5] hover:bg-stone-100 text-stone-800 border border-[#E7E2DA] font-bold shadow-2xs active:scale-95 transition-all"
          >
            <div className="w-7 h-7 rounded-lg bg-amber-600 text-white flex items-center justify-center shrink-0">
              <Boxes className="w-3.5 h-3.5" />
            </div>
            <div className="truncate">
              <span className="block font-black text-stone-900 leading-tight">Stock Ledger</span>
              <span className="text-[10px] text-stone-500 font-medium">3-Tier Par</span>
            </div>
          </Link>

          <Link
            href="/reminders"
            className="flex items-center gap-2 p-2.5 rounded-xl bg-[#FAF8F5] hover:bg-stone-100 text-stone-800 border border-[#E7E2DA] font-bold shadow-2xs active:scale-95 transition-all"
          >
            <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0">
              <Bell className="w-3.5 h-3.5 text-amber-200" />
            </div>
            <div className="truncate">
              <span className="block font-black text-stone-900 leading-tight">Reminders</span>
              <span className="text-[10px] text-stone-500 font-medium">Alerts & Tasks</span>
            </div>
          </Link>

          <Link
            href="/checklists"
            className="flex items-center gap-2 p-2.5 rounded-xl bg-[#FAF8F5] hover:bg-stone-100 text-stone-800 border border-[#E7E2DA] font-bold shadow-2xs active:scale-95 transition-all"
          >
            <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0">
              <CheckSquare className="w-3.5 h-3.5" />
            </div>
            <div className="truncate">
              <span className="block font-black text-stone-900 leading-tight">Checklists</span>
              <span className="text-[10px] text-stone-500 font-medium">SOP Opening</span>
            </div>
          </Link>

          <Link
            href="/settings"
            className="flex items-center gap-2 p-2.5 rounded-xl bg-[#FAF8F5] hover:bg-stone-100 text-stone-800 border border-[#E7E2DA] font-bold shadow-2xs active:scale-95 transition-all"
          >
            <div className="w-7 h-7 rounded-lg bg-stone-700 text-stone-200 flex items-center justify-center shrink-0">
              <Settings className="w-3.5 h-3.5" />
            </div>
            <div className="truncate">
              <span className="block font-black text-stone-900 leading-tight">Settings</span>
              <span className="text-[10px] text-stone-500 font-medium">Waiters & PIN</span>
            </div>
          </Link>
        </div>
      </div>

      {/* Top Key Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="luxury-card p-4 sm:p-5 rounded-2xl border border-[#E7E2DA] flex flex-col justify-between space-y-2">
          <div className="flex items-center justify-between text-stone-500 text-xs font-bold">
            <span>Today's Total Revenue</span>
            <TrendingUp className="w-4 h-4 text-emerald-700" />
          </div>
          <div className="mt-1 text-2xl font-black text-stone-900">₹{totalSalesToday.toLocaleString("en-IN")}</div>
          <div className="text-[11px] text-stone-500 font-medium">
            {store.payments.length} Payments Collected
          </div>
        </div>

        <div className="luxury-card p-4 sm:p-5 rounded-2xl border border-[#E7E2DA] flex flex-col justify-between space-y-2">
          <div className="flex items-center justify-between text-stone-500 text-xs font-bold">
            <span>Active Seated Guests</span>
            <Users className="w-4 h-4 text-amber-700" />
          </div>
          <div className="mt-1 text-2xl font-black text-stone-900">{totalGuests}</div>
          <div className="text-[11px] text-stone-500 font-medium">
            {activeParties.length} Parties across {occupiedTables.length} Tables
          </div>
        </div>

        <div className="luxury-card p-4 sm:p-5 rounded-2xl border border-[#E7E2DA] flex flex-col justify-between space-y-2">
          <div className="flex items-center justify-between text-stone-500 text-xs font-bold">
            <span>Table Occupancy</span>
            <Utensils className="w-4 h-4 text-red-700" />
          </div>
          <div className="mt-1 text-2xl font-black text-stone-900">
            {Math.round((occupiedTables.length / 12) * 100)}%
          </div>
          <div className="text-[11px] text-stone-500 font-medium">
            {occupiedTables.length} of 12 Tables Occupied
          </div>
        </div>

        <div className="luxury-card p-4 sm:p-5 rounded-2xl border border-[#E7E2DA] flex flex-col justify-between space-y-2">
          <div className="flex items-center justify-between text-stone-500 text-xs font-bold">
            <span>KOT Pipeline</span>
            <Clock className="w-4 h-4 text-purple-700" />
          </div>
          <div className="mt-1 text-2xl font-black text-stone-900">
            {store.kots.filter((k) => k.status !== "SERVED" && (k.status as any) !== "CANCELLED").length}
          </div>
          <div className="text-[11px] text-stone-500 font-medium">Active kitchen orders</div>
        </div>
      </div>

      {/* Actionable Stock Alerts Banner */}
      {stockAlerts.length > 0 && (
        <div className="bg-amber-50/90 border border-amber-300 rounded-2xl p-4 sm:p-5 text-xs shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-black text-amber-950 text-sm">
              <AlertTriangle className="w-4 h-4 text-amber-700" />
              <span>Actionable Inventory Alerts ({stockAlerts.length})</span>
            </div>
            <Link href="/inventory" className="text-amber-800 hover:text-amber-950 font-black flex items-center gap-1">
              <span>Order Stock</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 pt-1">
            {stockAlerts.slice(0, 3).map((al) => (
              <div
                key={al.ingredientId}
                className="bg-white/90 p-3 rounded-xl border border-amber-200 flex items-start justify-between gap-2 shadow-2xs"
              >
                <div>
                  <span className="font-bold text-stone-900 block">{al.ingredientName}</span>
                  <p className="text-[11px] text-stone-600 mt-0.5 leading-tight">{al.message}</p>
                </div>
                <span
                  className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase shrink-0 ${
                    al.urgency === "CRITICAL"
                      ? "bg-red-600 text-white"
                      : "bg-amber-100 text-amber-900 border border-amber-300"
                  }`}
                >
                  {al.urgency}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stock Alerts & Payment Breakdown Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Critical & Low Stock Ticker */}
        <div className="lg:col-span-7 luxury-card p-5 sm:p-6 rounded-2xl border border-[#E7E2DA] space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-black text-stone-900 flex items-center gap-2">
              <Boxes className="w-4 h-4 text-red-700" />
              <span>Realtime Stock Health & Availability</span>
            </h2>
            <Link href="/inventory" className="text-xs text-red-700 hover:text-red-900 font-black flex items-center gap-1">
              <span>View Ledger</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          <div className="space-y-2.5 max-h-96 overflow-y-auto">
            {store.ingredients.map((ing) => {
              const isCritical = ing.physicalStock <= ing.criticalLevel;
              const isLow = ing.physicalStock <= ing.reorderLevel && !isCritical;
              const isOut = ing.physicalStock <= 0;

              return (
                <div
                  key={ing.id}
                  className={`p-3 rounded-xl border flex items-center justify-between text-xs transition-all ${
                    isOut
                      ? "bg-red-50/80 border-red-300 shadow-2xs"
                      : isCritical
                      ? "bg-amber-50/80 border-amber-300 shadow-2xs"
                      : "bg-[#FAF8F5] border-[#E7E2DA] hover:border-stone-300"
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-black text-stone-900 text-xs">{ing.name}</span>
                      {ing.localName && (
                        <span className="text-[11px] font-bold text-amber-800">({ing.localName})</span>
                      )}
                    </div>
                    <span className="text-[10px] text-stone-400 font-medium block mt-0.5">
                      Reorder: {ing.reorderLevel} {ing.baseUnit} • Par: {ing.parLevel} {ing.baseUnit}
                    </span>
                  </div>

                  <div className="text-right">
                    <span className="font-black text-stone-900 text-sm block">
                      {formatQuantityWithUnit(ing.physicalStock, ing.baseUnit)}
                    </span>
                    <span
                      className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider ${
                        isOut
                          ? "bg-red-600 text-white"
                          : isCritical
                          ? "bg-amber-50 text-amber-800 border border-amber-200"
                          : isLow
                          ? "bg-amber-50 text-amber-800 border border-amber-200"
                          : "bg-emerald-50 text-emerald-800 border border-emerald-200"
                      }`}
                    >
                      {isOut ? "Out of Stock" : isCritical ? "Critical" : isLow ? "Low Stock" : "Optimal"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Checklists & Multi-Tender Payment Breakdown */}
        <div className="lg:col-span-5 space-y-6">
          {/* Daily Operating Checklist Widget */}
          <div className="luxury-card p-5 sm:p-6 rounded-2xl border border-[#E7E2DA] space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-black text-stone-900 flex items-center gap-2">
                <CheckSquare className="w-4 h-4 text-blue-700" />
                <span>Daily SOP Checklists</span>
              </h2>
              <Link href="/checklists" className="text-xs text-blue-700 hover:text-blue-900 font-bold flex items-center gap-1">
                <span>Manage</span>
                <ArrowRight className="w-3 h-3" />
              </Link>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="bg-[#FAF8F5] border border-[#E7E2DA] p-3 rounded-xl space-y-1.5">
                <span className="font-bold text-stone-700 block">Opening Shift</span>
                <div className="flex items-center justify-between">
                  <span className="text-stone-500 font-medium">{openingDone}/{openingItems.length} Done</span>
                  <span className="font-black text-stone-900">{openingPct}%</span>
                </div>
                <div className="w-full bg-stone-200 rounded-full h-1.5 overflow-hidden">
                  <div className="bg-emerald-600 h-1.5 rounded-full" style={{ width: `${openingPct}%` }} />
                </div>
              </div>

              <div className="bg-[#FAF8F5] border border-[#E7E2DA] p-3 rounded-xl space-y-1.5">
                <span className="font-bold text-stone-700 block">Closing Shift</span>
                <div className="flex items-center justify-between">
                  <span className="text-stone-500 font-medium">{closingDone}/{closingItems.length} Done</span>
                  <span className="font-black text-stone-900">{closingPct}%</span>
                </div>
                <div className="w-full bg-stone-200 rounded-full h-1.5 overflow-hidden">
                  <div className="bg-blue-600 h-1.5 rounded-full" style={{ width: `${closingPct}%` }} />
                </div>
              </div>
            </div>
          </div>

          {/* Payment Method Breakdown */}
          <div className="luxury-card p-5 sm:p-6 rounded-2xl border border-[#E7E2DA] space-y-4">
            <div>
              <h2 className="text-sm font-black text-stone-900 flex items-center gap-2">
                <PieChart className="w-4 h-4 text-emerald-700" />
                <span>Multi-Tender Payment Breakdown</span>
              </h2>
              <p className="text-xs text-stone-500 font-medium mt-0.5">
                Live distribution of settled customer bills across tenders.
              </p>

              <div className="space-y-3 mt-4 text-xs">
                <div className="bg-emerald-50 border border-emerald-200/80 p-3 rounded-xl flex items-center justify-between shadow-2xs">
                  <div>
                    <span className="font-black text-emerald-950 block">UPI QR Payments</span>
                    <span className="text-[11px] text-emerald-700 font-medium">PhonePe, GPay, Paytm</span>
                  </div>
                  <span className="font-black text-base text-emerald-900">₹{upiSales.toLocaleString("en-IN")}</span>
                </div>

                <div className="bg-[#FAF8F5] border border-[#E7E2DA] p-3 rounded-xl flex items-center justify-between shadow-2xs">
                  <div>
                    <span className="font-black text-stone-900 block">Cash Settlements</span>
                    <span className="text-[11px] text-stone-500 font-medium">Physical drawer cash</span>
                  </div>
                  <span className="font-black text-base text-stone-900">₹{cashSales.toLocaleString("en-IN")}</span>
                </div>

                <div className="bg-amber-50 border border-amber-200/80 p-3 rounded-xl flex items-center justify-between shadow-2xs">
                  <div>
                    <span className="font-black text-amber-950 block">Card Swipes (POS)</span>
                    <span className="text-[11px] text-amber-800 font-medium">Debit / Credit cards</span>
                  </div>
                  <span className="font-black text-base text-amber-900">₹{cardSales.toLocaleString("en-IN")}</span>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-[#E7E2DA] flex items-center justify-between text-xs text-stone-500 font-medium">
              <span>Total Collected:</span>
              <span className="font-black text-lg text-stone-900">₹{totalSalesToday.toLocaleString("en-IN")}</span>
            </div>
          </div>
        </div>
      </div>

      {/* MODAL: AUDIT TRAIL LOG VIEWER */}
      {isAuditModalOpen && (
        <div className="fixed inset-0 z-50 bg-stone-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-stone-200 overflow-hidden text-xs max-h-[85vh] flex flex-col animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-[#FAF8F5] border-b border-[#E7E2DA] p-4 flex items-center justify-between">
              <div className="flex items-center gap-2 font-black text-sm text-stone-900">
                <History className="w-5 h-5 text-amber-600" />
                <span>Authoritative Immutable Audit Trail ({store.auditLogs.length} Events)</span>
              </div>
              <button
                onClick={() => setIsAuditModalOpen(false)}
                className="text-stone-400 hover:text-stone-700 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto flex-1 space-y-2">
              {store.auditLogs.length === 0 ? (
                <div className="p-8 text-center text-stone-400">
                  No privileged security or financial overrides recorded yet.
                </div>
              ) : (
                store.auditLogs.map((log) => (
                  <div
                    key={log.id}
                    className="p-3 bg-stone-50 rounded-xl border border-stone-200 space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-black text-[10px] bg-stone-900 text-amber-300 px-2 py-0.5 rounded">
                          {log.action}
                        </span>
                        <span className="font-bold text-stone-800">
                          {log.entityType} #{log.entityId}
                        </span>
                      </div>
                      <span className="text-[10px] text-stone-400">
                        {new Date(log.createdAt).toLocaleTimeString()}
                      </span>
                    </div>

                    <div className="text-[11px] text-stone-600 flex items-center gap-2">
                      <span>User: <strong className="text-stone-800">{log.userName}</strong> ({log.role})</span>
                    </div>

                    {log.reason && (
                      <p className="text-[11px] text-stone-700 italic bg-white p-1.5 rounded border border-stone-200">
                        "{log.reason}"
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>

            <div className="p-3 bg-[#FAF8F5] border-t border-[#E7E2DA] flex justify-end">
              <button
                onClick={() => setIsAuditModalOpen(false)}
                className="px-4 py-2 bg-stone-900 text-white font-bold rounded-xl text-xs"
              >
                Close Audit Viewer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
