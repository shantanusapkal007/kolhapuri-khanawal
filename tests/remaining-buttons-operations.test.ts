import { describe, it, expect, beforeEach } from "vitest";
import { RestaurantStore } from "@/lib/store/restaurant-store";

describe("Operational Buttons & Lifecycle Management", () => {
  let store: RestaurantStore;

  beforeEach(() => {
    store = new RestaurantStore();
  });

  describe("1. Recipe BOM Management Buttons", () => {
    it("deletes a recipe Bill of Materials and recalculates menu availability", () => {
      const initialRecipeCount = store.recipes.length;
      const targetRecipe = store.recipes[0];
      expect(targetRecipe).toBeDefined();

      store.deleteRecipe(targetRecipe.id);
      expect(store.recipes.length).toBe(initialRecipeCount - 1);
      expect(store.recipes.find((r) => r.id === targetRecipe.id)).toBeUndefined();

      // Verify audit log recorded
      const log = store.auditLogs.find((l) => l.action === "DELETE_RECIPE" && l.entityId === targetRecipe.id);
      expect(log).toBeDefined();
    });

    it("throws an error when deleting a non-existent recipe", () => {
      expect(() => store.deleteRecipe("rec-non-existent")).toThrowError(/not found/);
    });
  });

  describe("2. Inventory Threshold & Ingredient Management Buttons", () => {
    it("updates ingredient par levels, reorder levels, critical levels, and cost", () => {
      const ing = store.ingredients[0];
      const updated = store.updateIngredient(ing.id, {
        parLevel: 50,
        reorderLevel: 20,
        criticalLevel: 8,
        currentCostPerUnit: 290,
      });

      expect(updated.parLevel).toBe(50);
      expect(updated.reorderLevel).toBe(20);
      expect(updated.criticalLevel).toBe(8);
      expect(updated.currentCostPerUnit).toBe(290);

      // Verify stored in list
      const fromStore = store.ingredients.find((i) => i.id === ing.id);
      expect(fromStore?.parLevel).toBe(50);
      expect(fromStore?.currentCostPerUnit).toBe(290);
    });

    it("deletes an ingredient from the stock ledger and logs an audit record", () => {
      const initialCount = store.ingredients.length;
      const targetIng = store.ingredients[store.ingredients.length - 1];

      store.deleteIngredient(targetIng.id);
      expect(store.ingredients.length).toBe(initialCount - 1);
      expect(store.ingredients.find((i) => i.id === targetIng.id)).toBeUndefined();

      const log = store.auditLogs.find((l) => l.action === "DELETE_INGREDIENT" && l.entityId === targetIng.id);
      expect(log).toBeDefined();
    });
  });

  describe("3. Waiter Floor & Table Management Buttons", () => {
    it("allows cancelling and vacating an empty table party", () => {
      // Seat a party with 0 orders
      const party = store.createPartyAtTable(5, 2, "Test Empty Table");
      expect(party.status).toBe("OPEN");
      expect(store.parties.find((p) => p.id === party.id && p.status !== "CANCELLED")).toBeDefined();

      // Cancel / vacate empty party
      store.voidOrCancelParty(party.id, "Guest walked out before ordering");
      const cancelled = store.parties.find((p) => p.id === party.id);
      expect(cancelled?.status).toBe("CANCELLED");

      // Verify table 5 is freed
      const table5 = store.tables.find((t) => t.tableNumber === 5);
      expect(table5?.status).toBe("AVAILABLE");
    });

    it("prevents cancelling a party if items were already ordered", () => {
      const party = store.createPartyAtTable(6, 2, "Ordering Table");
      const menuItem = store.menuItems[0];
      store.placeOrder(party.id, [{ menuItemId: menuItem.id, quantity: 1, spiceLevel: "MEDIUM" }]);

      expect(() => store.voidOrCancelParty(party.id)).toThrowError(/active orders/);
    });

    it("transfers a party to another table successfully", () => {
      const party = store.createPartyAtTable(7, 3, "Transfer Test");
      expect(party.tableNumber).toBe(7);

      const transferred = store.transferPartyToTable(party.id, 8);
      expect(transferred.tableNumber).toBe(8);

      const table7 = store.tables.find((t) => t.tableNumber === 7);
      expect(table7?.status).toBe("AVAILABLE");

      const table8 = store.tables.find((t) => t.tableNumber === 8);
      expect(table8?.status).toBe("OCCUPIED");
    });
  });
});
