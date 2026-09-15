/**
 * Kolhapuri Khanawal Restaurant Operating System
 * Phase 3: Authoritative Stock Movement Ledger
 *
 * Implements double-entry inventory ledger with Weighted Average Costing (WAC)
 * and physical stock count reconciliation.
 */

import {
  Ingredient,
  StockTransaction,
  StockTransactionType,
  StandardUnit,
  StockCountItem,
} from "@/types/inventory";

export interface RecordTransactionParams {
  ingredient: Ingredient;
  transactionType: StockTransactionType;
  quantity: number;
  unit: StandardUnit;
  direction: "IN" | "OUT";
  referenceType: StockTransaction["referenceType"];
  referenceId: string;
  unitCost: number;
  performedBy: string;
  notes?: string;
}

/**
 * Records a transaction to the stock ledger and computes the new physical stock and running balance
 */
export function executeStockMovement(
  params: RecordTransactionParams
): {
  transaction: StockTransaction;
  updatedIngredient: Ingredient;
} {
  const {
    ingredient,
    transactionType,
    quantity,
    unit,
    direction,
    referenceType,
    referenceId,
    unitCost,
    performedBy,
    notes,
  } = params;

  let newPhysicalStock = ingredient.physicalStock;
  let newWac = ingredient.weightedAvgCostPerUnit;

  if (direction === "IN") {
    // Recalculate Weighted Average Cost on inbound purchase
    const currentValuation = ingredient.physicalStock * ingredient.weightedAvgCostPerUnit;
    const incomingValuation = quantity * unitCost;
    const totalQty = ingredient.physicalStock + quantity;

    newWac = totalQty > 0 ? Number(((currentValuation + incomingValuation) / totalQty).toFixed(2)) : unitCost;
    newPhysicalStock = Number((ingredient.physicalStock + quantity).toFixed(4));
  } else {
    // Outbound consumption or wastage reduces physical stock
    newPhysicalStock = Number(Math.max(0, ingredient.physicalStock - quantity).toFixed(4));
  }

  const transaction: StockTransaction = {
    id: `tx-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    ingredientId: ingredient.id,
    ingredientName: ingredient.name,
    transactionType,
    quantity,
    unit,
    direction,
    referenceType,
    referenceId,
    unitCost,
    totalValue: Number((quantity * unitCost).toFixed(2)),
    runningBalance: newPhysicalStock,
    performedBy,
    notes,
    timestamp: new Date().toISOString(),
  };

  const updatedIngredient: Ingredient = {
    ...ingredient,
    physicalStock: newPhysicalStock,
    weightedAvgCostPerUnit: newWac,
    currentCostPerUnit: unitCost > 0 ? unitCost : ingredient.currentCostPerUnit,
    availableStock: Math.max(0, newPhysicalStock - ingredient.reservedStock),
    updatedAt: new Date().toISOString(),
  };

  return { transaction, updatedIngredient };
}

/**
 * Reconciles physical stock count against theoretical system stock
 */
export function reconcilePhysicalCount(
  ingredient: Ingredient,
  physicalCount: number,
  performedBy: string,
  reason: StockCountItem["varianceReason"] = "UNKNOWN_VARIANCE",
  notes?: string
): {
  countItem: StockCountItem;
  adjustmentTransaction?: StockTransaction;
  updatedIngredient: Ingredient;
} {
  const theoreticalStock = ingredient.physicalStock;
  const varianceQuantity = Number((physicalCount - theoreticalStock).toFixed(4));
  const variancePercentage =
    theoreticalStock > 0
      ? Number(((varianceQuantity / theoreticalStock) * 100).toFixed(2))
      : 0;
  const varianceValue = Number(
    (varianceQuantity * ingredient.weightedAvgCostPerUnit).toFixed(2)
  );

  let adjustmentTransaction: StockTransaction | undefined = undefined;
  let updatedIngredient = { ...ingredient };

  if (Math.abs(varianceQuantity) > 0.0001) {
    const direction = varianceQuantity > 0 ? "IN" : "OUT";
    const absQty = Math.abs(varianceQuantity);

    const result = executeStockMovement({
      ingredient,
      transactionType: "STOCK_COUNT",
      quantity: absQty,
      unit: ingredient.baseUnit,
      direction,
      referenceType: "STOCK_COUNT",
      referenceId: `COUNT-${Date.now()}`,
      unitCost: ingredient.weightedAvgCostPerUnit,
      performedBy,
      notes: notes || `Physical stock count adjustment: ${varianceQuantity > 0 ? '+' : ''}${varianceQuantity} ${ingredient.baseUnit} (${reason})`,
    });

    adjustmentTransaction = result.transaction;
    updatedIngredient = result.updatedIngredient;
  }

  const countItem: StockCountItem = {
    id: `count-item-${Date.now()}`,
    stockCountId: `count-${Date.now()}`,
    ingredientId: ingredient.id,
    ingredientName: ingredient.name,
    unit: ingredient.baseUnit,
    theoreticalStock,
    physicalCount,
    varianceQuantity,
    variancePercentage,
    varianceValue,
    varianceReason: reason,
    adjustmentTransactionId: adjustmentTransaction?.id,
  };

  return { countItem, adjustmentTransaction, updatedIngredient };
}
