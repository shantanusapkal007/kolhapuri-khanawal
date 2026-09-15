/**
 * Kolhapuri Khanawal Restaurant Operating System
 * Phase 0: Billing, Configurable Tax Engine, Multi-Tender Settlement Types
 */

export type PaymentMethodType = "CASH" | "UPI" | "CARD" | "OTHER";

export type BillStatus =
  | "DRAFT"
  | "OPEN"
  | "FINALIZED"
  | "PAID"
  | "PARTIALLY_PAID"
  | "CANCELLED"
  | "REFUNDED";

export interface TaxRate {
  id: string;
  name: string; // e.g. "GST Standalone Restaurant (5%)", "GST Alcohol (VAT 10%)", "Exempt (0%)"
  code: string;
  cgstRate: number; // e.g. 2.5
  sgstRate: number; // e.g. 2.5
  igstRate: number; // e.g. 5.0
  vatRate: number;  // e.g. 0.0
  totalRate: number; // 5.0
  isTaxInclusive: boolean;
  isTaxExempt: boolean;
  hsnSacCode?: string;
  effectiveFrom: string;
  effectiveTo?: string;
  isActive: boolean;
}

export interface DiscountPolicy {
  id: string;
  name: string;
  discountType: "PERCENTAGE" | "FLAT_AMOUNT";
  value: number;
  maxDiscountAmount?: number;
  requiresManagerPin: boolean;
  minBillAmount?: number;
  isActive: boolean;
}

export interface Bill {
  id: string;
  billNumber: string; // e.g. "BILL-2026-000001"
  partyId: string;
  partyCode: string;
  tableId: string;
  tableNumber: number;
  waiterId: string;
  waiterName: string;
  cashierId: string;
  cashierName: string;
  status: BillStatus;
  subtotal: number;
  discountId?: string;
  discountAmount: number;
  discountReason?: string;
  discountApprovedBy?: string;
  taxableAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  vatAmount: number;
  totalTaxAmount: number;
  roundOff: number;
  grandTotal: number;
  paidAmount: number;
  balanceDue: number;
  createdAt: string;
  settledAt?: string;
  cancelledAt?: string;
  cancelledBy?: string;
  cancelledReason?: string;
  isTakeaway?: boolean;
  customerName?: string;
  customerPhone?: string;
  packagingCharges?: number;
  items: BillItem[];
  payments: Payment[];
}

export interface BillItem {
  id: string;
  billId: string;
  orderItemId: string;
  menuItemId: string;
  menuItemName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  seatNumber?: number;
  taxRateId: string;
  taxRatePercentage: number;
  taxAmount: number;
  isComplimentary: boolean;
  breadOption?: string;
}

export interface Payment {
  id: string;
  billId: string;
  paymentMethod: PaymentMethodType;
  amount: number;
  transactionReference?: string; // UPI UTR / Card Auth Code
  receivedBy: string;
  receivedByName: string;
  status: "SUCCESS" | "REFUNDED" | "VOID";
  notes?: string;
  paymentTime: string;
}

export interface RefundRecord {
  id: string;
  billId: string;
  paymentId: string;
  amount: number;
  reason: string;
  approvedBy: string;
  approvedByName: string;
  refundMethod: PaymentMethodType;
  refundReference?: string;
  timestamp: string;
}

export interface DayEndDishSales {
  menuItemId: string;
  name: string;
  quantity: number;
  revenue: number;
}

export interface DayEndReport {
  date: string;
  shiftName: string;
  generatedAt: string;
  generatedByName: string;
  totalBills: number;
  settledBillsCount: number;
  cancelledBillsCount: number;
  grossSalesSubtotal: number;
  totalDiscountAmount: number;
  netTaxableSales: number;
  cgstAmount: number;
  sgstAmount: number;
  totalTaxAmount: number;
  totalPackagingCharges: number;
  roundOffTotal: number;
  netRevenue: number;
  tenders: {
    cash: number;
    upi: number;
    card: number;
    other: number;
  };
  topSellingDishes: DayEndDishSales[];
  auditDiscrepanciesCount: number;
  // Backward compatibility test aliases
  reportId?: string;
  totalBillsSettled?: number;
  grossSales?: number;
  taxableSales?: number;
  cgstTotal?: number;
  sgstTotal?: number;
  topDishes?: { name: string; qty: number; revenue: number }[];
  auditDiscrepancyCount?: number;
  cancelledKotsCount?: number;
}

export type KhanawalExpenseCategory =
  | "FOOD_PURCHASE"
  | "CLEANING"
  | "GAS"
  | "WIFI"
  | "ELECTRICITY"
  | "TRANSPORT"
  | "REPAIR"
  | "MAINTENANCE"
  | "STAFF"
  | "ADVANCE"
  | "KITCHEN"
  | "EQUIPMENT"
  | "OTHER"
  | "UNCLASSIFIED";

export type { MasterExpenseCategory, ExpenseFrequency, ExpenseRecord } from "@/types/expenses";

export interface CashLedgerEntry {
  id: string;
  date: string;
  entryType: "OPENING" | "SALE" | "PURCHASE" | "EXPENSE" | "SUPPLIER_PAYMENT" | "STAFF_PAYMENT" | "ADJUSTMENT";
  description: string;
  inflow: number;
  outflow: number;
  balance: number;
  referenceId?: string;
  timestamp: string;
}

export interface UPILedgerEntry {
  id: string;
  date: string;
  entryType: "OPENING" | "SALE" | "EXPENSE" | "TRANSFER" | "SETTLEMENT";
  description: string;
  inflow: number;
  outflow: number;
  balance: number;
  utrReference?: string;
  timestamp: string;
}

export type PrinterConnectionType =
  | "NETWORK"        // TCP/IP raw socket port 9100 (Ethernet / Wi-Fi)
  | "BLUETOOTH"      // Web Bluetooth BLE
  | "BLUETOOTH_SPP"  // Bluetooth Classic Serial Port Profile (SPP) / RFCOMM (Virtual COM / GATT Serial / RawBT)
  | "SERIAL_USB"     // Web Serial COM port / direct USB
  | "RAWBT"          // RawBT print service (Android HTTP daemon :40213 or App Intent)
  | "LOCAL_BRIDGE"   // Local HTTP print daemon / gateway (e.g. http://localhost:9180/print)
  | "BROWSER_SYSTEM"; // Browser window / iframe print dialog fallback

export type PrinterStatus = "ONLINE" | "OFFLINE" | "CONNECTING" | "BUSY" | "ERROR";

export type BluetoothSppMode = "VIRTUAL_COM" | "BLE_GATT" | "RAWBT_RFCOMM" | "AUTO";

export interface PrinterDevice {
  id: string;
  name: string;
  connectionType: PrinterConnectionType;
  paperWidth: "80mm" | "58mm";
  isEnabled: boolean;
  status: PrinterStatus;
  
  // Connection parameters
  ipAddress?: string;         // e.g. "192.168.1.100" (for NETWORK)
  port?: number;              // default 9100 (for NETWORK)
  baudRate?: number;          // 9600, 19200, 38400, 57600, 115200 (for SERIAL_USB / BLUETOOTH_SPP)
  serialPortName?: string;     // e.g. "COM3 (USB-SERIAL CH340)" (for SERIAL_USB / BLUETOOTH_SPP)
  dataBits?: 7 | 8;
  stopBits?: 1 | 2;
  parity?: "none" | "even" | "odd";
  flowControl?: "none" | "hardware";

  // RawBT (Android Driver / Print Service)
  rawbtMethod?: "HTTP" | "INTENT"; // HTTP background daemon (default) vs Android app intent
  rawbtHost?: string;              // default "localhost" or local network IP
  rawbtPort?: number;              // default 40213

  bridgeUrl?: string;         // e.g. "http://localhost:9180/print" (for LOCAL_BRIDGE)
  bluetoothDeviceName?: string; // e.g. "RPP02N-Thermal" (for BLUETOOTH / BLUETOOTH_SPP)
  bluetoothServiceUuid?: string; // Optional custom GATT service UUID

  // Bluetooth Classic SPP (Serial Port Profile) & RFCOMM Settings
  sppMode?: BluetoothSppMode;       // "VIRTUAL_COM" | "BLE_GATT" | "RAWBT_RFCOMM" | "AUTO"
  rfcommChannel?: number;           // 1 to 30 (default: 1)
  bluetoothMacAddress?: string;     // e.g. "66:32:B1:88:99:A2"
  sppUuid?: string;                 // default: "00001101-0000-1000-8000-00805f9b34fb"
  rfcommPin?: string;               // default: "0000" or "1234"
  chunkSize?: number;               // Throttle chunk size in bytes (e.g. 64, 128, 256)
  chunkDelayMs?: number;            // Delay between chunks in ms (e.g. 15, 25, 50)

  
  // Station & role assignments
  assignedStations: string[];  // e.g. ["MAIN_KITCHEN", "TANDOOR_BHAKRI"]
  isDefaultReceiptPrinter: boolean; // Receives customer tax invoices
  isDefaultKotPrinter: boolean;     // Receives kitchen tickets
  
  // Hardware capabilities
  autoCut: boolean;
  openDrawerOnPrint: boolean;
  
  // Runtime telemetry
  lastSeen?: string;
  latencyMs?: number;
  lastErrorMessage?: string;
}

export interface PrintJob {
  id: string;
  printerId: string;
  printerName: string;
  stationCode?: string;
  type: "RECEIPT" | "KOT" | "TABLE_CHECK" | "CANCELLED_KOT" | "DAY_END" | "TEST";
  status: PrintJobStatus;
  title: string;
  rawPayload?: string;        // Base64 or hex encoded ESC/POS byte sequence
  htmlPayload?: string;       // Fallback HTML string
  paperWidth: "80mm" | "58mm";
  attempts: number;
  maxAttempts: number;
  errorMessage?: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
}

export type PrintJobStatus = "QUEUED" | "PRINTING" | "SUCCESS" | "FAILED" | "RETRYING";

export interface StationPrinterConfig {
  stationCode: string;
  stationName: string;
  printerName: string;
  paperWidth: "80mm" | "58mm";
  isEnabled: boolean;
  printerId?: string;
  connectionType?: PrinterConnectionType;
}

export interface PrinterSettings {
  paperWidth: "80mm" | "58mm";
  autoPrintKotOnOrder: boolean;
  autoPrintReceiptOnPayment: boolean;
  autoPrintPreBillOnRequest: boolean;
  autoKickCashDrawerOnCash: boolean;
  numberOfReceiptCopies: number;
  printMarathiHeader: boolean;
  stationPrinters: StationPrinterConfig[];
  // Enhanced Multi-Device & Routing features
  devices?: PrinterDevice[];
  autoSplitKotByStation?: boolean; // When true, multi-station orders split tickets to station printers automatically
  printMasterKotToKitchen?: boolean; // Also print master ticket to Main Kitchen when splitting
  printSpoolerEnabled?: boolean;     // Sequential per-printer queue to prevent byte collision
  networkTimeoutMs?: number;         // Socket timeout in milliseconds (default: 3500)
}

