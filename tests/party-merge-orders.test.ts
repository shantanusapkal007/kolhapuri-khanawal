import { describe, it, expect, beforeEach } from "vitest";
import { RestaurantStore } from "@/lib/store/restaurant-store";

describe("Phase 5: Table & Shared Party Merge Data Integrity", () => {
  let store: RestaurantStore;

  beforeEach(() => {
    store = new RestaurantStore();
  });

  it("should preserve all orders and items from merged parties when generating a bill", () => {
    // 1. Seat Party A and Party B on Table 4 (Shared Table Model)
    const partyA = store.createPartyAtTable(4, 2, "Party A (Lunch)");
    const partyB = store.createPartyAtTable(4, 2, "Party B (Friends)");

    expect(partyA.tableNumber).toBe(4);
    expect(partyB.tableNumber).toBe(4);
    expect(partyA.id).not.toBe(partyB.id);

    // 2. Order Chicken Thali for Party A
    const orderA = store.placeOrder(partyA.id, [
      { menuItemId: "menu-chicken-thali", quantity: 2 }, // 2 x 250 = 500
    ]);
    expect(orderA.order.items.length).toBe(1);
    expect(orderA.order.subtotal).toBe(500);

    // 3. Order Mutton Thali for Party B
    const orderB = store.placeOrder(partyB.id, [
      { menuItemId: "menu-mutton-thali", quantity: 1 }, // 1 x 270 = 270
    ]);
    expect(orderB.order.items.length).toBe(1);
    expect(orderB.order.subtotal).toBe(270);

    // Verify isolation before merge
    const billBeforeMergeA = store.generateBillForParty(partyA.id);
    expect(billBeforeMergeA.items.length).toBe(1);
    expect(billBeforeMergeA.subtotal).toBe(500);

    // 4. Merge Party B into Party A
    const mergedParty = store.mergePartiesTogether([partyA.id, partyB.id]);
    expect(mergedParty.id).toBe(partyA.id);
    expect(mergedParty.guestCount).toBe(4);

    // 5. Generate final bill for the merged party
    const finalBill = store.generateBillForParty(mergedParty.id);

    // MUST contain items from BOTH parties (Chicken Thali x2 + Mutton Thali x1)
    expect(finalBill.items.length).toBe(2);
    expect(finalBill.subtotal).toBe(770); // 500 + 270 = 770

    const chickenItem = finalBill.items.find((it) => it.menuItemId === "menu-chicken-thali");
    const muttonItem = finalBill.items.find((it) => it.menuItemId === "menu-mutton-thali");

    expect(chickenItem).toBeDefined();
    expect(chickenItem!.quantity).toBe(2);
    expect(muttonItem).toBeDefined();
    expect(muttonItem!.quantity).toBe(1);
  });
});
