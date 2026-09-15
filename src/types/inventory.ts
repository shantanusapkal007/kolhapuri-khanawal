/**
 * Kolhapuri Khanawal Restaurant Operating System
 * Phase 0: Inventory, Recipes, Preparations & Stock Ledger Types
 */

export type StandardUnit =
  | "kg"
  | "g"
  | "l"
  | "ml"
  | "piece"
  | "dozen"
  | "packet"
  | "box"
  | "bottle"
  | "portion";

export type StockHealthStatus =
  | "HEALTHY"
  | "WATCH"
  | "LOW"
  | "CRITICAL"
  | "OUT_OF_STOCK";

export type StockTransactionType =
  | "PURCHASE"
  | "SALE_CONSUMPTION"
  | "PREPARATION_CONSUMPTION"
  | "PREPARATION_OUTPUT"
  | "WASTAGE"
  | "SPOILAGE"
  | "STOCK_ADJUSTMENT"
  | "STOCK_COUNT"
  | "TRANSFER_IN"
  | "TRANSFER_OUT"
  | "RETURN_TO_SUPPLIER"
  | "OPENING_BALANCE"
  | "MANUAL_CORRECTION";

export interface IngredientCategory {
  id: string;
  name: string;
  code: string;
  description?: string;
}

export interface Ingredient {
  id: string;
  categoryId: string;
  categoryName?: string;
  name: string;
  localName?: string; // e.g. "तांबडा रस्सा मसाला", "कोंबडी"
  baseUnit: StandardUnit;
  physicalStock: number;
  reservedStock: number;
  availableStock: number;
  parLevel: number;
  reorderLevel: number;
  criticalLevel: number;
  currentCostPerUnit: number;
  weightedAvgCostPerUnit: number;
  healthStatus: StockHealthStatus;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Intermediate Kitchen Preparations (e.g. Marinated Chicken, Tambda/Pandhra Rassa base, Masala blends)
 */
export interface Preparation {
  id: string;
  name: string;
  localName?: string;
  outputUnit: StandardUnit;
  standardYieldRatio: number; // e.g., 10kg raw chicken yields 7.5kg cooked/prepared (0.75)
  shelfLifeHours: number;
  notes?: string;
  isActive: boolean;
  components: PreparationComponent[];
}

export interface PreparationComponent {
  id: string;
  preparationId: string;
  ingredientId: string;
  ingredientName?: string;
  requiredQuantity: number;
  unit: StandardUnit;
  notes?: string;
}

export interface PreparationBatch {
  id: string;
  batchNumber: string;
  preparationId: string;
  preparationName?: string;
  rawInputQuantity: number;
  outputQuantityProduced: number;
  outputUnit: StandardUnit;
  preparedBy: string;
  preparedAt: string;
  expiresAt: string;
  costTotal: number;
  unitCost: number;
  status: "ACTIVE" | "DEPLETED" | "EXPIRED" | "DISCARDED";
}

/**
 * Menu Recipe Models
 */
export interface Recipe {
  id: string;
  menuItemId: string;
  menuItemName?: string;
  version: number;
  status: "DRAFT" | "ACTIVE" | "INACTIVE";
  effectiveFrom: string;
  effectiveTo?: string;
  preparationTimeMinutes: number;
  portionsYielded: number;
  estimatedCost: number;
  notes?: string;
  components: RecipeComponent[];
}

export interface RecipeComponent {
  id: string;
  recipeId: string;
  componentType: "RAW_INGREDIENT" | "PREPARATION_BATCH" | "SUB_RECIPE";
  ingredientId?: string;
  ingredientName?: string;
  preparationId?: string;
  preparationName?: string;
  quantity: number;
  unit: StandardUnit;
  isOptional: boolean;
  yieldFactor: number; // default 1.0
  notes?: string;
}

/**
 * Immutable Stock Movement Ledger
 */
export interface StockTransaction {
  id: string;
  ingredientId: string;
  ingredientName?: string;
  transactionType: StockTransactionType;
  quantity: number;
  unit: StandardUnit;
  direction: "IN" | "OUT";
  referenceType:
    | "PURCHASE_RECEIPT"
    | "KOT_ORDER"
    | "PREPARATION_BATCH"
    | "WASTAGE_LOG"
    | "STOCK_COUNT"
    | "MANUAL_ADJUSTMENT";
  referenceId: string;
  unitCost: number;
  totalValue: number;
  runningBalance: number;
  performedBy: string;
  notes?: string;
  timestamp: string;
}

export interface StockReservation {
  id: string;
  partyId: string;
  orderId: string;
  orderItemId: string;
  ingredientId: string;
  quantity: number;
  unit: StandardUnit;
  status: "RESERVED" | "CONSUMED" | "RELEASED";
  reservedAt: string;
  expiresAt: string;
}

export interface Supplier {
  id: string;
  name: string;
  contactPerson?: string;
  phone: string;
  email?: string;
  address?: string;
  gstin?: string;
  isActive: boolean;
}

export interface PurchaseOrder {
  id: string;
  poNumber: string;
  supplierId: string;
  supplierName?: string;
  status: "DRAFT" | "SUBMITTED" | "PARTIALLY_RECEIVED" | "RECEIVED" | "CANCELLED";
  orderDate: string;
  expectedDeliveryDate?: string;
  subtotal: number;
  taxTotal: number;
  grandTotal: number;
  notes?: string;
  items: PurchaseItem[];
}

export interface PurchaseItem {
  id: string;
  purchaseOrderId: string;
  ingredientId: string;
  ingredientName?: string;
  orderedQuantity: number;
  receivedQuantity: number;
  rejectedQuantity: number;
  unit: StandardUnit;
  unitRate: number;
  taxRate: number;
  totalAmount: number;
  expiryDate?: string;
  batchNumber?: string;
}

export interface WastageRecord {
  id: string;
  ingredientId: string;
  ingredientName?: string;
  quantity: number;
  unit: StandardUnit;
  reason:
    | "BURNT_FOOD"
    | "SPOILED"
    | "EXPIRED"
    | "BROKEN_DROPPED"
    | "KITCHEN_ERROR"
    | "CUSTOMER_RETURN"
    | "PREPARATION_LOSS"
    | "OTHER";
  estimatedCost: number;
  recordedBy: string;
  approvedBy?: string;
  approvalStatus: "APPROVED" | "PENDING_APPROVAL" | "REJECTED";
  notes?: string;
  timestamp: string;
}

export interface StockCountRecord {
  id: string;
  countDate: string;
  conductedBy: string;
  status: "IN_PROGRESS" | "COMPLETED" | "RECONCILED";
  notes?: string;
  items: StockCountItem[];
}

export interface StockCountItem {
  id: string;
  stockCountId: string;
  ingredientId: string;
  ingredientName?: string;
  unit: StandardUnit;
  theoreticalStock: number;
  physicalCount: number;
  varianceQuantity: number;
  variancePercentage: number;
  varianceValue: number;
  varianceReason?:
    | "WASTAGE"
    | "PREPARATION_VARIANCE"
    | "MEASUREMENT_ERROR"
    | "PILFERAGE"
    | "UNKNOWN_VARIANCE"
    | "OTHER";
  adjustmentTransactionId?: string;
}

export type KhanawalCategory =
  | "DAILY_FOOD"
  | "KIRANA"
  | "DRY_STOCK"
  | "CLEANING"
  | "KITCHEN";

export interface Supplier {
  id: string;
  name: string;
  phone: string;
  suppliedItems: string[];
  totalPurchased: number;
  totalPaid: number;
  currentAdvance: number;
  outstandingPayable: number;
  notes?: string;
  createdAt: string;
}

export interface QuickPurchaseEntry {
  id: string;
  supplierId: string;
  supplierName: string;
  ingredientId: string;
  ingredientName: string;
  quantity: number;
  unit: StandardUnit;
  rate: number;
  totalAmount: number;
  paymentMethod: "CASH" | "UPI" | "CREDIT" | "ADVANCE_ADJUSTMENT";
  paymentStatus: "PAID" | "PENDING";
  date: string;
  notes?: string;
  receiptPhotoUrl?: string;
}

export interface SupplierAdvanceRecord {
  id: string;
  supplierId: string;
  supplierName: string;
  amount: number;
  date: string;
  paymentMethod: "CASH" | "UPI";
  notes?: string;
  adjustedAmount: number;
  remainingAdvance: number;
}

export interface SupplierPaymentRecord {
  id: string;
  supplierId: string;
  supplierName: string;
  purchaseId?: string;
  invoiceNumber?: string;
  amount: number;
  date: string;
  paymentMethod: "CASH" | "UPI";
  notes?: string;
}

export interface PriceHistoryRecord {
  id: string;
  ingredientId: string;
  ingredientName: string;
  supplierId: string;
  supplierName: string;
  date: string;
  ratePerUnit: number;
  unit: StandardUnit;
  previousRate?: number;
  percentageChange?: number;
}

export interface DailyPurchaseRecommendation {
  ingredientId: string;
  ingredientName: string;
  localName?: string;
  unit: StandardUnit;
  currentStock: number;
  expectedDailyRequirement: number;
  recommendedPurchaseQty: number;
  estimatedCost: number;
  urgency: "CRITICAL" | "HIGH" | "NORMAL";
}

export interface DailyClosingSnapshot {
  id: string;
  date: string;
  closedAt: string;
  closedBy: string;
  // Sales summary
  totalSales: number;
  cashSales: number;
  upiSales: number;
  cardSales: number;
  totalThalisSold: number;
  chickenThalisSold: number;
  muttonThalisSold: number;
  // Outflows
  foodPurchases: number;
  otherExpenses: number;
  supplierPayments: number;
  staffPayments: number;
  // Cash & UPI Balances
  openingCash: number;
  expectedCash: number;
  actualCash: number;
  cashVariance: number;
  openingUpi: number;
  expectedUpi: number;
  actualUpi: number;
  upiVariance: number;
  // Checklist
  checklistConfirmed: boolean;
  checklistItems: Record<string, boolean>;
  // Inventory variance
  stockVariances: {
    ingredientId: string;
    ingredientName: string;
    expectedStock: number;
    physicalStock: number;
    variance: number;
    unit: StandardUnit;
  }[];
  notes?: string;
  actualCashCounted?: number;
  actualUpiCounted?: number;
  cashierSigned?: boolean;
  managerSigned?: boolean;
}

