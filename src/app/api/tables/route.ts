import { NextRequest, NextResponse } from "next/server";
import { TableRepository } from "@/lib/db/table-repository";
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
 * GET /api/tables
 * Returns all dining tables with real-time occupancy status from SQLite
 */
export async function GET(request: NextRequest) {
  try {
    ensureDb();
    const tables = TableRepository.getAllTables();
    return NextResponse.json({ success: true, tables });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to fetch tables" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/tables
 * Actions:
 * - SEAT: Atomically seats a party at table with mutex protection
 * - TRANSFER: Transfers an active party to a new table
 * - RELEASE: Releases a table
 */
export async function POST(request: NextRequest) {
  try {
    ensureDb();
    const user = getAuthenticatedUser(request);
    // In POS environment, if header/cookie is absent we allow identified waiter from body or authenticated session
    const body = await request.json();
    const action = body?.action || "SEAT";

    const waiterId = user?.userId || body?.waiterId || "u-wtr-01";
    const waiterName = user?.name || body?.waiterName || "Staff";

    if (action === "SEAT") {
      const { tableNumber, guestCount, descriptor, customerName, customerPhone, isTakeaway, packagingCharges } = body;
      if (!tableNumber) {
        return NextResponse.json({ success: false, error: "tableNumber is required" }, { status: 400 });
      }

      const result = TableRepository.seatParty({
        tableNumber: Number(tableNumber),
        guestCount: Number(guestCount) || 2,
        waiterId,
        waiterName,
        descriptor,
        customerName,
        customerPhone,
        isTakeaway: Boolean(isTakeaway),
        packagingCharges: Number(packagingCharges) || 0,
      });

      return NextResponse.json({ success: true, party: result.party, table: result.table });
    }

    if (action === "TRANSFER") {
      const { partyId, toTableNumber } = body;
      if (!partyId || !toTableNumber) {
        return NextResponse.json({ success: false, error: "partyId and toTableNumber are required" }, { status: 400 });
      }

      const result = TableRepository.transferTable(
        partyId,
        Number(toTableNumber),
        waiterId,
        waiterName
      );

      return NextResponse.json({ success: true, ...result });
    }

    if (action === "RELEASE") {
      const { tableNumber } = body;
      if (!tableNumber) {
        return NextResponse.json({ success: false, error: "tableNumber is required" }, { status: 400 });
      }
      TableRepository.releaseTable(Number(tableNumber));
      return NextResponse.json({ success: true, message: `Table #${tableNumber} released` });
    }

    return NextResponse.json({ success: false, error: `Unknown action: ${action}` }, { status: 400 });
  } catch (error: any) {
    const isConflict = error?.message?.includes("already occupied");
    return NextResponse.json(
      { success: false, error: error?.message || "Table operation failed" },
      { status: isConflict ? 409 : 500 }
    );
  }
}
