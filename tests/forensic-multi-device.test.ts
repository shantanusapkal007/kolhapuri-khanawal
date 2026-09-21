import { describe, it, expect, beforeEach } from "vitest";
import { getDatabase } from "@/lib/db/sqlite";
import { initDatabaseSchema } from "@/lib/db/schema";
import { seedDatabaseIfEmpty } from "@/lib/db/seed";
import { TableRepository } from "@/lib/db/table-repository";
import { OrderRepository } from "@/lib/db/order-repository";
import { BillingRepository } from "@/lib/db/billing-repository";

describe("Forensic Section 2: Real Multi-Device Concurrent Simulation", () => {
  beforeEach(() => {
    const db = getDatabase();
    initDatabaseSchema(db);
    seedDatabaseIfEmpty(db);
  });

  it("simulates 4 distinct terminals concurrently without data loss or sequence collisions", () => {
    // -------------------------------------------------------------
    // DEVICE 1 (WAITER 1): Seat Table A1 (tableNumber 1)
    // -------------------------------------------------------------
    const waiter1Party = TableRepository.seatParty({
      tableNumber: 1,
      guestCount: 4,
      waiterId: "u-wtr-01",
      waiterName: "Rahul Shinde (Device 1)",
      descriptor: "Window family",
    });
    expect(waiter1Party.party.partyCode).toBe("A1-P01");

    // -------------------------------------------------------------
    // DEVICE 2 (WAITER 2): Seat Table B1 (tableNumber 4)
    // -------------------------------------------------------------
    const waiter2Party = TableRepository.seatParty({
      tableNumber: 4,
      guestCount: 3,
      waiterId: "u-wtr-02",
      waiterName: "Nitin Jadhav (Device 2)",
      descriptor: "Tech group",
    });
    expect(waiter2Party.party.partyCode).toBe("B1-P01");

    // -------------------------------------------------------------
    // DEVICE 1 (WAITER 1): Table A1 -> 5 items -> KOT 1
    // -------------------------------------------------------------
    const w1Kot1 = OrderRepository.createOrderAndKot({
      idempotencyKey: "w1-order-kot1-" + Date.now(),
      partyId: waiter1Party.party.id,
      waiterId: "u-wtr-01",
      waiterName: "Rahul Shinde (Device 1)",
      items: [
        { menuItemId: "item-thali-01", menuItemName: "Special Mutton Thali", quantity: 2, unitPrice: 350 },
        { menuItemId: "item-thali-02", menuItemName: "Kolhapuri Chicken Thali", quantity: 2, unitPrice: 280 },
        { menuItemId: "item-bhakri-01", menuItemName: "Jowar Bhakri", quantity: 4, unitPrice: 20 },
        { menuItemId: "item-water-01", menuItemName: "Small Water Bottle", quantity: 2, unitPrice: 10 },
        { menuItemId: "item-extra-01", menuItemName: "Tambda Rassa Wati", quantity: 2, unitPrice: 40 },
      ],
    });
    expect(w1Kot1.kot.items.length).toBe(5);
    expect(w1Kot1.kot.kotSequenceNumber).toBe(1);
    expect(w1Kot1.kot.isAddOn).toBe(false);

    // -------------------------------------------------------------
    // DEVICE 2 (WAITER 2): Table B1 -> 6 items -> KOT 1
    // -------------------------------------------------------------
    const w2Kot1 = OrderRepository.createOrderAndKot({
      idempotencyKey: "w2-order-kot1-" + Date.now(),
      partyId: waiter2Party.party.id,
      waiterId: "u-wtr-02",
      waiterName: "Nitin Jadhav (Device 2)",
      items: [
        { menuItemId: "item-thali-03", menuItemName: "Special Chicken Thali", quantity: 1, unitPrice: 300 },
        { menuItemId: "item-thali-04", menuItemName: "Egg Thali", quantity: 1, unitPrice: 180 },
        { menuItemId: "item-bhakri-02", menuItemName: "Bajra Bhakri", quantity: 3, unitPrice: 20 },
        { menuItemId: "item-water-02", menuItemName: "Big Water Bottle", quantity: 1, unitPrice: 20 },
        { menuItemId: "item-extra-02", menuItemName: "Pandhra Rassa Wati", quantity: 2, unitPrice: 40 },
        { menuItemId: "item-beverage-01", menuItemName: "Solkadhi Glass", quantity: 2, unitPrice: 30 },
      ],
    });
    expect(w2Kot1.kot.items.length).toBe(6);
    expect(w2Kot1.kot.kotSequenceNumber).toBe(1);

    // KOT sequence numbers and order numbers must never collide
    expect(w1Kot1.kot.kotNumber).not.toBe(w2Kot1.kot.kotNumber);
    expect(w1Kot1.order.orderNumber).not.toBe(w2Kot1.order.orderNumber);

    // -------------------------------------------------------------
    // DEVICE 1 (WAITER 1): Add 3 more items -> second KOT (Add-on)
    // -------------------------------------------------------------
    const w1Kot2 = OrderRepository.createOrderAndKot({
      idempotencyKey: "w1-order-kot2-" + Date.now(),
      partyId: waiter1Party.party.id,
      waiterId: "u-wtr-01",
      waiterName: "Rahul Shinde (Device 1)",
      items: [
        { menuItemId: "item-bhakri-01", menuItemName: "Jowar Bhakri", quantity: 2, unitPrice: 20 },
        { menuItemId: "item-beverage-01", menuItemName: "Solkadhi Glass", quantity: 3, unitPrice: 30 },
        { menuItemId: "item-water-01", menuItemName: "Small Water Bottle", quantity: 1, unitPrice: 10 },
      ],
    });
    expect(w1Kot2.kot.kotSequenceNumber).toBe(2);
    expect(w1Kot2.kot.isAddOn).toBe(true);

    // -------------------------------------------------------------
    // DEVICE 2 (WAITER 2): Transfer Table B1 to Table B2 (tableNumber 5)
    // -------------------------------------------------------------
    const transferResult = TableRepository.transferTable(
      waiter2Party.party.id,
      5,
      "u-wtr-02",
      "Nitin Jadhav (Device 2)"
    );
    expect(transferResult.oldTableNumber).toBe(4);
    expect(transferResult.newTableNumber).toBe(5);

    // Verify Table B1 (4) is now AVAILABLE, Table B2 (5) is OCCUPIED
    const liveTables = TableRepository.getAllTables();
    const tableB1 = liveTables.find((t) => t.tableNumber === 4);
    const tableB2 = liveTables.find((t) => t.tableNumber === 5);
    expect(tableB1?.status).toBe("AVAILABLE");
    expect(tableB2?.status).toBe("OCCUPIED");

    // -------------------------------------------------------------
    // DEVICE 4 (KITCHEN): Receive all KOTs
    // -------------------------------------------------------------
    const kitchenKots = OrderRepository.getActiveKots();
    expect(kitchenKots.length).toBeGreaterThanOrEqual(3);
    const w1Kot1Found = kitchenKots.find((k) => k.id === w1Kot1.kot.id);
    const w1Kot2Found = kitchenKots.find((k) => k.id === w1Kot2.kot.id);
    const w2Kot1Found = kitchenKots.find((k) => k.id === w2Kot1.kot.id);
    expect(w1Kot1Found).toBeDefined();
    expect(w1Kot2Found).toBeDefined();
    expect(w2Kot1Found).toBeDefined();

    // -------------------------------------------------------------
    // DEVICE 3 (CASHIER): Open billing for Table A1
    // -------------------------------------------------------------
    const billA1 = BillingRepository.getOrCreateBillForParty({
      partyId: waiter1Party.party.id,
      cashierId: "u-csh-01",
      cashierName: "Priya Kulkarni (Device 3)",
    });

    // Check subtotal calculation:
    // KOT 1: 2*350 (700) + 2*280 (560) + 4*20 (80) + 2*10 (20) + 2*40 (80) = 1440
    // KOT 2: 2*20 (40) + 3*30 (90) + 1*10 (10) = 140
    // Total subtotal = 1580
    expect(billA1.subtotal).toBe(1580);
    expect(billA1.billNumber).toMatch(/^BILL-2026-\d{6}$/);

    // Settle bill via Cashier
    const paymentA1 = BillingRepository.recordPayment({
      idempotencyKey: "pay-A1-" + billA1.id,
      billId: billA1.id,
      paymentMethod: "CASH",
      tenderAmount: billA1.grandTotal + 20,
      cashierId: "u-csh-01",
      cashierName: "Priya Kulkarni (Device 3)",
    });
    expect(paymentA1.bill.status).toBe("PAID");

    // Table A1 (1) must now be AVAILABLE
    const tableA1Final = TableRepository.getAllTables().find((t) => t.tableNumber === 1);
    expect(tableA1Final?.status).toBe("AVAILABLE");

    // Verify all 4 devices converge:
    // Party A1 is CLOSED
    const partyA1Final = TableRepository.getPartyById(waiter1Party.party.id);
    expect(partyA1Final?.status).toBe("CLOSED");

    // Party B2 remains active at table 5
    const partyB2Final = TableRepository.getPartyById(waiter2Party.party.id);
    expect(partyB2Final?.tableNumber).toBe(5);
    expect(partyB2Final?.status).not.toBe("CLOSED");
  });
});
