# DATABASE.md — PostgreSQL 17 Relational Schema & Functions

## 1. Schema Overview

The database is built on PostgreSQL 17 and Supabase with 18 normalized relational tables:

- **Core & Auth:** `restaurants`, `restaurant_settings`, `roles`, `permissions`, `role_permissions`, `app_users`, `staff`, `staff_shifts`.
- **Tables & Parties:** `dining_tables`, `dining_parties`, `party_seats`, `party_transfers`, `party_merges`.
- **Menu & Kitchen:** `kitchen_stations`, `tax_rates`, `menu_categories`, `menu_items`, `menu_item_modifiers`, `recipes`, `recipe_components`, `preparations`, `preparation_components`, `preparation_batches`.
- **Orders & KOT:** `orders`, `order_items`, `kot`, `kot_events`.
- **Inventory Ledger:** `ingredients`, `stock_transactions`, `stock_reservations`, `suppliers`, `purchase_orders`, `purchase_items`, `wastage_records`, `stock_counts`, `stock_count_items`.
- **Billing & Settlement:** `discounts`, `bills`, `bill_items`, `payments`, `refund_records`.
- **Operations & Audit:** `daily_checklists`, `daily_checklist_items`, `operational_tasks`, `audit_logs`.

---

## 2. Explicit Stored Procedures

Critical domain operations execute in PostgreSQL stored procedures using `SELECT ... FOR UPDATE` row-level locks:

```sql
-- 1. Atomic Order & KOT Creation with 3-Tier Stock Reservation
CREATE OR REPLACE FUNCTION create_order_and_kot_tx(
    p_party_id UUID,
    p_waiter_id UUID,
    p_idempotency_key VARCHAR(100),
    p_items JSONB,
    p_allow_override BOOLEAN DEFAULT FALSE
) RETURNS JSONB;

-- 2. Stock Ledger Consumption on Kitchen Preparation
CREATE OR REPLACE FUNCTION commit_kot_consumption_tx(
    p_kot_id UUID,
    p_performed_by UUID
) RETURNS JSONB;

-- 3. Bill Payment Settlement and Automatic Table State Update
CREATE OR REPLACE FUNCTION process_bill_payment_tx(
    p_bill_id UUID,
    p_payment_method VARCHAR(50),
    p_amount NUMERIC(12,2),
    p_reference VARCHAR(100),
    p_cashier_id UUID
) RETURNS JSONB;
```

---

## 3. Sequential Number Generators

Guarantees thread-safe, gap-free, concurrency-safe sequential identifiers:
- `generate_kot_number()` $\rightarrow$ `KOT-2026-001045`
- `generate_bill_number()` $\rightarrow$ `BILL-2026-001002`
- `generate_party_code(p_table_number)` $\rightarrow$ `T4-P01`, `T4-P02`
