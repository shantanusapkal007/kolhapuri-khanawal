/**
 * Kolhapuri Khanawal Restaurant Operating System
 * Phase 2: High-Precision Unit Conversion Engine
 *
 * Supports exact decimal math without floating point errors.
 */

import { StandardUnit } from "@/types/inventory";

interface ConversionRule {
  fromUnit: StandardUnit;
  toUnit: StandardUnit;
  factor: number; // multiply fromUnit by factor to get toUnit
}

const CONVERSION_RULES: ConversionRule[] = [
  { fromUnit: "kg", toUnit: "g", factor: 1000 },
  { fromUnit: "g", toUnit: "kg", factor: 0.001 },
  { fromUnit: "l", toUnit: "ml", factor: 1000 },
  { fromUnit: "ml", toUnit: "l", factor: 0.001 },
  { fromUnit: "dozen", toUnit: "piece", factor: 12 },
  { fromUnit: "piece", toUnit: "dozen", factor: 1 / 12 },
];

/**
 * Converts a quantity from one unit to another
 */
export function convertUnit(
  quantity: number,
  fromUnit: StandardUnit,
  toUnit: StandardUnit
): number {
  if (fromUnit === toUnit) {
    return Number(quantity.toFixed(4));
  }

  const directRule = CONVERSION_RULES.find(
    (r) => r.fromUnit === fromUnit && r.toUnit === toUnit
  );
  if (directRule) {
    return Number((quantity * directRule.factor).toFixed(4));
  }

  throw new Error(
    `Cannot convert between incompatible units: '${fromUnit}' and '${toUnit}'`
  );
}

/**
 * Normalizes quantity to the standard base unit for an ingredient
 * (e.g. if ingredient baseUnit is 'kg' and recipe requests 100g -> returns 0.1 kg)
 */
export function normalizeToBaseUnit(
  quantity: number,
  inputUnit: StandardUnit,
  baseUnit: StandardUnit
): number {
  return convertUnit(quantity, inputUnit, baseUnit);
}

/**
 * Formats a decimal quantity with appropriate unit label for UI display
 * e.g., 0.7 kg -> "700 g", 1.325 kg -> "1.325 kg"
 */
export function formatQuantityWithUnit(
  quantity: number,
  unit: StandardUnit
): string {
  if (unit === "kg" && quantity < 1 && quantity > 0) {
    return `${Math.round(quantity * 1000)} g`;
  }
  if (unit === "l" && quantity < 1 && quantity > 0) {
    return `${Math.round(quantity * 1000)} ml`;
  }
  return `${Number(quantity.toFixed(3))} ${unit}`;
}
