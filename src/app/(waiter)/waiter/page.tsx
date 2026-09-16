"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Utensils,
  Plus,
  Users,
  ArrowRightLeft,
  Merge,
  Scissors,
  Receipt,
  Sparkles,
  X,
  ShoppingBag,
  ChefHat,
  Printer,
  MoreVertical,
} from "lucide-react";
import { globalRestaurantStore } from "@/lib/store/restaurant-store";
import { DiningTable, DiningParty } from "@/types/tables";
import { printTableCheck, printBillReceipt, printKotTicket } from "@/lib/printing/thermal-printer";
import { WaiterPrinterSettingsModal } from "@/components/waiter/WaiterPrinterSettingsModal";
import { useAndroidBackButton } from "@/lib/mobile/useAndroidBackButton";
import { triggerHaptic } from "@/lib/mobile/haptics";

export default function WaiterFloorPage() {
  const router = useRouter();
  const store = globalRestaurantStore;
  const [, setTick] = useState(0);

  const [activeModal, setActiveModal] = useState<"ADD_PARTY" | "TRANSFER" | "MERGE" | "SPLIT" | null>(null);
  const [showPrinterModal, setShowPrinterModal] = useState<boolean>(false);
  const [activeTableForDetail, setActiveTableForDetail] = useState<DiningTable | null>(null);
  const [selectedTableNumber, setSelectedTableNumber] = useState<number>(1);
  const [guestCount, setGuestCount] = useState<number>(2);
  const [descriptor, setDescriptor] = useState<string>("");
  const [isTakeaway, setIsTakeaway] = useState<boolean>(false);
  const [customerName, setCustomerName] = useState<string>("");
  const [customerPhone, setCustomerPhone] = useState<string>("");

  const [floorFilter, setFloorFilter] = useState<"ALL" | "AVAILABLE" | "OCCUPIED" | "SHARED" | "BILL_REQUESTED">("ALL");

  // Transfer state
  const [transferPartyId, setTransferPartyId] = useState<string>("");
  const [targetTableNumber, setTargetTableNumber] = useState<number>(2);

  // Merge state
  const [selectedPartyIdsForMerge, setSelectedPartyIdsForMerge] = useState<string[]>([]);

  // Split state
  const [splitSourcePartyId, setSplitSourcePartyId] = useState<string>("");
  const [splitTargetTableNumber, setSplitTargetTableNumber] = useState<number>(1);
  const [selectedOrderItemIdsForSplit, setSelectedOrderItemIdsForSplit] = useState<string[]>([]);

  // Feedback Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Android Back Button Trap: Close active modals or sheets before leaving floor
  const isAnyModalOpen = Boolean(activeModal) || showPrinterModal || Boolean(activeTableForDetail);
  useAndroidBackButton(isAnyModalOpen, () => {
    if (activeModal) {
      setActiveModal(null);
    } else if (showPrinterModal) {
      setShowPrinterModal(false);
    } else if (activeTableForDetail) {
      setActiveTableForDetail(null);
    }
  });

  useEffect(() => {
    const interval = setInterval(() => {
      setTick((t) => t + 1);
    }, 1000);

    const handleSync = () => {
      setTick((t) => t + 1);
    };
    window.addEventListener("kk-state-changed", handleSync);

    return () => {
      clearInterval(interval);
      window.removeEventListener("kk-state-changed", handleSync);
    };
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleOpenAddParty = (tableNum: number) => {
    triggerHaptic("tap");
    setSelectedTableNumber(tableNum);
    setGuestCount(2);
    setDescriptor("");
    setIsTakeaway(false);
    setCustomerName("");
    setCustomerPhone("");
    setActiveModal("ADD_PARTY");
  };

  const handleQuickSeatAndOrder = (tableNum: number, guests: number = 2) => {
    try {
      triggerHaptic("success");
      const party = store.createPartyAtTable(tableNum, guests, "", false, "", "", 0);
      setTick((t) => t + 1);
      showToast(`Party ${party.partyCode} opened at Table ${tableNum}! Opening order screen...`);
      router.push(`/waiter/order/${party.id}`);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleCreatePartySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      triggerHaptic("success");
      const party = store.createPartyAtTable(
        selectedTableNumber,
        guestCount,
        descriptor,
        isTakeaway,
        customerName,
        customerPhone,
        isTakeaway ? 20 : 0
      );
      setTick((t) => t + 1);
      setActiveModal(null);
      showToast(`${isTakeaway ? "Parcel (पार्सल)" : "Party"} ${party.partyCode} opened! Taking order...`);
      // Immediately redirect to take orders
      router.push(`/waiter/order/${party.id}`);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleTransferSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      triggerHaptic("success");
      const updated = store.transferPartyToTable(transferPartyId, targetTableNumber);
      setTick((t) => t + 1);
      setActiveModal(null);
      showToast(`Party ${updated.partyCode} successfully moved to Table ${targetTableNumber}!`);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleMergeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      triggerHaptic("success");
      const merged = store.mergePartiesTogether(selectedPartyIdsForMerge);
      setTick((t) => t + 1);
      setActiveModal(null);
      showToast(`Parties merged into ${merged.partyCode}!`);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleSplitSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      triggerHaptic("success");
      const { newParty } = store.splitPartyItemsAction(
        splitSourcePartyId,
        splitTargetTableNumber,
        selectedOrderItemIdsForSplit
      );
      setTick((t) => t + 1);
      setActiveModal(null);
      setSelectedOrderItemIdsForSplit([]);
      showToast(`Created new split party ${newParty.partyCode} at Table ${splitTargetTableNumber}!`);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleRequestBill = (partyId: string) => {
    const targetParty = store.parties.find((p) => p.id === partyId);
    if (!targetParty) return;

    store.parties = store.parties.map((p) =>
      p.id === partyId ? { ...p, status: "WAITING_FOR_BILL", lastActivityAt: new Date().toISOString() } : p
    );

    // Auto-generate and print interim Table Check / Pre-Bill with UPI QR
    const partyOrders = store.orders.filter((o) => o.partyId === partyId);
    const partyItems = partyOrders.flatMap((o) => o.items);
    if (partyItems.length > 0) {
      const subtotal = partyItems.reduce((s, i) => s + i.totalPrice, 0);
      const taxEstimate = Number((subtotal * 0.05).toFixed(2));
      const grandTotal = Math.round(subtotal + taxEstimate);
      printTableCheck({
        party: targetParty,
        items: partyItems,
        subtotal,
        taxEstimate,
        grandTotal,
        cashierName: store.currentUser.name,
        paperWidth: store.printerSettings?.paperWidth || "80mm",
      });
    }

    const table = store.tables.find((t) => t.id === targetParty.tableId);
    const tableNum = table ? table.tableNumber : 1;
    store.addNotification({
      type: "BILL_REQUESTED",
      title: `Table ${tableNum} Requested Bill 🔥`,
      message: `${targetParty.partyCode} (${targetParty.customerName || "Walk-in"}) is ready for billing. Running subtotal: ₹${targetParty.runningSubtotal}.`,
      category: "BILLING",
      urgency: "HIGH",
      targetRoles: ["CASHIER", "ADMIN", "MANAGER"],
      actionUrl: "/billing",
      actionLabel: "Settle Bill",
      metadata: { tableNumber: tableNum, partyId: targetParty.id, amount: targetParty.runningSubtotal },
    });

    setTick((t) => t + 1);
    showToast(`Table Check printed & bill requested for ${targetParty.partyCode}!`);
  };

  const handlePrintFinalBill = (partyId: string) => {
    try {
      let bill = store.bills.find((b) => b.partyId === partyId && b.status !== "CANCELLED");
      if (!bill) {
        bill = store.generateBillForParty(partyId);
      }
      printBillReceipt(bill, false, store.printerSettings?.paperWidth || "80mm");
      setTick((t) => t + 1);
      showToast(`Printed Customer Bill #${bill.billNumber} for Table ${bill.tableNumber}!`);
    } catch (err: any) {
      alert(`Could not print bill: ${err.message}`);
    }
  };

  const handlePrintKotForParty = (partyId: string) => {
    const partyKots = store.kots.filter((k) => k.partyId === partyId);
    if (partyKots.length === 0) {
      alert("No KOT has been generated for this party yet. Tap 'Order' to select and send items first.");
      return;
    }
    const latestKot = partyKots[partyKots.length - 1];
    printKotTicket(latestKot, {
      paperWidth: store.printerSettings?.paperWidth || "80mm",
      isReprint: true,
    });
    showToast(`Reprinted Kitchen KOT #${latestKot.kotNumber} for Table ${latestKot.tableNumber}!`);
  };

  const availableCount = store.tables.filter((t) => t.status === "AVAILABLE").length;
  const occupiedCount = store.tables.filter((t) => t.status === "OCCUPIED").length;
  const sharedCount = store.tables.filter((t) => t.status === "SHARED").length;
  const billRequestedCount = store.tables.filter((t) =>
    store.parties.some((p) => p.tableId === t.id && p.status === "WAITING_FOR_BILL")
  ).length;

  const displayedTables = store.tables.filter((table) => {
    if (floorFilter === "AVAILABLE") return table.status === "AVAILABLE";
    if (floorFilter === "OCCUPIED") return table.status === "OCCUPIED";
    if (floorFilter === "SHARED") return table.status === "SHARED";
    if (floorFilter === "BILL_REQUESTED") {
      return store.parties.some((p) => p.tableId === table.id && p.status === "WAITING_FOR_BILL");
    }
    return true;
  });

  return (
    <div className="space-y-2 sm:space-y-4">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-4 right-4 z-50 bg-stone-900 text-amber-300 border border-amber-500/40 px-4 py-3 rounded-xl shadow-xl flex items-center gap-2 text-sm font-semibold animate-bounce">
          <Sparkles className="w-4 h-4 text-amber-400" />
          {toastMessage}
        </div>
      )}

      {/* Luxury Hero Header - Shown on tablet/desktop, compact on mobile to maximize table visibility */}
      <div className="hidden sm:flex luxury-card rounded-2xl p-4 border border-[#E7E2DA] items-center justify-between gap-4 bg-gradient-to-r from-white via-[#FAF8F5] to-white shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-red-600 to-red-700 text-white flex items-center justify-center shadow-sm shadow-red-600/20 border border-red-500/30 shrink-0">
            <Utensils className="w-5 h-5 text-amber-100" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-black text-stone-900 tracking-tight">
                Dining Floor & 12 Tables
              </h1>
              <span className="bg-emerald-50 text-emerald-800 text-xs font-black px-2 py-0.5 rounded-full border border-emerald-200">
                {availableCount} Available
              </span>
            </div>
            <p className="text-xs text-stone-500 font-medium mt-0.5">
              Khanawal dining hall. Independent customer parties, shared seating & KOTs.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => handleOpenAddParty(1)}
            className="flex items-center gap-1.5 bg-gradient-to-r from-red-600 via-red-700 to-red-800 hover:from-red-700 hover:to-red-900 text-white text-xs font-black px-3.5 py-2 rounded-xl shadow-2xs active:scale-95 transition-all shrink-0"
          >
            <Plus className="w-3.5 h-3.5 text-amber-200" />
            <span>+ Seat Table</span>
          </button>
        </div>
      </div>

      {/* Mobile Fast Action Strip (sm:hidden) */}
      <div className="flex sm:hidden items-center justify-between gap-1.5 bg-gradient-to-r from-stone-900 to-stone-800 text-white p-2 rounded-xl shadow-xs">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-[11px] font-black text-amber-300 truncate">12 Tables</span>
          <span className="bg-emerald-600/90 text-[9px] font-bold px-1.5 py-0.2 rounded-full text-white">
            {availableCount} Free
          </span>
        </div>
        <button
          type="button"
          onClick={() => handleOpenAddParty(1)}
          className="px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white font-black text-[10px] rounded-lg shadow-2xs active:scale-95 transition-all flex items-center gap-1"
        >
          <Plus className="w-3 h-3 text-amber-200" />
          <span>+ Seat Table</span>
        </button>
      </div>

      {/* Fast Filter Bar */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar text-xs">
        <button
          onClick={() => setFloorFilter("ALL")}
          className={`px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg sm:rounded-xl font-black whitespace-nowrap transition-all border touch-manipulation active:scale-95 text-[11px] sm:text-xs ${
            floorFilter === "ALL"
              ? "bg-stone-900 text-amber-200 border-stone-900 shadow-2xs"
              : "bg-white text-stone-600 border-[#E7E2DA] hover:bg-[#FAF8F5]"
          }`}
        >
          All (12)
        </button>
        <button
          onClick={() => setFloorFilter("AVAILABLE")}
          className={`px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg sm:rounded-xl font-black whitespace-nowrap transition-all border touch-manipulation active:scale-95 text-[11px] sm:text-xs ${
            floorFilter === "AVAILABLE"
              ? "bg-emerald-600 text-white border-emerald-600 shadow-2xs"
              : "bg-white text-emerald-800 border-[#E7E2DA] hover:bg-emerald-50/50"
          }`}
        >
          Free ({availableCount})
        </button>
        <button
          onClick={() => setFloorFilter("OCCUPIED")}
          className={`px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg sm:rounded-xl font-black whitespace-nowrap transition-all border touch-manipulation active:scale-95 text-[11px] sm:text-xs ${
            floorFilter === "OCCUPIED"
              ? "bg-red-600 text-white border-red-600 shadow-2xs"
              : "bg-white text-red-800 border-[#E7E2DA] hover:bg-red-50/50"
          }`}
        >
          Occupied ({occupiedCount + sharedCount})
        </button>
        {billRequestedCount > 0 && (
          <button
            onClick={() => setFloorFilter("BILL_REQUESTED")}
            className={`px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg sm:rounded-xl font-black whitespace-nowrap transition-all border animate-pulse touch-manipulation active:scale-95 text-[11px] sm:text-xs ${
              floorFilter === "BILL_REQUESTED"
                ? "bg-amber-600 text-white border-amber-600 shadow-2xs"
                : "bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100"
            }`}
          >
            Bill ({billRequestedCount}) 🔥
          </button>
        )}
      </div>

      {/* 12 Physical Tables Grid: Exactly 3 Tables per Line on Mobile, Responsive & Touch-Friendly */}
      <div className="grid grid-cols-3 gap-1.5 sm:gap-2.5 md:gap-3 max-w-2xl sm:max-w-4xl mx-auto w-full">
        {displayedTables.map((table) => {
          const tableParties = store.parties.filter(
            (p) => p.tableId === table.id && p.status !== "CLOSED" && p.status !== "CANCELLED"
          );
          const isOccupied = tableParties.length > 0;
          const isShared = tableParties.length > 1;
          const hasBillRequested = tableParties.some((p) => p.status === "WAITING_FOR_BILL");
          const primaryParty = tableParties[0];
          const totalSubtotal = tableParties.reduce((sum, p) => sum + p.runningSubtotal, 0);
          const totalGuests = tableParties.reduce((sum, p) => sum + p.guestCount, 0);

          // Count ordered items for this table
          const tableOrderedItems = tableParties.flatMap((p) =>
            store.orders
              .filter((o) => o.partyId === p.id && o.status !== "CANCELLED")
              .flatMap((o) => o.items)
          );
          const totalItemsCount = tableOrderedItems.reduce((sum, it) => sum + it.quantity, 0);

          return (
            <div
              key={table.id}
              className={`min-h-[140px] sm:min-h-[165px] w-full luxury-card rounded-xl sm:rounded-2xl border transition-all flex flex-col justify-between p-1.5 sm:p-2.5 md:p-3 relative overflow-hidden shadow-2xs hover:shadow-md touch-manipulation select-none ${
                hasBillRequested
                  ? "border-amber-400 bg-amber-50/40 ring-2 ring-amber-300"
                  : isShared
                  ? "border-amber-400/80 bg-amber-50/20 ring-2 ring-amber-300/30"
                  : isOccupied
                  ? "border-red-300/90 bg-red-50/20 ring-2 ring-red-200/40"
                  : "border-[#E7E2DA] bg-white hover:border-emerald-300 hover:shadow-xs"
              }`}
            >
              {/* Top Row: Table Badge & Status */}
              <div className="flex items-center justify-between gap-1 shrink-0">
                <div className="flex items-center gap-1 min-w-0">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (isOccupied) setActiveTableForDetail(table);
                      else handleOpenAddParty(table.tableNumber);
                    }}
                    title={isOccupied ? "Manage Table / Move / Merge / Split" : "Seat Table"}
                    className="w-6 h-6 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl bg-stone-900 hover:bg-stone-800 text-amber-300 font-black text-[11px] sm:text-xs md:text-sm flex items-center justify-center shadow-2xs shrink-0 cursor-pointer active:scale-95 transition-all touch-manipulation"
                  >
                    T{table.tableNumber}
                  </button>
                  <span className="font-bold text-[9px] sm:text-[11px] text-stone-600 hidden md:inline truncate">
                    {table.name}
                  </span>
                </div>

                {/* Status Pill */}
                {hasBillRequested ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveTableForDetail(table);
                    }}
                    className="text-[8px] sm:text-[9px] font-black px-1.5 sm:px-2 py-0.5 rounded-full bg-amber-500 text-stone-950 uppercase tracking-tight shadow-2xs animate-pulse cursor-pointer touch-manipulation"
                  >
                    Bill 🔥
                  </button>
                ) : isShared ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveTableForDetail(table);
                    }}
                    className="text-[8px] sm:text-[9px] font-black px-1.5 sm:px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 cursor-pointer touch-manipulation"
                  >
                    {tableParties.length}P•{totalGuests}G
                  </button>
                ) : isOccupied ? (
                  <span className="text-[8px] sm:text-[9px] font-black px-1.5 sm:px-2 py-0.5 rounded-full bg-red-100 text-red-800 border border-red-200">
                    {totalGuests} G
                  </span>
                ) : (
                  <span className="text-[8px] sm:text-[9px] font-bold px-1.5 sm:px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Free
                  </span>
                )}
              </div>

              {/* Center Zone: Tap Area */}
              {isOccupied ? (
                <div
                  onClick={() => isShared ? setActiveTableForDetail(table) : router.push(`/waiter/order/${primaryParty.id}`)}
                  className="flex-1 min-h-0 flex flex-col items-center justify-center text-center cursor-pointer py-1 px-0.5 touch-manipulation"
                >
                  <span className="text-[9px] sm:text-[11px] font-bold text-stone-600 truncate max-w-full leading-tight">
                    {isShared
                      ? `${tableParties.length} Shared Parties`
                      : primaryParty.customerName || primaryParty.partyCode}
                  </span>
                  <span className="text-xs sm:text-base md:text-lg font-black text-stone-900 font-mono leading-tight mt-0.5">
                    ₹{totalSubtotal}
                  </span>
                  <div className="flex items-center gap-1 mt-0.5">
                    {totalItemsCount > 0 && (
                      <span className="text-[7px] sm:text-[8px] font-black px-1 py-0.2 rounded bg-red-100 text-red-700 border border-red-200">
                        {totalItemsCount} items
                      </span>
                    )}
                    <span className="text-[8px] sm:text-[9px] text-stone-400 font-medium truncate leading-tight">
                      {primaryParty.assignedWaiterName.split(" ")[0]}
                    </span>
                  </div>
                </div>
              ) : (
                <div
                  onClick={() => handleOpenAddParty(table.tableNumber)}
                  className="flex-1 min-h-0 flex flex-col items-center justify-center text-center cursor-pointer group py-1 touch-manipulation"
                >
                  <Plus className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-500 group-hover:text-emerald-600 transition-colors" />
                  <span className="text-[9px] sm:text-[10px] text-emerald-600 font-bold leading-tight mt-0.5">Tap to seat</span>
                </div>
              )}

              {/* Bottom Row: 1-Tap Touch-Friendly Actions */}
              {isOccupied ? (
                isShared ? (
                  <div className="pt-1.5 border-t border-stone-100 shrink-0 flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setActiveTableForDetail(table)}
                      className="flex-1 min-w-0 py-1.5 sm:py-2 px-1 bg-amber-500 hover:bg-amber-600 text-stone-950 font-black text-[10px] sm:text-xs rounded-lg sm:rounded-xl shadow-2xs active:scale-95 transition-all text-center truncate touch-manipulation"
                    >
                      {tableParties.length}P View →
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveTableForDetail(table);
                      }}
                      title="Manage Table / Shared Parties"
                      className="w-7 h-7 sm:w-8 sm:h-8 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg sm:rounded-xl active:scale-90 transition-all shrink-0 flex items-center justify-center font-black text-xs shadow-2xs border border-stone-200 touch-manipulation"
                    >
                      <MoreVertical className="w-3.5 h-3.5 text-stone-700" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1 pt-1.5 border-t border-stone-100 shrink-0">
                    <Link
                      href={`/waiter/order/${primaryParty.id}`}
                      className="flex-1 min-w-0 py-1.5 sm:py-2 px-1 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white font-black text-[10px] sm:text-xs rounded-lg sm:rounded-xl shadow-2xs active:scale-95 transition-all flex items-center justify-center gap-0.5 text-center truncate touch-manipulation"
                    >
                      <Plus className="w-3 h-3 text-amber-200 shrink-0" />
                      <span className="truncate">Order</span>
                    </Link>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveTableForDetail(table);
                      }}
                      title="Table Actions: KOT, Bill, Move, Merge, Split"
                      className="w-7 h-7 sm:w-8 sm:h-8 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg sm:rounded-xl active:scale-90 transition-all shrink-0 flex items-center justify-center font-black text-xs shadow-2xs border border-stone-200 touch-manipulation"
                    >
                      <MoreVertical className="w-3.5 h-3.5 text-stone-700" />
                    </button>
                  </div>
                )
              ) : (
                <div className="pt-1.5 border-t border-stone-100 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleQuickSeatAndOrder(table.tableNumber, 2)}
                    className="w-full py-1.5 sm:py-2 px-1 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white font-black text-[10px] sm:text-xs rounded-lg sm:rounded-xl shadow-2xs active:scale-95 transition-all flex items-center justify-center gap-1 text-center truncate touch-manipulation"
                    title="1-Tap Quick Seat (2 Guests) & Take Order"
                  >
                    <Plus className="w-3 h-3 shrink-0" />
                    <span>Seat</span>
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* MODAL: TABLE DETAIL & MULTI-PARTY MANAGEMENT */}
      {activeTableForDetail && (
        <div className="fixed inset-0 z-50 bg-stone-900/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-stone-200 overflow-hidden text-xs max-h-[90vh] flex flex-col">
            <div className="bg-gradient-to-r from-stone-900 to-stone-800 text-white p-4 flex items-center justify-between">
              <div className="flex items-center gap-2 font-black text-sm sm:text-base">
                <span className="w-8 h-8 rounded-xl bg-amber-400 text-stone-950 flex items-center justify-center text-sm font-black">
                  T{activeTableForDetail.tableNumber}
                </span>
                <div>
                  <h2 className="leading-tight">{activeTableForDetail.name}</h2>
                  <span className="text-[10px] text-amber-200 font-normal">
                    Capacity: {activeTableForDetail.maxCapacity} Seats • Unified Dining Room
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveTableForDetail(null)}
                className="text-stone-300 hover:text-white p-1 rounded-lg text-sm"
              >
                ✕
              </button>
            </div>

            <div className="p-4 overflow-y-auto space-y-3 flex-1">
              {(() => {
                const parties = store.parties.filter(
                  (p) => p.tableId === activeTableForDetail.id && p.status !== "CLOSED" && p.status !== "CANCELLED"
                );

                if (parties.length === 0) {
                  return (
                    <div className="text-center py-6 space-y-2">
                      <p className="text-stone-500 font-medium">No active parties on this table.</p>
                      <button
                        onClick={() => {
                          const tblNum = activeTableForDetail.tableNumber;
                          setActiveTableForDetail(null);
                          handleOpenAddParty(tblNum);
                        }}
                        className="px-4 py-2 bg-red-600 text-white font-black rounded-xl"
                      >
                        + Seat New Party
                      </button>
                    </div>
                  );
                }

                return parties.map((party) => (
                  <div
                    key={party.id}
                    className="p-3 rounded-xl border border-[#E7E2DA] bg-[#FAF8F5] space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="bg-stone-900 text-amber-200 font-black px-2 py-0.5 rounded text-xs">
                          {party.partyCode}
                        </span>
                        <span className="font-bold text-stone-800">
                          {party.guestCount} Guests • Waiter: {party.assignedWaiterName}
                        </span>
                      </div>
                      <span className="font-mono font-black text-stone-900 text-sm">
                        ₹{party.runningSubtotal}
                      </span>
                    </div>

                    {party.customerName && (
                      <p className="text-[11px] text-stone-600">
                        👤 Customer: <strong>{party.customerName}</strong> {party.customerPhone ? `(${party.customerPhone})` : ""}
                      </p>
                    )}

                    {/* Ordered Items Summary */}
                    {(() => {
                      const partyOrders = store.orders.filter(
                        (o) => o.partyId === party.id && o.status !== "CANCELLED"
                      );
                      const orderedItems = partyOrders.flatMap((o) => o.items);
                      if (orderedItems.length === 0) return null;
                      return (
                        <div className="bg-white rounded-lg border border-stone-200 p-2 space-y-1">
                          <span className="text-[10px] font-black text-stone-500 uppercase tracking-wider">Ordered Items</span>
                          <div className="divide-y divide-stone-100">
                            {orderedItems.map((item, idx) => (
                              <div key={idx} className="flex items-center justify-between py-1 text-[11px]">
                                <span className="font-bold text-stone-800 truncate">
                                  {item.quantity}× {item.menuItemName}
                                </span>
                                <span className="font-mono font-black text-stone-700 shrink-0 ml-2">
                                  ₹{item.totalPrice}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })()}

                    {/* Actions — Simple 2-row layout */}
                    <div className="grid grid-cols-2 gap-1.5 pt-1">
                      <Link
                        href={`/waiter/order/${party.id}`}
                        onClick={() => setActiveTableForDetail(null)}
                        className="py-2.5 bg-red-600 hover:bg-red-700 text-white font-black rounded-xl text-center flex items-center justify-center gap-1 shadow-xs"
                      >
                        <Utensils className="w-3.5 h-3.5 text-amber-200" />
                        <span>+ Order</span>
                      </Link>
                      <button
                        type="button"
                        onClick={() => handleRequestBill(party.id)}
                        className="py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl flex items-center justify-center gap-1 shadow-xs"
                      >
                        <Receipt className="w-3.5 h-3.5" />
                        <span>Bill</span>
                      </button>
                    </div>
                    <div className="grid grid-cols-3 gap-1.5 text-xs">
                      <button
                        type="button"
                        onClick={() => handlePrintKotForParty(party.id)}
                        className="py-2 bg-stone-100 hover:bg-stone-200 text-stone-800 font-bold rounded-xl flex items-center justify-center gap-1 touch-manipulation active:scale-95 transition-all"
                      >
                        <ChefHat className="w-3.5 h-3.5 text-red-600" />
                        <span>KOT</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setTransferPartyId(party.id);
                          setTargetTableNumber(activeTableForDetail.tableNumber === 12 ? 1 : activeTableForDetail.tableNumber + 1);
                          setActiveTableForDetail(null);
                          setActiveModal("TRANSFER");
                        }}
                        className="py-2 bg-stone-100 hover:bg-stone-200 text-stone-800 font-bold rounded-xl flex items-center justify-center gap-1 touch-manipulation active:scale-95 transition-all"
                      >
                        <ArrowRightLeft className="w-3.5 h-3.5 text-blue-600" />
                        <span>Move</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handlePrintFinalBill(party.id)}
                        className="py-2 bg-stone-100 hover:bg-stone-200 text-stone-800 font-bold rounded-xl flex items-center justify-center gap-1 touch-manipulation active:scale-95 transition-all"
                      >
                        <Printer className="w-3.5 h-3.5 text-stone-700" />
                        <span>Print</span>
                      </button>
                    </div>

                    {party.runningSubtotal === 0 && (
                      <div className="pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            if (confirm(`Cancel party ${party.partyCode} and free table seats?`)) {
                              try {
                                store.voidOrCancelParty(party.id, "Waiter cancelled empty party");
                                setTick((t) => t + 1);
                                setActiveTableForDetail(null);
                                showToast(`Party ${party.partyCode} cancelled and table vacated.`);
                              } catch (err: any) {
                                alert(err.message);
                              }
                            }
                          }}
                          className="w-full py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold rounded-lg flex items-center justify-center gap-1 border border-rose-200 text-[10px] active:scale-95 transition-all"
                        >
                          <X className="w-3 h-3" />
                          <span>Cancel / Vacate Empty Party</span>
                        </button>
                      </div>
                    )}
                  </div>
                ));
              })()}

              {/* Add Shared Party button in modal if capacity permits */}
              <div className="pt-2 border-t border-stone-200 flex items-center justify-between">
                <span className="text-[11px] text-stone-500 font-medium">
                  {activeTableForDetail.totalActiveGuests} of {activeTableForDetail.maxCapacity} seats occupied
                </span>
                <button
                  type="button"
                  onClick={() => {
                    const tblNum = activeTableForDetail.tableNumber;
                    setActiveTableForDetail(null);
                    handleOpenAddParty(tblNum);
                  }}
                  className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 font-black rounded-lg border border-red-200 text-xs flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Add Shared Party</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ULTRA SIMPLE HOW MANY GUESTS MODAL */}
      {activeModal === "ADD_PARTY" && (
        <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-3xl shadow-2xl border border-stone-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150 p-5 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-stone-100">
              <div className="flex items-center gap-2">
                <span className="bg-red-600 text-white font-black text-xs px-2.5 py-1 rounded-lg">
                  Table {selectedTableNumber}
                </span>
                <h3 className="font-black text-stone-900 text-base">
                  How many guests? (किती माणसे?)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="text-stone-400 hover:text-stone-700 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Fast 1-Tap Guest Selection Chips */}
            <div className="grid grid-cols-4 gap-2">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((num) => (
                <button
                  type="button"
                  key={num}
                  onClick={() => handleQuickSeatAndOrder(selectedTableNumber, num)}
                  className={`h-14 rounded-2xl font-black text-lg transition-all touch-manipulation flex flex-col items-center justify-center shadow-xs active:scale-95 ${
                    guestCount === num
                      ? "bg-gradient-to-br from-red-600 to-red-700 text-white ring-2 ring-red-400"
                      : "bg-stone-50 hover:bg-stone-100 border border-stone-200 text-stone-900"
                  }`}
                >
                  <span>{num}</span>
                  <span className="text-[9px] font-medium opacity-75">
                    {num === 1 ? "Guest" : "Guests"}
                  </span>
                </button>
              ))}
            </div>

            {/* Stepper for custom count */}
            <div className="flex items-center justify-between bg-stone-50 p-2.5 rounded-2xl border border-stone-200">
              <span className="text-xs font-bold text-stone-600">Other count:</span>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setGuestCount(Math.max(1, guestCount - 1))}
                  className="w-8 h-8 rounded-xl bg-white border border-stone-300 font-black text-base flex items-center justify-center active:scale-90"
                >
                  -
                </button>
                <span className="font-mono text-base font-black min-w-6 text-center">
                  {guestCount}
                </span>
                <button
                  type="button"
                  onClick={() => setGuestCount(guestCount + 1)}
                  className="w-8 h-8 rounded-xl bg-white border border-stone-300 font-black text-base flex items-center justify-center active:scale-90"
                >
                  +
                </button>
              </div>
            </div>

            {/* Start Order Button */}
            <button
              type="button"
              onClick={() => handleQuickSeatAndOrder(selectedTableNumber, guestCount)}
              className="w-full py-3.5 bg-gradient-to-r from-red-600 via-red-700 to-red-800 hover:from-red-700 hover:to-red-900 text-white rounded-2xl font-black text-sm shadow-md shadow-red-700/25 active:scale-95 transition-all flex items-center justify-center gap-2 touch-manipulation"
            >
              <span>Start Order ({guestCount} Guests) →</span>
            </button>
          </div>
        </div>
      )}

      {/* Waiter Printer Settings Modal */}
      <WaiterPrinterSettingsModal
        isOpen={showPrinterModal}
        onClose={() => setShowPrinterModal(false)}
      />

      {/* MODAL: TRANSFER PARTY IN LIGHT THEME */}
      {activeModal === "TRANSFER" && (
        <div className="fixed inset-0 z-50 bg-stone-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-stone-200 overflow-hidden max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-stone-50 border-b border-stone-200 text-stone-900 p-4 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2 font-bold text-base">
                <ArrowRightLeft className="w-5 h-5 text-blue-600" />
                <span>Transfer Dining Party</span>
              </div>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="text-stone-400 hover:text-stone-700 p-1 rounded-lg touch-manipulation"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleTransferSubmit} className="p-5 space-y-4 flex-1 overflow-y-auto">
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  Destination Table
                </label>
                <select
                  value={targetTableNumber}
                  onChange={(e) => setTargetTableNumber(Number(e.target.value))}
                  className="w-full bg-stone-50 border border-stone-300 rounded-xl px-3 py-2.5 text-sm font-semibold text-stone-900 focus:outline-none focus:ring-2 focus:ring-red-500"
                >
                  {store.tables.map((t) => (
                    <option key={t.id} value={t.tableNumber}>
                      {t.name} ({t.status}) — {t.activePartiesCount} active parties
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-stone-500 font-medium mt-1">
                  Only this specific party moves; other parties at the origin table will remain untouched.
                </p>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="px-4 py-2.5 text-xs font-bold text-stone-600 hover:bg-stone-100 rounded-xl touch-manipulation"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-xs active:scale-95 touch-manipulation"
                >
                  Confirm Transfer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: MERGE PARTIES IN LIGHT THEME */}
      {activeModal === "MERGE" && (
        <div className="fixed inset-0 z-50 bg-stone-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-stone-200 overflow-hidden max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-stone-50 border-b border-stone-200 text-stone-900 p-4 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2 font-bold text-base">
                <Merge className="w-5 h-5 text-purple-600" />
                <span>Merge Dining Parties</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setActiveModal(null);
                  setSelectedPartyIdsForMerge([]);
                }}
                className="text-stone-400 hover:text-stone-700 p-1 rounded-lg touch-manipulation"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleMergeSubmit} className="p-5 space-y-4 flex-1 overflow-y-auto">
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-2">
                  Select 2 or more active parties to merge into one
                </label>
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {store.parties
                    .filter((p) => p.status !== "CLOSED" && p.status !== "CANCELLED")
                    .map((p) => {
                      const isChecked = selectedPartyIdsForMerge.includes(p.id);
                      return (
                        <label
                          key={p.id}
                          className={`flex items-center justify-between p-2.5 rounded-xl border cursor-pointer transition-all touch-manipulation ${
                            isChecked
                              ? "bg-purple-50 border-purple-400 ring-1 ring-purple-300/40"
                              : "bg-stone-50 border-stone-200 hover:bg-stone-100"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {
                                setSelectedPartyIdsForMerge((prev) =>
                                  isChecked
                                    ? prev.filter((id) => id !== p.id)
                                    : [...prev, p.id]
                                );
                              }}
                              className="accent-purple-600 w-4 h-4"
                            />
                            <span className="font-black text-xs bg-stone-900 text-white px-2 py-0.5 rounded">
                              {p.partyCode}
                            </span>
                            <span className="text-xs font-bold text-stone-800">
                              Table {p.tableNumber} • {p.guestCount} Guests
                            </span>
                          </div>
                          <span className="text-xs font-bold text-stone-700">₹{p.runningSubtotal}</span>
                        </label>
                      );
                    })}
                </div>
                {selectedPartyIdsForMerge.length < 2 && (
                  <p className="text-[11px] text-amber-700 font-semibold mt-2">
                    Select at least 2 parties to merge.
                  </p>
                )}
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setActiveModal(null);
                    setSelectedPartyIdsForMerge([]);
                  }}
                  className="px-4 py-2.5 text-xs font-bold text-stone-600 hover:bg-stone-100 rounded-xl touch-manipulation"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={selectedPartyIdsForMerge.length < 2}
                  className="px-5 py-2.5 text-xs font-bold bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-xl shadow-xs active:scale-95 touch-manipulation"
                >
                  Merge {selectedPartyIdsForMerge.length} Parties
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: SPLIT PARTY & ORDER ITEMS */}
      {activeModal === "SPLIT" && (
        <div className="fixed inset-0 z-50 bg-stone-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-stone-200 overflow-hidden max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-stone-50 border-b border-stone-200 text-stone-900 p-4 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2 font-bold text-base">
                <Scissors className="w-5 h-5 text-rose-600" />
                <span>Split Party & Order Items</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setActiveModal(null);
                  setSelectedOrderItemIdsForSplit([]);
                }}
                className="text-stone-400 hover:text-stone-700 p-1 rounded-lg touch-manipulation"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSplitSubmit} className="p-5 space-y-4 text-xs flex-1 overflow-y-auto">
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  Destination Table for New Split Party
                </label>
                <select
                  value={splitTargetTableNumber}
                  onChange={(e) => setSplitTargetTableNumber(Number(e.target.value))}
                  className="w-full bg-stone-50 border border-stone-300 rounded-xl px-3 py-2.5 text-xs font-semibold text-stone-900 focus:outline-none focus:ring-2 focus:ring-red-500"
                >
                  {store.tables.map((t) => {
                    const isSameTable = store.parties.find((p) => p.id === splitSourcePartyId)?.tableNumber === t.tableNumber;
                    return (
                      <option key={t.id} value={t.tableNumber}>
                        {t.name} {isSameTable ? "(Same Physical Table — Shared Split Party)" : `(${t.status})`}
                      </option>
                    );
                  })}
                </select>
                <p className="text-[11px] text-stone-500 mt-1">
                  You can split items to the same table (e.g. 2 guests paying separately) or move them to another table.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-2">
                  Select Order Items to Move into New Split Party
                </label>
                {(() => {
                  const sourceOrders = store.orders.filter((o) => o.partyId === splitSourcePartyId);
                  const allItems = sourceOrders.flatMap((o) => o.items);

                  if (allItems.length === 0) {
                    return (
                      <div className="p-4 bg-stone-50 rounded-xl text-center text-stone-400 font-medium">
                        No food items ordered yet for this party to split.
                      </div>
                    );
                  }

                  return (
                    <div className="space-y-1.5 max-h-48 overflow-y-auto">
                      {allItems.map((it) => {
                        const isChecked = selectedOrderItemIdsForSplit.includes(it.id);
                        return (
                          <label
                            key={it.id}
                            className={`flex items-center justify-between p-2.5 rounded-xl border cursor-pointer transition-all touch-manipulation ${
                              isChecked
                                ? "bg-rose-50 border-rose-400 ring-1 ring-rose-300/40"
                                : "bg-stone-50 border-stone-200 hover:bg-stone-100"
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => {
                                  setSelectedOrderItemIdsForSplit((prev) =>
                                    isChecked ? prev.filter((id) => id !== it.id) : [...prev, it.id]
                                  );
                                }}
                                className="accent-rose-600 w-4 h-4"
                              />
                              <span className="font-black text-stone-900">
                                {it.quantity}× {it.menuItemName}
                              </span>
                              {it.seatNumber && (
                                <span className="text-[10px] bg-stone-200 text-stone-700 font-bold px-1.5 py-0.5 rounded">
                                  Seat {it.seatNumber}
                                </span>
                              )}
                            </div>
                            <span className="font-black text-stone-900">₹{it.totalPrice}</span>
                          </label>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-stone-100 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setActiveModal(null);
                    setSelectedOrderItemIdsForSplit([]);
                  }}
                  className="px-4 py-2.5 text-xs font-bold text-stone-600 hover:bg-stone-100 rounded-xl touch-manipulation"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={selectedOrderItemIdsForSplit.length === 0}
                  className={`px-5 py-2.5 text-xs font-bold rounded-xl shadow-xs active:scale-95 touch-manipulation ${
                    selectedOrderItemIdsForSplit.length === 0
                      ? "bg-stone-300 text-stone-500 cursor-not-allowed"
                      : "bg-rose-600 hover:bg-rose-700 text-white"
                  }`}
                >
                  Confirm Split ({selectedOrderItemIdsForSplit.length} Items)
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
