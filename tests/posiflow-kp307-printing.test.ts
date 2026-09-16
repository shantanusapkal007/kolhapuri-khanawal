import { describe, it, expect, beforeEach, vi } from "vitest";
import { EscPosBuilder } from "@/lib/printing/escpos-builder";
import {
  globalPrinterManager,
  DEFAULT_PRINTER_DEVICES,
} from "@/lib/printing/printer-connection-manager";
import { PrinterDevice, PrintJob, PrinterSettings } from "@/types/billing";
import { Kot } from "@/types/orders";
import { Bill } from "@/types/billing";

describe("POSIFLOW KP307-UEWB Thermal Printer & Spooler Subsystem", () => {
  beforeEach(() => {
    globalPrinterManager.clearCompletedJobs();
  });

  describe("1. ESC/POS Engine — POSIFLOW KP307-UEWB QR & Drawer Features", () => {
    it("generates valid standard ESC/POS bytes for 80mm roll", () => {
      const builder = new EscPosBuilder("80mm");
      builder
        .align("CENTER")
        .bold(true)
        .line("KOLHAPURI KHANAWAL")
        .bold(false)
        .separator()
        .twoColumns("Bill #101", "₹540.00")
        .doubleSeparator()
        .cut();

      const bytes = builder.toBytes();
      expect(bytes).toBeInstanceOf(Uint8Array);
      expect(bytes.length).toBeGreaterThan(20);
      // Verify ESC @ (init) is first 2 bytes: 0x1B, 0x40
      expect(bytes[0]).toBe(0x1b);
      expect(bytes[1]).toBe(0x40);
    });

    it("generates native ESC/POS QR code sequence for UPI payments", () => {
      const builder = new EscPosBuilder("80mm");
      const upiUrl = "upi://pay?pa=kolhapurikhanawal@okhdfcbank&pn=KolhapuriKhanawal&am=450.00&cu=INR";
      builder.qrCode(upiUrl, 6);

      const bytes = builder.toBytes();
      // GS ( k sequence contains 0x1D, 0x28, 0x6B
      const hasGsK = bytes.some((b, i) => b === 0x1d && bytes[i + 1] === 0x28 && bytes[i + 2] === 0x6b);
      expect(hasGsK).toBe(true);
    });

    it("generates cash drawer pulse sequence (ESC p 0 25 250)", () => {
      const builder = new EscPosBuilder("80mm");
      builder.kickDrawer(2);

      const bytes = builder.toBytes();
      // ESC p sequence: 0x1B, 0x70
      const hasDrawerKick = bytes.some((b, i) => b === 0x1b && bytes[i + 1] === 0x70);
      expect(hasDrawerKick).toBe(true);
    });
  });

  describe("2. Fleet Configuration — POSIFLOW KP307-UEWB Presets", () => {
    it("includes POSIFLOW KP307-UEWB network presets in default fleet", () => {
      const kp307Counter = DEFAULT_PRINTER_DEVICES.find((d) => d.id === "printer-posiflow-counter");
      expect(kp307Counter).toBeDefined();
      expect(kp307Counter?.modelName).toBe("POSIFLOW KP307-UEWB");
      expect(kp307Counter?.connectionType).toBe("NETWORK");
      expect(kp307Counter?.port).toBe(9100);
      expect(kp307Counter?.paperWidth).toBe("80mm");
      expect(kp307Counter?.isDefaultReceiptPrinter).toBe(true);
      expect(kp307Counter?.failoverPrinterId).toBe("printer-cashier-fallback");

      const kp307Kitchen = DEFAULT_PRINTER_DEVICES.find((d) => d.id === "printer-posiflow-kitchen");
      expect(kp307Kitchen).toBeDefined();
      expect(kp307Kitchen?.modelName).toBe("POSIFLOW KP307-UEWB");
      expect(kp307Kitchen?.isDefaultKotPrinter).toBe(true);
    });
  });

  describe("3. Print Spooler Queue, Retries & Duplicate Protection", () => {
    it("enqueues jobs and provides duplicate print protection with idempotencyKey", () => {
      const device: PrinterDevice = {
        id: "test-dev-01",
        name: "Test KP307",
        connectionType: "BROWSER_SYSTEM",
        paperWidth: "80mm",
        isEnabled: true,
        status: "ONLINE",
        assignedStations: ["CASHIER"],
        isDefaultReceiptPrinter: true,
        isDefaultKotPrinter: false,
        autoCut: true,
        openDrawerOnPrint: true,
      };

      const key = "bill-unique-12345";
      const job1 = globalPrinterManager.enqueueJob(
        device,
        "Customer Bill #12345",
        "RECEIPT",
        undefined,
        "<html>Bill</html>",
        "CASHIER",
        key
      );

      expect(job1).toBeDefined();
      expect(job1.idempotencyKey).toBe(key);

      // Attempt immediate duplicate enqueue with identical key
      const job2 = globalPrinterManager.enqueueJob(
        device,
        "Customer Bill #12345",
        "RECEIPT",
        undefined,
        "<html>Bill</html>",
        "CASHIER",
        key
      );

      // Should return the original job without creating a duplicate
      expect(job2.id).toBe(job1.id);
    });

    it("supports job cancellation and retry mechanisms", () => {
      const device: PrinterDevice = {
        id: "test-dev-02",
        name: "Test Fallback",
        connectionType: "BROWSER_SYSTEM",
        paperWidth: "80mm",
        isEnabled: true,
        status: "ONLINE",
        assignedStations: ["CASHIER"],
        isDefaultReceiptPrinter: true,
        isDefaultKotPrinter: false,
        autoCut: true,
        openDrawerOnPrint: false,
      };

      const job = globalPrinterManager.enqueueJob(
        device,
        "Test Job for Cancel",
        "TEST",
        undefined,
        "<html>Test</html>"
      );

      // Cancel job
      globalPrinterManager.cancelJob(job.id);
      const jobsAfterCancel = globalPrinterManager.getJobs();
      const cancelledJob = jobsAfterCancel.find((j) => j.id === job.id);
      // Queued job gets removed or marked failed
      if (cancelledJob) {
        expect(cancelledJob.status).toBe("FAILED");
      }

      // Retry job
      if (cancelledJob) {
        globalPrinterManager.retryJob(cancelledJob.id);
        const retried = globalPrinterManager.getJobs().find((j) => j.id === job.id);
        expect(retried?.status).toBe("QUEUED");
      }
    });
  });

  describe("4. Mobile & Online KP307-UEWB Setup, Auto-Scanner & 1-Tap Defaults", () => {
    it("activates Wi-Fi network printer and makes it universal default for receipts & KOTs", () => {
      const dev = globalPrinterManager.activateWifiNetworkPrint("192.168.1.100", "80mm");
      expect(dev).toBeDefined();
      expect(dev.connectionType).toBe("NETWORK");
      expect(dev.ipAddress).toBe("192.168.1.100");
      expect(dev.port).toBe(9100);
      expect(dev.isDefaultReceiptPrinter).toBe(true);
      expect(dev.isDefaultKotPrinter).toBe(true);
      expect(dev.assignedStations).toContain("CASHIER");
      expect(dev.assignedStations).toContain("MAIN_KITCHEN");
      expect(dev.assignedStations).toContain("THALI_SECTION");
      expect(dev.assignedStations).toContain("TANDOOR_BHAKRI");
      expect(dev.assignedStations).toContain("FRY_SECTION");
      expect(dev.assignedStations).toContain("BEVERAGE_DESSERT");
    });

    it("activates Android System Print Spooler for instant zero-app mobile printing", () => {
      const dev = globalPrinterManager.activateAndroidSystemPrint("80mm");
      expect(dev).toBeDefined();
      expect(dev.connectionType).toBe("BROWSER_SYSTEM");
      expect(dev.isDefaultReceiptPrinter).toBe(true);
      expect(dev.isDefaultKotPrinter).toBe(true);
      expect(dev.assignedStations).toContain("CASHIER");
      expect(dev.assignedStations).toContain("MAIN_KITCHEN");
    });

    it("activates Android RawBT Print for 0.1s instant background printing", () => {
      const dev = globalPrinterManager.activateAndroidRawBtPrint("80mm");
      expect(dev).toBeDefined();
      expect(dev.connectionType).toBe("RAWBT");
      expect(dev.rawbtMethod).toBe("INTENT");
      expect(dev.isDefaultReceiptPrinter).toBe(true);
      expect(dev.isDefaultKotPrinter).toBe(true);
    });

    it("scans network candidates and returns discovered printers or empty array gracefully", async () => {
      // Mock global fetch to simulate a discovered printer
      const originalFetch = global.fetch;
      global.fetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.includes("scan=true")) {
          return {
            ok: true,
            json: async () => ({
              success: true,
              printers: [{ ip: "192.168.1.100", port: 9100, latencyMs: 15 }],
            }),
          };
        }
        return { ok: false, json: async () => ({}) };
      }) as any;

      try {
        const found = await globalPrinterManager.scanNetworkPrinters(["192.168.1.100", "192.168.1.50"]);
        expect(found).toHaveLength(1);
        expect(found[0].ip).toBe("192.168.1.100");
        expect(found[0].port).toBe(9100);
        expect(found[0].latencyMs).toBe(15);
      } finally {
        global.fetch = originalFetch;
      }
    });
  });
});
