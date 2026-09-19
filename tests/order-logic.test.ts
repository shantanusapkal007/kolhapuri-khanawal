import { describe, it, expect, beforeEach } from "vitest";
import { RestaurantStore } from "../src/lib/store/restaurant-store";

describe("Comprehensive Order Logic for Tables and Parcels", () => {
  let store: RestaurantStore;

  beforeEach(() => {
    store = new RestaurantStore();
  });

  it("1. Dining Table: creates party, places order, updates runningSubtotal, and generates bill", () => {
    const party = store.createPartyAtTable(3, 4, "Patil Family");
    expect(party.tableNumber).toBe(3);
    expect(Boolean(party.isTakeaway)).toBe(false);
    expect(party.packagingCharges || 0).toBe(0);

    const thaliItem = store.menuItems.find((m) => m.categoryId === "THALI") || store.menuItems[0];
    const orderResult = store.placeOrder(party.id, [
      {
        menuItemId: thaliItem.id,
        quantity: 2,
        breadOption: "JOWAR_BHAKRI",
        notes: "2 ज्वारी भाकरी",
        unitPrice: thaliItem.sellingPrice,
      },
    ]);

    expect(orderResult.order.items.length).toBe(1);
    expect(orderResult.kot.tableNumber).toBe(3);
    expect(Boolean(orderResult.kot.isTakeaway)).toBe(false);

    const updatedParty = store.parties.find((p) => p.id === party.id);
    expect(updatedParty?.runningSubtotal).toBe(thaliItem.sellingPrice * 2);

    // Bill generation
    const bill = store.generateBillForParty(party.id);
    expect(bill.tableNumber).toBe(3);
    expect(bill.packagingCharges || 0).toBe(0);
    expect(bill.grandTotal).toBe(thaliItem.sellingPrice * 2);
  });

  it("2. Item Cancellation: cancels single item, rolls back subtotal and updates KOT", () => {
    const party = store.createPartyAtTable(2, 2, "Kadam");
    const item1 = store.menuItems[0];
    const item2 = store.menuItems[1];

    const orderResult = store.placeOrder(party.id, [
      { menuItemId: item1.id, quantity: 2, unitPrice: item1.sellingPrice },
      { menuItemId: item2.id, quantity: 1, unitPrice: item2.sellingPrice },
    ]);

    const initialSubtotal = item1.sellingPrice * 2 + item2.sellingPrice;
    let currentParty = store.parties.find((p) => p.id === party.id);
    expect(currentParty?.runningSubtotal).toBe(initialSubtotal);

    const itemToCancel = orderResult.order.items.find((i) => i.menuItemId === item2.id);
    expect(itemToCancel).toBeDefined();

    // Cancel item 2
    store.cancelOrderItem(itemToCancel!.id, "Customer changed their mind");

    currentParty = store.parties.find((p) => p.id === party.id);
    expect(currentParty?.runningSubtotal).toBe(item1.sellingPrice * 2);

    const orderAfterCancel = store.orders.find((o) => o.id === orderResult.order.id);
    const cancelledItem = orderAfterCancel?.items.find((i) => i.id === itemToCancel!.id);
    expect(cancelledItem?.isCancelled).toBe(true);
    expect((cancelledItem as any)?.cancellationReason).toBe("Customer changed their mind");
  });

  it("3. Takeaway / Parcel Flow: creates parcel with customer info, charges packaging, and quick settles", () => {
    const parcel = store.createTakeawayParty("Rahul Shinde");
    expect(parcel.isTakeaway).toBe(true);
    expect(parcel.tableNumber).toBe(0);
    expect(parcel.customerName).toBe("Rahul Shinde");
    expect(parcel.packagingCharges).toBe(20);

    // Update customer phone and pickup notes
    store.updatePartyCustomerInfo(parcel.id, "Rahul Shinde", "9876543210", "Pickup in 15 mins");
    const updatedParcel = store.parties.find((p) => p.id === parcel.id);
    expect(updatedParcel?.customerPhone).toBe("9876543210");
    expect(updatedParcel?.notes).toBe("Pickup in 15 mins");

    const item = store.menuItems[0];
    const orderResult = store.placeOrder(parcel.id, [
      { menuItemId: item.id, quantity: 1, unitPrice: item.sellingPrice },
    ]);

    expect(orderResult.kot.isTakeaway).toBe(true);
    expect(orderResult.kot.customerName).toBe("Rahul Shinde");

    // Quick settle parcel
    const settleResult = store.quickSettleBill(parcel.id, "UPI");
    expect(settleResult.bill.isTakeaway).toBe(true);
    expect(settleResult.bill.packagingCharges).toBe(20);
    expect(settleResult.bill.grandTotal).toBe(item.sellingPrice + 20);
    expect(settleResult.bill.payments[0]?.paymentMethod).toBe("UPI");
    expect(settleResult.bill.customerName).toBe("Rahul Shinde");
  });

  it("4. Table to Parcel Conversion: frees physical table, applies packaging fee, and retains orders", () => {
    const tableParty = store.createPartyAtTable(4, 2, "Dine In Party");
    const item = store.menuItems[0];
    store.placeOrder(tableParty.id, [{ menuItemId: item.id, quantity: 2, unitPrice: item.sellingPrice }]);

    // Table 4 should be occupied
    const table4 = store.tables.find((t) => t.tableNumber === 4);
    expect(table4?.status).toBe("OCCUPIED");

    // Convert to Takeaway
    const parcelParty = store.convertToTakeawayParty(tableParty.id, "Amit Mane", "9123456780", 25);
    expect(parcelParty.isTakeaway).toBe(true);
    expect(parcelParty.tableNumber).toBe(0);
    expect(parcelParty.packagingCharges).toBe(25);
    expect(parcelParty.customerName).toBe("Amit Mane");

    // Physical table 4 should now be free
    const refreshedTable4 = store.tables.find((t) => t.tableNumber === 4);
    expect(refreshedTable4?.status).toBe("AVAILABLE");

    // Settle bill includes new packaging charge
    const bill = store.generateBillForParty(parcelParty.id);
    expect(bill.packagingCharges).toBe(25);
    expect(bill.grandTotal).toBe(item.sellingPrice * 2 + 25);
  });

  it("5. Parcel to Table Conversion: assigns to physical table, removes packaging fee, and updates KOTs", () => {
    const parcel = store.createTakeawayParty("Sunil More");
    const item = store.menuItems[0];
    store.placeOrder(parcel.id, [{ menuItemId: item.id, quantity: 1, unitPrice: item.sellingPrice }]);

    expect(parcel.packagingCharges).toBe(20);

    // Convert parcel to Dining Table 5
    const tableParty = store.convertToTableParty(parcel.id, 5);
    expect(Boolean(tableParty.isTakeaway)).toBe(false);
    expect(tableParty.tableNumber).toBe(5);
    expect(tableParty.packagingCharges).toBe(0);

    // Physical Table 5 should be OCCUPIED
    const table5 = store.tables.find((t) => t.tableNumber === 5);
    expect(table5?.status).toBe("OCCUPIED");

    // Existing KOTs updated to Table 5
    const partyKots = store.kots.filter((k) => k.partyId === tableParty.id);
    expect(partyKots.every((k) => k.tableNumber === 5 && !k.isTakeaway)).toBe(true);

    // Bill now does not include packaging fee
    const bill = store.generateBillForParty(tableParty.id);
    expect(bill.packagingCharges || 0).toBe(0);
    expect(bill.grandTotal).toBe(item.sellingPrice);
  });
});
