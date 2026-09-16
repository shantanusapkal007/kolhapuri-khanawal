import { describe, it, expect, beforeEach } from "vitest";
import fs from "fs";
import path from "path";
import { globalRestaurantStore } from "@/lib/store/restaurant-store";

describe("PWA & Authentication & Simplified Order Taking", () => {
  beforeEach(() => {
    // Reset store before each test
    globalRestaurantStore.seedInitialState();
  });

  describe("1. PWA Manifest & Icons", () => {
    it("should have a valid and complete manifest.json", () => {
      const manifestPath = path.join(process.cwd(), "public", "manifest.json");
      expect(fs.existsSync(manifestPath)).toBe(true);

      const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
      expect(manifest.name).toContain("कोल्हापुरी खानावळ");
      expect(manifest.short_name).toBe("खानावळ POS");
      expect(manifest.display).toBe("standalone");
      expect(manifest.start_url).toBe("/dashboard");
      expect(manifest.theme_color).toBe("#991B1B");
      expect(["#F9F7F4", "#0F172A"]).toContain(manifest.background_color);
      expect(manifest.icons).toBeInstanceOf(Array);
      expect(manifest.icons.length).toBeGreaterThanOrEqual(4);

      // Check standard and maskable icons
      const has192 = manifest.icons.some((i: any) => i.sizes === "192x192" && i.purpose === "any");
      const has512 = manifest.icons.some((i: any) => i.sizes === "512x512" && i.purpose === "any");
      const hasMaskable = manifest.icons.some((i: any) => i.purpose === "maskable");
      expect(has192).toBe(true);
      expect(has512).toBe(true);
      expect(hasMaskable).toBe(true);

      // Check shortcuts
      expect(manifest.shortcuts).toBeInstanceOf(Array);
      expect(manifest.shortcuts.length).toBeGreaterThanOrEqual(3);
    });

    it("should have generated all required icon files in public/", () => {
      const iconPaths = [
        path.join(process.cwd(), "public", "icons", "icon-192x192.png"),
        path.join(process.cwd(), "public", "icons", "icon-512x512.png"),
        path.join(process.cwd(), "public", "icons", "icon-maskable-192x192.png"),
        path.join(process.cwd(), "public", "icons", "icon-maskable-512x512.png"),
        path.join(process.cwd(), "public", "icons", "apple-touch-icon.png"),
        path.join(process.cwd(), "public", "apple-touch-icon.png"),
      ];

      for (const p of iconPaths) {
        expect(fs.existsSync(p)).toBe(true);
        const stat = fs.statSync(p);
        expect(stat.size).toBeGreaterThan(500); // Valid non-empty PNG
      }
    });

    it("should have a production service worker in public/sw.js", () => {
      const swPath = path.join(process.cwd(), "public", "sw.js");
      expect(fs.existsSync(swPath)).toBe(true);

      const swContent = fs.readFileSync(swPath, "utf-8");
      expect(swContent).toContain("CACHE_NAME");
      expect(swContent).toContain("addEventListener(\"install\"");
      expect(swContent).toContain("addEventListener(\"activate\"");
      expect(swContent).toContain("addEventListener(\"fetch\"");
      expect(swContent).toContain("skipWaiting()");
      expect(swContent).toContain("clients.claim()");
    });
  });

  describe("2. Authentication & Credential Creation Login", () => {
    it("should login with built-in admin credentials", () => {
      const store = globalRestaurantStore;
      const res = store.loginUser("admin", "1234");
      expect(res.success).toBe(true);
      expect(res.user?.role).toBe("OWNER");
      expect(store.currentUser.role).toBe("OWNER");

      // Verify admin with password admin123
      const resPass = store.loginUser("admin", "admin123");
      expect(resPass.success).toBe(true);
      expect(resPass.user?.role).toBe("OWNER");
    });

    it("should login with built-in manager, cashier, and kitchen credentials", () => {
      const store = globalRestaurantStore;

      const resManager = store.loginUser("manager", "1234");
      expect(resManager.success).toBe(true);
      expect(resManager.user?.role).toBe("MANAGER");

      const resCashier = store.loginUser("cashier", "1234");
      expect(resCashier.success).toBe(true);
      expect(resCashier.user?.role).toBe("CASHIER");

      const resChef = store.loginUser("chef", "1234");
      expect(resChef.success).toBe(true);
      expect(resChef.user?.role).toBe("KITCHEN");
    });

    it("should reject invalid credentials with descriptive error", () => {
      const store = globalRestaurantStore;
      const res = store.loginUser("admin", "wrongpin");
      expect(res.success).toBe(false);
      expect(res.error).toBeDefined();
    });

    it("must login properly when new waiter credentials are created", () => {
      const store = globalRestaurantStore;

      // 1. Create brand new waiter credential
      const newWaiter = store.createWaiterCredential({
        name: "Santosh Kadam",
        username: "santosh",
        pin: "5566",
        phone: "9822001122",
        isActive: true,
      });

      expect(newWaiter.id).toBeDefined();
      expect(newWaiter.username).toBe("santosh");

      // 2. Login immediately with newly created username & PIN
      const loginRes = store.loginUser("santosh", "5566");
      expect(loginRes.success).toBe(true);
      expect(loginRes.user).toBeDefined();
      expect(loginRes.user?.role).toBe("WAITER");
      expect(loginRes.user?.name).toContain("Santosh Kadam");
      expect(store.currentUser.role).toBe("WAITER");

      // 3. Login using direct 4-digit PIN
      const pinLoginRes = store.loginUser("5566", "");
      expect(pinLoginRes.success).toBe(true);
      expect(pinLoginRes.user?.name).toContain("Santosh Kadam");
    });
  });

  describe("3. Simplified Order Taking (No Seat Clutter)", () => {
    it("should seat a table by simply specifying guest count and place KOT without seats", () => {
      const store = globalRestaurantStore;

      // 1. Create party asking ONLY for table and guest count
      const party = store.createPartyAtTable(3, 4);
      expect(party.tableNumber).toBe(3);
      expect(party.guestCount).toBe(4);
      expect(party.status).toBe("OPEN");

      // 2. Select a Thali with explicit bread choice
      const chickenThali = store.menuItems.find((m) => m.name.includes("Chicken Thali"));
      expect(chickenThali).toBeDefined();

      const orderItems = [
        {
          menuItemId: chickenThali!.id,
          quantity: 2,
          breadOption: "JWARI_BHAKRI" as const,
        },
        {
          menuItemId: chickenThali!.id,
          quantity: 2,
          breadOption: "BAJRI_BHAKRI" as const,
        },
      ];

      // 3. Place order without custom seat numbers
      const result = store.placeOrder(party.id, orderItems as any, false);
      expect(result.order).toBeDefined();
      expect(result.kot).toBeDefined();
      expect(result.kot.items.length).toBe(2);

      // Verify bread options on KOT items
      expect(result.kot.items[0].breadOption).toBe("JWARI_BHAKRI");
      expect(result.kot.items[1].breadOption).toBe("BAJRI_BHAKRI");

      // Table status updated
      const table = store.tables.find((t) => t.tableNumber === 3);
      expect(table?.status).toBe("OCCUPIED");
      const updatedParty = store.parties.find((p) => p.id === party.id);
      expect(updatedParty?.runningSubtotal).toBeGreaterThan(0);
    });
  });
});
