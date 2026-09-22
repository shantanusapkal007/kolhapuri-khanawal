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

function mergeActiveParties(primaryParties: any[], secondaryParties: any[]): any[] {
  const map = new Map<string, any>();
  if (Array.isArray(secondaryParties)) {
    for (const p of secondaryParties) {
      if (p && p.id && p.status !== "CLOSED" && p.status !== "CANCELLED") {
        map.set(p.id, p);
      }
    }
  }
  if (Array.isArray(primaryParties)) {
    for (const p of primaryParties) {
      if (p && p.id && p.status !== "CLOSED" && p.status !== "CANCELLED") {
        map.set(p.id, p);
      }
    }
  }
  return Array.from(map.values());
}

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
    // Merge database parties and last relay snapshot parties so newly created client parties are NEVER lost
    const parties = mergeActiveParties(lastRelaySnapshot?.parties || [], dbParties);

    // Ensure physical tables reflect occupancy of any active relay parties
    const occupiedTableNumbers = new Set(parties.map((p) => p.tableNumber));
    const mergedTables = tables.map((t) => {
      if (occupiedTableNumbers.has(t.tableNumber) && t.status === "AVAILABLE") {
        return { ...t, status: "OCCUPIED" as const, activePartiesCount: 1 };
      }
      return t;
    });

    return NextResponse.json({
      success: true,
      hasUpdate: true,
      version: lastSyncVersion || Date.now(),
      senderId: lastSyncSenderId,
      updatedAt,
      authoritative: true,
      snapshot: {
        tables: mergedTables,
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

    const dbParties = TableRepository.getActiveParties();
    const mergedParties = mergeActiveParties(
      snapshot?.parties || [],
      mergeActiveParties(lastRelaySnapshot?.parties || [], dbParties)
    );

    if (snapshot) {
      lastRelaySnapshot = {
        ...snapshot,
        parties: mergedParties,
      };
    }

    const tables = TableRepository.getAllTables();
    const occupiedTableNumbers = new Set(mergedParties.map((p) => p.tableNumber));
    const mergedTables = tables.map((t) => {
      if (occupiedTableNumbers.has(t.tableNumber) && t.status === "AVAILABLE") {
        return { ...t, status: "OCCUPIED" as const, activePartiesCount: 1 };
      }
      return t;
    });

    return NextResponse.json({
      success: true,
      version,
      senderId,
      updatedAt: new Date().toISOString(),
      message: "Sync acknowledged by authoritative database server",
      snapshot: {
        tables: mergedTables,
        parties: mergedParties,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || "Sync update failed" },
      { status: 500 }
    );
  }
}
