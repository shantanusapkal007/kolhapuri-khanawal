import { describe, it, expect, beforeEach } from "vitest";
import { RestaurantStore } from "@/lib/store/restaurant-store";
import { calculateItemTax } from "@/lib/billing/tax-engine";
import { recordBillPayment } from "@/lib/billing/billing-service";

describe("Configurable Tax Engine & Multi-Tender Split Billing", () => {
  let store: RestaurantStore;

  beforeEach(() => {
    store = new RestaurantStore();
  });

  it("should calculate standard 5% GST split into 2.5% CGST and 2.5% SGST", () => {
    const gstRate = store.taxRates.find((t) => t.code === "GST_5")!;

    // Item: ₹320 x 2 = ₹640
    const taxCalc = calculateItemTax(320.0, 2, gstRate);

    expect(taxCalc.taxableAmount).toBe(640.0);
    expect(taxCalc.cgstRate).toBe(2.5);
    expect(taxCalc.cgstAmount).toBe(16.0); // 2.5% of 640 = 16
    expect(taxCalc.sgstRate).toBe(2.5);
    expect(taxCalc.sgstAmount).toBe(16.0); // 2.5% of 640 = 16
    expect(taxCalc.totalTaxAmount).toBe(32.0);
    expect(taxCalc.effectiveTotal).toBe(672.0);
  });

  it("should handle multi-rate taxes like Exempt (0%) correctly", () => {
    const exemptRate = store.taxRates.find((t) => t.code === "EXEMPT_0")!;
    const taxCalc = calculateItemTax(50.0, 1, exemptRate);

    expect(taxCalc.taxableAmount).toBe(50.0);
    expect(taxCalc.totalTaxAmount).toBe(0.0);
    expect(taxCalc.effectiveTotal).toBe(50.0);
  });

  it("should support Multi-Tender Split Payments (e.g. ₹400 Cash + ₹100 UPI)", () => {
    const party = store.createPartyAtTable(1, 2, "Split Payment Party");
    store.placeOrder(party.id, [
      { menuItemId: "menu-chicken-thali", quantity: 2 }, // 250 * 2 = 500, no GST = 500
    ]);

    const bill = store.generateBillForParty(party.id);
    expect(bill.grandTotal).toBe(500);
    expect(bill.balanceDue).toBe(500);

    // 1. Pay ₹400 Cash
    const tender1 = store.payBill(bill.id, "CASH", 400.0);
    expect(tender1.isFullyPaid).toBe(false);
    expect(tender1.bill.status).toBe("PARTIALLY_PAID");
    expect(tender1.bill.paidAmount).toBe(400.0);
    expect(tender1.bill.balanceDue).toBe(100.0);

    // 2. Settle remaining ₹100 via UPI
    const tender2 = store.payBill(bill.id, "UPI", 100.0, "UPI-REF-888999");
    expect(tender2.isFullyPaid).toBe(true);
    expect(tender2.bill.status).toBe("PAID");
    expect(tender2.bill.paidAmount).toBe(500.0);
    expect(tender2.bill.balanceDue).toBe(0.0);
    expect(tender2.bill.payments.length).toBe(2);
  });
});
