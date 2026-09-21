import { describe, it, expect, beforeEach } from "vitest";
import { getDatabase } from "@/lib/db/sqlite";
import { initDatabaseSchema } from "@/lib/db/schema";
import { seedDatabaseIfEmpty } from "@/lib/db/seed";
import { TableRepository } from "@/lib/db/table-repository";
import { OrderRepository } from "@/lib/db/order-repository";
import { BillingRepository } from "@/lib/db/billing-repository";

describe("Forensic Section 3: Rapid-Action Taps & Duplicate Suppression", () => {
  beforeEach(() => {
    const db = getDatabase();
    initDatabaseSchema(db);
    seedDatabaseIfEmpty(db);
  });

  it("Send KOT: 10 rapid taps with same operation idempotency key produce exactly ONE database order and KOT", () => {
    const db = getDatabase();
    const { party } = TableRepository.seatParty({
      tableNumber: 2,
      guestCount: 2,
      waiterId: "u-wtr-01",
      waiterName: "Rahul",
    });

    const stableKey = "rapid-kot-" + Date.now();
    const orderParams = {
      idempotencyKey: stableKey,
      partyId: party.id,
      waiterId: "u-wtr-01",
      waiterName: "Rahul",
      items: [
        {
          menuItemId: "item-thali-01",
          menuItemName: "Special Mutton Thali",
          quantity: 2,
          unitPrice: 350,
        },
      ],
    };

    const results = [];
    // 10 rapid consecutive taps
    for (let tap = 1; tap <= 10; tap++) {
      const res = OrderRepository.createOrderAndKot(orderParams);
      results.push(res);
    }

    // Tap 1 is primary; Taps 2..10 must be flagged as duplicates
    expect(results[0].isDuplicateRequest).toBe(false);
    for (let i = 1; i < 10; i++) {
      expect(results[i].isDuplicateRequest).toBe(true);
      expect(results[i].kot.kotNumber).toBe(results[0].kot.kotNumber);
      expect(results[i].order.orderNumber).toBe(results[0].order.orderNumber);
    }

    // Verify raw SQLite database records: Exactly ONE order and ONE KOT exist
    const ordersInDb = db
      .prepare("SELECT COUNT(*) as c FROM orders WHERE party_id = ?")
      .get(party.id) as { c: number };
    const kotsInDb = db
      .prepare("SELECT COUNT(*) as c FROM kots WHERE party_id = ?")
      .get(party.id) as { c: number };

    expect(ordersInDb.c).toBe(1);
    expect(kotsInDb.c).toBe(1);
  });

  it("Generate Bill: 5 rapid calls return the same single statutory bill without burning new numbers", () => {
    const db = getDatabase();
    const { party } = TableRepository.seatParty({
      tableNumber: 3,
      guestCount: 2,
      waiterId: "u-wtr-01",
      waiterName: "Rahul",
    });

    OrderRepository.createOrderAndKot({
      idempotencyKey: "gen-bill-ord-" + Date.now(),
      partyId: party.id,
      waiterId: "u-wtr-01",
      waiterName: "Rahul",
      items: [{ menuItemId: "item-thali-01", menuItemName: "Mutton Thali", quantity: 1, unitPrice: 350 }],
    });

    const bills = [];
    // 5 rapid taps on "Generate Bill"
    for (let i = 0; i < 5; i++) {
      bills.push(
        BillingRepository.getOrCreateBillForParty({
          partyId: party.id,
          cashierId: "u-csh-01",
          cashierName: "Priya",
        })
      );
    }

    const firstBillNum = bills[0].billNumber;
    for (const b of bills) {
      expect(b.billNumber).toBe(firstBillNum);
      expect(b.id).toBe(bills[0].id);
    }

    // Verify SQLite table: Exactly ONE bill record exists
    const billsInDb = db
      .prepare("SELECT COUNT(*) as c FROM bills WHERE party_id = ?")
      .get(party.id) as { c: number };
    expect(billsInDb.c).toBe(1);
  });

  it("Pay Bill: 10 rapid taps on 'Pay Now' execute payment exactly ONCE without double-charging", () => {
    const db = getDatabase();
    const { party } = TableRepository.seatParty({
      tableNumber: 6,
      guestCount: 2,
      waiterId: "u-wtr-01",
      waiterName: "Rahul",
    });

    OrderRepository.createOrderAndKot({
      idempotencyKey: "pay-ord-" + Date.now(),
      partyId: party.id,
      waiterId: "u-wtr-01",
      waiterName: "Rahul",
      items: [{ menuItemId: "item-thali-02", menuItemName: "Chicken Thali", quantity: 1, unitPrice: 280 }],
    });

    const bill = BillingRepository.getOrCreateBillForParty({
      partyId: party.id,
      cashierId: "u-csh-01",
      cashierName: "Priya",
    });

    const paymentKey = "rapid-pay-key-" + bill.id;
    const payResults = [];

    // 10 rapid taps on "Pay"
    for (let tap = 1; tap <= 10; tap++) {
      payResults.push(
        BillingRepository.recordPayment({
          idempotencyKey: paymentKey,
          billId: bill.id,
          paymentMethod: "CASH",
          tenderAmount: 300,
          cashierId: "u-csh-01",
          cashierName: "Priya",
        })
      );
    }

    expect(payResults[0].isDuplicate).toBe(false);
    for (let i = 1; i < 10; i++) {
      expect(payResults[i].isDuplicate).toBe(true);
    }

    // Verify SQLite payments table: Exactly ONE payment was charged
    const paymentsInDb = db
      .prepare("SELECT COUNT(*) as c FROM payments WHERE bill_id = ?")
      .get(bill.id) as { c: number };
    expect(paymentsInDb.c).toBe(1);

    // Verify cash ledger: Exactly ONE cash entry was recorded
    const ledgerEntries = db
      .prepare("SELECT COUNT(*) as c FROM cash_ledger WHERE reference_id = ?")
      .get(bill.billNumber) as { c: number };
    expect(ledgerEntries.c).toBe(1);
  });

  it("Transfer Table: duplicate rapid taps reject secondary attempts once transferred", () => {
    const { party } = TableRepository.seatParty({
      tableNumber: 7,
      guestCount: 2,
      waiterId: "u-wtr-01",
      waiterName: "Rahul",
    });

    // Tap 1: transfers to table 8 successfully
    const transfer1 = TableRepository.transferTable(party.id, 8, "u-wtr-01", "Rahul");
    expect(transfer1.newTableNumber).toBe(8);

    // Tap 2 (rapid double tap): table 8 is now already occupied, so secondary attempt fails safely
    expect(() => {
      TableRepository.transferTable(party.id, 8, "u-wtr-01", "Rahul");
    }).toThrowError(/already occupied/i);
  });
});
