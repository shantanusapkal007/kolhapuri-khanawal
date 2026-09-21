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
 * GET /api/kots
 * Returns all active kitchen display orders
 */
export async function GET(request: NextRequest) {
  try {
    ensureDb();
    const kots = OrderRepository.getActiveKots();
    return NextResponse.json({ success: true, kots });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to fetch KOTs" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/kots
 * Updates KOT status (ACKNOWLEDGED, PREPARING, READY, SERVED, CANCELLED)
 */
export async function POST(request: NextRequest) {
  try {
    ensureDb();
    const user = getAuthenticatedUser(request);
    const body = await request.json();
    const { kotId, status } = body || {};

    if (!kotId || !status) {
      return NextResponse.json(
        { success: false, error: "kotId and status are required" },
        { status: 400 }
      );
    }

    const userId = user?.userId || body?.userId || "u-ktc-01";
    const userName = user?.name || body?.userName || "Kitchen Chef";

    OrderRepository.updateKotStatus(kotId, status, userId, userName);

    return NextResponse.json({
      success: true,
      message: `KOT ${kotId} updated to ${status}`,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to update KOT" },
      { status: 500 }
    );
  }
}
