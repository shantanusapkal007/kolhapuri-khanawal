import { describe, it, expect, beforeEach } from "vitest";
import { RestaurantStore } from "@/lib/store/restaurant-store";
import {
  getDraftCart,
  saveDraftCart,
  clearDraftCart,
  getAllDraftCartCounts,
} from "@/lib/orders/draft-cart";

describe("Fast POS Restaurant Operations Workflow", () => {
  let store: RestaurantStore;

  beforeEach(() => {
    store = new RestaurantStore();
    // Clear draft carts
    const counts = getAllDraftCartCounts();
    Object.keys(counts).forEach((pId) => clearDraftCart(pId));
  });

  describe("1. Draft Cart Persistence & Table Switching", () => {
    it("persists uncommitted cart items in memory/storage across table navigation", () => {
      const partyId1 = "party-tbl-1";
      const partyId2 = "party-tbl-2";

      const chickenThali = store.menuItems.find((m) => m.id === "menu-chicken-thali")!;
      const solkadhi = store.menuItems.find((m) => m.id === "menu-solkadhi")!;
      const vegThali = store.menuItems.find((m) => m.id === "menu-veg-thali")!;

      const cart1 = [
        {
          menuItem: chickenThali,
          unitPrice: chickenThali.sellingPrice,
          quantity: 2,
        },
        {
          menuItem: solkadhi,
          unitPrice: solkadhi.sellingPrice,
          quantity: 3,
        },
      ];

      saveDraftCart(partyId1, cart1);

      // Table hopping: Waiter checks Table 2
      expect(getDraftCart(partyId2)).toEqual([]);

      // Waiter adds item to Table 2
      saveDraftCart(partyId2, [
        {
          menuItem: vegThali,
          unitPrice: vegThali.sellingPrice,
          quantity: 1,
        },
      ]);

      // Verify Table 1's draft was NOT lost
      const retrievedCart1 = getDraftCart(partyId1);
      expect(retrievedCart1).toHaveLength(2);
      expect(retrievedCart1[0].menuItem.id).toBe("menu-chicken-thali");
      expect(retrievedCart1[0].quantity).toBe(2);

      // Verify counts badge helper for Floor Map
      const counts = getAllDraftCartCounts();
      expect(counts[partyId1]).toBe(5); // 2 + 3
      expect(counts[partyId2]).toBe(1);

      // Clear draft cart after sending KOT
      clearDraftCart(partyId1);
      expect(getDraftCart(partyId1)).toEqual([]);
      expect(getAllDraftCartCounts()[partyId1]).toBeUndefined();
    });
  });

  describe("2. Fast Table Seating & 1-Tap Ordering", () => {
    it("seats a table in 1 tap, transitions status to OCCUPIED and adds items", () => {
      const table3 = store.tables.find((t) => t.tableNumber === 3)!;
      expect(table3.status).toBe("AVAILABLE");

      // 1-Tap Seat
      const party = store.createPartyAtTable(3, 4, "T3-Party");
      expect(party.partyCode).toBe("T3-P01");

      const occupiedTable = store.tables.find((t) => t.tableNumber === 3)!;
      expect(occupiedTable.status).toBe("OCCUPIED");
      expect(occupiedTable.activePartiesCount).toBe(1);

      // 1-Tap item additions
      const orderItems = [
        { menuItemId: "menu-chicken-thali", quantity: 1, seatNumber: 1 },
        { menuItemId: "menu-solkadhi", quantity: 2, seatNumber: 1 },
      ];
      const result = store.placeOrder(party.id, orderItems);
      expect(result.kot).toBeDefined();
      expect(result.kot.items).toHaveLength(2);

      const partyOrders = store.orders.filter((o) => o.partyId === party.id);
      expect(partyOrders).toHaveLength(1);

      const updatedParty = store.parties.find((p) => p.id === party.id)!;
      expect(updatedParty.runningSubtotal).toBeGreaterThan(0);
    });
  });

  describe("3. Multi-KOT Kitchen Workflow (Starters -> Mains -> Extra Bhakri)", () => {
    it("supports multiple sequential KOTs without resetting party, accumulating total seamlessly", () => {
      const party = store.createPartyAtTable(5, 2, "Guests");

      // KOT 1: Starters
      const kot1Res = store.placeOrder(party.id, [
        { menuItemId: "menu-solkadhi", quantity: 2, seatNumber: 1 },
      ]);
      const kot1Number = kot1Res.kot.kotNumber;
      expect(kot1Number).toBeDefined();

      // Waiter stays on order page, adds KOT 2: Main Thalis
      const kot2Res = store.placeOrder(party.id, [
        { menuItemId: "menu-chicken-thali", quantity: 2, seatNumber: 1 },
      ]);
      const kot2Number = kot2Res.kot.kotNumber;
      expect(kot2Number).toBeDefined();
      expect(kot2Number).not.toBe(kot1Number);

      // Waiter adds KOT 3: Extra Jowar Bhakri
      const kot3Res = store.placeOrder(party.id, [
        { menuItemId: "menu-bhakri", quantity: 4, seatNumber: 1 },
      ]);
      expect(kot3Res.kot.kotNumber).toBeDefined();
      expect(kot3Res.kot.kotNumber).not.toBe(kot2Number);

      // Verify party tracking
      const partyOrders = store.orders.filter((o) => o.partyId === party.id);
      expect(partyOrders).toHaveLength(3);

      const partyKots = store.kots.filter((k) => k.partyId === party.id);
      expect(partyKots).toHaveLength(3);

      const activeParty = store.parties.find((p) => p.id === party.id)!;
      expect(activeParty.runningSubtotal).toBe(2 * 40 + 2 * 250 + 4 * 25);
    });
  });

  describe("4. Cashier 1-Tap Settlement & Auto Table Clearance", () => {
    it("settles balance in 1-tap with Cash, updates party to CLOSED and clears table to AVAILABLE", () => {
      const party = store.createPartyAtTable(7, 2, "Cash Test");
      store.placeOrder(party.id, [
        { menuItemId: "menu-chicken-thali", quantity: 2, seatNumber: 1 },
      ]);

      const bill = store.generateBillForParty(party.id);
      expect(bill.balanceDue).toBe(bill.grandTotal);
      expect(bill.status).toBe("OPEN");

      // 1-Tap Cash Settlement
      const result = store.payBill(bill.id, "CASH", bill.balanceDue);
      expect(result.isFullyPaid).toBe(true);
      expect(result.bill.status).toBe("PAID");
      expect(result.bill.balanceDue).toBe(0);

      // Party is closed
      const closedParty = store.parties.find((p) => p.id === party.id)!;
      expect(closedParty.status).toBe("CLOSED");

      // Table 7 is immediately available for next guests
      const table7 = store.tables.find((t) => t.tableNumber === 7)!;
      expect(table7.status).toBe("AVAILABLE");
      expect(table7.activePartiesCount).toBe(0);
    });

    it("settles balance in 1-tap with UPI QR, generating transaction audit", () => {
      const party = store.createPartyAtTable(8, 2, "UPI Test");
      store.placeOrder(party.id, [
        { menuItemId: "menu-chicken-thali", quantity: 1, seatNumber: 1 },
      ]);

      const bill = store.generateBillForParty(party.id);

      // 1-Tap UPI Settlement
      const result = store.payBill(bill.id, "UPI", bill.balanceDue, "UPI-QR-FAST-888");
      expect(result.isFullyPaid).toBe(true);
      expect(result.bill.status).toBe("PAID");
      expect(result.bill.payments[0].paymentMethod).toBe("UPI");

      const table8 = store.tables.find((t) => t.tableNumber === 8)!;
      expect(table8.status).toBe("AVAILABLE");
    });
  });

  describe("5. Fast Takeaway / Parcel Workflow", () => {
    it("creates takeaway parcel order with packaging charge in 1-tap and settles instantly", () => {
      // 1-Tap Takeaway creation
      const party = store.createTakeawayParty(
        "Ramesh K",
        "9822012345",
        20 // standard packaging charge
      );
      expect(party.isTakeaway).toBe(true);
      expect(party.packagingCharges).toBe(20);

      // Add Parcel items
      store.placeOrder(party.id, [
        { menuItemId: "menu-chicken-thali", quantity: 1, seatNumber: 1 },
        { menuItemId: "menu-bhakri", quantity: 3, seatNumber: 1 },
      ]);

      // Generate Bill
      const bill = store.generateBillForParty(party.id);
      expect(bill.packagingCharges).toBe(20);
      expect(bill.grandTotal).toBe(bill.subtotal + bill.totalTaxAmount + 20 + bill.roundOff);

      // Quick settle
      const settled = store.quickSettleBill(party.id, "UPI");
      expect(settled.bill.status).toBe("PAID");
    });
  });
});
