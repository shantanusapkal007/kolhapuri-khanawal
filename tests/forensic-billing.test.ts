import { describe, it, expect, beforeEach } from "vitest";
import { getDatabase } from "@/lib/db/sqlite";
import { initDatabaseSchema } from "@/lib/db/schema";
import { seedDatabaseIfEmpty } from "@/lib/db/seed";
import { TableRepository } from "@/lib/db/table-repository";
import { OrderRepository } from "@/lib/db/order-repository";
import { BillingRepository, StaleBillError } from "@/lib/db/billing-repository";
import { generateBillReceiptHtml } from "@/lib/printing/thermal-printer";

describe("Forensic Section 5: Billing Forensic & Statutory Number Invariance", () => {
  beforeEach(() => {
    const db = getDatabase();
    initDatabaseSchema(db);
    seedDatabaseIfEmpty(db);
  });

  it("verifies mathematical consistency across DB, API, and Print formatting without burning bill numbers", () => {
    // 1. Seat Party at Table 1
    const { party } = TableRepository.seatParty({
      tableNumber: 1,
      guestCount: 2,
      waiterId: "u-wtr-01",
      waiterName: "Rahul",
    });

    // 2. Initial Order: 2x Special Mutton Thali (₹350 each = ₹700)
    OrderRepository.createOrderAndKot({
      idempotencyKey: "bill-forensic-1",
      partyId: party.id,
      waiterId: "u-wtr-01",
      waiterName: "Rahul",
      items: [{ menuItemId: "item-thali-01", menuItemName: "Special Mutton Thali", quantity: 2, unitPrice: 350 }],
    });

    // 3. Generate Bill
    const bill1 = BillingRepository.getOrCreateBillForParty({
      partyId: party.id,
      cashierId: "u-csh-01",
      cashierName: "Priya",
    });
    const originalBillNumber = bill1.billNumber;
    expect(originalBillNumber).toMatch(/^BILL-2026-\d{6}$/);
    expect(bill1.subtotal).toBe(700);

    // 4. Apply ₹100 discount
    const bill2 = BillingRepository.applyDiscount({
      billId: bill1.id,
      discountAmount: 100,
      reason: "VIP Privilege",
      approvedBy: "Priya",
    });

    // STATUTORY INVARIANCE: Bill number must be strictly preserved
    expect(bill2.billNumber).toBe(originalBillNumber);
    expect(bill2.discountAmount).toBe(100);
    // Net taxable = 700 - 100 = 600
    // CGST 2.5% = 15, SGST 2.5% = 15, Total Tax = 30
    // Grand Total = 630
    expect(bill2.taxableAmount).toBe(600);
    expect(bill2.cgstAmount).toBe(15);
    expect(bill2.sgstAmount).toBe(15);
    expect(bill2.totalTaxAmount).toBe(30);
    expect(bill2.grandTotal).toBe(630);

    // 5. Waiter adds 2x Bhakri (₹20 each = ₹40) while bill is open
    OrderRepository.createOrderAndKot({
      idempotencyKey: "bill-forensic-2",
      partyId: party.id,
      waiterId: "u-wtr-01",
      waiterName: "Rahul",
      items: [{ menuItemId: "item-bhakri-01", menuItemName: "Jowar Bhakri", quantity: 2, unitPrice: 20 }],
    });

    // 6. Cashier attempts to settle outdated bill (₹630) without refreshing
    expect(() => {
      BillingRepository.recordPayment({
        billId: bill1.id,
        paymentMethod: "CASH",
        tenderAmount: 630,
        cashierId: "u-csh-01",
        cashierName: "Priya",
        expectedVersion: bill2.version, // outdated version / unbilled items
      });
    }).toThrowError(StaleBillError);

    // 7. Refresh bill with updated items
    const refreshedBill = BillingRepository.getOrCreateBillForParty({
      partyId: party.id,
      cashierId: "u-csh-01",
      cashierName: "Priya",
    });
    // Still uses the exact same statutory bill number!
    expect(refreshedBill.billNumber).toBe(originalBillNumber);
    // Subtotal = 700 + 40 = 740
    // Net taxable = 740 - 100 = 640
    // Tax = 5% of 640 = 32 (CGST 16 + SGST 16)
    // Grand Total = 672
    expect(refreshedBill.subtotal).toBe(740);
    expect(refreshedBill.taxableAmount).toBe(640);
    expect(refreshedBill.totalTaxAmount).toBe(32);
    expect(refreshedBill.grandTotal).toBe(672);

    // 8. Settle updated bill
    const payment = BillingRepository.recordPayment({
      idempotencyKey: "bill-forensic-pay-" + refreshedBill.id,
      billId: refreshedBill.id,
      paymentMethod: "UPI",
      tenderAmount: 672,
      reference: "UPI-OKAX-999888",
      cashierId: "u-csh-01",
      cashierName: "Priya",
    });

    expect(payment.bill.status).toBe("PAID");
    expect(payment.bill.paidAmount).toBe(672);
    expect(payment.bill.balanceDue).toBe(0);

    // 9. Paid bill becomes immutable: attempting to apply discount after settlement throws error
    expect(() => {
      BillingRepository.applyDiscount({
        billId: refreshedBill.id,
        discountAmount: 20,
        approvedBy: "Priya",
      });
    }).toThrowError(/cannot apply discount to paid bill/i);

    // 10. CROSS-LAYER VERIFICATION: Compare Database row vs In-memory vs ESC/POS Print bytes
    const db = getDatabase();
    const dbRow = db.prepare("SELECT * FROM bills WHERE id = ?").get(refreshedBill.id) as any;
    expect(dbRow.grand_total).toBe(672);
    expect(dbRow.subtotal).toBe(740);
    expect(dbRow.paid_amount).toBe(672);
    expect(dbRow.status).toBe("PAID");

    // Generate printed receipt HTML
    const receiptHtml = generateBillReceiptHtml(refreshedBill, {
      paperWidth: "80mm",
      showGst: true,
      showMarathiText: true,
    } as any);

    expect(receiptHtml).toContain(originalBillNumber);
    expect(receiptHtml).toContain("672");
    expect(receiptHtml).toContain("740");
    expect(receiptHtml).toContain("Special Mutton Thali");
  });
});
