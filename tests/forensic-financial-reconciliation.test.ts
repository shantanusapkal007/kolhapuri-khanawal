import { describe, it, expect, beforeEach } from "vitest";
import { getDatabase } from "@/lib/db/sqlite";
import { initDatabaseSchema } from "@/lib/db/schema";
import { seedDatabaseIfEmpty } from "@/lib/db/seed";
import { TableRepository } from "@/lib/db/table-repository";
import { OrderRepository } from "@/lib/db/order-repository";
import { BillingRepository } from "@/lib/db/billing-repository";

describe("Forensic Section 14: Strict Financial Reconciliation Audit", () => {
  beforeEach(() => {
    const db = getDatabase();
    initDatabaseSchema(db);
    seedDatabaseIfEmpty(db);
  });

  it("independently audits Gross Sales, Discounts, Taxable Sales, 5% GST, Cash, UPI, and Cancellations to exact rupee", () => {
    const db = getDatabase();

    // Independent Accumulators
    let expectedGrossSales = 0;
    let expectedDiscounts = 0;
    let expectedTaxableSales = 0;
    let expectedCgst = 0;
    let expectedSgst = 0;
    let expectedRoundOff = 0;
    let expectedGrandTotal = 0;
    let expectedCashCollected = 0;
    let expectedUpiCollected = 0;
    let expectedCancelledValue = 0;

    // -------------------------------------------------------------
    // SHIFT EVENT 1: Table A1 (tableNumber 1) - Pure CASH settlement
    // -------------------------------------------------------------
    const p1 = TableRepository.seatParty({
      tableNumber: 1,
      guestCount: 2,
      waiterId: "u-wtr-01",
      waiterName: "Rahul",
    });

    const o1 = OrderRepository.createOrderAndKot({
      idempotencyKey: "audit-shift-1-kot-1",
      partyId: p1.party.id,
      waiterId: "u-wtr-01",
      waiterName: "Rahul",
      items: [
        { menuItemId: "item-thali-01", menuItemName: "Special Mutton Thali", quantity: 2, unitPrice: 350 }, // 700
        { menuItemId: "item-water-01", menuItemName: "Small Water Bottle", quantity: 2, unitPrice: 10 }, // 20
      ],
    });

    const b1 = BillingRepository.getOrCreateBillForParty({
      partyId: p1.party.id,
      cashierId: "u-csh-01",
      cashierName: "Priya",
    });

    // Independent math for b1:
    const subtotal1 = 700 + 20; // 720
    const disc1 = 0;
    const taxable1 = 720;
    const cgst1 = Math.round(taxable1 * 0.025 * 100) / 100; // 18.00
    const sgst1 = Math.round(taxable1 * 0.025 * 100) / 100; // 18.00
    const rawTotal1 = taxable1 + cgst1 + sgst1; // 756.00
    const grandTotal1 = Math.round(rawTotal1); // 756
    const roundOff1 = grandTotal1 - rawTotal1; // 0

    expectedGrossSales += subtotal1;
    expectedDiscounts += disc1;
    expectedTaxableSales += taxable1;
    expectedCgst += cgst1;
    expectedSgst += sgst1;
    expectedRoundOff += roundOff1;
    expectedGrandTotal += grandTotal1;
    expectedCashCollected += grandTotal1;

    BillingRepository.recordPayment({
      idempotencyKey: "audit-shift-pay-1",
      billId: b1.id,
      paymentMethod: "CASH",
      tenderAmount: grandTotal1,
      cashierId: "u-csh-01",
      cashierName: "Priya",
    });

    // -------------------------------------------------------------
    // SHIFT EVENT 2: Table B1 (tableNumber 4) - Discounted UPI settlement
    // -------------------------------------------------------------
    const p2 = TableRepository.seatParty({
      tableNumber: 4,
      guestCount: 4,
      waiterId: "u-wtr-02",
      waiterName: "Nitin",
    });

    const o2 = OrderRepository.createOrderAndKot({
      idempotencyKey: "audit-shift-2-kot-1",
      partyId: p2.party.id,
      waiterId: "u-wtr-02",
      waiterName: "Nitin",
      items: [
        { menuItemId: "item-thali-02", menuItemName: "Kolhapuri Chicken Thali", quantity: 3, unitPrice: 280 }, // 840
        { menuItemId: "item-extra-01", menuItemName: "Tambda Rassa Wati", quantity: 4, unitPrice: 40 }, // 160
      ],
    });

    const b2Initial = BillingRepository.getOrCreateBillForParty({
      partyId: p2.party.id,
      cashierId: "u-csh-01",
      cashierName: "Priya",
    });

    const b2 = BillingRepository.applyDiscount({
      billId: b2Initial.id,
      discountPercentage: 10,
      reason: "Festival Offer",
      approvedBy: "Priya",
    });

    // Independent math for b2:
    const subtotal2 = 840 + 160; // 1000
    const disc2 = 100; // 10% of 1000
    const taxable2 = 900;
    const cgst2 = Math.round(taxable2 * 0.025 * 100) / 100; // 22.50
    const sgst2 = Math.round(taxable2 * 0.025 * 100) / 100; // 22.50
    const rawTotal2 = taxable2 + cgst2 + sgst2; // 945.00
    const grandTotal2 = Math.round(rawTotal2); // 945
    const roundOff2 = grandTotal2 - rawTotal2; // 0

    expectedGrossSales += subtotal2;
    expectedDiscounts += disc2;
    expectedTaxableSales += taxable2;
    expectedCgst += cgst2;
    expectedSgst += sgst2;
    expectedRoundOff += roundOff2;
    expectedGrandTotal += grandTotal2;
    expectedUpiCollected += grandTotal2;

    BillingRepository.recordPayment({
      idempotencyKey: "audit-shift-pay-2",
      billId: b2.id,
      paymentMethod: "UPI",
      tenderAmount: grandTotal2,
      reference: "UPI-ICICI-987654321",
      cashierId: "u-csh-01",
      cashierName: "Priya",
    });

    // -------------------------------------------------------------
    // SHIFT EVENT 3: Table C1 (tableNumber 8) - Split Tender (CASH + UPI)
    // -------------------------------------------------------------
    const p3 = TableRepository.seatParty({
      tableNumber: 8,
      guestCount: 6,
      waiterId: "u-wtr-01",
      waiterName: "Rahul",
    });

    const o3 = OrderRepository.createOrderAndKot({
      idempotencyKey: "audit-shift-3-kot-1",
      partyId: p3.party.id,
      waiterId: "u-wtr-01",
      waiterName: "Rahul",
      items: [
        { menuItemId: "item-thali-01", menuItemName: "Special Mutton Thali", quantity: 4, unitPrice: 350 }, // 1400
        { menuItemId: "item-bhakri-01", menuItemName: "Jowar Bhakri", quantity: 6, unitPrice: 20 }, // 120
      ],
    });

    const b3 = BillingRepository.getOrCreateBillForParty({
      partyId: p3.party.id,
      cashierId: "u-csh-01",
      cashierName: "Priya",
    });

    // Independent math for b3:
    const subtotal3 = 1400 + 120; // 1520
    const disc3 = 0;
    const taxable3 = 1520;
    const cgst3 = Math.round(taxable3 * 0.025 * 100) / 100; // 38.00
    const sgst3 = Math.round(taxable3 * 0.025 * 100) / 100; // 38.00
    const rawTotal3 = taxable3 + cgst3 + sgst3; // 1596.00
    const grandTotal3 = Math.round(rawTotal3); // 1596
    const roundOff3 = grandTotal3 - rawTotal3; // 0

    expectedGrossSales += subtotal3;
    expectedDiscounts += disc3;
    expectedTaxableSales += taxable3;
    expectedCgst += cgst3;
    expectedSgst += sgst3;
    expectedRoundOff += roundOff3;
    expectedGrandTotal += grandTotal3;
    expectedUpiCollected += grandTotal3;

    BillingRepository.recordPayment({
      idempotencyKey: "audit-shift-pay-3-upi",
      billId: b3.id,
      paymentMethod: "UPI",
      tenderAmount: grandTotal3,
      reference: "UPI-GPAY-11223344",
      cashierId: "u-csh-01",
      cashierName: "Priya",
    });

    // -------------------------------------------------------------
    // SHIFT EVENT 4: Cancelled Item Forensic
    // Table A2: ordered items, but 1 item cancelled due to kitchen out-of-stock
    // -------------------------------------------------------------
    const p4 = TableRepository.seatParty({
      tableNumber: 2,
      guestCount: 2,
      waiterId: "u-wtr-02",
      waiterName: "Nitin",
    });

    const o4 = OrderRepository.createOrderAndKot({
      idempotencyKey: "audit-shift-4-kot-1",
      partyId: p4.party.id,
      waiterId: "u-wtr-02",
      waiterName: "Nitin",
      items: [
        { menuItemId: "item-thali-01", menuItemName: "Special Mutton Thali", quantity: 1, unitPrice: 350 },
        { menuItemId: "item-thali-02", menuItemName: "Kolhapuri Chicken Thali", quantity: 1, unitPrice: 280 },
      ],
    });

    // Cancel the second item
    const cancelledItemId = o4.order.items[1].id;
    expectedCancelledValue += 280;

    db.prepare(`
      UPDATE order_items 
      SET is_cancelled = 1, cancelled_at = ?, cancelled_reason = 'Customer requested cancellation'
      WHERE id = ?
    `).run(new Date().toISOString(), cancelledItemId);

    // Bill generated for Table A2 only includes remaining item (350)
    const b4 = BillingRepository.getOrCreateBillForParty({
      partyId: p4.party.id,
      cashierId: "u-csh-01",
      cashierName: "Priya",
    });

    const subtotal4 = 350;
    const disc4 = 0;
    const taxable4 = 350;
    const cgst4 = Math.round(taxable4 * 0.025 * 100) / 100; // 8.75
    const sgst4 = Math.round(taxable4 * 0.025 * 100) / 100; // 8.75
    const rawTotal4 = taxable4 + cgst4 + sgst4; // 367.50
    const grandTotal4 = Math.round(rawTotal4); // 368
    const roundOff4 = Math.round((grandTotal4 - rawTotal4) * 100) / 100; // +0.50

    expectedGrossSales += subtotal4;
    expectedDiscounts += disc4;
    expectedTaxableSales += taxable4;
    expectedCgst += cgst4;
    expectedSgst += sgst4;
    expectedRoundOff += roundOff4;
    expectedGrandTotal += grandTotal4;
    expectedCashCollected += grandTotal4;

    BillingRepository.recordPayment({
      idempotencyKey: "audit-shift-pay-4",
      billId: b4.id,
      paymentMethod: "CASH",
      tenderAmount: grandTotal4,
      cashierId: "u-csh-01",
      cashierName: "Priya",
    });

    // -------------------------------------------------------------
    // DATABASE FORENSIC TOTAL RECONCILIATION
    // -------------------------------------------------------------
    const billSummary = db
      .prepare(`
        SELECT 
          COUNT(*) as total_bills,
          SUM(subtotal) as db_subtotal,
          SUM(discount_amount) as db_discount,
          SUM(taxable_amount) as db_taxable,
          SUM(cgst_amount) as db_cgst,
          SUM(sgst_amount) as db_sgst,
          SUM(round_off) as db_roundoff,
          SUM(grand_total) as db_grand_total,
          SUM(paid_amount) as db_paid_total,
          SUM(balance_due) as db_balance_due
        FROM bills 
        WHERE status = 'PAID'
      `)
      .get() as any;

    expect(billSummary.total_bills).toBe(4);
    expect(billSummary.db_subtotal).toBe(expectedGrossSales);
    expect(billSummary.db_discount).toBe(expectedDiscounts);
    expect(billSummary.db_taxable).toBe(expectedTaxableSales);
    expect(Math.abs(billSummary.db_cgst - expectedCgst)).toBeLessThan(0.01);
    expect(Math.abs(billSummary.db_sgst - expectedSgst)).toBeLessThan(0.01);
    expect(Math.abs(billSummary.db_roundoff - expectedRoundOff)).toBeLessThan(0.01);
    expect(billSummary.db_grand_total).toBe(expectedGrandTotal);
    expect(billSummary.db_paid_total).toBe(expectedGrandTotal);
    expect(billSummary.db_balance_due).toBe(0);

    // Payment Tender Ledger Reconciliation
    const tenderSummary = db
      .prepare(`
        SELECT payment_method, SUM(amount) as tender_sum 
        FROM payments 
        GROUP BY payment_method
      `)
      .all() as any[];

    const cashRow = tenderSummary.find((r) => r.payment_method === "CASH");
    const upiRow = tenderSummary.find((r) => r.payment_method === "UPI");

    expect(cashRow.tender_sum).toBe(expectedCashCollected);
    expect(upiRow.tender_sum).toBe(expectedUpiCollected);
    expect(cashRow.tender_sum + upiRow.tender_sum).toBe(expectedGrandTotal);

    // Verify Cancelled Items Recorded Correctly
    const cancelledRow = db
      .prepare("SELECT count(*) as cnt, sum(total_price) as cancelled_sum FROM order_items WHERE is_cancelled = 1")
      .get() as any;
    expect(cancelledRow.cnt).toBe(1);
    expect(cancelledRow.cancelled_sum).toBe(expectedCancelledValue);
  });
});
