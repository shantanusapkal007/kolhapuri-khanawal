/**
 * Authoritative Relational Database Schema DDL
 * Full ACID relational schema with foreign keys, constraints & indexes
 */

import { DatabaseSync } from "node:sqlite";

export function initDatabaseSchema(db: DatabaseSync): void {
  db.exec(`
    -- 1. Users, Credentials & Sessions
    CREATE TABLE IF NOT EXISTS app_users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      role TEXT NOT NULL,
      pin_salt TEXT NOT NULL,
      pin_hash TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      username TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES app_users (id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);

    -- 2. Dining Tables & Parties
    CREATE TABLE IF NOT EXISTS dining_tables (
      id TEXT PRIMARY KEY,
      table_number INTEGER UNIQUE NOT NULL,
      name TEXT NOT NULL,
      min_capacity INTEGER NOT NULL DEFAULT 1,
      max_capacity INTEGER NOT NULL DEFAULT 4,
      section TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'AVAILABLE',
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS dining_parties (
      id TEXT PRIMARY KEY,
      party_code TEXT NOT NULL,
      table_id TEXT NOT NULL,
      table_number INTEGER NOT NULL,
      table_name TEXT NOT NULL,
      guest_count INTEGER NOT NULL DEFAULT 2,
      assigned_waiter_id TEXT NOT NULL,
      assigned_waiter_name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'OPEN',
      descriptor TEXT,
      running_subtotal REAL NOT NULL DEFAULT 0.0,
      running_grand_total REAL NOT NULL DEFAULT 0.0,
      is_takeaway INTEGER NOT NULL DEFAULT 0,
      packaging_charges REAL DEFAULT 0.0,
      customer_name TEXT,
      customer_phone TEXT,
      notes TEXT,
      opened_at TEXT NOT NULL,
      closed_at TEXT,
      last_activity_at TEXT NOT NULL,
      FOREIGN KEY (table_id) REFERENCES dining_tables (id)
    );

    CREATE INDEX IF NOT EXISTS idx_parties_status ON dining_parties(status);
    CREATE INDEX IF NOT EXISTS idx_parties_table ON dining_parties(table_number);

    CREATE TABLE IF NOT EXISTS party_seats (
      id TEXT PRIMARY KEY,
      party_id TEXT NOT NULL,
      seat_number INTEGER NOT NULL,
      label TEXT NOT NULL,
      is_occupied INTEGER NOT NULL DEFAULT 1,
      seated_at TEXT NOT NULL,
      FOREIGN KEY (party_id) REFERENCES dining_parties (id) ON DELETE CASCADE
    );

    -- 3. Menu Categories & Menu Items
    CREATE TABLE IF NOT EXISTS menu_categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      local_name TEXT NOT NULL,
      code TEXT UNIQUE NOT NULL,
      display_order INTEGER NOT NULL DEFAULT 1,
      icon_name TEXT,
      is_active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS menu_items (
      id TEXT PRIMARY KEY,
      category_id TEXT NOT NULL,
      category_name TEXT NOT NULL,
      name TEXT NOT NULL,
      local_name TEXT NOT NULL,
      code TEXT,
      description TEXT,
      selling_price REAL NOT NULL,
      cost_price REAL DEFAULT 0.0,
      is_veg INTEGER NOT NULL DEFAULT 1,
      is_thali INTEGER NOT NULL DEFAULT 0,
      station_code TEXT NOT NULL,
      tax_category_id TEXT DEFAULT 'tax-exempt',
      gst_rate REAL DEFAULT 0.0,
      portion_availability INTEGER DEFAULT 100,
      stock_status TEXT DEFAULT 'AVAILABLE',
      is_available INTEGER NOT NULL DEFAULT 1,
      is_daily_special INTEGER NOT NULL DEFAULT 0,
      preparation_time_minutes INTEGER DEFAULT 5,
      display_order INTEGER NOT NULL DEFAULT 1,
      variants_json TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      FOREIGN KEY (category_id) REFERENCES menu_categories (id)
    );

    CREATE INDEX IF NOT EXISTS idx_menu_items_cat ON menu_items(category_id);

    -- 4. Inventory, Recipes & Stock Movements
    CREATE TABLE IF NOT EXISTS ingredients (
      id TEXT PRIMARY KEY,
      category_id TEXT NOT NULL,
      name TEXT NOT NULL,
      local_name TEXT,
      base_unit TEXT NOT NULL,
      physical_stock REAL NOT NULL DEFAULT 0.0,
      reserved_stock REAL NOT NULL DEFAULT 0.0,
      available_stock REAL NOT NULL DEFAULT 0.0,
      par_level REAL DEFAULT 10.0,
      reorder_level REAL DEFAULT 5.0,
      critical_level REAL DEFAULT 2.0,
      current_cost_per_unit REAL DEFAULT 0.0,
      weighted_avg_cost_per_unit REAL DEFAULT 0.0,
      health_status TEXT DEFAULT 'HEALTHY',
      is_active INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS recipes (
      id TEXT PRIMARY KEY,
      menu_item_id TEXT UNIQUE NOT NULL,
      menu_item_name TEXT NOT NULL,
      portions_yielded REAL DEFAULT 1.0,
      estimated_cost REAL DEFAULT 0.0,
      preparation_time_minutes INTEGER DEFAULT 5,
      is_active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS recipe_components (
      id TEXT PRIMARY KEY,
      recipe_id TEXT NOT NULL,
      component_type TEXT NOT NULL,
      ingredient_id TEXT NOT NULL,
      ingredient_name TEXT NOT NULL,
      quantity REAL NOT NULL,
      unit TEXT NOT NULL,
      yield_factor REAL DEFAULT 1.0,
      FOREIGN KEY (recipe_id) REFERENCES recipes (id) ON DELETE CASCADE,
      FOREIGN KEY (ingredient_id) REFERENCES ingredients (id)
    );

    CREATE TABLE IF NOT EXISTS stock_transactions (
      id TEXT PRIMARY KEY,
      ingredient_id TEXT NOT NULL,
      ingredient_name TEXT NOT NULL,
      transaction_type TEXT NOT NULL,
      quantity REAL NOT NULL,
      unit TEXT NOT NULL,
      direction TEXT NOT NULL,
      reference_type TEXT,
      reference_id TEXT,
      unit_cost REAL DEFAULT 0.0,
      total_value REAL DEFAULT 0.0,
      running_balance REAL NOT NULL,
      performed_by TEXT NOT NULL,
      notes TEXT,
      timestamp TEXT NOT NULL,
      FOREIGN KEY (ingredient_id) REFERENCES ingredients (id)
    );

    CREATE INDEX IF NOT EXISTS idx_stock_tx_ing ON stock_transactions(ingredient_id);

    -- 5. Orders & KOTs
    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      order_number TEXT UNIQUE NOT NULL,
      daily_order_number INTEGER,
      daily_parcel_number INTEGER,
      party_id TEXT NOT NULL,
      party_code TEXT NOT NULL,
      table_number INTEGER NOT NULL,
      waiter_id TEXT NOT NULL,
      waiter_name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'OPEN',
      idempotency_key TEXT UNIQUE,
      subtotal REAL NOT NULL DEFAULT 0.0,
      is_takeaway INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (party_id) REFERENCES dining_parties (id)
    );

    CREATE INDEX IF NOT EXISTS idx_orders_party ON orders(party_id);

    CREATE TABLE IF NOT EXISTS order_items (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL,
      party_id TEXT NOT NULL,
      menu_item_id TEXT NOT NULL,
      menu_item_name TEXT NOT NULL,
      menu_item_local_name TEXT,
      variant_name TEXT,
      quantity INTEGER NOT NULL DEFAULT 1,
      unit_price REAL NOT NULL,
      total_price REAL NOT NULL,
      seat_number INTEGER,
      spice_level TEXT,
      bread_option TEXT,
      notes TEXT,
      kot_id TEXT,
      kot_number TEXT,
      kot_status TEXT NOT NULL DEFAULT 'RECEIVED',
      is_cancelled INTEGER NOT NULL DEFAULT 0,
      cancelled_at TEXT,
      cancelled_reason TEXT,
      FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
    CREATE INDEX IF NOT EXISTS idx_order_items_party ON order_items(party_id);

    CREATE TABLE IF NOT EXISTS kots (
      id TEXT PRIMARY KEY,
      kot_number TEXT UNIQUE NOT NULL,
      daily_order_number INTEGER,
      daily_parcel_number INTEGER,
      kot_sequence_number INTEGER NOT NULL DEFAULT 1,
      order_id TEXT NOT NULL,
      party_id TEXT NOT NULL,
      party_code TEXT NOT NULL,
      table_number INTEGER NOT NULL,
      waiter_id TEXT NOT NULL,
      waiter_name TEXT NOT NULL,
      station_code TEXT NOT NULL,
      guest_count INTEGER NOT NULL DEFAULT 2,
      status TEXT NOT NULL DEFAULT 'RECEIVED',
      urgency_level TEXT NOT NULL DEFAULT 'NORMAL',
      is_add_on INTEGER NOT NULL DEFAULT 0,
      is_takeaway INTEGER NOT NULL DEFAULT 0,
      customer_name TEXT,
      notes TEXT,
      elapsed_seconds INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      acknowledged_at TEXT,
      ready_at TEXT,
      served_at TEXT,
      FOREIGN KEY (order_id) REFERENCES orders (id),
      FOREIGN KEY (party_id) REFERENCES dining_parties (id)
    );

    CREATE INDEX IF NOT EXISTS idx_kots_party ON kots(party_id);
    CREATE INDEX IF NOT EXISTS idx_kots_status ON kots(status);

    CREATE TABLE IF NOT EXISTS kot_items (
      id TEXT PRIMARY KEY,
      kot_id TEXT NOT NULL,
      order_item_id TEXT NOT NULL,
      menu_item_id TEXT NOT NULL,
      menu_item_name TEXT NOT NULL,
      menu_item_local_name TEXT,
      menu_item_english_name TEXT,
      variant_name TEXT,
      quantity INTEGER NOT NULL DEFAULT 1,
      bread_option TEXT,
      spice_level TEXT,
      notes TEXT,
      seat_number INTEGER,
      FOREIGN KEY (kot_id) REFERENCES kots (id) ON DELETE CASCADE,
      FOREIGN KEY (order_item_id) REFERENCES order_items (id)
    );

    -- 6. Bills & Multi-Tender Payments
    CREATE TABLE IF NOT EXISTS bills (
      id TEXT PRIMARY KEY,
      bill_number TEXT UNIQUE NOT NULL,
      party_id TEXT NOT NULL,
      party_code TEXT NOT NULL,
      table_id TEXT NOT NULL,
      table_number INTEGER NOT NULL,
      waiter_id TEXT NOT NULL,
      waiter_name TEXT NOT NULL,
      cashier_id TEXT NOT NULL,
      cashier_name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'OPEN',
      version INTEGER NOT NULL DEFAULT 1,
      subtotal REAL NOT NULL DEFAULT 0.0,
      discount_percentage REAL DEFAULT 0.0,
      discount_amount REAL DEFAULT 0.0,
      discount_reason TEXT,
      discount_approved_by TEXT,
      taxable_amount REAL NOT NULL DEFAULT 0.0,
      cgst_amount REAL DEFAULT 0.0,
      sgst_amount REAL DEFAULT 0.0,
      igst_amount REAL DEFAULT 0.0,
      vat_amount REAL DEFAULT 0.0,
      total_tax_amount REAL DEFAULT 0.0,
      packaging_charges REAL DEFAULT 0.0,
      round_off REAL DEFAULT 0.0,
      grand_total REAL NOT NULL DEFAULT 0.0,
      paid_amount REAL NOT NULL DEFAULT 0.0,
      balance_due REAL NOT NULL DEFAULT 0.0,
      is_takeaway INTEGER NOT NULL DEFAULT 0,
      customer_name TEXT,
      customer_phone TEXT,
      created_at TEXT NOT NULL,
      finalized_at TEXT,
      FOREIGN KEY (party_id) REFERENCES dining_parties (id)
    );

    CREATE INDEX IF NOT EXISTS idx_bills_party ON bills(party_id);
    CREATE INDEX IF NOT EXISTS idx_bills_status ON bills(status);

    CREATE TABLE IF NOT EXISTS bill_items (
      id TEXT PRIMARY KEY,
      bill_id TEXT NOT NULL,
      order_item_id TEXT NOT NULL,
      menu_item_id TEXT NOT NULL,
      menu_item_name TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      unit_price REAL NOT NULL,
      total_price REAL NOT NULL,
      seat_number INTEGER,
      tax_rate_id TEXT,
      tax_rate_percentage REAL DEFAULT 0.0,
      tax_amount REAL DEFAULT 0.0,
      is_complimentary INTEGER DEFAULT 0,
      bread_option TEXT,
      FOREIGN KEY (bill_id) REFERENCES bills (id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY,
      payment_number TEXT UNIQUE NOT NULL,
      bill_id TEXT NOT NULL,
      party_id TEXT NOT NULL,
      payment_method TEXT NOT NULL,
      amount REAL NOT NULL,
      tender_amount REAL NOT NULL,
      change_given REAL DEFAULT 0.0,
      reference TEXT,
      cashier_id TEXT NOT NULL,
      cashier_name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'SUCCESS',
      processed_at TEXT NOT NULL,
      FOREIGN KEY (bill_id) REFERENCES bills (id)
    );

    CREATE INDEX IF NOT EXISTS idx_payments_bill ON payments(bill_id);

    -- 7. Cash & UPI Ledgers
    CREATE TABLE IF NOT EXISTS cash_ledger (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      entry_type TEXT NOT NULL,
      description TEXT NOT NULL,
      inflow REAL DEFAULT 0.0,
      outflow REAL DEFAULT 0.0,
      balance REAL NOT NULL,
      reference_id TEXT,
      performed_by TEXT,
      timestamp TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS upi_ledger (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      entry_type TEXT NOT NULL,
      description TEXT NOT NULL,
      inflow REAL DEFAULT 0.0,
      outflow REAL DEFAULT 0.0,
      balance REAL NOT NULL,
      reference_id TEXT,
      performed_by TEXT,
      timestamp TEXT NOT NULL
    );

    -- 8. Atomic Sequences & Idempotency Store
    CREATE TABLE IF NOT EXISTS sequences (
      name TEXT PRIMARY KEY,
      current_value INTEGER NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS idempotency_keys (
      key TEXT PRIMARY KEY,
      operation_type TEXT NOT NULL,
      resource_id TEXT,
      response_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    -- 9. Immutable Audit Trail
    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      action TEXT NOT NULL,
      entity TEXT NOT NULL,
      entity_id TEXT,
      user_id TEXT NOT NULL,
      user_name TEXT NOT NULL,
      details TEXT,
      timestamp TEXT NOT NULL
    );

    -- 10. System Settings & Profile
    CREATE TABLE IF NOT EXISTS system_settings (
      id TEXT PRIMARY KEY,
      profile_json TEXT NOT NULL,
      billing_json TEXT NOT NULL,
      dining_json TEXT NOT NULL,
      operations_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
}
