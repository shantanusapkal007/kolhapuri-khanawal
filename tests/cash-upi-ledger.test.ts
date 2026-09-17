import { describe, it, expect, beforeEach } from "vitest";
import { RestaurantStore } from "@/lib/store/restaurant-store";

describe("Phase 4, 15 & 19: Cash & UPI Ledger Synchronization on Payment", () => {
  let store: RestaurantStore;

  beforeEach(() => {
    store = new RestaurantStore();
  });

  it("should record cash and UPI inflows into ledgers and reconcile owner summary", () => {
    const initialCash = store.cashLedger[0]?.balance ?? 5000;
    const initialUpi = store.upiLedger[0]?.balance ?? 15000;

    const party = store.createPartyAtTable(1, 2, "Payment Flow Party");
    store.placeOrder(party.id, [
      { menuItemId: "menu-chicken-thali", quantity: 2 }, // 500, no GST = 500
    ]);

    const bill = store.generateBillForParty(party.id);
    expect(bill.grandTotal).toBe(500);

    // 1. Pay ₹400 in Cash
    store.payBill(bill.id, "CASH", 400);

    // Verify cash ledger recorded inflow
    expect(store.cashLedger[0].entryType).toBe("SALE");
    expect(store.cashLedger[0].inflow).toBe(400);
    expect(store.cashLedger[0].balance).toBe(initialCash + 400);

    // 2. Pay remaining ₹100 via UPI
    store.payBill(bill.id, "UPI", 100, "UPI-TEST-123456");

    // Verify UPI ledger recorded inflow
    expect(store.upiLedger[0].entryType).toBe("SALE");
    expect(store.upiLedger[0].inflow).toBe(100);
    expect(store.upiLedger[0].balance).toBe(initialUpi + 100);

    // 3. Reconcile with Owner Summary
    const summary = store.getOwnerSummary();
    expect(summary.todaysSales).toBe(500);
    expect(summary.cashSales).toBe(400);
    expect(summary.upiSales).toBe(100);
    expect(summary.cashInDrawer).toBe(initialCash + 400);
    expect(summary.upiInBank).toBe(initialUpi + 100);
    expect(summary.chickenThalisSold).toBe(2);
    expect(summary.thalisSold).toBe(2);
  });
});
