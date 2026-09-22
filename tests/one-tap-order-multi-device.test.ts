import { describe, it, expect, beforeEach } from "vitest";
import { RestaurantStore } from "@/lib/store/restaurant-store";
import { GET, POST } from "@/app/api/sync/route";

describe("1-Tap Order, Real-time Multi-Device Status & Resilient Menu Sync", () => {
  let store: RestaurantStore;

  beforeEach(() => {
    store = new RestaurantStore();
  });

  it("1. Seating a table and setting ordering status transitions party to ORDERING for other devices", () => {
    // 1-tap seat at Table 2 (B1)
    const party = store.createPartyAtTable(2, 2, "1-Tap Diners");
    expect(party.status).toBe("OPEN");
    expect(party.tableNumber).toBe(2);

    // Terminal enters menu -> setPartyOrdering(party.id, true)
    store.setPartyOrdering(party.id, true);

    const activeParty = store.parties.find((p) => p.id === party.id);
    expect(activeParty).toBeDefined();
    expect(activeParty?.status).toBe("ORDERING");

    // Physical table must be OCCUPIED
    const table2 = store.tables.find((t) => t.tableNumber === 2);
    expect(table2?.status).toBe("OCCUPIED");
    expect(table2?.activePartiesCount).toBe(1);
  });

  it("2. When order is placed, party transitions to FOOD_PENDING and remains active on menu", () => {
    const party = store.createPartyAtTable(3, 2, "Hungry Guests");
    store.setPartyOrdering(party.id, true);
    expect(party.status).toBe("ORDERING");

    // Waiter sends KOT from menu
    const result = store.placeOrder(party.id, [
      { menuItemId: "menu-chicken-thali", quantity: 2 },
    ]);

    expect(result.order).toBeDefined();
    expect(result.kot).toBeDefined();

    // Party must now be FOOD_PENDING with updated running subtotal
    const updatedParty = store.parties.find((p) => p.id === party.id);
    expect(updatedParty?.status).toBe("FOOD_PENDING");
    expect(updatedParty?.runningSubtotal).toBeGreaterThan(0);

    // Party MUST NOT be removed from store
    expect(store.parties.some((p) => p.id === party.id)).toBe(true);
  });

  it("3. applySyncSnapshot preserves active in-flight parties when remote snapshot is missing them", () => {
    // Waiter seats party locally
    const localParty = store.createPartyAtTable(5, 4, "Family Table");
    store.setPartyOrdering(localParty.id, true);

    // A remote sync arrives from cashier or kitchen terminal that does not yet know about this new party
    const remoteSnapshotWithoutLocalParty = {
      parties: [
        {
          id: "party-remote-01",
          partyCode: "A1-P01",
          tableId: "tbl-1",
          tableNumber: 1,
          guestCount: 2,
          assignedWaiterId: "u-wtr-01",
          assignedWaiterName: "Rahul",
          status: "OPEN",
          runningSubtotal: 0,
          runningGrandTotal: 0,
          openedAt: new Date().toISOString(),
          lastActivityAt: new Date().toISOString(),
        },
      ],
      tables: store.tables,
    };

    // Apply remote snapshot
    store.applySyncSnapshot(remoteSnapshotWithoutLocalParty, Date.now() + 100);

    // Remote party must be present
    expect(store.parties.some((p) => p.id === "party-remote-01")).toBe(true);

    // CRITICAL: Local in-flight party MUST NOT be wiped out!
    const retainedLocalParty = store.parties.find((p) => p.id === localParty.id);
    expect(retainedLocalParty).toBeDefined();
    expect(retainedLocalParty?.status).toBe("ORDERING");
    expect(retainedLocalParty?.tableNumber).toBe(5);

    // Table 5 occupancy must be preserved as OCCUPIED
    const table5 = store.tables.find((t) => t.tableNumber === 5);
    expect(table5?.status).toBe("OCCUPIED");
  });

  it("4. Server relay sync /api/sync merges client parties so all devices receive active orders", async () => {
    const testParty = {
      id: `pty-test-${Date.now()}`,
      partyCode: "B2-P01",
      tableId: "tbl-3",
      tableNumber: 3,
      guestCount: 3,
      assignedWaiterId: "u-wtr-02",
      assignedWaiterName: "Nitin",
      status: "ORDERING",
      runningSubtotal: 0,
      runningGrandTotal: 0,
      openedAt: new Date().toISOString(),
      lastActivityAt: new Date().toISOString(),
    };

    // Device A pushes party in snapshot to POST /api/sync
    const postReq = new Request("http://localhost:3000/api/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        senderId: "waiter-device-a",
        version: Date.now(),
        snapshot: {
          parties: [testParty],
        },
      }),
    });

    const postRes = await POST(postReq);
    expect(postRes.status).toBe(200);
    const postData = await postRes.json();
    expect(postData.success).toBe(true);
    expect(postData.snapshot.parties.some((p: any) => p.id === testParty.id)).toBe(true);

    // Device B calls GET /api/sync -> MUST receive testParty with ORDERING status
    const getRes = await GET();
    expect(getRes.status).toBe(200);
    const getData = await getRes.json();
    expect(getData.success).toBe(true);

    const syncedParty = getData.snapshot.parties.find((p: any) => p.id === testParty.id);
    expect(syncedParty).toBeDefined();
    expect(syncedParty.status).toBe("ORDERING");
    expect(syncedParty.tableNumber).toBe(3);

    // Corresponding table in snapshot must reflect OCCUPIED
    const table3 = getData.snapshot.tables.find((t: any) => t.tableNumber === 3);
    expect(table3).toBeDefined();
    expect(table3.status).toBe("OCCUPIED");
  });
});
