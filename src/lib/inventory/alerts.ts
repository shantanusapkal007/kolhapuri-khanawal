/**
 * Kolhapuri Khanawal Restaurant Operating System
 * Phase 3: Stock Alert Engine
 */

import { Ingredient, StockHealthStatus } from "@/types/inventory";

export interface StockAlert {
  ingredientId: string;
  ingredientName: string;
  categoryName?: string;
  currentStock: number;
  unit: string;
  status: StockHealthStatus;
  urgency: "NONE" | "INFO" | "WARNING" | "CRITICAL";
  message: string;
  actionRequired?: string;
}

/**
 * Determines the stock health status based on ingredient thresholds
 */
export function evaluateStockHealth(ingredient: Ingredient): StockHealthStatus {
  const stock = ingredient.physicalStock;

  if (stock <= 0) return "OUT_OF_STOCK";
  if (stock <= ingredient.criticalLevel) return "CRITICAL";
  if (stock <= ingredient.reorderLevel) return "LOW";
  if (stock < ingredient.parLevel) return "WATCH";
  return "HEALTHY";
}

/**
 * Generates stock alerts for all monitored ingredients
 */
export function generateStockAlerts(ingredients: Ingredient[]): StockAlert[] {
  const alerts: StockAlert[] = [];

  for (const ing of ingredients) {
    const status = evaluateStockHealth(ing);
    if (status === "HEALTHY") continue;

    let urgency: StockAlert["urgency"] = "INFO";
    let message = "";
    let actionRequired = "";

    switch (status) {
      case "OUT_OF_STOCK":
        urgency = "CRITICAL";
        message = `${ing.name} is completely OUT OF STOCK (0 ${ing.baseUnit}). All recipes requiring this item are now blocked.`;
        actionRequired = "Immediate purchase / emergency stock replenishment needed.";
        break;
      case "CRITICAL":
        urgency = "CRITICAL";
        message = `${ing.name} is at CRITICAL level (${ing.physicalStock} ${ing.baseUnit} remaining, threshold: ${ing.criticalLevel} ${ing.baseUnit}).`;
        actionRequired = "Urgent supplier order required before dinner rush.";
        break;
      case "LOW":
        urgency = "WARNING";
        message = `${ing.name} has fallen below reorder level (${ing.physicalStock} ${ing.baseUnit} remaining, reorder at ${ing.reorderLevel} ${ing.baseUnit}).`;
        actionRequired = "Place purchase order with supplier today.";
        break;
      case "WATCH":
        urgency = "INFO";
        message = `${ing.name} is below par level (${ing.physicalStock} ${ing.baseUnit} remaining, par: ${ing.parLevel} ${ing.baseUnit}).`;
        actionRequired = "Monitor consumption rate.";
        break;
    }

    alerts.push({
      ingredientId: ing.id,
      ingredientName: ing.name,
      categoryName: ing.categoryName,
      currentStock: ing.physicalStock,
      unit: ing.baseUnit,
      status,
      urgency,
      message,
      actionRequired,
    });
  }

  // Sort by urgency: CRITICAL first, then WARNING, then INFO
  const urgencyWeight = { CRITICAL: 3, WARNING: 2, INFO: 1, NONE: 0 };
  return alerts.sort((a, b) => urgencyWeight[b.urgency] - urgencyWeight[a.urgency]);
}
