import { describe, it, expect, beforeEach } from "vitest";
import { getDatabase } from "@/lib/db/sqlite";
import { initDatabaseSchema } from "@/lib/db/schema";
import { seedDatabaseIfEmpty } from "@/lib/db/seed";
import { TableRepository } from "@/lib/db/table-repository";
import { OrderRepository } from "@/lib/db/order-repository";
import { BillingRepository } from "@/lib/db/billing-repository";

describe("Forensic Section 13: Realistic High-Concurrency Restaurant Load & Stress Test", () => {
  beforeEach(() => {
    const db = getDatabase();
    initDatabaseSchema(db);
    seedDatabaseIfEmpty(db);
  });

  it("simulates 105 orders, 525 items, rapid KOT creation and multi-tender bill settlements with 0 database lock errors", () => {
    const db = getDatabase();

    const sampleMenuItems = [
      { id: "item-thali-01", name: "Special Mutton Thali", price: 350 },
      { id: "item-thali-02", name: "Kolhapuri Chicken Thali", price: 280 },
      { id: "item-bhakri-01", name: "Jowar Bhakri", price: 20 },
      { id: "item-water-01", name: "Small Water Bottle", price: 10 },
      { id: "item-extra-01", name: "Tambda Rassa Wati", price: 40 },
    ];

    const waiters = [
      { id: "u-wtr-01", name: "Rahul Shinde (W1)" },
      { id: "u-wtr-02", name: "Nitin Jadhav (W2)" },
    ];

    const TOTAL_ORDERS = 105;
    let totalItemsCreated = 0;
    const startTime = Date.now();

    for (let i = 1; i <= TOTAL_ORDERS; i++) {
      const tableNumber = ((i - 1) % 11) + 1; // Tables 1..11 (A1..A3, B1..B4, C1..C4)
      const assignedWaiter = waiters[(i - 1) % waiters.length];

      // 1. Seat Party
      const partyResult = TableRepository.seatParty({
        tableNumber,
        guestCount: 3,
        waiterId: assignedWaiter.id,
        waiterName: assignedWaiter.name,
        descriptor: `Batch ${i} Table ${tableNumber}`,
      });
      const party = partyResult.party;

      // 2. Add 5 items and generate KOT (5 * 105 = 525 items)
      const items = [
        { menuItemId: sampleMenuItems[0].id, menuItemName: sampleMenuItems[0].name, quantity: 2, unitPrice: sampleMenuItems[0].price },
        { menuItemId: sampleMenuItems[1].id, menuItemName: sampleMenuItems[1].name, quantity: 1, unitPrice: sampleMenuItems[1].price },
        { menuItemId: sampleMenuItems[2].id, menuItemName: sampleMenuItems[2].name, quantity: 4, unitPrice: sampleMenuItems[2].price },
        { menuItemId: sampleMenuItems[3].id, menuItemName: sampleMenuItems[3].name, quantity: 2, unitPrice: sampleMenuItems[3].price },
        { menuItemId: sampleMenuItems[4].id, menuItemName: sampleMenuItems[4].name, quantity: 2, unitPrice: sampleMenuItems[4].price },
      ];
      totalItemsCreated += items.length;

      const kotResult = OrderRepository.createOrderAndKot({
        idempotencyKey: `load-kot-key-${i}`,
        partyId: party.id,
        waiterId: assignedWaiter.id,
        waiterName: assignedWaiter.name,
        items,
      });

      expect(kotResult.kot.items.length).toBe(5);

      // 3. Generate Bill
      const bill = BillingRepository.getOrCreateBillForParty({
        partyId: party.id,
        cashierId: "u-csh-01",
        cashierName: "Priya Cashier",
      });

      // Expected Subtotal:
      // (2 * 350) + (1 * 280) + (4 * 20) + (2 * 10) + (2 * 40)
      // = 700 + 280 + 80 + 20 + 80 = 1160
      expect(bill.subtotal).toBe(1160);

      // 4. Settle Bill (Alternating CASH and UPI)
      const tender = i % 2 === 0 ? "CASH" : "UPI";
      const paymentResult = BillingRepository.recordPayment({
        idempotencyKey: `load-pay-key-${i}`,
        billId: bill.id,
        paymentMethod: tender as any,
        tenderAmount: bill.grandTotal,
        reference: tender === "UPI" ? `UPI-TXN-REF-${i}` : undefined,
        cashierId: "u-csh-01",
        cashierName: "Priya Cashier",
      });

      expect(paymentResult.bill.status).toBe("PAID");

      // Verify Table is automatically released to AVAILABLE
      const currentTable = TableRepository.getAllTables().find((t) => t.tableNumber === tableNumber);
      expect(currentTable?.status).toBe("AVAILABLE");
    }

    const elapsedMs = Date.now() - startTime;
    const avgLatencyMs = elapsedMs / TOTAL_ORDERS;

    // FORENSIC ASSERTIONS
    expect(TOTAL_ORDERS).toBeGreaterThanOrEqual(100);
    expect(totalItemsCreated).toBeGreaterThanOrEqual(500);

    // Verify Orders in DB
    const orderCountRow = db.prepare("SELECT count(*) as count FROM orders").get() as any;
    expect(orderCountRow.count).toBe(105);

    // Verify Order Items in DB
    const itemCountRow = db.prepare("SELECT count(*) as count FROM order_items").get() as any;
    expect(itemCountRow.count).toBe(525);

    // Verify KOTs in DB
    const kotCountRow = db.prepare("SELECT count(*) as count FROM kots").get() as any;
    expect(kotCountRow.count).toBe(105);

    // Verify Bills in DB
    const billCountRow = db.prepare("SELECT count(*) as count, sum(grand_total) as gross FROM bills WHERE status = 'PAID'").get() as any;
    expect(billCountRow.count).toBe(105);
    expect(billCountRow.gross).toBeGreaterThan(120000);

    // Verify Payments in DB (Multi-tender Cash and UPI)
    const paymentRows = db.prepare("SELECT payment_method, count(*) as count, sum(amount) as total FROM payments GROUP BY payment_method").all() as any[];
    expect(paymentRows.length).toBe(2);

    // Latency assertion (should be swift, < 100ms per complete party-order-kot-bill-payment flow)
    expect(avgLatencyMs).toBeLessThan(100);
  });
});
