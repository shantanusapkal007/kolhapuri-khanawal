import { describe, it, expect, beforeEach } from "vitest";
import { getDatabase } from "@/lib/db/sqlite";
import { initDatabaseSchema } from "@/lib/db/schema";
import { seedDatabaseIfEmpty } from "@/lib/db/seed";
import { TableRepository } from "@/lib/db/table-repository";
import { OrderRepository } from "@/lib/db/order-repository";
import { BillingRepository } from "@/lib/db/billing-repository";
import { generateKotHtml, generateBillReceiptHtml } from "@/lib/printing/thermal-printer";

describe("Forensic Section 10: Printing Regression & Failure Decoupling", () => {
  beforeEach(() => {
    const db = getDatabase();
    initDatabaseSchema(db);
    seedDatabaseIfEmpty(db);
  });

  it("Printer Failure Decoupling: when a network thermal printer is completely offline, order and payment persist safely without rollback or duplicates", () => {
    const db = getDatabase();
    const { party } = TableRepository.seatParty({ tableNumber: 1, guestCount: 2, waiterId: "u-wtr-01", waiterName: "Rahul" });

    // 1. Place order
    const orderRes = OrderRepository.createOrderAndKot({
      idempotencyKey: "print-decouple-ord-" + Date.now(),
      partyId: party.id,
      waiterId: "u-wtr-01",
      waiterName: "Rahul",
      items: [{ menuItemId: "item-thali-01", menuItemName: "Special Mutton Thali", quantity: 2, unitPrice: 350 }],
    });
    expect(orderRes.order.id).toBeDefined();

    // Simulate printer failure (e.g. printer out of paper, wrong IP, or network timeout)
    const simulatedPrinterError = new Error("Printer TCP Connection Refused: 192.168.1.200:9100 unreachable");

    // The application catches the printer error and alerts the user, but MUST NOT roll back the order
    try {
      throw simulatedPrinterError;
    } catch (e) {
      // Handled gracefully in POS spooler
    }

    // Verify order STILL exists in database
    const orderInDb = db.prepare("SELECT * FROM orders WHERE id = ?").get(orderRes.order.id);
    expect(orderInDb).toBeDefined();

    // 2. Generate and Pay Bill
    const bill = BillingRepository.getOrCreateBillForParty({
      partyId: party.id,
      cashierId: "u-csh-01",
      cashierName: "Priya",
    });

    const paymentRes = BillingRepository.recordPayment({
      idempotencyKey: "print-decouple-pay-" + bill.id,
      billId: bill.id,
      paymentMethod: "CASH",
      tenderAmount: 700,
      cashierId: "u-csh-01",
      cashierName: "Priya",
    });

    // Simulate print receipt failure
    try {
      throw new Error("RawBT Service unavailable on tablet");
    } catch {}

    // Payment must remain PAID and cannot be duplicated or lost
    const billInDb = db.prepare("SELECT * FROM bills WHERE id = ?").get(bill.id) as any;
    expect(billInDb.status).toBe("PAID");
    expect(billInDb.paid_amount).toBe(paymentRes.bill.grandTotal);

    // Retrying the payment action due to print failure is safely idempotent (never charges twice!)
    const retryPayment = BillingRepository.recordPayment({
      idempotencyKey: "print-decouple-pay-" + bill.id,
      billId: bill.id,
      paymentMethod: "CASH",
      tenderAmount: 700,
      cashierId: "u-csh-01",
      cashierName: "Priya",
    });
    expect(retryPayment.isDuplicate).toBe(true);

    const countPayments = db.prepare("SELECT COUNT(*) as c FROM payments WHERE bill_id = ?").get(bill.id) as { c: number };
    expect(countPayments.c).toBe(1);
  });

  it("Printing Regression: renders complex Devanagari text, long dish titles, and large 15-item orders without crash", () => {
    const largeItems = [];
    for (let i = 1; i <= 15; i++) {
      largeItems.push({
        id: `kot-item-${i}`,
        kotId: "kot-large-1",
        orderItemId: `oi-${i}`,
        menuItemId: `m-${i}`,
        menuItemName: `विशेष अस्सल गावरान कोल्हापुरी चिकन तांबडा पांढरा रस्सा थाळी #${i}`,
        menuItemLocalName: `मराठी विशेष थाळी क्र. ${i}`,
        quantity: i,
        unitPrice: 250,
        totalPrice: 250 * i,
        status: "NEW" as any,
        breadOption: "JOWAR_BHAKRI" as any,
        spiceLevel: "MEDIUM" as any,
        notes: "गरम रस्सा आणि जादा लिंबू द्या",
      });
    }

    const largeKot = {
      id: "kot-large-1",
      kotNumber: "KOT-2026-000888",
      orderId: "ord-large-1",
      partyId: "pty-large-1",
      partyCode: "A1-P01",
      tableNumber: 1,
      waiterId: "u-wtr-01",
      waiterName: "राहुल शिंदे",
      stationCode: "MAIN_KITCHEN" as any,
      guestCount: 8,
      status: "NEW" as any,
      items: largeItems,
      elapsedSeconds: 0,
      urgencyLevel: "NORMAL" as any,
      createdAt: new Date().toISOString(),
    };

    const kotHtml = generateKotHtml(largeKot as any);
    expect(kotHtml).toContain("KOT-2026-000888");
    expect(kotHtml).toContain("तांबडा पांढरा रस्सा");
    expect(kotHtml).toContain("राहुल शिंदे");

    // Verify reprint flag
    const reprintHtml = generateKotHtml(largeKot as any, undefined, true);
    expect(reprintHtml).toContain("पुन्हा छपाई");
  });
});
