/**
 * Kolhapuri Khanawal Restaurant Operating System
 * Phase 3: 3-Tier Stock Reservation Engine
 *
 * Tier 1: Physical Stock (Total in storage)
 * Tier 2: Reserved Stock (Locked by active in-flight orders/KOTs)
 * Tier 3: Available Stock = Physical Stock - Reserved Stock
 */

import { Ingredient, Recipe, StockReservation } from "@/types/inventory";
import { normalizeToBaseUnit } from "./unit-converter";

export interface StockReservationRequirement {
  ingredientId: string;
  ingredientName: string;
  requiredQuantity: number;
  unit: string;
  availableStock: number;
  isDeficit: boolean;
}

/**
 * Checks whether all ingredients for a batch of ordered items can be reserved
 */
export function checkStockAvailability(
  items: { recipe: Recipe; quantity: number }[],
  ingredientsMap: Map<string, Ingredient>
): {
  isAvailable: boolean;
  requirements: StockReservationRequirement[];
  deficitMessage?: string;
} {
  const aggregatedRequirements = new Map<
    string,
    { ingredient: Ingredient; totalNeeded: number }
  >();

  // Aggregate requirements across all ordered recipes
  for (const { recipe, quantity } of items) {
    for (const comp of recipe.components) {
      if (comp.componentType === "RAW_INGREDIENT" && comp.ingredientId) {
        const ing = ingredientsMap.get(comp.ingredientId);
        if (!ing) continue;

        const neededInBaseUnit = normalizeToBaseUnit(
          comp.quantity * quantity * (comp.yieldFactor || 1.0),
          comp.unit,
          ing.baseUnit
        );

        const current = aggregatedRequirements.get(ing.id) || {
          ingredient: ing,
          totalNeeded: 0,
        };
        current.totalNeeded += neededInBaseUnit;
        aggregatedRequirements.set(ing.id, current);
      }
    }
  }

  const requirements: StockReservationRequirement[] = [];
  let isAvailable = true;
  let deficitMessage: string | undefined = undefined;

  for (const { ingredient, totalNeeded } of aggregatedRequirements.values()) {
    const available = Math.max(
      0,
      ingredient.physicalStock - ingredient.reservedStock
    );
    const isDeficit = available < totalNeeded;

    requirements.push({
      ingredientId: ingredient.id,
      ingredientName: ingredient.name,
      requiredQuantity: Number(totalNeeded.toFixed(4)),
      unit: ingredient.baseUnit,
      availableStock: Number(available.toFixed(4)),
      isDeficit,
    });

    if (isDeficit) {
      isAvailable = false;
      deficitMessage = `${ingredient.name} stock is insufficient for this order. Available: ${available} ${ingredient.baseUnit}. Required: ${totalNeeded} ${ingredient.baseUnit}.`;
    }
  }

  return { isAvailable, requirements, deficitMessage };
}

/**
 * Creates reservation records for active orders
 */
export function createReservations(
  orderId: string,
  partyId: string,
  requirements: StockReservationRequirement[]
): StockReservation[] {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 2 * 60 * 60 * 1000); // 2 hr expiry

  return requirements.map((req, idx) => ({
    id: `res-${orderId}-${idx}`,
    partyId,
    orderId,
    orderItemId: `item-${orderId}-${idx}`,
    ingredientId: req.ingredientId,
    quantity: req.requiredQuantity,
    unit: req.unit as any,
    status: "RESERVED",
    reservedAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
  }));
}
