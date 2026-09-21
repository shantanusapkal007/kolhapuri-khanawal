/**
 * Authoritative Server-Side Atomic Sequence Generator
 * Guarantees gap-free, collision-proof sequence numbers across concurrent devices.
 */

import { getDatabase, runTransaction } from "./sqlite";

export function nextSequence(name: string, initialValue: number = 1000): number {
  return runTransaction((db) => {
    const existing = db
      .prepare("SELECT current_value FROM sequences WHERE name = ?")
      .get(name) as { current_value: number } | undefined;

    const now = new Date().toISOString();
    let nextVal: number;

    if (!existing) {
      nextVal = initialValue;
      db.prepare("INSERT INTO sequences (name, current_value, updated_at) VALUES (?, ?, ?)")
        .run(name, nextVal, now);
    } else {
      nextVal = existing.current_value + 1;
      db.prepare("UPDATE sequences SET current_value = ?, updated_at = ? WHERE name = ?")
        .run(nextVal, now, name);
    }

    return nextVal;
  });
}

/**
 * Atomic KOT Number Generator: KOT-2026-XXXXXX
 */
export function generateAtomicKotNumber(): { kotNumber: string; sequence: number } {
  const seq = nextSequence("kot_number", 1045);
  const kotNumber = `KOT-2026-${String(seq).padStart(6, "0")}`;
  return { kotNumber, sequence: seq };
}

/**
 * Atomic Bill Number Generator: BILL-2026-XXXXXX
 */
export function generateAtomicBillNumber(): { billNumber: string; sequence: number } {
  const seq = nextSequence("bill_number", 1001);
  const billNumber = `BILL-2026-${String(seq).padStart(6, "0")}`;
  return { billNumber, sequence: seq };
}

/**
 * Atomic Order Number Generator: ORD-2026-XXXXXX
 */
export function generateAtomicOrderNumber(): { orderNumber: string; sequence: number } {
  const seq = nextSequence("order_number", 2001);
  const orderNumber = `ORD-2026-${String(seq).padStart(6, "0")}`;
  return { orderNumber, sequence: seq };
}

/**
 * Atomic Daily Order Counter (Dine-in): Resets per operational business day (starts 10:00 AM IST)
 */
export function generateAtomicDailyOrderNumber(businessDateKey: string): number {
  return nextSequence(`daily_order_${businessDateKey}`, 1);
}

/**
 * Atomic Daily Parcel Counter (Takeaway): Resets per operational business day
 */
export function generateAtomicDailyParcelNumber(businessDateKey: string): number {
  return nextSequence(`daily_parcel_${businessDateKey}`, 1);
}
