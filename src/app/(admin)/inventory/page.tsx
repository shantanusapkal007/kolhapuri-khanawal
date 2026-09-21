"use client";

import React, { useState, useEffect } from "react";
import {
  Boxes,
  Plus,
  AlertTriangle,
  Scale,
  Sparkles,
  X,
  History,
  Trash2,
  Edit2,
} from "lucide-react";
import { globalRestaurantStore } from "@/lib/store/restaurant-store";
import { Ingredient } from "@/types/inventory";
import { formatQuantityWithUnit } from "@/lib/inventory/unit-converter";
import { executeStockMovement, reconcilePhysicalCount } from "@/lib/inventory/ledger";
import { hasPermission } from "@/lib/auth/rbac";

export default function InventoryLedgerPage() {
  const store = globalRestaurantStore;
  const [, setTick] = useState(0);

  const [activeModal, setActiveModal] = useState<"COUNT" | "PURCHASE" | "WASTAGE" | "ADD_INGREDIENT" | "EDIT_INGREDIENT" | null>(null);
  const [selectedIngredient, setSelectedIngredient] = useState<Ingredient | null>(null);

  // Form states
  const [physicalCountInput, setPhysicalCountInput] = useState<number>(0);
  const [varianceReason, setVarianceReason] = useState<string>("WASTAGE");
  const [purchaseQty, setPurchaseQty] = useState<number>(10);
  const [purchaseRate, setPurchaseRate] = useState<number>(240);
  const [wastageQty, setWastageQty] = useState<number>(1);
  const [wastageReason, setWastageReason] = useState<string>("SPOILED");
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Add Raw Ingredient Form states
  const [newIngName, setNewIngName] = useState<string>("");
  const [newIngLocalName, setNewIngLocalName] = useState<string>("");
  const [newIngCategory, setNewIngCategory] = useState<string>("POULTRY");
  const [newIngUnit, setNewIngUnit] = useState<string>("kg");
  const [newIngStock, setNewIngStock] = useState<number>(10);
  const [newIngParLevel, setNewIngParLevel] = useState<number>(25);
  const [newIngReorderLevel, setNewIngReorderLevel] = useState<number>(10);
  const [newIngCriticalLevel, setNewIngCriticalLevel] = useState<number>(5);
  const [newIngCost, setNewIngCost] = useState<number>(150);

  // Edit Ingredient Form states
  const [editingIngredient, setEditingIngredient] = useState<Ingredient | null>(null);
  const [editName, setEditName] = useState<string>("");
  const [editLocalName, setEditLocalName] = useState<string>("");
  const [editParLevel, setEditParLevel] = useState<number>(25);
  const [editReorderLevel, setEditReorderLevel] = useState<number>(10);
  const [editCriticalLevel, setEditCriticalLevel] = useState<number>(5);
  const [editCostPerUnit, setEditCostPerUnit] = useState<number>(150);

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

  const handleOpenCountModal = (ing: Ingredient) => {
    setSelectedIngredient(ing);
    setPhysicalCountInput(ing.physicalStock);
    setActiveModal("COUNT");
  };

  const handleCountSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedIngredient) return;

    const result = reconcilePhysicalCount(
      selectedIngredient,
      physicalCountInput,
      store.currentUser.name,
      varianceReason as any,
      "Physical count reconciliation"
    );

    // Update store state
    store.ingredients = store.ingredients.map((i) =>
      i.id === selectedIngredient.id ? result.updatedIngredient : i
    );
    if (result.adjustmentTransaction) {
      store.stockTransactions.unshift(result.adjustmentTransaction);
    }
    store.recalculateMenuAvailability();
    setTick((t) => t + 1);
    setActiveModal(null);
    showToast(`Physical count reconciled! Variance: ${result.countItem.varianceQuantity} ${selectedIngredient.baseUnit}`);
  };

  const handlePurchaseSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedIngredient) return;

    const result = executeStockMovement({
      ingredient: selectedIngredient,
      transactionType: "PURCHASE",
      quantity: purchaseQty,
      unit: selectedIngredient.baseUnit,
      direction: "IN",
      referenceType: "PURCHASE_RECEIPT",
      referenceId: `PO-${Date.now()}`,
      unitCost: purchaseRate,
      performedBy: store.currentUser.name,
      notes: "Direct goods receipt from supplier",
    });

    store.ingredients = store.ingredients.map((i) =>
      i.id === selectedIngredient.id ? result.updatedIngredient : i
    );
    store.stockTransactions.unshift(result.transaction);
    store.recalculateMenuAvailability();
    setTick((t) => t + 1);
    setActiveModal(null);
    showToast(`Purchased +${purchaseQty} ${selectedIngredient.baseUnit} of ${selectedIngredient.name}!`);
  };

  const handleWastageSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedIngredient) return;

    const result = executeStockMovement({
      ingredient: selectedIngredient,
      transactionType: "WASTAGE",
      quantity: wastageQty,
      unit: selectedIngredient.baseUnit,
      direction: "OUT",
      referenceType: "WASTAGE_LOG",
      referenceId: `WASTE-${Date.now()}`,
      unitCost: selectedIngredient.weightedAvgCostPerUnit,
      performedBy: store.currentUser.name,
      notes: `Wastage logged: ${wastageReason}`,
    });

    store.ingredients = store.ingredients.map((i) =>
      i.id === selectedIngredient.id ? result.updatedIngredient : i
    );
    store.stockTransactions.unshift(result.transaction);
    store.recalculateMenuAvailability();
    setTick((t) => t + 1);
    setActiveModal(null);
    showToast(`Logged waste: -${wastageQty} ${selectedIngredient.baseUnit} of ${selectedIngredient.name}`);
  };

  const handleAddIngredientSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const categoryMap: Record<string, string> = {
        POULTRY: "Poultry & Meat",
        DAIRY: "Dairy & Milk Products",
        GRAINS: "Grains & Flours",
        SPICES: "Authentic Kolhapuri Masalas",
        OIL_FAT: "Cooking Oils & Ghee",
        BEVERAGE: "Beverage Ingredients",
      };

      const created = store.addIngredient({
        categoryId: `cat-${newIngCategory.toLowerCase()}`,
        categoryName: categoryMap[newIngCategory] || "General Provisions",
        name: newIngName,
        localName: newIngLocalName || undefined,
        baseUnit: newIngUnit as any,
        physicalStock: Number(newIngStock),
        parLevel: Number(newIngParLevel),
        reorderLevel: Number(newIngReorderLevel),
        criticalLevel: Number(newIngCriticalLevel),
        currentCostPerUnit: Number(newIngCost),
      });

      setTick((t) => t + 1);
      setActiveModal(null);
      showToast(`Added raw ingredient "${created.name}" to inventory!`);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleOpenEditModal = (ing: Ingredient) => {
    setEditingIngredient(ing);
    setEditName(ing.name);
    setEditLocalName(ing.localName || "");
    setEditParLevel(ing.parLevel);
    setEditReorderLevel(ing.reorderLevel);
    setEditCriticalLevel(ing.criticalLevel);
    setEditCostPerUnit(ing.currentCostPerUnit);
    setActiveModal("EDIT_INGREDIENT");
  };

  const handleEditIngredientSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingIngredient) return;
    try {
      store.updateIngredient(editingIngredient.id, {
        name: editName,
        localName: editLocalName || undefined,
        parLevel: Number(editParLevel),
        reorderLevel: Number(editReorderLevel),
        criticalLevel: Number(editCriticalLevel),
        currentCostPerUnit: Number(editCostPerUnit),
      });
      setTick((t) => t + 1);
      setActiveModal(null);
      showToast(`Updated ingredient "${editName}"!`);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDeleteIngredient = (ing: Ingredient) => {
    if (confirm(`Are you sure you want to delete ingredient "${ing.name}"?`)) {
      try {
        store.deleteIngredient(ing.id);
        setTick((t) => t + 1);
        showToast(`Ingredient "${ing.name}" deleted.`);
      } catch (err: any) {
        alert(err.message);
      }
    }
  };

  const totalInventoryValuation = Math.round(
    store.ingredients.reduce(
      (sum, i) => sum + i.physicalStock * i.weightedAvgCostPerUnit,
      0
    )
  );
  const lowStockCount = store.ingredients.filter(
    (i) => i.physicalStock <= i.reorderLevel
  ).length;

  const canViewCost = hasPermission(store.currentUser.role, "inventory.cost_view");
  const canAdjustStock = hasPermission(store.currentUser.role, "inventory.adjust");
  const canPurchase = hasPermission(store.currentUser.role, "inventory.purchase");

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
      <div className="luxury-card rounded-2xl p-5 sm:p-6 border border-[#E7E2DA] flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-white via-[#FAF8F5] to-white">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-600 text-white flex items-center justify-center shadow-md shadow-amber-600/20 border border-amber-400/30 shrink-0">
            <Boxes className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black text-stone-900 tracking-tight">
                Inventory Stock Ledger
              </h1>
              <span className="bg-amber-50 border border-amber-200 text-amber-900 text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
                Double-Entry
              </span>
            </div>
            <p className="text-xs text-stone-500 font-medium mt-0.5">
              3-Tier stock model (Physical, Reserved, Available), weighted average costing & reconciliation.
            </p>
          </div>
        </div>

        {/* Live Ledger Summary Metric Pills & Add Button */}
        <div className="flex items-center gap-2.5 sm:gap-3 flex-wrap">
          {canViewCost && (
            <div className="bg-white border border-[#E7E2DA] px-3.5 py-2 rounded-xl text-center shadow-2xs">
              <span className="text-[10px] text-stone-400 font-bold uppercase tracking-wider block">Valuation</span>
              <span className="text-sm font-black text-stone-900">₹{totalInventoryValuation.toLocaleString("en-IN")}</span>
            </div>
          )}

          <div className="bg-white border border-[#E7E2DA] px-3.5 py-2 rounded-xl text-center shadow-2xs">
            <span className="text-[10px] text-stone-400 font-bold uppercase tracking-wider block">Tracked</span>
            <span className="text-sm font-black text-stone-900">{store.ingredients.length} Items</span>
          </div>

          {lowStockCount > 0 ? (
            <div className="bg-red-50 border border-red-200 px-3.5 py-2 rounded-xl text-center shadow-2xs">
              <span className="text-[10px] text-red-700 font-black uppercase tracking-wider block">Alerts</span>
              <span className="text-sm font-black text-red-800">{lowStockCount} Low</span>
            </div>
          ) : (
            <div className="bg-emerald-50 border border-emerald-200 px-3.5 py-2 rounded-xl text-center shadow-2xs">
              <span className="text-[10px] text-emerald-700 font-black uppercase tracking-wider block">Health</span>
              <span className="text-sm font-black text-emerald-800">Optimal</span>
            </div>
          )}

          <button
            onClick={() => {
              setNewIngName("");
              setNewIngLocalName("");
              setNewIngCategory("POULTRY");
              setNewIngUnit("kg");
              setNewIngStock(10);
              setNewIngParLevel(25);
              setNewIngReorderLevel(10);
              setNewIngCriticalLevel(5);
              setNewIngCost(150);
              setActiveModal("ADD_INGREDIENT");
            }}
            className="flex items-center gap-2 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white text-xs font-black px-4 py-2 rounded-xl shadow-xs active:scale-95 transition-all"
          >
            <Plus className="w-4 h-4 text-amber-200" />
            <span>Add Raw Material</span>
          </button>
        </div>
      </div>

      {/* Ingredients Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {store.ingredients.map((ing) => {
          const isCritical = ing.physicalStock <= ing.criticalLevel;
          const isLow = ing.physicalStock <= ing.reorderLevel && !isCritical;
          const isOut = ing.physicalStock <= 0;
          const fillPercent = Math.min(100, Math.round((ing.availableStock / (ing.parLevel || 1)) * 100));

          return (
            <div
              key={ing.id}
              className={`luxury-card rounded-2xl p-5 border flex flex-col justify-between space-y-4 transition-all group ${
                isOut
                  ? "border-red-400/80 bg-red-50/15"
                  : isCritical
                  ? "border-amber-400/80 bg-amber-50/15"
                  : "border-[#E7E2DA] hover:border-amber-400/80"
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-black text-base text-stone-900 leading-snug group-hover:text-amber-950 transition-colors">
                      {ing.name}
                    </h3>
                    {ing.localName && (
                      <span className="text-xs font-bold text-amber-800 block mt-0.5">
                        {ing.localName}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span
                      className={`text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider flex items-center gap-1.5 shrink-0 ${
                        isOut
                          ? "bg-red-600 text-white shadow-xs"
                          : isCritical
                          ? "bg-red-50 text-red-800 border border-red-200"
                          : isLow
                          ? "bg-amber-50 text-amber-800 border border-amber-200"
                          : "bg-emerald-50 text-emerald-800 border border-emerald-200"
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          isOut
                            ? "bg-white"
                            : isCritical
                            ? "bg-red-600 animate-ping"
                            : isLow
                            ? "bg-amber-500"
                            : "bg-emerald-500"
                        }`}
                      />
                      <span>{isOut ? "OUT OF STOCK" : isCritical ? "CRITICAL" : isLow ? "LOW STOCK" : "HEALTHY"}</span>
                    </span>

                    {canAdjustStock && (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleOpenEditModal(ing)}
                          title="Edit ingredient thresholds and cost"
                          className="p-1 text-stone-400 hover:text-amber-800 hover:bg-amber-50 rounded-lg border border-[#E7E2DA] transition-all active:scale-95"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteIngredient(ing)}
                          title="Delete ingredient"
                          className="p-1 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg border border-[#E7E2DA] transition-all active:scale-95"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Stock Level Progress Track */}
                <div className="space-y-1.5 mt-3 pt-3 border-t border-stone-100">
                  <div className="flex justify-between text-[11px] text-stone-500 font-medium">
                    <span>Par Fill: {ing.parLevel} {ing.baseUnit}</span>
                    <span className="font-bold text-stone-800">{fillPercent}%</span>
                  </div>
                  <div className="w-full bg-[#EFECE6] h-1.5 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        isOut
                          ? "bg-red-600"
                          : isCritical
                          ? "bg-red-500"
                          : isLow
                          ? "bg-amber-500"
                          : "bg-emerald-600"
                      }`}
                      style={{ width: `${fillPercent}%` }}
                    />
                  </div>
                </div>

                {/* Segmented 3-Tier Breakdown Box */}
                <div className="grid grid-cols-3 divide-x divide-[#E7E2DA] bg-[#FAF8F5] rounded-xl border border-[#E7E2DA] p-1.5 text-center text-xs mt-3">
                  <div className="px-1 py-1">
                    <span className="text-[10px] text-stone-400 uppercase font-black tracking-wider block">Physical</span>
                    <span className="font-black text-stone-900 text-xs sm:text-sm">
                      {formatQuantityWithUnit(ing.physicalStock, ing.baseUnit)}
                    </span>
                  </div>
                  <div className="px-1 py-1">
                    <span className="text-[10px] text-amber-700/80 uppercase font-black tracking-wider block">Reserved</span>
                    <span className="font-black text-amber-900 text-xs sm:text-sm">
                      {formatQuantityWithUnit(ing.reservedStock, ing.baseUnit)}
                    </span>
                  </div>
                  <div className="px-1 py-1">
                    <span className="text-[10px] text-emerald-700/80 uppercase font-black tracking-wider block">Available</span>
                    <span className="font-black text-emerald-900 text-xs sm:text-sm">
                      {formatQuantityWithUnit(ing.availableStock, ing.baseUnit)}
                    </span>
                  </div>
                </div>

                {/* Pricing & Valuation Footer (Protected by RBAC) */}
                {canViewCost && (
                  <div className="flex items-center justify-between text-[11px] text-stone-500 font-medium mt-3 pt-2 border-t border-stone-100">
                    <span>WAC: <strong className="text-stone-700">₹{ing.weightedAvgCostPerUnit}</strong> / {ing.baseUnit}</span>
                    <span>Asset: <strong className="text-stone-800 font-bold">₹{Math.round(ing.physicalStock * ing.weightedAvgCostPerUnit)}</strong></span>
                  </div>
                )}
              </div>

              {/* Refined Action Buttons (Protected by RBAC) */}
              <div className="grid grid-cols-3 gap-1.5 pt-2 border-t border-stone-100 text-xs font-bold">
                {canPurchase ? (
                  <button
                    onClick={() => {
                      setSelectedIngredient(ing);
                      setPurchaseQty(10);
                      setPurchaseRate(ing.currentCostPerUnit);
                      setActiveModal("PURCHASE");
                    }}
                    className="flex items-center justify-center gap-1 py-2.5 min-h-[44px] rounded-xl bg-stone-900 hover:bg-stone-800 text-white transition-all shadow-2xs active:scale-95 touch-manipulation cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5 text-amber-300" />
                    <span>Receive</span>
                  </button>
                ) : (
                  <div />
                )}

                {canAdjustStock ? (
                  <button
                    onClick={() => {
                      setSelectedIngredient(ing);
                      setWastageQty(1);
                      setWastageReason("SPOILED");
                      setActiveModal("WASTAGE");
                    }}
                    className="flex items-center justify-center gap-1 py-2.5 min-h-[44px] rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200/80 transition-all active:scale-95 touch-manipulation cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Waste</span>
                  </button>
                ) : (
                  <div />
                )}

                {canAdjustStock ? (
                  <button
                    onClick={() => handleOpenCountModal(ing)}
                    className="flex items-center justify-center gap-1 py-2.5 min-h-[44px] rounded-xl bg-white hover:bg-[#FAF8F5] text-stone-800 border border-[#E7E2DA] transition-all shadow-2xs active:scale-95 touch-manipulation cursor-pointer"
                  >
                    <Scale className="w-3.5 h-3.5 text-stone-600" />
                    <span>Count</span>
                  </button>
                ) : (
                  <div />
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Double-Entry Stock Movement Ledger History */}
      <div className="luxury-card rounded-2xl border border-[#E7E2DA] p-5 sm:p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-black text-stone-900 flex items-center gap-2">
            <History className="w-4 h-4 text-amber-700" />
            <span>Double-Entry Stock Transactions Ledger (Immutable Audit)</span>
          </h2>
          <span className="text-[11px] font-bold text-stone-500 bg-[#FAF8F5] border border-[#E7E2DA] px-2.5 py-1 rounded-md">
            {store.stockTransactions.length} Recorded Movements
          </span>
        </div>

        {store.stockTransactions.length === 0 ? (
          <div className="py-6 text-center text-stone-400 text-xs">
            No stock movements logged yet today. Movements occur on purchases, KOT prep, or stock counts.
          </div>
        ) : (
          <>
            {/* Mobile Transaction Cards */}
            <div className="sm:hidden space-y-2">
              {store.stockTransactions.map((tx) => (
                <div key={tx.id} className="p-3 bg-[#FAF8F5] rounded-xl border border-stone-200/80 space-y-1.5 text-xs">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-bold text-stone-900 text-xs">{tx.ingredientName}</div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span
                          className={`text-[9px] font-black px-1.5 py-0.2 rounded uppercase ${
                            tx.direction === "IN"
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-red-100 text-red-800"
                          }`}
                        >
                          {tx.transactionType}
                        </span>
                        <span className="text-[10px] text-stone-400 font-mono">
                          {new Date(tx.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`font-black font-mono text-sm ${tx.direction === "IN" ? "text-emerald-700" : "text-red-600"}`}>
                        {tx.direction === "IN" ? "+" : "-"}{tx.quantity} {tx.unit}
                      </div>
                      <div className="text-[10px] text-stone-500 font-medium">
                        Bal: <strong className="text-stone-700 font-mono">{tx.runningBalance} {tx.unit}</strong>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[11px] pt-1 border-t border-stone-200/60 text-stone-500">
                    <span>Rate: ₹{tx.unitCost} • Total: <strong className="text-stone-700 font-bold">₹{tx.totalValue}</strong></span>
                    <span className="truncate max-w-[120px]">{tx.performedBy}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Table */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b border-[#E7E2DA] text-stone-500 bg-[#FAF8F5]/80">
                    <th className="font-extrabold py-2.5 px-2">Timestamp</th>
                    <th className="font-extrabold py-2.5 px-2">Ingredient</th>
                    <th className="font-extrabold py-2.5 px-2">Type</th>
                    <th className="font-extrabold py-2.5 px-2 text-right">Quantity</th>
                    <th className="font-extrabold py-2.5 px-2 text-right">Unit Rate</th>
                    <th className="font-extrabold py-2.5 px-2 text-right">Total Value</th>
                    <th className="font-extrabold py-2.5 px-2 text-right">Balance</th>
                    <th className="font-extrabold py-2.5 px-2">Performed By</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {store.stockTransactions.map((tx) => (
                    <tr key={tx.id} className="py-2 hover:bg-stone-50">
                      <td className="py-2 text-stone-400 font-mono">
                        {new Date(tx.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                      </td>
                      <td className="py-2 font-bold text-stone-900">{tx.ingredientName}</td>
                      <td className="py-2">
                        <span
                          className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded ${
                            tx.direction === "IN"
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-red-100 text-red-800"
                          }`}
                        >
                          {tx.transactionType}
                        </span>
                      </td>
                      <td className={`py-2 text-right font-black ${tx.direction === "IN" ? "text-emerald-700" : "text-red-600"}`}>
                        {tx.direction === "IN" ? "+" : "-"}{tx.quantity} {tx.unit}
                      </td>
                      <td className="py-2 text-right text-stone-600">₹{tx.unitCost}</td>
                      <td className="py-2 text-right font-bold text-stone-800">₹{tx.totalValue}</td>
                      <td className="py-2 text-right font-black text-stone-900">{tx.runningBalance} {tx.unit}</td>
                      <td className="py-2 text-stone-600">{tx.performedBy}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* MODAL: PHYSICAL STOCK COUNT RECONCILIATION IN LIGHT THEME */}
      {activeModal === "COUNT" && selectedIngredient && (
        <div className="fixed inset-0 z-50 bg-stone-900/40 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-2xl shadow-2xl border border-stone-200 overflow-hidden animate-in fade-in zoom-in-95">
            <div className="bg-stone-50 border-b border-stone-200 text-stone-900 p-4 flex items-center justify-between">
              <div className="flex items-center gap-2 font-bold text-base">
                <Scale className="w-5 h-5 text-amber-600" />
                <span>Stock Count: {selectedIngredient.name}</span>
              </div>
              <button onClick={() => setActiveModal(null)} className="text-stone-400 hover:text-stone-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCountSubmit} className="p-5 space-y-4">
              <div className="bg-stone-50 p-3 rounded-xl border border-stone-200 text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-stone-500">Theoretical System Stock:</span>
                  <strong className="text-stone-900">{selectedIngredient.physicalStock} {selectedIngredient.baseUnit}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-500">Unit Cost (WAC):</span>
                  <span>₹{selectedIngredient.weightedAvgCostPerUnit} / {selectedIngredient.baseUnit}</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  Actual Physical Count ({selectedIngredient.baseUnit})
                </label>
                <input
                  type="number"
                  step="0.001"
                  value={physicalCountInput}
                  onChange={(e) => setPhysicalCountInput(Number(e.target.value))}
                  className="w-full bg-stone-50 border border-stone-300 rounded-xl px-3 py-2 text-base font-black text-stone-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  Variance Reason / Category
                </label>
                <select
                  value={varianceReason}
                  onChange={(e) => setVarianceReason(e.target.value)}
                  className="w-full bg-stone-50 border border-stone-300 rounded-xl px-3 py-2 text-xs font-bold text-stone-900"
                >
                  <option value="WASTAGE">Kitchen Wastage / Spillage</option>
                  <option value="PREPARATION_VARIANCE">Preparation Yield Variance</option>
                  <option value="MEASUREMENT_ERROR">Scale / Measurement Error</option>
                  <option value="PILFERAGE">Unaccounted Shrinkage</option>
                  <option value="OTHER">Other Adjustment</option>
                </select>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="px-4 py-2 text-xs font-bold text-stone-600 hover:bg-stone-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white rounded-xl shadow active:scale-95"
                >
                  Reconcile & Update Ledger
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: RECEIVE PURCHASE INBOUND IN LIGHT THEME */}
      {activeModal === "PURCHASE" && selectedIngredient && (
        <div className="fixed inset-0 z-50 bg-stone-900/40 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-2xl shadow-2xl border border-stone-200 overflow-hidden animate-in fade-in zoom-in-95">
            <div className="bg-stone-50 border-b border-stone-200 text-stone-900 p-4 flex items-center justify-between">
              <div className="flex items-center gap-2 font-bold text-base">
                <Plus className="w-5 h-5 text-emerald-600" />
                <span>Receive Inbound Stock: {selectedIngredient.name}</span>
              </div>
              <button onClick={() => setActiveModal(null)} className="text-stone-400 hover:text-stone-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handlePurchaseSubmit} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  Received Quantity ({selectedIngredient.baseUnit})
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={purchaseQty}
                  onChange={(e) => setPurchaseQty(Number(e.target.value))}
                  className="w-full bg-stone-50 border border-stone-300 rounded-xl px-3 py-2 text-base font-black text-stone-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  Purchase Unit Rate (₹ / {selectedIngredient.baseUnit})
                </label>
                <input
                  type="number"
                  step="1"
                  value={purchaseRate}
                  onChange={(e) => setPurchaseRate(Number(e.target.value))}
                  className="w-full bg-stone-50 border border-stone-300 rounded-xl px-3 py-2 text-base font-black text-stone-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="px-4 py-2 text-xs font-bold text-stone-600 hover:bg-stone-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow active:scale-95"
                >
                  Confirm Goods Receipt
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: LOG KITCHEN WASTAGE */}
      {activeModal === "WASTAGE" && selectedIngredient && (
        <div className="fixed inset-0 z-50 bg-stone-900/40 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-2xl shadow-2xl border border-stone-200 overflow-hidden animate-in fade-in zoom-in-95">
            <div className="bg-stone-50 border-b border-stone-200 text-stone-900 p-4 flex items-center justify-between">
              <div className="flex items-center gap-2 font-bold text-base">
                <Trash2 className="w-5 h-5 text-rose-600" />
                <span>Log Wastage: {selectedIngredient.name}</span>
              </div>
              <button onClick={() => setActiveModal(null)} className="text-stone-400 hover:text-stone-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleWastageSubmit} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  Wastage Quantity ({selectedIngredient.baseUnit})
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={selectedIngredient.physicalStock}
                  value={wastageQty}
                  onChange={(e) => setWastageQty(Number(e.target.value))}
                  className="w-full bg-stone-50 border border-stone-300 rounded-xl px-3 py-2 text-base font-black text-stone-900 focus:outline-none focus:ring-2 focus:ring-rose-500"
                  required
                />
                <span className="text-[10px] text-stone-400 mt-1 block">
                  Current physical stock: {selectedIngredient.physicalStock} {selectedIngredient.baseUnit}
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  Wastage Reason
                </label>
                <select
                  value={wastageReason}
                  onChange={(e) => setWastageReason(e.target.value)}
                  className="w-full bg-stone-50 border border-stone-300 rounded-xl px-3 py-2 text-xs font-bold text-stone-900"
                >
                  <option value="SPOILED">Spoiled / Bad Quality</option>
                  <option value="BURNT_FOOD">Burnt / Overcooked in Kitchen</option>
                  <option value="EXPIRED">Expired Past Shelf Life</option>
                  <option value="BROKEN_DROPPED">Spilled / Dropped on Floor</option>
                  <option value="CUSTOMER_RETURN">Customer Return / Complaint</option>
                  <option value="PREPARATION_LOSS">Trimming / Preparation Loss</option>
                  <option value="OTHER">Other Wastage</option>
                </select>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="px-4 py-2 text-xs font-bold text-stone-600 hover:bg-stone-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow active:scale-95"
                >
                  Confirm Wastage Deduction
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADD RAW INGREDIENT */}
      {activeModal === "ADD_INGREDIENT" && (
        <div className="fixed inset-0 z-50 bg-stone-900/50 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white w-full max-w-lg rounded-t-3xl sm:rounded-2xl shadow-2xl border border-stone-200 overflow-hidden text-xs animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-[#FAF8F5] border-b border-[#E7E2DA] p-4 flex items-center justify-between">
              <div className="flex items-center gap-2 font-black text-sm text-stone-900">
                <Boxes className="w-5 h-5 text-amber-600" />
                <span>Add Raw Ingredient to Inventory Ledger</span>
              </div>
              <button
                onClick={() => setActiveModal(null)}
                className="text-stone-400 hover:text-stone-700 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddIngredientSubmit} className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    Ingredient Name (English) *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Fresh Chicken Breast"
                    value={newIngName}
                    onChange={(e) => setNewIngName(e.target.value)}
                    className="w-full bg-stone-50 border border-stone-300 rounded-xl px-3 py-2 text-xs text-stone-900 font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    Local Name (मराठी)
                  </label>
                  <input
                    type="text"
                    placeholder="उदा. ताजे कोंबडी चिकन"
                    value={newIngLocalName}
                    onChange={(e) => setNewIngLocalName(e.target.value)}
                    className="w-full bg-stone-50 border border-stone-300 rounded-xl px-3 py-2 text-xs text-stone-900 font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    Category *
                  </label>
                  <select
                    value={newIngCategory}
                    onChange={(e) => setNewIngCategory(e.target.value)}
                    className="w-full bg-stone-50 border border-stone-300 rounded-xl px-3 py-2 text-xs font-semibold text-stone-900"
                  >
                    <option value="POULTRY">Poultry & Meat (मटण आणि चिकन)</option>
                    <option value="DAIRY">Dairy & Milk (दूध आणि दही)</option>
                    <option value="GRAINS">Grains & Flours (ज्वारी/बाजरी/तांदूळ)</option>
                    <option value="SPICES">Authentic Masalas (कोल्हापुरी कांदा लसूण मसाला)</option>
                    <option value="OIL_FAT">Cooking Oil & Ghee (खाद्यतेल आणि तूप)</option>
                    <option value="BEVERAGE">Beverages & Kokum (कोकम आणि नारळ)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    Base Measurement Unit *
                  </label>
                  <select
                    value={newIngUnit}
                    onChange={(e) => setNewIngUnit(e.target.value)}
                    className="w-full bg-stone-50 border border-stone-300 rounded-xl px-3 py-2 text-xs font-semibold text-stone-900"
                  >
                    <option value="kg">Kilograms (kg)</option>
                    <option value="g">Grams (g)</option>
                    <option value="l">Liters (l)</option>
                    <option value="ml">Milliliters (ml)</option>
                    <option value="pcs">Pieces (pcs)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-stone-700 mb-1">
                    Initial Stock
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={newIngStock}
                    onChange={(e) => setNewIngStock(Number(e.target.value))}
                    className="w-full bg-stone-50 border border-stone-300 rounded-xl px-2.5 py-1.5 text-xs font-bold text-stone-900 text-center"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-stone-700 mb-1">
                    Par Level
                  </label>
                  <input
                    type="number"
                    step="1"
                    min="1"
                    value={newIngParLevel}
                    onChange={(e) => setNewIngParLevel(Number(e.target.value))}
                    className="w-full bg-stone-50 border border-stone-300 rounded-xl px-2.5 py-1.5 text-xs font-bold text-stone-900 text-center"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-stone-700 mb-1">
                    Reorder Level
                  </label>
                  <input
                    type="number"
                    step="1"
                    min="1"
                    value={newIngReorderLevel}
                    onChange={(e) => setNewIngReorderLevel(Number(e.target.value))}
                    className="w-full bg-stone-50 border border-stone-300 rounded-xl px-2.5 py-1.5 text-xs font-bold text-stone-900 text-center"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-stone-700 mb-1">
                    Rate (₹/Unit)
                  </label>
                  <input
                    type="number"
                    step="1"
                    min="1"
                    value={newIngCost}
                    onChange={(e) => setNewIngCost(Number(e.target.value))}
                    className="w-full bg-stone-50 border border-stone-300 rounded-xl px-2.5 py-1.5 text-xs font-bold text-stone-900 text-center"
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="px-4 py-2 text-xs font-bold text-stone-600 hover:bg-stone-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 text-xs font-black bg-amber-600 hover:bg-amber-700 text-white rounded-xl shadow-xs active:scale-95 transition-all"
                >
                  Add to Inventory
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EDIT RAW INGREDIENT */}
      {activeModal === "EDIT_INGREDIENT" && editingIngredient && (
        <div className="fixed inset-0 z-50 bg-stone-900/50 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white w-full max-w-lg rounded-t-3xl sm:rounded-2xl shadow-2xl border border-stone-200 overflow-hidden text-xs animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-[#FAF8F5] border-b border-[#E7E2DA] p-4 flex items-center justify-between">
              <div className="flex items-center gap-2 font-black text-sm text-stone-900">
                <Edit2 className="w-4 h-4 text-amber-600" />
                <span>Edit Ingredient Thresholds: {editingIngredient.name}</span>
              </div>
              <button
                onClick={() => setActiveModal(null)}
                className="text-stone-400 hover:text-stone-700 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleEditIngredientSubmit} className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    Ingredient Name (English) *
                  </label>
                  <input
                    type="text"
                    required
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full bg-stone-50 border border-stone-300 rounded-xl px-3 py-2 text-xs text-stone-900 font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    Local Name (मराठी)
                  </label>
                  <input
                    type="text"
                    value={editLocalName}
                    onChange={(e) => setEditLocalName(e.target.value)}
                    className="w-full bg-stone-50 border border-stone-300 rounded-xl px-3 py-2 text-xs text-stone-900 font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-stone-700 mb-1">
                    Par Level ({editingIngredient.baseUnit})
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="1"
                    value={editParLevel}
                    onChange={(e) => setEditParLevel(Number(e.target.value))}
                    className="w-full bg-stone-50 border border-stone-300 rounded-xl px-2.5 py-1.5 text-xs font-bold text-stone-900 text-center"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-stone-700 mb-1">
                    Reorder Level ({editingIngredient.baseUnit})
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="1"
                    value={editReorderLevel}
                    onChange={(e) => setEditReorderLevel(Number(e.target.value))}
                    className="w-full bg-stone-50 border border-stone-300 rounded-xl px-2.5 py-1.5 text-xs font-bold text-stone-900 text-center"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-stone-700 mb-1">
                    Critical Level ({editingIngredient.baseUnit})
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="0.1"
                    value={editCriticalLevel}
                    onChange={(e) => setEditCriticalLevel(Number(e.target.value))}
                    className="w-full bg-stone-50 border border-stone-300 rounded-xl px-2.5 py-1.5 text-xs font-bold text-stone-900 text-center"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-stone-700 mb-1">
                    Cost (₹/{editingIngredient.baseUnit})
                  </label>
                  <input
                    type="number"
                    step="1"
                    min="1"
                    value={editCostPerUnit}
                    onChange={(e) => setEditCostPerUnit(Number(e.target.value))}
                    className="w-full bg-stone-50 border border-stone-300 rounded-xl px-2.5 py-1.5 text-xs font-bold text-stone-900 text-center"
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="px-4 py-2 text-xs font-bold text-stone-600 hover:bg-stone-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 text-xs font-black bg-amber-600 hover:bg-amber-700 text-white rounded-xl shadow-xs active:scale-95 transition-all"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
