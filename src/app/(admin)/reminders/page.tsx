"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Bell,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Plus,
  Trash2,
  Volume2,
  VolumeX,
  Filter,
  Flame,
  Check,
  RotateCcw,
  Sparkles,
  ChefHat,
  Receipt,
  Boxes,
  ShieldCheck,
  ArrowRight,
  X,
} from "lucide-react";
import { globalRestaurantStore } from "@/lib/store/restaurant-store";
import { KhanawalReminder, RestaurantNotification, NotificationCategory } from "@/types/domain";

export default function RemindersPage() {
  const store = globalRestaurantStore;
  const [, setTick] = useState(0);

  // Filters & Tabs
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [showCompleted, setShowCompleted] = useState<boolean>(false);
  const [showAddModal, setShowAddModal] = useState<boolean>(false);

  // New Reminder Form
  const [newTitle, setNewTitle] = useState("");
  const [newMessage, setNewMessage] = useState("");
  const [newCategory, setNewCategory] = useState<KhanawalReminder["category"]>("OPERATIONS");
  const [newUrgency, setNewUrgency] = useState<KhanawalReminder["urgency"]>("HIGH");
  const [newTargetRole, setNewTargetRole] = useState<KhanawalReminder["targetRole"]>("ALL");
  const [newRecurrence, setNewRecurrence] = useState<KhanawalReminder["recurrence"]>("ONCE");
  const [newDueMinutes, setNewDueMinutes] = useState<number>(30);

  useEffect(() => {
    store.evaluateLiveOperationalAlerts();
    const interval = setInterval(() => {
      store.evaluateLiveOperationalAlerts();
      setTick((t) => t + 1);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const reminders = store.reminders;
  const notifications = store.notifications;

  const activeReminders = reminders.filter((r) => !r.isCompleted && !r.isDismissed);
  const completedReminders = reminders.filter((r) => r.isCompleted);
  const overdueCount = activeReminders.filter((r) => r.dueDate && new Date(r.dueDate).getTime() <= Date.now()).length;

  const filteredReminders = (showCompleted ? completedReminders : activeReminders).filter((r) => {
    if (selectedCategory === "ALL") return true;
    return r.category === selectedCategory;
  });

  const handleCreateReminderSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const dueDate = new Date(Date.now() + newDueMinutes * 60 * 1000).toISOString();
    store.createReminder({
      title: newTitle.trim(),
      message: newMessage.trim() || newTitle.trim(),
      type: "CUSTOM",
      category: newCategory,
      urgency: newUrgency,
      targetRole: newTargetRole,
      recurrence: newRecurrence,
      dueDate,
      isDismissed: false,
    });

    setNewTitle("");
    setNewMessage("");
    setShowAddModal(false);
    setTick((t) => t + 1);
  };

  const getUrgencyBadge = (urgency: KhanawalReminder["urgency"]) => {
    switch (urgency) {
      case "CRITICAL":
        return <span className="bg-red-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full flex items-center gap-1 shadow-2xs animate-pulse"><Flame className="w-3 h-3" /> Critical</span>;
      case "HIGH":
        return <span className="bg-amber-500 text-stone-950 text-[10px] font-black px-2 py-0.5 rounded-full shadow-2xs">High</span>;
      case "MEDIUM":
        return <span className="bg-blue-100 text-blue-800 text-[10px] font-bold px-2 py-0.5 rounded-full">Medium</span>;
      default:
        return <span className="bg-stone-100 text-stone-700 text-[10px] font-bold px-2 py-0.5 rounded-full">Low</span>;
    }
  };

  const formatDueDate = (isoString?: string) => {
    if (!isoString) return "No due time";
    const date = new Date(isoString);
    const diffMs = date.getTime() - Date.now();
    const diffMins = Math.round(diffMs / 60000);

    if (diffMins < 0) {
      const pastMins = Math.abs(diffMins);
      if (pastMins < 60) return `Overdue by ${pastMins}m 🔥`;
      return `Overdue (${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })})`;
    }
    if (diffMins < 60) return `Due in ${diffMins}m`;
    if (diffMins < 1440) return `Today at ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
    return date.toLocaleDateString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Luxury Hero Header */}
      <div className="luxury-card rounded-2xl p-5 sm:p-6 border border-[#E7E2DA] bg-gradient-to-r from-white via-[#FAF8F5] to-white flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-red-600 to-red-700 text-white flex items-center justify-center shadow-md shadow-red-600/20 border border-red-500/30 shrink-0">
            <Bell className="w-6 h-6 text-amber-200" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black text-stone-900 tracking-tight">
                Operational Reminders & Alerts
              </h1>
              <span className="bg-red-50 text-red-800 text-xs font-black px-2.5 py-0.5 rounded-full border border-red-200">
                सूचना व स्मरण
              </span>
            </div>
            <p className="text-xs text-stone-500 font-medium mt-0.5">
              Automated kitchen checks, safety routines, par-stock reorders & staff reminders.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Audio Toggle */}
          <button
            onClick={() => {
              store.toggleSound();
              setTick((t) => t + 1);
            }}
            className={`px-3 py-2 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all ${
              store.soundEnabled
                ? "bg-stone-900 text-amber-300 border-stone-900 shadow-2xs"
                : "bg-white text-stone-600 border-[#E7E2DA] hover:bg-[#FAF8F5]"
            }`}
            title={store.soundEnabled ? "Audio chimes enabled" : "Audio chimes muted"}
          >
            {store.soundEnabled ? <Volume2 className="w-4 h-4 text-amber-300" /> : <VolumeX className="w-4 h-4 text-stone-400" />}
            <span className="hidden sm:inline">{store.soundEnabled ? "Sound On" : "Muted"}</span>
          </button>

          {/* Create Button */}
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 bg-gradient-to-r from-red-600 via-red-700 to-red-800 hover:from-red-700 hover:to-red-900 text-white text-xs sm:text-sm font-black px-4 py-2 rounded-xl shadow-sm shadow-red-700/20 active:scale-95 transition-all"
          >
            <Plus className="w-4 h-4 text-amber-200" />
            <span>+ New Reminder</span>
          </button>
        </div>
      </div>

      {/* Metric Cards Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 text-xs">
        <div className="luxury-card rounded-2xl p-4 border border-[#E7E2DA] bg-white">
          <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider">Active Reminders</span>
          <div className="text-2xl font-black text-stone-900 mt-1">{activeReminders.length}</div>
          <span className="text-[10px] text-stone-400">Scheduled checks</span>
        </div>

        <div className="luxury-card rounded-2xl p-4 border border-red-200 bg-red-50/20">
          <span className="text-[11px] font-bold text-red-700 uppercase tracking-wider">Due / Overdue</span>
          <div className="text-2xl font-black text-red-700 mt-1">{overdueCount}</div>
          <span className="text-[10px] text-red-500">Immediate action needed</span>
        </div>

        <div className="luxury-card rounded-2xl p-4 border border-emerald-200 bg-emerald-50/20">
          <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">Completed</span>
          <div className="text-2xl font-black text-emerald-700 mt-1">{completedReminders.length}</div>
          <span className="text-[10px] text-emerald-600">Finished tasks</span>
        </div>

        <div className="luxury-card rounded-2xl p-4 border border-amber-200 bg-amber-50/20">
          <span className="text-[11px] font-bold text-amber-800 uppercase tracking-wider">Live Alerts</span>
          <div className="text-2xl font-black text-amber-900 mt-1">{notifications.length}</div>
          <span className="text-[10px] text-amber-700">Kitchen & billing events</span>
        </div>
      </div>

      {/* Filter & View Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
          {["ALL", "SAFETY", "OPERATIONS", "INVENTORY", "FINANCE", "STAFF"].map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all border ${
                selectedCategory === cat
                  ? "bg-stone-900 text-amber-200 border-stone-900 shadow-2xs"
                  : "bg-white text-stone-600 border-[#E7E2DA] hover:bg-[#FAF8F5]"
              }`}
            >
              {cat === "ALL" ? "All Categories" : cat}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1.5 self-end sm:self-auto shrink-0">
          <button
            onClick={() => setShowCompleted(false)}
            className={`px-3 py-1.5 rounded-xl font-black transition-all ${
              !showCompleted
                ? "bg-red-600 text-white shadow-2xs"
                : "bg-white text-stone-600 border border-[#E7E2DA]"
            }`}
          >
            Active ({activeReminders.length})
          </button>
          <button
            onClick={() => setShowCompleted(true)}
            className={`px-3 py-1.5 rounded-xl font-black transition-all ${
              showCompleted
                ? "bg-emerald-600 text-white shadow-2xs"
                : "bg-white text-stone-600 border border-[#E7E2DA]"
            }`}
          >
            Completed ({completedReminders.length})
          </button>
        </div>
      </div>

      {/* Reminders List Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        {filteredReminders.length === 0 ? (
          <div className="col-span-full luxury-card rounded-2xl p-12 text-center text-stone-400 border border-[#E7E2DA] bg-white">
            <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-3" />
            <h3 className="text-base font-bold text-stone-800">No Reminders Found</h3>
            <p className="text-xs text-stone-400 mt-1">All scheduled operational tasks in this view are completed!</p>
          </div>
        ) : (
          filteredReminders.map((rem) => {
            const isOverdue = rem.dueDate && new Date(rem.dueDate).getTime() <= Date.now();
            const isSnoozed = rem.snoozedUntil && new Date(rem.snoozedUntil).getTime() > Date.now();

            return (
              <div
                key={rem.id}
                className={`luxury-card rounded-2xl p-4 border transition-all flex flex-col justify-between ${
                  rem.isCompleted
                    ? "bg-white/80 border-[#E7E2DA] opacity-70"
                    : isOverdue && !isSnoozed
                    ? "bg-red-50/30 border-red-300 ring-1 ring-red-200"
                    : "bg-white border-[#E7E2DA]"
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {getUrgencyBadge(rem.urgency)}
                      <span className="text-[10px] font-bold text-stone-500 bg-[#FAF8F5] px-2 py-0.5 rounded-md border border-[#E7E2DA]">
                        {rem.category}
                      </span>
                      {rem.targetRole && rem.targetRole !== "ALL" && (
                        <span className="text-[10px] font-bold text-stone-600 bg-stone-100 px-1.5 py-0.5 rounded">
                          {rem.targetRole}
                        </span>
                      )}
                    </div>

                    <div className="text-[11px] font-black">
                      {isSnoozed ? (
                        <span className="text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                          Snoozed
                        </span>
                      ) : (
                        <span className={isOverdue && !rem.isCompleted ? "text-red-700" : "text-stone-500"}>
                          {formatDueDate(rem.dueDate)}
                        </span>
                      )}
                    </div>
                  </div>

                  <h3 className={`text-sm font-black text-stone-900 mt-2.5 ${rem.isCompleted ? "line-through text-stone-500" : ""}`}>
                    {rem.title}
                  </h3>
                  <p className={`text-xs text-stone-600 mt-1 leading-relaxed ${rem.isCompleted ? "line-through text-stone-400" : ""}`}>
                    {rem.message}
                  </p>
                </div>

                {/* Bottom Actions Bar */}
                <div className="mt-4 pt-3 border-t border-stone-100 flex items-center justify-between gap-2 text-xs">
                  {!rem.isCompleted ? (
                    <>
                      <button
                        onClick={() => {
                          store.completeReminder(rem.id);
                          setTick((t) => t + 1);
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl shadow-2xs active:scale-95 transition-all"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Mark Done</span>
                      </button>

                      <div className="flex items-center gap-1">
                        <span className="text-[10px] text-stone-400 font-medium">Snooze:</span>
                        <button
                          onClick={() => {
                            store.snoozeReminder(rem.id, 15);
                            setTick((t) => t + 1);
                          }}
                          className="px-2 py-1 bg-[#FAF8F5] hover:bg-stone-100 text-stone-700 font-bold rounded-lg border border-[#E7E2DA] text-[10px]"
                        >
                          +15m
                        </button>
                        <button
                          onClick={() => {
                            store.snoozeReminder(rem.id, 60);
                            setTick((t) => t + 1);
                          }}
                          className="px-2 py-1 bg-[#FAF8F5] hover:bg-stone-100 text-stone-700 font-bold rounded-lg border border-[#E7E2DA] text-[10px]"
                        >
                          +1h
                        </button>
                        <button
                          onClick={() => {
                            store.deleteReminder(rem.id);
                            setTick((t) => t + 1);
                          }}
                          className="p-1.5 text-stone-400 hover:text-red-700 rounded-lg"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="flex items-center justify-between w-full text-stone-400">
                      <span className="text-[10px]">Completed {rem.completedAt ? formatDueDate(rem.completedAt) : ""}</span>
                      <button
                        onClick={() => {
                          rem.isCompleted = false;
                          setTick((t) => t + 1);
                        }}
                        className="text-[10px] font-bold text-stone-600 hover:text-stone-900"
                      >
                        Re-open
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Operational Notification Stream History */}
      <div className="luxury-card rounded-2xl p-5 border border-[#E7E2DA] bg-white space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-red-600" />
            <h2 className="text-base font-black text-stone-900">Recent Live Restaurant Events</h2>
          </div>
          <button
            onClick={() => {
              store.markAllNotificationsRead();
              setTick((t) => t + 1);
            }}
            className="text-xs font-bold text-red-700 hover:text-red-900"
          >
            Mark all read
          </button>
        </div>

        <div className="space-y-2">
          {notifications.slice(0, 5).map((n) => (
            <div
              key={n.id}
              className={`p-3 rounded-xl border flex items-center justify-between gap-3 text-xs ${
                n.isRead ? "bg-[#FAF8F5] border-[#E7E2DA] opacity-75" : "bg-white border-amber-300 shadow-2xs"
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-2 h-2 rounded-full bg-red-600 shrink-0" />
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-black text-stone-900 truncate">{n.title}</span>
                    <span className="text-[9px] font-bold text-stone-400">{n.category}</span>
                  </div>
                  <p className="text-[11px] text-stone-600 truncate">{n.message}</p>
                </div>
              </div>

              {n.actionUrl && (
                <Link
                  href={n.actionUrl}
                  className="shrink-0 font-bold text-red-700 hover:text-red-900 flex items-center gap-1 text-[11px]"
                >
                  <span>{n.actionLabel || "View"}</span>
                  <ArrowRight className="w-3 h-3" />
                </Link>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ADD REMINDER MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl border border-[#E7E2DA] overflow-hidden">
            <div className="p-4 bg-gradient-to-r from-stone-900 to-stone-800 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-amber-300" />
                <h3 className="font-black text-sm sm:text-base">Schedule New Reminder (नवीन स्मरण)</h3>
              </div>
              <button onClick={() => setShowAddModal(false)} className="text-stone-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateReminderSubmit} className="p-5 space-y-3.5 text-xs">
              <div>
                <label className="block text-[11px] font-black text-stone-700 mb-1">
                  Title (शीर्षक) *
                </label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Clean Exhaust Hood Filter, Call Mutton Supplier"
                  className="w-full p-2.5 rounded-xl border border-[#E7E2DA] focus:outline-hidden focus:ring-2 focus:ring-red-600 font-bold text-xs"
                />
              </div>

              <div>
                <label className="block text-[11px] font-black text-stone-700 mb-1">
                  Instructions / Notes (तपशील)
                </label>
                <textarea
                  rows={2}
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Specific task steps or notes for staff..."
                  className="w-full p-2.5 rounded-xl border border-[#E7E2DA] focus:outline-hidden focus:ring-2 focus:ring-red-600 font-medium text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-black text-stone-700 mb-1">Category</label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value as any)}
                    className="w-full p-2.5 rounded-xl border border-[#E7E2DA] font-bold text-xs bg-white"
                  >
                    <option value="OPERATIONS">Operations (कामकाज)</option>
                    <option value="SAFETY">Safety (सुरक्षा/गॅस)</option>
                    <option value="INVENTORY">Inventory (साठा)</option>
                    <option value="FINANCE">Finance (पैशांचे व्यवहार)</option>
                    <option value="STAFF">Staff (कर्मचारी)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-black text-stone-700 mb-1">Urgency</label>
                  <select
                    value={newUrgency}
                    onChange={(e) => setNewUrgency(e.target.value as any)}
                    className="w-full p-2.5 rounded-xl border border-[#E7E2DA] font-bold text-xs bg-white"
                  >
                    <option value="LOW">Low (सामान्य)</option>
                    <option value="MEDIUM">Medium (मध्यम)</option>
                    <option value="HIGH">High (महत्त्वाचे)</option>
                    <option value="CRITICAL">Critical (तातडीचे 🔥)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-black text-stone-700 mb-1">Target Staff</label>
                  <select
                    value={newTargetRole}
                    onChange={(e) => setNewTargetRole(e.target.value as any)}
                    className="w-full p-2.5 rounded-xl border border-[#E7E2DA] font-bold text-xs bg-white"
                  >
                    <option value="ALL">All Staff</option>
                    <option value="ADMIN">Owner / Admin</option>
                    <option value="MANAGER">Manager</option>
                    <option value="CHEF">Kitchen / Chef</option>
                    <option value="WAITER">Waiters</option>
                    <option value="CASHIER">Cashier</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-black text-stone-700 mb-1">Recurrence</label>
                  <select
                    value={newRecurrence}
                    onChange={(e) => setNewRecurrence(e.target.value as any)}
                    className="w-full p-2.5 rounded-xl border border-[#E7E2DA] font-bold text-xs bg-white"
                  >
                    <option value="ONCE">One-time</option>
                    <option value="DAILY">Daily Routine</option>
                    <option value="WEEKLY">Weekly Routine</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-black text-stone-700 mb-1">Due Timing</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: "15 Mins", mins: 15 },
                    { label: "1 Hour", mins: 60 },
                    { label: "2 Hours", mins: 120 },
                    { label: "4 Hours", mins: 240 },
                    { label: "Tonight", mins: 360 },
                    { label: "Tomorrow", mins: 1440 },
                  ].map((item) => (
                    <button
                      key={item.mins}
                      type="button"
                      onClick={() => setNewDueMinutes(item.mins)}
                      className={`p-2 rounded-xl border text-center font-bold text-[11px] transition-all ${
                        newDueMinutes === item.mins
                          ? "bg-stone-900 text-amber-300 border-stone-900 shadow-2xs"
                          : "bg-[#FAF8F5] text-stone-700 border-[#E7E2DA] hover:bg-stone-100"
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-stone-600 hover:text-stone-900 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white font-black rounded-xl shadow-2xs active:scale-95 transition-all"
                >
                  Save Reminder
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
