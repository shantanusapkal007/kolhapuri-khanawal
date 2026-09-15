"use client";

import React, { useState, useEffect } from "react";
import {
  BarChart3,
  Clock,
  Scale,
  FileSpreadsheet,
} from "lucide-react";
import { globalRestaurantStore } from "@/lib/store/restaurant-store";
import { calculateTheoreticalVsActualStock, calculateInventoryForecast } from "@/lib/reports/report-service";
import { formatQuantityWithUnit } from "@/lib/inventory/unit-converter";

export default function ReportsVariancePage() {
  const store = globalRestaurantStore;
  const [, setTick] = useState(0);

  useEffect(() => {
    setTick((t) => t + 1);
  }, []);

  // Compute Variance rows for each ingredient
  const varianceRows = store.ingredients.map((ing) => {
    const openingStock = ing.parLevel; // simulated opening balance
    return calculateTheoreticalVsActualStock(
      ing,
      openingStock,
      store.stockTransactions,
      ing.physicalStock
    );
  });

  // Compute Forecasting rows
  const forecastRows = store.ingredients.map((ing) => {
    // simulated average daily use: approx 25% of par level
    const avgUse = Number((ing.parLevel * 0.25).toFixed(2));
    return calculateInventoryForecast(ing, avgUse);
  });

  const totalLeakage = varianceRows.reduce((sum, r) => sum + r.financialLeakageValue, 0);

  const handleExportCsv = () => {
    const headers = [
      "Ingredient",
      "Unit",
      "Opening Stock",
      "Purchases",
      "Sales Consumed",
      "Wastage",
      "Expected Theoretical",
      "Physical Actual",
      "Variance Qty",
      "Variance %",
      "Leakage Value (INR)",
      "Status",
    ];

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [
        headers.join(","),
        ...varianceRows.map((r) =>
          [
            r.ingredientName,
            r.unit,
            r.openingStock,
            r.purchasesQuantity,
            r.salesConsumptionQuantity,
            r.wastageQuantity,
            r.expectedTheoreticalStock,
            r.actualPhysicalStock,
            r.varianceQuantity,
            r.variancePercentage,
            r.financialLeakageValue,
            r.varianceStatus,
          ].join(",")
        ),
      ].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `kolhapuri_khanawal_stock_variance_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Luxury Hero Header */}
      <div className="luxury-card rounded-2xl p-5 sm:p-6 border border-[#E7E2DA] flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-white via-[#FAF8F5] to-white">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-rose-600 to-rose-700 text-white flex items-center justify-center shadow-md shadow-rose-600/20 border border-rose-500/30 shrink-0">
            <BarChart3 className="w-6 h-6 text-amber-100" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black text-stone-900 tracking-tight">
                Theoretical vs. Actual Variance
              </h1>
              <span className="bg-rose-50 text-rose-900 text-[10px] font-black px-2.5 py-0.5 rounded-full border border-rose-200 uppercase tracking-wider">
                Audited Formula
              </span>
            </div>
            <p className="text-xs text-stone-500 font-medium mt-0.5">
              Formula: (Opening + Purchases - Recipe Sales - Wastage) vs Physical Count to uncover kitchen leakage.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCsv}
            className="flex items-center gap-1.5 bg-stone-900 hover:bg-stone-800 text-amber-200 text-xs font-black px-4 py-2.5 rounded-xl shadow-xs active:scale-95 transition-all"
          >
            <FileSpreadsheet className="w-4 h-4 text-amber-300" />
            <span>Export CSV Report</span>
          </button>
        </div>
      </div>

      {/* Variance Table Card */}
      <div className="luxury-card rounded-2xl border border-[#E7E2DA] p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <h2 className="text-sm font-black text-stone-900 flex items-center gap-2">
            <Scale className="w-4 h-4 text-rose-600" />
            <span>Operational Stock Reconciliation Table</span>
          </h2>

          <div className="text-xs text-stone-500 font-medium">
            Total Estimated Leakage Value:{" "}
            <strong className="text-rose-700 font-black">₹{totalLeakage}</strong>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="border-b border-[#E7E2DA] text-stone-500 bg-[#FAF8F5]/80">
                <th className="font-extrabold py-2.5 px-2">Ingredient</th>
                <th className="font-extrabold py-2.5 px-2 text-right">Opening</th>
                <th className="font-extrabold py-2.5 px-2 text-right">Purchases</th>
                <th className="font-extrabold py-2.5 px-2 text-right">Recipe Sales</th>
                <th className="font-extrabold py-2.5 px-2 text-right">Wastage</th>
                <th className="font-extrabold py-2.5 px-2 text-right">Expected Stock</th>
                <th className="font-extrabold py-2.5 px-2 text-right">Actual Physical</th>
                <th className="font-extrabold py-2.5 px-2 text-right">Variance Qty</th>
                <th className="font-extrabold py-2.5 px-2 text-right">Variance %</th>
                <th className="font-extrabold py-2.5 px-2 text-right">Leakage Value</th>
                <th className="font-extrabold py-2.5 px-2 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {varianceRows.map((row) => (
                <tr key={row.ingredientId} className="py-2 hover:bg-stone-50">
                  <td className="py-2.5 font-bold text-stone-900">{row.ingredientName}</td>
                  <td className="py-2.5 text-right text-stone-600">{row.openingStock} {row.unit}</td>
                  <td className="py-2.5 text-right text-emerald-700 font-semibold">+{row.purchasesQuantity}</td>
                  <td className="py-2.5 text-right text-red-600 font-semibold">-{row.salesConsumptionQuantity}</td>
                  <td className="py-2.5 text-right text-amber-700 font-semibold">-{row.wastageQuantity}</td>
                  <td className="py-2.5 text-right font-black text-stone-800">{row.expectedTheoreticalStock} {row.unit}</td>
                  <td className="py-2.5 text-right font-black text-purple-900">{row.actualPhysicalStock} {row.unit}</td>
                  <td className={`py-2.5 text-right font-black ${row.varianceQuantity < 0 ? "text-rose-600" : "text-emerald-700"}`}>
                    {row.varianceQuantity > 0 ? "+" : ""}{row.varianceQuantity} {row.unit}
                  </td>
                  <td className={`py-2.5 text-right font-black ${row.variancePercentage < 0 ? "text-rose-600" : "text-emerald-700"}`}>
                    {row.variancePercentage}%
                  </td>
                  <td className="py-2.5 text-right font-bold text-stone-900">₹{row.financialLeakageValue}</td>
                  <td className="py-2.5 text-center">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                        row.varianceStatus === "LEAKAGE_RISK"
                          ? "bg-red-100 text-red-800 border border-red-300"
                          : row.varianceStatus === "HIGH_VARIANCE"
                          ? "bg-amber-100 text-amber-800 border border-amber-300"
                          : "bg-emerald-100 text-emerald-800"
                      }`}
                    >
                      {row.varianceStatus.replace(/_/g, " ")}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Statistical Inventory Forecasting Grid */}
      <div className="luxury-card rounded-2xl border border-[#E7E2DA] p-5 sm:p-6 space-y-4">
        <h2 className="text-sm font-black text-stone-900 flex items-center gap-2">
          <Clock className="w-4 h-4 text-amber-700" />
          <span>Operational Consumption Rate & Days Remaining Forecast</span>
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {forecastRows.map((fc) => (
            <div
              key={fc.ingredientId}
              className="p-4 rounded-xl border border-[#E7E2DA] bg-[#FAF8F5] hover:border-stone-300 hover:bg-white transition-all flex flex-col justify-between space-y-2.5 shadow-2xs"
            >
              <div className="flex items-center justify-between">
                <span className="font-black text-xs text-stone-900">{fc.ingredientName}</span>
                <span
                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                    fc.reorderStatus === "CRITICAL_ORDER_NOW" || fc.reorderStatus === "OUT_OF_STOCK"
                      ? "bg-red-600 text-white"
                      : fc.reorderStatus === "ORDER_SOON"
                      ? "bg-amber-500 text-stone-950 font-black"
                      : "bg-emerald-100 text-emerald-800"
                  }`}
                >
                  {fc.reorderStatus.replace(/_/g, " ")}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs text-stone-600">
                <span>Avg Daily Use: <strong>{fc.averageDailyConsumption} {fc.unit}</strong></span>
                <span>Days Left: <strong className="text-stone-900">{fc.estimatedDaysRemaining} Days</strong></span>
              </div>

              {fc.suggestedReorderQuantity > 0 && (
                <div className="text-[11px] font-bold text-amber-800 bg-amber-50 px-2 py-1 rounded border border-amber-200">
                  Recommended PO: +{fc.suggestedReorderQuantity} {fc.unit}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
