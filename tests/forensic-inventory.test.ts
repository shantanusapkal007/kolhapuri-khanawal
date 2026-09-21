import { describe, it, expect, beforeEach } from "vitest";
import { getDatabase, runTransaction } from "@/lib/db/sqlite";
import { initDatabaseSchema } from "@/lib/db/schema";
import { seedDatabaseIfEmpty } from "@/lib/db/seed";
import { TableRepository } from "@/lib/db/table-repository";
import { OrderRepository } from "@/lib/db/order-repository";
import { InventoryRepository } from "@/lib/db/inventory-repository";

describe("Forensic Section 6: Inventory Concurrency, Serialization & Mathematical Ledger Reconciliation", () => {
  beforeEach(() => {
    const db = getDatabase();
    initDatabaseSchema(db);
    seedDatabaseIfEmpty(db);
  });

  it("enforces inventory concurrency: when stock = 1 serving, only one terminal succeeds and the second fails safely", () => {
    const db = getDatabase();

    // 1. Setup raw ingredient: Fresh Broiler Chicken with available stock = 0.5 kg (exactly 1 serving of 0.5 kg)
    const ingId = "ing-chicken-limited";
    db.prepare(`
      INSERT OR REPLACE INTO ingredients (
        id, category_id, name, base_unit, physical_stock, reserved_stock,
        available_stock, par_level, reorder_level, critical_level,
        current_cost_per_unit, is_active, updated_at
      ) VALUES (?, 'meat', 'Limited Chicken Portion', 'kg', 0.5, 0.0, 0.5, 10, 5, 2, 220, 1, ?)
    `).run(ingId, new Date().toISOString());

    // 2. Setup menu item and recipe: "Chicken Sukka Plate" requiring 0.5 kg of this ingredient
    const menuItemId = "item-chicken-limited-sukka";
    const recipeId = "rec-chicken-limited-sukka";

    db.prepare(`
      INSERT OR REPLACE INTO menu_items (
        id, category_id, category_name, name, local_name, selling_price,
        station_code, is_active
      ) VALUES (?, 'cat-chicken-thali', 'Chicken Thali', 'Limited Chicken Sukka', 'मर्यादित चिकन सुक्का', 280, 'MAIN_KITCHEN', 1)
    `).run(menuItemId);

    db.prepare(`
      INSERT OR REPLACE INTO recipes (id, menu_item_id, menu_item_name, is_active)
      VALUES (?, ?, 'Limited Chicken Sukka', 1)
    `).run(recipeId, menuItemId);

    db.prepare(`
      INSERT OR REPLACE INTO recipe_components (id, recipe_id, component_type, ingredient_id, ingredient_name, quantity, unit)
      VALUES ('rc-limited-1', ?, 'RAW_INGREDIENT', ?, 'Limited Chicken Portion', 0.5, 'kg')
    `).run(recipeId, ingId);

    // 3. Seat Table 1 and Table 2 for two different waiters
    const party1 = TableRepository.seatParty({ tableNumber: 1, guestCount: 2, waiterId: "u-wtr-01", waiterName: "Rahul" });
    const party2 = TableRepository.seatParty({ tableNumber: 4, guestCount: 2, waiterId: "u-wtr-02", waiterName: "Nitin" });

    // 4. Terminal 1 places order for 1 serving of Chicken Sukka
    const terminal1Res = OrderRepository.createOrderAndKot({
      idempotencyKey: "t1-chicken-sukka",
      partyId: party1.party.id,
      waiterId: "u-wtr-01",
      waiterName: "Rahul",
      items: [{ menuItemId, menuItemName: "Limited Chicken Sukka", quantity: 1, unitPrice: 280 }],
    });
    expect(terminal1Res.order.id).toBeDefined();

    // Verify stock is now 0.0 kg
    const ingAfterT1 = db.prepare("SELECT available_stock FROM ingredients WHERE id = ?").get(ingId) as any;
    expect(ingAfterT1.available_stock).toBe(0.0);

    // 5. Terminal 2 simultaneously attempts to order the same dish
    expect(() => {
      OrderRepository.createOrderAndKot({
        idempotencyKey: "t2-chicken-sukka",
        partyId: party2.party.id,
        waiterId: "u-wtr-02",
        waiterName: "Nitin",
        items: [{ menuItemId, menuItemName: "Limited Chicken Sukka", quantity: 1, unitPrice: 280 }],
      });
    }).toThrowError(/Insufficient inventory/i);

    // Verify stock never went negative!
    const finalIng = db.prepare("SELECT available_stock FROM ingredients WHERE id = ?").get(ingId) as any;
    expect(finalIng.available_stock).toBe(0.0);

    // Verify stock transactions ledger: Exactly ONE sale recorded
    const salesInLedger = db
      .prepare("SELECT * FROM stock_transactions WHERE ingredient_id = ? AND transaction_type = 'SALE'")
      .all(ingId);
    expect(salesInLedger.length).toBe(1);
  });

  it("mathematical ledger reconciliation: Purchase (+10) -> Sale (-2) -> Wastage (-1) -> Adjustment (+3) = exactly 10", () => {
    const db = getDatabase();
    const ingId = "ing-math-reconciliation";

    // Opening balance: 0.0 kg
    db.prepare(`
      INSERT OR REPLACE INTO ingredients (
        id, category_id, name, base_unit, physical_stock, reserved_stock,
        available_stock, par_level, reorder_level, critical_level,
        current_cost_per_unit, is_active, updated_at
      ) VALUES (?, 'staples', 'Kolhapuri Lavangi Mirchi', 'kg', 0.0, 0.0, 0.0, 10, 5, 2, 180, 1, ?)
    `).run(ingId, new Date().toISOString());

    // 1. PURCHASE: +10 kg
    InventoryRepository.adjustStock({
      ingredientId: ingId,
      adjustmentQuantity: 10,
      type: "PURCHASE",
      performedBy: "Manager Vikram",
      notes: "Farmer purchase",
    });

    // 2. SALE_CONSUMPTION: -2 kg
    InventoryRepository.adjustStock({
      ingredientId: ingId,
      adjustmentQuantity: -2,
      type: "SALE_CONSUMPTION",
      performedBy: "Kitchen Chef",
      notes: "Daily curry base prep",
    });

    // 3. WASTAGE: -1 kg
    InventoryRepository.adjustStock({
      ingredientId: ingId,
      adjustmentQuantity: -1,
      type: "WASTAGE",
      performedBy: "Kitchen Chef",
      notes: "Moisture spoilage",
    });

    // 4. STOCK_ADJUSTMENT: +3 kg
    InventoryRepository.adjustStock({
      ingredientId: ingId,
      adjustmentQuantity: 3,
      type: "STOCK_ADJUSTMENT",
      performedBy: "Owner Shantanu",
      notes: "Physical audit correction",
    });

    // Mathematical expectation: 0 + 10 - 2 - 1 + 3 = 10 kg
    const ingFinal = db.prepare("SELECT available_stock, physical_stock FROM ingredients WHERE id = ?").get(ingId) as any;
    expect(ingFinal.available_stock).toBe(10.0);
    expect(ingFinal.physical_stock).toBe(10.0);

    // Reconcile against immutable ledger: sum of all transactions must equal current balance
    const ledgerRows = db
      .prepare("SELECT transaction_type, quantity, direction FROM stock_transactions WHERE ingredient_id = ?")
      .all(ingId) as any[];

    let computedStock = 0;
    for (const tx of ledgerRows) {
      if (tx.direction === "IN") {
        computedStock += tx.quantity;
      } else {
        computedStock -= tx.quantity;
      }
    }

    expect(computedStock).toBe(10.0);
  });
});
