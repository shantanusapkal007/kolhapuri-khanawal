import { describe, it, expect, beforeEach, vi } from "vitest";
import { RestaurantStore } from "@/lib/store/restaurant-store";
import { triggerHaptic } from "@/lib/mobile/haptics";
import { GET, POST } from "@/app/api/sync/route";

describe("Production Readiness Audit & Mobile/Operational Subsystem", () => {
  let store: RestaurantStore;
  let mockStorage: Record<string, string> = {};

  beforeEach(() => {
    mockStorage = {};

    // Mock localStorage
    const storageMock = {
      getItem: vi.fn((key: string) => mockStorage[key] || null),
      setItem: vi.fn((key: string, val: string) => {
        mockStorage[key] = val;
      }),
      removeItem: vi.fn((key: string) => {
        delete mockStorage[key];
      }),
      clear: vi.fn(() => {
        mockStorage = {};
      }),
    };

    vi.stubGlobal("localStorage", storageMock);
    vi.stubGlobal("window", {
      dispatchEvent: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      history: { pushState: vi.fn(), back: vi.fn() },
    });

    store = new RestaurantStore();
  });

  it("1. saves live operational state to localStorage on dining party creation", () => {
    store.createPartyAtTable(2, 3, "Baner Tech Group");

    expect(store.parties.length).toBeGreaterThan(0);
    const savedParty = store.parties.find((p) => p.tableNumber === 2);
    expect(savedParty).toBeDefined();
    expect(savedParty?.guestCount).toBe(3);

    // Explicitly flush state
    store.saveLiveOperationalState();

    expect(mockStorage["kk_live_operations_v1"]).toBeDefined();
    const parsed = JSON.parse(mockStorage["kk_live_operations_v1"]);
    expect(parsed.parties.some((p: any) => p.tableNumber === 2)).toBe(true);
    expect(parsed.senderId).toBe(store.instanceId);
  });

  it("2. rehydrates operational snapshot on initialization, preventing order loss on APK pause/reload", () => {
    // Simulate saved state from earlier session
    const fakeSnapshot = {
      version: Date.now() - 1000,
      senderId: "remote-device-99",
      tables: [
        {
          id: "tbl-5",
          tableNumber: 5,
          name: "Table 5",
          minCapacity: 1,
          maxCapacity: 4,
          section: "MAIN_HALL",
          status: "OCCUPIED",
          activePartiesCount: 1,
          totalActiveGuests: 2,
          updatedAt: new Date().toISOString(),
        },
      ],
      parties: [
        {
          id: "pty-saved-101",
          partyCode: "P-101",
          tableId: "tbl-5",
          tableNumber: 5,
          guestCount: 2,
          status: "FOOD_PENDING",
          runningSubtotal: 640,
          assignedWaiterId: "emp-rahul",
          assignedWaiterName: "Rahul Shinde",
          openedAt: new Date().toISOString(),
          lastActivityAt: new Date().toISOString(),
        },
      ],
      seats: [],
      orders: [
        {
          id: "ord-101",
          orderNumber: "ORD-101",
          partyId: "pty-saved-101",
          partyCode: "P-101",
          tableNumber: 5,
          waiterId: "emp-rahul",
          waiterName: "Rahul Shinde",
          status: "OPEN",
          idempotencyKey: "idem-101",
          items: [],
          subtotal: 640,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
      kots: [],
      kotEvents: [],
      bills: [],
      payments: [],
      cashLedger: [],
      upiLedger: [],
      ingredients: [],
      stockTransactions: [],
      stockReservations: [],
      wastageRecords: [],
      dailyClosings: [],
      purchases: [],
      expenses: [],
      supplierAdvances: [],
      supplierPayments: [],
      staffAdvances: [],
      attendance: [],
      checklistItems: [],
      notifications: [],
    };

    mockStorage["kk_live_operations_v1"] = JSON.stringify(fakeSnapshot);

    const rehydratedStore = new RestaurantStore();
    expect(rehydratedStore.parties.some((p) => p.id === "pty-saved-101")).toBe(true);
    expect(rehydratedStore.orders.some((o) => o.id === "ord-101")).toBe(true);
  });

  it("3. applies cross-device sync snapshot from local restaurant Wi-Fi relay", () => {
    const remoteSnapshot = {
      tables: [],
      parties: [
        {
          id: "pty-remote-777",
          partyCode: "P-777",
          tableId: "tbl-1",
          tableNumber: 1,
          guestCount: 4,
          status: "OPEN",
          runningSubtotal: 0,
          assignedWaiterId: "emp-nitin",
          assignedWaiterName: "Nitin Jadhav",
          openedAt: new Date().toISOString(),
          lastActivityAt: new Date().toISOString(),
        },
      ],
      seats: [],
      orders: [],
      kots: [],
      kotEvents: [],
      bills: [],
      payments: [],
      cashLedger: [],
      upiLedger: [],
      ingredients: [],
      stockTransactions: [],
      stockReservations: [],
      wastageRecords: [],
      dailyClosings: [],
      purchases: [],
      expenses: [],
      supplierAdvances: [],
      supplierPayments: [],
      staffAdvances: [],
      attendance: [],
      checklistItems: [],
      notifications: [],
    };

    store.applySyncSnapshot(remoteSnapshot, 123456789);

    expect(store.parties.some((p) => p.id === "pty-remote-777")).toBe(true);
    expect(store.lastSyncVersion).toBe(123456789);
  });

  it("4. local Wi-Fi relay endpoint (/api/sync) accepts state updates and responds with latest version", async () => {
    const postReq = new Request("http://localhost:3000/api/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        senderId: "waiter-tablet-01",
        version: 9999000,
        snapshot: {
          parties: [{ id: "p-sync-test", tableNumber: 3 }],
        },
      }),
    });

    const postRes = await POST(postReq);
    expect(postRes.status).toBe(200);
    const postBody = await postRes.json();
    expect(postBody.success).toBe(true);
    expect(postBody.version).toBe(9999000);

    const getRes = await GET();
    expect(getRes.status).toBe(200);
    const getBody = await getRes.json();
    expect(getBody.version).toBe(9999000);
    expect(getBody.senderId).toBe("waiter-tablet-01");
    expect(getBody.snapshot.parties[0].id).toBe("p-sync-test");
  });

  it("5. haptic vibration safely handles missing navigator or mobile vibration API", () => {
    // Should not throw even when navigator.vibrate does not exist
    expect(() => triggerHaptic("tap")).not.toThrow();
    expect(() => triggerHaptic("success")).not.toThrow();
    expect(() => triggerHaptic("error")).not.toThrow();

    // Mock navigator.vibrate
    const vibrateMock = vi.fn();
    vi.stubGlobal("navigator", { vibrate: vibrateMock });

    triggerHaptic("tap");
    expect(vibrateMock).toHaveBeenCalledWith(20);

    triggerHaptic("success");
    expect(vibrateMock).toHaveBeenCalledWith([35, 40, 45]);
  });
});
