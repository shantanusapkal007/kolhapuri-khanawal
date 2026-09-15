/**
 * Kolhapuri Khanawal Restaurant Operating System
 * Phase 9: Reports & Theoretical vs Actual Stock Variance Engine
 */

import { Ingredient, StockTransaction } from "@/types/inventory";

export interface StockVarianceReportRow {
  ingredientId: string;
  ingredientName: string;
  unit: string;
  openingStock: number;
  purchasesQuantity: number;
  salesConsumptionQuantity: number;
  wastageQuantity: number;
  adjustmentsQuantity: number;
  expectedTheoreticalStock: number;
  actualPhysicalStock: number;
  varianceQuantity: number;
  variancePercentage: number;
  unitCost: number;
  financialLeakageValue: number;
  varianceStatus: "EXACT_MATCH" | "NORMAL_VARIANCE" | "HIGH_VARIANCE" | "LEAKAGE_RISK";
}

export interface InventoryForecastingRow {
  ingredientId: string;
  ingredientName: string;
  currentStock: number;
  unit: string;
  averageDailyConsumption: number;
  estimatedDaysRemaining: number;
  reorderStatus: "HEALTHY" | "WATCH" | "ORDER_SOON" | "CRITICAL_ORDER_NOW" | "OUT_OF_STOCK";
  suggestedReorderQuantity: number;
}

/**
 * Calculates Theoretical vs Actual Stock Variance from transaction ledger records
 */
export function calculateTheoreticalVsActualStock(
  ingredient: Ingredient,
  openingStock: number,
  transactions: StockTransaction[],
  physicalCount: number
): StockVarianceReportRow {
  let purchasesQty = 0;
  let salesQty = 0;
  let wastageQty = 0;
  let adjustmentsQty = 0;

  for (const tx of transactions.filter((t) => t.ingredientId === ingredient.id)) {
    switch (tx.transactionType) {
      case "PURCHASE":
        purchasesQty += tx.quantity;
        break;
      case "SALE_CONSUMPTION":
        salesQty += tx.quantity;
        break;
      case "WASTAGE":
      case "SPOILAGE":
        wastageQty += tx.quantity;
        break;
      case "STOCK_ADJUSTMENT":
        adjustmentsQty += tx.direction === "IN" ? tx.quantity : -tx.quantity;
        break;
    }
  }

  // Expected = Opening + Purchases - Sales - Wastage ± Adjustments
  const expectedTheoreticalStock = Number(
    (openingStock + purchasesQty - salesQty - wastageQty + adjustmentsQty).toFixed(4)
  );

  const varianceQuantity = Number((physicalCount - expectedTheoreticalStock).toFixed(4));
  const variancePercentage =
    expectedTheoreticalStock > 0
      ? Number(((varianceQuantity / expectedTheoreticalStock) * 100).toFixed(2))
      : 0;

  const financialLeakageValue = Number(
    (Math.abs(varianceQuantity) * ingredient.weightedAvgCostPerUnit).toFixed(2)
  );

  let varianceStatus: StockVarianceReportRow["varianceStatus"] = "EXACT_MATCH";
  if (Math.abs(varianceQuantity) < 0.001) {
    varianceStatus = "EXACT_MATCH";
  } else if (Math.abs(variancePercentage) <= 5.0) {
    varianceStatus = "NORMAL_VARIANCE";
  } else if (Math.abs(variancePercentage) <= 15.0) {
    varianceStatus = "HIGH_VARIANCE";
  } else {
    varianceStatus = "LEAKAGE_RISK";
  }

  return {
    ingredientId: ingredient.id,
    ingredientName: ingredient.name,
    unit: ingredient.baseUnit,
    openingStock,
    purchasesQuantity: purchasesQty,
    salesConsumptionQuantity: salesQty,
    wastageQuantity: wastageQty,
    adjustmentsQuantity: adjustmentsQty,
    expectedTheoreticalStock,
    actualPhysicalStock: physicalCount,
    varianceQuantity,
    variancePercentage,
    unitCost: ingredient.weightedAvgCostPerUnit,
    financialLeakageValue,
    varianceStatus,
  };
}

/**
 * Calculates simple operational statistical forecasting for ingredients
 */
export function calculateInventoryForecast(
  ingredient: Ingredient,
  averageDailyUse: number
): InventoryForecastingRow {
  const currentStock = ingredient.physicalStock;
  const daysRemaining =
    averageDailyUse > 0
      ? Number((currentStock / averageDailyUse).toFixed(1))
      : 99.0;

  let reorderStatus: InventoryForecastingRow["reorderStatus"] = "HEALTHY";
  if (currentStock <= 0) {
    reorderStatus = "OUT_OF_STOCK";
  } else if (daysRemaining <= 1.0 || currentStock <= ingredient.criticalLevel) {
    reorderStatus = "CRITICAL_ORDER_NOW";
  } else if (daysRemaining <= 2.5 || currentStock <= ingredient.reorderLevel) {
    reorderStatus = "ORDER_SOON";
  } else if (currentStock < ingredient.parLevel) {
    reorderStatus = "WATCH";
  }

  // Suggested reorder = Par Level - Current Stock
  const suggestedReorderQuantity = Math.max(0, Number((ingredient.parLevel - currentStock).toFixed(2)));

  return {
    ingredientId: ingredient.id,
    ingredientName: ingredient.name,
    currentStock,
    unit: ingredient.baseUnit,
    averageDailyConsumption: averageDailyUse,
    estimatedDaysRemaining: daysRemaining,
    reorderStatus,
    suggestedReorderQuantity,
  };
}
