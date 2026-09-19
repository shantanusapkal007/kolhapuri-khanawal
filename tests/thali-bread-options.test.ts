import { describe, it, expect, beforeEach } from "vitest";
import { RestaurantStore } from "@/lib/store/restaurant-store";
import {
  BreadOption,
  BREAD_OPTIONS,
  BREAD_OPTION_LABELS,
  DEFAULT_BREAD_PORTIONS,
  formatBreadNotes,
  isThaliOrMainCourseItem,
} from "@/types/orders";
import { generateKotHtml, generateBillReceiptHtml, generateTableCheckHtml } from "@/lib/printing/thermal-printer";
import { buildKotEscPos } from "@/lib/printing/escpos-builder";

describe("Instant Bread Options for Thali & Main Course Orders", () => {
  let store: RestaurantStore;

  beforeEach(() => {
    store = new RestaurantStore();
  });

  describe("1. Bread Option Definitions & Classification", () => {
    it("should define all 4 required bread options including two types of Bhakri (Jwari and Bajri)", () => {
      const optionIds = BREAD_OPTIONS.map((b) => b.id);
      expect(optionIds).toContain("JWARI_BHAKRI");
      expect(optionIds).toContain("BAJRI_BHAKRI");
      expect(optionIds).toContain("CHAPATI");
      expect(optionIds).toContain("ROTI");
      expect(BREAD_OPTIONS.length).toBe(4);
    });

    it("should provide authentic Marathi local names for both Bhakris and breads", () => {
      expect(BREAD_OPTION_LABELS.JWARI_BHAKRI.mr).toBe("ज्वारी भाकरी");
      expect(BREAD_OPTION_LABELS.BAJRI_BHAKRI.mr).toBe("बाजरी भाकरी");
      expect(BREAD_OPTION_LABELS.CHAPATI.mr).toBe("चपाती");
      expect(BREAD_OPTION_LABELS.ROTI.mr).toBe("रोटी");

      expect(BREAD_OPTION_LABELS.JWARI_BHAKRI.full).toContain("ज्वारी भाकरी");
      expect(BREAD_OPTION_LABELS.BAJRI_BHAKRI.full).toContain("बाजरी भाकरी");
    });

    it("should correctly classify Thalis for bread option requirement (excluding main courses)", () => {
      // Thalis should require bread options
      expect(isThaliOrMainCourseItem({ name: "Special Chicken Thali", isThali: true })).toBe(true);
      expect(isThaliOrMainCourseItem({ name: "Kolhapuri Mutton Thali", categoryId: "cat-thalis" })).toBe(true);
      expect(isThaliOrMainCourseItem({ name: "Special Veg Thali", isThali: true })).toBe(true);

      // Main Courses (Handi, Sukka, Masala, Rassa, Curry, Bhaji) should NOT have bread options
      expect(isThaliOrMainCourseItem({ name: "Chicken Sukka", categoryId: "cat-chicken-main" })).toBe(false);
      expect(isThaliOrMainCourseItem({ name: "Mutton Handi", categoryId: "cat-mutton-main" })).toBe(false);
      expect(isThaliOrMainCourseItem({ name: "Tambada Rassa Fry", categoryId: "cat-rassa" })).toBe(false);
      expect(isThaliOrMainCourseItem({ name: "Shev Bhaji Kolhapuri", categoryId: "cat-veg-main" })).toBe(false);

      // Non-Bread items should return false
      expect(isThaliOrMainCourseItem({ name: "Tomato Soup", categoryId: "cat-soup" })).toBe(false);
      expect(isThaliOrMainCourseItem({ name: "Chicken Fried Rice", categoryId: "cat-chinese-rice" })).toBe(false);
      expect(isThaliOrMainCourseItem({ name: "Solkadhi Glass", categoryId: "cat-beverage" })).toBe(false);
      expect(isThaliOrMainCourseItem({ name: "Extra Chapati", categoryId: "cat-roti-bhakri" })).toBe(false);
    });
  });

  describe("2. Ordering Flow & KOT Generation with Bread Options", () => {
    it("should propagate breadOption from order input into OrderItem and KotItem", () => {
      const party = store.createPartyAtTable(1, 2, "Shantanu Patil");
      const chickenThali = store.menuItems.find((m) => m.name.toLowerCase().includes("chicken thali")) || store.menuItems[0];

      const { order, kot } = store.placeOrder(party.id, [
        {
          menuItemId: chickenThali.id,
          quantity: 1,
          seatNumber: 1,
          spiceLevel: "SPICY",
          breadOption: "JWARI_BHAKRI",
        },
      ]);

      expect(order.items[0].breadOption).toBe("JWARI_BHAKRI");
      expect(kot.items[0].breadOption).toBe("JWARI_BHAKRI");
      expect(kot.items[0].spiceLevel).toBe("SPICY");
    });

    it("should preserve different bread options for the same dish on the same table", () => {
      const party = store.createPartyAtTable(2, 3, "Deshmukh Family");
      const chickenThali = store.menuItems.find((m) => m.name.toLowerCase().includes("chicken thali")) || store.menuItems[0];

      // Customer 1 wants Jwari Bhakri, Customer 2 wants Bajri Bhakri, Customer 3 wants Chapati
      const { order, kot } = store.placeOrder(party.id, [
        {
          menuItemId: chickenThali.id,
          quantity: 1,
          seatNumber: 1,
          breadOption: "JWARI_BHAKRI",
        },
        {
          menuItemId: chickenThali.id,
          quantity: 1,
          seatNumber: 2,
          breadOption: "BAJRI_BHAKRI",
        },
        {
          menuItemId: chickenThali.id,
          quantity: 1,
          seatNumber: 3,
          breadOption: "CHAPATI",
        },
      ]);

      expect(order.items.length).toBe(3);
      expect(kot.items.length).toBe(3);

      expect(order.items[0].breadOption).toBe("JWARI_BHAKRI");
      expect(order.items[1].breadOption).toBe("BAJRI_BHAKRI");
      expect(order.items[2].breadOption).toBe("CHAPATI");

      expect(kot.items[0].breadOption).toBe("JWARI_BHAKRI");
      expect(kot.items[1].breadOption).toBe("BAJRI_BHAKRI");
      expect(kot.items[2].breadOption).toBe("CHAPATI");
    });

    it("should allow ordering with Roti bread option", () => {
      const party = store.createPartyAtTable(3, 1, "Rohan");
      const muttonThali = store.menuItems.find((m) => m.name.toLowerCase().includes("mutton thali")) || store.menuItems[0];

      const { order, kot } = store.placeOrder(party.id, [
        {
          menuItemId: muttonThali.id,
          quantity: 2,
          breadOption: "ROTI",
        },
      ]);

      expect(order.items[0].breadOption).toBe("ROTI");
      expect(order.items[0].quantity).toBe(2);
      expect(kot.items[0].breadOption).toBe("ROTI");
    });
  });

  describe("3. Thermal Printer Ticket Formatting with Bread Options", () => {
    it("should render bread option badge with Marathi script in generateKotHtml", () => {
      const party = store.createPartyAtTable(4, 2, "Kadam");
      const thali = store.menuItems.find((m) => m.isThali) || store.menuItems[0];

      const { kot } = store.placeOrder(party.id, [
        {
          menuItemId: thali.id,
          quantity: 1,
          breadOption: "JWARI_BHAKRI",
        },
        {
          menuItemId: thali.id,
          quantity: 1,
          breadOption: "BAJRI_BHAKRI",
        },
      ]);

      const kotHtml = generateKotHtml(kot);

      // Verify Devanagari bread names are rendered for kitchen staff
      expect(kotHtml).toContain("ज्वारी भाकरी");
      expect(kotHtml).toContain("Jwari Bhakri");
      expect(kotHtml).toContain("बाजरी भाकरी");
      expect(kotHtml).toContain("Bajri Bhakri");
      expect(kotHtml).toContain("kot-bread");
    });

    it("should render bread information in ESC/POS binary ticket builder", () => {
      const party = store.createPartyAtTable(5, 1, "Pawar");
      const thali = store.menuItems.find((m) => m.isThali) || store.menuItems[0];

      const { kot } = store.placeOrder(party.id, [
        {
          menuItemId: thali.id,
          quantity: 1,
          breadOption: "CHAPATI",
        },
      ]);

      const bytes = buildKotEscPos(kot);
      expect(bytes).toBeInstanceOf(Uint8Array);
      expect(bytes.length).toBeGreaterThan(50);

      // Convert bytes to string to verify text content
      const text = new TextDecoder().decode(bytes);
      expect(text).toContain("Bread:");
      expect(text).toContain("Chapati");
    });
  });

  describe("4. Billing & Customer Receipt Integration", () => {
    it("should propagate breadOption into BillItem when generating a bill", () => {
      const party = store.createPartyAtTable(6, 2, "Shinde");
      const thali = store.menuItems.find((m) => m.isThali) || store.menuItems[0];

      store.placeOrder(party.id, [
        {
          menuItemId: thali.id,
          quantity: 1,
          seatNumber: 1,
          breadOption: "JWARI_BHAKRI",
        },
        {
          menuItemId: thali.id,
          quantity: 1,
          seatNumber: 2,
          breadOption: "ROTI",
        },
      ]);

      const bill = store.generateBillForParty(party.id);
      expect(bill.items.length).toBe(2);
      expect(bill.items[0].breadOption).toBe("JWARI_BHAKRI");
      expect(bill.items[1].breadOption).toBe("ROTI");
    });

    it("should include bread option badge in customer bill receipt and table check HTML", () => {
      const party = store.createPartyAtTable(7, 2, "Gaikwad");
      const thali = store.menuItems.find((m) => m.isThali) || store.menuItems[0];

      store.placeOrder(party.id, [
        {
          menuItemId: thali.id,
          quantity: 1,
          breadOption: "BAJRI_BHAKRI",
        },
      ]);

      const bill = store.generateBillForParty(party.id);
      const receiptHtml = generateBillReceiptHtml(bill);
      expect(receiptHtml).toContain("बाजरी भाकरी");

      const tableCheckHtml = generateTableCheckHtml({
        party,
        items: store.orders.filter((o) => o.partyId === party.id).flatMap((o) => o.items),
        subtotal: bill.subtotal,
        taxEstimate: bill.totalTaxAmount,
        grandTotal: bill.grandTotal,
        cashierName: "Priya",
      });
      expect(tableCheckHtml).toContain("बाजरी भाकरी");
    });
  });

  describe("5. Separation of Thali Quantity and Bread/Roti Counts (No Double Billing for Rotis)", () => {
    it("should define standard default bread portions (2 for Roti/Chapati, 1 for Bhakri)", () => {
      expect(DEFAULT_BREAD_PORTIONS.ROTI).toBe(2);
      expect(DEFAULT_BREAD_PORTIONS.CHAPATI).toBe(2);
      expect(DEFAULT_BREAD_PORTIONS.JWARI_BHAKRI).toBe(1);
      expect(DEFAULT_BREAD_PORTIONS.BAJRI_BHAKRI).toBe(1);
    });

    it("should format bread notes cleanly for single or mixed bread options", () => {
      expect(formatBreadNotes({ ROTI: 2 })).toBe("2x रोटी");
      expect(formatBreadNotes({ CHAPATI: 2 })).toBe("2x चपाती");
      expect(formatBreadNotes({ JWARI_BHAKRI: 1 })).toBe("1x ज्वारी भाकरी");
      expect(formatBreadNotes({ JWARI_BHAKRI: 1, ROTI: 1 })).toBe("1x ज्वारी भाकरी, 1x रोटी");
      expect(formatBreadNotes({ ROTI: 0 })).toBe("");
      expect(formatBreadNotes(undefined)).toBe("");
    });

    it("should order 1 Thali with 2 Rotis charging ONLY for 1 Thali (no double billing)", () => {
      const party = store.createPartyAtTable(8, 2, "Kulkarni");
      const chickenThali = store.menuItems.find((m) => m.name.toLowerCase().includes("chicken thali")) || store.menuItems[0];
      const singleThaliPrice = chickenThali.sellingPrice;

      // Customer orders 1 Thali with 2 Rotis
      const { order, kot } = store.placeOrder(party.id, [
        {
          menuItemId: chickenThali.id,
          quantity: 1, // EXACTLY 1 THALI!
          breadOption: "ROTI",
          notes: formatBreadNotes({ ROTI: 2 }), // 2x रोटी
        },
      ]);

      // Verify Order Item
      expect(order.items.length).toBe(1);
      expect(order.items[0].quantity).toBe(1);
      expect(order.items[0].unitPrice).toBe(singleThaliPrice);
      expect(order.items[0].totalPrice).toBe(singleThaliPrice);
      expect(order.items[0].breadOption).toBe("ROTI");
      expect(order.items[0].notes).toBe("2x रोटी");
      expect(order.subtotal).toBe(singleThaliPrice); // Subtotal is for 1 Thali, NOT 2 Thalis!

      // Verify KOT Copy
      expect(kot.items[0].quantity).toBe(1);
      expect(kot.items[0].breadOption).toBe("ROTI");
      expect(kot.items[0].notes).toBe("2x रोटी");

      // Verify Bill Generation
      const bill = store.generateBillForParty(party.id);
      expect(bill.items.length).toBe(1);
      expect(bill.items[0].quantity).toBe(1);
      expect(bill.items[0].unitPrice).toBe(singleThaliPrice);
      expect(bill.subtotal).toBe(singleThaliPrice);
      expect(bill.grandTotal).toBe(singleThaliPrice); // Pure dish sum without GST
    });

    it("should bill for 2 Thalis ONLY when the Thali quantity is explicitly 2", () => {
      const party = store.createPartyAtTable(9, 2, "Jadhav");
      const vegThali = store.menuItems.find((m) => m.name.toLowerCase().includes("veg thali")) || store.menuItems[0];
      const singlePrice = vegThali.sellingPrice;

      // 2 Thalis ordered, each having 2 Rotis (total 4 Rotis)
      const { order } = store.placeOrder(party.id, [
        {
          menuItemId: vegThali.id,
          quantity: 2, // 2 Thalis
          breadOption: "ROTI",
          notes: formatBreadNotes({ ROTI: 4 }), // 4x रोटी
        },
      ]);

      expect(order.items[0].quantity).toBe(2);
      expect(order.items[0].totalPrice).toBe(singlePrice * 2);
      expect(order.items[0].notes).toBe("4x रोटी");

      const bill = store.generateBillForParty(party.id);
      expect(bill.subtotal).toBe(singlePrice * 2);
    });
  });
});
