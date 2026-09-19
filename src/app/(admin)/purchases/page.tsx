"use client";

import React, { useState } from "react";
import {
  ShoppingCart,
  Plus,
  RotateCcw,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  AlertCircle,
  Truck,
  IndianRupee,
  Search,
} from "lucide-react";
import { globalRestaurantStore } from "@/lib/store/restaurant-store";
import { QuickPurchaseEntry } from "@/types/inventory";

export default function PurchasesPage() {
  const store = globalRestaurantStore;
  const [, setTick] = useState(0);

  // Form State
  const [showAddModal, setShowAddModal] = useState(false);
  const [supplierId, setSupplierId] = useState(store.suppliers[0]?.id || "");
  const [ingredientId, setIngredientId] = useState(store.ingredients[0]?.id || "");
  const [quantity, setQuantity] = useState<number>(5);
  const [unit, setUnit] = useState<string>("kg");
  const [rate, setRate] = useState<number>(380);
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "UPI">("CASH");
  const [notes, setNotes] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterSupplier, setFilterSupplier] = useState("ALL");

  const totalAmount = quantity * rate;

  const handleCreatePurchase = (e: React.FormEvent) => {
    e.preventDefault();
    const sup = store.suppliers.find((s) => s.id === supplierId);
    const ing = store.ingredients.find((i) => i.id === ingredientId);

    store.recordQuickPurchase({
      supplierId,
      supplierName: sup?.name || "Supplier",
      ingredientId,
      ingredientName: ing ? `${ing.name} (${ing.localName || ""})` : "Raw Material",
      quantity,
      unit: (ing?.baseUnit || unit) as any,
      rate,
      totalAmount,
      paymentMethod,
      paymentStatus: "PAID",
      date: new Date().toISOString().split("T")[0],
      notes,
    });

    setShowAddModal(false);
    setNotes("");
    setTick((t) => t + 1);
  };

  const handleRepeat = (id: string) => {
    store.repeatPurchase(id);
    setTick((t) => t + 1);
  };

  const filteredPurchases = store.purchases.filter((p) => {
    const matchesSearch =
      p.ingredientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.supplierName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesSupplier = filterSupplier === "ALL" || p.supplierId === filterSupplier;
    return matchesSearch && matchesSupplier;
  });

  const totalPurchasesAmount = filteredPurchases.reduce((sum, p) => sum + p.totalAmount, 0);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 sm:p-6 rounded-2xl border border-[#E7E2DA] shadow-xs">
        <div>
          <div className="flex items-center gap-2 text-red-700 text-xs font-black uppercase tracking-wider">
            <ShoppingCart className="w-4 h-4" />
            <span>दुकान व माल खरेदी • Purchase Management</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-stone-900 mt-1">
            Fast Purchase Entry & Reorder
          </h1>
          <p className="text-xs sm:text-sm text-stone-500 font-medium">
            Directly updates live kitchen stock, price history trends, supplier ledger, and cash drawer outflow.
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white font-black px-5 py-3 rounded-xl text-sm shadow-md shadow-red-700/20 active:scale-95 transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>+ नवीन खरेदी नोंदवा (New Purchase)</span>
        </button>
      </div>

      {/* Quick Statistics Banner */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="luxury-card p-4 rounded-xl border border-[#E7E2DA]">
          <div className="text-xs font-bold text-stone-500">Total Purchase Volume</div>
          <div className="text-2xl font-black text-stone-900 mt-1">
            ₹{totalPurchasesAmount.toLocaleString("en-IN")}
          </div>
          <div className="text-[11px] text-stone-400 mt-0.5">{store.purchases.length} Recorded Deliveries</div>
        </div>

        <div className="luxury-card p-4 rounded-xl border border-[#E7E2DA]">
          <div className="text-xs font-bold text-stone-500">Active Daily Suppliers</div>
          <div className="text-2xl font-black text-stone-900 mt-1">{store.suppliers.length}</div>
          <div className="text-[11px] text-emerald-600 font-bold mt-0.5">Poultry, Mutton, Bhakri, Kirana, Gas</div>
        </div>

        <div className="luxury-card p-4 rounded-xl border border-[#E7E2DA]">
          <div className="text-xs font-bold text-stone-500">Chicken Current Rate</div>
          <div className="text-2xl font-black text-stone-900 mt-1 flex items-center gap-1.5">
            ₹390 <span className="text-xs text-stone-400 font-bold">/kg</span>
            <span className="text-xs font-bold text-red-600 flex items-center">
              <TrendingUp className="w-3.5 h-3.5" /> +2.6%
            </span>
          </div>
          <div className="text-[11px] text-stone-400 mt-0.5">Raju Poultry Farm Baner</div>
        </div>

        <div className="luxury-card p-4 rounded-xl border border-[#E7E2DA]">
          <div className="text-xs font-bold text-stone-500">Mutton Current Rate</div>
          <div className="text-2xl font-black text-stone-900 mt-1 flex items-center gap-1.5">
            ₹770 <span className="text-xs text-stone-400 font-bold">/kg</span>
            <span className="text-xs font-bold text-red-600 flex items-center">
              <TrendingUp className="w-3.5 h-3.5" /> +2.7%
            </span>
          </div>
          <div className="text-[11px] text-stone-400 mt-0.5">Prakash Goat Mutton Mart</div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-[#E7E2DA] flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
          <input
            type="text"
            placeholder="Search items or suppliers..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-stone-200 bg-stone-50/50 focus:outline-none focus:border-red-500 font-medium"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <span className="text-xs font-bold text-stone-500 whitespace-nowrap">Supplier:</span>
          <select
            value={filterSupplier}
            onChange={(e) => setFilterSupplier(e.target.value)}
            className="text-xs font-bold py-2 px-3 rounded-lg border border-stone-200 bg-white focus:outline-none"
          >
            <option value="ALL">All Suppliers (सर्व पुरवठादार)</option>
            {store.suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Purchases List Table */}
      <div className="bg-white rounded-2xl border border-[#E7E2DA] overflow-hidden shadow-xs">
        <div className="p-4 border-b border-[#E7E2DA] flex items-center justify-between bg-[#FAF8F5]">
          <h2 className="text-sm font-black text-stone-900">Recorded Deliveries & Purchases History</h2>
          <span className="text-xs font-bold text-stone-500">{filteredPurchases.length} Transactions</span>
        </div>

        {filteredPurchases.length === 0 ? (
          <div className="p-8 text-center text-stone-400 text-xs font-semibold">
            कोणतीही खरेदी सापडली नाही (No purchases found)
          </div>
        ) : (
          <>
            {/* Mobile Purchase Cards */}
            <div className="sm:hidden divide-y divide-stone-100 p-2 space-y-2">
              {filteredPurchases.map((purchase) => (
                <div key={purchase.id} className="p-3 bg-[#FAF8F5] rounded-xl border border-stone-200/80 space-y-2 text-xs">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-bold text-stone-900 text-xs flex items-center gap-1">
                        <Truck className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                        <span className="truncate">{purchase.supplierName}</span>
                      </div>
                      <div className="text-[10px] text-stone-400 font-mono mt-0.5">
                        {purchase.date}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-mono font-black text-stone-900 text-sm">
                        ₹{purchase.totalAmount.toLocaleString("en-IN")}
                      </div>
                      <span
                        className={`inline-flex items-center px-2 py-0.2 rounded-full text-[9px] font-black uppercase ${
                          purchase.paymentMethod === "CASH"
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-blue-100 text-blue-800"
                        }`}
                      >
                        {purchase.paymentMethod}
                      </span>
                    </div>
                  </div>

                  <div className="p-2 rounded-lg bg-white border border-stone-200/60 flex items-center justify-between text-[11px]">
                    <div>
                      <span className="font-bold text-stone-800">{purchase.ingredientName}</span>
                      <div className="text-[10px] text-stone-500">
                        {purchase.quantity} {purchase.unit} @ ₹{purchase.rate}/{purchase.unit}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRepeat(purchase.id)}
                      className="inline-flex items-center gap-1 bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold px-2.5 py-1.5 min-h-[36px] rounded-lg text-xs border border-amber-200 active:scale-95 transition-all touch-manipulation shrink-0"
                      title="1-Tap Reorder with today's date"
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-amber-700" />
                      <span>Reorder</span>
                    </button>
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
                    <th className="py-3 px-4">Supplier</th>
                    <th className="py-3 px-4">Item & Quantity</th>
                    <th className="py-3 px-4">Rate</th>
                    <th className="py-3 px-4">Total Amount</th>
                    <th className="py-3 px-4">Paid Via</th>
                    <th className="py-3 px-4 text-right">Quick Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {filteredPurchases.map((purchase) => (
                    <tr key={purchase.id} className="hover:bg-amber-50/30 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-bold text-stone-700 whitespace-nowrap">
                        {purchase.date}
                      </td>
                      <td className="py-3.5 px-4 font-bold text-stone-900 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <Truck className="w-3.5 h-3.5 text-stone-400" />
                          {purchase.supplierName}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-stone-900">{purchase.ingredientName}</div>
                        <div className="text-[11px] text-stone-500 font-medium">
                          Qty: <span className="font-bold text-stone-800">{purchase.quantity} {purchase.unit}</span>
                          {purchase.notes && ` • ${purchase.notes}`}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold text-stone-700">
                        ₹{purchase.rate}/{purchase.unit}
                      </td>
                      <td className="py-3.5 px-4 font-mono font-black text-base text-stone-900">
                        ₹{purchase.totalAmount.toLocaleString("en-IN")}
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold ${
                            purchase.paymentMethod === "CASH"
                              ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                              : "bg-blue-100 text-blue-800 border border-blue-200"
                          }`}
                        >
                          {purchase.paymentMethod}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => handleRepeat(purchase.id)}
                          className="inline-flex items-center gap-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold px-3 py-1.5 rounded-lg text-xs border border-amber-200 active:scale-95 transition-all touch-manipulation"
                          title="1-Tap Reorder with today's date"
                        >
                          <RotateCcw className="w-3.5 h-3.5 text-amber-700" />
                          <span>1-Tap Reorder</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* New Purchase Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-stone-900/40 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 max-w-lg w-full border border-[#E7E2DA] shadow-2xl space-y-4 animate-in fade-in zoom-in-95 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#E7E2DA] pb-3">
              <div>
                <h3 className="text-base font-black text-stone-900">खरेदी नोंदवा (Record New Purchase)</h3>
                <p className="text-xs text-stone-500 font-medium">Adds to stock & updates cash/UPI ledger</p>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="w-8 h-8 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-500 font-bold flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreatePurchase} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-stone-700">Supplier (पुरवठादार)</label>
                <select
                  value={supplierId}
                  onChange={(e) => setSupplierId(e.target.value)}
                  className="w-full mt-1 p-2.5 text-sm rounded-xl border border-stone-200 bg-white font-bold"
                  required
                >
                  {store.suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.suppliedItems.join(", ")})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-stone-700">Ingredient / Stock Item (वस्तू)</label>
                <select
                  value={ingredientId}
                  onChange={(e) => {
                    setIngredientId(e.target.value);
                    const ing = store.ingredients.find((i) => i.id === e.target.value);
                    if (ing) {
                      setUnit(ing.baseUnit);
                      setRate(ing.currentCostPerUnit);
                    }
                  }}
                  className="w-full mt-1 p-2.5 text-sm rounded-xl border border-stone-200 bg-white font-bold"
                  required
                >
                  {store.ingredients.map((ing) => (
                    <option key={ing.id} value={ing.id}>
                      {ing.name} ({ing.localName}) — Current: {ing.physicalStock} {ing.baseUnit}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-bold text-stone-700">Quantity (नग/किलो)</label>
                  <input
                    type="number"
                    step="any"
                    min="0.1"
                    value={quantity}
                    onChange={(e) => setQuantity(parseFloat(e.target.value) || 0)}
                    className="w-full mt-1 p-2.5 text-sm rounded-xl border border-stone-200 bg-white font-bold"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-stone-700">Unit</label>
                  <input
                    type="text"
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    className="w-full mt-1 p-2.5 text-sm rounded-xl border border-stone-200 bg-stone-50 font-bold"
                    readOnly
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-stone-700">Rate per {unit} (₹)</label>
                  <input
                    type="number"
                    step="any"
                    min="1"
                    value={rate}
                    onChange={(e) => setRate(parseFloat(e.target.value) || 0)}
                    className="w-full mt-1 p-2.5 text-sm rounded-xl border border-stone-200 bg-white font-bold"
                    required
                  />
                </div>
              </div>

              <div className="bg-amber-50/60 p-3 rounded-xl border border-amber-200 flex items-center justify-between">
                <span className="text-xs font-bold text-amber-900">Total Purchase Value:</span>
                <span className="text-lg font-black text-amber-950 font-mono">₹{totalAmount.toLocaleString("en-IN")}</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-stone-700">Payment Mode</label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as "CASH" | "UPI")}
                    className="w-full mt-1 p-2.5 text-sm rounded-xl border border-stone-200 bg-white font-bold"
                  >
                    <option value="CASH">CASH (गल्ला रोख)</option>
                    <option value="UPI">UPI (बँक ट्रान्सफर)</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-stone-700">Remarks / Batch Note</label>
                  <input
                    type="text"
                    placeholder="e.g. Fresh morning lot"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full mt-1 p-2.5 text-sm rounded-xl border border-stone-200 bg-white font-medium"
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-stone-200 text-stone-600 font-bold text-xs hover:bg-stone-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-md shadow-red-700/20 active:scale-95"
                >
                  Save & Update Stock
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
