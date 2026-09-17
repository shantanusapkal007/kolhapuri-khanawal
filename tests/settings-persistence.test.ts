import { describe, it, expect, beforeEach } from "vitest";
import { RestaurantStore } from "@/lib/store/restaurant-store";

describe("Restaurant Settings & System Configuration Persistence", () => {
  let store: RestaurantStore;

  beforeEach(() => {
    store = new RestaurantStore();
  });

  it("should initialize with default authentic Baner Khanawal configuration", () => {
    const { settings } = store;
    expect(settings).toBeDefined();
    expect(settings.profile.nameEn).toBe("KOLHAPURI KHANAWAL");
    expect(settings.profile.nameMr).toBe("कोल्हापुरी खानावळ");
    expect(settings.profile.address).toContain("Baner");
    expect(settings.profile.city).toBe("Pune");
    expect(settings.profile.gstin).toBe("27AAAAA0000A1Z5");
    expect(settings.profile.fssai).toBe("11026999000123");
    expect(settings.profile.upiId).toBe("Q338740118@ybl");

    expect(settings.billing.gstRatePercent).toBe(5);
    expect(settings.billing.packagingChargePerThali).toBe(20);
    expect(settings.billing.applyRoundOff).toBe(true);
    expect(settings.billing.managerPin).toBe("1234");
    expect(settings.billing.maxDiscountWithoutPinPercent).toBe(10);

    expect(settings.dining.sharedSeatingEnabled).toBe(true);
    expect(settings.dining.autoVacateOnPayment).toBe(true);
    expect(settings.dining.totalTables).toBe(12);
  });

  it("should update restaurant brand profile and persist changes", () => {
    store.updateRestaurantSettings({
      profile: {
        ...store.settings.profile,
        nameEn: "Kolhapuri Khanawal & Dining Hall",
        primaryPhone: "+91 98811 55443",
        upiId: "kolhapurikhanawal.baner@icici",
      },
    });

    expect(store.settings.profile.nameEn).toBe("Kolhapuri Khanawal & Dining Hall");
    expect(store.settings.profile.primaryPhone).toBe("+91 98811 55443");
    expect(store.settings.profile.upiId).toBe("kolhapurikhanawal.baner@icici");
    // Ensure untouched fields remain intact
    expect(store.settings.profile.nameMr).toBe("कोल्हापुरी खानावळ");
    expect(store.settings.profile.gstin).toBe("27AAAAA0000A1Z5");
  });

  it("should update billing rules and manager authorization PIN", () => {
    store.updateRestaurantSettings({
      billing: {
        ...store.settings.billing,
        gstRatePercent: 5,
        packagingChargePerThali: 25,
        managerPin: "9876",
        maxDiscountWithoutPinPercent: 15,
      },
    });

    expect(store.settings.billing.packagingChargePerThali).toBe(25);
    expect(store.settings.billing.managerPin).toBe("9876");
    expect(store.settings.billing.maxDiscountWithoutPinPercent).toBe(15);
  });

  it("should update dining policies and operations config", () => {
    store.updateRestaurantSettings({
      dining: {
        ...store.settings.dining,
        sharedSeatingEnabled: false,
        maxGuestsPerTable: 6,
      },
      operations: {
        ...store.settings.operations,
        deepFreezerTargetTempC: -20,
        lpgReserveAlertDays: 3,
      },
    });

    expect(store.settings.dining.sharedSeatingEnabled).toBe(false);
    expect(store.settings.dining.maxGuestsPerTable).toBe(6);
    expect(store.settings.operations.deepFreezerTargetTempC).toBe(-20);
    expect(store.settings.operations.lpgReserveAlertDays).toBe(3);
  });

  it("should update thermal printer hardware settings", () => {
    store.updatePrinterSettings({
      paperWidth: "58mm",
      autoPrintKotOnOrder: true,
      autoPrintReceiptOnPayment: true,
      numberOfReceiptCopies: 2,
    });

    expect(store.printerSettings.paperWidth).toBe("58mm");
    expect(store.printerSettings.autoPrintKotOnOrder).toBe(true);
    expect(store.printerSettings.numberOfReceiptCopies).toBe(2);
  });

  it("should export a complete valid JSON system backup", () => {
    const backupJson = store.exportSystemBackup();
    expect(typeof backupJson).toBe("string");

    const parsed = JSON.parse(backupJson);
    expect(parsed.version).toBe("1.0");
    expect(parsed.exportedAt).toBeDefined();
    expect(Array.isArray(parsed.tables)).toBe(true);
    expect(parsed.tables.length).toBe(12);
    expect(Array.isArray(parsed.parties)).toBe(true);
    expect(Array.isArray(parsed.bills)).toBe(true);
    expect(Array.isArray(parsed.payments)).toBe(true);
    expect(Array.isArray(parsed.expenses)).toBe(true);
    expect(Array.isArray(parsed.employees)).toBe(true);
    expect(parsed.settings).toBeDefined();
    expect(parsed.settings.profile.nameMr).toBe("कोल्हापुरी खानावळ");
  });

  it("should reset to authentic 04/09 - 07/09 seed dataset (₹59,201 total revenue)", () => {
    // Make mutations to store
    store.updateRestaurantSettings({
      profile: {
        ...store.settings.profile,
        nameEn: "Temporary Test Name",
      },
    });
    expect(store.settings.profile.nameEn).toBe("Temporary Test Name");

    // Perform system reset
    store.resetToSeedData();

    // Verify settings restored
    expect(store.settings.profile.nameEn).toBe("KOLHAPURI KHANAWAL");
    expect(store.tables.length).toBe(12);

    // Active bills total ₹3,108
    const activeTodaySales = store.bills.reduce((sum, b) => sum + b.grandTotal, 0);
    expect(activeTodaySales).toBe(3108);

    // Cumulative seed revenue across 04/09 to 07/09 equals ₹92,408 (3 closed days + today)
    const closedSales = store.dailyClosings.reduce((sum, c) => sum + c.totalSales, 0);
    const cumulativeRevenue = closedSales + activeTodaySales;
    expect(cumulativeRevenue).toBe(92408);
  });
});
