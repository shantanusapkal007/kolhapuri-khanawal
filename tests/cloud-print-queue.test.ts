import { describe, it, expect, beforeEach, vi } from "vitest";
import { isBridgeOnline, getActiveBridge } from "@/lib/printing/cloud-print-queue";
import { globalPrinterManager } from "@/lib/printing/printer-connection-manager";
import { EscPosBuilder, buildDiagnosticTestEscPos } from "@/lib/printing/escpos-builder";
import type { CloudPrintJob, PrintBridgeHeartbeat, PrinterDevice } from "@/types/billing";

describe("Cloud Print Queue & Local Print Bridge Subsystem", () => {
  describe("1. Bridge Heartbeat & Liveness Engine", () => {
    it("reports bridge online when heartbeat is recent (< 45s)", () => {
      const recentHeartbeat: PrintBridgeHeartbeat = {
        bridgeId: "kk-bridge-cashier",
        restaurantId: "kolhapuri-khanawal",
        hostname: "CASHIER-PC",
        version: "1.0.0",
        lastHeartbeat: new Date(Date.now() - 5000).toISOString(), // 5s ago
        status: "ONLINE",
        printerMapping: {
          CASHIER: { ip: "192.168.0.108", port: 9100 },
        },
        jobsDelivered: 12,
      };

      expect(isBridgeOnline([recentHeartbeat])).toBe(true);
    });

    it("reports bridge offline when heartbeat is stale (> 45s)", () => {
      const staleHeartbeat: PrintBridgeHeartbeat = {
        bridgeId: "kk-bridge-cashier",
        restaurantId: "kolhapuri-khanawal",
        hostname: "CASHIER-PC",
        version: "1.0.0",
        lastHeartbeat: new Date(Date.now() - 60000).toISOString(), // 60s ago
        status: "ONLINE",
        printerMapping: {
          CASHIER: { ip: "192.168.0.108", port: 9100 },
        },
        jobsDelivered: 12,
      };

      expect(isBridgeOnline([staleHeartbeat])).toBe(false);
    });

    it("reports bridge offline when bridge list is empty", () => {
      expect(isBridgeOnline([])).toBe(false);
    });

    it("identifies the most active online bridge from multiple instances", () => {
      const bridgeA: PrintBridgeHeartbeat = {
        bridgeId: "bridge-older",
        restaurantId: "kolhapuri-khanawal",
        hostname: "POS-1",
        version: "1.0.0",
        lastHeartbeat: new Date(Date.now() - 20000).toISOString(),
        status: "ONLINE",
        printerMapping: {},
        jobsDelivered: 5,
      };

      const bridgeB: PrintBridgeHeartbeat = {
        bridgeId: "bridge-freshest",
        restaurantId: "kolhapuri-khanawal",
        hostname: "POS-2",
        version: "1.0.0",
        lastHeartbeat: new Date(Date.now() - 2000).toISOString(),
        status: "ONLINE",
        printerMapping: {},
        jobsDelivered: 15,
      };

      const active = getActiveBridge([bridgeA, bridgeB]);
      expect(active).not.toBeNull();
      expect(active?.bridgeId).toBe("bridge-freshest");
    });
  });

  describe("2. 1-Tap Activation of Cloud Queue Spooler", () => {
    it("activates cloud queue print mode with 80mm roll width", () => {
      const device = globalPrinterManager.activateCloudQueuePrint("80mm");
      expect(device.id).toBe("printer-cloud-bridge");
      expect(device.connectionType).toBe("CLOUD_QUEUE");
      expect(device.paperWidth).toBe("80mm");
      expect(device.isEnabled).toBe(true);
      expect(device.isDefaultReceiptPrinter).toBe(true);
      expect(device.isDefaultKotPrinter).toBe(true);
      expect(device.failoverPrinterId).toBe("printer-android-system");
    });

    it("activates cloud queue print mode with 58mm roll width", () => {
      const device = globalPrinterManager.activateCloudQueuePrint("58mm");
      expect(device.paperWidth).toBe("58mm");
      expect(device.connectionType).toBe("CLOUD_QUEUE");
    });
  });

  describe("3. Cloud Print Queue Payload & ESC/POS Formatting", () => {
    it("generates valid diagnostic test slip for cloud queue dispatch", () => {
      const bytes = buildDiagnosticTestEscPos("POSIFLOW KP307-UEWB", "80mm");
      expect(bytes).toBeInstanceOf(Uint8Array);
      expect(bytes.length).toBeGreaterThan(50);

      // Verify ESC @ at beginning
      expect(bytes[0]).toBe(0x1b);
      expect(bytes[1]).toBe(0x40);

      // Verify converts to base64 cleanly
      let binary = "";
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const b64 = Buffer.from(binary, "binary").toString("base64");
      expect(b64.length).toBeGreaterThan(20);

      // Verify base64 decodes back to original bytes
      const decoded = Buffer.from(b64, "base64");
      expect(decoded.length).toBe(bytes.length);
      expect(decoded[0]).toBe(0x1b);
      expect(decoded[1]).toBe(0x40);
    });
  });
});
