"use client";

import React, { useState, useEffect } from "react";
import {
  Receipt,
  CreditCard,
  QrCode,
  Banknote,
  CheckCircle2,
  Printer,
  Sparkles,
  History,
  Lock,
  ShieldAlert,
  XCircle,
  X,
  RotateCcw,
  FileText,
  Calendar,
  Sliders,
  Users,
  CheckCheck,
} from "lucide-react";
import { globalRestaurantStore } from "@/lib/store/restaurant-store";
import { Bill, PaymentMethodType, DayEndReport } from "@/types/billing";
import { DiningParty } from "@/types/tables";
import {
  printBillReceipt,
  printBillDuplicate,
  printTableCheck,
  printDayEndReport,
  printTestTicket,
  triggerCashDrawerKick,
  generateBillReceiptHtml,
  generateTableCheckHtml,
} from "@/lib/printing/thermal-printer";
import { ThermalReceiptModal } from "@/components/printing/ThermalReceiptModal";
import { PrinterSettingsModal } from "@/components/printing/PrinterSettingsModal";

export default function CashierBillingPage() {
  const store = globalRestaurantStore;
  const [, setTick] = useState(0);

  const [billingTab, setBillingTab] = useState<"ACTIVE" | "SETTLED">("ACTIVE");
  const [selectedPartyId, setSelectedPartyId] = useState<string>("");
  const [activeBill, setActiveBill] = useState<Bill | null>(null);
  const [discountPercent, setDiscountPercent] = useState<number>(0);

  // Item View Mode (Unified vs By Seat)
  const [itemViewTab, setItemViewTab] = useState<"ALL" | "BY_SEAT">("ALL");

  // Mobile navigation view (Table list vs Bill receipt)
  const [mobileView, setMobileView] = useState<"LIST" | "BILL">("LIST");

  // Day-End Z-Report Modal
  const [isZReportModalOpen, setIsZReportModalOpen] = useState<boolean>(false);
  const [dayEndReportData, setDayEndReportData] = useState<DayEndReport | null>(null);

  // Printer Hardware Settings Modal
  const [isPrinterSettingsOpen, setIsPrinterSettingsOpen] = useState<boolean>(false);
  const [printerPaperWidth, setPrinterPaperWidth] = useState<"80mm" | "58mm">(
    store.printerSettings?.paperWidth || "80mm"
  );
  const [autoPrintKot, setAutoPrintKot] = useState<boolean>(
    store.printerSettings?.autoPrintKotOnOrder ?? true
  );
  const [autoPrintReceipt, setAutoPrintReceipt] = useState<boolean>(
    store.printerSettings?.autoPrintReceiptOnPayment ?? true
  );
  const [autoKickDrawer, setAutoKickDrawer] = useState<boolean>(
    store.printerSettings?.autoKickCashDrawerOnCash ?? true
  );

  // Payment Modal state
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState<boolean>(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodType>("UPI");
  const [tenderAmount, setTenderAmount] = useState<number>(0);
  const [utrReference, setUtrReference] = useState<string>("");

  // Thermal Print Receipt Modal
  const [isPrintModalOpen, setIsPrintModalOpen] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Manager Discount PIN state (>10%)
  const [discountPinModal, setDiscountPinModal] = useState<{ open: boolean; targetPct: number }>({
    open: false,
    targetPct: 0,
  });
  const [discountPin, setDiscountPin] = useState<string>("");
  const [discountPinError, setDiscountPinError] = useState<string | null>(null);

  // Void Bill state
  const [voidBillModal, setVoidBillModal] = useState<{ open: boolean; billId: string }>({
    open: false,
    billId: "",
  });
  const [voidReason, setVoidReason] = useState<string>("Customer item dispute / accidental bill entry");

  useEffect(() => {
    const interval = setInterval(() => {
      setTick((t) => t + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const activeParties = store.parties.filter(
    (p) => p.status !== "CLOSED" && p.status !== "CANCELLED"
  );

  const settledBills = store.bills.filter(
    (b) => b.status === "PAID" || b.status === "FINALIZED"
  );

  /**
   * Selects a party and retrieves (or generates) a bill.
   */
  const handleSelectParty = (partyId: string) => {
    setSelectedPartyId(partyId);

    const existingBill = store.bills.find(
      (b) => b.partyId === partyId && b.status !== "PAID" && b.status !== "CANCELLED"
    );

    if (existingBill) {
      setActiveBill(existingBill);
      setTenderAmount(existingBill.balanceDue);
    } else {
      const bill = store.generateBillForParty(partyId, discountPercent);
      setActiveBill(bill);
      setTenderAmount(bill.balanceDue);
    }
    setMobileView("BILL");
  };

  const handleApplyDiscount = (pct: number) => {
    if (pct > 10) {
      const isManager = store.currentUser.role === "OWNER" || store.currentUser.role === "MANAGER";
      if (!isManager) {
        setDiscountPinModal({ open: true, targetPct: pct });
        setDiscountPin("");
        setDiscountPinError(null);
        return;
      }
    }
    applyDiscountAuthorized(pct);
  };

  const applyDiscountAuthorized = (pct: number, managerAuthorized = false) => {
    setDiscountPercent(pct);
    if (selectedPartyId) {
      store.bills = store.bills.filter(
        (b) => !(b.partyId === selectedPartyId && b.status !== "PAID" && b.status !== "CANCELLED")
      );
      const bill = store.generateBillForParty(selectedPartyId, pct);
      setActiveBill(bill);
      setTenderAmount(bill.balanceDue);
      if (pct > 10) {
        store.recordAuditLog(
          "HIGH_DISCOUNT_APPLIED",
          "BILL",
          bill.id,
          `${pct}% discount authorized${managerAuthorized ? " via Manager PIN" : " by Manager"}`
        );
      }
    }
  };

  const handleDiscountPinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const requiredPin = store.settings?.billing?.managerPin || "1234";
    if (discountPin !== requiredPin) {
      setDiscountPinError(`Invalid Manager PIN! Enter authorized manager PIN.`);
      return;
    }
    setDiscountPinModal({ open: false, targetPct: 0 });
    applyDiscountAuthorized(discountPinModal.targetPct, true);
    showToast(`${discountPinModal.targetPct}% discount authorized by Manager!`);
  };

  const handleVoidBillSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!voidBillModal.billId) return;
    try {
      const cancelled = store.cancelBill(voidBillModal.billId, voidReason);
      setTick((t) => t + 1);
      setVoidBillModal({ open: false, billId: "" });
      if (activeBill?.id === cancelled.id) {
        setActiveBill(null);
        setSelectedPartyId("");
      }
      showToast(`Bill #${cancelled.billNumber} voided and party reopened!`);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleRecordPaymentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeBill) return;

    try {
      const paymentAmount = Math.min(tenderAmount, activeBill.balanceDue);
      if (paymentAmount <= 0) {
        alert("Payment amount must be greater than 0");
        return;
      }
      const changeReturn =
        paymentMethod === "CASH" && tenderAmount > activeBill.balanceDue
          ? tenderAmount - activeBill.balanceDue
          : 0;

      const result = store.payBill(
        activeBill.id,
        paymentMethod,
        paymentAmount,
        utrReference || undefined
      );

      setActiveBill(result.bill);
      setIsPaymentModalOpen(false);
      setTick((t) => t + 1);

      if (result.isFullyPaid) {
        showToast(
          changeReturn > 0
            ? `Bill ${result.bill.billNumber} PAID IN FULL! Return change: ₹${changeReturn}`
            : `Bill ${result.bill.billNumber} PAID IN FULL! Table status updated.`
        );
        // Auto-print receipt on full payment
        printBillReceipt(result.bill);
        if (paymentMethod === "CASH" && (store.printerSettings?.autoKickCashDrawerOnCash ?? true)) {
          triggerCashDrawerKick();
        }
        setIsPrintModalOpen(true);

        // Notify floor staff that table is now settled and available
        store.addNotification({
          type: "BILL_PAID",
          title: `Table ${result.bill.tableNumber} Bill Settled (₹${result.bill.grandTotal})`,
          message: `Bill #${result.bill.billNumber} paid in full. Table ${result.bill.tableNumber} is ready for next guests.`,
          category: "BILLING",
          urgency: "MEDIUM",
          targetRoles: ["WAITER", "MANAGER", "ADMIN"],
          actionUrl: "/waiter",
          actionLabel: "View Floor",
          metadata: { tableNumber: result.bill.tableNumber, amount: result.bill.grandTotal },
        });
      } else {
        showToast(`Partial payment of ₹${paymentAmount} recorded. Remaining: ₹${result.bill.balanceDue}`);
        setTenderAmount(result.bill.balanceDue);
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed bottom-4 right-4 z-50 bg-stone-900 text-amber-300 border border-amber-500/40 px-4 py-3 rounded-xl shadow-xl flex items-center gap-2 text-sm font-semibold animate-bounce">
          <Sparkles className="w-4 h-4 text-amber-400" />
          {toastMessage}
        </div>
      )}

      {/* Luxury Hero Header */}
      <div className="luxury-card rounded-2xl p-5 sm:p-6 border border-[#E7E2DA] flex items-center justify-between bg-gradient-to-r from-white via-[#FAF8F5] to-white">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-600 to-emerald-700 text-white flex items-center justify-center shadow-md shadow-emerald-600/20 border border-emerald-500/30 shrink-0">
            <Receipt className="w-6 h-6 text-amber-100" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black text-stone-900 tracking-tight">
                Cashier Billing & Settlement
              </h1>
              <span className="bg-emerald-50 text-emerald-900 text-[10px] font-black px-2.5 py-0.5 rounded-full border border-emerald-200 uppercase tracking-wider">
                GST Point-of-Sale
              </span>
            </div>
            <p className="text-xs text-stone-500 font-medium mt-0.5">
              Select an active party below to compute itemized GST, apply discounts, or record multi-tender payments.
            </p>
          </div>
        </div>

        {/* Operational Toolbar: Z-Report, Printers & Cash Drawer */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              triggerCashDrawerKick();
              showToast("Cash drawer kick pulse sent");
            }}
            className="flex items-center gap-1.5 bg-stone-100 hover:bg-stone-200 text-stone-800 font-bold text-xs px-3 py-2.5 rounded-xl transition-all border border-stone-300 shadow-2xs"
            title="Trigger ESC/POS Cash Drawer Kick pulse"
          >
            <Banknote className="w-4 h-4 text-emerald-600" />
            <span className="hidden sm:inline">Kick Drawer</span>
          </button>
          <button
            onClick={() => {
              const report = store.generateDayEndReport();
              setDayEndReportData(report);
              setIsZReportModalOpen(true);
            }}
            className="flex items-center gap-1.5 bg-stone-900 hover:bg-black text-amber-300 font-bold text-xs px-3.5 py-2.5 rounded-xl transition-all shadow-sm"
            title="Generate and print daily sales & tax closure slip (Z-Report)"
          >
            <Calendar className="w-4 h-4 text-amber-400" />
            <span>Day-End Z-Report</span>
          </button>
          <button
            onClick={() => setIsPrinterSettingsOpen(true)}
            className="flex items-center gap-1.5 bg-white hover:bg-stone-100 text-stone-700 font-bold text-xs px-3 py-2.5 rounded-xl transition-all border border-stone-300 shadow-2xs"
            title="Thermal printer paper width and station routing configuration"
          >
            <Sliders className="w-4 h-4 text-stone-600" />
            <span className="hidden sm:inline">Printers</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Active Dining Parties vs Settled Bills List */}
        <div className={`lg:col-span-4 space-y-3 ${mobileView === "BILL" && activeBill ? "hidden lg:block" : "block"}`}>
          {/* Tab Switcher */}
          <div className="flex items-center gap-1 bg-[#FAF8F5] p-1 rounded-xl border border-[#E7E2DA] text-xs font-bold">
            <button
              onClick={() => setBillingTab("ACTIVE")}
              className={`flex-1 py-1.5 rounded-lg transition-all text-center ${
                billingTab === "ACTIVE"
                  ? "bg-red-600 text-white shadow-2xs font-black"
                  : "text-stone-600 hover:text-stone-900"
              }`}
            >
              Active ({activeParties.length})
            </button>
            <button
              onClick={() => setBillingTab("SETTLED")}
              className={`flex-1 py-1.5 rounded-lg transition-all text-center flex items-center justify-center gap-1 ${
                billingTab === "SETTLED"
                  ? "bg-stone-900 text-amber-200 shadow-2xs font-black"
                  : "text-stone-600 hover:text-stone-900"
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>Settled ({settledBills.length})</span>
            </button>
          </div>

          <div className="space-y-2">
            {billingTab === "ACTIVE" ? (
              activeParties.length === 0 ? (
                <div className="bg-white p-6 text-center rounded-xl border border-[#E7E2DA] text-stone-400 text-xs">
                  No active seated parties right now.
                </div>
              ) : (
                activeParties.map((party) => {
                  const isSelected = selectedPartyId === party.id;
                  const isBillRequested = party.status === "WAITING_FOR_BILL";

                  return (
                    <div
                      key={party.id}
                      onClick={() => handleSelectParty(party.id)}
                      className={`p-4 rounded-xl border cursor-pointer transition-all ${
                        isSelected
                          ? "bg-gradient-to-r from-red-50/95 via-amber-50/40 to-white border-red-500 ring-2 ring-red-400/30 shadow-xs"
                          : isBillRequested
                          ? "bg-amber-50/80 border-amber-300 hover:bg-amber-100/60 shadow-2xs"
                          : "bg-white border-[#E7E2DA] hover:border-stone-300 hover:bg-[#FAF8F5] shadow-2xs"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-black text-xs bg-stone-900 text-amber-200 px-2 py-0.5 rounded-md shadow-2xs">
                            {party.partyCode}
                          </span>
                          <span className="font-black text-sm text-stone-900">
                            Table {party.tableNumber}
                          </span>
                        </div>
                        <span className="font-black text-sm text-emerald-800">
                          ₹{party.runningSubtotal}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-xs text-stone-500 mt-2 font-medium">
                        <span>
                          {party.guestCount} Guests • Waiter: {party.assignedWaiterName}
                        </span>
                        {isBillRequested && (
                          <span className="font-black text-amber-800 text-[10px] bg-amber-100 px-2 py-0.5 rounded-full border border-amber-200 animate-pulse">
                            Bill Requested!
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )
            ) : settledBills.length === 0 ? (
              <div className="bg-white p-6 text-center rounded-xl border border-[#E7E2DA] text-stone-400 text-xs">
                No settled bills recorded yet today.
              </div>
            ) : (
              settledBills.map((b) => {
                const isSelected = activeBill?.id === b.id;
                return (
                  <div
                    key={b.id}
                    onClick={() => {
                      setActiveBill(b);
                      setSelectedPartyId("");
                      setMobileView("BILL");
                    }}
                    className={`p-4 rounded-xl border cursor-pointer transition-all ${
                      isSelected
                        ? "bg-stone-900 text-white border-stone-800 shadow-xs"
                        : "bg-white border-[#E7E2DA] hover:border-stone-300 hover:bg-[#FAF8F5] shadow-2xs text-stone-900"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className={`font-black text-xs px-2 py-0.5 rounded-md ${
                            isSelected
                              ? "bg-amber-400 text-stone-950"
                              : "bg-emerald-100 text-emerald-900 border border-emerald-300"
                          }`}
                        >
                          {b.billNumber}
                        </span>
                        <span className="font-black text-sm">Table {b.tableNumber}</span>
                      </div>
                      <span
                        className={`font-black text-sm ${
                          isSelected ? "text-amber-300" : "text-emerald-700"
                        }`}
                      >
                        ₹{b.grandTotal}
                      </span>
                    </div>

                    <div
                      className={`flex items-center justify-between text-xs mt-2 font-medium ${
                        isSelected ? "text-stone-300" : "text-stone-500"
                      }`}
                    >
                      <span>
                        Paid ₹{b.paidAmount} • {b.partyCode}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            printBillDuplicate(b);
                          }}
                          className={`flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded transition-all ${
                            isSelected
                              ? "bg-amber-400 text-stone-950 hover:bg-amber-300"
                              : "bg-stone-100 text-stone-600 hover:bg-stone-200 border border-stone-200"
                          }`}
                          title="Reprint receipt"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>Reprint</span>
                        </button>
                        <span className="text-[10px] bg-emerald-500/20 text-emerald-700 px-2 py-0.5 rounded font-bold">
                          PAID
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Live Bill Receipt Calculation */}
        <div className={`lg:col-span-8 ${mobileView === "LIST" && activeBill ? "hidden lg:block" : "block"}`}>
          {/* Mobile Back Button when viewing bill on small screens */}
          {activeBill && (
            <div className="lg:hidden flex items-center justify-between bg-stone-900 text-white p-3 rounded-2xl mb-3 shadow-xs">
              <button
                type="button"
                onClick={() => setMobileView("LIST")}
                className="flex items-center gap-1.5 text-xs font-bold text-amber-300 hover:text-white touch-manipulation active:scale-95"
              >
                <span>← Back to Table List</span>
              </button>
              <span className="text-xs font-black bg-stone-800 px-2 py-0.5 rounded text-amber-200">
                Table {activeBill.tableNumber} • {activeBill.partyCode}
              </span>
            </div>
          )}

          {!activeBill ? (
            <div className="bg-white p-12 text-center rounded-2xl border border-stone-200 text-stone-400">
              <Receipt className="w-12 h-12 mx-auto mb-2 opacity-30" />
              <h3 className="font-bold text-stone-700">No Party Selected</h3>
              <p className="text-xs text-stone-500 mt-1">
                Click on any dining party on the left to compute bill and settle payment.
              </p>
            </div>
          ) : (
            <div className="luxury-card rounded-2xl border border-[#E7E2DA] shadow-xs overflow-hidden space-y-4">
              {/* Receipt Header in Clean Light Theme */}
              <div className="p-4 bg-[#FAF8F5] border-b border-[#E7E2DA] flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 font-black text-base text-stone-900">
                    <span>{activeBill.billNumber}</span>
                    <span className="bg-red-600 text-white text-xs px-2 py-0.5 rounded font-black shadow-2xs">
                      {activeBill.partyCode} (Table {activeBill.tableNumber})
                    </span>
                  </div>
                  <span className="text-xs text-stone-500 font-medium">
                    Waiter: {activeBill.waiterName} • Cashier: {activeBill.cashierName}
                  </span>
                </div>

                <span
                  className={`text-xs font-black px-2.5 py-1 rounded-md uppercase tracking-wider ${
                    activeBill.status === "PAID"
                      ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                      : activeBill.status === "PARTIALLY_PAID"
                      ? "bg-amber-100 text-amber-800 border border-amber-300"
                      : "bg-blue-100 text-blue-800 border border-blue-300"
                  }`}
                >
                  {activeBill.status}
                </span>
              </div>

              {/* Items Breakdown Section */}
              <div className="p-4 space-y-4">
                {/* View Switcher Bar */}
                <div className="flex items-center justify-between border-b border-stone-200 pb-2">
                  <div className="flex items-center gap-1.5 bg-stone-100 p-1 rounded-xl text-xs">
                    <button
                      type="button"
                      onClick={() => setItemViewTab("ALL")}
                      className={`px-3 py-1 rounded-lg font-bold transition-all ${
                        itemViewTab === "ALL"
                          ? "bg-white text-stone-900 shadow-2xs"
                          : "text-stone-500 hover:text-stone-900"
                      }`}
                    >
                      All Items ({activeBill.items.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setItemViewTab("BY_SEAT")}
                      className={`px-3 py-1 rounded-lg font-bold transition-all flex items-center gap-1 ${
                        itemViewTab === "BY_SEAT"
                          ? "bg-white text-stone-900 shadow-2xs"
                          : "text-stone-500 hover:text-stone-900"
                      }`}
                    >
                      <Users className="w-3.5 h-3.5 text-stone-500" />
                      <span>By Seat Breakdown</span>
                    </button>
                  </div>

                  {activeBill.isTakeaway && (
                    <span className="text-[10px] font-black bg-amber-100 text-amber-900 border border-amber-300 px-2 py-0.5 rounded-md">
                      🥡 PARCEL (पार्सल)
                    </span>
                  )}
                </div>

                {itemViewTab === "ALL" ? (
                  <table className="w-full text-xs text-left">
                    <thead>
                      <tr className="border-b border-stone-200 text-stone-500 pb-2">
                        <th className="font-bold py-1.5">Item</th>
                        <th className="font-bold py-1.5 text-center">Qty</th>
                        <th className="font-bold py-1.5 text-right">Price</th>
                        <th className="font-bold py-1.5 text-right">Tax (5% GST)</th>
                        <th className="font-bold py-1.5 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {activeBill.items.map((it) => (
                        <tr key={it.id} className="py-2">
                          <td className="py-2 font-bold text-stone-900">
                            {it.menuItemName}
                            {it.seatNumber && (
                              <span className="text-[10px] text-stone-400 font-normal ml-1">
                                (Seat {it.seatNumber})
                              </span>
                            )}
                          </td>
                          <td className="py-2 text-center font-bold text-stone-700">{it.quantity}</td>
                          <td className="py-2 text-right text-stone-700">₹{it.unitPrice}</td>
                          <td className="py-2 text-right text-stone-500">₹{it.taxAmount}</td>
                          <td className="py-2 text-right font-black text-stone-900">₹{it.totalPrice}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="space-y-3">
                    {Object.entries(
                      activeBill.items.reduce((acc, it) => {
                        const key = it.seatNumber ? `Seat ${it.seatNumber}` : "Shared / Table Center";
                        if (!acc[key]) acc[key] = [];
                        acc[key].push(it);
                        return acc;
                      }, {} as Record<string, typeof activeBill.items>)
                    ).map(([seatName, seatItems]) => {
                      const seatSubtotal = seatItems.reduce((sum, i) => sum + i.totalPrice, 0);
                      const seatTax = seatItems.reduce((sum, i) => sum + i.taxAmount, 0);
                      const seatTotal = Math.round(seatSubtotal + seatTax);
                      return (
                        <div key={seatName} className="border border-stone-200 rounded-xl p-3 bg-[#FAF8F5]">
                          <div className="flex items-center justify-between pb-2 border-b border-stone-200 mb-2">
                            <span className="font-black text-stone-900 text-xs flex items-center gap-1.5">
                              <Users className="w-3.5 h-3.5 text-stone-600" />
                              {seatName}
                            </span>
                            <span className="font-bold text-xs text-stone-700">
                              Estimated Seat Total: <b className="text-stone-950 font-black">₹{seatTotal}</b>
                            </span>
                          </div>
                          <table className="w-full text-xs text-left">
                            <tbody className="divide-y divide-stone-100">
                              {seatItems.map((it) => (
                                <tr key={it.id} className="py-1">
                                  <td className="py-1 font-medium text-stone-900">{it.menuItemName}</td>
                                  <td className="py-1 text-center font-bold text-stone-600">{it.quantity}×</td>
                                  <td className="py-1 text-right text-stone-500">₹{it.unitPrice}</td>
                                  <td className="py-1 text-right font-bold text-stone-900">₹{it.totalPrice}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Discount Pills & Void Bill Action */}
                <div className="flex items-center justify-between pt-2 border-t border-stone-100 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-stone-700">Discounts:</span>
                    {[0, 5, 10, 15].map((pct) => (
                      <button
                        key={pct}
                        onClick={() => handleApplyDiscount(pct)}
                        className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                          discountPercent === pct
                            ? "bg-red-600 text-white shadow-xs"
                            : "bg-stone-100 text-stone-700 hover:bg-stone-200"
                        }`}
                      >
                        {pct === 0 ? "None" : pct > 10 ? `${pct}% (PIN)` : `${pct}% Off`}
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => setVoidBillModal({ open: true, billId: activeBill.id })}
                    className="text-rose-600 hover:text-rose-800 font-bold flex items-center gap-1 hover:bg-rose-50 px-2.5 py-1 rounded-lg transition-all text-xs border border-rose-200"
                    title="Void / Cancel this Bill"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    <span>Void Bill</span>
                  </button>
                </div>

                {/* Financial Totals */}
                <div className="bg-stone-50 p-4 rounded-xl border border-stone-200/80 space-y-1.5 text-xs">
                  <div className="flex justify-between text-stone-600">
                    <span>Subtotal:</span>
                    <span className="font-bold">₹{activeBill.subtotal}</span>
                  </div>
                  {activeBill.discountAmount > 0 && (
                    <div className="flex justify-between text-red-600">
                      <span>Discount ({discountPercent}%):</span>
                      <span className="font-bold">-₹{activeBill.discountAmount}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-stone-500">
                    <span>CGST (2.5%):</span>
                    <span>₹{activeBill.cgstAmount}</span>
                  </div>
                  <div className="flex justify-between text-stone-500">
                    <span>SGST (2.5%):</span>
                    <span>₹{activeBill.sgstAmount}</span>
                  </div>
                  {activeBill.roundOff !== 0 && (
                    <div className="flex justify-between text-stone-500">
                      <span>Round Off:</span>
                      <span>{activeBill.roundOff > 0 ? `+₹${activeBill.roundOff}` : `-₹${Math.abs(activeBill.roundOff)}`}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-base font-black text-stone-900 pt-2 border-t border-stone-200">
                    <span>Grand Total:</span>
                    <span className="text-emerald-700">₹{activeBill.grandTotal}</span>
                  </div>

                  {activeBill.paidAmount > 0 && (
                    <div className="flex justify-between text-xs font-bold text-emerald-700 pt-1">
                      <span>Paid so far:</span>
                      <span>₹{activeBill.paidAmount}</span>
                    </div>
                  )}

                  {activeBill.balanceDue > 0 && (
                    <div className="flex justify-between text-xs font-bold text-red-600">
                      <span>Balance Due:</span>
                      <span>₹{activeBill.balanceDue}</span>
                    </div>
                  )}
                </div>

                {/* Settlement Actions */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => printBillReceipt(activeBill, false, store.printerSettings?.paperWidth || "80mm")}
                      className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition-all shadow-sm active:scale-95 touch-manipulation"
                    >
                      <Printer className="w-4 h-4" />
                      <span>Print Receipt</span>
                    </button>
                    <button
                      onClick={() => setIsPrintModalOpen(true)}
                      className="flex items-center justify-center gap-1.5 bg-white border border-stone-300 hover:bg-stone-100 text-stone-700 font-bold text-xs px-3 py-2.5 rounded-xl transition-all touch-manipulation active:scale-95"
                    >
                      <Receipt className="w-3.5 h-3.5" />
                      <span>Preview</span>
                    </button>
                    {activeBill.balanceDue > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          const party = store.parties.find((p) => p.id === activeBill.partyId);
                          if (party) {
                            printTableCheck({
                              party,
                              items: activeBill.items.map((it) => ({
                                id: it.orderItemId,
                                orderId: activeBill.id,
                                partyId: activeBill.partyId,
                                menuItemId: it.menuItemId,
                                menuItemName: it.menuItemName,
                                quantity: it.quantity,
                                unitPrice: it.unitPrice,
                                totalPrice: it.totalPrice,
                                seatNumber: it.seatNumber,
                                kotStatus: "SERVED",
                                isCancelled: false,
                              })),
                              subtotal: activeBill.subtotal,
                              taxEstimate: activeBill.totalTaxAmount,
                              grandTotal: activeBill.grandTotal,
                              cashierName: activeBill.cashierName,
                              paperWidth: store.printerSettings?.paperWidth || "80mm",
                            });
                            showToast(`Table Check / Pre-Bill printed for Table ${activeBill.tableNumber}`);
                          }
                        }}
                        className="flex items-center justify-center gap-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 font-bold text-xs px-3 py-2.5 rounded-xl transition-all touch-manipulation active:scale-95"
                        title="Print interim table check / estimate for guest review"
                      >
                        <FileText className="w-3.5 h-3.5 text-amber-700" />
                        <span>Pre-Bill (कच्चा बिल)</span>
                      </button>
                    )}
                  </div>

                  {activeBill.balanceDue > 0 ? (
                    <button
                      onClick={() => setIsPaymentModalOpen(true)}
                      className="w-full sm:w-auto flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs px-6 py-3 rounded-xl shadow-md shadow-emerald-600/20 active:scale-95 transition-all touch-manipulation"
                    >
                      <CreditCard className="w-4 h-4" />
                      <span>COLLECT PAYMENT (₹{activeBill.balanceDue})</span>
                    </button>
                  ) : (
                    <span className="flex items-center justify-center gap-1.5 text-xs font-black text-emerald-700 bg-emerald-50 px-3 py-2 rounded-lg border border-emerald-200">
                      <CheckCircle2 className="w-4 h-4" /> BILL SETTLED IN FULL
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* MODAL: PAYMENT SETTLEMENT IN LIGHT THEME */}
      {isPaymentModalOpen && activeBill && (
        <div className="fixed inset-0 z-50 bg-stone-900/40 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-stone-200 overflow-hidden max-h-[92vh] flex flex-col animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-stone-50 border-b border-stone-200 text-stone-900 p-4 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2 font-bold text-base">
                <QrCode className="w-5 h-5 text-emerald-600" />
                <span>Collect Payment for {activeBill.partyCode}</span>
              </div>
              <button
                type="button"
                onClick={() => setIsPaymentModalOpen(false)}
                className="text-stone-400 hover:text-stone-700 p-1.5 rounded-lg touch-manipulation"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRecordPaymentSubmit} className="p-4 sm:p-5 space-y-4 flex-1 overflow-y-auto">
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  Payment Tender Method
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { code: "UPI", label: "UPI QR", icon: QrCode },
                    { code: "CASH", label: "Cash", icon: Banknote },
                    { code: "CARD", label: "Card", icon: CreditCard },
                  ].map((m) => {
                    const Icon = m.icon;
                    const isSel = paymentMethod === m.code;
                    return (
                      <button
                        type="button"
                        key={m.code}
                        onClick={() => setPaymentMethod(m.code as any)}
                        className={`p-3 rounded-xl border flex flex-col items-center gap-1 font-bold text-xs transition-all touch-manipulation active:scale-95 ${
                          isSel
                            ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                            : "bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100"
                        }`}
                      >
                        <Icon className="w-5 h-5" />
                        <span>{m.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* UPI Dynamic QR Preview Simulation */}
              {paymentMethod === "UPI" && (
                <div className="bg-amber-50 border border-amber-200 p-3.5 rounded-xl text-center space-y-2">
                  <div className="w-32 h-32 bg-white border border-stone-300 mx-auto rounded-lg flex items-center justify-center shadow-inner">
                    <QrCode className="w-24 h-24 text-stone-800" />
                  </div>
                  <p className="text-[11px] font-bold text-stone-800">
                    Scan with PhonePe / GPay / Paytm
                  </p>
                  <p className="text-[10px] text-stone-500">
                    UPI ID: <strong>kolhapurikhanawal@okhdfcbank</strong> • Amount: <strong>₹{tenderAmount}</strong>
                  </p>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  Tender Amount (₹)
                </label>
                <input
                  type="number"
                  inputMode="decimal"
                  step="1"
                  value={tenderAmount}
                  onChange={(e) => setTenderAmount(Number(e.target.value))}
                  className="w-full bg-stone-50 border border-stone-300 rounded-xl px-3 py-2.5 text-base font-black text-stone-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                />
                <span className="text-[10px] text-stone-400 mt-1 block font-medium">
                  You can enter a partial amount to split payment between tenders, or a larger cash note.
                </span>

                {paymentMethod === "CASH" && tenderAmount > activeBill.balanceDue && (
                  <div className="mt-2 bg-emerald-50 border border-emerald-200 rounded-xl p-2.5 flex items-center justify-between text-xs font-bold text-emerald-800">
                    <span>Change to Return:</span>
                    <span className="text-sm font-black text-emerald-700">₹{tenderAmount - activeBill.balanceDue}</span>
                  </div>
                )}

                {paymentMethod === "CASH" && (
                  <div className="flex items-center gap-1.5 mt-2 overflow-x-auto pb-1 text-xs">
                    <span className="text-stone-400 font-bold text-[10px] uppercase shrink-0">Quick:</span>
                    <button
                      type="button"
                      onClick={() => setTenderAmount(activeBill.balanceDue)}
                      className="px-2.5 py-1.5 min-h-[34px] bg-stone-100 hover:bg-stone-200 text-stone-800 rounded-lg font-bold text-xs touch-manipulation active:scale-95 shrink-0"
                    >
                      Exact (₹{activeBill.balanceDue})
                    </button>
                    {[100, 200, 500, 1000, 2000]
                      .filter((n) => n >= activeBill.balanceDue)
                      .slice(0, 3)
                      .map((amt) => (
                        <button
                          type="button"
                          key={amt}
                          onClick={() => setTenderAmount(amt)}
                          className="px-2.5 py-1.5 min-h-[34px] bg-stone-100 hover:bg-stone-200 text-stone-800 rounded-lg font-bold text-xs touch-manipulation active:scale-95 shrink-0"
                        >
                          ₹{amt}
                        </button>
                      ))}
                  </div>
                )}
              </div>

              {paymentMethod !== "CASH" && (
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    Transaction / UTR Reference (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. UTR-408912389"
                    value={utrReference}
                    onChange={(e) => setUtrReference(e.target.value)}
                    className="w-full bg-stone-50 border border-stone-300 rounded-xl px-3 py-2 text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              )}

              <div className="pt-3 border-t border-stone-200 flex items-center justify-end gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsPaymentModalOpen(false)}
                  className="px-4 py-2.5 text-xs font-bold text-stone-600 hover:bg-stone-100 rounded-xl touch-manipulation"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-3 text-xs sm:text-sm font-black bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-xs active:scale-95 touch-manipulation"
                >
                  Confirm Payment of ₹{tenderAmount}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: THERMAL RECEIPT PREVIEW (80MM / 58MM) */}
      {isPrintModalOpen && activeBill && (
        <ThermalReceiptModal
          isOpen={isPrintModalOpen}
          onClose={() => setIsPrintModalOpen(false)}
          title={`Tax Invoice — ${activeBill.billNumber}`}
          generateHtml={(width) => generateBillReceiptHtml(activeBill, false, width)}
          defaultPaperWidth={printerPaperWidth}
        />
      )}

      {/* MODAL: MANAGER PIN FOR HIGH DISCOUNT (>10%) */}
      {discountPinModal.open && (
        <div className="fixed inset-0 z-50 bg-stone-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl border border-stone-200 overflow-hidden text-xs animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-amber-50 border-b border-amber-200 p-4 text-amber-950 flex items-center justify-between font-black text-sm">
              <div className="flex items-center gap-2">
                <Lock className="w-5 h-5 text-amber-600" />
                <span>Manager Authorization Required</span>
              </div>
              <button
                onClick={() => setDiscountPinModal({ open: false, targetPct: 0 })}
                className="text-stone-400 hover:text-stone-700 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleDiscountPinSubmit} className="p-5 space-y-4">
              <p className="text-stone-600 leading-relaxed text-xs">
                Applying discounts higher than 10% ({discountPinModal.targetPct}%) requires Manager or Owner PIN authorization.
              </p>

              {discountPinError && (
                <div className="p-2.5 bg-red-50 border border-red-300 text-red-700 font-bold rounded-xl text-xs">
                  {discountPinError}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  Manager PIN *
                </label>
                <input
                  type="password"
                  required
                  placeholder="Enter 4-digit PIN (default: 1234)"
                  value={discountPin}
                  onChange={(e) => setDiscountPin(e.target.value)}
                  className="w-full bg-stone-50 border border-stone-300 rounded-xl px-3 py-2.5 text-base font-black text-center tracking-widest text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setDiscountPinModal({ open: false, targetPct: 0 })}
                  className="px-4 py-2 text-xs font-bold text-stone-600 hover:bg-stone-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white rounded-xl shadow-xs active:scale-95"
                >
                  Authorize {discountPinModal.targetPct}% Off
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: VOID / CANCEL BILL */}
      {voidBillModal.open && (
        <div className="fixed inset-0 z-50 bg-stone-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl border border-stone-200 overflow-hidden text-xs animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-rose-50 border-b border-rose-200 p-4 text-rose-950 flex items-center justify-between font-black text-sm">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-rose-600" />
                <span>Void / Cancel Bill</span>
              </div>
              <button
                onClick={() => setVoidBillModal({ open: false, billId: "" })}
                className="text-stone-400 hover:text-stone-700 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleVoidBillSubmit} className="p-5 space-y-4">
              <p className="text-stone-600 leading-relaxed text-xs">
                Voiding this bill marks it cancelled and reopens the party so orders can be adjusted. An immutable audit record will be created.
              </p>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  Reason for Bill Void *
                </label>
                <input
                  type="text"
                  required
                  value={voidReason}
                  onChange={(e) => setVoidReason(e.target.value)}
                  className="w-full bg-stone-50 border border-stone-300 rounded-xl px-3 py-2 text-xs text-stone-900 font-semibold focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setVoidBillModal({ open: false, billId: "" })}
                  className="px-4 py-2 text-xs font-bold text-stone-600 hover:bg-stone-100 rounded-xl"
                >
                  Keep Bill
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow-xs active:scale-95"
                >
                  Confirm Void
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: DAY-END Z-REPORT (दिवसाचा हिशोब) */}
      {isZReportModalOpen && dayEndReportData && (
        <div className="fixed inset-0 z-50 bg-stone-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-stone-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="bg-stone-900 text-white p-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-400 text-stone-950 flex items-center justify-center font-bold">
                  <Calendar className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-black text-sm text-amber-200">Day-End Z-Report (दिवसाचा हिशोब)</h3>
                  <p className="text-[11px] text-stone-400">Date: {dayEndReportData.date} • {dayEndReportData.shiftName}</p>
                </div>
              </div>
              <button
                onClick={() => setIsZReportModalOpen(false)}
                className="text-stone-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 space-y-4 overflow-y-auto text-xs">
              {/* Metrics Summary */}
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-stone-50 border border-stone-200 p-2.5 rounded-xl">
                  <div className="text-[10px] text-stone-500 font-bold uppercase">Total Bills</div>
                  <div className="text-base font-black text-stone-900">{dayEndReportData.totalBills}</div>
                </div>
                <div className="bg-emerald-50 border border-emerald-200 p-2.5 rounded-xl">
                  <div className="text-[10px] text-emerald-700 font-bold uppercase">Settled Paid</div>
                  <div className="text-base font-black text-emerald-700">{dayEndReportData.settledBillsCount}</div>
                </div>
                <div className="bg-rose-50 border border-rose-200 p-2.5 rounded-xl">
                  <div className="text-[10px] text-rose-700 font-bold uppercase">Cancelled/Void</div>
                  <div className="text-base font-black text-rose-700">{dayEndReportData.cancelledBillsCount}</div>
                </div>
              </div>

              {/* Financial Breakdown Table */}
              <div className="border border-stone-200 rounded-xl overflow-hidden">
                <div className="bg-stone-50 px-3 py-2 font-bold text-stone-700 border-b border-stone-200 flex justify-between">
                  <span>Financial Statement</span>
                  <span>Amount</span>
                </div>
                <div className="p-3 space-y-1.5 text-xs divide-y divide-stone-100">
                  <div className="flex justify-between py-0.5">
                    <span className="text-stone-600">Gross Sales Subtotal:</span>
                    <span className="font-bold text-stone-900">₹{dayEndReportData.grossSalesSubtotal.toFixed(2)}</span>
                  </div>
                  {dayEndReportData.totalDiscountAmount > 0 && (
                    <div className="flex justify-between py-0.5 text-red-600">
                      <span>Total Discounts:</span>
                      <span className="font-bold">-₹{dayEndReportData.totalDiscountAmount.toFixed(2)}</span>
                    </div>
                  )}
                  {dayEndReportData.totalPackagingCharges > 0 && (
                    <div className="flex justify-between py-0.5 text-stone-600">
                      <span>Packaging / Parcel Charges:</span>
                      <span className="font-bold text-stone-900">₹{dayEndReportData.totalPackagingCharges.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between py-0.5">
                    <span className="text-stone-600">Net Taxable Turnover:</span>
                    <span className="font-bold text-stone-900">₹{dayEndReportData.netTaxableSales.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between py-0.5 text-stone-500">
                    <span>CGST (2.5%):</span>
                    <span>₹{dayEndReportData.cgstAmount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between py-0.5 text-stone-500">
                    <span>SGST (2.5%):</span>
                    <span>₹{dayEndReportData.sgstAmount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between py-1 border-t-2 border-stone-800 text-sm font-black text-stone-900">
                    <span>NET REVENUE</span>
                    <span className="text-emerald-700">₹{dayEndReportData.netRevenue.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* Payment Tender Collection */}
              <div className="border border-stone-200 rounded-xl p-3 bg-[#FAF8F5] space-y-2">
                <div className="font-bold text-stone-800 text-xs border-b border-stone-200 pb-1">
                  Payment Tender Collections
                </div>
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="bg-white p-2 rounded-lg border border-stone-200">
                    <span className="text-[10px] text-stone-500 font-bold block">CASH</span>
                    <span className="font-black text-stone-900">₹{dayEndReportData.tenders.cash.toFixed(2)}</span>
                  </div>
                  <div className="bg-white p-2 rounded-lg border border-stone-200">
                    <span className="text-[10px] text-stone-500 font-bold block">UPI / QR</span>
                    <span className="font-black text-stone-900">₹{dayEndReportData.tenders.upi.toFixed(2)}</span>
                  </div>
                  <div className="bg-white p-2 rounded-lg border border-stone-200">
                    <span className="text-[10px] text-stone-500 font-bold block">CARD</span>
                    <span className="font-black text-stone-900">₹{dayEndReportData.tenders.card.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* Top Selling Dishes */}
              {dayEndReportData.topSellingDishes.length > 0 && (
                <div className="border border-stone-200 rounded-xl overflow-hidden">
                  <div className="bg-stone-50 px-3 py-1.5 font-bold text-stone-700 border-b border-stone-200 text-xs">
                    Top Selling Kolhapuri Dishes
                  </div>
                  <div className="p-2 divide-y divide-stone-100 text-xs">
                    {dayEndReportData.topSellingDishes.map((d: any, idx: number) => (
                      <div key={d.menuItemId} className="flex justify-between py-1">
                        <span className="font-medium text-stone-900">
                          {idx + 1}. {d.name}
                        </span>
                        <span className="text-stone-600 font-bold">
                          {d.quantity} portions • ₹{d.revenue}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Footer Actions */}
            <div className="p-3.5 bg-stone-50 border-t border-stone-200 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setIsZReportModalOpen(false)}
                className="px-4 py-2 bg-white border border-stone-300 hover:bg-stone-100 rounded-xl text-xs font-bold text-stone-700"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  printDayEndReport(dayEndReportData, store.printerSettings?.paperWidth || "80mm");
                  showToast("Sending Day-End Z-Report to thermal printer...");
                }}
                className="flex items-center gap-1.5 bg-gradient-to-r from-stone-900 to-black text-amber-300 font-bold text-xs px-5 py-2.5 rounded-xl shadow-sm hover:from-black hover:to-stone-900 active:scale-95 transition-all"
              >
                <Printer className="w-4 h-4 text-amber-400" />
                <span>Print 80mm Z-Report</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: PRINTER HARDWARE SETTINGS */}
      <PrinterSettingsModal
        isOpen={isPrinterSettingsOpen}
        onClose={() => setIsPrinterSettingsOpen(false)}
      />

    </div>
  );
}
