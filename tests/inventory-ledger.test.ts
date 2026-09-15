import { describe, it, expect, beforeEach } from "vitest";
import { RestaurantStore } from "@/lib/store/restaurant-store";
import { checkStockAvailability } from "@/lib/inventory/stock-reservation";
import { calculateTheoreticalVsActualStock } from "@/lib/reports/report-service";
import { executeStockMovement } from "@/lib/inventory/ledger";

describe("Inventory Ledger, Recipe Engine & Concurrency Scenario", () => {
  let store: RestaurantStore;

  beforeEach(() => {
    store = new RestaurantStore();
  });

  it("should initialize with 2.0 kg Chicken (yielding exactly 20 theoretical Chicken Thalis)", () => {
    const chicken = store.ingredients.find((i) => i.id === "ing-chicken")!;
    expect(chicken.physicalStock).toBe(2.0);
    expect(chicken.availableStock).toBe(2.0);

    const chickenThali = store.menuItems.find((m) => m.id === "menu-chicken-thali")!;
    // 2.0 kg chicken / 0.1 kg per thali = 20 portions
    expect(chickenThali.portionAvailability).toBe(20);
    expect(chickenThali.stockStatus).toBe("AVAILABLE");
  });

  it("should accurately decrement portions: Order 3 -> 17 remaining (1.7kg), Order 10 -> 7 remaining (700g), Order 7 -> 0 remaining (0g)", () => {
    // Open Party A at Table 4
    const partyA = store.createPartyAtTable(4, 2, "Party A");

    // 1. Order 3 Chicken Thalis
    store.placeOrder(partyA.id, [{ menuItemId: "menu-chicken-thali", quantity: 3 }]);

    let chicken = store.ingredients.find((i) => i.id === "ing-chicken")!;
    expect(chicken.reservedStock).toBe(0.3); // 3 * 100g = 300g reserved
    expect(chicken.availableStock).toBe(1.7); // 1.7 kg available

    let thali = store.menuItems.find((m) => m.id === "menu-chicken-thali")!;
    expect(thali.portionAvailability).toBe(17);

    // 2. Order 10 Chicken Thalis
    store.placeOrder(partyA.id, [{ menuItemId: "menu-chicken-thali", quantity: 10 }]);

    chicken = store.ingredients.find((i) => i.id === "ing-chicken")!;
    expect(chicken.reservedStock).toBe(1.3); // 300g + 1000g = 1.3 kg reserved
    expect(chicken.availableStock).toBe(0.7); // 700g available

    thali = store.menuItems.find((m) => m.id === "menu-chicken-thali")!;
    expect(thali.portionAvailability).toBe(7);

    // 3. Order remaining 7 Chicken Thalis
    store.placeOrder(partyA.id, [{ menuItemId: "menu-chicken-thali", quantity: 7 }]);

    chicken = store.ingredients.find((i) => i.id === "ing-chicken")!;
    expect(chicken.reservedStock).toBe(2.0); // 2.0 kg reserved
    expect(chicken.availableStock).toBe(0.0); // 0g available

    thali = store.menuItems.find((m) => m.id === "menu-chicken-thali")!;
    expect(thali.portionAvailability).toBe(0);
    expect(thali.stockStatus).toBe("OUT_OF_STOCK");

    // 4. Attempt 8th / additional order: MUST BE BLOCKED
    expect(() => {
      store.placeOrder(partyA.id, [{ menuItemId: "menu-chicken-thali", quantity: 1 }]);
    }).toThrow(/insufficient/i);
  });

  it("should prevent concurrent stock depletion when two orders compete for the last stock", () => {
    // Current available stock is 2.0kg (20 thalis).
    // Simulate order of 15 thalis and simultaneous second order of 10 thalis.
    const party1 = store.createPartyAtTable(1, 4, "Group 1");
    const party2 = store.createPartyAtTable(2, 4, "Group 2");

    // Order 1 takes 15
    store.placeOrder(party1.id, [{ menuItemId: "menu-chicken-thali", quantity: 15 }]);

    // Order 2 requests 10, but only 5 remain
    expect(() => {
      store.placeOrder(party2.id, [{ menuItemId: "menu-chicken-thali", quantity: 10 }]);
    }).toThrow(/insufficient/i);
  });

  it("should commit stock to the ledger when Kitchen marks KOT preparing", () => {
    const party = store.createPartyAtTable(3, 2, "KOT Test");
    const { kot } = store.placeOrder(party.id, [{ menuItemId: "menu-chicken-thali", quantity: 2 }]);

    expect(store.stockTransactions.length).toBe(0); // Only reserved, not yet consumed

    // Kitchen starts preparation
    store.advanceKotStatus(kot.id, "PREPARING");

    expect(store.stockTransactions.length).toBeGreaterThan(0);
    const chickenTx = store.stockTransactions.find((t) => t.ingredientId === "ing-chicken")!;
    expect(chickenTx.transactionType).toBe("SALE_CONSUMPTION");
    expect(chickenTx.quantity).toBe(0.2); // 200g
    expect(chickenTx.direction).toBe("OUT");

    const chicken = store.ingredients.find((i) => i.id === "ing-chicken")!;
    expect(chicken.physicalStock).toBe(1.8);
    expect(chicken.reservedStock).toBe(0);
    expect(chicken.availableStock).toBe(1.8);
  });

  it("should calculate Theoretical vs Actual Stock Variance correctly", () => {
    const chicken = store.ingredients.find((i) => i.id === "ing-chicken")!;

    // Scenario from prompt:
    // Opening: 10 kg, Purchases: 20 kg, Sales: 18 kg, Wastage: 1 kg -> Expected: 11 kg. Physical Count: 9.5 kg -> Variance: -1.5 kg (-13.64%)
    const sampleTxs = [
      { ingredientId: chicken.id, transactionType: "PURCHASE", quantity: 20, direction: "IN" },
      { ingredientId: chicken.id, transactionType: "SALE_CONSUMPTION", quantity: 18, direction: "OUT" },
      { ingredientId: chicken.id, transactionType: "WASTAGE", quantity: 1, direction: "OUT" },
    ] as any;

    const report = calculateTheoreticalVsActualStock(chicken, 10.0, sampleTxs, 9.5);

    expect(report.expectedTheoreticalStock).toBe(11.0);
    expect(report.actualPhysicalStock).toBe(9.5);
    expect(report.varianceQuantity).toBe(-1.5);
    expect(report.variancePercentage).toBe(-13.64);
    expect(report.varianceStatus).toBe("HIGH_VARIANCE");
  });
});
