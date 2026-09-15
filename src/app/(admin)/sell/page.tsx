"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  TrendingUp,
  Receipt,
  Printer,
  Banknote,
  QrCode,
  CreditCard,
  Sparkles,
  Search,
  Filter,
  ArrowUpRight,
  ArrowRight,
  Utensils,
  Wallet,
  Lock,
  Clock,
  CheckCircle2,
  Calendar,
  AlertCircle,
  Eye,
  FileText,
} from "lucide-react";
import { globalRestaurantStore } from "@/lib/store/restaurant-store";
import { Bill } from "@/types/billing";
import {
  printBillDuplicate,
  generateBillReceiptHtml,
} from "@/lib/printing/thermal-printer";
import { ThermalReceiptModal } from "@/components/printing/ThermalReceiptModal";

export default function SellPage() {
  const store = globalRestaurantStore;
  const [, setTick] = useState(0);

  const [searchQuery, setSearchQuery] = useState("");
  const [methodFilter, setMethodFilter] = useState<"ALL" | "CASH" | "UPI">("ALL");
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Thermal Preview Modal state
  const [previewBill, setPreviewBill] = useState<Bill | null>(null);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setTick((t) => t + 1);
    }, 1500);
    return () => clearInterval(interval);
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const summary = store.getOwnerSummary();
  const today = new Date().toISOString().split("T")[0];

  const paidBills = store.bills.filter(
    (b) => b.status === "PAID" || b.status === "FINALIZED"
  );

  const activeParties = store.parties.filter(
    (p) => p.status !== "CLOSED" && p.status !== "CANCELLED"
  );

  // Estimate total unbilled amount on active tables
  const activeTablesSubtotal = activeParties.reduce((sum, party) => {
    const partyOrders = store.orders.filter(
      (o) => o.partyId === party.id && o.status !== "CANCELLED"
    );
    const partyItems = partyOrders.flatMap((o) => o.items);
    return sum + partyItems.reduce((acc, item) => acc + item.totalPrice, 0);
  }, 0);

  const filteredBills = paidBills.filter((b) => {
    const matchesQuery =
      b.billNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (b.customerName && b.customerName.toLowerCase().includes(searchQuery.toLowerCase())) ||
      `Table ${b.tableNumber}`.toLowerCase().includes(searchQuery.toLowerCase());

    const method = b.payments[0]?.paymentMethod || "CASH";
    const matchesMethod =
      methodFilter === "ALL" ||
      (methodFilter === "CASH" && method === "CASH") ||
      (methodFilter === "UPI" && method === "UPI");

    return matchesQuery && matchesMethod;
  });

  const handlePrintReprint = (bill: Bill) => {
    printBillDuplicate(bill, store.printerSettings?.paperWidth || "80mm");
    showToast(`Bill #${bill.billNumber} duplicate printed!`);
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-4 right-4 z-50 bg-stone-900 text-amber-300 border border-amber-500/40 px-4 py-3 rounded-xl shadow-xl flex items-center gap-2 text-sm font-semibold animate-bounce">
          <Sparkles className="w-4 h-4 text-amber-400" />
          {toastMessage}
        </div>
      )}

      {/* Header Banner */}
      <div className="luxury-card rounded-2xl p-5 sm:p-6 border border-[#E7E2DA] flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-white via-[#FAF8F5] to-white">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-600 to-emerald-700 text-white flex items-center justify-center shadow-md shadow-emerald-600/20 border border-emerald-500/30 shrink-0">
            <TrendingUp className="w-6 h-6 text-emerald-100" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black text-stone-900 tracking-tight">
                विक्री व काउंटर हिशोब (Sell & Sales Hub)
              </h1>
              <span className="bg-emerald-50 text-emerald-900 text-[10px] font-black px-2.5 py-0.5 rounded-full border border-emerald-200 uppercase tracking-wider">
                Core Operations
              </span>
            </div>
            <p className="text-xs text-stone-500 font-medium mt-0.5">
              Live today sales feed, cash drawer balance, soundbox bank credit, duplicate bill reprints, and day-end audit.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Link
            href="/billing"
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl shadow-sm transition-all active:scale-95 touch-manipulation"
          >
            <Receipt className="w-4 h-4" />
            <span>बिलिंग काउंटर (Billing Desk) →</span>
          </Link>

          <Link
            href="/daily-closing"
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 bg-stone-900 hover:bg-black text-white text-xs font-bold rounded-xl shadow-sm transition-all"
          >
            <Lock className="w-3.5 h-3.5 text-amber-400" />
            <span>Z-क्लोजिंग (Z-Report)</span>
          </Link>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        {/* Gross Sales */}
        <div className="p-4 sm:p-5 rounded-2xl bg-white border border-[#E7E2DA] border-l-4 border-l-emerald-600 shadow-2xs space-y-2">
          <div className="flex items-center justify-between text-stone-500 text-xs font-bold">
            <span>आजची एकूण विक्री</span>
            <span className="bg-emerald-50 text-emerald-800 text-[10px] px-2 py-0.5 rounded-full font-bold">
              Gross Sales
            </span>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-stone-900 font-mono tracking-tight">
            ₹{summary.todaysSales.toLocaleString("en-IN")}
          </div>
          <div className="text-[11px] text-stone-500 flex items-center justify-between pt-1 border-t border-stone-100 font-medium">
            <span>{paidBills.length} बिले पूर्ण</span>
            <span className="text-emerald-700 font-bold">100% संकलित</span>
          </div>
        </div>

        {/* Cash in Drawer */}
        <div className="p-4 sm:p-5 rounded-2xl bg-white border border-[#E7E2DA] border-l-4 border-l-amber-600 shadow-2xs space-y-2 bg-amber-50/20">
          <div className="flex items-center justify-between text-amber-800 text-xs font-bold">
            <span className="flex items-center gap-1.5">
              <Banknote className="w-3.5 h-3.5 text-amber-700" />
              गल्ल्यात रोख (Cash)
            </span>
            <span className="bg-amber-100 text-amber-900 text-[10px] px-2 py-0.5 rounded-full font-bold">
              Drawer
            </span>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-amber-950 font-mono tracking-tight">
            ₹{summary.cashInDrawer.toLocaleString("en-IN")}
          </div>
          <div className="text-[11px] text-stone-500 flex items-center justify-between pt-1 border-t border-stone-100 font-medium">
            <span>विक्री: ₹{summary.cashSales}</span>
            <span className="text-amber-800 font-bold">Float समाविष्ट</span>
          </div>
        </div>

        {/* UPI in Bank */}
        <div className="p-4 sm:p-5 rounded-2xl bg-white border border-[#E7E2DA] border-l-4 border-l-blue-600 shadow-2xs space-y-2 bg-blue-50/20">
          <div className="flex items-center justify-between text-blue-800 text-xs font-bold">
            <span className="flex items-center gap-1.5">
              <QrCode className="w-3.5 h-3.5 text-blue-700" />
              बँक जमा (UPI)
            </span>
            <span className="bg-blue-100 text-blue-900 text-[10px] px-2 py-0.5 rounded-full font-bold">
              Soundbox
            </span>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-blue-950 font-mono tracking-tight">
            ₹{summary.upiInBank.toLocaleString("en-IN")}
          </div>
          <div className="text-[11px] text-stone-500 flex items-center justify-between pt-1 border-t border-stone-100 font-medium">
            <span>QR साउंडबॉक्स जमा</span>
            <span className="text-blue-700 font-bold">HDFC Bank</span>
          </div>
        </div>

        {/* Active Tables Subtotal */}
        <div className="p-4 sm:p-5 rounded-2xl bg-white border border-[#E7E2DA] border-l-4 border-l-purple-600 shadow-2xs space-y-2">
          <div className="flex items-center justify-between text-stone-500 text-xs font-bold">
            <span className="flex items-center gap-1.5">
              <Utensils className="w-3.5 h-3.5 text-purple-700" />
              चालू टेबल्सचे बिल
            </span>
            <span className="bg-purple-50 text-purple-800 text-[10px] px-2 py-0.5 rounded-full font-bold">
              Active Dining
            </span>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-purple-950 font-mono tracking-tight">
            ₹{activeTablesSubtotal.toLocaleString("en-IN")}
          </div>
          <div className="text-[11px] text-stone-500 flex items-center justify-between pt-1 border-t border-stone-100 font-medium">
            <span>{activeParties.length} टेबल्स चालू</span>
            <Link href="/waiter" className="text-purple-700 font-bold hover:underline">
              पहा (View) →
            </Link>
          </div>
        </div>
      </div>

      {/* Thali & Volume Counters */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-[#E7E2DA] shadow-2xs">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-600" />
            <h2 className="text-xs sm:text-sm font-black text-stone-900 uppercase tracking-wide">
              आजची थाळी व खाद्यपदार्थ विक्री (Thali Volume Metrics)
            </h2>
          </div>
          <span className="text-xs text-stone-500 font-semibold">एकूण थाळ्या: {summary.thalisSold}</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 bg-red-50/60 rounded-xl border border-red-200/80 flex items-center justify-between">
            <div>
              <div className="text-[11px] font-bold text-red-900">चिकन थाळी (Chicken)</div>
              <div className="text-xl font-black text-red-950 mt-0.5">{summary.chickenThalisSold}</div>
            </div>
            <span className="text-2xl">🍗</span>
          </div>

          <div className="p-3 bg-amber-50/60 rounded-xl border border-amber-200/80 flex items-center justify-between">
            <div>
              <div className="text-[11px] font-bold text-amber-900">मटण थाळी (Mutton)</div>
              <div className="text-xl font-black text-amber-950 mt-0.5">{summary.muttonThalisSold}</div>
            </div>
            <span className="text-2xl">🐐</span>
          </div>

          <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 flex items-center justify-between">
            <div>
              <div className="text-[11px] font-bold text-stone-800">चपाती / भाकरी</div>
              <div className="text-xl font-black text-stone-900 mt-0.5">
                {summary.thalisSold * 3} <span className="text-xs font-normal text-stone-500">pc</span>
              </div>
            </div>
            <span className="text-2xl">🫓</span>
          </div>

          <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-200/80 flex items-center justify-between">
            <div>
              <div className="text-[11px] font-bold text-blue-900">इंद्रायणी भात व रस्सा</div>
              <div className="text-xl font-black text-blue-950 mt-0.5">
                {summary.thalisSold} <span className="text-xs font-normal text-stone-500">servings</span>
              </div>
            </div>
            <span className="text-2xl">🍲</span>
          </div>
        </div>
      </div>

      {/* Settled Bills Table & Search */}
      <div className="bg-white rounded-2xl border border-[#E7E2DA] shadow-2xs overflow-hidden">
        {/* Table Filters */}
        <div className="p-4 sm:p-5 border-b border-stone-100 flex flex-col sm:flex-row items-center justify-between gap-3 bg-[#FAF8F5]">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Receipt className="w-4 h-4 text-stone-700" />
            <h3 className="font-black text-stone-900 text-sm">
              आजची बिले व पावती इतिहास ({filteredBills.length})
            </h3>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            {/* Search Input */}
            <div className="relative flex-1 sm:w-60">
              <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="बिल क्र. किंवा टेबल शोधा..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-stone-200 text-xs focus:ring-2 focus:ring-emerald-600 focus:outline-none bg-white"
              />
            </div>

            {/* Payment Method Filter */}
            <div className="flex items-center bg-white rounded-xl border border-stone-200 p-0.5 text-xs font-bold">
              <button
                onClick={() => setMethodFilter("ALL")}
                className={`px-2.5 py-1 rounded-lg transition-colors ${
                  methodFilter === "ALL" ? "bg-stone-900 text-white" : "text-stone-600 hover:text-stone-900"
                }`}
              >
                सर्व (All)
              </button>
              <button
                onClick={() => setMethodFilter("CASH")}
                className={`px-2.5 py-1 rounded-lg transition-colors ${
                  methodFilter === "CASH" ? "bg-amber-600 text-white" : "text-stone-600 hover:text-stone-900"
                }`}
              >
                कॅश (Cash)
              </button>
              <button
                onClick={() => setMethodFilter("UPI")}
                className={`px-2.5 py-1 rounded-lg transition-colors ${
                  methodFilter === "UPI" ? "bg-blue-600 text-white" : "text-stone-600 hover:text-stone-900"
                }`}
              >
                UPI QR
              </button>
            </div>
          </div>
        </div>

        {/* Bills Table */}
        <div className="overflow-x-auto">
          {filteredBills.length === 0 ? (
            <div className="p-8 text-center text-stone-400">
              <FileText className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-xs font-semibold">कोणतेही बिल सापडले नाही</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-stone-200 bg-stone-50/70 text-stone-600 font-extrabold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-4">बिल क्रमांक</th>
                  <th className="py-3 px-3">टेबल क्र.</th>
                  <th className="py-3 px-3">आयटम्स</th>
                  <th className="py-3 px-3">रक्कम (Total)</th>
                  <th className="py-3 px-3">पेमेंट पद्धत</th>
                  <th className="py-3 px-3">वेळ (Time)</th>
                  <th className="py-3 px-4 text-right">कृती (Actions)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {filteredBills.map((bill) => (
                  <tr key={bill.id} className="hover:bg-amber-50/30 transition-colors">
                    <td className="py-3 px-4 font-mono font-black text-stone-900">
                      #{bill.billNumber}
                    </td>
                    <td className="py-3 px-3 font-bold text-stone-800">
                      टेबल {bill.tableNumber}
                    </td>
                    <td className="py-3 px-3 text-stone-600">
                      {bill.items.length} आयटम्स
                    </td>
                    <td className="py-3 px-3 font-mono font-black text-stone-900">
                      ₹{bill.grandTotal.toLocaleString("en-IN")}
                    </td>
                    <td className="py-3 px-3">
                      {(() => {
                        const method = bill.payments[0]?.paymentMethod || "CASH";
                        return (
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black ${
                              method === "CASH"
                                ? "bg-amber-100 text-amber-900 border border-amber-300"
                                : method === "UPI"
                                ? "bg-blue-100 text-blue-900 border border-blue-300"
                                : "bg-purple-100 text-purple-900 border border-purple-300"
                            }`}
                          >
                            {method === "CASH" ? (
                              <Banknote className="w-3 h-3" />
                            ) : (
                              <QrCode className="w-3 h-3" />
                            )}
                            {method}
                          </span>
                        );
                      })()}
                    </td>
                    <td className="py-3 px-3 text-stone-500 font-mono text-[11px]">
                      {new Date(bill.createdAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="py-3 px-4 text-right space-x-1.5">
                      <button
                        onClick={() => {
                          setPreviewBill(bill);
                          setIsPreviewModalOpen(true);
                        }}
                        className="p-1.5 rounded-lg border border-stone-200 hover:bg-stone-100 text-stone-600 hover:text-stone-900 transition-colors"
                        title="पावती पहा (View Receipt)"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => handlePrintReprint(bill)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] shadow-2xs transition-colors"
                        title="थर्मल प्रिंटरवर डुप्लिकेट प्रिंट करा"
                      >
                        <Printer className="w-3 h-3" />
                        <span>रीप्रिंट (Reprint)</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Thermal Receipt Preview Modal */}
      {previewBill && (
        <ThermalReceiptModal
          isOpen={isPreviewModalOpen}
          onClose={() => setIsPreviewModalOpen(false)}
          title={`Bill #${previewBill.billNumber} Receipt`}
          generateHtml={(width) => generateBillReceiptHtml(previewBill, true, width)}
          defaultPaperWidth={store.printerSettings?.paperWidth || "80mm"}
        />
      )}
    </div>
  );
}
