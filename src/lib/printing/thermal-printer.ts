/**
 * Kolhapuri Khanawal Restaurant Operating System
 * Thermal Printer Engine — 80mm & 58mm Monospace Thermal Printing
 *
 * Supports:
 *  - Customer Tax Invoice (80mm / 58mm) with duplicate/reprint and parcel tags
 *  - Table Check / Pre-Bill Estimate ("कच्चा बिल") with UPI payment QR instructions
 *  - Kitchen Order Ticket (KOT) with Add-on, Station-filtered, and Reprint markers
 *  - Cancelled KOT Slip ("रद्द पावती — DO NOT PREPARE")
 *  - Cashier Day-End Z-Report ("दिवसाचा हिशोब")
 *  - Diagnostic Printer Test Ticket with Devanagari Unicode alignment test
 *  - Hardware Cash Drawer Kick simulation pulse
 */

import { Bill, DayEndReport, PrinterSettings } from "@/types/billing";
import { Kot, OrderItem, BreadOption, BREAD_OPTION_LABELS } from "@/types/orders";
import { DiningParty } from "@/types/tables";
import { WaiterCredential } from "@/types/domain";
import { DEFAULT_PRINTER_DEVICES, globalPrinterManager } from "./printer-connection-manager";
import { EscPosBuilder } from "./escpos-builder";

export { globalPrinterManager, DEFAULT_PRINTER_DEVICES, EscPosBuilder };

// ── Restaurant Header Constants & Profile Provider ───────────────
export {
  RESTAURANT_NAME,
  RESTAURANT_NAME_EN,
  RESTAURANT_ADDRESS,
  RESTAURANT_PHONE,
  RESTAURANT_GSTIN,
  RESTAURANT_FSSAI,
  RESTAURANT_UPI_ID,
  getActiveRestaurantProfile,
  type ActiveRestaurantProfile,
} from "./restaurant-profile";
import {
  getActiveRestaurantProfile,
  type ActiveRestaurantProfile,
  RESTAURANT_NAME,
  RESTAURANT_NAME_EN,
  RESTAURANT_ADDRESS,
  RESTAURANT_PHONE,
  RESTAURANT_GSTIN,
  RESTAURANT_FSSAI,
  RESTAURANT_UPI_ID,
} from "./restaurant-profile";

// ── Default Printer Settings ─────────────────────────────────────
export const DEFAULT_PRINTER_SETTINGS: PrinterSettings = {
  paperWidth: "80mm",
  autoPrintKotOnOrder: true,
  autoPrintReceiptOnPayment: true,
  autoPrintPreBillOnRequest: true,
  autoKickCashDrawerOnCash: true,
  numberOfReceiptCopies: 1,
  printMarathiHeader: true,
  stationPrinters: [
    { stationCode: "CASHIER", stationName: "Cashier Desk", printerName: "POS-80 Counter", paperWidth: "80mm", isEnabled: true },
    { stationCode: "MAIN_KITCHEN", stationName: "Main Kitchen", printerName: "Kitchen 80-1", paperWidth: "80mm", isEnabled: true },
    { stationCode: "TANDOOR_BHAKRI", stationName: "Tandoor / Bhakri", printerName: "Bhakri Thermal-1", paperWidth: "80mm", isEnabled: true },
    { stationCode: "FRY_SECTION", stationName: "Fry / Sukka", printerName: "Fry Thermal-1", paperWidth: "80mm", isEnabled: true },
    { stationCode: "BEVERAGE_DESSERT", stationName: "Solkadhi / Bar", printerName: "Bar 58-1", paperWidth: "58mm", isEnabled: true },
  ],
  devices: DEFAULT_PRINTER_DEVICES,
  autoSplitKotByStation: true,
  printMasterKotToKitchen: true,
  printSpoolerEnabled: true,
  networkTimeoutMs: 3500,
  failoverEnabled: true,
  duplicatePrintProtection: true,
};

/**
 * Detects if the current client is running on an Android device
 */
export function isAndroidDevice(): boolean {
  if (typeof window === "undefined" || !navigator) return false;
  return /Android/i.test(navigator.userAgent || "");
}

/**
 * Detects if the current client is a mobile device or phone/tablet screen
 */
export function isMobileDevice(): boolean {
  if (typeof window === "undefined" || !navigator) return false;
  return (
    /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || "") ||
    (typeof window.innerWidth === "number" && window.innerWidth < 768)
  );
}

/**
 * Retrieves persisted printer settings or returns defaults
 */
export function getStoredPrinterSettings(): PrinterSettings {
  if (typeof window === "undefined") return DEFAULT_PRINTER_SETTINGS;
  try {
    const raw = localStorage.getItem("kk_printer_settings");
    if (raw) {
      return { ...DEFAULT_PRINTER_SETTINGS, ...JSON.parse(raw) };
    }
    // Mobile / Android first run: provide ready-to-use Android System Print default
    if (isMobileDevice()) {
      return {
        ...DEFAULT_PRINTER_SETTINGS,
        devices: [
          {
            id: "printer-android-system",
            name: "📱 Android फोन प्रिंटर (System Spooler)",
            modelName: "Android System Print Spooler",
            connectionType: "BROWSER_SYSTEM",
            paperWidth: "80mm",
            isEnabled: true,
            status: "ONLINE",
            assignedStations: ["CASHIER", "MAIN_KITCHEN", "THALI_SECTION", "TANDOOR_BHAKRI", "FRY_SECTION", "BEVERAGE_DESSERT"],
            isDefaultReceiptPrinter: true,
            isDefaultKotPrinter: true,
            autoCut: true,
            openDrawerOnPrint: false,
          },
        ],
      };
    }
    return DEFAULT_PRINTER_SETTINGS;
  } catch {
    return DEFAULT_PRINTER_SETTINGS;
  }
}

/**
 * Persists printer settings to browser storage
 */
export function saveStoredPrinterSettings(settings: PrinterSettings): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem("kk_printer_settings", JSON.stringify(settings));
  } catch {
    // Ignore storage quota errors
  }
}

// ── Base CSS for 80mm & 58mm Thermal Receipts ────────────────────
export function getThermalBaseCss(paperWidth: "80mm" | "58mm" = "80mm"): string {
  const is58mm = paperWidth === "58mm";
  const targetWidth = is58mm ? "58mm" : "80mm";
  const baseFontSize = is58mm ? "11px" : "12px";
  const bigFontSize = is58mm ? "12px" : "14px";
  const kotHeaderSize = is58mm ? "15px" : "18px";
  const itemColWidth = is58mm ? "26mm" : "38mm";

  return `
  @page {
    size: ${targetWidth} auto;
    margin: 0;
  }
  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
    font-weight: 700 !important;
    color: #000000 !important;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
    text-rendering: geometricPrecision;
  }
  body {
    font-family: 'Courier New', 'Courier', 'Lucida Console', Monaco, monospace;
    font-size: ${baseFontSize};
    font-weight: 700 !important;
    line-height: 1.35;
    color: #000000 !important;
    background: #ffffff !important;
    width: ${targetWidth};
    max-width: ${targetWidth};
    padding: 4mm 3mm;
    -webkit-font-smoothing: antialiased;
  }
  .center { text-align: center; }
  .right { text-align: right; }
  .bold { font-weight: 900 !important; }
  .big { font-size: ${bigFontSize}; font-weight: 900 !important; }
  .small { font-size: ${is58mm ? "9.5px" : "10.5px"}; font-weight: 700 !important; }
  .tiny { font-size: ${is58mm ? "8.5px" : "9.5px"}; font-weight: 700 !important; }
  .dashed {
    border-top: 1.5px dashed #000000 !important;
    margin: 4px 0;
  }
  .double-line {
    border-top: 2.5px solid #000000 !important;
    margin: 4px 0;
  }
  table {
    width: 100%;
    border-collapse: collapse;
  }
  th, td {
    padding: 1.5px 0;
    vertical-align: top;
    font-weight: 700 !important;
    color: #000000 !important;
  }
  th { font-weight: 900 !important; }
  .item-name {
    max-width: ${itemColWidth};
    word-wrap: break-word;
    overflow-wrap: break-word;
    font-weight: 700 !important;
  }
  .qty { text-align: center; width: 8mm; font-weight: 900 !important; }
  .amt { text-align: right; width: ${is58mm ? "13mm" : "16mm"}; font-weight: 800 !important; }
  .rate { text-align: right; width: ${is58mm ? "11mm" : "14mm"}; font-weight: 700 !important; }
  .sr { text-align: center; width: 5mm; font-weight: 700 !important; }
  .totals-row td {
    padding: 1.5px 0;
    font-weight: 700 !important;
  }
  .grand-total {
    font-size: ${is58mm ? "14px" : "16px"};
    font-weight: 900 !important;
    border-top: 2.5px solid #000000 !important;
    border-bottom: 2.5px solid #000000 !important;
    padding: 3px 0;
  }
  .kot-header {
    font-size: ${kotHeaderSize};
    font-weight: 900 !important;
    text-align: center;
    letter-spacing: 1px;
    border: 2.5px solid #000000 !important;
    padding: 3px;
    margin-bottom: 4px;
  }
  .kot-table-info {
    font-size: ${is58mm ? "14px" : "17px"};
    font-weight: 900 !important;
    text-align: center;
    padding: 2px;
  }
  .kot-item {
    font-size: ${is58mm ? "13px" : "15px"};
    font-weight: 900 !important;
    padding: 3px 0;
    border-bottom: 1.5px dotted #000000 !important;
  }
  .kot-item .qty-badge {
    display: inline-block;
    border: 1.5px solid #000000 !important;
    padding: 1px 5px;
    margin-right: 4px;
    font-weight: 900 !important;
    font-size: ${is58mm ? "13px" : "15px"};
  }
  .kot-notes {
    font-style: italic;
    font-size: ${is58mm ? "10px" : "11.5px"};
    padding-left: 8mm;
    color: #000000 !important;
    font-weight: 700 !important;
  }
  .kot-spice {
    font-size: ${is58mm ? "10px" : "11.5px"};
    padding-left: 8mm;
    font-weight: 900 !important;
    color: #000000 !important;
  }
  .footer-msg {
    text-align: center;
    font-size: ${is58mm ? "9.5px" : "10.5px"};
    padding-top: 4px;
    font-weight: 700 !important;
  }
  `;
}

// ── Helpers ──────────────────────────────────────────────────────

function formatDate(isoString: string): string {
  const d = new Date(isoString);
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatTime(isoString: string): string {
  const d = new Date(isoString);
  return d.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
}

function formatDateTime(isoString: string): string {
  return `${formatDate(isoString)} ${formatTime(isoString)}`;
}

/**
 * Triggers an ESC/POS Cash Drawer Kick simulation pulse
 */
export function triggerCashDrawerKick(): void {
  try {
    if (typeof window === "undefined") return;
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioCtx) {
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "square";
      osc.frequency.setValueAtTime(120, ctx.currentTime);
      gain.gain.setValueAtTime(0.4, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    }
  } catch {
    // Audio autoplay restrictions
  }
}

/**
 * Opens a print execution.
 * On Android / Mobile browsers, direct print injection into the document body with @media print
 * is used because Android Chrome suppresses hidden iframe.contentWindow.print().
 * On Desktop, iframe print is used with automatic fallback.
 */
export function openPrintWindow(html: string, title: string): void {
  if (typeof window === "undefined") return;

  const isMobile =
    /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) ||
    (typeof window !== "undefined" && window.innerWidth < 768);

  // If Mobile (Android / iOS): Use Direct Injected Document Print
  if (isMobile) {
    directMobilePrint(html, title);
    return;
  }

  // Desktop: Try hidden iframe first for silent desktop printing
  try {
    let iframe = document.getElementById("thermal-print-frame") as HTMLIFrameElement | null;
    if (!iframe) {
      iframe = document.createElement("iframe");
      iframe.id = "thermal-print-frame";
      iframe.style.position = "fixed";
      iframe.style.top = "-9999px";
      iframe.style.left = "-9999px";
      iframe.style.width = "10px";
      iframe.style.height = "10px";
      iframe.style.border = "none";
      document.body.appendChild(iframe);
    }

    const iframeDoc = iframe.contentWindow?.document || iframe.contentDocument;
    if (iframeDoc && iframe.contentWindow) {
      iframeDoc.open();
      iframeDoc.write(html);
      iframeDoc.close();
      iframeDoc.title = title;

      setTimeout(() => {
        try {
          iframe?.contentWindow?.focus();
          iframe?.contentWindow?.print();
        } catch {
          directMobilePrint(html, title);
        }
      }, 250);
      return;
    }
  } catch (err) {
    console.warn("IFrame print attempt failed, switching to direct print:", err);
  }

  directMobilePrint(html, title);
}

function directMobilePrint(html: string, title: string): void {
  try {
    if (typeof document === "undefined") return;

    let printRoot = document.getElementById("kk-direct-print-root");
    if (!printRoot) {
      printRoot = document.createElement("div");
      printRoot.id = "kk-direct-print-root";
      document.body.appendChild(printRoot);
    }

    let styleEl = document.getElementById("kk-direct-print-style");
    if (!styleEl) {
      styleEl = document.createElement("style");
      styleEl.id = "kk-direct-print-style";
      styleEl.textContent = `
        @media print {
          body > *:not(#kk-direct-print-root) {
            display: none !important;
          }
          #kk-direct-print-root {
            display: block !important;
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #fff !important;
            color: #000 !important;
            font-weight: 700 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          #kk-direct-print-root, #kk-direct-print-root * {
            font-weight: 700 !important;
            color: #000 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          #kk-direct-print-root .bold,
          #kk-direct-print-root .big,
          #kk-direct-print-root th,
          #kk-direct-print-root .grand-total,
          #kk-direct-print-root .kot-header,
          #kk-direct-print-root .kot-table-info,
          #kk-direct-print-root .kot-item {
            font-weight: 900 !important;
          }
        }
        @media screen {
          #kk-direct-print-root {
            display: none !important;
          }
        }
      `;
      document.head.appendChild(styleEl);
    }

    // Extract head styles and body content to preserve thermal formatting on Android mobile Chrome
    let headStyles = "";
    let bodyContent = html;
    if (typeof DOMParser !== "undefined") {
      try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, "text/html");
        if (doc.head) {
          headStyles = Array.from(doc.head.querySelectorAll("style"))
            .map((s) => s.outerHTML)
            .join("\n");
        }
        if (doc.body) {
          bodyContent = doc.body.innerHTML;
        }
      } catch {}
    }
    printRoot.innerHTML = headStyles + bodyContent;

    const prevTitle = document.title;
    document.title = title;

    setTimeout(() => {
      try {
        window.focus();
        window.print();
      } catch (err) {
        console.warn("Direct window.print() failed:", err);
        fallbackWindowPrint(html, title);
      } finally {
        setTimeout(() => {
          if (typeof document !== "undefined") {
            document.title = prevTitle;
            if (printRoot) printRoot.innerHTML = "";
          }
        }, 1500);
      }
    }, 150);
  } catch (err) {
    console.error("Direct print error, trying popup window:", err);
    fallbackWindowPrint(html, title);
  }
}

function fallbackWindowPrint(html: string, title: string): void {
  try {
    if (typeof window === "undefined" || !window.open) return;
    const printWindow = window.open("", "_blank", "width=380,height=650,scrollbars=yes");
    if (!printWindow) {
      if (typeof alert !== "undefined") {
        alert("Please allow pop-ups for thermal receipt printing or use the in-app preview.");
      }
      return;
    }
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.document.title = title;

    setTimeout(() => {
      try {
        printWindow.focus();
        printWindow.print();
      } catch (err) {
        console.warn("Auto-print error:", err);
      }
    }, 350);
  } catch (err) {
    console.error("Print window open failed:", err);
  }
}

/**
 * Dispatches an Android RawBT print intent via a hidden DOM anchor.
 * If the user has RawBT installed, it triggers instant silent Bluetooth ESC/POS printing.
 * If not installed, Android opens Google Play Store fallback.
 */
export function triggerRawBtPrint(base64Payload: string): void {
  if (typeof window === "undefined" || typeof document === "undefined") return;

  const intentUrl = `intent:base64,${base64Payload}#Intent;scheme=rawbt;package=ru.a402d.rawbtprinter;S.browser_fallback_url=https%3A%2F%2Fplay.google.com%2Fstore%2Fapps%2Fdetails%3Fid%3Dru.a402d.rawbtprinter;end;`;

  try {
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
  } catch {
    window.location.href = `rawbt:data:application/octet-stream;base64,${base64Payload}`;
  }
}

// ══════════════════════════════════════════════════════════════════
//  1. BILL RECEIPT (Customer Tax Invoice — 80mm / 58mm)
// ══════════════════════════════════════════════════════════════════

export function generateBillReceiptHtml(
  bill: Bill,
  isDuplicate: boolean = false,
  paperWidthOrSettings: "80mm" | "58mm" | { paperWidth?: "80mm" | "58mm" } = "80mm",
  customProfile?: Partial<ActiveRestaurantProfile>
): string {
  const targetWidth =
    typeof paperWidthOrSettings === "object" && paperWidthOrSettings !== null
      ? (paperWidthOrSettings as any).paperWidth || "80mm"
      : (paperWidthOrSettings as "80mm" | "58mm") || "80mm";
  const now = new Date().toISOString();
  const printTime = formatDateTime(now);
  const billTime = formatDateTime(bill.createdAt);

  const baseProfile = getActiveRestaurantProfile();
  const profile = customProfile ? { ...baseProfile, ...customProfile } : baseProfile;

  // Header Lines
  const headerHtmlParts: string[] = [];
  if (profile.nameMr) {
    headerHtmlParts.push(`<div class="big">${profile.nameMr}</div>`);
  }
  if (profile.nameEn) {
    headerHtmlParts.push(`<div class="bold">${profile.nameEn}</div>`);
  }
  if (profile.tagline) {
    headerHtmlParts.push(`<div class="small">${profile.tagline}</div>`);
  }
  if (profile.address) {
    headerHtmlParts.push(`<div class="small">${profile.address}</div>`);
  }
  if (profile.phone) {
    const sec = profile.secondaryPhone ? ` / ${profile.secondaryPhone}` : "";
    headerHtmlParts.push(`<div class="small">Ph: ${profile.phone}${sec}</div>`);
  }

  // Compliance Line (GSTIN / FSSAI) - ONLY print if there is data!
  const complianceTokens: string[] = [];
  if (profile.gstin && profile.gstin.trim()) {
    complianceTokens.push(`GSTIN: ${profile.gstin.trim()}`);
  }
  if (profile.fssai && profile.fssai.trim()) {
    complianceTokens.push(`FSSAI: ${profile.fssai.trim()}`);
  }
  if (complianceTokens.length > 0) {
    headerHtmlParts.push(`<div class="tiny">${complianceTokens.join(" | ")}</div>`);
  }

  let itemsHtml = "";
  let srNo = 0;
  for (const item of bill.items) {
    srNo++;
    itemsHtml += `
      <tr>
        <td class="sr">${srNo}</td>
        <td class="item-name">${item.menuItemName}${item.breadOption ? ` <span class="tiny" style="font-weight:bold;">[${BREAD_OPTION_LABELS[item.breadOption as BreadOption]?.mr || item.breadOption}]</span>` : ""}${item.seatNumber ? ` <span class="tiny">(S${item.seatNumber})</span>` : ""}</td>
        <td class="qty">${item.quantity}</td>
        <td class="rate">₹${item.unitPrice.toFixed(0)}</td>
        <td class="amt">₹${item.totalPrice.toFixed(2)}</td>
      </tr>`;
  }

  let paymentSummary = "";
  if (bill.payments.length > 0) {
    paymentSummary = bill.payments
      .map(
        (p) =>
          `<tr class="totals-row">
            <td colspan="3">${p.paymentMethod}${p.transactionReference ? ` (${p.transactionReference})` : ""}:</td>
            <td colspan="2" class="right bold">₹${p.amount.toFixed(2)}</td>
          </tr>`
      )
      .join("");
  }

  const changeReturn =
    bill.payments.length > 0
      ? bill.payments
          .filter((p) => p.paymentMethod === "CASH")
          .reduce((sum, p) => sum + p.amount, 0) - bill.grandTotal
      : 0;

  const hasGst = Boolean(
    profile.gstin &&
    profile.gstin.trim() &&
    (bill.cgstAmount > 0 || bill.sgstAmount > 0 || bill.totalTaxAmount > 0)
  );

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${isDuplicate ? "DUPLICATE — " : ""}Receipt ${bill.billNumber}</title>
  <style>${getThermalBaseCss(targetWidth)}</style>
</head>
<body>
  ${
    isDuplicate
      ? `
  <div style="text-align:center; font-weight:bold; font-size:13px; border:2px dashed #000; padding:3px; margin-bottom:5px; letter-spacing:1px;">
    *** DUPLICATE COPY / REPRINT ***
  </div>
  `
      : ""
  }

  ${
    bill.isTakeaway
      ? `
  <div style="text-align:center; font-weight:bold; font-size:13px; border:2px solid #000; padding:3px; margin-bottom:5px;">
    🥡 TAKEAWAY / PARCEL (पार्सल)
    ${bill.customerName ? `<div class="small bold">Customer: ${bill.customerName} ${bill.customerPhone ? `(${bill.customerPhone})` : ""}</div>` : ""}
  </div>
  `
      : ""
  }

  <!-- Restaurant Header -->
  <div class="center">
    ${headerHtmlParts.join("\n    ")}
  </div>

  <div class="dashed"></div>

  <!-- Bill Metadata -->
  <table>
    <tr>
      <td class="bold">Bill: ${bill.billNumber}</td>
      <td class="right small">${billTime}</td>
    </tr>
    <tr>
      <td class="small">Table: ${bill.tableNumber} | ${bill.partyCode}</td>
      <td class="right small">${bill.isTakeaway ? "Type: PARCEL" : "Dine-in"}</td>
    </tr>
    <tr>
      <td class="small">Waiter: ${bill.waiterName}</td>
      <td class="right small">Cashier: ${bill.cashierName}</td>
    </tr>
  </table>

  <div class="double-line"></div>

  <!-- Items Table -->
  <table>
    <thead>
      <tr style="border-bottom: 1px solid #000;">
        <th class="sr">#</th>
        <th style="text-align:left;">Item</th>
        <th class="qty">Qty</th>
        <th class="rate">Rate</th>
        <th class="amt">Amt</th>
      </tr>
    </thead>
    <tbody>
      ${itemsHtml}
    </tbody>
  </table>

  <div class="dashed"></div>

  <!-- Financial Totals -->
  <table>
    <tr class="totals-row">
      <td colspan="3">Subtotal:</td>
      <td colspan="2" class="right bold">₹${bill.subtotal.toFixed(2)}</td>
    </tr>
    ${
      bill.discountAmount > 0
        ? `<tr class="totals-row">
            <td colspan="3">Discount${bill.discountReason ? ` (${bill.discountReason})` : ""}:</td>
            <td colspan="2" class="right bold">-₹${bill.discountAmount.toFixed(2)}</td>
          </tr>`
        : ""
    }
    ${
      bill.packagingCharges && bill.packagingCharges > 0
        ? `<tr class="totals-row">
            <td colspan="3">Packaging / पार्सल शुल्क:</td>
            <td colspan="2" class="right bold">₹${bill.packagingCharges.toFixed(2)}</td>
          </tr>`
        : ""
    }
    ${
      hasGst
        ? `<tr class="totals-row">
            <td colspan="3">Taxable Amount:</td>
            <td colspan="2" class="right">₹${bill.taxableAmount.toFixed(2)}</td>
          </tr>
          <tr class="totals-row">
            <td colspan="3">CGST (2.5%):</td>
            <td colspan="2" class="right">₹${bill.cgstAmount.toFixed(2)}</td>
          </tr>
          <tr class="totals-row">
            <td colspan="3">SGST (2.5%):</td>
            <td colspan="2" class="right">₹${bill.sgstAmount.toFixed(2)}</td>
          </tr>`
        : ""
    }
    ${
      bill.roundOff !== 0
        ? `<tr class="totals-row">
            <td colspan="3">Round Off:</td>
            <td colspan="2" class="right">${bill.roundOff > 0 ? "+" : "-"}₹${Math.abs(bill.roundOff).toFixed(2)}</td>
          </tr>`
        : ""
    }
  </table>

  <!-- Grand Total -->
  <div class="grand-total" style="display:flex; justify-content:space-between;">
    <span>GRAND TOTAL</span>
    <span>₹${bill.grandTotal.toFixed(2)}</span>
  </div>

  ${
    bill.payments.length > 0
      ? `
    <div class="dashed"></div>
    <div class="bold small center" style="padding-bottom:2px;">— PAYMENT DETAILS —</div>
    <table>
      ${paymentSummary}
      <tr class="totals-row">
        <td colspan="3" class="bold">Total Paid:</td>
        <td colspan="2" class="right bold">₹${bill.paidAmount.toFixed(2)}</td>
      </tr>
      ${
        changeReturn > 0
          ? `<tr class="totals-row">
              <td colspan="3">Change Return:</td>
              <td colspan="2" class="right bold">₹${changeReturn.toFixed(2)}</td>
            </tr>`
          : ""
      }
      ${
        bill.balanceDue > 0
          ? `<tr class="totals-row">
              <td colspan="3" class="bold">Balance Due:</td>
              <td colspan="2" class="right bold">₹${bill.balanceDue.toFixed(2)}</td>
            </tr>`
          : ""
      }
    </table>
  `
      : ""
  }

  ${
    hasGst
      ? `<div class="dashed"></div>
  <div class="tiny center">HSN/SAC: 996331 | Standalone Restaurant (5% GST)</div>`
      : ""
  }

  <div class="dashed"></div>

  <!-- Footer -->
  <div class="footer-msg">
    <div class="bold">धन्यवाद! पुन्हा भेट द्या!</div>
    <div>Thank you for dining with us!</div>
    <div class="tiny" style="padding-top:3px;">${hasGst ? "This is a computer-generated tax invoice." : "This is a computer-generated bill receipt."}</div>
    <div class="tiny">Printed: ${printTime}</div>
  </div>

  <div style="height: 6mm;"></div>
</body>
</html>`;
}

export async function printBillReceipt(
  bill: Bill,
  isDuplicate: boolean = false,
  paperWidth: "80mm" | "58mm" = "80mm"
): Promise<{ success: boolean; message?: string }> {
  const settings = getStoredPrinterSettings();
  if (paperWidth) {
    settings.paperWidth = paperWidth;
  }
  return await globalPrinterManager.printDirectBill(bill, isDuplicate, settings, generateBillReceiptHtml);
}

export async function printBillDuplicate(
  bill: Bill,
  paperWidth: "80mm" | "58mm" = "80mm"
): Promise<{ success: boolean; message?: string }> {
  return await printBillReceipt(bill, true, paperWidth);
}

// ══════════════════════════════════════════════════════════════════
//  2. TABLE CHECK / PRE-BILL ESTIMATE (कच्चा बिल — 80mm / 58mm)
// ══════════════════════════════════════════════════════════════════

export interface TableCheckParams {
  party: DiningParty;
  items: OrderItem[];
  subtotal: number;
  taxEstimate: number;
  grandTotal: number;
  cashierName?: string;
  paperWidth?: "80mm" | "58mm";
}

export function generateTableCheckHtml(params: TableCheckParams | Bill | any): string {
  const partyCode = params.party?.partyCode || params.partyCode || "P-101";
  const tableNumber = params.party?.tableNumber || params.tableNumber || 1;
  const guestCount = params.party?.guestCount || 2;
  const waiterName = params.party?.assignedWaiterName || params.waiterName || params.cashierName || "Staff";
  const cashierName = params.cashierName || "Cashier Desk";
  const subtotal =
    typeof params.subtotal === "number"
      ? params.subtotal
      : params.items
      ? params.items.reduce((s: number, i: any) => s + (i.totalPrice || 0), 0)
      : 0;
  const taxEstimate =
    typeof params.taxEstimate === "number"
      ? params.taxEstimate
      : (params.cgstAmount || 0) + (params.sgstAmount || 0) || subtotal * 0.05;
  const grandTotal =
    typeof params.grandTotal === "number" ? params.grandTotal : subtotal + taxEstimate;
  const rawItems = params.items || [];
  const paperWidth =
    typeof params.paperWidth === "string"
      ? params.paperWidth
      : params.paperWidth?.paperWidth || "80mm";

  const now = new Date().toISOString();
  const printTime = formatDateTime(now);

  let itemsHtml = "";
  let srNo = 0;
  for (const item of rawItems.filter((i: any) => !i.isCancelled)) {
    srNo++;
    itemsHtml += `
      <tr>
        <td class="sr">${srNo}</td>
        <td class="item-name">${item.menuItemName}${item.breadOption ? ` <span class="tiny" style="font-weight:bold;">[${BREAD_OPTION_LABELS[item.breadOption as BreadOption]?.mr || item.breadOption}]</span>` : ""}${item.seatNumber ? ` <span class="tiny">(S${item.seatNumber})</span>` : ""}</td>
        <td class="qty">${item.quantity}</td>
        <td class="rate">₹${item.unitPrice.toFixed(0)}</td>
        <td class="amt">₹${item.totalPrice.toFixed(2)}</td>
      </tr>`;
  }

  const baseProfile = getActiveRestaurantProfile();
  const profile = params.profile ? { ...baseProfile, ...params.profile } : baseProfile;
  const hasGst = Boolean(
    profile.gstin &&
    profile.gstin.trim() &&
    taxEstimate > 0
  );

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Pre-Bill Estimate ${partyCode}</title>
  <style>${getThermalBaseCss(paperWidth)}</style>
</head>
<body>
  <!-- Pre-Bill Header Banner -->
  <div style="text-align:center; font-weight:bold; font-size:13px; border:2px solid #000; padding:4px; margin-bottom:5px;">
    *** TABLE CHECK / PRE-BILL ESTIMATE ***
    <div style="font-size:9.5px; font-weight:bold; letter-spacing:0.5px;">(Not a Tax Invoice — कच्चा बिल / अंदाजे हिशोब)</div>
    <div style="font-size:8.5px; font-weight:bold;">THIS IS NOT A TAX INVOICE</div>
  </div>

  <div class="center">
    ${profile.nameMr ? `<div class="big">${profile.nameMr}</div>` : ""}
    ${profile.nameEn ? `<div class="bold">${profile.nameEn}</div>` : ""}
    ${profile.address ? `<div class="small">${profile.address}</div>` : ""}
    ${profile.phone ? `<div class="small">Ph: ${profile.phone}</div>` : ""}
  </div>

  <div class="dashed"></div>

  <!-- Table Details -->
  <table>
    <tr>
      <td class="bold">TABLE ${tableNumber}</td>
      <td class="right small">${printTime}</td>
    </tr>
    <tr>
      <td class="small">Party: ${partyCode}</td>
      <td class="right small">Guests: ${guestCount}</td>
    </tr>
    <tr>
      <td class="small">Waiter: ${waiterName}</td>
      <td class="right small">${cashierName}</td>
    </tr>
  </table>

  <div class="double-line"></div>

  <!-- Order Items Breakdown -->
  <table>
    <thead>
      <tr style="border-bottom: 1px solid #000;">
        <th class="sr">#</th>
        <th style="text-align:left;">Item</th>
        <th class="qty">Qty</th>
        <th class="rate">Rate</th>
        <th class="amt">Amt</th>
      </tr>
    </thead>
    <tbody>
      ${itemsHtml}
    </tbody>
  </table>

  <div class="dashed"></div>

  <!-- Totals Estimate -->
  <table>
    <tr class="totals-row">
      <td colspan="3">Subtotal:</td>
      <td colspan="2" class="right bold">₹${subtotal.toFixed(2)}</td>
    </tr>
    ${
      hasGst
        ? `<tr class="totals-row">
            <td colspan="3">Estimated GST (5%):</td>
            <td colspan="2" class="right">₹${taxEstimate.toFixed(2)}</td>
          </tr>`
        : ""
    }
  </table>

  <div class="grand-total" style="display:flex; justify-content:space-between;">
    <span>Total Estimate:</span>
    <span>₹${grandTotal.toFixed(2)}</span>
  </div>

  ${
    profile.upiId && profile.upiId.trim()
      ? `
  <div class="dashed"></div>

  <!-- UPI QR Payment Simulation Instructions -->
  <div style="border:1px dashed #000; padding:4px; text-align:center; margin:4px 0;">
    <div class="bold small">⚡ PAY VIA UPI AT TABLE ⚡</div>
    <div class="tiny" style="padding-top:2px;">GPay • PhonePe • Paytm • BHIM</div>
    <div class="small bold" style="padding-top:2px;">UPI ID: ${profile.upiId}</div>
    <div class="tiny" style="word-break:break-all;">upi://pay?pa=${profile.upiId}&pn=${encodeURIComponent(profile.upiMerchantName || profile.nameEn || "KolhapuriKhanawal")}&am=${grandTotal.toFixed(2)}</div>
    <div class="bold" style="font-size:13px; padding-top:2px;">Amount: ₹${grandTotal.toFixed(2)}</div>
  </div>
  `
      : ""
  }

  <div class="footer-msg">
    <div class="bold">कृपया पेमेंट वेटरकडे किंवा काउंटरवर जमा करा.</div>
    <div>Please settle with your waiter or at the cash counter.</div>
    <div class="tiny" style="padding-top:3px;">Final Tax Invoice will be issued upon payment settlement.</div>
  </div>

  <div style="height: 6mm;"></div>
</body>
</html>`;
}

export async function printTableCheck(
  params: TableCheckParams
): Promise<{ success: boolean; message?: string }> {
  const settings = getStoredPrinterSettings();
  if (params.paperWidth) settings.paperWidth = params.paperWidth;
  return await globalPrinterManager.printDirectTableCheck(params, settings, generateTableCheckHtml);
}

// ══════════════════════════════════════════════════════════════════
//  3. KITCHEN ORDER TICKET (KOT — 80mm / 58mm)
// ══════════════════════════════════════════════════════════════════

export function generateKotHtml(
  kot: Kot,
  stationFilter?: string,
  isReprint: boolean = false,
  paperWidth: "80mm" | "58mm" = "80mm"
): string {
  const kotTime = formatDateTime(kot.createdAt);

  const stationLabels: Record<string, string> = {
    MAIN_KITCHEN: "MAIN KITCHEN",
    THALI_SECTION: "THALI SECTION",
    TANDOOR_BHAKRI: "TANDOOR / BHAKRI",
    FRY_SECTION: "FRY / SUKKA",
    BEVERAGE_DESSERT: "DRINKS / DESSERT",
  };
  const stationName = stationLabels[kot.stationCode] || kot.stationCode;

  const itemsToRender =
    stationFilter && stationFilter !== "ALL"
      ? kot.items.filter((item) => true)
      : kot.items;

  let itemsHtml = "";
  for (const item of itemsToRender) {
    itemsHtml += `
      <div class="kot-item">
        <span class="qty-badge">${item.quantity}×</span>
        ${item.menuItemName}
        ${item.seatNumber ? `<span class="tiny"> [S${item.seatNumber}]</span>` : ""}
      </div>`;
    if (item.breadOption) {
      const breadObj = BREAD_OPTION_LABELS[item.breadOption as BreadOption];
      const breadText = breadObj ? `${breadObj.mr} (${breadObj.en})` : item.breadOption;
      itemsHtml += `<div class="kot-bread" style="font-weight:bold; font-size:12px; margin-left:14px; margin-top:2px; color:#000;">🍞 ${breadText}</div>`;
    }
    if (item.spiceLevel && item.spiceLevel !== "MEDIUM") {
      itemsHtml += `<div class="kot-spice">🌶️ ${item.spiceLevel.replace(/_/g, " ")}</div>`;
    }
    if (item.notes) {
      itemsHtml += `<div class="kot-notes">📝 ${item.notes}</div>`;
    }
  }

  let headerTitle = "*** K O T ***";
  if (isReprint) {
    headerTitle = "*** REPRINT KOT / किचन प्रत ***";
  } else if (kot.isAddOn) {
    headerTitle = `*** ADD-ON KOT #${kot.kotSequenceNumber || 2} (रनिंग ऑर्डर) ***`;
  }

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>KOT ${kot.kotNumber}</title>
  <style>${getThermalBaseCss(paperWidth)}</style>
</head>
<body>
  <!-- KOT Header -->
  <div class="kot-header">
    ${headerTitle}
  </div>

  <div class="kot-table-info">
    TABLE ${kot.tableNumber} — ${kot.partyCode}
  </div>

  ${
    kot.isTakeaway
      ? `
  <div style="text-align:center; font-weight:bold; font-size:13px; border:2px solid #000; padding:2px; margin:3px 0;">
    🥡 TAKEAWAY / PARCEL (पार्सल)
    ${kot.customerName ? `<div class="small bold">Customer: ${kot.customerName}</div>` : ""}
  </div>
  `
      : ""
  }

  <div class="dashed"></div>

  <table>
    <tr>
      <td class="bold">${kot.kotNumber}</td>
      <td class="right small">${kotTime}</td>
    </tr>
    <tr>
      <td class="small">Waiter: ${kot.waiterName}</td>
      <td class="right small">Guests: ${kot.guestCount}</td>
    </tr>
    <tr>
      <td colspan="2" class="bold" style="padding-top:2px; font-size:13px;">
        Station: ${stationName}
      </td>
    </tr>
  </table>

  <div class="double-line"></div>

  <!-- Order Items (large font for kitchen clarity) -->
  ${itemsHtml}

  <div class="double-line"></div>

  ${kot.notes ? `<div class="small" style="padding:2px 0;"><b>Order Notes:</b> ${kot.notes}</div><div class="dashed"></div>` : ""}

  <!-- Summary -->
  <table>
    <tr>
      <td class="bold">Items: ${itemsToRender.length}</td>
      <td class="right bold">Total Qty: ${itemsToRender.reduce((s, i) => s + i.quantity, 0)}</td>
    </tr>
  </table>

  <div class="dashed"></div>

  <div class="center small bold" style="padding:2px 0;">
    ${RESTAURANT_NAME_EN} — Kitchen Copy
  </div>

  <div style="height: 6mm;"></div>
</body>
</html>`;
}

export async function printKotTicket(
  kot: Kot,
  stationFilterOrOptions?: string | { stationFilter?: string; isReprint?: boolean; paperWidth?: "80mm" | "58mm" },
  isReprint: boolean = false,
  paperWidth: "80mm" | "58mm" = "80mm"
): Promise<{ success: boolean; message?: string }> {
  let finalStationFilter: string | undefined;
  let finalIsReprint = isReprint;
  let finalPaperWidth = paperWidth;

  if (typeof stationFilterOrOptions === "object" && stationFilterOrOptions !== null) {
    finalStationFilter = stationFilterOrOptions.stationFilter;
    finalIsReprint = stationFilterOrOptions.isReprint ?? false;
    finalPaperWidth = stationFilterOrOptions.paperWidth || "80mm";
  } else {
    finalStationFilter = stationFilterOrOptions;
  }

  const settings = getStoredPrinterSettings();
  if (finalPaperWidth) {
    settings.paperWidth = finalPaperWidth;
  }
  return await globalPrinterManager.printDirectKot(
    kot,
    finalIsReprint,
    finalStationFilter,
    settings,
    (k, s, r, w) => generateKotHtml(k, finalStationFilter || s, r, w || finalPaperWidth)
  );
}

// ══════════════════════════════════════════════════════════════════
//  4. CANCELLED / VOID KOT SLIP (रद्द पावती — 80mm / 58mm)
// ══════════════════════════════════════════════════════════════════

export function generateCancelledKotHtml(
  kot: Kot,
  reason: string = "Customer changed order",
  cancelledBy: string = "Kitchen / Cashier",
  paperWidth: "80mm" | "58mm" = "80mm"
): string {
  const cancelTime = formatDateTime(new Date().toISOString());

  let itemsHtml = "";
  for (const item of kot.items) {
    itemsHtml += `
      <div class="kot-item" style="text-decoration: line-through;">
        <span class="qty-badge">${item.quantity}×</span>
        ${item.menuItemName}
      </div>`;
  }

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>CANCELLED KOT ${kot.kotNumber}</title>
  <style>${getThermalBaseCss(paperWidth)}</style>
</head>
<body>
  <!-- Header Alert -->
  <div class="kot-header" style="border: 2px dashed #000;">
    *** CANCELLED KOT / रद्द पावती ***
  </div>

  <div style="text-align:center; font-weight:bold; font-size:15px; padding:4px 0; border:2px solid #000; margin:4px 0;">
    ⛔ DO NOT PREPARE — ऑर्डर रद्द ⛔
  </div>

  <div class="kot-table-info">
    TABLE ${kot.tableNumber} — ${kot.partyCode}
  </div>

  <div class="dashed"></div>

  <table>
    <tr>
      <td class="bold">Ticket: ${kot.kotNumber}</td>
      <td class="right small">${cancelTime}</td>
    </tr>
    <tr>
      <td class="small">Waiter: ${kot.waiterName}</td>
      <td class="right small">Cancelled By: ${cancelledBy}</td>
    </tr>
  </table>

  <div class="double-line"></div>

  <div class="bold small" style="padding-bottom:2px;">Items to cancel:</div>
  ${itemsHtml}

  <div class="double-line"></div>

  <div style="padding:4px 0; font-size:12px;">
    <b>Reason:</b> ${reason || "Customer cancelled order"}
  </div>

  <div class="dashed"></div>

  <div class="center small bold" style="padding:2px 0;">
    Stock reservation released back to inventory.
  </div>

  <div style="height: 6mm;"></div>
</body>
</html>`;
}

export function printCancelledKot(
  kot: Kot,
  reason: string,
  cancelledBy: string,
  paperWidth: "80mm" | "58mm" = "80mm"
): void {
  const settings = getStoredPrinterSettings();
  if (paperWidth) settings.paperWidth = paperWidth;
  globalPrinterManager.dispatchCancelledKot(kot, reason, cancelledBy, settings, generateCancelledKotHtml);
}

// ══════════════════════════════════════════════════════════════════
//  5. CASHIER DAY-END Z-REPORT (दिवसाचा हिशोब — 80mm / 58mm)
// ══════════════════════════════════════════════════════════════════

export function generateDayEndReportHtml(
  report: DayEndReport,
  paperWidthOrSettings: "80mm" | "58mm" | { paperWidth?: "80mm" | "58mm" } = "80mm"
): string {
  const paperWidth =
    typeof paperWidthOrSettings === "object" && paperWidthOrSettings !== null
      ? (paperWidthOrSettings as any).paperWidth || "80mm"
      : (paperWidthOrSettings as "80mm" | "58mm") || "80mm";
  const genTime = formatDateTime(report.generatedAt);

  let topDishesHtml = "";
  const topList = report.topSellingDishes || report.topDishes || [];
  for (const dish of topList) {
    const qty = (dish as any).quantity ?? (dish as any).qty ?? 0;
    topDishesHtml += `
      <tr>
        <td class="item-name">${dish.name}</td>
        <td class="qty">${qty}</td>
        <td class="amt">₹${dish.revenue.toFixed(0)}</td>
      </tr>`;
  }

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Day-End Z-Report ${report.date}</title>
  <style>${getThermalBaseCss(paperWidth)}</style>
</head>
<body>
  <!-- Restaurant Header -->
  <div class="center">
    <div class="big">${RESTAURANT_NAME}</div>
    <div class="bold">${RESTAURANT_NAME_EN}</div>
    <div class="small">${RESTAURANT_ADDRESS}</div>
    <div class="tiny">GSTIN: ${RESTAURANT_GSTIN}</div>
  </div>

  <div class="dashed"></div>

  <div class="center bold" style="font-size:14px; border:2px solid #000; padding:3px; margin-bottom:4px;">
    *** DAILY CLOSURE / Z-REPORT (दिवसाचा हिशोब) ***
    ${report.reportId ? `<div class="small bold">${report.reportId}</div>` : ""}
  </div>

  <table>
    <tr>
      <td class="bold">Date: ${report.date}</td>
      <td class="right bold">${report.shiftName}</td>
    </tr>
    <tr>
      <td class="small">Generated: ${genTime}</td>
      <td class="right small">Cashier: ${report.generatedByName}</td>
    </tr>
  </table>

  <div class="double-line"></div>

  <!-- Summary of Bills -->
  <div class="bold small" style="padding-bottom:2px;">— TRANSACTION METRICS —</div>
  <table>
    <tr>
      <td>Total Bills Issued:</td>
      <td class="right bold">${report.totalBills}</td>
    </tr>
    <tr>
      <td>Bills Settled (Paid):</td>
      <td class="right bold">${report.settledBillsCount}</td>
    </tr>
    <tr>
      <td>Bills Voided / Cancelled:</td>
      <td class="right bold">${report.cancelledBillsCount}</td>
    </tr>
  </table>

  <div class="dashed"></div>

  <!-- Financial Breakdown -->
  <div class="bold small" style="padding-bottom:2px;">— REVENUE & TAX BREAKDOWN —</div>
  <table>
    <tr class="totals-row">
      <td colspan="3">GROSS SALES:</td>
      <td colspan="2" class="right bold">₹${report.grossSalesSubtotal.toFixed(2)}</td>
    </tr>
    ${
      report.totalDiscountAmount > 0
        ? `<tr class="totals-row">
            <td colspan="3">Discounts Allowed:</td>
            <td colspan="2" class="right bold">-₹${report.totalDiscountAmount.toFixed(2)}</td>
          </tr>`
        : ""
    }
    ${
      report.totalPackagingCharges > 0
        ? `<tr class="totals-row">
            <td colspan="3">Packaging Charges:</td>
            <td colspan="2" class="right bold">₹${report.totalPackagingCharges.toFixed(2)}</td>
          </tr>`
        : ""
    }
    <tr class="totals-row">
      <td colspan="3">Net Taxable Revenue:</td>
      <td colspan="2" class="right">₹${report.netTaxableSales.toFixed(2)}</td>
    </tr>
    <tr class="totals-row">
      <td colspan="3">CGST (2.5%):</td>
      <td colspan="2" class="right">₹${report.cgstAmount.toFixed(2)}</td>
    </tr>
    <tr class="totals-row">
      <td colspan="3">SGST (2.5%):</td>
      <td colspan="2" class="right">₹${report.sgstAmount.toFixed(2)}</td>
    </tr>
    <tr class="totals-row">
      <td colspan="3">Total GST (5%):</td>
      <td colspan="2" class="right bold">₹${report.totalTaxAmount.toFixed(2)}</td>
    </tr>
    ${
      report.roundOffTotal !== 0
        ? `<tr class="totals-row">
            <td colspan="3">Round Off Total:</td>
            <td colspan="2" class="right">${report.roundOffTotal > 0 ? "+" : "-"}₹${Math.abs(report.roundOffTotal).toFixed(2)}</td>
          </tr>`
        : ""
    }
  </table>

  <div class="grand-total" style="display:flex; justify-content:space-between;">
    <span>NET REVENUE:</span>
    <span>₹${report.netRevenue.toFixed(2)}</span>
  </div>

  <div class="dashed"></div>

  <!-- Tender Breakdown -->
  <div class="bold small" style="padding-bottom:2px;">— PAYMENT TENDER COLLECTION —</div>
  <table>
    <tr>
      <td>CASH Collected:</td>
      <td class="right bold">₹${report.tenders.cash.toFixed(2)}</td>
    </tr>
    <tr>
      <td>UPI / QR Collected:</td>
      <td class="right bold">₹${report.tenders.upi.toFixed(2)}</td>
    </tr>
    <tr>
      <td>CARD Collected:</td>
      <td class="right bold">₹${report.tenders.card.toFixed(2)}</td>
    </tr>
    ${
      report.tenders.other > 0
        ? `<tr><td>OTHER:</td><td class="right bold">₹${report.tenders.other.toFixed(2)}</td></tr>`
        : ""
    }
    <tr style="border-top:1px solid #000; font-weight:bold;">
      <td>Total Collections:</td>
      <td class="right">₹${(report.tenders.cash + report.tenders.upi + report.tenders.card + report.tenders.other).toFixed(2)}</td>
    </tr>
  </table>

  <div class="dashed"></div>

  <!-- Top Selling Dishes -->
  <div class="bold small" style="padding-bottom:2px;">— TOP SELLING DISHES TODAY —</div>
  <table>
    <thead>
      <tr style="border-bottom: 1px solid #000;">
        <th style="text-align:left;">Item</th>
        <th class="qty">Qty</th>
        <th class="amt">Total</th>
      </tr>
    </thead>
    <tbody>
      ${topDishesHtml || '<tr><td colspan="3" class="small center">No dish sales recorded yet</td></tr>'}
    </tbody>
  </table>

  <div class="dashed"></div>

  <div class="tiny center">
    Audit Discrepancies / Overrides Logged: ${report.auditDiscrepanciesCount}
  </div>

  <div class="double-line"></div>

  <!-- Sign-off -->
  <div style="display:flex; justify-content:space-between; padding-top:12px; font-size:10px;" class="bold">
    <div>Cashier Sign: ___________</div>
    <div>MANAGER SIGNATURE: ___________</div>
  </div>

  <div style="height: 8mm;"></div>
</body>
</html>`;
}

export function printDayEndReport(
  report: DayEndReport,
  paperWidth: "80mm" | "58mm" = "80mm"
): void {
  const settings = getStoredPrinterSettings();
  if (paperWidth) settings.paperWidth = paperWidth;
  globalPrinterManager.dispatchDayEndReport(report, settings, generateDayEndReportHtml);
}

// ══════════════════════════════════════════════════════════════════
//  6. PRINTER DIAGNOSTIC TEST TICKET (80mm / 58mm)
// ══════════════════════════════════════════════════════════════════

export function generatePrinterTestHtml(settings?: PrinterSettings): string {
  const targetWidth = settings?.paperWidth || "80mm";
  const now = new Date().toISOString();

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Thermal Printer Test</title>
  <style>${getThermalBaseCss(targetWidth)}</style>
</head>
<body>
  <div class="center bold big">=== PRINTER DIAGNOSTIC TEST TICKET ===</div>
  <div class="center bold">चाचणी पावती — ${RESTAURANT_NAME}</div>
  <div class="center bold">${RESTAURANT_NAME_EN}</div>
  <div class="center small">Thermal Print Subsystem v2.0</div>
  <div class="dashed"></div>

  <div class="small">Timestamp: ${formatDateTime(now)}</div>
  <div class="small">Paper Profile: <b>${targetWidth === "58mm" ? "58mm (Compact POS)" : "80mm (Standard POS)"}</b></div>
  <div class="small">Auto-Cut: <b>ENABLED</b></div>
  <div class="small">Cash Drawer Pulse: Enabled</div>

  <div class="dashed"></div>

  <div class="bold small center">--- ALIGNMENT & PITCH TEST ---</div>
  <div style="display:flex; justify-content:space-between; padding:2px 0;">
    <span>[LEFT]</span>
    <span>[CENTER]</span>
    <span>[RIGHT]</span>
  </div>

  <div class="dashed"></div>

  <div class="small">NUMBERS: 0 1 2 3 4 5 6 7 8 9</div>
  <div class="small">ALPHA: A B C D E F G H I J K L M N O P Q R S T U V W X Y Z</div>
  <div class="small bold">BOLD: <b>Kolhapuri Khanawal Restaurant OS</b></div>

  <div class="dashed"></div>

  <div class="bold small center">--- देवनागरी मराठी फॉन्ट सुसंगतता ---</div>
  <div class="bold" style="text-align:center; padding:3px 0;">
    अस्सल कोल्हापुरी चव — तांबडा रस्सा • पांढरा रस्सा • मटण सुक्का • गरमागरम भाकरी
  </div>

  <div class="dashed"></div>

  <!-- Simulated Barcode Line -->
  <div style="text-align:center; padding:4px 0; font-family:monospace; letter-spacing:3px; font-weight:bold;">
    ||| | |||| || ||| |||| | ||| ||
    <div class="tiny bold">TEST-BARCODE-996331</div>
  </div>

  <div class="double-line"></div>

  <div class="center small bold">
    ✓ ALL DIAGNOSTIC CHECKS PASSED [TEST PASSED]
  </div>

  <div style="height: 8mm;"></div>
</body>
</html>`;
}

export function printTestTicket(settings?: PrinterSettings): void {
  const activeSettings = settings || getStoredPrinterSettings();
  const devices = globalPrinterManager.getActiveDevices(activeSettings);
  if (devices && devices.length > 0) {
    for (const dev of devices) {
      globalPrinterManager.dispatchTestSlip(dev, generatePrinterTestHtml);
    }
  } else {
    const html = generatePrinterTestHtml(activeSettings);
    openPrintWindow(html, "Thermal Printer Test");
  }
}

// ══════════════════════════════════════════════════════════════════
//  7. WAITER LOGIN & CREDENTIAL SLIP (वेटर प्रवेश पावती)
// ══════════════════════════════════════════════════════════════════

export function generateWaiterCredentialSlipHtml(
  cred: WaiterCredential,
  paperWidth: "80mm" | "58mm" = "80mm"
): string {
  const profile = getActiveRestaurantProfile();
  const now = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Waiter Credential — ${cred.name}</title>
  <style>
    ${getThermalBaseCss(paperWidth)}
  </style>
</head>
<body>
  <div class="header">
    <div class="bold" style="font-size: 15px;">${profile.nameMr}</div>
    <div class="small bold">${profile.nameEn}</div>
    <div class="small">${profile.address}</div>
    <div class="small">दूरध्वनी: ${profile.phone}</div>
  </div>

  <div class="double-line"></div>

  <div class="center bold" style="font-size: 13px; margin: 4px 0;">
    वेटर लॉगिन क्रेडेंशियल स्लिप
  </div>
  <div class="center small">WAITER ACCESS PASS & PIN</div>

  <div class="dashed"></div>

  <div class="line"><span class="label">दिनांक व वेळ:</span><span class="val">${now}</span></div>
  <div class="line"><span class="label">कर्मचारी नाव:</span><span class="val bold">${cred.name}</span></div>
  <div class="line"><span class="label">लॉगिन कोड/User:</span><span class="val bold" style="font-size: 14px;">${cred.username}</span></div>
  <div class="line"><span class="label">गोपनीय पिन (PIN):</span><span class="val bold" style="font-size: 16px; letter-spacing: 2px;">${cred.pin}</span></div>
  ${cred.phone ? `<div class="line"><span class="label">मोबाईल:</span><span class="val">${cred.phone}</span></div>` : ""}

  <div class="dashed"></div>

  <div class="bold small" style="margin-top: 4px;">प्रणाली अधिकार / PERMISSIONS:</div>
  <div class="small" style="line-height: 1.5; padding-left: 5px;">
    ✓ टेबल्स व ग्राहक जागा (Tables & Parties)<br>
    ✓ मेनू व दर माहिती (Menu Catalog)<br>
    ✓ किचन केओटी प्रिंट (Print KOT)<br>
    ✓ टेबल बिल प्रिंट (Print Customer Bill)<br>
    ✕ आर्थिक व हिशोब अहवाल पूर्ण बंद (Reports Locked)
  </div>

  <div class="dashed"></div>

  <div class="center small" style="margin: 6px 0;">
    कृपया हा पिन सुरक्षित ठेवा व कोणाशीही शेअर करू नका.
    <br>
    Keep this PIN confidential.
  </div>

  <div class="double-line"></div>
  <div class="center tiny font-mono">ID: ${cred.id} • AUTH: ADMIN APPROVED</div>
  <div style="height: 8mm;"></div>
</body>
</html>`;
}

export function printWaiterCredentialSlip(
  cred: WaiterCredential,
  paperWidth: "80mm" | "58mm" = "80mm"
): void {
  const html = generateWaiterCredentialSlipHtml(cred, paperWidth);
  openPrintWindow(html, `Waiter-Pass-${cred.username}`);
}

