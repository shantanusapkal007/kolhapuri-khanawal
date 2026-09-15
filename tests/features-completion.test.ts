import { describe, it, expect, beforeEach } from "vitest";
import { RestaurantStore } from "@/lib/store/restaurant-store";

describe("Features Completion Test Suite (Kolhapuri Khanawal Restaurant OS)", () => {
  let store: RestaurantStore;

  beforeEach(() => {
    store = new RestaurantStore();
  });

  it("1. Party item splitting: splits selected items to a new party at another or same table", () => {
    // Open a party at Table 1
    const party = store.createPartyAtTable(1, 4, "Family Party");

    // Order items
    const muttonThali = store.menuItems.find((m) => m.name.includes("Mutton"))!;
    const bhakri = store.menuItems.find((m) => m.name.includes("Bhakri"))!;

    store.placeOrder(party.id, [
      { menuItemId: muttonThali.id, quantity: 2, seatNumber: 1 },
      { menuItemId: bhakri.id, quantity: 4, seatNumber: 2 },
    ]);

    const sourceBeforeSplit = store.parties.find((p) => p.id === party.id)!;
    const initialRunningSubtotal = sourceBeforeSplit.runningSubtotal;

    const sourceOrders = store.orders.filter((o) => o.partyId === party.id);
    const allItems = sourceOrders.flatMap((o) => o.items);
    const itemsToSplit = [allItems[1].id]; // split bhakri items

    // Split to Table 2
    const { newParty, updatedSourceParty } = store.splitPartyItemsAction(party.id, 2, itemsToSplit);

    expect(newParty.tableNumber).toBe(2);
    expect(updatedSourceParty.runningSubtotal).toBeLessThan(initialRunningSubtotal);
    expect(store.orders.some((o) => o.partyId === newParty.id)).toBe(true);
    expect(store.auditLogs.some((l) => l.action === "SPLIT_PARTY_ITEMS")).toBe(true);
  });

  it("2. Recipe BOM Authoring: adds recipe and recalculates theoretical portion availability", () => {
    const newItem = store.addMenuItem({
      categoryId: "cat-specials",
      categoryName: "Kolhapuri Specials",
      name: "Kolhapuri Kala Mutton Fry",
      localName: "कोल्हापुरी काळा मटण फ्राय",
      code: "KLH-KM-01",
      description: "Authentic dark spiced Kolhapuri goat fry",
      sellingPrice: 380,
      costPrice: 120,
      isVeg: false,
      isThali: false,
      stationCode: "FRY_SECTION",
      taxCategoryId: "tax-gst5",
      stockStatus: "AVAILABLE",
      isDailySpecial: false,
      preparationTimeMinutes: 15,
      displayOrder: 10,
      isActive: true,
    });

    const goatMeat = store.ingredients.find((i) => i.id === "ing-mutton")!;

    const recipe = store.addRecipe({
      menuItemId: newItem.id,
      menuItemName: newItem.name,
      preparationTimeMinutes: 20,
      portionsYielded: 1,
      estimatedCost: 110,
      components: [
        {
          id: "comp-1",
          recipeId: "rec-km",
          componentType: "RAW_INGREDIENT",
          ingredientId: goatMeat.id,
          ingredientName: goatMeat.name,
          quantity: 0.25, // 250g per portion
          unit: "kg",
          yieldFactor: 0.9,
          isOptional: false,
        },
      ],
    });

    expect(recipe.id).toBeDefined();
    expect(store.recipes.some((r) => r.id === recipe.id)).toBe(true);

    // Availability should be recalculated based on goat meat physical stock (5kg / 0.25 = ~18 portions with yield)
    const refreshedDish = store.menuItems.find((m) => m.id === newItem.id)!;
    expect(refreshedDish.portionAvailability).toBeGreaterThan(0);
    expect(store.auditLogs.some((l) => l.action === "ADD_RECIPE")).toBe(true);
  });

  it("3. Raw Material Creation: adds ingredient to inventory ledger and updates valuation", () => {
    const initialCount = store.ingredients.length;

    const newIng = store.addIngredient({
      categoryId: "cat-spices",
      categoryName: "Authentic Kolhapuri Masalas",
      name: "Special Kolhapuri Dagadphool (Stone Flower)",
      localName: "दगडफूल मसाला",
      baseUnit: "kg",
      physicalStock: 5.0,
      parLevel: 10.0,
      reorderLevel: 2.0,
      criticalLevel: 1.0,
      currentCostPerUnit: 600,
    });

    expect(store.ingredients.length).toBe(initialCount + 1);
    expect(newIng.availableStock).toBe(5.0);
    expect(store.auditLogs.some((l) => l.action === "ADD_INGREDIENT")).toBe(true);
  });

  it("4. Menu Item Deletion: archives dish and removes associated recipe", () => {
    const dish = store.menuItems[0];
    store.deleteMenuItem(dish.id);

    expect(store.menuItems.some((m) => m.id === dish.id)).toBe(false);
    expect(store.recipes.some((r) => r.menuItemId === dish.id)).toBe(false);
    expect(store.auditLogs.some((l) => l.action === "DELETE_MENU_ITEM")).toBe(true);
  });

  it("5. Manager Negative-Stock Override: allows order when stock is insufficient and writes audit log", () => {
    const party = store.createPartyAtTable(3, 2);
    const chickenThali = store.menuItems.find((m) => m.id === "menu-chicken-thali")!;

    // Exhaust stock by setting chicken physical stock to 0
    const chickenIng = store.ingredients.find((i) => i.id === "ing-chicken")!;
    chickenIng.physicalStock = 0;
    chickenIng.availableStock = 0;
    store.recalculateMenuAvailability();

    // Regular order without override should fail
    expect(() => {
      store.placeOrder(party.id, [{ menuItemId: chickenThali.id, quantity: 2 }], false);
    }).toThrow();

    // Order WITH allowNegativeStock override should succeed
    const { order, kot } = store.placeOrder(
      party.id,
      [{ menuItemId: chickenThali.id, quantity: 2 }],
      true
    );

    expect(order).toBeDefined();
    expect(kot).toBeDefined();
    expect(store.auditLogs.some((l) => l.action === "OVERRIDE_NEGATIVE_STOCK")).toBe(true);
  });

  it("6. KOT Voiding: cancels ticket and releases reserved ingredient stocks", () => {
    const party = store.createPartyAtTable(4, 2);
    const muttonThali = store.menuItems.find((m) => m.name.includes("Mutton"))!;

    const initialReserved = store.ingredients.find((i) => i.id === "ing-mutton")!.reservedStock;

    const { kot } = store.placeOrder(party.id, [{ menuItemId: muttonThali.id, quantity: 2 }]);
    const reservedAfterOrder = store.ingredients.find((i) => i.id === "ing-mutton")!.reservedStock;
    expect(reservedAfterOrder).toBeGreaterThan(initialReserved);

    // Cancel KOT
    store.cancelKot(kot.id, "Customer changed order before cooking");

    const cancelledKot = store.kots.find((k) => k.id === kot.id)!;
    expect((cancelledKot.status as any)).toBe("CANCELLED");
    const reservedAfterCancel = store.ingredients.find((i) => i.id === "ing-mutton")!.reservedStock;
    expect(reservedAfterCancel).toBe(initialReserved);
    expect(store.auditLogs.some((l) => l.action === "CANCEL_KOT")).toBe(true);
  });

  it("7. Bill Cancellation: voids bill, restores dining party status and logs audit entry", () => {
    const party = store.createPartyAtTable(5, 2);
    const solkadhi = store.menuItems.find((m) => m.name.includes("Solkadhi"))!;

    store.placeOrder(party.id, [{ menuItemId: solkadhi.id, quantity: 2 }]);
    const bill = store.generateBillForParty(party.id);

    expect(bill.status).toBe("OPEN");

    // Void bill
    store.cancelBill(bill.id, "Bill printed with wrong items");

    const cancelledBill = store.bills.find((b) => b.id === bill.id)!;
    expect(cancelledBill.status).toBe("CANCELLED");

    const reopenedParty = store.parties.find((p) => p.id === party.id)!;
    expect(reopenedParty.status).toBe("OPEN");
    expect(store.auditLogs.some((l) => l.action === "CANCEL_BILL")).toBe(true);
  });

  it("8. Checklists Persistence: toggles and creates SOP items persisting in store", () => {
    const initialCount = store.checklistItems.length;
    const firstItem = store.checklistItems[0];
    const initialStatus = firstItem.isCompleted;

    store.toggleChecklistItem(firstItem.id);
    expect(store.checklistItems.find((i) => i.id === firstItem.id)!.isCompleted).toBe(!initialStatus);

    store.addChecklistItem("Check Tambada Rassa spice level with head cook", "OPERATIONS", "OPENING");
    expect(store.checklistItems.length).toBe(initialCount + 1);
  });
});
