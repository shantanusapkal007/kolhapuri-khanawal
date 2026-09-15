import { describe, it, expect, beforeEach } from "vitest";
import { globalRestaurantStore } from "@/lib/store/restaurant-store";
import { generateDayEndReportHtml } from "@/lib/printing/thermal-printer";

describe("Day-End Z-Report (दिवसाचा हिशोब) & Reconciliation", () => {
  beforeEach(() => {
    // Reset or ensure known store state
    const store = globalRestaurantStore;
    // ensure currentUser has cashier/manager role
    store.currentUser = {
      id: "u-01",
      email: "manager@kolhapurikhanawal.com",
      name: "Suresh Rao",
      role: "MANAGER",
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  });

  it("calculates accurate day-end totals for settled bills across tenders", () => {
    const store = globalRestaurantStore;
    const report = store.generateDayEndReport();

    expect(report).toBeDefined();
    expect(report.reportId).toContain("Z-REP-");
    expect(report.totalBillsSettled).toBeGreaterThanOrEqual(0);
    expect(typeof report.grossSales).toBe("number");
    expect(typeof report.taxableSales).toBe("number");
    expect(typeof report.cgstTotal).toBe("number");
    expect(typeof report.sgstTotal).toBe("number");
    expect(typeof report.netRevenue).toBe("number");

    // Tender breakdown consistency
    const tendersSum = report.tenders.cash + report.tenders.upi + report.tenders.card;
    expect(Math.round(tendersSum)).toBe(Math.round(report.netRevenue));

    // GST consistency (CGST and SGST should match at 2.5%)
    expect(report.cgstTotal!).toBeCloseTo(report.sgstTotal!, 1);
  });

  it("identifies top-selling dishes and counts audits & voids", () => {
    const store = globalRestaurantStore;
    const report = store.generateDayEndReport();

    expect(Array.isArray(report.topDishes)).toBe(true);
    expect(typeof report.auditDiscrepancyCount).toBe("number");
    expect(typeof report.cancelledKotsCount).toBe("number");

    if (report.topDishes && report.topDishes.length > 0) {
      const topDish = report.topDishes[0];
      expect(topDish.name).toBeDefined();
      expect(topDish.qty).toBeGreaterThan(0);
      expect(topDish.revenue).toBeGreaterThanOrEqual(0);
    }
  });

  it("generates thermal printable 80mm and 58mm HTML for Z-Report", () => {
    const store = globalRestaurantStore;
    const report = store.generateDayEndReport();

    const html80 = generateDayEndReportHtml(report, { paperWidth: "80mm" });
    expect(html80).toContain("80mm");
    expect(html80).toContain("DAILY CLOSURE / Z-REPORT");
    expect(html80).toContain("दिवसाचा हिशोब");
    expect(html80).toContain(report.reportId);
    expect(html80).toContain("GROSS SALES:");
    expect(html80).toContain("NET REVENUE:");
    expect(html80).toContain("MANAGER SIGNATURE:");

    const html58 = generateDayEndReportHtml(report, { paperWidth: "58mm" });
    expect(html58).toContain("58mm");
    expect(html58).toContain("Z-REPORT");
  });
});
