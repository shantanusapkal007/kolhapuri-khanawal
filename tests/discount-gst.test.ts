import { describe, it, expect, beforeEach } from "vitest";
import { RestaurantStore } from "@/lib/store/restaurant-store";

describe("Phase 13 & 14: GST Calculation on Discounted Bills (Sec 15(3) CGST Act)", () => {
  let store: RestaurantStore;

  beforeEach(() => {
    store = new RestaurantStore();
  });

  it("should calculate GST on the discounted taxable amount, not on full gross subtotal", () => {
    store.settings.profile.gstin = "27AAAAA0000A1Z5";
    store.settings.billing.gstRatePercent = 5;
    const party = store.createPartyAtTable(3, 2, "Discount GST Party");
    // Place order: 2 Chicken Thalis (2 x 250 = 500)
    store.placeOrder(party.id, [
      { menuItemId: "menu-chicken-thali", quantity: 2 },
    ]); // subtotal = 500

    // Apply 10% discount
    // Subtotal = ₹500
    // Discount 10% = ₹50.00
    // Taxable Amount = ₹450.00
    // GST 5% on ₹450.00 = ₹22.50 (CGST 2.5% = ₹11.25, SGST 2.5% = ₹11.25)
    // Unrounded Total = 450.00 + 22.50 = ₹472.50
    // Rounded Grand Total = ₹473.00
    // Round Off = +₹0.50
    const bill = store.generateBillForParty(party.id, 10);

    expect(bill.subtotal).toBe(500);
    expect(bill.discountAmount).toBe(50);
    expect(bill.taxableAmount).toBe(450);
    expect(bill.cgstAmount).toBe(11.25);
    expect(bill.sgstAmount).toBe(11.25);
    expect(bill.totalTaxAmount).toBe(22.5);
    expect(bill.grandTotal).toBe(473);
    expect(bill.roundOff).toBe(0.5);
  });
});
