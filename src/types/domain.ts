/**
 * Kolhapuri Khanawal Restaurant Operating System
 * Phase 0: Core Domain Models & RBAC Types
 */

export type RoleType =
  | "OWNER"
  | "MANAGER"
  | "CASHIER"
  | "WAITER"
  | "KITCHEN"
  | "INVENTORY_MANAGER"
  | "PURCHASE_STAFF"
  | "OTHER_STAFF";

export type PermissionCode =
  | "orders.create"
  | "orders.modify"
  | "orders.cancel"
  | "kot.create"
  | "kot.cancel"
  | "kot.status_update"
  | "bill.create"
  | "bill.discount"
  | "bill.cancel"
  | "bill.refund"
  | "payment.record"
  | "inventory.view"
  | "inventory.adjust"
  | "inventory.purchase"
  | "inventory.cost_view"
  | "recipe.view"
  | "recipe.edit"
  | "preparation.manage"
  | "reports.view"
  | "reports.financial"
  | "staff.manage"
  | "settings.manage"
  | "override.negative_stock"
  | "party.transfer"
  | "party.merge"
  | "party.split"
  | "menu.view"
  | "menu.edit"
  | "cash_upi.reconcile"
  | "tasks.manage"
  | "reminders.manage"
  | "office_orders.manage";

export interface Restaurant {
  id: string;
  name: string;
  tagline: string;
  address: string;
  phone: string;
  gstin?: string;
  fssaiNumber?: string;
  currency: string;
  timezone: string;
  receiptFooter: string;
  createdAt: string;
  updatedAt: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  phone?: string;
  role: RoleType;
  isActive: boolean;
  avatarUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface WaiterCredential {
  id: string;
  name: string;
  username: string;
  pin: string; // 4-6 digit numeric PIN or password
  phone?: string;
  employeeId?: string;
  isActive: boolean;
  createdAt: string;
  lastLoginAt?: string;
}

export interface Staff {
  id: string;
  userId: string;
  employeeCode: string;
  designation: string;
  shiftSchedule: "MORNING" | "EVENING" | "FULL_DAY";
  joiningDate: string;
  emergencyContact?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface StaffShift {
  id: string;
  staffId: string;
  shiftDate: string;
  clockIn: string;
  clockOut?: string;
  notes?: string;
}

export interface DailyChecklist {
  id: string;
  checklistType: "OPENING" | "CLOSING";
  date: string;
  shift: "MORNING" | "EVENING";
  completedBy: string;
  verifiedBy?: string;
  status: "PENDING" | "COMPLETED" | "FLAGGED";
  completedAt?: string;
  notes?: string;
}

export interface DailyChecklistItem {
  id: string;
  checklistId: string;
  title: string;
  category: "SAFETY" | "HYGIENE" | "STOCK" | "FINANCE" | "OPERATIONS";
  isCompleted: boolean;
  completedAt?: string;
  remarks?: string;
}

export interface AuditLog {
  id: string;
  userId: string;
  userName: string;
  role: RoleType;
  action: string;
  entityType: string;
  entityId: string;
  oldValue?: Record<string, unknown> | null;
  newValue?: Record<string, unknown> | null;
  reason?: string;
  ipAddress?: string;
  createdAt: string;
}

export interface OperationalTask {
  id: string;
  title: string;
  description?: string;
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  status: "TODO" | "IN_PROGRESS" | "DONE" | "OVERDUE" | "CANCELLED";
  assignedTo?: string;
  dueTime: string;
  isRecurring: boolean;
  recurrenceRule?: "DAILY" | "WEEKLY";
  completedAt?: string;
  createdAt: string;
}

export type EmployeeRole =
  | "Cook"
  | "Kitchen Helper"
  | "Waiter"
  | "Cashier"
  | "Cleaning"
  | "Chapati/Bhakri"
  | "Manager";

export interface Employee {
  id: string;
  name: string;
  role: EmployeeRole;
  phone: string;
  joiningDate: string;
  baseSalary: number; // monthly or daily
  salaryType: "MONTHLY" | "DAILY";
  status: "ACTIVE" | "INACTIVE";
}

export type AttendanceStatus =
  | "PRESENT"
  | "ABSENT"
  | "HALF_DAY"
  | "LEAVE"
  | "WEEKLY_OFF";

export interface AttendanceRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  date: string;
  status: AttendanceStatus;
  notes?: string;
  markedAt: string;
}

export interface StaffAdvanceRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  amount: number;
  date: string;
  recoveredAmount: number;
  status: "PENDING" | "PARTIAL" | "RECOVERED";
  notes?: string;
}

export interface SalaryCalculation {
  employeeId: string;
  employeeName: string;
  month: string; // e.g. "2026-09"
  baseSalary: number;
  overtime?: number;
  bonus?: number;
  advancesDeducted: number;
  otherDeductions?: number;
  payableSalary: number;
  status?: "UNPAID" | "PAID";
  paidAt?: string;
  // Convenience and display fields
  presentDays?: number;
  totalDays?: number;
  calculatedGross?: number;
  advanceDeducted?: number;
  netPayable?: number;
}

export type TaskPriority = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

export interface KhanawalTask {
  id: string;
  title: string;
  assignedTo: string;
  priority: TaskPriority;
  dueDate: string;
  status: "PENDING" | "COMPLETED";
  reminder: boolean;
  createdAt: string;
  completedAt?: string;
}

export interface HotelEquipment {
  id: string;
  name: string;
  category: "FREEZER" | "GAS" | "LIGHTS" | "UTENSILS" | "WATER" | "WIFI" | "KITCHEN";
  purchaseDate: string;
  repairHistory: {
    date: string;
    description: string;
    cost: number;
    vendor?: string;
  }[];
  totalRepairCost: number;
  nextServiceDate: string;
  status: "OPERATIONAL" | "NEEDS_REPAIR" | "CRITICAL";
}

export type NotificationCategory = "KITCHEN" | "SERVICE" | "BILLING" | "INVENTORY" | "MAINTENANCE" | "ADMIN";
export type NotificationUrgency = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
export type NotificationType =
  | "KOT_NEW"
  | "KOT_READY"
  | "KOT_DELAYED"
  | "BILL_REQUESTED"
  | "BILL_PAID"
  | "LOW_STOCK"
  | "REMINDER_DUE"
  | "CHECKLIST_PENDING"
  | "SYSTEM";

export interface RestaurantNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  category: NotificationCategory;
  urgency: NotificationUrgency;
  targetRoles: ("ADMIN" | "MANAGER" | "WAITER" | "CHEF" | "CASHIER")[];
  actionUrl?: string;
  actionLabel?: string;
  isRead: boolean;
  createdAt: string;
  metadata?: {
    tableNumber?: number;
    partyId?: string;
    partyCode?: string;
    kotId?: string;
    kotNumber?: string;
    menuItemId?: string;
    reminderId?: string;
    amount?: number;
  };
}

export interface KhanawalReminder {
  id: string;
  type:
    | "LOW_STOCK"
    | "SUPPLIER_PAYMENT"
    | "STAFF_SALARY"
    | "STAFF_ADVANCE"
    | "GAS_REFILL"
    | "FREEZER_MAINTENANCE"
    | "CLEANING"
    | "PENDING_TASK"
    | "DAILY_CLOSING"
    | "STOCK_COUNT"
    | "CUSTOM";
  title: string;
  message: string;
  category: "OPERATIONS" | "FINANCE" | "SAFETY" | "INVENTORY" | "STAFF";
  urgency: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  dueDate?: string;
  recurrence?: "ONCE" | "DAILY" | "HOURLY" | "WEEKLY";
  targetRole?: "ALL" | "ADMIN" | "MANAGER" | "WAITER" | "CHEF" | "CASHIER";
  isCompleted: boolean;
  completedAt?: string;
  isDismissed: boolean;
  snoozedUntil?: string;
  actionUrl?: string;
  actionLabel?: string;
}

export interface OfficeGroupOrder {
  id: string;
  orderNumber: string;
  companyName: string;
  contactPerson: string;
  contactNumber: string;
  pickupDeliveryTime: string;
  deliveryType: "PICKUP" | "DELIVERY";
  deliveryAddress?: string;
  items: {
    menuItemId: string;
    menuItemName: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
  }[];
  totalAmount: number;
  advancePaid: number;
  paymentStatus: "PENDING" | "PARTIALLY_PAID" | "PAID";
  paymentMethod?: "CASH" | "UPI" | "BANK_TRANSFER";
  status: "ORDERED" | "PREPARING" | "READY" | "COMPLETED" | "CANCELLED";
  specialInstructions?: string;
  createdAt: string;
}

// ── 7. SYSTEM SETTINGS & RESTAURANT CONFIGURATION ────────────────
export interface RestaurantProfile {
  nameMr: string;
  nameEn: string;
  tagline: string;
  address: string;
  city: string;
  pincode: string;
  primaryPhone: string;
  secondaryPhone?: string;
  gstin: string;
  fssai: string;
  upiId: string;
  upiMerchantName: string;
}

export interface BillingRules {
  gstRatePercent: number;
  packagingChargePerThali: number;
  applyRoundOff: boolean;
  managerPin: string;
  maxDiscountWithoutPinPercent: number;
}

export interface DiningPolicies {
  totalTables: number;
  sharedSeatingEnabled: boolean;
  maxGuestsPerTable: number;
  autoVacateOnPayment: boolean;
  defaultGuestCount: number;
}

export interface OperationsConfig {
  morningPrepTargetTime: string;
  deepFreezerTargetTempC: number;
  lpgReserveAlertDays: number;
  nightClosingChecklistMandatory: boolean;
}

export interface RestaurantSettings {
  profile: RestaurantProfile;
  billing: BillingRules;
  dining: DiningPolicies;
  operations: OperationsConfig;
}

export interface WaiterCredential {
  id: string;
  name: string;
  username: string; // e.g. "rahul", "waiter01"
  pin: string;      // 4-6 digit numeric PIN or password
  phone?: string;
  employeeId?: string;
  isActive: boolean;
  createdAt: string;
  lastLoginAt?: string;
}
