"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  UtensilsCrossed,
  Utensils,
  Search,
  Plus,
  Edit2,
  CheckCircle2,
  AlertTriangle,
  X,
  Sparkles,
  Layers,
  Flame,
  Check,
  Trash2,
} from "lucide-react";
import { globalRestaurantStore } from "@/lib/store/restaurant-store";
import { MenuItem } from "@/types/orders";

export default function MenuManagementPage() {
  const store = globalRestaurantStore;
  const [, setTick] = useState(0);

  // Filter & Search State
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [dietFilter, setDietFilter] = useState<"ALL" | "VEG" | "NON_VEG" | "OUT_OF_STOCK">("ALL");

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    name: "",
    localName: "",
    code: "",
    categoryId: "cat-veg-soup",
    categoryName: "Veg Soup",
    description: "",
    sellingPrice: 150,
    costPrice: 45,
    hasVariants: false,
    halfPrice: 150,
    fullPrice: 250,
    isVeg: false,
    isThali: false,
    stationCode: "MAIN_KITCHEN" as any,
    stockStatus: "AVAILABLE" as "AVAILABLE" | "OUT_OF_STOCK",
  });

  // Toast Notification
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    store.recalculateMenuAvailability();
    setTick((t) => t + 1);
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleOpenAddModal = () => {
    setEditingItem(null);
    const defaultCat = store.categories[0] || { id: "cat-veg-soup", name: "Veg Soup" };
    setFormData({
      name: "",
      localName: "",
      code: `DISH_${Date.now().toString().slice(-4)}`,
      categoryId: defaultCat.id,
      categoryName: defaultCat.name,
      description: "",
      sellingPrice: 200,
      costPrice: 60,
      hasVariants: false,
      halfPrice: 150,
      fullPrice: 250,
      isVeg: false,
      isThali: false,
      stationCode: "MAIN_KITCHEN",
      stockStatus: "AVAILABLE",
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (item: MenuItem) => {
    setEditingItem(item);
    const hasVariants = Boolean(item.variants && item.variants.length > 0);
    const halfVar = item.variants?.find((v) => v.name.toLowerCase().includes("half"));
    const fullVar = item.variants?.find((v) => v.name.toLowerCase().includes("full"));
    setFormData({
      name: item.name,
      localName: item.localName || "",
      code: item.code,
      categoryId: item.categoryId,
      categoryName: item.categoryName || "Dishes",
      description: item.description || "",
      sellingPrice: item.sellingPrice,
      costPrice: item.costPrice || 0,
      hasVariants,
      halfPrice: halfVar ? halfVar.price : item.sellingPrice,
      fullPrice: fullVar ? fullVar.price : Math.round(item.sellingPrice * 1.5),
      isVeg: item.isVeg,
      isThali: item.isThali,
      stationCode: item.stationCode,
      stockStatus: item.stockStatus === "OUT_OF_STOCK" ? "OUT_OF_STOCK" : "AVAILABLE",
    });
    setIsModalOpen(true);
  };

  const handleToggleStockStatus = (item: MenuItem, e: React.MouseEvent) => {
    e.stopPropagation();
    const newStatus = item.stockStatus === "OUT_OF_STOCK" ? "AVAILABLE" : "OUT_OF_STOCK";
    store.updateMenuItem(item.id, { stockStatus: newStatus });
    setTick((t) => t + 1);
    showToast(
      newStatus === "OUT_OF_STOCK"
        ? `Marked "${item.name}" as 86 / OUT OF STOCK`
        : `Marked "${item.name}" as AVAILABLE in service`
    );
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const variants = formData.hasVariants
        ? [
            { name: "Half", price: Number(formData.halfPrice) },
            { name: "Full", price: Number(formData.fullPrice) },
          ]
        : undefined;
      const finalPrice = formData.hasVariants ? Number(formData.halfPrice) : Number(formData.sellingPrice);

      if (editingItem) {
        store.updateMenuItem(editingItem.id, {
          name: formData.name,
          localName: formData.localName,
          sellingPrice: finalPrice,
          price: finalPrice,
          variants,
          costPrice: Number(formData.costPrice),
          description: formData.description,
          categoryId: formData.categoryId,
          categoryName: formData.categoryName,
          isVeg: formData.isVeg,
          foodType: formData.isVeg ? "VEG" : "NON_VEG",
          stockStatus: formData.stockStatus,
        });
        showToast(`Updated "${formData.name}" (₹${finalPrice}) successfully!`);
      } else {
        store.addMenuItem({
          categoryId: formData.categoryId,
          categoryName: formData.categoryName,
          name: formData.name,
          localName: formData.localName,
          code: formData.code,
          description: formData.description,
          sellingPrice: finalPrice,
          price: finalPrice,
          variants,
          costPrice: Number(formData.costPrice),
          isVeg: formData.isVeg,
          foodType: formData.isVeg ? "VEG" : "NON_VEG",
          isThali: formData.isThali,
          stationCode: formData.stationCode,
          taxCategoryId: "tax-gst5",
          gstRate: 5,
          stockStatus: formData.stockStatus,
          isDailySpecial: false,
          preparationTimeMinutes: 10,
          displayOrder: store.menuItems.length + 1,
          sortOrder: store.menuItems.length + 1,
          isActive: true,
        });
        showToast(`Added new dish "${formData.name}" to menu!`);
      }
      setTick((t) => t + 1);
      setIsModalOpen(false);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDeleteDish = (id: string, name: string) => {
    const confirmDelete = confirm(`Are you sure you want to delete "${name}" from the menu catalog?`);
    if (!confirmDelete) return;

    try {
      store.deleteMenuItem(id);
      setTick((t) => t + 1);
      if (isModalOpen) setIsModalOpen(false);
      showToast(`Dish "${name}" removed from catalog!`);
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Filter menu items
  const filteredItems = store.menuItems.filter((item) => {
    const matchesCategory = selectedCategory === "ALL" || item.categoryId === selectedCategory;
    const matchesSearch =
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.localName && item.localName.toLowerCase().includes(searchQuery.toLowerCase())) ||
      item.code.toLowerCase().includes(searchQuery.toLowerCase());

    let matchesDiet = true;
    if (dietFilter === "VEG") matchesDiet = item.isVeg;
    if (dietFilter === "NON_VEG") matchesDiet = !item.isVeg;
    if (dietFilter === "OUT_OF_STOCK") matchesDiet = item.stockStatus === "OUT_OF_STOCK";

    return matchesCategory && matchesSearch && matchesDiet;
  });

  const totalDishes = store.menuItems.length;
  const vegCount = store.menuItems.filter((i) => i.isVeg).length;
  const nonVegCount = store.menuItems.filter((i) => !i.isVeg).length;
  const outOfStockCount = store.menuItems.filter((i) => i.stockStatus === "OUT_OF_STOCK").length;

  return (
    <div className="space-y-6">
      {/* Feedback Toast */}
      {toastMessage && (
        <div className="fixed bottom-4 right-4 z-50 bg-stone-900 text-amber-300 border border-amber-500/40 px-4 py-3 rounded-xl shadow-xl flex items-center gap-2 text-sm font-semibold animate-bounce">
          <Sparkles className="w-4 h-4 text-amber-400" />
          {toastMessage}
        </div>
      )}

      {/* Luxury Hero Header */}
      <div className="luxury-card rounded-2xl p-5 sm:p-6 border border-[#E7E2DA] flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-white via-[#FAF8F5] to-white">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-red-600 to-red-700 text-white flex items-center justify-center shadow-md shadow-red-600/20 border border-red-500/30 shrink-0">
            <UtensilsCrossed className="w-6 h-6 text-amber-100" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black text-stone-900 tracking-tight">
                Menu & Pricing Catalog
              </h1>
              <span className="bg-red-50 text-red-800 text-xs font-black px-2.5 py-0.5 rounded-full border border-red-200 shadow-2xs">
                खानावळ मेनू सूची
              </span>
            </div>
            <p className="text-xs text-stone-500 font-medium mt-0.5">
              Edit dish prices, toggle 86 / out-of-stock availability, update descriptions, and add new authentic dishes.
            </p>
          </div>
        </div>

        {store.currentUser.role === "WAITER" ? (
          <Link
            href="/waiter"
            className="flex items-center gap-1.5 bg-gradient-to-r from-red-600 via-red-700 to-red-800 hover:from-red-700 hover:to-red-900 text-white text-xs sm:text-sm font-black px-4 py-2.5 rounded-xl shadow-sm shadow-red-700/20 active:scale-95 transition-all self-start sm:self-auto shrink-0"
          >
            <Utensils className="w-4 h-4 text-amber-200" />
            <span>Floor Tables (ऑर्डर घ्या) →</span>
          </Link>
        ) : (
          <button
            onClick={handleOpenAddModal}
            className="flex items-center gap-1.5 bg-gradient-to-r from-red-600 via-red-700 to-red-800 hover:from-red-700 hover:to-red-900 text-white text-xs sm:text-sm font-black px-4 py-2.5 rounded-xl shadow-sm shadow-red-700/20 active:scale-95 transition-all self-start sm:self-auto shrink-0"
          >
            <Plus className="w-4 h-4 text-amber-200" />
            <span>+ Add New Dish</span>
          </button>
        )}
      </div>

      {/* Metric Cards Banner */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 sm:gap-4">
        <div className="luxury-card p-4 rounded-2xl border border-[#E7E2DA]">
          <span className="text-[10px] text-stone-500 uppercase font-black tracking-wider block">Total Catalog</span>
          <span className="text-2xl font-black text-stone-900 mt-1 block">{totalDishes} Dishes</span>
          <span className="text-[11px] text-stone-400 font-medium">Active Khanawal Menu</span>
        </div>

        <div className="luxury-card p-4 rounded-2xl border border-[#E7E2DA]">
          <span className="text-[10px] text-emerald-700 uppercase font-black tracking-wider block">Vegetarian</span>
          <span className="text-2xl font-black text-emerald-800 mt-1 block">{vegCount} Items</span>
          <span className="text-[11px] text-emerald-600 font-medium">Pithla, Shev Bhaji, Chapati</span>
        </div>

        <div className="luxury-card p-4 rounded-2xl border border-[#E7E2DA]">
          <span className="text-[10px] text-red-700 uppercase font-black tracking-wider block">Non-Veg Specials</span>
          <span className="text-2xl font-black text-red-800 mt-1 block">{nonVegCount} Items</span>
          <span className="text-[11px] text-red-600 font-medium">Chicken, Mutton, Sukka, Rassa</span>
        </div>

        <div className={`luxury-card p-4 rounded-2xl border ${outOfStockCount > 0 ? "border-amber-300 bg-amber-50/40" : "border-[#E7E2DA]"}`}>
          <span className="text-[10px] text-amber-800 uppercase font-black tracking-wider block">86 / Out of Stock</span>
          <span className="text-2xl font-black text-amber-900 mt-1 block">{outOfStockCount} Items</span>
          <span className="text-[11px] text-stone-500 font-medium">Unavailable to Waiters</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="luxury-card p-4 rounded-2xl border border-[#E7E2DA] space-y-3 bg-white">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              type="text"
              placeholder="Search dishes by name (e.g. Chicken Thali, Bhakri, तांबडा)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#FAF8F5] border border-[#E7E2DA] rounded-xl pl-9 pr-4 py-2 text-xs sm:text-sm font-semibold text-stone-900 focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>

          {/* Diet / Status Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none text-xs">
            <button
              onClick={() => setDietFilter("ALL")}
              className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all border ${
                dietFilter === "ALL"
                  ? "bg-stone-900 text-amber-200 border-stone-900 shadow-2xs"
                  : "bg-white text-stone-600 border-[#E7E2DA] hover:bg-[#FAF8F5]"
              }`}
            >
              All Items
            </button>
            <button
              onClick={() => setDietFilter("NON_VEG")}
              className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all border ${
                dietFilter === "NON_VEG"
                  ? "bg-red-700 text-white border-red-700 shadow-2xs"
                  : "bg-white text-red-800 border-[#E7E2DA] hover:bg-red-50/50"
              }`}
            >
              Non-Veg ({nonVegCount})
            </button>
            <button
              onClick={() => setDietFilter("VEG")}
              className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all border ${
                dietFilter === "VEG"
                  ? "bg-emerald-700 text-white border-emerald-700 shadow-2xs"
                  : "bg-white text-emerald-800 border-[#E7E2DA] hover:bg-emerald-50/50"
              }`}
            >
              Veg ({vegCount})
            </button>
            {outOfStockCount > 0 && (
              <button
                onClick={() => setDietFilter("OUT_OF_STOCK")}
                className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all border ${
                  dietFilter === "OUT_OF_STOCK"
                    ? "bg-amber-600 text-white border-amber-600 shadow-2xs"
                    : "bg-amber-50 text-amber-900 border-amber-300"
                }`}
              >
                86 / Out of Stock ({outOfStockCount})
              </button>
            )}
          </div>
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 scrollbar-none text-xs pt-1 border-t border-[#E7E2DA]/60">
          <button
            onClick={() => setSelectedCategory("ALL")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
              selectedCategory === "ALL"
                ? "bg-red-600 text-white border border-red-600 font-black shadow-2xs"
                : "text-stone-600 hover:text-stone-900 bg-white border border-[#E7E2DA] hover:bg-[#FAF8F5]"
            }`}
          >
            All Categories ({totalDishes})
          </button>
          {store.categories.map((cat) => {
            const count = store.menuItems.filter((i) => i.categoryId === cat.id).length;
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                  selectedCategory === cat.id
                    ? "bg-red-600 text-white border border-red-600 font-black shadow-2xs"
                    : "text-stone-600 hover:text-stone-900 bg-white border border-[#E7E2DA] hover:bg-[#FAF8F5]"
                }`}
              >
                {cat.name} {count > 0 ? `(${count})` : ""}
              </button>
            );
          })}
        </div>
      </div>

      {/* Menu Dishes Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-5">
        {filteredItems.length === 0 ? (
          <div className="col-span-full py-12 text-center text-stone-400">
            <UtensilsCrossed className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm font-bold text-stone-600">No dishes match your filter.</p>
            <p className="text-xs text-stone-400 mt-1">Try resetting the search or category filter.</p>
          </div>
        ) : (
          filteredItems.map((item) => {
            const isOutOfStock = item.stockStatus === "OUT_OF_STOCK";
            const cost = item.costPrice || 0;
            const marginPct = item.sellingPrice > 0 ? Math.round(((item.sellingPrice - cost) / item.sellingPrice) * 100) : 0;

            return (
              <div
                key={item.id}
                className={`luxury-card rounded-2xl border transition-all flex flex-col justify-between overflow-hidden ${
                  isOutOfStock
                    ? "border-amber-300 bg-amber-50/20 opacity-85"
                    : "border-[#E7E2DA] hover:border-red-300/80 shadow-xs hover:shadow-md"
                }`}
              >
                {/* Card Top */}
                <div className="p-4 sm:p-5 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2.5">
                      {/* Veg / Non-Veg Indicator Symbol */}
                      <span
                        className={`w-4 h-4 border-2 rounded-xs flex items-center justify-center shrink-0 mt-1 ${
                          item.isVeg ? "border-emerald-600" : "border-red-700"
                        }`}
                        title={item.isVeg ? "Pure Vegetarian" : "Non-Vegetarian"}
                      >
                        <span
                          className={`w-2 h-2 rounded-full ${
                            item.isVeg ? "bg-emerald-600" : "bg-red-700"
                          }`}
                        />
                      </span>

                      <div>
                        <h2 className="font-black text-stone-900 text-base leading-snug">{item.name}</h2>
                        {item.localName && (
                          <p className="text-xs font-bold text-stone-500 mt-0.5">{item.localName}</p>
                        )}
                      </div>
                    </div>

                    {/* Stock Status Pill */}
                    <span
                      className={`text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider shrink-0 ${
                        isOutOfStock
                          ? "bg-amber-100 text-amber-900 border border-amber-300"
                          : "bg-emerald-50 text-emerald-800 border border-emerald-200"
                      }`}
                    >
                      {isOutOfStock ? "86 Out of Stock" : "In Stock"}
                    </span>
                  </div>

                  {item.description && (
                    <p className="text-xs text-stone-600 font-medium leading-relaxed bg-[#FAF8F5] p-2.5 rounded-xl border border-[#E7E2DA]/80">
                      {item.description}
                    </p>
                  )}

                  {/* Half / Full Variants Badge */}
                  {item.variants && item.variants.length > 0 && (
                    <div className="flex items-center gap-1.5 flex-wrap bg-amber-50/70 p-2 rounded-xl border border-amber-200">
                      <span className="text-[10px] uppercase font-black tracking-wider text-amber-900">Variants:</span>
                      {item.variants.map((v) => (
                        <span
                          key={v.name}
                          className="bg-white text-stone-900 text-xs font-black px-2.5 py-0.5 rounded-lg border border-amber-300 shadow-2xs flex items-center gap-1"
                        >
                          <span className="text-stone-600 font-bold">{v.name}</span>
                          <strong className="text-red-700">₹{v.price}</strong>
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Financial Metrics Strip */}
                  {store.currentUser.role === "WAITER" ? (
                    <div className="grid grid-cols-2 divide-x divide-[#E7E2DA] bg-[#FAF8F5] rounded-xl border border-[#E7E2DA] p-2 text-center text-xs">
                      <div>
                        <span className="text-[10px] text-stone-400 uppercase font-bold block">Selling Price</span>
                        <span className="font-black text-stone-900 text-base">₹{item.sellingPrice}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-emerald-700 uppercase font-bold block">Available Stock</span>
                        <span className="font-black text-emerald-800 text-sm">
                          {item.portionAvailability > 0 ? `${item.portionAvailability} Portions` : "0 Portions"}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 divide-x divide-[#E7E2DA] bg-[#FAF8F5] rounded-xl border border-[#E7E2DA] p-2 text-center text-xs">
                      <div>
                        <span className="text-[10px] text-stone-400 uppercase font-bold block">Selling Price</span>
                        <span className="font-black text-stone-900 text-base">₹{item.sellingPrice}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-amber-700 uppercase font-bold block">Recipe Cost</span>
                        <span className="font-black text-amber-900 text-base">₹{cost}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-emerald-700 uppercase font-bold block">Margin</span>
                        <span className="font-black text-emerald-800 text-base">{marginPct}%</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Card Actions Footer */}
                {store.currentUser.role === "WAITER" ? (
                  <div className="p-3 bg-[#FAF8F5] border-t border-[#E7E2DA] flex items-center justify-between gap-2">
                    <span className="text-[11px] font-bold text-stone-500 truncate">
                      Station: <strong className="text-stone-800">{item.stationCode}</strong>
                    </span>
                    <Link
                      href="/waiter"
                      className="inline-flex items-center gap-1 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white text-xs font-bold px-3 py-1.5 rounded-xl shadow-2xs active:scale-95 transition-all shrink-0"
                    >
                      <Utensils className="w-3.5 h-3.5 text-amber-200" />
                      <span>Take Order →</span>
                    </Link>
                  </div>
                ) : (
                  <div className="p-3 bg-[#FAF8F5] border-t border-[#E7E2DA] flex items-center justify-between gap-2">
                    {/* 86 Toggle Button */}
                    <button
                      onClick={(e) => handleToggleStockStatus(item, e)}
                      className={`flex items-center gap-1.5 text-xs font-black px-3 py-1.5 rounded-xl border transition-all active:scale-95 shadow-2xs ${
                        isOutOfStock
                          ? "bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700"
                          : "bg-white text-amber-800 border-amber-300 hover:bg-amber-50"
                      }`}
                    >
                      {isOutOfStock ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>Restore to Stock</span>
                        </>
                      ) : (
                        <>
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                          <span>86 / Mark Out</span>
                        </>
                      )}
                    </button>

                    {/* Card Right Actions */}
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleOpenEditModal(item)}
                        className="flex items-center gap-1.5 bg-white hover:bg-stone-100 text-stone-700 border border-[#E7E2DA] text-xs font-bold px-3 py-1.5 rounded-xl active:scale-95 transition-all shadow-2xs"
                      >
                        <Edit2 className="w-3 h-3" />
                        <span>Edit</span>
                      </button>
                      <button
                        onClick={() => handleDeleteDish(item.id, item.name)}
                        className="p-1.5 text-stone-400 hover:text-rose-600 hover:bg-rose-50 border border-[#E7E2DA] rounded-xl transition-all"
                        title="Delete dish from catalog"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* MODAL: ADD / EDIT DISH */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-stone-900/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="luxury-card bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-[#E7E2DA] overflow-hidden">
            {/* Modal Header */}
            <div className="bg-[#FAF8F5] border-b border-[#E7E2DA] p-4 sm:p-5 flex items-center justify-between">
              <div className="flex items-center gap-2.5 font-black text-stone-900 text-base">
                <UtensilsCrossed className="w-5 h-5 text-red-600" />
                <span>{editingItem ? `Edit Dish: ${editingItem.name}` : "Add New Menu Item"}</span>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-stone-400 hover:text-stone-700 p-1 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleFormSubmit} className="p-5 sm:p-6 space-y-4 text-xs max-h-[80vh] overflow-y-auto">
              {/* Dish English Name */}
              <div>
                <label className="block font-black text-stone-700 uppercase tracking-wider text-[10px] mb-1">
                  Dish English Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Special Chicken Thali"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-[#FAF8F5] border border-[#E7E2DA] rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-stone-900 focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>

              {/* Dish Local Marathi Name */}
              <div>
                <label className="block font-black text-stone-700 uppercase tracking-wider text-[10px] mb-1">
                  Marathi Local Name (मराठी नाव)
                </label>
                <input
                  type="text"
                  placeholder="e.g. स्पेशल चिकन थाळी (तांबडा-पांढरा रस्सा)"
                  value={formData.localName}
                  onChange={(e) => setFormData({ ...formData, localName: e.target.value })}
                  className="w-full bg-[#FAF8F5] border border-[#E7E2DA] rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-stone-900 focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>

              {/* Pricing Row */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-black text-stone-700 uppercase tracking-wider text-[10px] mb-1">
                    Selling Price (₹) *
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    step="any"
                    value={formData.sellingPrice}
                    onChange={(e) => setFormData({ ...formData, sellingPrice: Number(e.target.value) })}
                    className="w-full bg-[#FAF8F5] border border-[#E7E2DA] rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-black text-stone-900 focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                </div>

                <div>
                  <label className="block font-black text-stone-700 uppercase tracking-wider text-[10px] mb-1">
                    Recipe Cost (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={formData.costPrice}
                    onChange={(e) => setFormData({ ...formData, costPrice: Number(e.target.value) })}
                    className="w-full bg-[#FAF8F5] border border-[#E7E2DA] rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-stone-900 focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                </div>
              </div>

              {/* Category & Diet Row */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-black text-stone-700 uppercase tracking-wider text-[10px] mb-1">
                    Category *
                  </label>
                  <select
                    value={formData.categoryId}
                    onChange={(e) => {
                      const selected = store.categories.find((c) => c.id === e.target.value);
                      setFormData({
                        ...formData,
                        categoryId: e.target.value,
                        categoryName: selected?.name || "Dishes",
                      });
                    }}
                    className="w-full bg-[#FAF8F5] border border-[#E7E2DA] rounded-xl px-3.5 py-2.5 text-xs font-bold text-stone-900 focus:outline-none focus:ring-2 focus:ring-red-500"
                  >
                    {store.categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.localName ? `(${c.localName})` : ""}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-black text-stone-700 uppercase tracking-wider text-[10px] mb-1">
                    Food Type *
                  </label>
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, isVeg: false })}
                      className={`flex-1 py-2 px-2.5 rounded-xl border text-xs font-black transition-all ${
                        !formData.isVeg
                          ? "bg-red-50 border-red-400 text-red-900 ring-2 ring-red-300/30"
                          : "bg-white border-[#E7E2DA] text-stone-600"
                      }`}
                    >
                      Non-Veg 🍗
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, isVeg: true })}
                      className={`flex-1 py-2 px-2.5 rounded-xl border text-xs font-black transition-all ${
                        formData.isVeg
                          ? "bg-emerald-50 border-emerald-400 text-emerald-900 ring-2 ring-emerald-300/30"
                          : "bg-white border-[#E7E2DA] text-stone-600"
                      }`}
                    >
                      Veg 🥬
                    </button>
                  </div>
                </div>
              </div>

              {/* Dual-Pricing Variants (Half / Full) Toggle */}
              <div className="bg-[#FAF8F5] p-3 rounded-xl border border-[#E7E2DA] space-y-2">
                <div className="flex items-center justify-between">
                  <label className="font-black text-stone-700 uppercase tracking-wider text-[10px] flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                    <span>Dual Pricing Variants (Half / Full)</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, hasVariants: !formData.hasVariants })}
                    className={`px-2.5 py-1 rounded-lg text-xs font-black transition-all ${
                      formData.hasVariants
                        ? "bg-amber-500 text-stone-900 shadow-2xs"
                        : "bg-stone-200 text-stone-600 hover:bg-stone-300"
                    }`}
                  >
                    {formData.hasVariants ? "Enabled ✓" : "Enable Variants"}
                  </button>
                </div>

                {formData.hasVariants && (
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div>
                      <span className="text-[10px] font-bold text-stone-500 block mb-1">Half Portion Price (₹)</span>
                      <input
                        type="number"
                        min="1"
                        value={formData.halfPrice}
                        onChange={(e) => setFormData({ ...formData, halfPrice: Number(e.target.value) })}
                        className="w-full bg-white border border-[#E7E2DA] rounded-lg px-3 py-1.5 text-xs font-black text-stone-900 focus:outline-none focus:ring-2 focus:ring-red-500"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-stone-500 block mb-1">Full Portion Price (₹)</span>
                      <input
                        type="number"
                        min="1"
                        value={formData.fullPrice}
                        onChange={(e) => setFormData({ ...formData, fullPrice: Number(e.target.value) })}
                        className="w-full bg-white border border-[#E7E2DA] rounded-lg px-3 py-1.5 text-xs font-black text-stone-900 focus:outline-none focus:ring-2 focus:ring-red-500"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Description */}
              <div>
                <label className="block font-black text-stone-700 uppercase tracking-wider text-[10px] mb-1">
                  Dish Ingredients / Included Items Description
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Tambda Rassa, Pandhra Rassa, 2 Jowar Bhakris, Sukka & Indrayani Bhaat"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full bg-[#FAF8F5] border border-[#E7E2DA] rounded-xl px-3.5 py-2 text-xs font-semibold text-stone-900 focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>

              {/* Availability Toggle */}
              <div>
                <label className="block font-black text-stone-700 uppercase tracking-wider text-[10px] mb-1">
                  Service Availability
                </label>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, stockStatus: "AVAILABLE" })}
                    className={`flex-1 py-2 rounded-xl border text-xs font-black transition-all ${
                      formData.stockStatus === "AVAILABLE"
                        ? "bg-emerald-50 border-emerald-400 text-emerald-900 ring-2 ring-emerald-300/30"
                        : "bg-white border-[#E7E2DA] text-stone-600"
                    }`}
                  >
                    In Stock (Available)
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, stockStatus: "OUT_OF_STOCK" })}
                    className={`flex-1 py-2 rounded-xl border text-xs font-black transition-all ${
                      formData.stockStatus === "OUT_OF_STOCK"
                        ? "bg-amber-50 border-amber-400 text-amber-900 ring-2 ring-amber-300/30"
                        : "bg-white border-[#E7E2DA] text-stone-600"
                    }`}
                  >
                    86 / Out of Stock
                  </button>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-3 flex items-center justify-between gap-2 border-t border-stone-100">
                {editingItem ? (
                  <button
                    type="button"
                    onClick={() => handleDeleteDish(editingItem.id, editingItem.name)}
                    className="flex items-center gap-1.5 text-rose-600 hover:text-rose-800 font-bold px-3 py-2 rounded-xl hover:bg-rose-50 transition-all text-xs"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete Dish</span>
                  </button>
                ) : (
                  <div />
                )}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2.5 rounded-xl border border-[#E7E2DA] text-stone-700 font-bold hover:bg-[#FAF8F5]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex items-center gap-1.5 bg-gradient-to-r from-red-600 via-red-700 to-red-800 hover:from-red-700 hover:to-red-900 text-white font-black px-5 py-2.5 rounded-xl shadow-md shadow-red-700/20 active:scale-95 transition-all"
                  >
                    <Sparkles className="w-4 h-4 text-amber-200" />
                    <span>{editingItem ? "Save Price & Changes" : "Create Dish"}</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
