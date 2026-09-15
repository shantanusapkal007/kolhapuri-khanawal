"use client";

import React, { useState } from "react";
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
} from "lucide-react";
import { globalRestaurantStore } from "@/lib/store/restaurant-store";

export default function CashUPIReconciliationPage() {
  const store = globalRestaurantStore;
  const [, setTick] = useState(0);

  // Physical Cash Count Form
  const [actualCashCount, setActualCashCount] = useState<number>(store.cashLedger[0]?.balance ?? 5000);
  const [actualUpiCount, setActualUpiCount] = useState<number>(store.upiLedger[0]?.balance ?? 15000);
  const [isReconciled, setIsReconciled] = useState(false);

  // Quick Float Entry Form
  const [showAddModal, setShowAddModal] = useState(false);
  const [entryMode, setEntryMode] = useState<"CASH" | "UPI">("CASH");
  const [entryType, setEntryType] = useState<"INFLOW" | "OUTFLOW">("INFLOW");
  const [amount, setAmount] = useState<number>(500);
  const [description, setDescription] = useState("");

  const currentExpectedCash = store.cashLedger[0]?.balance ?? 5000;
  const currentExpectedUpi = store.upiLedger[0]?.balance ?? 15000;

  const cashVariance = actualCashCount - currentExpectedCash;
  const upiVariance = actualUpiCount - currentExpectedUpi;

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
        description: description || `Manual ${entryType.toLowerCase()} adjustment`,
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
        description: description || `Manual ${entryType.toLowerCase()} adjustment`,
        inflow,
        outflow,
        balance: newBalance,
        timestamp: new Date().toISOString(),
      });
    }

    setShowAddModal(false);
    setDescription("");
    setTick((t) => t + 1);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 sm:p-6 rounded-2xl border border-[#E7E2DA] shadow-xs">
        <div>
          <div className="flex items-center gap-2 text-red-700 text-xs font-black uppercase tracking-wider">
            <Scale className="w-4 h-4" />
            <span>हिशोब व ताळमेळ • Daily Reconciliation</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-stone-900 mt-1">
            Cash Drawer & UPI Bank Reconciliation
          </h1>
          <p className="text-xs sm:text-sm text-stone-500 font-medium">
            Daily double-entry tracking separating physical cash in drawer from UPI QR soundbox bank collections.
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white font-black px-5 py-3 rounded-xl text-sm shadow-md shadow-red-700/20 active:scale-95 transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>+ Manual Adjustment Entry</span>
        </button>
      </div>

      {/* Main Balances Comparison Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Physical Cash In Drawer */}
        <div className="bg-white rounded-3xl p-6 border border-[#E7E2DA] shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-100">
                <Coins className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-black text-stone-900">गल्ला रोख शिल्लक (Cash Drawer)</h3>
                <p className="text-xs text-stone-500 font-medium">Physical cash float + sales - cash expenses</p>
              </div>
            </div>
            <span className="text-xs font-black px-3 py-1 bg-emerald-50 text-emerald-800 rounded-full border border-emerald-200">
              Live
            </span>
          </div>

          <div className="p-4 bg-emerald-50/50 rounded-2xl border border-emerald-100/80 space-y-1">
            <div className="text-xs font-bold text-stone-500">System Calculated Balance</div>
            <div className="text-3xl font-black text-emerald-950 font-mono">
              ₹{currentExpectedCash.toLocaleString("en-IN")}
            </div>
          </div>

          <div className="space-y-3 pt-1">
            <label className="text-xs font-bold text-stone-700">Verify Physical Cash Count (मोजलेली रोख)</label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                value={actualCashCount}
                onChange={(e) => setActualCashCount(parseFloat(e.target.value) || 0)}
                className="flex-1 p-3 rounded-xl border border-stone-200 font-black font-mono text-lg bg-stone-50/50 focus:bg-white focus:border-red-500"
              />
              <button
                onClick={() => setIsReconciled(true)}
                className="px-4 py-3 bg-stone-900 hover:bg-stone-800 text-white font-bold text-xs rounded-xl shadow-xs"
              >
                Match Float
              </button>
            </div>

            {cashVariance !== 0 ? (
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs font-bold text-amber-900 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  Variance Alert: {cashVariance > 0 ? `₹${cashVariance} Extra` : `₹${Math.abs(cashVariance)} Short`} vs system calculation!
                </span>
              </div>
            ) : (
              <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-xs font-bold text-emerald-800 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Zero Variance! Cash drawer perfectly balanced.</span>
              </div>
            )}
          </div>
        </div>

        {/* UPI Soundbox / Bank Balance */}
        <div className="bg-white rounded-3xl p-6 border border-[#E7E2DA] shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-700 flex items-center justify-center border border-blue-100">
                <QrCode className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-black text-stone-900">UPI बँक जमा (Soundbox Bank)</h3>
                <p className="text-xs text-stone-500 font-medium">PhonePe / Google Pay / Paytm QR Settlements</p>
              </div>
            </div>
            <span className="text-xs font-black px-3 py-1 bg-blue-50 text-blue-800 rounded-full border border-blue-200">
              Verified
            </span>
          </div>

          <div className="p-4 bg-blue-50/50 rounded-2xl border border-blue-100/80 space-y-1">
            <div className="text-xs font-bold text-stone-500">System Recorded Bank Balance</div>
            <div className="text-3xl font-black text-blue-950 font-mono">
              ₹{currentExpectedUpi.toLocaleString("en-IN")}
            </div>
          </div>

          <div className="space-y-3 pt-1">
            <label className="text-xs font-bold text-stone-700">Verify Net Banking Balance (बँक स्टेटमेंट)</label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                value={actualUpiCount}
                onChange={(e) => setActualUpiCount(parseFloat(e.target.value) || 0)}
                className="flex-1 p-3 rounded-xl border border-stone-200 font-black font-mono text-lg bg-stone-50/50 focus:bg-white focus:border-red-500"
              />
              <button
                onClick={() => setActualUpiCount(currentExpectedUpi)}
                className="px-4 py-3 bg-stone-900 hover:bg-stone-800 text-white font-bold text-xs rounded-xl shadow-xs"
              >
                Sync App
              </button>
            </div>

            {upiVariance !== 0 ? (
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs font-bold text-amber-900 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  UPI Variance: {upiVariance > 0 ? `₹${upiVariance} Pending Settlement` : `₹${Math.abs(upiVariance)} Unreconciled`}
                </span>
              </div>
            ) : (
              <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-xs font-bold text-emerald-800 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>UPI Soundbox collections reconciled with bank.</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Side-by-Side Ledgers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Cash Ledger */}
        <div className="bg-white rounded-2xl border border-[#E7E2DA] overflow-hidden shadow-xs">
          <div className="p-4 bg-[#FAF8F5] border-b border-[#E7E2DA] flex items-center justify-between">
            <h3 className="text-sm font-black text-stone-900 flex items-center gap-2">
              <Coins className="w-4 h-4 text-emerald-600" />
              <span>Cash In-Drawer Transactions Ledger</span>
            </h3>
            <span className="text-xs font-bold text-stone-500">{store.cashLedger.length} Entries</span>
          </div>

          <div className="divide-y divide-stone-100 max-h-96 overflow-y-auto">
            {store.cashLedger.map((entry) => (
              <div key={entry.id} className="p-3.5 flex items-center justify-between gap-4 text-xs">
                <div>
                  <div className="font-bold text-stone-900">{entry.description}</div>
                  <div className="text-[11px] text-stone-500 font-medium">
                    {entry.date} • Type: <span className="font-bold">{entry.entryType}</span>
                  </div>
                </div>

                <div className="text-right whitespace-nowrap">
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
          </div>
        </div>

        {/* UPI Ledger */}
        <div className="bg-white rounded-2xl border border-[#E7E2DA] overflow-hidden shadow-xs">
          <div className="p-4 bg-[#FAF8F5] border-b border-[#E7E2DA] flex items-center justify-between">
            <h3 className="text-sm font-black text-stone-900 flex items-center gap-2">
              <QrCode className="w-4 h-4 text-blue-600" />
              <span>UPI Soundbox Transactions Ledger</span>
            </h3>
            <span className="text-xs font-bold text-stone-500">{store.upiLedger.length} Entries</span>
          </div>

          <div className="divide-y divide-stone-100 max-h-96 overflow-y-auto">
            {store.upiLedger.map((entry) => (
              <div key={entry.id} className="p-3.5 flex items-center justify-between gap-4 text-xs">
                <div>
                  <div className="font-bold text-stone-900">{entry.description}</div>
                  <div className="text-[11px] text-stone-500 font-medium">
                    {entry.date} {entry.utrReference && `• UTR: ${entry.utrReference}`}
                  </div>
                </div>

                <div className="text-right whitespace-nowrap">
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
          </div>
        </div>
      </div>

      {/* Manual Entry Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-stone-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full border border-[#E7E2DA] shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-[#E7E2DA] pb-3">
              <h3 className="text-base font-black text-stone-900">Manual Cash/UPI Entry</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="w-8 h-8 rounded-full bg-stone-100 text-stone-500 font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddLedgerEntry} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-stone-700">Account</label>
                  <select
                    value={entryMode}
                    onChange={(e) => setEntryMode(e.target.value as "CASH" | "UPI")}
                    className="w-full mt-1 p-2.5 text-sm rounded-xl border border-stone-200 bg-white font-bold"
                  >
                    <option value="CASH">CASH (Drawer)</option>
                    <option value="UPI">UPI (Bank)</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-stone-700">Movement Type</label>
                  <select
                    value={entryType}
                    onChange={(e) => setEntryType(e.target.value as "INFLOW" | "OUTFLOW")}
                    className="w-full mt-1 p-2.5 text-sm rounded-xl border border-stone-200 bg-white font-bold"
                  >
                    <option value="INFLOW">Deposit / Inflow (+)</option>
                    <option value="OUTFLOW">Withdrawal / Outflow (-)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-stone-700">Amount (₹)</label>
                <input
                  type="number"
                  min="1"
                  value={amount}
                  onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                  className="w-full mt-1 p-2.5 text-sm rounded-xl border border-stone-200 bg-white font-black font-mono text-base"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-bold text-stone-700">Description / Reason</label>
                <input
                  type="text"
                  placeholder="e.g. Added morning float change ₹500"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full mt-1 p-2.5 text-sm rounded-xl border border-stone-200 bg-white font-medium"
                  required
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-stone-200 text-stone-600 font-bold text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-white font-bold text-xs"
                >
                  Save Entry
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
