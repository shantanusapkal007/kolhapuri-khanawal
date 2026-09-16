import { NextRequest, NextResponse } from "next/server";

// In-memory server relay cache for local restaurant Wi-Fi multi-device synchronization
interface SharedOperationalState {
  version: number;
  senderId?: string;
  updatedAt: string;
  payload: any;
}

let serverStateCache: SharedOperationalState | null = null;

/**
 * GET /api/sync
 * Retrieves current operational state from local server relay
 */
export async function GET(request?: Request) {
  try {
    let clientTimestamp: string | null = null;
    if (request && request.url) {
      try {
        const { searchParams } = new URL(request.url);
        clientTimestamp = searchParams.get("since");
      } catch {}
    }

    if (!serverStateCache) {
      return NextResponse.json({
        success: true,
        hasUpdate: false,
        version: 0,
        snapshot: null,
        state: null,
      });
    }

    if (clientTimestamp && serverStateCache.updatedAt <= clientTimestamp) {
      return NextResponse.json({
        success: true,
        hasUpdate: false,
        version: serverStateCache.version,
        updatedAt: serverStateCache.updatedAt,
      });
    }

    return NextResponse.json({
      success: true,
      hasUpdate: true,
      version: serverStateCache.version,
      senderId: serverStateCache.senderId,
      updatedAt: serverStateCache.updatedAt,
      snapshot: serverStateCache.payload,
      state: serverStateCache.payload,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || "Sync failed" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/sync
 * Pushes updated operational state from a device to the local server relay
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const snapshot = body?.snapshot || body?.payload;

    if (!body || !snapshot) {
      return NextResponse.json(
        { success: false, error: "Invalid sync payload" },
        { status: 400 }
      );
    }

    const version = typeof body.version === "number" && body.version > 0
      ? body.version
      : (serverStateCache ? serverStateCache.version + 1 : Date.now());
    const updatedAt = new Date().toISOString();

    serverStateCache = {
      version,
      senderId: body.senderId || "unknown",
      updatedAt,
      payload: snapshot,
    };

    return NextResponse.json({
      success: true,
      version,
      senderId: body.senderId,
      updatedAt,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || "Sync update failed" },
      { status: 500 }
    );
  }
}
