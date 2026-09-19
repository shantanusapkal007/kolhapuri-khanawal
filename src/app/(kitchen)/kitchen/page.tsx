"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  ChefHat,
  Clock,
  CheckCircle2,
  Flame,
  Sparkles,
  XCircle,
  Volume2,
  VolumeX,
  Bell,
  X,
  Printer,
} from "lucide-react";
import { globalRestaurantStore } from "@/lib/store/restaurant-store";
import { Kot, KotStatus, KitchenStationCode, BreadOption, BREAD_OPTION_LABELS } from "@/types/orders";
import { printKotTicket, printCancelledKot } from "@/lib/printing/thermal-printer";
import { useScreenWakeLock } from "@/lib/mobile/useScreenWakeLock";
import { useAndroidBackButton } from "@/lib/mobile/useAndroidBackButton";
import { triggerHaptic } from "@/lib/mobile/haptics";
import { resolveKotOrderNumber } from "@/lib/orders/order-numbering";

export default function KitchenDisplayPage() {
  const store = globalRestaurantStore;
  const [, setTick] = useState(0);

  // Screen Wake Lock: keeps tablet display awake in hot kitchen environment
  useScreenWakeLock(true);

  const [selectedStation, setSelectedStation] = useState<string>("ALL");
  const [selectedStatus, setSelectedStatus] = useState<string>("ACTIVE");
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Audio alert and cancellation state
  const [audioEnabled, setAudioEnabled] = useState<boolean>(true);
  const [cancellingKotId, setCancellingKotId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState<string>("Customer requested cancellation");
  const prevKotCountRef = useRef<number>(store.kots.length);

  // Back button trap to close cancellation modal
  useAndroidBackButton(Boolean(cancellingKotId), () => setCancellingKotId(null));

  const playKitchenChime = () => {
    try {
      if (typeof window === "undefined" || !audioEnabled) return;
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.15); // A5
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.6);
    } catch {
      // Audio autoplay restrictions
    }
  };

  useEffect(() => {
    // 1. Periodic poll check
    const interval = setInterval(() => {
      setTick((t) => t + 1);
      if (store.kots.length > prevKotCountRef.current) {
        playKitchenChime();
        prevKotCountRef.current = store.kots.length;
      }
    }, 1000);

    // 2. Instant multi-device sync event listener
    const handleSync = () => {
      setTick((t) => t + 1);
      if (store.kots.length > prevKotCountRef.current) {
        playKitchenChime();
        prevKotCountRef.current = store.kots.length;
      }
    };
    window.addEventListener("kk-state-changed", handleSync);

    return () => {
      clearInterval(interval);
      window.removeEventListener("kk-state-changed", handleSync);
    };
  }, [audioEnabled]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleAdvanceStatus = (kotId: string, nextStatus: KotStatus) => {
    try {
      store.advanceKotStatus(kotId, nextStatus);
      triggerHaptic(nextStatus === "SERVED" ? "success" : "tap");
      const kot = store.kots.find((k) => k.id === kotId);
      if (kot && nextStatus === "READY") {
        store.addNotification({
          type: "KOT_READY",
          title: `Table ${kot.tableNumber} Food Ready (KOT #${kot.kotNumber})`,
          message: `${kot.items.map((i) => `${i.menuItemName} × ${i.quantity}`).join(", ")} ready on pass shelf.`,
          category: "SERVICE",
          urgency: "HIGH",
          targetRoles: ["WAITER", "MANAGER", "ADMIN"],
          actionUrl: `/waiter/order/${kot.partyId}`,
          actionLabel: "View Order",
          metadata: { tableNumber: kot.tableNumber, kotId: kot.id, kotNumber: kot.kotNumber },
        });
      }
      setTick((t) => t + 1);
      showToast(`KOT status advanced to ${nextStatus}!`);
    } catch (err: any) {
      triggerHaptic("error");
      alert(err.message);
    }
  };

  const handleCancelKotSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancellingKotId) return;
    try {
      const kotToCancel = store.kots.find((k) => k.id === cancellingKotId);
      store.cancelKot(cancellingKotId, cancelReason);
      triggerHaptic("warning");
      if (kotToCancel) {
        printCancelledKot(kotToCancel, cancelReason, store.currentUser.name);
      }
      setTick((t) => t + 1);
      setCancellingKotId(null);
      showToast("KOT ticket cancelled and DO NOT PREPARE slip printed!");
    } catch (err: any) {
      triggerHaptic("error");
      alert(err.message);
    }
  };

  // Filter KOTs with accurate multi-station awareness
  const filteredKots = store.kots.filter((kot) => {
    if ((kot.status as any) === "CANCELLED") return false;

    const matchesStation =
      selectedStation === "ALL" ||
      kot.stationCode === selectedStation ||
      kot.items.some((item) => {
        const menuItem = store.menuItems.find((m) => m.id === item.menuItemId);
        return menuItem?.stationCode === selectedStation;
      });

    let matchesStatus = true;
    if (selectedStatus === "ACTIVE") {
      matchesStatus = kot.status === "NEW" || kot.status === "ACKNOWLEDGED" || kot.status === "PREPARING";
    } else if (selectedStatus === "READY") {
      matchesStatus = kot.status === "READY";
    } else if (selectedStatus === "SERVED") {
      matchesStatus = kot.status === "SERVED";
    }
    return matchesStation && matchesStatus;
  });

  return (
    <div className="space-y-4">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed bottom-4 right-4 z-50 bg-stone-900 text-amber-300 border border-amber-500/40 px-4 py-3 rounded-xl shadow-xl flex items-center gap-2 text-sm font-semibold animate-bounce">
          <Sparkles className="w-4 h-4 text-amber-400" />
          {toastMessage}
        </div>
      )}

      {/* Luxury Hero Header */}
      <div className="luxury-card rounded-2xl p-5 sm:p-6 border border-[#E7E2DA] space-y-4 bg-gradient-to-r from-white via-[#FAF8F5] to-white">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-600 to-amber-700 text-white flex items-center justify-center shadow-md shadow-amber-600/20 border border-amber-500/30 shrink-0">
              <ChefHat className="w-6 h-6 text-amber-100" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black text-stone-900 tracking-tight">
                  Kitchen Display System (KDS)
                </h1>
                <span className="bg-amber-50 text-amber-900 text-[10px] font-black px-2.5 py-0.5 rounded-full border border-amber-200 uppercase tracking-wider">
                  Live Dispatch
                </span>
              </div>
              <p className="text-xs text-stone-500 font-medium mt-0.5">
                Realtime station routing (Thali, Bhakri, Fry, Drinks), preparation timers & stock triggers.
              </p>
            </div>
          </div>

          {/* Status View Switcher & Chime Toggle */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-[#FAF8F5] p-1 rounded-xl border border-[#E7E2DA] text-xs font-bold">
              <button
                onClick={() => setSelectedStatus("ACTIVE")}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  selectedStatus === "ACTIVE"
                    ? "bg-red-600 text-white shadow-2xs font-black"
                    : "text-stone-600 hover:text-stone-900"
                }`}
              >
                Active Prep ({store.kots.filter((k) => k.status !== "READY" && k.status !== "SERVED" && (k.status as any) !== "CANCELLED").length})
              </button>
              <button
                onClick={() => setSelectedStatus("READY")}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  selectedStatus === "READY"
                    ? "bg-emerald-600 text-white shadow-2xs font-black"
                    : "text-stone-600 hover:text-stone-900"
                }`}
              >
                Ready to Serve ({store.kots.filter((k) => k.status === "READY").length})
              </button>
              <button
                onClick={() => setSelectedStatus("SERVED")}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  selectedStatus === "SERVED"
                    ? "bg-stone-900 text-white shadow-2xs font-black"
                    : "text-stone-600 hover:text-stone-900"
                }`}
              >
                Served History
              </button>
            </div>

            <button
              onClick={() => {
                setAudioEnabled(!audioEnabled);
                if (!audioEnabled) playKitchenChime();
              }}
              className={`p-2 rounded-xl border text-xs font-bold transition-all flex items-center gap-1.5 shadow-2xs ${
                audioEnabled
                  ? "bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100"
                  : "bg-stone-100 text-stone-500 border-stone-200 hover:bg-stone-200"
              }`}
              title={audioEnabled ? "Order chime active" : "Order chime muted"}
            >
              {audioEnabled ? <Volume2 className="w-4 h-4 text-amber-600" /> : <VolumeX className="w-4 h-4" />}
              <span className="hidden sm:inline">{audioEnabled ? "Chime On" : "Muted"}</span>
            </button>
          </div>
        </div>

        {/* Station Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none text-xs">
          <button
            onClick={() => setSelectedStation("ALL")}
            className={`px-3.5 py-1.5 rounded-xl font-black whitespace-nowrap transition-all border ${
              selectedStation === "ALL"
                ? "bg-stone-900 text-amber-200 border-stone-900 shadow-2xs"
                : "bg-white text-stone-600 border-[#E7E2DA] hover:bg-[#FAF8F5]"
            }`}
          >
            All Stations
          </button>
          {store.kitchenStations.map((st) => (
            <button
              key={st.id}
              onClick={() => setSelectedStation(st.code)}
              className={`px-3.5 py-1.5 rounded-xl font-black whitespace-nowrap transition-all border ${
                selectedStation === st.code
                  ? "bg-gradient-to-r from-red-600 to-red-700 text-white border-red-600 shadow-2xs"
                  : "bg-white text-stone-600 border-[#E7E2DA] hover:bg-[#FAF8F5]"
              }`}
            >
              {st.name}
            </button>
          ))}
        </div>
      </div>

      {/* KOT Cards Grid */}
      {filteredKots.length === 0 ? (
        <div className="bg-white p-12 text-center rounded-2xl border border-stone-200 text-stone-400">
          <ChefHat className="w-12 h-12 mx-auto mb-2 opacity-30" />
          <h3 className="text-base font-bold text-stone-700">No Kitchen Orders in this View</h3>
          <p className="text-xs text-stone-500 mt-1">Orders sent by waiters will appear here in realtime.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredKots.map((kot) => {
            const isReady = kot.status === "READY";
            const isServed = kot.status === "SERVED";
            const isNew = kot.status === "NEW";

            // Calculate elapsed time since KOT was created
            const elapsedMs = Date.now() - new Date(kot.createdAt).getTime();
            const elapsedMins = Math.floor(elapsedMs / 60000);
            const elapsedSecs = Math.floor((elapsedMs % 60000) / 1000);
            const isOverdue = elapsedMins >= 15;

            return (
              <div
                key={kot.id}
                className={`luxury-card rounded-2xl border flex flex-col justify-between overflow-hidden shadow-xs transition-all ${
                  isReady
                    ? "border-emerald-500/80 ring-2 ring-emerald-200/60"
                    : isNew
                    ? "border-red-500/80 ring-2 ring-red-200/60 animate-urgent"
                    : "border-[#E7E2DA] hover:border-amber-400/80"
                }`}
              >
                {/* Ticket Header */}
                <div
                  className={`p-3.5 text-white flex items-center justify-between ${
                    isReady
                      ? "bg-gradient-to-r from-emerald-600 to-emerald-700"
                      : isNew
                      ? "bg-gradient-to-r from-red-600 to-red-700"
                      : "bg-gradient-to-r from-stone-900 via-stone-800 to-stone-900"
                  }`}
                >
                  <div>
                    {kot.isTakeaway && (
                      <div className="bg-orange-500 text-white text-[11px] font-black px-2 py-0.5 rounded-md inline-flex items-center gap-1 mb-1 shadow-xs">
                        <span>🥡 पार्सल (PARCEL)</span>
                      </div>
                    )}
                    <div className="flex items-center gap-1.5 font-black text-base flex-wrap">
                      <span className="bg-amber-300 text-stone-950 text-xs px-2 py-0.5 rounded font-black tracking-wide shadow-2xs">
                        {resolveKotOrderNumber(kot).orderTitle}
                      </span>
                      <span>{kot.isTakeaway ? "ऑर्डर - पार्सल" : `ऑर्डर - टेबल नं. ${kot.tableNumber}`}</span>
                      <span className="bg-white/20 text-white text-xs px-2 py-0.5 rounded font-black">
                        {kot.partyCode}
                      </span>
                      {kot.isAddOn && (
                        <span className="bg-amber-400 text-stone-950 text-[10px] px-2 py-0.5 rounded font-black shadow-2xs">
                          रनिंग ऑर्डर #{kot.kotSequenceNumber || 2}
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-stone-200 font-medium">
                      वेटर: <strong>{kot.waiterName}</strong>
                    </span>
                  </div>

                  <div className="text-right">
                    <span className="font-black text-xs block tracking-wide">{kot.kotNumber}</span>
                    <span className="text-[10px] uppercase font-black bg-black/30 px-2 py-0.5 rounded-md">
                      {kot.status}
                    </span>
                  </div>
                </div>

                {/* Live Elapsed Timer */}
                {!isServed && (
                  <div className={`px-3.5 py-2 flex items-center justify-between text-xs border-b ${
                    isOverdue ? "bg-red-50 border-red-200" : "bg-[#FAF8F5] border-[#E7E2DA]"
                  }`}>
                    <div className="flex items-center gap-1.5">
                      <Clock className={`w-3.5 h-3.5 ${
                        isOverdue ? "text-red-600" : "text-stone-500"
                      }`} />
                      <span className={`font-black ${
                        isOverdue ? "text-red-700" : "text-stone-700"
                      }`}>
                        {elapsedMins}m {elapsedSecs.toString().padStart(2, "0")}s elapsed
                      </span>
                    </div>
                    {isOverdue && (
                      <span className="text-[10px] font-black text-red-700 bg-red-100 px-2 py-0.5 rounded-md border border-red-300 animate-pulse">
                        OVERDUE
                      </span>
                    )}
                  </div>
                )}

                {/* Items List (Filtered by station if specific station selected) */}
                <div className="p-3.5 space-y-2 flex-1 divide-y divide-stone-100">
                  {(selectedStation === "ALL"
                    ? kot.items
                    : kot.items.filter((item) => {
                        const menuItem = store.menuItems.find((m) => m.id === item.menuItemId);
                        return menuItem ? menuItem.stationCode === selectedStation : kot.stationCode === selectedStation;
                      })
                  ).map((item) => {
                    const marathiName =
                      item.menuItemLocalName ||
                      store.menuItems.find((m) => m.id === item.menuItemId)?.localName ||
                      item.menuItemName;
                    const englishSubtitle =
                      (item as any).menuItemEnglishName ||
                      (item.menuItemName && item.menuItemName.trim() !== marathiName.trim() ? item.menuItemName : "");

                    return (
                      <div key={item.id} className="pt-2 first:pt-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-start gap-2.5">
                            <span className="w-6 h-6 rounded-md bg-stone-900 text-white font-black text-xs flex items-center justify-center shrink-0 mt-0.5">
                              {item.quantity}×
                            </span>
                            <div>
                              <span className="font-black text-base text-stone-900 leading-snug block">
                                {marathiName}
                              </span>
                              {englishSubtitle && (
                                <span className="text-xs text-stone-500 font-semibold block">
                                  {englishSubtitle}
                                </span>
                              )}
                            </div>
                          </div>
                          {item.seatNumber && (
                            <span className="text-[10px] font-bold text-stone-600 bg-stone-100 px-1.5 py-0.5 rounded shrink-0 whitespace-nowrap">
                              जागा {item.seatNumber}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 mt-1.5 ml-8 flex-wrap">
                          {item.breadOption && (
                            <span className="text-[11px] font-black text-amber-950 bg-amber-200 border border-amber-400 px-2 py-0.5 rounded-md flex items-center gap-1 shadow-2xs">
                              <span>🍞</span>
                              <span>{BREAD_OPTION_LABELS[item.breadOption as BreadOption]?.mr || item.breadOption}</span>
                              <span className="text-[9px] text-amber-800 font-bold">({BREAD_OPTION_LABELS[item.breadOption as BreadOption]?.en})</span>
                            </span>
                          )}
                          {item.spiceLevel && item.spiceLevel !== "MEDIUM" && (
                            <span className="text-[10px] font-bold text-amber-800 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
                              🌶️ {item.spiceLevel.replace(/_/g, " ")}
                            </span>
                          )}
                          {item.notes && (
                            <span className="text-[11px] font-semibold text-red-600 italic">
                              📝 “{item.notes}”
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Step Action Buttons */}
                <div className="p-3 bg-stone-50 border-t border-stone-200 flex items-center gap-2">
                  {isNew ? (
                    <button
                      onClick={() => handleAdvanceStatus(kot.id, "PREPARING")}
                      className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white font-black text-xs rounded-xl shadow-xs active:scale-95 transition-all"
                    >
                      START PREPARATION
                    </button>
                  ) : kot.status === "PREPARING" || kot.status === "ACKNOWLEDGED" ? (
                    <button
                      onClick={() => handleAdvanceStatus(kot.id, "READY")}
                      className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl shadow-xs active:scale-95 transition-all flex items-center justify-center gap-1.5"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>MARK ORDER READY</span>
                    </button>
                  ) : isReady ? (
                    <button
                      onClick={() => handleAdvanceStatus(kot.id, "SERVED")}
                      className="flex-1 py-2.5 bg-stone-800 hover:bg-stone-900 text-white font-bold text-xs rounded-xl active:scale-95 transition-all"
                    >
                      MARK SERVED
                    </button>
                  ) : (
                    <span className="flex-1 text-center text-xs font-bold text-stone-400 py-1">
                      Served to Table
                    </span>
                  )}

                  {/* Print KOT Button */}
                  <button
                    onClick={() => {
                      printKotTicket(kot, undefined, true, store.printerSettings?.paperWidth || "80mm");
                      showToast(`Printing KOT ${kot.kotNumber} (reprint)...`);
                    }}
                    className="p-2.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-xs font-bold rounded-xl active:scale-95 transition-all shrink-0"
                    title="Print KOT Ticket (Kitchen Copy / Reprint)"
                  >
                    <Printer className="w-4 h-4" />
                  </button>

                  {!isServed && (
                    <button
                      onClick={() => {
                        setCancellingKotId(kot.id);
                        setCancelReason("Customer cancelled item before preparation");
                      }}
                      className="p-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold rounded-xl active:scale-95 transition-all shrink-0"
                      title="Void / Cancel KOT Ticket"
                    >
                      <XCircle className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL: VOID / CANCEL KOT */}
      {cancellingKotId && (
        <div className="fixed inset-0 z-50 bg-stone-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-stone-200 overflow-hidden text-xs animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-rose-50 border-b border-rose-200 p-4 text-rose-900 flex items-center justify-between font-black text-sm">
              <div className="flex items-center gap-2">
                <XCircle className="w-5 h-5 text-rose-600" />
                <span>Void / Cancel Kitchen Ticket</span>
              </div>
              <button
                onClick={() => setCancellingKotId(null)}
                className="text-stone-400 hover:text-stone-700 p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCancelKotSubmit} className="p-5 space-y-4">
              <p className="text-stone-600 leading-relaxed text-xs">
                Cancelling this KOT will void the ticket and immediately release all reserved raw ingredient stocks back to available inventory.
              </p>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  Cancellation Reason *
                </label>
                <input
                  type="text"
                  required
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  className="w-full bg-stone-50 border border-stone-300 rounded-xl px-3 py-2 text-xs text-stone-900 font-semibold focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setCancellingKotId(null)}
                  className="px-4 py-2 text-xs font-bold text-stone-600 hover:bg-stone-100 rounded-xl"
                >
                  Keep Ticket
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow-xs active:scale-95"
                >
                  Confirm Void & Release Stock
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
