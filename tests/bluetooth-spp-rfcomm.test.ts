import { describe, it, expect, beforeEach } from "vitest";
import {
  globalPrinterManager,
  DEFAULT_PRINTER_DEVICES,
} from "@/lib/printing/printer-connection-manager";
import { Bill, PrinterDevice, PrinterSettings } from "@/types/billing";
import { Kot } from "@/types/orders";
import { globalRestaurantStore } from "@/lib/store/restaurant-store";

describe("Bluetooth Classic SPP & RFCOMM Thermal Printer System", () => {
  const mockBill: Bill = {
    id: "bill-spp-01",
    billNumber: "BILL-2026-SPP1",
    partyId: "party-spp-1",
    partyCode: "P-101",
    tableId: "t-02",
    tableNumber: 2,
    waiterId: "w-01",
    waiterName: "Bandu Patil",
    cashierId: "c-01",
    cashierName: "Suresh Rao",
    status: "PAID",
    subtotal: 750,
    discountAmount: 0,
    taxableAmount: 750,
    cgstAmount: 18.75,
    sgstAmount: 18.75,
    igstAmount: 0,
    vatAmount: 0,
    totalTaxAmount: 37.5,
    roundOff: 0,
    grandTotal: 788,
    paidAmount: 788,
    balanceDue: 0,
    createdAt: "2026-09-13T10:00:00.000Z",
    items: [
      {
        id: "bi-spp-1",
        billId: "bill-spp-01",
        orderItemId: "oi-spp-1",
        menuItemId: "m-1",
        menuItemName: "Kolhapuri Chicken Thali",
        quantity: 2,
        unitPrice: 375,
        totalPrice: 750,
        taxRateId: "tx-1",
        taxRatePercentage: 5,
        taxAmount: 37.5,
        isComplimentary: false,
      },
    ],
    payments: [
      {
        id: "p-spp-1",
        billId: "bill-spp-01",
        paymentMethod: "CASH",
        amount: 800,
        receivedBy: "c-01",
        receivedByName: "Suresh Rao",
        status: "SUCCESS",
        paymentTime: "2026-09-13T10:30:00.000Z",
      },
    ],
  };

  const mockKot: Kot = {
    id: "kot-spp-01",
    kotNumber: "KOT-0888",
    orderId: "ord-spp-1",
    partyId: "p-spp-1",
    partyCode: "P-101",
    tableNumber: 2,
    waiterId: "w-01",
    waiterName: "Bandu Patil",
    stationCode: "TANDOOR_BHAKRI",
    guestCount: 2,
    status: "NEW",
    elapsedSeconds: 5,
    urgencyLevel: "NORMAL",
    createdAt: "2026-09-13T10:05:00.000Z",
    items: [
      {
        id: "ki-spp-1",
        kotId: "kot-spp-01",
        orderItemId: "oi-spp-1",
        menuItemId: "m-2",
        menuItemName: "Jowar Bhakri",
        quantity: 4,
        status: "NEW",
      },
    ],
  };

  describe("1. SPP / RFCOMM Device Configuration & Store Persistence", () => {
    it("adds a Virtual COM Port (Web Serial RFCOMM) Bluetooth printer to store", () => {
      const store = globalRestaurantStore;
      const sppComDevice: PrinterDevice = {
        id: "printer-spp-com-01",
        name: "PT-210 Mobile SPP (COM4)",
        connectionType: "BLUETOOTH_SPP",
        sppMode: "VIRTUAL_COM",
        serialPortName: "COM4 (Bluetooth SPP Port)",
        baudRate: 9600,
        dataBits: 8,
        stopBits: 1,
        parity: "none",
        flowControl: "none",
        paperWidth: "58mm",
        isEnabled: true,
        status: "ONLINE",
        assignedStations: ["CASHIER"],
        isDefaultReceiptPrinter: false,
        isDefaultKotPrinter: false,
        autoCut: false,
        openDrawerOnPrint: false,
        chunkSize: 128,
        chunkDelayMs: 25,
      };

      store.addPrinterDevice(sppComDevice);
      const saved = store.printerSettings.devices?.find((d) => d.id === "printer-spp-com-01");
      expect(saved).toBeDefined();
      expect(saved?.connectionType).toBe("BLUETOOTH_SPP");
      expect(saved?.sppMode).toBe("VIRTUAL_COM");
      expect(saved?.serialPortName).toBe("COM4 (Bluetooth SPP Port)");
      expect(saved?.baudRate).toBe(9600);
      expect(saved?.chunkSize).toBe(128);
      expect(saved?.chunkDelayMs).toBe(25);
    });

    it("adds a Web Bluetooth GATT Serial SPP printer with custom 0x1101 UUID and throttling", () => {
      const store = globalRestaurantStore;
      const sppGattDevice: PrinterDevice = {
        id: "printer-spp-gatt-01",
        name: "MPT-II Portable SPP (BLE GATT)",
        connectionType: "BLUETOOTH_SPP",
        sppMode: "BLE_GATT",
        bluetoothDeviceName: "MPT-II-8899",
        sppUuid: "00001101-0000-1000-8000-00805f9b34fb",
        chunkSize: 64,
        chunkDelayMs: 50,
        paperWidth: "58mm",
        isEnabled: true,
        status: "ONLINE",
        assignedStations: ["BEVERAGE_DESSERT"],
        isDefaultReceiptPrinter: false,
        isDefaultKotPrinter: false,
        autoCut: false,
        openDrawerOnPrint: false,
      };

      store.addPrinterDevice(sppGattDevice);
      const saved = store.printerSettings.devices?.find((d) => d.id === "printer-spp-gatt-01");
      expect(saved).toBeDefined();
      expect(saved?.sppMode).toBe("BLE_GATT");
      expect(saved?.sppUuid).toBe("00001101-0000-1000-8000-00805f9b34fb");
      expect(saved?.chunkSize).toBe(64);
      expect(saved?.chunkDelayMs).toBe(50);
    });

    it("adds a RawBT Android RFCOMM Socket printer with channel and PIN configuration", () => {
      const store = globalRestaurantStore;
      const sppRawBtDevice: PrinterDevice = {
        id: "printer-spp-rawbt-01",
        name: "Waiter Tab SPP (RawBT Ch.1)",
        connectionType: "BLUETOOTH_SPP",
        sppMode: "RAWBT_RFCOMM",
        bluetoothMacAddress: "66:32:B1:88:99:A2",
        rfcommChannel: 1,
        rfcommPin: "1234",
        paperWidth: "58mm",
        isEnabled: true,
        status: "ONLINE",
        assignedStations: ["MAIN_KITCHEN"],
        isDefaultReceiptPrinter: false,
        isDefaultKotPrinter: false,
        autoCut: false,
        openDrawerOnPrint: false,
      };

      store.addPrinterDevice(sppRawBtDevice);
      const saved = store.printerSettings.devices?.find((d) => d.id === "printer-spp-rawbt-01");
      expect(saved).toBeDefined();
      expect(saved?.sppMode).toBe("RAWBT_RFCOMM");
      expect(saved?.bluetoothMacAddress).toBe("66:32:B1:88:99:A2");
      expect(saved?.rfcommChannel).toBe(1);
      expect(saved?.rfcommPin).toBe("1234");
    });
  });

  describe("2. Telemetry & Ping Diagnostics for SPP / RFCOMM", () => {
    it("reports online telemetry for Virtual COM RFCOMM mode", async () => {
      const device: PrinterDevice = {
        id: "p-diag-com",
        name: "ZJ-5802 SPP",
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

      const result = await globalPrinterManager.testDeviceConnection(device);
      expect(result.online).toBe(true);
      expect(result.message).toContain("SPP RFCOMM via COM5");
      expect(result.message).toContain("115200 bps");
    });

    it("reports online telemetry for BLE GATT Serial SPP mode", async () => {
      const device: PrinterDevice = {
        id: "p-diag-gatt",
        name: "MPT-II SPP",
        connectionType: "BLUETOOTH_SPP",
        sppMode: "BLE_GATT",
        bluetoothDeviceName: "MPT-II-POS",
        chunkSize: 128,
        paperWidth: "58mm",
        isEnabled: true,
        status: "ONLINE",
        assignedStations: ["CASHIER"],
        isDefaultReceiptPrinter: false,
        isDefaultKotPrinter: false,
        autoCut: false,
        openDrawerOnPrint: false,
      };

      const result = await globalPrinterManager.testDeviceConnection(device);
      expect(result.online).toBe(true);
      expect(result.message).toContain("SPP BLE GATT");
      expect(result.message).toContain("MPT-II-POS");
      expect(result.message).toContain("Chk:128B");
    });

    it("reports online telemetry for RawBT Android RFCOMM Socket mode with Channel and PIN", async () => {
      const device: PrinterDevice = {
        id: "p-diag-rawbt",
        name: "Android Waiter SPP",
        connectionType: "BLUETOOTH_SPP",
        sppMode: "RAWBT_RFCOMM",
        bluetoothMacAddress: "AA:BB:CC:11:22:33",
        rfcommChannel: 2,
        rfcommPin: "0000",
        paperWidth: "58mm",
        isEnabled: true,
        status: "ONLINE",
        assignedStations: ["CASHIER"],
        isDefaultReceiptPrinter: false,
        isDefaultKotPrinter: false,
        autoCut: false,
        openDrawerOnPrint: false,
      };

      const result = await globalPrinterManager.testDeviceConnection(device);
      expect(result.online).toBe(true);
      expect(result.message).toContain("SPP RFCOMM Android Socket (Ch.2)");
      expect(result.message).toContain("AA:BB:CC:11:22:33");
      expect(result.message).toContain("PIN: 0000");
    });
  });

  describe("3. Print Dispatch to Bluetooth SPP / RFCOMM Printers", () => {
    it("dispatches customer Bill receipt to designated Bluetooth SPP printer", () => {
      const sppPrinter: PrinterDevice = {
        id: "p-spp-receipt",
        name: "Counter SPP 58",
        connectionType: "BLUETOOTH_SPP",
        sppMode: "VIRTUAL_COM",
        serialPortName: "COM3",
        baudRate: 9600,
        paperWidth: "58mm",
        isEnabled: true,
        status: "ONLINE",
        assignedStations: ["CASHIER"],
        isDefaultReceiptPrinter: true,
        isDefaultKotPrinter: false,
        autoCut: false,
        openDrawerOnPrint: false,
      };

      const settings: PrinterSettings = {
        paperWidth: "58mm",
        autoPrintKotOnOrder: true,
        autoPrintReceiptOnPayment: true,
        autoPrintPreBillOnRequest: true,
        autoKickCashDrawerOnCash: false,
        numberOfReceiptCopies: 1,
        printMarathiHeader: true,
        stationPrinters: [],
        devices: [sppPrinter],
      };

      const job = globalPrinterManager.dispatchBill(mockBill, false, settings);
      expect(job).toBeDefined();
      expect(job.type).toBe("RECEIPT");
      expect(job.printerName).toBe("Counter SPP 58");
      expect(job.paperWidth).toBe("58mm");
      expect(job.rawPayload).toBeDefined();
    });

    it("dispatches KOT ticket to designated Station Bluetooth SPP printer", () => {
      const bhakriSppPrinter: PrinterDevice = {
        id: "p-spp-bhakri",
        name: "Bhakri Mobile SPP",
        connectionType: "BLUETOOTH_SPP",
        sppMode: "BLE_GATT",
        bluetoothDeviceName: "Bhakri-58",
        paperWidth: "58mm",
        isEnabled: true,
        status: "ONLINE",
        assignedStations: ["TANDOOR_BHAKRI"],
        isDefaultReceiptPrinter: false,
        isDefaultKotPrinter: false,
        autoCut: false,
        openDrawerOnPrint: false,
      };

      const settings: PrinterSettings = {
        paperWidth: "58mm",
        autoPrintKotOnOrder: true,
        autoPrintReceiptOnPayment: true,
        autoPrintPreBillOnRequest: true,
        autoKickCashDrawerOnCash: false,
        numberOfReceiptCopies: 1,
        printMarathiHeader: true,
        stationPrinters: [],
        devices: [bhakriSppPrinter],
        autoSplitKotByStation: false,
      };

      const jobs = globalPrinterManager.dispatchKot(mockKot, settings);
      expect(jobs.length).toBe(1);
      expect(jobs[0].type).toBe("KOT");
      expect(jobs[0].printerName).toBe("Bhakri Mobile SPP");
      expect(jobs[0].paperWidth).toBe("58mm");
      expect(jobs[0].stationCode).toBe("TANDOOR_BHAKRI");
    });
  });

  describe("4. Cleanup & Store Isolation", () => {
    it("cleanly removes test SPP devices from store", () => {
      const store = globalRestaurantStore;
      store.removePrinterDevice("printer-spp-com-01");
      store.removePrinterDevice("printer-spp-gatt-01");
      store.removePrinterDevice("printer-spp-rawbt-01");

      const remaining = store.printerSettings.devices || [];
      expect(remaining.some((d) => d.id === "printer-spp-com-01")).toBe(false);
      expect(remaining.some((d) => d.id === "printer-spp-gatt-01")).toBe(false);
      expect(remaining.some((d) => d.id === "printer-spp-rawbt-01")).toBe(false);
    });
  });

  describe("5. Android 1-Tap Print Activation & KP307-UEWB Default Routing", () => {
    it("activates Android System Print as universal default", () => {
      const dev = globalPrinterManager.activateAndroidSystemPrint("80mm");
      expect(dev.connectionType).toBe("BROWSER_SYSTEM");
      expect(dev.isDefaultReceiptPrinter).toBe(true);
      expect(dev.isDefaultKotPrinter).toBe(true);
      expect(dev.assignedStations).toContain("CASHIER");
      expect(dev.assignedStations).toContain("MAIN_KITCHEN");

      const settings: PrinterSettings = {
        paperWidth: "80mm",
        autoPrintKotOnOrder: true,
        autoPrintReceiptOnPayment: true,
        autoPrintPreBillOnRequest: true,
        autoKickCashDrawerOnCash: false,
        numberOfReceiptCopies: 1,
        printMarathiHeader: true,
        stationPrinters: [],
        devices: [dev],
      };

      const billJob = globalPrinterManager.dispatchBill({ ...mockBill, id: "bill-android-sys-01" }, false, settings);
      expect(billJob.printerId).toBe(dev.id);
      expect(billJob.printerName).toBe(dev.name);

      const kotJobs = globalPrinterManager.dispatchKot({ ...mockKot, id: "kot-android-sys-01", kotNumber: "KOT-SYS-01" }, settings);
      expect(kotJobs[0].printerId).toBe(dev.id);
    });

    it("activates Android RawBt Print with fallback to Android system", () => {
      const dev = globalPrinterManager.activateAndroidRawBtPrint("80mm");
      expect(dev.connectionType).toBe("RAWBT");
      expect(dev.isDefaultReceiptPrinter).toBe(true);
      expect(dev.isDefaultKotPrinter).toBe(true);
      expect(dev.failoverPrinterId).toBe("printer-android-system");
    });

    it("routes bills and KOTs directly to KP307-UEWB (Serial COM Port) when marked default", () => {
      const serialComPortDev: PrinterDevice = {
        id: "printer-kp307-serial-com",
        name: "Serial COM Port",
        modelName: "POSIFLOW KP307-UEWB",
        connectionType: "BLUETOOTH_SPP",
        bluetoothDeviceName: "KP307-UEWB",
        paperWidth: "80mm",
        isEnabled: true,
        status: "ONLINE",
        assignedStations: ["CASHIER", "MAIN_KITCHEN", "THALI_SECTION", "TANDOOR_BHAKRI", "FRY_SECTION", "BEVERAGE_DESSERT"],
        isDefaultReceiptPrinter: true,
        isDefaultKotPrinter: true,
        autoCut: true,
        openDrawerOnPrint: false,
      };

      const settings: PrinterSettings = {
        paperWidth: "80mm",
        autoPrintKotOnOrder: true,
        autoPrintReceiptOnPayment: true,
        autoPrintPreBillOnRequest: true,
        autoKickCashDrawerOnCash: false,
        numberOfReceiptCopies: 1,
        printMarathiHeader: true,
        stationPrinters: [],
        devices: [
          serialComPortDev,
          {
            id: "printer-posiflow-counter",
            name: "POSIFLOW KP307-UEWB (Counter Bill)",
            connectionType: "NETWORK",
            ipAddress: "192.168.1.50",
            port: 9100,
            paperWidth: "80mm",
            isEnabled: true,
            status: "ONLINE",
            assignedStations: [],
            isDefaultReceiptPrinter: false,
            isDefaultKotPrinter: false,
            autoCut: true,
            openDrawerOnPrint: true,
          },
        ],
      };

      // Verify that dispatchBill routes to "Serial COM Port"
      const billJob = globalPrinterManager.dispatchBill({ ...mockBill, id: "bill-serial-com-01" }, false, settings);
      expect(billJob.printerId).toBe("printer-kp307-serial-com");
      expect(billJob.printerName).toBe("Serial COM Port");

      // Verify that dispatchKot routes to "Serial COM Port"
      const kotJobs = globalPrinterManager.dispatchKot({ ...mockKot, id: "kot-serial-com-01", kotNumber: "KOT-SC-01" }, settings);
      expect(kotJobs[0].printerId).toBe("printer-kp307-serial-com");
      expect(kotJobs[0].printerName).toBe("Serial COM Port");
    });
  });
});
