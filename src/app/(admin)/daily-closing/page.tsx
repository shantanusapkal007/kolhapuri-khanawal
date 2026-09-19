"use client";

import React, { useState } from "react";
import {
  Lock,
  CheckSquare,
  Printer,
  FileSpreadsheet,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Coins,
  QrCode,
  Flame,
  Snowflake,
} from "lucide-react";
import { globalRestaurantStore } from "@/lib/store/restaurant-store";
import { printDayEndReport, generateDayEndReportHtml } from "@/lib/printing/thermal-printer";
import { ThermalReceiptModal } from "@/components/printing/ThermalReceiptModal";

export default function DailyClosingPage() {
  const store = globalRestaurantStore;
  const [, setTick] = useState(0);

  const today = new Date().toISOString().split("T")[0];
  const [actualCash, setActualCash] = useState<number>(store.cashLedger[0]?.balance || 5000);
  const [actualUpi, setActualUpi] = useState<number>(store.upiLedger[0]?.balance || 15000);
  const [notes, setNotes] = useState("");
  const [isClosed, setIsClosed] = useState(false);
  const [printModalOpen, setPrintModalOpen] = useState(false);

  // 10-Point Daily Operational Closing Checklist
  const [checklist, setChecklist] = useState<Record<string, boolean>>({
    c1: false, // All dining parties closed & settled
    c2: false, // Physical cash count matched with drawer
    c3: false, // All kitchen KOTs served & cleared
    c4: false, // Daily wastage & scrap recorded
    c5: false, // Commercial LPG main gas valves locked
    c6: false, // Deep freezers holding < -18°C & padlocked
    c7: false, // Exhaust blowers cleaned & degreased
    c8: false, // Meat & dairy refrigerated
    c9: false, // UPI Soundbox and POS terminal plugged into charger
    c10: false, // Main dining hall shutter locked
  });

  const checklistItems = [
    { id: "c1", title: "All dining parties closed & bills settled with cashier (सर्व ग्राहक बिल भरणा पूर्ण)", icon: CheckCircle2 },
    { id: "c2", title: "Physical cash count reconciled with drawer ledger (गल्ल्यातील रोख मोजली)", icon: Coins },
    { id: "c3", title: "All kitchen KOTs marked completed & served (स्वयंपाकघर ऑर्डर्स पूर्ण)", icon: CheckCircle2 },
    { id: "c4", title: "Daily wastage and prep variance recorded in stock ledger (शिल्लक/खराब अन्न नोंद)", icon: AlertTriangle },
    { id: "c5", title: "Commercial LPG gas cylinders shut off and master safety valves locked (गॅस व्हॉल्व बंद)", icon: Flame },
    { id: "c6", title: "Deep freezers temperature verified < -18°C & locked (डीप फ्रीजर तापमान व कुलूप)", icon: Snowflake },
    { id: "c7", title: "Kitchen grease traps cleaned and trash bins cleared (कचरा व स्वच्छता पूर्ण)", icon: CheckCircle2 },
    { id: "c8", title: "Remaining chicken, mutton & dairy safely stored in cold unit (उरलेले मटण/चिकन शीतकपाटात)", icon: Snowflake },
    { id: "c9", title: "UPI Soundbox, thermal printer & POS terminal put on charge (साऊंडबॉक्स चार्जिंग)", icon: QrCode },
    { id: "c10", title: "Day End Z-Report printed and main hall shutters secured (झेड-रिपोर्ट व कुलूप)", icon: Lock },
  ];

  const allChecked = Object.values(checklist).every(Boolean);

  const toggleItem = (id: string) => {
    setChecklist((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleCloseDay = () => {
    store.performDailyClosing({
      actualCash,
      actualUpi,
      checklistItems: checklist,
      notes,
    });
    setIsClosed(true);
    setTick((t) => t + 1);
  };

  const currentReport = store.generateDayEndReport(today);

  const handleDirectPrintZReport = () => {
    printDayEndReport(currentReport, "80mm");
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 sm:p-6 rounded-2xl border border-[#E7E2DA] shadow-xs">
        <div>
          <div className="flex items-center gap-2 text-red-700 text-xs font-black uppercase tracking-wider">
            <Lock className="w-4 h-4" />
            <span>दिवस सांगता व झेड-रिपोर्ट • Daily Closing & Z-Report</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-stone-900 mt-1">
            End-of-Day Closing & Z-Report
          </h1>
          <p className="text-xs sm:text-sm text-stone-500 font-medium">
            10-point mandatory security & reconciliation checklist. Creates immutable daily audit snapshot and prints thermal Z-Report.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleDirectPrintZReport}
            className="inline-flex items-center gap-2 bg-stone-100 hover:bg-stone-200 text-stone-800 font-bold px-4 py-2.5 rounded-xl text-xs sm:text-sm border border-stone-300 active:scale-95 transition-all"
          >
            <Printer className="w-4 h-4 text-stone-600" />
            <span>Print Z-Report (थर्मल पावती)</span>
          </button>

          <button
            onClick={() => setPrintModalOpen(true)}
            className="inline-flex items-center gap-2 bg-white hover:bg-[#FAF8F5] text-stone-800 font-bold px-4 py-2.5 rounded-xl text-xs sm:text-sm border border-[#E7E2DA] shadow-2xs active:scale-95 transition-all"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
            <span>Preview Z-Ticket</span>
          </button>
        </div>
      </div>

      {/* 10-Point Checklist Section */}
      <div className="bg-white rounded-3xl p-6 border border-[#E7E2DA] shadow-xs space-y-5">
        <div className="flex items-center justify-between border-b border-[#E7E2DA] pb-4">
          <div>
            <h2 className="text-base font-black text-stone-900">10-Point Mandatory Closing Checklist</h2>
            <p className="text-xs text-stone-500 font-medium">
              Every item must be inspected and confirmed by Manager / Head Cook before locking
            </p>
          </div>
          <button
            onClick={() => {
              const allTrue: Record<string, boolean> = {};
              checklistItems.forEach((it) => (allTrue[it.id] = true));
              setChecklist(allTrue);
            }}
            className="text-xs font-bold text-red-700 hover:text-red-900 underline"
          >
            Mark All Completed (सर्व पूर्ण)
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {checklistItems.map((item) => {
            const Icon = item.icon;
            const checked = checklist[item.id];
            return (
              <div
                key={item.id}
                onClick={() => toggleItem(item.id)}
                className={`p-3.5 rounded-2xl border flex items-start gap-3 cursor-pointer transition-all ${
                  checked
                    ? "bg-emerald-50/60 border-emerald-300 text-stone-900"
                    : "bg-white border-[#E7E2DA] text-stone-600 hover:border-amber-400"
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 mt-0.5 border ${
                    checked
                      ? "bg-emerald-600 border-emerald-600 text-white"
                      : "bg-white border-stone-300"
                  }`}
                >
                  {checked && <CheckSquare className="w-3.5 h-3.5" />}
                </div>
                <div className="text-xs font-bold leading-relaxed">{item.title}</div>
              </div>
            );
          })}
        </div>

        {/* Closing Reconciliation Form */}
        <div className="pt-4 border-t border-[#E7E2DA] grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="text-xs font-bold text-stone-700">Actual Counted Cash In Drawer (₹)</label>
            <input
              type="number"
              value={actualCash}
              onChange={(e) => setActualCash(parseFloat(e.target.value) || 0)}
              className="w-full mt-1 p-3 rounded-xl border border-stone-200 bg-white font-mono font-black text-base"
              required
            />
          </div>

          <div>
            <label className="text-xs font-bold text-stone-700">Actual Verified UPI Balance (₹)</label>
            <input
              type="number"
              value={actualUpi}
              onChange={(e) => setActualUpi(parseFloat(e.target.value) || 0)}
              className="w-full mt-1 p-3 rounded-xl border border-stone-200 bg-white font-mono font-black text-base"
              required
            />
          </div>

          <div>
            <label className="text-xs font-bold text-stone-700">Manager Shift Notes</label>
            <input
              type="text"
              placeholder="e.g. Clean kitchen handover, gas locked"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full mt-1 p-3 rounded-xl border border-stone-200 bg-white font-medium text-xs"
            />
          </div>
        </div>

        {/* 1-Click CLOSE DAY Button */}
        <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-4 bg-[#FAF8F5] p-4 rounded-2xl border border-[#E7E2DA]">
          <div className="text-xs text-stone-600 font-medium">
            Status:{" "}
            {allChecked ? (
              <span className="font-bold text-emerald-700">✓ All 10 checklist items confirmed</span>
            ) : (
              <span className="font-bold text-amber-700">⚠️ Please complete all 10 checklist items</span>
            )}
          </div>

          <button
            onClick={handleCloseDay}
            disabled={!allChecked}
            className={`w-full sm:w-auto px-5 sm:px-6 py-3.5 min-h-[44px] rounded-xl font-black text-xs sm:text-sm shadow-md transition-all flex items-center justify-center gap-2 touch-manipulation ${
              allChecked
                ? "bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white shadow-red-700/20 active:scale-95"
                : "bg-stone-200 text-stone-400 cursor-not-allowed"
            }`}
          >
            <Lock className="w-4 h-4 shrink-0" />
            <span className="sm:hidden">Close Day & Save Audit</span>
            <span className="hidden sm:inline">CLOSE DAY & SAVE AUDIT SNAPSHOT</span>
          </button>
        </div>

        {isClosed && (
          <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200 flex items-center justify-between animate-in fade-in">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <div className="text-xs sm:text-sm font-bold text-emerald-950">
                Day Closed Successfully! Daily Closing Snapshot saved in permanent ledger.
              </div>
            </div>
            <button
              onClick={handleDirectPrintZReport}
              className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-xl shadow-xs shrink-0"
            >
              Print Thermal Z-Ticket
            </button>
          </div>
        )}
      </div>

      {/* Past Daily Closings Archive */}
      <div className="bg-white rounded-2xl border border-[#E7E2DA] overflow-hidden shadow-xs">
        <div className="p-4 bg-[#FAF8F5] border-b border-[#E7E2DA] flex items-center justify-between">
          <h3 className="text-sm font-black text-stone-900">Past Daily Closings Archive (मागील हिशोब)</h3>
          <span className="text-xs font-bold text-stone-500">{store.dailyClosings.length} Saved Days</span>
        </div>

        {store.dailyClosings.length === 0 ? (
          <div className="p-6 text-center text-stone-400 text-xs">
            No past daily closings recorded yet.
          </div>
        ) : (
          <>
            {/* Mobile Closings Cards */}
            <div className="sm:hidden divide-y divide-stone-100 p-2 space-y-2">
              {store.dailyClosings.map((closing) => (
                <div key={closing.id} className="p-3.5 bg-[#FAF8F5] rounded-xl border border-stone-200/80 space-y-2 text-xs">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-mono font-bold text-stone-900 text-sm">{closing.date}</div>
                      <div className="text-[11px] text-stone-500 font-medium mt-0.5">
                        By {closing.closedBy} • {closing.totalThalisSold} Thalis ({closing.chickenThalisSold}C, {closing.muttonThalisSold}M)
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono font-black text-stone-900 text-base">
                        ₹{closing.totalSales.toLocaleString("en-IN")}
                      </div>
                      <span
                        className={`font-mono font-bold text-[10px] ${
                          closing.cashVariance === 0 ? "text-emerald-700" : "text-amber-700"
                        }`}
                      >
                        Var: {closing.cashVariance === 0 ? "₹0.00" : `₹${closing.cashVariance}`}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-1 border-t border-stone-200/60 text-[11px]">
                    <div>
                      <span className="text-stone-500">Cash:</span>{" "}
                      <strong className="text-emerald-700 font-mono font-bold">₹{closing.cashSales.toLocaleString("en-IN")}</strong>
                    </div>
                    <div>
                      <span className="text-stone-500">UPI:</span>{" "}
                      <strong className="text-blue-700 font-mono font-bold">₹{closing.upiSales.toLocaleString("en-IN")}</strong>
                    </div>
                  </div>

                  {closing.notes && (
                    <div className="text-[10px] text-stone-500 italic pt-0.5">
                      “{closing.notes}”
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Desktop Table */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead>
                  <tr className="border-b border-[#E7E2DA] bg-stone-50 text-stone-500 font-bold uppercase tracking-wider text-[11px]">
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Closed By</th>
                    <th className="py-3 px-4">Total Sales</th>
                    <th className="py-3 px-4">Thalis Sold</th>
                    <th className="py-3 px-4">Cash Sales</th>
                    <th className="py-3 px-4">UPI Sales</th>
                    <th className="py-3 px-4">Cash Variance</th>
                    <th className="py-3 px-4 text-right">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {store.dailyClosings.map((closing) => (
                    <tr key={closing.id} className="hover:bg-amber-50/30">
                      <td className="py-3 px-4 font-mono font-bold text-stone-900 whitespace-nowrap">
                        {closing.date}
                      </td>
                      <td className="py-3 px-4 font-medium text-stone-800 whitespace-nowrap">
                        {closing.closedBy}
                      </td>
                      <td className="py-3 px-4 font-mono font-black text-stone-900">
                        ₹{closing.totalSales.toLocaleString("en-IN")}
                      </td>
                      <td className="py-3 px-4 font-bold text-stone-800">
                        {closing.totalThalisSold} ({closing.chickenThalisSold} C, {closing.muttonThalisSold} M)
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-emerald-700">
                        ₹{closing.cashSales.toLocaleString("en-IN")}
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-blue-700">
                        ₹{closing.upiSales.toLocaleString("en-IN")}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`font-mono font-bold text-xs ${
                            closing.cashVariance === 0 ? "text-emerald-700" : "text-amber-700"
                          }`}
                        >
                          {closing.cashVariance === 0 ? "₹0.00" : `₹${closing.cashVariance}`}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right text-stone-500 font-medium text-[11px]">
                        {closing.notes || "Checklist confirmed"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Thermal Receipt Preview Modal */}
      {printModalOpen && (
        <ThermalReceiptModal
          isOpen={printModalOpen}
          title={`Z-Report ${today}`}
          generateHtml={(width) => generateDayEndReportHtml(currentReport, width)}
          onClose={() => setPrintModalOpen(false)}
          onDirectPrint={() => {
            printDayEndReport(currentReport, "80mm");
            setPrintModalOpen(false);
          }}
        />
      )}
    </div>
  );
}
