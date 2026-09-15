/**
 * Kolhapuri Khanawal Restaurant Operating System
 * Hotel POS Expense Master & Practical Accounting Taxonomy
 */

export type ExpenseFrequency = "DAILY" | "FREQUENT" | "OCCASIONAL" | "ONE_TIME" | "MONTHLY";

export type MasterExpenseCategory =
  | "Food & Raw Materials"
  | "Fuel"
  | "Packaging"
  | "Cleaning & Sanitation"
  | "Staff & Labour"
  | "Utilities & Connectivity"
  | "Repairs & Maintenance"
  | "Kitchen Supplies"
  | "Office & Administrative"
  | "Equipment & Setup"
  | "Supplier / Vendor Payments"
  | "Miscellaneous / Petty Expenses"
  | "Staff Welfare";

export interface ExpenseCategoryConfig {
  id: string;
  name: MasterExpenseCategory;
  localName: string; // Marathi label
  description: string;
  iconName: string;
  colorClass: string;
}

export interface ExpenseSubcategoryConfig {
  name: string;
  category: MasterExpenseCategory;
  defaultFrequency: ExpenseFrequency;
  localName?: string;
  suggestedVendors?: string[];
}

export interface ExpenseRecord {
  id: string;
  date: string;
  category: MasterExpenseCategory | string;
  subcategory?: string;
  item?: string; // Backwards compatibility alias for subcategory / description
  party?: string; // Vendor / Staff / Payee Name (e.g. "Mahesh", "Raju Chicken Supplier", "Ranjit", "Bhandi Bai")
  paidTo?: string; // Backwards compatibility alias for party
  amount: number;
  paymentMethod: "CASH" | "UPI" | "BANK_TRANSFER";
  frequency?: ExpenseFrequency;
  notes?: string;
  receiptPhotoUrl?: string;
  isReviewed: boolean;
  createdAt: string;
}
