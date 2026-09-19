"use client";

import React, { useState } from "react";
import {
  Users,
  CheckCircle2,
  XCircle,
  Clock,
  IndianRupee,
  Calendar,
  Phone,
  Plus,
  ArrowDownRight,
  Calculator,
} from "lucide-react";
import { globalRestaurantStore } from "@/lib/store/restaurant-store";
import { AttendanceStatus } from "@/types/domain";

export default function StaffPage() {
  const store = globalRestaurantStore;
  const [, setTick] = useState(0);

  const today = new Date().toISOString().split("T")[0];

  // Advance modal state
  const [showAdvanceModal, setShowAdvanceModal] = useState(false);
  const [advanceEmployeeId, setAdvanceEmployeeId] = useState(store.employees[0]?.id || "");
  const [advanceAmount, setAdvanceAmount] = useState<number>(1000);
  const [advanceNotes, setAdvanceNotes] = useState("");

  // Salary calculator modal state
  const [showSalaryModal, setShowSalaryModal] = useState(false);
  const [selectedCalcEmployeeId, setSelectedCalcEmployeeId] = useState(store.employees[0]?.id || "");
  const [calcMonth, setCalcMonth] = useState("2026-09");

  const handleMarkAllPresent = () => {
    store.markAllStaffAttendance("PRESENT");
    setTick((t) => t + 1);
  };

  const handleToggleAttendance = (empId: string, currentStatus?: AttendanceStatus) => {
    const nextStatus: AttendanceStatus =
      currentStatus === "PRESENT" ? "HALF_DAY" : currentStatus === "HALF_DAY" ? "ABSENT" : "PRESENT";
    store.updateStaffAttendance(empId, nextStatus);
    setTick((t) => t + 1);
  };

  const handleRecordAdvance = (e: React.FormEvent) => {
    e.preventDefault();
    const emp = store.employees.find((e) => e.id === advanceEmployeeId);
    if (!emp) return;

    store.recordStaffAdvance({
      employeeId: emp.id,
      employeeName: emp.name,
      amount: advanceAmount,
      date: today,
      notes: advanceNotes,
    });

    setShowAdvanceModal(false);
    setAdvanceNotes("");
    setTick((t) => t + 1);
  };

  const salaryCalc = store.calculateStaffSalary(selectedCalcEmployeeId, calcMonth);

  const presentCount = store.employees.filter((emp) => {
    const att = store.attendance.find((a) => a.employeeId === emp.id && a.date === today);
    return att?.status === "PRESENT";
  }).length;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 sm:p-6 rounded-2xl border border-[#E7E2DA] shadow-xs">
        <div>
          <div className="flex items-center gap-2 text-red-700 text-xs font-black uppercase tracking-wider">
            <Users className="w-4 h-4" />
            <span>कर्मचारी हजेरी व पगार • Staff & Attendance</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-stone-900 mt-1">
            Staff Roster & Attendance
          </h1>
          <p className="text-xs sm:text-sm text-stone-500 font-medium">
            1-Click attendance for morning prep crew, cash drawer advance draws, and salary calculator with advance deductions.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleMarkAllPresent}
            className="inline-flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white font-black px-4 py-2.5 rounded-xl text-xs sm:text-sm shadow-md shadow-emerald-700/20 active:scale-95 transition-all"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>1-Click [Mark All Present]</span>
          </button>

          <button
            onClick={() => setShowAdvanceModal(true)}
            className="inline-flex items-center gap-2 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 font-bold px-4 py-2.5 rounded-xl text-xs sm:text-sm active:scale-95 transition-all"
          >
            <ArrowDownRight className="w-4 h-4 text-amber-700" />
            <span>+ पगार ॲडव्हान्स (Staff Advance)</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="luxury-card p-4 rounded-xl border border-[#E7E2DA]">
          <div className="text-xs font-bold text-stone-500">Staff Present Today</div>
          <div className="text-2xl font-black text-stone-900 mt-1">
            {presentCount} <span className="text-xs font-semibold text-stone-400">/ {store.employees.length}</span>
          </div>
          <div className="text-[11px] text-emerald-700 font-bold mt-0.5">Kitchen & Dining fully staffed</div>
        </div>

        <div className="luxury-card p-4 rounded-xl border border-[#E7E2DA]">
          <div className="text-xs font-bold text-stone-500">Cook Suresh Maharaj</div>
          <div className="text-2xl font-black text-stone-900 mt-1">₹28,000</div>
          <div className="text-[11px] text-amber-700 font-bold mt-0.5">₹1,500 Advance Pending</div>
        </div>

        <div className="luxury-card p-4 rounded-xl border border-[#E7E2DA]">
          <div className="text-xs font-bold text-stone-500">Bhakri Specialist Bandu</div>
          <div className="text-2xl font-black text-stone-900 mt-1">₹18,000</div>
          <div className="text-[11px] text-amber-700 font-bold mt-0.5">₹2,000 Advance Pending</div>
        </div>

        <div className="luxury-card p-4 rounded-xl border border-[#E7E2DA]">
          <div className="text-xs font-bold text-stone-500">Total Pending Advances</div>
          <div className="text-2xl font-black text-red-700 mt-1 font-mono">
            ₹{store.staffAdvances.reduce((sum, a) => sum + (a.amount - a.recoveredAmount), 0).toLocaleString("en-IN")}
          </div>
          <div className="text-[11px] text-stone-400 mt-0.5">Deducted at monthly closing</div>
        </div>
      </div>

      {/* Staff Roster Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {store.employees.map((emp) => {
          const att = store.attendance.find((a) => a.employeeId === emp.id && a.date === today);
          const pendingAdv = store.staffAdvances
            .filter((a) => a.employeeId === emp.id && a.status === "PENDING")
            .reduce((sum, a) => sum + (a.amount - a.recoveredAmount), 0);

          return (
            <div
              key={emp.id}
              className="bg-white rounded-2xl border border-[#E7E2DA] p-4 shadow-xs space-y-3 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-black text-stone-900 text-sm">{emp.name}</h3>
                    <div className="text-xs font-bold text-red-700">{emp.role}</div>
                  </div>
                  <button
                    onClick={() => handleToggleAttendance(emp.id, att?.status)}
                    className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase border transition-all ${
                      att?.status === "PRESENT"
                        ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                        : att?.status === "HALF_DAY"
                        ? "bg-amber-100 text-amber-800 border-amber-300"
                        : "bg-red-100 text-red-800 border-red-300"
                    }`}
                  >
                    {att?.status || "NOT MARKED"}
                  </button>
                </div>

                <div className="mt-3 space-y-1 text-xs text-stone-600 bg-stone-50 p-2.5 rounded-xl border border-stone-100">
                  <div className="flex justify-between">
                    <span className="text-stone-400 font-bold">Salary:</span>
                    <span className="font-mono font-bold text-stone-800">₹{emp.baseSalary.toLocaleString("en-IN")}/mo</span>
                  </div>
                  {pendingAdv > 0 && (
                    <div className="flex justify-between text-amber-900 font-bold">
                      <span>Advance:</span>
                      <span className="font-mono">₹{pendingAdv}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-[11px] text-stone-500 pt-0.5">
                    <span>Phone:</span>
                    <span>{emp.phone}</span>
                  </div>
                </div>
              </div>

              <div className="pt-2 flex items-center gap-2">
                <button
                  onClick={() => {
                    setSelectedCalcEmployeeId(emp.id);
                    setShowSalaryModal(true);
                  }}
                  className="flex-1 py-2 text-xs font-bold bg-stone-100 hover:bg-stone-200 text-stone-800 rounded-xl transition-colors flex items-center justify-center gap-1"
                >
                  <Calculator className="w-3.5 h-3.5 text-stone-600" />
                  <span>Salary Slip</span>
                </button>

                <button
                  onClick={() => {
                    setAdvanceEmployeeId(emp.id);
                    setShowAdvanceModal(true);
                  }}
                  className="py-2 px-3 text-xs font-bold bg-amber-50 hover:bg-amber-100 text-amber-900 rounded-xl border border-amber-200 transition-colors"
                  title="Give Advance"
                >
                  + Adv
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Staff Advance Records History */}
      <div className="bg-white rounded-2xl border border-[#E7E2DA] overflow-hidden shadow-xs">
        <div className="p-4 bg-[#FAF8F5] border-b border-[#E7E2DA] flex items-center justify-between">
          <h2 className="text-sm font-black text-stone-900">Recorded Staff Advances (कर्मचारी उचल)</h2>
          <span className="text-xs font-bold text-stone-500">{store.staffAdvances.length} Advance Entries</span>
        </div>

        {store.staffAdvances.length === 0 ? (
          <div className="p-6 text-center text-stone-400 text-xs">
            कोणतीही उचल नोंदवलेली नाही (No staff advances recorded)
          </div>
        ) : (
          <>
            {/* Mobile Advances Cards */}
            <div className="sm:hidden divide-y divide-stone-100 p-2 space-y-2">
              {store.staffAdvances.map((adv) => (
                <div key={adv.id} className="p-3 bg-[#FAF8F5] rounded-xl border border-stone-200/80 space-y-1.5 text-xs">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-bold text-stone-900 text-xs">{adv.employeeName}</div>
                      <div className="text-[10px] text-stone-400 font-mono mt-0.5">{adv.date}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono font-black text-amber-900 text-sm">
                        ₹{adv.amount.toLocaleString("en-IN")}
                      </div>
                      <span className="inline-flex items-center px-2 py-0.2 rounded-full text-[9px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                        {adv.status}
                      </span>
                    </div>
                  </div>

                  <div className="text-[11px] text-stone-500 pt-1 border-t border-stone-200/60 italic">
                    {adv.notes || "Staff advance draw"}
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Table */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead>
                  <tr className="border-b border-[#E7E2DA] bg-stone-50 text-stone-500 font-bold uppercase tracking-wider text-[11px]">
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Staff Name</th>
                    <th className="py-3 px-4">Advance Amount</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Reason / Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {store.staffAdvances.map((adv) => (
                    <tr key={adv.id} className="hover:bg-amber-50/30">
                      <td className="py-3.5 px-4 font-mono font-bold text-stone-700 whitespace-nowrap">
                        {adv.date}
                      </td>
                      <td className="py-3.5 px-4 font-bold text-stone-900 whitespace-nowrap">
                        {adv.employeeName}
                      </td>
                      <td className="py-3.5 px-4 font-mono font-black text-amber-900 text-base">
                        ₹{adv.amount.toLocaleString("en-IN")}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                          {adv.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right text-stone-500 font-medium text-[11px]">
                        {adv.notes || "Staff advance draw"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Give Advance Modal */}
      {showAdvanceModal && (
        <div className="fixed inset-0 z-50 bg-stone-900/40 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 max-w-sm w-full border border-[#E7E2DA] shadow-2xl space-y-4 animate-in fade-in zoom-in-95 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#E7E2DA] pb-3">
              <h3 className="text-base font-black text-stone-900">Record Staff Advance</h3>
              <button
                onClick={() => setShowAdvanceModal(false)}
                className="w-8 h-8 rounded-full bg-stone-100 font-bold text-stone-500"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleRecordAdvance} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-stone-700">Staff Member</label>
                <select
                  value={advanceEmployeeId}
                  onChange={(e) => setAdvanceEmployeeId(e.target.value)}
                  className="w-full mt-1 p-2.5 text-sm rounded-xl border border-stone-200 bg-white font-bold"
                >
                  {store.employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name} ({emp.role})
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
                <label className="text-xs font-bold text-stone-700">Reason / Notes</label>
                <input
                  type="text"
                  placeholder="e.g. Festival advance / Medical emergency"
                  value={advanceNotes}
                  onChange={(e) => setAdvanceNotes(e.target.value)}
                  className="w-full mt-1 p-2.5 text-sm rounded-xl border border-stone-200 bg-white font-medium text-xs"
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
                  Pay From Cash Drawer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Salary Slip Modal */}
      {showSalaryModal && (
        <div className="fixed inset-0 z-50 bg-stone-900/40 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 max-w-md w-full border border-[#E7E2DA] shadow-2xl space-y-4 animate-in fade-in zoom-in-95 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#E7E2DA] pb-3">
              <div>
                <h3 className="text-base font-black text-stone-900">Monthly Salary Statement</h3>
                <p className="text-xs text-stone-500 font-medium">Auto-deducts pending advances</p>
              </div>
              <button
                onClick={() => setShowSalaryModal(false)}
                className="w-8 h-8 rounded-full bg-stone-100 font-bold text-stone-500"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between items-center bg-stone-50 p-3 rounded-xl border border-stone-200">
                <div>
                  <div className="text-xs font-bold text-stone-500">Employee</div>
                  <div className="text-sm font-black text-stone-900">{salaryCalc.employeeName}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-bold text-stone-500">Month</div>
                  <div className="text-xs font-mono font-bold text-stone-700">{salaryCalc.month}</div>
                </div>
              </div>

              <div className="space-y-2 text-xs divide-y divide-stone-100">
                <div className="flex justify-between pt-1">
                  <span className="text-stone-600 font-medium">Monthly Base Salary:</span>
                  <span className="font-mono font-bold text-stone-900">₹{salaryCalc.baseSalary.toLocaleString("en-IN")}</span>
                </div>
                <div className="flex justify-between pt-2">
                  <span className="text-stone-600 font-medium">Days Present:</span>
                  <span className="font-mono font-bold text-stone-900">{salaryCalc.presentDays ?? 26} / {salaryCalc.totalDays ?? 30}</span>
                </div>
                <div className="flex justify-between pt-2">
                  <span className="text-stone-600 font-medium">Calculated Gross:</span>
                  <span className="font-mono font-bold text-stone-900">₹{(salaryCalc.calculatedGross ?? salaryCalc.baseSalary).toLocaleString("en-IN")}</span>
                </div>
                <div className="flex justify-between pt-2 text-red-700 font-bold">
                  <span>Advance Deducted:</span>
                  <span className="font-mono">-₹{(salaryCalc.advanceDeducted ?? salaryCalc.advancesDeducted ?? 0).toLocaleString("en-IN")}</span>
                </div>
                <div className="flex justify-between pt-3 text-base font-black text-stone-900 border-t-2 border-stone-900">
                  <span>Net Payable:</span>
                  <span className="font-mono text-emerald-700">₹{(salaryCalc.netPayable ?? salaryCalc.payableSalary).toLocaleString("en-IN")}</span>
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowSalaryModal(false)}
              className="w-full py-3 bg-stone-900 hover:bg-stone-800 text-white font-bold text-xs rounded-xl shadow-xs"
            >
              Close Statement
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
