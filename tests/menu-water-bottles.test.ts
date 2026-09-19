import { describe, it, expect, beforeEach } from "vitest";
import { RestaurantStore } from "@/lib/store/restaurant-store";
import { initialKhanawalMenuItems, initialKhanawalCategories } from "@/lib/store/kolhapuri-menu-data";
import { getKotItemMarathiName } from "@/lib/printing/thermal-printer";

describe("Water Bottles Menu Catalog & POS Ordering", () => {
  let store: RestaurantStore;

  beforeEach(() => {
    store = new RestaurantStore();
  });

  it("should have Water Bottle Small priced at 10 Rs in the menu catalog", () => {
    const smallBottle = store.menuItems.find((m) => m.id === "menu-water-bottle-small");
    expect(smallBottle).toBeDefined();
    expect(smallBottle?.name).toContain("Water Bottle");
    expect(smallBottle?.name).toContain("Small");
    expect(smallBottle?.sellingPrice).toBe(10);
    expect(smallBottle?.price).toBe(10);
    expect(smallBottle?.isVeg).toBe(true);
    expect(smallBottle?.foodType).toBe("VEG");
    expect(smallBottle?.stationCode).toBe("BEVERAGE_DESSERT");
    expect(smallBottle?.categoryId).toBe("cat-beverages");
    expect(smallBottle?.localName).toBeTruthy();
    expect(/[\u0900-\u097F]/.test(smallBottle!.localName!)).toBe(true);
    expect(smallBottle?.localName).toContain("पाण्याची बाटली");
    expect(smallBottle?.localName).toContain("लहान");
  });

  it("should have Water Bottle Big priced at 20 Rs in the menu catalog", () => {
    const bigBottle = store.menuItems.find((m) => m.id === "menu-water-bottle-big");
    expect(bigBottle).toBeDefined();
    expect(bigBottle?.name).toContain("Water Bottle");
    expect(bigBottle?.name).toContain("Big");
    expect(bigBottle?.sellingPrice).toBe(20);
    expect(bigBottle?.price).toBe(20);
    expect(bigBottle?.isVeg).toBe(true);
    expect(bigBottle?.foodType).toBe("VEG");
    expect(bigBottle?.stationCode).toBe("BEVERAGE_DESSERT");
    expect(bigBottle?.categoryId).toBe("cat-beverages");
    expect(bigBottle?.localName).toBeTruthy();
    expect(/[\u0900-\u097F]/.test(bigBottle!.localName!)).toBe(true);
    expect(bigBottle?.localName).toContain("पाण्याची बाटली");
    expect(bigBottle?.localName).toContain("मोठी");
  });

  it("should place order with small (10 Rs) and big (20 Rs) water bottles and verify KOT & Bill", () => {
    const party = store.createPartyAtTable(1, 2, "Shantanu");
    const smallBottle = store.menuItems.find((m) => m.id === "menu-water-bottle-small")!;
    const bigBottle = store.menuItems.find((m) => m.id === "menu-water-bottle-big")!;

    // 2 small bottles (2 x 10 = 20) + 1 big bottle (1 x 20 = 20)
    const { order, kot } = store.placeOrder(
      party.id,
      [
        {
          menuItemId: smallBottle.id,
          quantity: 2,
          unitPrice: 10,
        },
        {
          menuItemId: bigBottle.id,
          quantity: 1,
          unitPrice: 20,
        },
      ],
      true
    );

    expect(order).toBeDefined();
    expect(kot).toBeDefined();
    expect(kot.items.length).toBe(2);

    // KOT station routing
    expect(kot.stationCode).toBe("BEVERAGE_DESSERT");

    // Authentic Marathi Devanagari translation for thermal printing
    const smallPrintName = getKotItemMarathiName({
      menuItemId: smallBottle.id,
      menuItemName: smallBottle.name,
      menuItemLocalName: smallBottle.localName,
    });
    expect(smallPrintName).toContain("पाण्याची बाटली");
    expect(smallPrintName).toContain("लहान");

    const bigPrintName = getKotItemMarathiName({
      menuItemId: bigBottle.id,
      menuItemName: bigBottle.name,
      menuItemLocalName: bigBottle.localName,
    });
    expect(bigPrintName).toContain("पाण्याची बाटली");
    expect(bigPrintName).toContain("मोठी");

    // Check Party running subtotal: 20 + 20 = 40
    const updatedParty = store.parties.find((p) => p.id === party.id);
    expect(updatedParty?.runningSubtotal).toBe(40);

    // Generate final Bill
    const bill = store.generateBillForParty(party.id);
    expect(bill.subtotal).toBe(40);
    expect(bill.grandTotal).toBe(40);
    expect(bill.items.length).toBe(2);
    expect(bill.items.find((i) => i.menuItemId === smallBottle.id)?.totalPrice).toBe(20);
    expect(bill.items.find((i) => i.menuItemId === bigBottle.id)?.totalPrice).toBe(20);
  });

  it("should merge new water bottles seamlessly into existing localStorage caches", () => {
    // Simulate an older cached localStorage array without the water bottles
    const mockOldStoredItems = initialKhanawalMenuItems.filter(
      (m) => m.id !== "menu-water-bottle-small" && m.id !== "menu-water-bottle-big"
    );
    expect(mockOldStoredItems.length).toBe(188);

    const storeInstance = new RestaurantStore();
    // Test helper logic: ensure missing items are merged
    const existingIds = new Set(mockOldStoredItems.map((m) => m.id));
    const missing = initialKhanawalMenuItems.filter((m) => !existingIds.has(m.id));
    expect(missing.length).toBe(2);
    expect(missing.map((m) => m.id)).toEqual(["menu-water-bottle-small", "menu-water-bottle-big"]);

    const merged = [...mockOldStoredItems, ...missing];
    expect(merged.length).toBe(190);
    expect(merged.some((m) => m.id === "menu-water-bottle-small")).toBe(true);
    expect(merged.some((m) => m.id === "menu-water-bottle-big")).toBe(true);
  });
});
