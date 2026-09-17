import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const LOCAL_BRIDGE_URL = process.env.LOCAL_BRIDGE_URL || "http://127.0.0.1:9180";

/**
 * GET /api/print/bridge
 * Probes the local print bridge daemon on port 9180.
 * Returns live bridge status and printer mappings.
 */
export async function GET() {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1800);
    const res = await fetch(`${LOCAL_BRIDGE_URL}/health`, {
      signal: controller.signal,
      cache: "no-store",
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      return NextResponse.json({
        online: true,
        bridge: {
          bridgeId: data.bridgeId || "kk-bridge-local",
          restaurantId: data.restaurantId || "kolhapuri-khanawal",
          hostname: data.hostname || "Local POS Terminal",
          version: data.version || "1.0.0",
          lastHeartbeat: new Date().toISOString(),
          status: "ONLINE",
          printerMapping: data.mappedPrinters || data.printerMapping || {
            DEFAULT: { ip: "192.168.0.108", port: 9100 },
          },
          jobsDelivered: data.jobsDelivered || 0,
        },
      });
    }
  } catch {
    // Bridge daemon is not running or unreachable
  }

  return NextResponse.json({ online: false, bridge: null });
}

/**
 * POST /api/print/bridge
 * Proxies print jobs to the local print bridge daemon.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const res = await fetch(`${LOCAL_BRIDGE_URL}/print`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || "Failed to reach local print bridge" },
      { status: 502 }
    );
  }
}
