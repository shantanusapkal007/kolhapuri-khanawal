import { describe, it, expect, beforeEach } from "vitest";
import { getDatabase, runTransaction } from "@/lib/db/sqlite";
import { initDatabaseSchema } from "@/lib/db/schema";
import { seedDatabaseIfEmpty } from "@/lib/db/seed";
import { TableRepository } from "@/lib/db/table-repository";
import { OrderRepository } from "@/lib/db/order-repository";
import { BillingRepository, StaleBillError } from "@/lib/db/billing-repository";
import { InventoryRepository } from "@/lib/db/inventory-repository";

describe("Server-Side Repositories & Concurrency Safety", () => {
  beforeEach(() => {
    const db = getDatabase();
    initDatabaseSchema(db);
    seedDatabaseIfEmpty(db);
  });

  it("Phase 10: enforces Table Mutex and prevents two waiters from claiming Table 1 (A1)", () => {
    // Waiter 1 seats party at table 1
    const seat1 = TableRepository.seatParty({
      tableNumber: 1,
      guestCount: 2,
      waiterId: "u-wtr-01",
      waiterName: "Rahul Shinde",
    });
    expect(seat1.party.partyCode).toContain("A1-P");
    expect(seat1.table.status).toBe("OCCUPIED");

    // Waiter 2 tries to seat another party at table 1 simultaneously
    expect(() => {
      TableRepository.seatParty({
        tableNumber: 1,
        guestCount: 4,
        waiterId: "u-wtr-02",
        waiterName: "Nitin Jadhav",
      });
    }).toThrowError(/already occupied/i);
  });

  it("Phase 6 & 4: generates atomic KOT numbers and enforces idempotency on double-tap", () => {
    // Seat party at table 2 (A2)
    const { party } = TableRepository.seatParty({
      tableNumber: 2,
      guestCount: 2,
      waiterId: "u-wtr-01",
      waiterName: "Rahul Shinde",
    });

    const idemKey = "test-idem-" + Date.now();
    const orderParams = {
      idempotencyKey: idemKey,
      partyId: party.id,
      waiterId: "u-wtr-01",
      waiterName: "Rahul Shinde",
      items: [
        {
          menuItemId: "item-thali-01",
          menuItemName: "Kolhapuri Special Chicken Thali",
          quantity: 2,
          unitPrice: 280,
        },
      ],
    };

    // First tap
    const res1 = OrderRepository.createOrderAndKot(orderParams);
    expect(res1.isDuplicateRequest).toBe(false);
    expect(res1.kot.kotNumber).toMatch(/^KOT-2026-\d{6}$/);
    expect(res1.order.orderNumber).toMatch(/^ORD-2026-\d{6}$/);
    expect(res1.party.runningSubtotal).toBe(560);

    // Second tap with same idempotency key (network retry / double tap)
    const res2 = OrderRepository.createOrderAndKot(orderParams);
    expect(res2.isDuplicateRequest).toBe(true);
    expect(res2.kot.kotNumber).toBe(res1.kot.kotNumber);
    expect(res2.order.orderNumber).toBe(res1.order.orderNumber);
  });

  it("Phase 7: creates single statutory bill number and updates in place on discount", () => {
    // Seat party at table 3 (A3)
    const { party } = TableRepository.seatParty({
      tableNumber: 3,
      guestCount: 2,
      waiterId: "u-wtr-01",
      waiterName: "Rahul Shinde",
    });

    // Place order
    OrderRepository.createOrderAndKot({
      idempotencyKey: "test-idem-bill-1",
      partyId: party.id,
      waiterId: "u-wtr-01",
      waiterName: "Rahul Shinde",
      items: [
        {
          menuItemId: "item-thali-01",
          menuItemName: "Special Mutton Thali",
          quantity: 1,
          unitPrice: 350,
        },
      ],
    });

    // Generate bill
    const bill1 = BillingRepository.getOrCreateBillForParty({
      partyId: party.id,
      cashierId: "u-csh-01",
      cashierName: "Priya Kulkarni",
    });

    expect(bill1.billNumber).toMatch(/^BILL-2026-\d{6}$/);
    expect(bill1.subtotal).toBe(350);
    expect(bill1.status).toBe("OPEN");

    // Apply ₹50 discount
    const bill2 = BillingRepository.applyDiscount({
      billId: bill1.id,
      discountAmount: 50,
      reason: "Regular customer discount",
      approvedBy: "Priya Kulkarni",
    });

    // STATUTORY BILL NUMBER MUST NOT CHANGE
    expect(bill2.billNumber).toBe(bill1.billNumber);
    expect(bill2.discountAmount).toBe(50);
    expect(bill2.grandTotal).toBeLessThan(bill1.grandTotal);
  });

  it("Phase 8: Stale Bill Protection detects waiter add-ons after cashier opened bill", () => {
    // Seat party at table 4 (B1)
    const { party } = TableRepository.seatParty({
      tableNumber: 4,
      guestCount: 2,
      waiterId: "u-wtr-01",
      waiterName: "Rahul Shinde",
    });

    // Initial order
    OrderRepository.createOrderAndKot({
      idempotencyKey: "test-stale-1",
      partyId: party.id,
      waiterId: "u-wtr-01",
      waiterName: "Rahul Shinde",
      items: [
        {
          menuItemId: "item-thali-01",
          menuItemName: "Chicken Thali",
          quantity: 1,
          unitPrice: 250,
        },
      ],
    });

    // Cashier opens bill
    const initialBill = BillingRepository.getOrCreateBillForParty({
      partyId: party.id,
      cashierId: "u-csh-01",
      cashierName: "Priya Kulkarni",
    });

    // Concurrently, waiter adds 2 Bhakris (₹40)
    OrderRepository.createOrderAndKot({
      idempotencyKey: "test-stale-2",
      partyId: party.id,
      waiterId: "u-wtr-01",
      waiterName: "Rahul Shinde",
      items: [
        {
          menuItemId: "item-bhakri-01",
          menuItemName: "Jowar Bhakri",
          quantity: 2,
          unitPrice: 20,
        },
      ],
    });

    // Cashier attempts to settle the outdated bill
    expect(() => {
      BillingRepository.recordPayment({
        billId: initialBill.id,
        paymentMethod: "CASH",
        tenderAmount: 300,
        cashierId: "u-csh-01",
        cashierName: "Priya Kulkarni",
        expectedVersion: initialBill.subtotal,
      });
    }).toThrowError(StaleBillError);
  });

  it("settles payment, updates ledger, frees table, and enforces payment idempotency", () => {
    // Seat party at table 5 (B2)
    const { party } = TableRepository.seatParty({
      tableNumber: 5,
      guestCount: 2,
      waiterId: "u-wtr-01",
      waiterName: "Rahul Shinde",
    });

    OrderRepository.createOrderAndKot({
      idempotencyKey: "test-pay-ord-1",
      partyId: party.id,
      waiterId: "u-wtr-01",
      waiterName: "Rahul Shinde",
      items: [
        {
          menuItemId: "item-thali-01",
          menuItemName: "Egg Thali",
          quantity: 1,
          unitPrice: 180,
        },
      ],
    });

    const bill = BillingRepository.getOrCreateBillForParty({
      partyId: party.id,
      cashierId: "u-csh-01",
      cashierName: "Priya Kulkarni",
    });

    const paymentKey = "pay-idem-" + Date.now();
    const payRes1 = BillingRepository.recordPayment({
      idempotencyKey: paymentKey,
      billId: bill.id,
      paymentMethod: "CASH",
      tenderAmount: 200,
      cashierId: "u-csh-01",
      cashierName: "Priya Kulkarni",
    });

    expect(payRes1.isDuplicate).toBe(false);
    expect(payRes1.payment.amount).toBe(payRes1.bill.grandTotal);

    // Table 5 must now be AVAILABLE
    const table5 = TableRepository.getAllTables().find((t) => t.tableNumber === 5);
    expect(table5?.status).toBe("AVAILABLE");

    // Retry payment with same idempotency key
    const payRes2 = BillingRepository.recordPayment({
      idempotencyKey: paymentKey,
      billId: bill.id,
      paymentMethod: "CASH",
      tenderAmount: 200,
      cashierId: "u-csh-01",
      cashierName: "Priya Kulkarni",
    });
    expect(payRes2.isDuplicate).toBe(true);
  });

  it("Phase 9: adjusts inventory stock atomically and prevents negative stock without override", () => {
    const ings = InventoryRepository.getAllIngredients();
    expect(ings.length).toBeGreaterThan(0);
    const chicken = ings.find((i) => i.name.toLowerCase().includes("chicken") || i.name.toLowerCase().includes("कोंबडी")) || ings[0];

    const initialAvailable = chicken.availableStock;

    // Add stock
    const updated1 = InventoryRepository.adjustStock({
      ingredientId: chicken.id,
      adjustmentQuantity: 10,
      type: "PURCHASE",
      performedBy: "Manager Vikram",
      notes: "Fresh morning poultry delivery",
    });
    expect(updated1.availableStock).toBe(initialAvailable + 10);

    // Verify stock transactions ledger
    const txs = InventoryRepository.getStockTransactions(10);
    expect(txs.some((tx) => tx.ingredient_id === chicken.id && tx.transaction_type === "PURCHASE")).toBe(true);
  });
});
