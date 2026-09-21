import { NextRequest, NextResponse } from "next/server";
import { TableRepository } from "@/lib/db/table-repository";
import { OrderRepository } from "@/lib/db/order-repository";
import { getDatabase } from "@/lib/db/sqlite";
import { initDatabaseSchema } from "@/lib/db/schema";
import { seedDatabaseIfEmpty } from "@/lib/db/seed";

function ensureDb() {
  const db = getDatabase();
  initDatabaseSchema(db);
  seedDatabaseIfEmpty(db);
}

let lastSyncVersion: number = 0;
let lastSyncSenderId: string = "server";
let lastRelaySnapshot: any = null;

/**
 * GET /api/sync
 * Upgraded from ephemeral in-memory cache to authoritative SQLite state.
 * Returns authoritative tables, active dining parties, and active kitchen KOTs.
 */
export async function GET(request?: NextRequest | Request) {
  try {
    ensureDb();
    const tables = TableRepository.getAllTables();
    const dbParties = TableRepository.getActiveParties();
    const kots = OrderRepository.getActiveKots();

    const updatedAt = new Date().toISOString();
    const parties = dbParties.length > 0 ? dbParties : (lastRelaySnapshot?.parties || []);

    return NextResponse.json({
      success: true,
      hasUpdate: true,
      version: lastSyncVersion || Date.now(),
      senderId: lastSyncSenderId,
      updatedAt,
      authoritative: true,
      snapshot: {
        tables,
        parties,
        activeKots: kots,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || "Authoritative sync failed" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/sync
 * Phase 3: Acknowledges sync from device terminals and maintains compatibility
 */
export async function POST(request: NextRequest | Request) {
  try {
    ensureDb();
    const body = await request.json().catch(() => ({}));
    const senderId = body?.senderId || "terminal";
    const version = typeof body?.version === "number" && body.version > 0 ? body.version : Date.now();
    const snapshot = body?.snapshot || body?.payload;

    lastSyncVersion = version;
    lastSyncSenderId = senderId;
    if (snapshot) {
      lastRelaySnapshot = snapshot;
    }

    const tables = TableRepository.getAllTables();
    const parties = TableRepository.getActiveParties();

    return NextResponse.json({
      success: true,
      version,
      senderId,
      updatedAt: new Date().toISOString(),
      message: "Sync acknowledged by authoritative database server",
      snapshot: {
        tables,
        parties: parties.length > 0 ? parties : (snapshot?.parties || []),
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || "Sync update failed" },
      { status: 500 }
    );
  }
}
