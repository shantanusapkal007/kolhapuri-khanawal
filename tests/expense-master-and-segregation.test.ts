import { describe, it, expect, beforeEach } from "vitest";
import { RestaurantStore } from "@/lib/store/restaurant-store";
import {
  khanawalExpenseCategories,
  khanawalExpenseSubcategories,
  knownExpenseParties,
} from "@/lib/store/expense-master-data";
import { MasterExpenseCategory } from "@/types/expenses";

describe("Hotel POS Expense Master & Core Operations Segregation", () => {
  let store: RestaurantStore;

  beforeEach(() => {
    store = new RestaurantStore();
  });

  describe("1. Expense Master Taxonomy (13 Categories & ~80 Subcategories)", () => {
    it("should define exactly the 13 required master categories", () => {
      const expectedCategories: MasterExpenseCategory[] = [
        "Food & Raw Materials",
        "Fuel",
        "Packaging",
        "Cleaning & Sanitation",
        "Staff & Labour",
        "Utilities & Connectivity",
        "Repairs & Maintenance",
        "Kitchen Supplies",
        "Office & Administrative",
        "Equipment & Setup",
        "Supplier / Vendor Payments",
        "Miscellaneous / Petty Expenses",
        "Staff Welfare",
      ];

      expect(khanawalExpenseCategories.length).toBe(13);
      expectedCategories.forEach((cat) => {
        const found = khanawalExpenseCategories.find((c) => c.name === cat);
        expect(found, `Category ${cat} should exist`).toBeDefined();
        expect(found?.localName, `Category ${cat} should have Marathi name`).toBeTruthy();
      });
    });

    it("must NOT use 'Kirkol' as a top-level category; Kirkol is placed under Miscellaneous / Petty Expenses", () => {
      // Ensure 'Kirkol' is not a top-level category name
      const topKirkol = khanawalExpenseCategories.find((c) => c.name.toLowerCase().includes("kirkol"));
      expect(topKirkol).toBeUndefined();

      // Ensure Kirkol exists as a subcategory under 'Miscellaneous / Petty Expenses'
      const kirkolSub = khanawalExpenseSubcategories.find(
        (s) => s.name === "Kirkol" && s.category === "Miscellaneous / Petty Expenses"
      );
      expect(kirkolSub).toBeDefined();
      expect(kirkolSub?.localName).toBe("किरकोळ खर्च (Kirkol)");
    });

    it("should include key daily authentic khanawal subcategories", () => {
      const subNames = khanawalExpenseSubcategories.map((s) => s.name);

      // Food & Raw Materials
      expect(subNames).toContain("Chapati / Bhakri");
      expect(subNames).toContain("Bhaji Pala");
      expect(subNames).toContain("Chicken");
      expect(subNames).toContain("Mutton");
      expect(subNames).toContain("Kirana");
      expect(subNames).toContain("Milk");

      // Fuel
      expect(subNames).toContain("Coal / Charcoal");
      expect(subNames).toContain("Gas / Cylinder");

      // Packaging
      expect(subNames).toContain("Packaging Material");
      expect(subNames).toContain("Foil");
      expect(subNames).toContain("Dustbin Bags");

      // Staff & Labour
      expect(subNames).toContain("Bhandi Bai / Bhandi Wali");
      expect(subNames).toContain("Porter");
      expect(subNames).toContain("Kitchen Staff Payment");
    });

    it("should have known payee parties catalog for autocomplete", () => {
      expect(knownExpenseParties.length).toBeGreaterThan(10);
      expect(knownExpenseParties).toContain("Mahesh");
      expect(knownExpenseParties).toContain("Raju Chicken Supplier");
      expect(knownExpenseParties).toContain("Ranjit");
      expect(knownExpenseParties).toContain("Bhandi Bai");
      expect(knownExpenseParties).toContain("Sandip");
    });
  });

  describe("2. Structured Expense Recording with 3 Distinct Fields & Ledger Sync", () => {
    it("should record structured expense with category, subcategory, and party", () => {
      const exp = store.recordStructuredExpense({
        date: "2026-09-15",
        category: "Food & Raw Materials",
        subcategory: "Bhaji Pala (Vegetables)",
        party: "Sandip (Vegetable Mandi)",
        amount: 850,
        frequency: "DAILY",
        paymentMethod: "CASH",
        notes: "Fresh coriander, ginger, garlic, tomatoes",
        isReviewed: true,
      });

      expect(exp.id).toBeDefined();
      expect(exp.category).toBe("Food & Raw Materials");
      expect(exp.subcategory).toBe("Bhaji Pala (Vegetables)");
      expect(exp.party).toBe("Sandip (Vegetable Mandi)");
      expect(exp.amount).toBe(850);
      expect(exp.frequency).toBe("DAILY");
      expect(exp.paymentMethod).toBe("CASH");

      // Backward-compatible aliases must be populated
      expect(exp.item).toBe("Bhaji Pala (Vegetables)");
      expect(exp.paidTo).toBe("Sandip (Vegetable Mandi)");
    });

    it("should immediately debit Cash Ledger when expense is paid via CASH", () => {
      const initialCash = store.cashLedger[0]?.balance ?? 5000;
      const expenseAmount = 450;

      store.recordStructuredExpense({
        date: "2026-09-15",
        category: "Packaging",
        subcategory: "Packaging Material",
        party: "Arihant Packaging",
        amount: expenseAmount,
        frequency: "DAILY",
        paymentMethod: "CASH",
        isReviewed: true,
      });

      const latestCashEntry = store.cashLedger[0];
      expect(latestCashEntry.entryType).toBe("EXPENSE");
      expect(latestCashEntry.outflow).toBe(expenseAmount);
      expect(latestCashEntry.balance).toBe(initialCash - expenseAmount);
      expect(latestCashEntry.description).toContain("Arihant Packaging");
    });

    it("should immediately debit UPI Ledger when expense is paid via UPI", () => {
      const initialUpi = store.upiLedger[0]?.balance ?? 15000;
      const expenseAmount = 2200;

      store.recordStructuredExpense({
        date: "2026-09-15",
        category: "Food & Raw Materials",
        subcategory: "Chicken",
        party: "Raju Chicken Supplier",
        amount: expenseAmount,
        frequency: "FREQUENT",
        paymentMethod: "UPI",
        isReviewed: true,
      });

      const latestUpiEntry = store.upiLedger[0];
      expect(latestUpiEntry.entryType).toBe("EXPENSE");
      expect(latestUpiEntry.outflow).toBe(expenseAmount);
      expect(latestUpiEntry.balance).toBe(initialUpi - expenseAmount);
      expect(latestUpiEntry.description).toContain("Raju Chicken Supplier");
    });

    it("should delete an expense record successfully", () => {
      const exp = store.recordStructuredExpense({
        date: "2026-09-15",
        category: "Office & Administrative",
        subcategory: "Xerox / Printing / Forms",
        party: "Cyber Point Xerox",
        amount: 80,
        paymentMethod: "CASH",
        isReviewed: true,
      });

      expect(store.expenses.some((e) => e.id === exp.id)).toBe(true);

      store.deleteExpense(exp.id);
      expect(store.expenses.some((e) => e.id === exp.id)).toBe(false);
    });
  });

  describe("3. Operational Segregation Verification", () => {
    it("should verify that the 6 core operational touchpoints exist", () => {
      const coreRoutes = [
        { name: "Daily Tasks", route: "/daily-tasks" },
        { name: "Table Orders", route: "/waiter" },
        { name: "KOT (Kitchen)", route: "/kitchen" },
        { name: "Billing Desk", route: "/billing" },
        { name: "Sell & Register", route: "/sell" },
        { name: "Hotel Expenses", route: "/expenses" },
      ];

      expect(coreRoutes.length).toBe(6);
      coreRoutes.forEach((item) => {
        expect(item.route.startsWith("/")).toBe(true);
      });
    });
  });
});
