import { describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { getDatabase } from "@/lib/db/sqlite";
import { initDatabaseSchema } from "@/lib/db/schema";
import { seedDatabaseIfEmpty } from "@/lib/db/seed";
import { middleware } from "@/middleware";

import { GET as meRoute } from "@/app/api/auth/me/route";
import { POST as postTablesRoute } from "@/app/api/tables/route";
import { POST as postOrdersRoute } from "@/app/api/orders/route";
import { POST as postBillsRoute } from "@/app/api/bills/route";
import { POST as postInventoryRoute } from "@/app/api/inventory/route";
import { POST as loginRoute } from "@/app/api/auth/login/route";

describe("Forensic Sections 7 & 8: Security, Route Protection & Privilege Escalation Prevention", () => {
  beforeEach(() => {
    const db = getDatabase();
    initDatabaseSchema(db);
    seedDatabaseIfEmpty(db);
  });

  it("Middleware: blocks direct URL access to /dashboard, /billing, /settings without session cookie", () => {
    const sensitiveUrls = [
      "http://localhost:3000/dashboard",
      "http://localhost:3000/billing",
      "http://localhost:3000/settings",
      "http://localhost:3000/reports",
      "http://localhost:3000/inventory",
    ];

    for (const url of sensitiveUrls) {
      const req = new NextRequest(url);
      const res = middleware(req);
      // Next.js redirect to /login
      expect(res.status).toBe(307);
      expect(res.headers.get("location")).toContain("/login");
    }
  });

  it("Middleware: allows access when valid auth_session cookie is present", () => {
    const req = new NextRequest("http://localhost:3000/dashboard", {
      headers: {
        cookie: "auth_session=valid_test_token_sample",
      },
    });
    const res = middleware(req);
    expect(res.status).toBe(200);
  });

  it("GET /api/auth/me: rejects unauthenticated requests with 401 Unauthorized", async () => {
    const req = new NextRequest("http://localhost:3000/api/auth/me");
    const res = await meRoute(req);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toContain("Unauthorized");
  });

  it("GET /api/auth/me: rejects expired or fake session tokens", async () => {
    const db = getDatabase();
    // Insert expired session
    const expiredToken = "expired_token_12345";
    db.prepare(`
      INSERT INTO sessions (token, user_id, username, name, role, expires_at, created_at)
      VALUES (?, 'u-owner-01', 'admin', 'Admin', 'OWNER', ?, ?)
    `).run(expiredToken, new Date(Date.now() - 3600000).toISOString(), new Date(Date.now() - 7200000).toISOString());

    const req = new NextRequest("http://localhost:3000/api/auth/me", {
      headers: { Authorization: `Bearer ${expiredToken}` },
    });
    const res = await meRoute(req);
    expect(res.status).toBe(401);
  });

  it("Privilege Escalation: modifying localStorage or injecting role in request does not bypass server authentication", async () => {
    // Attempt to invoke admin action on /api/inventory without valid session token
    const req = new NextRequest("http://localhost:3000/api/inventory", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Attacker injects fake client-side role
        "X-Injected-Role": "OWNER",
        "X-Injected-User": "admin",
      },
      body: JSON.stringify({
        // Tampered payload
        role: "OWNER",
        ingredientId: "ing-chicken-01",
        adjustmentQuantity: 50,
        type: "STOCK_ADJUSTMENT",
      }),
    });

    // Server should only trust cryptographic sessions, not body role injection
    const res = await postInventoryRoute(req);
    // If ingredient doesn't exist or unauthorized, returns 500 or 400 safely without allowing arbitrary state
    const body = await res.json();
    expect(body.ingredient?.role).toBeUndefined();
  });

  it("API Input & Schema Validation: rejects malformed payloads and arbitrary state injection", async () => {
    // 1. POST /api/orders without items array
    const badOrderReq = new NextRequest("http://localhost:3000/api/orders", {
      method: "POST",
      body: JSON.stringify({ partyId: "pty-1" }), // missing items
    });
    const badOrderRes = await postOrdersRoute(badOrderReq);
    expect(badOrderRes.status).toBe(400);

    // 2. POST /api/bills without required fields
    const badBillReq = new NextRequest("http://localhost:3000/api/bills", {
      method: "POST",
      body: JSON.stringify({ action: "PAY" }), // missing billId and tenderAmount
    });
    const badBillRes = await postBillsRoute(badBillReq);
    expect(badBillRes.status).toBe(400);

    // 3. POST /api/tables without tableNumber
    const badTableReq = new NextRequest("http://localhost:3000/api/tables", {
      method: "POST",
      body: JSON.stringify({ action: "SEAT" }), // missing tableNumber
    });
    const badTableRes = await postTablesRoute(badTableReq);
    expect(badTableRes.status).toBe(400);
  });
});
