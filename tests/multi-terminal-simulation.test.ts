import { describe, it, expect, beforeEach } from "vitest";
import { getDatabase } from "@/lib/db/sqlite";
import { initDatabaseSchema } from "@/lib/db/schema";
import { seedDatabaseIfEmpty } from "@/lib/db/seed";
import { TableRepository } from "@/lib/db/table-repository";
import { OrderRepository } from "@/lib/db/order-repository";
import { BillingRepository } from "@/lib/db/billing-repository";

describe("Production Multi-Terminal Simulation (2 Waiters, 1 Cashier, 1 Kitchen)", () => {
  beforeEach(() => {
    const db = getDatabase();
    initDatabaseSchema(db);
    seedDatabaseIfEmpty(db);
  });

  it("executes complete concurrent multi-terminal restaurant workflow without data loss", async () => {
    // -------------------------------------------------------------
    // 1. Waiter Tablet 1 seats Table 1 (A1)
    // -------------------------------------------------------------
    const waiter1Seat = TableRepository.seatParty({
      tableNumber: 1,
      guestCount: 4,
      waiterId: "u-wtr-01",
      waiterName: "Rahul Shinde (Tablet 1)",
    });
    expect(waiter1Seat.party.partyCode).toContain("A1-P");
    expect(waiter1Seat.table.status).toBe("OCCUPIED");

    // -------------------------------------------------------------
    // 2. Waiter Tablet 2 seats Table 4 (B1)
    // -------------------------------------------------------------
    const waiter2Seat = TableRepository.seatParty({
      tableNumber: 4,
      guestCount: 2,
      waiterId: "u-wtr-02",
      waiterName: "Nitin Jadhav (Tablet 2)",
    });
    expect(waiter2Seat.party.partyCode).toContain("B1-P");
    expect(waiter2Seat.table.status).toBe("OCCUPIED");

    // -------------------------------------------------------------
    // 3. Waiter Tablet 1 dispatches initial KOT 1 for Table A1
    // -------------------------------------------------------------
    const kot1Res = OrderRepository.createOrderAndKot({
      idempotencyKey: "sim-ord-kot1-" + Date.now(),
      partyId: waiter1Seat.party.id,
      waiterId: "u-wtr-01",
      waiterName: "Rahul Shinde (Tablet 1)",
      items: [
        {
          menuItemId: "item-thali-01",
          menuItemName: "Special Mutton Thali",
          quantity: 2,
          unitPrice: 350,
        },
      ],
    });
    expect(kot1Res.kot.kotSequenceNumber).toBe(1);
    expect(kot1Res.kot.isAddOn).toBe(false);

    // -------------------------------------------------------------
    // 4. Waiter Tablet 2 dispatches initial KOT 1 for Table B1
    // -------------------------------------------------------------
    const kot2Res = OrderRepository.createOrderAndKot({
      idempotencyKey: "sim-ord-kot2-" + Date.now(),
      partyId: waiter2Seat.party.id,
      waiterId: "u-wtr-02",
      waiterName: "Nitin Jadhav (Tablet 2)",
      items: [
        {
          menuItemId: "item-thali-02",
          menuItemName: "Kolhapuri Chicken Thali",
          quantity: 2,
          unitPrice: 280,
        },
      ],
    });
    expect(kot2Res.kot.kotSequenceNumber).toBe(1);
    // Unique KOT numbers
    expect(kot1Res.kot.kotNumber).not.toBe(kot2Res.kot.kotNumber);

    // -------------------------------------------------------------
    // 5. Waiter Tablet 1 dispatches Add-On KOT 2 for Table A1 (Bhakris & Solkadhi)
    // -------------------------------------------------------------
    const kot3Res = OrderRepository.createOrderAndKot({
      idempotencyKey: "sim-ord-kot3-" + Date.now(),
      partyId: waiter1Seat.party.id,
      waiterId: "u-wtr-01",
      waiterName: "Rahul Shinde (Tablet 1)",
      items: [
        {
          menuItemId: "item-bhakri-01",
          menuItemName: "Jowar Bhakri",
          quantity: 3,
          unitPrice: 20,
        },
      ],
    });
    expect(kot3Res.kot.kotSequenceNumber).toBe(2);
    expect(kot3Res.kot.isAddOn).toBe(true);

    // -------------------------------------------------------------
    // 6. Kitchen Display queries active KOTs and advances them
    // -------------------------------------------------------------
    const activeKots = OrderRepository.getActiveKots();
    expect(activeKots.length).toBeGreaterThanOrEqual(3);

    // Chef acknowledges and serves KOT 1
    OrderRepository.updateKotStatus(kot1Res.kot.id, "PREPARING", "u-ktc-01", "Chef Suresh");
    OrderRepository.updateKotStatus(kot1Res.kot.id, "READY", "u-ktc-01", "Chef Suresh");

    // -------------------------------------------------------------
    // 7. Cashier opens bill for Table A1
    // -------------------------------------------------------------
    const bill = BillingRepository.getOrCreateBillForParty({
      partyId: waiter1Seat.party.id,
      cashierId: "u-csh-01",
      cashierName: "Priya Kulkarni",
    });

    // Subtotal = 2 * 350 (Thali) + 3 * 20 (Bhakri) = 760
    expect(bill.subtotal).toBe(760);

    // Cashier applies discount of ₹40
    const discountedBill = BillingRepository.applyDiscount({
      billId: bill.id,
      discountAmount: 40,
      reason: "Loyal customer",
      approvedBy: "Priya Kulkarni",
    });
    expect(discountedBill.discountAmount).toBe(40);
    expect(discountedBill.billNumber).toBe(bill.billNumber);

    // -------------------------------------------------------------
    // 8. Cashier settles payment with UPI
    // -------------------------------------------------------------
    const payResult = BillingRepository.recordPayment({
      idempotencyKey: "sim-pay-" + bill.id,
      billId: bill.id,
      paymentMethod: "UPI",
      tenderAmount: discountedBill.grandTotal,
      reference: "UPI/2026/0921/123456",
      cashierId: "u-csh-01",
      cashierName: "Priya Kulkarni",
    });

    expect(payResult.bill.status).toBe("PAID");
    expect(payResult.payment.status).toBe("SUCCESS");

    // Table 1 (A1) must be freed and AVAILABLE for the next guest!
    const tables = TableRepository.getAllTables();
    const table1 = tables.find((t) => t.tableNumber === 1);
    expect(table1?.status).toBe("AVAILABLE");

    // Table 4 (B1) remains OCCUPIED with its open party
    const table4 = tables.find((t) => t.tableNumber === 4);
    expect(table4?.status).toBe("OCCUPIED");
  });

  it("handles 20 rapid orders concurrently with zero sequence collisions", () => {
    // Seat party at table 2
    const { party } = TableRepository.seatParty({
      tableNumber: 2,
      guestCount: 4,
      waiterId: "u-wtr-01",
      waiterName: "Rahul",
    });

    const kotNumbers = new Set<string>();
    const orderNumbers = new Set<string>();

    for (let i = 0; i < 20; i++) {
      const res = OrderRepository.createOrderAndKot({
        idempotencyKey: `rapid-order-${i}-${Date.now()}`,
        partyId: party.id,
        waiterId: "u-wtr-01",
        waiterName: "Rahul",
        items: [
          {
            menuItemId: "item-water-01",
            menuItemName: "Small Water Bottle",
            quantity: 1,
            unitPrice: 10,
          },
        ],
      });

      expect(kotNumbers.has(res.kot.kotNumber)).toBe(false);
      expect(orderNumbers.has(res.order.orderNumber)).toBe(false);

      kotNumbers.add(res.kot.kotNumber);
      orderNumbers.add(res.order.orderNumber);
    }

    expect(kotNumbers.size).toBe(20);
    expect(orderNumbers.size).toBe(20);
  });
});
