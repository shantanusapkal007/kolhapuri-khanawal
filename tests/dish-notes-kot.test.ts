import { describe, it, expect, beforeEach } from "vitest";
import { RestaurantStore } from "@/lib/store/restaurant-store";
import { buildKotEscPos } from "@/lib/printing/escpos-builder";
import { generateKotHtml } from "@/lib/printing/thermal-printer";
import { Kot, KotItem } from "@/types/orders";
import { NOTE_PRESETS } from "@/app/(waiter)/waiter/order/[partyId]/WaiterOrderClient";

describe("Dish Notes & Special Requirements on KOT", () => {
  let store: RestaurantStore;

  beforeEach(() => {
    store = new RestaurantStore();
  });

  describe("1. Note Presets & Options", () => {
    it("should export relevant Kolhapuri culinary note presets", () => {
      expect(NOTE_PRESETS).toContain("कमी तिखट");
      expect(NOTE_PRESETS).toContain("झणझणीत");
      expect(NOTE_PRESETS).toContain("रस्सा वेगळा");
      expect(NOTE_PRESETS).toContain("गरम द्या");
      expect(NOTE_PRESETS).toContain("बिनकांदा");
      expect(NOTE_PRESETS).toContain("कडक भाकरी");
      expect(NOTE_PRESETS).toContain("कमी तेल");
    });
  });

  describe("2. Order Placement with Dish Notes", () => {
    it("should preserve special requirements on each order item and KOT item", () => {
      const party = store.createPartyAtTable(1, 2, "Kadam");
      const chickenThali = store.menuItems.find((m) => m.name.toLowerCase().includes("chicken thali"))!;
      const sukka = store.menuItems.find((m) => m.name.toLowerCase().includes("sukka") || m.name.toLowerCase().includes("handi"))!;

      const orderResult = store.placeOrder(party.id, [
        {
          menuItemId: chickenThali.id,
          quantity: 2,
          breadOption: "JWARI_BHAKRI",
          notes: "2 ज्वारी भाकरी | कमी तिखट | कडक भाकरी",
        },
        {
          menuItemId: sukka.id,
          quantity: 1,
          notes: "रस्सा वेगळा, गरम द्या",
        },
      ]);

      expect(orderResult.order).toBeDefined();
      expect(orderResult.kot).toBeDefined();

      const kotItems = orderResult.kot.items;
      expect(kotItems.length).toBe(2);

      // Check item 1 notes
      expect(kotItems[0].notes).toBe("2 ज्वारी भाकरी | कमी तिखट | कडक भाकरी");
      // Check item 2 notes
      expect(kotItems[1].notes).toBe("रस्सा वेगळा, गरम द्या");

      // Verify overall KOT notes contains aggregated requirements
      expect(orderResult.kot.notes).toContain("कमी तिखट");
      expect(orderResult.kot.notes).toContain("रस्सा वेगळा");
    });
  });

  describe("3. HTML KOT Generation with Dish Notes", () => {
    it("should format dish notes with bold label and icon in 80mm and 58mm HTML", () => {
      const mockKot: Kot = {
        id: "kot-test-1",
        kotNumber: "KOT-2026-000999",
        orderId: "ord-test-1",
        partyId: "party-test-1",
        partyCode: "TBL-05",
        tableNumber: 5,
        waiterId: "u-wtr-01",
        waiterName: "Ramesh",
        stationCode: "MAIN_KITCHEN",
        guestCount: 3,
        status: "NEW",
        items: [
          {
            id: "ki-1",
            kotId: "kot-test-1",
            orderItemId: "oi-1",
            menuItemId: "item-1",
            menuItemName: "Special Mutton Thali",
            menuItemLocalName: "स्पेशल मटन थाळी",
            quantity: 2,
            breadOption: "BAJRI_BHAKRI",
            notes: "2 बाजरी भाकरी | झणझणीत | रस्सा वेगळा",
            status: "NEW",
          },
          {
            id: "ki-2",
            kotId: "kot-test-1",
            orderItemId: "oi-2",
            menuItemId: "item-2",
            menuItemName: "Chicken Fry",
            menuItemLocalName: "चिकन फ्राय",
            quantity: 1,
            notes: "कमी तेल, कडक फ्राय",
            status: "NEW",
          },
        ],
        elapsedSeconds: 0,
        urgencyLevel: "NORMAL",
        createdAt: new Date().toISOString(),
      };

      const html80 = generateKotHtml(mockKot, undefined, false, "80mm");
      expect(html80).toContain("kot-notes");
      expect(html80).toContain("📝 2 बाजरी भाकरी | झणझणीत | रस्सा वेगळा");
      expect(html80).toContain("📝 कमी तेल, कडक फ्राय");

      const html58 = generateKotHtml(mockKot, undefined, false, "58mm");
      expect(html58).toContain("kot-notes");
      expect(html58).toContain("📝 2 बाजरी भाकरी | झणझणीत | रस्सा वेगळा");
    });
  });

  describe("4. ESC/POS Thermal Printing with Dish Notes", () => {
    it("should build ESC/POS payload with dish cooking notes", () => {
      const mockKot: Kot = {
        id: "kot-test-2",
        kotNumber: "KOT-2026-000998",
        orderId: "ord-test-2",
        partyId: "party-test-2",
        partyCode: "TBL-02",
        tableNumber: 2,
        waiterId: "u-wtr-02",
        waiterName: "Suresh",
        stationCode: "MAIN_KITCHEN",
        guestCount: 2,
        status: "NEW",
        items: [
          {
            id: "ki-3",
            kotId: "kot-test-2",
            orderItemId: "oi-3",
            menuItemId: "item-3",
            menuItemName: "Special Chicken Thali",
            menuItemLocalName: "स्पेशल चिकन थाळी",
            quantity: 1,
            notes: "Extra spicy, no onion",
            status: "NEW",
          },
        ],
        elapsedSeconds: 0,
        urgencyLevel: "NORMAL",
        createdAt: new Date().toISOString(),
      };

      const escposBytes = buildKotEscPos(mockKot, undefined, false, "80mm");
      expect(escposBytes).toBeDefined();
      expect(escposBytes.length).toBeGreaterThan(50);

      // Verify the text content inside the byte stream includes the note
      const decoder = new TextDecoder();
      const textOutput = decoder.decode(escposBytes);
      expect(textOutput).toContain("NOTE: Extra spicy, no onion");
    });
  });
});
