import { describe, it, expect, beforeEach } from "vitest";
import { RestaurantStore } from "@/lib/store/restaurant-store";

describe("Phase 9 & 13: KOT Cancellation Cleanup & Ledger Integrity", () => {
  let store: RestaurantStore;

  beforeEach(() => {
    store = new RestaurantStore();
  });

  it("should release reserved stock, flag order items cancelled, and exclude from billing", () => {
    const party = store.createPartyAtTable(2, 2, "Cancellation Test");
    const initialChickenStock = store.ingredients.find((i) => i.id === "ing-chicken")!.availableStock;

    // 1. Place order for 2 Chicken Thalis
    const { order, kot } = store.placeOrder(party.id, [
      { menuItemId: "menu-chicken-thali", quantity: 2 }, // 2 x 0.1kg = 0.2kg reserved
    ]);

    const afterOrderChickenStock = store.ingredients.find((i) => i.id === "ing-chicken")!.availableStock;
    expect(afterOrderChickenStock).toBeCloseTo(initialChickenStock - 0.2, 4);

    const updatedParty = store.parties.find((p) => p.id === party.id)!;
    expect(updatedParty.runningSubtotal).toBe(500);

    // 2. Cancel KOT before cooking
    const cancelledKot = store.cancelKot(kot.id, "Customer changed mind");
    expect(cancelledKot.status).toBe("CANCELLED");

    // 3. Verify stock reservation is released
    const restoredChickenStock = store.ingredients.find((i) => i.id === "ing-chicken")!.availableStock;
    expect(restoredChickenStock).toBeCloseTo(initialChickenStock, 4);

    // 4. Verify order items are marked cancelled
    const currentOrder = store.orders.find((o) => o.id === order.id)!;
    expect(currentOrder.status).toBe("CANCELLED");
    expect(currentOrder.items.every((it) => it.isCancelled)).toBe(true);

    // 5. Verify party running subtotal is reset
    const partyAfterCancel = store.parties.find((p) => p.id === party.id)!;
    expect(partyAfterCancel.runningSubtotal).toBe(0);

    // 6. Verify bill generation excludes cancelled items and charges ₹0
    const bill = store.generateBillForParty(party.id);
    expect(bill.items.length).toBe(0);
    expect(bill.subtotal).toBe(0);
    expect(bill.grandTotal).toBe(0);
  });
});
