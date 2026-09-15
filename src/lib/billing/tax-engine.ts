/**
 * Kolhapuri Khanawal Restaurant Operating System
 * Phase 7: Configurable Multi-Rate Tax Engine
 */

import { TaxRate } from "@/types/billing";

export interface ItemTaxCalculation {
  taxableAmount: number;
  cgstRate: number;
  cgstAmount: number;
  sgstRate: number;
  sgstAmount: number;
  igstRate: number;
  igstAmount: number;
  vatRate: number;
  vatAmount: number;
  totalTaxAmount: number;
  effectiveTotal: number;
}

/**
 * Calculates deterministic tax components for a single line item
 */
export function calculateItemTax(
  itemPrice: number,
  quantity: number,
  taxRate: TaxRate
): ItemTaxCalculation {
  const lineTotal = itemPrice * quantity;

  if (taxRate.isTaxExempt || taxRate.totalRate === 0) {
    return {
      taxableAmount: lineTotal,
      cgstRate: 0,
      cgstAmount: 0,
      sgstRate: 0,
      sgstAmount: 0,
      igstRate: 0,
      igstAmount: 0,
      vatRate: 0,
      vatAmount: 0,
      totalTaxAmount: 0,
      effectiveTotal: lineTotal,
    };
  }

  let taxableAmount = lineTotal;
  if (taxRate.isTaxInclusive) {
    // If tax inclusive: taxable = lineTotal / (1 + totalRate/100)
    taxableAmount = Number((lineTotal / (1 + taxRate.totalRate / 100)).toFixed(2));
  }

  const cgstAmount = Number(((taxableAmount * taxRate.cgstRate) / 100).toFixed(2));
  const sgstAmount = Number(((taxableAmount * taxRate.sgstRate) / 100).toFixed(2));
  const igstAmount =
    taxRate.cgstRate > 0 || taxRate.sgstRate > 0
      ? 0
      : Number(((taxableAmount * taxRate.igstRate) / 100).toFixed(2));
  const vatAmount = Number(((taxableAmount * taxRate.vatRate) / 100).toFixed(2));

  const totalTaxAmount = Number(
    (cgstAmount + sgstAmount + igstAmount + (taxRate.vatRate > 0 ? vatAmount : 0)).toFixed(2)
  );
  const effectiveTotal = taxRate.isTaxInclusive
    ? lineTotal
    : Number((taxableAmount + totalTaxAmount).toFixed(2));

  return {
    taxableAmount,
    cgstRate: taxRate.cgstRate,
    cgstAmount,
    sgstRate: taxRate.sgstRate,
    sgstAmount,
    igstRate: taxRate.igstRate,
    igstAmount,
    vatRate: taxRate.vatRate,
    vatAmount,
    totalTaxAmount,
    effectiveTotal,
  };
}
