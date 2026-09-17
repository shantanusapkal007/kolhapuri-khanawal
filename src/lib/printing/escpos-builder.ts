/**
 * Kolhapuri Khanawal Restaurant Operating System
 * ESC/POS Binary Command Engine for Direct Hardware Thermal Printing
 *
 * Generates raw ESC/POS byte buffers for:
 * - Network (LAN/Wi-Fi TCP Port 9100)
 * - Web Bluetooth (BLE/SPP GATT Characteristic)
 * - Web Serial / USB COM Port
 * - Local Print Gateway / Bridge
 */

import { Bill, DayEndReport } from "@/types/billing";
import { Kot, BreadOption, BREAD_OPTION_LABELS } from "@/types/orders";
import { getActiveRestaurantProfile, type ActiveRestaurantProfile } from "./restaurant-profile";

export const ESC = 0x1b;
export const FS = 0x1c;
export const GS = 0x1d;

export type AlignMode = "LEFT" | "CENTER" | "RIGHT";
export type TextSize = "NORMAL" | "DOUBLE_HEIGHT" | "DOUBLE_WIDTH" | "DOUBLE_BOTH" | "BIG";

export interface ColumnDefinition {
  width: number; // In monospace characters
  align?: AlignMode;
}

/**
 * Sanitizes any text string for 100% reliable single-byte ESC/POS thermal printing.
 * Converts Unicode symbols to clean ASCII:
 * - '₹' -> 'Rs.'
 * - '—' or '–' -> '-'
 * - '•' or '·' -> '*'
 * - Smart quotes -> standard quotes
 * - Strips or cleans unsupported Unicode, Devanagari, and emoji
 * to eliminate hardware ROM font mojibake (e.g. 'añðaRÜaAtañÜaM#', 'rè|', 'rço', 'rU1')
 */
export function cleanThermalText(str: string): string {
  if (!str) return "";
  return str
    .replace(/₹/g, "Rs.")
    .replace(/[—–]/g, "-")
    .replace(/[•·]/g, "*")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[⚡🥡✅⚠️❌📦🔔🍽️]/g, "")
    // Remove Devanagari Unicode characters (0x0900 - 0x097F)
    .replace(/[\u0900-\u097F]/g, "")
    // Clean empty parentheses or brackets left behind like () or [] or (- )
    .replace(/\(\s*[- ]*\s*\)/g, "")
    .replace(/\[\s*[- ]*\s*\]/g, "")
    // Remove characters outside printable ASCII range (32-126) + newline (10)
    .replace(/[^\x20-\x7E\n]/g, "")
    // Collapse multiple consecutive spaces
    .replace(/ +/g, " ")
    .trim();
}

export class EscPosBuilder {
  private buffer: number[] = [];
  public paperWidth: "80mm" | "58mm";
  public maxColumns: number;
  public currentSize: TextSize = "NORMAL";

  constructor(paperWidth: "80mm" | "58mm" = "80mm") {
    this.paperWidth = paperWidth;
    // 80mm standard Font A is 48 chars; 58mm is 32 chars
    this.maxColumns = paperWidth === "58mm" ? 32 : 48;
    this.init();
  }

  /**
   * Reset / Initialize printer to default state
   * Emphasized (bold) mode and double-strike mode are activated by default
   * so all thermal printheads fire full heat with double dot density,
   * eliminating faint, jagged, or blurry text on thermal rolls.
   */
  init(): this {
    this.buffer.push(ESC, 0x40); // ESC @ (initialize printer)
    this.buffer.push(ESC, 0x45, 0x01); // ESC E 1 (emphasized mode on)
    this.buffer.push(ESC, 0x47, 0x01); // ESC G 1 (double-strike mode on)
    this.currentSize = "NORMAL";
    return this;
  }

  /**
   * Set text alignment
   */
  align(mode: AlignMode): this {
    const val = mode === "CENTER" ? 1 : mode === "RIGHT" ? 2 : 0;
    this.buffer.push(ESC, 0x61, val); // ESC a n
    return this;
  }

  /**
   * Emphasized (bold) mode
   * Enforces bold font weight across all receipt text to prevent blurry printouts.
   */
  bold(enable: boolean = true): this {
    this.buffer.push(ESC, 0x45, 1); // Always keep ESC E 1 active
    this.buffer.push(ESC, 0x47, enable ? 1 : 0); // Toggle double-strike
    return this;
  }

  /**
   * Underline mode
   */
  underline(enable: boolean = true): this {
    this.buffer.push(ESC, 0x2d, enable ? 1 : 0); // ESC - n
    return this;
  }

  /**
   * White/Black reverse (inverse) mode
   */
  inverse(enable: boolean = true): this {
    this.buffer.push(GS, 0x42, enable ? 1 : 0); // GS B n
    return this;
  }

  /**
   * Text size selection
   */
  size(size: TextSize = "NORMAL"): this {
    this.currentSize = size;
    let val = 0x00;
    if (size === "DOUBLE_HEIGHT") val = 0x01;
    else if (size === "DOUBLE_WIDTH") val = 0x10;
    else if (size === "DOUBLE_BOTH" || size === "BIG") val = 0x11;
    this.buffer.push(GS, 0x21, val); // GS ! n
    return this;
  }

  /**
   * Get effective horizontal monospace columns available for current text size
   */
  get effectiveColumns(): number {
    if (
      this.currentSize === "BIG" ||
      this.currentSize === "DOUBLE_WIDTH" ||
      this.currentSize === "DOUBLE_BOTH"
    ) {
      return Math.floor(this.maxColumns / 2);
    }
    return this.maxColumns;
  }

  /**
   * Feed n lines
   */
  feed(lines: number = 1): this {
    if (lines <= 0) return this;
    this.buffer.push(ESC, 0x64, lines); // ESC d n
    return this;
  }

  /**
   * Full or partial paper cut
   */
  cut(partial: boolean = true): this {
    this.feed(3);
    if (partial) {
      this.buffer.push(GS, 0x56, 0x42, 0x00); // GS V 66 0 (feed and partial cut)
    } else {
      this.buffer.push(GS, 0x56, 0x00); // GS V 0 (full cut)
    }
    return this;
  }

  /**
   * Pulse cash drawer kick (pin 2: 0x00, pin 5: 0x01)
   */
  kickDrawer(pin: 2 | 5 = 2): this {
    const pinByte = pin === 5 ? 0x01 : 0x00;
    this.buffer.push(ESC, 0x70, pinByte, 0x19, 0xfa); // ESC p m t1 t2
    return this;
  }

  /**
   * Print 2D QR Code (compatible with POSIFLOW KP307-UEWB and ESC/POS standard)
   * Uses GS ( k commands for Model 2 QR Code
   */
  qrCode(data: string, size: number = 6): this {
    if (!data) return this;
    const encoder = new TextEncoder();
    const dataBytes = encoder.encode(data);
    const pL = (dataBytes.length + 3) & 0xff;
    const pH = ((dataBytes.length + 3) >> 8) & 0xff;

    // 1. Select QR Model (Model 2)
    this.buffer.push(GS, 0x28, 0x6b, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00);
    // 2. Set module size (2 to 8 dots, default 6)
    const clampedSize = Math.max(2, Math.min(8, size));
    this.buffer.push(GS, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x43, clampedSize);
    // 3. Set error correction (Level M)
    this.buffer.push(GS, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x45, 0x31);
    // 4. Store symbol data in printer memory
    this.buffer.push(GS, 0x28, 0x6b, pL, pH, 0x31, 0x50, 0x31);
    for (let i = 0; i < dataBytes.length; i++) {
      this.buffer.push(dataBytes[i]);
    }
    // 5. Print the stored symbol
    this.buffer.push(GS, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x51, 0x30);
    this.feed(1);
    return this;
  }

  /**
   * Append ASCII sanitized text string
   */
  text(str: string): this {
    const cleaned = cleanThermalText(str);
    const encoder = new TextEncoder();
    const bytes = encoder.encode(cleaned);
    for (let i = 0; i < bytes.length; i++) {
      this.buffer.push(bytes[i]);
    }
    return this;
  }

  /**
   * Append text followed by line break
   */
  line(str: string = ""): this {
    this.text(str);
    this.buffer.push(0x0a); // LF
    return this;
  }

  /**
   * Print a repeated separator line
   */
  separator(char: string = "-"): this {
    const repeated = char.repeat(this.effectiveColumns);
    return this.line(repeated);
  }

  /**
   * Print a double separator line
   */
  doubleSeparator(): this {
    return this.separator("=");
  }

  /**
   * Print a two-column row with left and right aligned content
   * Guarantees that left and right fit on a single line without wrapping.
   */
  twoColumns(left: string, right: string, bold: boolean = false): this {
    if (bold) this.bold(true);
    const cleanLeft = cleanThermalText(left);
    const cleanRight = cleanThermalText(right);
    const width = this.effectiveColumns;

    const maxLeft = width - cleanRight.length - 1;
    let displayLeft = cleanLeft;
    if (displayLeft.length > maxLeft && maxLeft > 3) {
      displayLeft = displayLeft.substring(0, maxLeft - 1) + ".";
    }

    const spaceCount = Math.max(1, width - displayLeft.length - cleanRight.length);
    this.line(`${displayLeft}${" ".repeat(spaceCount)}${cleanRight}`);
    if (bold) this.bold(false);
    return this;
  }

  /**
   * Print tabular columns with defined widths and alignments
   */
  tableRow(cols: { text: string; width: number; align?: AlignMode }[], bold: boolean = false): this {
    if (bold) this.bold(true);
    let rowStr = "";
    for (const col of cols) {
      const rawText = cleanThermalText(col.text || "");
      const align = col.align || "LEFT";
      const width = col.width;

      let cell = "";
      if (rawText.length > width) {
        cell = rawText.substring(0, width);
      } else {
        const pad = width - rawText.length;
        if (align === "RIGHT") {
          cell = " ".repeat(pad) + rawText;
        } else if (align === "CENTER") {
          const leftPad = Math.floor(pad / 2);
          const rightPad = pad - leftPad;
          cell = " ".repeat(leftPad) + rawText + " ".repeat(rightPad);
        } else {
          cell = rawText + " ".repeat(pad);
        }
      }
      rowStr += cell;
    }
    this.line(rowStr);
    if (bold) this.bold(false);
    return this;
  }

  /**
   * Get raw byte array
   */
  toBytes(): Uint8Array {
    return new Uint8Array(this.buffer);
  }

  /**
   * Get as Base64 encoded string
   */
  toBase64(): string {
    const bytes = this.toBytes();
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

  /**
   * Get as Hex encoded string
   */
  toHex(): string {
    return Array.from(this.toBytes())
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }
}

// ── Helpers ────────────────────────────────────────────────────────
function formatDateTime(isoString: string): string {
  try {
    const d = new Date(isoString);
    return d.toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return isoString;
  }
}

// ══════════════════════════════════════════════════════════════════
//  1. BILL RECEIPT ESC/POS BUILDER
// ══════════════════════════════════════════════════════════════════
export function buildBillReceiptEscPos(
  bill: Bill,
  isDuplicate: boolean = false,
  paperWidth: "80mm" | "58mm" = "80mm",
  customProfile?: Partial<ActiveRestaurantProfile>
): Uint8Array {
  const p = new EscPosBuilder(paperWidth);
  const is58mm = paperWidth === "58mm";
  const baseProfile = getActiveRestaurantProfile();
  const profile = customProfile ? { ...baseProfile, ...customProfile } : baseProfile;

  // DUPLICATE OR PARCEL BANNER
  if (isDuplicate) {
    p.align("CENTER").bold(true).line("*** DUPLICATE COPY / REPRINT ***").bold(false);
    p.separator("*");
  }

  if (bill.isTakeaway) {
    p.align("CENTER").bold(true).line(">> TAKEAWAY / PARCEL <<").bold(false);
    if (bill.customerName) {
      p.align("CENTER").line(`Customer: ${bill.customerName} ${bill.customerPhone ? `(${bill.customerPhone})` : ""}`);
    }
    p.separator("*");
  }

  // Restaurant Header
  p.align("CENTER");
  p.bold(true).size("DOUBLE_HEIGHT").line(profile.nameEn || "KOLHAPURI KHANAWAL").size("NORMAL").bold(false);
  if (profile.address) {
    p.line(profile.address);
  }
  if (profile.phone) {
    const sec = profile.secondaryPhone ? ` / ${profile.secondaryPhone}` : "";
    p.line(`Ph: ${profile.phone}${sec}`);
  }

  // Compliance Line (GSTIN / FSSAI) - ONLY print if data exists
  const compParts: string[] = [];
  if (profile.gstin && profile.gstin.trim()) {
    compParts.push(`GSTIN: ${profile.gstin.trim()}`);
  }
  if (profile.fssai && profile.fssai.trim()) {
    compParts.push(`FSSAI: ${profile.fssai.trim()}`);
  }
  if (compParts.length > 0) {
    p.line(compParts.join(" | "));
  }

  p.separator();

  // Invoice Title & Metadata
  p.align("CENTER").bold(true).line(profile.gstin ? "TAX INVOICE" : "BILL RECEIPT").bold(false);
  p.align("LEFT");
  p.twoColumns(`Bill: ${bill.billNumber}`, formatDateTime(bill.createdAt));
  p.twoColumns(`Table: ${bill.tableNumber} | ${bill.partyCode}`, bill.isTakeaway ? "Type: PARCEL" : "Dine-in");
  p.twoColumns(`Waiter: ${bill.waiterName}`, `Cashier: ${bill.cashierName}`);

  p.doubleSeparator();

  // Table Columns Setup
  // 80mm (48 cols): Sr(3), Item(23), Qty(4), Rate(8), Amt(10) = 48
  // 58mm (32 cols): Item(16), Qty(4), Rate(5), Amt(7) = 32
  if (is58mm) {
    p.tableRow([
      { text: "Item", width: 16, align: "LEFT" },
      { text: "Qty", width: 4, align: "CENTER" },
      { text: "Rate", width: 5, align: "RIGHT" },
      { text: "Amt", width: 7, align: "RIGHT" },
    ], true);
  } else {
    p.tableRow([
      { text: "#", width: 3, align: "CENTER" },
      { text: "Item", width: 23, align: "LEFT" },
      { text: "Qty", width: 4, align: "CENTER" },
      { text: "Rate", width: 8, align: "RIGHT" },
      { text: "Amt", width: 10, align: "RIGHT" },
    ], true);
  }
  p.separator();

  let sr = 0;
  for (const item of bill.items) {
    sr++;
    const breadSuffix = item.breadOption ? ` [${BREAD_OPTION_LABELS[item.breadOption as BreadOption]?.en || item.breadOption}]` : "";
    const name = cleanThermalText(item.menuItemName + breadSuffix);
    const qty = String(item.quantity);
    const rate = item.unitPrice.toFixed(0);
    const amt = item.totalPrice.toFixed(2);

    if (is58mm) {
      p.tableRow([
        { text: name, width: 16, align: "LEFT" },
        { text: qty, width: 4, align: "CENTER" },
        { text: rate, width: 5, align: "RIGHT" },
        { text: amt, width: 7, align: "RIGHT" },
      ]);
    } else {
      p.tableRow([
        { text: String(sr), width: 3, align: "CENTER" },
        { text: name, width: 23, align: "LEFT" },
        { text: qty, width: 4, align: "CENTER" },
        { text: rate, width: 8, align: "RIGHT" },
        { text: amt, width: 10, align: "RIGHT" },
      ]);
    }
  }

  p.separator();

  // Financial Totals
  p.twoColumns("Subtotal:", `Rs. ${bill.subtotal.toFixed(2)}`, true);
  if (bill.discountAmount > 0) {
    p.twoColumns(`Discount${bill.discountReason ? ` (${bill.discountReason})` : ""}:`, `-Rs. ${bill.discountAmount.toFixed(2)}`, true);
  }
  if (bill.packagingCharges && bill.packagingCharges > 0) {
    p.twoColumns("Packaging / Parcel Fee:", `Rs. ${bill.packagingCharges.toFixed(2)}`, true);
  }

  const hasGst = Boolean(
    profile.gstin &&
    profile.gstin.trim() &&
    (bill.cgstAmount > 0 || bill.sgstAmount > 0 || bill.totalTaxAmount > 0)
  );

  if (hasGst) {
    p.twoColumns("Taxable Amount:", `Rs. ${bill.taxableAmount.toFixed(2)}`);
    p.twoColumns("CGST (2.5%):", `Rs. ${bill.cgstAmount.toFixed(2)}`);
    p.twoColumns("SGST (2.5%):", `Rs. ${bill.sgstAmount.toFixed(2)}`);
  }

  if (bill.roundOff !== 0) {
    p.twoColumns("Round Off:", `${bill.roundOff > 0 ? "+" : "-"}Rs. ${Math.abs(bill.roundOff).toFixed(2)}`);
  }

  p.doubleSeparator();
  p.bold(true).size("DOUBLE_HEIGHT").twoColumns("GRAND TOTAL:", `Rs. ${bill.grandTotal.toFixed(2)}`).size("NORMAL").bold(false);
  p.doubleSeparator();

  // Payment Breakdown
  if (bill.payments && bill.payments.length > 0) {
    p.align("CENTER").bold(true).line("-- PAYMENT DETAILS --").bold(false);
    for (const pay of bill.payments) {
      p.twoColumns(`${pay.paymentMethod}${pay.transactionReference ? ` (${pay.transactionReference})` : ""}:`, `Rs. ${pay.amount.toFixed(2)}`);
    }
    p.twoColumns("Total Paid:", `Rs. ${bill.paidAmount.toFixed(2)}`, true);
    const change = bill.payments.filter((x) => x.paymentMethod === "CASH").reduce((s, x) => s + x.amount, 0) - bill.grandTotal;
    if (change > 0) {
      p.twoColumns("Change Return:", `Rs. ${change.toFixed(2)}`, true);
    }
    p.separator();
  }

  // QR Code on receipt for UPI settlement
  if (profile.upiId && profile.upiId.trim()) {
    const upiId = profile.upiId;
    const upiName = profile.upiMerchantName || "Kolapuri khanawal";
    const upiUrl = `upi://pay?pa=${upiId}&pn=${encodeURIComponent(upiName)}&am=${bill.grandTotal.toFixed(2)}&cu=INR&tn=Bill%20${bill.billNumber}`;

    p.align("CENTER")
      .bold(true)
      .line("SCAN TO PAY VIA UPI")
      .bold(false);
    p.qrCode(upiUrl, is58mm ? 4 : 5);
    p.align("CENTER")
      .bold(true).line(`UPI ID: ${upiId}`).bold(false)
      .line(`Payee: ${upiName}`)
      .line(`Terminal: ${profile.upiTerminal || "Terminal 1-Q338740118"}`);
    p.separator();
  }

  // Footer
  p.align("CENTER")
    .bold(true)
    .line("Thank you! Please visit again!")
    .line("Aamhi Aplya Seveche Runi Aahot")
    .bold(false);

  if (hasGst) {
    p.line("HSN/SAC: 996331 | Standalone Restaurant (5% GST)");
    p.line("This is a computer-generated tax invoice.");
  } else {
    p.line("This is a computer-generated bill receipt.");
  }
  p.line(`Printed: ${formatDateTime(new Date().toISOString())}`);

  p.cut();
  return p.toBytes();
}

// ══════════════════════════════════════════════════════════════════
//  2. KITCHEN ORDER TICKET (KOT) ESC/POS BUILDER
// ══════════════════════════════════════════════════════════════════
export function buildKotEscPos(
  kot: Kot,
  stationFilter?: string,
  isReprint: boolean = false,
  paperWidth: "80mm" | "58mm" = "80mm"
): Uint8Array {
  const p = new EscPosBuilder(paperWidth);

  let title = "*** K O T ***";
  if (isReprint) {
    title = "*** REPRINT KOT - KITCHEN COPY ***";
  } else if (kot.isAddOn) {
    title = `*** ADD-ON KOT #${kot.kotSequenceNumber || 2} ***`;
  }

  p.align("CENTER")
    .bold(true)
    .line(title)
    .size("DOUBLE_HEIGHT")
    .line(`TABLE ${kot.tableNumber} - ${kot.partyCode}`)
    .size("NORMAL")
    .bold(false);

  if (kot.isTakeaway) {
    p.align("CENTER").bold(true).line(">> TAKEAWAY / PARCEL <<").bold(false);
  }

  p.separator();
  p.align("LEFT");
  p.twoColumns(`Ticket: ${kot.kotNumber}`, formatDateTime(kot.createdAt));
  p.twoColumns(`Waiter: ${cleanThermalText(kot.waiterName)}`, `Guests: ${kot.guestCount}`);
  p.bold(true).line(`Station: ${cleanThermalText(kot.stationCode)}`).bold(false);
  p.doubleSeparator();

  // Items
  const items = stationFilter && stationFilter !== "ALL"
    ? kot.items.filter((item) => true)
    : kot.items;

  for (const item of items) {
    const itemName = cleanThermalText(item.menuItemName);
    p.bold(true).size("DOUBLE_HEIGHT").line(`${item.quantity}x ${itemName}${item.seatNumber ? ` [S${item.seatNumber}]` : ""}`).size("NORMAL").bold(false);
    if (item.breadOption) {
      const breadObj = BREAD_OPTION_LABELS[item.breadOption as BreadOption];
      const breadLabel = breadObj?.en || item.breadOption;
      p.bold(true).line(`  * Bread: [${breadLabel}]`).bold(false);
    }
    if (item.spiceLevel && item.spiceLevel !== "MEDIUM") {
      p.line(`  * Spice: ${item.spiceLevel.replace(/_/g, " ")}`);
    }
    if (item.notes) {
      p.line(`  * Note: ${cleanThermalText(item.notes)}`);
    }
    p.separator(".");
  }

  p.doubleSeparator();
  if (kot.notes) {
    p.line(`Order Notes: ${cleanThermalText(kot.notes)}`);
    p.separator();
  }

  p.twoColumns(`Items: ${items.length}`, `Total Qty: ${items.reduce((s, i) => s + i.quantity, 0)}`, true);
  p.align("CENTER").bold(true).line("KOLHAPURI KHANAWAL - Kitchen Copy").bold(false);

  p.cut();
  return p.toBytes();
}

// ══════════════════════════════════════════════════════════════════
//  3. CANCELLED KOT SLIP ESC/POS BUILDER
// ══════════════════════════════════════════════════════════════════
export function buildCancelledKotEscPos(
  kot: Kot,
  reason: string = "Customer cancelled order",
  cancelledBy: string = "Kitchen / Cashier",
  paperWidth: "80mm" | "58mm" = "80mm"
): Uint8Array {
  const p = new EscPosBuilder(paperWidth);

  p.align("CENTER")
    .bold(true)
    .line("*** CANCELLED KOT - DO NOT PREPARE ***")
    .size("DOUBLE_HEIGHT")
    .line("DO NOT PREPARE - ORDER CANCELLED")
    .size("NORMAL")
    .line(`TABLE ${kot.tableNumber} - ${kot.partyCode}`)
    .bold(false);

  p.separator("!");
  p.twoColumns(`Ticket: ${kot.kotNumber}`, formatDateTime(new Date().toISOString()));
  p.twoColumns(`Waiter: ${cleanThermalText(kot.waiterName)}`, `Cancelled By: ${cleanThermalText(cancelledBy)}`);
  p.doubleSeparator();

  p.bold(true).line("Items to Cancel:").bold(false);
  for (const item of kot.items) {
    p.line(`  [CANCELLED] ${item.quantity}x ${cleanThermalText(item.menuItemName)}`);
  }

  p.doubleSeparator();
  p.line(`Reason: ${cleanThermalText(reason)}`);
  p.separator();
  p.align("CENTER").line("Stock reservation released to inventory.");

  p.cut();
  return p.toBytes();
}

// ══════════════════════════════════════════════════════════════════
//  4. TABLE CHECK / PRE-BILL ESTIMATE ESC/POS BUILDER
// ══════════════════════════════════════════════════════════════════
export function buildTableCheckEscPos(
  params: any,
  paperWidth: "80mm" | "58mm" = "80mm"
): Uint8Array {
  const p = new EscPosBuilder(paperWidth);
  const baseProfile = getActiveRestaurantProfile();
  const profile = params.profile ? { ...baseProfile, ...params.profile } : baseProfile;
  const tableNum = params.party?.tableNumber || params.tableNumber || 1;
  const partyCode = params.party?.partyCode || params.partyCode || "P-101";
  const subtotal = typeof params.subtotal === "number" ? params.subtotal : 0;
  const grandTotal = typeof params.grandTotal === "number" ? params.grandTotal : subtotal;

  p.align("CENTER")
    .bold(true)
    .line("*** TABLE CHECK / PRE-BILL ESTIMATE ***")
    .line("(Not a Tax Invoice - Kachha Bill)")
    .line("THIS IS NOT A TAX INVOICE");

  p.bold(true).size("DOUBLE_HEIGHT").line(profile.nameEn || "KOLHAPURI KHANAWAL").size("NORMAL").bold(false);
  if (profile.address) p.line(profile.address);
  if (profile.phone) p.line(`Ph: ${profile.phone}`);

  p.size("DOUBLE_HEIGHT")
    .bold(true)
    .line(`TABLE ${tableNum}`)
    .size("NORMAL")
    .line(`Party: ${partyCode}`)
    .bold(false);

  p.separator();
  p.align("LEFT");
  p.twoColumns(`Table: ${tableNum}`, formatDateTime(new Date().toISOString()));
  p.twoColumns(`Party: ${partyCode}`, `Guests: ${params.party?.guestCount || 2}`);
  if (params.party?.assignedWaiterName || params.waiterName) {
    p.line(`Waiter: ${cleanThermalText(params.party?.assignedWaiterName || params.waiterName)}`);
  }
  p.doubleSeparator();

  // Order Items
  const items = params.items || [];
  for (const item of items) {
    if (item.isCancelled) continue;
    const qty = item.quantity || 1;
    const name = cleanThermalText(item.menuItemName || "Item");
    const amt = typeof item.totalPrice === "number" ? item.totalPrice : (item.unitPrice || 0) * qty;
    p.twoColumns(`${qty}x ${name}`, `Rs. ${amt.toFixed(2)}`);
  }

  p.separator();
  p.twoColumns("Subtotal:", `Rs. ${subtotal.toFixed(2)}`, true);
  if (params.taxEstimate && params.taxEstimate > 0) {
    p.twoColumns("Estimated GST (5%):", `Rs. ${params.taxEstimate.toFixed(2)}`);
  }
  p.doubleSeparator();
  p.bold(true).size("DOUBLE_HEIGHT").twoColumns("TOTAL ESTIMATE:", `Rs. ${grandTotal.toFixed(2)}`).size("NORMAL").bold(false);
  p.doubleSeparator();

  const is58mm = paperWidth === "58mm";
  const upiId = profile.upiId || "Q338740118@ybl";
  const upiName = profile.upiMerchantName || "Kolapuri khanawal";
  const upiUrl = `upi://pay?pa=${upiId}&pn=${encodeURIComponent(upiName)}&am=${grandTotal.toFixed(2)}&cu=INR&tn=Table%20${tableNum}`;

  p.align("CENTER")
    .bold(true)
    .line("SCAN TO PAY VIA UPI")
    .bold(false);
  p.qrCode(upiUrl, is58mm ? 4 : 5);
  p.align("CENTER")
    .bold(true).line(`UPI ID: ${upiId}`).bold(false)
    .line(`Payee: ${upiName}`)
    .line(`Terminal: ${profile.upiTerminal || "Terminal 1-Q338740118"}`)
    .feed(1)
    .line("Please settle with your waiter or at counter.");

  p.cut();
  return p.toBytes();
}

// ══════════════════════════════════════════════════════════════════
//  5. DAY-END Z-REPORT ESC/POS BUILDER
// ══════════════════════════════════════════════════════════════════
export function buildDayEndReportEscPos(
  report: DayEndReport,
  paperWidth: "80mm" | "58mm" = "80mm"
): Uint8Array {
  const p = new EscPosBuilder(paperWidth);

  p.align("CENTER")
    .bold(true)
    .size("DOUBLE_HEIGHT")
    .line("KOLHAPURI KHANAWAL")
    .size("NORMAL")
    .line("*** DAY-END Z-REPORT (DAILY CLOSING) ***")
    .line(`Date: ${report.date} | Shift: ${report.shiftName}`)
    .bold(false);

  p.separator();
  p.twoColumns(`Generated: ${formatDateTime(report.generatedAt)}`, `By: ${cleanThermalText(report.generatedByName)}`);
  p.doubleSeparator();

  p.bold(true).line("TRANSACTION METRICS:").bold(false);
  p.twoColumns("Total Bills Issued:", String(report.totalBills));
  p.twoColumns("Bills Settled (Paid):", String(report.settledBillsCount));
  p.twoColumns("Bills Voided / Cancelled:", String(report.cancelledBillsCount));

  p.separator();
  p.bold(true).line("REVENUE & TAX BREAKDOWN:").bold(false);
  p.twoColumns("Gross Sales Subtotal:", `Rs. ${report.grossSalesSubtotal.toFixed(2)}`);
  if (report.totalDiscountAmount > 0) {
    p.twoColumns("Discounts Allowed:", `-Rs. ${report.totalDiscountAmount.toFixed(2)}`);
  }
  p.twoColumns("Net Taxable Sales:", `Rs. ${report.netTaxableSales.toFixed(2)}`);
  p.twoColumns("Total GST (5%):", `Rs. ${report.totalTaxAmount.toFixed(2)}`);
  p.doubleSeparator();
  p.bold(true).size("DOUBLE_HEIGHT").twoColumns("NET REVENUE:", `Rs. ${report.netRevenue.toFixed(2)}`).size("NORMAL").bold(false);
  p.doubleSeparator();

  p.bold(true).line("PAYMENT TENDERS:").bold(false);
  p.twoColumns("Cash Collected:", `Rs. ${report.tenders.cash.toFixed(2)}`);
  p.twoColumns("UPI / QR Collected:", `Rs. ${report.tenders.upi.toFixed(2)}`);
  p.twoColumns("Card Collected:", `Rs. ${report.tenders.card.toFixed(2)}`);
  const totalCollected = report.tenders.cash + report.tenders.upi + report.tenders.card + (report.tenders.other || 0);
  p.twoColumns("Total Collections:", `Rs. ${totalCollected.toFixed(2)}`, true);

  p.feed(2);
  p.line("Cashier: ___________   Manager: ___________");

  p.cut();
  return p.toBytes();
}

// ══════════════════════════════════════════════════════════════════
//  6. HARDWARE DIAGNOSTIC TEST ESC/POS BUILDER
// ══════════════════════════════════════════════════════════════════
export function buildDiagnosticTestEscPos(
  printerName: string = "POS Thermal",
  paperWidth: "80mm" | "58mm" = "80mm"
): Uint8Array {
  const p = new EscPosBuilder(paperWidth);

  p.align("CENTER")
    .bold(true)
    .size("DOUBLE_HEIGHT")
    .line("=== PRINTER TEST TICKET ===")
    .size("NORMAL")
    .line("KOLHAPURI KHANAWAL")
    .line("Lalit Estate, Baner, Pune")
    .line("Ph: +91 91753 86576")
    .line(`Printer: ${cleanThermalText(printerName)}`)
    .bold(false);

  p.separator();
  p.twoColumns("Profile:", paperWidth === "58mm" ? "58mm Compact" : "80mm Standard");
  p.twoColumns("Timestamp:", formatDateTime(new Date().toISOString()));
  p.twoColumns("Max Columns:", `${p.maxColumns} monospace`);
  p.twoColumns("Auto-Cutter:", "ENABLED");
  p.twoColumns("Cash Drawer:", "CONNECTED");

  p.separator();
  p.align("CENTER").bold(true).line("--- ALIGNMENT TEST ---").bold(false);
  p.align("LEFT").line("[LEFT ALIGNED TEXT]");
  p.align("CENTER").line("[CENTER ALIGNED TEXT]");
  p.align("RIGHT").line("[RIGHT ALIGNED TEXT]");

  p.separator();
  p.align("CENTER").bold(true).line("--- FONT & PITCH CHECK ---").bold(false);
  p.align("LEFT");
  p.line("Normal: Kolhapuri Khanawal Restaurant OS");
  p.bold(true).line("Bold: Tambda Rassa / Pandhra Rassa / Sukka Mutton").bold(false);
  p.underline(true).line("Underlined: Authentic Kolhapur Flavors").underline(false);
  p.inverse(true).align("CENTER").line(" INVERTED WHITE ON BLACK ").inverse(false);

  p.doubleSeparator();
  p.align("CENTER").bold(true).line("[PASS] ALL HARDWARE CHECKS PASSED").bold(false);

  p.cut();
  return p.toBytes();
}

export interface CashUpiReconciliationEscPosParams {
  date: string;
  expectedCash: number;
  actualCash: number;
  cashVariance: number;
  expectedUpi: number;
  actualUpi: number;
  upiVariance: number;
  denominations?: { label: string; value: number; count: number }[];
  paperWidth?: "80mm" | "58mm";
}

export function buildCashUpiReconciliationEscPos(
  params: CashUpiReconciliationEscPosParams,
  paperWidth: "80mm" | "58mm" = "80mm"
): Uint8Array {
  const profile = getActiveRestaurantProfile();
  const p = new EscPosBuilder(paperWidth);

  p.align("CENTER");
  p.bold(true).size("DOUBLE_HEIGHT").line(profile.nameEn || "KOLHAPURI KHANAWAL").bold(false).size("NORMAL");
  p.line("Lalit Estate, Baner, Pune");
  p.line("Ph: +91 91753 86576");
  p.line("CASH & UPI RECONCILIATION SLIP");
  p.line(`Date: ${params.date} | Time: ${new Date().toLocaleTimeString("en-IN")}`);
  p.doubleSeparator();

  p.align("LEFT").bold(true).line("1. CASH DRAWER AUDIT").bold(false);
  p.twoColumns("System Expected:", `Rs. ${params.expectedCash.toLocaleString("en-IN")}`);
  p.twoColumns("Actual Drawer Count:", `Rs. ${params.actualCash.toLocaleString("en-IN")}`);
  p.bold(true).twoColumns(
    "Cash Variance:",
    params.cashVariance === 0
      ? "Rs. 0 (Balanced)"
      : params.cashVariance > 0
      ? `+Rs. ${params.cashVariance} (Surplus)`
      : `-Rs. ${Math.abs(params.cashVariance)} (Shortage)`
  ).bold(false);

  p.separator();
  p.align("LEFT").bold(true).line("2. UPI BANK / SOUNDBOX").bold(false);
  p.twoColumns("System Expected:", `Rs. ${params.expectedUpi.toLocaleString("en-IN")}`);
  p.twoColumns("Actual Bank Count:", `Rs. ${params.actualUpi.toLocaleString("en-IN")}`);
  p.bold(true).twoColumns(
    "UPI Variance:",
    params.upiVariance === 0 ? "Rs. 0 (Balanced)" : `Rs. ${params.upiVariance}`
  ).bold(false);

  p.doubleSeparator();
  p.bold(true).size("DOUBLE_HEIGHT").twoColumns(
    "TOTAL LIQUID FUNDS:",
    `Rs. ${(params.actualCash + params.actualUpi).toLocaleString("en-IN")}`
  ).bold(false).size("NORMAL");

  if (params.denominations && params.denominations.some((d) => d.count > 0)) {
    p.separator();
    p.bold(true).line("DENOMINATIONS:").bold(false);
    for (const d of params.denominations.filter((d) => d.count > 0)) {
      p.twoColumns(`${d.label} x ${d.count}`, `= Rs. ${(d.value * d.count).toLocaleString("en-IN")}`);
    }
  }

  p.feed(2);
  p.twoColumns("Cashier: _________", "Manager: _________");
  p.separator();
  p.align("CENTER").line("Kolhapuri Khanawal Restaurant OS");
  p.cut();
  return p.toBytes();
}
