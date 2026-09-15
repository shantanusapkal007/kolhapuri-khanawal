import { NextRequest, NextResponse } from "next/server";
import net from "net";

export const dynamic = "force-static";

/**
 * Health check / ping a network thermal printer over raw TCP port 9100
 * Example: GET /api/print/network?ip=192.168.1.100&port=9100
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
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
