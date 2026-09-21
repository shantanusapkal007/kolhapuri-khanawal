/**
 * Authoritative Server-Side Inventory Repository
 * Enforces Phase 9: Atomic Inventory Concurrency & Stock Ledger History
 */

import { DatabaseSync } from "node:sqlite";
import { getDatabase, runTransaction } from "./sqlite";
import { Ingredient, StockTransactionType, StockHealthStatus } from "@/types/inventory";

export interface StockAdjustmentParams {
  ingredientId: string;
  adjustmentQuantity: number; // positive = add stock, negative = deduct stock
  type: StockTransactionType;
  performedBy: string;
  notes?: string;
}

export class InventoryRepository {
  /**
   * Get all raw ingredients and their real-time stock levels
   */
  static getAllIngredients(): Ingredient[] {
    const db = getDatabase();
    const rows = db
      .prepare(`
        SELECT * FROM ingredients 
        WHERE is_active = 1
        ORDER BY name ASC
      `)
      .all() as any[];

    return rows.map((r) => ({
      id: r.id,
      categoryId: r.category_id,
      name: r.name,
      localName: r.local_name || undefined,
      baseUnit: r.base_unit,
      physicalStock: r.physical_stock,
      reservedStock: r.reserved_stock,
      availableStock: r.available_stock,
      parLevel: r.par_level,
      reorderLevel: r.reorder_level,
      criticalLevel: r.critical_level,
      currentCostPerUnit: r.current_cost_per_unit,
      weightedAvgCostPerUnit: r.weighted_avg_cost_per_unit,
      healthStatus: (r.health_status as StockHealthStatus) || "HEALTHY",
      isActive: r.is_active === 1,
      createdAt: r.updated_at,
      updatedAt: r.updated_at,
    }));
  }

  /**
   * Atomically adjust stock with ledger entry (Phase 9)
   */
  static adjustStock(params: StockAdjustmentParams): Ingredient {
    return runTransaction((db: DatabaseSync) => {
      const now = new Date().toISOString();

      const ing = db.prepare("SELECT * FROM ingredients WHERE id = ?").get(params.ingredientId) as any;
      if (!ing) {
        throw new Error(`Ingredient ${params.ingredientId} not found`);
      }

      const newPhysical = ing.physical_stock + params.adjustmentQuantity;
      const newAvailable = ing.available_stock + params.adjustmentQuantity;

      if (newAvailable < 0 && params.type !== "STOCK_ADJUSTMENT") {
        throw new Error(
          `Cannot deduct ${Math.abs(params.adjustmentQuantity)} ${ing.base_unit} of "${ing.name}". Current available: ${ing.available_stock} ${ing.base_unit}`
        );
      }

      // Calculate health status
      let health: StockHealthStatus = "HEALTHY";
      if (newAvailable <= 0) {
        health = "OUT_OF_STOCK";
      } else if (newAvailable <= ing.critical_level) {
        health = "CRITICAL";
      } else if (newAvailable <= ing.reorder_level) {
        health = "LOW";
      } else if (newAvailable <= ing.parLevel) {
        health = "WATCH";
      }

      // 1. Update ingredient stock
      db.prepare(`
        UPDATE ingredients 
        SET physical_stock = ?, available_stock = ?, health_status = ?, updated_at = ?
        WHERE id = ?
      `).run(newPhysical, newAvailable, health, now, ing.id);

      // 2. Record immutable stock transaction in ledger
      const direction = params.adjustmentQuantity >= 0 ? "IN" : "OUT";
      const txId = `stk-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

      db.prepare(`
        INSERT INTO stock_transactions (
          id, ingredient_id, ingredient_name, transaction_type, quantity,
          unit, direction, reference_type, running_balance, performed_by, notes, timestamp
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'MANUAL', ?, ?, ?, ?)
      `).run(
        txId,
        ing.id,
        ing.name,
        params.type,
        Math.abs(params.adjustmentQuantity),
        ing.base_unit,
        direction,
        newAvailable,
        params.performedBy,
        params.notes || null,
        now
      );

      // 3. Audit log
      db.prepare(`
        INSERT INTO audit_logs (id, action, entity, entity_id, user_id, user_name, details, timestamp)
        VALUES (?, 'INVENTORY_ADJUST', 'ingredient', ?, ?, ?, ?, ?)
      `).run(
        `aud-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        ing.id,
        params.performedBy,
        params.performedBy,
        JSON.stringify({
          ingredient: ing.name,
          delta: params.adjustmentQuantity,
          newStock: newAvailable,
          type: params.type,
        }),
        now
      );

      return {
        id: ing.id,
        categoryId: ing.category_id,
        name: ing.name,
        localName: ing.local_name || undefined,
        baseUnit: ing.base_unit,
        physicalStock: newPhysical,
        reservedStock: ing.reserved_stock,
        availableStock: newAvailable,
        parLevel: ing.par_level,
        reorderLevel: ing.reorder_level,
        criticalLevel: ing.critical_level,
        currentCostPerUnit: ing.current_cost_per_unit,
        weightedAvgCostPerUnit: ing.weighted_avg_cost_per_unit,
        healthStatus: health,
        isActive: true,
        createdAt: ing.updated_at,
        updatedAt: now,
      };
    });
  }

  /**
   * Get stock transaction history
   */
  static getStockTransactions(limit: number = 50): any[] {
    const db = getDatabase();
    return db
      .prepare(`
        SELECT * FROM stock_transactions 
        ORDER BY timestamp DESC 
        LIMIT ?
      `)
      .all(limit) as any[];
  }
}
