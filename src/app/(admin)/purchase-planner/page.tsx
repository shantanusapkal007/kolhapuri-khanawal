"use client";

import React, { useState } from "react";
import {
  ClipboardList,
  AlertTriangle,
  ShoppingCart,
  CheckCircle2,
  TrendingDown,
  ArrowRight,
  Boxes,
  Truck,
  IndianRupee,
} from "lucide-react";
import { globalRestaurantStore } from "@/lib/store/restaurant-store";
import Link from "next/link";

export default function PurchasePlannerPage() {
  const store = globalRestaurantStore;
  const [, setTick] = useState(0);

  const recommendations = store.generateDailyPurchasePlanner();

  const totalEstimatedCost = recommendations.reduce((sum, r) => sum + r.estimatedCost, 0);
  const criticalCount = recommendations.filter((r) => r.urgency === "CRITICAL").length;
  const highCount = recommendations.filter((r) => r.urgency === "HIGH").length;

  const handleFastOrder = (rec: any) => {
    // Map to supplier
    let supplierId = "sup-swastik-kirana";
    if (rec.ingredientId.includes("chicken")) supplierId = "sup-raju-chicken";
    else if (rec.ingredientId.includes("mutton")) supplierId = "sup-prakash-mutton";
    else if (rec.ingredientId.includes("chapati") || rec.ingredientId.includes("bhakri")) supplierId = "sup-mahesh-bhakri";
    else if (rec.ingredientId.includes("dairy")) supplierId = "sup-datta-dairy";
    else if (rec.ingredientId.includes("gas") || rec.ingredientId.includes("charcoal")) supplierId = "sup-baner-gas";

    const sup = store.suppliers.find((s) => s.id === supplierId);
    const rate = Math.round(rec.estimatedCost / (rec.recommendedPurchaseQty || 1));

    store.recordQuickPurchase({
      supplierId,
      supplierName: sup?.name || "Supplier",
      ingredientId: rec.ingredientId,
      ingredientName: `${rec.ingredientName} (${rec.localName || ""})`,
      quantity: rec.recommendedPurchaseQty,
      unit: rec.unit,
      rate,
      totalAmount: rec.estimatedCost,
      paymentMethod: "CASH",
      paymentStatus: "PAID",
      date: new Date().toISOString().split("T")[0],
      notes: `Generated via Morning Purchase Planner (${rec.urgency} shortage)`,
    });

    setTick((t) => t + 1);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 sm:p-6 rounded-2xl border border-[#E7E2DA] shadow-xs">
        <div>
          <div className="flex items-center gap-2 text-red-700 text-xs font-black uppercase tracking-wider">
            <ClipboardList className="w-4 h-4" />
            <span>सकाळचे खरेदी नियोजन • Morning Purchase Planner</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-stone-900 mt-1">
            Daily Stock & Purchase Recommendation
          </h1>
          <p className="text-xs sm:text-sm text-stone-500 font-medium">
            Calculated daily requirement vs physical stock to prevent running out of Chicken, Mutton, Bhakri, or LPG during rush hours.
          </p>
        </div>

        <Link
          href="/purchases"
          className="inline-flex items-center gap-2 bg-stone-900 hover:bg-stone-800 text-white font-bold px-5 py-3 rounded-xl text-xs sm:text-sm shadow-xs transition-all"
        >
          <ShoppingCart className="w-4 h-4" />
          <span>View All Purchases</span>
        </Link>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="luxury-card p-5 rounded-2xl border border-[#E7E2DA] space-y-1">
          <div className="text-xs font-bold text-stone-500">Estimated Morning Procurement Budget</div>
          <div className="text-3xl font-black text-stone-900 font-mono">
            ₹{totalEstimatedCost.toLocaleString("en-IN")}
          </div>
          <p className="text-[11px] text-stone-500 font-medium">For essential meat, grains, dairy & fuel</p>
        </div>

        <div className="luxury-card p-5 rounded-2xl border border-red-200 bg-red-50/40 space-y-1">
          <div className="text-xs font-bold text-red-900">Critical Stock Items</div>
          <div className="text-3xl font-black text-red-700 font-mono">{criticalCount} Items</div>
          <p className="text-[11px] text-red-600 font-bold">Below critical emergency threshold</p>
        </div>

        <div className="luxury-card p-5 rounded-2xl border border-amber-200 bg-amber-50/40 space-y-1">
          <div className="text-xs font-bold text-amber-900">High Priority Orders</div>
          <div className="text-3xl font-black text-amber-700 font-mono">{highCount} Items</div>
          <p className="text-[11px] text-amber-800 font-bold">Order before dinner crowd arrives</p>
        </div>
      </div>

      {/* Recommendation Table */}
      <div className="bg-white rounded-2xl border border-[#E7E2DA] overflow-hidden shadow-xs">
        <div className="p-4 bg-[#FAF8F5] border-b border-[#E7E2DA] flex items-center justify-between">
          <h2 className="text-sm font-black text-stone-900">Recommended Procurements for Today</h2>
          <span className="text-xs font-bold text-stone-500">{recommendations.length} Ingredients Calculated</span>
        </div>

        {recommendations.length === 0 ? (
          <div className="p-8 text-center text-stone-400 text-xs font-semibold">
            सर्व स्टॉक पर्याप्त आहे (All stocks adequate)
          </div>
        ) : (
          <>
            {/* Mobile Procurement Cards */}
            <div className="sm:hidden divide-y divide-stone-100 p-2 space-y-2">
              {recommendations.map((rec) => (
                <div key={rec.ingredientId} className="p-3 bg-[#FAF8F5] rounded-xl border border-stone-200/80 space-y-2 text-xs">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-black text-stone-900 text-xs">{rec.ingredientName}</div>
                      {rec.localName && (
                        <div className="text-[10px] text-stone-500 font-bold">{rec.localName}</div>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${
                          rec.urgency === "CRITICAL"
                            ? "bg-red-100 text-red-800 border border-red-300 animate-pulse"
                            : rec.urgency === "HIGH"
                            ? "bg-amber-100 text-amber-800 border border-amber-300"
                            : "bg-emerald-100 text-emerald-800"
                        }`}
                      >
                        {rec.urgency}
                      </span>
                      <div className="font-mono font-black text-stone-900 text-xs mt-0.5">
                        ₹{rec.estimatedCost.toLocaleString("en-IN")}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 p-2 rounded-lg bg-white border border-stone-200/60 text-[11px]">
                    <div>
                      <span className="text-stone-500">Current:</span>{" "}
                      <strong className="text-stone-800 font-mono font-bold">{rec.currentStock} {rec.unit}</strong>
                    </div>
                    <div>
                      <span className="text-stone-500">Daily Par:</span>{" "}
                      <strong className="text-stone-700 font-mono">{rec.expectedDailyRequirement} {rec.unit}</strong>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1 text-xs">
                    <div>
                      <span className="text-[10px] text-stone-500 uppercase font-bold">To Buy: </span>
                      {rec.recommendedPurchaseQty > 0 ? (
                        <span className="font-mono font-black text-sm text-red-700">
                          {rec.recommendedPurchaseQty} {rec.unit}
                        </span>
                      ) : (
                        <span className="font-bold text-emerald-700 text-xs">Adequate ✓</span>
                      )}
                    </div>

                    {rec.recommendedPurchaseQty > 0 && (
                      <button
                        type="button"
                        onClick={() => handleFastOrder(rec)}
                        className="inline-flex items-center gap-1.5 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white font-bold px-3 py-2 min-h-[38px] rounded-xl text-xs shadow-xs active:scale-95 transition-all touch-manipulation"
                      >
                        <ShoppingCart className="w-3.5 h-3.5" />
                        <span>1-Click Buy</span>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Table */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead>
                  <tr className="border-b border-[#E7E2DA] bg-stone-50 text-stone-500 font-bold uppercase tracking-wider text-[11px]">
                    <th className="py-3 px-4">Ingredient / Item</th>
                    <th className="py-3 px-4">Current Stock</th>
                    <th className="py-3 px-4">Daily Par Requirement</th>
                    <th className="py-3 px-4">Recommended To Buy</th>
                    <th className="py-3 px-4">Estimated Cost</th>
                    <th className="py-3 px-4">Urgency</th>
                    <th className="py-3 px-4 text-right">Quick Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {recommendations.map((rec) => (
                    <tr key={rec.ingredientId} className="hover:bg-amber-50/30">
                      <td className="py-3.5 px-4">
                        <div className="font-black text-stone-900">{rec.ingredientName}</div>
                        {rec.localName && (
                          <div className="text-[11px] text-stone-500 font-bold">{rec.localName}</div>
                        )}
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold text-stone-800">
                        {rec.currentStock} {rec.unit}
                      </td>
                      <td className="py-3.5 px-4 font-mono font-medium text-stone-600">
                        {rec.expectedDailyRequirement} {rec.unit}
                      </td>
                      <td className="py-3.5 px-4 font-mono font-black text-base text-stone-900">
                        {rec.recommendedPurchaseQty > 0 ? (
                          <span className="text-red-700">
                            {rec.recommendedPurchaseQty} {rec.unit}
                          </span>
                        ) : (
                          <span className="text-emerald-700">Adequate ✓</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold text-stone-900">
                        ₹{rec.estimatedCost.toLocaleString("en-IN")}
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                            rec.urgency === "CRITICAL"
                              ? "bg-red-100 text-red-800 border border-red-300 animate-pulse"
                              : rec.urgency === "HIGH"
                              ? "bg-amber-100 text-amber-800 border border-amber-300"
                              : "bg-emerald-100 text-emerald-800"
                          }`}
                        >
                          {rec.urgency}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        {rec.recommendedPurchaseQty > 0 ? (
                          <button
                            type="button"
                            onClick={() => handleFastOrder(rec)}
                            className="inline-flex items-center gap-1.5 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white font-bold px-3.5 py-1.5 rounded-lg text-xs shadow-xs active:scale-95 transition-all touch-manipulation"
                          >
                            <ShoppingCart className="w-3.5 h-3.5" />
                            <span>1-Click Buy</span>
                          </button>
                        ) : (
                          <span className="text-xs font-bold text-stone-400">No Action</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
