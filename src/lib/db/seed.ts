/**
 * Authoritative Initial Database Seed
 * Populates tables, users with scrypt hashed PINs, 21 categories, 190 menu items, recipes & settings
 */

import { DatabaseSync } from "node:sqlite";
import { hashPassword } from "./auth-service";
import { initialKhanawalCategories, initialKhanawalMenuItems } from "@/lib/store/kolhapuri-menu-data";
import { KHANAWAL_TABLE_CONFIGS, DEFAULT_RESTAURANT_SETTINGS } from "@/lib/store/restaurant-store";

export function seedDatabaseIfEmpty(db: DatabaseSync): void {
  const userCount = db.prepare("SELECT COUNT(*) as count FROM app_users").get() as { count: number };
  if (userCount && userCount.count > 0) {
    return; // Already seeded
  }

  const now = new Date().toISOString();

  // 1. Seed Core Staff & Waiter Users with Securely Hashed PINs
  const seedUsers = [
    { id: "u-owner-01", username: "admin", name: "Shantanu (Owner)", role: "OWNER", pin: "1234" },
    { id: "u-owner-02", username: "owner", name: "Suresh Rao (Owner)", role: "OWNER", pin: "1234" },
    { id: "u-mgr-01", username: "manager", name: "Vikram Patil", role: "MANAGER", pin: "1234" },
    { id: "u-csh-01", username: "cashier", name: "Priya Kulkarni", role: "CASHIER", pin: "1234" },
    { id: "u-ktc-01", username: "chef", name: "Suresh Maharaj", role: "KITCHEN", pin: "1234" },
    { id: "u-wtr-01", username: "rahul", name: "Rahul Shinde", role: "WAITER", pin: "1111" },
    { id: "u-wtr-02", username: "nitin", name: "Nitin Jadhav", role: "WAITER", pin: "2222" },
  ];

  const insertUser = db.prepare(`
    INSERT INTO app_users (id, username, name, role, pin_salt, pin_hash, is_active, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)
  `);

  for (const u of seedUsers) {
    const { salt, hash } = hashPassword(u.pin);
    insertUser.run(u.id, u.username, u.name, u.role, salt, hash, now, now);
  }

  // 2. Seed 11 Physical Tables: Section A (A1..A3), Section B (B1..B4), Section C (C1..C4)
  const insertTable = db.prepare(`
    INSERT INTO dining_tables (id, table_number, name, min_capacity, max_capacity, section, status, updated_at)
    VALUES (?, ?, ?, 1, 4, ?, 'AVAILABLE', ?)
  `);

  for (const cfg of KHANAWAL_TABLE_CONFIGS) {
    insertTable.run(`tbl-${cfg.tableNumber}`, cfg.tableNumber, cfg.name, cfg.section, now);
  }

  // 3. Seed 21 Menu Categories
  const insertCat = db.prepare(`
    INSERT INTO menu_categories (id, name, local_name, code, display_order, icon_name, is_active)
    VALUES (?, ?, ?, ?, ?, ?, 1)
  `);

  for (const cat of initialKhanawalCategories) {
    insertCat.run(cat.id, cat.name, cat.localName || cat.name, cat.code, cat.displayOrder, cat.iconName || null);
  }

  // 4. Seed 190 Authentic Menu Items (including Water Bottles)
  const insertItem = db.prepare(`
    INSERT INTO menu_items (
      id, category_id, category_name, name, local_name, code, description,
      selling_price, cost_price, is_veg, is_thali, station_code, tax_category_id,
      gst_rate, portion_availability, stock_status, is_available, is_daily_special,
      preparation_time_minutes, display_order, variants_json, is_active
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, 1)
  `);

  for (const it of initialKhanawalMenuItems) {
    insertItem.run(
      it.id,
      it.categoryId,
      it.categoryName || "Special",
      it.name,
      it.localName || it.name,
      it.code || null,
      it.description || null,
      it.sellingPrice,
      it.price || it.sellingPrice,
      it.isVeg ? 1 : 0,
      it.isThali ? 1 : 0,
      it.stationCode || "MAIN_KITCHEN",
      it.taxCategoryId || "tax-exempt",
      it.gstRate || 0,
      it.portionAvailability || 100,
      it.stockStatus || "AVAILABLE",
      it.isDailySpecial ? 1 : 0,
      it.preparationTimeMinutes || 5,
      it.displayOrder || 1,
      it.variants ? JSON.stringify(it.variants) : null
    );
  }

  // 5. Seed Core Raw Ingredients
  const insertIng = db.prepare(`
    INSERT INTO ingredients (
      id, category_id, name, local_name, base_unit, physical_stock,
      reserved_stock, available_stock, par_level, reorder_level, critical_level,
      current_cost_per_unit, weighted_avg_cost_per_unit, health_status, is_active, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, 'HEALTHY', 1, ?)
  `);

  const initialIngredients = [
    { id: "ing-chicken", categoryId: "cat-meat", name: "Fresh Chicken", localName: "कोंबडी / चिकन", baseUnit: "kg", stock: 15.0, par: 15.0, cost: 240.0 },
    { id: "ing-mutton", categoryId: "cat-meat", name: "Fresh Mutton (Goat)", localName: "बोकडाचे मटण", baseUnit: "kg", stock: 10.0, par: 15.0, cost: 750.0 },
    { id: "ing-rice", categoryId: "cat-grains", name: "Indrayani Rice", localName: "इंद्रायणी तांदूळ", baseUnit: "kg", stock: 30.0, par: 30.0, cost: 65.0 },
    { id: "ing-dal", categoryId: "cat-pulses", name: "Toor Dal", localName: "तुरीची डाळ", baseUnit: "kg", stock: 15.0, par: 15.0, cost: 160.0 },
    { id: "ing-oil", categoryId: "cat-oils", name: "Groundnut Oil", localName: "शेंगदाणा तेल", baseUnit: "l", stock: 20.0, par: 20.0, cost: 180.0 },
    { id: "ing-chapati", categoryId: "cat-grains", name: "Fresh Chapati", localName: "चपाती", baseUnit: "piece", stock: 200.0, par: 300.0, cost: 6.0 },
    { id: "ing-spices", categoryId: "cat-spices", name: "Kolhapuri Masala", localName: "कांदा लसूण मसाला", baseUnit: "kg", stock: 10.0, par: 10.0, cost: 350.0 },
    { id: "ing-kokum-coconut", categoryId: "cat-dairy", name: "Coconut Milk & Kokum", localName: "नारळ दूध आणि कोकम", baseUnit: "l", stock: 10.0, par: 10.0, cost: 120.0 },
  ];

  for (const ing of initialIngredients) {
    insertIng.run(ing.id, ing.categoryId, ing.name, ing.localName, ing.baseUnit, ing.stock, ing.stock, ing.par, 5.0, 2.0, ing.cost, ing.cost, now);
  }

  // 6. Seed System Settings
  db.prepare(`
    INSERT INTO system_settings (id, profile_json, billing_json, dining_json, operations_json, updated_at)
    VALUES ('restaurant-default', ?, ?, ?, ?, ?)
  `).run(
    JSON.stringify(DEFAULT_RESTAURANT_SETTINGS.profile),
    JSON.stringify(DEFAULT_RESTAURANT_SETTINGS.billing),
    JSON.stringify(DEFAULT_RESTAURANT_SETTINGS.dining),
    JSON.stringify(DEFAULT_RESTAURANT_SETTINGS.operations),
    now
  );

  // 7. Seed Initial Atomic Sequences
  const insertSeq = db.prepare("INSERT INTO sequences (name, current_value, updated_at) VALUES (?, ?, ?)");
  insertSeq.run("kot_number", 1045, now);
  insertSeq.run("bill_number", 1001, now);
  insertSeq.run("order_number", 2001, now);
}
