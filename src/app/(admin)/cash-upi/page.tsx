"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Coins,
  QrCode,
  ArrowUpRight,
  ArrowDownLeft,
  CheckCircle2,
  AlertTriangle,
  Scale,
  Plus,
  RefreshCw,
  Printer,
  Search,
  Calendar,
  Clock,
  Banknote,
  Check,
  Calculator,
  FileText,
  Copy,
} from "lucide-react";
import { globalRestaurantStore } from "@/lib/store/restaurant-store";
import { useAndroidBackButton } from "@/lib/mobile/useAndroidBackButton";
import { triggerHaptic } from "@/lib/mobile/haptics";
import { openPrintWindow } from "@/lib/printing/thermal-printer";

interface DenominationRow {
  label: string;
  value: number;
  count: number;
}

const DEFAULT_DENOMINATIONS: DenominationRow[] = [
  { label: "₹500", value: 500, count: 0 },
  { label: "₹200", value: 200, count: 0 },
  { label: "₹100", value: 100, count: 0 },
  { label: "₹50", value: 50, count: 0 },
  { label: "₹20", value: 20, count: 0 },
  { label: "₹10", value: 10, count: 0 },
  { label: "Coins", value: 1, count: 0 },
];

const PRESET_REASONS = [
  { label: "Morning Float", mode: "CASH", type: "INFLOW", defaultAmount: 2000 },
  { label: "Bank Change", mode: "CASH", type: "INFLOW", defaultAmount: 1000 },
  { label: "Kirana / Veg Purchase", mode: "CASH", type: "OUTFLOW", defaultAmount: 500 },
  { label: "Gas Cylinder Bill", mode: "CASH", type: "OUTFLOW", defaultAmount: 1950 },
  { label: "Staff Daily Advance", mode: "CASH", type: "OUTFLOW", defaultAmount: 500 },
  { label: "Owner Drawing", mode: "CASH", type: "OUTFLOW", defaultAmount: 3000 },
  { label: "UPI Bank Settlement", mode: "UPI", type: "INFLOW", defaultAmount: 5000 },
  { label: "Float Adjustment", mode: "CASH", type: "INFLOW", defaultAmount: 100 },
] as const;

export default function CashUPIReconciliationPage() {
  const store = globalRestaurantStore;
  const [, setTick] = useState(0);

  // Cash & UPI Balances
  const [actualCashCount, setActualCashCount] = useState<number>(() => store.cashLedger[0]?.balance ?? 5000);
  const [actualUpiCount, setActualUpiCount] = useState<number>(() => store.upiLedger[0]?.balance ?? 15000);

  // Denomination Sheet State
  const [showDenomDrawer, setShowDenomDrawer] = useState(false);
  const [denominations, setDenominations] = useState<DenominationRow[]>(DEFAULT_DENOMINATIONS);

  // Manual Float / Entry Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [entryMode, setEntryMode] = useState<"CASH" | "UPI">("CASH");
  const [entryType, setEntryType] = useState<"INFLOW" | "OUTFLOW">("INFLOW");
  const [amount, setAmount] = useState<number>(500);
  const [description, setDescription] = useState("");

  // Thermal Slip Modal State
  const [showSlipModal, setShowSlipModal] = useState(false);
  const [copiedSlip, setCopiedSlip] = useState(false);

  // Ledgers Filter State
  const [activeLedgerTab, setActiveLedgerTab] = useState<"ALL" | "CASH" | "UPI">("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [directionFilter, setDirectionFilter] = useState<"ALL" | "INFLOW" | "OUTFLOW">("ALL");

  // Android back button traps
  useAndroidBackButton(showAddModal, () => setShowAddModal(false));
  useAndroidBackButton(showDenomDrawer, () => setShowDenomDrawer(false));
  useAndroidBackButton(showSlipModal, () => setShowSlipModal(false));

  // Multi-terminal local sync listener
  useEffect(() => {
    const handleSync = () => setTick((t) => t + 1);
    window.addEventListener("kk-state-changed", handleSync);
    return () => window.removeEventListener("kk-state-changed", handleSync);
  }, []);

  const currentExpectedCash = store.cashLedger[0]?.balance ?? 5000;
  const currentExpectedUpi = store.upiLedger[0]?.balance ?? 15000;

  const cashVariance = actualCashCount - currentExpectedCash;
  const upiVariance = actualUpiCount - currentExpectedUpi;
  const totalVariance = cashVariance + upiVariance;

  const todayDateStr = useMemo(() => new Date().toISOString().split("T")[0], []);

  // Denomination calculator sum
  const totalDenominationSum = useMemo(() => {
    return denominations.reduce((acc, row) => acc + row.value * row.count, 0);
  }, [denominations]);

  const handleDenominationChange = (index: number, count: number) => {
    const safeCount = Math.max(0, isNaN(count) ? 0 : count);
    setDenominations((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], count: safeCount };
      return copy;
    });
  };

  const applyDenominationToCash = () => {
    setActualCashCount(totalDenominationSum);
    setShowDenomDrawer(false);
    triggerHaptic("success");
  };

  const resetDenominations = () => {
    setDenominations(DEFAULT_DENOMINATIONS);
    triggerHaptic("tap");
  };

  // Add Manual Ledger Entry
  const handleAddLedgerEntry = (e: React.FormEvent) => {
    e.preventDefault();
    const today = new Date().toISOString().split("T")[0];

    if (entryMode === "CASH") {
      const inflow = entryType === "INFLOW" ? amount : 0;
      const outflow = entryType === "OUTFLOW" ? amount : 0;
      const newBalance = currentExpectedCash + inflow - outflow;

      store.cashLedger.unshift({
        id: `csh-${Date.now()}`,
        date: today,
        entryType: "ADJUSTMENT",
        description: description || `Manual ${entryType.toLowerCase()} entry`,
        inflow,
        outflow,
        balance: newBalance,
        timestamp: new Date().toISOString(),
      });
    } else {
      const inflow = entryType === "INFLOW" ? amount : 0;
      const outflow = entryType === "OUTFLOW" ? amount : 0;
      const newBalance = currentExpectedUpi + inflow - outflow;

      store.upiLedger.unshift({
        id: `upi-${Date.now()}`,
        date: today,
        entryType: "TRANSFER",
        description: description || `Manual ${entryType.toLowerCase()} entry`,
        inflow,
        outflow,
        balance: newBalance,
        timestamp: new Date().toISOString(),
      });
    }

    setShowAddModal(false);
    setDescription("");
    triggerHaptic("success");
    store.notifyStateChange("reconcileCashFloat");
    setTick((t) => t + 1);
  };

  // Filtered Ledgers
  const filteredCashLedger = useMemo(() => {
    return store.cashLedger.filter((entry) => {
      if (directionFilter === "INFLOW" && entry.inflow <= 0) return false;
      if (directionFilter === "OUTFLOW" && entry.outflow <= 0) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          entry.description.toLowerCase().includes(q) ||
          entry.entryType.toLowerCase().includes(q) ||
          entry.date.includes(q)
        );
      }
      return true;
    });
  }, [store.cashLedger, directionFilter, searchQuery]);

  const filteredUpiLedger = useMemo(() => {
    return store.upiLedger.filter((entry) => {
      if (directionFilter === "INFLOW" && entry.inflow <= 0) return false;
      if (directionFilter === "OUTFLOW" && entry.outflow <= 0) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          entry.description.toLowerCase().includes(q) ||
          entry.entryType.toLowerCase().includes(q) ||
          (entry.utrReference && entry.utrReference.toLowerCase().includes(q)) ||
          entry.date.includes(q)
        );
      }
      return true;
    });
  }, [store.upiLedger, directionFilter, searchQuery]);

  // 80mm Thermal Slip HTML (Clean English)
  const generateThermalSlipHtml = () => {
    const now = new Date();
    const dateStr = now.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
    const timeStr = now.toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Shift Reconciliation Slip</title>
  <style>
    @page { margin: 0; }
    body {
      font-family: 'Courier New', Courier, monospace;
      width: 76mm;
      margin: 0 auto;
      padding: 8px 4px;
      color: #000;
      font-size: 12px;
      line-height: 1.3;
    }
    .text-center { text-align: center; }
    .text-right { text-align: right; }
    .bold { font-weight: bold; }
    .divider { border-top: 1px dashed #000; margin: 6px 0; }
    .double-divider { border-top: 2px solid #000; margin: 6px 0; }
    .row { display: flex; justify-content: space-between; margin: 2px 0; }
    .header { font-size: 15px; font-weight: bold; margin-bottom: 2px; }
  </style>
</head>
<body>
  <div class="text-center">
    <div class="header">KOLHAPURI KHANAWAL</div>
    <div style="font-size: 11px;">CASH & UPI RECONCILIATION SLIP</div>
  </div>

  <div class="divider"></div>

  <div class="row">
    <span>Date:</span>
    <span class="bold">${dateStr}</span>
  </div>
  <div class="row">
    <span>Time:</span>
    <span>${timeStr}</span>
  </div>

  <div class="double-divider"></div>

  <div class="bold" style="font-size: 12px; margin: 4px 0 2px 0;">1. CASH DRAWER</div>
  <div class="row">
    <span>Expected Balance:</span>
    <span class="bold">₹${currentExpectedCash.toLocaleString("en-IN")}</span>
  </div>
  <div class="row">
    <span>Actual Count:</span>
    <span class="bold">₹${actualCashCount.toLocaleString("en-IN")}</span>
  </div>
  <div class="row">
    <span>Variance:</span>
    <span class="bold">${
      cashVariance === 0
        ? "₹0 (Balanced)"
        : cashVariance > 0
        ? `+₹${cashVariance} (Surplus)`
        : `-₹${Math.abs(cashVariance)} (Shortage)`
    }</span>
  </div>

  <div class="divider"></div>

  <div class="bold" style="font-size: 12px; margin: 4px 0 2px 0;">2. UPI BANK (SOUNDBOX)</div>
  <div class="row">
    <span>System Balance:</span>
    <span class="bold">₹${currentExpectedUpi.toLocaleString("en-IN")}</span>
  </div>
  <div class="row">
    <span>Bank Count:</span>
    <span class="bold">₹${actualUpiCount.toLocaleString("en-IN")}</span>
  </div>
  <div class="row">
    <span>Variance:</span>
    <span class="bold">${
      upiVariance === 0 ? "₹0 (Balanced)" : `₹${upiVariance}`
    }</span>
  </div>

  <div class="double-divider"></div>

  <div class="row bold" style="font-size: 13px;">
    <span>Total Liquid Funds:</span>
    <span>₹${(actualCashCount + actualUpiCount).toLocaleString("en-IN")}</span>
  </div>

  <div class="divider"></div>

  ${
    denominations.some((d) => d.count > 0)
      ? `
  <div class="bold" style="font-size: 11px; margin: 4px 0 2px 0;">DENOMINATIONS:</div>
  ${denominations
    .filter((d) => d.count > 0)
    .map(
      (d) => `
    <div class="row" style="font-size: 10px;">
      <span>${d.label} × ${d.count}</span>
      <span>= ₹${(d.value * d.count).toLocaleString("en-IN")}</span>
    </div>
  `
    )
    .join("")}
  <div class="divider"></div>
  `
      : ""
  }

  <div style="margin-top: 24px;">
    <div class="row">
      <div style="width: 45%; border-top: 1px solid #000; text-align: center; padding-top: 3px; font-size: 10px;">
        Cashier Sign
      </div>
      <div style="width: 45%; border-top: 1px solid #000; text-align: center; padding-top: 3px; font-size: 10px;">
        Manager Sign
      </div>
    </div>
  </div>

  <div class="divider"></div>
  <div class="text-center" style="font-size: 9px; margin-top: 8px;">
    Kolhapuri Khanawal POS OS
  </div>
</body>
</html>
    `.trim();
  };

  const handlePrintSlip = () => {
    triggerHaptic("tap");
    const html = generateThermalSlipHtml();
    openPrintWindow(html, `Reconciliation-Slip-${todayDateStr}`);
  };

  const handleCopyTextSummary = () => {
    const text = `
*Kolhapuri Khanawal — Reconciliation Report*
Date: ${todayDateStr}
----------------------------------------
Cash Drawer:
- Expected: ₹${currentExpectedCash.toLocaleString("en-IN")}
- Actual: ₹${actualCashCount.toLocaleString("en-IN")}
- Variance: ${cashVariance === 0 ? "₹0 (Balanced)" : (cashVariance > 0 ? `+₹${cashVariance} (Surplus)` : `-₹${Math.abs(cashVariance)} (Shortage)`)}

UPI Bank:
- System: ₹${currentExpectedUpi.toLocaleString("en-IN")}
- Bank: ₹${actualUpiCount.toLocaleString("en-IN")}
- Variance: ${upiVariance === 0 ? "₹0 (Balanced)" : `₹${upiVariance}`}

Total Funds: ₹${(actualCashCount + actualUpiCount).toLocaleString("en-IN")}
Status: ${totalVariance === 0 ? "Balanced (Zero Variance)" : "Variance detected"}
----------------------------------------
    `.trim();

    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedSlip(true);
      triggerHaptic("tap");
      setTimeout(() => setCopiedSlip(false), 2500);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-5 animate-in fade-in duration-200">
      {/* 1. Header & Controls */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 border border-[#E7E2DA] shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-red-50 text-red-700 border border-red-200 uppercase tracking-wider">
              Reconciliation
            </span>
            <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-200">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Live
            </span>
            <span className="text-xs font-bold text-stone-500 font-mono">
              {todayDateStr}
            </span>
          </div>

          <h1 className="text-xl sm:text-2xl font-black text-stone-900 tracking-tight">
            Cash Drawer & UPI Reconciliation
          </h1>
          <p className="text-xs sm:text-sm text-stone-500 font-medium">
            Daily physical cash float and UPI bank collections verification.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => {
              triggerHaptic("tap");
              setShowDenomDrawer(!showDenomDrawer);
            }}
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 bg-white hover:bg-stone-50 text-stone-800 border border-stone-200 font-bold px-3.5 py-2.5 rounded-xl text-xs shadow-xs active:scale-95 transition-all touch-manipulation"
          >
            <Calculator className="w-4 h-4 text-amber-700" />
            <span>Count Notes</span>
          </button>

          <button
            type="button"
            onClick={() => {
              triggerHaptic("tap");
              setShowSlipModal(true);
            }}
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 bg-white hover:bg-stone-50 text-stone-800 border border-stone-200 font-bold px-3.5 py-2.5 rounded-xl text-xs shadow-xs active:scale-95 transition-all touch-manipulation"
          >
            <Printer className="w-4 h-4 text-stone-700" />
            <span>Print Slip</span>
          </button>

          <button
            type="button"
            onClick={() => {
              triggerHaptic("tap");
              setShowAddModal(true);
            }}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-red-700 hover:bg-red-800 text-white font-bold px-4 py-2.5 rounded-xl text-xs shadow-md shadow-red-700/20 active:scale-95 transition-all touch-manipulation"
          >
            <Plus className="w-4 h-4" />
            <span>+ Add Entry</span>
          </button>
        </div>
      </div>

      {/* 2. 4-Metric Overview Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Card 1: Total Liquid */}
        <div className="bg-white rounded-2xl p-4 border border-[#E7E2DA] shadow-xs space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-stone-500">Total Liquid Balance</span>
            <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-800 flex items-center justify-center border border-amber-200">
              <Banknote className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl font-black text-stone-900 font-mono tracking-tight">
            ₹{(currentExpectedCash + currentExpectedUpi).toLocaleString("en-IN")}
          </div>
          <div className="text-[11px] text-stone-500 font-medium truncate">
            Cash ₹{currentExpectedCash.toLocaleString("en-IN")} + UPI ₹{currentExpectedUpi.toLocaleString("en-IN")}
          </div>
        </div>

        {/* Card 2: Cash In Drawer */}
        <div className="bg-white rounded-2xl p-4 border border-[#E7E2DA] shadow-xs space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-stone-500">Cash in Drawer</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-800 flex items-center justify-center border border-emerald-200">
              <Coins className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl font-black text-emerald-950 font-mono tracking-tight">
            ₹{actualCashCount.toLocaleString("en-IN")}
          </div>
          <div className="text-[11px]">
            {cashVariance === 0 ? (
              <span className="font-bold text-emerald-700 flex items-center gap-1">
                <Check className="w-3 h-3" /> Balanced
              </span>
            ) : cashVariance > 0 ? (
              <span className="font-bold text-amber-700">
                +₹{cashVariance} Surplus
              </span>
            ) : (
              <span className="font-bold text-rose-700">
                -₹{Math.abs(cashVariance)} Short
              </span>
            )}
          </div>
        </div>

        {/* Card 3: UPI Bank */}
        <div className="bg-white rounded-2xl p-4 border border-[#E7E2DA] shadow-xs space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-stone-500">UPI Bank Collections</span>
            <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-800 flex items-center justify-center border border-blue-200">
              <QrCode className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl font-black text-blue-950 font-mono tracking-tight">
            ₹{actualUpiCount.toLocaleString("en-IN")}
          </div>
          <div className="text-[11px]">
            {upiVariance === 0 ? (
              <span className="font-bold text-blue-700 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Settled to Bank
              </span>
            ) : (
              <span className="font-bold text-amber-700">
                Diff: ₹{Math.abs(upiVariance)}
              </span>
            )}
          </div>
        </div>

        {/* Card 4: Net Variance */}
        <div className="bg-white rounded-2xl p-4 border border-[#E7E2DA] shadow-xs space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-stone-500">Total Variance</span>
            <div
              className={`w-7 h-7 rounded-lg flex items-center justify-center border ${
                totalVariance === 0
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : "bg-rose-50 text-rose-700 border-rose-200"
              }`}
            >
              <Scale className="w-3.5 h-3.5" />
            </div>
          </div>
          <div
            className={`text-2xl font-black font-mono tracking-tight ${
              totalVariance === 0 ? "text-emerald-700" : "text-rose-700"
            }`}
          >
            {totalVariance === 0 ? "₹0" : `${totalVariance > 0 ? "+" : "-"}₹${Math.abs(totalVariance)}`}
          </div>
          <div className="text-[11px] font-bold">
            {totalVariance === 0 ? (
              <span className="text-emerald-700">All accounts matched</span>
            ) : (
              <span className="text-rose-700">Check differences</span>
            )}
          </div>
        </div>
      </div>

      {/* 3. Denomination Calculator (Collapsible) */}
      {showDenomDrawer && (
        <div className="bg-white rounded-3xl p-5 border-2 border-amber-300 shadow-sm animate-in slide-in-from-top-2 duration-150 space-y-3">
          <div className="flex items-center justify-between border-b border-stone-200 pb-2.5">
            <div className="flex items-center gap-2">
              <Calculator className="w-4 h-4 text-amber-700" />
              <h3 className="text-sm font-black text-stone-900">
                Note Denomination Counter
              </h3>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={resetDenominations}
                className="px-2.5 py-1 rounded-lg border border-stone-200 text-stone-600 hover:bg-stone-50 text-xs font-bold touch-manipulation"
              >
                Reset
              </button>
              <button
                type="button"
                onClick={() => setShowDenomDrawer(false)}
                className="w-7 h-7 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-600 flex items-center justify-center font-black text-xs"
              >
                ✕
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
            {denominations.map((denom, index) => (
              <div
                key={denom.label}
                className="p-2.5 rounded-xl bg-stone-50 border border-stone-200 space-y-1.5"
              >
                <div className="flex justify-between items-baseline">
                  <span className="text-xs font-black text-stone-800">{denom.label}</span>
                  <span className="text-[10px] font-mono font-bold text-stone-500">
                    ₹{(denom.value * denom.count).toLocaleString("en-IN")}
                  </span>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleDenominationChange(index, denom.count - 1)}
                    className="w-7 h-7 rounded-lg bg-white border border-stone-300 text-stone-700 font-bold text-sm flex items-center justify-center active:scale-95 touch-manipulation"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    min="0"
                    inputMode="numeric"
                    value={denom.count === 0 ? "" : denom.count}
                    placeholder="0"
                    onChange={(e) => handleDenominationChange(index, parseInt(e.target.value) || 0)}
                    className="w-full text-center py-1 px-1 font-mono font-black text-xs rounded-lg border border-stone-300 bg-white"
                  />
                  <button
                    type="button"
                    onClick={() => handleDenominationChange(index, denom.count + 1)}
                    className="w-7 h-7 rounded-lg bg-white border border-stone-300 text-stone-700 font-bold text-sm flex items-center justify-center active:scale-95 touch-manipulation"
                  >
                    +
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-stone-200">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-stone-500">Total Counted:</span>
              <span className="text-xl font-black font-mono text-emerald-800">
                ₹{totalDenominationSum.toLocaleString("en-IN")}
              </span>
            </div>

            <button
              type="button"
              onClick={applyDenominationToCash}
              className="inline-flex items-center gap-1.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold px-4 py-2 rounded-xl text-xs shadow-sm active:scale-95 transition-all touch-manipulation"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Apply to Cash Drawer</span>
            </button>
          </div>
        </div>
      )}

      {/* 4. Dual Workbenches: Cash vs UPI */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Cash Drawer Workbench */}
        <div className="bg-white rounded-3xl p-5 sm:p-6 border border-[#E7E2DA] shadow-xs space-y-4 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-800 flex items-center justify-center border border-emerald-200 shrink-0">
                  <Coins className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-black text-stone-900">Cash Drawer</h2>
                  <p className="text-xs text-stone-500 font-medium">Physical cash in drawer</p>
                </div>
              </div>
              <span className="text-xs font-black px-2.5 py-0.5 bg-emerald-50 text-emerald-800 rounded-full border border-emerald-200">
                Drawer
              </span>
            </div>

            {/* Expected Balance Card */}
            <div className="p-4 bg-emerald-50/60 rounded-2xl border border-emerald-200/70 space-y-1">
              <div className="text-xs font-bold text-stone-500">System Balance</div>
              <div className="text-3xl font-black text-emerald-950 font-mono">
                ₹{currentExpectedCash.toLocaleString("en-IN")}
              </div>
            </div>

            {/* Physical Cash Input */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-stone-700">Physical Cash Count:</label>
                <button
                  type="button"
                  onClick={() => {
                    setActualCashCount(currentExpectedCash);
                    triggerHaptic("success");
                  }}
                  className="text-xs font-bold text-emerald-700 hover:text-emerald-900 underline underline-offset-2"
                >
                  Match System
                </button>
              </div>

              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-mono font-black text-stone-400 text-lg">
                    ₹
                  </span>
                  <input
                    type="number"
                    inputMode="decimal"
                    value={actualCashCount}
                    onChange={(e) => setActualCashCount(parseFloat(e.target.value) || 0)}
                    className="w-full pl-8 pr-3 py-2.5 rounded-xl border border-stone-200 font-black font-mono text-xl text-stone-900 bg-stone-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-red-600"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => setShowDenomDrawer(true)}
                  className="px-3.5 py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-800 font-bold text-xs rounded-xl border border-stone-200 shrink-0 touch-manipulation active:scale-95 flex items-center gap-1"
                >
                  <Calculator className="w-3.5 h-3.5 text-amber-700" />
                  <span>Notes</span>
                </button>
              </div>

              {/* Quick Steppers */}
              <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                <span className="text-[11px] font-bold text-stone-400 mr-1">Quick:</span>
                {[-500, -100, 100, 500, 1000].map((step) => (
                  <button
                    key={step}
                    type="button"
                    onClick={() => {
                      setActualCashCount((prev) => Math.max(0, prev + step));
                      triggerHaptic("tap");
                    }}
                    className="px-2 py-0.5 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 font-mono font-bold text-xs border border-stone-200 active:scale-95 touch-manipulation"
                  >
                    {step > 0 ? `+${step}` : step}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Variance Status Alert */}
          <div className="pt-2">
            {cashVariance === 0 ? (
              <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-xs font-bold text-emerald-800 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Balanced: Cash drawer matches system count.</span>
              </div>
            ) : cashVariance > 0 ? (
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs font-bold text-amber-900 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Surplus: ₹{cashVariance} extra in drawer</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setEntryMode("CASH");
                    setEntryType("INFLOW");
                    setAmount(cashVariance);
                    setDescription("Cash surplus float adjustment");
                    setShowAddModal(true);
                  }}
                  className="px-2.5 py-1 bg-amber-600 text-white rounded-lg text-xs font-bold active:scale-95"
                >
                  Record
                </button>
              </div>
            ) : (
              <div className="p-3 bg-rose-50 rounded-xl border border-rose-200 text-xs font-bold text-rose-900 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>Shortage: ₹{Math.abs(cashVariance)} short</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setEntryMode("CASH");
                    setEntryType("OUTFLOW");
                    setAmount(Math.abs(cashVariance));
                    setDescription("Cash shortage voucher");
                    setShowAddModal(true);
                  }}
                  className="px-2.5 py-1 bg-rose-600 text-white rounded-lg text-xs font-bold active:scale-95"
                >
                  Record
                </button>
              </div>
            )}
          </div>
        </div>

        {/* UPI Bank Workbench */}
        <div className="bg-white rounded-3xl p-5 sm:p-6 border border-[#E7E2DA] shadow-xs space-y-4 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-800 flex items-center justify-center border border-blue-200 shrink-0">
                  <QrCode className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-black text-stone-900">UPI Bank Collections</h2>
                  <p className="text-xs text-stone-500 font-medium">Soundbox QR settlements</p>
                </div>
              </div>
              <span className="text-xs font-black px-2.5 py-0.5 bg-blue-50 text-blue-800 rounded-full border border-blue-200">
                Verified
              </span>
            </div>

            {/* Recorded Bank Balance Card */}
            <div className="p-4 bg-blue-50/60 rounded-2xl border border-blue-200/70 space-y-1">
              <div className="text-xs font-bold text-stone-500">Recorded Bank Balance</div>
              <div className="text-3xl font-black text-blue-950 font-mono">
                ₹{currentExpectedUpi.toLocaleString("en-IN")}
              </div>
            </div>

            {/* Statement Verification Input */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-stone-700">Bank App Count:</label>
                <button
                  type="button"
                  onClick={() => {
                    setActualUpiCount(currentExpectedUpi);
                    triggerHaptic("success");
                  }}
                  className="text-xs font-bold text-blue-700 hover:text-blue-900 underline underline-offset-2"
                >
                  Match Recorded
                </button>
              </div>

              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-mono font-black text-stone-400 text-lg">
                    ₹
                  </span>
                  <input
                    type="number"
                    inputMode="decimal"
                    value={actualUpiCount}
                    onChange={(e) => setActualUpiCount(parseFloat(e.target.value) || 0)}
                    className="w-full pl-8 pr-3 py-2.5 rounded-xl border border-stone-200 font-black font-mono text-xl text-stone-900 bg-stone-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-600"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setActualUpiCount(currentExpectedUpi);
                    triggerHaptic("tap");
                  }}
                  className="px-4 py-2.5 bg-stone-900 hover:bg-stone-800 text-white font-bold text-xs rounded-xl shrink-0 touch-manipulation active:scale-95 flex items-center gap-1.5"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Sync</span>
                </button>
              </div>

              {/* Soundbox Hardware Tag */}
              <div className="p-2.5 bg-stone-50 rounded-xl border border-stone-200 text-xs font-medium text-stone-600 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Soundbox Connected</span>
                </div>
                <span className="font-bold text-stone-700 text-[11px]">Auto-Settled</span>
              </div>
            </div>
          </div>

          {/* Variance Status Alert */}
          <div className="pt-2">
            {upiVariance === 0 ? (
              <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-xs font-bold text-emerald-800 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Reconciled: QR collections match bank balance.</span>
              </div>
            ) : (
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs font-bold text-amber-900 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Pending Settlement: ₹{Math.abs(upiVariance)}</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setEntryMode("UPI");
                    setEntryType(upiVariance > 0 ? "INFLOW" : "OUTFLOW");
                    setAmount(Math.abs(upiVariance));
                    setDescription("UPI settlement adjustment");
                    setShowAddModal(true);
                  }}
                  className="px-2.5 py-1 bg-amber-600 text-white rounded-lg text-xs font-bold active:scale-95"
                >
                  Record
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 5. Filterable Transaction Ledgers */}
      <div className="bg-white rounded-3xl border border-[#E7E2DA] shadow-xs overflow-hidden">
        {/* Header & Tabs */}
        <div className="p-4 sm:p-5 border-b border-[#E7E2DA] bg-[#FAF8F5]/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm sm:text-base font-black text-stone-900 flex items-center gap-2">
              <FileText className="w-4 h-4 text-red-700" />
              <span>Transaction History</span>
            </h3>
            <p className="text-xs text-stone-500 font-medium">
              Audit log of cash and UPI movements
            </p>
          </div>

          <div className="inline-flex p-1 bg-stone-200/70 rounded-xl self-start sm:self-auto">
            <button
              type="button"
              onClick={() => {
                setActiveLedgerTab("ALL");
                triggerHaptic("tap");
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all touch-manipulation ${
                activeLedgerTab === "ALL"
                  ? "bg-white text-stone-900 shadow-xs"
                  : "text-stone-600 hover:text-stone-900"
              }`}
            >
              All ({store.cashLedger.length + store.upiLedger.length})
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveLedgerTab("CASH");
                triggerHaptic("tap");
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all touch-manipulation flex items-center gap-1 ${
                activeLedgerTab === "CASH"
                  ? "bg-white text-emerald-900 shadow-xs"
                  : "text-stone-600 hover:text-stone-900"
              }`}
            >
              <Coins className="w-3 h-3 text-emerald-600" />
              <span>Cash ({store.cashLedger.length})</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveLedgerTab("UPI");
                triggerHaptic("tap");
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all touch-manipulation flex items-center gap-1 ${
                activeLedgerTab === "UPI"
                  ? "bg-white text-blue-900 shadow-xs"
                  : "text-stone-600 hover:text-stone-900"
              }`}
            >
              <QrCode className="w-3 h-3 text-blue-600" />
              <span>UPI ({store.upiLedger.length})</span>
            </button>
          </div>
        </div>

        {/* Search & Flow Filter */}
        <div className="p-3 sm:p-4 border-b border-stone-200 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-72">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              type="text"
              placeholder="Search description, date, or UTR..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-stone-200 bg-stone-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-red-600"
            />
          </div>

          <div className="flex items-center gap-1.5 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setDirectionFilter("ALL")}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all touch-manipulation ${
                directionFilter === "ALL"
                  ? "bg-stone-900 text-white"
                  : "bg-stone-100 text-stone-600 hover:bg-stone-200"
              }`}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setDirectionFilter("INFLOW")}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all touch-manipulation flex items-center gap-1 ${
                directionFilter === "INFLOW"
                  ? "bg-emerald-700 text-white"
                  : "bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100"
              }`}
            >
              <ArrowDownLeft className="w-3 h-3" />
              <span>In (+)</span>
            </button>
            <button
              type="button"
              onClick={() => setDirectionFilter("OUTFLOW")}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all touch-manipulation flex items-center gap-1 ${
                directionFilter === "OUTFLOW"
                  ? "bg-red-700 text-white"
                  : "bg-red-50 text-red-800 border border-red-200 hover:bg-red-100"
              }`}
            >
              <ArrowUpRight className="w-3 h-3" />
              <span>Out (-)</span>
            </button>
          </div>
        </div>

        {/* Ledger Entries */}
        <div className="divide-y divide-stone-100 max-h-96 overflow-y-auto">
          {(activeLedgerTab === "ALL" || activeLedgerTab === "CASH") &&
            filteredCashLedger.map((entry) => (
              <div
                key={entry.id}
                className="p-3.5 hover:bg-stone-50/70 transition-colors flex items-center justify-between gap-3 text-xs border-l-3 border-l-emerald-600"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                      entry.inflow > 0
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-red-100 text-red-800"
                    }`}
                  >
                    {entry.inflow > 0 ? (
                      <ArrowDownLeft className="w-3.5 h-3.5" />
                    ) : (
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="font-bold text-stone-900 truncate flex items-center gap-1.5">
                      <span>{entry.description}</span>
                      <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 shrink-0">
                        CASH
                      </span>
                    </div>
                    <div className="text-[11px] text-stone-500 font-medium flex items-center gap-1.5 mt-0.5">
                      <span>{entry.date}</span>
                      <span>•</span>
                      <span className="font-bold text-stone-600">{entry.entryType}</span>
                      {entry.referenceId && (
                        <>
                          <span>•</span>
                          <span className="font-mono text-stone-500">{entry.referenceId}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="text-right whitespace-nowrap shrink-0">
                  {entry.inflow > 0 && (
                    <div className="font-mono font-black text-emerald-700 text-sm">
                      +₹{entry.inflow.toLocaleString("en-IN")}
                    </div>
                  )}
                  {entry.outflow > 0 && (
                    <div className="font-mono font-black text-red-700 text-sm">
                      -₹{entry.outflow.toLocaleString("en-IN")}
                    </div>
                  )}
                  <div className="text-[10px] text-stone-400 font-mono">
                    Bal: ₹{entry.balance.toLocaleString("en-IN")}
                  </div>
                </div>
              </div>
            ))}

          {(activeLedgerTab === "ALL" || activeLedgerTab === "UPI") &&
            filteredUpiLedger.map((entry) => (
              <div
                key={entry.id}
                className="p-3.5 hover:bg-stone-50/70 transition-colors flex items-center justify-between gap-3 text-xs border-l-3 border-l-blue-600"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                      entry.inflow > 0
                        ? "bg-blue-100 text-blue-800"
                        : "bg-red-100 text-red-800"
                    }`}
                  >
                    {entry.inflow > 0 ? (
                      <ArrowDownLeft className="w-3.5 h-3.5" />
                    ) : (
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="font-bold text-stone-900 truncate flex items-center gap-1.5">
                      <span>{entry.description}</span>
                      <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-blue-50 text-blue-800 border border-blue-200 shrink-0">
                        UPI
                      </span>
                    </div>
                    <div className="text-[11px] text-stone-500 font-medium flex items-center gap-1.5 mt-0.5">
                      <span>{entry.date}</span>
                      <span>•</span>
                      <span className="font-bold text-stone-600">{entry.entryType}</span>
                      {entry.utrReference && (
                        <>
                          <span>•</span>
                          <span className="font-mono text-blue-700 font-bold">
                            UTR: {entry.utrReference}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="text-right whitespace-nowrap shrink-0">
                  {entry.inflow > 0 && (
                    <div className="font-mono font-black text-blue-700 text-sm">
                      +₹{entry.inflow.toLocaleString("en-IN")}
                    </div>
                  )}
                  {entry.outflow > 0 && (
                    <div className="font-mono font-black text-red-700 text-sm">
                      -₹{entry.outflow.toLocaleString("en-IN")}
                    </div>
                  )}
                  <div className="text-[10px] text-stone-400 font-mono">
                    Bank: ₹{entry.balance.toLocaleString("en-IN")}
                  </div>
                </div>
              </div>
            ))}
        </div>
      </div>

      {/* 6. Manual Float / Adjustment Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-stone-950/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-3xl p-5 sm:p-6 max-w-sm w-full border border-[#E7E2DA] shadow-2xl space-y-4 max-h-[92vh] flex flex-col animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-stone-200 pb-3 shrink-0">
              <h3 className="text-base font-black text-stone-900">
                New Float / Adjustment Entry
              </h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="w-8 h-8 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-600 font-bold flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddLedgerEntry} className="space-y-3.5 flex-1 overflow-y-auto">
              {/* Account */}
              <div>
                <label className="text-xs font-bold text-stone-700 block mb-1">Account:</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setEntryMode("CASH")}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 ${
                      entryMode === "CASH"
                        ? "bg-emerald-700 text-white border-emerald-700 shadow-xs"
                        : "bg-stone-50 text-stone-700 border-stone-200"
                    }`}
                  >
                    <Coins className="w-3.5 h-3.5" />
                    <span>Cash Drawer</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setEntryMode("UPI")}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 ${
                      entryMode === "UPI"
                        ? "bg-blue-700 text-white border-blue-700 shadow-xs"
                        : "bg-stone-50 text-stone-700 border-stone-200"
                    }`}
                  >
                    <QrCode className="w-3.5 h-3.5" />
                    <span>UPI Bank</span>
                  </button>
                </div>
              </div>

              {/* Movement */}
              <div>
                <label className="text-xs font-bold text-stone-700 block mb-1">Movement:</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setEntryType("INFLOW")}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 ${
                      entryType === "INFLOW"
                        ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                        : "bg-stone-50 text-stone-700 border-stone-200"
                    }`}
                  >
                    <ArrowDownLeft className="w-3.5 h-3.5" />
                    <span>Inflow (+)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setEntryType("OUTFLOW")}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 ${
                      entryType === "OUTFLOW"
                        ? "bg-red-700 text-white border-red-700 shadow-xs"
                        : "bg-stone-50 text-stone-700 border-stone-200"
                    }`}
                  >
                    <ArrowUpRight className="w-3.5 h-3.5" />
                    <span>Outflow (-)</span>
                  </button>
                </div>
              </div>

              {/* Amount */}
              <div>
                <label className="text-xs font-bold text-stone-700 block mb-1">Amount (₹):</label>
                <input
                  type="number"
                  inputMode="decimal"
                  min="1"
                  value={amount === 0 ? "" : amount}
                  placeholder="0"
                  onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                  className="w-full p-2.5 rounded-xl border border-stone-300 font-mono font-black text-lg bg-stone-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-red-600"
                  required
                />

                <div className="flex flex-wrap gap-1 mt-1.5">
                  {[100, 200, 500, 1000, 2000].map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => {
                        setAmount(val);
                        triggerHaptic("tap");
                      }}
                      className="px-2 py-0.5 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 font-mono font-bold text-xs border border-stone-200 active:scale-95"
                    >
                      +₹{val}
                    </button>
                  ))}
                </div>
              </div>

              {/* Quick Presets */}
              <div>
                <label className="text-xs font-bold text-stone-700 block mb-1">Quick Presets:</label>
                <div className="flex flex-wrap gap-1">
                  {PRESET_REASONS.map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => {
                        setDescription(preset.label);
                        setEntryMode(preset.mode);
                        setEntryType(preset.type);
                        setAmount(preset.defaultAmount);
                        triggerHaptic("tap");
                      }}
                      className="px-2 py-1 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 text-[11px] font-bold border border-stone-200 active:scale-95"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="text-xs font-bold text-stone-700 block mb-1">Description:</label>
                <input
                  type="text"
                  placeholder="e.g. Added morning float ₹2,000"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full p-2.5 text-xs rounded-xl border border-stone-300 bg-white font-medium focus:outline-none focus:ring-1 focus:ring-red-600"
                  required
                />
              </div>

              {/* Modal Buttons */}
              <div className="pt-2 border-t border-stone-200 flex items-center justify-end gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl border border-stone-300 text-stone-600 font-bold text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-red-700 hover:bg-red-800 text-white font-bold text-xs active:scale-95 shadow-xs"
                >
                  Save Entry
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 7. Thermal Slip Preview Modal */}
      {showSlipModal && (
        <div className="fixed inset-0 z-50 bg-stone-950/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-3xl p-5 sm:p-6 max-w-sm w-full border border-[#E7E2DA] shadow-2xl space-y-4 max-h-[92vh] flex flex-col animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-stone-200 pb-2.5 shrink-0">
              <h3 className="text-sm font-black text-stone-900 flex items-center gap-1.5">
                <Printer className="w-4 h-4 text-stone-700" />
                <span>Shift Reconciliation Slip</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowSlipModal(false)}
                className="w-7 h-7 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-600 font-bold flex items-center justify-center text-xs"
              >
                ✕
              </button>
            </div>

            {/* Simulated Receipt */}
            <div className="flex-1 overflow-y-auto p-3.5 bg-stone-50 rounded-2xl border border-stone-200 font-mono text-xs text-stone-900 space-y-2.5">
              <div className="text-center space-y-0.5">
                <div className="font-black text-xs">KOLHAPURI KHANAWAL</div>
                <div className="text-[10px] text-stone-500">Reconciliation Summary • {todayDateStr}</div>
              </div>

              <div className="border-t border-dashed border-stone-300 pt-1.5 space-y-1">
                <div className="flex justify-between font-bold">
                  <span>Cash Expected:</span>
                  <span>₹{currentExpectedCash.toLocaleString("en-IN")}</span>
                </div>
                <div className="flex justify-between font-bold">
                  <span>Cash Counted:</span>
                  <span>₹{actualCashCount.toLocaleString("en-IN")}</span>
                </div>
                <div className="flex justify-between text-xs font-black">
                  <span>Cash Variance:</span>
                  <span className={cashVariance === 0 ? "text-emerald-700" : "text-rose-700"}>
                    {cashVariance === 0 ? "₹0 (Balanced)" : `₹${cashVariance}`}
                  </span>
                </div>
              </div>

              <div className="border-t border-dashed border-stone-300 pt-1.5 space-y-1">
                <div className="flex justify-between font-bold">
                  <span>UPI System:</span>
                  <span>₹{currentExpectedUpi.toLocaleString("en-IN")}</span>
                </div>
                <div className="flex justify-between font-bold">
                  <span>UPI Bank Count:</span>
                  <span>₹{actualUpiCount.toLocaleString("en-IN")}</span>
                </div>
                <div className="flex justify-between text-xs font-black">
                  <span>UPI Variance:</span>
                  <span className={upiVariance === 0 ? "text-emerald-700" : "text-amber-700"}>
                    {upiVariance === 0 ? "₹0 (Balanced)" : `₹${upiVariance}`}
                  </span>
                </div>
              </div>

              <div className="border-t-2 border-stone-800 pt-1.5 flex justify-between font-black">
                <span>Total Liquid Funds:</span>
                <span>₹{(actualCashCount + actualUpiCount).toLocaleString("en-IN")}</span>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="pt-2 border-t border-stone-200 flex items-center justify-between gap-2 shrink-0">
              <button
                type="button"
                onClick={handleCopyTextSummary}
                className="px-3 py-2 rounded-xl border border-stone-300 text-stone-700 font-bold text-xs hover:bg-stone-50 flex items-center gap-1.5"
              >
                {copiedSlip ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-stone-500" />
                    <span>Copy Text</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handlePrintSlip}
                className="px-4 py-2 rounded-xl bg-red-700 hover:bg-red-800 text-white font-bold text-xs active:scale-95 shadow-xs flex items-center gap-1.5"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print 80mm Slip</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
