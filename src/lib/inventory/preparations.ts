/**
 * Kolhapuri Khanawal Restaurant Operating System
 * Phase 2: Intermediate Kitchen Preparations & Batch Engine
 */

import {
  Preparation,
  PreparationBatch,
  PreparationComponent,
  StandardUnit,
} from "@/types/inventory";

export interface CreateBatchParams {
  preparation: Preparation;
  rawInputQuantity: number;
  outputQuantityProduced: number;
  outputUnit: StandardUnit;
  preparedBy: string;
  componentCosts: { ingredientId: string; totalCost: number }[];
}

/**
 * Calculates preparation yield percentage
 * e.g., 10 kg raw input -> 7.5 kg output yields 75%
 */
export function calculatePreparationYield(
  rawInput: number,
  outputProduced: number
): number {
  if (rawInput <= 0) return 0;
  return Number(((outputProduced / rawInput) * 100).toFixed(2));
}

/**
 * Creates an intermediate preparation batch with batch number, expiration, and unit cost
 */
export function createPreparationBatch(
  params: CreateBatchParams
): PreparationBatch {
  const {
    preparation,
    rawInputQuantity,
    outputQuantityProduced,
    outputUnit,
    preparedBy,
    componentCosts,
  } = params;

  const totalCost = componentCosts.reduce((acc, c) => acc + c.totalCost, 0);
  const unitCost =
    outputQuantityProduced > 0
      ? Number((totalCost / outputQuantityProduced).toFixed(2))
      : 0;

  const now = new Date();
  const expiresAt = new Date(
    now.getTime() + preparation.shelfLifeHours * 60 * 60 * 1000
  );

  const batchNumber = `BATCH-${preparation.name
    .replace(/\s+/g, "")
    .toUpperCase()
    .slice(0, 4)}-${Date.now().toString().slice(-6)}`;

  return {
    id: `batch-${Date.now()}`,
    batchNumber,
    preparationId: preparation.id,
    preparationName: preparation.name,
    rawInputQuantity,
    outputQuantityProduced,
    outputUnit,
    preparedBy,
    preparedAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    costTotal: totalCost,
    unitCost,
    status: "ACTIVE",
  };
}
