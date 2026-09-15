"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  X,
  Bell,
  Volume2,
  VolumeX,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Flame,
  ChefHat,
  Receipt,
  Boxes,
  Sparkles,
  Plus,
  Trash2,
  RotateCcw,
  Check,
  Calendar,
  Layers,
  ArrowRight,
} from "lucide-react";
import { globalRestaurantStore } from "@/lib/store/restaurant-store";
import { RestaurantNotification, KhanawalReminder, NotificationCategory } from "@/types/domain";

interface NotificationCenterDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function NotificationCenterDrawer({ isOpen, onClose }: NotificationCenterDrawerProps) {
  const store = globalRestaurantStore;
  const [, setTick] = useState(0);
  const [activeTab, setActiveTab] = useState<"NOTIFICATIONS" | "REMINDERS" | "ADD_REMINDER">("NOTIFICATIONS");
  const [categoryFilter, setCategoryFilter] = useState<"ALL" | NotificationCategory>("ALL");

  // Add Reminder Form State
  const [newTitle, setNewTitle] = useState("");
  const [newMessage, setNewMessage] = useState("");
  const [newCategory, setNewCategory] = useState<KhanawalReminder["category"]>("OPERATIONS");
  const [newUrgency, setNewUrgency] = useState<KhanawalReminder["urgency"]>("HIGH");
  const [newTargetRole, setNewTargetRole] = useState<KhanawalReminder["targetRole"]>("ALL");
  const [newDueMinutes, setNewDueMinutes] = useState<number>(30);

  useEffect(() => {
    const handleEvent = () => setTick((t) => t + 1);
    window.addEventListener("khanawal-notification", handleEvent);
    const interval = setInterval(() => setTick((t) => t + 1), 3000);
    return () => {
      window.removeEventListener("khanawal-notification", handleEvent);
      clearInterval(interval);
    };
  }, []);

  if (!isOpen) return null;

  const notifications = store.notifications;
  const reminders = store.reminders;
  const unreadNotifCount = notifications.filter((n) => !n.isRead).length;
  const pendingRemindersCount = reminders.filter((r) => !r.isCompleted && !r.isDismissed).length;

  const filteredNotifications = notifications.filter((n) => {
    if (categoryFilter === "ALL") return true;
    return n.category === categoryFilter;
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
      dueDate,
      recurrence: "ONCE",
      isDismissed: false,
    });

    setNewTitle("");
    setNewMessage("");
    setActiveTab("REMINDERS");
    setTick((t) => t + 1);
  };

  const formatRelativeTime = (isoString: string) => {
    const diffMs = Date.now() - new Date(isoString).getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return new Date(isoString).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  };

  const getCategoryIcon = (category: NotificationCategory) => {
    switch (category) {
      case "KITCHEN":
        return <ChefHat className="w-4 h-4 text-amber-600" />;
      case "SERVICE":
        return <Sparkles className="w-4 h-4 text-emerald-600" />;
      case "BILLING":
        return <Receipt className="w-4 h-4 text-red-600" />;
      case "INVENTORY":
        return <Boxes className="w-4 h-4 text-amber-600" />;
      case "MAINTENANCE":
        return <AlertTriangle className="w-4 h-4 text-orange-600" />;
      default:
        return <Bell className="w-4 h-4 text-stone-600" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-stone-900/60 backdrop-blur-xs flex justify-end animate-in fade-in duration-200">
      {/* Click outside to close */}
      <div className="flex-1" onClick={onClose} />

      {/* Drawer Panel */}
      <div className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col border-l border-[#E7E2DA] animate-in slide-in-from-right duration-250">
        {/* Top Header */}
        <div className="p-4 border-b border-[#E7E2DA] bg-gradient-to-r from-stone-900 via-stone-800 to-stone-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-red-600 to-red-700 flex items-center justify-center shadow-sm">
              <Bell className="w-4 h-4 text-amber-200" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-black tracking-tight">Notifications & Reminders</h2>
                {unreadNotifCount > 0 && (
                  <span className="bg-red-600 text-white text-[10px] font-black px-1.5 py-0.2 rounded-full">
                    {unreadNotifCount}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-stone-400 font-medium">सूचना व स्मरण केंद्र</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Audio Toggle */}
            <button
              onClick={() => {
                store.toggleSound();
                setTick((t) => t + 1);
              }}
              title={store.soundEnabled ? "Mute audio chimes" : "Unmute audio chimes"}
              className={`p-2 rounded-xl border transition-all active:scale-90 ${
                store.soundEnabled
                  ? "bg-stone-800 text-amber-300 border-stone-700 hover:bg-stone-700"
                  : "bg-stone-800/60 text-stone-500 border-stone-800 hover:bg-stone-800"
              }`}
            >
              {store.soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>

            {/* Close */}
            <button
              onClick={onClose}
              className="p-2 text-stone-400 hover:text-white rounded-xl hover:bg-stone-800 transition-colors"
              aria-label="Close notifications"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-[#E7E2DA] bg-[#FAF8F5] p-1 gap-1 text-xs font-bold shrink-0">
          <button
            onClick={() => setActiveTab("NOTIFICATIONS")}
            className={`flex-1 py-2 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
              activeTab === "NOTIFICATIONS"
                ? "bg-white text-stone-900 shadow-2xs border border-[#E7E2DA]"
                : "text-stone-500 hover:text-stone-800"
            }`}
          >
            <Bell className="w-3.5 h-3.5 text-amber-600" />
            <span>Alerts</span>
            {unreadNotifCount > 0 && (
              <span className="bg-red-600 text-white text-[9px] font-black px-1.5 rounded-full">
                {unreadNotifCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab("REMINDERS")}
            className={`flex-1 py-2 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
              activeTab === "REMINDERS"
                ? "bg-white text-stone-900 shadow-2xs border border-[#E7E2DA]"
                : "text-stone-500 hover:text-stone-800"
            }`}
          >
            <Clock className="w-3.5 h-3.5 text-red-600" />
            <span>Reminders</span>
            {pendingRemindersCount > 0 && (
              <span className="bg-amber-500 text-stone-950 text-[9px] font-black px-1.5 rounded-full">
                {pendingRemindersCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab("ADD_REMINDER")}
            className={`py-2 px-3 rounded-xl transition-all flex items-center justify-center gap-1 ${
              activeTab === "ADD_REMINDER"
                ? "bg-red-600 text-white shadow-2xs"
                : "text-stone-500 hover:text-stone-800"
            }`}
            title="Create Custom Reminder"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Add</span>
          </button>
        </div>

        {/* ── TAB 1: NOTIFICATIONS ────────────────────────────────────── */}
        {activeTab === "NOTIFICATIONS" && (
          <div className="flex-1 flex flex-col min-h-0">
            {/* Filter Bar & Mark All Read */}
            <div className="p-2.5 border-b border-[#E7E2DA] flex items-center justify-between gap-2 overflow-x-auto no-scrollbar text-xs">
              <div className="flex items-center gap-1">
                {(["ALL", "KITCHEN", "SERVICE", "BILLING", "INVENTORY"] as const).map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setCategoryFilter(cat)}
                    className={`px-2 py-1 rounded-lg text-[10px] font-black transition-all ${
                      categoryFilter === cat
                        ? "bg-stone-900 text-amber-200"
                        : "bg-[#FAF8F5] text-stone-600 hover:bg-stone-100 border border-[#E7E2DA]"
                    }`}
                  >
                    {cat === "ALL" ? "All" : cat}
                  </button>
                ))}
              </div>

              {unreadNotifCount > 0 && (
                <button
                  onClick={() => {
                    store.markAllNotificationsRead();
                    setTick((t) => t + 1);
                  }}
                  className="text-[10px] font-bold text-red-700 hover:text-red-900 whitespace-nowrap shrink-0"
                >
                  Mark all read
                </button>
              )}
            </div>

            {/* Notifications List */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {filteredNotifications.length === 0 ? (
                <div className="h-64 flex flex-col items-center justify-center text-center p-6 text-stone-400">
                  <div className="w-12 h-12 rounded-2xl bg-[#FAF8F5] flex items-center justify-center text-stone-400 mb-2 border border-[#E7E2DA]">
                    <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                  </div>
                  <h3 className="text-sm font-bold text-stone-700">All caught up!</h3>
                  <p className="text-xs text-stone-400 mt-0.5">No pending operational alerts in this category.</p>
                </div>
              ) : (
                filteredNotifications.map((notif) => (
                  <div
                    key={notif.id}
                    onClick={() => {
                      if (!notif.isRead) {
                        store.markNotificationRead(notif.id);
                        setTick((t) => t + 1);
                      }
                    }}
                    className={`p-3 rounded-2xl border transition-all relative overflow-hidden text-xs ${
                      notif.isRead
                        ? "bg-white border-[#E7E2DA] opacity-80"
                        : notif.urgency === "CRITICAL"
                        ? "bg-red-50/50 border-red-200 shadow-2xs"
                        : notif.urgency === "HIGH"
                        ? "bg-amber-50/40 border-amber-200 shadow-2xs"
                        : "bg-[#FAF8F5] border-[#E7E2DA] shadow-2xs"
                    }`}
                  >
                    {/* Urgency accent bar */}
                    {!notif.isRead && (
                      <div
                        className={`absolute left-0 top-0 bottom-0 w-1 ${
                          notif.urgency === "CRITICAL"
                            ? "bg-red-600"
                            : notif.urgency === "HIGH"
                            ? "bg-amber-500"
                            : "bg-blue-500"
                        }`}
                      />
                    )}

                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <div className="p-1 rounded-lg bg-white border border-[#E7E2DA] shadow-2xs">
                          {getCategoryIcon(notif.category)}
                        </div>
                        <span className="font-black text-stone-900 text-xs">{notif.title}</span>
                      </div>

                      <div className="flex items-center gap-1">
                        <span className="text-[10px] text-stone-400 font-medium whitespace-nowrap">
                          {formatRelativeTime(notif.createdAt)}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            store.dismissNotification(notif.id);
                            setTick((t) => t + 1);
                          }}
                          className="p-1 text-stone-400 hover:text-stone-700 rounded"
                          title="Dismiss"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <p className="text-stone-600 mt-1.5 text-[11px] leading-relaxed">{notif.message}</p>

                    {/* Action Link */}
                    {notif.actionUrl && (
                      <div className="mt-2.5 pt-2 border-t border-stone-100 flex items-center justify-between">
                        <span className="text-[10px] font-bold text-stone-400">
                          {notif.targetRoles?.join(", ")}
                        </span>
                        <Link
                          href={notif.actionUrl}
                          onClick={() => {
                            store.markNotificationRead(notif.id);
                            onClose();
                          }}
                          className="inline-flex items-center gap-1 text-[11px] font-black text-red-700 hover:text-red-800 bg-red-50 hover:bg-red-100/70 px-2.5 py-1 rounded-lg transition-colors"
                        >
                          <span>{notif.actionLabel || "View Action"}</span>
                          <ArrowRight className="w-3 h-3" />
                        </Link>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* ── TAB 2: REMINDERS ────────────────────────────────────────── */}
        {activeTab === "REMINDERS" && (
          <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
            <div className="flex items-center justify-between text-xs font-bold text-stone-500 px-1">
              <span>Operational Checklists & Reminders</span>
              <span className="text-[11px] font-normal">{pendingRemindersCount} Active</span>
            </div>

            {reminders.map((rem) => {
              const isOverdue = rem.dueDate && new Date(rem.dueDate).getTime() <= Date.now();
              const isSnoozed = rem.snoozedUntil && new Date(rem.snoozedUntil).getTime() > Date.now();

              return (
                <div
                  key={rem.id}
                  className={`p-3 rounded-2xl border transition-all text-xs ${
                    rem.isCompleted
                      ? "bg-[#FAF8F5] border-[#E7E2DA] opacity-60 line-through"
                      : isOverdue && !isSnoozed
                      ? "bg-red-50/40 border-red-200 ring-1 ring-red-300"
                      : "bg-white border-[#E7E2DA] shadow-2xs"
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    {/* Completion Checkbox */}
                    <button
                      onClick={() => {
                        if (rem.isCompleted) {
                          rem.isCompleted = false;
                        } else {
                          store.completeReminder(rem.id);
                        }
                        setTick((t) => t + 1);
                      }}
                      className={`mt-0.5 w-5 h-5 rounded-lg border flex items-center justify-center transition-all ${
                        rem.isCompleted
                          ? "bg-emerald-600 border-emerald-600 text-white"
                          : "border-stone-300 hover:border-red-600 bg-white"
                      }`}
                    >
                      {rem.isCompleted && <Check className="w-3.5 h-3.5" />}
                    </button>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className={`font-black text-xs text-stone-900 truncate ${rem.isCompleted ? "line-through text-stone-500" : ""}`}>
                          {rem.title}
                        </span>
                        <div className="flex items-center gap-1 shrink-0">
                          {isSnoozed && (
                            <span className="bg-amber-100 text-amber-800 text-[9px] font-black px-1.5 py-0.2 rounded-full">
                              Snoozed
                            </span>
                          )}
                          <span
                            className={`text-[9px] font-black px-1.5 py-0.2 rounded-full ${
                              rem.urgency === "CRITICAL"
                                ? "bg-red-600 text-white"
                                : rem.urgency === "HIGH"
                                ? "bg-amber-500 text-stone-950"
                                : "bg-stone-100 text-stone-700"
                            }`}
                          >
                            {rem.category}
                          </span>
                        </div>
                      </div>

                      <p className={`text-[11px] text-stone-600 mt-1 leading-relaxed ${rem.isCompleted ? "line-through text-stone-400" : ""}`}>
                        {rem.message}
                      </p>

                      {/* Reminder Controls: Snooze & Delete */}
                      {!rem.isCompleted && (
                        <div className="flex items-center justify-between gap-2 mt-2 pt-2 border-t border-stone-100">
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] text-stone-400 font-medium">Snooze:</span>
                            <button
                              onClick={() => {
                                store.snoozeReminder(rem.id, 15);
                                setTick((t) => t + 1);
                              }}
                              className="px-1.5 py-0.5 bg-[#FAF8F5] hover:bg-stone-100 text-stone-700 rounded text-[10px] font-bold border border-[#E7E2DA]"
                            >
                              +15m
                            </button>
                            <button
                              onClick={() => {
                                store.snoozeReminder(rem.id, 60);
                                setTick((t) => t + 1);
                              }}
                              className="px-1.5 py-0.5 bg-[#FAF8F5] hover:bg-stone-100 text-stone-700 rounded text-[10px] font-bold border border-[#E7E2DA]"
                            >
                              +1h
                            </button>
                          </div>

                          <button
                            onClick={() => {
                              store.deleteReminder(rem.id);
                              setTick((t) => t + 1);
                            }}
                            className="p-1 text-stone-400 hover:text-red-700 transition-colors"
                            title="Delete reminder"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── TAB 3: CREATE CUSTOM REMINDER ──────────────────────────── */}
        {activeTab === "ADD_REMINDER" && (
          <form onSubmit={handleCreateReminderSubmit} className="flex-1 overflow-y-auto p-4 space-y-3.5 text-xs">
            <div>
              <label className="block text-[11px] font-black text-stone-700 mb-1">
                Reminder Title (स्मरण शीर्षक) *
              </label>
              <input
                type="text"
                required
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="e.g. Call Mutton Vendor, Check Gas Cylinder B"
                className="w-full p-2.5 rounded-xl border border-[#E7E2DA] focus:outline-hidden focus:ring-2 focus:ring-red-600 font-medium text-xs"
              />
            </div>

            <div>
              <label className="block text-[11px] font-black text-stone-700 mb-1">
                Details / Notes (तपशील)
              </label>
              <textarea
                rows={2}
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Optional instructions for staff..."
                className="w-full p-2.5 rounded-xl border border-[#E7E2DA] focus:outline-hidden focus:ring-2 focus:ring-red-600 font-medium text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
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

            <div>
              <label className="block text-[11px] font-black text-stone-700 mb-1">Due Timing</label>
              <div className="grid grid-cols-3 gap-1.5">
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

            <button
              type="submit"
              className="w-full mt-2 py-3 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white font-black text-xs rounded-xl shadow-sm shadow-red-700/20 active:scale-95 transition-all"
            >
              + Create Reminder (स्मरण जतन करा)
            </button>
          </form>
        )}

        {/* Bottom Footer */}
        <div className="p-3 border-t border-[#E7E2DA] bg-[#FAF8F5] flex items-center justify-between text-xs text-stone-500 shrink-0">
          <Link
            href="/reminders"
            onClick={onClose}
            className="font-bold text-red-700 hover:text-red-900 flex items-center gap-1 text-[11px]"
          >
            <span>Open Reminders Dashboard →</span>
          </Link>
          <span className="text-[10px]">Kolhapuri Khanawal OS</span>
        </div>
      </div>
    </div>
  );
}
