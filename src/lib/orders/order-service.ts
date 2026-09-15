/**
 * Kolhapuri Khanawal Restaurant Operating System
 * Phase 5 & 6: Order & KOT Atomic Service Engine
 */

import {
  Order,
  OrderItem,
  Kot,
  KotItem,
  KotEvent,
  KotStatus,
  MenuItem,
  KitchenStationCode,
  BreadOption,
} from "@/types/orders";
import { DiningParty } from "@/types/tables";
import { Ingredient, Recipe, StockReservation, StockTransaction } from "@/types/inventory";
import { checkStockAvailability, createReservations } from "@/lib/inventory/stock-reservation";
import { executeStockMovement } from "@/lib/inventory/ledger";

export interface PlaceOrderItemInput {
  menuItem: MenuItem;
  quantity: number;
  seatNumber?: number;
  spiceLevel?: "MILD" | "MEDIUM" | "SPICY" | "THECHA_EXTRA_SPICY";
  breadOption?: BreadOption;
  notes?: string;
  variantName?: string;
  unitPrice?: number;
}

export interface PlaceOrderParams {
  party: DiningParty;
  waiterId: string;
  waiterName: string;
  items: PlaceOrderItemInput[];
  recipesMap: Map<string, Recipe>;
  ingredientsMap: Map<string, Ingredient>;
  idempotencyKey: string;
  allowNegativeStockOverride?: boolean;
  kotSequenceNumber?: number;
  isAddOn?: boolean;
}

let kotSequence = 1045;
let orderSequence = 2001;

/**
 * Places an order atomically, reserves stock, and generates a Kitchen Order Ticket (KOT)
 */
export function placeOrderAndGenerateKot(
  params: PlaceOrderParams
): {
  order: Order;
  kot: Kot;
  reservations: StockReservation[];
  updatedIngredientsMap: Map<string, Ingredient>;
} {
  const {
    party,
    waiterId,
    waiterName,
    items,
    recipesMap,
    ingredientsMap,
    idempotencyKey,
    allowNegativeStockOverride = false,
    kotSequenceNumber = 1,
    isAddOn = false,
  } = params;

  if (party.status === "CLOSED" || party.status === "CANCELLED") {
    throw new Error(`Cannot place order: Party ${party.partyCode} is ${party.status}`);
  }

  // 1. Validate Stock Reservation across all ordered recipes
  const recipeRequirements: { recipe: Recipe; quantity: number }[] = [];
  for (const it of items) {
    const recipe = recipesMap.get(it.menuItem.id);
    if (recipe) {
      recipeRequirements.push({ recipe, quantity: it.quantity });
    }
  }

  const stockCheck = checkStockAvailability(recipeRequirements, ingredientsMap);
  if (!stockCheck.isAvailable && !allowNegativeStockOverride) {
    throw new Error(stockCheck.deficitMessage || "Insufficient stock for selected items");
  }

  // 2. Generate IDs & Numbers
  const orderId = `ord-${Date.now()}`;
  orderSequence += 1;
  const orderNumber = `ORD-2026-${String(orderSequence).padStart(6, "0")}`;

  const kotId = `kot-${Date.now()}`;
  kotSequence += 1;
  const kotNumber = `KOT-2026-${String(kotSequence).padStart(6, "0")}`;

  const now = new Date().toISOString();

  // 3. Build Order Items
  let subtotal = 0;
  const orderItems: OrderItem[] = items.map((it, idx) => {
    const itemPrice = it.unitPrice ?? it.menuItem.sellingPrice;
    const itemTotal = itemPrice * it.quantity;
    subtotal += itemTotal;

    return {
      id: `item-${orderId}-${idx + 1}`,
      orderId,
      partyId: party.id,
      menuItemId: it.menuItem.id,
      menuItemName: it.variantName ? `${it.menuItem.name} (${it.variantName})` : it.menuItem.name,
      variantName: it.variantName,
      quantity: it.quantity,
      unitPrice: itemPrice,
      totalPrice: itemTotal,
      seatNumber: it.seatNumber,
      spiceLevel: it.spiceLevel || "MEDIUM",
      breadOption: it.breadOption,
      notes: it.notes,
      kotId,
      kotNumber,
      kotStatus: "NEW",
      isCancelled: false,
    };
  });

  const order: Order = {
    id: orderId,
    orderNumber,
    partyId: party.id,
    partyCode: party.partyCode,
    tableNumber: party.tableNumber,
    waiterId,
    waiterName,
    status: "KOT_SENT",
    idempotencyKey,
    items: orderItems,
    subtotal,
    createdAt: now,
    updatedAt: now,
  };

  // 4. Build KOT
  const primaryStation = items[0]?.menuItem.stationCode || "MAIN_KITCHEN";
  const kotItems: KotItem[] = orderItems.map((oi) => ({
    id: `kot-item-${oi.id}`,
    kotId,
    orderItemId: oi.id,
    menuItemId: oi.menuItemId,
    menuItemName: oi.menuItemName,
    variantName: oi.variantName,
    quantity: oi.quantity,
    seatNumber: oi.seatNumber,
    spiceLevel: oi.spiceLevel,
    breadOption: oi.breadOption,
    notes: oi.notes,
    status: "NEW",
  }));

  const kot: Kot = {
    id: kotId,
    kotNumber,
    orderId,
    partyId: party.id,
    partyCode: party.partyCode,
    tableNumber: party.tableNumber,
    waiterId,
    waiterName,
    stationCode: primaryStation,
    guestCount: party.guestCount,
    status: "NEW",
    items: kotItems,
    notes: items.map((i) => i.notes).filter(Boolean).join("; "),
    elapsedSeconds: 0,
    urgencyLevel: "NORMAL",
    kotSequenceNumber,
    isAddOn,
    isTakeaway: party.isTakeaway,
    customerName: party.customerName,
    createdAt: now,
  };

  // 5. Create 3-Tier Stock Reservations & Update ingredient reserved counts
  const reservations = createReservations(orderId, party.id, stockCheck.requirements);
  const updatedIngredientsMap = new Map(ingredientsMap);

  for (const req of stockCheck.requirements) {
    const currentIng = updatedIngredientsMap.get(req.ingredientId);
    if (currentIng) {
      const newReserved = Number((currentIng.reservedStock + req.requiredQuantity).toFixed(4));
      updatedIngredientsMap.set(req.ingredientId, {
        ...currentIng,
        reservedStock: newReserved,
        availableStock: Math.max(0, currentIng.physicalStock - newReserved),
      });
    }
  }

  return { order, kot, reservations, updatedIngredientsMap };
}

/**
 * Transitions KOT status in the kitchen and executes stock consumption upon preparation
 */
export function transitionKotStatus(
  kot: Kot,
  newStatus: KotStatus,
  performedBy: string,
  performedByName: string,
  reservations: StockReservation[],
  ingredientsMap: Map<string, Ingredient>
): {
  updatedKot: Kot;
  event: KotEvent;
  stockTransactions: StockTransaction[];
  updatedIngredientsMap: Map<string, Ingredient>;
} {
  const now = new Date().toISOString();
  const updatedKot: Kot = {
    ...kot,
    status: newStatus,
    acknowledgedAt: newStatus === "ACKNOWLEDGED" ? now : kot.acknowledgedAt,
    readyAt: newStatus === "READY" ? now : kot.readyAt,
    servedAt: newStatus === "SERVED" ? now : kot.servedAt,
  };

  const event: KotEvent = {
    id: `event-${Date.now()}`,
    kotId: kot.id,
    kotNumber: kot.kotNumber,
    eventType:
      newStatus === "PREPARING"
        ? "STARTED_PREPARATION"
        : newStatus === "READY"
        ? "MARKED_READY"
        : newStatus === "SERVED"
        ? "SERVED"
        : "ACKNOWLEDGED",
    performedBy,
    performedByName,
    role: "KITCHEN",
    timestamp: now,
  };

  const stockTransactions: StockTransaction[] = [];
  const updatedIngredientsMap = new Map(ingredientsMap);

  // When kitchen begins PREPARING or READY, convert reservations to actual consumed stock in the ledger
  if (newStatus === "PREPARING" || (newStatus === "READY" && kot.status === "NEW")) {
    for (const res of reservations.filter((r) => r.status === "RESERVED" && (r.orderId === kot.orderId || r.partyId === kot.partyId))) {
      const ing = updatedIngredientsMap.get(res.ingredientId);
      if (ing) {
        const movement = executeStockMovement({
          ingredient: ing,
          transactionType: "SALE_CONSUMPTION",
          quantity: res.quantity,
          unit: res.unit,
          direction: "OUT",
          referenceType: "KOT_ORDER",
          referenceId: kot.kotNumber,
          unitCost: ing.weightedAvgCostPerUnit,
          performedBy,
          notes: `Consumed for ${kot.kotNumber} (${kot.partyCode})`,
        });

        // Release reservation and set final stock
        const finalIng: Ingredient = {
          ...movement.updatedIngredient,
          reservedStock: Math.max(0, movement.updatedIngredient.reservedStock - res.quantity),
          availableStock: Math.max(0, movement.updatedIngredient.physicalStock - (movement.updatedIngredient.reservedStock - res.quantity)),
        };

        updatedIngredientsMap.set(ing.id, finalIng);
        stockTransactions.push(movement.transaction);
        res.status = "CONSUMED";
      }
    }
  }

  return { updatedKot, event, stockTransactions, updatedIngredientsMap };
}
