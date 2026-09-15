import { describe, it, expect, beforeEach } from "vitest";
import { RestaurantStore } from "@/lib/store/restaurant-store";

describe("Khanawal Core Daily Operations & Accounting Integrity", () => {
  let store: RestaurantStore;

  beforeEach(() => {
    store = new RestaurantStore();
  });

  it("Scenario 1: Quick Purchase updates physical stock, supplier ledger, and tracks price changes", () => {
    const initialStock = store.ingredients.find((i) => i.id === "ing-chicken")!.physicalStock;

    // Raju Poultry delivers 5kg chicken at ₹395 (higher than previous rate)
    const entry = store.recordQuickPurchase({
      supplierId: "sup-raju-chicken",
      supplierName: "Raju Poultry Farm",
      ingredientId: "ing-chicken",
      ingredientName: "Fresh Chicken",
      quantity: 5,
      unit: "kg",
      rate: 395,
      totalAmount: 1975,
      paymentMethod: "CASH",
      paymentStatus: "PAID",
      date: "2026-09-07",
    });

    expect(entry.id).toBeDefined();

    // Verify stock increment
    const chicken = store.ingredients.find((i) => i.id === "ing-chicken")!;
    expect(chicken.physicalStock).toBe(initialStock + 5);
    expect(chicken.currentCostPerUnit).toBe(395);

    // Verify price history tracking
    const priceTrend = store.priceHistory.find((p) => p.ingredientId === "ing-chicken");
    expect(priceTrend).toBeDefined();
    expect(priceTrend?.ratePerUnit).toBe(395);

    // Verify cash ledger outflow
    expect(store.cashLedger[0].outflow).toBe(1975);
    expect(store.cashLedger[0].entryType).toBe("PURCHASE");
  });

  it("Scenario 2: 1-Tap Repeat Purchase clones a previous order with today's date", () => {
    const pastPurchase = store.purchases[0];
    const initialStock = store.ingredients.find((i) => i.id === pastPurchase.ingredientId)?.physicalStock || 0;

    const repeated = store.repeatPurchase(pastPurchase.id);

    expect(repeated.supplierId).toBe(pastPurchase.supplierId);
    expect(repeated.quantity).toBe(pastPurchase.quantity);
    expect(repeated.rate).toBe(pastPurchase.rate);
    expect(repeated.totalAmount).toBe(pastPurchase.totalAmount);
    expect(repeated.date).toBe(new Date().toISOString().split("T")[0]);

    if (pastPurchase.ingredientId) {
      const updatedStock = store.ingredients.find((i) => i.id === pastPurchase.ingredientId)!.physicalStock;
      expect(updatedStock).toBe(initialStock + pastPurchase.quantity);
    }
  });

  it("Scenario 3: Accounting Separation — Advance is NOT an expense; Invoice is net-settled without double counting", () => {
    // 1. Pay ₹2,000 Advance to Mahesh Bhakri Kendra
    store.recordSupplierAdvance({
      supplierId: "sup-mahesh-bhakri",
      supplierName: "Mahesh Bhakri & Chapati Kendra",
      amount: 2000,
      date: "2026-09-05",
      paymentMethod: "CASH",
      notes: "Advance for 4 days bhakri lot",
    });

    const sup = store.suppliers.find((s) => s.id === "sup-mahesh-bhakri")!;
    expect(sup.currentAdvance).toBe(2000);

    // 2. Mahesh Kendra brings an invoice of ₹2,100 on 07/09
    const initialCash = store.cashLedger[0].balance;
    const settlement = store.settleSupplierInvoice("sup-mahesh-bhakri", 2100, "CASH");

    // Advance consumed: ₹2,000. Net cash out of pocket: only ₹100!
    expect(settlement.adjustedFromAdvance).toBe(2000);
    expect(settlement.netPaid).toBe(100);
    expect(sup.currentAdvance).toBe(0);

    // Outflow in cash drawer is only the net difference (₹100), NOT ₹2,100 + ₹2,000!
    expect(store.cashLedger[0].outflow).toBe(100);
    expect(store.cashLedger[0].balance).toBe(initialCash - 100);
  });

  it("Scenario 4: Structured Expenses & Unclassified Review Alert", () => {
    // Record an unclassified market shopping expense
    const exp = store.recordStructuredExpense({
      date: "2026-09-07",
      category: "UNCLASSIFIED",
      item: "Helper local grocery purchase",
      amount: 350,
      paidTo: "Local Bazaar",
      paymentMethod: "CASH",
      isReviewed: false,
    });

    expect(exp.isReviewed).toBe(false);
    expect(store.getOwnerSummary().unreviewedExpensesCount).toBeGreaterThan(0);

    // Owner reviews and reclassifies as FOOD_PURCHASE
    const reviewed = store.markExpenseReviewed(exp.id, "FOOD_PURCHASE");
    expect(reviewed.isReviewed).toBe(true);
    expect(reviewed.category).toBe("FOOD_PURCHASE");
  });

  it("Scenario 5: Wastage Logger deducts physical inventory and records reason", () => {
    const initialStock = store.ingredients.find((i) => i.id === "ing-rice")!.physicalStock;

    const wastage = store.recordWastageRecord({
      ingredientId: "ing-rice",
      ingredientName: "Indrayani Rice",
      quantity: 1.5,
      unit: "kg",
      reason: "BURNT_FOOD",
      estimatedCost: 100,
      recordedBy: "Suresh Maharaj",
      notes: "Bottom of vessel scorched during evening batch",
    });

    expect(wastage.approvalStatus).toBe("APPROVED");
    const updatedStock = store.ingredients.find((i) => i.id === "ing-rice")!.physicalStock;
    expect(updatedStock).toBe(initialStock - 1.5);
  });

  it("Scenario 6: Staff 1-Click Attendance & Salary Calculation with advance recovery", () => {
    // 1-Click Mark All Present
    const attendance = store.markAllStaffAttendance("PRESENT");
    expect(attendance.length).toBeGreaterThanOrEqual(8);
    expect(attendance.every((a) => a.status === "PRESENT")).toBe(true);

    // Cook Suresh (₹28,000 salary) has ₹1,500 pending advance
    const calc = store.calculateStaffSalary("emp-suresh", "2026-09");
    expect(calc.baseSalary).toBe(28000);
    expect(calc.advanceDeducted!).toBe(Math.min(1500, calc.calculatedGross!));
    expect(calc.netPayable!).toBe(calc.calculatedGross! - calc.advanceDeducted!);
  });

  it("Scenario 7: Daily Purchase Planner flags critical stock levels and recommends quantities", () => {
    // Chicken is 2kg, requirement is 10kg
    const recommendations = store.generateDailyPurchasePlanner();
    const chickenRec = recommendations.find((r) => r.ingredientId === "ing-chicken")!;

    expect(chickenRec.currentStock).toBe(2);
    expect(chickenRec.expectedDailyRequirement).toBe(10);
    expect(chickenRec.recommendedPurchaseQty).toBe(8);
    expect(chickenRec.urgency).toBe("HIGH");
  });

  it("Scenario 8: Daily Closing Snapshot captures cash/UPI reconciliation and checklist", () => {
    const snapshot = store.performDailyClosing({
      actualCash: 7160,
      actualUpi: 17440,
      checklistItems: {
        gasValves: true,
        freezerLocked: true,
        cashCounted: true,
        kotsCleared: true,
      },
      notes: "All 12 tables closed smoothly.",
    });

    expect(snapshot.id).toContain("cls-");
    expect(snapshot.checklistConfirmed).toBe(true);
    expect(snapshot.totalSales).toBeGreaterThan(0);
    expect(store.dailyClosings[0].id).toBe(snapshot.id);
  });

  it("Scenario 9: Owner Summary immediately answers 5 core operational questions", () => {
    const summary = store.getOwnerSummary();

    // 1. Sales & tenders
    expect(summary.todaysSales).toBeGreaterThanOrEqual(0);
    expect(typeof summary.cashSales).toBe("number");
    expect(typeof summary.upiSales).toBe("number");

    // 2. Cash in drawer
    expect(summary.cashInDrawer).toBeGreaterThan(0);

    // 3. UPI in bank
    expect(summary.upiInBank).toBeGreaterThan(0);

    // 4. Meat stock
    expect(summary.chickenStockKg).toBeGreaterThanOrEqual(0);
    expect(summary.muttonStockKg).toBeGreaterThanOrEqual(0);

    // 5. Thalis sold
    expect(summary.thalisSold).toBe(summary.chickenThalisSold + summary.muttonThalisSold);
  });
});
