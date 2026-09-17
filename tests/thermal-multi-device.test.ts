import { describe, it, expect, beforeEach } from "vitest";
import {
  EscPosBuilder,
  buildBillReceiptEscPos,
  buildKotEscPos,
  buildCancelledKotEscPos,
  buildTableCheckEscPos,
  buildDayEndReportEscPos,
  buildDiagnosticTestEscPos,
} from "@/lib/printing/escpos-builder";
import {
  globalPrinterManager,
  DEFAULT_PRINTER_DEVICES,
} from "@/lib/printing/printer-connection-manager";
import { Bill, PrinterDevice, PrinterSettings } from "@/types/billing";
import { Kot } from "@/types/orders";
import { globalRestaurantStore } from "@/lib/store/restaurant-store";

describe("Multi-Device Thermal Printer Connection System", () => {
  const mockBill: Bill = {
    id: "bill-multi-01",
    billNumber: "BILL-2026-8888",
    partyId: "party-01",
    partyCode: "P-101",
    tableId: "t-05",
    tableNumber: 5,
    waiterId: "w-01",
    waiterName: "Bandu Patil",
    cashierId: "c-01",
    cashierName: "Suresh Rao",
    status: "PAID",
    subtotal: 900,
    discountAmount: 0,
    taxableAmount: 900,
    cgstAmount: 22.5,
    sgstAmount: 22.5,
    igstAmount: 0,
    vatAmount: 0,
    totalTaxAmount: 45,
    roundOff: 0,
    grandTotal: 945,
    paidAmount: 945,
    balanceDue: 0,
    createdAt: "2026-09-10T12:00:00.000Z",
    items: [
      {
        id: "bi-1",
        billId: "bill-multi-01",
        orderItemId: "oi-1",
        menuItemId: "m-1",
        menuItemName: "Special Mutton Thali",
        quantity: 2,
        unitPrice: 450,
        totalPrice: 900,
        taxRateId: "tx-1",
        taxRatePercentage: 5,
        taxAmount: 45,
        isComplimentary: false,
      },
    ],
    payments: [
      {
        id: "p-1",
        billId: "bill-multi-01",
        paymentMethod: "CASH",
        amount: 1000,
        receivedBy: "c-01",
        receivedByName: "Suresh Rao",
        status: "SUCCESS",
        paymentTime: "2026-09-10T12:30:00.000Z",
      },
    ],
  };

  const mockMultiStationKot: Kot = {
    id: "kot-multi-01",
    kotNumber: "KOT-0999",
    orderId: "ord-01",
    partyId: "p-01",
    partyCode: "P-101",
    tableNumber: 5,
    waiterId: "w-01",
    waiterName: "Bandu Patil",
    stationCode: "MAIN_KITCHEN",
    guestCount: 4,
    status: "NEW",
    elapsedSeconds: 15,
    urgencyLevel: "NORMAL",
    createdAt: "2026-09-10T12:05:00.000Z",
    items: [
      {
        id: "ki-1",
        kotId: "kot-multi-01",
        orderItemId: "oi-1",
        menuItemId: "m-1",
        menuItemName: "Mutton Thali",
        quantity: 2,
        status: "NEW",
      },
      {
        id: "ki-2",
        kotId: "kot-multi-01",
        orderItemId: "oi-2",
        menuItemId: "m-2",
        menuItemName: "Jowar Bhakri",
        quantity: 4,
        status: "NEW",
      },
      {
        id: "ki-3",
        kotId: "kot-multi-01",
        orderItemId: "oi-3",
        menuItemId: "m-3",
        menuItemName: "Solkadhi Glass",
        quantity: 2,
        status: "NEW",
      },
    ],
  };

  // Add stationCode to individual items to test multi-station splitting
  (mockMultiStationKot.items[0] as any).stationCode = "MAIN_KITCHEN";
  (mockMultiStationKot.items[1] as any).stationCode = "TANDOOR_BHAKRI";
  (mockMultiStationKot.items[2] as any).stationCode = "BEVERAGE_DESSERT";

  describe("1. ESC/POS Binary Command Engine", () => {
    it("generates valid ESC/POS byte sequence for initialization, formatting, and alignment", () => {
      const p = new EscPosBuilder("80mm");
      p.init()
        .align("CENTER")
        .bold(true)
        .line("TEST TITLE")
        .bold(false)
        .align("LEFT")
        .line("Left line")
        .cut(true);

      const bytes = p.toBytes();
      expect(bytes.length).toBeGreaterThan(10);
      // ESC @ = 0x1B, 0x40
      expect(bytes[0]).toBe(0x1b);
      expect(bytes[1]).toBe(0x40);

      // Converts to Base64 and Hex without throwing
      const b64 = p.toBase64();
      expect(typeof b64).toBe("string");
      expect(b64.length).toBeGreaterThan(0);

      const hex = p.toHex();
      expect(typeof hex).toBe("string");
      expect(hex.startsWith("1b40")).toBe(true);
    });

    it("respects 80mm (48 columns) and 58mm (32 columns) width constraints", () => {
      const p80 = new EscPosBuilder("80mm");
      expect(p80.maxColumns).toBe(48);

      const p58 = new EscPosBuilder("58mm");
      expect(p58.maxColumns).toBe(32);
    });

    it("generates cash drawer kick pulse bytes (ESC p 0 25 250)", () => {
      const p = new EscPosBuilder("80mm");
      p.kickDrawer(2);
      const bytes = p.toBytes();
      // ESC p 0 25 250
      expect(bytes.slice(bytes.length - 5)).toEqual(new Uint8Array([0x1b, 0x70, 0x00, 0x19, 0xfa]));
    });

    it("generates full paper cut command (GS V 0)", () => {
      const p = new EscPosBuilder("80mm");
      p.cut(false);
      const bytes = p.toBytes();
      // GS V 0 = 0x1D, 0x56, 0x00
      expect(bytes[bytes.length - 3]).toBe(0x1d);
      expect(bytes[bytes.length - 2]).toBe(0x56);
      expect(bytes[bytes.length - 1]).toBe(0x00);
    });

    it("builds bill receipt ESC/POS buffer with items, totals, and change return", () => {
      const bytes = buildBillReceiptEscPos(mockBill, false, "80mm");
      expect(bytes.length).toBeGreaterThan(100);

      const text = new TextDecoder().decode(bytes);
      expect(text).toContain("KOLHAPURI KHANAWAL");
      expect(text).toContain("Special Mutton Thali");
      expect(text).toContain("BILL-2026-8888");
      expect(text).toContain("GRAND TOTAL:");
      expect(text).toContain("945.00");
      expect(text).toContain("Change Return:");
      expect(text).toContain("55.00"); // 1000 - 945 = 55
    });

    it("builds KOT ticket ESC/POS buffer with table, items, and kitchen markers", () => {
      const bytes = buildKotEscPos(mockMultiStationKot, undefined, false, "80mm");
      expect(bytes.length).toBeGreaterThan(50);

      const text = new TextDecoder().decode(bytes);
      expect(text).toContain("*** K O T ***");
      expect(text).toContain("TABLE 5");
      expect(text).toContain("Mutton Thali");
      expect(text).toContain("Kitchen Copy");
    });

    it("builds cancelled KOT ESC/POS buffer with void alert", () => {
      const bytes = buildCancelledKotEscPos(mockMultiStationKot, "Table changed order", "Head Chef", "80mm");
      const text = new TextDecoder().decode(bytes);
      expect(text).toContain("DO NOT PREPARE - ORDER CANCELLED");
      expect(text).toContain("Table changed order");
      expect(text).toContain("Head Chef");
    });

    it("builds table check and day-end Z-report ESC/POS buffers", () => {
      const checkBytes = buildTableCheckEscPos(
        { party: { tableNumber: 5, partyCode: "P-101", guestCount: 3 }, subtotal: 900, grandTotal: 945 },
        "80mm"
      );
      const checkText = new TextDecoder().decode(checkBytes);
      expect(checkText).toContain("TABLE CHECK / PRE-BILL ESTIMATE");
      expect(checkText).toContain("Not a Tax Invoice - Kachha Bill");
      expect(checkText).toContain("KOLHAPURI KHANAWAL");
      expect(checkText).toContain("Lalit Estate, Baner, Pune, Maharashtra 411045");
      expect(checkText).toContain("Ph: +91 91753 86576");
      expect(checkText).toContain("Q338740118@ybl");
      expect(checkText).toContain("Kolapuri khanawal");
      expect(checkText).toContain("Terminal 1-Q338740118");
      expect(checkText).toContain("Rs. 900.00");
      expect(checkText).toContain("Rs. 945.00");

      const zReportBytes = buildDayEndReportEscPos(
        {
          date: "2026-09-10",
          shiftName: "Dinner Shift",
          generatedAt: new Date().toISOString(),
          generatedByName: "Suresh Rao",
          totalBills: 42,
          settledBillsCount: 40,
          cancelledBillsCount: 2,
          grossSalesSubtotal: 35000,
          totalDiscountAmount: 1200,
          netTaxableSales: 33800,
          cgstAmount: 845,
          sgstAmount: 845,
          totalTaxAmount: 1690,
          totalPackagingCharges: 250,
          roundOffTotal: 0,
          netRevenue: 35740,
          tenders: { cash: 15000, upi: 18000, card: 2740, other: 0 },
          topSellingDishes: [],
          auditDiscrepanciesCount: 0,
        },
        "80mm"
      );
      expect(new TextDecoder().decode(zReportBytes)).toContain("DAY-END Z-REPORT");
    });
  });

  describe("2. Multi-Device Hardware Fleet & Discovery", () => {
    it("provides default printer fleet with separate devices for counter and kitchen stations", () => {
      expect(DEFAULT_PRINTER_DEVICES.length).toBeGreaterThanOrEqual(2);

      const cashierPrinter = DEFAULT_PRINTER_DEVICES.find((d) => d.isDefaultReceiptPrinter);
      expect(cashierPrinter).toBeDefined();
      expect(cashierPrinter?.assignedStations).toContain("CASHIER");

      const kitchenPrinter = DEFAULT_PRINTER_DEVICES.find((d) => d.assignedStations.includes("MAIN_KITCHEN"));
      expect(kitchenPrinter).toBeDefined();
      expect(kitchenPrinter?.isDefaultKotPrinter).toBe(true);
    });

    it("verifies printer connection status based on connection type", async () => {
      const browserDevice: PrinterDevice = {
        id: "p-test-browser",
        name: "Test Browser",
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

      const result = await globalPrinterManager.testDeviceConnection(browserDevice);
      expect(result.online).toBe(true);
      expect(result.message).toContain("Browser");

      const bluetoothDevice: PrinterDevice = {
        id: "p-test-bt",
        name: "Test BT",
        connectionType: "BLUETOOTH",
        bluetoothDeviceName: "RPP02N-Bar",
        paperWidth: "58mm",
        isEnabled: true,
        status: "ONLINE",
        assignedStations: ["BEVERAGE_DESSERT"],
        isDefaultReceiptPrinter: false,
        isDefaultKotPrinter: false,
        autoCut: false,
        openDrawerOnPrint: false,
      };

      const btResult = await globalPrinterManager.testDeviceConnection(bluetoothDevice);
      expect(btResult.online).toBe(true);
      expect(btResult.message).toContain("RPP02N-Bar");

      const serialDevice: PrinterDevice = {
        id: "p-test-serial",
        name: "Test Serial",
        connectionType: "SERIAL_USB",
        serialPortName: "COM3 (CH340 USB-Serial)",
        baudRate: 115200,
        paperWidth: "80mm",
        isEnabled: true,
        status: "ONLINE",
        assignedStations: ["CASHIER"],
        isDefaultReceiptPrinter: true,
        isDefaultKotPrinter: false,
        autoCut: true,
        openDrawerOnPrint: false,
      };

      const serialResult = await globalPrinterManager.testDeviceConnection(serialDevice);
      expect(serialResult.online).toBe(true);
      expect(serialResult.message).toContain("COM3");
      expect(serialResult.message).toContain("115200 bps");

      const rawbtDevice: PrinterDevice = {
        id: "p-test-rawbt",
        name: "Test RawBT Android",
        connectionType: "RAWBT",
        rawbtMethod: "HTTP",
        rawbtHost: "localhost",
        rawbtPort: 40213,
        paperWidth: "80mm",
        isEnabled: true,
        status: "ONLINE",
        assignedStations: ["MAIN_KITCHEN"],
        isDefaultReceiptPrinter: false,
        isDefaultKotPrinter: true,
        autoCut: true,
        openDrawerOnPrint: false,
      };

      const rawbtResult = await globalPrinterManager.testDeviceConnection(rawbtDevice);
      expect(rawbtResult.online).toBe(true);
      expect(rawbtResult.message).toContain("RawBT");
    });
  });

  describe("3. Multi-Station Routing & Auto-Splitting", () => {
    it("splits a multi-station order and generates simultaneous jobs for respective station printers", () => {
      const stationDevices: PrinterDevice[] = [
        {
          id: "printer-bhakri",
          name: "Bhakri Station Printer",
          connectionType: "BROWSER_SYSTEM",
          paperWidth: "80mm",
          isEnabled: true,
          status: "ONLINE",
          assignedStations: ["TANDOOR_BHAKRI"],
          isDefaultReceiptPrinter: false,
          isDefaultKotPrinter: false,
          autoCut: true,
          openDrawerOnPrint: false,
        },
        {
          id: "printer-bar",
          name: "Bar & Dessert Printer",
          connectionType: "BROWSER_SYSTEM",
          paperWidth: "58mm",
          isEnabled: true,
          status: "ONLINE",
          assignedStations: ["BEVERAGE_DESSERT"],
          isDefaultReceiptPrinter: false,
          isDefaultKotPrinter: false,
          autoCut: true,
          openDrawerOnPrint: false,
        },
        ...DEFAULT_PRINTER_DEVICES,
      ];

      const settings: PrinterSettings = {
        paperWidth: "80mm",
        autoPrintKotOnOrder: true,
        autoPrintReceiptOnPayment: true,
        autoPrintPreBillOnRequest: true,
        autoKickCashDrawerOnCash: true,
        numberOfReceiptCopies: 1,
        printMarathiHeader: true,
        stationPrinters: [],
        devices: stationDevices,
        autoSplitKotByStation: true,
        printMasterKotToKitchen: true,
      };

      // Dispatches KOT containing items across MAIN_KITCHEN, TANDOOR_BHAKRI, BEVERAGE_DESSERT
      const jobs = globalPrinterManager.dispatchKot(mockMultiStationKot, settings);

      // Should generate 3 station jobs + 1 master job = 4 print jobs!
      expect(jobs.length).toBe(4);

      const stationCodes = jobs.map((j) => j.stationCode);
      expect(stationCodes).toContain("MAIN_KITCHEN");
      expect(stationCodes).toContain("TANDOOR_BHAKRI");
      expect(stationCodes).toContain("BEVERAGE_DESSERT");

      // Verify targeted printer destinations
      const bhakriJob = jobs.find((j) => j.stationCode === "TANDOOR_BHAKRI");
      expect(bhakriJob?.printerName).toContain("Bhakri");

      const barJob = jobs.find((j) => j.stationCode === "BEVERAGE_DESSERT");
      expect(barJob?.printerName).toContain("Bar");
      expect(barJob?.paperWidth).toBe("58mm");
    });

    it("routes to single station printer when autoSplitKotByStation is disabled", () => {
      const settings: PrinterSettings = {
        paperWidth: "80mm",
        autoPrintKotOnOrder: true,
        autoPrintReceiptOnPayment: true,
        autoPrintPreBillOnRequest: true,
        autoKickCashDrawerOnCash: true,
        numberOfReceiptCopies: 1,
        printMarathiHeader: true,
        stationPrinters: [],
        devices: DEFAULT_PRINTER_DEVICES,
        autoSplitKotByStation: false,
        printMasterKotToKitchen: false,
      };

      const jobs = globalPrinterManager.dispatchKot(mockMultiStationKot, settings);
      expect(jobs.length).toBe(1);
      expect(jobs[0].stationCode).toBe("MAIN_KITCHEN");
    });

    it("dispatches customer tax invoice directly to designated Cashier receipt printer", () => {
      const settings: PrinterSettings = {
        paperWidth: "80mm",
        autoPrintKotOnOrder: true,
        autoPrintReceiptOnPayment: true,
        autoPrintPreBillOnRequest: true,
        autoKickCashDrawerOnCash: true,
        numberOfReceiptCopies: 1,
        printMarathiHeader: true,
        stationPrinters: [],
        devices: DEFAULT_PRINTER_DEVICES,
      };

      const job = globalPrinterManager.dispatchBill(mockBill, false, settings);
      expect(job.type).toBe("RECEIPT");
      expect(job.stationCode).toBe("CASHIER");
      expect(job.printerName).toContain("Counter");
      expect(["QUEUED", "PRINTING", "SUCCESS"]).toContain(job.status);
    });
  });

  describe("4. Concurrent Print Spooler & Job Queue", () => {
    it("enqueues multiple print jobs, serializing per printer and tracking status", () => {
      const device = DEFAULT_PRINTER_DEVICES[0];

      const job1 = globalPrinterManager.enqueueJob(device, "Test Job 1", "TEST");
      const job2 = globalPrinterManager.enqueueJob(device, "Test Job 2", "TEST");

      expect(job1.id).toBeDefined();
      expect(job2.id).toBeDefined();
      expect(job1.id).not.toBe(job2.id);

      const allJobs = globalPrinterManager.getJobs();
      expect(allJobs.some((j) => j.id === job1.id)).toBe(true);
      expect(allJobs.some((j) => j.id === job2.id)).toBe(true);
    });

    it("notifies subscribers of queue updates", () => {
      let notified = false;
      const unsubscribe = globalPrinterManager.subscribe((jobs) => {
        if (jobs.length > 0) notified = true;
      });

      globalPrinterManager.enqueueJob(DEFAULT_PRINTER_DEVICES[0], "Subscriber Test", "TEST");
      expect(notified).toBe(true);
      unsubscribe();
    });
  });

  describe("5. RestaurantStore Multi-Device Integration", () => {
    it("allows adding, updating, and removing hardware printer devices in store", () => {
      const store = globalRestaurantStore;
      const initialCount = store.printerSettings.devices?.length || 0;

      const customPrinter: PrinterDevice = {
        id: "printer-custom-99",
        name: "Second Floor Wireless 80",
        connectionType: "NETWORK",
        ipAddress: "192.168.1.250",
        port: 9100,
        paperWidth: "80mm",
        isEnabled: true,
        status: "ONLINE",
        assignedStations: ["MAIN_KITCHEN"],
        isDefaultReceiptPrinter: false,
        isDefaultKotPrinter: false,
        autoCut: true,
        openDrawerOnPrint: false,
      };

      // 1. Add printer
      store.addPrinterDevice(customPrinter);
      expect(store.printerSettings.devices?.some((d) => d.id === "printer-custom-99")).toBe(true);

      // 2. Update printer
      store.updatePrinterDevice("printer-custom-99", { ipAddress: "192.168.1.251" });
      const updated = store.printerSettings.devices?.find((d) => d.id === "printer-custom-99");
      expect(updated?.ipAddress).toBe("192.168.1.251");

      // 3. Remove printer
      store.removePrinterDevice("printer-custom-99");
      expect(store.printerSettings.devices?.some((d) => d.id === "printer-custom-99")).toBe(false);
    });
  });

  describe("6. Diagnostic Test Slip & Direct Execution", () => {
    it("generates HTML diagnostic slip by default in dispatchTestSlip", () => {
      const browserDev: PrinterDevice = {
        id: "test-dev-browser",
        name: "POS-80 Counter (Cashier)",
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

      const job = globalPrinterManager.dispatchTestSlip(browserDev);
      expect(job).toBeDefined();
      expect(job.title).toContain("Diagnostic Test");
      expect(job.htmlPayload).toBeDefined();
      expect(job.htmlPayload).toContain("Diagnostic Test");
      expect(job.htmlPayload).toContain("POS-80 Counter (Cashier)");
    });

    it("executes printDirectDeviceTestSlip for BROWSER_SYSTEM without throwing", async () => {
      const browserDev: PrinterDevice = {
        id: "test-browser-direct",
        name: "Counter System Printer",
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

      const result = await globalPrinterManager.printDirectDeviceTestSlip(browserDev);
      expect(result.success).toBe(true);
      expect(result.message).toContain("Browser print dialog");
    });

    it("handles Network printer without IP gracefully in printDirectDeviceTestSlip", async () => {
      const brokenNetworkDev: PrinterDevice = {
        id: "test-net-no-ip",
        name: "Missing IP Kitchen 80",
        connectionType: "NETWORK",
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
        globalPrinterManager.printDirectDeviceTestSlip(brokenNetworkDev)
      ).rejects.toThrow("IP address is not configured");
    });
  });
});
