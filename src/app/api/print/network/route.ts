import { NextRequest, NextResponse } from "next/server";
import net from "net";

export const dynamic = "force-dynamic";

/**
 * Health check / ping a network thermal printer over raw TCP port 9100
 * Or scan common candidate IPs for POSIFLOW KP307-UEWB:
 * - Single IP: GET /api/print/network?ip=192.168.1.100&port=9100
 * - Auto-scan: GET /api/print/network?scan=true&candidates=192.168.1.100,192.168.1.87
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const isScan = searchParams.get("scan") === "true";

  // Multi-IP scan mode for easy mobile discovery of KP307-UEWB
  if (isScan) {
    const rawCandidates = searchParams.get("candidates");
    const candidates = rawCandidates
      ? rawCandidates.split(",").map((s) => s.trim()).filter(Boolean)
      : [
          "192.168.0.108",
          "192.168.223.1",
          "192.168.1.100",
          "192.168.1.87",
          "192.168.1.50",
          "192.168.1.200",
          "192.168.0.100",
          "192.168.0.87",
          "192.168.29.100",
          "192.168.31.100",
          "192.168.1.101",
        ];
    const port = parseInt(searchParams.get("port") || "9100", 10);
    const timeoutMs = parseInt(searchParams.get("timeoutMs") || "1200", 10);

    const probeIp = (candidateIp: string) =>
      new Promise<{ ip: string; port: number; online: boolean; latencyMs?: number }>((resolve) => {
        const start = Date.now();
        const socket = new net.Socket();
        socket.setTimeout(timeoutMs);

        socket.connect(port, candidateIp, () => {
          const latencyMs = Date.now() - start;
          socket.destroy();
          resolve({ ip: candidateIp, port, online: true, latencyMs });
        });

        socket.on("timeout", () => {
          socket.destroy();
          resolve({ ip: candidateIp, port, online: false });
        });

        socket.on("error", () => {
          socket.destroy();
          resolve({ ip: candidateIp, port, online: false });
        });
      });

    const results = await Promise.all(candidates.map(probeIp));
    const onlinePrinters = results.filter((r) => r.online);

    return NextResponse.json({
      success: true,
      scannedCount: candidates.length,
      onlineCount: onlinePrinters.length,
      printers: onlinePrinters,
      timestamp: new Date().toISOString(),
    });
  }

  const ip = searchParams.get("ip");
  const port = parseInt(searchParams.get("port") || "9100", 10);
  const timeoutMs = parseInt(searchParams.get("timeoutMs") || "2500", 10);

  if (!ip) {
    return NextResponse.json({ error: "Missing 'ip' query parameter" }, { status: 400 });
  }

  const startTime = Date.now();

  try {
    const isOnline = await new Promise<boolean>((resolve) => {
      const socket = new net.Socket();
      let connected = false;

      socket.setTimeout(timeoutMs);

      socket.connect(port, ip, () => {
        connected = true;
        socket.destroy();
        resolve(true);
      });

      socket.on("timeout", () => {
        socket.destroy();
        resolve(false);
      });

      socket.on("error", () => {
        socket.destroy();
        resolve(false);
      });
    });

    const latencyMs = Date.now() - startTime;

    return NextResponse.json({
      online: isOnline,
      ip,
      port,
      latencyMs: isOnline ? latencyMs : null,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    return NextResponse.json({
      online: false,
      ip,
      port,
      error: err?.message || "Connection check failed",
      timestamp: new Date().toISOString(),
    });
  }
}

/**
 * Dispatch raw ESC/POS payload to network thermal printer
 * Accepts base64, hex, or raw text payload
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      ip,
      port = 9100,
      payloadBase64,
      payloadHex,
      rawText,
      timeoutMs = 4000,
    } = body;

    if (!ip) {
      return NextResponse.json({ error: "Missing target 'ip' address" }, { status: 400 });
    }

    let buffer: Buffer;

    if (payloadBase64) {
      buffer = Buffer.from(payloadBase64, "base64");
    } else if (payloadHex) {
      buffer = Buffer.from(payloadHex, "hex");
    } else if (rawText) {
      buffer = Buffer.from(rawText, "utf-8");
    } else {
      return NextResponse.json(
        { error: "No print payload provided (expected payloadBase64, payloadHex, or rawText)" },
        { status: 400 }
      );
    }

    const startTime = Date.now();

    await new Promise<void>((resolve, reject) => {
      const socket = new net.Socket();
      let resolved = false;

      socket.setTimeout(timeoutMs);

      socket.connect(port, ip, () => {
        socket.write(buffer, (err) => {
          if (err) {
            if (!resolved) {
              resolved = true;
              socket.destroy();
              reject(err);
            }
          } else {
            // Allow printer buffer to flush before closing socket
            setTimeout(() => {
              if (!resolved) {
                resolved = true;
                socket.end();
                resolve();
              }
            }, 100);
          }
        });
      });

      socket.on("timeout", () => {
        if (!resolved) {
          resolved = true;
          socket.destroy();
          reject(new Error(`Connection to printer ${ip}:${port} timed out after ${timeoutMs}ms`));
        }
      });

      socket.on("error", (err) => {
        if (!resolved) {
          resolved = true;
          socket.destroy();
          reject(err);
        }
      });

      socket.on("close", () => {
        if (!resolved) {
          resolved = true;
          resolve();
        }
      });
    });

    const durationMs = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      printer: `${ip}:${port}`,
      bytesWritten: buffer.length,
      durationMs,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        error: err?.message || "Thermal printer network dispatch failed",
        code: err?.code || "PRINT_FAILED",
      },
      { status: 500 }
    );
  }
}
