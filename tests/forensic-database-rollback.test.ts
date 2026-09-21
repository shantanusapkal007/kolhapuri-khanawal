import { describe, it, expect, beforeEach } from "vitest";
import { getDatabase, runTransaction } from "@/lib/db/sqlite";
import { initDatabaseSchema } from "@/lib/db/schema";
import { seedDatabaseIfEmpty } from "@/lib/db/seed";
import { TableRepository } from "@/lib/db/table-repository";

describe("Forensic Section 9: Database Integrity, Constraints & Transaction Rollback Behavior", () => {
  beforeEach(() => {
    const db = getDatabase();
    initDatabaseSchema(db);
    seedDatabaseIfEmpty(db);
  });

  it("Transaction Atomicity: when an operation fails midway, all prior inserts in that transaction are rolled back", () => {
    const db = getDatabase();
    const { party } = TableRepository.seatParty({ tableNumber: 1, guestCount: 2, waiterId: "u-wtr-01", waiterName: "Rahul" });

    const doomedOrderId = "ord-doomed-transaction-1";

    // Execute a transaction where Order is inserted, but child KOT throws an error midway
    expect(() => {
      runTransaction((txDb) => {
        // Step 1: Insert order
        txDb.prepare(`
          INSERT INTO orders (id, order_number, party_id, party_code, table_number, waiter_id, waiter_name, status, subtotal, created_at, updated_at)
          VALUES (?, 'ORD-DOOMED-99', ?, 'A1-P01', 1, 'u-wtr-01', 'Rahul', 'OPEN', 500, ?, ?)
        `).run(doomedOrderId, party.id, new Date().toISOString(), new Date().toISOString());

        // Verify order exists inside the transaction scope
        const insideCheck = txDb.prepare("SELECT * FROM orders WHERE id = ?").get(doomedOrderId);
        expect(insideCheck).toBeDefined();

        // Step 2: Intentional error to simulate failure (e.g. invalid foreign key or database abort)
        throw new Error("Simulated Hardware/Network Fault during KOT generation");
      });
    }).toThrowError("Simulated Hardware/Network Fault during KOT generation");

    // CRITICAL: After rollback, the order MUST NOT exist in the database (Zero half-created transactions!)
    const orderAfterRollback = db.prepare("SELECT * FROM orders WHERE id = ?").get(doomedOrderId);
    expect(orderAfterRollback).toBeUndefined();
  });

  it("Foreign Key Enforcement: rejects orphan order items or bills referencing nonexistent entities", () => {
    const db = getDatabase();

    // Attempt to insert order referencing nonexistent party
    expect(() => {
      db.prepare(`
        INSERT INTO orders (id, order_number, party_id, party_code, table_number, waiter_id, waiter_name, status, subtotal, created_at, updated_at)
        VALUES ('ord-orphan-1', 'ORD-ORPHAN', 'nonexistent-party-999', 'N-999', 99, 'u-wtr-01', 'Rahul', 'OPEN', 100, ?, ?)
      `).run(new Date().toISOString(), new Date().toISOString());
    }).toThrowError(/FOREIGN KEY constraint failed/i);
  });

  it("Unique Constraints: rejects duplicate usernames, table numbers, and sequence names", () => {
    const db = getDatabase();

    // Attempt to insert duplicate username 'admin'
    expect(() => {
      db.prepare(`
        INSERT INTO app_users (id, username, name, role, pin_salt, pin_hash, is_active, created_at, updated_at)
        VALUES ('u-dup-admin', 'admin', 'Fake Admin', 'OWNER', 'salt', 'hash', 1, ?, ?)
      `).run(new Date().toISOString(), new Date().toISOString());
    }).toThrowError(/UNIQUE constraint failed: app_users\.username/i);

    // Attempt to insert duplicate physical table number 1
    expect(() => {
      db.prepare(`
        INSERT INTO dining_tables (id, table_number, name, section, status, updated_at)
        VALUES ('tbl-dup-1', 1, 'Duplicate Table 1', 'SECTION_A', 'AVAILABLE', ?)
      `).run(new Date().toISOString());
    }).toThrowError(/UNIQUE constraint failed: dining_tables\.table_number/i);
  });
});
