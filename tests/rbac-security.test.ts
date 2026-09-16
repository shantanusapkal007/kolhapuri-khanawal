import { describe, it, expect } from "vitest";
import { hasPermission, requirePermission } from "@/lib/auth/rbac";
import { RestaurantStore } from "@/lib/store/restaurant-store";

describe("Granular RBAC Security & Role Authorization Matrix", () => {
  it("WAITER can create orders, send KOT, and print/create bill, but CANNOT view costs, edit recipes, or cancel bills", () => {
    expect(hasPermission("WAITER", "orders.create")).toBe(true);
    expect(hasPermission("WAITER", "kot.create")).toBe(true);
    expect(hasPermission("WAITER", "bill.create")).toBe(true);
    expect(hasPermission("WAITER", "party.transfer")).toBe(true);

    // Strictly Denied
    expect(hasPermission("WAITER", "inventory.cost_view")).toBe(false);
    expect(hasPermission("WAITER", "recipe.edit")).toBe(false);
    expect(hasPermission("WAITER", "bill.cancel")).toBe(false);
    expect(hasPermission("WAITER", "bill.discount")).toBe(false);
    expect(hasPermission("WAITER", "inventory.adjust")).toBe(false);
    expect(hasPermission("WAITER", "reports.financial")).toBe(false);

    expect(() => {
      requirePermission("WAITER", "inventory.cost_view");
    }).toThrow(/Access Denied/i);
  });

  it("KITCHEN can update KOT status and view recipes, but CANNOT manage bills or view financial reports", () => {
    expect(hasPermission("KITCHEN", "kot.status_update")).toBe(true);
    expect(hasPermission("KITCHEN", "recipe.view")).toBe(true);
    expect(hasPermission("KITCHEN", "bill.create")).toBe(false);
    expect(hasPermission("KITCHEN", "reports.financial")).toBe(false);
  });

  it("CASHIER can generate bills and record payments, but CANNOT edit recipes or adjust inventory", () => {
    expect(hasPermission("CASHIER", "bill.create")).toBe(true);
    expect(hasPermission("CASHIER", "payment.record")).toBe(true);
    expect(hasPermission("CASHIER", "recipe.edit")).toBe(false);
    expect(hasPermission("CASHIER", "inventory.adjust")).toBe(false);
  });

  it("OWNER and MANAGER have comprehensive operational and override controls", () => {
    expect(hasPermission("OWNER", "reports.financial")).toBe(true);
    expect(hasPermission("OWNER", "override.negative_stock")).toBe(true);
    expect(hasPermission("MANAGER", "override.negative_stock")).toBe(true);
  });

  it("RestaurantStore supports creating waiter credentials and PIN-based login", () => {
    const store = new RestaurantStore();

    const initialCount = store.waiterCredentials.length;
    const newWaiter = store.createWaiterCredential({
      name: "Suresh Patil",
      username: "suresh_patil",
      pin: "3333",
      phone: "+91 98888 77777",
      isActive: true,
    });

    expect(newWaiter.id).toBeDefined();
    expect(newWaiter.pin).toBe("3333");
    expect(store.waiterCredentials.length).toBe(initialCount + 1);

    // Test Login with valid PIN
    const loginResult = store.loginWithWaiterPin("3333");
    expect(loginResult.success).toBe(true);
    expect(loginResult.waiter?.username).toBe("suresh_patil");
    expect(store.currentUser.role).toBe("WAITER");
    expect(store.currentUser.name).toContain("Suresh Patil");

    // Attempting invalid PIN
    const invalidResult = store.loginWithWaiterPin("9999");
    expect(invalidResult.success).toBe(false);
    expect(invalidResult.waiter).toBeUndefined();

    // Verify Waiter is restricted in store role
    expect(hasPermission(store.currentUser.role, "orders.create")).toBe(true);
    expect(hasPermission(store.currentUser.role, "bill.create")).toBe(true);
    expect(hasPermission(store.currentUser.role, "kot.create")).toBe(true);
    expect(hasPermission(store.currentUser.role, "reports.financial")).toBe(false);
    expect(hasPermission(store.currentUser.role, "inventory.cost_view")).toBe(false);

    // Clean up created waiter
    store.deleteWaiterCredential(newWaiter.id);
    expect(store.waiterCredentials.some((w: any) => w.id === newWaiter.id)).toBe(false);

    // Reset to Owner
    store.setCurrentUserRole("OWNER");
    expect(store.currentUser.role).toBe("OWNER");
  });

  it("New granular permissions are enforced correctly across all roles", () => {
    // 1. menu.view & menu.edit
    expect(hasPermission("OWNER", "menu.view")).toBe(true);
    expect(hasPermission("OWNER", "menu.edit")).toBe(true);
    expect(hasPermission("MANAGER", "menu.edit")).toBe(true);
    expect(hasPermission("CASHIER", "menu.view")).toBe(true);
    expect(hasPermission("CASHIER", "menu.edit")).toBe(false);
    expect(hasPermission("WAITER", "menu.view")).toBe(true);
    expect(hasPermission("WAITER", "menu.edit")).toBe(false);
    expect(hasPermission("KITCHEN", "menu.view")).toBe(true);
    expect(hasPermission("KITCHEN", "menu.edit")).toBe(false);

    // 2. cash_upi.reconcile
    expect(hasPermission("OWNER", "cash_upi.reconcile")).toBe(true);
    expect(hasPermission("MANAGER", "cash_upi.reconcile")).toBe(true);
    expect(hasPermission("CASHIER", "cash_upi.reconcile")).toBe(true);
    expect(hasPermission("WAITER", "cash_upi.reconcile")).toBe(false);
    expect(hasPermission("KITCHEN", "cash_upi.reconcile")).toBe(false);

    // 3. tasks.manage & reminders.manage
    expect(hasPermission("OWNER", "tasks.manage")).toBe(true);
    expect(hasPermission("OWNER", "reminders.manage")).toBe(true);
    expect(hasPermission("MANAGER", "tasks.manage")).toBe(true);
    expect(hasPermission("CASHIER", "tasks.manage")).toBe(false);
    expect(hasPermission("WAITER", "tasks.manage")).toBe(false);
    expect(hasPermission("KITCHEN", "tasks.manage")).toBe(false);

    // 4. office_orders.manage
    expect(hasPermission("OWNER", "office_orders.manage")).toBe(true);
    expect(hasPermission("MANAGER", "office_orders.manage")).toBe(true);
    expect(hasPermission("CASHIER", "office_orders.manage")).toBe(true);
    expect(hasPermission("WAITER", "office_orders.manage")).toBe(false);
    expect(hasPermission("KITCHEN", "office_orders.manage")).toBe(false);
  });

  it("Logout sets user to unauthenticated guest state", () => {
    const store = new RestaurantStore();
    store.setCurrentUserRole("OWNER");
    expect(store.currentUser.isActive).toBe(true);

    store.logout();
    expect(store.currentUser.id).toBe("guest");
    expect(store.currentUser.isActive).toBe(false);
  });
});
