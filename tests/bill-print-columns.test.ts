import { describe, it, expect } from "vitest";
import { generateBillReceiptHtml, generateTableCheckHtml } from "@/lib/printing/thermal-printer";
import { buildBillReceiptEscPos, buildTableCheckEscPos } from "@/lib/printing/escpos-builder";
import type { Bill } from "@/types/billing";

describe("Bill Printing Column Alignment (Description on Left, Qty Rate Amt on Right)", () => {
  const dummyBill = {
    id: "bill-test-01",
    billNumber: "BILL-2026-001",
    partyId: "party-01",
    tableNumber: 5,
    partyCode: "P-5A",
    waiterName: "Ramesh",
    cashierName: "Admin",
    subtotal: 760,
    discountAmount: 0,
    totalTaxAmount: 0,
    cgstAmount: 0,
    sgstAmount: 0,
    grandTotal: 760,
    paidAmount: 760,
    balanceAmount: 0,
    status: "PAID",
    createdAt: new Date().toISOString(),
    items: [
      {
        id: "item-1",
        billId: "bill-test-01",
        orderItemId: "oi-1",
        menuItemId: "m1",
        menuItemName: "Special Kolhapuri Mutton Thali",
        quantity: 2,
        unitPrice: 380,
        totalPrice: 760,
        taxRateId: "tax-1",
        taxRatePercentage: 0,
        taxAmount: 0,
        breadOption: "JWARI_BHAKRI",
      },
    ],
    payments: [
      {
        paymentMethod: "CASH",
        amount: 760,
      },
    ],
  } as unknown as Bill;

  it("HTML Bill Receipt formats columns with Description left and Qty, Rate, Amt right", () => {
    const html = generateBillReceiptHtml(dummyBill, false, "80mm");

    // Check headers
    expect(html).toContain('<th class="col-desc">Description</th>');
    expect(html).toContain('<th class="col-qty">Qty</th>');
    expect(html).toContain('<th class="col-rate">Rate</th>');
    expect(html).toContain('<th class="col-amt">Amt</th>');

    // Check CSS alignment rules
    expect(html).toContain("table.items-table th.col-desc");
    expect(html).toContain("text-align: left !important;");
    expect(html).toContain("table.items-table th.col-qty");
    expect(html).toContain("text-align: right !important;");

    // Check item data row cells
    expect(html).toContain('<td class="col-desc">');
    expect(html).toContain('<td class="col-qty">2</td>');
    expect(html).toContain('<td class="col-rate">₹380</td>');
    expect(html).toContain('<td class="col-amt">₹760.00</td>');
  });

  it("HTML Table Check Estimate formats columns with Description left and Qty, Rate, Amt right", () => {
    const html = generateTableCheckHtml({
      tableNumber: 5,
      partyCode: "P-5A",
      waiterName: "Ramesh",
      cashierName: "Admin",
      paperWidth: "80mm",
      items: [
        {
          id: "item-1",
          menuItemId: "m1",
          menuItemName: "Kolhapuri Chicken Thali",
          quantity: 1,
          unitPrice: 280,
          totalPrice: 280,
          breadOption: "CHAPATI",
        },
      ],
    });

    expect(html).toContain('<th class="col-desc">Description</th>');
    expect(html).toContain('<th class="col-qty">Qty</th>');
    expect(html).toContain('<th class="col-rate">Rate</th>');
    expect(html).toContain('<th class="col-amt">Amt</th>');
    expect(html).toContain('<td class="col-qty">1</td>');
  });

  it("ESC/POS 80mm Bill Receipt aligns columns across 48 columns (25 + 5 + 8 + 10)", () => {
    const bytes = buildBillReceiptEscPos(dummyBill, false, "80mm");
    const text = new TextDecoder("latin1").decode(bytes);

    // Check header line contains Description, Qty, Rate, Amt
    expect(text).toContain("Description");
    expect(text).toContain("Qty");
    expect(text).toContain("Rate");
    expect(text).toContain("Amt");

    // Header should be formatted as: Description(25) + Qty(5) + Rate(8) + Amt(10) = 48 printable columns
    const rawHeaderRow = text.split("\n").find((line) => line.includes("Description") && line.includes("Amt"));
    expect(rawHeaderRow).toBeDefined();
    // Strip ESC/POS control codes (ESC E 1, ESC E 0, etc.)
    const cleanHeader = rawHeaderRow?.replace(/\x1b./g, "").replace(/[\x00-\x1f]/g, "");
    expect(cleanHeader?.length).toBe(48);
    expect(cleanHeader?.endsWith("Amt")).toBe(true);
  });

  it("ESC/POS 58mm Bill Receipt aligns columns across 32 columns (15 + 3 + 6 + 8)", () => {
    const bytes = buildBillReceiptEscPos(dummyBill, false, "58mm");
    const text = new TextDecoder("latin1").decode(bytes);

    expect(text).toContain("Description");
    expect(text).toContain("Qty");
    expect(text).toContain("Rate");
    expect(text).toContain("Amt");

    // Header should be: Description(15) + Qty(3) + Rate(6) + Amt(8) = 32 printable columns
    const rawHeaderRow = text.split("\n").find((line) => line.includes("Description") && line.includes("Amt"));
    expect(rawHeaderRow).toBeDefined();
    const cleanHeader = rawHeaderRow?.replace(/\x1b./g, "").replace(/[\x00-\x1f]/g, "");
    expect(cleanHeader?.length).toBe(32);
    expect(cleanHeader?.endsWith("Amt")).toBe(true);
  });

  it("ESC/POS Table Check aligns columns properly for 80mm and 58mm", () => {
    const bytes80 = buildTableCheckEscPos({
      party: {
        id: "p1",
        tableNumber: 2,
        partyCode: "T2",
        guestCount: 2,
        status: "OCCUPIED",
        runningSubtotal: 300,
        createdAt: new Date().toISOString(),
        orderCount: 1,
      },
      items: [
        {
          id: "it-1",
          menuItemId: "m1",
          menuItemName: "Tambda Rassa",
          quantity: 2,
          unitPrice: 60,
          totalPrice: 120,
        },
      ],
      paperWidth: "80mm",
    });

    const text80 = new TextDecoder("latin1").decode(bytes80);
    const rawHeaderRow80 = text80.split("\n").find((line) => line.includes("Description") && line.includes("Amt"));
    expect(rawHeaderRow80).toBeDefined();
    const cleanHeader80 = rawHeaderRow80?.replace(/\x1b./g, "").replace(/[\x00-\x1f]/g, "");
    expect(cleanHeader80?.length).toBe(48);
  });
});
