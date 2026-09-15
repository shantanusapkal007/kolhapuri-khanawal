"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  CheckSquare,
  CheckCircle2,
  Circle,
  Plus,
  Trash2,
  Sparkles,
  ShieldCheck,
  Flame,
  Snowflake,
  Clock,
  AlertTriangle,
  Bell,
  ArrowRight,
  ListTodo,
  Calendar,
  Lock,
} from "lucide-react";
import { globalRestaurantStore } from "@/lib/store/restaurant-store";

export default function DailyTasksPage() {
  const store = globalRestaurantStore;
  const [, setTick] = useState(0);

  const [activeTab, setActiveTab] = useState<"OPENING" | "CLOSING" | "REMINDERS">("OPENING");

  // Modal and Form State for adding custom checklist item
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newItemTitle, setNewItemTitle] = useState("");
  const [newItemCategory, setNewItemCategory] = useState<"SAFETY" | "HYGIENE" | "STOCK" | "FINANCE" | "OPERATIONS">("OPERATIONS");
  const [newItemShift, setNewItemShift] = useState<"OPENING" | "CLOSING">("OPENING");
  const [toastMessage, setToastMessage] = useState<string | null>(null);

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

  const openingItems = store.checklistItems.filter((i) => i.shift === "OPENING");
  const closingItems = store.checklistItems.filter((i) => i.shift === "CLOSING");
  const activeReminders = store.reminders.filter((r) => !r.isDismissed);

  const currentItems = activeTab === "OPENING" ? openingItems : closingItems;
  const completedCount = currentItems.filter((i) => i.isCompleted).length;
  const totalCount = currentItems.length;
  const progressPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const toggleItem = (id: string) => {
    store.toggleChecklistItem(id);
    setTick((t) => t + 1);
  };

  const handleDeleteItem = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    store.deleteChecklistItem(id);
    setTick((t) => t + 1);
    showToast("तपासणी आयटम काढला (Checklist item removed)");
  };

  const handleAddItemSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemTitle.trim()) return;

    store.addChecklistItem(newItemTitle.trim(), newItemCategory, newItemShift);
    setTick((t) => t + 1);
    setNewItemTitle("");
    setIsAddModalOpen(false);
    showToast("नवीन काम जोडले (New task added)!");
  };

  const handleCompleteReminder = (id: string) => {
    store.completeReminder(id);
    setTick((t) => t + 1);
    showToast("सूचना पूर्ण केली (Reminder marked completed)");
  };

  const quickSuggestions = [
    { title: "तांबडा व पांढरा रस्सा स्टॉक तपासणी (Check Tambada/Pandhara stock)", cat: "STOCK" as const, shift: "OPENING" as const },
    { title: "गॅस सिलिंडर व सेफ्टी व्हॉल्व्ह तपासणी (Check LPG regulator valves)", cat: "SAFETY" as const, shift: "OPENING" as const },
    { title: "UPI साऊंडबॉक्स बॅटरी व नेटवर्क ऑन करणे (Turn on UPI Soundbox)", cat: "FINANCE" as const, shift: "OPENING" as const },
    { title: "भाकरी तवा व लाटणे स्वच्छ करणे (Sanitize Bhakri tawa & counter)", cat: "HYGIENE" as const, shift: "OPENING" as const },
    { title: "डीप फ्रीझर तापमान (-18°C) तपासणी (Check Deep Freezer temp)", cat: "SAFETY" as const, shift: "CLOSING" as const },
    { title: "गल्ल्यातील कॅश मोजणे व दैनंदिन Z-क्लोजिंग (Count Cash & Z-Report)", cat: "FINANCE" as const, shift: "CLOSING" as const },
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
            <CheckSquare className="w-6 h-6 text-amber-100" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black text-stone-900 tracking-tight">
                दैनंदिन कामे व सुरक्षा (Daily Tasks)
              </h1>
              <span className="bg-red-50 text-red-900 text-[10px] font-black px-2.5 py-0.5 rounded-full border border-red-200 uppercase tracking-wider">
                Core Operations
              </span>
            </div>
            <p className="text-xs text-stone-500 font-medium mt-0.5">
              Opening duties (11 AM), closing duties (11 PM), kitchen gas safety, deep freezer, and operational SOP alerts.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-red-700 hover:bg-red-800 text-white text-xs font-bold rounded-xl shadow-sm transition-all active:scale-95 touch-manipulation"
          >
            <Plus className="w-4 h-4" />
            <span>नवीन काम जोडा (Add Task)</span>
          </button>

          <Link
            href="/daily-closing"
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 bg-stone-900 hover:bg-black text-white text-xs font-bold rounded-xl shadow-sm transition-all"
          >
            <Lock className="w-3.5 h-3.5 text-amber-400" />
            <span>रात्रीचे Z-क्लोजिंग →</span>
          </Link>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-stone-200 pb-2">
        <button
          onClick={() => setActiveTab("OPENING")}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-black flex items-center gap-2 transition-all ${
            activeTab === "OPENING"
              ? "bg-red-600 text-white shadow-sm"
              : "bg-stone-100 text-stone-600 hover:bg-stone-200"
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>सकाळची कामे (Opening SOP - 11 AM)</span>
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
            activeTab === "OPENING" ? "bg-white/20 text-white" : "bg-stone-200 text-stone-700"
          }`}>
            {openingItems.filter((i) => i.isCompleted).length}/{openingItems.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("CLOSING")}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-black flex items-center gap-2 transition-all ${
            activeTab === "CLOSING"
              ? "bg-stone-900 text-white shadow-sm"
              : "bg-stone-100 text-stone-600 hover:bg-stone-200"
          }`}
        >
          <Lock className="w-4 h-4" />
          <span>रात्रीची कामे (Closing SOP - 11 PM)</span>
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
            activeTab === "CLOSING" ? "bg-white/20 text-white" : "bg-stone-200 text-stone-700"
          }`}>
            {closingItems.filter((i) => i.isCompleted).length}/{closingItems.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("REMINDERS")}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-black flex items-center gap-2 transition-all ${
            activeTab === "REMINDERS"
              ? "bg-amber-600 text-white shadow-sm"
              : "bg-stone-100 text-stone-600 hover:bg-stone-200"
          }`}
        >
          <Bell className="w-4 h-4" />
          <span>अलर्ट्स व सूचना (Reminders & Alerts)</span>
          {activeReminders.length > 0 && (
            <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-red-600 text-white animate-pulse">
              {activeReminders.length}
            </span>
          )}
        </button>
      </div>

      {activeTab !== "REMINDERS" ? (
        <div className="space-y-4">
          {/* Progress Card */}
          <div className="bg-white p-4 rounded-2xl border border-[#E7E2DA] flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="w-full sm:w-auto">
              <div className="text-xs font-bold text-stone-500 uppercase">
                {activeTab === "OPENING" ? "सकाळच्या शिफ्ट प्रगती" : "रात्रीच्या शिफ्ट प्रगती"}
              </div>
              <div className="text-lg font-black text-stone-900 mt-0.5">
                {completedCount} पैकी {totalCount} कामे पूर्ण ({progressPct}%)
              </div>
            </div>

            <div className="w-full sm:w-72 bg-stone-100 rounded-full h-3.5 overflow-hidden border border-stone-200">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  progressPct === 100
                    ? "bg-emerald-500"
                    : activeTab === "OPENING"
                    ? "bg-red-600"
                    : "bg-stone-900"
                }`}
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>

          {/* Checklist Items List */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {currentItems.map((item) => (
              <div
                key={item.id}
                onClick={() => toggleItem(item.id)}
                className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-start justify-between gap-3 ${
                  item.isCompleted
                    ? "bg-emerald-50/50 border-emerald-300 text-stone-700"
                    : "bg-white border-stone-200 hover:border-red-300 shadow-2xs"
                }`}
              >
                <div className="flex items-start gap-3">
                  <button
                    type="button"
                    className="mt-0.5 text-stone-400 focus:outline-none"
                  >
                    {item.isCompleted ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 fill-emerald-100" />
                    ) : (
                      <Circle className="w-5 h-5 text-stone-300 hover:text-stone-500" />
                    )}
                  </button>
                  <div>
                    <span
                      className={`text-sm font-bold ${
                        item.isCompleted ? "line-through text-stone-400" : "text-stone-900"
                      }`}
                    >
                      {item.title}
                    </span>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-stone-100 text-stone-600 border border-stone-200">
                        {item.category}
                      </span>
                      {item.isCompleted && (
                        <span className="text-[10px] text-emerald-700 font-bold">
                          ✓ पूर्ण झाले
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={(e) => handleDeleteItem(item.id, e)}
                  className="text-stone-300 hover:text-red-600 p-1 rounded-lg transition-colors"
                  title="Remove"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          {/* Quick Suggestions */}
          <div className="bg-[#FAF8F5] p-4 rounded-2xl border border-stone-200 space-y-2 mt-4">
            <div className="text-xs font-black text-stone-700 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-600" />
              <span>खानावळ शिफारसी (Khanawal Suggestions - 1-Tap Add):</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {quickSuggestions
                .filter((q) => q.shift === activeTab)
                .map((sug, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      store.addChecklistItem(sug.title, sug.cat, sug.shift);
                      setTick((t) => t + 1);
                      showToast("शिफारस जोडली!");
                    }}
                    className="text-xs font-semibold bg-white border border-stone-200 hover:border-red-300 text-stone-700 px-3 py-1.5 rounded-xl shadow-2xs hover:bg-red-50/50 transition-colors"
                  >
                    + {sug.title}
                  </button>
                ))}
            </div>
          </div>
        </div>
      ) : (
        /* Reminders & Alerts Tab */
        <div className="space-y-3">
          {activeReminders.length === 0 ? (
            <div className="p-8 text-center bg-white rounded-2xl border border-stone-200 text-stone-500">
              <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto mb-2" />
              <div className="font-bold text-sm text-stone-800">सर्व अलर्ट्स सुरळीत आहेत (All clear)</div>
              <p className="text-xs mt-1">कोणतेही प्रलंबित तात्काळ नोटिफिकेशन्स नाहीत.</p>
            </div>
          ) : (
            activeReminders.map((rem) => (
              <div
                key={rem.id}
                className={`p-4 rounded-2xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
                  rem.urgency === "CRITICAL"
                    ? "bg-red-50/80 border-red-300"
                    : rem.urgency === "HIGH"
                    ? "bg-amber-50/80 border-amber-300"
                    : "bg-white border-stone-200"
                }`}
              >
                <div className="flex items-start gap-3">
                  <AlertTriangle
                    className={`w-5 h-5 shrink-0 mt-0.5 ${
                      rem.urgency === "CRITICAL"
                        ? "text-red-600"
                        : rem.urgency === "HIGH"
                        ? "text-amber-600"
                        : "text-blue-600"
                    }`}
                  />
                  <div>
                    <div className="font-black text-stone-900 text-sm">{rem.title}</div>
                    <p className="text-xs text-stone-600 mt-0.5">{rem.message}</p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-stone-100 text-stone-700">
                        {rem.category}
                      </span>
                      <span className="text-[10px] font-bold text-stone-400">
                        Urgency: {rem.urgency}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {rem.actionUrl && (
                    <Link
                      href={rem.actionUrl}
                      className="px-3 py-1.5 bg-white border border-stone-300 hover:bg-stone-50 text-stone-800 text-xs font-bold rounded-xl transition-colors"
                    >
                      {rem.actionLabel || "तपासा (Review)"}
                    </Link>
                  )}
                  <button
                    onClick={() => handleCompleteReminder(rem.id)}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-colors shadow-2xs"
                  >
                    ✓ पूर्ण झाले (Done)
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Add Checklist Item Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-stone-200 animate-in zoom-in-95">
            <h3 className="text-lg font-black text-stone-900">नवीन तपासणी काम जोडा</h3>
            <p className="text-xs text-stone-500 mt-0.5">
              Daily Operational Checklist SOP Protocol Task
            </p>

            <form onSubmit={handleAddItemSubmit} className="space-y-4 mt-4">
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  कामाचे नाव (Task Description) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="उदा. गॅस सिलिंडर व्हॉल्व्ह सुरक्षित लॉक करणे"
                  value={newItemTitle}
                  onChange={(e) => setNewItemTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 text-sm focus:ring-2 focus:ring-red-600 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    शिफ्ट (Shift)
                  </label>
                  <select
                    value={newItemShift}
                    onChange={(e) => setNewItemShift(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl border border-stone-300 text-xs font-bold focus:outline-none"
                  >
                    <option value="OPENING">सकाळ (Opening 11 AM)</option>
                    <option value="CLOSING">रात्र (Closing 11 PM)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    प्रवर्ग (Category)
                  </label>
                  <select
                    value={newItemCategory}
                    onChange={(e) => setNewItemCategory(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl border border-stone-300 text-xs font-bold focus:outline-none"
                  >
                    <option value="OPERATIONS">OPERATIONS</option>
                    <option value="SAFETY">SAFETY (सुरक्षा)</option>
                    <option value="HYGIENE">HYGIENE (स्वच्छता)</option>
                    <option value="STOCK">STOCK (साठा)</option>
                    <option value="FINANCE">FINANCE (हिशोब)</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-stone-300 text-xs font-bold text-stone-600 hover:bg-stone-100"
                >
                  रद्द करा (Cancel)
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-red-700 hover:bg-red-800 text-white text-xs font-bold shadow-sm"
                >
                  जोडा (Add Task)
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
