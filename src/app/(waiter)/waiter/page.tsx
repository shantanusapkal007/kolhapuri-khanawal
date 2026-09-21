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
  CheckCircle2,
  Banknote,
  CreditCard,
  Check,
  Truck,
} from "lucide-react";
import { globalRestaurantStore } from "@/lib/store/restaurant-store";
import { DiningTable, DiningParty } from "@/types/tables";
import { printTableCheck, printBillReceipt, printKotTicket } from "@/lib/printing/thermal-printer";
import { WaiterPrinterSettingsModal } from "@/components/waiter/WaiterPrinterSettingsModal";
import { useAndroidBackButton } from "@/lib/mobile/useAndroidBackButton";
import { triggerHaptic } from "@/lib/mobile/haptics";
import { getAllDraftCartCounts } from "@/lib/orders/draft-cart";

export default function WaiterFloorPage() {
  const router = useRouter();
  const store = globalRestaurantStore;
  const [, setTick] = useState(0);
  const [draftCartCounts, setDraftCartCounts] = useState<Record<string, number>>({});

  const [activeModal, setActiveModal] = useState<"ADD_PARTY" | "TRANSFER" | "MERGE" | "SPLIT" | null>(null);
  const [showPrinterModal, setShowPrinterModal] = useState<boolean>(false);
  const [activeTableForDetail, setActiveTableForDetail] = useState<DiningTable | null>(null);
  const [selectedTableNumber, setSelectedTableNumber] = useState<number>(1);
  const [guestCount, setGuestCount] = useState<number>(2);
  const [descriptor, setDescriptor] = useState<string>("");
  const [isTakeaway, setIsTakeaway] = useState<boolean>(false);
  const [customerName, setCustomerName] = useState<string>("");
  const [customerPhone, setCustomerPhone] = useState<string>("");

  const [floorFilter, setFloorFilter] = useState<
    "ALL" | "SECTION_A" | "SECTION_B" | "SECTION_C" | "AVAILABLE" | "OCCUPIED" | "SHARED" | "BILL_REQUESTED" | "PARCELS" | "DELIVERY"
  >("ALL");

  // Sync with URL search params (e.g. redirected from parcel order)
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("tab") === "parcels") {
        setFloorFilter("PARCELS");
      }
    }
  }, []);

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

  // Quick Settle / Bill Paid State
  const [settlePartyTarget, setSettlePartyTarget] = useState<DiningParty | null>(null);
  const [settleMethod, setSettleMethod] = useState<"CASH" | "UPI">("CASH");
  const [autoPrintOnSettle, setAutoPrintOnSettle] = useState<boolean>(true);

  // Android Back Button Trap: Close active modals or sheets before leaving floor
  const isAnyModalOpen = Boolean(activeModal) || showPrinterModal || Boolean(activeTableForDetail) || Boolean(settlePartyTarget);
  useAndroidBackButton(isAnyModalOpen, () => {
    if (settlePartyTarget) {
      setSettlePartyTarget(null);
    } else if (activeModal) {
      setActiveModal(null);
    } else if (showPrinterModal) {
      setShowPrinterModal(false);
    } else if (activeTableForDetail) {
      setActiveTableForDetail(null);
    }
  });

  useEffect(() => {
    const updateDrafts = () => {
      setDraftCartCounts(getAllDraftCartCounts());
    };
    updateDrafts();

    const interval = setInterval(() => {
      setTick((t) => t + 1);
      updateDrafts();
    }, 1000);

    const handleSync = () => {
      setTick((t) => t + 1);
      updateDrafts();
    };
    window.addEventListener("kk-state-changed", handleSync);
    window.addEventListener("kk-draft-carts-changed", updateDrafts);

    return () => {
      clearInterval(interval);
      window.removeEventListener("kk-state-changed", handleSync);
      window.removeEventListener("kk-draft-carts-changed", updateDrafts);
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
      showToast(`Party ${party.partyCode} opened at Table ${store.getTableName(tableNum)}! Opening order screen...`);
      router.push(`/waiter/order/${party.id}`);
    } catch (err: any) {
      showToast(err.message || "Failed to open table");
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
      showToast(err?.message || "Failed to create party");
    }
  };

  const handleTransferSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      triggerHaptic("success");
      const updated = store.transferPartyToTable(transferPartyId, targetTableNumber);
      setTick((t) => t + 1);
      setActiveModal(null);
      showToast(`Party ${updated.partyCode} successfully moved to Table ${store.getTableName(targetTableNumber)}!`);
    } catch (err: any) {
      showToast(err?.message || "Failed to transfer party");
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
      showToast(err?.message || "Failed to merge parties");
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
      showToast(`Created new split party ${newParty.partyCode} at Table ${store.getTableName(splitTargetTableNumber)}!`);
    } catch (err: any) {
      showToast(err?.message || "Failed to split party");
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
    const isTakeaway = Boolean(targetParty.isTakeaway || targetParty.tableNumber === 0);
    const packagingFee = isTakeaway ? (targetParty.packagingCharges ?? 20) : 0;
    const subtotal = partyItems.reduce((s, i) => s + i.totalPrice, 0);
    const taxEstimate = 0;
    const grandTotal = Math.round(subtotal + (isTakeaway && subtotal > 0 ? packagingFee : 0));

    if (partyItems.length > 0) {
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
      title: isTakeaway ? `Parcel ${targetParty.partyCode} Requested Bill 🔥` : `Table ${store.getTableName(tableNum)} Requested Bill 🔥`,
      message: `${targetParty.partyCode} (${targetParty.customerName || "Walk-in"}) is ready for billing. Total: ₹${grandTotal}.`,
      category: "BILLING",
      urgency: "HIGH",
      targetRoles: ["CASHIER", "ADMIN", "MANAGER"],
      actionUrl: "/billing",
      actionLabel: "Settle Bill",
      metadata: { tableNumber: tableNum, partyId: targetParty.id, amount: grandTotal },
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
      showToast(`Printed Customer Bill #${bill.billNumber} for Table ${store.getTableName(bill.tableNumber)}!`);
    } catch (err: any) {
      showToast(`❌ Could not print bill: ${err?.message || "Failed"}`);
    }
  };

  const handlePrintKotForParty = (partyId: string) => {
    const partyKots = store.kots.filter((k) => k.partyId === partyId);
    if (partyKots.length === 0) {
      showToast("⚠️ No KOT has been generated yet. Tap 'Order' to send items first.");
      return;
    }
    const latestKot = partyKots[partyKots.length - 1];
    printKotTicket(latestKot, {
      paperWidth: store.printerSettings?.paperWidth || "80mm",
      isReprint: true,
    });
    showToast(`Reprinted Kitchen KOT #${latestKot.kotNumber} for Table ${store.getTableName(latestKot.tableNumber)}!`);
  };

  const handleQuickSettleParty = (partyId: string, paymentMethod: "CASH" | "UPI" = "CASH") => {
    try {
      triggerHaptic("success");
      const result = store.quickSettleBill(partyId, paymentMethod);
      if (autoPrintOnSettle) {
        printBillReceipt(result.bill, false, store.printerSettings?.paperWidth || "80mm");
      }
      setSettlePartyTarget(null);
      setActiveTableForDetail(null);
      setTick((t) => t + 1);
      showToast(`✅ ${result.message}`);
    } catch (err: any) {
      triggerHaptic("error");
      showToast(`❌ ${err?.message || "Quick settle failed"}`);
    }
  };

  const availableCount = store.tables.filter((t) => t.status === "AVAILABLE").length;
  const occupiedCount = store.tables.filter((t) => t.status === "OCCUPIED").length;
  const sharedCount = store.tables.filter((t) => t.status === "SHARED").length;
  const billRequestedCount = store.tables.filter((t) =>
    store.parties.some((p) => p.tableId === t.id && p.status === "WAITING_FOR_BILL")
  ).length;

  const activeParcels = store.parties.filter(
    (p) => (p.isTakeaway || p.tableNumber === 0) && p.status !== "CLOSED" && p.status !== "CANCELLED"
  );

  const handleTakeParcel = (name?: string) => {
    try {
      triggerHaptic("success");
      const party = store.createTakeawayParty(name ? name.trim() : undefined);
      setTick((t) => t + 1);
      showToast(`🛍️ Parcel ${party.partyCode} opened!`);
      router.push(`/waiter/order/${party.id}?isTakeaway=true`);
    } catch (err: any) {
      showToast(err.message || "Failed to create parcel");
    }
  };

  const handleTakeDelivery = (name?: string) => {
    try {
      triggerHaptic("success");
      const party = store.createPartyAtTable(0, 1, "डिलिव्हरी (Delivery)", true, name ? name.trim() : "Delivery Customer", "", 20);
      setTick((t) => t + 1);
      showToast(`🛵 Delivery ${party.partyCode} opened!`);
      router.push(`/waiter/order/${party.id}?isDelivery=true`);
    } catch (err: any) {
      showToast(err.message || "Failed to create delivery");
    }
  };

  const totalFloorSales = store.parties
    .filter((p) => p.status !== "CLOSED" && p.status !== "CANCELLED")
    .reduce((sum, p) => sum + (p.runningSubtotal || 0), 0);
  const totalActiveGuests = store.parties
    .filter((p) => p.status !== "CLOSED" && p.status !== "CANCELLED")
    .reduce((sum, p) => sum + (p.guestCount || 0), 0);

  const displayedTables = store.tables.filter((table) => {
    if (floorFilter === "PARCELS" || floorFilter === "DELIVERY") return false;
    if (floorFilter === "SECTION_A") return table.section === "SECTION_A" || table.name.startsWith("A");
    if (floorFilter === "SECTION_B") return table.section === "SECTION_B" || table.name.startsWith("B");
    if (floorFilter === "SECTION_C") return table.section === "SECTION_C" || table.name.startsWith("C");
    if (floorFilter === "AVAILABLE") return table.status === "AVAILABLE";
    if (floorFilter === "OCCUPIED") return table.status === "OCCUPIED";
    if (floorFilter === "SHARED") return table.status === "SHARED";
    if (floorFilter === "BILL_REQUESTED") {
      return store.parties.some((p) => p.tableId === table.id && p.status === "WAITING_FOR_BILL");
    }
    return true;
  });

  return (
    <div className="space-y-3 sm:space-y-4 pb-8">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 bg-stone-950/95 text-amber-300 border border-amber-400/50 px-5 py-3.5 rounded-2xl shadow-2xl flex items-center gap-2.5 text-xs sm:text-sm font-bold animate-in fade-in slide-in-from-bottom-3 duration-200 backdrop-blur-xl ring-1 ring-black/20">
          <Sparkles className="w-4 h-4 text-amber-400 shrink-0 animate-pulse" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Luxury Floor Command Center — Tablet & Desktop */}
      <div className="hidden sm:flex luxury-card rounded-3xl p-4 sm:p-5 border border-stone-200/90 items-center justify-between gap-4 bg-gradient-to-r from-stone-950 via-stone-900 to-stone-950 text-white shadow-xl relative overflow-hidden">
        {/* Subtle decorative gold sheen */}
        <div className="absolute top-0 right-0 w-80 h-full bg-radial from-amber-500/10 via-transparent to-transparent pointer-events-none" />

        <div className="flex items-center gap-4 relative z-10">
          <div className="w-13 h-13 rounded-2xl bg-gradient-to-br from-red-600 via-red-700 to-red-900 text-white flex items-center justify-center shadow-lg shadow-red-900/40 border border-red-400/30 shrink-0 ring-2 ring-amber-500/30">
            <Utensils className="w-6 h-6 text-amber-200" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl font-black tracking-tight text-white font-sans">
                Dining Floor & {store.tables.length} Tables
              </h1>
              <span className="bg-gradient-to-r from-amber-400 to-amber-500 text-stone-950 text-[11px] font-black px-2.5 py-0.5 rounded-full shadow-xs border border-amber-300">
                {store.tables.length} टेबल (A1–C4)
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs font-semibold mt-1.5 flex-wrap">
              <span className="flex items-center gap-1.5 text-emerald-300 font-bold bg-emerald-950/80 px-2.5 py-1 rounded-xl border border-emerald-500/30 shadow-2xs">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                {availableCount} Free
              </span>
              <span className="flex items-center gap-1.5 text-rose-300 font-bold bg-rose-950/80 px-2.5 py-1 rounded-xl border border-rose-500/30 shadow-2xs">
                <span className="w-2 h-2 rounded-full bg-rose-400" />
                {occupiedCount + sharedCount} Occupied
              </span>
              <span className="flex items-center gap-1.5 text-stone-300 font-bold bg-stone-800/90 px-2.5 py-1 rounded-xl border border-stone-700 shadow-2xs">
                👥 {totalActiveGuests} Diners
              </span>
              <span className="flex items-center gap-1.5 text-amber-200 font-black bg-amber-950/80 px-3 py-1 rounded-xl border border-amber-500/40 shadow-2xs font-tabular tracking-wide">
                💰 Floor: ₹{totalFloorSales}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 relative z-10">
          <button
            type="button"
            onClick={() => handleTakeParcel()}
            className="flex items-center gap-2 bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 hover:from-amber-500 hover:to-amber-700 text-stone-950 text-xs font-black px-4 py-2.5 rounded-2xl shadow-lg shadow-amber-500/25 active:scale-95 transition-all shrink-0 cursor-pointer border border-amber-300"
            title="1-Tap New Parcel Order (Will not occupy physical tables 1–12)"
          >
            <ShoppingBag className="w-4 h-4 text-stone-950" />
            <span>🛍️ Take Parcel (पार्सल)</span>
          </button>
          <button
            type="button"
            onClick={() => setShowPrinterModal(true)}
            className="flex items-center gap-2 bg-stone-800/90 hover:bg-stone-750 text-stone-200 text-xs font-bold px-3.5 py-2.5 rounded-2xl border border-stone-700 shadow-sm active:scale-95 transition-all shrink-0 cursor-pointer"
            title="Configure waiter thermal printer"
          >
            <Printer className="w-4 h-4 text-amber-400" />
            <span>प्रिंटर सेटिंग्ज</span>
          </button>
          <button
            onClick={() => handleOpenAddParty(1)}
            className="flex items-center gap-2 bg-gradient-to-r from-red-600 via-red-700 to-red-800 hover:from-red-500 hover:to-red-700 text-white text-xs font-black px-4 py-2.5 rounded-2xl shadow-lg shadow-red-900/40 active:scale-95 transition-all shrink-0 cursor-pointer border border-red-500/40 ring-1 ring-amber-400/20"
          >
            <Plus className="w-4 h-4 text-amber-200" />
            <span>+ Seat Table (बसवा)</span>
          </button>
        </div>
      </div>

      {/* Mobile Fast Action Strip (sm:hidden) */}
      <div className="flex sm:hidden items-center justify-between gap-2 bg-gradient-to-r from-stone-950 via-stone-900 to-stone-950 text-white p-2.5 rounded-2xl shadow-md border border-stone-800/90">
        <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
          <span className="text-xs font-black text-amber-400">{store.tables.length} Tables</span>
          <span className="bg-emerald-600/90 text-[10px] font-bold px-1.5 py-0.5 rounded-full text-white">
            {availableCount} Free
          </span>
          <span className="bg-stone-800 text-[10px] font-tabular font-bold px-1.5 py-0.5 rounded-md text-amber-200 border border-stone-700">
            ₹{totalFloorSales}
          </span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => handleTakeParcel()}
            className="min-h-[44px] px-3 py-1.5 bg-gradient-to-r from-amber-400 to-amber-500 text-stone-950 font-black text-xs rounded-xl shadow-xs active:scale-95 transition-all flex items-center gap-1.5 border border-amber-300 cursor-pointer touch-manipulation"
            title="1-Tap Take Parcel"
          >
            <ShoppingBag className="w-3.5 h-3.5 text-stone-950 shrink-0" />
            <span>Parcel</span>
          </button>
          <button
            type="button"
            onClick={() => setShowPrinterModal(true)}
            className="min-h-[44px] px-2.5 py-1.5 bg-stone-800/90 hover:bg-stone-750 text-amber-300 border border-stone-700 font-bold text-xs rounded-xl shadow-2xs active:scale-95 transition-all flex items-center gap-1 cursor-pointer touch-manipulation"
          >
            <Printer className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>प्रिंटर</span>
          </button>
          <button
            type="button"
            onClick={() => handleOpenAddParty(1)}
            className="min-h-[44px] px-3 py-1.5 bg-gradient-to-r from-red-600 to-red-700 text-white font-black text-xs rounded-xl shadow-xs active:scale-95 transition-all flex items-center gap-1 border border-red-500/40 cursor-pointer touch-manipulation"
          >
            <Plus className="w-3.5 h-3.5 text-amber-200 shrink-0" />
            <span>Seat</span>
          </button>
        </div>
      </div>

      {/* Modern Floor Filter Bar */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar text-xs">
        <button
          onClick={() => setFloorFilter("ALL")}
          className={`px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-2xl font-black whitespace-nowrap transition-all border touch-manipulation active:scale-95 text-[11px] sm:text-xs flex items-center gap-1.5 cursor-pointer ${
            floorFilter === "ALL"
              ? "bg-stone-900 text-amber-300 border-stone-900 shadow-md ring-1 ring-amber-400/30"
              : "bg-white text-stone-700 border-stone-200/90 hover:bg-stone-50 shadow-2xs"
          }`}
        >
          <span className="xs:hidden">All</span>
          <span className="hidden xs:inline">All Tables</span>
          <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-tabular ${floorFilter === "ALL" ? "bg-stone-800 text-amber-300" : "bg-stone-100 text-stone-600"}`}>{store.tables.length}</span>
        </button>
        <button
          onClick={() => setFloorFilter("SECTION_A")}
          className={`px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-2xl font-black whitespace-nowrap transition-all border touch-manipulation active:scale-95 text-[11px] sm:text-xs flex items-center gap-1 cursor-pointer ${
            floorFilter === "SECTION_A"
              ? "bg-stone-900 text-amber-300 border-stone-900 shadow-md ring-1 ring-amber-400/30"
              : "bg-white text-stone-700 border-stone-200/90 hover:bg-stone-50 shadow-2xs"
          }`}
        >
          <span>Sec A (A1–A3)</span>
        </button>
        <button
          onClick={() => setFloorFilter("SECTION_B")}
          className={`px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-2xl font-black whitespace-nowrap transition-all border touch-manipulation active:scale-95 text-[11px] sm:text-xs flex items-center gap-1 cursor-pointer ${
            floorFilter === "SECTION_B"
              ? "bg-stone-900 text-amber-300 border-stone-900 shadow-md ring-1 ring-amber-400/30"
              : "bg-white text-stone-700 border-stone-200/90 hover:bg-stone-50 shadow-2xs"
          }`}
        >
          <span>Sec B (B1–B4)</span>
        </button>
        <button
          onClick={() => setFloorFilter("SECTION_C")}
          className={`px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-2xl font-black whitespace-nowrap transition-all border touch-manipulation active:scale-95 text-[11px] sm:text-xs flex items-center gap-1 cursor-pointer ${
            floorFilter === "SECTION_C"
              ? "bg-stone-900 text-amber-300 border-stone-900 shadow-md ring-1 ring-amber-400/30"
              : "bg-white text-stone-700 border-stone-200/90 hover:bg-stone-50 shadow-2xs"
          }`}
        >
          <span>Sec C (C1–C4)</span>
        </button>
        <button
          onClick={() => setFloorFilter("AVAILABLE")}
          className={`px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-2xl font-black whitespace-nowrap transition-all border touch-manipulation active:scale-95 text-[11px] sm:text-xs flex items-center gap-1.5 cursor-pointer ${
            floorFilter === "AVAILABLE"
              ? "bg-emerald-600 text-white border-emerald-600 shadow-md ring-1 ring-emerald-400/40"
              : "bg-white text-emerald-800 border-stone-200/90 hover:bg-emerald-50/50 shadow-2xs"
          }`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span>Free</span>
          <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-tabular ${floorFilter === "AVAILABLE" ? "bg-emerald-700 text-white" : "bg-emerald-100 text-emerald-800"}`}>
            {availableCount}
          </span>
        </button>
        <button
          onClick={() => setFloorFilter("OCCUPIED")}
          className={`px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-2xl font-black whitespace-nowrap transition-all border touch-manipulation active:scale-95 text-[11px] sm:text-xs flex items-center gap-1.5 cursor-pointer ${
            floorFilter === "OCCUPIED"
              ? "bg-red-700 text-white border-red-700 shadow-md ring-1 ring-red-400/40"
              : "bg-white text-red-900 border-stone-200/90 hover:bg-red-50/50 shadow-2xs"
          }`}
        >
          <span className="xs:hidden">Occ</span>
          <span className="hidden xs:inline">Occupied</span>
          <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-tabular ${floorFilter === "OCCUPIED" ? "bg-red-800 text-white" : "bg-red-100 text-red-800"}`}>
            {occupiedCount + sharedCount}
          </span>
        </button>
        {billRequestedCount > 0 && (
          <button
            onClick={() => setFloorFilter("BILL_REQUESTED")}
            className={`px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-2xl font-black whitespace-nowrap transition-all border touch-manipulation active:scale-95 text-[11px] sm:text-xs flex items-center gap-1.5 cursor-pointer ${
              floorFilter === "BILL_REQUESTED"
                ? "bg-amber-500 text-stone-950 border-amber-500 shadow-md ring-2 ring-amber-300 animate-pulse"
                : "bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100/70 shadow-2xs"
            }`}
          >
            <span className="xs:hidden">Bill 🔥</span>
            <span className="hidden xs:inline">Bill Ready 🔥</span>
            <span className="bg-amber-600 text-white text-[10px] px-1.5 py-0.2 rounded-full font-tabular font-black">
              {billRequestedCount}
            </span>
          </button>
        )}
        <button
          onClick={() => setFloorFilter("PARCELS")}
          className={`px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-2xl font-black whitespace-nowrap transition-all border touch-manipulation active:scale-95 text-[11px] sm:text-xs flex items-center gap-1.5 cursor-pointer ${
            floorFilter === "PARCELS"
              ? "bg-amber-600 text-white border-amber-600 shadow-md ring-2 ring-amber-400/40"
              : "bg-white text-amber-900 border-stone-200/90 hover:bg-amber-50/50 shadow-2xs"
          }`}
        >
          <ShoppingBag className="w-3.5 h-3.5 text-amber-600" />
          <span className="xs:hidden">Parcels</span>
          <span className="hidden xs:inline">Parcels (पार्सल)</span>
          {activeParcels.length > 0 && (
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-tabular font-bold ${floorFilter === "PARCELS" ? "bg-amber-700 text-white" : "bg-amber-100 text-amber-800"}`}>
              {activeParcels.length}
            </span>
          )}
        </button>
      </div>

      {/* Active Parcels Strip (Always visible if parcels exist OR when PARCELS filter selected) */}
      {(activeParcels.length > 0 || floorFilter === "PARCELS") && (
        <div className="bg-gradient-to-r from-amber-50/95 via-orange-50/70 to-amber-50/95 border border-amber-300/80 rounded-3xl p-3.5 sm:p-4 space-y-3 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-amber-500 text-stone-950 flex items-center justify-center font-black shadow-sm">
                <ShoppingBag className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs sm:text-sm font-black text-amber-950 leading-tight">
                  Running Parcels (चालू पार्सल: {activeParcels.length})
                </h3>
                <span className="text-[10px] text-amber-800 font-semibold">
                  {activeParcels.length === 0 ? "No active parcel orders right now" : "Ready & in-preparation takeaway orders"}
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => handleTakeParcel()}
              className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-black text-xs rounded-xl shadow-xs active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer border border-amber-500"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Take Parcel</span>
            </button>
          </div>

          {activeParcels.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {activeParcels.map((parcel) => (
                <div
                  key={parcel.id}
                  className="bg-white rounded-2xl p-3.5 border border-amber-200/90 shadow-sm flex flex-col justify-between gap-3 hover:border-amber-400 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="bg-amber-100 text-amber-950 font-black text-[11px] px-2.5 py-0.5 rounded-lg border border-amber-300 inline-block">
                        🛍️ {parcel.partyCode}
                      </span>
                      <p className="text-xs font-bold text-stone-900 mt-1 truncate max-w-[180px]">
                        {parcel.customerName || "Takeaway Guest"}
                        {parcel.customerPhone ? ` • ${parcel.customerPhone}` : ""}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="font-tabular font-black text-base sm:text-lg text-stone-950 block leading-tight">
                        ₹{parcel.runningSubtotal}
                      </span>
                      <span className="text-[9px] font-black uppercase text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                        {parcel.status}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 pt-2 border-t border-stone-100">
                    <Link
                      href={`/waiter/order/${parcel.id}?isTakeaway=true`}
                      className="flex-1 py-2 px-2.5 bg-stone-900 hover:bg-stone-800 text-white font-black text-xs rounded-xl text-center flex items-center justify-center gap-1.5 active:scale-95 transition-all shadow-xs"
                    >
                      <Plus className="w-3.5 h-3.5 text-amber-300" />
                      <span>Order</span>
                    </Link>
                    <button
                      type="button"
                      onClick={() => {
                        setSettlePartyTarget(parcel);
                        setSettleMethod("CASH");
                      }}
                      className="py-2 px-3.5 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white font-black text-xs rounded-xl flex items-center justify-center gap-1.5 shadow-xs active:scale-95 transition-all cursor-pointer border border-emerald-500"
                      title="Bill is Paid — Complete Parcel"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-200" />
                      <span>Bill Paid</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-4 text-center text-xs text-amber-800 font-semibold bg-white/70 rounded-2xl border border-dashed border-amber-200">
              Tap &quot;+ Take Parcel&quot; above to start a takeaway order without assigning a dining table.
            </div>
          )}
        </div>
      )}

      {/* 12 Physical Tables Grid: Responsive 2-col on narrow mobile (<380px), 3-col on >=380px, 4-col on tablet/laptop, 6-col on desktop */}
      <div className="grid grid-cols-2 min-[380px]:grid-cols-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-6 gap-2 sm:gap-3.5 w-full pb-6">
        {displayedTables.map((table) => {
          const tableParties = store.parties.filter(
            (p) => (p.tableId === table.id || p.tableNumber === table.tableNumber) && p.status !== "CLOSED" && p.status !== "CANCELLED" && !p.isTakeaway
          );
          const isOccupied = tableParties.length > 0 || table.status === "OCCUPIED" || table.status === "SHARED";
          const isShared = tableParties.length > 1;
          const hasBillRequested = tableParties.some((p) => p.status === "WAITING_FOR_BILL");
          const primaryParty = tableParties[0] || {
            id: `party-tbl-${table.tableNumber}`,
            partyCode: `T${table.tableNumber}-P01`,
            tableId: table.id,
            tableNumber: table.tableNumber,
            guestCount: table.totalActiveGuests || 2,
            assignedWaiterId: store.currentUser.id,
            assignedWaiterName: store.currentUser.name,
            status: "OPEN" as const,
            runningSubtotal: 0,
            runningGrandTotal: 0,
            openedAt: new Date().toISOString(),
            lastActivityAt: new Date().toISOString(),
          };
          const totalSubtotal = tableParties.reduce((sum, p) => sum + p.runningSubtotal, 0);
          const totalGuests = tableParties.reduce((sum, p) => sum + p.guestCount, 0);

          // Count ordered items for this table
          const tableOrderedItems = tableParties.flatMap((p) =>
            store.orders
              .filter((o) => o.partyId === p.id && o.status !== "CANCELLED")
              .flatMap((o) => o.items)
          );
          const totalItemsCount = tableOrderedItems.reduce((sum, it) => sum + it.quantity, 0);
          const draftItemCount = primaryParty ? (draftCartCounts[primaryParty.id] || 0) : 0;

          const handleTableCardClick = () => {
            if (isOccupied) {
              if (isShared) {
                setActiveTableForDetail(table);
              } else {
                router.push(`/waiter/order/${primaryParty.id}`);
              }
            } else {
              handleQuickSeatAndOrder(table.tableNumber, 2);
            }
          };

          return (
            <div
              key={table.id}
              onClick={handleTableCardClick}
              className={`min-h-[148px] sm:min-h-[185px] w-full rounded-2xl sm:rounded-3xl border transition-all flex flex-col justify-between p-2.5 sm:p-3.5 relative overflow-hidden touch-manipulation select-none cursor-pointer active:scale-[0.98] ${
                hasBillRequested
                  ? "border-amber-400 bg-gradient-to-b from-amber-50/95 via-white to-amber-50/60 shadow-lg ring-2 ring-amber-400/80 animate-bill-radar"
                  : isShared
                  ? "border-purple-300/90 bg-gradient-to-b from-purple-50/40 via-white to-stone-50/40 shadow-xs hover:shadow-md ring-1 ring-purple-300/50"
                  : isOccupied
                  ? "border-stone-300/90 bg-gradient-to-b from-red-50/20 via-white to-[#FAF7F2] shadow-xs hover:shadow-md hover:border-red-300"
                  : "border-emerald-200/90 bg-gradient-to-b from-emerald-50/30 via-white to-[#F9FCFA] hover:border-emerald-400 shadow-xs hover:shadow-sm"
              }`}
            >
              {/* Top Row: Table Badge & Status */}
              <div className="flex items-center justify-between gap-1 shrink-0">
                <div className="flex items-center gap-1.5 min-w-0">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (isOccupied) setActiveTableForDetail(table);
                      else handleOpenAddParty(table.tableNumber);
                    }}
                    title={isOccupied ? `Manage Table ${table.name}` : `Seat Table ${table.name}`}
                    className={`w-7 h-7 sm:w-8 sm:h-8 rounded-xl font-black text-xs sm:text-sm flex items-center justify-center shadow-xs shrink-0 cursor-pointer active:scale-95 transition-all touch-manipulation ${
                      hasBillRequested
                        ? "bg-amber-500 text-stone-950 ring-2 ring-amber-300 font-tabular"
                        : isOccupied
                        ? "bg-stone-900 text-amber-300 border border-stone-800 font-tabular"
                        : "bg-emerald-600 text-white shadow-emerald-600/20 font-tabular"
                    }`}
                  >
                    {table.name}
                  </button>
                  <span className="font-black text-[11px] sm:text-xs text-stone-800 hidden md:inline truncate">
                    Table {table.name}
                  </span>
                </div>

                {/* Status Pill & Draft Badge in top right */}
                <div className="flex items-center gap-1 shrink-0">
                  {draftItemCount > 0 && (
                    <span
                      className="text-[9px] font-black px-1.5 py-0.5 rounded-md bg-amber-400 text-stone-950 flex items-center gap-0.5 shadow-2xs font-tabular animate-pulse shrink-0"
                      title={`${draftItemCount} unsaved items in cart`}
                    >
                      🛒 {draftItemCount}
                    </span>
                  )}
                  {hasBillRequested ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSettlePartyTarget(primaryParty);
                        setSettleMethod("CASH");
                      }}
                      className="text-[8px] sm:text-[9px] font-black px-1.5 py-0.5 rounded-full bg-amber-500 text-stone-950 uppercase tracking-tight shadow-xs animate-pulse cursor-pointer touch-manipulation border border-amber-400 shrink-0"
                      title="Bill Requested — Quick Settle"
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
                      className="text-[8px] sm:text-[9px] font-black px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-900 border border-purple-300 cursor-pointer touch-manipulation font-tabular shrink-0"
                    >
                      {tableParties.length}P•{totalGuests}G
                    </button>
                  ) : isOccupied ? (
                    <span className="text-[8px] sm:text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-900 border border-amber-200 flex items-center gap-1 font-tabular shrink-0">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                      {totalGuests}G
                    </span>
                  ) : (
                    <span className="text-[8px] sm:text-[9px] font-black px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-1 shrink-0">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Free
                    </span>
                  )}
                </div>
              </div>

              {/* Center Zone: Tap Area */}
              {isOccupied ? (
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    if (isShared) setActiveTableForDetail(table);
                    else router.push(`/waiter/order/${primaryParty.id}`);
                  }}
                  className="flex-1 min-h-0 flex flex-col items-center justify-center text-center cursor-pointer py-1.5 px-0.5 touch-manipulation"
                >
                  <span className="text-[10px] sm:text-xs font-bold text-stone-600 truncate max-w-full leading-tight">
                    {isShared
                      ? `${tableParties.length} Shared Parties`
                      : primaryParty.customerName || primaryParty.partyCode}
                  </span>
                  <span className="text-base sm:text-lg md:text-xl font-black text-stone-950 font-tabular leading-tight mt-0.5 tracking-tight">
                    ₹{totalSubtotal}
                  </span>
                  <div className="flex items-center gap-1 mt-0.5">
                    {totalItemsCount > 0 && (
                      <span className="text-[8px] sm:text-[9px] font-black px-1.5 py-0.2 rounded-md bg-stone-100 text-stone-700 border border-stone-200 font-tabular">
                        {totalItemsCount} items
                      </span>
                    )}
                    <span className="text-[8px] sm:text-[9px] text-stone-400 font-semibold truncate leading-tight">
                      {primaryParty.assignedWaiterName.split(" ")[0]}
                    </span>
                  </div>
                </div>
              ) : (
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    handleQuickSeatAndOrder(table.tableNumber, 2);
                  }}
                  className="flex-1 min-h-0 flex flex-col items-center justify-center text-center cursor-pointer group py-2 touch-manipulation"
                >
                  <div className="w-8 h-8 rounded-full bg-emerald-100/90 flex items-center justify-center border border-emerald-300 group-hover:bg-emerald-200 transition-colors shadow-2xs">
                    <Plus className="w-4 h-4 text-emerald-800" />
                  </div>
                  <span className="text-[10px] sm:text-[11px] text-emerald-800 font-black leading-tight mt-1">1-Tap Seat & Order</span>
                  <span className="text-[9px] text-emerald-600 font-medium">2 Guests</span>
                </div>
              )}

              {/* Bottom Row: 1-Tap Touch-Friendly Actions with Short Forms to Never Ellipsis */}
              {isOccupied ? (
                isShared ? (
                  <div className="pt-2 border-t border-stone-100 shrink-0">
                    <div className="grid grid-cols-2 gap-1.5 w-full">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveTableForDetail(table);
                        }}
                        className="w-full min-h-[44px] py-2 px-1 bg-purple-600 hover:bg-purple-700 text-white font-black text-xs rounded-xl shadow-xs active:scale-95 transition-all text-center truncate touch-manipulation cursor-pointer flex items-center justify-center"
                      >
                        <span>{tableParties.length}P View →</span>
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSettlePartyTarget(primaryParty);
                          setSettleMethod("CASH");
                        }}
                        title="Bill is Paid — Close Table"
                        className="w-full min-h-[44px] py-2 px-1 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white font-black text-xs rounded-xl shadow-xs active:scale-95 transition-all flex items-center justify-center gap-1 text-center truncate touch-manipulation cursor-pointer border border-emerald-500/40"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-200 shrink-0" />
                        <span>Paid</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="pt-2 border-t border-stone-100 shrink-0">
                    <div className="grid grid-cols-2 gap-1.5 w-full">
                      <Link
                        href={`/waiter/order/${primaryParty.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="w-full min-h-[44px] py-2 px-1 bg-gradient-to-r from-red-600 via-red-700 to-red-800 hover:from-red-500 hover:to-red-700 text-white font-black text-xs rounded-xl shadow-xs active:scale-95 transition-all flex items-center justify-center gap-1 text-center truncate touch-manipulation border border-red-500/30"
                      >
                        <Plus className="w-3.5 h-3.5 text-amber-200 shrink-0" />
                        <span>Order</span>
                      </Link>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSettlePartyTarget(primaryParty);
                          setSettleMethod("CASH");
                        }}
                        title="Bill is Paid — Close Table"
                        className={`w-full min-h-[44px] py-2 px-1 text-white font-black text-xs rounded-xl shadow-xs active:scale-95 transition-all flex items-center justify-center gap-1 text-center truncate touch-manipulation cursor-pointer border ${
                          hasBillRequested
                            ? "bg-gradient-to-r from-amber-500 to-amber-600 text-stone-950 border-amber-400 ring-1 ring-amber-300 animate-pulse font-black"
                            : "bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 border border-emerald-500/40"
                        }`}
                      >
                        <CheckCircle2 className={`w-3.5 h-3.5 shrink-0 ${hasBillRequested ? "text-stone-950" : "text-emerald-200"}`} />
                        <span>{hasBillRequested ? "Paid 🔥" : "Paid"}</span>
                      </button>
                    </div>
                  </div>
                )
              ) : (
                <div className="pt-2 border-t border-stone-100 shrink-0">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleQuickSeatAndOrder(table.tableNumber, 2);
                    }}
                    className="w-full min-h-[44px] py-2 px-2 bg-gradient-to-r from-emerald-600 via-emerald-700 to-emerald-800 hover:from-emerald-500 hover:to-emerald-700 text-white font-black text-xs rounded-xl shadow-xs active:scale-95 transition-all flex items-center justify-center gap-1.5 text-center truncate touch-manipulation border border-emerald-500/30 cursor-pointer"
                    title="1-Tap Quick Seat (2 Guests) & Take Order"
                  >
                    <Plus className="w-3.5 h-3.5 text-emerald-200 shrink-0" />
                    <span>Seat & Order →</span>
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* MODAL: TABLE DETAIL & MULTI-PARTY MANAGEMENT */}
      {activeTableForDetail && (
        <div className="fixed inset-0 z-50 bg-stone-950/70 backdrop-blur-md flex items-center justify-center p-3.5 sm:p-4 animate-in fade-in duration-150">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-stone-200 overflow-hidden text-xs max-h-[90vh] flex flex-col">
            <div className="bg-gradient-to-r from-stone-950 via-stone-900 to-stone-950 text-white p-4 sm:p-5 flex items-center justify-between border-b border-stone-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-amber-400 to-amber-500 text-stone-950 font-black text-sm sm:text-base flex items-center justify-center font-tabular shadow-sm">
                  {activeTableForDetail.name}
                </div>
                <div>
                  <h2 className="leading-tight text-white font-black text-base">Table {activeTableForDetail.name}</h2>
                  <p className="text-[11px] text-stone-400 font-medium">
                    Section {activeTableForDetail.name.charAt(0)} • {activeTableForDetail.maxCapacity} Seats
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveTableForDetail(null)}
                className="text-stone-400 hover:text-white p-1.5 rounded-xl hover:bg-stone-800 transition-colors text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-4 sm:p-5 overflow-y-auto space-y-3.5 flex-1">
              {(() => {
                const parties = store.parties.filter(
                  (p) => (p.tableId === activeTableForDetail.id || p.tableNumber === activeTableForDetail.tableNumber) && p.status !== "CLOSED" && p.status !== "CANCELLED" && !p.isTakeaway
                );

                if (parties.length === 0) {
                  return (
                    <div className="text-center py-8 space-y-3">
                      <p className="text-stone-500 font-medium">No active parties seated on this table.</p>
                      <button
                        onClick={() => {
                          const tblNum = activeTableForDetail.tableNumber;
                          setActiveTableForDetail(null);
                          handleOpenAddParty(tblNum);
                        }}
                        className="px-5 py-2.5 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-700 text-white font-black rounded-2xl shadow-md cursor-pointer"
                      >
                        + Seat New Party
                      </button>
                    </div>
                  );
                }

                return parties.map((party) => (
                  <div
                    key={party.id}
                    className="p-3.5 rounded-2xl border border-stone-200/90 bg-[#FAF8F5] space-y-2.5 shadow-2xs"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="bg-stone-900 text-amber-300 font-black px-2.5 py-0.5 rounded-lg text-xs font-tabular">
                          {party.partyCode}
                        </span>
                        <span className="font-bold text-stone-800">
                          {party.guestCount} Guests • Waiter: {party.assignedWaiterName}
                        </span>
                      </div>
                      <span className="font-tabular font-black text-stone-950 text-sm sm:text-base">
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
                        <div className="bg-white rounded-xl border border-stone-200/90 p-2.5 space-y-1.5 shadow-2xs">
                          <span className="text-[10px] font-black text-stone-500 uppercase tracking-wider">Ordered Items</span>
                          <div className="divide-y divide-stone-100">
                            {orderedItems.map((item, idx) => (
                              <div key={idx} className="flex items-center justify-between py-1 text-[11px]">
                                <span className="font-bold text-stone-800 truncate">
                                  {item.quantity}× {item.menuItemLocalName || item.menuItemName}
                                </span>
                                <span className="font-tabular font-black text-stone-700 shrink-0 ml-2">
                                  ₹{item.totalPrice}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })()}

                    {/* Primary Action: Bill Paid & Close Table - ALWAYS VISIBLE */}
                    <div className="pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setSettlePartyTarget(party);
                          setSettleMethod("CASH");
                        }}
                        className="w-full py-3.5 bg-gradient-to-r from-emerald-600 via-emerald-700 to-emerald-800 hover:from-emerald-500 hover:to-emerald-700 text-white font-black text-xs sm:text-sm rounded-xl flex items-center justify-center gap-2 shadow-md shadow-emerald-700/25 active:scale-95 transition-all touch-manipulation cursor-pointer border border-emerald-500/30"
                      >
                        <CheckCircle2 className="w-4 h-4 text-emerald-200 shrink-0" />
                        <span>
                          {party.runningSubtotal > 0
                            ? `✅ Bill is Paid — Close Table (₹${party.runningSubtotal})`
                            : "✅ Vacate / Close Table (टेबल बंद करा)"}
                        </span>
                      </button>
                    </div>

                    {/* Actions — 3-column action grid */}
                    <div className="grid grid-cols-3 gap-1.5 pt-1">
                      <Link
                        href={`/waiter/order/${party.id}`}
                        onClick={() => setActiveTableForDetail(null)}
                        className="py-2.5 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-700 text-white font-black rounded-xl text-center flex items-center justify-center gap-1 shadow-xs border border-red-500/40"
                      >
                        <Utensils className="w-3.5 h-3.5 text-amber-200" />
                        <span>+ Order</span>
                      </Link>
                      <button
                        type="button"
                        onClick={() => {
                          setSettlePartyTarget(party);
                          setSettleMethod("CASH");
                        }}
                        className="py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl flex items-center justify-center gap-1 shadow-xs border border-emerald-500 cursor-pointer"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-200" />
                        <span>Bill Paid</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRequestBill(party.id)}
                        className="py-2.5 bg-stone-900 hover:bg-stone-800 text-amber-300 font-black rounded-xl flex items-center justify-center gap-1 shadow-xs border border-stone-800 cursor-pointer"
                      >
                        <Receipt className="w-3.5 h-3.5 text-amber-300" />
                        <span>Req Bill</span>
                      </button>
                    </div>
                    <div className="grid grid-cols-3 gap-1.5 text-xs">
                      <button
                        type="button"
                        onClick={() => handlePrintKotForParty(party.id)}
                        className="py-2 bg-stone-100 hover:bg-stone-200 text-stone-800 font-bold rounded-xl flex items-center justify-center gap-1 touch-manipulation active:scale-95 transition-all cursor-pointer"
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
                        className="py-2 bg-stone-100 hover:bg-stone-200 text-stone-800 font-bold rounded-xl flex items-center justify-center gap-1 touch-manipulation active:scale-95 transition-all cursor-pointer"
                      >
                        <ArrowRightLeft className="w-3.5 h-3.5 text-blue-600" />
                        <span>Move</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handlePrintFinalBill(party.id)}
                        className="py-2 bg-stone-100 hover:bg-stone-200 text-stone-800 font-bold rounded-xl flex items-center justify-center gap-1 touch-manipulation active:scale-95 transition-all cursor-pointer"
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
                            try {
                              store.voidOrCancelParty(party.id, "Waiter cancelled empty party");
                              setTick((t) => t + 1);
                              setActiveTableForDetail(null);
                              showToast(`Party ${party.partyCode} cancelled and table vacated.`);
                            } catch (err: any) {
                              showToast(err?.message || "Could not cancel party");
                            }
                          }}
                          className="w-full py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold rounded-xl flex items-center justify-center gap-1 border border-rose-200 text-[11px] active:scale-95 transition-all cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                          <span>Cancel / Vacate Empty Party</span>
                        </button>
                      </div>
                    )}
                  </div>
                ));
              })()}

              {/* Add Shared Party button in modal if capacity permits */}
              <div className="pt-2.5 border-t border-stone-200 flex items-center justify-between">
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
                  className="px-3.5 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 font-black rounded-xl border border-red-200 text-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Add Shared Party</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: QUICK SETTLE & CLOSE TABLE (बिल भरले — टेबल बंद करा) */}
      {settlePartyTarget && (
        <div className="fixed inset-0 z-50 bg-stone-950/70 backdrop-blur-md flex items-center justify-center p-3.5 sm:p-4 animate-in fade-in duration-150">
          <div className="bg-white text-stone-900 rounded-3xl max-w-sm w-full p-5 sm:p-6 shadow-2xl border border-stone-200 space-y-4 animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <div className="flex items-center gap-2.5">
                <span className={`text-white font-black text-xs px-2.5 py-1 rounded-xl shadow-xs ${
                  settlePartyTarget.isTakeaway || settlePartyTarget.tableNumber === 0
                    ? "bg-amber-600"
                    : "bg-red-600"
                }`}>
                  {settlePartyTarget.isTakeaway || settlePartyTarget.tableNumber === 0
                    ? `Parcel ${settlePartyTarget.partyCode}`
                    : `Table ${store.getTableName(settlePartyTarget.tableNumber)}`}
                </span>
                <h3 className="font-black text-stone-900 text-base">
                  Bill is Paid (बिल भरले)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSettlePartyTarget(null)}
                className="text-stone-400 hover:text-stone-700 p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Bill Summary & Packaging Breakdown */}
            {(() => {
              const targetIsTakeaway = settlePartyTarget.isTakeaway || settlePartyTarget.tableNumber === 0;
              const targetPackagingFee = targetIsTakeaway ? (settlePartyTarget.packagingCharges ?? 20) : 0;
              const targetGrandTotal = settlePartyTarget.runningSubtotal + (targetIsTakeaway && settlePartyTarget.runningSubtotal > 0 ? targetPackagingFee : 0);

              return (
                <>
                  <div className="bg-gradient-to-b from-[#FAF8F5] to-[#F5EFE6] border border-[#E7E2DA] rounded-2xl p-4 text-center space-y-1 shadow-2xs">
                    <div className="text-xs text-stone-600 font-semibold">
                      Party {settlePartyTarget.partyCode}
                      {settlePartyTarget.customerName ? ` • ${settlePartyTarget.customerName}` : ""}
                    </div>
                    <div className="text-3xl sm:text-4xl font-tabular font-black text-emerald-700 tracking-tight">
                      ₹{targetGrandTotal}
                    </div>
                    {targetIsTakeaway && settlePartyTarget.runningSubtotal > 0 && (
                      <div className="text-[11px] text-amber-800 font-bold">
                        Items: ₹{settlePartyTarget.runningSubtotal} + Packaging: ₹{targetPackagingFee}
                      </div>
                    )}
                    <div className="text-[11px] text-stone-500 font-medium">
                      {targetIsTakeaway
                        ? "Mark parcel as paid and ready for takeaway"
                        : `Full payment to close & free Table ${store.getTableName(settlePartyTarget.tableNumber)}`}
                    </div>
                  </div>

                  {/* Payment Method Selector */}
                  <div className="space-y-2">
                    <span className="text-[11px] font-black uppercase text-stone-500 tracking-wider block">
                      Payment Mode (पैसे कसे मिळाले?):
                    </span>
                    <div className="grid grid-cols-2 gap-2.5">
                      <button
                        type="button"
                        onClick={() => setSettleMethod("CASH")}
                        className={`py-3.5 px-3 rounded-2xl border-2 font-black text-xs sm:text-sm flex flex-col items-center justify-center gap-1.5 transition-all touch-manipulation active:scale-95 cursor-pointer ${
                          settleMethod === "CASH"
                            ? "border-emerald-600 bg-emerald-50/80 text-emerald-950 shadow-xs ring-2 ring-emerald-400/20"
                            : "border-stone-200 bg-white text-stone-700 hover:border-stone-300"
                        }`}
                      >
                        <Banknote className="w-5 h-5 text-emerald-600" />
                        <span>💵 Cash (रोख)</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setSettleMethod("UPI")}
                        className={`py-3.5 px-3 rounded-2xl border-2 font-black text-xs sm:text-sm flex flex-col items-center justify-center gap-1.5 transition-all touch-manipulation active:scale-95 cursor-pointer ${
                          settleMethod === "UPI"
                            ? "border-blue-600 bg-blue-50/80 text-blue-950 shadow-xs ring-2 ring-blue-400/20"
                            : "border-stone-200 bg-white text-stone-700 hover:border-stone-300"
                        }`}
                      >
                        <CreditCard className="w-5 h-5 text-blue-600" />
                        <span>📱 UPI / QR</span>
                      </button>
                    </div>
                  </div>

                  {/* Print Receipt Toggle */}
                  <label className="flex items-center gap-2.5 text-xs font-bold text-stone-700 cursor-pointer select-none bg-stone-50 p-3 rounded-2xl border border-stone-200">
                    <input
                      type="checkbox"
                      checked={autoPrintOnSettle}
                      onChange={(e) => setAutoPrintOnSettle(e.target.checked)}
                      className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                    />
                    <Printer className="w-4 h-4 text-stone-600" />
                    <span>Print Customer Bill Receipt (पावती छापा)</span>
                  </label>

                  {/* Confirm Settle & Close Table Button */}
                  <div className="pt-1 space-y-2">
                    <button
                      type="button"
                      onClick={() => handleQuickSettleParty(settlePartyTarget.id, settleMethod)}
                      className="w-full py-3.5 bg-gradient-to-r from-emerald-600 via-emerald-700 to-emerald-800 hover:from-emerald-500 hover:to-emerald-700 text-white font-black text-sm rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-700/25 active:scale-95 transition-all touch-manipulation cursor-pointer border border-emerald-500/40"
                    >
                      <CheckCircle2 className="w-4 h-4 text-emerald-200" />
                      <span>
                        {targetIsTakeaway
                          ? `Confirm Paid & Complete Parcel (₹${targetGrandTotal}) →`
                          : `Confirm Paid & Free Table (₹${targetGrandTotal}) →`}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSettlePartyTarget(null)}
                      className="w-full py-2 text-stone-500 hover:text-stone-800 font-bold text-xs text-center cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </>
              );
            })()}
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
                  Table {store.getTableName(selectedTableNumber)}
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
                                {it.quantity}× {it.menuItemLocalName || it.menuItemName}
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

      {/* Waiter Printer Settings Modal */}
      <WaiterPrinterSettingsModal
        isOpen={showPrinterModal}
        onClose={() => setShowPrinterModal(false)}
      />
    </div>
  );
}
