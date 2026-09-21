import { describe, it, expect, afterAll } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { initDatabaseSchema } from "@/lib/db/schema";
import { seedDatabaseIfEmpty } from "@/lib/db/seed";
import { BackupService } from "@/lib/db/backup-service";

describe("Forensic Section 11: Real Data Recovery, Corruption Defense & Backup/Restore", () => {
  const testDir = path.resolve(process.cwd(), "data", "test-recovery-zone");
  const testDbPath = path.join(testDir, "recovery-test.db");
  const backupDir = path.join(testDir, "backups");

  afterAll(() => {
    try {
      if (fs.existsSync(testDir)) {
        fs.rmSync(testDir, { recursive: true, force: true });
      }
    } catch {}
  });

  it("creates real database -> writes records -> backs up -> corrupts database -> restores -> verifies all records intact", () => {
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
    // Clean previous run artifacts if any
    for (const f of [testDbPath, `${testDbPath}-wal`, `${testDbPath}-shm`]) {
      if (fs.existsSync(f)) {
        try { fs.unlinkSync(f); } catch {}
      }
    }

    // 1. Create a real file-based SQLite database
    const db = new DatabaseSync(testDbPath);
    initDatabaseSchema(db);

    // Insert prerequisite dining_table record
    db.prepare(`
      INSERT INTO dining_tables (id, table_number, name, min_capacity, max_capacity, section, status, updated_at)
      VALUES ('tbl-1', 1, 'A1', 1, 4, 'SECTION_A', 'AVAILABLE', ?)
    `).run(new Date().toISOString());

    // Insert test financial records
    db.prepare(`
      INSERT INTO dining_parties (id, party_code, table_id, table_number, table_name, guest_count, assigned_waiter_id, assigned_waiter_name, status, opened_at, last_activity_at)
      VALUES ('pty-recovery-1', 'A1-P01', 'tbl-1', 1, 'A1', 4, 'u-wtr-01', 'Rahul', 'OPEN', ?, ?)
    `).run(new Date().toISOString(), new Date().toISOString());

    db.prepare(`
      INSERT INTO orders (id, order_number, party_id, party_code, table_number, waiter_id, waiter_name, status, subtotal, created_at, updated_at)
      VALUES ('ord-recovery-1', 'ORD-2026-999001', 'pty-recovery-1', 'A1-P01', 1, 'u-wtr-01', 'Rahul', 'BILLED', 1250, ?, ?)
    `).run(new Date().toISOString(), new Date().toISOString());

    db.prepare(`
      INSERT INTO bills (id, bill_number, party_id, party_code, table_id, table_number, waiter_id, waiter_name, cashier_id, cashier_name, status, subtotal, grand_total, paid_amount, balance_due, created_at)
      VALUES ('bill-recovery-1', 'BILL-2026-999001', 'pty-recovery-1', 'A1-P01', 'tbl-1', 1, 'u-wtr-01', 'Rahul', 'u-csh-01', 'Priya', 'PAID', 1250, 1312, 1312, 0, ?)
    `).run(new Date().toISOString());

    db.close();

    // 2. Perform safe file backup
    const backupFilePath = BackupService.backupDatabase(testDbPath, backupDir);
    expect(fs.existsSync(backupFilePath)).toBe(true);

    // 3. INTENTIONALLY CORRUPT the active database file with random garbage bytes
    fs.writeFileSync(testDbPath, Buffer.from("CORRUPTED_GARBAGE_HEADER_DATA_FAIL_SIMULATION"));

    // Verify opening corrupted database fails or fails integrity check
    expect(() => {
      const corruptedDb = new DatabaseSync(testDbPath);
      const check = corruptedDb.prepare("PRAGMA integrity_check;").get() as any;
      corruptedDb.close();
      if (!check || check.integrity_check !== "ok") {
        throw new Error("Database corruption confirmed");
      }
    }).toThrow();

    // 4. RESTORE from backup
    BackupService.restoreDatabase(backupFilePath, testDbPath);

    // 5. VERIFY restored database: check all records exist and PRAGMA integrity_check is 'ok'
    const restoredDb = new DatabaseSync(testDbPath);
    const integrityCheck = restoredDb.prepare("PRAGMA integrity_check;").get() as any;
    expect(integrityCheck.integrity_check).toBe("ok");

    const orderRow = restoredDb.prepare("SELECT * FROM orders WHERE id = 'ord-recovery-1'").get() as any;
    expect(orderRow).toBeDefined();
    expect(orderRow.order_number).toBe("ORD-2026-999001");
    expect(orderRow.subtotal).toBe(1250);

    const billRow = restoredDb.prepare("SELECT * FROM bills WHERE id = 'bill-recovery-1'").get() as any;
    expect(billRow).toBeDefined();
    expect(billRow.bill_number).toBe("BILL-2026-999001");
    expect(billRow.grand_total).toBe(1312);
    expect(billRow.status).toBe("PAID");

    restoredDb.close();
  }, 20000);
});
