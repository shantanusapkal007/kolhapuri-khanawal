import { describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { getDatabase } from "@/lib/db/sqlite";
import { initDatabaseSchema } from "@/lib/db/schema";
import { seedDatabaseIfEmpty } from "@/lib/db/seed";

import { POST as loginRoute } from "@/app/api/auth/login/route";
import { GET as meRoute } from "@/app/api/auth/me/route";
import { GET as getTablesRoute, POST as postTablesRoute } from "@/app/api/tables/route";
import { POST as postOrdersRoute } from "@/app/api/orders/route";
import { GET as getBillsRoute, POST as postBillsRoute } from "@/app/api/bills/route";
import { GET as getHealthRoute } from "@/app/api/health/route";

describe("Server-Side REST APIs End-to-End", () => {
  beforeEach(() => {
    const db = getDatabase();
    initDatabaseSchema(db);
    seedDatabaseIfEmpty(db);
  });

  it("POST /api/auth/login: authenticates with valid credentials and sets session cookie", async () => {
    const req = new NextRequest("http://localhost:3000/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username: "admin", pin: "1234" }),
    });

    const res = await loginRoute(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.user.username).toBe("admin");
    expect(data.user.role).toBe("OWNER");
    expect(data.token).toBeDefined();

    // Verify session cookie was set
    const cookie = res.cookies.get("auth_session");
    expect(cookie?.value).toBe(data.token);
  });

  it("POST /api/auth/login: rejects invalid PIN with 401", async () => {
    const req = new NextRequest("http://localhost:3000/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username: "admin", pin: "9999" }),
    });

    const res = await loginRoute(req);
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.success).toBe(false);
  });

  it("GET /api/health: reports HEALTHY with table and item counts", async () => {
    const res = await getHealthRoute();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe("HEALTHY");
    expect(data.database.counts.tables).toBe(11);
    expect(data.database.counts.menuItems).toBeGreaterThan(100);
  });

  it("Full POS lifecycle via REST APIs: Table -> Order/KOT -> Bill -> Pay", async () => {
    // 1. Get Tables
    const tablesRes = await getTablesRoute(new NextRequest("http://localhost:3000/api/tables"));
    const tablesData = await tablesRes.json();
    expect(tablesData.tables.length).toBe(11);

    // 2. Seat Party at Table 6 (B3)
    const seatReq = new NextRequest("http://localhost:3000/api/tables", {
      method: "POST",
      body: JSON.stringify({
        action: "SEAT",
        tableNumber: 6,
        guestCount: 3,
        waiterId: "u-wtr-01",
        waiterName: "Rahul",
      }),
    });
    const seatRes = await postTablesRoute(seatReq);
    expect(seatRes.status).toBe(200);
    const seatData = await seatRes.json();
    expect(seatData.party.tableNumber).toBe(6);
    const partyId = seatData.party.id;

    // 3. Place Order & KOT via POST /api/orders
    const orderReq = new NextRequest("http://localhost:3000/api/orders", {
      method: "POST",
      body: JSON.stringify({
        idempotencyKey: "test-api-idem-1",
        partyId,
        items: [
          {
            menuItemId: "item-thali-01",
            menuItemName: "Special Mutton Thali",
            quantity: 2,
            unitPrice: 350,
          },
        ],
        waiterId: "u-wtr-01",
        waiterName: "Rahul",
      }),
    });
    const orderRes = await postOrdersRoute(orderReq);
    expect(orderRes.status).toBe(200);
    const orderData = await orderRes.json();
    expect(orderData.kot.kotNumber).toMatch(/^KOT-2026-\d{6}$/);
    expect(orderData.party.runningSubtotal).toBe(700);

    // 4. Generate Bill via POST /api/bills
    const billReq = new NextRequest("http://localhost:3000/api/bills", {
      method: "POST",
      body: JSON.stringify({
        action: "GENERATE",
        partyId,
        cashierId: "u-csh-01",
        cashierName: "Priya",
      }),
    });
    const billRes = await postBillsRoute(billReq);
    expect(billRes.status).toBe(200);
    const billData = await billRes.json();
    expect(billData.bill.billNumber).toMatch(/^BILL-2026-\d{6}$/);
    expect(billData.bill.subtotal).toBe(700);
    const billId = billData.bill.id;

    // 5. Apply ₹50 Discount
    const discReq = new NextRequest("http://localhost:3000/api/bills", {
      method: "POST",
      body: JSON.stringify({
        action: "DISCOUNT",
        billId,
        discountAmount: 50,
        reason: "VIP Guest",
      }),
    });
    const discRes = await postBillsRoute(discReq);
    expect(discRes.status).toBe(200);
    const discData = await discRes.json();
    expect(discData.bill.discountAmount).toBe(50);
    // Statutory bill number must be preserved
    expect(discData.bill.billNumber).toBe(billData.bill.billNumber);

    // 6. Pay Bill via POST /api/bills (action: "PAY")
    const payReq = new NextRequest("http://localhost:3000/api/bills", {
      method: "POST",
      body: JSON.stringify({
        action: "PAY",
        billId,
        paymentMethod: "UPI",
        tenderAmount: discData.bill.grandTotal,
        idempotencyKey: "pay-api-idem-1",
        cashierId: "u-csh-01",
        cashierName: "Priya",
      }),
    });
    const payRes = await postBillsRoute(payReq);
    expect(payRes.status).toBe(200);
    const payData = await payRes.json();
    expect(payData.bill.status).toBe("PAID");
    expect(payData.payment.paymentMethod).toBe("UPI");

    // Table 6 must be vacated and AVAILABLE
    const tableCheckRes = await getTablesRoute(new NextRequest("http://localhost:3000/api/tables"));
    const tableCheckData = await tableCheckRes.json();
    const table6 = tableCheckData.tables.find((t: any) => t.tableNumber === 6);
    expect(table6.status).toBe("AVAILABLE");
  });
});
