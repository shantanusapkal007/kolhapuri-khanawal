import { describe, it, expect, beforeEach } from "vitest";
import { RestaurantStore } from "@/lib/store/restaurant-store";

describe("Khanawal Operational Notification & Reminder System", () => {
  let store: RestaurantStore;

  beforeEach(() => {
    store = new RestaurantStore();
  });

  describe("1. Real-Time Operational Notifications", () => {
    it("creates a notification with unique ID, timestamp, and unread status", () => {
      const initialCount = store.notifications.length;
      const notif = store.addNotification({
        type: "KOT_READY",
        title: "Table 4 Ready",
        message: "Chicken Thali ready for pickup",
        category: "SERVICE",
        urgency: "HIGH",
        targetRoles: ["WAITER"],
        actionUrl: "/waiter",
        actionLabel: "View Table",
      });

      expect(notif.id).toBeDefined();
      expect(notif.isRead).toBe(false);
      expect(notif.createdAt).toBeDefined();
      expect(store.notifications.length).toBe(initialCount + 1);
      expect(store.notifications[0].id).toBe(notif.id);
    });

    it("marks an individual notification as read", () => {
      const notif = store.addNotification({
        type: "BILL_REQUESTED",
        title: "Bill Requested",
        message: "Table 2 requested check",
        category: "BILLING",
        urgency: "HIGH",
        targetRoles: ["CASHIER"],
      });

      expect(notif.isRead).toBe(false);
      store.markNotificationRead(notif.id);

      const found = store.notifications.find((n) => n.id === notif.id);
      expect(found?.isRead).toBe(true);
    });

    it("marks all notifications as read at once", () => {
      store.addNotification({
        type: "LOW_STOCK",
        title: "Low Mutton",
        message: "1.5 kg remaining",
        category: "INVENTORY",
        urgency: "CRITICAL",
        targetRoles: ["ADMIN"],
      });

      expect(store.notifications.some((n) => !n.isRead)).toBe(true);

      store.markAllNotificationsRead();
      expect(store.notifications.every((n) => n.isRead)).toBe(true);
    });

    it("dismisses an individual notification", () => {
      const notif = store.addNotification({
        type: "SYSTEM",
        title: "System Test",
        message: "Test message",
        category: "ADMIN",
        urgency: "LOW",
        targetRoles: ["ADMIN"],
      });

      const countBefore = store.notifications.length;
      store.dismissNotification(notif.id);
      expect(store.notifications.length).toBe(countBefore - 1);
      expect(store.notifications.find((n) => n.id === notif.id)).toBeUndefined();
    });

    it("toggles audio chime setting", () => {
      expect(store.soundEnabled).toBe(true);
      store.toggleSound(false);
      expect(store.soundEnabled).toBe(false);
      store.toggleSound(true);
      expect(store.soundEnabled).toBe(true);
    });
  });

  describe("2. Intelligent Khanawal Reminders Management", () => {
    it("creates a custom reminder and auto-generates high urgency notification", () => {
      const initialRemCount = store.reminders.length;
      const initialNotifCount = store.notifications.length;

      const reminder = store.createReminder({
        title: "Gas Cylinder B Valve Check",
        message: "Inspect valve gasket and manifold pressure gauge",
        type: "GAS_REFILL",
        category: "SAFETY",
        urgency: "CRITICAL",
        targetRole: "ADMIN",
        dueDate: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
        recurrence: "DAILY",
        isDismissed: false,
      });

      expect(reminder.id).toBeDefined();
      expect(reminder.isCompleted).toBe(false);
      expect(store.reminders.length).toBe(initialRemCount + 1);

      // Critical reminder triggers an operational notification immediately
      expect(store.notifications.length).toBe(initialNotifCount + 1);
      expect(store.notifications[0].type).toBe("REMINDER_DUE");
      expect(store.notifications[0].title).toContain("Gas Cylinder B");
    });

    it("completes a reminder and cleans up its notification", () => {
      const reminder = store.createReminder({
        title: "Check Ice Machine Filter",
        message: "Clean sediment mesh",
        type: "CLEANING",
        category: "OPERATIONS",
        urgency: "HIGH",
        isDismissed: false,
      });

      expect(store.notifications.some((n) => n.metadata?.reminderId === reminder.id)).toBe(true);

      store.completeReminder(reminder.id);

      const foundRem = store.reminders.find((r) => r.id === reminder.id);
      expect(foundRem?.isCompleted).toBe(true);
      expect(foundRem?.completedAt).toBeDefined();

      // Corresponding notification should be cleaned up
      expect(store.notifications.some((n) => n.metadata?.reminderId === reminder.id)).toBe(false);
    });

    it("snoozes a reminder for a designated duration", () => {
      const reminder = store.createReminder({
        title: "Call Poultry Vendor",
        message: "Confirm evening chicken delivery",
        type: "LOW_STOCK",
        category: "INVENTORY",
        urgency: "MEDIUM",
        dueDate: new Date().toISOString(),
        isDismissed: false,
      });

      store.snoozeReminder(reminder.id, 45);

      const updated = store.reminders.find((r) => r.id === reminder.id);
      expect(updated?.snoozedUntil).toBeDefined();
      const snoozedMs = new Date(updated!.snoozedUntil!).getTime();
      expect(snoozedMs).toBeGreaterThan(Date.now() + 40 * 60 * 1000);
    });

    it("deletes a reminder completely", () => {
      const reminder = store.createReminder({
        title: "One-off Task",
        message: "Temporary reminder",
        type: "PENDING_TASK",
        category: "OPERATIONS",
        urgency: "LOW",
        isDismissed: false,
      });

      store.deleteReminder(reminder.id);
      expect(store.reminders.find((r) => r.id === reminder.id)).toBeUndefined();
    });
  });

  describe("3. Real-Time Operational Evaluator", () => {
    it("detects tables waiting for bill and generates BILL_REQUESTED alert", () => {
      // Find an active party and set status to WAITING_FOR_BILL
      const activeParty = store.parties.find((p) => p.status !== "CLOSED" && p.status !== "CANCELLED");
      if (activeParty) {
        activeParty.status = "WAITING_FOR_BILL";
        activeParty.runningSubtotal = 750;

        store.evaluateLiveOperationalAlerts();

        const billAlert = store.notifications.find(
          (n) => n.type === "BILL_REQUESTED" && n.metadata?.partyId === activeParty.id
        );
        expect(billAlert).toBeDefined();
        expect(billAlert?.urgency).toBe("HIGH");
        expect(billAlert?.message).toContain("₹750");
      }
    });

    it("detects low stock ingredients below par threshold", () => {
      // Set an inventory item to 1.0kg when reorder level is 5.0kg
      const chicken = store.ingredients.find((i) => i.name.toLowerCase().includes("chicken"));
      if (chicken) {
        chicken.physicalStock = 1.0;
        chicken.reorderLevel = 5.0;

        store.evaluateLiveOperationalAlerts();

        const stockAlert = store.notifications.find(
          (n) => n.type === "LOW_STOCK" && n.metadata?.menuItemId === chicken.id
        );
        expect(stockAlert).toBeDefined();
        expect(stockAlert?.title).toContain(chicken.name);
      }
    });

    it("detects delayed KOTs in kitchen preparation over 20 minutes", () => {
      // Create a simulated old KOT
      const oldKot = {
        id: "kot-delayed-test-1",
        kotNumber: "KOT-999",
        orderId: "ord-test-1",
        partyId: "party-test-1",
        partyCode: "P-99",
        tableNumber: 3,
        waiterId: "waiter-1",
        waiterName: "Suresh",
        status: "PREPARING" as const,
        stationCode: "THALI_SECTION" as const,
        guestCount: 2,
        items: [],
        elapsedSeconds: 1500,
        urgencyLevel: "URGENT" as const,
        createdAt: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
      };
      store.kots.push(oldKot);

      store.evaluateLiveOperationalAlerts();

      const delayedAlert = store.notifications.find(
        (n) => n.type === "KOT_DELAYED" && n.metadata?.kotId === oldKot.id
      );
      expect(delayedAlert).toBeDefined();
      expect(delayedAlert?.urgency).toBe("CRITICAL");
      expect(delayedAlert?.title).toContain("Delayed KOT #KOT-999");
    });
  });
});
