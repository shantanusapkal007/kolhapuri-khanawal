import { describe, it, expect, beforeEach } from "vitest";
import { RestaurantStore } from "@/lib/store/restaurant-store";
import { initialKhanawalCategories, initialKhanawalMenuItems } from "@/lib/store/kolhapuri-menu-data";

describe("Kolhapuri Khanawal Complete Authentic Menu Catalog Validation", () => {
  let store: RestaurantStore;

  beforeEach(() => {
    store = new RestaurantStore();
  });

  it("should contain all 20 authentic restaurant menu categories", () => {
    expect(store.categories.length).toBe(20);

    const expectedCategories = [
      "Veg Soup",
      "Non-Veg Soup",
      "Veg Chinese Rice & Noodles",
      "Non-Veg Chinese",
      "Veg Thali",
      "Chicken Thali",
      "Mutton Thali",
      "Special Thali",
      "Veg Main Course",
      "Chicken Main Course",
      "Mutton Main Course",
      "Egg Main Course",
      "Biryani",
      "Rice",
      "Roti / Naan / Paratha",
      "Egg Starters",
      "Seafood",
      "Seafood Thali",
      "Veg Kebab",
      "Non-Veg Kebab",
    ];

    for (const catName of expectedCategories) {
      const found = store.categories.find(
        (c) => c.name.toLowerCase().trim() === catName.toLowerCase().trim()
      );
      expect(found, `Category "${catName}" should exist in store`).toBeDefined();
    }
  });

  it("should contain the complete catalog of ~188 menu items", () => {
    expect(store.menuItems.length).toBeGreaterThanOrEqual(185);
    expect(initialKhanawalMenuItems.length).toBe(188);
  });

  it("should enforce valid taxonomy (foodType, isVeg, pricing, station) on every menu item", () => {
    for (const item of store.menuItems) {
      expect(item.id).toBeTruthy();
      expect(item.name).toBeTruthy();
      expect(item.categoryId).toBeTruthy();
      expect(item.sellingPrice).toBeGreaterThan(0);
      expect(["VEG", "NON_VEG"]).toContain(item.foodType);
      expect(typeof item.isVeg).toBe("boolean");
      expect(item.stationCode).toBeTruthy();

      // Ensure isVeg aligns with foodType
      if (item.foodType === "VEG") {
        expect(item.isVeg).toBe(true);
      } else {
        expect(item.isVeg).toBe(false);
      }
    }
  });

  it("should preserve legacy IDs for backward compatibility with existing recipes and tests", () => {
    const legacyIds = [
      "menu-chicken-thali",
      "menu-mutton-thali",
      "menu-veg-thali",
      "menu-bhakri",
      "menu-chapati",
      "menu-solkadhi",
    ];

    for (const id of legacyIds) {
      const item = store.menuItems.find((m) => m.id === id);
      expect(item, `Legacy item ID ${id} must exist`).toBeDefined();
      expect(item?.sellingPrice).toBeGreaterThan(0);
    }
  });

  it("should verify dual-pricing variants (Half & Full) for curries, biryanis, and tandoori", () => {
    const itemsWithVariants = store.menuItems.filter(
      (m) => m.variants && m.variants.length > 0
    );
    expect(itemsWithVariants.length).toBeGreaterThanOrEqual(15);

    // Specific test for Butter Chicken
    const butterChicken = store.menuItems.find((m) => m.name === "Butter Chicken");
    expect(butterChicken).toBeDefined();
    expect(butterChicken?.variants?.length).toBe(2);
    const halfBc = butterChicken?.variants?.find((v) => v.name === "Half");
    const fullBc = butterChicken?.variants?.find((v) => v.name === "Full");
    expect(halfBc?.price).toBe(400);
    expect(fullBc?.price).toBe(700);

    // Specific test for Chicken Dum Biryani
    const chickenBiryani = store.menuItems.find((m) => m.name === "Chicken Dum Biryani");
    expect(chickenBiryani).toBeDefined();
    const halfBiryani = chickenBiryani?.variants?.find((v) => v.name === "Half");
    const fullBiryani = chickenBiryani?.variants?.find((v) => v.name === "Full");
    expect(halfBiryani?.price).toBe(200);
    expect(fullBiryani?.price).toBe(300);

    // Specific test for Plain Rice
    const plainRice = store.menuItems.find((m) => m.name === "Plain Rice");
    expect(plainRice).toBeDefined();
    const halfRice = plainRice?.variants?.find((v) => v.name === "Half");
    const fullRice = plainRice?.variants?.find((v) => v.name === "Full");
    expect(halfRice?.price).toBe(70);
    expect(fullRice?.price).toBe(120);
  });

  it("should verify Thalis have rich descriptions and proper thali flag", () => {
    const thalis = store.menuItems.filter((m) => m.isThali);
    expect(thalis.length).toBeGreaterThanOrEqual(15);

    for (const thali of thalis) {
      expect(thali.description).toBeTruthy();
      expect(thali.description?.length).toBeGreaterThan(15);
    }

    const chickenThali = store.menuItems.find((m) => m.id === "menu-chicken-thali");
    expect(chickenThali?.description).toContain("Tambda");
    expect(chickenThali?.description).toContain("Pandhra");
  });

  it("should properly process order and KOT generation with Half/Full variant pricing", () => {
    // 1. Seat a party at Table 1
    const party = store.createPartyAtTable(1, 2, "Test Party");

    expect(party).toBeDefined();
    expect(party.runningSubtotal).toBe(0);

    // 2. Find Butter Chicken which has variants Half (₹400) and Full (₹700)
    const butterChicken = store.menuItems.find((m) => m.name === "Butter Chicken")!;
    expect(butterChicken).toBeDefined();

    // 3. Place order with Half variant (₹400) under allowNegativeStock = true
    const { order, kot } = store.placeOrder(
      party.id,
      [
        {
          menuItemId: butterChicken.id,
          quantity: 2,
          variantName: "Half",
          unitPrice: 400,
          spiceLevel: "SPICY",
          notes: "Extra gravy",
        },
      ],
      true
    );

    expect(order.items.length).toBe(1);
    expect(order.items[0].menuItemName).toBe("Butter Chicken (Half)");
    expect(order.items[0].variantName).toBe("Half");
    expect(order.items[0].unitPrice).toBe(400);
    expect(order.items[0].totalPrice).toBe(800);
    expect(order.subtotal).toBe(800);

    // Check KOT details
    expect(kot.items[0].menuItemName).toBe("Butter Chicken (Half)");
    expect(kot.items[0].variantName).toBe("Half");
    expect(kot.items[0].quantity).toBe(2);

    // Check Party running subtotal
    const updatedParty = store.parties.find((p) => p.id === party.id);
    expect(updatedParty?.runningSubtotal).toBe(800);

    // 4. Generate final Bill and verify GST & totals calculation
    const bill = store.generateBillForParty(party.id);
    expect(bill.subtotal).toBe(800);
    expect(bill.items[0].unitPrice).toBe(400);
    expect(bill.items[0].totalPrice).toBe(800);
    expect(bill.items[0].menuItemName).toBe("Butter Chicken (Half)");
    // 5% GST on ₹800 = ₹40 (CGST ₹20 + SGST ₹20)
    expect(bill.totalTaxAmount).toBe(40);
    expect(bill.grandTotal).toBe(840);
  });

  it("should support adding, editing, and deleting dishes in the catalog with persistence", () => {
    const testDish = {
      categoryId: "cat-desserts",
      name: "Special Kolhapuri Gulab Jamun",
      localName: "गुलाब जामुन",
      code: "DESSERT_GULAB_JAMUN",
      sellingPrice: 80,
      isVeg: true,
      foodType: "VEG" as const,
      isThali: false,
      stationCode: "BEVERAGE_DESSERT" as const,
      taxCategoryId: "tax-food-5",
      portionAvailability: 50,
      stockStatus: "AVAILABLE" as const,
      isDailySpecial: false,
      preparationTimeMinutes: 5,
      displayOrder: 1,
      isActive: true,
    };

    const added = store.addMenuItem(testDish);
    expect(added.id).toBeDefined();
    expect(store.menuItems.find((m) => m.id === added.id)).toBeDefined();

    // Update dish
    store.updateMenuItem(added.id, {
      sellingPrice: 95,
      variants: [
        { name: "2 Pcs", price: 60 },
        { name: "4 Pcs", price: 100 },
      ],
    });

    const updated = store.menuItems.find((m) => m.id === added.id);
    expect(updated?.sellingPrice).toBe(95);
    expect(updated?.variants?.length).toBe(2);

    // Delete dish
    store.deleteMenuItem(added.id);
    expect(store.menuItems.find((m) => m.id === added.id)).toBeUndefined();
  });
});
