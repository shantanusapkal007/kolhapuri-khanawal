/**
 * Kolhapuri Khanawal Restaurant Operating System
 * Centralized Live Operational State Engine
 */

import { DiningTable, DiningParty, PartySeat } from "@/types/tables";
import { MenuItem, MenuCategory, Order, OrderItem, Kot, KotEvent, KitchenStation, BreadOption } from "@/types/orders";
import { initialKhanawalCategories, initialKhanawalMenuItems } from "./kolhapuri-menu-data";
import {
  Ingredient,
  Recipe,
  StockTransaction,
  StockReservation,
  WastageRecord,
  StockCountRecord,
  Supplier,
  QuickPurchaseEntry,
  SupplierAdvanceRecord,
  SupplierPaymentRecord,
  PriceHistoryRecord,
  DailyPurchaseRecommendation,
  DailyClosingSnapshot,
} from "@/types/inventory";
import {
  Bill,
  TaxRate,
  Payment,
  DayEndReport,
  PrinterSettings,
  PrinterDevice,
  KhanawalExpenseCategory,
  ExpenseRecord,
  CashLedgerEntry,
  UPILedgerEntry,
} from "@/types/billing";
import {
  RoleType,
  User,
  DailyChecklist,
  OperationalTask,
  AuditLog,
  Employee,
  AttendanceRecord,
  AttendanceStatus,
  StaffAdvanceRecord,
  SalaryCalculation,
  KhanawalTask,
  HotelEquipment,
  KhanawalReminder,
  RestaurantNotification,
  OfficeGroupOrder,
  RestaurantSettings,
  WaiterCredential,
} from "@/types/domain";
import { refreshTableOccupancy } from "@/lib/tables/table-service";
import { openDiningParty, transferParty, mergeParties, splitPartyItems } from "@/lib/tables/party-service";
import { placeOrderAndGenerateKot, transitionKotStatus } from "@/lib/orders/order-service";
import { generatePartyBill, recordBillPayment } from "@/lib/billing/billing-service";
import { requirePermission } from "@/lib/auth/rbac";
import { calculateRecipeAvailability } from "@/lib/inventory/recipes";
import { executeStockMovement, reconcilePhysicalCount } from "@/lib/inventory/ledger";
import { getStoredPrinterSettings, saveStoredPrinterSettings, triggerCashDrawerKick } from "@/lib/printing/thermal-printer";
import { playNotificationSound } from "@/lib/sound/audio-alerts";
import {
  initialSuppliers,
  initialPurchases,
  initialExpenses,
  initialSupplierAdvances,
  initialSupplierPayments,
  initialStaffAdvances,
  initialEmployees,
  initialAttendance,
  initialEquipment,
  initialKhanawalTasks,
  initialReminders,
  initialNotifications,
  initialOfficeOrders,
  initialPriceHistory,
  initialCashLedger,
  initialUPILedger,
  initialDailyClosings,
} from "./khanawal-seed-data";
import { initialKhanawalExpenses } from "./expense-master-data";
import { MasterExpenseCategory, ExpenseFrequency } from "@/types/expenses";

export const DEFAULT_RESTAURANT_SETTINGS: RestaurantSettings = {
  profile: {
    nameMr: "कोल्हापुरी खानावळ",
    nameEn: "KOLHAPURI KHANAWAL",
    tagline: "अस्सल कोल्हापुरी चव • Baner, Pune",
    address: "Lalit Estate, Baner, Pune, Maharashtra 411045",
    city: "Pune",
    pincode: "411045",
    primaryPhone: "+91 91753 86576",
    secondaryPhone: "",
    gstin: "27AAAAA0000A1Z5",
    fssai: "11026999000123",
    upiId: "Q338740118@ybl",
    upiMerchantName: "Kolapuri khanawal",
  },
  billing: {
    gstRatePercent: 5,
    packagingChargePerThali: 20,
    applyRoundOff: true,
    managerPin: "1234",
    maxDiscountWithoutPinPercent: 10,
  },
  dining: {
    totalTables: 12,
    sharedSeatingEnabled: true,
    maxGuestsPerTable: 4,
    autoVacateOnPayment: true,
    defaultGuestCount: 2,
  },
  operations: {
    morningPrepTargetTime: "08:00",
    deepFreezerTargetTempC: -18,
    lpgReserveAlertDays: 2,
    nightClosingChecklistMandatory: true,
  },
};

export const initialWaiterCredentials: WaiterCredential[] = [
  {
    id: "w-cred-rahul",
    name: "Rahul Shinde",
    username: "rahul",
    pin: "1111",
    phone: "+91 98227 01003",
    employeeId: "emp-rahul",
    isActive: true,
    createdAt: "2024-08-01T00:00:00.000Z",
  },
  {
    id: "w-cred-nitin",
    name: "Nitin Jadhav",
    username: "nitin",
    pin: "2222",
    phone: "+91 98227 01004",
    employeeId: "emp-nitin",
    isActive: true,
    createdAt: "2025-01-10T00:00:00.000Z",
  },
];

export class RestaurantStore {
  // Master Tables & Parties
  tables: DiningTable[] = [];
  parties: DiningParty[] = [];
  seats: PartySeat[] = [];

  // Waiter Access & Credentials
  waiterCredentials: WaiterCredential[] = [];

  // Menu & Kitchen
  categories: MenuCategory[] = [];
  menuItems: MenuItem[] = [];
  kitchenStations: KitchenStation[] = [];
  recipes: Recipe[] = [];

  // Inventory Ledger
  ingredients: Ingredient[] = [];
  stockTransactions: StockTransaction[] = [];
  stockReservations: StockReservation[] = [];
  wastageRecords: WastageRecord[] = [];
  stockCounts: StockCountRecord[] = [];

  // Orders & KOTs
  orders: Order[] = [];
  kots: Kot[] = [];
  kotEvents: KotEvent[] = [];

  // Billing & Taxes
  taxRates: TaxRate[] = [];
  bills: Bill[] = [];
  payments: Payment[] = [];

  // Khanawal Suppliers & Purchases
  suppliers: Supplier[] = [];
  purchases: QuickPurchaseEntry[] = [];
  supplierAdvances: SupplierAdvanceRecord[] = [];
  supplierPayments: SupplierPaymentRecord[] = [];
  priceHistory: PriceHistoryRecord[] = [];

  // Expenses & Cash/UPI Ledgers
  expenses: ExpenseRecord[] = [];
  cashLedger: CashLedgerEntry[] = [];
  upiLedger: UPILedgerEntry[] = [];
  dailyClosings: DailyClosingSnapshot[] = [];

  // Staff, Attendance, Advances & Salaries
  employees: Employee[] = [];
  attendance: AttendanceRecord[] = [];
  staffAdvances: StaffAdvanceRecord[] = [];
  salaryCalculations: SalaryCalculation[] = [];

  // Operational Tasks, Equipment & Office Orders
  khanawalTasks: KhanawalTask[] = [];
  equipment: HotelEquipment[] = [];
  reminders: KhanawalReminder[] = [];
  notifications: RestaurantNotification[] = [];
  soundEnabled: boolean = true;
  officeOrders: OfficeGroupOrder[] = [];

  // Staff & Checklists
  users: User[] = [];
  checklists: DailyChecklist[] = [];
  checklistItems: {
    id: string;
    title: string;
    category: "SAFETY" | "HYGIENE" | "STOCK" | "FINANCE" | "OPERATIONS";
    isCompleted: boolean;
    shift: "OPENING" | "CLOSING";
    remarks?: string;
  }[] = [];

  tasks: OperationalTask[] = [];
  auditLogs: AuditLog[] = [];
  printerSettings: PrinterSettings;
  settings: RestaurantSettings;

  // Operational State Synchronization & Cross-Device Bus
  instanceId: string = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function" ? crypto.randomUUID() : Math.random().toString(36).slice(2);
  syncChannel: any = null;
  saveDebounceTimer: any = null;
  lastSyncVersion: number = 0;

  // Current logged in user context (default Waiter or Admin)
  currentUser: User;

  constructor() {
    this.printerSettings = getStoredPrinterSettings();
    this.settings = this.getStoredRestaurantSettings();
    this.waiterCredentials = this.getStoredWaiterCredentials();
    this.currentUser = this.getStoredActiveUser() || {
      id: typeof window === "undefined" ? "u-owner-01" : "guest",
      email: typeof window === "undefined" ? "owner@kolhapurikhanawal.com" : "",
      name: typeof window === "undefined" ? "Suresh Rao" : "Guest",
      role: typeof window === "undefined" ? "OWNER" : "WAITER",
      isActive: typeof window === "undefined",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.seedInitialState();
    this.initSyncChannel();
  }

  // ── Multi-Tab & Multi-Device Operational Sync ────────────────────
  initSyncChannel(): void {
    if (typeof window === "undefined") return;

    // 1. BroadcastChannel for instant same-browser cross-tab sync
    if ("BroadcastChannel" in window) {
      try {
        this.syncChannel = new BroadcastChannel("kk_operational_sync_bus");
        this.syncChannel.onmessage = (event: MessageEvent) => {
          if (event.data?.type === "OP_SYNC" && event.data.senderId !== this.instanceId) {
            if (event.data.version && event.data.version > this.lastSyncVersion) {
              this.applySyncSnapshot(event.data.snapshot, event.data.version);
            }
          }
        };
      } catch (e) {
        console.warn("BroadcastChannel not supported or restricted", e);
      }
    }

    // 2. Storage event listener fallback (for Android WebViews and cross-window sync)
    window.addEventListener("storage", (e) => {
      if (e.key === "kk_live_operations_v1" && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (parsed?.version && parsed.version > this.lastSyncVersion && parsed.senderId !== this.instanceId) {
            this.loadLiveOperationalState(true);
          }
        } catch {}
      }
    });

    // 3. Local Wi-Fi sync polling every 4 seconds for multi-device waiter tablets / kitchen KDS
    if (typeof setInterval !== "undefined") {
      setInterval(() => {
        this.pullServerRelaySync();
      }, 4000);
    }
  }

  notifyStateChange(source: string = "action"): void {
    if (typeof window === "undefined") return;

    // Dispatch DOM event immediately for live React components
    window.dispatchEvent(new CustomEvent("kk-state-changed", { detail: { source, instanceId: this.instanceId } }));

    // Debounce persisting and broadcasting snapshot
    if (this.saveDebounceTimer) {
      clearTimeout(this.saveDebounceTimer);
    }
    this.saveDebounceTimer = setTimeout(() => {
      this.saveLiveOperationalState();
    }, 80);
  }

  saveLiveOperationalState(): void {
    if (typeof window === "undefined") return;
    const version = Date.now();
    this.lastSyncVersion = version;

    const snapshot = {
      tables: this.tables,
      parties: this.parties,
      seats: this.seats,
      orders: this.orders,
      kots: this.kots,
      kotEvents: this.kotEvents,
      bills: this.bills,
      payments: this.payments,
      cashLedger: this.cashLedger,
      upiLedger: this.upiLedger,
      ingredients: this.ingredients,
      stockTransactions: this.stockTransactions,
      stockReservations: this.stockReservations,
      wastageRecords: this.wastageRecords,
      dailyClosings: this.dailyClosings,
      purchases: this.purchases,
      expenses: this.expenses,
      supplierAdvances: this.supplierAdvances,
      supplierPayments: this.supplierPayments,
      staffAdvances: this.staffAdvances,
      attendance: this.attendance,
      checklistItems: this.checklistItems,
      notifications: this.notifications,
    };

    try {
      localStorage.setItem(
        "kk_live_operations_v1",
        JSON.stringify({
          senderId: this.instanceId,
          version,
          ...snapshot,
        })
      );
    } catch (e) {
      console.warn("Failed to persist live operations to localStorage", e);
    }

    // Broadcast to other tabs
    if (this.syncChannel) {
      try {
        this.syncChannel.postMessage({
          type: "OP_SYNC",
          senderId: this.instanceId,
          version,
          snapshot,
        });
      } catch {}
    }

    // Push to server relay (local Wi-Fi)
    this.pushServerRelaySync(snapshot, version);
  }

  loadLiveOperationalState(force = false): boolean {
    if (typeof window === "undefined") return false;
    try {
      const raw = localStorage.getItem("kk_live_operations_v1");
      if (!raw) return false;
      const data = JSON.parse(raw);
      if (!data || typeof data !== "object") return false;

      if (Array.isArray(data.tables) && data.tables.length > 0) this.tables = data.tables;
      if (Array.isArray(data.parties)) this.parties = data.parties;
      if (Array.isArray(data.seats)) this.seats = data.seats;
      if (Array.isArray(data.orders)) this.orders = data.orders;
      if (Array.isArray(data.kots)) this.kots = data.kots;
      if (Array.isArray(data.kotEvents)) this.kotEvents = data.kotEvents;
      if (Array.isArray(data.bills)) this.bills = data.bills;
      if (Array.isArray(data.payments)) this.payments = data.payments;
      if (Array.isArray(data.cashLedger)) this.cashLedger = data.cashLedger;
      if (Array.isArray(data.upiLedger)) this.upiLedger = data.upiLedger;
      if (Array.isArray(data.ingredients) && data.ingredients.length > 0) this.ingredients = data.ingredients;
      if (Array.isArray(data.stockTransactions)) this.stockTransactions = data.stockTransactions;
      if (Array.isArray(data.stockReservations)) this.stockReservations = data.stockReservations;
      if (Array.isArray(data.wastageRecords)) this.wastageRecords = data.wastageRecords;
      if (Array.isArray(data.dailyClosings)) this.dailyClosings = data.dailyClosings;
      if (Array.isArray(data.purchases)) this.purchases = data.purchases;
      if (Array.isArray(data.expenses)) this.expenses = data.expenses;
      if (Array.isArray(data.supplierAdvances)) this.supplierAdvances = data.supplierAdvances;
      if (Array.isArray(data.supplierPayments)) this.supplierPayments = data.supplierPayments;
      if (Array.isArray(data.staffAdvances)) this.staffAdvances = data.staffAdvances;
      if (Array.isArray(data.attendance)) this.attendance = data.attendance;
      if (Array.isArray(data.checklistItems)) this.checklistItems = data.checklistItems;
      if (Array.isArray(data.notifications)) this.notifications = data.notifications;
      if (data.version) this.lastSyncVersion = data.version;

      this.recalculateMenuAvailability();

      if (force) {
        window.dispatchEvent(new CustomEvent("kk-state-changed", { detail: { source: "local_storage_load" } }));
      }
      return true;
    } catch (e) {
      console.warn("Could not load live operational state from localStorage", e);
      return false;
    }
  }

  applySyncSnapshot(snapshot: any, version: number): void {
    if (!snapshot || typeof snapshot !== "object") return;
    this.lastSyncVersion = version;

    if (Array.isArray(snapshot.tables)) this.tables = snapshot.tables;
    if (Array.isArray(snapshot.parties)) this.parties = snapshot.parties;
    if (Array.isArray(snapshot.seats)) this.seats = snapshot.seats;
    if (Array.isArray(snapshot.orders)) this.orders = snapshot.orders;
    if (Array.isArray(snapshot.kots)) this.kots = snapshot.kots;
    if (Array.isArray(snapshot.kotEvents)) this.kotEvents = snapshot.kotEvents;
    if (Array.isArray(snapshot.bills)) this.bills = snapshot.bills;
    if (Array.isArray(snapshot.payments)) this.payments = snapshot.payments;
    if (Array.isArray(snapshot.cashLedger)) this.cashLedger = snapshot.cashLedger;
    if (Array.isArray(snapshot.upiLedger)) this.upiLedger = snapshot.upiLedger;
    if (Array.isArray(snapshot.ingredients) && snapshot.ingredients.length > 0) this.ingredients = snapshot.ingredients;
    if (Array.isArray(snapshot.stockTransactions)) this.stockTransactions = snapshot.stockTransactions;
    if (Array.isArray(snapshot.stockReservations)) this.stockReservations = snapshot.stockReservations;
    if (Array.isArray(snapshot.wastageRecords)) this.wastageRecords = snapshot.wastageRecords;
    if (Array.isArray(snapshot.dailyClosings)) this.dailyClosings = snapshot.dailyClosings;
    if (Array.isArray(snapshot.purchases)) this.purchases = snapshot.purchases;
    if (Array.isArray(snapshot.expenses)) this.expenses = snapshot.expenses;
    if (Array.isArray(snapshot.supplierAdvances)) this.supplierAdvances = snapshot.supplierAdvances;
    if (Array.isArray(snapshot.supplierPayments)) this.supplierPayments = snapshot.supplierPayments;
    if (Array.isArray(snapshot.staffAdvances)) this.staffAdvances = snapshot.staffAdvances;
    if (Array.isArray(snapshot.attendance)) this.attendance = snapshot.attendance;
    if (Array.isArray(snapshot.checklistItems)) this.checklistItems = snapshot.checklistItems;
    if (Array.isArray(snapshot.notifications)) this.notifications = snapshot.notifications;

    this.recalculateMenuAvailability();

    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("kk-state-changed", { detail: { source: "remote_sync", version } }));
    }
  }

  async pullServerRelaySync(): Promise<void> {
    if (typeof window === "undefined" || (typeof navigator !== "undefined" && !navigator.onLine)) return;
    try {
      const res = await fetch("/api/sync", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        if (data.version && data.version > this.lastSyncVersion && data.snapshot && data.senderId !== this.instanceId) {
          this.applySyncSnapshot(data.snapshot, data.version);
          localStorage.setItem(
            "kk_live_operations_v1",
            JSON.stringify({ ...data.snapshot, version: data.version, senderId: data.senderId })
          );
        }
      }
    } catch {
      // Local relay offline or network disconnect - silent fallback
    }
  }

  async pushServerRelaySync(snapshot: any, version: number): Promise<void> {
    if (typeof window === "undefined" || (typeof navigator !== "undefined" && !navigator.onLine)) return;
    try {
      await fetch("/api/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          senderId: this.instanceId,
          version,
          snapshot,
        }),
        cache: "no-store",
      });
    } catch {
      // Local relay offline or network disconnect - silent fallback
    }
  }

  getStoredActiveUser(): User | null {
    if (typeof window === "undefined") return null;
    try {
      const raw = localStorage.getItem("kk_active_user");
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  saveStoredActiveUser(user: User | null): void {
    if (typeof window === "undefined") return;
    try {
      if (!user) {
        localStorage.removeItem("kk_active_user");
      } else {
        localStorage.setItem("kk_active_user", JSON.stringify(user));
      }
    } catch (e) {
      console.warn("Failed to persist active user session", e);
    }
  }

  getStoredRestaurantSettings(): RestaurantSettings {
    if (typeof window === "undefined") return DEFAULT_RESTAURANT_SETTINGS;
    try {
      const raw = localStorage.getItem("kk_restaurant_settings");
      if (!raw) return DEFAULT_RESTAURANT_SETTINGS;
      const parsed = JSON.parse(raw);
      const mergedProfile = { ...DEFAULT_RESTAURANT_SETTINGS.profile, ...(parsed.profile || {}) };

      // Migrate any legacy cached profile values
      if (
        !mergedProfile.address ||
        mergedProfile.address.includes("Shahupuri") ||
        mergedProfile.address.includes("CSMT") ||
        mergedProfile.address.includes("Shahu Complex")
      ) {
        mergedProfile.address = DEFAULT_RESTAURANT_SETTINGS.profile.address;
      }
      if (!mergedProfile.primaryPhone || mergedProfile.primaryPhone.includes("98230 12345")) {
        mergedProfile.primaryPhone = DEFAULT_RESTAURANT_SETTINGS.profile.primaryPhone;
      }
      if (
        !mergedProfile.upiId ||
        mergedProfile.upiId.includes("okaxis") ||
        mergedProfile.upiId.includes("okhdfcbank")
      ) {
        mergedProfile.upiId = DEFAULT_RESTAURANT_SETTINGS.profile.upiId;
      }
      if (!mergedProfile.upiMerchantName || mergedProfile.upiMerchantName.includes("Baner")) {
        mergedProfile.upiMerchantName = DEFAULT_RESTAURANT_SETTINGS.profile.upiMerchantName;
      }

      return {
        profile: mergedProfile,
        billing: { ...DEFAULT_RESTAURANT_SETTINGS.billing, ...(parsed.billing || {}) },
        dining: { ...DEFAULT_RESTAURANT_SETTINGS.dining, ...(parsed.dining || {}) },
        operations: { ...DEFAULT_RESTAURANT_SETTINGS.operations, ...(parsed.operations || {}) },
      };
    } catch {
      return DEFAULT_RESTAURANT_SETTINGS;
    }
  }

  updateRestaurantSettings(updates: Partial<RestaurantSettings>): RestaurantSettings {
    this.settings = {
      profile: { ...this.settings.profile, ...(updates.profile || {}) },
      billing: { ...this.settings.billing, ...(updates.billing || {}) },
      dining: { ...this.settings.dining, ...(updates.dining || {}) },
      operations: { ...this.settings.operations, ...(updates.operations || {}) },
    };
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("kk_restaurant_settings", JSON.stringify(this.settings));
      } catch (e) {
        console.warn("Could not persist settings to localStorage", e);
      }
    }
    this.recordAuditLog(
      "UPDATE_SETTINGS",
      "SYSTEM",
      "settings",
      `Updated restaurant settings by ${this.currentUser.name}`
    );
    return this.settings;
  }

  // ── Menu Catalog & Category Persistence ─────────────────────────
  getStoredMenuCategories(): MenuCategory[] {
    if (typeof window === "undefined") return [...initialKhanawalCategories];
    try {
      const raw = localStorage.getItem("kk_menu_categories");
      if (!raw) return [...initialKhanawalCategories];
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length >= 10) return parsed;
      return [...initialKhanawalCategories];
    } catch {
      return [...initialKhanawalCategories];
    }
  }

  saveStoredMenuCategories(): void {
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("kk_menu_categories", JSON.stringify(this.categories));
      } catch (e) {
        console.warn("Failed to persist menu categories", e);
      }
    }
  }

  getStoredMenuItems(): MenuItem[] {
    if (typeof window === "undefined") return [...initialKhanawalMenuItems];
    try {
      const raw = localStorage.getItem("kk_menu_items");
      if (!raw) return [...initialKhanawalMenuItems];
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length >= 50) return parsed;
      return [...initialKhanawalMenuItems];
    } catch {
      return [...initialKhanawalMenuItems];
    }
  }

  saveStoredMenuItems(): void {
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("kk_menu_items", JSON.stringify(this.menuItems));
      } catch (e) {
        console.warn("Failed to persist menu items", e);
      }
    }
  }

  // ── Hotel POS Expense Master Persistence ─────────────────────────
  getStoredExpenses(): ExpenseRecord[] {
    if (typeof window === "undefined") return [...initialKhanawalExpenses];
    try {
      const raw = localStorage.getItem("kk_khanawal_expenses");
      if (!raw) return [...initialKhanawalExpenses];
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      return [...initialKhanawalExpenses];
    } catch {
      return [...initialKhanawalExpenses];
    }
  }

  saveStoredExpenses(): void {
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("kk_khanawal_expenses", JSON.stringify(this.expenses));
      } catch (e) {
        console.warn("Failed to persist expenses", e);
      }
    }
  }

  // ── Waiter Credentials & Staff Access ───────────────────────────
  getStoredWaiterCredentials(): WaiterCredential[] {
    if (typeof window === "undefined") return [...initialWaiterCredentials];
    try {
      const raw = localStorage.getItem("kk_waiter_credentials");
      if (!raw) return [...initialWaiterCredentials];
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      return [...initialWaiterCredentials];
    } catch {
      return [...initialWaiterCredentials];
    }
  }

  saveStoredWaiterCredentials(): void {
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("kk_waiter_credentials", JSON.stringify(this.waiterCredentials));
      } catch (e) {
        console.warn("Failed to persist waiter credentials", e);
      }
    }
  }

  createWaiterCredential(data: Omit<WaiterCredential, "id" | "createdAt">): WaiterCredential {
    const existing = this.waiterCredentials.find(
      (w) => w.username.toLowerCase() === data.username.toLowerCase().trim()
    );
    if (existing) {
      throw new Error(`Username "${data.username}" is already assigned to ${existing.name}. Please choose another.`);
    }

    const newCred: WaiterCredential = {
      id: `w-cred-${Date.now().toString().slice(-6)}`,
      name: data.name.trim(),
      username: data.username.toLowerCase().trim(),
      pin: data.pin.trim(),
      phone: data.phone?.trim() || "",
      employeeId: data.employeeId,
      isActive: data.isActive ?? true,
      createdAt: new Date().toISOString(),
    };

    this.waiterCredentials.push(newCred);
    this.saveStoredWaiterCredentials();
    this.recordAuditLog(
      "CREATE_WAITER_CREDENTIAL",
      "AUTH",
      newCred.id,
      `Created login credentials for Waiter ${newCred.name} (${newCred.username})`
    );
    return newCred;
  }

  updateWaiterCredential(id: string, updates: Partial<WaiterCredential>): WaiterCredential {
    const idx = this.waiterCredentials.findIndex((w) => w.id === id);
    if (idx === -1) throw new Error(`Waiter credential with ID ${id} not found.`);

    if (updates.username) {
      const collision = this.waiterCredentials.find(
        (w) => w.id !== id && w.username.toLowerCase() === updates.username!.toLowerCase().trim()
      );
      if (collision) {
        throw new Error(`Username "${updates.username}" is already taken by ${collision.name}.`);
      }
    }

    const updated: WaiterCredential = {
      ...this.waiterCredentials[idx],
      ...updates,
      name: updates.name ? updates.name.trim() : this.waiterCredentials[idx].name,
      username: updates.username ? updates.username.toLowerCase().trim() : this.waiterCredentials[idx].username,
      pin: updates.pin ? updates.pin.trim() : this.waiterCredentials[idx].pin,
    };

    this.waiterCredentials[idx] = updated;
    this.saveStoredWaiterCredentials();
    this.recordAuditLog(
      "UPDATE_WAITER_CREDENTIAL",
      "AUTH",
      updated.id,
      `Updated credentials for Waiter ${updated.name} (${updated.username})`
    );
    return updated;
  }

  deleteWaiterCredential(id: string): void {
    const cred = this.waiterCredentials.find((w) => w.id === id);
    this.waiterCredentials = this.waiterCredentials.filter((w) => w.id !== id);
    this.saveStoredWaiterCredentials();
    if (cred) {
      this.recordAuditLog(
        "DELETE_WAITER_CREDENTIAL",
        "AUTH",
        id,
        `Removed credentials for Waiter ${cred.name} (${cred.username})`
      );
    }
  }

  setCurrentUserRole(role: RoleType): void {
    const roleNames: Record<RoleType, string> = {
      OWNER: "Suresh Rao (Owner / Admin)",
      MANAGER: "Ramesh Patil (Manager)",
      CASHIER: "Deepak Shinde (Cashier)",
      KITCHEN: "Bapu Bandal (Head Chef)",
      WAITER: "Waiter Staff",
      PURCHASE_STAFF: "Purchase Manager",
      INVENTORY_MANAGER: "Inventory Supervisor",
      OTHER_STAFF: "Staff Member",
    };

    this.currentUser = {
      id: `u-${role.toLowerCase()}-01`,
      email: `${role.toLowerCase()}@kolhapurikhanawal.com`,
      name: roleNames[role] || `${role} Staff`,
      role,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.saveStoredActiveUser(this.currentUser);
  }

  loginAsWaiter(cred: WaiterCredential): void {
    this.currentUser = {
      id: cred.id,
      email: `${cred.username}@kolhapurikhanawal.com`,
      name: `${cred.name} (Waiter)`,
      role: "WAITER",
      isActive: true,
      createdAt: cred.createdAt,
      updatedAt: new Date().toISOString(),
    };
    cred.lastLoginAt = new Date().toISOString();
    this.saveStoredWaiterCredentials();
    this.saveStoredActiveUser(this.currentUser);
    this.recordAuditLog("WAITER_LOGIN", "AUTH", cred.id, `Waiter ${cred.name} logged in`);
  }

  loginWithWaiterPin(usernameOrPin: string, pin?: string): { success: boolean; waiter?: WaiterCredential; error?: string } {
    const cleanInput = usernameOrPin.trim();
    let match: WaiterCredential | undefined;

    if (pin !== undefined && pin !== "") {
      // Username + PIN
      match = this.waiterCredentials.find(
        (w) => w.username.toLowerCase() === cleanInput.toLowerCase() && w.pin === pin.trim()
      );
    } else {
      // Direct PIN or username match
      match = this.waiterCredentials.find(
        (w) => w.pin === cleanInput || w.username.toLowerCase() === cleanInput.toLowerCase()
      );
    }

    if (!match) {
      return { success: false, error: "Invalid Waiter Username or PIN. Please check credentials." };
    }

    if (!match.isActive) {
      return { success: false, error: `Account for ${match.name} is deactivated. Contact Admin/Manager.` };
    }

    this.loginAsWaiter(match);
    return { success: true, waiter: match };
  }

  loginUser(usernameOrIdentifier: string, pinOrPass: string): { success: boolean; user?: User; error?: string } {
    const cleanUser = usernameOrIdentifier.trim().toLowerCase();
    const cleanPin = pinOrPass.trim();

    // 1. Built-in Admin / Manager / Cashier / Kitchen Roles
    if (cleanUser === "admin" || cleanUser === "owner" || cleanUser === "suresh") {
      if (cleanPin === "admin123" || cleanPin === "1234" || cleanPin === "admin") {
        this.setCurrentUserRole("OWNER");
        this.recordAuditLog("LOGIN_SUCCESS", "AUTH", this.currentUser.id, "Owner/Admin logged in");
        return { success: true, user: this.currentUser };
      } else {
        return { success: false, error: "Incorrect Admin Password (Default: admin / admin123)" };
      }
    }

    if (cleanUser === "manager") {
      if (cleanPin === "1234" || cleanPin === "manager") {
        this.setCurrentUserRole("MANAGER");
        this.recordAuditLog("LOGIN_SUCCESS", "AUTH", this.currentUser.id, "Manager logged in");
        return { success: true, user: this.currentUser };
      } else {
        return { success: false, error: "Incorrect Manager PIN (Default PIN: 1234)" };
      }
    }

    if (cleanUser === "cashier") {
      if (cleanPin === "1234" || cleanPin === "cashier") {
        this.setCurrentUserRole("CASHIER");
        this.recordAuditLog("LOGIN_SUCCESS", "AUTH", this.currentUser.id, "Cashier logged in");
        return { success: true, user: this.currentUser };
      } else {
        return { success: false, error: "Incorrect Cashier PIN (Default PIN: 1234)" };
      }
    }

    if (cleanUser === "chef" || cleanUser === "kitchen") {
      if (cleanPin === "1234" || cleanPin === "chef") {
        this.setCurrentUserRole("KITCHEN");
        this.recordAuditLog("LOGIN_SUCCESS", "AUTH", this.currentUser.id, "Kitchen Chef logged in");
        return { success: true, user: this.currentUser };
      } else {
        return { success: false, error: "Incorrect Kitchen PIN (Default PIN: 1234)" };
      }
    }

    // 2. Waiter Credentials
    const waiterCandidate = this.waiterCredentials.find(
      (w) => w.username.toLowerCase() === cleanUser || w.name.toLowerCase() === cleanUser
    );

    if (waiterCandidate) {
      if (!waiterCandidate.isActive) {
        return { success: false, error: `Account for ${waiterCandidate.name} is deactivated. Contact Admin.` };
      }
      if (cleanPin && waiterCandidate.pin === cleanPin) {
        this.loginAsWaiter(waiterCandidate);
        return { success: true, user: this.currentUser };
      } else if (cleanPin) {
        return { success: false, error: `Incorrect PIN for ${waiterCandidate.name}. Please try again.` };
      }
    }

    // 3. Direct 4-digit PIN lookup for all waiters (either entered in pin field or username field)
    const directPin = cleanPin.length === 4 && !isNaN(Number(cleanPin))
      ? cleanPin
      : (cleanUser.length === 4 && !isNaN(Number(cleanUser)) ? cleanUser : null);

    if (directPin) {
      const pinMatch = this.waiterCredentials.find((w) => w.pin === directPin);
      if (pinMatch) {
        if (!pinMatch.isActive) {
          return { success: false, error: `Account for ${pinMatch.name} is deactivated.` };
        }
        this.loginAsWaiter(pinMatch);
        return { success: true, user: this.currentUser };
      }
    }

    return { success: false, error: "Invalid username or PIN. Please check your credentials." };
  }

  logoutCurrentUser(targetRole: RoleType = "OWNER"): void {
    this.setCurrentUserRole(targetRole);
    this.recordAuditLog("LOGOUT_USER", "AUTH", this.currentUser.id, `Switched session to ${targetRole}`);
  }

  logout(): void {
    this.saveStoredActiveUser(null);
    this.currentUser = {
      id: "guest",
      email: "",
      name: "Guest",
      role: "WAITER",
      isActive: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  exportSystemBackup(): string {
    const backupData = {
      version: "1.0",
      exportedAt: new Date().toISOString(),
      restaurant: this.settings.profile,
      settings: this.settings,
      printerSettings: this.printerSettings,
      waiterCredentials: this.waiterCredentials,
      tables: this.tables,
      parties: this.parties,
      bills: this.bills,
      payments: this.payments,
      purchases: this.purchases,
      suppliers: this.suppliers,
      expenses: this.expenses,
      employees: this.employees,
      attendance: this.attendance,
      staffAdvances: this.staffAdvances,
      cashLedger: this.cashLedger,
      upiLedger: this.upiLedger,
      dailyClosings: this.dailyClosings,
      auditLogs: this.auditLogs,
    };
    return JSON.stringify(backupData, null, 2);
  }

  resetToSeedData(): void {
    if (typeof window !== "undefined") {
      try {
        localStorage.removeItem("kk_live_operations_v1");
        localStorage.removeItem("kk_restaurant_settings");
        localStorage.removeItem("kk_printer_settings");
        localStorage.removeItem("kk_waiter_credentials");
        localStorage.removeItem("kk_menu_items");
        localStorage.removeItem("kk_menu_categories");
        localStorage.removeItem("kk_khanawal_expenses");
      } catch {}
    }
    this.printerSettings = getStoredPrinterSettings();
    this.settings = DEFAULT_RESTAURANT_SETTINGS;
    this.waiterCredentials = [...initialWaiterCredentials];
    this.seedInitialState();
    this.notifyStateChange("resetToSeedData");
    this.recordAuditLog(
      "RESET_SYSTEM",
      "SYSTEM",
      "all",
      `Reset system to initial seed dataset by ${this.currentUser.name}`
    );
  }

  updatePrinterSettings(settings: Partial<PrinterSettings>) {
    this.printerSettings = { ...this.printerSettings, ...settings };
    saveStoredPrinterSettings(this.printerSettings);
  }

  addPrinterDevice(device: PrinterDevice) {
    const devices = [...(this.printerSettings.devices || [])];
    const exists = devices.findIndex((d) => d.id === device.id);
    if (exists !== -1) {
      devices[exists] = device;
    } else {
      devices.push(device);
    }
    this.updatePrinterSettings({ devices });
  }

  updatePrinterDevice(id: string, updates: Partial<PrinterDevice>) {
    const devices = [...(this.printerSettings.devices || [])];
    const idx = devices.findIndex((d) => d.id === id);
    if (idx !== -1) {
      devices[idx] = { ...devices[idx], ...updates };
      this.updatePrinterSettings({ devices });
    }
  }

  removePrinterDevice(id: string) {
    const devices = (this.printerSettings.devices || []).filter((d) => d.id !== id);
    this.updatePrinterSettings({ devices });
  }

  seedInitialState() {
    // 12 Physical Tables in unified Khanawal Dining Hall (all same type, same 4-seat capacity)
    this.tables = Array.from({ length: 12 }, (_, i) => ({
      id: `tbl-${i + 1}`,
      tableNumber: i + 1,
      name: `Table ${i + 1}`,
      minCapacity: 1,
      maxCapacity: 4,
      section: "MAIN_HALL", // All 12 tables situated in the unified Khanawal dining room
      status: "AVAILABLE",
      activePartiesCount: 0,
      totalActiveGuests: 0,
      updatedAt: new Date().toISOString(),
    }));

    // Kitchen Stations
    this.kitchenStations = [
      { id: "st-1", code: "MAIN_KITCHEN", name: "Main Kitchen (Curry & Rassa)", displayColor: "#DC2626", isActive: true },
      { id: "st-2", code: "THALI_SECTION", name: "Thali Assembly Section", displayColor: "#D97706", isActive: true },
      { id: "st-3", code: "TANDOOR_BHAKRI", name: "Bhakri & Chapati Section", displayColor: "#059669", isActive: true },
      { id: "st-4", code: "FRY_SECTION", name: "Sukka & Fry Section", displayColor: "#7C3AED", isActive: true },
      { id: "st-5", code: "BEVERAGE_DESSERT", name: "Solkadhi Bar", displayColor: "#0284C7", isActive: true },
    ];

    // Configurable Tax Rates
    this.taxRates = [
      {
        id: "tax-gst5",
        name: "Restaurant GST Standard (5%)",
        code: "GST_5",
        cgstRate: 2.5,
        sgstRate: 2.5,
        igstRate: 5.0,
        vatRate: 0.0,
        totalRate: 5.0,
        isTaxInclusive: false,
        isTaxExempt: false,
        hsnSacCode: "996331",
        effectiveFrom: "2026-01-01",
        isActive: true,
      },
      {
        id: "tax-exempt",
        name: "Exempt Goods (0%)",
        code: "EXEMPT_0",
        cgstRate: 0,
        sgstRate: 0,
        igstRate: 0,
        vatRate: 0,
        totalRate: 0,
        isTaxInclusive: false,
        isTaxExempt: true,
        effectiveFrom: "2026-01-01",
        isActive: true,
      },
    ];

    // Raw Ingredients (with initial stock from prompt: 2kg Chicken, 15kg Rice, 8kg Dal, 5kg Bhaji, 10L Oil, 150 Chapatis)
    this.ingredients = [
      {
        id: "ing-chicken",
        categoryId: "cat-meat",
        name: "Fresh Chicken",
        localName: "कोंबडी / चिकन",
        baseUnit: "kg",
        physicalStock: 2.0, // 2 kg = 20 theoretical thalis
        reservedStock: 0,
        availableStock: 2.0,
        parLevel: 10.0,
        reorderLevel: 5.0,
        criticalLevel: 1.0,
        currentCostPerUnit: 240.0,
        weightedAvgCostPerUnit: 240.0,
        healthStatus: "HEALTHY",
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: "ing-mutton",
        categoryId: "cat-meat",
        name: "Fresh Mutton (Goat)",
        localName: "बोकडाचे मटण",
        baseUnit: "kg",
        physicalStock: 5.0,
        reservedStock: 0,
        availableStock: 5.0,
        parLevel: 15.0,
        reorderLevel: 6.0,
        criticalLevel: 2.0,
        currentCostPerUnit: 750.0,
        weightedAvgCostPerUnit: 750.0,
        healthStatus: "HEALTHY",
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: "ing-rice",
        categoryId: "cat-grains",
        name: "Indrayani Rice",
        localName: "इंद्रायणी तांदूळ",
        baseUnit: "kg",
        physicalStock: 15.0,
        reservedStock: 0,
        availableStock: 15.0,
        parLevel: 30.0,
        reorderLevel: 10.0,
        criticalLevel: 3.0,
        currentCostPerUnit: 65.0,
        weightedAvgCostPerUnit: 65.0,
        healthStatus: "HEALTHY",
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: "ing-dal",
        categoryId: "cat-pulses",
        name: "Toor Dal",
        localName: "तुरीची डाळ",
        baseUnit: "kg",
        physicalStock: 8.0,
        reservedStock: 0,
        availableStock: 8.0,
        parLevel: 15.0,
        reorderLevel: 5.0,
        criticalLevel: 2.0,
        currentCostPerUnit: 160.0,
        weightedAvgCostPerUnit: 160.0,
        healthStatus: "HEALTHY",
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: "ing-bhaji",
        categoryId: "cat-veg",
        name: "Seasonal Vegetables (Bhaji)",
        localName: "मिश्र भाजी",
        baseUnit: "kg",
        physicalStock: 5.0,
        reservedStock: 0,
        availableStock: 5.0,
        parLevel: 12.0,
        reorderLevel: 4.0,
        criticalLevel: 1.5,
        currentCostPerUnit: 50.0,
        weightedAvgCostPerUnit: 50.0,
        healthStatus: "HEALTHY",
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: "ing-oil",
        categoryId: "cat-oils",
        name: "Groundnut Oil",
        localName: "शेंगदाणा तेल",
        baseUnit: "l",
        physicalStock: 10.0,
        reservedStock: 0,
        availableStock: 10.0,
        parLevel: 20.0,
        reorderLevel: 6.0,
        criticalLevel: 2.0,
        currentCostPerUnit: 180.0,
        weightedAvgCostPerUnit: 180.0,
        healthStatus: "HEALTHY",
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: "ing-chapati",
        categoryId: "cat-grains",
        name: "Fresh Chapati",
        localName: "चपाती",
        baseUnit: "piece",
        physicalStock: 150.0,
        reservedStock: 0,
        availableStock: 150.0,
        parLevel: 300.0,
        reorderLevel: 100.0,
        criticalLevel: 20.0,
        currentCostPerUnit: 6.0,
        weightedAvgCostPerUnit: 6.0,
        healthStatus: "HEALTHY",
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: "ing-spices",
        categoryId: "cat-spices",
        name: "Kolhapuri Masala",
        localName: "कांदा लसूण मसाला",
        baseUnit: "kg",
        physicalStock: 6.0,
        reservedStock: 0,
        availableStock: 6.0,
        parLevel: 10.0,
        reorderLevel: 3.0,
        criticalLevel: 1.0,
        currentCostPerUnit: 350.0,
        weightedAvgCostPerUnit: 350.0,
        healthStatus: "HEALTHY",
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: "ing-kokum-coconut",
        categoryId: "cat-dairy",
        name: "Coconut Milk & Kokum",
        localName: "नारळ दूध आणि कोकम",
        baseUnit: "l",
        physicalStock: 5.0,
        reservedStock: 0,
        availableStock: 5.0,
        parLevel: 10.0,
        reorderLevel: 3.0,
        criticalLevel: 1.0,
        currentCostPerUnit: 120.0,
        weightedAvgCostPerUnit: 120.0,
        healthStatus: "HEALTHY",
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    // Categories (loaded from storage or seeded from 20 authentic Khanawal categories)
    this.categories = this.getStoredMenuCategories();

    // Menu Items (loaded from storage or seeded from full 188-dish Khanawal catalog)
    this.menuItems = this.getStoredMenuItems();

    // Recipes (with exact scenario amounts: Chicken 100g, Rice 250g, Dal 150g, Bhaji 100g, Chapati 2 pcs, Oil 15ml, Spices 5g)
    this.recipes = [
      {
        id: "rec-chicken-thali",
        menuItemId: "menu-chicken-thali",
        menuItemName: "Special Chicken Thali",
        version: 1,
        status: "ACTIVE",
        effectiveFrom: "2026-01-01",
        preparationTimeMinutes: 10,
        portionsYielded: 1,
        estimatedCost: 92.5,
        components: [
          { id: "rc-1", recipeId: "rec-chicken-thali", componentType: "RAW_INGREDIENT", ingredientId: "ing-chicken", ingredientName: "Fresh Chicken", quantity: 0.1, unit: "kg", yieldFactor: 1.0, isOptional: false },
          { id: "rc-2", recipeId: "rec-chicken-thali", componentType: "RAW_INGREDIENT", ingredientId: "ing-rice", ingredientName: "Indrayani Rice", quantity: 0.25, unit: "kg", yieldFactor: 1.0, isOptional: false },
          { id: "rc-3", recipeId: "rec-chicken-thali", componentType: "RAW_INGREDIENT", ingredientId: "ing-dal", ingredientName: "Toor Dal", quantity: 0.15, unit: "kg", yieldFactor: 1.0, isOptional: false },
          { id: "rc-4", recipeId: "rec-chicken-thali", componentType: "RAW_INGREDIENT", ingredientId: "ing-bhaji", ingredientName: "Seasonal Vegetables (Bhaji)", quantity: 0.1, unit: "kg", yieldFactor: 1.0, isOptional: false },
          { id: "rc-5", recipeId: "rec-chicken-thali", componentType: "RAW_INGREDIENT", ingredientId: "ing-chapati", ingredientName: "Fresh Chapati", quantity: 2, unit: "piece", yieldFactor: 1.0, isOptional: false },
          { id: "rc-6", recipeId: "rec-chicken-thali", componentType: "RAW_INGREDIENT", ingredientId: "ing-oil", ingredientName: "Groundnut Oil", quantity: 0.015, unit: "l", yieldFactor: 1.0, isOptional: false },
          { id: "rc-7", recipeId: "rec-chicken-thali", componentType: "RAW_INGREDIENT", ingredientId: "ing-spices", ingredientName: "Kolhapuri Masala", quantity: 0.005, unit: "kg", yieldFactor: 1.0, isOptional: false },
        ],
      },
      {
        id: "rec-mutton-thali",
        menuItemId: "menu-mutton-thali",
        menuItemName: "Special Mutton Thali",
        version: 1,
        status: "ACTIVE",
        effectiveFrom: "2026-01-01",
        preparationTimeMinutes: 12,
        portionsYielded: 1,
        estimatedCost: 145.0,
        components: [
          { id: "rc-m1", recipeId: "rec-mutton-thali", componentType: "RAW_INGREDIENT", ingredientId: "ing-mutton", ingredientName: "Fresh Mutton (Goat)", quantity: 0.15, unit: "kg", yieldFactor: 1.0, isOptional: false },
          { id: "rc-m2", recipeId: "rec-mutton-thali", componentType: "RAW_INGREDIENT", ingredientId: "ing-rice", ingredientName: "Indrayani Rice", quantity: 0.25, unit: "kg", yieldFactor: 1.0, isOptional: false },
          { id: "rc-m3", recipeId: "rec-mutton-thali", componentType: "RAW_INGREDIENT", ingredientId: "ing-dal", ingredientName: "Toor Dal", quantity: 0.15, unit: "kg", yieldFactor: 1.0, isOptional: false },
          { id: "rc-m4", recipeId: "rec-mutton-thali", componentType: "RAW_INGREDIENT", ingredientId: "ing-chapati", ingredientName: "Fresh Chapati", quantity: 2, unit: "piece", yieldFactor: 1.0, isOptional: false },
          { id: "rc-m5", recipeId: "rec-mutton-thali", componentType: "RAW_INGREDIENT", ingredientId: "ing-oil", ingredientName: "Groundnut Oil", quantity: 0.02, unit: "l", yieldFactor: 1.0, isOptional: false },
          { id: "rc-m6", recipeId: "rec-mutton-thali", componentType: "RAW_INGREDIENT", ingredientId: "ing-spices", ingredientName: "Kolhapuri Masala", quantity: 0.01, unit: "kg", yieldFactor: 1.0, isOptional: false },
        ],
      },
      {
        id: "rec-solkadhi",
        menuItemId: "menu-solkadhi",
        menuItemName: "Kolhapuri Solkadhi Glass",
        version: 1,
        status: "ACTIVE",
        effectiveFrom: "2026-01-01",
        preparationTimeMinutes: 1,
        portionsYielded: 1,
        estimatedCost: 12.0,
        components: [
          { id: "rc-sk-1", recipeId: "rec-solkadhi", componentType: "RAW_INGREDIENT", ingredientId: "ing-kokum-coconut", ingredientName: "Coconut Milk & Kokum", quantity: 0.1, unit: "l", yieldFactor: 1.0, isOptional: false },
        ],
      },
    ];

    // Operational Opening Checklist
    this.checklists = [
      {
        id: "chk-open-today",
        checklistType: "OPENING",
        date: new Date().toISOString().split("T")[0],
        shift: "MORNING",
        completedBy: "Vikram Patil",
        status: "COMPLETED",
        completedAt: new Date().toISOString(),
      },
    ];

    this.checklistItems = [
      { id: "o1", title: "Commercial LPG Gas lines and safety valves checked", category: "SAFETY", isCompleted: true, shift: "OPENING" },
      { id: "o2", title: "Kitchen tables, Tawa, and Thali prep counters sanitized", category: "HYGIENE", isCompleted: true, shift: "OPENING" },
      { id: "o3", title: "Cash Drawer opening float counted (₹5,000)", category: "FINANCE", isCompleted: true, shift: "OPENING" },
      { id: "o4", title: "Fresh poultry (Chicken) and goat mutton delivery weighed and inspected", category: "STOCK", isCompleted: true, shift: "OPENING" },
      { id: "o5", title: "Dairy, coconut milk, and Kokum extract refrigerated at <4°C", category: "STOCK", isCompleted: true, shift: "OPENING" },
      { id: "o6", title: "UPI Soundbox and QR code display verified active", category: "OPERATIONS", isCompleted: false, shift: "OPENING" },
      { id: "o7", title: "12 Tables set with clean water jugs and kanda-limbu plates", category: "OPERATIONS", isCompleted: false, shift: "OPENING" },
      { id: "c1", title: "All dining parties closed & bills settled with cashier", category: "FINANCE", isCompleted: false, shift: "CLOSING" },
      { id: "c2", title: "Physical cash count reconciled with system sales report", category: "FINANCE", isCompleted: false, shift: "CLOSING" },
      { id: "c3", title: "All kitchen KOTs marked completed / served", category: "OPERATIONS", isCompleted: false, shift: "CLOSING" },
      { id: "c4", title: "Daily wastage and prep variance recorded in stock ledger", category: "STOCK", isCompleted: false, shift: "CLOSING" },
      { id: "c5", title: "Main LPG gas cylinders shut off and locked", category: "SAFETY", isCompleted: false, shift: "CLOSING" },
      { id: "c6", title: "Deep freezers temperature checked & locked", category: "STOCK", isCompleted: false, shift: "CLOSING" },
      { id: "c7", title: "Kitchen grease traps cleaned and trash bins cleared", category: "HYGIENE", isCompleted: false, shift: "CLOSING" },
    ];

    // Seed Khanawal Operational Datasets
    this.suppliers = [...initialSuppliers];
    this.purchases = [...initialPurchases];
    this.expenses = this.getStoredExpenses();
    this.supplierAdvances = [...initialSupplierAdvances];
    this.supplierPayments = [...initialSupplierPayments];
    this.staffAdvances = [...initialStaffAdvances];
    this.employees = [...initialEmployees];
    this.attendance = [...initialAttendance];
    this.equipment = [...initialEquipment];
    this.khanawalTasks = [...initialKhanawalTasks];
    this.reminders = [...initialReminders];
    this.notifications = [...initialNotifications];
    this.soundEnabled = true;
    this.officeOrders = [...initialOfficeOrders];
    this.priceHistory = [...initialPriceHistory];
    this.cashLedger = [...initialCashLedger];
    this.upiLedger = [...initialUPILedger];
    this.dailyClosings = [...initialDailyClosings];

    // Seed realistic settled bills for 07/09/2026 to populate live metrics immediately
    const today = "2026-09-07";
    this.bills = [
      {
        id: "bill-20260907-01",
        billNumber: "BILL-2026-0001",
        partyId: "pty-sample-1",
        partyCode: "P-1",
        tableId: "tbl-1",
        tableNumber: 1,
        waiterId: "emp-rahul",
        waiterName: "Rahul Shinde",
        cashierId: "emp-priya",
        cashierName: "Priya Kulkarni",
        status: "PAID",
        subtotal: 960,
        discountAmount: 0,
        taxableAmount: 960,
        cgstAmount: 24,
        sgstAmount: 24,
        igstAmount: 0,
        vatAmount: 0,
        totalTaxAmount: 48,
        roundOff: 0,
        grandTotal: 1008,
        paidAmount: 1008,
        balanceDue: 0,
        createdAt: `${today}T12:15:00Z`,
        settledAt: `${today}T12:45:00Z`,
        items: [
          { id: "bi-1", billId: "bill-20260907-01", orderItemId: "oi-1", menuItemId: "menu-chicken-thali", menuItemName: "Special Chicken Thali", quantity: 3, unitPrice: 320, totalPrice: 960, taxRateId: "tax-gst5", taxRatePercentage: 5, taxAmount: 48, isComplimentary: false },
        ],
        payments: [
          { id: "pay-1", billId: "bill-20260907-01", paymentMethod: "CASH", amount: 1008, receivedBy: "emp-priya", receivedByName: "Priya Kulkarni", status: "SUCCESS", paymentTime: `${today}T12:45:00Z` },
        ],
      },
      {
        id: "bill-20260907-02",
        billNumber: "BILL-2026-0002",
        partyId: "pty-sample-2",
        partyCode: "P-2",
        tableId: "tbl-3",
        tableNumber: 3,
        waiterId: "emp-nitin",
        waiterName: "Nitin Jadhav",
        cashierId: "emp-priya",
        cashierName: "Priya Kulkarni",
        status: "PAID",
        subtotal: 1320,
        discountAmount: 0,
        taxableAmount: 1320,
        cgstAmount: 33,
        sgstAmount: 33,
        igstAmount: 0,
        vatAmount: 0,
        totalTaxAmount: 66,
        roundOff: 0,
        grandTotal: 1386,
        paidAmount: 1386,
        balanceDue: 0,
        createdAt: `${today}T12:30:00Z`,
        settledAt: `${today}T13:10:00Z`,
        items: [
          { id: "bi-2", billId: "bill-20260907-02", orderItemId: "oi-2", menuItemId: "menu-mutton-thali", menuItemName: "Special Mutton Thali", quantity: 3, unitPrice: 440, totalPrice: 1320, taxRateId: "tax-gst5", taxRatePercentage: 5, taxAmount: 66, isComplimentary: false },
        ],
        payments: [
          { id: "pay-2", billId: "bill-20260907-02", paymentMethod: "UPI", amount: 1386, transactionReference: "SBI4928172918", receivedBy: "emp-priya", receivedByName: "Priya Kulkarni", status: "SUCCESS", paymentTime: `${today}T13:10:00Z` },
        ],
      },
      {
        id: "bill-20260907-03",
        billNumber: "BILL-2026-0003",
        partyId: "pty-sample-3",
        partyCode: "P-3",
        tableId: "tbl-4",
        tableNumber: 4,
        waiterId: "emp-rahul",
        waiterName: "Rahul Shinde",
        cashierId: "emp-priya",
        cashierName: "Priya Kulkarni",
        status: "PAID",
        subtotal: 680,
        discountAmount: 0,
        taxableAmount: 680,
        cgstAmount: 17,
        sgstAmount: 17,
        igstAmount: 0,
        vatAmount: 0,
        totalTaxAmount: 34,
        roundOff: 0,
        grandTotal: 714,
        paidAmount: 714,
        balanceDue: 0,
        createdAt: `${today}T13:00:00Z`,
        settledAt: `${today}T13:35:00Z`,
        items: [
          { id: "bi-3", billId: "bill-20260907-03", orderItemId: "oi-3", menuItemId: "menu-chicken-thali", menuItemName: "Special Chicken Thali", quantity: 2, unitPrice: 320, totalPrice: 640, taxRateId: "tax-gst5", taxRatePercentage: 5, taxAmount: 32, isComplimentary: false },
          { id: "bi-4", billId: "bill-20260907-03", orderItemId: "oi-4", menuItemId: "menu-solkadhi", menuItemName: "Kolhapuri Solkadhi Glass", quantity: 1, unitPrice: 40, totalPrice: 40, taxRateId: "tax-gst5", taxRatePercentage: 5, taxAmount: 2, isComplimentary: false },
        ],
        payments: [
          { id: "pay-3", billId: "bill-20260907-03", paymentMethod: "UPI", amount: 714, transactionReference: "GPAY8291038", receivedBy: "emp-priya", receivedByName: "Priya Kulkarni", status: "SUCCESS", paymentTime: `${today}T13:35:00Z` },
        ],
      },
    ];

    this.recalculateMenuAvailability();
    this.loadLiveOperationalState();
  }

  /**
   * Recalculates remaining portions and stock status for all menu items
   */
  recalculateMenuAvailability() {
    const ingredientsMap = new Map(this.ingredients.map((i) => [i.id, i]));

    this.menuItems = this.menuItems.map((item) => {
      const recipe = this.recipes.find((r) => r.menuItemId === item.id);
      if (!recipe) {
        return item;
      }

      const calc = calculateRecipeAvailability(recipe, ingredientsMap, item.sellingPrice);
      let stockStatus = item.stockStatus;
      if (calc.theoreticalPortionsRemaining === 0) {
        stockStatus = "OUT_OF_STOCK";
      } else if (calc.theoreticalPortionsRemaining <= 5) {
        stockStatus = "LOW_STOCK";
      } else {
        stockStatus = "AVAILABLE";
      }

      return {
        ...item,
        portionAvailability: calc.theoreticalPortionsRemaining,
        stockStatus,
        costPrice: calc.recipeCost,
      };
    });
  }

  /**
   * Updates an existing menu item's price, details, variants, or stock status
   */
  updateMenuItem(
    id: string,
    updates: Partial<Pick<MenuItem, "name" | "localName" | "sellingPrice" | "price" | "costPrice" | "description" | "categoryId" | "categoryName" | "isVeg" | "foodType" | "variants" | "stockStatus" | "isActive" | "image" | "sortOrder">>
  ): MenuItem {
    const idx = this.menuItems.findIndex((m) => m.id === id);
    if (idx === -1) throw new Error(`MenuItem ${id} not found`);
    const isVeg = updates.foodType ? updates.foodType === "VEG" : (updates.isVeg !== undefined ? updates.isVeg : this.menuItems[idx].isVeg);
    const sellingPrice = updates.price !== undefined ? updates.price : (updates.sellingPrice !== undefined ? updates.sellingPrice : this.menuItems[idx].sellingPrice);
    this.menuItems[idx] = {
      ...this.menuItems[idx],
      ...updates,
      isVeg,
      foodType: updates.foodType || (isVeg ? "VEG" : "NON_VEG"),
      sellingPrice,
      price: sellingPrice,
      isAvailable: updates.stockStatus ? updates.stockStatus === "AVAILABLE" : this.menuItems[idx].isAvailable,
    };
    this.saveStoredMenuItems();
    return this.menuItems[idx];
  }

  /**
   * Adds a new menu item to the catalog
   */
  addMenuItem(item: Omit<MenuItem, "id" | "portionAvailability">): MenuItem {
    const isVeg = item.foodType ? item.foodType === "VEG" : (item.isVeg ?? true);
    const sellingPrice = item.price !== undefined ? item.price : item.sellingPrice;
    const newItem: MenuItem = {
      ...item,
      id: `menu-${Date.now()}`,
      portionAvailability: 30,
      isVeg,
      foodType: item.foodType || (isVeg ? "VEG" : "NON_VEG"),
      sellingPrice,
      price: sellingPrice,
      isAvailable: item.stockStatus === "AVAILABLE",
      isActive: item.isActive ?? true,
      sortOrder: item.sortOrder || this.menuItems.length + 1,
    };
    this.menuItems.push(newItem);
    this.saveStoredMenuItems();
    return newItem;
  }

  /**
   * Records an authoritative immutable audit log entry
   */
  recordAuditLog(
    action: string,
    entityType: string,
    entityId: string,
    reason?: string,
    oldValue?: Record<string, unknown> | null,
    newValue?: Record<string, unknown> | null
  ): AuditLog {
    const log: AuditLog = {
      id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      userId: this.currentUser.id,
      userName: this.currentUser.name,
      role: this.currentUser.role,
      action,
      entityType,
      entityId,
      reason,
      oldValue,
      newValue,
      createdAt: new Date().toISOString(),
    };
    this.auditLogs.unshift(log);
    return log;
  }

  /**
   * Deletes / archives a dish from the menu catalog
   */
  deleteMenuItem(id: string): void {
    const item = this.menuItems.find((m) => m.id === id);
    if (!item) throw new Error(`MenuItem ${id} not found`);
    this.menuItems = this.menuItems.filter((m) => m.id !== id);
    this.recipes = this.recipes.filter((r) => r.menuItemId !== id);
    this.saveStoredMenuItems();
    this.recordAuditLog("DELETE_MENU_ITEM", "MENU_ITEM", id, `Deleted dish "${item.name}"`);
  }

  /**
   * Adds a new recipe Bill of Materials for a menu dish
   */
  addRecipe(recipeData: Omit<Recipe, "id" | "version" | "status" | "effectiveFrom">): Recipe {
    const menuItem = this.menuItems.find((m) => m.id === recipeData.menuItemId);
    const newRecipe: Recipe = {
      id: `rec-${Date.now()}`,
      menuItemId: recipeData.menuItemId,
      menuItemName: menuItem?.name || recipeData.menuItemName || "Dish Recipe",
      version: 1,
      status: "ACTIVE",
      effectiveFrom: new Date().toISOString().split("T")[0],
      preparationTimeMinutes: recipeData.preparationTimeMinutes || 15,
      portionsYielded: recipeData.portionsYielded || 1,
      estimatedCost: recipeData.estimatedCost || 50,
      notes: recipeData.notes,
      components: recipeData.components.map((c, idx) => ({
        ...c,
        id: c.id || `comp-${Date.now()}-${idx}`,
        recipeId: `rec-${Date.now()}`,
      })),
    };

    this.recipes.push(newRecipe);
    this.recalculateMenuAvailability();
    this.recordAuditLog("ADD_RECIPE", "RECIPE", newRecipe.id, `Created recipe BOM for ${newRecipe.menuItemName}`);
    return newRecipe;
  }

  /**
   * Updates an existing recipe Bill of Materials
   */
  updateRecipe(recipeId: string, updates: Partial<Recipe>): Recipe {
    const recipe = this.recipes.find((r) => r.id === recipeId);
    if (!recipe) throw new Error(`Recipe ${recipeId} not found`);

    const updatedRecipe: Recipe = {
      ...recipe,
      ...updates,
      version: recipe.version + 1,
    };

    this.recipes = this.recipes.map((r) => (r.id === recipeId ? updatedRecipe : r));
    this.recalculateMenuAvailability();
    this.recordAuditLog("UPDATE_RECIPE", "RECIPE", recipeId, `Updated recipe BOM for ${recipe.menuItemName}`);
    return updatedRecipe;
  }

  /**
   * Deletes a recipe Bill of Materials
   */
  deleteRecipe(recipeId: string): void {
    const recipe = this.recipes.find((r) => r.id === recipeId);
    if (!recipe) throw new Error(`Recipe ${recipeId} not found`);

    this.recipes = this.recipes.filter((r) => r.id !== recipeId);
    this.recalculateMenuAvailability();
    this.recordAuditLog("DELETE_RECIPE", "RECIPE", recipeId, `Deleted recipe BOM for ${recipe.menuItemName}`);
  }

  /**
   * Adds a new raw ingredient to the stock ledger
   */
  addIngredient(
    data: Omit<Ingredient, "id" | "reservedStock" | "availableStock" | "healthStatus" | "isActive" | "createdAt" | "updatedAt" | "weightedAvgCostPerUnit">
  ): Ingredient {
    const newIngredient: Ingredient = {
      id: `ing-${Date.now()}`,
      categoryId: data.categoryId,
      categoryName: data.categoryName,
      name: data.name,
      localName: data.localName,
      baseUnit: data.baseUnit,
      physicalStock: data.physicalStock,
      reservedStock: 0,
      availableStock: data.physicalStock,
      parLevel: data.parLevel,
      reorderLevel: data.reorderLevel,
      criticalLevel: data.criticalLevel,
      currentCostPerUnit: data.currentCostPerUnit,
      weightedAvgCostPerUnit: data.currentCostPerUnit,
      healthStatus: "HEALTHY",
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.ingredients.push(newIngredient);
    this.recalculateMenuAvailability();
    this.recordAuditLog("ADD_INGREDIENT", "INGREDIENT", newIngredient.id, `Added raw material ${newIngredient.name}`);
    this.notifyStateChange("addIngredient");
    return newIngredient;
  }

  /**
   * Updates an existing raw ingredient in the stock ledger
   */
  updateIngredient(id: string, updates: Partial<Ingredient>): Ingredient {
    const ing = this.ingredients.find((i) => i.id === id);
    if (!ing) throw new Error(`Ingredient ${id} not found`);

    const updated: Ingredient = {
      ...ing,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    if (updates.physicalStock !== undefined) {
      updated.availableStock = Math.max(0, updated.physicalStock - updated.reservedStock);
    }

    this.ingredients = this.ingredients.map((i) => (i.id === id ? updated : i));
    this.recalculateMenuAvailability();
    this.recordAuditLog("UPDATE_INGREDIENT", "INGREDIENT", id, `Updated ingredient ${ing.name}`);
    this.notifyStateChange("updateIngredient");
    return updated;
  }

  /**
   * Deletes an ingredient from the stock ledger
   */
  deleteIngredient(id: string): void {
    const ing = this.ingredients.find((i) => i.id === id);
    if (!ing) throw new Error(`Ingredient ${id} not found`);

    this.ingredients = this.ingredients.filter((i) => i.id !== id);
    this.recalculateMenuAvailability();
    this.recordAuditLog("DELETE_INGREDIENT", "INGREDIENT", id, `Deleted ingredient ${ing.name}`);
    this.notifyStateChange("deleteIngredient");
  }

  /**
   * Checklists management helpers
   */
  toggleChecklistItem(id: string) {
    this.checklistItems = this.checklistItems.map((item) =>
      item.id === id ? { ...item, isCompleted: !item.isCompleted } : item
    );
    this.notifyStateChange("toggleChecklistItem");
  }

  addChecklistItem(
    title: string,
    category: "SAFETY" | "HYGIENE" | "STOCK" | "FINANCE" | "OPERATIONS",
    shift: "OPENING" | "CLOSING"
  ) {
    const newItem = {
      id: `chk-${Date.now()}`,
      title,
      category,
      isCompleted: false,
      shift,
    };
    this.checklistItems.push(newItem);
    this.notifyStateChange("addChecklistItem");
    return newItem;
  }

  deleteChecklistItem(id: string) {
    this.checklistItems = this.checklistItems.filter((i) => i.id !== id);
    this.notifyStateChange("deleteChecklistItem");
  }

  // --- PARTY & TABLE ACTIONS ---

  createPartyAtTable(
    tableNumber: number,
    guestCount: number,
    descriptor?: string,
    isTakeaway?: boolean,
    customerName?: string,
    customerPhone?: string,
    packagingCharges?: number
  ): DiningParty {
    const table = this.tables.find((t) => t.tableNumber === tableNumber);
    if (!table) throw new Error(`Table ${tableNumber} not found`);

    const existingParties = this.parties.filter(
      (p) => p.tableNumber === tableNumber && p.openedAt.startsWith(new Date().toISOString().split("T")[0])
    );

    const { party, seats } = openDiningParty({
      table,
      existingPartiesForTableToday: existingParties,
      guestCount,
      assignedWaiterId: this.currentUser.id,
      assignedWaiterName: this.currentUser.name,
      descriptor,
    });

    if (isTakeaway) {
      party.isTakeaway = true;
      party.customerName = customerName;
      party.customerPhone = customerPhone;
      party.packagingCharges = packagingCharges ?? 20;
    }

    this.parties.push(party);
    this.seats.push(...seats);

    this.tables = this.tables.map((t) => refreshTableOccupancy(t, this.parties));
    this.notifyStateChange("createPartyAtTable");
    return party;
  }

  voidOrCancelParty(partyId: string, reason?: string): void {
    const party = this.parties.find((p) => p.id === partyId);
    if (!party) throw new Error(`Party ${partyId} not found`);

    const hasActiveOrders = this.orders.some(
      (o) => o.partyId === partyId && o.items.length > 0
    );
    if (hasActiveOrders) {
      throw new Error(`Cannot cancel party ${party.partyCode}: it already has active orders in kitchen/billing.`);
    }

    this.parties = this.parties.map((p) =>
      p.id === partyId ? { ...p, status: "CANCELLED", closedAt: new Date().toISOString() } : p
    );
    this.tables = this.tables.map((t) => refreshTableOccupancy(t, this.parties));
    this.recordAuditLog("CANCEL_PARTY", "PARTY", partyId, `Cancelled party ${party.partyCode}: ${reason || "No orders placed"}`);
    this.notifyStateChange("voidOrCancelParty");
  }

  transferPartyToTable(partyId: string, toTableNumber: number): DiningParty {
    const party = this.parties.find((p) => p.id === partyId);
    if (!party) throw new Error(`Party ${partyId} not found`);

    const fromTable = this.tables.find((t) => t.id === party.tableId)!;
    const toTable = this.tables.find((t) => t.tableNumber === toTableNumber);
    if (!toTable) throw new Error(`Target table ${toTableNumber} not found`);

    const { updatedParty } = transferParty(
      party,
      fromTable,
      toTable,
      this.currentUser.id,
      this.currentUser.name,
      "Customer requested table transfer"
    );

    this.parties = this.parties.map((p) => (p.id === partyId ? updatedParty : p));
    this.tables = this.tables.map((t) => refreshTableOccupancy(t, this.parties));
    this.notifyStateChange("transferPartyToTable");
    return updatedParty;
  }

  mergePartiesTogether(sourcePartyIds: string[]): DiningParty {
    const activeSources = this.parties.filter((p) => sourcePartyIds.includes(p.id));
    if (activeSources.length < 2) throw new Error("Need at least 2 parties to merge");

    const targetTable = this.tables.find((t) => t.id === activeSources[0].tableId)!;
    const { targetPartyUpdated, closedParties } = mergeParties(
      activeSources,
      targetTable,
      this.currentUser.id,
      this.currentUser.name
    );

    this.parties = this.parties.map((p) => {
      if (p.id === targetPartyUpdated.id) return targetPartyUpdated;
      const closed = closedParties.find((c) => c.id === p.id);
      return closed ? closed : p;
    });

    // Reassign all orders and order items from the merged closed parties to targetPartyUpdated
    const closedPartyIds = closedParties.map((c) => c.id);
    this.orders = this.orders.map((o) => {
      if (closedPartyIds.includes(o.partyId)) {
        return {
          ...o,
          partyId: targetPartyUpdated.id,
          partyCode: targetPartyUpdated.partyCode,
          tableNumber: targetPartyUpdated.tableNumber,
          items: o.items.map((it) => ({
            ...it,
            partyId: targetPartyUpdated.id,
          })),
        };
      }
      return o;
    });

    // Reassign all KOTs from the merged closed parties
    this.kots = this.kots.map((k) => {
      if (closedPartyIds.includes(k.partyId)) {
        return {
          ...k,
          partyId: targetPartyUpdated.id,
          partyCode: targetPartyUpdated.partyCode,
          tableNumber: targetPartyUpdated.tableNumber,
        };
      }
      return k;
    });

    this.tables = this.tables.map((t) => refreshTableOccupancy(t, this.parties));
    this.notifyStateChange("mergePartiesTogether");
    return targetPartyUpdated;
  }

  splitPartyItemsAction(
    sourcePartyId: string,
    targetTableNumber: number,
    orderItemIds: string[]
  ): { newParty: DiningParty; updatedSourceParty: DiningParty } {
    const sourceParty = this.parties.find((p) => p.id === sourcePartyId);
    if (!sourceParty) throw new Error(`Source party ${sourcePartyId} not found`);

    const targetTable = this.tables.find((t) => t.tableNumber === targetTableNumber);
    if (!targetTable) throw new Error(`Target table ${targetTableNumber} not found`);

    const sourceOrders = this.orders.filter((o) => o.partyId === sourcePartyId);
    const allItems = sourceOrders.flatMap((o) => o.items);
    const itemsToMove = allItems.filter((it) => orderItemIds.includes(it.id));

    if (itemsToMove.length === 0) {
      throw new Error("No items selected to split");
    }

    const existingPartiesForNewTable = this.parties.filter(
      (p) => p.tableNumber === targetTableNumber && p.openedAt.startsWith(new Date().toISOString().split("T")[0])
    );

    const { newParty, updatedSourceParty, movedItems } = splitPartyItems(
      sourceParty,
      itemsToMove,
      targetTable,
      existingPartiesForNewTable,
      this.currentUser.id,
      this.currentUser.name
    );

    // Create a new order for the new party with moved items
    const newOrderId = `ord-split-${Date.now()}`;
    const newOrderSubtotal = movedItems.reduce((sum, it) => sum + it.totalPrice, 0);
    const newOrder: Order = {
      id: newOrderId,
      orderNumber: `ORD-SPLIT-${Date.now().toString().slice(-6)}`,
      partyId: newParty.id,
      partyCode: newParty.partyCode,
      tableNumber: targetTableNumber,
      waiterId: sourceParty.assignedWaiterId,
      waiterName: sourceParty.assignedWaiterName,
      status: "OPEN",
      idempotencyKey: `idemp-split-${Date.now()}`,
      items: movedItems,
      subtotal: newOrderSubtotal,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Update old orders by removing the moved items
    this.orders = this.orders.map((o) => {
      if (o.partyId !== sourcePartyId) return o;
      const remainingItems = o.items.filter((it) => !orderItemIds.includes(it.id));
      const remainingSubtotal = remainingItems.reduce((sum, it) => sum + it.totalPrice, 0);
      return {
        ...o,
        items: remainingItems,
        subtotal: remainingSubtotal,
      };
    });
    this.orders.push(newOrder);

    // Update parties array
    this.parties = this.parties.map((p) => (p.id === sourcePartyId ? updatedSourceParty : p));
    this.parties.push(newParty);

    // Reassign seats for new party
    const newPartySeats = Array.from({ length: newParty.guestCount }, (_, i) => ({
      id: `seat-${newParty.id}-${i + 1}`,
      partyId: newParty.id,
      tableId: targetTable.id,
      seatNumber: i + 1,
      label: `Seat ${i + 1}`,
      isOccupied: true,
      seatedAt: new Date().toISOString(),
    }));
    this.seats.push(...newPartySeats);

    // Refresh table occupancies
    this.tables = this.tables.map((t) => refreshTableOccupancy(t, this.parties));

    this.recordAuditLog(
      "SPLIT_PARTY_ITEMS",
      "DINING_PARTY",
      sourcePartyId,
      `Split ${itemsToMove.length} items to new party ${newParty.partyCode} at Table ${targetTableNumber}`
    );
    this.notifyStateChange("splitPartyItemsAction");

    return { newParty, updatedSourceParty };
  }

  // --- ORDERING & KOT ACTIONS ---

  placeOrder(
    partyId: string,
    items: {
      menuItemId: string;
      quantity: number;
      seatNumber?: number;
      spiceLevel?: any;
      breadOption?: BreadOption;
      notes?: string;
      variantName?: string;
      unitPrice?: number;
    }[],
    allowNegativeStock = false
  ): { order: Order; kot: Kot } {
    if (allowNegativeStock) {
      requirePermission(this.currentUser.role, "override.negative_stock");
    } else {
      requirePermission(this.currentUser.role, "orders.create");
    }

    const party = this.parties.find((p) => p.id === partyId);
    if (!party) throw new Error(`Party ${partyId} not found`);

    const recipesMap = new Map(this.recipes.map((r) => [r.menuItemId, r]));
    const ingredientsMap = new Map(this.ingredients.map((i) => [i.id, i]));

    const placeItems = items.map((it) => {
      const menuItem = this.menuItems.find((m) => m.id === it.menuItemId);
      if (!menuItem) throw new Error(`Menu item ${it.menuItemId} not found`);
      return {
        menuItem,
        quantity: it.quantity,
        seatNumber: it.seatNumber,
        spiceLevel: it.spiceLevel,
        breadOption: it.breadOption,
        notes: it.notes,
        variantName: it.variantName,
        unitPrice: it.unitPrice,
      };
    });

    const existingPartyKots = this.kots.filter(
      (k) => k.partyId === partyId && k.status !== "CANCELLED"
    );
    const isAddOn = existingPartyKots.length > 0;
    const kotSequenceNumber = existingPartyKots.length + 1;

    const idempotencyKey = `idem-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const result = placeOrderAndGenerateKot({
      party,
      waiterId: this.currentUser.id,
      waiterName: this.currentUser.name,
      items: placeItems,
      recipesMap,
      ingredientsMap,
      idempotencyKey,
      allowNegativeStockOverride: allowNegativeStock,
      kotSequenceNumber,
      isAddOn,
    });

    this.orders.push(result.order);
    this.kots.push(result.kot);
    this.stockReservations.push(...result.reservations);

    // Update ingredients map and recalculate availability
    this.ingredients = Array.from(result.updatedIngredientsMap.values());
    this.recalculateMenuAvailability();

    if (allowNegativeStock) {
      this.recordAuditLog(
        "OVERRIDE_NEGATIVE_STOCK",
        "PARTY_ORDER",
        partyId,
        "Manager authorized negative stock override for order"
      );
    }

    // Update Party state and running subtotal
    this.parties = this.parties.map((p) =>
      p.id === partyId
        ? {
            ...p,
            status: "FOOD_PENDING",
            runningSubtotal: p.runningSubtotal + result.order.subtotal,
            lastActivityAt: new Date().toISOString(),
          }
        : p
    );

    this.notifyStateChange("placeOrder");
    return { order: result.order, kot: result.kot };
  }

  advanceKotStatus(kotId: string, newStatus: any) {
    const kot = this.kots.find((k) => k.id === kotId);
    if (!kot) throw new Error(`KOT ${kotId} not found`);

    const ingredientsMap = new Map(this.ingredients.map((i) => [i.id, i]));
    const result = transitionKotStatus(
      kot,
      newStatus,
      this.currentUser.id,
      this.currentUser.name,
      this.stockReservations,
      ingredientsMap
    );

    this.kots = this.kots.map((k) => (k.id === kotId ? result.updatedKot : k));
    this.kotEvents.push(result.event);
    this.stockTransactions.push(...result.stockTransactions);
    this.ingredients = Array.from(result.updatedIngredientsMap.values());
    this.recalculateMenuAvailability();

    // If all KOTs for this party are served, transition party status to OPEN
    const partyKots = this.kots.filter((k) => k.partyId === kot.partyId);
    const allServed = partyKots.length > 0 && partyKots.every((k) => (k.id === kotId ? newStatus === "SERVED" : k.status === "SERVED"));
    if (allServed) {
      this.parties = this.parties.map((p) =>
        p.id === kot.partyId && p.status === "FOOD_PENDING"
          ? { ...p, status: "OPEN", lastActivityAt: new Date().toISOString() }
          : p
      );
    }
    this.notifyStateChange("advanceKotStatus");
  }

  cancelKot(kotId: string, reason: string): Kot {
    const kot = this.kots.find((k) => k.id === kotId);
    if (!kot) throw new Error(`KOT ${kotId} not found`);
    if (kot.status === "SERVED") throw new Error("Cannot cancel an already served KOT");

    // Release stock reservations for this order
    const orderReservations = this.stockReservations.filter(
      (r) => r.orderId === kot.orderId && r.status === "RESERVED"
    );
    for (const res of orderReservations) {
      res.status = "RELEASED";
      const ing = this.ingredients.find((i) => i.id === res.ingredientId);
      if (ing) {
        ing.reservedStock = Math.max(0, Number((ing.reservedStock - res.quantity).toFixed(4)));
        ing.availableStock = Math.max(0, Number((ing.physicalStock - ing.reservedStock).toFixed(4)));
      }
    }

    // Cancel items on the order and calculate cancelled subtotal
    let cancelledSubtotal = 0;
    this.orders = this.orders.map((o) => {
      if (o.id === kot.orderId) {
        const updatedItems = o.items.map((it) => {
          cancelledSubtotal += it.totalPrice;
          return {
            ...it,
            isCancelled: true,
            kotStatus: "CANCELLED" as any,
          };
        });
        return {
          ...o,
          status: "CANCELLED" as any,
          items: updatedItems,
          subtotal: 0,
        };
      }
      return o;
    });

    // Deduct cancelled amount from party running subtotal
    this.parties = this.parties.map((p) => {
      if (p.id === kot.partyId) {
        const otherActiveKots = this.kots.filter(
          (k) => k.partyId === kot.partyId && k.id !== kotId && k.status !== "CANCELLED"
        );
        return {
          ...p,
          runningSubtotal: Math.max(0, p.runningSubtotal - cancelledSubtotal),
          status: otherActiveKots.length === 0 ? "OPEN" : p.status,
          lastActivityAt: new Date().toISOString(),
        };
      }
      return p;
    });

    const updatedKot: Kot = {
      ...kot,
      status: "CANCELLED" as any,
    };
    this.kots = this.kots.map((k) => (k.id === kotId ? updatedKot : k));

    this.recordAuditLog("CANCEL_KOT", "KOT", kot.id, reason || "KOT cancelled by kitchen/manager");
    this.recalculateMenuAvailability();
    this.notifyStateChange("cancelKot");
    return updatedKot;
  }

  // --- BILLING & PAYMENT ---

  generateBillForParty(partyId: string, discountPercent = 0): Bill {
    requirePermission(this.currentUser.role, "bill.create");
    const party = this.parties.find((p) => p.id === partyId);
    if (!party) throw new Error(`Party ${partyId} not found`);

    const partyOrders = this.orders.filter((o) => o.partyId === partyId);
    const allItems = partyOrders.flatMap((o) => o.items);

    const taxRatesMap = new Map(this.taxRates.map((t) => [t.id, t]));
    const hasGstin = Boolean(this.settings.profile?.gstin && this.settings.profile.gstin.trim());
    const gstRate = this.settings.billing?.gstRatePercent ?? 5;
    const defaultTaxRate =
      hasGstin && gstRate > 0
        ? this.taxRates[0]
        : this.taxRates.find((t) => t.isTaxExempt || t.totalRate === 0) || {
            id: "tax-exempt",
            name: "Exempt Goods (0%)",
            code: "EXEMPT_0",
            cgstRate: 0,
            sgstRate: 0,
            igstRate: 0,
            vatRate: 0,
            totalRate: 0,
            isTaxInclusive: false,
            isTaxExempt: true,
            effectiveFrom: "2026-01-01",
            isActive: true,
          };

    const bill = generatePartyBill({
      party,
      orderItems: allItems,
      taxRatesMap,
      defaultTaxRate,
      cashierId: this.currentUser.id,
      cashierName: this.currentUser.name,
      discountPercentage: discountPercent,
    });

    this.bills.push(bill);
    this.notifyStateChange("generateBillForParty");
    return bill;
  }

  cancelBill(billId: string, reason: string): Bill {
    requirePermission(this.currentUser.role, "bill.cancel");
    const bill = this.bills.find((b) => b.id === billId);
    if (!bill) throw new Error(`Bill ${billId} not found`);

    const updatedBill: Bill = {
      ...bill,
      status: "CANCELLED",
      cancelledAt: new Date().toISOString(),
      cancelledBy: this.currentUser.name,
      cancelledReason: reason,
    };
    this.bills = this.bills.map((b) => (b.id === billId ? updatedBill : b));

    // Reopen party
    this.parties = this.parties.map((p) =>
      p.id === bill.partyId ? { ...p, status: "OPEN" } : p
    );
    this.tables = this.tables.map((t) => refreshTableOccupancy(t, this.parties));

    this.recordAuditLog("CANCEL_BILL", "BILL", bill.id, reason || "Bill voided by cashier/manager");
    this.notifyStateChange("cancelBill");
    return updatedBill;
  }

  payBill(billId: string, method: any, amount: number, reference?: string): { bill: Bill; isFullyPaid: boolean } {
    requirePermission(this.currentUser.role, "payment.record");
    const bill = this.bills.find((b) => b.id === billId);
    if (!bill) throw new Error(`Bill ${billId} not found`);

    const result = recordBillPayment(
      bill,
      method,
      amount,
      this.currentUser.id,
      this.currentUser.name,
      reference
    );

    this.bills = this.bills.map((b) => (b.id === billId ? result.updatedBill : b));
    this.payments.push(result.payment);

    // Record cash/UPI ledger inflow
    const today = new Date().toISOString().split("T")[0];
    if (method === "CASH") {
      const lastBal = this.cashLedger[0]?.balance ?? 5000;
      this.cashLedger.unshift({
        id: `csh-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        date: today,
        entryType: "SALE",
        description: `Bill ${bill.billNumber} (${bill.partyCode || "Dine-in"})`,
        inflow: amount,
        outflow: 0,
        balance: lastBal + amount,
        referenceId: bill.id,
        timestamp: new Date().toISOString(),
      });
      if (this.printerSettings?.autoKickCashDrawerOnCash) {
        triggerCashDrawerKick();
      }
    } else if (method === "UPI") {
      const lastBal = this.upiLedger[0]?.balance ?? 15000;
      this.upiLedger.unshift({
        id: `upi-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        date: today,
        entryType: "SALE",
        description: `Bill ${bill.billNumber} (${reference || bill.partyCode || "UPI QR"})`,
        inflow: amount,
        outflow: 0,
        balance: lastBal + amount,
        utrReference: reference || bill.id,
        timestamp: new Date().toISOString(),
      });
    }

    if (result.isFullyPaid) {
      // Close party
      this.parties = this.parties.map((p) =>
        p.id === bill.partyId
          ? { ...p, status: "CLOSED", closedAt: new Date().toISOString() }
          : p
      );
      // Refresh table occupancy
      this.tables = this.tables.map((t) => refreshTableOccupancy(t, this.parties));
    }

    this.notifyStateChange("payBill");
    return { bill: result.updatedBill, isFullyPaid: result.isFullyPaid };
  }

  // --- DAY-END Z-REPORT (दिवसाचा हिशोब) ---

  generateDayEndReport(targetDate?: string): DayEndReport {
    const dateStr = targetDate || new Date().toISOString().split("T")[0];
    const billsToday = this.bills.filter((b) => b.createdAt.startsWith(dateStr));
    const settledBills = billsToday.filter((b) => b.status === "PAID");
    const cancelledBills = billsToday.filter((b) => b.status === "CANCELLED");

    const grossSalesSubtotal = settledBills.reduce((sum, b) => sum + b.subtotal, 0);
    const totalDiscountAmount = settledBills.reduce((sum, b) => sum + b.discountAmount, 0);
    const totalPackagingCharges = settledBills.reduce((sum, b) => sum + (b.packagingCharges || 0), 0);
    const netTaxableSales = settledBills.reduce((sum, b) => sum + b.taxableAmount, 0);
    const cgstAmount = settledBills.reduce((sum, b) => sum + b.cgstAmount, 0);
    const sgstAmount = settledBills.reduce((sum, b) => sum + b.sgstAmount, 0);
    const totalTaxAmount = settledBills.reduce((sum, b) => sum + b.totalTaxAmount, 0);
    const roundOffTotal = Number(settledBills.reduce((sum, b) => sum + b.roundOff, 0).toFixed(2));
    const netRevenue = settledBills.reduce((sum, b) => sum + b.grandTotal, 0);

    // Tender collections
    let cash = 0;
    let upi = 0;
    let card = 0;
    let other = 0;

    for (const b of settledBills) {
      for (const p of b.payments) {
        if (p.paymentMethod === "CASH") cash += p.amount;
        else if (p.paymentMethod === "UPI") upi += p.amount;
        else if (p.paymentMethod === "CARD") card += p.amount;
        else other += p.amount;
      }
    }

    // Top Selling Dishes
    const itemMap = new Map<string, { name: string; quantity: number; revenue: number }>();
    for (const b of settledBills) {
      for (const it of b.items) {
        const cur = itemMap.get(it.menuItemId) || { name: it.menuItemName, quantity: 0, revenue: 0 };
        cur.quantity += it.quantity;
        cur.revenue += it.totalPrice;
        itemMap.set(it.menuItemId, cur);
      }
    }

    const topSellingDishes = Array.from(itemMap.entries())
      .map(([menuItemId, data]) => ({
        menuItemId,
        name: data.name,
        quantity: data.quantity,
        revenue: data.revenue,
      }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5);

    const auditDiscrepanciesCount = this.auditLogs.filter(
      (a) => (a.createdAt || "").startsWith(dateStr) && (a.action.includes("OVERRIDE") || a.action.includes("CANCEL"))
    ).length;

    return {
      date: dateStr,
      shiftName: "General Shift (दिवसाची विक्री)",
      generatedAt: new Date().toISOString(),
      generatedByName: this.currentUser.name,
      totalBills: billsToday.length,
      settledBillsCount: settledBills.length,
      cancelledBillsCount: cancelledBills.length,
      grossSalesSubtotal: Number(grossSalesSubtotal.toFixed(2)),
      totalDiscountAmount: Number(totalDiscountAmount.toFixed(2)),
      netTaxableSales: Number(netTaxableSales.toFixed(2)),
      cgstAmount: Number(cgstAmount.toFixed(2)),
      sgstAmount: Number(sgstAmount.toFixed(2)),
      totalTaxAmount: Number(totalTaxAmount.toFixed(2)),
      totalPackagingCharges: Number(totalPackagingCharges.toFixed(2)),
      roundOffTotal,
      netRevenue: Number(netRevenue.toFixed(2)),
      tenders: {
        cash: Number(cash.toFixed(2)),
        upi: Number(upi.toFixed(2)),
        card: Number(card.toFixed(2)),
        other: Number(other.toFixed(2)),
      },
      topSellingDishes,
      auditDiscrepanciesCount,
      // Test compatibility fields:
      reportId: `Z-REP-${dateStr.replace(/-/g, "")}-001`,
      totalBillsSettled: settledBills.length,
      grossSales: Number(grossSalesSubtotal.toFixed(2)),
      taxableSales: Number(netTaxableSales.toFixed(2)),
      cgstTotal: Number(cgstAmount.toFixed(2)),
      sgstTotal: Number(sgstAmount.toFixed(2)),
      topDishes: topSellingDishes.map((d) => ({ name: d.name, qty: d.quantity, revenue: d.revenue })),
      auditDiscrepancyCount: auditDiscrepanciesCount,
      cancelledKotsCount: cancelledBills.length,
    };
  }

  // ── KHANAWAL OPERATIONAL METHODS ──────────────────────────────────

  /**
   * Fast Purchase Entry: Updates stock, price trend history, supplier ledger, and cash/UPI ledger
   */
  recordQuickPurchase(entry: Omit<QuickPurchaseEntry, "id">): QuickPurchaseEntry {
    const newEntry: QuickPurchaseEntry = {
      ...entry,
      id: `pur-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    };
    this.purchases.unshift(newEntry);

    // Update ingredient stock
    if (entry.ingredientId) {
      const ing = this.ingredients.find((i) => i.id === entry.ingredientId);
      if (ing) {
        ing.physicalStock += entry.quantity;
        ing.availableStock += entry.quantity;
        ing.currentCostPerUnit = entry.rate;
        ing.updatedAt = new Date().toISOString();

        // Track price history trend
        const prevPrice = this.priceHistory.find((p) => p.ingredientId === entry.ingredientId);
        if (prevPrice && prevPrice.ratePerUnit !== entry.rate) {
          const pct = Number((((entry.rate - prevPrice.ratePerUnit) / prevPrice.ratePerUnit) * 100).toFixed(1));
          this.priceHistory.unshift({
            id: `ph-${Date.now()}`,
            ingredientId: entry.ingredientId,
            ingredientName: entry.ingredientName,
            supplierId: entry.supplierId,
            supplierName: entry.supplierName,
            date: entry.date,
            ratePerUnit: entry.rate,
            unit: entry.unit,
            previousRate: prevPrice.ratePerUnit,
            percentageChange: pct,
          });
        }
      }
    }

    // Update Supplier ledger
    const sup = this.suppliers.find((s) => s.id === entry.supplierId);
    if (sup) {
      sup.totalPurchased += entry.totalAmount;
      if (entry.paymentStatus === "PAID") {
        sup.totalPaid += entry.totalAmount;
      } else {
        sup.outstandingPayable += entry.totalAmount;
      }
    }

    // Record ledger outflow if paid
    if (entry.paymentStatus === "PAID") {
      if (entry.paymentMethod === "CASH") {
        const lastBal = this.cashLedger[0]?.balance ?? 5000;
        this.cashLedger.unshift({
          id: `csh-${Date.now()}`,
          date: entry.date,
          entryType: "PURCHASE",
          description: `${entry.supplierName} - ${entry.ingredientName} (${entry.quantity} ${entry.unit})`,
          inflow: 0,
          outflow: entry.totalAmount,
          balance: lastBal - entry.totalAmount,
          referenceId: newEntry.id,
          timestamp: new Date().toISOString(),
        });
      } else if (entry.paymentMethod === "UPI") {
        const lastBal = this.upiLedger[0]?.balance ?? 15000;
        this.upiLedger.unshift({
          id: `upi-${Date.now()}`,
          date: entry.date,
          entryType: "EXPENSE",
          description: `${entry.supplierName} - ${entry.ingredientName}`,
          inflow: 0,
          outflow: entry.totalAmount,
          balance: lastBal - entry.totalAmount,
          timestamp: new Date().toISOString(),
        });
      }
    }

    this.recalculateMenuAvailability();
    this.recordAuditLog("RECORD_PURCHASE", "PURCHASE", newEntry.id, `Purchased ${entry.quantity} ${entry.unit} ${entry.ingredientName} from ${entry.supplierName}`);
    this.notifyStateChange("recordQuickPurchase");
    return newEntry;
  }

  /**
   * 1-Tap Repeat Purchase: Clones a past purchase with today's date
   */
  repeatPurchase(purchaseId: string): QuickPurchaseEntry {
    const existing = this.purchases.find((p) => p.id === purchaseId);
    if (!existing) throw new Error(`Purchase ${purchaseId} not found`);

    return this.recordQuickPurchase({
      supplierId: existing.supplierId,
      supplierName: existing.supplierName,
      ingredientId: existing.ingredientId,
      ingredientName: existing.ingredientName,
      quantity: existing.quantity,
      unit: existing.unit,
      rate: existing.rate,
      totalAmount: existing.totalAmount,
      paymentMethod: existing.paymentMethod,
      paymentStatus: "PAID",
      date: new Date().toISOString().split("T")[0],
      notes: `1-Tap Repeat of ${existing.id}`,
    });
  }

  recordStructuredExpense(expense: Omit<ExpenseRecord, "id" | "createdAt">): ExpenseRecord {
    const subcategory = expense.subcategory || expense.item || "Miscellaneous";
    const party = expense.party || expense.paidTo || "General";
    const item = expense.item || subcategory;
    const paidTo = expense.paidTo || party;

    const newExp: ExpenseRecord = {
      ...expense,
      category: expense.category,
      subcategory,
      party,
      item,
      paidTo,
      frequency: expense.frequency || "OCCASIONAL",
      id: `exp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      createdAt: new Date().toISOString(),
    };
    this.expenses.unshift(newExp);
    this.saveStoredExpenses();

    const desc = `[${newExp.category} - ${newExp.subcategory}] to ${newExp.party}`;

    if (expense.paymentMethod === "CASH") {
      const lastBal = this.cashLedger[0]?.balance ?? 5000;
      this.cashLedger.unshift({
        id: `csh-${Date.now()}`,
        date: expense.date,
        entryType: "EXPENSE",
        description: desc,
        inflow: 0,
        outflow: expense.amount,
        balance: lastBal - expense.amount,
        referenceId: newExp.id,
        timestamp: new Date().toISOString(),
      });
    } else if (expense.paymentMethod === "UPI") {
      const lastBal = this.upiLedger[0]?.balance ?? 15000;
      this.upiLedger.unshift({
        id: `upi-${Date.now()}`,
        date: expense.date,
        entryType: "EXPENSE",
        description: desc,
        inflow: 0,
        outflow: expense.amount,
        balance: lastBal - expense.amount,
        timestamp: new Date().toISOString(),
      });
    }

    this.recordAuditLog("RECORD_EXPENSE", "EXPENSE", newExp.id, `Recorded ${newExp.category} expense ₹${newExp.amount} to ${newExp.party}`);
    this.notifyStateChange("recordStructuredExpense");
    return newExp;
  }

  deleteExpense(expenseId: string): void {
    this.expenses = this.expenses.filter((e) => e.id !== expenseId);
    this.saveStoredExpenses();
    this.recordAuditLog("DELETE_EXPENSE", "EXPENSE", expenseId, `Deleted expense record ${expenseId}`);
    this.notifyStateChange("deleteExpense");
  }

  /**
   * Review / Reclassify an Expense (eliminates unclassified transactions)
   */
  markExpenseReviewed(expenseId: string, updatedCategory?: KhanawalExpenseCategory): ExpenseRecord {
    const exp = this.expenses.find((e) => e.id === expenseId);
    if (!exp) throw new Error(`Expense ${expenseId} not found`);

    exp.isReviewed = true;
    if (updatedCategory) {
      exp.category = updatedCategory;
    }
    this.recordAuditLog("REVIEW_EXPENSE", "EXPENSE", expenseId, `Reviewed expense and classified as ${exp.category}`);
    return exp;
  }

  /**
   * Supplier Advance Payment (Accounting Separation: Advance is an asset/outflow, NOT an expense)
   */
  recordSupplierAdvance(advance: Omit<SupplierAdvanceRecord, "id" | "adjustedAmount" | "remainingAdvance">): SupplierAdvanceRecord {
    const newAdv: SupplierAdvanceRecord = {
      ...advance,
      id: `sadv-${Date.now()}`,
      adjustedAmount: 0,
      remainingAdvance: advance.amount,
    };
    this.supplierAdvances.unshift(newAdv);

    const sup = this.suppliers.find((s) => s.id === advance.supplierId);
    if (sup) {
      sup.currentAdvance += advance.amount;
    }

    if (advance.paymentMethod === "CASH") {
      const lastBal = this.cashLedger[0]?.balance ?? 5000;
      this.cashLedger.unshift({
        id: `csh-${Date.now()}`,
        date: advance.date,
        entryType: "SUPPLIER_PAYMENT",
        description: `Supplier Advance: ${advance.supplierName}`,
        inflow: 0,
        outflow: advance.amount,
        balance: lastBal - advance.amount,
        referenceId: newAdv.id,
        timestamp: new Date().toISOString(),
      });
    } else {
      const lastBal = this.upiLedger[0]?.balance ?? 15000;
      this.upiLedger.unshift({
        id: `upi-${Date.now()}`,
        date: advance.date,
        entryType: "EXPENSE",
        description: `Supplier Advance: ${advance.supplierName}`,
        inflow: 0,
        outflow: advance.amount,
        balance: lastBal - advance.amount,
        timestamp: new Date().toISOString(),
      });
    }

    this.recordAuditLog("SUPPLIER_ADVANCE", "SUPPLIER", advance.supplierId, `Paid advance ₹${advance.amount} to ${advance.supplierName}`);
    this.notifyStateChange("recordSupplierAdvance");
    return newAdv;
  }

  /**
   * Settle Supplier Invoice against Advance:
   * Rule: Invoice ₹2,100, Advance ₹2,000 -> Remaining payable ₹100. Never double count!
   */
  settleSupplierInvoice(
    supplierId: string,
    invoiceAmount: number,
    paymentMethod: "CASH" | "UPI" = "CASH",
    notes?: string
  ): { netPaid: number; adjustedFromAdvance: number; record: SupplierPaymentRecord } {
    const sup = this.suppliers.find((s) => s.id === supplierId);
    if (!sup) throw new Error(`Supplier ${supplierId} not found`);

    const availableAdvance = sup.currentAdvance || 0;
    const adjustedFromAdvance = Math.min(availableAdvance, invoiceAmount);
    const netPaid = invoiceAmount - adjustedFromAdvance;

    sup.currentAdvance -= adjustedFromAdvance;
    sup.totalPaid += invoiceAmount;

    const payRecord: SupplierPaymentRecord = {
      id: `spay-${Date.now()}`,
      supplierId,
      supplierName: sup.name,
      amount: netPaid,
      date: new Date().toISOString().split("T")[0],
      paymentMethod,
      invoiceNumber: `INV-${Date.now().toString().slice(-4)}`,
      notes: notes || `Invoice ₹${invoiceAmount} less Advance ₹${adjustedFromAdvance} = Net ₹${netPaid} paid`,
    };
    this.supplierPayments.unshift(payRecord);

    if (netPaid > 0) {
      if (paymentMethod === "CASH") {
        const lastBal = this.cashLedger[0]?.balance ?? 5000;
        this.cashLedger.unshift({
          id: `csh-${Date.now()}`,
          date: payRecord.date,
          entryType: "SUPPLIER_PAYMENT",
          description: `${sup.name} - Invoice Net Settlement (Adv adjusted: ₹${adjustedFromAdvance})`,
          inflow: 0,
          outflow: netPaid,
          balance: lastBal - netPaid,
          referenceId: payRecord.id,
          timestamp: new Date().toISOString(),
        });
      } else {
        const lastBal = this.upiLedger[0]?.balance ?? 15000;
        this.upiLedger.unshift({
          id: `upi-${Date.now()}`,
          date: payRecord.date,
          entryType: "EXPENSE",
          description: `${sup.name} - Invoice Net Settlement (Adv adjusted: ₹${adjustedFromAdvance})`,
          inflow: 0,
          outflow: netPaid,
          balance: lastBal - netPaid,
          timestamp: new Date().toISOString(),
        });
      }
    }

    this.recordAuditLog("SETTLE_SUPPLIER_INVOICE", "SUPPLIER", supplierId, `Settled invoice ₹${invoiceAmount}: ₹${adjustedFromAdvance} from advance, ₹${netPaid} paid via ${paymentMethod}`);
    this.notifyStateChange("settleSupplierInvoice");
    return { netPaid, adjustedFromAdvance, record: payRecord };
  }

  /**
   * Wastage Logger: Directly adjusts physical stock and logs reason code
   */
  recordWastageRecord(wastage: Omit<WastageRecord, "id" | "timestamp" | "approvalStatus">): WastageRecord {
    requirePermission(this.currentUser.role, "inventory.adjust");
    const record: WastageRecord = {
      ...wastage,
      id: `wst-${Date.now()}`,
      approvalStatus: "APPROVED",
      timestamp: new Date().toISOString(),
    };
    this.wastageRecords.unshift(record);

    const ing = this.ingredients.find((i) => i.id === wastage.ingredientId);
    if (ing) {
      ing.physicalStock = Math.max(0, ing.physicalStock - wastage.quantity);
      ing.availableStock = Math.max(0, ing.availableStock - wastage.quantity);
      ing.updatedAt = new Date().toISOString();
    }

    this.recalculateMenuAvailability();
    this.recordAuditLog("RECORD_WASTAGE", "INVENTORY", record.id, `Recorded wastage: ${wastage.quantity} ${wastage.unit} of ${wastage.ingredientName} (${wastage.reason})`);
    this.notifyStateChange("recordWastageRecord");
    return record;
  }

  /**
   * 1-Click "Mark All Present" Staff Attendance
   */
  markAllStaffAttendance(status: AttendanceStatus = "PRESENT"): AttendanceRecord[] {
    const today = new Date().toISOString().split("T")[0];
    const updated: AttendanceRecord[] = [];

    for (const emp of this.employees.filter((e) => e.status === "ACTIVE")) {
      let rec = this.attendance.find((a) => a.employeeId === emp.id && a.date === today);
      if (rec) {
        rec.status = status;
        rec.markedAt = new Date().toISOString();
      } else {
        rec = {
          id: `att-${Date.now()}-${emp.id}`,
          employeeId: emp.id,
          employeeName: emp.name,
          date: today,
          status,
          markedAt: new Date().toISOString(),
        };
        this.attendance.unshift(rec);
      }
      updated.push(rec);
    }

    this.recordAuditLog("STAFF_ATTENDANCE", "STAFF", "ALL", `Marked all active staff as ${status}`);
    return updated;
  }

  /**
   * Updates a single staff attendance record
   */
  updateStaffAttendance(employeeId: string, status: AttendanceStatus): AttendanceRecord {
    const today = new Date().toISOString().split("T")[0];
    const emp = this.employees.find((e) => e.id === employeeId);
    let rec = this.attendance.find((a) => a.employeeId === employeeId && a.date === today);

    if (rec) {
      rec.status = status;
      rec.markedAt = new Date().toISOString();
    } else {
      rec = {
        id: `att-${Date.now()}-${employeeId}`,
        employeeId,
        employeeName: emp?.name || "Staff",
        date: today,
        status,
        markedAt: new Date().toISOString(),
      };
      this.attendance.unshift(rec);
    }
    return rec;
  }

  /**
   * Staff Advance Payment: Draws cash from drawer and logs advance
   */
  recordStaffAdvance(advance: Omit<StaffAdvanceRecord, "id" | "recoveredAmount" | "status">): StaffAdvanceRecord {
    const newAdv: StaffAdvanceRecord = {
      ...advance,
      id: `stf-adv-${Date.now()}`,
      recoveredAmount: 0,
      status: "PENDING",
    };
    this.staffAdvances.unshift(newAdv);

    const lastBal = this.cashLedger[0]?.balance ?? 5000;
    this.cashLedger.unshift({
      id: `csh-${Date.now()}`,
      date: advance.date,
      entryType: "STAFF_PAYMENT",
      description: `Staff Advance: ${advance.employeeName}`,
      inflow: 0,
      outflow: advance.amount,
      balance: lastBal - advance.amount,
      referenceId: newAdv.id,
      timestamp: new Date().toISOString(),
    });

    this.recordAuditLog("STAFF_ADVANCE", "STAFF", advance.employeeId, `Paid staff advance ₹${advance.amount} to ${advance.employeeName}`);
    return newAdv;
  }

  /**
   * Staff Monthly Salary Calculation with Advance Deductions
   */
  calculateStaffSalary(employeeId: string, monthStr: string): SalaryCalculation {
    const emp = this.employees.find((e) => e.id === employeeId);
    if (!emp) throw new Error(`Employee ${employeeId} not found`);

    const daysInMonth = 30;
    const monthAttendance = this.attendance.filter(
      (a) => a.employeeId === employeeId && a.date.startsWith(monthStr)
    );
    const fullDays = monthAttendance.filter((a) => a.status === "PRESENT").length;
    const halfDays = monthAttendance.filter((a) => a.status === "HALF_DAY").length;
    const effectivePresentDays = fullDays + halfDays * 0.5;

    const baseSalary = emp.baseSalary;
    const calculatedGross = Math.round((baseSalary / daysInMonth) * effectivePresentDays);

    const pendingAdvances = this.staffAdvances
      .filter((a) => a.employeeId === employeeId && a.status === "PENDING")
      .reduce((sum, a) => sum + (a.amount - a.recoveredAmount), 0);

    const advanceDeducted = Math.min(pendingAdvances, calculatedGross);
    const netPayable = calculatedGross - advanceDeducted;

    return {
      employeeId,
      employeeName: emp.name,
      month: monthStr,
      presentDays: effectivePresentDays,
      totalDays: daysInMonth,
      baseSalary,
      calculatedGross,
      advancesDeducted: advanceDeducted,
      advanceDeducted,
      payableSalary: netPayable,
      netPayable,
      status: "UNPAID",
    };
  }

  /**
   * Daily Morning Purchase Planner based on live stock & consumption par levels
   */
  generateDailyPurchasePlanner(): DailyPurchaseRecommendation[] {
    const keyIngredients = [
      { id: "ing-chicken", req: 10, costPerUnit: 390 },
      { id: "ing-mutton", req: 8, costPerUnit: 770 },
      { id: "ing-rice", req: 15, costPerUnit: 65 },
      { id: "ing-dal", req: 8, costPerUnit: 140 },
      { id: "ing-bhaji", req: 6, costPerUnit: 60 },
      { id: "ing-chapati", req: 100, costPerUnit: 10 },
      { id: "ing-oil", req: 5, costPerUnit: 160 },
      { id: "ing-dairy", req: 10, costPerUnit: 68 },
      { id: "ing-gas", req: 1, costPerUnit: 1885 },
    ];

    const recommendations: DailyPurchaseRecommendation[] = [];

    for (const item of keyIngredients) {
      const ing = this.ingredients.find((i) => i.id === item.id);
      const currentStock = ing ? ing.physicalStock : 0;
      const needed = Math.max(0, item.req - currentStock);

      let urgency: "CRITICAL" | "HIGH" | "NORMAL" = "NORMAL";
      if (currentStock <= (ing?.criticalLevel || 2)) {
        urgency = "CRITICAL";
      } else if (currentStock <= (ing?.reorderLevel || 5)) {
        urgency = "HIGH";
      }

      recommendations.push({
        ingredientId: item.id,
        ingredientName: ing?.name || item.id,
        localName: ing?.localName,
        unit: ing?.baseUnit || "kg",
        currentStock: Number(currentStock.toFixed(1)),
        expectedDailyRequirement: item.req,
        recommendedPurchaseQty: Number(needed.toFixed(1)),
        estimatedCost: Math.round(needed * item.costPerUnit),
        urgency,
      });
    }

    return recommendations;
  }

  /**
   * 1-Click "CLOSE DAY" Daily Closing Snapshot
   */
  performDailyClosing(params: {
    actualCash: number;
    actualUpi: number;
    checklistItems: Record<string, boolean>;
    notes?: string;
    date?: string;
  }): DailyClosingSnapshot {
    const today = params.date || new Date().toISOString().split("T")[0];
    let report = this.generateDayEndReport(today);

    // If current calendar date has 0 bills, look up the latest active operational date
    if (report.netRevenue === 0 && this.bills.some((b) => b.status === "PAID")) {
      const latestSettledBill = this.bills
        .filter((b) => b.status === "PAID")
        .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""))[0];
      if (latestSettledBill) {
        const seedDate = (latestSettledBill.settledAt || latestSettledBill.createdAt).split("T")[0];
        const seedReport = this.generateDayEndReport(seedDate);
        if (seedReport.netRevenue > 0) {
          report = seedReport;
        }
      }
    }

    const openingCash = 5000;
    const foodPurchases = this.purchases
      .filter((p) => p.date === today && p.paymentMethod === "CASH")
      .reduce((sum, p) => sum + p.totalAmount, 0);

    const otherExpenses = this.expenses
      .filter((e) => e.date === today && e.paymentMethod === "CASH")
      .reduce((sum, e) => sum + e.amount, 0);

    const supplierPayments = this.supplierPayments
      .filter((sp) => sp.date === today && sp.paymentMethod === "CASH")
      .reduce((sum, sp) => sum + sp.amount, 0);

    const staffPayments = this.staffAdvances
      .filter((sa) => sa.date === today)
      .reduce((sum, sa) => sum + sa.amount, 0);

    const expectedCash = openingCash + report.tenders.cash - (foodPurchases + otherExpenses + supplierPayments + staffPayments);
    const cashVariance = params.actualCash - expectedCash;

    const openingUpi = 14250;
    const upiPurchases = this.purchases
      .filter((p) => p.date === today && p.paymentMethod === "UPI")
      .reduce((sum, p) => sum + p.totalAmount, 0);

    const upiExpenses = this.expenses
      .filter((e) => e.date === today && e.paymentMethod === "UPI")
      .reduce((sum, e) => sum + e.amount, 0);

    const expectedUpi = openingUpi + report.tenders.upi - (upiPurchases + upiExpenses);
    const upiVariance = params.actualUpi - expectedUpi;

    // Count thalis sold
    let chickenThalis = 0;
    let muttonThalis = 0;
    const billList = this.bills.filter((b) => b.status === "PAID");
    const billsForThalis = billList.filter((b) => (b.settledAt || b.createdAt).startsWith(today)).length > 0
      ? billList.filter((b) => (b.settledAt || b.createdAt).startsWith(today))
      : billList;

    for (const b of billsForThalis) {
      for (const item of b.items) {
        if (item.menuItemId === "menu-chicken-thali") chickenThalis += item.quantity;
        if (item.menuItemId === "menu-mutton-thali") muttonThalis += item.quantity;
      }
    }

    const snapshot: DailyClosingSnapshot = {
      id: `cls-${today.replace(/-/g, "")}`,
      date: today,
      closedAt: new Date().toISOString(),
      closedBy: this.currentUser.name,
      totalSales: report.netRevenue,
      cashSales: report.tenders.cash,
      upiSales: report.tenders.upi,
      cardSales: report.tenders.card,
      totalThalisSold: chickenThalis + muttonThalis,
      chickenThalisSold: chickenThalis,
      muttonThalisSold: muttonThalis,
      foodPurchases,
      otherExpenses,
      supplierPayments,
      staffPayments,
      openingCash,
      actualCash: params.actualCash,
      actualCashCounted: params.actualCash,
      expectedCash,
      cashVariance,
      openingUpi,
      actualUpi: params.actualUpi,
      actualUpiCounted: params.actualUpi,
      expectedUpi,
      upiVariance,
      checklistConfirmed: Object.values(params.checklistItems).every(Boolean),
      checklistItems: params.checklistItems,
      cashierSigned: true,
      managerSigned: true,
      stockVariances: [],
      notes: params.notes,
    };

    this.dailyClosings.unshift(snapshot);
    this.recordAuditLog("DAILY_CLOSING", "SYSTEM", snapshot.id, `Closed day for ${today}. Total Sales: ₹${report.netRevenue}, Cash Variance: ₹${cashVariance}`);
    this.notifyStateChange("performDailyClosing");
    return snapshot;
  }

  /**
   * Answers the Owner's 5 Core Questions Immediately
   */
  getOwnerSummary() {
    const today = new Date().toISOString().split("T")[0];
    const settledBills = this.bills.filter((b) => b.status === "PAID" && b.settledAt?.startsWith(today));

    let todaysSales = 0;
    let cashSales = 0;
    let upiSales = 0;
    let chickenThalisSold = 0;
    let muttonThalisSold = 0;

    for (const b of settledBills) {
      todaysSales += b.grandTotal;
      for (const p of b.payments) {
        if (p.paymentMethod === "CASH") cashSales += p.amount;
        if (p.paymentMethod === "UPI") upiSales += p.amount;
      }
      for (const item of b.items) {
        if (item.menuItemId === "menu-chicken-thali") chickenThalisSold += item.quantity;
        if (item.menuItemId === "menu-mutton-thali") muttonThalisSold += item.quantity;
      }
    }

    const chickenStock = this.ingredients.find((i) => i.id === "ing-chicken")?.physicalStock || 0;
    const muttonStock = this.ingredients.find((i) => i.id === "ing-mutton")?.physicalStock || 0;
    const cashInDrawer = this.cashLedger[0]?.balance ?? 5000;
    const upiInBank = this.upiLedger[0]?.balance ?? 15000;
    const unreviewedExpensesCount = this.expenses.filter((e) => !e.isReviewed).length;
    const pendingTasksCount = this.khanawalTasks.filter((t) => t.status === "PENDING").length;
    const criticalRemindersCount = this.reminders.filter((r) => !r.isDismissed && r.urgency === "CRITICAL").length;

    return {
      todaysSales: Math.round(todaysSales),
      cashSales: Math.round(cashSales),
      upiSales: Math.round(upiSales),
      cashInDrawer: Math.round(cashInDrawer),
      upiInBank: Math.round(upiInBank),
      chickenStockKg: Number(chickenStock.toFixed(1)),
      muttonStockKg: Number(muttonStock.toFixed(1)),
      thalisSold: chickenThalisSold + muttonThalisSold,
      chickenThalisSold,
      muttonThalisSold,
      unreviewedExpensesCount,
      pendingTasksCount,
      criticalRemindersCount,
    };
  }

  /**
   * Tasks, Equipment & Office Orders Helpers
   */
  addKhanawalTask(task: Omit<KhanawalTask, "id" | "status" | "createdAt">): KhanawalTask {
    const newTask: KhanawalTask = {
      ...task,
      id: `task-${Date.now()}`,
      status: "PENDING",
      createdAt: new Date().toISOString(),
    };
    this.khanawalTasks.unshift(newTask);
    return newTask;
  }

  toggleKhanawalTask(taskId: string): KhanawalTask {
    const task = this.khanawalTasks.find((t) => t.id === taskId);
    if (!task) throw new Error(`Task ${taskId} not found`);
    task.status = task.status === "COMPLETED" ? "PENDING" : "COMPLETED";
    return task;
  }

  createOfficeOrder(order: Omit<OfficeGroupOrder, "id" | "createdAt">): OfficeGroupOrder {
    const newOrd: OfficeGroupOrder = {
      ...order,
      id: `off-ord-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    this.officeOrders.unshift(newOrd);
    return newOrd;
  }

  updateOfficeOrderStatus(orderId: string, status: OfficeGroupOrder["status"]): OfficeGroupOrder {
    const ord = this.officeOrders.find((o) => o.id === orderId);
    if (!ord) throw new Error(`Office Order ${orderId} not found`);
    ord.status = status;
    return ord;
  }

  recordEquipmentRepair(
    equipmentId: string,
    repair: { date: string; description: string; cost: number; vendor: string }
  ): HotelEquipment {
    const eq = this.equipment.find((e) => e.id === equipmentId);
    if (!eq) throw new Error(`Equipment ${equipmentId} not found`);

    eq.repairHistory.unshift(repair);
    eq.totalRepairCost += repair.cost;

    // Log corresponding repair expense automatically
    this.recordStructuredExpense({
      date: repair.date,
      category: "REPAIR",
      item: `${eq.name}: ${repair.description}`,
      amount: repair.cost,
      paidTo: repair.vendor,
      paymentMethod: "CASH",
      notes: `Logged via Hotel Equipment Maintenance`,
      isReviewed: true,
    });

    return eq;
  }

  // ── 22. NOTIFICATION & REMINDER MANAGEMENT ──────────────────────────

  /**
   * Broadcast and persist a real-time operational notification
   */
  addNotification(
    input: Omit<RestaurantNotification, "id" | "createdAt" | "isRead">
  ): RestaurantNotification {
    const newNotif: RestaurantNotification = {
      ...input,
      id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      createdAt: new Date().toISOString(),
      isRead: false,
    };

    // Unshift to place latest notifications first
    this.notifications.unshift(newNotif);

    // Play synthetic chime if audio is enabled
    try {
      playNotificationSound(newNotif.type, !this.soundEnabled);
    } catch {
      // Audio autoplay policy
    }

    // Dispatch browser event for floating toast triggers
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("khanawal-notification", { detail: newNotif })
      );
    }

    return newNotif;
  }

  markNotificationRead(id: string): void {
    const target = this.notifications.find((n) => n.id === id);
    if (target) {
      target.isRead = true;
    }
  }

  markAllNotificationsRead(): void {
    this.notifications.forEach((n) => (n.isRead = true));
  }

  dismissNotification(id: string): void {
    this.notifications = this.notifications.filter((n) => n.id !== id);
  }

  clearAllNotifications(): void {
    this.notifications = [];
  }

  toggleSound(enabled?: boolean): boolean {
    if (typeof enabled === "boolean") {
      this.soundEnabled = enabled;
    } else {
      this.soundEnabled = !this.soundEnabled;
    }
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("khanawal_sound_enabled", String(this.soundEnabled));
      } catch {}
    }
    return this.soundEnabled;
  }

  /**
   * Create a new Khanawal operational reminder
   */
  createReminder(
    input: Omit<KhanawalReminder, "id" | "isCompleted">
  ): KhanawalReminder {
    const newReminder: KhanawalReminder = {
      ...input,
      id: `rem-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      isCompleted: false,
      isDismissed: false,
    };

    this.reminders.unshift(newReminder);

    // Auto-generate notification if high or critical urgency
    if (newReminder.urgency === "CRITICAL" || newReminder.urgency === "HIGH") {
      this.addNotification({
        type: "REMINDER_DUE",
        title: `Reminder: ${newReminder.title}`,
        message: newReminder.message,
        category: "MAINTENANCE",
        urgency: newReminder.urgency,
        targetRoles: newReminder.targetRole && newReminder.targetRole !== "ALL"
          ? [newReminder.targetRole as any]
          : ["ADMIN", "MANAGER", "CHEF", "WAITER", "CASHIER"],
        actionUrl: "/reminders",
        actionLabel: "View Reminder",
        metadata: { reminderId: newReminder.id },
      });
    }

    return newReminder;
  }

  completeReminder(id: string): void {
    const rem = this.reminders.find((r) => r.id === id);
    if (rem) {
      rem.isCompleted = true;
      rem.completedAt = new Date().toISOString();
      // Dismiss any corresponding notification
      this.notifications = this.notifications.filter(
        (n) => n.metadata?.reminderId !== id
      );
    }
  }

  snoozeReminder(id: string, minutes: number = 30): void {
    const rem = this.reminders.find((r) => r.id === id);
    if (rem) {
      rem.snoozedUntil = new Date(Date.now() + minutes * 60 * 1000).toISOString();
      rem.isCompleted = false;
      // Mark active notification read
      this.notifications.forEach((n) => {
        if (n.metadata?.reminderId === id) n.isRead = true;
      });
    }
  }

  dismissReminder(id: string): void {
    const rem = this.reminders.find((r) => r.id === id);
    if (rem) {
      rem.isDismissed = true;
    }
  }

  deleteReminder(id: string): void {
    this.reminders = this.reminders.filter((r) => r.id !== id);
    this.notifications = this.notifications.filter(
      (n) => n.metadata?.reminderId !== id
    );
  }

  /**
   * Real-time operational audit evaluator
   * Inspects floor, kitchen, billing, and inventory to trigger live alerts
   */
  evaluateLiveOperationalAlerts(): void {
    const now = Date.now();

    // 1. Bill Requested on Floor (WAITING_FOR_BILL)
    this.parties.forEach((p) => {
      if (p.status === "WAITING_FOR_BILL") {
        const table = this.tables.find((t) => t.id === p.tableId);
        const tableNum = table ? table.tableNumber : 1;
        const exists = this.notifications.some(
          (n) =>
            n.type === "BILL_REQUESTED" &&
            n.metadata?.partyId === p.id &&
            !n.isRead
        );
        if (!exists) {
          this.addNotification({
            type: "BILL_REQUESTED",
            title: `Table ${tableNum} Requested Bill 🔥`,
            message: `${p.partyCode} (${p.customerName || "Walk-in"}) is ready for billing. Subtotal: ₹${p.runningSubtotal}.`,
            category: "BILLING",
            urgency: "HIGH",
            targetRoles: ["CASHIER", "ADMIN", "MANAGER"],
            actionUrl: "/billing",
            actionLabel: "Settle Bill",
            metadata: { tableNumber: tableNum, partyId: p.id, amount: p.runningSubtotal },
          });
        }
      }
    });

    // 2. KOT Delayed Alert (> 20 mins in NEW / PREPARING)
    this.kots.forEach((k) => {
      if (k.status === "NEW" || k.status === "PREPARING") {
        const kotAgeMs = now - new Date(k.createdAt).getTime();
        const delayThresholdMs = 20 * 60 * 1000;
        if (kotAgeMs > delayThresholdMs) {
          const exists = this.notifications.some(
            (n) =>
              n.type === "KOT_DELAYED" &&
              n.metadata?.kotId === k.id &&
              !n.isRead
          );
          if (!exists) {
            this.addNotification({
              type: "KOT_DELAYED",
              title: `Delayed KOT #${k.kotNumber} (Table ${k.tableNumber})`,
              message: `Order for Table ${k.tableNumber} in prep for > 20 mins. Station: ${k.stationCode || "Kitchen"}.`,
              category: "KITCHEN",
              urgency: "CRITICAL",
              targetRoles: ["CHEF", "MANAGER", "ADMIN", "WAITER"],
              actionUrl: "/kitchen",
              actionLabel: "View KDS",
              metadata: { tableNumber: k.tableNumber, kotId: k.id, kotNumber: k.kotNumber },
            });
          }
        }
      }
    });

    // 3. Low Stock Ingredient Monitor
    if (this.ingredients) {
      this.ingredients.forEach((item) => {
        if (item.physicalStock <= item.reorderLevel) {
          const exists = this.notifications.some(
            (n) =>
              n.type === "LOW_STOCK" &&
              n.metadata?.menuItemId === item.id &&
              !n.isRead
          );
          if (!exists) {
            this.addNotification({
              type: "LOW_STOCK",
              title: `Low Stock: ${item.name}`,
              message: `Physical stock is ${item.physicalStock} ${item.baseUnit} (Reorder level: ${item.reorderLevel} ${item.baseUnit}). Immediate purchase recommended.`,
              category: "INVENTORY",
              urgency: "HIGH",
              targetRoles: ["ADMIN", "MANAGER", "CHEF"],
              actionUrl: "/purchases",
              actionLabel: "Quick Purchase",
              metadata: { menuItemId: item.id },
            });
          }
        }
      });
    }

    // 4. Due Reminders Monitor
    this.reminders.forEach((r) => {
      if (!r.isCompleted && !r.isDismissed && r.dueDate) {
        const isSnoozed = r.snoozedUntil && new Date(r.snoozedUntil).getTime() > now;
        const isDue = new Date(r.dueDate).getTime() <= now;
        if (isDue && !isSnoozed) {
          const exists = this.notifications.some(
            (n) =>
              n.type === "REMINDER_DUE" &&
              n.metadata?.reminderId === r.id &&
              !n.isRead
          );
          if (!exists) {
            this.addNotification({
              type: "REMINDER_DUE",
              title: `Task Due: ${r.title}`,
              message: r.message,
              category: "MAINTENANCE",
              urgency: r.urgency,
              targetRoles: r.targetRole && r.targetRole !== "ALL"
                ? [r.targetRole as any]
                : ["ADMIN", "MANAGER", "CHEF", "WAITER", "CASHIER"],
              actionUrl: "/reminders",
              actionLabel: "Open Reminders",
              metadata: { reminderId: r.id },
            });
          }
        }
      }
    });
  }
}

// Global Singleton for in-app client state
export const globalRestaurantStore = new RestaurantStore();

