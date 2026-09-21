import { NextRequest, NextResponse } from "next/server";
import { BillingRepository, StaleBillError } from "@/lib/db/billing-repository";
import { getAuthenticatedUser } from "@/lib/auth/server-auth";
import { getDatabase } from "@/lib/db/sqlite";
import { initDatabaseSchema } from "@/lib/db/schema";
import { seedDatabaseIfEmpty } from "@/lib/db/seed";

function ensureDb() {
  const db = getDatabase();
  initDatabaseSchema(db);
  seedDatabaseIfEmpty(db);
}

/**
 * GET /api/bills
 * Fetch bill by partyId or billId
 */
export async function GET(request: NextRequest) {
  try {
    ensureDb();
    const { searchParams } = new URL(request.url);
    const partyId = searchParams.get("partyId");
    const billId = searchParams.get("billId");

    if (billId) {
      const bill = BillingRepository.getBillWithDetails(billId);
      return NextResponse.json({ success: true, bill });
    }

    if (partyId) {
      const user = getAuthenticatedUser(request);
      const cashierId = user?.userId || "u-csh-01";
      const cashierName = user?.name || "Cashier Priya";

      const bill = BillingRepository.getOrCreateBillForParty({
        partyId,
        cashierId,
        cashierName,
      });
      return NextResponse.json({ success: true, bill });
    }

    return NextResponse.json(
      { success: false, error: "partyId or billId is required" },
      { status: 400 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to fetch bill" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/bills
 * Actions:
 * - GENERATE: Gets or creates statutory bill in place
 * - DISCOUNT: Applies discount without creating new statutory bill number
 * - PAY: Settles bill idempotently with stale bill protection
 */
export async function POST(request: NextRequest) {
  try {
    ensureDb();
    const user = getAuthenticatedUser(request);
    const body = await request.json();
    const action = body?.action || "GENERATE";

    const cashierId = user?.userId || body?.cashierId || "u-csh-01";
    const cashierName = user?.name || body?.cashierName || "Cashier Priya";

    if (action === "GENERATE") {
      const { partyId } = body;
      if (!partyId) {
        return NextResponse.json({ success: false, error: "partyId is required" }, { status: 400 });
      }

      const bill = BillingRepository.getOrCreateBillForParty({
        partyId,
        cashierId,
        cashierName,
      });

      return NextResponse.json({ success: true, bill });
    }

    if (action === "DISCOUNT") {
      const { billId, discountPercentage, discountAmount, reason, expectedVersion } = body;
      if (!billId) {
        return NextResponse.json({ success: false, error: "billId is required" }, { status: 400 });
      }

      const bill = BillingRepository.applyDiscount({
        billId,
        discountPercentage: Number(discountPercentage) || 0,
        discountAmount: Number(discountAmount) || 0,
        reason,
        approvedBy: cashierName,
        expectedVersion: expectedVersion !== undefined ? Number(expectedVersion) : undefined,
      });

      return NextResponse.json({ success: true, bill });
    }

    if (action === "PAY") {
      const { billId, paymentMethod, tenderAmount, reference, idempotencyKey, expectedVersion } = body;
      if (!billId || !paymentMethod || tenderAmount === undefined) {
        return NextResponse.json(
          { success: false, error: "billId, paymentMethod, and tenderAmount are required" },
          { status: 400 }
        );
      }

      const result = BillingRepository.recordPayment({
        idempotencyKey: idempotencyKey || `pay-${billId}-${paymentMethod}`,
        billId,
        paymentMethod,
        tenderAmount: Number(tenderAmount),
        reference,
        cashierId,
        cashierName,
        expectedVersion: expectedVersion !== undefined ? Number(expectedVersion) : undefined,
      });

      return NextResponse.json({
        success: true,
        bill: result.bill,
        payment: result.payment,
        isDuplicate: result.isDuplicate,
      });
    }

    return NextResponse.json({ success: false, error: `Unknown action: ${action}` }, { status: 400 });
  } catch (error: any) {
    if (error instanceof StaleBillError) {
      return NextResponse.json(
        {
          success: false,
          error: error.message,
          isStale: true,
          refreshedBill: error.currentBill,
        },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { success: false, error: error?.message || "Billing operation failed" },
      { status: 500 }
    );
  }
}
