/**
 * Authoritative Server-Side Table Repository
 * Enforces transactional table safety (Phase 10: Multi-Device Table Safety)
 * Prevents two waiters from simultaneously claiming the same table.
 */

import { DatabaseSync } from "node:sqlite";
import { getDatabase, runTransaction } from "./sqlite";
import { DiningTable, DiningParty, PhysicalTableStatus } from "@/types/tables";

export interface SeatPartyParams {
  tableNumber: number;
  guestCount: number;
  waiterId: string;
  waiterName: string;
  descriptor?: string;
  customerName?: string;
  customerPhone?: string;
  isTakeaway?: boolean;
  packagingCharges?: number;
}

export interface TableWithParty extends DiningTable {
  activeParty?: DiningParty;
}

export class TableRepository {
  /**
   * Get all 11 dining tables with their current occupancy and active party if any
   */
  static getAllTables(): TableWithParty[] {
    const db = getDatabase();

    const tables = db
      .prepare(`
        SELECT 
          id, table_number, name, min_capacity, max_capacity, section, status, updated_at
        FROM dining_tables
        ORDER BY table_number ASC
      `)
      .all() as any[];

    const activeParties = db
      .prepare(`
        SELECT * FROM dining_parties 
        WHERE status IN ('OPEN', 'ORDERING', 'FOOD_PENDING', 'WAITING_FOR_BILL', 'PAYMENT_PENDING')
      `)
      .all() as any[];

    const partyMap = new Map<number, any>();
    for (const p of activeParties) {
      partyMap.set(p.table_number, p);
    }

    return tables.map((t) => {
      const party = partyMap.get(t.table_number);
      const tableStatus: PhysicalTableStatus = party ? "OCCUPIED" : (t.status as PhysicalTableStatus);

      const diningTable: TableWithParty = {
        id: t.id,
        tableNumber: t.table_number,
        name: t.name,
        minCapacity: t.min_capacity,
        maxCapacity: t.max_capacity,
        section: t.section,
        status: tableStatus,
        activePartiesCount: party ? 1 : 0,
        totalActiveGuests: party ? party.guest_count : 0,
        updatedAt: t.updated_at,
      };

      if (party) {
        diningTable.activeParty = {
          id: party.id,
          partyCode: party.party_code,
          tableId: party.table_id,
          tableNumber: party.table_number,
          tableName: party.table_name,
          guestCount: party.guest_count,
          assignedWaiterId: party.assigned_waiter_id,
          assignedWaiterName: party.assigned_waiter_name,
          status: party.status,
          descriptor: party.descriptor || undefined,
          runningSubtotal: party.running_subtotal,
          runningGrandTotal: party.running_grand_total,
          isTakeaway: party.is_takeaway === 1,
          packagingCharges: party.packaging_charges || 0,
          customerName: party.customer_name || undefined,
          customerPhone: party.customer_phone || undefined,
          notes: party.notes || undefined,
          openedAt: party.opened_at,
          closedAt: party.closed_at || undefined,
          lastActivityAt: party.last_activity_at,
        };
      }

      return diningTable;
    });
  }

  /**
   * Seat a party at a table atomically.
   * Enforces Table Mutex (Phase 10):
   * If table is already occupied by an active party, throws an error.
   */
  static seatParty(params: SeatPartyParams): { party: DiningParty; table: DiningTable } {
    return runTransaction((db: DatabaseSync) => {
      const now = new Date().toISOString();

      // 1. Lock and inspect physical table
      const table = db
        .prepare("SELECT * FROM dining_tables WHERE table_number = ?")
        .get(params.tableNumber) as any;

      if (!table) {
        throw new Error(`Table #${params.tableNumber} does not exist`);
      }

      // 2. Check if an active dining party already exists for this table
      const existingParty = db
        .prepare(`
          SELECT * FROM dining_parties 
          WHERE table_number = ? 
            AND status IN ('OPEN', 'ORDERING', 'FOOD_PENDING', 'WAITING_FOR_BILL', 'PAYMENT_PENDING')
        `)
        .get(params.tableNumber) as any;

      if (existingParty) {
        throw new Error(
          `Table ${table.name} is already occupied by party ${existingParty.party_code} (${existingParty.assigned_waiter_name}). Please choose another table or join existing party.`
        );
      }

      // 3. Generate stable party code: e.g. "A1-P01" or "T4-P01"
      const existingCountForDay = db
        .prepare("SELECT COUNT(*) as c FROM dining_parties WHERE table_number = ?")
        .get(params.tableNumber) as { c: number };
      const partySeq = (existingCountForDay?.c || 0) + 1;
      const partyCode = `${table.name}-P${String(partySeq).padStart(2, "0")}`;
      const partyId = `pty-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

      // 4. Insert new dining party
      db.prepare(`
        INSERT INTO dining_parties (
          id, party_code, table_id, table_number, table_name, guest_count,
          assigned_waiter_id, assigned_waiter_name, status, descriptor,
          running_subtotal, running_grand_total, is_takeaway, packaging_charges,
          customer_name, customer_phone, opened_at, last_activity_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'OPEN', ?, 0.0, 0.0, ?, ?, ?, ?, ?, ?)
      `).run(
        partyId,
        partyCode,
        table.id,
        table.table_number,
        table.name,
        params.guestCount,
        params.waiterId,
        params.waiterName,
        params.descriptor || null,
        params.isTakeaway ? 1 : 0,
        params.packagingCharges || 0.0,
        params.customerName || null,
        params.customerPhone || null,
        now,
        now
      );

      // 5. Update dining table status to OCCUPIED
      db.prepare("UPDATE dining_tables SET status = 'OCCUPIED', updated_at = ? WHERE id = ?")
        .run(now, table.id);

      // 6. Log in audit trail
      db.prepare(`
        INSERT INTO audit_logs (id, action, entity, entity_id, user_id, user_name, details, timestamp)
        VALUES (?, 'SEAT_PARTY', 'dining_party', ?, ?, ?, ?, ?)
      `).run(
        `aud-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        partyId,
        params.waiterId,
        params.waiterName,
        JSON.stringify({ tableNumber: params.tableNumber, partyCode, guestCount: params.guestCount }),
        now
      );

      const party: DiningParty = {
        id: partyId,
        partyCode,
        tableId: table.id,
        tableNumber: table.table_number,
        tableName: table.name,
        guestCount: params.guestCount,
        assignedWaiterId: params.waiterId,
        assignedWaiterName: params.waiterName,
        status: "OPEN",
        descriptor: params.descriptor,
        runningSubtotal: 0,
        runningGrandTotal: 0,
        isTakeaway: params.isTakeaway,
        packagingCharges: params.packagingCharges,
        customerName: params.customerName,
        customerPhone: params.customerPhone,
        openedAt: now,
        lastActivityAt: now,
      };

      const updatedTable: DiningTable = {
        id: table.id,
        tableNumber: table.table_number,
        name: table.name,
        minCapacity: table.min_capacity,
        maxCapacity: table.max_capacity,
        section: table.section,
        status: "OCCUPIED",
        activePartiesCount: 1,
        totalActiveGuests: params.guestCount,
        updatedAt: now,
      };

      return { party, table: updatedTable };
    });
  }

  /**
   * Transfer a party from their current table to a new available table
   */
  static transferTable(
    partyId: string,
    toTableNumber: number,
    userId: string,
    userName: string
  ): { party: DiningParty; oldTableNumber: number; newTableNumber: number } {
    return runTransaction((db: DatabaseSync) => {
      const now = new Date().toISOString();

      const party = db
        .prepare("SELECT * FROM dining_parties WHERE id = ?")
        .get(partyId) as any;
      if (!party) {
        throw new Error(`Party ${partyId} not found`);
      }

      if (party.status === "CLOSED" || party.status === "CANCELLED") {
        throw new Error(`Cannot transfer closed or cancelled party ${party.party_code}`);
      }

      const targetTable = db
        .prepare("SELECT * FROM dining_tables WHERE table_number = ?")
        .get(toTableNumber) as any;
      if (!targetTable) {
        throw new Error(`Target table #${toTableNumber} does not exist`);
      }

      // Check target table occupancy
      const targetOccupied = db
        .prepare(`
          SELECT * FROM dining_parties 
          WHERE table_number = ? 
            AND status IN ('OPEN', 'ORDERING', 'FOOD_PENDING', 'WAITING_FOR_BILL', 'PAYMENT_PENDING')
        `)
        .get(toTableNumber) as any;
      if (targetOccupied) {
        throw new Error(`Target table ${targetTable.name} is already occupied`);
      }

      const oldTableNumber = party.table_number;

      // 1. Vacate old table
      db.prepare("UPDATE dining_tables SET status = 'AVAILABLE', updated_at = ? WHERE table_number = ?")
        .run(now, oldTableNumber);

      // 2. Occupy new table
      db.prepare("UPDATE dining_tables SET status = 'OCCUPIED', updated_at = ? WHERE table_number = ?")
        .run(now, toTableNumber);

      // 3. Update party record
      db.prepare(`
        UPDATE dining_parties 
        SET table_id = ?, table_number = ?, table_name = ?, last_activity_at = ?
        WHERE id = ?
      `).run(targetTable.id, targetTable.table_number, targetTable.name, now, partyId);

      // 4. Update any unfinalized orders
      db.prepare("UPDATE orders SET table_number = ?, updated_at = ? WHERE party_id = ?")
        .run(toTableNumber, now, partyId);

      // 5. Update open bills
      db.prepare("UPDATE bills SET table_id = ?, table_number = ? WHERE party_id = ? AND status = 'OPEN'")
        .run(targetTable.id, toTableNumber, partyId);

      // 6. Audit log
      db.prepare(`
        INSERT INTO audit_logs (id, action, entity, entity_id, user_id, user_name, details, timestamp)
        VALUES (?, 'TRANSFER_TABLE', 'dining_party', ?, ?, ?, ?, ?)
      `).run(
        `aud-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        partyId,
        userId,
        userName,
        JSON.stringify({ fromTable: oldTableNumber, toTable: toTableNumber, partyCode: party.party_code }),
        now
      );

      const updatedParty: DiningParty = {
        id: party.id,
        partyCode: party.party_code,
        tableId: targetTable.id,
        tableNumber: targetTable.table_number,
        tableName: targetTable.name,
        guestCount: party.guest_count,
        assignedWaiterId: party.assigned_waiter_id,
        assignedWaiterName: party.assigned_waiter_name,
        status: party.status,
        descriptor: party.descriptor || undefined,
        runningSubtotal: party.running_subtotal,
        runningGrandTotal: party.running_grand_total,
        isTakeaway: party.is_takeaway === 1,
        packagingCharges: party.packaging_charges || 0,
        customerName: party.customer_name || undefined,
        customerPhone: party.customer_phone || undefined,
        notes: party.notes || undefined,
        openedAt: party.opened_at,
        lastActivityAt: now,
      };

      return { party: updatedParty, oldTableNumber, newTableNumber: toTableNumber };
    });
  }

  /**
   * Release / vacate a table if party is settled
   */
  static releaseTable(tableNumber: number): void {
    const db = getDatabase();
    const now = new Date().toISOString();
    db.prepare("UPDATE dining_tables SET status = 'AVAILABLE', updated_at = ? WHERE table_number = ?")
      .run(now, tableNumber);
  }

  /**
   * Get a party by ID
   */
  static getPartyById(partyId: string): DiningParty | null {
    const db = getDatabase();
    const party = db
      .prepare("SELECT * FROM dining_parties WHERE id = ?")
      .get(partyId) as any;

    if (!party) return null;

    return {
      id: party.id,
      partyCode: party.party_code,
      tableId: party.table_id,
      tableNumber: party.table_number,
      tableName: party.table_name,
      guestCount: party.guest_count,
      assignedWaiterId: party.assigned_waiter_id,
      assignedWaiterName: party.assigned_waiter_name,
      status: party.status,
      descriptor: party.descriptor || undefined,
      runningSubtotal: party.running_subtotal,
      runningGrandTotal: party.running_grand_total,
      isTakeaway: party.is_takeaway === 1,
      packagingCharges: party.packaging_charges || 0,
      customerName: party.customer_name || undefined,
      customerPhone: party.customer_phone || undefined,
      notes: party.notes || undefined,
      openedAt: party.opened_at,
      closedAt: party.closed_at || undefined,
      lastActivityAt: party.last_activity_at,
    };
  }

  /**
   * Get all active parties currently in the dining room
   */
  static getActiveParties(): DiningParty[] {
    const db = getDatabase();
    const parties = db
      .prepare(`
        SELECT * FROM dining_parties 
        WHERE status IN ('OPEN', 'ORDERING', 'FOOD_PENDING', 'WAITING_FOR_BILL', 'PAYMENT_PENDING')
        ORDER BY opened_at ASC
      `)
      .all() as any[];

    return parties.map((p) => ({
      id: p.id,
      partyCode: p.party_code,
      tableId: p.table_id,
      tableNumber: p.table_number,
      tableName: p.table_name,
      guestCount: p.guest_count,
      assignedWaiterId: p.assigned_waiter_id,
      assignedWaiterName: p.assigned_waiter_name,
      status: p.status,
      descriptor: p.descriptor || undefined,
      runningSubtotal: p.running_subtotal,
      runningGrandTotal: p.running_grand_total,
      isTakeaway: p.is_takeaway === 1,
      packagingCharges: p.packaging_charges || 0,
      customerName: p.customer_name || undefined,
      customerPhone: p.customer_phone || undefined,
      notes: p.notes || undefined,
      openedAt: p.opened_at,
      closedAt: p.closed_at || undefined,
      lastActivityAt: p.last_activity_at,
    }));
  }
}
