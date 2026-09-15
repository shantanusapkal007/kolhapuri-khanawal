"use client";

import React, { useState } from "react";
import {
  CheckSquare,
  Wrench,
  AlertCircle,
  Plus,
  Clock,
  CheckCircle2,
  Calendar,
  Snowflake,
  Flame,
  Wifi,
  Sparkles,
  ShieldAlert,
} from "lucide-react";
import { globalRestaurantStore } from "@/lib/store/restaurant-store";
import { KhanawalTask } from "@/types/domain";

export default function TasksMaintenancePage() {
  const store = globalRestaurantStore;
  const [, setTick] = useState(0);

  // New task modal
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [title, setTitle] = useState("");
  const [assignedTo, setAssignedTo] = useState("Vikram Patil");
  const [priority, setPriority] = useState<KhanawalTask["priority"]>("HIGH");

  // New repair modal
  const [showRepairModal, setShowRepairModal] = useState(false);
  const [selectedEquipmentId, setSelectedEquipmentId] = useState(store.equipment[0]?.id || "");
  const [repairDescription, setRepairDescription] = useState("");
  const [repairCost, setRepairCost] = useState<number>(1000);
  const [repairVendor, setRepairVendor] = useState("");

  const handleToggleTask = (id: string) => {
    store.toggleKhanawalTask(id);
    setTick((t) => t + 1);
  };

  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    store.addKhanawalTask({
      title,
      assignedTo,
      priority,
      dueDate: new Date().toISOString(),
      reminder: true,
    });
    setShowTaskModal(false);
    setTitle("");
    setTick((t) => t + 1);
  };

  const handleRecordRepair = (e: React.FormEvent) => {
    e.preventDefault();
    store.recordEquipmentRepair(selectedEquipmentId, {
      date: new Date().toISOString().split("T")[0],
      description: repairDescription,
      cost: repairCost,
      vendor: repairVendor,
    });
    setShowRepairModal(false);
    setRepairDescription("");
    setRepairVendor("");
    setTick((t) => t + 1);
  };

  const pendingTasks = store.khanawalTasks.filter((t) => t.status === "PENDING");
  const completedTasks = store.khanawalTasks.filter((t) => t.status === "COMPLETED");

  const equipmentIcons: Record<string, any> = {
    FREEZER: Snowflake,
    GAS: Flame,
    WIFI: Wifi,
    KITCHEN: Wrench,
    LIGHTS: Sparkles,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 sm:p-6 rounded-2xl border border-[#E7E2DA] shadow-xs">
        <div>
          <div className="flex items-center gap-2 text-red-700 text-xs font-black uppercase tracking-wider">
            <Wrench className="w-4 h-4" />
            <span>दुकान कामे व उपकरण देखभाल • Tasks & Hotel Maintenance</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-stone-900 mt-1">
            Tasks, Reminders & Equipment Maintenance
          </h1>
          <p className="text-xs sm:text-sm text-stone-500 font-medium">
            Daily operational task priority board, deep freezer monitoring, commercial gas maintenance, and service records.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowTaskModal(true)}
            className="inline-flex items-center gap-2 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white font-black px-4 py-2.5 rounded-xl text-xs sm:text-sm shadow-md shadow-red-700/20 active:scale-95 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>+ New Task (नवीन काम)</span>
          </button>

          <button
            onClick={() => setShowRepairModal(true)}
            className="inline-flex items-center gap-2 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 font-bold px-4 py-2.5 rounded-xl text-xs sm:text-sm active:scale-95 transition-all"
          >
            <Wrench className="w-4 h-4 text-amber-700" />
            <span>+ Record Equipment Repair</span>
          </button>
        </div>
      </div>

      {/* Reminders Banner */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {store.reminders.map((rem) => (
          <div
            key={rem.id}
            className={`p-4 rounded-2xl border flex items-start gap-3 ${
              rem.urgency === "CRITICAL"
                ? "bg-red-50/70 border-red-200 text-red-950"
                : "bg-amber-50/60 border-amber-200 text-amber-950"
            }`}
          >
            <ShieldAlert className={`w-5 h-5 shrink-0 mt-0.5 ${rem.urgency === "CRITICAL" ? "text-red-600" : "text-amber-600"}`} />
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase tracking-wider">{rem.title}</span>
                <span className="text-[10px] font-black px-1.5 py-0.5 rounded-full bg-white/80 border">
                  {rem.urgency}
                </span>
              </div>
              <p className="text-xs mt-1 leading-relaxed font-medium">{rem.message}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Operational Tasks Board */}
      <div className="bg-white rounded-3xl p-6 border border-[#E7E2DA] shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-[#E7E2DA] pb-3">
          <div>
            <h2 className="text-base font-black text-stone-900">Operational Tasks Board</h2>
            <p className="text-xs text-stone-500 font-medium">Daily operational checklist with priority routing</p>
          </div>
          <span className="text-xs font-bold text-stone-500">{pendingTasks.length} Pending</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {store.khanawalTasks.map((task) => {
            const isDone = task.status === "COMPLETED";
            return (
              <div
                key={task.id}
                onClick={() => handleToggleTask(task.id)}
                className={`p-4 rounded-2xl border flex items-start gap-3 cursor-pointer transition-all ${
                  isDone
                    ? "bg-stone-50 border-stone-200 text-stone-400 line-through"
                    : "bg-white border-[#E7E2DA] hover:border-amber-400 shadow-xs"
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 mt-0.5 border ${
                    isDone
                      ? "bg-stone-400 border-stone-400 text-white"
                      : "bg-white border-stone-300"
                  }`}
                >
                  {isDone && <CheckCircle2 className="w-3.5 h-3.5" />}
                </div>

                <div className="flex-1 space-y-1">
                  <div className="text-xs font-bold text-stone-900 leading-snug">{task.title}</div>
                  <div className="flex items-center gap-2 text-[11px] text-stone-500">
                    <span>Assigned: <strong className="text-stone-700">{task.assignedTo}</strong></span>
                    <span>•</span>
                    <span
                      className={`font-black uppercase text-[10px] px-1.5 py-0.5 rounded-full ${
                        task.priority === "CRITICAL"
                          ? "bg-red-100 text-red-800"
                          : task.priority === "HIGH"
                          ? "bg-amber-100 text-amber-800"
                          : "bg-stone-100 text-stone-600"
                      }`}
                    >
                      {task.priority}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Hotel Equipment Registry & Repair Histories */}
      <div className="bg-white rounded-3xl p-6 border border-[#E7E2DA] shadow-xs space-y-5">
        <div className="flex items-center justify-between border-b border-[#E7E2DA] pb-3">
          <div>
            <h2 className="text-base font-black text-stone-900">Hotel Equipment & Maintenance Registry</h2>
            <p className="text-xs text-stone-500 font-medium">Tracks assets, service history, and repair expenditure</p>
          </div>
          <span className="text-xs font-bold text-stone-500">{store.equipment.length} Assets Registered</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {store.equipment.map((eq) => {
            const Icon = equipmentIcons[eq.category] || Wrench;
            return (
              <div
                key={eq.id}
                className="p-5 rounded-2xl border border-[#E7E2DA] bg-[#FAF8F5]/50 space-y-3 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between">
                    <div className="w-10 h-10 rounded-xl bg-white border border-stone-200 text-red-700 flex items-center justify-center shadow-2xs">
                      <Icon className="w-5 h-5" />
                    </div>
                    <span className="text-[11px] font-bold px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full">
                      {eq.status}
                    </span>
                  </div>

                  <h3 className="font-black text-stone-900 text-sm mt-2">{eq.name}</h3>
                  <div className="text-[11px] text-stone-500 font-medium">Purchased: {eq.purchaseDate}</div>

                  {eq.repairHistory.length > 0 && (
                    <div className="mt-2.5 p-2.5 bg-white rounded-xl border border-stone-200 space-y-1 text-xs">
                      <div className="text-[10px] uppercase font-bold text-stone-400">Latest Repair</div>
                      <div className="font-bold text-stone-800">{eq.repairHistory[0].description}</div>
                      <div className="flex justify-between text-[11px] text-stone-500 pt-0.5">
                        <span>{eq.repairHistory[0].date}</span>
                        <span className="font-mono font-bold text-red-700">₹{eq.repairHistory[0].cost}</span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="pt-2 border-t border-stone-200/80 flex items-center justify-between text-xs">
                  <span className="text-stone-500 font-medium">Total Repair Cost:</span>
                  <span className="font-mono font-black text-stone-900">
                    ₹{eq.totalRepairCost.toLocaleString("en-IN")}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Add Task Modal */}
      {showTaskModal && (
        <div className="fixed inset-0 z-50 bg-stone-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full border border-[#E7E2DA] shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-[#E7E2DA] pb-3">
              <h3 className="text-base font-black text-stone-900">Create Operational Task</h3>
              <button
                onClick={() => setShowTaskModal(false)}
                className="w-8 h-8 rounded-full bg-stone-100 text-stone-500 font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateTask} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-stone-700">Task Title</label>
                <input
                  type="text"
                  placeholder="e.g. Inspect LPG valves before evening rush"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full mt-1 p-2.5 text-sm rounded-xl border border-stone-200 bg-white font-bold"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-bold text-stone-700">Assign To</label>
                <select
                  value={assignedTo}
                  onChange={(e) => setAssignedTo(e.target.value)}
                  className="w-full mt-1 p-2.5 text-sm rounded-xl border border-stone-200 bg-white font-bold"
                >
                  {store.employees.map((e) => (
                    <option key={e.id} value={e.name}>
                      {e.name} ({e.role})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-stone-700">Priority Level</label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as any)}
                  className="w-full mt-1 p-2.5 text-sm rounded-xl border border-stone-200 bg-white font-bold"
                >
                  <option value="CRITICAL">🔴 CRITICAL (Emergency / Safety)</option>
                  <option value="HIGH">🟠 HIGH (Rush Hour Prep)</option>
                  <option value="MEDIUM">🟡 MEDIUM (Standard Maintenance)</option>
                  <option value="LOW">🟢 LOW (Can be deferred)</option>
                </select>
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowTaskModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-stone-200 text-stone-600 font-bold text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-md shadow-red-700/20 active:scale-95"
                >
                  Create Task
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Record Repair Modal */}
      {showRepairModal && (
        <div className="fixed inset-0 z-50 bg-stone-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full border border-[#E7E2DA] shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-[#E7E2DA] pb-3">
              <div>
                <h3 className="text-base font-black text-stone-900">Record Equipment Repair</h3>
                <p className="text-xs text-stone-500 font-medium">Updates asset history and logs expense in ledger</p>
              </div>
              <button
                onClick={() => setShowRepairModal(false)}
                className="w-8 h-8 rounded-full bg-stone-100 text-stone-500 font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleRecordRepair} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-stone-700">Equipment Asset</label>
                <select
                  value={selectedEquipmentId}
                  onChange={(e) => setSelectedEquipmentId(e.target.value)}
                  className="w-full mt-1 p-2.5 text-sm rounded-xl border border-stone-200 bg-white font-bold"
                >
                  {store.equipment.map((eq) => (
                    <option key={eq.id} value={eq.id}>
                      {eq.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-stone-700">Repair Description</label>
                <input
                  type="text"
                  placeholder="e.g. Compressor relay & R134a refrigerant recharge"
                  value={repairDescription}
                  onChange={(e) => setRepairDescription(e.target.value)}
                  className="w-full mt-1 p-2.5 text-sm rounded-xl border border-stone-200 bg-white font-bold"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-stone-700">Repair Cost (₹)</label>
                  <input
                    type="number"
                    min="1"
                    value={repairCost}
                    onChange={(e) => setRepairCost(parseFloat(e.target.value) || 0)}
                    className="w-full mt-1 p-2.5 text-sm rounded-xl border border-stone-200 bg-white font-black font-mono text-base"
                    required
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-stone-700">Service Vendor</label>
                  <input
                    type="text"
                    placeholder="e.g. CoolTech Baner"
                    value={repairVendor}
                    onChange={(e) => setRepairVendor(e.target.value)}
                    className="w-full mt-1 p-2.5 text-sm rounded-xl border border-stone-200 bg-white font-medium"
                    required
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowRepairModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-stone-200 text-stone-600 font-bold text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-md shadow-red-700/20 active:scale-95"
                >
                  Save & Log Repair
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
