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
  Sliders,
  Banknote,
  CreditCard,
  ShoppingBag,
  Edit3,
  User,
  Phone,
} from "lucide-react";
import { globalRestaurantStore } from "@/lib/store/restaurant-store";
import {
  MenuItem,
  BreadOption,
  BREAD_OPTIONS,
  BREAD_OPTION_LABELS,
  DEFAULT_BREAD_PORTIONS,
  formatBreadNotes,
  isThaliOrMainCourseItem,
} from "@/types/orders";
import { outboxManager } from "@/lib/offline/outbox";
import { printKotTicket, printBillReceipt, printTableCheck } from "@/lib/printing/thermal-printer";
import { WaiterPrinterSettingsModal } from "@/components/waiter/WaiterPrinterSettingsModal";
import { triggerHaptic } from "@/lib/mobile/haptics";
import { useAndroidBackButton } from "@/lib/mobile/useAndroidBackButton";

interface CartItem {
  menuItem: MenuItem;
  variantName?: string;
  unitPrice: number;
  quantity: number;
  breadOption?: BreadOption;
  breadCounts?: Partial<Record<BreadOption, number>>;
  notes?: string;
  customNote?: string;
  spiceLevel?: "MILD" | "MEDIUM" | "SPICY" | "THECHA_EXTRA_SPICY";
}

function buildItemNotes(
  breadCounts?: Partial<Record<BreadOption, number>>,
  customNote?: string,
  spiceLevel?: string
): string {
  const parts: string[] = [];
  if (breadCounts && Object.keys(breadCounts).length > 0) {
    parts.push(formatBreadNotes(breadCounts));
  }
  if (spiceLevel && spiceLevel !== "MEDIUM") {
    const spiceMrMap: Record<string, string> = {
      MILD: "कमी तिखट",
      SPICY: "तिखट",
      THECHA_EXTRA_SPICY: "ठेचा झणझणीत",
    };
    parts.push(spiceMrMap[spiceLevel] || spiceLevel);
  }
  if (customNote && customNote.trim()) {
    parts.push(customNote.trim());
  }
  return parts.join(" | ");
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

  // Customer Info Edit Modal state (for parcel & table diners)
  const [showCustomerModal, setShowCustomerModal] = useState<boolean>(false);
  const [custName, setCustName] = useState<string>("");
  const [custPhone, setCustPhone] = useState<string>("");
  const [custNotes, setCustNotes] = useState<string>("");

  // Parcel-to-Table conversion state
  const [showConvertToTableModal, setShowConvertToTableModal] = useState<boolean>(false);
  const [convertTargetTable, setConvertTargetTable] = useState<number>(1);

  // Manager Override Modal state
  const [showOverrideModal, setShowOverrideModal] = useState<boolean>(false);
  const [overridePin, setOverridePin] = useState<string>("");
  const [overrideReason, setOverrideReason] = useState<string>("Chef confirmed emergency stock available");
  const [overrideError, setOverrideError] = useState<string | null>(null);

  // Quick Settle / Bill Paid Modal state
  const [showSettleModal, setShowSettleModal] = useState<boolean>(false);
  const [settleMethod, setSettleMethod] = useState<"CASH" | "UPI">("CASH");
  const [autoPrintOnSettle, setAutoPrintOnSettle] = useState<boolean>(true);
  const [isSettling, setIsSettling] = useState<boolean>(false);

  // Android Back Button Trap: Dismiss open modals or sheets before exiting app
  const isAnyModalOpen =
    isCartSheetOpen ||
    showMoreActions ||
    showPrinterModal ||
    showTransferModal ||
    showOverrideModal ||
    showSettleModal ||
    showCustomerModal ||
    showConvertToTableModal;
  useAndroidBackButton(isAnyModalOpen, () => {
    setIsCartSheetOpen(false);
    setShowMoreActions(false);
    setShowPrinterModal(false);
    setShowTransferModal(false);
    setShowOverrideModal(false);
    setShowSettleModal(false);
    setShowCustomerModal(false);
    setShowConvertToTableModal(false);
  });

  // Resilient party resolution: Check direct ID, or auto-heal table number pattern
  let party = store.parties.find((p) => p.id === resolvedParams.partyId);
  if (!party) {
    const tableMatch = resolvedParams.partyId.match(/(?:party-tbl-|table-)?(\d+)/i);
    if (tableMatch) {
      const tblNum = parseInt(tableMatch[1], 10);
      const existingTableParty = store.parties.find(
        (p) => p.tableNumber === tblNum && p.status !== "CLOSED" && p.status !== "CANCELLED" && !p.isTakeaway
      );
      if (existingTableParty) {
        party = existingTableParty;
      } else {
        const tableObj = store.tables.find((t) => t.tableNumber === tblNum);
        if (tableObj) {
          try {
            party = store.createPartyAtTable(tblNum, 2, `Table ${tblNum}`);
          } catch {
            // fallback
          }
        }
      }
    }
  }

  useEffect(() => {
    if (party) {
      setCustName(party.customerName || "");
      setCustPhone(party.customerPhone || "");
      setCustNotes(party.notes || "");
    }
  }, [party?.id, party?.customerName, party?.customerPhone, party?.notes]);

  useEffect(() => {
    store.recalculateMenuAvailability();
    setTick((t) => t + 1);

    // Live multi-device & multi-tab update sync
    const handleSync = () => {
      setTick((t) => t + 1);
    };
    window.addEventListener("kk-state-changed", handleSync);
    return () => window.removeEventListener("kk-state-changed", handleSync);
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

  const getBreadCountForItem = (itemId: string, breadId: BreadOption): number => {
    return cart
      .filter((c) => c.menuItem.id === itemId)
      .reduce((sum, c) => {
        if (c.breadCounts && c.breadCounts[breadId] !== undefined) {
          return sum + (c.breadCounts[breadId] || 0);
        }
        if (c.breadOption === breadId) {
          return sum + (DEFAULT_BREAD_PORTIONS[breadId] || 1) * c.quantity;
        }
        return sum;
      }, 0);
  };

  const getBreadSummaryForItem = (itemId: string): string => {
    const thaliItems = cart.filter((c) => c.menuItem.id === itemId);
    if (thaliItems.length === 0) return "";
    const notes = thaliItems
      .map((c) => c.notes || (c.breadOption ? (BREAD_OPTION_LABELS[c.breadOption]?.mr || c.breadOption) : ""))
      .filter(Boolean);
    return notes.join(" | ");
  };

  const isTakeaway = Boolean(party.isTakeaway || party.tableNumber === 0);
  const packagingFee = isTakeaway ? (party.packagingCharges ?? 20) : 0;
  const totalCartCount = cart.reduce((sum, it) => sum + it.quantity, 0);
  const cartSubtotal = cart.reduce((sum, it) => sum + it.unitPrice * it.quantity, 0);
  const runningGrandTotal = party.runningSubtotal + (isTakeaway && party.runningSubtotal > 0 ? packagingFee : 0);

  const handleBreadCountChange = (
    item: MenuItem,
    breadId: BreadOption,
    delta: number
  ) => {
    const isOut = item.stockStatus === "OUT_OF_STOCK" || item.portionAvailability <= 0;
    if (isOut && delta > 0) {
      triggerHaptic("warning");
      const confirmAdd = confirm(
        `"${item.name}" has 0 portions left. Add under Manager PIN override?`
      );
      if (!confirmAdd) return;
    }

    triggerHaptic("tap");
    setErrorMessage(null);

    const existingIndex = cart.findIndex((c) => c.menuItem.id === item.id);

    if (existingIndex === -1) {
      if (delta <= 0) return;
      const initialPortion = DEFAULT_BREAD_PORTIONS[breadId] || 2;
      const counts: Partial<Record<BreadOption, number>> = { [breadId]: initialPortion };
      const notes = buildItemNotes(counts);
      setCart([
        ...cart,
        {
          menuItem: item,
          unitPrice: item.sellingPrice,
          quantity: 1, // 1 Thali!
          breadOption: breadId,
          breadCounts: counts,
          notes,
        },
      ]);
      return;
    }

    const updated = [...cart];
    const target = { ...updated[existingIndex] };
    const counts = { ...(target.breadCounts || {}) };

    if (Object.keys(counts).length === 0 && target.breadOption) {
      counts[target.breadOption] = (DEFAULT_BREAD_PORTIONS[target.breadOption] || 1) * target.quantity;
    }

    const currentCount = counts[breadId] || 0;
    const newCount = Math.max(0, currentCount + delta);

    if (newCount > 0) {
      counts[breadId] = newCount;
    } else {
      delete counts[breadId];
    }

    let primaryBread: BreadOption = breadId;
    let maxCount = 0;
    for (const [bId, count] of Object.entries(counts)) {
      if (count && count > maxCount) {
        maxCount = count;
        primaryBread = bId as BreadOption;
      }
    }

    target.breadCounts = counts;
    target.breadOption = primaryBread;
    target.notes = buildItemNotes(counts, target.customNote, target.spiceLevel);

    updated[existingIndex] = target;
    setCart(updated);
  };

  const handleThaliQuantityChange = (
    item: MenuItem,
    delta: number
  ) => {
    const isOut = item.stockStatus === "OUT_OF_STOCK" || item.portionAvailability <= 0;
    if (isOut && delta > 0) {
      triggerHaptic("warning");
      const confirmAdd = confirm(
        `"${item.name}" has 0 portions left. Add under Manager PIN override?`
      );
      if (!confirmAdd) return;
    }

    triggerHaptic("tap");
    setErrorMessage(null);

    const existingIndex = cart.findIndex((c) => c.menuItem.id === item.id);

    if (existingIndex === -1) {
      if (delta <= 0) return;
      const defaultBread: BreadOption = "ROTI";
      const portion = DEFAULT_BREAD_PORTIONS[defaultBread] || 2;
      const counts: Partial<Record<BreadOption, number>> = { [defaultBread]: portion };
      setCart([
        ...cart,
        {
          menuItem: item,
          unitPrice: item.sellingPrice,
          quantity: 1,
          breadOption: defaultBread,
          breadCounts: counts,
          notes: buildItemNotes(counts),
        },
      ]);
      return;
    }

    const updated = [...cart];
    const target = { ...updated[existingIndex] };
    const newQty = target.quantity + delta;

    if (newQty <= 0) {
      updated.splice(existingIndex, 1);
      setCart(updated);
      return;
    }

    const oldQty = target.quantity;
    const counts = { ...(target.breadCounts || {}) };
    for (const [bId, count] of Object.entries(counts)) {
      if (count) {
        const perThali = Math.round(count / oldQty) || (DEFAULT_BREAD_PORTIONS[bId as BreadOption] || 1);
        counts[bId as BreadOption] = perThali * newQty;
      }
    }

    target.quantity = newQty;
    target.breadCounts = counts;
    target.notes = buildItemNotes(counts, target.customNote, target.spiceLevel);

    updated[existingIndex] = target;
    setCart(updated);
  };

  const handleAddToCart = (
    item: MenuItem,
    explicitBread?: BreadOption,
    variant?: { name: string; price: number }
  ) => {
    const isOut = item.stockStatus === "OUT_OF_STOCK" || item.portionAvailability <= 0;
    if (isOut) {
      triggerHaptic("warning");
      const confirmAdd = confirm(
        `"${item.name}" has 0 portions left. Add under Manager PIN override?`
      );
      if (!confirmAdd) return;
    }

    triggerHaptic("tap");
    setErrorMessage(null);

    const isThali = isThaliOrMainCourseItem(item);
    if (isThali) {
      if (explicitBread) {
        handleBreadCountChange(item, explicitBread, 1);
      } else {
        handleThaliQuantityChange(item, 1);
      }
      return;
    }

    const variantName = variant ? variant.name : undefined;
    const unitPrice = variant ? variant.price : item.sellingPrice;

    const existingIndex = cart.findIndex(
      (c) =>
        c.menuItem.id === item.id &&
        c.variantName === variantName
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
        },
      ]);
    }
  };

  const handleCardDecrement = (
    item: MenuItem,
    explicitBread?: BreadOption,
    variantName?: string
  ) => {
    triggerHaptic("tap");
    const isThali = isThaliOrMainCourseItem(item);
    if (isThali) {
      if (explicitBread) {
        handleBreadCountChange(item, explicitBread, -1);
      } else {
        handleThaliQuantityChange(item, -1);
      }
      return;
    }

    const existingIndex = cart.findIndex(
      (c) =>
        c.menuItem.id === item.id &&
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
    triggerHaptic("tap");
    const updated = [...cart];
    const target = { ...updated[index] };
    const newQty = target.quantity + delta;

    if (newQty <= 0) {
      updated.splice(index, 1);
      setCart(updated);
      return;
    }

    if (target.breadCounts && Object.keys(target.breadCounts).length > 0) {
      const oldQty = target.quantity;
      const counts = { ...target.breadCounts };
      for (const [bId, count] of Object.entries(counts)) {
        if (count) {
          const perThali = Math.round(count / oldQty) || (DEFAULT_BREAD_PORTIONS[bId as BreadOption] || 1);
          counts[bId as BreadOption] = perThali * newQty;
        }
      }
      target.breadCounts = counts;
      target.notes = buildItemNotes(counts, target.customNote, target.spiceLevel);
    }

    target.quantity = newQty;
    updated[index] = target;
    setCart(updated);
  };

  const handleChangeCartItemBread = (index: number, newBread: BreadOption) => {
    const current = cart[index];
    const updated = [...cart];
    const portion = (DEFAULT_BREAD_PORTIONS[newBread] || 1) * current.quantity;
    const newCounts: Partial<Record<BreadOption, number>> = { [newBread]: portion };
    updated[index] = {
      ...current,
      breadOption: newBread,
      breadCounts: newCounts,
      notes: buildItemNotes(newCounts, current.customNote, current.spiceLevel),
    };
    setCart(updated);
  };

  const handleSendKot = async () => {
    if (cart.length === 0 || isSending) return;
    setIsSending(true);
    setErrorMessage(null);

    try {
      if (outboxManager.getStatus() === "OFFLINE") {
        outboxManager.enqueueMutation(
          "SEND_KOT",
          {
            partyId: party.id,
            items: cart.map((c) => ({
              menuItemId: c.menuItem.id,
              quantity: c.quantity,
              breadOption: c.breadOption,
              notes: c.notes || buildItemNotes(c.breadCounts, c.customNote, c.spiceLevel),
              variantName: c.variantName,
              unitPrice: c.unitPrice,
            })),
          },
          { partyCode: party.partyCode, tableNumber: party.tableNumber }
        ).catch(() => {});
      }

      const result = store.placeOrder(
        party.id,
        cart.map((c) => ({
          menuItemId: c.menuItem.id,
          quantity: c.quantity,
          breadOption: c.breadOption,
          notes: c.notes || buildItemNotes(c.breadCounts, c.customNote, c.spiceLevel),
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
        title: isTakeaway ? `KOT #${result.kot.kotNumber} (Parcel ${party.partyCode})` : `KOT #${result.kot.kotNumber} (Table ${party.tableNumber})`,
        message: `${result.kot.items.map((i) => `${i.menuItemLocalName || i.menuItemName} × ${i.quantity}`).join(", ")} स्वयंपाकघरात पाठवले (Dispatched to kitchen).`,
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
      triggerHaptic("success");
      router.push(isTakeaway ? "/waiter?tab=parcels" : "/waiter");
    } catch (err: any) {
      triggerHaptic("error");
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

  const handleSendKotAndSettle = async (method: "CASH" | "UPI" = "CASH") => {
    if (cart.length === 0 || isSending) return;
    setIsSending(true);
    setErrorMessage(null);

    try {
      const result = store.placeOrder(
        party.id,
        cart.map((c) => ({
          menuItemId: c.menuItem.id,
          quantity: c.quantity,
          breadOption: c.breadOption,
          notes: c.notes || buildItemNotes(c.breadCounts, c.customNote, c.spiceLevel),
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

      const settleResult = store.quickSettleBill(party.id, method);
      if (autoPrintOnSettle) {
        printBillReceipt(settleResult.bill, false, store.printerSettings?.paperWidth || "80mm");
      }

      triggerHaptic("success");
      setCart([]);
      setIsCartSheetOpen(false);
      alert(`✅ Order placed & bill settled (₹${settleResult.bill.grandTotal}) via ${method}!`);
      router.push(isTakeaway ? "/waiter?tab=parcels" : "/waiter");
    } catch (err: any) {
      triggerHaptic("error");
      setErrorMessage(err.message || "Failed to place & settle order");
    } finally {
      setIsSending(false);
    }
  };

  const handleCancelOrderedItem = (orderItemId: string, itemName: string, qty: number) => {
    const reason = prompt(
      `Cancel "${itemName}" × ${qty}?\nEnter cancellation reason (उदा. ग्राहक बदलले / रद्द केले):`,
      "Customer changed mind"
    );
    if (!reason || !reason.trim()) return;

    try {
      store.cancelOrderItem(orderItemId, reason.trim());
      triggerHaptic("warning");
      setTick((t) => t + 1);
      alert(`Cancelled "${itemName}" × ${qty}. Stock reservation rolled back & bill updated.`);
    } catch (err: any) {
      triggerHaptic("error");
      alert(err.message || "Failed to cancel item");
    }
  };

  const handleSaveCustomerInfo = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      store.updatePartyCustomerInfo(party.id, custName, custPhone, custNotes);
      setShowCustomerModal(false);
      triggerHaptic("success");
      setTick((t) => t + 1);
      alert(`Saved details for ${custName || party.partyCode}!`);
    } catch (err: any) {
      alert(err.message || "Failed to save customer details");
    }
  };

  const handleConvertToTableSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      store.convertToTableParty(party.id, convertTargetTable);
      setShowConvertToTableModal(false);
      triggerHaptic("success");
      setTick((t) => t + 1);
      alert(`Switched Parcel to Table ${convertTargetTable}!`);
      router.refresh();
    } catch (err: any) {
      alert(err.message || "Failed to convert to table");
    }
  };

  const handleManagerOverrideSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const isAuthorized =
      overridePin === "1234" ||
      store.currentUser.role === "OWNER" ||
      store.currentUser.role === "MANAGER";

    if (!isAuthorized) {
      triggerHaptic("error");
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

      triggerHaptic("success");
      setShowOverrideModal(false);
      setCart([]);
      setIsCartSheetOpen(false);
      router.push(isTakeaway ? "/waiter?tab=parcels" : "/waiter");
    } catch (err: any) {
      triggerHaptic("error");
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
      alert(`Bill printed for ${isTakeaway ? `Parcel ${party.partyCode}` : `Table ${party.tableNumber}`}!`);
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
    alert(`Reprinted KOT #${latestKot.kotNumber} for ${isTakeaway ? `Parcel ${party.partyCode}` : `Table ${party.tableNumber}`}`);
  };

  const handleRequestBill = () => {
    try {
      store.parties = store.parties.map((p) =>
        p.id === party.id ? { ...p, status: "WAITING_FOR_BILL", lastActivityAt: new Date().toISOString() } : p
      );
      const partyOrders = store.orders.filter((o) => o.partyId === party.id && o.status !== "CANCELLED");
      const partyItems = partyOrders.flatMap((o) => o.items.filter((i) => !i.isCancelled));
      const subtotal = partyItems.reduce((s, i) => s + (i.totalPrice || 0), 0);
      const taxEstimate = 0;
      const pkg = isTakeaway ? packagingFee : 0;
      const grandTotal = Math.round(subtotal + pkg);
      printTableCheck({
        party,
        items: partyItems,
        subtotal,
        taxEstimate,
        grandTotal,
        packagingCharges: pkg,
        paperWidth: store.printerSettings?.paperWidth || "80mm",
      });
      setShowMoreActions(false);
      alert(`Bill requested for ${isTakeaway ? `Parcel ${party.partyCode}` : `Table ${party.tableNumber}`}!`);
    } catch (err: any) {
      alert(`Could not request bill: ${err.message}`);
    }
  };

  const handleQuickSettle = (method: "CASH" | "UPI" = "CASH") => {
    if (!party) return;
    try {
      setIsSettling(true);
      triggerHaptic("success");
      const result = store.quickSettleBill(party.id, method);
      if (autoPrintOnSettle) {
        printBillReceipt(result.bill, false, store.printerSettings?.paperWidth || "80mm");
      }
      setShowSettleModal(false);
      alert(`✅ ${result.message}`);
      if (party.isTakeaway || party.tableNumber === 0) {
        router.push("/waiter?tab=parcels");
      } else {
        router.push("/waiter");
      }
    } catch (err: any) {
      triggerHaptic("error");
      alert(err.message);
    } finally {
      setIsSettling(false);
    }
  };

  return (
    <div className="space-y-3.5 pb-36 max-w-5xl mx-auto">
      {/* 1. Luxury Header - Responsive & Non-Collapsing */}
      <div className="bg-white/95 backdrop-blur-xl rounded-3xl p-3 sm:p-4 border border-stone-200/90 shadow-sm flex items-center justify-between gap-2">
        {/* Left: Back Arrow & Table / Parcel Identity */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <Link
            href={party.isTakeaway || party.tableNumber === 0 ? "/waiter?tab=parcels" : "/waiter"}
            className="p-2 sm:p-2.5 rounded-2xl bg-stone-100 hover:bg-stone-200 text-stone-700 border border-stone-200/80 active:scale-95 transition-all shrink-0 shadow-2xs cursor-pointer touch-manipulation"
            title={party.isTakeaway || party.tableNumber === 0 ? "Back to Parcels" : "Back to Floor"}
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>

          <div className="min-w-0">
            {party.isTakeaway || party.tableNumber === 0 ? (
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="bg-gradient-to-r from-amber-500 to-amber-600 text-stone-950 font-black text-xs px-2.5 py-1 rounded-xl flex items-center gap-1 shadow-xs border border-amber-300 font-tabular shrink-0">
                  <ShoppingBag className="w-3.5 h-3.5 text-stone-950 shrink-0" />
                  <span>{party.partyCode}</span>
                </span>
                <button
                  type="button"
                  onClick={() => setShowCustomerModal(true)}
                  className="flex items-center gap-1 text-[11px] font-bold text-amber-900 bg-amber-50 hover:bg-amber-100 px-2 py-0.5 rounded-xl border border-amber-200 truncate max-w-[120px] xs:max-w-[170px] cursor-pointer touch-manipulation active:scale-95 transition-all shadow-2xs"
                  title="Edit Customer Name & Phone"
                >
                  <User className="w-3 h-3 text-amber-700 shrink-0" />
                  <span className="truncate">{party.customerName || "+ Add Name"}</span>
                  <Edit3 className="w-2.5 h-2.5 text-amber-600 shrink-0 opacity-70" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="bg-stone-950 text-amber-300 font-black text-xs sm:text-sm px-2.5 py-1 rounded-xl shadow-xs border border-stone-800 font-tabular shrink-0">
                  Table {party.tableNumber}
                </span>
                <button
                  type="button"
                  onClick={() => setShowCustomerModal(true)}
                  className="flex items-center gap-1 text-[11px] font-bold text-stone-600 hover:text-stone-900 bg-stone-100 hover:bg-stone-200 px-2 py-0.5 rounded-xl border border-stone-200 truncate max-w-[120px] xs:max-w-[170px] cursor-pointer touch-manipulation active:scale-95 transition-all"
                  title="Edit Customer / Guest Details"
                >
                  <span className="truncate">{party.customerName || `${party.guestCount}G • ${party.assignedWaiterName.split(" ")[0]}`}</span>
                  <Edit3 className="w-2.5 h-2.5 text-stone-400 shrink-0" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right: Bill Total & Compact Action Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Running Bill Amount Tile */}
          <div className="text-right px-2.5 sm:px-3 py-1 sm:py-1.5 bg-stone-950 text-amber-300 border border-stone-800 rounded-xl sm:rounded-2xl font-tabular shadow-2xs shrink-0">
            <span className="text-[8px] sm:text-[9px] uppercase font-bold text-stone-400 block leading-none">
              {isTakeaway ? "Parcel Total" : "Bill"}
            </span>
            <span className="font-black text-xs sm:text-sm md:text-base text-amber-300 leading-tight">
              ₹{runningGrandTotal}
            </span>
            {isTakeaway && packagingFee > 0 && party.runningSubtotal > 0 && (
              <span className="text-[7.5px] sm:text-[8px] text-amber-400/80 block leading-none font-sans font-semibold">
                (₹{party.runningSubtotal}+₹{packagingFee}pkg)
              </span>
            )}
          </div>

          {/* Desktop Only: 1-Tap Take Parcel Button */}
          <button
            type="button"
            onClick={() => {
              try {
                const newParcel = store.createTakeawayParty();
                router.push(`/waiter/order/${newParcel.id}?isTakeaway=true`);
              } catch (err: any) {
                alert(err.message);
              }
            }}
            className="hidden md:flex px-3 py-2 bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 hover:from-amber-500 hover:to-amber-700 text-stone-950 font-black text-xs rounded-2xl shadow-xs active:scale-95 transition-all items-center gap-1.5 shrink-0 touch-manipulation cursor-pointer border border-amber-300"
            title="Take a New Parcel Order (Will not occupy physical tables 1–12)"
          >
            <ShoppingBag className="w-3.5 h-3.5 text-stone-950" />
            <span>Take Parcel</span>
          </button>

          {/* Quick Printer Settings Button */}
          <button
            type="button"
            onClick={() => setShowPrinterModal(true)}
            className="w-10 h-10 min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl sm:rounded-2xl bg-stone-50 hover:bg-stone-100 border border-stone-200 text-stone-700 active:scale-95 cursor-pointer shadow-2xs shrink-0 touch-manipulation"
            title="प्रिंटर सेटिंग्ज (Printer Settings)"
          >
            <Printer className="w-4 h-4 text-amber-600" />
          </button>

          {/* More Actions Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowMoreActions(!showMoreActions)}
              className="w-10 h-10 min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl sm:rounded-2xl bg-stone-50 hover:bg-stone-100 border border-stone-200 text-stone-700 active:scale-95 cursor-pointer shadow-2xs shrink-0 touch-manipulation"
              title="More Actions"
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            {showMoreActions && (
              <div className="absolute right-0 mt-2 w-64 bg-white border border-stone-200/90 rounded-3xl shadow-2xl p-2 z-40 text-xs space-y-1 animate-in fade-in zoom-in-95">
                {/* Edit Customer Info Button */}
                <button
                  type="button"
                  onClick={() => {
                    setShowMoreActions(false);
                    setShowCustomerModal(true);
                  }}
                  className="w-full text-left px-3 py-2 rounded-2xl hover:bg-amber-50 font-bold text-amber-950 flex items-center gap-2 border border-amber-200 bg-amber-50/50 cursor-pointer"
                >
                  <User className="w-3.5 h-3.5 text-amber-600" />
                  <span>Edit Name / Phone (ग्राहक माहिती)</span>
                </button>

                {/* 1-Tap Take New Parcel inside dropdown */}
                <button
                  type="button"
                  onClick={() => {
                    setShowMoreActions(false);
                    try {
                      const newParcel = store.createTakeawayParty();
                      router.push(`/waiter/order/${newParcel.id}?isTakeaway=true`);
                    } catch (err: any) {
                      alert(err.message);
                    }
                  }}
                  className="w-full text-left px-3 py-2 rounded-2xl hover:bg-amber-50 font-black text-amber-950 flex items-center gap-2 border border-amber-200 bg-amber-50/70 cursor-pointer"
                >
                  <ShoppingBag className="w-3.5 h-3.5 text-amber-600" />
                  <span>🛍️ Take New Parcel (नवीन पार्सल)</span>
                </button>

                {/* If Parcel: Option to Convert to Dining Table */}
                {isTakeaway && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowMoreActions(false);
                      setShowConvertToTableModal(true);
                    }}
                    className="w-full text-left px-3 py-2 rounded-2xl hover:bg-emerald-50 font-bold text-emerald-950 flex items-center gap-2 border border-emerald-200 bg-emerald-50/70 cursor-pointer"
                  >
                    <ArrowRightLeft className="w-3.5 h-3.5 text-emerald-600" />
                    <span>🪑 Assign Table (डायनिंग टेबल द्या)</span>
                  </button>
                )}

                {/* Cancel & Free Table if empty */}
                {party.runningSubtotal === 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowMoreActions(false);
                      if (confirm("No orders placed yet. Cancel and vacate this table/order?")) {
                        try {
                          store.voidOrCancelParty(party.id, "Empty party cancelled");
                          router.push(party.isTakeaway || party.tableNumber === 0 ? "/waiter?tab=parcels" : "/waiter");
                        } catch (e: any) {
                          alert(e.message);
                        }
                      }
                    }}
                    className="w-full text-left px-3 py-2 rounded-2xl hover:bg-red-50 font-black text-red-700 flex items-center gap-2 border border-red-200 bg-red-50/50 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5 text-red-600" />
                    <span>✕ Cancel & Free Table (टेबल रद्द)</span>
                  </button>
                )}

                {/* Switch from Table to Parcel takeaway if guest changes mind */}
                {!party.isTakeaway && party.tableNumber !== 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      try {
                        store.convertToTakeawayParty(party.id);
                        setShowMoreActions(false);
                        alert(`Switched Table ${party.tableNumber} to Takeaway Parcel! Physical table is now FREE.`);
                        router.refresh();
                      } catch (e: any) {
                        alert(e.message);
                      }
                    }}
                    className="w-full text-left px-3 py-2 rounded-2xl hover:bg-amber-50 font-bold text-amber-900 flex items-center gap-2 border border-amber-200 bg-amber-50/60 cursor-pointer"
                  >
                    <ShoppingBag className="w-3.5 h-3.5 text-amber-600" />
                    <span>Make Parcel (पार्सल करा)</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={handlePrintLatestKot}
                  className="w-full text-left px-3 py-2 rounded-2xl hover:bg-stone-50 font-bold text-stone-800 flex items-center gap-2 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5 text-amber-600" />
                  <span>Reprint KOT</span>
                </button>
                <button
                  type="button"
                  onClick={handleRequestBill}
                  className="w-full text-left px-3 py-2 rounded-2xl hover:bg-stone-50 font-bold text-stone-800 flex items-center gap-2 cursor-pointer"
                >
                  <Bell className="w-3.5 h-3.5 text-blue-600" />
                  <span>Request Bill</span>
                </button>
                <button
                  type="button"
                  onClick={handlePrintFinalBill}
                  className="w-full text-left px-3 py-2 rounded-2xl hover:bg-stone-50 font-bold text-emerald-700 flex items-center gap-2 cursor-pointer"
                >
                  <Receipt className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Print Final Bill</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowMoreActions(false);
                    setShowPrinterModal(true);
                  }}
                  className="w-full text-left px-3 py-2 rounded-2xl hover:bg-stone-50 font-bold text-stone-700 flex items-center gap-2 cursor-pointer"
                >
                  <Sliders className="w-3.5 h-3.5 text-stone-500" />
                  <span>Printer Settings</span>
                </button>
                {!isTakeaway && (
                  <>
                    <div className="border-t border-stone-100 my-1" />
                    <button
                      type="button"
                      onClick={() => {
                        setShowMoreActions(false);
                        setTargetTableNumber(party.tableNumber === 12 ? 1 : party.tableNumber + 1);
                        setShowTransferModal(true);
                      }}
                      className="w-full text-left px-3 py-2 rounded-2xl hover:bg-stone-50 font-bold text-stone-700 flex items-center gap-2 cursor-pointer"
                    >
                      <ArrowRightLeft className="w-3.5 h-3.5 text-stone-500" />
                      <span>Move Table</span>
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Fast Table Settle Action Strip - Always unmissable when table is open */}
      <div className="bg-gradient-to-r from-emerald-50/90 via-white to-emerald-50/70 border border-emerald-400/80 rounded-3xl p-3 sm:p-4 flex items-center justify-between gap-2.5 shadow-xs">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-2xl bg-emerald-600 text-white flex items-center justify-center font-black text-xs shrink-0 shadow-xs">
            <CheckCircle2 className="w-4 h-4 text-emerald-100" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-black text-xs sm:text-sm text-stone-900 truncate">
                {party.isTakeaway || party.tableNumber === 0 ? "🛍️ Takeaway Parcel" : `Table ${party.tableNumber}`}
              </span>
              <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-200">
                ACTIVE
              </span>
            </div>
            <span className="text-[11px] text-stone-500 font-bold block truncate mt-0.5">
              Total: <strong className="text-emerald-700 font-tabular font-black text-xs sm:text-sm">₹{party.runningSubtotal}</strong> • {party.guestCount} Guests
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleRequestBill}
            className="hidden xs:flex px-3 py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold text-xs rounded-2xl items-center gap-1.5 border border-stone-300/80 active:scale-95 transition-all cursor-pointer"
            title="Request / Print Pre-Bill Check"
          >
            <Receipt className="w-3.5 h-3.5 text-stone-600" />
            <span>Check</span>
          </button>
          <button
            type="button"
            onClick={() => setShowSettleModal(true)}
            className="px-3.5 sm:px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white font-black text-xs sm:text-sm rounded-2xl flex items-center gap-1.5 shadow-md shadow-emerald-700/25 active:scale-95 transition-all cursor-pointer border border-emerald-500"
            title="Bill is Paid — Settle & Close Table"
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-200 shrink-0" />
            <span>Bill Paid (बिल भरले)</span>
          </button>
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
        <div className="bg-emerald-50/70 border border-emerald-200/90 rounded-3xl p-3 sm:p-3.5 space-y-2.5 shadow-2xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-black text-emerald-950">
                In Kitchen ({previouslyOrderedItems.filter((i) => !i.isCancelled).length} items ordered)
              </span>
            </div>
            <button
              type="button"
              onClick={() => setShowActiveOrders(!showActiveOrders)}
              className="text-[11px] font-black text-emerald-800 hover:text-emerald-950 flex items-center gap-1 bg-white border border-emerald-200 px-2.5 py-1 rounded-xl shadow-2xs cursor-pointer"
            >
              <span>{showActiveOrders ? "Hide" : "Show"}</span>
              {showActiveOrders ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
          </div>

          {showActiveOrders && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-emerald-200/60 text-xs">
              {previouslyOrderedItems.map((item, idx) => {
                const menuItem = store.menuItems.find((m) => m.id === item.menuItemId);
                const isCancelled = item.isCancelled;
                return (
                  <div
                    key={idx}
                    className={`p-2.5 rounded-2xl bg-white border flex items-center justify-between gap-2 shadow-2xs ${
                      isCancelled ? "border-red-200 bg-red-50/40 opacity-70" : "border-emerald-200/90"
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <span className={`font-bold block truncate text-xs ${isCancelled ? "line-through text-stone-400" : "text-stone-900"}`}>
                        {item.quantity}× {item.menuItemLocalName || item.menuItemName}
                      </span>
                      {item.menuItemLocalName && item.menuItemName && item.menuItemLocalName !== item.menuItemName && (
                        <span className="text-[10px] text-stone-500 block truncate">
                          ({item.menuItemName})
                        </span>
                      )}
                      <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                        <span
                          className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded-md ${
                            isCancelled
                              ? "bg-red-100 text-red-700"
                              : item.kotStatus === "READY"
                              ? "bg-emerald-100 text-emerald-800"
                              : item.kotStatus === "PREPARING"
                              ? "bg-amber-100 text-amber-900"
                              : "bg-blue-50 text-blue-800"
                          }`}
                        >
                          {item.kotStatus}
                        </span>
                        {item.notes && (
                          <span className="text-[9.5px] text-stone-500 truncate max-w-[120px]">
                            {item.notes}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {!isCancelled && (
                        <button
                          type="button"
                          onClick={() => handleCancelOrderedItem(item.id, item.menuItemName, item.quantity)}
                          className="px-2 py-1 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 font-bold text-[10px] rounded-xl flex items-center gap-0.5 active:scale-95 transition-all cursor-pointer"
                          title="Cancel this item from kitchen order"
                        >
                          <X className="w-3 h-3" />
                          <span>रद्द</span>
                        </button>
                      )}
                      {menuItem && !isCancelled && (
                        <button
                          type="button"
                          onClick={() =>
                            handleAddToCart(
                              menuItem,
                              item.breadOption,
                              item.variantName ? { name: item.variantName, price: item.unitPrice } : undefined
                            )
                          }
                          className="px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white font-black text-[10px] rounded-xl flex items-center gap-1 shadow-2xs active:scale-95 transition-all cursor-pointer"
                          title="Add this item again to current order"
                        >
                          <Plus className="w-3 h-3" />
                          <span>Again</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 3. Search Bar & Horizontal Category Pills */}
      <div className="space-y-2.5">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-4 top-3.5 text-stone-400" />
          <input
            type="text"
            placeholder="Search dishes (उदा. चिकन थाळी, मटण, भाकरी, तांबडा रस्सा)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white border border-stone-200/90 rounded-2xl pl-11 pr-10 py-3 text-xs sm:text-sm text-stone-900 font-bold focus:outline-none focus:ring-2 focus:ring-red-500 shadow-2xs"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-3.5 top-3 text-stone-400 hover:text-stone-600 p-1 cursor-pointer"
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
            className={`px-4 py-2.5 rounded-2xl font-black whitespace-nowrap transition-all touch-manipulation active:scale-95 cursor-pointer ${
              selectedCategory === "ALL"
                ? "bg-gradient-to-r from-red-600 via-red-700 to-red-800 text-white shadow-sm border border-red-500/40"
                : "bg-white text-stone-700 border border-stone-200/90 hover:bg-stone-50 shadow-2xs"
            }`}
          >
            सर्व पदार्थ (All Dishes)
          </button>
          {store.categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-4 py-2.5 rounded-2xl font-bold whitespace-nowrap transition-all touch-manipulation active:scale-95 cursor-pointer ${
                selectedCategory === cat.id
                  ? "bg-gradient-to-r from-red-600 via-red-700 to-red-800 text-white shadow-sm font-black border border-red-500/40"
                  : "bg-white text-stone-700 border border-stone-200/90 hover:bg-stone-50 shadow-2xs"
              }`}
            >
              {cat.localName || cat.name}
            </button>
          ))}
        </div>
      </div>

      {/* 4. Streamlined Menu Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {filteredItems.map((item) => {
          const isOut = item.stockStatus === "OUT_OF_STOCK" || item.portionAvailability <= 0;
          const isLow = item.stockStatus === "LOW_STOCK" || item.portionAvailability <= 5;
          const inCartTotal = getCartQuantityForItem(item.id);
          const isThaliOrMain = isThaliOrMainCourseItem(item);

          return (
            <div
              key={item.id}
              className={`p-3.5 sm:p-4 rounded-3xl border transition-all flex flex-col justify-between ${
                inCartTotal > 0
                  ? "bg-red-50/20 border-red-300 ring-2 ring-red-200/50 shadow-xs"
                  : isOut
                  ? "bg-stone-50/70 border-stone-200 opacity-60"
                  : "bg-white border-stone-200/90 hover:border-stone-300 shadow-2xs"
              }`}
            >
              <div>
                {/* Title & Price Row */}
                <div className="flex items-start justify-between gap-2.5">
                  <div className="flex items-start gap-2.5 min-w-0">
                    <span
                      className={`w-4 h-4 border-2 rounded-xs flex items-center justify-center shrink-0 mt-0.5 ${
                        item.isVeg ? "border-emerald-600" : "border-red-700"
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${item.isVeg ? "bg-emerald-600" : "bg-red-700"}`} />
                    </span>
                    <div className="min-w-0">
                      <h3 className="font-black text-sm sm:text-base text-stone-900 leading-snug truncate">
                        {item.localName || item.name}
                      </h3>
                      {item.localName && item.name && item.localName !== item.name && (
                        <span className="text-[11px] font-semibold text-stone-500 block truncate mt-0.5">
                          {item.name}
                        </span>
                      )}
                    </div>
                  </div>

                  <span className="font-tabular font-black text-base sm:text-lg text-stone-950 shrink-0">
                    ₹{item.sellingPrice}
                  </span>
                </div>

                {/* Stock warning (Only if Low/Out) */}
                {(isOut || isLow) && (
                  <div className="mt-1.5">
                    <span
                      className={`text-[9px] font-black px-2 py-0.5 rounded-md ${
                        isOut ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-900"
                      }`}
                    >
                      {isOut ? "OUT OF STOCK" : `${item.portionAvailability} left`}
                    </span>
                  </div>
                )}

                {/* Thali Quantity Row (थाळी संख्या) */}
                {isThaliOrMain && (
                  <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-stone-100">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-xs font-black text-stone-900 truncate">
                        थाळी (Thali Qty):
                      </span>
                      {inCartTotal > 0 && (
                        <span className="text-[11px] font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200 shrink-0 font-tabular">
                          ₹{item.sellingPrice * inCartTotal}
                        </span>
                      )}
                    </div>

                    {inCartTotal > 0 ? (
                      <div className="flex items-center gap-1.5 bg-red-50 border border-red-200 p-1 rounded-2xl shrink-0">
                        <button
                          type="button"
                          onClick={() => handleThaliQuantityChange(item, -1)}
                          className="w-9 h-9 min-w-[36px] min-h-[36px] rounded-xl bg-white border border-red-200 text-stone-700 flex items-center justify-center active:scale-90 touch-manipulation shadow-2xs cursor-pointer"
                          title="कमी करा (Decrease Thali)"
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                        <span className="font-tabular font-black text-sm text-stone-900 px-1 min-w-5 text-center">
                          {inCartTotal}
                        </span>
                        <button
                          type="button"
                          disabled={isOut}
                          onClick={() => handleThaliQuantityChange(item, 1)}
                          className="w-9 h-9 min-w-[36px] min-h-[36px] rounded-xl bg-red-600 text-white font-black flex items-center justify-center active:scale-90 touch-manipulation shadow-2xs cursor-pointer"
                          title="वाढवा (Increase Thali)"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        disabled={isOut}
                        onClick={() => handleThaliQuantityChange(item, 1)}
                        className="px-3.5 py-1.5 rounded-xl bg-stone-900 text-white font-black text-xs flex items-center gap-1 hover:bg-stone-800 active:scale-95 touch-manipulation cursor-pointer shadow-2xs shrink-0"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>थाळी जोडा (Add)</span>
                      </button>
                    )}
                  </div>
                )}

                {/* Instant Bread Selector with +/- Stepper for Rotis / Bhakris in Thali */}
                {isThaliOrMain && (
                  <div className="mt-2.5 pt-2 border-t border-dashed border-stone-200">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-black uppercase text-amber-900 tracking-wider">
                        भाकरी / चपाती / रोटी (Breads):
                      </span>
                      {getBreadSummaryForItem(item.id) && (
                        <span className="text-[10px] font-black text-amber-900 bg-amber-100/90 px-2 py-0.5 rounded-md border border-amber-200 truncate max-w-[160px]">
                          {getBreadSummaryForItem(item.id)}
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {BREAD_OPTIONS.map((bread) => {
                        const breadCount = getBreadCountForItem(item.id, bread.id);
                        return (
                          <div
                            key={bread.id}
                            className={`min-h-[44px] rounded-2xl border transition-all ${
                              breadCount > 0
                                ? "bg-amber-50/90 border-amber-400 ring-1 ring-amber-300/50"
                                : "bg-stone-50/80 border-stone-200"
                            }`}
                          >
                            {breadCount > 0 ? (
                              /* Stepper mode: - breadCount + */
                              <div className="flex items-center justify-between px-2 py-1 gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleBreadCountChange(item, bread.id, -1)}
                                  className="w-8 h-8 rounded-xl bg-white border border-stone-300 text-stone-700 flex items-center justify-center active:scale-90 touch-manipulation shadow-2xs cursor-pointer"
                                  title={`कमी करा (${bread.name})`}
                                >
                                  <Minus className="w-3.5 h-3.5" />
                                </button>
                                <div className="flex flex-col items-center min-w-0 flex-1">
                                  <span className="font-tabular font-black text-sm text-amber-900 leading-none">
                                    {breadCount}
                                  </span>
                                  <span className="text-[9px] font-bold text-amber-700 truncate leading-tight">
                                    {bread.shortCode}
                                  </span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleBreadCountChange(item, bread.id, 1)}
                                  className="w-8 h-8 rounded-xl bg-amber-500 text-stone-950 font-black flex items-center justify-center active:scale-90 touch-manipulation shadow-2xs cursor-pointer"
                                  title={`वाढवा (${bread.name})`}
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ) : (
                              /* Add mode: single tap to set bread for this thali */
                              <button
                                type="button"
                                disabled={isOut}
                                onClick={() => handleBreadCountChange(item, bread.id, 1)}
                                className="w-full h-full min-h-[44px] px-3 py-2 rounded-2xl text-xs font-bold flex items-center justify-between hover:bg-amber-50/70 active:scale-95 touch-manipulation cursor-pointer"
                              >
                                <span className="flex items-center gap-1.5 truncate text-[11px] sm:text-xs text-stone-800">
                                  <span className="text-sm">{bread.emoji}</span>
                                  <span className="truncate">{bread.localName}</span>
                                </span>
                                <Plus className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Card Stepper for Non-Thalis / Standard Items */}
              {!isThaliOrMain && (
                <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-stone-100">
                  <span className="text-[11px] font-bold text-stone-400">
                    {inCartTotal > 0 ? `${inCartTotal} निवडले` : "टॅप करा (Add)"}
                  </span>

                  {inCartTotal > 0 ? (
                    <div className="flex items-center gap-1.5 bg-red-50 border border-red-200 p-1 rounded-2xl">
                      <button
                        type="button"
                        onClick={() => handleCardDecrement(item)}
                        className="w-9 h-9 min-w-[36px] min-h-[36px] rounded-xl bg-white border border-stone-300 text-stone-700 flex items-center justify-center font-black active:scale-90 touch-manipulation shadow-2xs cursor-pointer"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="font-tabular font-black text-sm text-red-700 px-1 min-w-5 text-center">
                        {inCartTotal}
                      </span>
                      <button
                        type="button"
                        disabled={isOut}
                        onClick={() => handleAddToCart(item)}
                        className="w-9 h-9 min-w-[36px] min-h-[36px] rounded-xl bg-red-600 text-white flex items-center justify-center font-black active:scale-90 touch-manipulation shadow-2xs cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      disabled={isOut}
                      onClick={() => handleAddToCart(item)}
                      className={`min-h-[38px] px-4 py-2 rounded-2xl text-xs sm:text-sm font-black flex items-center gap-1.5 shadow-2xs active:scale-95 transition-all touch-manipulation cursor-pointer ${
                        isOut
                          ? "bg-stone-200 text-stone-400 cursor-not-allowed"
                          : "bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-700 text-white"
                      }`}
                    >
                      <Plus className="w-3.5 h-3.5 text-amber-200" />
                      <span>जोडा (Add)</span>
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
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-stone-950/95 backdrop-blur-2xl border-t border-stone-800 shadow-2xl p-3.5 sm:p-4 pb-[max(0.85rem,env(safe-area-inset-bottom))] animate-in slide-in-from-bottom duration-200 text-white">
          <div className="max-w-5xl mx-auto flex items-center justify-between gap-3">
            {/* Cart Preview Button */}
            <button
              type="button"
              onClick={() => setIsCartSheetOpen(true)}
              className="flex items-center gap-3 text-left p-1 rounded-2xl active:scale-95 transition-all min-w-0 touch-manipulation cursor-pointer"
            >
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-red-600 to-red-800 text-white flex items-center justify-center font-tabular font-black text-sm shrink-0 shadow-lg border border-red-500/30">
                {totalCartCount}
              </div>
              <div className="min-w-0">
                <span className="text-xs sm:text-sm font-black text-white font-tabular block leading-tight">
                  ₹{cartSubtotal}
                </span>
                <span className="text-[10px] text-amber-300 font-bold flex items-center gap-0.5">
                  <span>View Items</span>
                  <ChevronUp className="w-3 h-3" />
                </span>
              </div>
            </button>

            {/* Clear All */}
            <button
              type="button"
              onClick={() => { if (confirm("Clear all items from cart?")) setCart([]); }}
              className="text-[11px] font-bold text-stone-400 hover:text-rose-400 transition-colors px-2 py-1.5 shrink-0 touch-manipulation cursor-pointer"
            >
              Clear All
            </button>

            {/* Big 1-Tap Send KOT Button */}
            <button
              type="button"
              disabled={isSending}
              onClick={handleSendKot}
              className="flex-1 max-w-sm py-3.5 sm:py-4 bg-gradient-to-r from-emerald-600 via-emerald-700 to-emerald-800 hover:from-emerald-500 hover:to-emerald-700 text-white font-black text-xs sm:text-sm rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-700/30 active:scale-95 transition-all touch-manipulation cursor-pointer border border-emerald-500/40"
            >
              <Send className="w-4 h-4 text-emerald-200" />
              <span>{isSending ? "Sending..." : `KOT पाठवा (${totalCartCount}) →`}</span>
            </button>
          </div>
        </div>
      )}

      {/* 5b. Floating Bottom Bar when Cart is Empty & Party Has Running Total */}
      {totalCartCount === 0 && party.runningSubtotal > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-stone-950/95 backdrop-blur-2xl border-t border-stone-800 shadow-2xl p-3.5 sm:p-4 pb-[max(0.85rem,env(safe-area-inset-bottom))] animate-in slide-in-from-bottom duration-200 text-white">
          <div className="max-w-5xl mx-auto flex items-center justify-between gap-2.5">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-stone-400">Bill Total:</span>
              <span className="font-tabular font-black text-base sm:text-lg text-emerald-400">₹{party.runningSubtotal}</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleRequestBill}
                className="px-3 py-2.5 bg-stone-800 hover:bg-stone-700 text-stone-200 font-bold text-xs rounded-2xl flex items-center gap-1.5 active:scale-95 transition-all touch-manipulation cursor-pointer border border-stone-700"
                title="Print Pre-Bill / Table Check"
              >
                <Receipt className="w-3.5 h-3.5 text-stone-400" />
                <span className="hidden xs:inline">Check</span>
              </button>
              <button
                type="button"
                onClick={() => setShowSettleModal(true)}
                className="py-2.5 sm:py-3 px-3.5 sm:px-5 min-h-[44px] bg-gradient-to-r from-emerald-600 via-emerald-700 to-emerald-800 hover:from-emerald-500 hover:to-emerald-700 text-white font-black text-xs sm:text-sm rounded-2xl flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-700/25 active:scale-95 transition-all touch-manipulation cursor-pointer border border-emerald-500/40 shrink-0"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-200 shrink-0" />
                <span className="sm:hidden">Settle & Close</span>
                <span className="hidden sm:inline">
                  {party.isTakeaway || party.tableNumber === 0
                    ? "Bill is Paid — Complete Parcel →"
                    : "Bill is Paid — Close Table →"}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. Expandable Cart Sheet Modal */}
      {isCartSheetOpen && (
        <div className="fixed inset-0 z-50 bg-stone-950/70 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-150">
          <div className="bg-white text-stone-900 rounded-t-3xl sm:rounded-3xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-stone-200 space-y-4 max-h-[85vh] flex flex-col animate-in slide-in-from-bottom duration-200">
            {/* Sheet Header */}
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <div className="flex items-center gap-2.5">
                <h3 className="font-black text-sm sm:text-base text-stone-900">
                  Order Summary ({totalCartCount} Items)
                </h3>
                <span className="text-xs font-tabular font-black text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-lg border border-emerald-200">
                  ₹{cartSubtotal}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCart([])}
                  className="text-stone-400 hover:text-rose-600 text-xs font-bold cursor-pointer"
                >
                  Clear All
                </button>
                <button
                  type="button"
                  onClick={() => setIsCartSheetOpen(false)}
                  className="text-stone-400 hover:text-stone-700 p-1 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Items List */}
            <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 no-scrollbar text-xs">
              {cart.map((c, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-2xl bg-stone-50/90 border border-stone-200/90 flex items-center justify-between gap-2.5 shadow-2xs"
                >
                  <div className="min-w-0 flex-1">
                    <span className="font-black text-stone-900 block truncate text-xs sm:text-sm">
                      {c.menuItem.localName || c.menuItem.name} {c.variantName ? `(${c.variantName === "Half" ? "हाफ" : c.variantName === "Full" ? "फुल" : c.variantName})` : ""}
                    </span>
                    {c.menuItem.localName && c.menuItem.name && c.menuItem.localName !== c.menuItem.name && (
                      <span className="text-[10px] font-semibold text-stone-500 block truncate">
                        {c.menuItem.name}
                      </span>
                    )}
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[11px] text-stone-500 font-tabular">
                        ₹{c.unitPrice} × {c.quantity} {isThaliOrMainCourseItem(c.menuItem) ? "थाळी" : ""}
                      </span>
                      <span className="text-[11px] font-tabular font-black text-stone-900">
                        = ₹{c.unitPrice * c.quantity}
                      </span>
                    </div>

                    {/* Bread Option Switcher & Custom Cooking Notes in Cart */}
                    <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                      {(c.breadOption || c.notes) && (
                        <span className="text-[10px] font-black bg-amber-200 text-stone-950 px-2 py-0.5 rounded-md shadow-2xs">
                          {c.notes || (c.breadOption ? (BREAD_OPTION_LABELS[c.breadOption]?.mr || c.breadOption) : "")}
                        </span>
                      )}
                      {c.breadOption &&
                        BREAD_OPTIONS.filter((b) => b.id !== c.breadOption).map((b) => (
                          <button
                            key={b.id}
                            type="button"
                            onClick={() => handleChangeCartItemBread(idx, b.id)}
                            className="text-[9px] font-bold text-stone-600 bg-white border border-stone-200 px-1.5 py-0.5 rounded-md hover:bg-stone-50 cursor-pointer"
                          >
                            {b.shortCode}
                          </button>
                        ))}
                      <button
                        type="button"
                        onClick={() => {
                          const note = prompt("Enter kitchen instruction (उदा. कमी तिखट, झणझणीत, रस्सा वेगळा):", c.customNote || "");
                          if (note !== null) {
                            const updated = [...cart];
                            const trimmed = note.trim();
                            updated[idx] = {
                              ...updated[idx],
                              customNote: trimmed,
                              notes: buildItemNotes(updated[idx].breadCounts, trimmed, updated[idx].spiceLevel)
                            };
                            setCart(updated);
                          }
                        }}
                        className="text-[9px] font-bold text-amber-900 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-1.5 py-0.5 rounded-md cursor-pointer flex items-center gap-0.5"
                      >
                        ✏️ {c.customNote ? c.customNote : "नोंद / Note"}
                      </button>
                    </div>
                  </div>

                  {/* Quantity Stepper + Trash */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <div className="flex items-center gap-1.5 bg-white border border-stone-200 px-2 py-1 rounded-xl shadow-2xs">
                      <button
                        type="button"
                        onClick={() => handleUpdateCartQuantity(idx, -1)}
                        className="w-6 h-6 flex items-center justify-center rounded-lg text-stone-600 font-bold active:scale-90 cursor-pointer"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="font-tabular font-black text-xs px-1 min-w-4 text-center">
                        {c.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleUpdateCartQuantity(idx, 1)}
                        className="w-6 h-6 flex items-center justify-center rounded-lg text-stone-600 font-bold active:scale-90 cursor-pointer"
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
                      className="w-7 h-7 flex items-center justify-center rounded-xl text-stone-400 hover:text-rose-600 hover:bg-rose-50 active:scale-90 transition-all cursor-pointer"
                      title="Remove item"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Packaging Breakdown & Totals */}
            <div className="space-y-2 pt-2 border-t border-stone-100">
              {isTakeaway && (
                <div className="bg-amber-50/90 border border-amber-200/90 rounded-xl px-3 py-2 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 text-amber-900 font-bold">
                    <span>🥡</span>
                    <span>Parcel Packaging (पॅकिंग शुल्क):</span>
                  </div>
                  <span className="font-tabular font-black text-amber-900">
                    +₹{packagingFee}
                  </span>
                </div>
              )}

              <div className="flex items-center justify-between px-1 text-xs">
                <span className="text-stone-500 font-bold">Items Total:</span>
                <span className="font-tabular font-black text-stone-900">₹{cartSubtotal}</span>
              </div>

              {isTakeaway && (
                <div className="flex items-center justify-between px-1 text-xs border-t border-stone-100 pt-1">
                  <span className="text-stone-700 font-black">Estimated Bill:</span>
                  <span className="font-tabular font-black text-emerald-700 text-sm">
                    ₹{cartSubtotal + packagingFee}
                  </span>
                </div>
              )}
            </div>

            {/* Send KOT Button(s) inside sheet */}
            <div className="pt-1">
              {isTakeaway ? (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={isSending}
                    onClick={handleSendKot}
                    className="py-3.5 px-2 bg-stone-900 hover:bg-stone-800 text-white font-black text-xs rounded-2xl flex items-center justify-center gap-1.5 shadow-md active:scale-95 transition-all touch-manipulation cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5 text-stone-300" />
                    <span>{isSending ? "Sending..." : "Send KOT Only"}</span>
                  </button>
                  <button
                    type="button"
                    disabled={isSending}
                    onClick={() => handleSendKotAndSettle("CASH")}
                    className="py-3.5 px-2 bg-gradient-to-r from-emerald-600 via-emerald-700 to-emerald-800 hover:from-emerald-500 hover:to-emerald-700 text-white font-black text-xs rounded-2xl flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-700/25 active:scale-95 transition-all touch-manipulation cursor-pointer border border-emerald-500/40"
                  >
                    <span>⚡ Pay & Send (₹{cartSubtotal + packagingFee})</span>
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  disabled={isSending}
                  onClick={handleSendKot}
                  className="w-full py-4 bg-gradient-to-r from-emerald-600 via-emerald-700 to-emerald-800 hover:from-emerald-500 hover:to-emerald-700 text-white font-black text-sm rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-700/25 active:scale-95 transition-all touch-manipulation cursor-pointer border border-emerald-500/40"
                >
                  <Send className="w-4 h-4 text-emerald-200" />
                  <span>{isSending ? "Sending..." : `Send KOT to Kitchen (₹${cartSubtotal})`}</span>
                </button>
              )}
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
        <div className="fixed inset-0 z-50 bg-stone-950/70 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-stone-200 text-stone-900 space-y-4">
            <div className="flex items-center gap-2 text-amber-600">
              <AlertTriangle className="w-5 h-5" />
              <h3 className="font-black text-sm">Manager Stock Override Required</h3>
            </div>
            <p className="text-xs text-stone-600 leading-relaxed">
              Selected portions exceed live recorded inventory. Enter Manager PIN (1234) to authorize sending KOT.
            </p>
            {overrideError && (
              <div className="p-2.5 bg-rose-50 text-rose-700 rounded-xl text-xs font-bold border border-rose-200">
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
                className="w-full bg-stone-50 border border-stone-300 rounded-xl px-3.5 py-2.5 text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-red-500"
              />
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowOverrideModal(false)}
                  className="px-3.5 py-2 text-xs font-bold text-stone-500 hover:text-stone-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-700 text-white rounded-xl text-xs font-black shadow-xs cursor-pointer"
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
        <div className="fixed inset-0 z-50 bg-stone-950/70 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-stone-200 text-stone-900 space-y-4">
            <h3 className="font-black text-sm text-stone-900">
              Move Party to Another Table
            </h3>
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-stone-500">Target Table</label>
              <select
                value={targetTableNumber}
                onChange={(e) => setTargetTableNumber(Number(e.target.value))}
                className="w-full bg-stone-50 border border-stone-200 rounded-xl p-3 text-xs font-bold"
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
            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowTransferModal(false)}
                className="px-3.5 py-2 text-xs font-bold text-stone-500 hover:text-stone-700 cursor-pointer"
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
                className="px-4 py-2 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs font-black shadow-xs cursor-pointer"
              >
                Confirm Move
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 10. Quick Settle & Close Table Modal (बिल भरले — टेबल बंद करा) */}
      {showSettleModal && (
        <div className="fixed inset-0 z-50 bg-stone-950/70 backdrop-blur-md flex items-center justify-center p-3.5 sm:p-4 animate-in fade-in duration-150">
          <div className="bg-white text-stone-900 rounded-3xl max-w-sm w-full p-5 sm:p-6 shadow-2xl border border-stone-200 space-y-4 animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <div className="flex items-center gap-2.5">
                <span className={`text-white font-black text-xs px-2.5 py-1 rounded-xl shadow-xs ${
                  party.isTakeaway || party.tableNumber === 0 ? "bg-amber-600" : "bg-red-600"
                }`}>
                  {party.isTakeaway || party.tableNumber === 0 ? `Parcel ${party.partyCode}` : `Table ${party.tableNumber}`}
                </span>
                <h3 className="font-black text-stone-900 text-base">
                  Bill is Paid (बिल भरले)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowSettleModal(false)}
                className="text-stone-400 hover:text-stone-700 p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Bill Summary */}
            <div className="bg-gradient-to-b from-[#FAF8F5] to-[#F5EFE6] border border-[#E7E2DA] rounded-2xl p-4 text-center space-y-1 shadow-2xs">
              <div className="text-xs text-stone-600 font-semibold">
                Party {party.partyCode}
                {party.customerName ? ` • ${party.customerName}` : ""}
              </div>
              <div className="text-3xl sm:text-4xl font-tabular font-black text-emerald-700 tracking-tight">
                ₹{runningGrandTotal}
              </div>
              {isTakeaway && party.runningSubtotal > 0 && (
                <div className="text-[11px] text-amber-800 font-bold">
                  Items: ₹{party.runningSubtotal} + Packaging: ₹{packagingFee}
                </div>
              )}
              <div className="text-[11px] text-stone-500 font-medium">
                {party.isTakeaway || party.tableNumber === 0
                  ? "Mark parcel as paid and ready for takeaway"
                  : `Mark settled and close Table ${party.tableNumber}`}
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

            {/* Confirm Settle Button */}
            <div className="pt-1 space-y-2">
              <button
                type="button"
                disabled={isSettling}
                onClick={() => handleQuickSettle(settleMethod)}
                className="w-full py-3.5 bg-gradient-to-r from-emerald-600 via-emerald-700 to-emerald-800 hover:from-emerald-500 hover:to-emerald-700 text-white font-black text-sm rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-700/25 active:scale-95 transition-all touch-manipulation cursor-pointer border border-emerald-500/40"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-200" />
                <span>
                  {isSettling
                    ? (party.isTakeaway || party.tableNumber === 0 ? "Completing Parcel..." : "Closing Table...")
                    : (party.isTakeaway || party.tableNumber === 0
                        ? `Confirm Paid & Complete Parcel (₹${runningGrandTotal}) →`
                        : `Confirm Paid & Close Table (₹${runningGrandTotal}) →`)}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setShowSettleModal(false)}
                className="w-full py-2 text-stone-500 hover:text-stone-800 font-bold text-xs text-center cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 11. Customer Details Modal */}
      {showCustomerModal && (
        <div className="fixed inset-0 z-50 bg-stone-950/70 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-stone-200 text-stone-900 space-y-4">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-lg">👤</span>
                <h3 className="font-black text-sm text-stone-900">
                  {isTakeaway ? "Customer Details (पार्सल ग्राहक)" : `Table ${party.tableNumber} Diner Info`}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowCustomerModal(false)}
                className="text-stone-400 hover:text-stone-700 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCustomerInfo} className="space-y-3">
              <div>
                <label className="text-[11px] font-bold text-stone-600 mb-1 block">
                  Customer Name (ग्राहकाचे नाव)
                </label>
                <input
                  type="text"
                  placeholder="उदा. राहुल कदम, सचिन सर"
                  value={custName}
                  onChange={(e) => setCustName(e.target.value)}
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3.5 py-2.5 text-xs font-bold text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-stone-600 mb-1 block">
                  Phone Number (फोन नंबर)
                </label>
                <input
                  type="tel"
                  placeholder="उदा. 9876543210"
                  value={custPhone}
                  onChange={(e) => setCustPhone(e.target.value)}
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3.5 py-2.5 text-xs font-mono font-bold text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-stone-600 mb-1 block">
                  Order / Pickup Note (नोंद)
                </label>
                <input
                  type="text"
                  placeholder="उदा. 15 मिनिटांनी घेणार, कारमध्ये द्या"
                  value={custNotes}
                  onChange={(e) => setCustNotes(e.target.value)}
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3.5 py-2.5 text-xs font-bold text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCustomerModal(false)}
                  className="px-3.5 py-2 text-xs font-bold text-stone-500 hover:text-stone-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-700 text-white rounded-xl text-xs font-black shadow-xs cursor-pointer"
                >
                  Save Details (जतन करा)
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 12. Convert Parcel to Dining Table Modal */}
      {showConvertToTableModal && (
        <div className="fixed inset-0 z-50 bg-stone-950/70 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-stone-200 text-stone-900 space-y-4">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-lg">🍽️</span>
                <h3 className="font-black text-sm text-stone-900">
                  Assign Parcel to Dining Table
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowConvertToTableModal(false)}
                className="text-stone-400 hover:text-stone-700 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-stone-600 leading-relaxed">
              Customer decided to dine in. This will remove packaging charges and bind existing KOT items to the selected table.
            </p>

            <form onSubmit={handleConvertToTableSubmit} className="space-y-3">
              <div>
                <label className="text-[11px] font-bold text-stone-500 mb-1 block">
                  Select Dining Table (टेबल निवडा)
                </label>
                <select
                  value={convertTargetTable}
                  onChange={(e) => setConvertTargetTable(Number(e.target.value))}
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl p-3 text-xs font-bold"
                >
                  {store.tables.map((t) => (
                    <option key={t.id} value={t.tableNumber}>
                      Table {t.tableNumber} — {t.status}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowConvertToTableModal(false)}
                  className="px-3.5 py-2 text-xs font-bold text-stone-500 hover:text-stone-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-700 text-white rounded-xl text-xs font-black shadow-xs cursor-pointer"
                >
                  Confirm Table Assignment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
