import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { globalPrinterManager } from "@/lib/printing/printer-connection-manager";
import { buildDiagnosticTestEscPos } from "@/lib/printing/escpos-builder";
import { generatePrinterTestHtml } from "@/lib/printing/thermal-printer";
import { PrinterDevice } from "@/types/billing";

describe("Thermal Printer Test Slip Comprehensive Diagnostics", () => {
  const originalWindow = (globalThis as any).window;
  const originalNavigator = globalThis.navigator;
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    // Setup window mock for browser-like testing in Node.js
    (globalThis as any).window = {
      location: { href: "" },
      open: vi.fn(),
      document: {
        write: vi.fn(),
        close: vi.fn(),
      },
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
    (globalThis as any).window = originalWindow;
    if (originalNavigator) {
      Object.defineProperty(globalThis, "navigator", {
        value: originalNavigator,
        configurable: true,
        writable: true,
      });
    }
    if (originalFetch) {
      globalThis.fetch = originalFetch;
    }
  });

  describe("1. ESC/POS Diagnostic Binary Generator", () => {
    it("generates correct ESC/POS init, text, and cut bytes for 80mm printer", () => {
      const bytes = buildDiagnosticTestEscPos("Kitchen Master 80", "80mm");
      expect(bytes).toBeInstanceOf(Uint8Array);
      expect(bytes.length).toBeGreaterThan(100);

      // ESC @ (Initialize printer: 0x1B, 0x40)
      expect(bytes[0]).toBe(0x1b);
      expect(bytes[1]).toBe(0x40);

      // Decoded text contains printer name and ticket header
      const decoded = new TextDecoder("ascii", { fatal: false }).decode(bytes);
      expect(decoded).toContain("Kitchen Master 80");
      expect(decoded).toContain("PRINTER TEST TICKET");
      expect(decoded).toContain("80mm Standard");
      expect(decoded).toContain("Auto-Cutter:");
    });

    it("adjusts printable column width and tags for 58mm compact printer", () => {
      const bytes = buildDiagnosticTestEscPos("Solkadhi & Bar 58", "58mm");
      const decoded = new TextDecoder("ascii", { fatal: false }).decode(bytes);
      expect(decoded).toContain("Solkadhi & Bar 58");
      expect(decoded).toContain("58mm Compact");
    });
  });

  describe("2. dispatchTestSlip (Spooler Queue Integration)", () => {
    it("enqueues diagnostic job with non-empty htmlPayload and rawPayload", () => {
      const device: PrinterDevice = {
        id: "p-test-spool",
        name: "POS-80 Counter",
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

      const job = globalPrinterManager.dispatchTestSlip(device);
      expect(["QUEUED", "PRINTING", "PRINTED"]).toContain(job.status);
      expect(job.title).toContain("Diagnostic Test (POS-80 Counter)");
      expect(job.htmlPayload).toBeDefined();
      expect(job.htmlPayload).toContain("Diagnostic Test — POS-80 Counter");
      expect(job.rawPayload).toBeDefined();
      expect(job.rawPayload?.length).toBeGreaterThan(50);
    });

    it("respects custom htmlFallbackFn when provided to dispatchTestSlip", () => {
      const device: PrinterDevice = {
        id: "p-test-custom-fn",
        name: "Bar 58",
        connectionType: "BROWSER_SYSTEM",
        paperWidth: "58mm",
        isEnabled: true,
        status: "ONLINE",
        assignedStations: ["BEVERAGE_DESSERT"],
        isDefaultReceiptPrinter: false,
        isDefaultKotPrinter: false,
        autoCut: false,
        openDrawerOnPrint: false,
      };

      const job = globalPrinterManager.dispatchTestSlip(device, generatePrinterTestHtml);
      expect(job.htmlPayload).toBeDefined();
      expect(job.htmlPayload).toContain("PRINTER DIAGNOSTIC TEST TICKET");
      expect(job.htmlPayload).toContain("चाचणी पावती");
    });
  });

  describe("3. printDirectDeviceTestSlip - BROWSER_SYSTEM", () => {
    it("opens print window directly and returns success message", async () => {
      const browserPrinter: PrinterDevice = {
        id: "p-browser-direct",
        name: "POS-80 Counter (Cashier)",
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

      const result = await globalPrinterManager.printDirectDeviceTestSlip(
        browserPrinter,
        generatePrinterTestHtml
      );
      expect(result.success).toBe(true);
      expect(result.message).toBe("Browser print dialog opened");
    });
  });

  describe("4. printDirectDeviceTestSlip - SERIAL_USB & BLUETOOTH_SPP (Virtual COM)", () => {
    it("throws clear error when Web Serial API is unavailable in non-compatible browser", async () => {
      Object.defineProperty(globalThis, "navigator", {
        value: {},
        configurable: true,
        writable: true,
      });

      const serialPrinter: PrinterDevice = {
        id: "p-serial-err",
        name: "Serial COM Port",
        connectionType: "SERIAL_USB",
        serialPortName: "COM3",
        baudRate: 9600,
        paperWidth: "80mm",
        isEnabled: true,
        status: "ONLINE",
        assignedStations: ["MAIN_KITCHEN"],
        isDefaultReceiptPrinter: false,
        isDefaultKotPrinter: false,
        autoCut: true,
        openDrawerOnPrint: false,
      };

      await expect(
        globalPrinterManager.printDirectDeviceTestSlip(serialPrinter)
      ).rejects.toThrow("Web Serial API is not supported");
    });

    it("uses existing granted port and writes bytes successfully", async () => {
      const mockWriter = {
        write: vi.fn().mockResolvedValue(undefined),
        releaseLock: vi.fn(),
      };
      const mockPort = {
        open: vi.fn().mockResolvedValue(undefined),
        close: vi.fn().mockResolvedValue(undefined),
        writable: {
          getWriter: vi.fn().mockReturnValue(mockWriter),
        },
      };

      Object.defineProperty(globalThis, "navigator", {
        value: {
          serial: {
            getPorts: vi.fn().mockResolvedValue([mockPort]),
            requestPort: vi.fn(),
          },
        },
        configurable: true,
        writable: true,
      });

      const serialPrinter: PrinterDevice = {
        id: "p-serial-ok",
        name: "Kitchen Serial COM",
        connectionType: "SERIAL_USB",
        serialPortName: "COM4",
        baudRate: 9600,
        paperWidth: "80mm",
        isEnabled: true,
        status: "ONLINE",
        assignedStations: ["MAIN_KITCHEN"],
        isDefaultReceiptPrinter: false,
        isDefaultKotPrinter: false,
        autoCut: true,
        openDrawerOnPrint: false,
      };

      const result = await globalPrinterManager.printDirectDeviceTestSlip(serialPrinter);
      expect(result.success).toBe(true);
      expect(result.message).toContain("Sent to COM4 (9600 bps)");
      expect(mockPort.open).toHaveBeenCalledWith(
        expect.objectContaining({ baudRate: 9600 })
      );
      expect(mockWriter.write).toHaveBeenCalled();
      expect(mockWriter.releaseLock).toHaveBeenCalled();
    });

    it("triggers requestPort user prompt when no port was previously granted", async () => {
      const mockWriter = {
        write: vi.fn().mockResolvedValue(undefined),
        releaseLock: vi.fn(),
      };
      const mockPort = {
        open: vi.fn().mockResolvedValue(undefined),
        close: vi.fn().mockResolvedValue(undefined),
        writable: {
          getWriter: vi.fn().mockReturnValue(mockWriter),
        },
      };

      const requestPortMock = vi.fn().mockResolvedValue(mockPort);

      Object.defineProperty(globalThis, "navigator", {
        value: {
          serial: {
            getPorts: vi.fn().mockResolvedValue([]),
            requestPort: requestPortMock,
          },
        },
        configurable: true,
        writable: true,
      });

      const sppPrinter: PrinterDevice = {
        id: "p-spp-request",
        name: "SPP Mobile Printer",
        connectionType: "BLUETOOTH_SPP",
        sppMode: "VIRTUAL_COM",
        serialPortName: "COM5",
        baudRate: 115200,
        paperWidth: "58mm",
        isEnabled: true,
        status: "ONLINE",
        assignedStations: ["CASHIER"],
        isDefaultReceiptPrinter: false,
        isDefaultKotPrinter: false,
        autoCut: false,
        openDrawerOnPrint: false,
      };

      const result = await globalPrinterManager.printDirectDeviceTestSlip(sppPrinter);
      expect(requestPortMock).toHaveBeenCalled();
      expect(result.success).toBe(true);
      expect(result.message).toContain("Sent to COM5 (115200 bps)");
    });
  });

  describe("5. printDirectDeviceTestSlip - NETWORK (LAN / Wi-Fi)", () => {
    it("throws immediately if network printer has no IP configured", async () => {
      const device: PrinterDevice = {
        id: "p-net-noip",
        name: "Kitchen Master 80-1",
        connectionType: "NETWORK",
        ipAddress: "",
        port: 9100,
        paperWidth: "80mm",
        isEnabled: true,
        status: "ONLINE",
        assignedStations: ["MAIN_KITCHEN"],
        isDefaultReceiptPrinter: false,
        isDefaultKotPrinter: true,
        autoCut: true,
        openDrawerOnPrint: false,
      };

      await expect(
        globalPrinterManager.printDirectDeviceTestSlip(device)
      ).rejects.toThrow("Printer IP address is not configured");
    });

    it("sends payload to /api/print/network and handles successful print", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ success: true }),
      } as any);

      const device: PrinterDevice = {
        id: "p-net-ok",
        name: "Kitchen Master 80-1 (Main)",
        connectionType: "NETWORK",
        ipAddress: "192.168.1.201",
        port: 9100,
        paperWidth: "80mm",
        isEnabled: true,
        status: "ONLINE",
        assignedStations: ["MAIN_KITCHEN"],
        isDefaultReceiptPrinter: false,
        isDefaultKotPrinter: true,
        autoCut: true,
        openDrawerOnPrint: false,
      };

      const result = await globalPrinterManager.printDirectDeviceTestSlip(device);
      expect(result.success).toBe(true);
      expect(result.message).toContain("Printed on Network 192.168.1.201");
      expect(globalThis.fetch).toHaveBeenCalledWith(
        "/api/print/network",
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
        })
      );
    });

    it("throws informative error when network printer is unreachable", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        json: vi.fn().mockResolvedValue({
          success: false,
          error: "Printer at 192.168.1.201:9100 is unreachable (ETIMEDOUT)",
        }),
      } as any);

      const device: PrinterDevice = {
        id: "p-net-fail",
        name: "Kitchen Master 80-1 (Main)",
        connectionType: "NETWORK",
        ipAddress: "192.168.1.201",
        port: 9100,
        paperWidth: "80mm",
        isEnabled: true,
        status: "ONLINE",
        assignedStations: ["MAIN_KITCHEN"],
        isDefaultReceiptPrinter: false,
        isDefaultKotPrinter: true,
        autoCut: true,
        openDrawerOnPrint: false,
      };

      await expect(
        globalPrinterManager.printDirectDeviceTestSlip(device)
      ).rejects.toThrow("Printer at 192.168.1.201:9100 is unreachable");
    });
  });

  describe("6. printDirectDeviceTestSlip - RAWBT (Android)", () => {
    it("transmits test slip via window.location rawbt scheme without error", async () => {
      const device: PrinterDevice = {
        id: "p-rawbt-01",
        name: "Android Waiter Slip",
        connectionType: "RAWBT",
        rawbtMethod: "INTENT",
        paperWidth: "58mm",
        isEnabled: true,
        status: "ONLINE",
        assignedStations: ["MAIN_KITCHEN"],
        isDefaultReceiptPrinter: false,
        isDefaultKotPrinter: false,
        autoCut: false,
        openDrawerOnPrint: false,
      };

      const result = await globalPrinterManager.printDirectDeviceTestSlip(device);
      expect(result.success).toBe(true);
      expect(result.message).toContain("Sent via RawBT Android service");
      expect((globalThis as any).window.location.href).toContain("package=ru.a402d.rawbtprinter");
    });
  });
});
