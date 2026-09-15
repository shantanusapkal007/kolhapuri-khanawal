/**
 * Kolhapuri Khanawal Restaurant Operating System
 * Phase 7: Billing & Multi-Tender Settlement Service
 */

import { Bill, BillItem, Payment, PaymentMethodType, TaxRate } from "@/types/billing";
import { OrderItem } from "@/types/orders";
import { DiningParty } from "@/types/tables";
import { calculateItemTax } from "./tax-engine";

export interface GenerateBillParams {
  party: DiningParty;
  orderItems: OrderItem[];
  taxRatesMap: Map<string, TaxRate>;
  defaultTaxRate: TaxRate;
  cashierId: string;
  cashierName: string;
  discountPercentage?: number;
  discountFlatAmount?: number;
  discountReason?: string;
  discountApprovedBy?: string;
}

let billSequence = 1001;

/**
 * Generates an itemized bill for a dining party with tax calculation and round-off
 */
export function generatePartyBill(params: GenerateBillParams): Bill {
  const {
    party,
    orderItems,
    taxRatesMap,
    defaultTaxRate,
    cashierId,
    cashierName,
    discountPercentage = 0,
    discountFlatAmount = 0,
    discountReason,
    discountApprovedBy,
  } = params;

  billSequence += 1;
  const billId = `bill-${Date.now()}`;
  const billNumber = `BILL-2026-${String(billSequence).padStart(6, "0")}`;
  const now = new Date().toISOString();

  let subtotal = 0;
  let totalCgst = 0;
  let totalSgst = 0;
  let totalIgst = 0;
  let totalVat = 0;
  let totalTax = 0;

  const validItems = orderItems.filter((i) => !i.isCancelled);

  const billItems: BillItem[] = validItems.map((it, idx) => {
    const rate = taxRatesMap.get(defaultTaxRate.id) || defaultTaxRate;
    const taxCalc = calculateItemTax(it.unitPrice, it.quantity, rate);

    subtotal += it.totalPrice;
    totalCgst += taxCalc.cgstAmount;
    totalSgst += taxCalc.sgstAmount;
    totalIgst += taxCalc.igstAmount;
    totalVat += taxCalc.vatAmount;
    totalTax += taxCalc.totalTaxAmount;

    return {
      id: `bill-item-${billId}-${idx + 1}`,
      billId,
      orderItemId: it.id,
      menuItemId: it.menuItemId,
      menuItemName: it.menuItemName,
      quantity: it.quantity,
      unitPrice: it.unitPrice,
      totalPrice: it.totalPrice,
      seatNumber: it.seatNumber,
      taxRateId: rate.id,
      taxRatePercentage: rate.totalRate,
      taxAmount: taxCalc.totalTaxAmount,
      isComplimentary: false,
      breadOption: it.breadOption,
    };
  });

  // Calculate Discounts
  let discountAmount = 0;
  if (discountPercentage > 0) {
    discountAmount = Number(((subtotal * discountPercentage) / 100).toFixed(2));
  } else if (discountFlatAmount > 0) {
    discountAmount = Math.min(subtotal, discountFlatAmount);
  }

  const packagingCharges = party.packagingCharges || (party.isTakeaway ? 20 : 0);
  const taxableAmount = Math.max(0, subtotal - discountAmount);

  // If discount applied, scale taxes so GST is computed on the net taxable amount (CGST Act Sec 15(3))
  const discountFactor = subtotal > 0 ? taxableAmount / subtotal : 1;
  const finalCgst = Number((totalCgst * discountFactor).toFixed(2));
  const finalSgst = Number((totalSgst * discountFactor).toFixed(2));
  const finalIgst = Number((totalIgst * discountFactor).toFixed(2));
  const finalVat = Number((totalVat * discountFactor).toFixed(2));
  const finalTotalTax = Number((finalCgst + finalSgst + finalIgst + finalVat).toFixed(2));

  const unroundedTotal = taxableAmount + finalTotalTax + packagingCharges;
  const roundedGrandTotal = Math.round(unroundedTotal);
  const roundOff = Number((roundedGrandTotal - unroundedTotal).toFixed(2));

  return {
    id: billId,
    billNumber,
    partyId: party.id,
    partyCode: party.partyCode,
    tableId: party.tableId,
    tableNumber: party.tableNumber,
    waiterId: party.assignedWaiterId,
    waiterName: party.assignedWaiterName,
    cashierId,
    cashierName,
    status: "OPEN",
    subtotal: Number(subtotal.toFixed(2)),
    discountAmount,
    discountReason,
    discountApprovedBy,
    taxableAmount: Number(taxableAmount.toFixed(2)),
    cgstAmount: finalCgst,
    sgstAmount: finalSgst,
    igstAmount: finalIgst,
    vatAmount: finalVat,
    totalTaxAmount: finalTotalTax,
    roundOff,
    grandTotal: roundedGrandTotal,
    paidAmount: 0.0,
    balanceDue: roundedGrandTotal,
    isTakeaway: party.isTakeaway,
    customerName: party.customerName,
    customerPhone: party.customerPhone,
    packagingCharges: packagingCharges > 0 ? packagingCharges : undefined,
    createdAt: now,
    items: billItems,
    payments: [],
  };
}

/**
 * Records a payment against a bill (Supports Multi-Tender Split Payment)
 */
export function recordBillPayment(
  bill: Bill,
  paymentMethod: PaymentMethodType,
  amount: number,
  receivedBy: string,
  receivedByName: string,
  transactionReference?: string,
  notes?: string
): {
  updatedBill: Bill;
  payment: Payment;
  isFullyPaid: boolean;
} {
  const paymentId = `pay-${Date.now()}`;
  const now = new Date().toISOString();

  const payment: Payment = {
    id: paymentId,
    billId: bill.id,
    paymentMethod,
    amount: Number(amount.toFixed(2)),
    transactionReference,
    receivedBy,
    receivedByName,
    status: "SUCCESS",
    notes,
    paymentTime: now,
  };

  const newPaidAmount = Number((bill.paidAmount + amount).toFixed(2));
  const newBalanceDue = Math.max(0, Number((bill.grandTotal - newPaidAmount).toFixed(2)));
  const isFullyPaid = newBalanceDue <= 0.0;

  const updatedBill: Bill = {
    ...bill,
    paidAmount: newPaidAmount,
    balanceDue: newBalanceDue,
    status: isFullyPaid ? "PAID" : "PARTIALLY_PAID",
    settledAt: isFullyPaid ? now : undefined,
    payments: [...bill.payments, payment],
  };

  return { updatedBill, payment, isFullyPaid };
}
