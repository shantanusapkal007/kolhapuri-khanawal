import { describe, it, expect, beforeEach } from "vitest";
import { RestaurantStore } from "@/lib/store/restaurant-store";
import { initialKhanawalCategories, initialKhanawalMenuItems } from "@/lib/store/kolhapuri-menu-data";
import { generateKotHtml, getKotItemMarathiName } from "@/lib/printing/thermal-printer";
import { buildKotEscPos, MARATHI_HEADER_RASTER_B64 } from "@/lib/printing/escpos-builder";

describe("Marathi First Menu & KOT Printing Verification", () => {
  let store: RestaurantStore;

  beforeEach(() => {
    store = new RestaurantStore();
  });

  describe("1. Menu in Marathi First", () => {
    it("all categories must have authentic Marathi localName defined", () => {
      expect(initialKhanawalCategories.length).toBe(20);
      for (const cat of initialKhanawalCategories) {
        expect(cat.localName, `Category ${cat.name} must have a Marathi localName`).toBeTruthy();
        expect(/[\u0900-\u097F]/.test(cat.localName!)).toBe(true);
      }
    });

    it("all 188 menu items must have authentic Marathi localName defined", () => {
      expect(initialKhanawalMenuItems.length).toBe(188);
      for (const item of initialKhanawalMenuItems) {
        expect(item.localName, `Item ${item.name} (${item.id}) must have a Marathi localName`).toBeTruthy();
        expect(/[\u0900-\u097F]/.test(item.localName!)).toBe(true);
      }
    });

    it("order service sets menuItemLocalName with authentic Marathi dish name and Marathi variant", () => {
      const party = store.createPartyAtTable(2, 2, "Patil");
      const butterChicken = store.menuItems.find((m) => m.name === "Butter Chicken")!;
      expect(butterChicken).toBeDefined();

      const { order, kot } = store.placeOrder(
        party.id,
        [
          {
            menuItemId: butterChicken.id,
            quantity: 2,
            variantName: "Half",
            unitPrice: 400,
          },
        ],
        true
      );

      // Order item has authentic Marathi name with Marathi variant
      expect(order.items[0].menuItemLocalName).toContain("बटर चिकन");
      expect(order.items[0].menuItemLocalName).toContain("हाफ");

      // KOT item has authentic Marathi name as primary menuItemName
      expect(kot.items[0].menuItemName).toContain("बटर चिकन");
      expect(kot.items[0].menuItemName).toContain("हाफ");
      expect(kot.items[0].menuItemLocalName).toContain("बटर चिकन");
      expect(kot.items[0].menuItemLocalName).toContain("हाफ");
      expect(kot.items[0].menuItemEnglishName).toBe("Butter Chicken (Half)");
    });
  });

  describe("2. KOT Printing in Marathi Devanagari", () => {
    it("resolves Marathi Devanagari dish name via getKotItemMarathiName", () => {
      const mr1 = getKotItemMarathiName({
        menuItemName: "Cream of Tomato Soup",
        menuItemId: "soup-veg-tomato",
      });
      expect(mr1).toBe("टोमॅटो सूप");

      const mr2 = getKotItemMarathiName({
        menuItemName: "Special Mutton Thali",
      });
      expect(mr2).toBe("स्पेशल मटण थाळी");

      const mr3 = getKotItemMarathiName({
        menuItemName: "Chicken Curry",
        variantName: "Half",
      });
      expect(mr3).toContain("हाफ");
    });

    it("generateKotHtml produces large bold Marathi Devanagari dish name with English subtitle", () => {
      const party = store.createPartyAtTable(4, 3, "Jadhav");
      const chickenThali = store.menuItems.find((m) => m.name.toLowerCase().includes("chicken thali"))!;
      const tomatoSoup = store.menuItems.find((m) => m.id === "soup-veg-tomato")!;

      const { kot } = store.placeOrder(
        party.id,
        [
          {
            menuItemId: chickenThali.id,
            quantity: 2,
            breadOption: "JWARI_BHAKRI",
            spiceLevel: "EXTRA_SPICY",
          },
          {
            menuItemId: tomatoSoup.id,
            quantity: 1,
            notes: "Extra hot croutons",
          },
        ],
        true
      );

      const html = generateKotHtml(kot);

      // 1. Header is in Marathi
      expect(html).toContain("ऑर्डर - टेबल नं. 4");

      // 2. Metadata labels in Marathi
      expect(html).toContain("केओटी:");
      expect(html).toContain("वेळ:");
      expect(html).toContain("वेटर:");
      expect(html).toContain("व्यक्ती:");
      expect(html).toContain("किचन विभाग:");

      // 3. Table headers in Marathi
      expect(html).toContain("नग (Qty)");
      expect(html).toContain("पदार्थ तपशील (Dish Details)");

      // 4. Large Marathi Devanagari dish name
      expect(html).toContain("marathi-title");
      expect(html).toContain("टोमॅटो सूप");
      expect(html).toContain("थाळी"); // from रेग्युलर चिकन थाळी

      // 5. English subtitle in parenthesis
      expect(html).toContain("Cream of Tomato Soup");

      // 6. Bread and spice in Marathi
      expect(html).toContain("ज्वारी भाकरी");
      expect(html).toContain("झणझणीत तिखट");
    });

    it("buildKotEscPos embeds the Marathi Devanagari raster header bitmap", () => {
      const party = store.createPartyAtTable(6, 2, "Shinde");
      const vegThali = store.menuItems.find((m) => m.isThali)!;

      const { kot } = store.placeOrder(party.id, [{ menuItemId: vegThali.id, quantity: 1 }], true);
      const bytes = buildKotEscPos(kot, undefined, false, "80mm");

      // Contains ESC/POS GS v 0 raster header bitmap (0x1D, 0x76, 0x30)
      const hasRasterGraphic = bytes.some(
        (b, i) => b === 0x1d && bytes[i + 1] === 0x76 && bytes[i + 2] === 0x30
      );
      expect(hasRasterGraphic).toBe(true);

      const text = new TextDecoder().decode(bytes);
      expect(text).toContain("*** K O T ***");
      expect(text).toContain("TABLE 6");
      expect(text).toContain("Kitchen Copy");
      expect(text).toContain(vegThali.localName || "थाळी");
    });
  });
});
