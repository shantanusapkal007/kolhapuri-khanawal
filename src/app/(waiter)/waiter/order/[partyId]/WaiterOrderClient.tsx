"use client";

import React, { useState, useEffect, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Search,
  Plus,
  Minus,
  Sparkles,
  AlertTriangle,
  Send,
  Printer,
  Receipt,
  Trash2,
  ChefHat,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  X,
  Bell,
  ArrowRightLeft,
  MoreVertical,
  Check,
} from "lucide-react";
import { globalRestaurantStore } from "@/lib/store/restaurant-store";
import {
  MenuItem,
  BreadOption,
  BREAD_OPTIONS,
  BREAD_OPTION_LABELS,
  isThaliOrMainCourseItem,
} from "@/types/orders";
import { outboxManager } from "@/lib/offline/outbox";
import { printKotTicket, printBillReceipt, printTableCheck } from "@/lib/printing/thermal-printer";
import { WaiterPrinterSettingsModal } from "@/components/waiter/WaiterPrinterSettingsModal";

interface CartItem {
  menuItem: MenuItem;
  variantName?: string;
  unitPrice: number;
  quantity: number;
  breadOption?: BreadOption;
  notes?: string;
}

export default function WaiterOrderClient({
  params,
}: {
  params: Promise<{ partyId: string }>;
}) {
  const resolvedParams = use(params);
  const router = useRouter();
  const store = globalRestaurantStore;
  const [, setTick] = useState(0);

  // Core order state (Simplified: NO SEAT PARTITIONING)
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isSending, setIsSending] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // UI Modals & Drawers
  const [isCartSheetOpen, setIsCartSheetOpen] = useState<boolean>(false);
  const [showActiveOrders, setShowActiveOrders] = useState<boolean>(true);
  const [showMoreActions, setShowMoreActions] = useState<boolean>(false);
  const [showPrinterModal, setShowPrinterModal] = useState<boolean>(false);
  const [showTransferModal, setShowTransferModal] = useState<boolean>(false);
  const [targetTableNumber, setTargetTableNumber] = useState<number>(1);

  // Manager Override Modal state
  const [showOverrideModal, setShowOverrideModal] = useState<boolean>(false);
  const [overridePin, setOverridePin] = useState<string>("");
  const [overrideReason, setOverrideReason] = useState<string>("Chef confirmed emergency stock available");
  const [overrideError, setOverrideError] = useState<string | null>(null);

  const party = store.parties.find((p) => p.id === resolvedParams.partyId);

  useEffect(() => {
    store.recalculateMenuAvailability();
    setTick((t) => t + 1);
  }, [resolvedParams.partyId]);

  if (!party) {
    return (
      <div className="p-8 text-center bg-white rounded-3xl border border-stone-200 shadow-md max-w-md mx-auto my-12">
        <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-3" />
        <h2 className="text-lg font-black text-stone-900">Table Party Not Found</h2>
        <p className="text-xs text-stone-500 mt-1">This party may have been settled or closed.</p>
        <Link
          href="/waiter"
          className="mt-5 inline-flex items-center gap-1.5 bg-red-600 text-white font-black text-xs px-5 py-2.5 rounded-xl shadow-md"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Dining Tables (मजला)</span>
        </Link>
      </div>
    );
  }

  // Active items already sent to kitchen
  const partyOrders = store.orders.filter((o) => o.partyId === party.id);
  const previouslyOrderedItems = partyOrders.flatMap((o) => o.items);

  // Filtered menu
  const filteredItems = store.menuItems.filter((item) => {
    const matchesCategory = selectedCategory === "ALL" || item.categoryId === selectedCategory;
    const matchesSearch =
      !searchQuery.trim() ||
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.localName && item.localName.includes(searchQuery));
    return matchesCategory && matchesSearch;
  });

  const getCartQuantityForItem = (itemId: string, breadOption?: BreadOption, variantName?: string) => {
    return cart
      .filter(
        (c) =>
          c.menuItem.id === itemId &&
          (breadOption === undefined || c.breadOption === breadOption) &&
          (variantName === undefined || c.variantName === variantName)
      )
      .reduce((sum, c) => sum + c.quantity, 0);
  };

  const handleAddToCart = (
    item: MenuItem,
    explicitBread?: BreadOption,
    variant?: { name: string; price: number }
  ) => {
    const isOut = item.stockStatus === "OUT_OF_STOCK" || item.portionAvailability <= 0;
    if (isOut) {
      const confirmAdd = confirm(
        `"${item.name}" has 0 portions left. Add under Manager PIN override?`
      );
      if (!confirmAdd) return;
    }

    setErrorMessage(null);

    const variantName = variant ? variant.name : undefined;
    const unitPrice = variant ? variant.price : item.sellingPrice;
    const needsBread = isThaliOrMainCourseItem(item);
    const breadToUse: BreadOption | undefined = needsBread
      ? explicitBread || "JWARI_BHAKRI"
      : undefined;

    const existingIndex = cart.findIndex(
      (c) =>
        c.menuItem.id === item.id &&
        c.variantName === variantName &&
        c.breadOption === breadToUse
    );

    if (existingIndex > -1) {
      const updated = [...cart];
      updated[existingIndex].quantity += 1;
      setCart(updated);
    } else {
      setCart([
        ...cart,
        {
          menuItem: item,
          variantName,
          unitPrice,
          quantity: 1,
          breadOption: breadToUse,
        },
      ]);
    }
  };

  const handleCardDecrement = (
    item: MenuItem,
    explicitBread?: BreadOption,
    variantName?: string
  ) => {
    const existingIndex = cart.findIndex(
      (c) =>
        c.menuItem.id === item.id &&
        (explicitBread === undefined || c.breadOption === explicitBread) &&
        (variantName === undefined || c.variantName === variantName)
    );

    if (existingIndex > -1) {
      const updated = [...cart];
      if (updated[existingIndex].quantity > 1) {
        updated[existingIndex].quantity -= 1;
      } else {
        updated.splice(existingIndex, 1);
      }
      setCart(updated);
    }
  };

  const handleUpdateCartQuantity = (index: number, delta: number) => {
    const updated = [...cart];
    updated[index].quantity += delta;
    if (updated[index].quantity <= 0) {
      updated.splice(index, 1);
    }
    setCart(updated);
  };

  const handleChangeCartItemBread = (index: number, newBread: BreadOption) => {
    const current = cart[index];
    const existingIndex = cart.findIndex(
      (c, idx) =>
        idx !== index &&
        c.menuItem.id === current.menuItem.id &&
        c.variantName === current.variantName &&
        c.breadOption === newBread
    );
    if (existingIndex > -1) {
      const updated = [...cart];
      updated[existingIndex].quantity += current.quantity;
      updated.splice(index, 1);
      setCart(updated);
    } else {
      const updated = [...cart];
      updated[index] = { ...current, breadOption: newBread };
      setCart(updated);
    }
  };

  const totalCartCount = cart.reduce((sum, it) => sum + it.quantity, 0);
  const cartSubtotal = cart.reduce((sum, it) => sum + it.unitPrice * it.quantity, 0);

  const handleSendKot = async () => {
    if (cart.length === 0) return;
    setIsSending(true);
    setErrorMessage(null);

    try {
      if (outboxManager.getStatus() === "OFFLINE") {
        await outboxManager.enqueueMutation(
          "SEND_KOT",
          {
            partyId: party.id,
            items: cart.map((c) => ({
              menuItemId: c.menuItem.id,
              quantity: c.quantity,
              breadOption: c.breadOption,
              notes: c.notes,
              variantName: c.variantName,
              unitPrice: c.unitPrice,
            })),
          },
          { partyCode: party.partyCode, tableNumber: party.tableNumber }
        );
      }

      const result = store.placeOrder(
        party.id,
        cart.map((c) => ({
          menuItemId: c.menuItem.id,
          quantity: c.quantity,
          breadOption: c.breadOption,
          notes: c.notes,
          variantName: c.variantName,
          unitPrice: c.unitPrice,
        })),
        false
      );

      if (store.printerSettings?.autoPrintKotOnOrder ?? true) {
        printKotTicket(result.kot, {
          paperWidth: store.printerSettings?.paperWidth || "80mm",
        });
      }

      store.addNotification({
        type: "KOT_NEW",
        title: `KOT #${result.kot.kotNumber} (Table ${party.tableNumber})`,
        message: `${result.kot.items.map((i) => `${i.menuItemName} × ${i.quantity}`).join(", ")} dispatched to kitchen.`,
        category: "KITCHEN",
        urgency: "HIGH",
        targetRoles: ["CHEF", "MANAGER", "ADMIN"],
        actionUrl: "/kitchen",
        actionLabel: "View KDS",
        metadata: {
          tableNumber: party.tableNumber,
          partyId: party.id,
          kotId: result.kot.id,
          kotNumber: result.kot.kotNumber,
        },
      });

      setTick((t) => t + 1);
      setCart([]);
      setIsCartSheetOpen(false);
      router.push("/waiter");
    } catch (err: any) {
      if (err.message?.toLowerCase().includes("insufficient") || err.message?.toLowerCase().includes("deficit")) {
        setErrorMessage(err.message);
        setOverrideError(null);
        setShowOverrideModal(true);
      } else {
        setErrorMessage(err.message || "Failed to place order");
      }
    } finally {
      setIsSending(false);
    }
  };

  const handleManagerOverrideSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const isAuthorized =
      overridePin === "1234" ||
      store.currentUser.role === "OWNER" ||
      store.currentUser.role === "MANAGER";

    if (!isAuthorized) {
      setOverrideError("Invalid Manager PIN! Enter 1234 or switch to Manager/Owner role.");
      return;
    }

    try {
      setIsSending(true);
      const result = store.placeOrder(
        party.id,
        cart.map((c) => ({
          menuItemId: c.menuItem.id,
          quantity: c.quantity,
          breadOption: c.breadOption,
          notes: c.notes,
          variantName: c.variantName,
          unitPrice: c.unitPrice,
        })),
        true
      );
      store.recordAuditLog(
        "OVERRIDE_NEGATIVE_STOCK",
        "PARTY_ORDER",
        party.id,
        overrideReason || "Manager authorized negative stock override"
      );

      if (store.printerSettings?.autoPrintKotOnOrder ?? true) {
        printKotTicket(result.kot, {
          paperWidth: store.printerSettings?.paperWidth || "80mm",
        });
      }

      setShowOverrideModal(false);
      setCart([]);
      setIsCartSheetOpen(false);
      router.push("/waiter");
    } catch (err: any) {
      setOverrideError(err.message);
    } finally {
      setIsSending(false);
    }
  };

  const handlePrintFinalBill = () => {
    try {
      let bill = store.bills.find((b) => b.partyId === party.id && b.status !== "CANCELLED");
      if (!bill) {
        bill = store.generateBillForParty(party.id);
      }
      printBillReceipt(bill, false, store.printerSettings?.paperWidth || "80mm");
      setShowMoreActions(false);
      alert(`Bill printed for Table ${party.tableNumber}!`);
    } catch (err: any) {
      alert(`Could not print bill: ${err.message}`);
    }
  };

  const handlePrintLatestKot = () => {
    const kots = store.kots.filter((k) => k.partyId === party.id);
    if (kots.length === 0) {
      alert("No KOT generated yet for this party.");
      return;
    }
    const latestKot = kots[kots.length - 1];
    printKotTicket(latestKot, {
      paperWidth: store.printerSettings?.paperWidth || "80mm",
    });
    setShowMoreActions(false);
    alert(`Reprinted KOT #${latestKot.kotNumber} for Table ${party.tableNumber}`);
  };

  const handleRequestBill = () => {
    try {
      store.parties = store.parties.map((p) =>
        p.id === party.id ? { ...p, status: "WAITING_FOR_BILL", lastActivityAt: new Date().toISOString() } : p
      );
      const partyOrders = store.orders.filter((o) => o.partyId === party.id);
      const partyItems = partyOrders.flatMap((o) => o.items);
      const subtotal = partyItems.reduce((s, i) => s + (i.totalPrice || 0), 0);
      const taxEstimate = Number((subtotal * 0.05).toFixed(2));
      const grandTotal = Math.round(subtotal + taxEstimate);
      printTableCheck({
        party,
        items: partyItems,
        subtotal,
        taxEstimate,
        grandTotal,
        paperWidth: store.printerSettings?.paperWidth || "80mm",
      });
      setShowMoreActions(false);
      alert(`Bill requested for Table ${party.tableNumber}!`);
    } catch (err: any) {
      alert(`Could not request bill: ${err.message}`);
    }
  };

  return (
    <div className="space-y-3 pb-32 max-w-5xl mx-auto">
      {/* 1. Ultra-Clean Header */}
      <div className="bg-white rounded-2xl p-3 sm:p-4 border border-stone-200 shadow-xs flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <Link
            href="/waiter"
            className="p-2 sm:p-2.5 rounded-xl bg-stone-50 hover:bg-stone-100 text-stone-700 border border-stone-200 active:scale-95 transition-all shrink-0"
            title="Back to Floor"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>

          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="bg-red-600 text-white font-black text-xs px-2 py-0.5 rounded-md">
                Table {party.tableNumber}
              </span>
              <span className="text-xs font-bold text-stone-600 truncate">
                {party.guestCount} Guests
              </span>
            </div>
            <span className="text-[11px] text-stone-400 font-semibold block truncate">
              Waiter: <strong className="text-stone-700">{party.assignedWaiterName.split(" ")[0]}</strong>
            </span>
          </div>
        </div>

        {/* Right Header Status & Action Buttons */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Running Bill Amount */}
          <div className="text-right px-2.5 py-1 bg-stone-50 border border-stone-200 rounded-xl">
            <span className="text-[9px] uppercase font-black tracking-wider text-stone-400 block leading-none">
              Bill Total
            </span>
            <span className="font-mono font-black text-sm sm:text-base text-stone-900 leading-tight">
              ₹{party.runningSubtotal}
            </span>
          </div>

          {/* More Actions Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowMoreActions(!showMoreActions)}
              className="p-2 rounded-xl bg-stone-50 hover:bg-stone-100 border border-stone-200 text-stone-700 active:scale-95"
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            {showMoreActions && (
              <div className="absolute right-0 mt-2 w-48 bg-white border border-stone-200 rounded-2xl shadow-xl p-1.5 z-30 text-xs space-y-1 animate-in fade-in zoom-in-95">
                <button
                  type="button"
                  onClick={handlePrintLatestKot}
                  className="w-full text-left px-3 py-2 rounded-xl hover:bg-stone-50 font-bold text-stone-800 flex items-center gap-2"
                >
                  <Printer className="w-3.5 h-3.5 text-amber-600" />
                  <span>Reprint KOT</span>
                </button>
                <button
                  type="button"
                  onClick={handleRequestBill}
                  className="w-full text-left px-3 py-2 rounded-xl hover:bg-stone-50 font-bold text-stone-800 flex items-center gap-2"
                >
                  <Bell className="w-3.5 h-3.5 text-blue-600" />
                  <span>Request Bill</span>
                </button>
                <button
                  type="button"
                  onClick={handlePrintFinalBill}
                  className="w-full text-left px-3 py-2 rounded-xl hover:bg-stone-50 font-bold text-emerald-700 flex items-center gap-2"
                >
                  <Receipt className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Print Final Bill</span>
                </button>
                <div className="border-t border-stone-100 my-1" />
                <button
                  type="button"
                  onClick={() => {
                    setShowMoreActions(false);
                    setTargetTableNumber(party.tableNumber === 12 ? 1 : party.tableNumber + 1);
                    setShowTransferModal(true);
                  }}
                  className="w-full text-left px-3 py-2 rounded-xl hover:bg-stone-50 font-bold text-stone-700 flex items-center gap-2"
                >
                  <ArrowRightLeft className="w-3.5 h-3.5 text-stone-500" />
                  <span>Move Table</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Error Alert */}
      {errorMessage && (
        <div className="bg-red-50 border border-red-300 text-red-800 p-3 rounded-2xl flex items-center gap-2 text-xs font-bold shadow-2xs">
          <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* 2. Active Kitchen Items Pill (Collapsible) */}
      {previouslyOrderedItems.length > 0 && (
        <div className="bg-emerald-50/80 border border-emerald-200 rounded-2xl p-2.5 sm:p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-black text-emerald-950">
                In Kitchen ({previouslyOrderedItems.length} items ordered)
              </span>
            </div>
            <button
              type="button"
              onClick={() => setShowActiveOrders(!showActiveOrders)}
              className="text-[11px] font-black text-emerald-800 hover:text-emerald-950 flex items-center gap-1 bg-white border border-emerald-200 px-2 py-0.5 rounded-lg shadow-2xs"
            >
              <span>{showActiveOrders ? "Hide" : "Show"}</span>
              {showActiveOrders ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
          </div>

          {showActiveOrders && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1 border-t border-emerald-200/60 text-xs">
              {previouslyOrderedItems.map((item, idx) => {
                const menuItem = store.menuItems.find((m) => m.id === item.menuItemId);
                return (
                  <div
                    key={idx}
                    className="p-2 rounded-xl bg-white border border-emerald-200 flex items-center justify-between gap-1.5"
                  >
                    <div className="min-w-0 flex-1">
                      <span className="font-bold text-stone-900 truncate block">
                        {item.quantity}× {item.menuItemName}
                      </span>
                      <span className="text-[10px] font-black uppercase text-emerald-700 bg-emerald-100 px-1.5 py-0.2 rounded">
                        {item.kotStatus}
                      </span>
                    </div>
                    {menuItem && (
                      <button
                        type="button"
                        onClick={() => handleAddToCart(menuItem, item.breadOption, item.variantName ? { name: item.variantName, price: item.unitPrice } : undefined)}
                        className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white font-black text-[10px] rounded-lg flex items-center gap-0.5 shadow-2xs active:scale-95 transition-all shrink-0"
                        title="Add this item again to current order"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Again</span>
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 3. Search Bar & Horizontal Category Pills */}
      <div className="space-y-2">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3.5 top-3 text-stone-400" />
          <input
            type="text"
            placeholder="Search dishes (उदा. चिकन थाळी, मटण, भाकरी, तांबडा रस्सा)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white border border-stone-200 rounded-2xl pl-10 pr-9 py-2.5 text-xs sm:text-sm text-stone-900 font-bold focus:outline-none focus:ring-2 focus:ring-red-500 shadow-2xs"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-2.5 text-stone-400 hover:text-stone-600 p-1"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Category Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
          <button
            type="button"
            onClick={() => setSelectedCategory("ALL")}
            className={`px-3.5 py-2 rounded-xl font-bold whitespace-nowrap transition-all touch-manipulation active:scale-95 ${
              selectedCategory === "ALL"
                ? "bg-red-600 text-white shadow-2xs font-black"
                : "bg-white text-stone-700 border border-stone-200 hover:bg-stone-50"
            }`}
          >
            All Dishes (सर्व)
          </button>
          {store.categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3.5 py-2 rounded-xl font-bold whitespace-nowrap transition-all touch-manipulation active:scale-95 ${
                selectedCategory === cat.id
                  ? "bg-red-600 text-white shadow-2xs font-black"
                  : "bg-white text-stone-700 border border-stone-200 hover:bg-stone-50"
              }`}
            >
              {cat.localName || cat.name}
            </button>
          ))}
        </div>
      </div>

      {/* 4. Streamlined Menu Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {filteredItems.map((item) => {
          const isOut = item.stockStatus === "OUT_OF_STOCK" || item.portionAvailability <= 0;
          const isLow = item.stockStatus === "LOW_STOCK" || item.portionAvailability <= 5;
          const inCartTotal = getCartQuantityForItem(item.id);
          const isThaliOrMain = isThaliOrMainCourseItem(item);

          return (
            <div
              key={item.id}
              className={`p-3 sm:p-3.5 rounded-2xl border transition-all flex flex-col justify-between ${
                inCartTotal > 0
                  ? "bg-red-50/30 border-red-300 ring-2 ring-red-200/50"
                  : isOut
                  ? "bg-stone-50/70 border-stone-200 opacity-60"
                  : "bg-white border-stone-200 hover:border-stone-300 shadow-2xs"
              }`}
            >
              <div>
                {/* Title & Price Row */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2 min-w-0">
                    <span
                      className={`w-3.5 h-3.5 border-2 rounded-xs flex items-center justify-center shrink-0 mt-0.5 ${
                        item.isVeg ? "border-emerald-600" : "border-red-700"
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${item.isVeg ? "bg-emerald-600" : "bg-red-700"}`} />
                    </span>
                    <div className="min-w-0">
                      <h3 className="font-black text-sm text-stone-900 leading-snug truncate">
                        {item.name}
                      </h3>
                      {item.localName && (
                        <span className="text-xs font-bold text-amber-800 block truncate">
                          {item.localName}
                        </span>
                      )}
                    </div>
                  </div>

                  <span className="font-mono font-black text-sm sm:text-base text-stone-900 shrink-0">
                    ₹{item.sellingPrice}
                  </span>
                </div>

                {/* Stock warning (Only if Low/Out) */}
                {(isOut || isLow) && (
                  <div className="mt-1.5">
                    <span
                      className={`text-[9px] font-black px-1.5 py-0.2 rounded-md ${
                        isOut ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-900"
                      }`}
                    >
                      {isOut ? "OUT OF STOCK" : `${item.portionAvailability} left`}
                    </span>
                  </div>
                )}

                {/* Instant 1-Tap Bread Selector for Thalis */}
                {isThaliOrMain && (
                  <div className="mt-2.5 pt-2 border-t border-stone-100">
                    <span className="text-[10px] font-black uppercase text-amber-900 block mb-1">
                      Choose Bread (भाकरी / चपाती पर्याय):
                    </span>
                    <div className="grid grid-cols-2 gap-1.5">
                      {BREAD_OPTIONS.map((bread) => {
                        const count = getCartQuantityForItem(item.id, bread.id);
                        return (
                          <button
                            key={bread.id}
                            type="button"
                            disabled={isOut}
                            onClick={() => handleAddToCart(item, bread.id)}
                            className={`min-h-[40px] px-2.5 py-2 rounded-xl text-xs font-bold flex items-center justify-between border transition-all active:scale-95 touch-manipulation ${
                              count > 0
                                ? "bg-amber-500 border-amber-600 text-stone-950 font-black shadow-2xs"
                                : "bg-stone-50 hover:bg-amber-50/60 border-stone-200 text-stone-800"
                            }`}
                          >
                            <span className="flex items-center gap-1.5 truncate text-[11px] sm:text-xs">
                              <span className="text-sm">{bread.emoji}</span>
                              <span className="truncate">{bread.localName}</span>
                            </span>
                            {count > 0 ? (
                              <span className="bg-stone-900 text-amber-300 font-mono text-[10px] px-1.5 py-0.5 rounded-full shrink-0">
                                ×{count}
                              </span>
                            ) : (
                              <Plus className="w-3.5 h-3.5 text-red-600 shrink-0" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Card Stepper for Non-Thalis / Standard Items */}
              {!isThaliOrMain && (
                <div className="flex items-center justify-between mt-3 pt-2 border-t border-stone-100">
                  <span className="text-[11px] font-bold text-stone-400">
                    {inCartTotal > 0 ? `${inCartTotal} in draft` : "Tap to add"}
                  </span>

                  {inCartTotal > 0 ? (
                    <div className="flex items-center gap-2 bg-red-50 border border-red-200 p-1 rounded-xl">
                      <button
                        type="button"
                        onClick={() => handleCardDecrement(item)}
                        className="w-8 h-8 rounded-lg bg-white border border-stone-300 text-stone-700 flex items-center justify-center font-black active:scale-90 touch-manipulation shadow-2xs"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="font-mono font-black text-sm text-red-700 px-1 min-w-5 text-center">
                        {inCartTotal}
                      </span>
                      <button
                        type="button"
                        disabled={isOut}
                        onClick={() => handleAddToCart(item)}
                        className="w-8 h-8 rounded-lg bg-red-600 text-white flex items-center justify-center font-black active:scale-90 touch-manipulation shadow-2xs"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      disabled={isOut}
                      onClick={() => handleAddToCart(item)}
                      className={`min-h-[38px] px-4 py-2 rounded-xl text-xs sm:text-sm font-black flex items-center gap-1.5 shadow-2xs active:scale-95 transition-all touch-manipulation ${
                        isOut
                          ? "bg-stone-200 text-stone-400 cursor-not-allowed"
                          : "bg-red-600 hover:bg-red-700 text-white"
                      }`}
                    >
                      <Plus className="w-3.5 h-3.5 text-amber-200" />
                      <span>Add</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 5. Floating Bottom Bar (Clear, Prominent, Lightning-Fast KOT) */}
      {totalCartCount > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-t border-stone-200 shadow-2xl p-3 sm:p-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] animate-in slide-in-from-bottom duration-200">
          <div className="max-w-5xl mx-auto flex items-center justify-between gap-3">
            {/* Cart Preview Button */}
            <button
              type="button"
              onClick={() => setIsCartSheetOpen(true)}
              className="flex items-center gap-2.5 text-left p-1 rounded-xl active:scale-95 transition-all min-w-0 touch-manipulation"
            >
              <div className="w-11 h-11 rounded-xl bg-red-600 text-white flex items-center justify-center font-mono font-black text-sm shrink-0 shadow-md">
                {totalCartCount}
              </div>
              <div className="min-w-0">
                <span className="text-xs sm:text-sm font-black text-stone-900 block leading-tight">
                  ₹{cartSubtotal}
                </span>
                <span className="text-[10px] text-stone-500 font-bold flex items-center gap-0.5">
                  <span>View Items</span>
                  <ChevronUp className="w-3 h-3" />
                </span>
              </div>
            </button>

            {/* Clear All */}
            <button
              type="button"
              onClick={() => { if (confirm("Clear all items from cart?")) setCart([]); }}
              className="text-[11px] font-bold text-stone-400 hover:text-red-500 transition-colors px-2 py-1.5 shrink-0 touch-manipulation"
            >
              Clear All
            </button>

            {/* Big 1-Tap Send KOT Button */}
            <button
              type="button"
              disabled={isSending}
              onClick={handleSendKot}
              className="flex-1 max-w-sm py-3.5 bg-gradient-to-r from-emerald-600 via-emerald-700 to-emerald-800 hover:from-emerald-500 hover:to-emerald-700 text-white font-black text-xs sm:text-sm rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-700/30 active:scale-95 transition-all touch-manipulation"
            >
              <Send className="w-4 h-4 text-emerald-200" />
              <span>{isSending ? "Sending..." : `KOT पाठवा (${totalCartCount}) →`}</span>
            </button>
          </div>
        </div>
      )}

      {/* 6. Expandable Cart Sheet Modal */}
      {isCartSheetOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-150">
          <div className="bg-white text-stone-900 rounded-t-3xl sm:rounded-3xl max-w-md w-full p-4 sm:p-5 shadow-2xl border border-stone-200 space-y-3.5 max-h-[85vh] flex flex-col animate-in slide-in-from-bottom duration-200">
            {/* Sheet Header */}
            <div className="flex items-center justify-between pb-2 border-b border-stone-100">
              <div className="flex items-center gap-2">
                <h3 className="font-black text-sm sm:text-base text-stone-900">
                  Order Summary ({totalCartCount} Items)
                </h3>
                <span className="text-xs font-mono font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                  ₹{cartSubtotal}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCart([])}
                  className="text-stone-400 hover:text-red-600 text-[11px] font-bold"
                >
                  Clear
                </button>
                <button
                  type="button"
                  onClick={() => setIsCartSheetOpen(false)}
                  className="text-stone-400 hover:text-stone-700 p-1"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Items List */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 no-scrollbar text-xs">
              {cart.map((c, idx) => (
                <div
                  key={idx}
                  className="p-2.5 rounded-xl bg-stone-50 border border-stone-200/80 flex items-center justify-between gap-2"
                >
                  <div className="min-w-0 flex-1">
                    <span className="font-black text-stone-900 block truncate text-xs">
                      {c.menuItem.name} {c.variantName ? `(${c.variantName})` : ""}
                    </span>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[11px] text-stone-500 font-mono">
                        ₹{c.unitPrice} × {c.quantity}
                      </span>
                      <span className="text-[11px] font-mono font-black text-stone-800">
                        = ₹{c.unitPrice * c.quantity}
                      </span>
                    </div>

                    {/* Bread Option Switcher in Cart */}
                    {c.breadOption && (
                      <div className="flex items-center gap-1 mt-1 flex-wrap">
                        <span className="text-[10px] font-black bg-amber-200 text-stone-950 px-1.5 py-0.2 rounded">
                          {BREAD_OPTION_LABELS[c.breadOption]?.mr || c.breadOption}
                        </span>
                        {BREAD_OPTIONS.filter((b) => b.id !== c.breadOption).map((b) => (
                          <button
                            key={b.id}
                            type="button"
                            onClick={() => handleChangeCartItemBread(idx, b.id)}
                            className="text-[9px] font-bold text-stone-600 bg-white border border-stone-200 px-1 py-0.2 rounded"
                          >
                            {b.shortCode}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Quantity Stepper + Trash */}
                  <div className="flex items-center gap-1 shrink-0">
                    <div className="flex items-center gap-1.5 bg-white border border-stone-200 px-2 py-1 rounded-xl">
                      <button
                        type="button"
                        onClick={() => handleUpdateCartQuantity(idx, -1)}
                        className="w-6 h-6 flex items-center justify-center rounded text-stone-600 font-bold active:scale-90"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="font-mono font-black text-xs px-1 min-w-4 text-center">
                        {c.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleUpdateCartQuantity(idx, 1)}
                        className="w-6 h-6 flex items-center justify-center rounded text-stone-600 font-bold active:scale-90"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const updated = [...cart];
                        updated.splice(idx, 1);
                        setCart(updated);
                      }}
                      className="w-6 h-6 flex items-center justify-center rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 active:scale-90 transition-all"
                      title="Remove item"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Send KOT Button inside sheet */}
            <div className="pt-2 border-t border-stone-100">
              <button
                type="button"
                disabled={isSending}
                onClick={handleSendKot}
                className="w-full py-3.5 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white font-black text-sm rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-700/25 active:scale-95 transition-all touch-manipulation"
              >
                <Send className="w-4 h-4 text-emerald-200" />
                <span>{isSending ? "Sending..." : `Send KOT to Kitchen (₹${cartSubtotal})`}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. Waiter Printer Settings Modal */}
      <WaiterPrinterSettingsModal
        isOpen={showPrinterModal}
        onClose={() => setShowPrinterModal(false)}
      />

      {/* 8. Manager Stock Override Modal */}
      {showOverrideModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-5 shadow-2xl border border-stone-200 text-stone-900 space-y-4">
            <div className="flex items-center gap-2 text-amber-600">
              <AlertTriangle className="w-5 h-5" />
              <h3 className="font-black text-sm">Manager Stock Override Required</h3>
            </div>
            <p className="text-xs text-stone-600">
              Selected portions exceed live recorded inventory. Enter Manager PIN (1234) to authorize sending KOT.
            </p>
            {overrideError && (
              <div className="p-2.5 bg-red-50 text-red-700 rounded-xl text-xs font-bold">
                {overrideError}
              </div>
            )}
            <form onSubmit={handleManagerOverrideSubmit} className="space-y-3">
              <input
                type="password"
                required
                placeholder="Enter Manager PIN (1234)"
                value={overridePin}
                onChange={(e) => setOverridePin(e.target.value)}
                className="w-full bg-stone-50 border border-stone-300 rounded-xl px-3 py-2 text-xs font-mono font-bold"
              />
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowOverrideModal(false)}
                  className="px-3 py-2 text-xs font-bold text-stone-500"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-black"
                >
                  Authorize & Send
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 9. Move Table Modal */}
      {showTransferModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-5 shadow-2xl border border-stone-200 text-stone-900 space-y-4">
            <h3 className="font-black text-sm text-stone-900">
              Move Party to Another Table
            </h3>
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-stone-500">Target Table</label>
              <select
                value={targetTableNumber}
                onChange={(e) => setTargetTableNumber(Number(e.target.value))}
                className="w-full bg-stone-50 border border-stone-200 rounded-xl p-2.5 text-xs font-bold"
              >
                {store.tables
                  .filter((t) => t.tableNumber !== party.tableNumber)
                  .map((t) => (
                    <option key={t.id} value={t.tableNumber}>
                      Table {t.tableNumber} — {t.status}
                    </option>
                  ))}
              </select>
            </div>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowTransferModal(false)}
                className="px-3 py-2 text-xs font-bold text-stone-500"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  try {
                    store.transferPartyToTable(party.id, targetTableNumber);
                    setShowTransferModal(false);
                    alert(`Moved to Table ${targetTableNumber}!`);
                    router.push("/waiter");
                  } catch (e: any) {
                    alert(e.message);
                  }
                }}
                className="px-4 py-2 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs font-black"
              >
                Confirm Move
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
