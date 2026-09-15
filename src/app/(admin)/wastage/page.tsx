"use client";

import React, { useState } from "react";
import {
  Trash2,
  Plus,
  AlertTriangle,
  Flame,
  CheckCircle2,
  Boxes,
  TrendingDown,
  Calendar,
} from "lucide-react";
import { globalRestaurantStore } from "@/lib/store/restaurant-store";
import { WastageRecord } from "@/types/inventory";

export default function WastagePage() {
  const store = globalRestaurantStore;
  const [, setTick] = useState(0);

  const [showAddModal, setShowAddModal] = useState(false);
  const [ingredientId, setIngredientId] = useState(store.ingredients[0]?.id || "");
  const [quantity, setQuantity] = useState<number>(1);
  const [reason, setReason] = useState<WastageRecord["reason"]>("BURNT_FOOD");
  const [notes, setNotes] = useState("");

  const handleRecordWastage = (e: React.FormEvent) => {
    e.preventDefault();
    const ing = store.ingredients.find((i) => i.id === ingredientId);
    if (!ing) return;

    const estimatedCost = Math.round(quantity * ing.currentCostPerUnit);

    store.recordWastageRecord({
      ingredientId,
      ingredientName: ing.name,
      quantity,
      unit: ing.baseUnit,
      reason,
      estimatedCost,
      recordedBy: store.currentUser.name,
      notes,
    });

    setShowAddModal(false);
    setNotes("");
    setTick((t) => t + 1);
  };

  const totalWastageCost = store.wastageRecords.reduce((sum, w) => sum + w.estimatedCost, 0);

  const reasonLabels: Record<WastageRecord["reason"], string> = {
    BURNT_FOOD: "भांडी करपली / अन्न जळाले (Burnt Vessel)",
    SPOILED: "खराब झाले / वास आला (Spoiled/Sour)",
    EXPIRED: "मुदत संपली (Expired Lot)",
    BROKEN_DROPPED: "सांडले / पडले (Spilled/Dropped)",
    KITCHEN_ERROR: "स्वयंपाकातील चूक (Kitchen Error)",
    CUSTOMER_RETURN: "ग्राहकाने परत केले (Customer Return)",
    PREPARATION_LOSS: "कापणी / स्वच्छता घट (Trimming Loss)",
    OTHER: "इतर कारण (Other)",
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 sm:p-6 rounded-2xl border border-[#E7E2DA] shadow-xs">
        <div>
          <div className="flex items-center gap-2 text-red-700 text-xs font-black uppercase tracking-wider">
            <Trash2 className="w-4 h-4" />
            <span>अन्न नासाडी व घट नोंद • Wastage & Loss Logger</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-stone-900 mt-1">
            Wastage & Food Loss Registry
          </h1>
          <p className="text-xs sm:text-sm text-stone-500 font-medium">
            Immediately deducts spoiled, burnt, or spilled ingredients from the live stock ledger with verified reason codes.
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white font-black px-5 py-3 rounded-xl text-sm shadow-md shadow-red-700/20 active:scale-95 transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>+ नासाडी नोंदवा (Log Wastage)</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="luxury-card p-5 rounded-2xl border border-[#E7E2DA] space-y-1">
          <div className="text-xs font-bold text-stone-500">Cumulative Recorded Loss</div>
          <div className="text-3xl font-black text-red-700 font-mono">
            ₹{totalWastageCost.toLocaleString("en-IN")}
          </div>
          <p className="text-[11px] text-stone-400 font-medium">Across all logged prep errors & spoilage</p>
        </div>

        <div className="luxury-card p-5 rounded-2xl border border-[#E7E2DA] space-y-1">
          <div className="text-xs font-bold text-stone-500">Total Wastage Incidents</div>
          <div className="text-3xl font-black text-stone-900 font-mono">
            {store.wastageRecords.length}
          </div>
          <p className="text-[11px] text-stone-400 font-medium">Auto-deducted from physical stock</p>
        </div>

        <div className="luxury-card p-5 rounded-2xl border border-[#E7E2DA] space-y-1">
          <div className="text-xs font-bold text-stone-500">Primary Cause</div>
          <div className="text-xl font-black text-amber-900 mt-1">Burnt / High Flame</div>
          <p className="text-[11px] text-amber-700 font-medium">During heavy lunch rush chulha operation</p>
        </div>
      </div>

      {/* Wastage Records Table */}
      <div className="bg-white rounded-2xl border border-[#E7E2DA] overflow-hidden shadow-xs">
        <div className="p-4 bg-[#FAF8F5] border-b border-[#E7E2DA] flex items-center justify-between">
          <h2 className="text-sm font-black text-stone-900">Recorded Food Loss History</h2>
          <span className="text-xs font-bold text-stone-500">{store.wastageRecords.length} Records</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-[#E7E2DA] bg-stone-50 text-stone-500 font-bold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-4">Date & Time</th>
                <th className="py-3 px-4">Ingredient</th>
                <th className="py-3 px-4">Quantity Deducted</th>
                <th className="py-3 px-4">Reason Code</th>
                <th className="py-3 px-4">Estimated Loss</th>
                <th className="py-3 px-4">Reported By</th>
                <th className="py-3 px-4 text-right">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {store.wastageRecords.map((w) => (
                <tr key={w.id} className="hover:bg-amber-50/30">
                  <td className="py-3.5 px-4 font-mono font-medium text-stone-700 whitespace-nowrap">
                    {w.timestamp.split("T")[0]}
                  </td>
                  <td className="py-3.5 px-4 font-bold text-stone-900 whitespace-nowrap">
                    {w.ingredientName}
                  </td>
                  <td className="py-3.5 px-4 font-mono font-black text-red-700">
                    -{w.quantity} {w.unit}
                  </td>
                  <td className="py-3.5 px-4 whitespace-nowrap">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                      {reasonLabels[w.reason] || w.reason}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 font-mono font-bold text-stone-900">
                    ₹{w.estimatedCost.toLocaleString("en-IN")}
                  </td>
                  <td className="py-3.5 px-4 text-stone-700 font-medium">
                    {w.recordedBy}
                  </td>
                  <td className="py-3.5 px-4 text-right text-stone-500 text-[11px] font-medium">
                    {w.notes || "Recorded on shift"}
                  </td>
                </tr>
              ))}
              {store.wastageRecords.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-stone-400 font-medium">
                    No wastage recorded yet today. Zero loss!
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Record Wastage Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-stone-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full border border-[#E7E2DA] shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-[#E7E2DA] pb-3">
              <div>
                <h3 className="text-base font-black text-stone-900">Log Wastage / Spoilage</h3>
                <p className="text-xs text-stone-500 font-medium">Immediately deducts stock from kitchen inventory</p>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="w-8 h-8 rounded-full bg-stone-100 font-bold text-stone-500"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleRecordWastage} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-stone-700">Wasted Ingredient</label>
                <select
                  value={ingredientId}
                  onChange={(e) => setIngredientId(e.target.value)}
                  className="w-full mt-1 p-2.5 text-sm rounded-xl border border-stone-200 bg-white font-bold"
                  required
                >
                  {store.ingredients.map((ing) => (
                    <option key={ing.id} value={ing.id}>
                      {ing.name} ({ing.localName}) — Physical Stock: {ing.physicalStock} {ing.baseUnit}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-stone-700">Quantity to Deduct</label>
                <input
                  type="number"
                  step="any"
                  min="0.1"
                  value={quantity}
                  onChange={(e) => setQuantity(parseFloat(e.target.value) || 0)}
                  className="w-full mt-1 p-2.5 text-sm rounded-xl border border-stone-200 bg-white font-black font-mono text-base"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-bold text-stone-700">Reason for Loss</label>
                <select
                  value={reason}
                  onChange={(e) => setReason(e.target.value as any)}
                  className="w-full mt-1 p-2.5 text-sm rounded-xl border border-stone-200 bg-white font-bold"
                >
                  {Object.entries(reasonLabels).map(([code, label]) => (
                    <option key={code} value={code}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-stone-700">Explanation / Vessel Details</label>
                <input
                  type="text"
                  placeholder="e.g. Scorch mark on bottom of large rassa pot"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full mt-1 p-2.5 text-sm rounded-xl border border-stone-200 bg-white font-medium text-xs"
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
                  className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-md shadow-red-700/20 active:scale-95"
                >
                  Deduct & Record Loss
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
