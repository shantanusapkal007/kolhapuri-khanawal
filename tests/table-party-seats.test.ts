import { describe, it, expect, beforeEach } from "vitest";
import { RestaurantStore } from "@/lib/store/restaurant-store";
import { splitPartyItems } from "@/lib/tables/party-service";

describe("Shared Tables, Dining Parties & Seat Management Lifecycle", () => {
  let store: RestaurantStore;

  beforeEach(() => {
    store = new RestaurantStore();
  });

  it("Scenario 1: Two independent parties share Table 4, order separately, and table stays OCCUPIED/SHARED until both close", () => {
    const table4 = store.tables.find((t) => t.tableNumber === 4)!;
    expect(table4.status).toBe("AVAILABLE");

    // Party A arrives (2 guests)
    const partyA = store.createPartyAtTable(4, 2, "Party A");
    expect(partyA.partyCode).toBe("T4-P01");

    let updatedTable4 = store.tables.find((t) => t.tableNumber === 4)!;
    expect(updatedTable4.status).toBe("OCCUPIED");
    expect(updatedTable4.activePartiesCount).toBe(1);

    // Party B arrives at the same table (1 guest)
    const partyB = store.createPartyAtTable(4, 1, "Party B (Single Customer)");
    expect(partyB.partyCode).toBe("T4-P02");

    updatedTable4 = store.tables.find((t) => t.tableNumber === 4)!;
    expect(updatedTable4.status).toBe("SHARED");
    expect(updatedTable4.activePartiesCount).toBe(2);

    // Party A orders 2x Chicken Thali + 1x Solkadhi
    store.placeOrder(partyA.id, [
      { menuItemId: "menu-chicken-thali", quantity: 2, seatNumber: 1 },
      { menuItemId: "menu-solkadhi", quantity: 1, seatNumber: 2 },
    ]);

    // Party B orders 1x Veg Thali
    store.placeOrder(partyB.id, [
      { menuItemId: "menu-veg-thali", quantity: 1, seatNumber: 1 },
    ]);

    // Generate Bill for Party A
    const billA = store.generateBillForParty(partyA.id);
    expect(billA.partyCode).toBe("T4-P01");
    expect(billA.subtotal).toBe(250 * 2 + 40); // ₹540

    // Party A pays and closes
    store.payBill(billA.id, "UPI", billA.grandTotal, "UPI-UTR-999123");

    const closedPartyA = store.parties.find((p) => p.id === partyA.id)!;
    expect(closedPartyA.status).toBe("CLOSED");

    // Table 4 MUST NOT become AVAILABLE because Party B is still active!
    updatedTable4 = store.tables.find((t) => t.tableNumber === 4)!;
    expect(updatedTable4.status).toBe("OCCUPIED");
    expect(updatedTable4.activePartiesCount).toBe(1);

    // Now Party B requests bill & pays
    const billB = store.generateBillForParty(partyB.id);
    expect(billB.partyCode).toBe("T4-P02");
    store.payBill(billB.id, "CASH", billB.grandTotal);

    // Now Table 4 has 0 active parties -> MUST become AVAILABLE
    updatedTable4 = store.tables.find((t) => t.tableNumber === 4)!;
    expect(updatedTable4.status).toBe("AVAILABLE");
    expect(updatedTable4.activePartiesCount).toBe(0);
  });

  it("Scenario 2: Transfer only Party B from Table 6 to Table 9 while Party A stays at Table 6", () => {
    const partyA = store.createPartyAtTable(6, 4, "Party A (Family)");
    const partyB = store.createPartyAtTable(6, 2, "Party B (Couple)");

    let table6 = store.tables.find((t) => t.tableNumber === 6)!;
    let table9 = store.tables.find((t) => t.tableNumber === 9)!;
    expect(table6.status).toBe("SHARED");
    expect(table9.status).toBe("AVAILABLE");

    // Transfer only Party B to Table 9
    store.transferPartyToTable(partyB.id, 9);

    table6 = store.tables.find((t) => t.tableNumber === 6)!;
    table9 = store.tables.find((t) => t.tableNumber === 9)!;

    expect(table6.status).toBe("OCCUPIED");
    expect(table6.activePartiesCount).toBe(1);

    expect(table9.status).toBe("OCCUPIED");
    expect(table9.activePartiesCount).toBe(1);
  });

  it("Scenario 3: Merge Party A and Party B into a single party with audit trail", () => {
    const partyA = store.createPartyAtTable(5, 2, "Party A");
    const partyB = store.createPartyAtTable(5, 3, "Party B");

    store.placeOrder(partyA.id, [{ menuItemId: "menu-chicken-thali", quantity: 2 }]);
    store.placeOrder(partyB.id, [{ menuItemId: "menu-mutton-thali", quantity: 1 }]);

    const mergedParty = store.mergePartiesTogether([partyA.id, partyB.id]);
    expect(mergedParty.guestCount).toBe(5);

    const table5 = store.tables.find((t) => t.tableNumber === 5)!;
    expect(table5.status).toBe("OCCUPIED");
    expect(table5.activePartiesCount).toBe(1);
  });

  it("Scenario 4: One-Tap Bill Paid & Close Table (quickSettleBill) marks party closed, settles bill, and frees table immediately", () => {
    const table2 = store.tables.find((t) => t.tableNumber === 2)!;
    expect(table2.status).toBe("AVAILABLE");

    const party = store.createPartyAtTable(2, 4, "Patil Family");
    expect(store.tables.find((t) => t.tableNumber === 2)!.status).toBe("OCCUPIED");

    // Order dishes
    store.placeOrder(party.id, [
      { menuItemId: "menu-mutton-thali", quantity: 2 },
      { menuItemId: "menu-solkadhi", quantity: 2 },
    ]);

    // Fast 1-tap Bill Paid
    const result = store.quickSettleBill(party.id, "CASH");
    expect(result.bill.status).toBe("PAID");
    expect(result.bill.paidAmount).toBe(result.bill.grandTotal);
    expect(result.message).toContain("Table 2");
    expect(result.message).toContain("Table closed");

    // Table 2 must be AVAILABLE immediately
    const freedTable2 = store.tables.find((t) => t.tableNumber === 2)!;
    expect(freedTable2.status).toBe("AVAILABLE");
    expect(freedTable2.activePartiesCount).toBe(0);

    // Party must be CLOSED
    const closedParty = store.parties.find((p) => p.id === party.id)!;
    expect(closedParty.status).toBe("CLOSED");
  });
});
