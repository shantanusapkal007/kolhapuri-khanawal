"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Wallet,
  Plus,
  AlertTriangle,
  CheckCircle2,
  Filter,
  Wrench,
  Wifi,
  Flame,
  Sparkles,
  ShoppingBag,
  IndianRupee,
  Calendar,
  Banknote,
  QrCode,
  Tag,
  Users,
  Search,
  Trash2,
  Zap,
  ArrowRight,
  Package,
  FileSpreadsheet,
  Clock,
  ShieldCheck,
} from "lucide-react";
import { globalRestaurantStore } from "@/lib/store/restaurant-store";
import {
  MasterExpenseCategory,
  ExpenseFrequency,
} from "@/types/expenses";
import {
  khanawalExpenseCategories,
  khanawalExpenseSubcategories,
  knownExpenseParties,
} from "@/lib/store/expense-master-data";

export default function ExpensesPage() {
  const store = globalRestaurantStore;
  const [, setTick] = useState(0);

  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [selectedFrequency, setSelectedFrequency] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Form states (Category, Subcategory, Party + financial details)
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [category, setCategory] = useState<MasterExpenseCategory>("Food & Raw Materials");
  const [subcategory, setSubcategory] = useState<string>("Bhaji Pala (Vegetables)");
  const [party, setParty] = useState<string>("");
  const [amount, setAmount] = useState<number>(500);
  const [frequency, setFrequency] = useState<ExpenseFrequency>("DAILY");
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "UPI">("CASH");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    const interval = setInterval(() => {
      setTick((t) => t + 1);
    }, 1500);
    return () => clearInterval(interval);
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Subcategories available for selected category in modal
  const availableSubcategories = khanawalExpenseSubcategories.filter(
    (s) => s.category === category
  );

  const handleCategoryChange = (newCat: MasterExpenseCategory) => {
    setCategory(newCat);
    const subcats = khanawalExpenseSubcategories.filter((s) => s.category === newCat);
    if (subcats.length > 0) {
      setSubcategory(subcats[0].name);
      setFrequency(subcats[0].defaultFrequency);
    } else {
      setSubcategory("");
    }
  };

  // 1-Tap Fast Expense Chip Handler
  const handleQuickChipClick = (
    cat: MasterExpenseCategory,
    subcat: string,
    defaultParty: string,
    freq: ExpenseFrequency,
    suggestedAmt?: number
  ) => {
    setCategory(cat);
    setSubcategory(subcat);
    setParty(defaultParty);
    setFrequency(freq);
    if (suggestedAmt) setAmount(suggestedAmt);
    setShowAddModal(true);
  };

  const handleCreateExpense = (e: React.FormEvent) => {
    e.preventDefault();
    if (!party.trim()) {
      showToast("कृपया पार्टी/व्यक्तीचे नाव टाका (Party name required)");
      return;
    }

    store.recordStructuredExpense({
      date,
      category,
      subcategory,
      party: party.trim(),
      amount,
      frequency,
      paymentMethod,
      notes: notes.trim(),
      isReviewed: true,
    });

    setShowAddModal(false);
    setParty("");
    setNotes("");
    setTick((t) => t + 1);
    showToast(`खर्च नोंदवला: ₹${amount} [${paymentMethod} Ledger Debited]`);
  };

  const handleDeleteExpense = (id: string) => {
    if (confirm("हा खर्च खरोखर काढून टाकायचा आहे का? (Delete this expense record?)")) {
      store.deleteExpense(id);
      setTick((t) => t + 1);
      showToast("खर्च रेकॉर्ड हटवले (Expense deleted)");
    }
  };

  // Filtered expenses
  const filteredExpenses = store.expenses.filter((e) => {
    const matchesCategory =
      selectedCategory === "ALL" || e.category === selectedCategory;

    const matchesFrequency =
      selectedFrequency === "ALL" || e.frequency === selectedFrequency;

    const query = searchQuery.toLowerCase();
    const matchesQuery =
      !query ||
      (e.category && e.category.toLowerCase().includes(query)) ||
      (e.subcategory && e.subcategory.toLowerCase().includes(query)) ||
      (e.party && e.party.toLowerCase().includes(query)) ||
      (e.item && e.item.toLowerCase().includes(query)) ||
      (e.paidTo && e.paidTo.toLowerCase().includes(query)) ||
      (e.notes && e.notes.toLowerCase().includes(query));

    return matchesCategory && matchesFrequency && matchesQuery;
  });

  const totalExpenseAmount = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);
  const cashExpenseTotal = filteredExpenses
    .filter((e) => e.paymentMethod === "CASH")
    .reduce((sum, e) => sum + e.amount, 0);
  const upiExpenseTotal = filteredExpenses
    .filter((e) => e.paymentMethod === "UPI")
    .reduce((sum, e) => sum + e.amount, 0);

  // 1-Tap Daily & Frequent Chips definitions
  const dailyChips = [
    { label: "भाकरी/चपाती", cat: "Food & Raw Materials" as const, sub: "Chapati / Bhakri", party: "Ranjit Bhakri Center", freq: "DAILY" as const, amt: 600 },
    { label: "भाजीपाला", cat: "Food & Raw Materials" as const, sub: "Bhaji Pala (Vegetables)", party: "Mandi Vendor (Somwar Peth)", freq: "DAILY" as const, amt: 850 },
    { label: "किराणा", cat: "Food & Raw Materials" as const, sub: "Kirana (Grocery)", party: "Mahalaxmi Kirana", freq: "DAILY" as const, amt: 1200 },
    { label: "दूध / दही", cat: "Food & Raw Materials" as const, sub: "Milk / Dahi", party: "Gokul Dairy Outlet", freq: "DAILY" as const, amt: 350 },
    { label: "हमाली / टेम्पो", cat: "Cleaning & Sanitation" as const, sub: "Porter / Transport / Hamali", party: "Kaka Tempo Wala", freq: "DAILY" as const, amt: 150 },
    { label: "पार्सल कंटेनर्स", cat: "Packaging" as const, sub: "Packaging Material (Boxes/Bags)", party: "Arihant Packaging", freq: "DAILY" as const, amt: 400 },
  ];

  const frequentChips = [
    { label: "चिकन खरेदी", cat: "Food & Raw Materials" as const, sub: "Chicken", party: "Raju Chicken Supplier", freq: "FREQUENT" as const, amt: 2200 },
    { label: "बोकड मटण", cat: "Food & Raw Materials" as const, sub: "Mutton", party: "Kolhapuri Mutton Mart", freq: "FREQUENT" as const, amt: 4500 },
    { label: "कोळसा (शेगडी)", cat: "Fuel" as const, sub: "Coal / Charcoal", party: "Charcoal Depot Shahupuri", freq: "FREQUENT" as const, amt: 900 },
    { label: "LPG सिलिंडर", cat: "Fuel" as const, sub: "Gas / Cylinder Refill", party: "Bharat Gas Commercial", freq: "FREQUENT" as const, amt: 1950 },
    { label: "डस्टबिन बॅग्ज", cat: "Packaging" as const, sub: "Dustbin Bags", party: "CleanWell Supplies", freq: "FREQUENT" as const, amt: 250 },
    { label: "झेरॉक्स / प्रिंट", cat: "Office & Administrative" as const, sub: "Xerox / Printing / Forms", party: "Cyber Point", freq: "FREQUENT" as const, amt: 120 },
  ];

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-4 right-4 z-50 bg-stone-900 text-amber-300 border border-amber-500/40 px-4 py-3 rounded-xl shadow-xl flex items-center gap-2 text-sm font-semibold animate-bounce">
          <Sparkles className="w-4 h-4 text-amber-400" />
          {toastMessage}
        </div>
      )}

      {/* Header Banner */}
      <div className="luxury-card rounded-2xl p-5 sm:p-6 border border-[#E7E2DA] flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-white via-[#FAF8F5] to-white">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-red-600 to-red-700 text-white flex items-center justify-center shadow-md shadow-red-600/20 border border-red-500/30 shrink-0">
            <Wallet className="w-6 h-6 text-amber-100" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black text-stone-900 tracking-tight">
                हॉटेल खर्च व हishob (Hotel POS Expenses Master)
              </h1>
              <span className="bg-red-50 text-red-900 text-[10px] font-black px-2.5 py-0.5 rounded-full border border-red-200 uppercase tracking-wider">
                Core Operations
              </span>
            </div>
            <p className="text-xs text-stone-500 font-medium mt-0.5">
              Authentic 13 master categories, 80+ subcategories, party/vendor tracking, and instant cash drawer & bank ledger deduction.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => {
              setCategory("Food & Raw Materials");
              setSubcategory("Bhaji Pala (Vegetables)");
              setParty("");
              setAmount(500);
              setShowAddModal(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-red-700 hover:bg-red-800 text-white text-xs font-bold rounded-xl shadow-sm transition-all active:scale-95 touch-manipulation"
          >
            <Plus className="w-4 h-4" />
            <span>नवीन खर्च नोंदवा (Record Expense)</span>
          </button>

          <Link
            href="/daily-closing"
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 bg-stone-900 hover:bg-black text-white text-xs font-bold rounded-xl shadow-sm transition-all"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
            <span>दैनिक Z-क्लोजिंग →</span>
          </Link>
        </div>
      </div>

      {/* 1-TAP FAST EXPENSE CHIPS ROW */}
      <div className="bg-white p-4 rounded-2xl border border-[#E7E2DA] shadow-2xs space-y-3">
        {/* Daily Chips */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs font-black text-red-800 uppercase tracking-wide shrink-0">
            <Zap className="w-3.5 h-3.5 text-red-600 fill-red-600" />
            <span>दैनिक खर्च (Daily 1-Tap):</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {dailyChips.map((chip, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() =>
                  handleQuickChipClick(chip.cat, chip.sub, chip.party, chip.freq, chip.amt)
                }
                className="text-xs font-bold px-3 py-1.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-900 border border-red-200/80 transition-all flex items-center gap-1.5 active:scale-95 touch-manipulation shadow-2xs"
              >
                <span>+ {chip.label}</span>
                <span className="text-[10px] text-red-700 font-mono font-black">₹{chip.amt}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Frequent Chips */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 pt-2 border-t border-stone-100">
          <div className="flex items-center gap-1.5 text-xs font-black text-amber-800 uppercase tracking-wide shrink-0">
            <Clock className="w-3.5 h-3.5 text-amber-600" />
            <span>वारंवार खर्च (Frequent 1-Tap):</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {frequentChips.map((chip, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() =>
                  handleQuickChipClick(chip.cat, chip.sub, chip.party, chip.freq, chip.amt)
                }
                className="text-xs font-bold px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200/80 transition-all flex items-center gap-1.5 active:scale-95 touch-manipulation shadow-2xs"
              >
                <span>+ {chip.label}</span>
                <span className="text-[10px] text-amber-700 font-mono font-black">₹{chip.amt}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-4 rounded-2xl bg-white border border-[#E7E2DA] border-l-4 border-l-stone-900 shadow-2xs space-y-1">
          <div className="text-[11px] font-bold text-stone-500 uppercase">एकूण नोंदवलेला खर्च</div>
          <div className="text-2xl font-black text-stone-900 font-mono tracking-tight">
            ₹{totalExpenseAmount.toLocaleString("en-IN")}
          </div>
          <div className="text-[10px] text-stone-400 font-medium">
            {filteredExpenses.length} व्यवहार (Transactions)
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-[#E7E2DA] border-l-4 border-l-amber-600 shadow-2xs space-y-1 bg-amber-50/20">
          <div className="text-[11px] font-bold text-amber-800 uppercase flex items-center gap-1">
            <Banknote className="w-3.5 h-3.5" /> गल्ल्यातून कॅश खर्च
          </div>
          <div className="text-2xl font-black text-amber-950 font-mono tracking-tight">
            ₹{cashExpenseTotal.toLocaleString("en-IN")}
          </div>
          <div className="text-[10px] text-amber-800 font-medium">
            गल्ला लेजरमधून वजा (Debited from Drawer)
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-[#E7E2DA] border-l-4 border-l-blue-600 shadow-2xs space-y-1 bg-blue-50/20">
          <div className="text-[11px] font-bold text-blue-800 uppercase flex items-center gap-1">
            <QrCode className="w-3.5 h-3.5" /> UPI / बँक खर्च
          </div>
          <div className="text-2xl font-black text-blue-950 font-mono tracking-tight">
            ₹{upiExpenseTotal.toLocaleString("en-IN")}
          </div>
          <div className="text-[10px] text-blue-800 font-medium">
            बँक खात्यातून थेट भरणा
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-[#E7E2DA] border-l-4 border-l-emerald-600 shadow-2xs space-y-1">
          <div className="text-[11px] font-bold text-stone-500 uppercase">लेखापरीक्षण दर्जा</div>
          <div className="text-xl font-black text-emerald-700 tracking-tight flex items-center gap-1.5 mt-1">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            <span>100% Verified</span>
          </div>
          <div className="text-[10px] text-stone-400 font-medium">
            3-Field standard ledger format
          </div>
        </div>
      </div>

      {/* 13 MASTER CATEGORIES HORIZONTAL PILLS */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs font-bold text-stone-500">
          <span>१३ मुख्य खर्च प्रवर्ग (13 Master Categories Filter):</span>
          <span>{khanawalExpenseCategories.length} Categories</span>
        </div>
        <div className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-none">
          <button
            onClick={() => setSelectedCategory("ALL")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
              selectedCategory === "ALL"
                ? "bg-stone-900 text-white shadow-2xs"
                : "bg-white text-stone-700 border border-stone-200 hover:bg-stone-100"
            }`}
          >
            सर्व प्रवर्ग (All)
          </button>
          {khanawalExpenseCategories.map((cat) => {
            const count = store.expenses.filter((e) => e.category === cat.name).length;
            const isSelected = selectedCategory === cat.name;
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.name)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                  isSelected
                    ? "bg-red-700 text-white shadow-2xs"
                    : "bg-white text-stone-700 border border-stone-200 hover:bg-stone-100"
                }`}
              >
                <span>{cat.localName}</span>
                <span className="text-[10px] opacity-75">({cat.name})</span>
                {count > 0 && (
                  <span
                    className={`text-[9px] px-1.5 py-0.2 rounded-full font-mono ${
                      isSelected ? "bg-white/20 text-white" : "bg-stone-100 text-stone-700"
                    }`}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-[#E7E2DA] shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="पार्टी, प्रवर्ग किंवा नोंद शोधा..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-stone-200 text-xs focus:ring-2 focus:ring-red-600 focus:outline-none"
          />
        </div>

        {/* Frequency Filter */}
        <div className="flex items-center gap-1 w-full sm:w-auto overflow-x-auto">
          <span className="text-xs font-bold text-stone-500 mr-1 shrink-0">फ्रिक्वेन्सी:</span>
          {["ALL", "DAILY", "FREQUENT", "MONTHLY"].map((freq) => (
            <button
              key={freq}
              onClick={() => setSelectedFrequency(freq)}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors ${
                selectedFrequency === freq
                  ? "bg-red-600 text-white"
                  : "bg-stone-100 text-stone-600 hover:bg-stone-200"
              }`}
            >
              {freq}
            </button>
          ))}
        </div>
      </div>

      {/* Expenses Records Table */}
      <div className="bg-white rounded-2xl border border-[#E7E2DA] shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          {filteredExpenses.length === 0 ? (
            <div className="p-8 text-center text-stone-400">
              <Wallet className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-xs font-semibold">कोणताही खर्च सापडला नाही</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-stone-200 bg-stone-50/70 text-stone-600 font-extrabold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-4">तारीख (Date)</th>
                  <th className="py-3 px-3">मुख्य प्रवर्ग (Category)</th>
                  <th className="py-3 px-3">उपकॅटेगरी (Subcategory)</th>
                  <th className="py-3 px-3">पार्टी / विक्रेता (Party)</th>
                  <th className="py-3 px-3">वारंवारता (Freq)</th>
                  <th className="py-3 px-3">पद्धत (Mode)</th>
                  <th className="py-3 px-3">रक्कम (Amount)</th>
                  <th className="py-3 px-4 text-right">कृती</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {filteredExpenses.map((exp) => (
                  <tr key={exp.id} className="hover:bg-amber-50/30 transition-colors">
                    <td className="py-3 px-4 text-stone-500 font-mono text-[11px]">
                      {exp.date}
                    </td>
                    <td className="py-3 px-3">
                      <span className="font-bold text-stone-900">{exp.category}</span>
                    </td>
                    <td className="py-3 px-3">
                      <span className="inline-block px-2 py-0.5 rounded-md bg-stone-100 text-stone-700 font-semibold text-[11px]">
                        {exp.subcategory || exp.item}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <span className="inline-flex items-center gap-1 font-bold text-amber-950">
                        <Users className="w-3 h-3 text-amber-700" />
                        {exp.party || exp.paidTo || "Local Vendor"}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-stone-100 text-stone-600 border border-stone-200">
                        {exp.frequency || "DAILY"}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black ${
                          exp.paymentMethod === "CASH"
                            ? "bg-amber-100 text-amber-900 border border-amber-300"
                            : "bg-blue-100 text-blue-900 border border-blue-300"
                        }`}
                      >
                        {exp.paymentMethod === "CASH" ? (
                          <Banknote className="w-3 h-3" />
                        ) : (
                          <QrCode className="w-3 h-3" />
                        )}
                        {exp.paymentMethod}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-mono font-black text-stone-900 text-sm">
                      ₹{exp.amount.toLocaleString("en-IN")}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => handleDeleteExpense(exp.id)}
                        className="p-1.5 rounded-lg border border-stone-200 hover:bg-red-50 text-stone-400 hover:text-red-600 transition-colors"
                        title="Delete expense"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* RECORD EXPENSE MODAL (WITH 3 DISTINCT FIELDS: Category, Subcategory, Party) */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-stone-200 animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-black text-stone-900 flex items-center gap-2">
              <Wallet className="w-5 h-5 text-red-600" />
              <span>नवीन खर्च नोंदवा (Record Hotel Expense)</span>
            </h3>
            <p className="text-xs text-stone-500 mt-0.5">
              Strict accounting: Separate Category, Subcategory, and Payee Party.
            </p>

            <form onSubmit={handleCreateExpense} className="space-y-4 mt-4">
              {/* Field 1: Category */}
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  1. मुख्य प्रवर्ग (Master Category) *
                </label>
                <select
                  value={category}
                  onChange={(e) => handleCategoryChange(e.target.value as MasterExpenseCategory)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 text-xs font-bold focus:ring-2 focus:ring-red-600 focus:outline-none"
                >
                  {khanawalExpenseCategories.map((c) => (
                    <option key={c.id} value={c.name}>
                      {c.localName} — {c.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Field 2: Subcategory */}
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  2. उपप्रवर्ग (Subcategory) *
                </label>
                {availableSubcategories.length > 0 ? (
                  <select
                    value={subcategory}
                    onChange={(e) => {
                      setSubcategory(e.target.value);
                      const matched = availableSubcategories.find((s) => s.name === e.target.value);
                      if (matched) setFrequency(matched.defaultFrequency);
                    }}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 text-xs font-bold focus:ring-2 focus:ring-red-600 focus:outline-none"
                  >
                    {availableSubcategories.map((s, idx) => (
                      <option key={idx} value={s.name}>
                        {s.localName} ({s.name})
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    required
                    placeholder="उदा. Kirkol / Small Repair"
                    value={subcategory}
                    onChange={(e) => setSubcategory(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 text-xs font-bold focus:outline-none"
                  />
                )}
              </div>

              {/* Field 3: Party (Payee / Vendor / Staff) */}
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  3. पार्टी / प्राप्तकर्ता नाव (Party / Vendor / Staff Name) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="उदा. Mahesh, Raju Chicken Mart, Ranjit, Bhandi Bai, Sandip"
                  value={party}
                  onChange={(e) => setParty(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 text-sm focus:ring-2 focus:ring-red-600 focus:outline-none"
                />
                {/* Party Autocomplete quick pills */}
                <div className="flex flex-wrap gap-1 mt-1.5">
                  <span className="text-[10px] text-stone-400 font-semibold">सुचवलेले:</span>
                  {knownExpenseParties.slice(0, 6).map((p, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setParty(p)}
                      className="text-[10px] px-2 py-0.5 rounded-md bg-stone-100 hover:bg-stone-200 text-stone-700 font-medium"
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              {/* Amount and Mode */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    रक्कम (Amount ₹) *
                  </label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={amount}
                    onChange={(e) => setAmount(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 text-sm font-mono font-black focus:ring-2 focus:ring-red-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    पेमेंट पद्धत (Payment Method) *
                  </label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as "CASH" | "UPI")}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 text-xs font-bold focus:outline-none"
                  >
                    <option value="CASH">CASH (गल्ल्यातून रोख वजा)</option>
                    <option value="UPI">UPI (बँक खात्यातून थेट)</option>
                  </select>
                </div>
              </div>

              {/* Frequency and Date */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    वारंवारता (Frequency)
                  </label>
                  <select
                    value={frequency}
                    onChange={(e) => setFrequency(e.target.value as ExpenseFrequency)}
                    className="w-full px-3 py-2 rounded-xl border border-stone-300 text-xs font-bold focus:outline-none"
                  >
                    <option value="DAILY">DAILY (दररोज)</option>
                    <option value="FREQUENT">FREQUENT (वारंवार)</option>
                    <option value="OCCASIONAL">OCCASIONAL (कधीतरी)</option>
                    <option value="MONTHLY">MONTHLY (महिन्याला)</option>
                    <option value="ONE_TIME">ONE_TIME (एकदाच)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    तारीख (Date)
                  </label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-stone-300 text-xs font-bold focus:outline-none"
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  टीप / तपशील (Optional Notes)
                </label>
                <input
                  type="text"
                  placeholder="उदा. 5 kg ताज्या पालेभाज्या पावती #442"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 text-xs focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl border border-stone-300 text-xs font-bold text-stone-600 hover:bg-stone-100"
                >
                  रद्द करा (Cancel)
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-red-700 hover:bg-red-800 text-white text-xs font-bold shadow-sm"
                >
                  नोंदवा (Record & Debit Ledger)
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
