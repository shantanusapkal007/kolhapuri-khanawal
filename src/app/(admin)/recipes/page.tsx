"use client";

import React, { useState, useEffect } from "react";
import {
  BookOpen,
  Layers,
  Plus,
  Edit2,
  Trash2,
  X,
  Sparkles,
  CheckCircle2,
} from "lucide-react";
import { globalRestaurantStore } from "@/lib/store/restaurant-store";
import { Recipe, RecipeComponent, StandardUnit } from "@/types/inventory";

export default function RecipesPage() {
  const store = globalRestaurantStore;
  const [, setTick] = useState(0);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRecipeId, setEditingRecipeId] = useState<string | null>(null);

  // Form states
  const [selectedMenuItemId, setSelectedMenuItemId] = useState<string>("");
  const [prepTimeMinutes, setPrepTimeMinutes] = useState<number>(15);
  const [portionsYielded, setPortionsYielded] = useState<number>(1);
  const [notes, setNotes] = useState<string>("");
  const [components, setComponents] = useState<
    Array<{
      id: string;
      ingredientId: string;
      quantity: number;
      unit: StandardUnit;
      yieldFactor: number;
    }>
  >([]);

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  useEffect(() => {
    store.recalculateMenuAvailability();
    setTick((t) => t + 1);
  }, []);

  const handleOpenAddModal = () => {
    setEditingRecipeId(null);
    const firstMenuItem = store.menuItems[0]?.id || "";
    setSelectedMenuItemId(firstMenuItem);
    setPrepTimeMinutes(15);
    setPortionsYielded(1);
    setNotes("");
    const firstIng = store.ingredients[0];
    setComponents([
      {
        id: `c-${Date.now()}`,
        ingredientId: firstIng?.id || "",
        quantity: 0.25,
        unit: (firstIng?.baseUnit || "kg") as StandardUnit,
        yieldFactor: 0.9,
      },
    ]);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (rec: Recipe) => {
    setEditingRecipeId(rec.id);
    setSelectedMenuItemId(rec.menuItemId);
    setPrepTimeMinutes(rec.preparationTimeMinutes);
    setPortionsYielded(rec.portionsYielded);
    setNotes(rec.notes || "");
    setComponents(
      rec.components.map((c) => ({
        id: c.id,
        ingredientId: c.ingredientId || "",
        quantity: c.quantity,
        unit: c.unit as StandardUnit,
        yieldFactor: c.yieldFactor,
      }))
    );
    setIsModalOpen(true);
  };

  const handleDeleteRecipe = (rec: Recipe) => {
    if (confirm(`Are you sure you want to delete the recipe BOM for "${rec.menuItemName}"?`)) {
      try {
        store.deleteRecipe(rec.id);
        setTick((t) => t + 1);
        showToast(`Recipe BOM for "${rec.menuItemName}" deleted!`);
      } catch (err: any) {
        alert(err.message);
      }
    }
  };

  const handleAddComponentRow = () => {
    const firstIng = store.ingredients[0];
    setComponents((prev) => [
      ...prev,
      {
        id: `c-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        ingredientId: firstIng?.id || "",
        quantity: 0.1,
        unit: (firstIng?.baseUnit || "kg") as StandardUnit,
        yieldFactor: 1.0,
      },
    ]);
  };

  const handleRemoveComponentRow = (id: string) => {
    setComponents((prev) => prev.filter((c) => c.id !== id));
  };

  const handleComponentChange = (id: string, field: string, val: any) => {
    setComponents((prev) =>
      prev.map((c) => {
        if (c.id !== id) return c;
        if (field === "ingredientId") {
          const ing = store.ingredients.find((i) => i.id === val);
          return {
            ...c,
            ingredientId: val,
            unit: (ing?.baseUnit || c.unit) as StandardUnit,
          };
        }
        return { ...c, [field]: val };
      })
    );
  };

  const calculatedCost = components.reduce((sum, c) => {
    const ing = store.ingredients.find((i) => i.id === c.ingredientId);
    const costPerUnit = ing?.currentCostPerUnit || 0;
    return sum + Number((costPerUnit * c.quantity).toFixed(2));
  }, 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (components.length === 0) {
      alert("Please add at least one ingredient component.");
      return;
    }

    const menuItem = store.menuItems.find((m) => m.id === selectedMenuItemId);
    if (!menuItem) {
      alert("Selected menu dish not found.");
      return;
    }

    const formattedComponents: RecipeComponent[] = components.map((c) => {
      const ing = store.ingredients.find((i) => i.id === c.ingredientId);
      return {
        id: c.id,
        recipeId: editingRecipeId || "",
        componentType: "RAW_INGREDIENT",
        ingredientId: c.ingredientId,
        ingredientName: ing?.name || "Raw Material",
        quantity: Number(c.quantity),
        unit: c.unit as StandardUnit,
        yieldFactor: Number(c.yieldFactor),
        isOptional: false,
      };
    });

    try {
      if (editingRecipeId) {
        store.updateRecipe(editingRecipeId, {
          menuItemId: selectedMenuItemId,
          menuItemName: menuItem.name,
          preparationTimeMinutes: Number(prepTimeMinutes),
          portionsYielded: Number(portionsYielded),
          estimatedCost: calculatedCost,
          notes,
          components: formattedComponents,
        });
        showToast(`Recipe BOM for ${menuItem.name} updated!`);
      } else {
        store.addRecipe({
          menuItemId: selectedMenuItemId,
          menuItemName: menuItem.name,
          preparationTimeMinutes: Number(prepTimeMinutes),
          portionsYielded: Number(portionsYielded),
          estimatedCost: calculatedCost,
          notes,
          components: formattedComponents,
        });
        showToast(`Recipe BOM for ${menuItem.name} created!`);
      }

      setTick((t) => t + 1);
      setIsModalOpen(false);
    } catch (err: any) {
      alert(err.message);
    }
  };

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
      <div className="luxury-card rounded-2xl p-5 sm:p-6 border border-[#E7E2DA] flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-white via-[#FAF8F5] to-white">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-600 to-amber-700 text-white flex items-center justify-center shadow-md shadow-amber-600/20 border border-amber-500/30 shrink-0">
            <BookOpen className="w-6 h-6 text-amber-100" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black text-stone-900 tracking-tight">
                Recipe Engine & Yield BOM
              </h1>
              <span className="bg-amber-50 text-amber-900 text-[10px] font-black px-2.5 py-0.5 rounded-full border border-amber-200 uppercase tracking-wider">
                Bill of Materials
              </span>
            </div>
            <p className="text-xs text-stone-500 font-medium mt-0.5">
              Ingredient consumption ratios, yield factors, theoretical portion calculations, and food cost margins.
            </p>
          </div>
        </div>

        <button
          onClick={handleOpenAddModal}
          className="flex items-center gap-2 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white text-xs font-black px-4 py-2.5 rounded-xl shadow-xs active:scale-95 transition-all self-start sm:self-auto"
        >
          <Plus className="w-4 h-4 text-amber-200" />
          <span>Add Recipe BOM</span>
        </button>
      </div>

      {/* Recipes Cards Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {store.recipes.map((rec) => {
          const menuItem = store.menuItems.find((m) => m.id === rec.menuItemId);
          const sellingPrice = menuItem?.sellingPrice || 320;
          const recipeCost = rec.estimatedCost || 92.5;
          const marginPct = Number((((sellingPrice - recipeCost) / sellingPrice) * 100).toFixed(1));

          return (
            <div
              key={rec.id}
              className="luxury-card rounded-2xl border border-[#E7E2DA] p-5 sm:p-6 flex flex-col justify-between space-y-4 hover:border-amber-400/80 hover:shadow-md transition-all"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h2 className="text-base font-black text-stone-900 leading-snug">{rec.menuItemName}</h2>
                    <span className="text-xs text-stone-500 font-medium">Version {rec.version} • Status: Active</span>
                  </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleOpenEditModal(rec)}
                        className="p-1.5 text-stone-500 hover:text-amber-800 hover:bg-amber-50 rounded-lg border border-stone-200 transition-all active:scale-95"
                        title="Edit Recipe BOM"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteRecipe(rec)}
                        className="p-1.5 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg border border-stone-200 transition-all active:scale-95"
                        title="Delete Recipe BOM"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                      <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-black px-2.5 py-1 rounded-full shadow-2xs">
                        {menuItem?.portionAvailability || 0} Portions Available
                      </span>
                    </div>
                </div>

                {/* Financial Margin Pills */}
                <div className="grid grid-cols-3 divide-x divide-[#E7E2DA] bg-[#FAF8F5] rounded-xl border border-[#E7E2DA] p-1.5 text-center text-xs mt-4">
                  <div className="px-1 py-1">
                    <span className="text-[10px] text-stone-400 uppercase font-black tracking-wider block">Selling Price</span>
                    <span className="font-black text-stone-900 text-sm">₹{sellingPrice}</span>
                  </div>
                  <div className="px-1 py-1">
                    <span className="text-[10px] text-amber-700/80 uppercase font-black tracking-wider block">Recipe Cost</span>
                    <span className="font-black text-amber-900 text-sm">₹{recipeCost}</span>
                  </div>
                  <div className="px-1 py-1">
                    <span className="text-[10px] text-emerald-700/80 uppercase font-black tracking-wider block">Gross Margin</span>
                    <span className="font-black text-emerald-900 text-sm">{marginPct}%</span>
                  </div>
                </div>

                {/* Recipe Components Breakdown */}
                <div className="mt-4 space-y-2">
                  <h3 className="text-xs font-bold text-stone-700 flex items-center gap-1">
                    <Layers className="w-3.5 h-3.5 text-stone-400" />
                    <span>Ingredient Bill of Materials (Per Portion):</span>
                  </h3>

                  <div className="divide-y divide-stone-100 text-xs">
                    {rec.components.map((comp) => (
                      <div key={comp.id} className="py-1.5 flex items-center justify-between">
                        <span className="text-stone-800 font-medium">{comp.ingredientName}</span>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-stone-900">
                            {comp.quantity} {comp.unit}
                          </span>
                          <span className="text-[10px] text-stone-400 font-semibold bg-stone-100 px-1.5 py-0.5 rounded">
                            Yield: {comp.yieldFactor * 100}%
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-stone-100 flex items-center justify-between text-xs text-stone-400">
                <span>Prep Time: {rec.preparationTimeMinutes} mins</span>
                <span className="text-stone-600 font-semibold">Authoritative Consumption Model</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* MODAL: ADD / EDIT RECIPE BOM */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-stone-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-xl rounded-2xl shadow-2xl border border-stone-200 overflow-hidden text-xs max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-[#FAF8F5] border-b border-[#E7E2DA] p-4 flex items-center justify-between">
              <div className="flex items-center gap-2 font-black text-sm text-stone-900">
                <BookOpen className="w-5 h-5 text-amber-600" />
                <span>{editingRecipeId ? "Edit Recipe Bill of Materials" : "Author New Recipe BOM"}</span>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-stone-400 hover:text-stone-700 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto flex-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    Select Catalog Dish *
                  </label>
                  <select
                    value={selectedMenuItemId}
                    onChange={(e) => setSelectedMenuItemId(e.target.value)}
                    disabled={!!editingRecipeId}
                    className="w-full bg-stone-50 border border-stone-300 rounded-xl px-3 py-2 text-xs font-semibold text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  >
                    {store.menuItems.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} (₹{m.sellingPrice})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1">
                      Prep Time (Mins)
                    </label>
                    <input
                      type="number"
                      required
                      min={1}
                      value={prepTimeMinutes}
                      onChange={(e) => setPrepTimeMinutes(Number(e.target.value))}
                      className="w-full bg-stone-50 border border-stone-300 rounded-xl px-3 py-2 text-xs font-semibold text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1">
                      Portions Yielded
                    </label>
                    <input
                      type="number"
                      required
                      min={1}
                      value={portionsYielded}
                      onChange={(e) => setPortionsYielded(Number(e.target.value))}
                      className="w-full bg-stone-50 border border-stone-300 rounded-xl px-3 py-2 text-xs font-semibold text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                </div>
              </div>

              {/* Dynamic Ingredient Components Table */}
              <div className="space-y-2 pt-2 border-t border-stone-100">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-stone-800">
                    Raw Material Components (Bill of Materials)
                  </label>
                  <button
                    type="button"
                    onClick={handleAddComponentRow}
                    className="text-amber-800 hover:text-amber-950 font-bold flex items-center gap-1 text-xs hover:bg-amber-50 px-2 py-1 rounded-lg transition-all"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Row</span>
                  </button>
                </div>

                <div className="space-y-2">
                  {components.map((c) => (
                    <div
                      key={c.id}
                      className="p-3 bg-stone-50 rounded-xl border border-stone-200 grid grid-cols-12 gap-2 items-center text-xs"
                    >
                      <div className="col-span-5">
                        <select
                          value={c.ingredientId}
                          onChange={(e) => handleComponentChange(c.id, "ingredientId", e.target.value)}
                          className="w-full bg-white border border-stone-300 rounded-lg px-2.5 py-1.5 font-medium text-stone-900"
                        >
                          {store.ingredients.map((ing) => (
                            <option key={ing.id} value={ing.id}>
                              {ing.name} (₹{ing.currentCostPerUnit}/{ing.baseUnit})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="col-span-3">
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            step="0.01"
                            min="0.001"
                            value={c.quantity}
                            onChange={(e) => handleComponentChange(c.id, "quantity", Number(e.target.value))}
                            className="w-full bg-white border border-stone-300 rounded-lg px-2 py-1.5 font-bold text-stone-900"
                          />
                          <span className="text-[11px] font-bold text-stone-500 shrink-0">{c.unit}</span>
                        </div>
                      </div>

                      <div className="col-span-3">
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-stone-500 shrink-0">Yield:</span>
                          <input
                            type="number"
                            step="0.05"
                            min="0.1"
                            max="1.0"
                            value={c.yieldFactor}
                            onChange={(e) => handleComponentChange(c.id, "yieldFactor", Number(e.target.value))}
                            className="w-full bg-white border border-stone-300 rounded-lg px-1.5 py-1.5 font-bold text-stone-900 text-center"
                          />
                        </div>
                      </div>

                      <div className="col-span-1 text-right">
                        <button
                          type="button"
                          onClick={() => handleRemoveComponentRow(c.id)}
                          disabled={components.length <= 1}
                          className="text-stone-400 hover:text-red-600 disabled:opacity-30 p-1"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Calculated Food Cost Summary */}
              <div className="p-3 bg-amber-50/80 rounded-xl border border-amber-200 flex items-center justify-between text-xs">
                <div>
                  <span className="font-bold text-amber-900 block">Calculated Recipe Cost:</span>
                  <span className="text-[11px] text-amber-700">Auto-computed from raw ingredient costs</span>
                </div>
                <span className="text-base font-black text-amber-950">₹{calculatedCost.toFixed(2)}</span>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-stone-600 hover:bg-stone-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 text-xs font-black bg-amber-600 hover:bg-amber-700 text-white rounded-xl shadow-xs active:scale-95 transition-all"
                >
                  {editingRecipeId ? "Save Recipe Changes" : "Create Recipe BOM"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
