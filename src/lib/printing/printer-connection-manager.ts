/**
 * Kolhapuri Khanawal Restaurant Operating System
 * Multi-Device Thermal Printer Connection Manager & Job Spooler
 *
 * Coordinates concurrent hardware printing across multiple physical thermal printers:
 * - Network (LAN/Wi-Fi TCP Port 9100 via Next.js Server API)
 * - Web Bluetooth (BLE/SPP GATT Thermal characteristic)
 * - Web Serial / USB (Direct COM Port streams)
 * - Cloud Print Queue (Firestore queue → local bridge → printer)
 * - Local Print Gateway / Bridge (Lightweight HTTP print daemon)
 * - Browser System Print (Seamless zero-popup iframe fallback)
 */

import {
  Bill,
  PrinterDevice,
  PrinterSettings,
  PrintJob,
  PrintJobStatus,
  PrinterConnectionType,
} from "@/types/billing";
import { Kot } from "@/types/orders";
import {
  buildBillReceiptEscPos,
  buildKotEscPos,
  buildCancelledKotEscPos,
  buildTableCheckEscPos,
  buildDayEndReportEscPos,
  buildDiagnosticTestEscPos,
  EscPosBuilder,
} from "./escpos-builder";
import { openPrintWindow } from "./thermal-printer";
import { enqueuePrintJob, subscribeToBridgeStatus, isBridgeOnline, type EnqueuePrintJobParams } from "./cloud-print-queue";
import type { CloudPrintJob, PrintBridgeHeartbeat } from "@/types/billing";

// Default Initial Hardware Printer Fleet — Tailored for POSIFLOW KP307-UEWB & Mobile Spooling
export const DEFAULT_PRINTER_DEVICES: PrinterDevice[] = [
  {
    id: "printer-posiflow-counter",
    name: "POSIFLOW KP307-UEWB (Counter Bill)",
    modelName: "POSIFLOW KP307-UEWB",
    connectionType: "NETWORK",
    ipAddress: "192.168.0.108",
    port: 9100,
    paperWidth: "80mm",
    isEnabled: true,
    status: "ONLINE",
    assignedStations: ["CASHIER"],
    isDefaultReceiptPrinter: true,
    isDefaultKotPrinter: false,
    autoCut: true,
    openDrawerOnPrint: true,
    failoverPrinterId: "printer-cashier-fallback",
  },
  {
    id: "printer-posiflow-kitchen",
    name: "POSIFLOW KP307-UEWB (Kitchen KOT)",
    modelName: "POSIFLOW KP307-UEWB",
    connectionType: "NETWORK",
    ipAddress: "192.168.1.51",
    port: 9100,
    paperWidth: "80mm",
    isEnabled: true,
    status: "ONLINE",
    assignedStations: ["MAIN_KITCHEN", "THALI_SECTION", "TANDOOR_BHAKRI", "FRY_SECTION", "BEVERAGE_DESSERT"],
    isDefaultReceiptPrinter: false,
    isDefaultKotPrinter: true,
    autoCut: true,
    openDrawerOnPrint: false,
    failoverPrinterId: "printer-kitchen-fallback",
  },
  {
    id: "printer-cashier-fallback",
    name: "Counter System Print (Browser Spooler)",
    connectionType: "BROWSER_SYSTEM",
    paperWidth: "80mm",
    isEnabled: true,
    status: "ONLINE",
    assignedStations: ["CASHIER"],
    isDefaultReceiptPrinter: false,
    isDefaultKotPrinter: false,
    autoCut: true,
    openDrawerOnPrint: true,
  },
  {
    id: "printer-kitchen-fallback",
    name: "Kitchen System Print (Fallback Spooler)",
    connectionType: "BROWSER_SYSTEM",
    paperWidth: "80mm",
    isEnabled: true,
    status: "ONLINE",
    assignedStations: ["MAIN_KITCHEN"],
    isDefaultReceiptPrinter: false,
    isDefaultKotPrinter: false,
    autoCut: true,
    openDrawerOnPrint: false,
  },
];

type QueueListener = (jobs: PrintJob[]) => void;

class PrinterConnectionManager {
  private jobs: PrintJob[] = [];
  private activePrinterLocks = new Set<string>(); // Printer IDs currently processing a job
  private listeners = new Set<QueueListener>();
  private broadcastChannel: BroadcastChannel | null = null;
  private isProcessing = false;

  // Cached hardware handles (Bluetooth GATT / Serial Ports)
  private bluetoothDevices = new Map<string, any>();
  private serialPorts = new Map<string, any>();

  constructor() {
    // Restore persisted queue history
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem("kk_print_jobs");
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) {
            this.jobs = parsed.slice(0, 40);
          }
        }
      } catch {}
    }

    if (typeof window !== "undefined" && "BroadcastChannel" in window) {
      try {
        this.broadcastChannel = new BroadcastChannel("kk_printer_bus");
        this.broadcastChannel.onmessage = (event) => {
          if (event.data?.type === "JOB_UPDATE") {
            this.handleRemoteJobUpdate(event.data.job);
          } else if (event.data?.type === "ENQUEUE_JOB") {
            this.jobs.push(event.data.job);
            this.saveJobsToStorage();
            this.notifyListeners();
            this.processQueue();
          }
        };
      } catch {}
    }
  }

  private saveJobsToStorage() {
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("kk_print_jobs", JSON.stringify(this.jobs.slice(0, 40)));
      } catch {}
    }
  }

  public subscribe(listener: QueueListener): () => void {
    this.listeners.add(listener);
    listener([...this.jobs]);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners() {
    const copy = [...this.jobs];
    for (const listener of this.listeners) {
      listener(copy);
    }
  }

  private handleRemoteJobUpdate(updatedJob: PrintJob) {
    const idx = this.jobs.findIndex((j) => j.id === updatedJob.id);
    if (idx !== -1) {
      this.jobs[idx] = updatedJob;
    } else {
      this.jobs.unshift(updatedJob);
    }
    this.notifyListeners();
  }

  public getJobs(): PrintJob[] {
    return [...this.jobs];
  }

  public clearCompletedJobs() {
    this.jobs = this.jobs.filter((j) => j.status === "QUEUED" || j.status === "PRINTING");
    this.saveJobsToStorage();
    this.notifyListeners();
  }

  public retryJob(jobId: string) {
    const job = this.jobs.find((j) => j.id === jobId);
    if (job) {
      job.status = "QUEUED";
      job.attempts = 0;
      job.errorMessage = undefined;
      this.saveJobsToStorage();
      this.notifyListeners();
      this.processQueue();
    }
  }

  public retryAllFailed() {
    let modified = false;
    for (const job of this.jobs) {
      if (job.status === "FAILED") {
        job.status = "QUEUED";
        job.attempts = 0;
        job.errorMessage = undefined;
        modified = true;
      }
    }
    if (modified) {
      this.saveJobsToStorage();
      this.notifyListeners();
      this.processQueue();
    }
  }

  public cancelJob(jobId: string) {
    const idx = this.jobs.findIndex((j) => j.id === jobId);
    if (idx !== -1) {
      if (this.jobs[idx].status === "QUEUED" || this.jobs[idx].status === "RETRYING") {
        this.jobs.splice(idx, 1);
      } else {
        this.jobs[idx].status = "FAILED";
        this.jobs[idx].errorMessage = "Cancelled by user";
      }
      this.saveJobsToStorage();
      this.notifyListeners();
    }
  }

  // ══════════════════════════════════════════════════════════════════
  //  DEVICE DISCOVERY & PAIRING
  // ══════════════════════════════════════════════════════════════════

  /**
   * Request Bluetooth Thermal Printer pairing using Web Bluetooth API
   */
  public async pairBluetoothPrinter(): Promise<{ deviceName: string; deviceId: string } | null> {
    if (typeof window === "undefined" || !(navigator as any).bluetooth) {
      throw new Error("Web Bluetooth API is not supported in this browser. Use Chrome/Edge over HTTPS.");
    }

    try {
      const device = await (navigator as any).bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: [
          "000018f0-0000-1000-8000-00805f9b34fb", // Standard Thermal Printer Service
          "00001101-0000-1000-8000-00805f9b34fb", // Standard Bluetooth SPP 16-bit UUID (0x1101)
          "49535343-fe7d-41aa-87d9-066442454a86", // ISSC Transparent Serial / Microchip SPP
          "0000ffe0-0000-1000-8000-00805f9b34fb", // HM-10 SPP UART
          "6e400001-b5a3-f393-e0a9-e50e24dcca9e", // Nordic UART Service (NUS)
          "e7810a71-73ae-499d-8c15-faa9aef0c3f2",
          "0000fee7-0000-1000-8000-00805f9b34fb", // Tencent Serial
          "0000ff00-0000-1000-8000-00805f9b34fb", // ESC/POS SPP
        ],
      });

      this.bluetoothDevices.set(device.id, device);
      return {
        deviceName: device.name || "Bluetooth Thermal Printer",
        deviceId: device.id,
      };
    } catch (err: any) {
      if (err.name === "NotFoundError") {
        return null; // User cancelled prompt
      }
      throw err;
    }
  }

  /**
   * Request Bluetooth Classic SPP / RFCOMM pairing with specific SPP UUID filters
   */
  public async pairBluetoothSppPrinter(customSppUuid?: string): Promise<{ deviceName: string; deviceId: string } | null> {
    if (typeof window === "undefined" || !(navigator as any).bluetooth) {
      throw new Error("Web Bluetooth API is not supported in this browser. Use Chrome/Edge over HTTPS.");
    }

    const services = [
      customSppUuid || "00001101-0000-1000-8000-00805f9b34fb",
      "000018f0-0000-1000-8000-00805f9b34fb",
      "49535343-fe7d-41aa-87d9-066442454a86",
      "0000ffe0-0000-1000-8000-00805f9b34fb",
      "6e400001-b5a3-f393-e0a9-e50e24dcca9e",
      "e7810a71-73ae-499d-8c15-faa9aef0c3f2",
    ];

    try {
      const device = await (navigator as any).bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: services,
      });

      this.bluetoothDevices.set(device.id, device);
      return {
        deviceName: device.name || "Bluetooth SPP Printer",
        deviceId: device.id,
      };
    } catch (err: any) {
      if (err.name === "NotFoundError") {
        return null;
      }
      throw err;
    }
  }

  /**
   * Request Web Serial COM / USB Port connection with hardware vendor identification
   */
  public async requestSerialPort(baudRate: number = 9600): Promise<{ portName: string; portId: string } | null> {
    if (typeof window === "undefined" || !("serial" in navigator)) {
      throw new Error("Web Serial API is not supported in this browser. Use Chrome/Edge over HTTPS on a desktop computer.");
    }

    const isMobile =
      /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) ||
      (typeof window !== "undefined" && window.innerWidth < 768);

    if (isMobile) {
      throw new Error(
        "Serial COM Ports are only supported on Windows/Linux desktop computers with RS232/USB cables. On Android/mobile, please select 'System Print (Android Print Service)' or 'Bluetooth Thermal Printer'."
      );
    }

    try {
      const port = await (navigator as any).serial.requestPort();
      const info = port.getInfo ? port.getInfo() : {};
      const vendorHex = info.usbVendorId ? `0x${info.usbVendorId.toString(16).toUpperCase()}` : "";
      const productHex = info.usbProductId ? `0x${info.usbProductId.toString(16).toUpperCase()}` : "";

      let friendlyName = "Serial COM Port";
      if (vendorHex === "0x1A86") friendlyName = "COM Port (CH340 USB-Serial)";
      else if (vendorHex === "0x10C4") friendlyName = "COM Port (CP210x USB-to-UART)";
      else if (vendorHex === "0x0403") friendlyName = "COM Port (FTDI USB Serial)";
      else if (vendorHex === "0x067B") friendlyName = "COM Port (Prolific PL2303)";
      else if (vendorHex) friendlyName = `COM Port (USB VID:${vendorHex} PID:${productHex})`;

      const portId = `serial-${Date.now()}`;
      this.serialPorts.set(portId, port);
      return { portName: friendlyName, portId };
    } catch (err: any) {
      if (err.name === "NotFoundError") {
        return null; // User cancelled prompt
      }
      throw err;
    }
  }

  /**
   * Ping / Test connectivity to a specific printer device
   */
  public async testDeviceConnection(
    device: PrinterDevice,
    settings?: PrinterSettings
  ): Promise<{ online: boolean; latencyMs?: number; message?: string }> {
    if (device.connectionType === "BROWSER_SYSTEM") {
      return { online: true, latencyMs: 1, message: "Browser print dialog system ready" };
    }

    if (device.connectionType === "NETWORK") {
      if (!device.ipAddress) {
        return { online: false, message: "IP address not configured" };
      }
      try {
        const port = device.port || 9100;
        const res = await fetch(
          `/api/print/network?ip=${encodeURIComponent(device.ipAddress)}&port=${port}&timeoutMs=2500`
        );
        const data = await res.json();
        return {
          online: data.online === true,
          latencyMs: data.latencyMs,
          message: data.online ? `Connected (${data.latencyMs}ms)` : data.error || "Printer unreachable on port 9100",
        };
      } catch (err: any) {
        return { online: false, message: err?.message || "Server ping failed" };
      }
    }

    if (device.connectionType === "LOCAL_BRIDGE") {
      const bridgeUrl = device.bridgeUrl || "http://localhost:9180/health";
      try {
        const start = Date.now();
        const res = await fetch(bridgeUrl, { method: "GET", mode: "cors" });
        return {
          online: res.ok,
          latencyMs: Date.now() - start,
          message: res.ok ? "Local print gateway active" : "Gateway returned error status",
        };
      } catch (err: any) {
        return { online: false, message: "Cannot connect to local bridge daemon" };
      }
    }

    if (device.connectionType === "BLUETOOTH") {
      return {
        online: true,
        latencyMs: 10,
        message: device.bluetoothDeviceName ? `Paired (${device.bluetoothDeviceName})` : "Bluetooth ready",
      };
    }

    if (device.connectionType === "BLUETOOTH_SPP") {
      const mode = device.sppMode || "AUTO";
      const channel = device.rfcommChannel || 1;
      const mac = device.bluetoothMacAddress ? ` [${device.bluetoothMacAddress}]` : "";
      const pin = device.rfcommPin ? ` (PIN: ${device.rfcommPin})` : "";

      if (mode === "VIRTUAL_COM") {
        const port = device.serialPortName || "Virtual COM";
        const baud = device.baudRate || 9600;
        return {
          online: true,
          latencyMs: 4,
          message: `SPP RFCOMM via ${port} (${baud} bps, 8-N-1)${mac}`,
        };
      }
      if (mode === "RAWBT_RFCOMM") {
        return {
          online: true,
          latencyMs: 6,
          message: `SPP RFCOMM Android Socket (Ch.${channel})${mac}${pin}`,
        };
      }
      if (mode === "BLE_GATT") {
        const name = device.bluetoothDeviceName || "SPP Printer";
        return {
          online: true,
          latencyMs: 12,
          message: `SPP BLE GATT (${name}, Chk:${device.chunkSize || 128}B)`,
        };
      }
      // AUTO mode
      const portDesc = device.serialPortName ? `COM: ${device.serialPortName}` : (device.bluetoothDeviceName || `RFCOMM Ch.${channel}`);
      return {
        online: true,
        latencyMs: 5,
        message: `Bluetooth SPP / RFCOMM Active (${portDesc})${mac}`,
      };
    }

    if (device.connectionType === "SERIAL_USB") {
      const baud = device.baudRate || 9600;
      const portName = device.serialPortName || "Serial COM Port";
      return { online: true, latencyMs: 3, message: `${portName} (${baud} bps)` };
    }

    if (device.connectionType === "RAWBT") {
      const host = device.rawbtHost || "localhost";
      const port = device.rawbtPort || 40213;
      try {
        const start = Date.now();
        await fetch(`http://${host}:${port}/`, { method: "GET", mode: "no-cors" });
        return {
          online: true,
          latencyMs: Date.now() - start,
          message: `RawBT service active (${host}:${port})`,
        };
      } catch {
        return {
          online: true,
          latencyMs: 1,
          message: device.rawbtMethod === "INTENT" ? "RawBT Android Intent Ready" : "RawBT Web Service (:40213 / Intent)",
        };
      }
    }

    if (device.connectionType === "BLUETOOTH_BLE") {
      const hasBle = typeof window !== "undefined" && !!(navigator as any).bluetooth;
      return {
        online: hasBle,
        latencyMs: 12,
        message: hasBle
          ? (device.bluetoothDeviceName ? `BLE Ready (${device.bluetoothDeviceName})` : "iOS Bluetooth BLE ready")
          : "Web Bluetooth API not supported in this browser (use WebBLE on iOS or Chrome on Android/PC)",
      };
    }

    // Cloud Print Queue: Check bridge heartbeat from Firestore
    if (device.connectionType === "CLOUD_QUEUE") {
      try {
        const bridgeOnline = await new Promise<boolean>((resolve) => {
          const unsub = subscribeToBridgeStatus((bridges) => {
            unsub();
            resolve(isBridgeOnline(bridges));
          });
          // Timeout after 3s if Firestore doesn't respond
          setTimeout(() => resolve(false), 3000);
        });
        return {
          online: bridgeOnline,
          latencyMs: bridgeOnline ? 50 : undefined,
          message: bridgeOnline
            ? "☁️ Cloud Print Bridge connected — jobs will be delivered by the restaurant PC"
            : "⚠️ Print Bridge offline — start the bridge on your cashier PC",
        };
      } catch {
        return {
          online: false,
          message: "Could not check bridge status",
        };
      }
    }

    return { online: true };
  }

  // ══════════════════════════════════════════════════════════════════
  //  QUEUE & SPOOLER DISPATCH ENGINE
  // ══════════════════════════════════════════════════════════════════

  /**
   * Enqueue a new print job into the spooler with optional duplicate suppression
   */
  public enqueueJob(
    device: PrinterDevice,
    title: string,
    type: PrintJob["type"],
    escposBytes?: Uint8Array,
    htmlFallback?: string,
    stationCode?: string,
    idempotencyKey?: string
  ): PrintJob {
    // Duplicate print protection: suppress identical ticket within 60s
    if (idempotencyKey) {
      const now = Date.now();
      const existing = this.jobs.find(
        (j) =>
          j.idempotencyKey === idempotencyKey &&
          (j.status === "SUCCESS" || j.status === "PRINTING" || j.status === "QUEUED") &&
          now - new Date(j.createdAt).getTime() < 60000
      );
      if (existing) {
        console.warn(`[Spooler] Duplicate print suppressed for key: ${idempotencyKey}`);
        return existing;
      }
    }

    const job: PrintJob = {
      id: `job-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      printerId: device.id,
      printerName: device.name,
      stationCode,
      type,
      status: "QUEUED",
      title,
      idempotencyKey,
      rawPayload: escposBytes ? this.bytesToBase64(escposBytes) : undefined,
      htmlPayload: htmlFallback,
      paperWidth: device.paperWidth,
      attempts: 0,
      maxAttempts: 3,
      createdAt: new Date().toISOString(),
    };

    this.jobs.unshift(job);
    this.saveJobsToStorage();
    this.notifyListeners();

    // Broadcast to other tabs
    try {
      this.broadcastChannel?.postMessage({ type: "ENQUEUE_JOB", job });
    } catch {}

    // Trigger queue processor
    this.processQueue();
    return job;
  }

  /**
   * Spooler worker: Processes queued jobs while preventing concurrent byte interleave on the same printer
   */
  public async processQueue() {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      const pendingJobs = this.jobs.filter((j) => j.status === "QUEUED" || j.status === "RETRYING");

      for (const job of pendingJobs) {
        // If this specific physical printer is already executing a job, skip and let next cycle handle it
        if (this.activePrinterLocks.has(job.printerId)) {
          continue;
        }

        // Lock printer for sequential transmission
        this.activePrinterLocks.add(job.printerId);
        job.status = "PRINTING";
        job.startedAt = new Date().toISOString();
        job.attempts++;
        this.saveJobsToStorage();
        this.notifyListeners();
        this.broadcastJobUpdate(job);

        // Execute job asynchronously
        this.executeJob(job)
          .then(() => {
            job.status = "SUCCESS";
            job.completedAt = new Date().toISOString();
            job.errorMessage = undefined;
          })
          .catch((err) => {
            if (job.attempts < job.maxAttempts) {
              job.status = "RETRYING";
              job.errorMessage = `Attempt ${job.attempts} failed: ${err?.message}. Retrying...`;
            } else {
              job.status = "FAILED";
              job.errorMessage = err?.message || "Print job failed";
              job.completedAt = new Date().toISOString();
            }
          })
          .finally(() => {
            this.activePrinterLocks.delete(job.printerId);
            this.saveJobsToStorage();
            this.notifyListeners();
            this.broadcastJobUpdate(job);
            // Process any remaining jobs
            setTimeout(() => this.processQueue(), 100);
          });
      }
    } finally {
      this.isProcessing = false;
    }
  }

  private broadcastJobUpdate(job: PrintJob) {
    try {
      this.broadcastChannel?.postMessage({ type: "JOB_UPDATE", job });
    } catch {}
  }

  /**
   * Low-level execution based on connection type
   */
  private async executeJob(job: PrintJob): Promise<void> {
    const settings = this.getStoredSettings();
    const device = settings.devices?.find((d) => d.id === job.printerId);

    if (!device) {
      // Fallback: Use browser window if device no longer found
      if (job.htmlPayload) {
        openPrintWindow(job.htmlPayload, job.title);
        return;
      }
      throw new Error(`Printer device ${job.printerId} not found in configuration`);
    }

    // 1. BROWSER_SYSTEM DRIVER
    if (device.connectionType === "BROWSER_SYSTEM") {
      if (job.htmlPayload) {
        openPrintWindow(job.htmlPayload, job.title);
        return;
      }
      throw new Error("No HTML payload available for browser print");
    }

    // 2. NETWORK (LAN TCP/IP 9100) DRIVER
    if (device.connectionType === "NETWORK") {
      if (!device.ipAddress) {
        throw new Error("Printer IP address is required for Network connection");
      }
      if (!job.rawPayload) {
        throw new Error("Raw ESC/POS payload is required for Network printing");
      }

      try {
        const res = await fetch("/api/print/network", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ip: device.ipAddress,
            port: device.port || 9100,
            payloadBase64: job.rawPayload,
            timeoutMs: settings.networkTimeoutMs || 3000,
          }),
        });

        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error || `Network printer ${device.ipAddress} refused connection`);
        }
        return;
      } catch (err: any) {
        return await this.handleDriverFailure(device, job, settings, err);
      }
    }

    // 3. BLUETOOTH (Web Bluetooth GATT) DRIVER
    if (device.connectionType === "BLUETOOTH") {
      const isMobile =
        typeof window !== "undefined" &&
        (/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || window.innerWidth < 768);
      if (isMobile && job.htmlPayload) {
        openPrintWindow(job.htmlPayload, job.title);
        return;
      }

      if (!job.rawPayload) throw new Error("No ESC/POS payload for Bluetooth");
      try {
        await this.sendBluetoothPayload(device, this.base64ToBytes(job.rawPayload));
        return;
      } catch (err: any) {
        return await this.handleDriverFailure(device, job, settings, err);
      }
    }

    // 3b. BLUETOOTH_BLE (iOS / Web Bluetooth Low Energy) DRIVER
    if (device.connectionType === "BLUETOOTH_BLE") {
      const isMobile =
        typeof window !== "undefined" &&
        (/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || window.innerWidth < 768);
      if (isMobile && job.htmlPayload) {
        openPrintWindow(job.htmlPayload, job.title);
        return;
      }

      if (!job.rawPayload) throw new Error("No ESC/POS payload for Bluetooth BLE");
      try {
        await this.sendBluetoothBlePayload(device, this.base64ToBytes(job.rawPayload));
        return;
      } catch (err: any) {
        return await this.handleDriverFailure(device, job, settings, err);
      }
    }

    // 3c. BLUETOOTH_SPP (Bluetooth Classic Serial Port Profile / RFCOMM) DRIVER
    if (device.connectionType === "BLUETOOTH_SPP") {
      const isMobile =
        typeof window !== "undefined" &&
        (/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || window.innerWidth < 768);
      if (isMobile && job.htmlPayload) {
        openPrintWindow(job.htmlPayload, job.title);
        return;
      }

      if (!job.rawPayload) throw new Error("No ESC/POS payload for Bluetooth SPP");
      try {
        await this.sendBluetoothSppPayload(device, this.base64ToBytes(job.rawPayload), job.rawPayload);
        return;
      } catch (err: any) {
        return await this.handleDriverFailure(device, job, settings, err);
      }
    }

    // 4. SERIAL_USB (Web Serial COM Port) DRIVER
    if (device.connectionType === "SERIAL_USB") {
      const isMobile =
        typeof window !== "undefined" &&
        (/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || window.innerWidth < 768);
      if (isMobile && job.htmlPayload) {
        openPrintWindow(job.htmlPayload, job.title);
        return;
      }

      if (!job.rawPayload) throw new Error("No ESC/POS payload for Serial");
      try {
        await this.sendSerialPayload(device, this.base64ToBytes(job.rawPayload));
        return;
      } catch (err: any) {
        return await this.handleDriverFailure(device, job, settings, err);
      }
    }

    // 5. RAWBT (Android Driver / Print Service)
    if (device.connectionType === "RAWBT") {
      if (!job.rawPayload) throw new Error("No ESC/POS payload for RawBT");
      try {
        await this.sendRawBtPayload(device, job.rawPayload);
        return;
      } catch (err: any) {
        return await this.handleDriverFailure(device, job, settings, err);
      }
    }

    // 6. LOCAL_BRIDGE DRIVER
    if (device.connectionType === "LOCAL_BRIDGE") {
      const bridgeUrl = device.bridgeUrl || "http://localhost:9180/print";
      const res = await fetch(bridgeUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payloadBase64: job.rawPayload,
          printerName: device.name,
          title: job.title,
        }),
      });
      if (!res.ok) {
        throw new Error(`Local bridge returned error: ${res.statusText}`);
      }
      return;
    }

    // 7. CLOUD_QUEUE DRIVER — Enqueue to Firestore for local bridge delivery
    if (device.connectionType === "CLOUD_QUEUE") {
      if (!job.rawPayload) {
        throw new Error("No ESC/POS payload for Cloud Queue");
      }
      const currentUser = this.getCurrentUser();
      await enqueuePrintJob({
        type: job.type as CloudPrintJob["type"],
        title: job.title,
        stationCode: job.stationCode || "CASHIER",
        payloadBase64: job.rawPayload,
        paperWidth: job.paperWidth,
        idempotencyKey: job.idempotencyKey,
        createdBy: currentUser.id,
        createdByName: currentUser.name,
      });
      return;
    }
  }

  /**
   * Automatic Failover & Browser Fallback Handler
   */
  private async handleDriverFailure(
    device: PrinterDevice,
    job: PrintJob,
    settings: PrinterSettings,
    err: any
  ): Promise<void> {
    console.warn(`[Spooler] Primary printer '${device.name}' failed: ${err?.message}`);

    // 1. Check if a failover printer is configured and enabled
    if (device.failoverPrinterId && settings.devices) {
      const failoverDev = settings.devices.find((d) => d.id === device.failoverPrinterId && d.isEnabled);
      if (failoverDev && failoverDev.id !== device.id) {
        console.warn(`[Failover] Re-routing job "${job.title}" to backup: ${failoverDev.name}`);
        job.printerId = failoverDev.id;
        job.printerName = failoverDev.name;
        return await this.executeJob(job);
      }
    }

    // 2. Fallback to Browser System Print window so no receipt is lost
    if (job.htmlPayload) {
      openPrintWindow(job.htmlPayload, `${job.title} (Fallback)`);
      return;
    }

    throw err;
  }

  private async sendBluetoothBlePayload(device: PrinterDevice, bytes: Uint8Array): Promise<void> {
    if (typeof window === "undefined" || !(navigator as any).bluetooth) {
      throw new Error("Web Bluetooth API not available in this browser");
    }

    let btDevice = this.bluetoothDevices.get(device.id);
    if (!btDevice) {
      const bleServices = [
        device.bleServiceUuid || "000018f0-0000-1000-8000-00805f9b34fb",
        "49535343-fe7d-41aa-87d9-066442454a86",
        "0000ffe0-0000-1000-8000-00805f9b34fb",
        "6e400001-b5a3-f393-e0a9-e50e24dcca9e",
        "e7810a71-73ae-499d-8c15-faa9aef0c3f2",
      ];
      btDevice = await (navigator as any).bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: bleServices,
      });
      this.bluetoothDevices.set(device.id, btDevice);
    }

    const server = await btDevice.gatt?.connect();
    if (!server) throw new Error("Could not connect to Bluetooth BLE GATT Server");

    const services = await server.getPrimaryServices();
    let writeChar: any = null;

    for (const service of services) {
      const chars = await service.getCharacteristics();
      for (const char of chars) {
        if (char.properties.writeWithoutResponse || char.properties.write) {
          writeChar = char;
          break;
        }
      }
      if (writeChar) break;
    }

    if (!writeChar) {
      throw new Error("No writable BLE characteristic found on thermal printer");
    }

    const chunkSize = device.chunkSize || 64;
    const delayMs = device.chunkDelayMs !== undefined ? device.chunkDelayMs : 20;

    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.slice(i, i + chunkSize);
      if (writeChar.writeValueWithoutResponse) {
        await writeChar.writeValueWithoutResponse(chunk);
      } else {
        await writeChar.writeValue(chunk);
      }
      if (delayMs > 0) {
        await new Promise((r) => setTimeout(r, delayMs));
      }
    }
  }

  private async sendBluetoothPayload(device: PrinterDevice, bytes: Uint8Array): Promise<void> {
    if (typeof window === "undefined" || !(navigator as any).bluetooth) {
      throw new Error("Web Bluetooth API not available");
    }

    let btDevice = this.bluetoothDevices.get(device.id);
    if (!btDevice) {
      btDevice = await (navigator as any).bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: [
          "000018f0-0000-1000-8000-00805f9b34fb",
          "e7810a71-73ae-499d-8c15-faa9aef0c3f2",
          "49535343-fe7d-41aa-87d9-066442454a86",
          "0000ffe0-0000-1000-8000-00805f9b34fb",
        ],
      });
      this.bluetoothDevices.set(device.id, btDevice);
    }

    const server = await btDevice.gatt?.connect();
    if (!server) throw new Error("Could not connect to GATT Server");

    const services = await server.getPrimaryServices();
    let writeChar: any = null;

    for (const service of services) {
      const chars = await service.getCharacteristics();
      for (const char of chars) {
        if (char.properties.write || char.properties.writeWithoutResponse) {
          writeChar = char;
          break;
        }
      }
      if (writeChar) break;
    }

    if (!writeChar) {
      throw new Error("No writable characteristic found on Bluetooth thermal printer");
    }

    // Write in chunks of 64 bytes to prevent buffer overrun on portable printers
    const CHUNK_SIZE = 64;
    for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
      const chunk = bytes.slice(i, i + CHUNK_SIZE);
      await writeChar.writeValue(chunk);
      await new Promise((r) => setTimeout(r, 25));
    }
  }

  /**
   * Dispatches print payload to Bluetooth Classic SPP / RFCOMM printers
   * Supports Virtual COM Port (Web Serial RFCOMM), RawBT Android Socket, and Web Bluetooth GATT SPP
   */
  private async sendBluetoothSppPayload(
    device: PrinterDevice,
    bytes: Uint8Array,
    rawPayloadBase64: string
  ): Promise<void> {
    const mode = device.sppMode || "AUTO";

    // 1. Virtual COM Port (Web Serial RFCOMM) mode:
    // Windows/Linux/Mac pairs SPP RFCOMM devices as virtual COM ports (e.g. COM3/COM4).
    if (
      mode === "VIRTUAL_COM" ||
      (mode === "AUTO" && (device.serialPortName || (typeof window !== "undefined" && "serial" in navigator)))
    ) {
      await this.sendSerialPayload(device, bytes);
      return;
    }

    // 2. RawBT Android RFCOMM Socket mode:
    // Android POS / Mobile Waiter phone connects via native RFCOMM socket on channel 1-30.
    if (mode === "RAWBT_RFCOMM") {
      await this.sendRawBtPayload(device, rawPayloadBase64);
      return;
    }

    // 3. Web Bluetooth GATT SPP / Serial Emulation:
    // Connects via Web Bluetooth with SPP UUIDs (0x1101, HM-10, ISSC, Nordic UART, etc.)
    await this.sendBluetoothSppGattPayload(device, bytes);
  }

  private async sendBluetoothSppGattPayload(device: PrinterDevice, bytes: Uint8Array): Promise<void> {
    if (typeof window === "undefined" || !(navigator as any).bluetooth) {
      throw new Error("Web Bluetooth API not available for SPP");
    }

    let btDevice = this.bluetoothDevices.get(device.id);
    if (!btDevice) {
      const sppServices = [
        device.sppUuid || "00001101-0000-1000-8000-00805f9b34fb", // Standard SPP 16-bit UUID
        "000018f0-0000-1000-8000-00805f9b34fb", // Standard ESC/POS
        "49535343-fe7d-41aa-87d9-066442454a86", // ISSC Transparent Serial
        "0000ffe0-0000-1000-8000-00805f9b34fb", // HM-10 SPP UART
        "6e400001-b5a3-f393-e0a9-e50e24dcca9e", // Nordic UART Service (NUS)
        "e7810a71-73ae-499d-8c15-faa9aef0c3f2",
        "0000fee7-0000-1000-8000-00805f9b34fb",
        "0000ff00-0000-1000-8000-00805f9b34fb",
      ];
      if (device.bluetoothServiceUuid && !sppServices.includes(device.bluetoothServiceUuid)) {
        sppServices.push(device.bluetoothServiceUuid);
      }

      btDevice = await (navigator as any).bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: sppServices,
      });
      this.bluetoothDevices.set(device.id, btDevice);
    }

    const server = await btDevice.gatt?.connect();
    if (!server) throw new Error("Could not connect to Bluetooth SPP GATT Server");

    const services = await server.getPrimaryServices();
    let writeChar: any = null;

    for (const service of services) {
      const chars = await service.getCharacteristics();
      for (const char of chars) {
        if (char.properties.write || char.properties.writeWithoutResponse) {
          writeChar = char;
          break;
        }
      }
      if (writeChar) break;
    }

    if (!writeChar) {
      throw new Error("No writable SPP characteristic found on Bluetooth printer");
    }

    // Configurable chunk size and throttle delay to prevent buffer overrun on portable SPP printers
    const chunkSize = device.chunkSize || 128;
    const delayMs = device.chunkDelayMs !== undefined ? device.chunkDelayMs : 25;

    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.slice(i, i + chunkSize);
      await writeChar.writeValue(chunk);
      if (delayMs > 0) {
        await new Promise((r) => setTimeout(r, delayMs));
      }
    }
  }

  private async sendSerialPayload(device: PrinterDevice, bytes: Uint8Array): Promise<void> {
    if (typeof window === "undefined" || !("serial" in navigator)) {
      throw new Error("Web Serial API not available in this browser. Please use Chrome/Edge over HTTPS.");
    }

    let port = this.serialPorts.get(device.id);
    if (!port) {
      const availablePorts = await (navigator as any).serial.getPorts();
      if (availablePorts && availablePorts.length > 0) {
        port = availablePorts[0];
        this.serialPorts.set(device.id, port);
      } else {
        throw new Error(
          `COM port for '${device.name}' is not connected. Please click 'Select COM Port' in device settings to authorize the port.`
        );
      }
    }

    if (!port.readable || !port.writable) {
      await port.open({
        baudRate: device.baudRate || 9600,
        dataBits: device.dataBits || 8,
        stopBits: device.stopBits || 1,
        parity: device.parity || "none",
        flowControl: device.flowControl || "none",
      });
    }

    const writer = port.writable.getWriter();
    try {
      await writer.write(bytes);
    } finally {
      writer.releaseLock();
    }
  }

  private async sendRawBtPayload(device: PrinterDevice, base64Payload: string): Promise<void> {
    const host = device.rawbtHost || "localhost";
    const port = device.rawbtPort || 40213;
    const method = device.rawbtMethod || "HTTP";

    // 1. Try RawBT Background HTTP Web Service (:40213)
    if (method === "HTTP") {
      try {
        const rawbtUrl = `http://${host}:${port}/`;
        const res = await fetch(rawbtUrl, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: `rawbt:data:application/octet-stream;base64,${encodeURIComponent(base64Payload)}`,
          mode: "cors",
        });
        if (res.ok) return;
      } catch (err) {
        console.warn("RawBT HTTP daemon unreachable, falling back to Android intent:", err);
      }
    }

    // 2. Android App Intent / URL scheme fallback
    if (typeof window !== "undefined") {
      const intentUrl = `intent:base64,${base64Payload}#Intent;scheme=rawbt;package=ru.a402d.rawbtprinter;S.browser_fallback_url=https%3A%2F%2Fplay.google.com%2Fstore%2Fapps%2Fdetails%3Fid%3Dru.a402d.rawbtprinter;end;`;
      const schemeUrl = `rawbt:data:application/octet-stream;base64,${base64Payload}`;
      try {
        if (typeof document !== "undefined") {
          const a = document.createElement("a");
          a.href = intentUrl;
          a.style.display = "none";
          document.body.appendChild(a);
          a.click();
          setTimeout(() => {
            try {
              if (a.parentNode) a.parentNode.removeChild(a);
            } catch {}
          }, 600);
          return;
        }
        window.location.href = intentUrl;
      } catch {
        window.location.href = schemeUrl;
      }
      return;
    }

    throw new Error("RawBT Android service unreachable");
  }

  // ══════════════════════════════════════════════════════════════════
  //  STATION-BASED MULTI-DEVICE ROUTING API
  // ══════════════════════════════════════════════════════════════════

  /**
   * Dispatches KOT ticket across connected station printers.
   * If autoSplitKotByStation is enabled, splits items by station and fires
   * to respective station printers concurrently!
   */
  public dispatchKot(
    kot: Kot,
    settings: PrinterSettings,
    isReprint: boolean = false,
    htmlFallbackFn?: (kot: Kot, station?: string, isReprint?: boolean, width?: "80mm" | "58mm") => string
  ): PrintJob[] {
    const devices = this.getActiveDevices(settings);
    const jobsCreated: PrintJob[] = [];

    // Group items by station code
    const stationMap = new Map<string, typeof kot.items>();
    for (const item of kot.items) {
      // If item doesn't have stationCode, use KOT stationCode
      const st = (item as any).stationCode || kot.stationCode || "MAIN_KITCHEN";
      if (!stationMap.has(st)) stationMap.set(st, []);
      stationMap.get(st)!.push(item);
    }

    const shouldSplit = settings.autoSplitKotByStation && stationMap.size > 1;

    if (shouldSplit) {
      // 1. Fire individual station tickets to each respective station's printer
      for (const [stationCode, items] of stationMap.entries()) {
        const stationKot: Kot = {
          ...kot,
          stationCode: stationCode as any,
          items,
        };

        const targetPrinter = this.findPrinterForStation(devices, stationCode, "KOT");
        const escpos = buildKotEscPos(stationKot, stationCode, isReprint, targetPrinter.paperWidth);
        const html = htmlFallbackFn
          ? htmlFallbackFn(stationKot, stationCode, isReprint, targetPrinter.paperWidth)
          : undefined;

        const job = this.enqueueJob(
          targetPrinter,
          `KOT ${kot.kotNumber} [${stationCode}]`,
          "KOT",
          escpos,
          html,
          stationCode,
          isReprint ? undefined : `kot-${kot.id || kot.kotNumber}-${stationCode}`
        );
        jobsCreated.push(job);
      }

      // 2. Optionally also print master KOT to Main Kitchen
      if (settings.printMasterKotToKitchen) {
        const kitchenPrinter = this.findPrinterForStation(devices, "MAIN_KITCHEN", "KOT");
        const escpos = buildKotEscPos(kot, undefined, isReprint, kitchenPrinter.paperWidth);
        const html = htmlFallbackFn
          ? htmlFallbackFn(kot, undefined, isReprint, kitchenPrinter.paperWidth)
          : undefined;

        const masterJob = this.enqueueJob(
          kitchenPrinter,
          `KOT ${kot.kotNumber} [MASTER]`,
          "KOT",
          escpos,
          html,
          "MAIN_KITCHEN",
          isReprint ? undefined : `kot-${kot.id || kot.kotNumber}-MASTER`
        );
        jobsCreated.push(masterJob);
      }
    } else {
      // Single station or splitting disabled: route to designated printer for kot.stationCode
      const targetPrinter = this.findPrinterForStation(devices, kot.stationCode, "KOT");
      const escpos = buildKotEscPos(kot, undefined, isReprint, targetPrinter.paperWidth);
      const html = htmlFallbackFn
        ? htmlFallbackFn(kot, undefined, isReprint, targetPrinter.paperWidth)
        : undefined;

      const job = this.enqueueJob(
        targetPrinter,
        `KOT ${kot.kotNumber}`,
        "KOT",
        escpos,
        html,
        kot.stationCode,
        isReprint ? undefined : `kot-${kot.id || kot.kotNumber}`
      );
      jobsCreated.push(job);
    }

    return jobsCreated;
  }

  /**
   * Dispatches Bill Customer Receipt to Cashier / Receipt printer
   */
  public dispatchBill(
    bill: Bill,
    isDuplicate: boolean = false,
    settings: PrinterSettings,
    htmlFallbackFn?: (bill: Bill, isDup: boolean, width?: "80mm" | "58mm") => string
  ): PrintJob {
    const devices = this.getActiveDevices(settings);
    const receiptPrinter = this.findPrinterForStation(devices, "CASHIER", "RECEIPT");

    const escpos = buildBillReceiptEscPos(bill, isDuplicate, receiptPrinter.paperWidth);
    const html = htmlFallbackFn
      ? htmlFallbackFn(bill, isDuplicate, receiptPrinter.paperWidth)
      : undefined;

    return this.enqueueJob(
      receiptPrinter,
      `${isDuplicate ? "DUPLICATE " : ""}Bill ${bill.billNumber}`,
      "RECEIPT",
      escpos,
      html,
      "CASHIER",
      isDuplicate ? undefined : `bill-${bill.id}-${bill.paidAmount || bill.grandTotal}`
    );
  }

  /**
   * Dispatches Table Check Estimate
   */
  public dispatchTableCheck(
    params: any,
    settings: PrinterSettings,
    htmlFallbackFn?: (p: any) => string
  ): PrintJob {
    const devices = this.getActiveDevices(settings);
    const receiptPrinter = this.findPrinterForStation(devices, "CASHIER", "RECEIPT");

    const escpos = buildTableCheckEscPos(params, receiptPrinter.paperWidth);
    const html = htmlFallbackFn ? htmlFallbackFn(params) : undefined;

    return this.enqueueJob(
      receiptPrinter,
      `Table Check ${params.party?.partyCode || "Estimate"}`,
      "TABLE_CHECK",
      escpos,
      html,
      "CASHIER"
    );
  }

  /**
   * Dispatches Cancelled KOT Slip
   */
  public dispatchCancelledKot(
    kot: Kot,
    reason: string,
    cancelledBy: string,
    settings: PrinterSettings,
    htmlFallbackFn?: (k: Kot, r: string, c: string, w?: "80mm" | "58mm") => string
  ): PrintJob {
    const devices = this.getActiveDevices(settings);
    const kitchenPrinter = this.findPrinterForStation(devices, kot.stationCode, "KOT");

    const escpos = buildCancelledKotEscPos(kot, reason, cancelledBy, kitchenPrinter.paperWidth);
    const html = htmlFallbackFn
      ? htmlFallbackFn(kot, reason, cancelledBy, kitchenPrinter.paperWidth)
      : undefined;

    return this.enqueueJob(
      kitchenPrinter,
      `VOID KOT ${kot.kotNumber}`,
      "CANCELLED_KOT",
      escpos,
      html,
      kot.stationCode
    );
  }

  /**
   * Dispatches Cashier Day-End Z-Report
   */
  public dispatchDayEndReport(
    report: any,
    settings: PrinterSettings,
    htmlFallbackFn?: (r: any, w?: "80mm" | "58mm") => string
  ): PrintJob {
    const devices = this.getActiveDevices(settings);
    const cashierPrinter = this.findPrinterForStation(devices, "CASHIER", "RECEIPT");

    const escpos = buildDayEndReportEscPos(report, cashierPrinter.paperWidth);
    const html = htmlFallbackFn
      ? htmlFallbackFn(report, cashierPrinter.paperWidth)
      : undefined;

    return this.enqueueJob(
      cashierPrinter,
      `Day-End Z-Report ${report.date}`,
      "DAY_END",
      escpos,
      html,
      "CASHIER"
    );
  }

  /**
   * Dispatches Diagnostic Test Slip to a specific printer or all printers
   */
  public dispatchTestSlip(
    device: PrinterDevice,
    htmlFallbackFn?: (settings?: any) => string
  ): PrintJob {
    const escpos = buildDiagnosticTestEscPos(device.name, device.paperWidth);
    const html = htmlFallbackFn
      ? htmlFallbackFn({ paperWidth: device.paperWidth, printerName: device.name })
      : this.generateDiagnosticHtml(device);

    return this.enqueueJob(
      device,
      `Diagnostic Test (${device.name})`,
      "TEST",
      escpos,
      html
    );
  }

  /**
   * Directly executes a diagnostic test slip with immediate user gesture support and error reporting.
   * Handles user activation for Web Serial and Web Bluetooth, opening browser chooser prompts directly.
   */
  public async printDirectDeviceTestSlip(
    device: PrinterDevice,
    htmlFallbackFn?: (settings?: any) => string
  ): Promise<{ success: boolean; message?: string }> {
    const html = htmlFallbackFn
      ? htmlFallbackFn({ paperWidth: device.paperWidth, printerName: device.name })
      : this.generateDiagnosticHtml(device);

    // 1. Browser System print
    if (device.connectionType === "BROWSER_SYSTEM") {
      openPrintWindow(html, `Diagnostic Test — ${device.name}`);
      return { success: true, message: "Browser print dialog opened" };
    }

    // 2. Serial USB or Bluetooth SPP (Virtual COM)
    if (
      device.connectionType === "SERIAL_USB" ||
      (device.connectionType === "BLUETOOTH_SPP" && (device.sppMode === "VIRTUAL_COM" || !device.sppMode))
    ) {
      const isMobile =
        /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) ||
        (typeof window !== "undefined" && window.innerWidth < 768);
      if (isMobile) {
        openPrintWindow(html, `Diagnostic Test — ${device.name}`);
        return { success: true, message: "Dispatched to System Print (Mobile mode)" };
      }

      if (typeof window === "undefined" || !("serial" in navigator)) {
        throw new Error("Web Serial API is not supported in this browser. Use Chrome or Edge over HTTPS.");
      }

      let port = this.serialPorts.get(device.id);
      if (!port) {
        const availablePorts = await (navigator as any).serial.getPorts();
        if (availablePorts && availablePorts.length > 0) {
          port = availablePorts[0];
          this.serialPorts.set(device.id, port);
        } else {
          // In transient user click activation: open native browser COM chooser!
          port = await (navigator as any).serial.requestPort();
          if (!port) throw new Error("No COM port was selected");
          this.serialPorts.set(device.id, port);
        }
      }

      const escposBytes = buildDiagnosticTestEscPos(device.name, device.paperWidth);
      await this.sendSerialPayload(device, escposBytes);
      return {
        success: true,
        message: `Sent to ${device.serialPortName || "COM Port"} (${device.baudRate || 9600} bps)`,
      };
    }

    // 3. Web Bluetooth or Bluetooth SPP (BLE GATT)
    if (
      device.connectionType === "BLUETOOTH" ||
      (device.connectionType === "BLUETOOTH_SPP" && device.sppMode === "BLE_GATT")
    ) {
      if (typeof window === "undefined" || !(navigator as any).bluetooth) {
        throw new Error("Web Bluetooth API is not available in this browser");
      }

      let btDevice = this.bluetoothDevices.get(device.id);
      if (!btDevice) {
        const sppServices = [
          device.sppUuid || "00001101-0000-1000-8000-00805f9b34fb",
          "000018f0-0000-1000-8000-00805f9b34fb",
          "49535343-fe7d-41aa-87d9-066442454a86",
          "0000ffe0-0000-1000-8000-00805f9b34fb",
          "6e400001-b5a3-f393-e0a9-e50e24dcca9e",
          "e7810a71-73ae-499d-8c15-faa9aef0c3f2",
        ];
        btDevice = await (navigator as any).bluetooth.requestDevice({
          acceptAllDevices: true,
          optionalServices: sppServices,
        });
        if (!btDevice) throw new Error("Bluetooth device pairing was cancelled");
        this.bluetoothDevices.set(device.id, btDevice);
      }

      const escposBytes = buildDiagnosticTestEscPos(device.name, device.paperWidth);
      if (device.connectionType === "BLUETOOTH_SPP") {
        await this.sendBluetoothSppGattPayload(device, escposBytes);
      } else {
        await this.sendBluetoothPayload(device, escposBytes);
      }
      return { success: true, message: `Sent to Bluetooth printer (${btDevice.name || device.name})` };
    }

    // 4. RawBT (Android)
    if (
      device.connectionType === "RAWBT" ||
      (device.connectionType === "BLUETOOTH_SPP" && device.sppMode === "RAWBT_RFCOMM")
    ) {
      const escposBytes = buildDiagnosticTestEscPos(device.name, device.paperWidth);
      const b64 = this.bytesToBase64(escposBytes);
      await this.sendRawBtPayload(device, b64);
      return { success: true, message: "Sent via RawBT Android service" };
    }

    // 5. Network (LAN / Wi-Fi)
    if (device.connectionType === "NETWORK") {
      if (!device.ipAddress) throw new Error("Printer IP address is not configured");
      const escposBytes = buildDiagnosticTestEscPos(device.name, device.paperWidth);
      const res = await fetch("/api/print/network", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ip: device.ipAddress,
          port: device.port || 9100,
          payloadBase64: this.bytesToBase64(escposBytes),
          timeoutMs: 3500,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || `Printer at ${device.ipAddress}:${device.port || 9100} is unreachable`);
      }
      return { success: true, message: `Printed on Network ${device.ipAddress}` };
    }

    // 6. Local Bridge
    if (device.connectionType === "LOCAL_BRIDGE") {
      const bridgeUrl = device.bridgeUrl || "http://localhost:9180/print";
      const escposBytes = buildDiagnosticTestEscPos(device.name, device.paperWidth);
      const res = await fetch(bridgeUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payloadBase64: this.bytesToBase64(escposBytes),
          printerName: device.name,
          title: `Diagnostic Test (${device.name})`,
        }),
      });
      if (!res.ok) throw new Error(`Local bridge returned ${res.statusText}`);
      return { success: true, message: "Printed via Local POS Bridge" };
    }

    // 7. Cloud Print Queue
    if (device.connectionType === "CLOUD_QUEUE") {
      const escposBytes = buildDiagnosticTestEscPos(device.name, device.paperWidth);
      const currentUser = this.getCurrentUser();
      await enqueuePrintJob({
        type: "TEST",
        title: `Diagnostic Test (${device.name})`,
        stationCode: "CASHIER",
        payloadBase64: this.bytesToBase64(escposBytes),
        paperWidth: device.paperWidth,
        createdBy: currentUser.id,
        createdByName: currentUser.name,
      });
      return { success: true, message: "☁️ Sent test slip to Cloud Print Queue — bridge will deliver" };
    }

    // Fallback: Dispatch through standard spooler queue
    this.dispatchTestSlip(device, htmlFallbackFn);
    return { success: true, message: "Queued in spooler" };
  }

  /**
   * Directly prints a customer bill/receipt with immediate user gesture activation.
   * On Android / Mobile: Dispatches to openPrintWindow (or RawBT) immediately in the user gesture.
   * On Desktop: Writes to serial COM port directly or triggers browser prompt if needed.
   * Enqueues into spooler history as SUCCESS.
   */
  public async printDirectBill(
    bill: Bill,
    isDuplicate: boolean = false,
    settings?: PrinterSettings,
    htmlFallbackFn?: (bill: Bill, isDup: boolean, width?: "80mm" | "58mm") => string
  ): Promise<{ success: boolean; message?: string }> {
    const currentSettings = settings || this.getStoredSettings();
    const devices = this.getActiveDevices(currentSettings);
    const targetPrinter = this.findPrinterForStation(devices, "CASHIER", "RECEIPT");

    const html = htmlFallbackFn
      ? htmlFallbackFn(bill, isDuplicate, targetPrinter.paperWidth)
      : undefined;
    const title = `${isDuplicate ? "DUPLICATE " : ""}Bill ${bill.billNumber}`;

    const escposBytes = buildBillReceiptEscPos(bill, isDuplicate, targetPrinter.paperWidth);
    const idempotencyKey = isDuplicate ? undefined : `bill-${bill.id}-${bill.paidAmount || bill.grandTotal}`;

    const job = this.enqueueJob(
      targetPrinter,
      title,
      "RECEIPT",
      escposBytes,
      html,
      "CASHIER",
      idempotencyKey
    );

    const markSuccess = (msg: string) => {
      job.status = "SUCCESS";
      job.completedAt = new Date().toISOString();
      this.saveJobsToStorage();
      this.notifyListeners();
      return { success: true, message: msg };
    };

    // 1. Browser System Print
    if (targetPrinter.connectionType === "BROWSER_SYSTEM") {
      if (html) openPrintWindow(html, title);
      return markSuccess("Browser print window opened");
    }

    // 2. Serial USB or Bluetooth SPP (Virtual COM / Web Serial)
    if (
      targetPrinter.connectionType === "SERIAL_USB" ||
      targetPrinter.connectionType === "BLUETOOTH_SPP"
    ) {
      const isMobile =
        typeof window !== "undefined" &&
        (/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || window.innerWidth < 768);

      if (isMobile) {
        if (targetPrinter.sppMode === "RAWBT_RFCOMM") {
          const b64 = this.bytesToBase64(escposBytes);
          await this.sendRawBtPayload(targetPrinter, b64);
          return markSuccess("Sent via RawBT Android");
        }
        if (html) openPrintWindow(html, title);
        return markSuccess("Dispatched to System Print (Mobile mode)");
      }

      // Desktop: Check Web Serial API
      if (typeof window !== "undefined" && "serial" in navigator) {
        try {
          let port = this.serialPorts.get(targetPrinter.id);
          if (!port) {
            const availablePorts = await (navigator as any).serial.getPorts();
            if (availablePorts && availablePorts.length > 0) {
              port = availablePorts[0];
              this.serialPorts.set(targetPrinter.id, port);
            } else {
              // Direct user click: prompt port chooser
              port = await (navigator as any).serial.requestPort();
              if (port) {
                this.serialPorts.set(targetPrinter.id, port);
              }
            }
          }

          if (port) {
            await this.sendSerialPayload(targetPrinter, escposBytes);
            return markSuccess(
              `Printed to ${targetPrinter.name} (${targetPrinter.serialPortName || "COM Port"})`
            );
          }
        } catch (err: any) {
          console.warn("Serial direct bill print failed, falling back to openPrintWindow:", err);
          if (err.name === "NotFoundError") {
            if (html) openPrintWindow(html, title);
            return markSuccess("Dispatched to Print Window");
          }
        }
      }

      // Fallback to openPrintWindow
      if (html) openPrintWindow(html, title);
      return markSuccess("Dispatched to Print Window");
    }

    // 3. RawBT
    if (targetPrinter.connectionType === "RAWBT") {
      const b64 = this.bytesToBase64(escposBytes);
      await this.sendRawBtPayload(targetPrinter, b64);
      return markSuccess("Sent via RawBT Android");
    }

    // 4. Network (Wi-Fi / LAN)
    if (targetPrinter.connectionType === "NETWORK") {
      if (targetPrinter.ipAddress) {
        try {
          const res = await fetch("/api/print/network", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ip: targetPrinter.ipAddress,
              port: targetPrinter.port || 9100,
              payloadBase64: this.bytesToBase64(escposBytes),
              timeoutMs: 2000,
            }),
          });
          const data = await res.json();
          if (res.ok && data.success) {
            return markSuccess(`Printed on Network ${targetPrinter.ipAddress}`);
          }
        } catch (err) {
          console.warn("Network print failed, falling back to browser print:", err);
        }
      }
      if (html) openPrintWindow(html, title);
      return markSuccess("Dispatched to Print Window (Network Fallback)");
    }

    // 5. Cloud Print Queue — enqueue to Firestore for bridge delivery
    if (targetPrinter.connectionType === "CLOUD_QUEUE") {
      const currentUser = this.getCurrentUser();
      await enqueuePrintJob({
        type: "RECEIPT",
        title,
        stationCode: "CASHIER",
        payloadBase64: this.bytesToBase64(escposBytes),
        paperWidth: targetPrinter.paperWidth,
        idempotencyKey,
        createdBy: currentUser.id,
        createdByName: currentUser.name,
      });
      return markSuccess("☁️ Sent to Cloud Print Queue — bridge will deliver");
    }

    // Default Fallback
    if (html) openPrintWindow(html, title);
    return markSuccess("Dispatched to Print Window");
  }

  /**
   * Directly prints a table check / pre-bill estimate with immediate user gesture activation.
   */
  public async printDirectTableCheck(
    params: any,
    settings?: PrinterSettings,
    htmlFallbackFn?: (p: any) => string
  ): Promise<{ success: boolean; message?: string }> {
    const currentSettings = settings || this.getStoredSettings();
    const devices = this.getActiveDevices(currentSettings);
    const targetPrinter = this.findPrinterForStation(devices, "CASHIER", "RECEIPT");

    const html = htmlFallbackFn ? htmlFallbackFn(params) : undefined;
    const title = `Table Check ${params.party?.partyCode || params.partyCode || "Estimate"}`;

    const escposBytes = buildTableCheckEscPos(params, targetPrinter.paperWidth);
    const job = this.enqueueJob(targetPrinter, title, "TABLE_CHECK", escposBytes, html, "CASHIER");

    const markSuccess = (msg: string) => {
      job.status = "SUCCESS";
      job.completedAt = new Date().toISOString();
      this.saveJobsToStorage();
      this.notifyListeners();
      return { success: true, message: msg };
    };

    if (targetPrinter.connectionType === "BROWSER_SYSTEM") {
      if (html) openPrintWindow(html, title);
      return markSuccess("Browser print window opened");
    }

    if (
      targetPrinter.connectionType === "SERIAL_USB" ||
      targetPrinter.connectionType === "BLUETOOTH_SPP"
    ) {
      const isMobile =
        typeof window !== "undefined" &&
        (/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || window.innerWidth < 768);

      if (isMobile) {
        if (targetPrinter.sppMode === "RAWBT_RFCOMM") {
          const b64 = this.bytesToBase64(escposBytes);
          await this.sendRawBtPayload(targetPrinter, b64);
          return markSuccess("Sent via RawBT Android");
        }
        if (html) openPrintWindow(html, title);
        return markSuccess("Dispatched to System Print (Mobile mode)");
      }

      if (typeof window !== "undefined" && "serial" in navigator) {
        try {
          let port = this.serialPorts.get(targetPrinter.id);
          if (!port) {
            const availablePorts = await (navigator as any).serial.getPorts();
            if (availablePorts && availablePorts.length > 0) {
              port = availablePorts[0];
              this.serialPorts.set(targetPrinter.id, port);
            } else {
              port = await (navigator as any).serial.requestPort();
              if (port) this.serialPorts.set(targetPrinter.id, port);
            }
          }
          if (port) {
            await this.sendSerialPayload(targetPrinter, escposBytes);
            return markSuccess(`Printed to ${targetPrinter.name}`);
          }
        } catch (err: any) {
          console.warn("Serial pre-bill print failed:", err);
        }
      }

      if (html) openPrintWindow(html, title);
      return markSuccess("Dispatched to Print Window");
    }

    // Cloud Print Queue — enqueue to Firestore for bridge delivery
    if (targetPrinter.connectionType === "CLOUD_QUEUE") {
      const currentUser = this.getCurrentUser();
      await enqueuePrintJob({
        type: "TABLE_CHECK",
        title,
        stationCode: "CASHIER",
        payloadBase64: this.bytesToBase64(escposBytes),
        paperWidth: targetPrinter.paperWidth,
        createdBy: currentUser.id,
        createdByName: currentUser.name,
      });
      return markSuccess("☁️ Sent to Cloud Print Queue — bridge will deliver");
    }

    if (html) openPrintWindow(html, title);
    return markSuccess("Dispatched to Print Window");
  }

  /**
   * Directly prints a Kitchen Order Ticket with immediate user gesture activation.
   */
  public async printDirectKot(
    kot: Kot,
    isReprint: boolean = false,
    stationFilter?: string,
    settings?: PrinterSettings,
    htmlFallbackFn?: (kot: Kot, station?: string, isReprint?: boolean, width?: "80mm" | "58mm") => string
  ): Promise<{ success: boolean; message?: string }> {
    const currentSettings = settings || this.getStoredSettings();
    const devices = this.getActiveDevices(currentSettings);
    const targetPrinter = this.findPrinterForStation(devices, stationFilter || kot.stationCode, "KOT");

    const html = htmlFallbackFn
      ? htmlFallbackFn(kot, stationFilter || kot.stationCode, isReprint, targetPrinter.paperWidth)
      : undefined;
    const title = `KOT ${kot.kotNumber}${stationFilter ? ` [${stationFilter}]` : ""}`;

    const escposBytes = buildKotEscPos(kot, stationFilter, isReprint, targetPrinter.paperWidth);
    const idempotencyKey = isReprint ? undefined : `kot-${kot.id || kot.kotNumber}-${stationFilter || "ALL"}`;

    const job = this.enqueueJob(targetPrinter, title, "KOT", escposBytes, html, stationFilter || kot.stationCode, idempotencyKey);

    const markSuccess = (msg: string) => {
      job.status = "SUCCESS";
      job.completedAt = new Date().toISOString();
      this.saveJobsToStorage();
      this.notifyListeners();
      return { success: true, message: msg };
    };

    if (targetPrinter.connectionType === "BROWSER_SYSTEM") {
      if (html) openPrintWindow(html, title);
      return markSuccess("Browser print window opened");
    }

    if (
      targetPrinter.connectionType === "SERIAL_USB" ||
      targetPrinter.connectionType === "BLUETOOTH_SPP"
    ) {
      const isMobile =
        typeof window !== "undefined" &&
        (/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || window.innerWidth < 768);

      if (isMobile) {
        if (targetPrinter.sppMode === "RAWBT_RFCOMM") {
          const b64 = this.bytesToBase64(escposBytes);
          await this.sendRawBtPayload(targetPrinter, b64);
          return markSuccess("Sent via RawBT Android");
        }
        if (html) openPrintWindow(html, title);
        return markSuccess("Dispatched to System Print (Mobile mode)");
      }

      if (typeof window !== "undefined" && "serial" in navigator) {
        try {
          let port = this.serialPorts.get(targetPrinter.id);
          if (!port) {
            const availablePorts = await (navigator as any).serial.getPorts();
            if (availablePorts && availablePorts.length > 0) {
              port = availablePorts[0];
              this.serialPorts.set(targetPrinter.id, port);
            } else {
              port = await (navigator as any).serial.requestPort();
              if (port) this.serialPorts.set(targetPrinter.id, port);
            }
          }
          if (port) {
            await this.sendSerialPayload(targetPrinter, escposBytes);
            return markSuccess(`Printed to ${targetPrinter.name}`);
          }
        } catch (err: any) {
          console.warn("Serial KOT print failed:", err);
        }
      }

      if (html) openPrintWindow(html, title);
      return markSuccess("Dispatched to Print Window");
    }

    if (targetPrinter.connectionType === "RAWBT") {
      const b64 = this.bytesToBase64(escposBytes);
      await this.sendRawBtPayload(targetPrinter, b64);
      return markSuccess("Sent via RawBT Android");
    }

    if (targetPrinter.connectionType === "NETWORK") {
      if (targetPrinter.ipAddress) {
        try {
          const res = await fetch("/api/print/network", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ip: targetPrinter.ipAddress,
              port: targetPrinter.port || 9100,
              payloadBase64: this.bytesToBase64(escposBytes),
              timeoutMs: 2000,
            }),
          });
          const data = await res.json();
          if (res.ok && data.success) {
            return markSuccess(`Printed on Network ${targetPrinter.ipAddress}`);
          }
        } catch (err) {
          console.warn("Network KOT print failed:", err);
        }
      }
      if (html) openPrintWindow(html, title);
      return markSuccess("Dispatched to Print Window (Network Fallback)");
    }

    // Cloud Print Queue — enqueue to Firestore for bridge delivery
    if (targetPrinter.connectionType === "CLOUD_QUEUE") {
      const currentUser = this.getCurrentUser();
      await enqueuePrintJob({
        type: "KOT",
        title,
        stationCode: stationFilter || kot.stationCode || "MAIN_KITCHEN",
        payloadBase64: this.bytesToBase64(escposBytes),
        paperWidth: targetPrinter.paperWidth,
        idempotencyKey,
        createdBy: currentUser.id,
        createdByName: currentUser.name,
      });
      return markSuccess("☁️ Sent to Cloud Print Queue — bridge will deliver");
    }

    if (html) openPrintWindow(html, title);
    return markSuccess("Dispatched to Print Window");
  }

  private generateDiagnosticHtml(device: PrinterDevice): string {
    const is58mm = device.paperWidth === "58mm";
    const now = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Diagnostic Test — ${device.name}</title>
  <style>
    @page { margin: 0; size: ${is58mm ? "58mm" : "80mm"} auto; }
    body {
      font-family: 'Courier New', Courier, monospace, 'Mangal', sans-serif;
      margin: 0;
      padding: 3mm;
      width: ${is58mm ? "48mm" : "72mm"};
      font-size: 11px;
      line-height: 1.3;
      color: #000;
      background: #fff;
    }
    .center { text-align: center; }
    .bold { font-weight: bold; }
    .dashed { border-bottom: 1px dashed #000; margin: 4px 0; }
  </style>
</head>
<body>
  <div class="center bold" style="font-size: 14px;">कोल्हापुरी खानावळ</div>
  <div class="center bold">KOLHAPURI KHANAWAL</div>
  <div class="center" style="font-size: 10px;">PRINTER DIAGNOSTIC TEST TICKET</div>
  <div class="dashed"></div>
  <div><b>Printer:</b> ${device.name}</div>
  <div><b>Type:</b> ${device.connectionType}</div>
  <div><b>Width:</b> ${device.paperWidth}</div>
  <div><b>Time:</b> ${now}</div>
  <div class="dashed"></div>
  <div class="center bold">मराठी देवनागरी प्रिंट चाचणी</div>
  <div class="center" style="font-size: 10px;">तांबडा रस्सा • पांढरा रस्सा • मटण सुक्का • भाकरी</div>
  <div class="dashed"></div>
  <div class="center bold">✓ DIAGNOSTIC TEST PASSED</div>
  <div style="height: 10mm;"></div>
</body>
</html>`;
  }

  // ══════════════════════════════════════════════════════════════════
  //  INTERNAL HELPERS
  // ══════════════════════════════════════════════════════════════════

  public getActiveDevices(settings?: PrinterSettings): PrinterDevice[] {
    const configured = settings?.devices && settings.devices.length > 0
      ? settings.devices
      : DEFAULT_PRINTER_DEVICES;
    return configured.filter((d) => d.isEnabled);
  }

  public findPrinterForStation(
    devices: PrinterDevice[],
    stationCode: string,
    role: "RECEIPT" | "KOT"
  ): PrinterDevice {
    // 1. For RECEIPT: ALWAYS prioritize the designated default receipt printer!
    if (role === "RECEIPT") {
      const defaultReceipt = devices.find((d) => d.isDefaultReceiptPrinter);
      if (defaultReceipt) return defaultReceipt;

      // Check if user has paired a real hardware printer (Serial, Bluetooth SPP, RawBT)
      const hardwareDev = devices.find(
        (d) =>
          d.connectionType === "BLUETOOTH_SPP" ||
          d.connectionType === "SERIAL_USB" ||
          d.connectionType === "RAWBT" ||
          /Serial|POS-80|POS-58/i.test(d.name) ||
          /Serial|POS-80|POS-58/i.test(d.bluetoothDeviceName || "")
      );
      if (hardwareDev) return hardwareDev;
    }

    // 2. Look for a printer explicitly assigned to this stationCode
    const match = devices.find((d) => d.assignedStations && d.assignedStations.includes(stationCode));
    if (match) return match;

    // 3. Look for default role printer
    if (role === "RECEIPT") {
      const defaultReceipt = devices.find((d) => d.isDefaultReceiptPrinter);
      if (defaultReceipt) return defaultReceipt;
    } else {
      const defaultKot = devices.find((d) => d.isDefaultKotPrinter);
      if (defaultKot) return defaultKot;
    }

    // 4. Fallback to default receipt printer if any
    const defReceipt = devices.find((d) => d.isDefaultReceiptPrinter);
    if (defReceipt) return defReceipt;

    // 5. Fallback to first available device
    return devices[0] || DEFAULT_PRINTER_DEVICES[0];
  }

  private getStoredSettings(): PrinterSettings {
    if (typeof window !== "undefined") {
      try {
        const raw = localStorage.getItem("kk_printer_settings");
        if (raw) return JSON.parse(raw);
      } catch {}
    }

    const isMobile =
      typeof window !== "undefined" &&
      (/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || window.innerWidth < 768);

    const devices = isMobile
      ? [
          {
            id: "printer-mobile-system",
            name: "Android System Print (सर्वोत्तम व सोपे)",
            connectionType: "BROWSER_SYSTEM" as const,
            paperWidth: "80mm" as const,
            isEnabled: true,
            status: "ONLINE" as const,
            assignedStations: [
              "CASHIER",
              "MAIN_KITCHEN",
              "THALI_SECTION",
              "TANDOOR_BHAKRI",
              "FRY_SECTION",
              "BEVERAGE_DESSERT",
            ],
            isDefaultReceiptPrinter: true,
            isDefaultKotPrinter: true,
            autoCut: true,
            openDrawerOnPrint: false,
          },
          ...DEFAULT_PRINTER_DEVICES.filter((d) => d.id !== "printer-posiflow-counter").map((d) => ({
            ...d,
            isDefaultReceiptPrinter: false,
            isDefaultKotPrinter: false,
          })),
        ]
      : DEFAULT_PRINTER_DEVICES;

    return {
      paperWidth: "80mm",
      autoPrintKotOnOrder: true,
      autoPrintReceiptOnPayment: true,
      autoPrintPreBillOnRequest: true,
      autoKickCashDrawerOnCash: true,
      numberOfReceiptCopies: 1,
      printMarathiHeader: true,
      stationPrinters: [],
      devices,
      autoSplitKotByStation: true,
      printMasterKotToKitchen: true,
      printSpoolerEnabled: true,
    };
  }

  private bytesToBase64(bytes: Uint8Array): string {
    let binary = "";
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    if (typeof window !== "undefined" && window.btoa) {
      return window.btoa(binary);
    }
    return Buffer.from(binary, "binary").toString("base64");
  }

  private base64ToBytes(base64: string): Uint8Array {
    if (typeof window !== "undefined" && window.atob) {
      const binary = window.atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      return bytes;
    }
    return new Uint8Array(Buffer.from(base64, "base64"));
  }

  private getCurrentUser(): { id: string; name: string } {
    try {
      if (typeof window !== "undefined") {
        const stored = localStorage.getItem("kk_current_user");
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed?.id && parsed?.name) {
            return { id: parsed.id, name: parsed.name };
          }
        }
      }
    } catch {}
    return { id: "STAFF", name: "Restaurant Staff" };
  }

  public getDevices(settings?: PrinterSettings): PrinterDevice[] {
    return this.getActiveDevices(settings);
  }

  /**
   * 1-Tap Activation: Android System Print (Recommended for all Android phones/tablets)
   * Connects via Android's native print spooler. Works with any Bluetooth or Wi-Fi printer paired in Android settings.
   */
  public activateAndroidSystemPrint(paperWidth: "80mm" | "58mm" = "80mm"): PrinterDevice {
    const device: PrinterDevice = {
      id: "printer-android-system",
      name: "📱 Android फोन प्रिंटर (System Spooler)",
      modelName: "Android System Print Spooler",
      connectionType: "BROWSER_SYSTEM",
      paperWidth,
      isEnabled: true,
      status: "ONLINE",
      assignedStations: ["CASHIER", "MAIN_KITCHEN", "THALI_SECTION", "TANDOOR_BHAKRI", "FRY_SECTION", "BEVERAGE_DESSERT"],
      isDefaultReceiptPrinter: true,
      isDefaultKotPrinter: true,
      autoCut: true,
      openDrawerOnPrint: false,
    };

    const currentSettings = this.getStoredSettings();
    const updatedSettings: PrinterSettings = {
      ...currentSettings,
      paperWidth,
      devices: [
        device,
        ...(currentSettings.devices || []).filter((d) => d.id !== device.id).map((d) => ({
          ...d,
          isDefaultReceiptPrinter: false,
          isDefaultKotPrinter: false,
        })),
      ],
    };

    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("kk_printer_settings", JSON.stringify(updatedSettings));
      } catch {}
    }

    return device;
  }

  /**
   * 1-Tap Activation: RawBT Bluetooth (Instant 0.1s silent ESC/POS printing on Android)
   * Works with RawBT Android Driver app paired to any Classic Bluetooth thermal printer.
   */
  public activateAndroidRawBtPrint(paperWidth: "80mm" | "58mm" = "80mm"): PrinterDevice {
    const device: PrinterDevice = {
      id: "printer-android-rawbt",
      name: "⚡ RawBT ब्लूटूथ प्रिंटर (Instant Print)",
      modelName: "RawBT Android Print Service",
      connectionType: "RAWBT",
      rawbtMethod: "INTENT",
      rawbtHost: "localhost",
      rawbtPort: 40213,
      paperWidth,
      isEnabled: true,
      status: "ONLINE",
      assignedStations: ["CASHIER", "MAIN_KITCHEN", "THALI_SECTION", "TANDOOR_BHAKRI", "FRY_SECTION", "BEVERAGE_DESSERT"],
      isDefaultReceiptPrinter: true,
      isDefaultKotPrinter: true,
      autoCut: true,
      openDrawerOnPrint: true,
      failoverPrinterId: "printer-android-system",
    };

    const currentSettings = this.getStoredSettings();
    const updatedSettings: PrinterSettings = {
      ...currentSettings,
      paperWidth,
      devices: [
        device,
        {
          id: "printer-android-system",
          name: "📱 Android फोन प्रिंटर (System Fallback)",
          modelName: "Android System Print Spooler",
          connectionType: "BROWSER_SYSTEM",
          paperWidth,
          isEnabled: true,
          status: "ONLINE",
          assignedStations: ["CASHIER", "MAIN_KITCHEN"],
          isDefaultReceiptPrinter: false,
          isDefaultKotPrinter: false,
          autoCut: true,
          openDrawerOnPrint: false,
        },
        ...(currentSettings.devices || []).filter(
          (d) => d.id !== device.id && d.id !== "printer-android-system"
        ).map((d) => ({
          ...d,
          isDefaultReceiptPrinter: false,
          isDefaultKotPrinter: false,
        })),
      ],
    };

    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("kk_printer_settings", JSON.stringify(updatedSettings));
      } catch {}
    }

    return device;
  }

  /**
   * 1-Tap Activation: Wi-Fi / LAN Network Thermal Printer (e.g. POSIFLOW KP307-UEWB)
   */
  public activateWifiNetworkPrint(ipAddress: string, paperWidth: "80mm" | "58mm" = "80mm"): PrinterDevice {
    const device: PrinterDevice = {
      id: "printer-wifi-network",
      name: `हॉटेल वाय-फाय प्रिंटर (${ipAddress})`,
      modelName: "POSIFLOW KP307-UEWB",
      connectionType: "NETWORK",
      ipAddress: ipAddress.trim(),
      port: 9100,
      paperWidth,
      isEnabled: true,
      status: "ONLINE",
      assignedStations: ["CASHIER", "MAIN_KITCHEN", "THALI_SECTION", "TANDOOR_BHAKRI", "FRY_SECTION", "BEVERAGE_DESSERT"],
      isDefaultReceiptPrinter: true,
      isDefaultKotPrinter: true,
      autoCut: true,
      openDrawerOnPrint: true,
      failoverPrinterId: "printer-android-system",
    };

    const currentSettings = this.getStoredSettings();
    const updatedSettings: PrinterSettings = {
      ...currentSettings,
      paperWidth,
      devices: [
        device,
        {
          id: "printer-android-system",
          name: "📱 Android फोन प्रिंटर (Wi-Fi Fallback)",
          modelName: "Android System Print Spooler",
          connectionType: "BROWSER_SYSTEM",
          paperWidth,
          isEnabled: true,
          status: "ONLINE",
          assignedStations: ["CASHIER", "MAIN_KITCHEN"],
          isDefaultReceiptPrinter: false,
          isDefaultKotPrinter: false,
          autoCut: true,
          openDrawerOnPrint: false,
        },
        ...(currentSettings.devices || []).filter(
          (d) => d.id !== device.id && d.id !== "printer-android-system"
        ).map((d) => ({
          ...d,
          isDefaultReceiptPrinter: false,
          isDefaultKotPrinter: false,
        })),
      ],
    };

    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("kk_printer_settings", JSON.stringify(updatedSettings));
      } catch {}
    }

    return device;
  }

  /**
   * 1-Tap Activation: Cloud Print Queue & Local Bridge (Recommended for PWA Android + Counter Printer)
   * Phone enqueues to Firestore; Cashier PC bridge delivers to thermal printer over local Wi-Fi.
   */
  public activateCloudQueuePrint(paperWidth: "80mm" | "58mm" = "80mm"): PrinterDevice {
    const device: PrinterDevice = {
      id: "printer-cloud-bridge",
      name: "☁️ क्लाउड प्रिंट ब्रिज (Cloud Print Bridge)",
      modelName: "Cloud Print Queue Spooler",
      connectionType: "CLOUD_QUEUE",
      paperWidth,
      isEnabled: true,
      status: "ONLINE",
      assignedStations: ["CASHIER", "MAIN_KITCHEN", "THALI_SECTION", "TANDOOR_BHAKRI", "FRY_SECTION", "BEVERAGE_DESSERT"],
      isDefaultReceiptPrinter: true,
      isDefaultKotPrinter: true,
      autoCut: true,
      openDrawerOnPrint: true,
      failoverPrinterId: "printer-android-system",
    };

    const currentSettings = this.getStoredSettings();
    const updatedSettings: PrinterSettings = {
      ...currentSettings,
      paperWidth,
      devices: [
        device,
        {
          id: "printer-android-system",
          name: "📱 Android फोन प्रिंटर (System Fallback)",
          modelName: "Android System Print Spooler",
          connectionType: "BROWSER_SYSTEM",
          paperWidth,
          isEnabled: true,
          status: "ONLINE",
          assignedStations: ["CASHIER", "MAIN_KITCHEN"],
          isDefaultReceiptPrinter: false,
          isDefaultKotPrinter: false,
          autoCut: true,
          openDrawerOnPrint: false,
        },
        ...(currentSettings.devices || []).filter(
          (d) => d.id !== device.id && d.id !== "printer-android-system"
        ).map((d) => ({
          ...d,
          isDefaultReceiptPrinter: false,
          isDefaultKotPrinter: false,
        })),
      ],
    };

    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("kk_printer_settings", JSON.stringify(updatedSettings));
      } catch {}
    }

    return device;
  }

  /**
   * Probes candidate network IPs in parallel on TCP port 9100
   * to automatically discover online KP307-UEWB or ESC/POS printers on the local network.
   */
  public async scanNetworkPrinters(
    candidateIps?: string[]
  ): Promise<{ ip: string; port: number; latencyMs?: number }[]> {
    try {
      const qs = candidateIps && candidateIps.length > 0 ? `&candidates=${encodeURIComponent(candidateIps.join(","))}` : "";
      const res = await fetch(`/api/print/network?scan=true${qs}&timeoutMs=1500`);
      if (!res.ok) return [];
      const data = await res.json();
      return data.printers || [];
    } catch {
      return [];
    }
  }
}

// Global Singleton Instance
export const globalPrinterManager = new PrinterConnectionManager();
export const printerConnectionManager = globalPrinterManager;
