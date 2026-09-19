import { describe, it, expect, beforeEach } from "vitest";
import { getBusinessDateKey, resolveKotOrderNumber } from "@/lib/orders/order-numbering";
import { buildKotEscPos } from "@/lib/printing/escpos-builder";
import { generateKotHtml } from "@/lib/printing/thermal-printer";
import { Kot } from "@/types/orders";
import { RestaurantStore } from "@/lib/store/restaurant-store";

describe("Daily Sequential Order & Parcel Numbering Engine (10:00 AM IST Reset)", () => {
  describe("1. Operational Business Day Calculations (getBusinessDateKey)", () => {
    it("should consider 10:00 AM IST as the start of the business day", () => {
      // 2026-09-20 10:00:00 IST -> UTC is 04:30:00
      const morning10am = new Date("2026-09-20T04:30:00.000Z");
      expect(getBusinessDateKey(morning10am)).toBe("2026-09-20");
    });

    it("should treat late night orders (e.g., 11:30 PM IST) as the same business day", () => {
      // 2026-09-20 23:30:00 IST -> UTC is 18:00:00
      const nightOrder = new Date("2026-09-20T18:00:00.000Z");
      expect(getBusinessDateKey(nightOrder)).toBe("2026-09-20");
    });

    it("should treat early morning orders (e.g., 02:00 AM, 09:59 AM IST next day) as the previous business day", () => {
      // 2026-09-21 02:00:00 IST -> UTC is 2026-09-20T20:30:00.000Z
      const earlyMorning = new Date("2026-09-20T20:30:00.000Z");
      expect(getBusinessDateKey(earlyMorning)).toBe("2026-09-20");

      // 2026-09-21 09:59:59 IST -> UTC is 2026-09-21T04:29:59.000Z
      const justBeforeCutoff = new Date("2026-09-21T04:29:59.000Z");
      expect(getBusinessDateKey(justBeforeCutoff)).toBe("2026-09-20");
    });

    it("should roll over to a new business day at 10:00:00 AM IST sharp", () => {
      // 2026-09-21 10:00:00 IST -> UTC is 2026-09-21T04:30:00.000Z
      const nextDay10am = new Date("2026-09-21T04:30:00.000Z");
      expect(getBusinessDateKey(nextDay10am)).toBe("2026-09-21");
    });
  });

  describe("2. Separate Daily Sequences for Dine-In and Parcel in RestaurantStore", () => {
    let store: RestaurantStore;

    beforeEach(() => {
      store = new RestaurantStore();
    });

    it("should assign sequential dailyOrderNumber (1, 2, 3...) for dine-in parties", () => {
      const p1 = store.createPartyAtTable(1, 2, "Patil");
      const p2 = store.createPartyAtTable(2, 4, "Deshmukh");
      const p3 = store.createPartyAtTable(3, 2, "Jadhav");

      expect(p1.dailyOrderNumber).toBe(1);
      expect(p2.dailyOrderNumber).toBe(2);
      expect(p3.dailyOrderNumber).toBe(3);
    });

    it("should assign separate sequential dailyParcelNumber (1, 2, 3...) for takeaway orders", () => {
      const p1 = store.createTakeawayParty("Rahul", "9876543210");
      const p2 = store.createTakeawayParty("Sunil", "9876543211");

      expect(p1.dailyParcelNumber).toBe(1);
      expect(p1.partyCode).toBe("PARCEL-01");

      expect(p2.dailyParcelNumber).toBe(2);
      expect(p2.partyCode).toBe("PARCEL-02");
    });

    it("should maintain independent sequences without interfering with each other", () => {
      const d1 = store.createPartyAtTable(1, 2, "Patil");
      const t1 = store.createTakeawayParty("Takeaway 1");
      const d2 = store.createPartyAtTable(2, 4, "Deshmukh");
      const t2 = store.createTakeawayParty("Takeaway 2");

      expect(d1.dailyOrderNumber).toBe(1);
      expect(t1.dailyParcelNumber).toBe(1);

      expect(d2.dailyOrderNumber).toBe(2);
      expect(t2.dailyParcelNumber).toBe(2);
    });

    it("should propagate daily numbers onto generated KOTs and Orders", () => {
      const dineInParty = store.createPartyAtTable(4, 2, "Gaikwad");
      const thali = store.menuItems[0];

      const orderResult = store.placeOrder(dineInParty.id, [
        { menuItemId: thali.id, quantity: 2 },
      ]);

      expect(orderResult.order.dailyOrderNumber).toBe(1);
      expect(orderResult.kot.dailyOrderNumber).toBe(1);
      expect(orderResult.kot.isTakeaway).toBeFalsy();

      const parcelParty = store.createTakeawayParty("Kadam");
      const parcelOrderResult = store.placeOrder(parcelParty.id, [
        { menuItemId: thali.id, quantity: 1 },
      ]);

      expect(parcelOrderResult.order.dailyParcelNumber).toBe(1);
      expect(parcelOrderResult.kot.dailyParcelNumber).toBe(1);
      expect(parcelOrderResult.kot.isTakeaway).toBe(true);
    });
  });

  describe("3. KOT Formatting: ESC/POS and HTML thermal outputs", () => {
    const mockDineInKot: Kot = {
      id: "kot-dine-1",
      orderId: "ord-dine-1",
      kotNumber: "KOT-D1",
      tableNumber: 5,
      partyId: "party-d1",
      partyCode: "TBL-5-A",
      waiterId: "w1",
      waiterName: "Ramesh",
      stationCode: "MAIN_KITCHEN",
      status: "NEW",
      createdAt: new Date().toISOString(),
      dailyOrderNumber: 7,
      isTakeaway: false,
      guestCount: 3,
      elapsedSeconds: 0,
      urgencyLevel: "NORMAL",
      items: [
        {
          id: "item-1",
          kotId: "kot-dine-1",
          orderItemId: "oi-1",
          menuItemId: "m1",
          menuItemName: "Special Mutton Thali",
          menuItemLocalName: "स्पेशल मटन थाळी",
          quantity: 2,
          status: "NEW",
        },
      ],
    };

    const mockParcelKot: Kot = {
      id: "kot-parcel-1",
      orderId: "ord-parcel-1",
      kotNumber: "KOT-P1",
      tableNumber: 0,
      partyId: "party-p1",
      partyCode: "PARCEL-04",
      customerName: "Vikas Bhosale",
      waiterId: "w1",
      waiterName: "Counter",
      stationCode: "MAIN_KITCHEN",
      status: "NEW",
      createdAt: new Date().toISOString(),
      dailyParcelNumber: 4,
      isTakeaway: true,
      guestCount: 1,
      elapsedSeconds: 0,
      urgencyLevel: "NORMAL",
      items: [
        {
          id: "item-2",
          kotId: "kot-parcel-1",
          orderItemId: "oi-2",
          menuItemId: "m2",
          menuItemName: "Chicken Sukka",
          menuItemLocalName: "चिकन सुक्का",
          quantity: 1,
          status: "NEW",
        },
      ],
    };

    it("should print daily order number prominently in ESC/POS binary output for dine-in", () => {
      const bytes = buildKotEscPos(mockDineInKot);
      const text = new TextDecoder().decode(bytes);

      expect(text).toContain(">> ORDER #7 <<");
      expect(text).toContain("ORDER #7 - TABLE NO. 5");
    });

    it("should print daily parcel order number prominently in ESC/POS binary output for parcel", () => {
      const bytes = buildKotEscPos(mockParcelKot);
      const text = new TextDecoder().decode(bytes);

      expect(text).toContain(">> PARCEL (TAKEAWAY) <<");
      expect(text).toContain(">> PARCEL ORDER #4 <<");
      expect(text).toContain("ORDER - PARCEL #4");
    });

    it("should render daily order number in HTML thermal output for dine-in", () => {
      const html = generateKotHtml(mockDineInKot);

      expect(html).toContain("kot-order-top");
      expect(html).toContain("ORDER #7 (ऑर्डर क्र. 7)");
      expect(html).toContain("ORDER #7 — ऑर्डर - टेबल नं. 5");
    });

    it("should render daily parcel order number in HTML thermal output for parcel", () => {
      const html = generateKotHtml(mockParcelKot);

      expect(html).toContain("kot-parcel-top");
      expect(html).toContain("🥡 पार्सल (PARCEL) — #4");
      expect(html).toContain("ऑर्डर - पार्सल #4");
    });

    it("should resolve fallback numbering gracefully from partyCode if dailyParcelNumber is missing", () => {
      const legacyParcelKot: Kot = {
        ...mockParcelKot,
        dailyParcelNumber: undefined,
        partyCode: "PARCEL-12",
      };

      const resolved = resolveKotOrderNumber(legacyParcelKot);
      expect(resolved.orderNumber).toBe(12);
      expect(resolved.orderTitle).toBe("PARCEL ORDER #12");
      expect(resolved.marathiOrderTitle).toBe("पार्सल ऑर्डर क्र. 12");
    });
  });
});
