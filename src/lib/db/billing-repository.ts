/**
 * Authoritative Server-Side Billing Repository
 * Enforces:
 * - Phase 7: Single statutory bill number with in-place updates (discount/tax changes do not burn new numbers)
 * - Phase 7: Server-side authoritative calculation (never trusts client totals)
 * - Phase 8: Stale Bill Protection (detects concurrent waiter additions before cashier payment)
 * - Phase 4: Idempotent payments (prevents double-charging)
 * - Multi-tender settlement & automatic ledger updates (Cash & UPI)
 */

import { DatabaseSync } from "node:sqlite";
import { getDatabase, runTransaction } from "./sqlite";
import { generateAtomicBillNumber, nextSequence } from "./sequence-service";
import { Bill, BillItem, Payment } from "@/types/billing";

export class StaleBillError extends Error {
  currentBill: Bill;
  constructor(message: string, currentBill: Bill) {
    super(message);
    this.name = "StaleBillError";
    this.currentBill = currentBill;
  }
}

export interface GetOrCreateBillParams {
  partyId: string;
  cashierId: string;
  cashierName: string;
}

export interface ApplyDiscountParams {
  billId: string;
  discountPercentage?: number;
  discountAmount?: number;
  reason?: string;
  approvedBy: string;
  expectedVersion?: number;
}

export interface RecordPaymentParams {
  idempotencyKey?: string;
  billId: string;
  paymentMethod: "CASH" | "UPI" | "CARD" | "OTHER";
  tenderAmount: number;
  reference?: string;
  cashierId: string;
  cashierName: string;
  expectedVersion?: number;
}

export class BillingRepository {
  /**
   * Recalculate bill figures authoritatively from raw order items
   */
  private static calculateBillTotals(
    items: Array<{ unitPrice: number; quantity: number }>,
    discountPercentage: number = 0,
    discountFixedAmount: number = 0,
    packagingCharges: number = 0,
    gstRatePercent: number = 5.0
  ) {
    const subtotal = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);

    // Calculate discount
    let discountAmount = 0;
    if (discountFixedAmount > 0) {
      discountAmount = Math.min(discountFixedAmount, subtotal);
    } else if (discountPercentage > 0) {
      discountAmount = Math.round((subtotal * (discountPercentage / 100)) * 100) / 100;
    }

    const netTaxable = Math.max(0, subtotal - discountAmount);

    // GST calculation: e.g. 5% = CGST 2.5% + SGST 2.5%
    const cgstRate = gstRatePercent / 2;
    const sgstRate = gstRatePercent / 2;

    const cgstAmount = Math.round((netTaxable * (cgstRate / 100)) * 100) / 100;
    const sgstAmount = Math.round((netTaxable * (sgstRate / 100)) * 100) / 100;
    const totalTax = cgstAmount + sgstAmount;

    const rawTotal = netTaxable + totalTax + packagingCharges;
    const roundedGrandTotal = Math.round(rawTotal);
    const roundOff = Math.round((roundedGrandTotal - rawTotal) * 100) / 100;

    return {
      subtotal,
      discountAmount,
      taxableAmount: netTaxable,
      cgstAmount,
      sgstAmount,
      totalTaxAmount: totalTax,
      roundOff,
      grandTotal: roundedGrandTotal,
    };
  }

  /**
   * Get or generate the authoritative Bill for a party.
   * PHASE 7: If a bill already exists, updates it in place with any newly ordered items
   * without creating a new statutory bill number!
   */
  static getOrCreateBillForParty(params: GetOrCreateBillParams): Bill {
    return runTransaction((db: DatabaseSync) => {
      const now = new Date().toISOString();

      const party = db.prepare("SELECT * FROM dining_parties WHERE id = ?").get(params.partyId) as any;
      if (!party) {
        throw new Error(`Party ${params.partyId} not found`);
      }

      // 1. Fetch all authoritative non-cancelled order items for this party
      const orderItems = db
        .prepare(`
          SELECT 
            oi.id as order_item_id, oi.menu_item_id, oi.menu_item_name,
            oi.quantity, oi.unit_price, oi.total_price, oi.seat_number,
            oi.bread_option
          FROM order_items oi
          JOIN orders o ON oi.order_id = o.id
          WHERE oi.party_id = ? AND oi.is_cancelled = 0
        `)
        .all(params.partyId) as any[];

      if (orderItems.length === 0) {
        throw new Error("Cannot generate bill: Party has no ordered items");
      }

      // Check for existing bill
      const existingBill = db
        .prepare("SELECT * FROM bills WHERE party_id = ? ORDER BY created_at DESC LIMIT 1")
        .get(params.partyId) as any;

      if (existingBill) {
        if (existingBill.status === "PAID") {
          return this.getBillWithDetails(existingBill.id);
        }

        // Bill is OPEN - update in place (Phase 7)
        const calc = this.calculateBillTotals(
          orderItems.map((oi) => ({ unitPrice: oi.unit_price, quantity: oi.quantity })),
          existingBill.discount_percentage,
          existingBill.discount_amount,
          existingBill.packaging_charges,
          5.0
        );

        const newVersion = existingBill.version + 1;

        db.prepare(`
          UPDATE bills SET
            subtotal = ?,
            discount_amount = ?,
            taxable_amount = ?,
            cgst_amount = ?,
            sgst_amount = ?,
            total_tax_amount = ?,
            round_off = ?,
            grand_total = ?,
            balance_due = ?,
            version = ?,
            cashier_id = ?,
            cashier_name = ?
          WHERE id = ?
        `).run(
          calc.subtotal,
          calc.discountAmount,
          calc.taxableAmount,
          calc.cgstAmount,
          calc.sgstAmount,
          calc.totalTaxAmount,
          calc.roundOff,
          calc.grandTotal,
          calc.grandTotal - existingBill.paid_amount,
          newVersion,
          params.cashierId,
          params.cashierName,
          existingBill.id
        );

        // Synchronize bill_items table
        db.prepare("DELETE FROM bill_items WHERE bill_id = ?").run(existingBill.id);

        const insertBillItem = db.prepare(`
          INSERT INTO bill_items (
            id, bill_id, order_item_id, menu_item_id, menu_item_name,
            quantity, unit_price, total_price, seat_number, bread_option
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        for (const oi of orderItems) {
          insertBillItem.run(
            `bi-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            existingBill.id,
            oi.order_item_id,
            oi.menu_item_id,
            oi.menu_item_name,
            oi.quantity,
            oi.unit_price,
            oi.quantity * oi.unit_price,
            oi.seat_number || null,
            oi.bread_option || null
          );
        }

        return this.getBillWithDetails(existingBill.id);
      }

      // No existing bill: generate single statutory bill number atomically
      const { billNumber } = generateAtomicBillNumber();
      const billId = `bill-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const packaging = party.packaging_charges || 0.0;

      const calc = this.calculateBillTotals(
        orderItems.map((oi) => ({ unitPrice: oi.unit_price, quantity: oi.quantity })),
        0,
        0,
        packaging,
        5.0
      );

      db.prepare(`
        INSERT INTO bills (
          id, bill_number, party_id, party_code, table_id, table_number,
          waiter_id, waiter_name, cashier_id, cashier_name, status, version,
          subtotal, discount_percentage, discount_amount, taxable_amount,
          cgst_amount, sgst_amount, total_tax_amount, packaging_charges,
          round_off, grand_total, paid_amount, balance_due, is_takeaway,
          customer_name, customer_phone, created_at
        ) VALUES (
          ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'OPEN', 1,
          ?, 0.0, 0.0, ?, ?, ?, ?, ?,
          ?, ?, 0.0, ?, ?, ?, ?, ?
        )
      `).run(
        billId,
        billNumber,
        party.id,
        party.party_code,
        party.table_id,
        party.table_number,
        party.assigned_waiter_id,
        party.assigned_waiter_name,
        params.cashierId,
        params.cashierName,
        calc.subtotal,
        calc.taxableAmount,
        calc.cgstAmount,
        calc.sgstAmount,
        calc.totalTaxAmount,
        packaging,
        calc.roundOff,
        calc.grandTotal,
        calc.grandTotal,
        party.is_takeaway,
        party.customer_name || null,
        party.customer_phone || null,
        now
      );

      const insertBillItem = db.prepare(`
        INSERT INTO bill_items (
          id, bill_id, order_item_id, menu_item_id, menu_item_name,
          quantity, unit_price, total_price, seat_number, bread_option
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const oi of orderItems) {
        insertBillItem.run(
          `bi-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          billId,
          oi.order_item_id,
          oi.menu_item_id,
          oi.menu_item_name,
          oi.quantity,
          oi.unit_price,
          oi.quantity * oi.unit_price,
          oi.seat_number || null,
          oi.bread_option || null
        );
      }

      // Update party status to WAITING_FOR_BILL
      db.prepare("UPDATE dining_parties SET status = 'WAITING_FOR_BILL', last_activity_at = ? WHERE id = ?")
        .run(now, party.id);

      return this.getBillWithDetails(billId);
    });
  }

  /**
   * Apply Discount in place without burning a new statutory bill number
   */
  static applyDiscount(params: ApplyDiscountParams): Bill {
    return runTransaction((db: DatabaseSync) => {
      const bill = db.prepare("SELECT * FROM bills WHERE id = ?").get(params.billId) as any;
      if (!bill) {
        throw new Error(`Bill ${params.billId} not found`);
      }

      if (bill.status === "PAID" || bill.status === "CANCELLED") {
        throw new Error(`Cannot apply discount to ${bill.status.toLowerCase()} bill ${bill.bill_number}`);
      }

      // Concurrency check
      if (params.expectedVersion !== undefined && bill.version !== params.expectedVersion) {
        const currentBill = this.getBillWithDetails(bill.id);
        throw new StaleBillError("Bill has been modified by another terminal. Bill refreshed.", currentBill);
      }

      const items = db.prepare("SELECT unit_price, quantity FROM bill_items WHERE bill_id = ?").all(bill.id) as any[];

      const calc = this.calculateBillTotals(
        items.map((i) => ({ unitPrice: i.unit_price, quantity: i.quantity })),
        params.discountPercentage || 0,
        params.discountAmount || 0,
        bill.packaging_charges,
        5.0
      );

      const nextVer = bill.version + 1;
      const now = new Date().toISOString();

      db.prepare(`
        UPDATE bills SET
          discount_percentage = ?,
          discount_amount = ?,
          discount_reason = ?,
          discount_approved_by = ?,
          taxable_amount = ?,
          cgst_amount = ?,
          sgst_amount = ?,
          total_tax_amount = ?,
          round_off = ?,
          grand_total = ?,
          balance_due = ?,
          version = ?
        WHERE id = ?
      `).run(
        params.discountPercentage || 0,
        calc.discountAmount,
        params.reason || null,
        params.approvedBy,
        calc.taxableAmount,
        calc.cgstAmount,
        calc.sgstAmount,
        calc.totalTaxAmount,
        calc.roundOff,
        calc.grandTotal,
        calc.grandTotal - bill.paid_amount,
        nextVer,
        bill.id
      );

      // Audit log
      db.prepare(`
        INSERT INTO audit_logs (id, action, entity, entity_id, user_id, user_name, details, timestamp)
        VALUES (?, 'APPLY_DISCOUNT', 'bill', ?, ?, ?, ?, ?)
      `).run(
        `aud-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        bill.id,
        params.approvedBy,
        params.approvedBy,
        JSON.stringify({ billNumber: bill.bill_number, discountAmount: calc.discountAmount, reason: params.reason }),
        now
      );

      return this.getBillWithDetails(bill.id);
    });
  }

  /**
   * Settle Bill Payment with:
   * - Phase 4: Idempotency (safe against retries)
   * - Phase 8: Stale Bill Protection (verifies no unbilled order items were added by waiter)
   * - Phase 10: Automatic table vacating
   * - Cash / UPI ledger recording
   */
  static recordPayment(params: RecordPaymentParams): { bill: Bill; payment: Payment; isDuplicate: boolean } {
    const db = getDatabase();

    // 1. PHASE 4: Check Idempotency Store
    if (params.idempotencyKey) {
      const existing = db
        .prepare("SELECT response_json FROM idempotency_keys WHERE key = ?")
        .get(params.idempotencyKey) as { response_json: string } | undefined;

      if (existing) {
        try {
          const cached = JSON.parse(existing.response_json);
          return {
            ...cached,
            isDuplicate: true,
          };
        } catch {}
      }
    }

    return runTransaction((txDb: DatabaseSync) => {
      const now = new Date().toISOString();

      const bill = txDb.prepare("SELECT * FROM bills WHERE id = ?").get(params.billId) as any;
      if (!bill) {
        throw new Error(`Bill ${params.billId} not found`);
      }

      if (bill.status === "PAID") {
        const fullBill = this.getBillWithDetails(bill.id);
        const latestPayment = fullBill.payments[0];
        return { bill: fullBill, payment: latestPayment, isDuplicate: true };
      }

      // PHASE 8: Stale Bill Protection
      // Check if waiter added new order items that are not in the current bill
      const currentActiveItemCount = txDb
        .prepare(`
          SELECT COUNT(*) as c FROM order_items 
          WHERE party_id = ? AND is_cancelled = 0
        `)
        .get(bill.party_id) as { c: number };

      const billedItemCount = txDb
        .prepare("SELECT COUNT(*) as c FROM bill_items WHERE bill_id = ?")
        .get(bill.id) as { c: number };

      if (currentActiveItemCount.c !== billedItemCount.c) {
        // Stale bill detected! Refreshes bill with latest items
        const refreshed = this.getOrCreateBillForParty({
          partyId: bill.party_id,
          cashierId: params.cashierId,
          cashierName: params.cashierName,
        });
        throw new StaleBillError(
          `Order was updated by waiter (${currentActiveItemCount.c - billedItemCount.c} new items). Bill has been refreshed to ₹${refreshed.grandTotal}.`,
          refreshed
        );
      }

      if (params.expectedVersion !== undefined && bill.version !== params.expectedVersion) {
        const refreshed = this.getBillWithDetails(bill.id);
        throw new StaleBillError("Bill was modified concurrently. Refreshed.", refreshed);
      }

      // Check tender amount
      const changeGiven = Math.max(0, params.tenderAmount - bill.grand_total);
      const paidAmount = bill.grand_total;

      // Generate payment sequence
      const paySeq = nextSequence("payment_number", 5001);
      const paymentNumber = `PAY-2026-${String(paySeq).padStart(6, "0")}`;
      const paymentId = `pmt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

      // 2. Insert payment record
      txDb.prepare(`
        INSERT INTO payments (
          id, payment_number, bill_id, party_id, payment_method, amount,
          tender_amount, change_given, reference, cashier_id, cashier_name,
          status, processed_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'SUCCESS', ?)
      `).run(
        paymentId,
        paymentNumber,
        bill.id,
        bill.party_id,
        params.paymentMethod,
        paidAmount,
        params.tenderAmount,
        changeGiven,
        params.reference || null,
        params.cashierId,
        params.cashierName,
        now
      );

      // 3. Mark bill PAID and immutable
      txDb.prepare(`
        UPDATE bills SET
          paid_amount = ?,
          balance_due = 0.0,
          status = 'PAID',
          finalized_at = ?
        WHERE id = ?
      `).run(paidAmount, now, bill.id);

      // 4. Update Ledgers (Cash or UPI)
      const todayDate = now.slice(0, 10);
      if (params.paymentMethod === "CASH") {
        const lastLedger = txDb
          .prepare("SELECT balance FROM cash_ledger ORDER BY timestamp DESC LIMIT 1")
          .get() as { balance: number } | undefined;
        const currentBalance = (lastLedger?.balance || 0) + paidAmount;

        txDb.prepare(`
          INSERT INTO cash_ledger (
            id, date, entry_type, description, inflow, outflow, balance,
            reference_id, performed_by, timestamp
          ) VALUES (?, ?, 'INFLOW', ?, ?, 0.0, ?, ?, ?, ?)
        `).run(
          `csh-${Date.now()}`,
          todayDate,
          `Bill ${bill.bill_number} settlement (Table ${bill.table_number})`,
          paidAmount,
          currentBalance,
          bill.bill_number,
          params.cashierName,
          now
        );
      } else if (params.paymentMethod === "UPI") {
        const lastLedger = txDb
          .prepare("SELECT balance FROM upi_ledger ORDER BY timestamp DESC LIMIT 1")
          .get() as { balance: number } | undefined;
        const currentBalance = (lastLedger?.balance || 0) + paidAmount;

        txDb.prepare(`
          INSERT INTO upi_ledger (
            id, date, entry_type, description, inflow, outflow, balance,
            reference_id, performed_by, timestamp
          ) VALUES (?, ?, 'INFLOW', ?, ?, 0.0, ?, ?, ?, ?)
        `).run(
          `upi-${Date.now()}`,
          todayDate,
          `Bill ${bill.bill_number} UPI settlement`,
          paidAmount,
          currentBalance,
          bill.bill_number,
          params.cashierName,
          now
        );
      }

      // 5. Close Dining Party
      txDb.prepare(`
        UPDATE dining_parties SET
          status = 'CLOSED',
          closed_at = ?,
          last_activity_at = ?
        WHERE id = ?
      `).run(now, now, bill.party_id);

      // 6. Free Dining Table (Phase 10: Table Safety)
      txDb.prepare("UPDATE dining_tables SET status = 'AVAILABLE', updated_at = ? WHERE table_number = ?")
        .run(now, bill.table_number);

      // 7. Audit log
      txDb.prepare(`
        INSERT INTO audit_logs (id, action, entity, entity_id, user_id, user_name, details, timestamp)
        VALUES (?, 'SETTLE_BILL_PAYMENT', 'bill', ?, ?, ?, ?, ?)
      `).run(
        `aud-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        bill.id,
        params.cashierId,
        params.cashierName,
        JSON.stringify({
          billNumber: bill.bill_number,
          paymentMethod: params.paymentMethod,
          grandTotal: bill.grand_total,
          paymentNumber,
        }),
        now
      );

      const finalBill = this.getBillWithDetails(bill.id);
      const paymentRecord: Payment = {
        id: paymentId,
        billId: bill.id,
        paymentMethod: params.paymentMethod,
        amount: paidAmount,
        transactionReference: params.reference,
        receivedBy: params.cashierId,
        receivedByName: params.cashierName,
        status: "SUCCESS",
        paymentTime: now,
      };

      const result = {
        bill: finalBill,
        payment: paymentRecord,
        isDuplicate: false,
      };

      // 8. Persist Idempotency
      if (params.idempotencyKey) {
        txDb.prepare(`
          INSERT INTO idempotency_keys (key, operation_type, resource_id, response_json, created_at)
          VALUES (?, 'RECORD_PAYMENT', ?, ?, ?)
        `).run(params.idempotencyKey, bill.id, JSON.stringify(result), now);
      }

      return result;
    });
  }

  /**
   * Fetch full Bill object with items and payments
   */
  static getBillWithDetails(billId: string): Bill {
    const db = getDatabase();

    const b = db.prepare("SELECT * FROM bills WHERE id = ?").get(billId) as any;
    if (!b) {
      throw new Error(`Bill ${billId} not found`);
    }

    const items = db.prepare("SELECT * FROM bill_items WHERE bill_id = ?").all(billId) as any[];
    const payments = db.prepare("SELECT * FROM payments WHERE bill_id = ? ORDER BY processed_at ASC").all(billId) as any[];

    return {
      id: b.id,
      billNumber: b.bill_number,
      partyId: b.party_id,
      partyCode: b.party_code,
      tableId: b.table_id,
      tableNumber: b.table_number,
      waiterId: b.waiter_id,
      waiterName: b.waiter_name,
      cashierId: b.cashier_id,
      cashierName: b.cashier_name,
      status: b.status,
      subtotal: b.subtotal,
      discountAmount: b.discount_amount,
      discountReason: b.discount_reason || undefined,
      discountApprovedBy: b.discount_approved_by || undefined,
      taxableAmount: b.taxable_amount,
      cgstAmount: b.cgst_amount,
      sgstAmount: b.sgst_amount,
      igstAmount: b.igst_amount || 0,
      vatAmount: b.vat_amount || 0,
      totalTaxAmount: b.total_tax_amount,
      roundOff: b.round_off,
      grandTotal: b.grand_total,
      paidAmount: b.paid_amount,
      balanceDue: b.balance_due,
      createdAt: b.created_at,
      settledAt: b.finalized_at || undefined,
      isTakeaway: b.is_takeaway === 1,
      customerName: b.customer_name || undefined,
      customerPhone: b.customer_phone || undefined,
      packagingCharges: b.packaging_charges,
      items: items.map((it) => ({
        id: it.id,
        billId: it.bill_id,
        orderItemId: it.order_item_id,
        menuItemId: it.menu_item_id,
        menuItemName: it.menu_item_name,
        quantity: it.quantity,
        unitPrice: it.unit_price,
        totalPrice: it.total_price,
        seatNumber: it.seat_number || undefined,
        taxRateId: it.tax_rate_id || "gst-5",
        taxRatePercentage: it.tax_rate_percentage || 5,
        taxAmount: it.tax_amount || 0,
        isComplimentary: it.is_complimentary === 1,
        breadOption: it.bread_option || undefined,
      })),
      payments: payments.map((p) => ({
        id: p.id,
        billId: p.bill_id,
        paymentMethod: p.payment_method,
        amount: p.amount,
        transactionReference: p.reference || undefined,
        receivedBy: p.cashier_id,
        receivedByName: p.cashier_name,
        status: p.status,
        paymentTime: p.processed_at,
      })),
    };
  }
}
