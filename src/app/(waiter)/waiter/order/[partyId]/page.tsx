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
  Flame,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Utensils,
  X,
  Bell,
  ArrowRightLeft,
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

interface CartItem {
  menuItem: MenuItem;
  variantName?: string;
  unitPrice: number;
  quantity: number;
  seatNumber?: number;
  spiceLevel: "MILD" | "MEDIUM" | "SPICY" | "THECHA_EXTRA_SPICY";
  breadOption?: BreadOption;
  notes?: string;
}

export default function WaiterOrderPage({
  params,
}: {
  params: Promise<{ partyId: string }>;
}) {
  const resolvedParams = use(params);
  const router = useRouter();
  const store = globalRestaurantStore;
  const [, setTick] = useState(0);

  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [cart, setCart] = useState<CartItem[]>([]);
  // 0 = Whole Table / Shared, 1..N = Specific Seat
  const [selectedSeat, setSelectedSeat] = useState<number>(0);
  const [selectedSpice, setSelectedSpice] = useState<CartItem["spiceLevel"]>("MEDIUM");
  const [selectedDefaultBread, setSelectedDefaultBread] = useState<BreadOption>("JWARI_BHAKRI");
  const [itemNotes, setItemNotes] = useState<string>("");
  const [isSending, setIsSending] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showExistingOrders, setShowExistingOrders] = useState<boolean>(false);

  // Manager Override Modal state
  const [showOverrideModal, setShowOverrideModal] = useState<boolean>(false);
  const [overridePin, setOverridePin] = useState<string>("");
  const [overrideReason, setOverrideReason] = useState<string>("Chef confirmed emergency unrecorded stock available");
  const [overrideError, setOverrideError] = useState<string | null>(null);

  // Transfer Table Modal state
  const [showTransferModal, setShowTransferModal] = useState<boolean>(false);
  const [targetTableNumber, setTargetTableNumber] = useState<number>(1);

  const party = store.parties.find((p) => p.id === resolvedParams.partyId);

  useEffect(() => {
    store.recalculateMenuAvailability();
    setTick((t) => t + 1);
  }, [resolvedParams.partyId]);

  if (!party) {
    return (
      <div className="p-8 text-center bg-white rounded-2xl border border-stone-200 shadow-xs max-w-md mx-auto">
        <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto mb-3" />
        <h2 className="text-lg font-bold text-stone-900">Party Session Not Found</h2>
        <p className="text-xs text-stone-500 mt-1">This party may have been settled or closed.</p>
        <Link
          href="/waiter"
          className="mt-4 inline-flex items-center gap-1 bg-red-600 text-white font-bold text-xs px-4 py-2 rounded-xl"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Floor
        </Link>
      </div>
    );
  }

  // Retrieve already ordered items for this party
  const partyOrders = store.orders.filter((o) => o.partyId === party.id);
  const previouslyOrderedItems = partyOrders.flatMap((o) => o.items);

  // Filter menu items
  const filteredItems = store.menuItems.filter((item) => {
    const matchesCategory = selectedCategory === "ALL" || item.categoryId === selectedCategory;
    const matchesSearch =
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.localName && item.localName.includes(searchQuery));
    return matchesCategory && matchesSearch;
  });

  const getCartQuantityForItem = (itemId: string, variantName?: string, breadOption?: BreadOption) => {
    return cart
      .filter(
        (c) =>
          c.menuItem.id === itemId &&
          (variantName === undefined || c.variantName === variantName) &&
          (breadOption === undefined || c.breadOption === breadOption)
      )
      .reduce((sum, c) => sum + c.quantity, 0);
  };

  const getPreviousQuantityForItem = (itemId: string) => {
    return previouslyOrderedItems
      .filter((i) => i.menuItemId === itemId && !i.isCancelled)
      .reduce((sum, i) => sum + i.quantity, 0);
  };

  const handleAddToCart = (
    item: MenuItem,
    variant?: { name: string; price: number },
    explicitBread?: BreadOption
  ) => {
    const isOut = item.stockStatus === "OUT_OF_STOCK" || item.portionAvailability <= 0;
    if (isOut) {
      const confirmAdd = confirm(
        `"${item.name}" has 0 portions remaining. Add to order anyway under Manager Override?`
      );
      if (!confirmAdd) return;
    }

    const currentInCart = cart
      .filter((c) => c.menuItem.id === item.id)
      .reduce((sum, c) => sum + c.quantity, 0);

    if (!isOut && currentInCart + 1 > item.portionAvailability) {
      const confirmAdd = confirm(
        `Only ${item.portionAvailability} portions available for ${item.name}. Add extra portion with Manager Override?`
      );
      if (!confirmAdd) return;
    }

    setErrorMessage(null);

    const targetSeatNumber = selectedSeat === 0 ? undefined : selectedSeat;
    const variantName = variant ? variant.name : undefined;
    const unitPrice = variant ? variant.price : item.sellingPrice;
    const needsBread = isThaliOrMainCourseItem(item);
    const breadOptionToUse: BreadOption | undefined = needsBread
      ? explicitBread || selectedDefaultBread || "JWARI_BHAKRI"
      : undefined;

    const existingIndex = cart.findIndex(
      (c) =>
        c.menuItem.id === item.id &&
        c.variantName === variantName &&
        c.seatNumber === targetSeatNumber &&
        c.spiceLevel === selectedSpice &&
        c.breadOption === breadOptionToUse
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
          seatNumber: targetSeatNumber,
          spiceLevel: selectedSpice,
          breadOption: breadOptionToUse,
          notes: itemNotes,
        },
      ]);
    }
    setItemNotes("");
  };

  const handleCardDecrement = (
    item: MenuItem,
    variantName?: string,
    explicitBread?: BreadOption
  ) => {
    const targetSeatNumber = selectedSeat === 0 ? undefined : selectedSeat;
    let targetIdx = -1;
    if (explicitBread) {
      targetIdx = cart.findIndex(
        (c) =>
          c.menuItem.id === item.id &&
          c.variantName === variantName &&
          c.seatNumber === targetSeatNumber &&
          c.breadOption === explicitBread
      );
    }
    if (targetIdx === -1) {
      targetIdx = cart.findIndex(
        (c) =>
          c.menuItem.id === item.id &&
          c.variantName === variantName &&
          c.seatNumber === targetSeatNumber
      );
    }
    if (targetIdx === -1) {
      targetIdx = cart
        .map((c, i) => ({ c, i }))
        .reverse()
        .find(
          ({ c }) =>
            c.menuItem.id === item.id &&
            (variantName === undefined || c.variantName === variantName) &&
            (explicitBread === undefined || c.breadOption === explicitBread)
        )?.i ?? -1;
    }
    if (targetIdx > -1) {
      handleUpdateQuantity(targetIdx, -1);
    }
  };

  const handleChangeCartItemBread = (index: number, newBread: BreadOption) => {
    const current = cart[index];
    if (!current) return;
    const existingIndex = cart.findIndex(
      (c, i) =>
        i !== index &&
        c.menuItem.id === current.menuItem.id &&
        c.variantName === current.variantName &&
        c.seatNumber === current.seatNumber &&
        c.spiceLevel === current.spiceLevel &&
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

  const handleUpdateQuantity = (index: number, delta: number) => {
    const target = cart[index];
    if (delta > 0) {
      const currentInCart = cart
        .filter((c) => c.menuItem.id === target.menuItem.id)
        .reduce((sum, c) => sum + c.quantity, 0);

      if (currentInCart + delta > target.menuItem.portionAvailability) {
        setErrorMessage(
          `Portion limit reached (${target.menuItem.portionAvailability} available). Sending KOT will require Manager PIN override.`
        );
      }
    }

    const updated = [...cart];
    updated[index].quantity += delta;
    if (updated[index].quantity <= 0) {
      updated.splice(index, 1);
    }
    setCart(updated);
  };

  const cartSubtotal = cart.reduce(
    (sum, it) => sum + (it.unitPrice ?? it.menuItem.sellingPrice) * it.quantity,
    0
  );

  const handleQuickAddByQuery = (keyword: string) => {
    const item = store.menuItems.find((m) =>
      m.id.toLowerCase().includes(keyword) ||
      m.name.toLowerCase().includes(keyword) ||
      (m.localName && m.localName.includes(keyword))
    );
    if (item) {
      if (item.variants && item.variants.length > 0) {
        handleAddToCart(item, item.variants[0]);
      } else {
        handleAddToCart(item);
      }
    }
  };

  const handleAppendNote = (noteText: string) => {
    setItemNotes((prev) => (prev.trim() ? `${prev.trim()}, ${noteText}` : noteText));
  };

  const handleSendKot = async () => {
    if (cart.length === 0) return;
    setIsSending(true);
    setErrorMessage(null);

    try {
      // 1. If offline, enqueue into outbox
      if (outboxManager.getStatus() === "OFFLINE") {
        await outboxManager.enqueueMutation(
          "SEND_KOT",
          {
            partyId: party.id,
            items: cart.map((c) => ({
              menuItemId: c.menuItem.id,
              quantity: c.quantity,
              seatNumber: c.seatNumber,
              spiceLevel: c.spiceLevel,
              breadOption: c.breadOption,
              notes: c.notes,
              variantName: c.variantName,
              unitPrice: c.unitPrice,
            })),
          },
          { partyCode: party.partyCode, tableNumber: party.tableNumber }
        );
      }

      // 2. Authoritative Atomic Order & KOT Generation
      const result = store.placeOrder(
        party.id,
        cart.map((c) => ({
          menuItemId: c.menuItem.id,
          quantity: c.quantity,
          seatNumber: c.seatNumber,
          spiceLevel: c.spiceLevel,
          breadOption: c.breadOption,
          notes: c.notes,
          variantName: c.variantName,
          unitPrice: c.unitPrice,
        })),
        false
      );

      // 3. Auto-print KOT ticket for kitchen
      if (store.printerSettings?.autoPrintKotOnOrder ?? true) {
        printKotTicket(result.kot, {
          paperWidth: store.printerSettings?.paperWidth || "80mm",
        });
      }

      // 4. Dispatch live notification to Kitchen
      store.addNotification({
        type: "KOT_NEW",
        title: `New KOT #${result.kot.kotNumber} (Table ${party.tableNumber})`,
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
          seatNumber: c.seatNumber,
          spiceLevel: c.spiceLevel,
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

      // Auto-print KOT ticket for kitchen
      if (store.printerSettings?.autoPrintKotOnOrder ?? true) {
        printKotTicket(result.kot, {
          paperWidth: store.printerSettings?.paperWidth || "80mm",
        });
      }

      setShowOverrideModal(false);
      setCart([]);
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
      setTick((t) => t + 1);
    } catch (err: any) {
      alert(`Could not print bill: ${err.message}`);
    }
  };

  const handlePrintLatestKot = () => {
    const partyKots = store.kots.filter((k) => k.partyId === party.id);
    if (partyKots.length === 0) {
      alert("No kitchen KOT has been generated for this party yet. Add items and tap 'SEND KOT TO KITCHEN' first.");
      return;
    }
    const latestKot = partyKots[partyKots.length - 1];
    printKotTicket(latestKot, {
      paperWidth: store.printerSettings?.paperWidth || "80mm",
      isReprint: true,
    });
  };

  const handleRequestBill = () => {
    try {
      store.parties = store.parties.map((p) =>
        p.id === party.id ? { ...p, status: "WAITING_FOR_BILL", lastActivityAt: new Date().toISOString() } : p
      );

      // Auto-generate and print interim Table Check / Pre-Bill
      const partyOrders = store.orders.filter((o) => o.partyId === party.id);
      const partyItems = partyOrders.flatMap((o) => o.items);
      if (partyItems.length > 0) {
        const subtotal = partyItems.reduce((s, i) => s + i.totalPrice, 0);
        const taxEstimate = Number((subtotal * 0.05).toFixed(2));
        const grandTotal = Math.round(subtotal + taxEstimate);
        printTableCheck({
          party,
          items: partyItems,
          subtotal,
          taxEstimate,
          grandTotal,
          cashierName: store.currentUser.name,
          paperWidth: store.printerSettings?.paperWidth || "80mm",
        });
      }

      store.addNotification({
        type: "BILL_REQUESTED",
        title: `Bill Requested for Table ${party.tableNumber}`,
        message: `Customer at Table ${party.tableNumber} (${party.partyCode}) requested the bill. Subtotal: ₹${party.runningSubtotal}.`,
        category: "BILLING",
        urgency: "HIGH",
        targetRoles: ["CASHIER", "MANAGER", "ADMIN"],
        actionUrl: "/billing",
        actionLabel: "Open Billing",
        metadata: { partyId: party.id, tableNumber: party.tableNumber, partyCode: party.partyCode },
      });

      setTick((t) => t + 1);
      alert(`Pre-bill table check sent to thermal printer & cashier notified!`);
    } catch (err: any) {
      alert(`Could not request bill: ${err.message}`);
    }
  };

  const handleTransferSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      store.transferPartyToTable(party.id, targetTableNumber);
      setShowTransferModal(false);
      setTick((t) => t + 1);
      alert(`Party successfully transferred to Table ${targetTableNumber}!`);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleCancelEmptyParty = () => {
    if (confirm(`Are you sure you want to cancel party ${party.partyCode} and vacate Table ${party.tableNumber}?`)) {
      try {
        store.voidOrCancelParty(party.id, "Cancelled by waiter on order screen");
        setTick((t) => t + 1);
        router.push("/waiter");
      } catch (err: any) {
        alert(err.message);
      }
    }
  };

  const quickPicks = [
    { label: "Chicken Thali", local: "चिकन थाळी", price: 320, emoji: "🍗", query: "chicken" },
    { label: "Mutton Thali", local: "मटण थाळी", price: 390, emoji: "🍖", query: "mutton" },
    { label: "Veg Thali", local: "व्हेज थाळी", price: 190, emoji: "🥗", query: "veg" },
    { label: "Jowar Bhakri", local: "भाकरी", price: 25, emoji: "🫓", query: "bhakri" },
    { label: "Solkadhi", local: "सोलकढी", price: 40, emoji: "🥛", query: "solkadhi" },
    { label: "Tambada Rassa", local: "तांबडा रस्सा", price: 50, emoji: "🍲", query: "tambada" },
  ];

  const quickNotesChips = [
    "कमी तिखट (Less Spicy)",
    "जास्त तांबडा रस्सा (Extra Rassa)",
    "गरमागरम कडक भाकरी (Crisp Bhakri)",
    "कांदा-लिंबू जादा (Extra Onion/Lemon)",
    "कोथिंबीर नको (No Coriander)",
    "ठेचा जादा (Extra Thecha)",
    "लवकर द्या (Urgent / First)",
  ];

  return (
    <div className="space-y-4 pb-36">
      {/* Luxury Hero Header */}
      <div className="luxury-card rounded-2xl p-4 sm:p-5 border border-[#E7E2DA] flex flex-wrap items-center justify-between gap-3 bg-gradient-to-r from-white via-[#FAF8F5] to-white">
        <div className="flex items-center gap-3.5">
          <Link
            href="/waiter"
            className="bg-white hover:bg-[#FAF8F5] p-2.5 rounded-xl text-stone-700 hover:text-stone-900 transition-colors border border-[#E7E2DA] shadow-2xs active:scale-95 flex items-center gap-1 text-xs font-bold"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">मजला</span>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <span className="bg-red-600 text-white font-black text-xs px-2 py-0.5 rounded-md shadow-2xs">
                {party.partyCode}
              </span>
              {party.isTakeaway && (
                <span className="bg-amber-500 text-stone-900 font-black text-[10px] px-2 py-0.5 rounded-md shadow-2xs flex items-center gap-1">
                  🥡 PARCEL (पार्सल)
                </span>
              )}
              <h1 className="font-black text-base sm:text-lg text-stone-900 tracking-tight">
                {party.isTakeaway ? `Parcel #${party.tableNumber}` : `Table ${party.tableNumber} Order`}
              </h1>
            </div>
            <span className="text-xs text-stone-500 font-medium">
              {party.isTakeaway ? (
                <>Customer: <strong className="text-stone-700">{party.customerName || "Takeaway Guest"}</strong> {party.customerPhone ? `(${party.customerPhone})` : ""}</>
              ) : (
                <>{party.guestCount} Guests • Waiter: <strong className="text-stone-700">{party.assignedWaiterName}</strong></>
              )}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={handlePrintLatestKot}
              title="Print / Reprint latest Kitchen Order Ticket"
              className="px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl text-xs font-black bg-stone-900 hover:bg-stone-800 text-amber-300 border border-stone-800 flex items-center gap-1.5 shadow-xs active:scale-95 transition-all touch-manipulation"
            >
              <Printer className="w-3.5 h-3.5 text-amber-400" />
              <span>Print KOT</span>
            </button>
            <button
              type="button"
              onClick={handlePrintFinalBill}
              title="Print final customer tax receipt"
              className="px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl text-xs font-black bg-emerald-700 hover:bg-emerald-800 text-white shadow-xs flex items-center gap-1.5 active:scale-95 transition-all touch-manipulation"
            >
              <Receipt className="w-3.5 h-3.5" />
              <span>Print Bill</span>
            </button>
            <button
              type="button"
              onClick={handleRequestBill}
              title="Request interim bill from cashier"
              className={`px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl text-xs font-black flex items-center gap-1.5 shadow-xs active:scale-95 transition-all touch-manipulation ${
                party.status === "WAITING_FOR_BILL"
                  ? "bg-amber-500 hover:bg-amber-600 text-stone-950 ring-2 ring-amber-400 animate-pulse"
                  : "bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300"
              }`}
            >
              <Bell className="w-3.5 h-3.5" />
              <span>{party.status === "WAITING_FOR_BILL" ? "Bill Requested 🔥" : "Request Bill"}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setTargetTableNumber(party.tableNumber === 12 ? 1 : party.tableNumber + 1);
                setShowTransferModal(true);
              }}
              title="Transfer party to another physical table"
              className="px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl text-xs font-bold bg-[#FAF8F5] hover:bg-stone-100 text-stone-700 border border-[#E7E2DA] flex items-center gap-1 shadow-2xs active:scale-95 transition-all touch-manipulation"
            >
              <ArrowRightLeft className="w-3.5 h-3.5 text-stone-500" />
              <span>Move Table</span>
            </button>
            {party.runningSubtotal === 0 && cart.length === 0 && (
              <button
                type="button"
                onClick={handleCancelEmptyParty}
                title="Cancel party session and vacate table"
                className="px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl text-xs font-bold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 flex items-center gap-1 active:scale-95 transition-all touch-manipulation"
              >
                <X className="w-3.5 h-3.5 text-rose-600" />
                <span>Cancel Party</span>
              </button>
            )}
          </div>

          <div className="text-right border-l border-stone-200 pl-3">
            <span className="text-[10px] text-stone-400 block uppercase font-black tracking-wider">Party Running Subtotal</span>
            <span className="font-black text-lg text-stone-900 font-mono">₹{party.runningSubtotal}</span>
          </div>
        </div>
      </div>

      {/* Error Banner */}
      {errorMessage && (
        <div className="bg-red-50 border border-red-300 text-red-800 p-3.5 rounded-xl flex items-center gap-2 text-xs font-bold animate-pulse shadow-2xs">
          <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Already Ordered / Active Kitchen Orders Section */}
      {previouslyOrderedItems.length > 0 && (
        <div className="luxury-card rounded-2xl border border-emerald-300/80 bg-emerald-50/30 p-3.5 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="font-black text-stone-900 text-xs sm:text-sm">
                Already in Kitchen (आधी दिलेल्या ऑर्डर्स)
              </span>
              <span className="text-xs font-bold text-emerald-900 bg-emerald-100 px-2 py-0.5 rounded-md">
                {previouslyOrderedItems.length} items • ₹{party.runningSubtotal}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setShowExistingOrders(!showExistingOrders)}
              className="text-xs font-black text-emerald-800 hover:text-emerald-950 flex items-center gap-1 bg-white border border-emerald-200 px-2.5 py-1 rounded-lg shadow-2xs"
            >
              <span>{showExistingOrders ? "Hide Active List" : "Show Active List"}</span>
              {showExistingOrders ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>

          {showExistingOrders && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 pt-2 border-t border-emerald-200/60 text-xs">
              {previouslyOrderedItems.map((item, idx) => (
                <div
                  key={idx}
                  className="p-2.5 rounded-xl bg-white border border-emerald-200 flex items-center justify-between shadow-2xs"
                >
                  <div>
                    <span className="font-black text-stone-900 block">
                      {item.quantity}x {item.menuItemName}
                    </span>
                    <span className="text-[10px] text-stone-500 font-bold">
                      {item.seatNumber ? `Seat ${item.seatNumber}` : "Whole Table"} {item.spiceLevel ? `• ${item.spiceLevel}` : ""}
                    </span>
                  </div>
                  <span
                    className={`text-[9px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider ${
                      item.kotStatus === "SERVED"
                        ? "bg-emerald-100 text-emerald-900"
                        : item.kotStatus === "READY"
                        ? "bg-amber-100 text-amber-900"
                        : "bg-purple-100 text-purple-900"
                    }`}
                  >
                    {item.kotStatus}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ⚡ 1-Tap Fast Thalis & Khanawal Picks */}
      <div className="luxury-card p-3 rounded-2xl border border-amber-300/80 bg-gradient-to-r from-amber-50/50 via-white to-amber-50/30 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] uppercase font-black tracking-wider text-amber-900 flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-amber-600" />
            <span>1-Tap Fast Picks (जलद ऑर्डर — स्पेशल थाळ्या व रस्सा)</span>
          </span>
          <span className="text-[10px] text-stone-400 font-bold">Tap to add +1</span>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar text-xs">
          {quickPicks.map((pick) => (
            <button
              key={pick.query}
              type="button"
              onClick={() => handleQuickAddByQuery(pick.query)}
              className="flex items-center gap-2 bg-white hover:bg-amber-50 border border-[#E7E2DA] hover:border-amber-400 px-3 py-2 rounded-xl text-stone-900 shadow-2xs active:scale-95 transition-all shrink-0 touch-manipulation"
            >
              <span className="text-base leading-none">{pick.emoji}</span>
              <div className="text-left">
                <span className="font-black text-xs block leading-tight">{pick.label}</span>
                <span className="text-[10px] font-bold text-amber-800">₹{pick.price}</span>
              </div>
              <Plus className="w-3.5 h-3.5 text-red-600 ml-0.5" />
            </button>
          ))}
        </div>
      </div>

      {/* Modifier Bar: Target Seat, Spice Level, Notes */}
      <div className="luxury-card p-4 rounded-2xl border border-[#E7E2DA] space-y-3 text-xs bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Target Seat Selector (0 = Whole Table) */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-black text-stone-700 uppercase tracking-wider text-[10px]">Target Seat:</span>
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={() => setSelectedSeat(0)}
                className={`px-3 py-1.5 rounded-xl font-black text-xs transition-all touch-manipulation ${
                  selectedSeat === 0
                    ? "bg-red-700 text-white shadow-2xs"
                    : "bg-[#FAF8F5] text-stone-700 border border-[#E7E2DA] hover:bg-stone-100"
                }`}
              >
                🍽️ Whole Table (सर्व टेबल)
              </button>
              {Array.from({ length: party.guestCount }, (_, i) => i + 1).map((seat) => (
                <button
                  key={seat}
                  type="button"
                  onClick={() => setSelectedSeat(seat)}
                  className={`px-3 py-1.5 rounded-xl font-black text-xs transition-all touch-manipulation ${
                    selectedSeat === seat
                      ? "bg-stone-900 text-amber-200 shadow-2xs"
                      : "bg-[#FAF8F5] text-stone-700 border border-[#E7E2DA] hover:bg-stone-100"
                  }`}
                >
                  Seat {seat}
                </button>
              ))}
            </div>
          </div>

          {/* Spice Level Selector */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-black text-stone-700 uppercase tracking-wider text-[10px]">Spice Level:</span>
            <div className="flex items-center gap-1.5">
              {[
                { code: "MILD", label: "Mild" },
                { code: "MEDIUM", label: "Medium" },
                { code: "SPICY", label: "Kolhapuri 🌶️" },
                { code: "THECHA_EXTRA_SPICY", label: "Thecha 🔥" },
              ].map((sp) => (
                <button
                  key={sp.code}
                  type="button"
                  onClick={() => setSelectedSpice(sp.code as any)}
                  className={`px-3 py-1.5 rounded-xl font-black text-xs transition-all touch-manipulation ${
                    selectedSpice === sp.code
                      ? "bg-gradient-to-r from-amber-600 to-amber-700 text-white shadow-2xs"
                      : "bg-[#FAF8F5] text-stone-700 border border-[#E7E2DA] hover:bg-stone-100"
                  }`}
                >
                  {sp.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Bread Choice for Thalis & Main Courses */}
        <div className="pt-2 border-t border-[#E7E2DA]/80 flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-black text-amber-950 uppercase tracking-wider text-[10px] flex items-center gap-1 bg-amber-100/90 px-2 py-0.5 rounded-md border border-amber-300">
              <span>🌾</span>
              <span>भाकरी / चपाती पर्याय (Default Bread):</span>
            </span>
            <div className="flex items-center gap-1.5 flex-wrap">
              {BREAD_OPTIONS.map((bread) => (
                <button
                  key={bread.id}
                  type="button"
                  onClick={() => setSelectedDefaultBread(bread.id)}
                  className={`px-3 py-1.5 rounded-xl font-black text-xs transition-all touch-manipulation flex items-center gap-1.5 shadow-2xs ${
                    selectedDefaultBread === bread.id
                      ? "bg-gradient-to-r from-amber-500 to-amber-600 text-stone-950 font-extrabold ring-2 ring-amber-400 shadow-amber-500/20"
                      : "bg-[#FAF8F5] text-stone-700 border border-[#E7E2DA] hover:bg-stone-100 hover:border-amber-300"
                  }`}
                  title={`${bread.name} — ${bread.localName}`}
                >
                  <span className="text-sm">{bread.emoji}</span>
                  <span>{bread.localName}</span>
                  <span className="text-[10px] opacity-75 font-normal">({bread.name})</span>
                </button>
              ))}
            </div>
          </div>
          <span className="text-[10px] text-stone-400 italic hidden lg:inline font-medium">
            (थाळी व मेन कोर्ससाठी थेट 1-टॅप पर्याय)
          </span>
        </div>

        {/* Special Instructions Input + Quick Chips */}
        <div className="space-y-2 pt-2 border-t border-[#E7E2DA]/80">
          <div className="flex items-center gap-2">
            <span className="font-black text-stone-700 uppercase tracking-wider text-[10px] shrink-0">
              Special Notes:
            </span>
            <input
              type="text"
              placeholder="e.g. Less spicy, Extra rassa, Well cooked bhakri, No coriander..."
              value={itemNotes}
              onChange={(e) => setItemNotes(e.target.value)}
              className="flex-1 bg-[#FAF8F5] border border-[#E7E2DA] rounded-xl px-3 py-1.5 text-xs text-stone-900 font-semibold focus:outline-none focus:ring-2 focus:ring-red-500"
            />
            {itemNotes && (
              <button
                type="button"
                onClick={() => setItemNotes("")}
                className="text-stone-400 hover:text-stone-700 p-1 rounded"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Quick Note Suggestion Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-[11px]">
            <span className="text-[10px] font-bold text-stone-400 shrink-0">1-Tap:</span>
            {quickNotesChips.map((chip) => (
              <button
                key={chip}
                type="button"
                onClick={() => handleAppendNote(chip)}
                className="px-2.5 py-1 rounded-lg bg-[#FAF8F5] hover:bg-amber-100/70 text-stone-700 border border-[#E7E2DA] font-semibold whitespace-nowrap active:scale-95 transition-all touch-manipulation"
              >
                + {chip}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Search Bar & Category Pills */}
      <div className="space-y-2">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-3 text-stone-400" />
          <input
            type="text"
            placeholder="Search menu in English or Marathi (उदा. चिकन, मटण, भाकरी, सोलकढी)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white border border-stone-200 rounded-xl pl-9 pr-3 py-2 text-xs sm:text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-red-500 shadow-xs"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
          <button
            type="button"
            onClick={() => setSelectedCategory("ALL")}
            className={`px-3.5 py-2 rounded-xl font-bold whitespace-nowrap transition-all touch-manipulation active:scale-95 ${
              selectedCategory === "ALL"
                ? "bg-red-600 text-white shadow-2xs font-black"
                : "bg-white text-stone-700 border border-stone-200 hover:bg-stone-100"
            }`}
          >
            All Items (सर्व पदार्थ)
          </button>
          {store.categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3.5 py-2 rounded-xl font-bold whitespace-nowrap transition-all touch-manipulation active:scale-95 ${
                selectedCategory === cat.id
                  ? "bg-red-600 text-white shadow-2xs font-black"
                  : "bg-white text-stone-700 border border-stone-200 hover:bg-stone-100"
              }`}
            >
              {cat.name} {cat.localName ? `(${cat.localName})` : ""}
            </button>
          ))}
        </div>
      </div>

      {/* Menu Item Cards Grid with Inline Steppers */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {filteredItems.map((item) => {
          const isOut = item.stockStatus === "OUT_OF_STOCK" || item.portionAvailability <= 0;
          const isLow = item.stockStatus === "LOW_STOCK" || item.portionAvailability <= 5;
          const inCartCount = getCartQuantityForItem(item.id);
          const previousKitchenCount = getPreviousQuantityForItem(item.id);
          const isThaliOrMain = isThaliOrMainCourseItem(item);

          return (
            <div
              key={item.id}
              className={`premium-card p-4 flex flex-col justify-between transition-all rounded-2xl ${
                inCartCount > 0
                  ? "border-red-400 bg-red-50/20 ring-2 ring-red-200/50"
                  : isOut
                  ? "opacity-60 bg-[#FAF8F5] border-[#E7E2DA]"
                  : "border-[#E7E2DA] hover:border-amber-400/80 bg-white"
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2">
                    <span
                      className={`w-3.5 h-3.5 border-2 rounded-xs flex items-center justify-center shrink-0 mt-1 ${
                        item.isVeg ? "border-emerald-600" : "border-red-700"
                      }`}
                      title={item.isVeg ? "Vegetarian" : "Non-Vegetarian"}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${item.isVeg ? "bg-emerald-600" : "bg-red-700"}`} />
                    </span>
                    <div>
                      <h3 className="font-black text-sm text-stone-900 leading-snug">
                        {item.name}
                      </h3>
                      {item.localName && (
                        <span className="text-xs font-bold text-amber-800 block mt-0.5">
                          {item.localName}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    {item.variants && item.variants.length > 0 ? (
                      <div className="flex flex-col items-end">
                        <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Variants</span>
                        <div className="flex items-center gap-1 font-mono font-black text-xs text-stone-900">
                          {item.variants.map((v, i) => (
                            <span key={v.name}>
                              {v.name[0]}: ₹{v.price}{i < (item.variants?.length ?? 0) - 1 ? " /" : ""}
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <span className="font-mono font-black text-base text-stone-900 shrink-0">
                        ₹{item.sellingPrice}
                      </span>
                    )}
                  </div>
                </div>

                {/* Badges strip: previous in kitchen, stock */}
                <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                  {previousKitchenCount > 0 && (
                    <span className="text-[10px] font-black text-emerald-800 bg-emerald-50 border border-emerald-300 px-2 py-0.5 rounded-md flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      <span>{previousKitchenCount} in Kitchen</span>
                    </span>
                  )}
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      isOut
                        ? "bg-red-100 text-red-700"
                        : isLow
                        ? "bg-amber-100 text-amber-900"
                        : "bg-emerald-50 text-emerald-800 border border-emerald-200"
                    }`}
                  >
                    {isOut ? "OUT OF STOCK" : `${item.portionAvailability} available`}
                  </span>
                </div>

                {item.description && (
                  <p className="text-[11px] text-stone-500 mt-2 line-clamp-2 leading-relaxed font-medium">
                    {item.description}
                  </p>
                )}

                {/* Instant 1-Tap Bread Selector for Thalis & Main Courses */}
                {isThaliOrMain && (
                  <div className="mt-3 p-2 rounded-xl bg-gradient-to-r from-amber-50/80 via-white to-amber-50/60 border border-amber-300/80 space-y-1.5 shadow-2xs">
                    <div className="flex items-center justify-between text-[10px] font-black text-amber-950 uppercase tracking-wider">
                      <span className="flex items-center gap-1">
                        <span>🌾 1-Tap भाकरी / चपाती:</span>
                      </span>
                      <span className="text-[9px] text-amber-850 font-bold bg-amber-100 px-1.5 py-0.2 rounded">
                        थेट निवडा
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-1 text-xs">
                      {BREAD_OPTIONS.map((bread) => {
                        const breadCount = getCartQuantityForItem(item.id, undefined, bread.id);
                        return (
                          <button
                            key={bread.id}
                            type="button"
                            disabled={isOut}
                            onClick={() => handleAddToCart(item, undefined, bread.id)}
                            className={`px-2 py-1.5 rounded-lg text-xs font-bold flex items-center justify-between transition-all touch-manipulation active:scale-95 ${
                              breadCount > 0
                                ? "bg-amber-500 text-stone-950 font-black ring-2 ring-amber-400 shadow-xs"
                                : "bg-white text-stone-800 border border-stone-200 hover:border-amber-400 hover:bg-amber-50/70"
                            }`}
                            title={`Add 1 portion with ${bread.name} (${bread.localName})`}
                          >
                            <span className="flex items-center gap-1 truncate">
                              <span className="text-xs leading-none">{bread.emoji}</span>
                              <span className="text-[11px] font-extrabold truncate">{bread.localName}</span>
                            </span>
                            {breadCount > 0 ? (
                              <span className="bg-stone-900 text-amber-300 font-black text-[10px] px-1.5 py-0.2 rounded-full font-mono shrink-0 ml-1">
                                ×{breadCount}
                              </span>
                            ) : (
                              <Plus className="w-3 h-3 text-red-600 shrink-0 ml-1" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Bottom Stepper / Add Button */}
              {item.variants && item.variants.length > 0 ? (
                <div className="mt-3.5 pt-2.5 border-t border-stone-100 space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] font-bold text-stone-400">
                    <span>Portions ({item.variants.length}):</span>
                    {inCartCount > 0 && <span className="text-red-700 font-black">{inCartCount} in draft</span>}
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {item.variants.map((v) => {
                      const vCount = getCartQuantityForItem(item.id, v.name);
                      return (
                        <div
                          key={v.name}
                          className="flex items-center justify-between bg-[#FAF8F5] border border-[#E7E2DA] rounded-xl p-1.5 shadow-2xs"
                        >
                          <div className="flex flex-col pl-1">
                            <span className="font-bold text-stone-800 text-[11px] leading-tight">{v.name}</span>
                            <span className="font-black text-stone-900 text-xs font-mono">₹{v.price}</span>
                          </div>
                          {vCount > 0 ? (
                            <div className="flex items-center gap-1 bg-white border border-red-200 rounded-lg p-0.5 shadow-2xs">
                              <button
                                type="button"
                                onClick={() => handleCardDecrement(item, v.name)}
                                className="w-6 h-6 rounded bg-stone-100 text-stone-700 hover:text-stone-950 flex items-center justify-center font-black active:scale-90 touch-manipulation"
                                aria-label={`Decrease ${v.name}`}
                              >
                                <Minus className="w-3 h-3" />
                              </button>
                              <span className="font-black text-red-700 text-xs px-1 font-mono min-w-4 text-center">
                                {vCount}
                              </span>
                              <button
                                type="button"
                                disabled={isOut}
                                onClick={() => handleAddToCart(item, v)}
                                className="w-6 h-6 rounded bg-red-600 text-white hover:bg-red-700 flex items-center justify-center font-black active:scale-90 touch-manipulation"
                                aria-label={`Increase ${v.name}`}
                              >
                                <Plus className="w-3 h-3" />
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              disabled={isOut}
                              onClick={() => handleAddToCart(item, v)}
                              className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-black flex items-center gap-1 active:scale-95 transition-all touch-manipulation shadow-2xs"
                            >
                              <Plus className="w-3 h-3 text-amber-200" />
                              <span>Add</span>
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between mt-3.5 pt-2.5 border-t border-stone-100">
                  <span className="text-[11px] font-bold text-stone-400">
                    {inCartCount > 0 ? (
                      <span className="text-red-700 font-black">{inCartCount} in draft</span>
                    ) : (
                      <span>Tap to order</span>
                    )}
                  </span>

                  {inCartCount > 0 ? (
                    <div className="flex items-center gap-1 bg-red-50 border border-red-200 p-1 rounded-xl shadow-2xs">
                      <button
                        type="button"
                        onClick={() => handleCardDecrement(item)}
                        className="w-8 h-8 rounded-lg bg-white border border-stone-300 text-stone-700 hover:text-stone-950 flex items-center justify-center font-black active:scale-90 transition-all touch-manipulation"
                        aria-label="Decrease quantity"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="font-black text-red-700 text-sm px-2 min-w-5 text-center font-mono">
                        {inCartCount}
                      </span>
                      <button
                        type="button"
                        disabled={isOut}
                        onClick={() => handleAddToCart(item)}
                        className="w-8 h-8 rounded-lg bg-red-600 text-white hover:bg-red-700 flex items-center justify-center font-black active:scale-90 transition-all touch-manipulation"
                        aria-label="Increase quantity"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      disabled={isOut}
                      onClick={() => handleAddToCart(item)}
                      className={`min-h-[38px] px-4 py-2 flex items-center justify-center gap-1.5 font-black text-xs rounded-xl shadow-2xs active:scale-95 transition-all touch-manipulation ${
                        isOut
                          ? "bg-stone-200 text-stone-400 cursor-not-allowed"
                          : "bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white shadow-red-700/20"
                      }`}
                    >
                      <Plus className="w-4 h-4 text-amber-200" />
                      <span>Add</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Floating Bottom Cart & 1-Tap KOT Send Drawer */}
      {cart.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-50 glass-bottom-bar bg-white/95 backdrop-blur-lg text-stone-900 border-t border-[#E7E2DA] shadow-[0_-8px_30px_rgba(28,25,23,0.15)] p-3 sm:p-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] animate-in slide-in-from-bottom duration-200">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-3">
            {/* Cart Items List */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 max-w-full md:max-w-2xl no-scrollbar text-xs">
              <button
                type="button"
                onClick={() => setCart([])}
                className="text-stone-400 hover:text-red-600 text-[11px] font-bold flex items-center gap-1 p-1.5 rounded-lg border border-stone-200 hover:border-red-300 shrink-0 bg-white"
                title="Discard all draft items"
              >
                <Trash2 className="w-3.5 h-3.5 text-red-600" />
                <span>Clear</span>
              </button>

              {cart.map((c, idx) => (
                <div
                  key={idx}
                  className="bg-[#FAF8F5] border border-[#E7E2DA] rounded-xl px-3 py-2 flex items-center gap-2.5 shrink-0 shadow-2xs"
                >
                  <div>
                    <span className="font-black text-stone-900 block leading-tight text-xs">
                      {c.menuItem.name} {c.variantName ? `(${c.variantName})` : ""}
                    </span>
                    <span className="text-[10px] text-stone-500 font-bold block">
                      {c.seatNumber ? `Seat ${c.seatNumber}` : "Table"} • ₹{c.unitPrice} {c.spiceLevel ? `• ${c.spiceLevel}` : ""}
                    </span>
                    {c.breadOption && (
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        <span className="text-[10px] font-black bg-amber-200 text-stone-950 px-1.5 py-0.5 rounded border border-amber-400 flex items-center gap-1 shadow-2xs">
                          <span>🍞</span>
                          <span>{BREAD_OPTION_LABELS[c.breadOption]?.mr || c.breadOption}</span>
                        </span>
                        <div className="flex items-center gap-0.5">
                          {BREAD_OPTIONS.filter((b) => b.id !== c.breadOption).map((b) => (
                            <button
                              key={b.id}
                              type="button"
                              onClick={() => handleChangeCartItemBread(idx, b.id)}
                              className="text-[9px] font-bold text-stone-600 hover:text-stone-950 bg-white border border-stone-200 hover:border-amber-400 px-1.5 py-0.5 rounded shadow-2xs transition-all active:scale-90"
                              title={`Switch to ${b.name}`}
                            >
                              {b.shortCode}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 ml-2 bg-white border border-[#E7E2DA] px-2 py-1 rounded-lg shadow-2xs">
                    <button
                      type="button"
                      onClick={() => handleUpdateQuantity(idx, -1)}
                      className="text-stone-500 hover:text-stone-900 w-6 h-6 flex items-center justify-center rounded active:bg-stone-100 touch-manipulation"
                      aria-label="Decrease quantity"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="font-black text-stone-900 text-xs px-1">{c.quantity}</span>
                    <button
                      type="button"
                      onClick={() => handleUpdateQuantity(idx, 1)}
                      className="text-stone-500 hover:text-stone-900 w-6 h-6 flex items-center justify-center rounded active:bg-stone-100 touch-manipulation"
                      aria-label="Increase quantity"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Subtotal & 1-Tap Send Button */}
            <div className="flex items-center justify-between md:justify-end gap-4 shrink-0 pt-1 md:pt-0 border-t md:border-t-0 border-stone-200/60">
              <div className="text-left md:text-right">
                <span className="text-[10px] text-stone-400 block uppercase font-black tracking-wider">
                  New Draft KOT ({cart.reduce((s, c) => s + c.quantity, 0)} items)
                </span>
                <span className="text-base sm:text-lg font-black text-stone-900 font-mono">₹{cartSubtotal}</span>
              </div>

              <button
                type="button"
                disabled={isSending}
                onClick={handleSendKot}
                className="flex items-center gap-2 bg-gradient-to-r from-red-600 via-red-700 to-red-800 hover:from-red-700 hover:to-red-900 text-white font-black text-xs sm:text-sm px-6 py-3 rounded-xl shadow-md shadow-red-700/25 active:scale-95 transition-all touch-manipulation"
              >
                <Send className="w-4 h-4 text-amber-200" />
                <span>{isSending ? "Sending to Kitchen..." : "SEND KOT TO KITCHEN →"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: MANAGER PIN OVERRIDE FOR NEGATIVE STOCK */}
      {showOverrideModal && (
        <div className="fixed inset-0 z-50 bg-stone-900/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-stone-200 overflow-hidden text-xs">
            <div className="bg-red-50 border-b border-red-200 text-red-900 p-4 flex items-center justify-between">
              <div className="flex items-center gap-2 font-black text-sm sm:text-base">
                <AlertTriangle className="w-5 h-5 text-red-600" />
                <span>Stock Limit Reached — Manager Override</span>
              </div>
              <button
                type="button"
                onClick={() => setShowOverrideModal(false)}
                className="text-stone-400 hover:text-stone-700 p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleManagerOverrideSubmit} className="p-5 space-y-4">
              <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl text-stone-700 space-y-1">
                <p className="font-bold text-amber-900">Negative Stock Protection Notice:</p>
                <p className="text-[11px] leading-relaxed">
                  One or more items in this order exceed current theoretical kitchen availability. An authorized Manager PIN (`1234`) or Owner role is required to authorize kitchen preparation. An immutable audit record will be logged.
                </p>
              </div>

              {overrideError && (
                <div className="bg-red-100 text-red-800 font-bold p-2.5 rounded-lg border border-red-300 text-xs">
                  {overrideError}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  Manager Authorization PIN *
                </label>
                <input
                  type="password"
                  required
                  placeholder="Enter 4-digit PIN (default: 1234)"
                  value={overridePin}
                  onChange={(e) => setOverridePin(e.target.value)}
                  className="w-full bg-stone-50 border border-stone-300 rounded-xl px-3 py-2.5 text-base font-black text-stone-900 tracking-widest text-center focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  Override Justification / Reason *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Fresh stock delivered, unrecorded batch available"
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  className="w-full bg-stone-50 border border-stone-300 rounded-xl px-3 py-2 text-xs text-stone-900 font-medium focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setShowOverrideModal(false)}
                  className="px-4 py-2 text-xs font-bold text-stone-600 hover:bg-stone-100 rounded-xl"
                >
                  Cancel Order
                </button>
                <button
                  type="submit"
                  disabled={isSending}
                  className="px-5 py-2.5 text-xs font-black bg-red-600 hover:bg-red-700 text-white rounded-xl shadow-xs active:scale-95 transition-all"
                >
                  {isSending ? "Authorizing..." : "Authorize & Send KOT"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: TRANSFER PARTY TO ANOTHER TABLE */}
      {showTransferModal && (
        <div className="fixed inset-0 z-50 bg-stone-900/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl border border-stone-200 overflow-hidden text-xs">
            <div className="bg-[#FAF8F5] border-b border-[#E7E2DA] p-4 flex items-center justify-between">
              <div className="flex items-center gap-2 font-black text-sm text-stone-900">
                <ArrowRightLeft className="w-4 h-4 text-amber-600" />
                <span>Move Table (Table {party.tableNumber} → Target)</span>
              </div>
              <button
                type="button"
                onClick={() => setShowTransferModal(false)}
                className="text-stone-400 hover:text-stone-700 p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleTransferSubmit} className="p-4 space-y-4">
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  Select Destination Physical Table:
                </label>
                <select
                  value={targetTableNumber}
                  onChange={(e) => setTargetTableNumber(Number(e.target.value))}
                  className="w-full bg-stone-50 border border-stone-300 rounded-xl px-3 py-2 text-xs font-semibold text-stone-900 focus:outline-none focus:ring-2 focus:ring-red-500"
                >
                  {store.tables
                    .filter((t) => t.tableNumber !== party.tableNumber)
                    .map((t) => (
                      <option key={t.id} value={t.tableNumber}>
                        {t.name} ({t.status}, {t.activePartiesCount} active parties)
                      </option>
                    ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setShowTransferModal(false)}
                  className="px-4 py-2 text-xs font-bold text-stone-600 hover:bg-stone-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-black bg-red-600 hover:bg-red-700 text-white rounded-xl shadow-xs active:scale-95 transition-all"
                >
                  Confirm Table Move
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
