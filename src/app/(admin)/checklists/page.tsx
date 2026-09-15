"use client";

import React, { useState } from "react";
import {
  CheckSquare,
  CheckCircle2,
  Circle,
  Plus,
  X,
  Trash2,
  Sparkles,
  ShieldCheck,
  Tag,
} from "lucide-react";

import { globalRestaurantStore } from "@/lib/store/restaurant-store";

export default function ChecklistsPage() {
  const store = globalRestaurantStore;
  const [, setTick] = useState(0);
  const [checklistType, setChecklistType] = useState<"OPENING" | "CLOSING">("OPENING");

  // Modal and Form State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newItemTitle, setNewItemTitle] = useState("");
  const [newItemCategory, setNewItemCategory] = useState<"SAFETY" | "HYGIENE" | "STOCK" | "FINANCE" | "OPERATIONS">("OPERATIONS");
  const [newItemShift, setNewItemShift] = useState<"OPENING" | "CLOSING">("OPENING");
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const openingItems = store.checklistItems.filter((i) => i.shift === "OPENING");
  const closingItems = store.checklistItems.filter((i) => i.shift === "CLOSING");
  const items = checklistType === "OPENING" ? openingItems : closingItems;

  const toggleItem = (id: string) => {
    store.toggleChecklistItem(id);
    setTick((t) => t + 1);
  };

  const handleDeleteItem = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    store.deleteChecklistItem(id);
    setTick((t) => t + 1);
    showToast("Checklist item removed");
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleAddItemSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemTitle.trim()) return;

    store.addChecklistItem(newItemTitle.trim(), newItemCategory, newItemShift);
    setTick((t) => t + 1);
    setNewItemTitle("");
    setIsAddModalOpen(false);
    showToast("New checklist task added!");
  };

  const quickSuggestions = [
    { title: "Inspect Tambada & Pandhara Rassa stock in cold room", cat: "STOCK" as const },
    { title: "Verify kitchen fire extinguisher safety pressure", cat: "SAFETY" as const },
    { title: "Reconcile daily UPI QR soundbox audio payments", cat: "FINANCE" as const },
    { title: "Sanitize Bhakri rolling tawa and counters", cat: "HYGIENE" as const },
  ];

  const completedCount = items.filter((i) => i.isCompleted).length;
  const totalCount = items.length;
  const progressPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-4 right-4 z-50 bg-stone-900 text-amber-300 border border-amber-500/40 px-4 py-3 rounded-xl shadow-xl flex items-center gap-2 text-sm font-semibold animate-bounce">
          <Sparkles className="w-4 h-4 text-amber-400" />
          {toastMessage}
        </div>
      )}

      {/* Luxury Hero Header */}
      <div className="luxury-card rounded-2xl p-5 sm:p-6 border border-[#E7E2DA] flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-white via-[#FAF8F5] to-white">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-600 to-blue-700 text-white flex items-center justify-center shadow-md shadow-blue-600/20 border border-blue-500/30 shrink-0">
            <CheckSquare className="w-6 h-6 text-amber-100" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black text-stone-900 tracking-tight">
                Daily Operating Checklists
              </h1>
              <span className="bg-blue-50 text-blue-900 text-[10px] font-black px-2.5 py-0.5 rounded-full border border-blue-200 uppercase tracking-wider">
                SOP Protocols
              </span>
            </div>
            <p className="text-xs text-stone-500 font-medium mt-0.5">
              Shift opening verification, kitchen gas safety, cash reconciliation, and closing audit protocols.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Shift Switcher */}
          <div className="flex items-center gap-1 bg-[#FAF8F5] p-1 rounded-xl border border-[#E7E2DA] text-xs font-bold">
            <button
              onClick={() => setChecklistType("OPENING")}
              className={`px-3.5 py-2 rounded-lg transition-all ${
                checklistType === "OPENING"
                  ? "bg-gradient-to-r from-red-600 to-red-700 text-white shadow-2xs font-black"
                  : "text-stone-700 hover:bg-stone-200"
              }`}
            >
              Opening Shift ({openingItems.length})
            </button>
            <button
              onClick={() => setChecklistType("CLOSING")}
              className={`px-3.5 py-2 rounded-lg transition-all ${
                checklistType === "CLOSING"
                  ? "bg-gradient-to-r from-red-600 to-red-700 text-white shadow-2xs font-black"
                  : "text-stone-700 hover:bg-stone-200"
              }`}
            >
              Closing Shift ({closingItems.length})
            </button>
          </div>

          {/* Add Checklist Item Action Button */}
          <button
            onClick={() => {
              setNewItemShift(checklistType);
              setIsAddModalOpen(true);
            }}
            className="flex items-center gap-1.5 bg-gradient-to-r from-red-600 via-red-700 to-red-800 hover:from-red-700 hover:to-red-900 text-white text-xs font-black px-4 py-2.5 rounded-xl shadow-sm shadow-red-700/20 active:scale-95 transition-all shrink-0"
          >
            <Plus className="w-4 h-4 text-amber-200" />
            <span>Add Checklist Item</span>
          </button>
        </div>
      </div>

      {/* Progress Bar Card */}
      <div className="luxury-card p-5 sm:p-6 rounded-2xl border border-[#E7E2DA] space-y-2.5">
        <div className="flex items-center justify-between text-xs font-bold">
          <span className="text-stone-700 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-red-600" />
            <span>{checklistType === "OPENING" ? "Morning Shift Opening Verification" : "Evening Shift Closing Audit"}</span>
          </span>
          <span className="text-red-700 font-black">{completedCount} of {totalCount} Items Completed ({progressPct}%)</span>
        </div>
        <div className="w-full bg-[#EFECE6] h-2.5 rounded-full overflow-hidden">
          <div
            className="bg-gradient-to-r from-red-600 to-red-700 h-full transition-all duration-300 rounded-full"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* Checklist Items List */}
      <div className="luxury-card rounded-2xl border border-[#E7E2DA] divide-y divide-stone-100 overflow-hidden shadow-xs">
        {items.length === 0 ? (
          <div className="py-10 text-center text-stone-400">
            <CheckSquare className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="text-xs font-medium">No tasks in this shift yet.</p>
            <button
              onClick={() => {
                setNewItemShift(checklistType);
                setIsAddModalOpen(true);
              }}
              className="mt-3 text-xs font-bold text-red-600 hover:underline"
            >
              + Add your first checklist item
            </button>
          </div>
        ) : (
          items.map((it) => (
            <div
              key={it.id}
              onClick={() => toggleItem(it.id)}
              className={`p-4 flex items-center justify-between cursor-pointer transition-colors group ${
                it.isCompleted ? "bg-[#FAF8F5]/80 hover:bg-[#FAF8F5]" : "hover:bg-red-50/20"
              }`}
            >
              <div className="flex items-center gap-3">
                {it.isCompleted ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                ) : (
                  <Circle className="w-5 h-5 text-stone-300 group-hover:text-red-400 shrink-0" />
                )}
                <div>
                  <span
                    className={`text-xs font-bold block ${
                      it.isCompleted ? "text-stone-400 line-through" : "text-stone-900"
                    }`}
                  >
                    {it.title}
                  </span>
                  <span
                    className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md inline-block mt-0.5 ${
                      it.category === "SAFETY"
                        ? "bg-red-50 text-red-800 border border-red-200"
                        : it.category === "HYGIENE"
                        ? "bg-blue-50 text-blue-800 border border-blue-200"
                        : it.category === "STOCK"
                        ? "bg-amber-50 text-amber-900 border border-amber-200"
                        : it.category === "FINANCE"
                        ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                        : "bg-purple-50 text-purple-800 border border-purple-200"
                    }`}
                  >
                    {it.category}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span
                  className={`text-[10px] font-black px-2.5 py-0.5 rounded-full ${
                    it.isCompleted ? "bg-emerald-100 text-emerald-900 border border-emerald-300" : "bg-stone-100 text-stone-600"
                  }`}
                >
                  {it.isCompleted ? "COMPLETED" : "PENDING"}
                </span>

                <button
                  onClick={(e) => handleDeleteItem(it.id, e)}
                  className="opacity-0 group-hover:opacity-100 text-stone-400 hover:text-red-600 p-1 rounded-lg transition-all"
                  title="Remove this task"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}

        {/* Bottom Fast Add Task Row */}
        <div className="p-3.5 bg-[#FAF8F5] border-t border-[#E7E2DA] flex items-center justify-between">
          <span className="text-xs text-stone-500 font-medium">
            Tap any item above to toggle completion.
          </span>
          <button
            onClick={() => {
              setNewItemShift(checklistType);
              setIsAddModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 text-xs font-black text-red-700 hover:text-red-800 bg-red-50 hover:bg-red-100 border border-red-200 px-3 py-1.5 rounded-xl transition-all shadow-2xs active:scale-95"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Task to {checklistType === "OPENING" ? "Opening" : "Closing"}</span>
          </button>
        </div>
      </div>

      {/* MODAL: ADD CHECKLIST ITEM */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-stone-900/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="luxury-card bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-[#E7E2DA] overflow-hidden">
            {/* Modal Header */}
            <div className="bg-[#FAF8F5] border-b border-[#E7E2DA] p-4 sm:p-5 flex items-center justify-between">
              <div className="flex items-center gap-2.5 font-black text-stone-900 text-base">
                <CheckSquare className="w-5 h-5 text-red-600" />
                <span>Add Daily Checklist Task</span>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-stone-400 hover:text-stone-700 p-1 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddItemSubmit} className="p-5 sm:p-6 space-y-4 text-xs">
              {/* Target Shift */}
              <div>
                <label className="block font-black text-stone-700 uppercase tracking-wider text-[10px] mb-1.5">
                  Target Operating Shift
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setNewItemShift("OPENING")}
                    className={`p-3 rounded-xl border text-center transition-all ${
                      newItemShift === "OPENING"
                        ? "bg-red-50/90 border-red-500 ring-2 ring-red-400/30 text-red-900 font-black shadow-2xs"
                        : "bg-white border-[#E7E2DA] text-stone-700 hover:bg-[#FAF8F5]"
                    }`}
                  >
                    <span className="block font-black text-sm">Morning Opening</span>
                    <span className="text-[10px] text-stone-500 font-medium">Pre-service audit</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewItemShift("CLOSING")}
                    className={`p-3 rounded-xl border text-center transition-all ${
                      newItemShift === "CLOSING"
                        ? "bg-red-50/90 border-red-500 ring-2 ring-red-400/30 text-red-900 font-black shadow-2xs"
                        : "bg-white border-[#E7E2DA] text-stone-700 hover:bg-[#FAF8F5]"
                    }`}
                  >
                    <span className="block font-black text-sm">Evening Closing</span>
                    <span className="text-[10px] text-stone-500 font-medium">Post-service shutdown</span>
                  </button>
                </div>
              </div>

              {/* Task Title */}
              <div>
                <label className="block font-black text-stone-700 uppercase tracking-wider text-[10px] mb-1.5">
                  Task Description / SOP Instruction *
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="e.g. Inspect cold room temperature, Check mutton stock, Lock LPG valves"
                  value={newItemTitle}
                  onChange={(e) => setNewItemTitle(e.target.value)}
                  className="w-full bg-[#FAF8F5] border border-[#E7E2DA] rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-stone-900 focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>

              {/* Category Selector */}
              <div>
                <label className="block font-black text-stone-700 uppercase tracking-wider text-[10px] mb-1.5">
                  Task Category
                </label>
                <div className="grid grid-cols-5 gap-1.5 text-center">
                  {[
                    { code: "SAFETY", label: "Safety", color: "bg-red-50 border-red-200 text-red-800" },
                    { code: "HYGIENE", label: "Hygiene", color: "bg-blue-50 border-blue-200 text-blue-800" },
                    { code: "STOCK", label: "Stock", color: "bg-amber-50 border-amber-200 text-amber-800" },
                    { code: "FINANCE", label: "Finance", color: "bg-emerald-50 border-emerald-200 text-emerald-800" },
                    { code: "OPERATIONS", label: "Ops", color: "bg-purple-50 border-purple-200 text-purple-800" },
                  ].map((cat) => (
                    <button
                      key={cat.code}
                      type="button"
                      onClick={() => setNewItemCategory(cat.code as any)}
                      className={`p-2 rounded-xl border text-[11px] font-black transition-all ${
                        newItemCategory === cat.code
                          ? "bg-stone-900 text-amber-200 border-stone-900 shadow-2xs"
                          : `${cat.color} hover:opacity-80`
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Quick Suggestions Chips */}
              <div>
                <span className="block text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-1.5">
                  Quick Suggestion Shortcuts:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {quickSuggestions.map((sug, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setNewItemTitle(sug.title);
                        setNewItemCategory(sug.cat);
                      }}
                      className="bg-[#FAF8F5] hover:bg-stone-100 text-stone-700 border border-[#E7E2DA] px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all"
                    >
                      + {sug.title}
                    </button>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="pt-3 flex items-center justify-end gap-2 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-[#E7E2DA] text-stone-700 font-bold hover:bg-[#FAF8F5]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-1.5 bg-gradient-to-r from-red-600 via-red-700 to-red-800 hover:from-red-700 hover:to-red-900 text-white font-black px-5 py-2.5 rounded-xl shadow-md shadow-red-700/20 active:scale-95 transition-all"
                >
                  <Plus className="w-4 h-4 text-amber-200" />
                  <span>Save Checklist Item</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
