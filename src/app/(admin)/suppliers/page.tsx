"use client";

import React, { useState } from "react";
import {
  Truck,
  Plus,
  IndianRupee,
  Phone,
  FileText,
  CheckCircle2,
  AlertTriangle,
  ArrowDownRight,
  Receipt,
  Scale,
} from "lucide-react";
import { globalRestaurantStore } from "@/lib/store/restaurant-store";

export default function SuppliersPage() {
  const store = globalRestaurantStore;
  const [, setTick] = useState(0);

  // Modals state
  const [showAdvanceModal, setShowAdvanceModal] = useState(false);
  const [showSettleModal, setShowSettleModal] = useState(false);
  const [selectedSupplierId, setSelectedSupplierId] = useState(store.suppliers[0]?.id || "");

  // Advance form
  const [advanceAmount, setAdvanceAmount] = useState<number>(2000);
  const [advanceMethod, setAdvanceMethod] = useState<"CASH" | "UPI">("CASH");
  const [advanceNotes, setAdvanceNotes] = useState("");

  // Invoice settlement form
  const [invoiceAmount, setInvoiceAmount] = useState<number>(2100);
  const [settleMethod, setSettleMethod] = useState<"CASH" | "UPI">("CASH");
  const [settleNotes, setSettleNotes] = useState("");
  const [settlementResult, setSettlementResult] = useState<{
    netPaid: number;
    adjustedFromAdvance: number;
  } | null>(null);

  const selectedSupplier = store.suppliers.find((s) => s.id === selectedSupplierId);

  const handleRecordAdvance = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSupplier) return;

    store.recordSupplierAdvance({
      supplierId: selectedSupplier.id,
      supplierName: selectedSupplier.name,
      amount: advanceAmount,
      date: new Date().toISOString().split("T")[0],
      paymentMethod: advanceMethod,
      notes: advanceNotes,
    });

    setShowAdvanceModal(false);
    setAdvanceNotes("");
    setTick((t) => t + 1);
  };

  const handleSettleInvoice = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSupplier) return;

    const res = store.settleSupplierInvoice(
      selectedSupplier.id,
      invoiceAmount,
      settleMethod,
      settleNotes
    );

    setSettlementResult({
      netPaid: res.netPaid,
      adjustedFromAdvance: res.adjustedFromAdvance,
    });
    setTick((t) => t + 1);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 sm:p-6 rounded-2xl border border-[#E7E2DA] shadow-xs">
        <div>
          <div className="flex items-center gap-2 text-red-700 text-xs font-black uppercase tracking-wider">
            <Truck className="w-4 h-4" />
            <span>पुरवठादार व ॲडव्हान्स हिशोब • Suppliers & Advances</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-stone-900 mt-1">
            Suppliers Ledger & Advance Settlement
          </h1>
          <p className="text-xs sm:text-sm text-stone-500 font-medium">
            Strict accounting separation: Supplier advances are tracked in advance buckets and adjusted against future invoices with zero double-counting.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowAdvanceModal(true)}
            className="inline-flex items-center gap-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 font-bold px-4 py-2.5 rounded-xl text-xs sm:text-sm active:scale-95 transition-all"
          >
            <ArrowDownRight className="w-4 h-4 text-amber-700" />
            <span>+ ॲडव्हान्स द्या (Pay Advance)</span>
          </button>

          <button
            onClick={() => {
              setSettlementResult(null);
              setShowSettleModal(true);
            }}
            className="inline-flex items-center gap-1.5 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white font-bold px-4 py-2.5 rounded-xl text-xs sm:text-sm shadow-md shadow-red-700/20 active:scale-95 transition-all"
          >
            <Scale className="w-4 h-4" />
            <span>बिल जमा करा (Settle Invoice)</span>
          </button>
        </div>
      </div>

      {/* Advance Separation Visual Alert Box */}
      <div className="bg-gradient-to-r from-amber-50 via-white to-amber-50 p-4 sm:p-5 rounded-2xl border border-amber-200/80 shadow-xs flex items-start gap-3">
        <Scale className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
        <div className="text-xs sm:text-sm text-stone-700 space-y-1">
          <p className="font-bold text-amber-950">
            Accounting Invariant Rule: Advances are NEVER double-counted as purchase expenses!
          </p>
          <p className="text-stone-600 font-medium">
            Example: Mahesh Bhakri Kendra Advance of ₹2,000 on 05/09 is logged as an Advance Outflow. When the ₹2,100 invoice arrives on 07/09, the ₹2,000 advance is deducted and only the ₹100 net difference is drawn from the cash drawer.
          </p>
        </div>
      </div>

      {/* Supplier Directory Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {store.suppliers.map((supplier) => (
          <div
            key={supplier.id}
            className="bg-white rounded-2xl border border-[#E7E2DA] p-5 shadow-xs space-y-4 hover:border-amber-400/60 transition-colors"
          >
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-black text-stone-900 text-base">{supplier.name}</h3>
                <div className="flex items-center gap-1.5 text-xs text-stone-500 font-medium mt-0.5">
                  <Phone className="w-3.5 h-3.5 text-stone-400" />
                  <span>{supplier.phone}</span>
                </div>
              </div>
              <span className="text-[11px] font-bold px-2 py-0.5 bg-stone-100 text-stone-700 rounded-full border border-stone-200">
                Active
              </span>
            </div>

            <div className="text-xs text-stone-600 bg-stone-50 p-2.5 rounded-xl border border-stone-100">
              <span className="font-bold text-stone-700">Supplies: </span>
              {supplier.suppliedItems.join(", ")}
            </div>

            <div className="grid grid-cols-3 gap-2 text-center pt-1 border-t border-stone-100">
              <div className="p-2 rounded-xl bg-stone-50">
                <div className="text-[10px] uppercase font-bold text-stone-400">Total Goods</div>
                <div className="text-sm font-black text-stone-900 mt-0.5">
                  ₹{supplier.totalPurchased.toLocaleString("en-IN")}
                </div>
              </div>

              <div className="p-2 rounded-xl bg-stone-50">
                <div className="text-[10px] uppercase font-bold text-stone-400">Total Paid</div>
                <div className="text-sm font-black text-emerald-700 mt-0.5">
                  ₹{supplier.totalPaid.toLocaleString("en-IN")}
                </div>
              </div>

              <div
                className={`p-2 rounded-xl ${
                  supplier.currentAdvance > 0
                    ? "bg-amber-50 text-amber-900 border border-amber-200"
                    : "bg-stone-50 text-stone-700"
                }`}
              >
                <div className="text-[10px] uppercase font-bold text-stone-500">Live Advance</div>
                <div className="text-sm font-black mt-0.5">
                  ₹{supplier.currentAdvance.toLocaleString("en-IN")}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={() => {
                  setSelectedSupplierId(supplier.id);
                  setShowAdvanceModal(true);
                }}
                className="flex-1 text-xs font-bold py-2 bg-stone-50 hover:bg-amber-50 text-stone-700 hover:text-amber-900 rounded-xl border border-stone-200 transition-colors"
              >
                + Pay Advance
              </button>
              <button
                onClick={() => {
                  setSelectedSupplierId(supplier.id);
                  setSettlementResult(null);
                  setShowSettleModal(true);
                }}
                className="flex-1 text-xs font-bold py-2 bg-red-50 hover:bg-red-100 text-red-800 rounded-xl border border-red-200 transition-colors"
              >
                Settle Bill
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Advance Records History & Invoice Settlements */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Supplier Advances Table */}
        <div className="bg-white rounded-2xl border border-[#E7E2DA] overflow-hidden shadow-xs">
          <div className="p-4 bg-[#FAF8F5] border-b border-[#E7E2DA] flex items-center justify-between">
            <h3 className="text-sm font-black text-stone-900">Supplier Advance Records (ॲडव्हान्स नोंद)</h3>
            <span className="text-xs font-bold text-stone-500">{store.supplierAdvances.length} Records</span>
          </div>

          <div className="p-4 divide-y divide-stone-100">
            {store.supplierAdvances.map((adv) => (
              <div key={adv.id} className="py-3 flex items-center justify-between gap-4">
                <div>
                  <div className="font-bold text-sm text-stone-900">{adv.supplierName}</div>
                  <div className="text-xs text-stone-500 font-medium mt-0.5">
                    Date: {adv.date} • {adv.notes || "Advance payment"}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-black text-base text-amber-900 font-mono">
                    ₹{adv.amount.toLocaleString("en-IN")}
                  </div>
                  <span className="inline-flex text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                    {adv.remainingAdvance === 0 ? "Fully Adjusted" : `₹${adv.remainingAdvance} Pending`}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Invoice Settlements Table */}
        <div className="bg-white rounded-2xl border border-[#E7E2DA] overflow-hidden shadow-xs">
          <div className="p-4 bg-[#FAF8F5] border-b border-[#E7E2DA] flex items-center justify-between">
            <h3 className="text-sm font-black text-stone-900">Recent Invoice Settlements (देयक हिशोब)</h3>
            <span className="text-xs font-bold text-stone-500">{store.supplierPayments.length} Settlements</span>
          </div>

          <div className="p-4 divide-y divide-stone-100">
            {store.supplierPayments.map((pay) => (
              <div key={pay.id} className="py-3 flex items-center justify-between gap-4">
                <div>
                  <div className="font-bold text-sm text-stone-900">{pay.supplierName}</div>
                  <div className="text-xs text-stone-500 font-medium mt-0.5">
                    {pay.date} • {pay.notes}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-black text-base text-stone-900 font-mono">
                    Net: ₹{pay.amount.toLocaleString("en-IN")}
                  </div>
                  <span className="text-[10px] font-bold text-stone-500 uppercase">{pay.paymentMethod}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Pay Advance Modal */}
      {showAdvanceModal && (
        <div className="fixed inset-0 z-50 bg-stone-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full border border-[#E7E2DA] shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-[#E7E2DA] pb-3">
              <div>
                <h3 className="text-base font-black text-stone-900">Pay Supplier Advance</h3>
                <p className="text-xs text-stone-500 font-medium">Recorded as advance outflow, NOT a food expense</p>
              </div>
              <button
                onClick={() => setShowAdvanceModal(false)}
                className="w-8 h-8 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-500 font-bold flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleRecordAdvance} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-stone-700">Supplier</label>
                <select
                  value={selectedSupplierId}
                  onChange={(e) => setSelectedSupplierId(e.target.value)}
                  className="w-full mt-1 p-2.5 text-sm rounded-xl border border-stone-200 bg-white font-bold"
                  required
                >
                  {store.suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} (Current Adv: ₹{s.currentAdvance})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-stone-700">Advance Amount (₹)</label>
                <input
                  type="number"
                  min="100"
                  step="100"
                  value={advanceAmount}
                  onChange={(e) => setAdvanceAmount(parseFloat(e.target.value) || 0)}
                  className="w-full mt-1 p-2.5 text-sm rounded-xl border border-stone-200 bg-white font-black font-mono text-base"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-bold text-stone-700">Payment Outflow Source</label>
                <select
                  value={advanceMethod}
                  onChange={(e) => setAdvanceMethod(e.target.value as "CASH" | "UPI")}
                  className="w-full mt-1 p-2.5 text-sm rounded-xl border border-stone-200 bg-white font-bold"
                >
                  <option value="CASH">CASH (Physical Drawer Float)</option>
                  <option value="UPI">UPI (Business Bank Account)</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-stone-700">Notes / Purpose</label>
                <input
                  type="text"
                  placeholder="e.g. 4 days Jowar Bhakri advance"
                  value={advanceNotes}
                  onChange={(e) => setAdvanceNotes(e.target.value)}
                  className="w-full mt-1 p-2.5 text-sm rounded-xl border border-stone-200 bg-white font-medium"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowAdvanceModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-stone-200 text-stone-600 font-bold text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-md shadow-amber-700/20 active:scale-95"
                >
                  Record Advance Outflow
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Settle Invoice Modal */}
      {showSettleModal && selectedSupplier && (
        <div className="fixed inset-0 z-50 bg-stone-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full border border-[#E7E2DA] shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-[#E7E2DA] pb-3">
              <div>
                <h3 className="text-base font-black text-stone-900">Settle Supplier Invoice</h3>
                <p className="text-xs text-stone-500 font-medium">Consumes active advance first; pays only net difference</p>
              </div>
              <button
                onClick={() => setShowSettleModal(false)}
                className="w-8 h-8 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-500 font-bold flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            {settlementResult ? (
              <div className="space-y-4 py-3">
                <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200 text-center space-y-2">
                  <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
                  <h4 className="text-sm font-black text-emerald-950">Invoice Settled Successfully!</h4>
                  <div className="text-xs text-emerald-800 space-y-1 font-medium">
                    <p>Total Invoice: ₹{invoiceAmount}</p>
                    <p className="font-bold text-amber-900">
                      - Adjusted from Advance: ₹{settlementResult.adjustedFromAdvance}
                    </p>
                    <p className="text-base font-black text-stone-900 mt-2 font-mono">
                      Net Cash/UPI Paid: ₹{settlementResult.netPaid}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setShowSettleModal(false)}
                  className="w-full py-3 bg-stone-900 text-white font-bold text-sm rounded-xl"
                >
                  Done
                </button>
              </div>
            ) : (
              <form onSubmit={handleSettleInvoice} className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-stone-700">Supplier</label>
                  <select
                    value={selectedSupplierId}
                    onChange={(e) => setSelectedSupplierId(e.target.value)}
                    className="w-full mt-1 p-2.5 text-sm rounded-xl border border-stone-200 bg-white font-bold"
                  >
                    {store.suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} (Live Advance: ₹{s.currentAdvance})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-stone-700">Invoice Amount Presented (₹)</label>
                  <input
                    type="number"
                    min="1"
                    value={invoiceAmount}
                    onChange={(e) => setInvoiceAmount(parseFloat(e.target.value) || 0)}
                    className="w-full mt-1 p-2.5 text-sm rounded-xl border border-stone-200 bg-white font-black font-mono text-base"
                    required
                  />
                </div>

                {/* Calculation breakdown */}
                <div className="p-3.5 bg-stone-50 rounded-xl border border-stone-200 space-y-1.5 text-xs">
                  <div className="flex justify-between text-stone-600 font-medium">
                    <span>Available Advance:</span>
                    <span className="font-bold text-amber-700">₹{selectedSupplier.currentAdvance}</span>
                  </div>
                  <div className="flex justify-between text-stone-600 font-medium">
                    <span>Advance to be consumed:</span>
                    <span className="font-bold text-stone-800">
                      ₹{Math.min(selectedSupplier.currentAdvance, invoiceAmount)}
                    </span>
                  </div>
                  <div className="flex justify-between text-stone-900 font-black border-t border-stone-200 pt-1.5 text-sm font-mono">
                    <span>Net Amount to Pay:</span>
                    <span className="text-red-700">
                      ₹{Math.max(0, invoiceAmount - selectedSupplier.currentAdvance)}
                    </span>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-stone-700">Payment Mode for Net Amount</label>
                  <select
                    value={settleMethod}
                    onChange={(e) => setSettleMethod(e.target.value as "CASH" | "UPI")}
                    className="w-full mt-1 p-2.5 text-sm rounded-xl border border-stone-200 bg-white font-bold"
                  >
                    <option value="CASH">CASH (गल्ला रोख)</option>
                    <option value="UPI">UPI (बँक ट्रान्सफर)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-stone-700">Notes / Invoice No</label>
                  <input
                    type="text"
                    placeholder="e.g. 150 chapatis weekly bill"
                    value={settleNotes}
                    onChange={(e) => setSettleNotes(e.target.value)}
                    className="w-full mt-1 p-2.5 text-sm rounded-xl border border-stone-200 bg-white font-medium"
                  />
                </div>

                <div className="pt-2 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setShowSettleModal(false)}
                    className="px-4 py-2.5 rounded-xl border border-stone-200 text-stone-600 font-bold text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-md shadow-red-700/20 active:scale-95"
                  >
                    Settle & Pay Net ₹{Math.max(0, invoiceAmount - selectedSupplier.currentAdvance)}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
