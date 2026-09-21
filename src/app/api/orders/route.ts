import { NextRequest, NextResponse } from "next/server";
import { OrderRepository } from "@/lib/db/order-repository";
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
 * GET /api/orders
 * Returns orders for a given partyId (?partyId=...)
 */
export async function GET(request: NextRequest) {
  try {
    ensureDb();
    const { searchParams } = new URL(request.url);
    const partyId = searchParams.get("partyId");

    if (!partyId) {
      return NextResponse.json(
        { success: false, error: "partyId query parameter is required" },
        { status: 400 }
      );
    }

    const orders = OrderRepository.getOrdersByParty(partyId);
    return NextResponse.json({ success: true, orders });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to fetch orders" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/orders
 * Atomically creates Order, generates KOT, and checks/deducts inventory.
 * Enforces Phase 4 (Idempotency) and Phase 6 (Atomic Sequences).
 */
export async function POST(request: NextRequest) {
  try {
    ensureDb();
    const user = getAuthenticatedUser(request);
    const body = await request.json();

    const {
      idempotencyKey,
      partyId,
      items,
      notes,
      urgencyLevel,
      stationCode,
    } = body || {};

    if (!partyId) {
      return NextResponse.json({ success: false, error: "partyId is required" }, { status: 400 });
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ success: false, error: "items array is required" }, { status: 400 });
    }

    const waiterId = user?.userId || body?.waiterId || "u-wtr-01";
    const waiterName = user?.name || body?.waiterName || "Staff";

    const result = OrderRepository.createOrderAndKot({
      idempotencyKey: idempotencyKey || `idem-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      partyId,
      waiterId,
      waiterName,
      stationCode: stationCode || "MAIN_KITCHEN",
      items,
      notes,
      urgencyLevel: urgencyLevel || "NORMAL",
    });

    return NextResponse.json({
      success: true,
      order: result.order,
      kot: result.kot,
      party: result.party,
      isDuplicateRequest: result.isDuplicateRequest,
    });
  } catch (error: any) {
    const isConflict = error?.message?.includes("Insufficient inventory");
    return NextResponse.json(
      { success: false, error: error?.message || "Order creation failed" },
      { status: isConflict ? 409 : 500 }
    );
  }
}
