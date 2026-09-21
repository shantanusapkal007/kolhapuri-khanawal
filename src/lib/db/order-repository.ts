/**
 * Authoritative Server-Side Order & KOT Repository
 * Enforces:
 * - Phase 4: Idempotency & Duplicate Prevention (Zero double-orders or KOT duplicates on retry/double-tap)
 * - Phase 6: Server-side atomic KOT sequence numbering
 * - Phase 9: Atomic Inventory Concurrency & Stock Deduction
 */

import { DatabaseSync } from "node:sqlite";
import { getDatabase, runTransaction } from "./sqlite";
import { generateAtomicKotNumber, generateAtomicOrderNumber } from "./sequence-service";
import { Order, OrderItem, Kot, KotItem } from "@/types/orders";

export interface CreateOrderRequestItem {
  menuItemId: string;
  menuItemName: string;
  menuItemLocalName?: string;
  variantName?: string;
  quantity: number;
  unitPrice: number;
  seatNumber?: number;
  spiceLevel?: string;
  breadOption?: string;
  notes?: string;
}

export interface CreateOrderParams {
  idempotencyKey: string;
  partyId: string;
  waiterId: string;
  waiterName: string;
  stationCode?: string;
  items: CreateOrderRequestItem[];
  notes?: string;
  urgencyLevel?: "NORMAL" | "HIGH" | "RUSH";
}

export interface CreateOrderResult {
  order: Order;
  kot: Kot;
  party: {
    id: string;
    partyCode: string;
    tableNumber: number;
    runningSubtotal: number;
  };
  isDuplicateRequest: boolean;
}

export class OrderRepository {
  /**
   * Atomically create an Order and dispatch KOT
   * Safe against double-taps, network retries, and concurrent stock race conditions.
   */
  static createOrderAndKot(params: CreateOrderParams): CreateOrderResult {
    // 1. PHASE 4: Check Idempotency Store first
    const db = getDatabase();
    if (params.idempotencyKey) {
      const existingIdemp = db
        .prepare("SELECT response_json FROM idempotency_keys WHERE key = ?")
        .get(params.idempotencyKey) as { response_json: string } | undefined;

      if (existingIdemp) {
        try {
          const cached = JSON.parse(existingIdemp.response_json);
          return {
            ...cached,
            isDuplicateRequest: true,
          };
        } catch {}
      }
    }

    // 2. Execute entire order creation, KOT generation & stock deduction in an ACID transaction
    return runTransaction((txDb: DatabaseSync) => {
      const now = new Date().toISOString();

      // Verify dining party exists and is active
      const party = txDb
        .prepare("SELECT * FROM dining_parties WHERE id = ?")
        .get(params.partyId) as any;

      if (!party) {
        throw new Error(`Dining party ${params.partyId} not found`);
      }

      if (party.status === "CLOSED" || party.status === "CANCELLED") {
        throw new Error(`Cannot add order to ${party.status.toLowerCase()} party ${party.party_code}`);
      }

      if (!params.items || params.items.length === 0) {
        throw new Error("Order must contain at least one item");
      }

      // PHASE 9: Inventory Concurrency & Stock Validation
      // Check recipe ingredients and deduct stock atomically
      for (const item of params.items) {
        // Check recipe components for this item
        const recipe = txDb
          .prepare("SELECT id FROM recipes WHERE menu_item_id = ? AND is_active = 1")
          .get(item.menuItemId) as { id: string } | undefined;

        if (recipe) {
          const components = txDb
            .prepare(`
              SELECT rc.ingredient_id, rc.quantity, rc.unit, i.name, i.available_stock, i.physical_stock
              FROM recipe_components rc
              JOIN ingredients i ON rc.ingredient_id = i.id
              WHERE rc.recipe_id = ?
            `)
            .all(recipe.id) as any[];

          for (const comp of components) {
            const requiredQty = comp.quantity * item.quantity;
            if (comp.available_stock < requiredQty) {
              throw new Error(
                `Insufficient inventory for "${item.menuItemName}": ${comp.name} available: ${comp.available_stock.toFixed(2)} ${comp.unit}, required: ${requiredQty.toFixed(2)} ${comp.unit}`
              );
            }

            // Deduct available stock atomically
            const newAvailable = comp.available_stock - requiredQty;
            txDb.prepare(`
              UPDATE ingredients 
              SET available_stock = ?, updated_at = ? 
              WHERE id = ?
            `).run(newAvailable, now, comp.ingredient_id);

            // Record stock movement transaction (SALE)
            txDb.prepare(`
              INSERT INTO stock_transactions (
                id, ingredient_id, ingredient_name, transaction_type, quantity,
                unit, direction, reference_type, reference_id, running_balance,
                performed_by, notes, timestamp
              ) VALUES (?, ?, ?, 'SALE', ?, ?, 'OUT', 'ORDER', ?, ?, ?, ?, ?)
            `).run(
              `stk-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              comp.ingredient_id,
              comp.name,
              requiredQty,
              comp.unit,
              params.partyId,
              newAvailable,
              params.waiterName,
              `Order for table ${party.table_name}`,
              now
            );
          }
        }
      }

      // Calculate order totals
      let orderSubtotal = 0;
      for (const item of params.items) {
        orderSubtotal += item.unitPrice * item.quantity;
      }

      // Generate atomic IDs and sequence numbers (Phase 6)
      const { orderNumber } = generateAtomicOrderNumber();
      const { kotNumber } = generateAtomicKotNumber();
      const orderId = `ord-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const kotId = `kot-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

      // Determine KOT sequence number for this party (e.g. KOT 1, KOT 2)
      const existingKotCount = txDb
        .prepare("SELECT COUNT(*) as c FROM kots WHERE party_id = ?")
        .get(params.partyId) as { c: number };
      const kotSequenceNumber = (existingKotCount?.c || 0) + 1;
      const isAddOn = kotSequenceNumber > 1 ? 1 : 0;

      // 3. Insert into orders table
      txDb.prepare(`
        INSERT INTO orders (
          id, order_number, party_id, party_code, table_number, waiter_id,
          waiter_name, status, idempotency_key, subtotal, is_takeaway,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'KOT_SENT', ?, ?, ?, ?, ?)
      `).run(
        orderId,
        orderNumber,
        party.id,
        party.party_code,
        party.table_number,
        params.waiterId,
        params.waiterName,
        params.idempotencyKey || null,
        orderSubtotal,
        party.is_takeaway,
        now,
        now
      );

      // 4. Insert into kots table before children kot_items
      const primaryStation = params.stationCode || "MAIN_KITCHEN";
      txDb.prepare(`
        INSERT INTO kots (
          id, kot_number, kot_sequence_number, order_id, party_id, party_code,
          table_number, waiter_id, waiter_name, station_code, guest_count,
          status, urgency_level, is_add_on, is_takeaway, notes, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'RECEIVED', ?, ?, ?, ?, ?)
      `).run(
        kotId,
        kotNumber,
        kotSequenceNumber,
        orderId,
        party.id,
        party.party_code,
        party.table_number,
        params.waiterId,
        params.waiterName,
        primaryStation,
        party.guest_count,
        params.urgencyLevel || "NORMAL",
        isAddOn,
        party.is_takeaway,
        params.notes || null,
        now
      );

      // 5. Insert into order_items and kot_items
      const orderItems: OrderItem[] = [];
      const kotItems: KotItem[] = [];

      const insertOrderItem = txDb.prepare(`
        INSERT INTO order_items (
          id, order_id, party_id, menu_item_id, menu_item_name, menu_item_local_name,
          variant_name, quantity, unit_price, total_price, seat_number,
          spice_level, bread_option, notes, kot_id, kot_number, kot_status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'RECEIVED')
      `);

      const insertKotItem = txDb.prepare(`
        INSERT INTO kot_items (
          id, kot_id, order_item_id, menu_item_id, menu_item_name, menu_item_local_name,
          variant_name, quantity, bread_option, spice_level, notes, seat_number
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const it of params.items) {
        const orderItemId = `oi-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        const kotItemId = `ki-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        const lineTotal = it.unitPrice * it.quantity;

        insertOrderItem.run(
          orderItemId,
          orderId,
          party.id,
          it.menuItemId,
          it.menuItemName,
          it.menuItemLocalName || null,
          it.variantName || null,
          it.quantity,
          it.unitPrice,
          lineTotal,
          it.seatNumber || null,
          it.spiceLevel || null,
          it.breadOption || null,
          it.notes || null,
          kotId,
          kotNumber
        );

        insertKotItem.run(
          kotItemId,
          kotId,
          orderItemId,
          it.menuItemId,
          it.menuItemName,
          it.menuItemLocalName || null,
          it.variantName || null,
          it.quantity,
          it.breadOption || null,
          it.spiceLevel || null,
          it.notes || null,
          it.seatNumber || null
        );

        orderItems.push({
          id: orderItemId,
          orderId,
          partyId: party.id,
          menuItemId: it.menuItemId,
          menuItemName: it.menuItemName,
          menuItemLocalName: it.menuItemLocalName,
          variantName: it.variantName,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
          totalPrice: lineTotal,
          seatNumber: it.seatNumber,
          spiceLevel: (it.spiceLevel as any) || undefined,
          breadOption: (it.breadOption as any) || undefined,
          notes: it.notes,
          kotId,
          kotNumber,
          kotStatus: "RECEIVED" as any,
          isCancelled: false,
        });

        kotItems.push({
          id: kotItemId,
          kotId,
          orderItemId,
          menuItemId: it.menuItemId,
          menuItemName: it.menuItemName,
          menuItemLocalName: it.menuItemLocalName,
          variantName: it.variantName,
          quantity: it.quantity,
          breadOption: (it.breadOption as any) || undefined,
          spiceLevel: (it.spiceLevel as any) || undefined,
          notes: it.notes,
          seatNumber: it.seatNumber,
          status: "NEW",
        });
      }

      // 6. Update dining_parties running totals
      const newSubtotal = party.running_subtotal + orderSubtotal;
      const newGrandTotal = party.running_grand_total + orderSubtotal;
      txDb.prepare(`
        UPDATE dining_parties 
        SET running_subtotal = ?, running_grand_total = ?, status = 'FOOD_PENDING', last_activity_at = ?
        WHERE id = ?
      `).run(newSubtotal, newGrandTotal, now, party.id);

      // 7. Audit log
      txDb.prepare(`
        INSERT INTO audit_logs (id, action, entity, entity_id, user_id, user_name, details, timestamp)
        VALUES (?, 'CREATE_ORDER_AND_KOT', 'order', ?, ?, ?, ?, ?)
      `).run(
        `aud-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        orderId,
        params.waiterId,
        params.waiterName,
        JSON.stringify({ orderNumber, kotNumber, tableNumber: party.table_number, subtotal: orderSubtotal }),
        now
      );

      const createdOrder: Order = {
        id: orderId,
        orderNumber,
        partyId: party.id,
        partyCode: party.party_code,
        tableNumber: party.table_number,
        waiterId: params.waiterId,
        waiterName: params.waiterName,
        status: "KOT_SENT",
        idempotencyKey: params.idempotencyKey,
        items: orderItems,
        subtotal: orderSubtotal,
        createdAt: now,
        updatedAt: now,
      };

      const createdKot: Kot = {
        id: kotId,
        kotNumber,
        orderId,
        partyId: party.id,
        partyCode: party.party_code,
        tableNumber: party.table_number,
        waiterId: params.waiterId,
        waiterName: params.waiterName,
        stationCode: primaryStation as any,
        guestCount: party.guest_count,
        items: kotItems,
        status: "NEW",
        elapsedSeconds: 0,
        urgencyLevel: (params.urgencyLevel as any) || "NORMAL",
        kotSequenceNumber,
        isAddOn: isAddOn === 1,
        notes: params.notes,
        createdAt: now,
      };

      const result: CreateOrderResult = {
        order: createdOrder,
        kot: createdKot,
        party: {
          id: party.id,
          partyCode: party.party_code,
          tableNumber: party.table_number,
          runningSubtotal: newSubtotal,
        },
        isDuplicateRequest: false,
      };

      // 8. PHASE 4: Persist Idempotency Record
      if (params.idempotencyKey) {
        txDb.prepare(`
          INSERT INTO idempotency_keys (key, operation_type, resource_id, response_json, created_at)
          VALUES (?, 'CREATE_ORDER', ?, ?, ?)
        `).run(params.idempotencyKey, orderId, JSON.stringify(result), now);
      }

      return result;
    });
  }

  /**
   * Get active KOTs for the kitchen display system
   */
  static getActiveKots(): Kot[] {
    const db = getDatabase();

    const kots = db
      .prepare(`
        SELECT k.*, p.table_name
        FROM kots k
        JOIN dining_parties p ON k.party_id = p.id
        WHERE k.status IN ('RECEIVED', 'NEW', 'ACKNOWLEDGED', 'PREPARING')
        ORDER BY k.created_at ASC
      `)
      .all() as any[];

    if (kots.length === 0) return [];

    const kotIds = kots.map((k) => k.id);
    const placeholders = kotIds.map(() => "?").join(",");
    const items = db
      .prepare(`SELECT * FROM kot_items WHERE kot_id IN (${placeholders})`)
      .all(...kotIds) as any[];

    const itemMap = new Map<string, KotItem[]>();
    for (const it of items) {
      const list = itemMap.get(it.kot_id) || [];
      list.push({
        id: it.id,
        kotId: it.kot_id,
        orderItemId: it.order_item_id,
        menuItemId: it.menu_item_id,
        menuItemName: it.menu_item_name,
        menuItemLocalName: it.menu_item_local_name,
        variantName: it.variant_name,
        quantity: it.quantity,
        breadOption: it.bread_option,
        spiceLevel: it.spice_level,
        notes: it.notes,
        seatNumber: it.seat_number,
        status: "NEW",
      });
      itemMap.set(it.kot_id, list);
    }

    return kots.map((k) => ({
      id: k.id,
      kotNumber: k.kot_number,
      orderId: k.order_id,
      partyId: k.party_id,
      partyCode: k.party_code,
      tableNumber: k.table_number,
      waiterId: k.waiter_id,
      waiterName: k.waiter_name,
      stationCode: k.station_code,
      guestCount: k.guest_count,
      items: itemMap.get(k.id) || [],
      status: k.status === "RECEIVED" ? "NEW" : k.status,
      elapsedSeconds: k.elapsed_seconds || 0,
      urgencyLevel: k.urgency_level || "NORMAL",
      kotSequenceNumber: k.kot_sequence_number,
      isAddOn: k.is_add_on === 1,
      notes: k.notes || undefined,
      createdAt: k.created_at,
      acknowledgedAt: k.acknowledged_at || undefined,
      readyAt: k.ready_at || undefined,
      servedAt: k.served_at || undefined,
    }));
  }

  /**
   * Update KOT status (e.g. from Kitchen Display System)
   */
  static updateKotStatus(
    kotId: string,
    newStatus: "ACKNOWLEDGED" | "PREPARING" | "READY" | "SERVED" | "CANCELLED",
    userId: string,
    userName: string
  ): void {
    runTransaction((db) => {
      const now = new Date().toISOString();
      const kot = db.prepare("SELECT * FROM kots WHERE id = ?").get(kotId) as any;
      if (!kot) {
        throw new Error(`KOT ${kotId} not found`);
      }

      let timestampField = "";
      if (newStatus === "ACKNOWLEDGED" || newStatus === "PREPARING") {
        timestampField = ", acknowledged_at = ?";
      } else if (newStatus === "READY") {
        timestampField = ", ready_at = ?";
      } else if (newStatus === "SERVED") {
        timestampField = ", served_at = ?";
      }

      if (timestampField) {
        db.prepare(`UPDATE kots SET status = ? ${timestampField} WHERE id = ?`).run(newStatus, now, kotId);
      } else {
        db.prepare("UPDATE kots SET status = ? WHERE id = ?").run(newStatus, kotId);
      }

      // Update associated order items status
      db.prepare("UPDATE order_items SET kot_status = ? WHERE kot_id = ?").run(newStatus, kotId);

      // Audit log
      db.prepare(`
        INSERT INTO audit_logs (id, action, entity, entity_id, user_id, user_name, details, timestamp)
        VALUES (?, 'UPDATE_KOT_STATUS', 'kot', ?, ?, ?, ?, ?)
      `).run(`aud-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`, kotId, userId, userName, JSON.stringify({ from: kot.status, to: newStatus }), now);
    });
  }

  /**
   * Get all orders for a specific party
   */
  static getOrdersByParty(partyId: string): Order[] {
    const db = getDatabase();
    const orders = db
      .prepare("SELECT * FROM orders WHERE party_id = ? ORDER BY created_at ASC")
      .all(partyId) as any[];

    if (orders.length === 0) return [];

    const orderIds = orders.map((o) => o.id);
    const placeholders = orderIds.map(() => "?").join(",");
    const items = db
      .prepare(`SELECT * FROM order_items WHERE order_id IN (${placeholders})`)
      .all(...orderIds) as any[];

    const itemMap = new Map<string, OrderItem[]>();
    for (const it of items) {
      const list = itemMap.get(it.order_id) || [];
      list.push({
        id: it.id,
        orderId: it.order_id,
        partyId: it.party_id,
        menuItemId: it.menu_item_id,
        menuItemName: it.menu_item_name,
        menuItemLocalName: it.menu_item_local_name,
        variantName: it.variant_name,
        quantity: it.quantity,
        unitPrice: it.unit_price,
        totalPrice: it.total_price,
        seatNumber: it.seat_number,
        spiceLevel: it.spice_level,
        breadOption: it.bread_option,
        notes: it.notes,
        kotId: it.kot_id,
        kotNumber: it.kot_number,
        kotStatus: it.kot_status,
        isCancelled: it.is_cancelled === 1,
      });
      itemMap.set(it.order_id, list);
    }

    return orders.map((o) => ({
      id: o.id,
      orderNumber: o.order_number,
      partyId: o.party_id,
      partyCode: o.party_code,
      tableNumber: o.table_number,
      waiterId: o.waiter_id,
      waiterName: o.waiter_name,
      status: o.status,
      idempotencyKey: o.idempotency_key || "",
      items: itemMap.get(o.id) || [],
      subtotal: o.subtotal,
      createdAt: o.created_at,
      updatedAt: o.updated_at,
    }));
  }
}
