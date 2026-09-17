import { describe, it, expect, beforeEach } from "vitest";
import { RestaurantStore } from "@/lib/store/restaurant-store";

describe("Parcel / Takeaway Flow & Bill Paid Table Vacating", () => {
  let store: RestaurantStore;

  beforeEach(() => {
    store = new RestaurantStore();
  });

  it("creates a takeaway parcel with tableNumber 0 and does not occupy tables 1–12", () => {
    // Check initial table states (all 12 available)
    const initialAvailable = store.tables.filter((t) => t.status === "AVAILABLE").length;
    expect(initialAvailable).toBe(12);

    // Create a takeaway parcel
    const parcelParty = store.createTakeawayParty("Mahesh Shinde", "9876543210", 20);

    expect(parcelParty.isTakeaway).toBe(true);
    expect(parcelParty.tableNumber).toBe(0);
    expect(parcelParty.partyCode).toMatch(/^PARCEL-\d{2}$/);
    expect(parcelParty.customerName).toBe("Mahesh Shinde");
    expect(parcelParty.packagingCharges).toBe(20);

    // Verify all 12 physical tables are STILL AVAILABLE!
    const availableAfterParcel = store.tables.filter((t) => t.status === "AVAILABLE").length;
    expect(availableAfterParcel).toBe(12);
  });

  it("converts a dining table party to a takeaway parcel and frees the physical table immediately", () => {
    // Open a party at Table 3
    const table3Party = store.createPartyAtTable(3, 2, "Window Seat");
    expect(store.tables.find((t) => t.tableNumber === 3)?.status).toBe("OCCUPIED");

    // Guest decides to take it as parcel
    const converted = store.convertToTakeawayParty(table3Party.id, "Dr. Patil");
    expect(converted.isTakeaway).toBe(true);
    expect(converted.tableNumber).toBe(0);
    expect(converted.partyCode).toMatch(/^PARCEL-/);

    // Table 3 must be FREE (AVAILABLE) now!
    const table3 = store.tables.find((t) => t.tableNumber === 3);
    expect(table3?.status).toBe("AVAILABLE");
    expect(table3?.activePartiesCount).toBe(0);
  });

  it("allows quick settlement of a parcel order without altering physical tables", () => {
    const parcelParty = store.createTakeawayParty("Suresh", "9988776655", 20);

    // Place an order for this parcel
    const muttonDish = store.menuItems.find((m) => m.name.includes("Mutton") || m.name.includes("Thali")) || store.menuItems[0];
    store.placeOrder(parcelParty.id, [
      {
        menuItemId: muttonDish.id,
        quantity: 1,
      },
    ]);

    const activeParcel = store.parties.find((p) => p.id === parcelParty.id);
    expect(activeParcel?.runningSubtotal).toBeGreaterThan(0);

    // Quick settle with Cash
    const result = store.quickSettleBill(parcelParty.id, "CASH");
    expect(result.bill.status).toBe("PAID");
    expect(result.message).toContain("Parcel");

    const updatedParty = store.parties.find((p) => p.id === parcelParty.id);
    expect(updatedParty?.status).toBe("CLOSED");

    // Tables 1-12 must remain 100% available
    const availableTables = store.tables.filter((t) => t.status === "AVAILABLE").length;
    expect(availableTables).toBe(12);
  });
});
