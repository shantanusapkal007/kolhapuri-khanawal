import { describe, it, expect } from "vitest";
import {
  generateBillReceiptHtml,
  generateKotHtml,
  generateTableCheckHtml,
  generateCancelledKotHtml,
  generatePrinterTestHtml,
} from "@/lib/printing/thermal-printer";
import { buildBillReceiptEscPos } from "@/lib/printing/escpos-builder";
import { Bill } from "@/types/billing";
import { Kot } from "@/types/orders";

describe("Thermal Printer Utility (80mm Monospace Print)", () => {
  const mockBill = {
    id: "bill-test-01",
    billNumber: "BILL-2026-001",
    partyId: "party-01",
    partyCode: "P-101",
    tableNumber: 5,
    items: [
      {
        id: "item-01",
        orderItemId: "oi-01",
        menuItemId: "dish-01",
        menuItemName: "Special Mutton Thali (तांबडा-पांढरा रस्सा)",
        quantity: 2,
        unitPrice: 450,
        totalPrice: 900,
        seatNumber: 1,
      },
      {
        id: "item-02",
        orderItemId: "oi-02",
        menuItemId: "dish-02",
        menuItemName: "Jowar Bhakri (गरमागरम भाकरी)",
        quantity: 4,
        unitPrice: 30,
        totalPrice: 120,
        seatNumber: 2,
      },
    ],
    subtotal: 1020,
    discountAmount: 102,
    discountPercent: 10,
    discountReason: "Owner Special Discount",
    taxableAmount: 918,
    cgstRate: 0.025,
    cgstAmount: 22.95,
    sgstRate: 0.025,
    sgstAmount: 22.95,
    roundOff: 0.1,
    grandTotal: 964,
    status: "PAID",
    paidAmount: 1000,
    balanceDue: 0,
    waiterId: "w-01",
    waiterName: "Bandu Patil",
    cashierId: "c-01",
    cashierName: "Suresh Rao",
    payments: [
      {
        id: "pay-01",
        billId: "bill-test-01",
        amount: 1000,
        paymentMethod: "CASH",
        receivedBy: "Suresh Rao",
        status: "SUCCESS",
      },
    ],
    createdAt: "2026-09-06T14:00:00.000Z",
    updatedAt: "2026-09-06T14:30:00.000Z",
  } as unknown as Bill;

  const mockKot = {
    id: "kot-test-01",
    kotNumber: "KOT-0089",
    orderId: "ord-01",
    tableNumber: 5,
    partyCode: "P-101",
    waiterId: "w-01",
    waiterName: "Bandu Patil",
    guestCount: 4,
    stationCode: "MAIN_KITCHEN",
    status: "NEW",
    items: [
      {
        menuItemId: "dish-01",
        menuItemName: "Special Mutton Thali",
        quantity: 2,
        seatNumber: 1,
        spiceLevel: "EXTRA_SPICY",
        notes: "कमी तिखट, जास्त रस्सा",
      },
      {
        menuItemId: "dish-02",
        menuItemName: "Jowar Bhakri",
        quantity: 4,
        seatNumber: 2,
        spiceLevel: "MEDIUM",
      },
    ],
    notes: "Serve thali and extra rassa immediately",
    createdAt: "2026-09-06T14:05:00.000Z",
    updatedAt: "2026-09-06T14:05:00.000Z",
  } as unknown as Kot;

  describe("Customer Bill Receipt (80mm)", () => {
    it("renders valid 80mm thermal CSS constraints and restaurant compliance headers", () => {
      const html = generateBillReceiptHtml(mockBill);

      expect(html).toContain("80mm");
      expect(html).toContain("Courier New");
      expect(html).toContain("font-weight: 700 !important");
      expect(html).toContain("print-color-adjust: exact");
      expect(html).toContain("कोल्हापुरी खानावळ");
      expect(html).toContain("KOLHAPURI KHANAWAL");
      expect(html).toContain("GSTIN: 27AAAAA0000A1Z5");
      expect(html).toContain("FSSAI: 11026999000123");
      expect(html).toContain("Lalit Estate, Baner, Pune, Maharashtra 411045");
    });

    it("renders bill metadata, staff details, and itemized dish rows", () => {
      const html = generateBillReceiptHtml(mockBill);

      expect(html).toContain("BILL-2026-001");
      expect(html).toContain("Table: 5");
      expect(html).toContain("P-101");
      expect(html).toContain("Waiter: Bandu Patil");
      expect(html).toContain("Cashier: Suresh Rao");

      // Items
      expect(html).toContain("Special Mutton Thali (तांबडा-पांढरा रस्सा)");
      expect(html).toContain("(S1)");
      expect(html).toContain("Jowar Bhakri (गरमागरम भाकरी)");
      expect(html).toContain("(S2)");
    });

    it("renders accurate financial breakdown with GST, discount, and roundoff", () => {
      const html = generateBillReceiptHtml(mockBill);

      expect(html).toContain("Subtotal:");
      expect(html).toContain("1020.00");
      expect(html).toContain("Discount (Owner Special Discount):");
      expect(html).toContain("-₹102.00");
      expect(html).toContain("Taxable Amount:");
      expect(html).toContain("918.00");
      expect(html).toContain("CGST (2.5%):");
      expect(html).toContain("22.95");
      expect(html).toContain("SGST (2.5%):");
      expect(html).toContain("22.95");
      expect(html).toContain("Round Off:");
      expect(html).toContain("+₹0.10");
      expect(html).toContain("GRAND TOTAL");
      expect(html).toContain("₹964.00");
    });

    it("renders payment details and change return for cash settlement", () => {
      const html = generateBillReceiptHtml(mockBill);

      expect(html).toContain("— PAYMENT DETAILS —");
      expect(html).toContain("CASH:");
      expect(html).toContain("Total Paid:");
      expect(html).toContain("₹1000.00");
      expect(html).toContain("Change Return:");
      expect(html).toContain("₹36.00"); // 1000 - 964 = 36
    });

    it("supports UPI payment method with UTR transaction reference", () => {
      const upiBill: Bill = {
        ...mockBill,
        payments: [
          {
            id: "pay-02",
            billId: "bill-test-01",
            amount: 964,
            paymentMethod: "UPI",
            transactionReference: "UPI982301982301",
            receivedBy: "u-01",
            receivedByName: "Suresh Rao",
            paymentTime: "2026-09-06T14:30:00.000Z",
            status: "SUCCESS",
          },
        ],
      };

      const html = generateBillReceiptHtml(upiBill);
      expect(html).toContain("UPI (UPI982301982301):");
      expect(html).toContain("₹964.00");
      expect(html).not.toContain("Change Return");
    });

    it("renders DUPLICATE / REPRINT banner when isDuplicate is true", () => {
      const normalHtml = generateBillReceiptHtml(mockBill, false);
      expect(normalHtml).not.toContain("*** DUPLICATE COPY / REPRINT ***");
      expect(normalHtml).toContain("<title>Receipt BILL-2026-001</title>");

      const duplicateHtml = generateBillReceiptHtml(mockBill, true);
      expect(duplicateHtml).toContain("*** DUPLICATE COPY / REPRINT ***");
      expect(duplicateHtml).toContain("<title>DUPLICATE — Receipt BILL-2026-001</title>");
    });

    it("omits GSTIN, Taxable Amount, CGST, SGST, and HSN when GSTIN is empty or no tax applies", () => {
      const billWithoutGst = {
        ...mockBill,
        cgstAmount: 0,
        sgstAmount: 0,
        totalTaxAmount: 0,
      } as unknown as Bill;

      const html = generateBillReceiptHtml(billWithoutGst, false, "80mm", {
        gstin: "",
        fssai: "",
      });

      expect(html).not.toContain("GSTIN:");
      expect(html).not.toContain("FSSAI:");
      expect(html).not.toContain("Taxable Amount:");
      expect(html).not.toContain("CGST (2.5%):");
      expect(html).not.toContain("SGST (2.5%):");
      expect(html).not.toContain("HSN/SAC: 996331");
      expect(html).toContain("This is a computer-generated bill receipt.");
    });

    it("omits empty restaurant profile fields (address, phone) cleanly", () => {
      const html = generateBillReceiptHtml(mockBill, false, "80mm", {
        address: "",
        phone: "",
        secondaryPhone: "",
        gstin: "",
        fssai: "",
      });

      expect(html).not.toContain("Lalit Estate");
      expect(html).not.toContain("Ph:");
      expect(html).not.toContain("GSTIN:");
      expect(html).not.toContain("FSSAI:");
    });

    it("omits GSTIN and GST lines in ESC/POS byte output when GSTIN is blank", () => {
      const bytes = buildBillReceiptEscPos(mockBill, false, "80mm", { gstin: "" });
      const text = new TextDecoder().decode(bytes);

      expect(text).not.toContain("GSTIN:");
      expect(text).not.toContain("CGST (2.5%):");
      expect(text).not.toContain("SGST (2.5%):");
      expect(text).not.toContain("HSN/SAC: 996331");
      expect(text).not.toContain("This is a computer-generated bill receipt.");

      // Verify emphasized bold mode (ESC E 1) is present so printout is dark and not blurry
      const hasEscE1 = bytes.some((b, i) => b === 0x1b && bytes[i + 1] === 0x45 && bytes[i + 2] === 0x01);
      expect(hasEscE1).toBe(true);
    });
  });

  describe("Kitchen Order Ticket (KOT — 80mm)", () => {
    it("renders KOT header, table number, party code, and station routing label", () => {
      const html = generateKotHtml(mockKot);

      expect(html).toContain("*** K O T ***");
      expect(html).toContain("TABLE 5 — P-101");
      expect(html).toContain("KOT-0089");
      expect(html).toContain("Waiter: Bandu Patil");
      expect(html).toContain("Guests: 4");
      expect(html).toContain("Station: MAIN KITCHEN");
    });

    it("renders order items with quantity badges, seats, spice level, and cooking notes", () => {
      const html = generateKotHtml(mockKot);

      expect(html).toContain("2×");
      expect(html).toContain("Special Mutton Thali");
      expect(html).toContain("[S1]");
      expect(html).toContain("🌶️ EXTRA SPICY");
      expect(html).toContain("📝 कमी तिखट, जास्त रस्सा");

      expect(html).toContain("4×");
      expect(html).toContain("Jowar Bhakri");
      expect(html).toContain("[S2]");
    });

    it("renders order notes and item totals", () => {
      const html = generateKotHtml(mockKot);

      expect(html).toContain("Order Notes:</b> Serve thali and extra rassa immediately");
      expect(html).toContain("Items: 2");
      expect(html).toContain("Total Qty: 6");
      expect(html).toContain("Kitchen Copy");
    });

    it("maps station codes cleanly", () => {
      const tandoorKot: Kot = {
        ...mockKot,
        stationCode: "TANDOOR_BHAKRI",
      };
      const html = generateKotHtml(tandoorKot);
      expect(html).toContain("Station: TANDOOR / BHAKRI");
    });

    it("renders Add-on Running KOT badge and sequence number", () => {
      const addOnKot: Kot = {
        ...mockKot,
        kotSequenceNumber: 2,
        isAddOn: true,
      };
      const html = generateKotHtml(addOnKot);
      expect(html).toContain("ADD-ON KOT #2 (रनिंग ऑर्डर)");
    });

    it("renders Takeaway / Parcel badge and customer name on KOT", () => {
      const takeawayKot: Kot = {
        ...mockKot,
        isTakeaway: true,
        customerName: "Ganesh Shinde",
      };
      const html = generateKotHtml(takeawayKot);
      expect(html).toContain("🥡 TAKEAWAY / PARCEL (पार्सल)");
      expect(html).toContain("Ganesh Shinde");
    });
  });

  describe("Table Check / Pre-Bill Estimate ('कच्चा बिल')", () => {
    it("renders pre-bill estimate disclaimers, UPI QR code, and subtotal instructions", () => {
      const html = generateTableCheckHtml(mockBill);

      expect(html).toContain("TABLE CHECK / PRE-BILL ESTIMATE");
      expect(html).toContain("कच्चा बिल / अंदाजे हिशोब");
      expect(html).toContain("THIS IS NOT A TAX INVOICE");
      expect(html).toContain("PAY VIA UPI AT TABLE");
      expect(html).toContain("upi://pay?");
      expect(html).toContain("Q338740118@ybl");
      expect(html).toContain("Total Estimate:");
      expect(html).toContain("₹964.00");
    });

    it("omits estimated GST in pre-bill when GSTIN is empty", () => {
      const html = generateTableCheckHtml({
        ...mockBill,
        profile: { gstin: "" },
      });

      expect(html).not.toContain("Estimated GST (5%):");
      expect(html).toContain("Subtotal:");
      expect(html).toContain("Total Estimate:");
    });
  });

  describe("Cancelled KOT Slip ('ऑर्डर रद्द — DO NOT PREPARE')", () => {
    it("renders cancelled ticket alert banner and void reason", () => {
      const html = generateCancelledKotHtml(mockKot, "Customer changed order to Tambada Rassa");

      expect(html).toContain("CANCELLED KOT / रद्द पावती");
      expect(html).toContain("DO NOT PREPARE — ऑर्डर रद्द");
      expect(html).toContain("KOT-0089");
      expect(html).toContain("Customer changed order to Tambada Rassa");
      expect(html).toContain("Items to cancel:");
      expect(html).toContain("Special Mutton Thali");
    });
  });

  describe("Takeaway Parcel Invoice with Packaging Charges", () => {
    it("renders packaging charges and customer details on final bill", () => {
      const parcelBill: Bill = {
        ...mockBill,
        isTakeaway: true,
        customerName: "Rahul Jadhav",
        customerPhone: "9822012345",
        packagingCharges: 30,
        grandTotal: 994,
      };

      const html = generateBillReceiptHtml(parcelBill);

      expect(html).toContain("TAKEAWAY / PARCEL (पार्सल)");
      expect(html).toContain("Rahul Jadhav");
      expect(html).toContain("9822012345");
      expect(html).toContain("Packaging / पार्सल शुल्क:");
      expect(html).toContain("30.00");
    });
  });

  describe("Thermal Hardware Diagnostics & Compact 58mm Width", () => {
    it("renders 58mm width constraints when selected", () => {
      const html58 = generateBillReceiptHtml(mockBill, false, { paperWidth: "58mm" });
      expect(html58).toContain("58mm");
      expect(html58).toContain("font-size: 11px");
    });

    it("generates printer diagnostic test ticket with Devanagari alignment check", () => {
      const html = generatePrinterTestHtml({
        paperWidth: "80mm",
        autoPrintKotOnOrder: true,
        autoPrintReceiptOnPayment: true,
        autoPrintPreBillOnRequest: true,
        autoKickCashDrawerOnCash: true,
        numberOfReceiptCopies: 1,
        printMarathiHeader: true,
        stationPrinters: [],
      });

      expect(html).toContain("PRINTER DIAGNOSTIC TEST TICKET");
      expect(html).toContain("चाचणी पावती");
      expect(html).toContain("80mm (Standard POS)");
      expect(html).toContain("देवनागरी मराठी फॉन्ट सुसंगतता");
      expect(html).toContain("तांबडा रस्सा • पांढरा रस्सा • मटण सुक्का");
      expect(html).toContain("Cash Drawer Pulse: Enabled");
      expect(html).toContain("[TEST PASSED]");
    });
  });
});
