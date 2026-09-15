import { describe, it, expect, beforeEach } from "vitest";
import { RestaurantStore } from "@/lib/store/restaurant-store";

describe("Phase 3 & 28: RBAC Action Enforcement at Domain Store Layer", () => {
  let store: RestaurantStore;

  beforeEach(() => {
    store = new RestaurantStore();
  });

  it("should reject unauthorized negative stock override attempts by WAITER", () => {
    store.currentUser.role = "WAITER";
    const party = store.createPartyAtTable(1, 2);

    expect(() => {
      store.placeOrder(
        party.id,
        [{ menuItemId: "menu-chicken-thali", quantity: 1 }],
        true // allowNegativeStock requested
      );
    }).toThrow(/Access Denied/i);
  });

  it("should permit negative stock override by MANAGER or OWNER", () => {
    store.currentUser.role = "MANAGER";
    const party = store.createPartyAtTable(1, 2);

    expect(() => {
      store.placeOrder(
        party.id,
        [{ menuItemId: "menu-chicken-thali", quantity: 1 }],
        true
      );
    }).not.toThrow();
  });

  it("should reject bill cancellation attempts by WAITER or CASHIER", () => {
    store.currentUser.role = "CASHIER";
    const party = store.createPartyAtTable(2, 2);
    store.currentUser.role = "WAITER";
    store.placeOrder(party.id, [{ menuItemId: "menu-bhakri", quantity: 2 }]);

    store.currentUser.role = "CASHIER";
    const bill = store.generateBillForParty(party.id);

    // CASHIER cannot cancel bill
    expect(() => {
      store.cancelBill(bill.id, "Attempted cashier cancel");
    }).toThrow(/Access Denied/i);

    // WAITER cannot cancel bill
    store.currentUser.role = "WAITER";
    expect(() => {
      store.cancelBill(bill.id, "Attempted waiter cancel");
    }).toThrow(/Access Denied/i);

    // OWNER can cancel bill
    store.currentUser.role = "OWNER";
    expect(() => {
      store.cancelBill(bill.id, "Owner authorized void");
    }).not.toThrow();
  });

  it("should reject inventory adjustments and wastage logs by WAITER or CASHIER", () => {
    store.currentUser.role = "WAITER";
    expect(() => {
      store.recordWastageRecord({
        ingredientId: "ing-chicken",
        ingredientName: "Fresh Chicken",
        quantity: 1,
        unit: "kg",
        reason: "SPOILED",
        estimatedCost: 240,
        recordedBy: "Waiter Ramesh",
      });
    }).toThrow(/Access Denied/i);

    store.currentUser.role = "INVENTORY_MANAGER";
    expect(() => {
      store.recordWastageRecord({
        ingredientId: "ing-chicken",
        ingredientName: "Fresh Chicken",
        quantity: 1,
        unit: "kg",
        reason: "SPOILED",
        estimatedCost: 240,
        recordedBy: "Inventory Manager",
      });
    }).not.toThrow();
  });
});
