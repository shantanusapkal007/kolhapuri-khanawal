-- ============================================================================
-- KOLHAPURI KHANAWAL RESTAURANT OPERATING SYSTEM
-- Migration 001: Core Relational Schema (PostgreSQL 17 / Supabase)
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ----------------------------------------------------------------------------
-- 1. RESTAURANTS & SETTINGS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS restaurants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL DEFAULT 'Kolhapuri Khanawal',
    tagline VARCHAR(255) DEFAULT 'Authentic Maharashtrian & Kolhapuri Thali House',
    address TEXT NOT NULL DEFAULT 'CSMT Road, Kolhapur, Maharashtra 416001',
    phone VARCHAR(50) NOT NULL DEFAULT '+91 98230 12345',
    gstin VARCHAR(50) DEFAULT '27AAAAA0000A1Z5',
    fssai_number VARCHAR(50) DEFAULT '11521000000001',
    currency VARCHAR(10) NOT NULL DEFAULT 'INR',
    currency_symbol VARCHAR(5) NOT NULL DEFAULT '₹',
    timezone VARCHAR(50) NOT NULL DEFAULT 'Asia/Kolkata',
    receipt_footer TEXT DEFAULT 'धन्यवाद! पुन्हा भेट द्या! (Thank you, Visit again!)',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS restaurant_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    negative_stock_policy VARCHAR(50) NOT NULL DEFAULT 'BLOCK' CHECK (negative_stock_policy IN ('BLOCK', 'ALLOW_WITH_OVERRIDE')),
    auto_kds_routing BOOLEAN NOT NULL DEFAULT TRUE,
    table_count INT NOT NULL DEFAULT 12 CHECK (table_count > 0),
    service_charge_percentage NUMERIC(5,2) NOT NULL DEFAULT 0.00,
    low_stock_alert_threshold_ratio NUMERIC(5,2) NOT NULL DEFAULT 0.50,
    critical_stock_alert_threshold_ratio NUMERIC(5,2) NOT NULL DEFAULT 0.20,
    require_pin_for_discounts_over_percent NUMERIC(5,2) NOT NULL DEFAULT 10.00,
    require_pin_for_bill_cancellation BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 2. USERS, ROLES, PERMISSIONS & STAFF
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) UNIQUE NOT NULL CHECK (code IN ('OWNER', 'MANAGER', 'CASHIER', 'WAITER', 'KITCHEN', 'INVENTORY_MANAGER')),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(100) UNIQUE NOT NULL,
    module VARCHAR(50) NOT NULL,
    description TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS role_permissions (
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE IF NOT EXISTS app_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    role_id UUID NOT NULL REFERENCES roles(id),
    pin_hash VARCHAR(255),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    avatar_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS staff (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    employee_code VARCHAR(50) UNIQUE NOT NULL,
    designation VARCHAR(100) NOT NULL,
    shift_schedule VARCHAR(50) NOT NULL DEFAULT 'FULL_DAY',
    joining_date DATE NOT NULL DEFAULT CURRENT_DATE,
    emergency_contact VARCHAR(100),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS staff_shifts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
    shift_date DATE NOT NULL DEFAULT CURRENT_DATE,
    clock_in TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    clock_out TIMESTAMPTZ,
    notes TEXT
);

-- ----------------------------------------------------------------------------
-- 3. PHYSICAL TABLES, DINING PARTIES & SEATS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS dining_tables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_number INT UNIQUE NOT NULL CHECK (table_number >= 1 AND table_number <= 50),
    name VARCHAR(100) NOT NULL,
    min_capacity INT NOT NULL DEFAULT 1 CHECK (min_capacity >= 1),
    max_capacity INT NOT NULL DEFAULT 6 CHECK (max_capacity >= min_capacity),
    section VARCHAR(50) NOT NULL DEFAULT 'MAIN_HALL',
    status VARCHAR(50) NOT NULL DEFAULT 'AVAILABLE' CHECK (status IN ('AVAILABLE', 'OCCUPIED', 'SHARED', 'RESERVED', 'BLOCKED')),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS dining_parties (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    party_code VARCHAR(50) UNIQUE NOT NULL, -- e.g. T4-P01, T6-P02
    table_id UUID NOT NULL REFERENCES dining_tables(id) ON DELETE RESTRICT,
    table_number INT NOT NULL,
    guest_count INT NOT NULL DEFAULT 1 CHECK (guest_count >= 1),
    assigned_waiter_id UUID NOT NULL REFERENCES app_users(id),
    status VARCHAR(50) NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'ORDERING', 'FOOD_PENDING', 'WAITING_FOR_BILL', 'PAYMENT_PENDING', 'CLOSED', 'TRANSFERRED', 'CANCELLED')),
    descriptor VARCHAR(255), -- e.g. "Window side", "2 Adults 1 Child"
    opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    closed_at TIMESTAMPTZ,
    last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    notes TEXT
);

CREATE TABLE IF NOT EXISTS party_seats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    party_id UUID NOT NULL REFERENCES dining_parties(id) ON DELETE CASCADE,
    seat_number INT NOT NULL CHECK (seat_number >= 1),
    label VARCHAR(50),
    UNIQUE(party_id, seat_number)
);

CREATE TABLE IF NOT EXISTS party_transfers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    party_id UUID NOT NULL REFERENCES dining_parties(id),
    party_code VARCHAR(50) NOT NULL,
    from_table_id UUID NOT NULL REFERENCES dining_tables(id),
    from_table_number INT NOT NULL,
    to_table_id UUID NOT NULL REFERENCES dining_tables(id),
    to_table_number INT NOT NULL,
    transferred_by UUID NOT NULL REFERENCES app_users(id),
    reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS party_merges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_party_ids UUID[] NOT NULL,
    source_party_codes TEXT[] NOT NULL,
    target_party_id UUID NOT NULL REFERENCES dining_parties(id),
    target_party_code VARCHAR(50) NOT NULL,
    table_id UUID NOT NULL REFERENCES dining_tables(id),
    merged_by UUID NOT NULL REFERENCES app_users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 4. INGREDIENTS, PREPARATIONS & RECIPES
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ingredient_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) UNIQUE NOT NULL,
    code VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ingredients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id UUID NOT NULL REFERENCES ingredient_categories(id),
    name VARCHAR(255) NOT NULL,
    local_name VARCHAR(255),
    base_unit VARCHAR(20) NOT NULL CHECK (base_unit IN ('kg', 'g', 'l', 'ml', 'piece', 'dozen', 'packet', 'box', 'bottle', 'portion')),
    physical_stock NUMERIC(14,4) NOT NULL DEFAULT 0.0000 CHECK (physical_stock >= 0),
    reserved_stock NUMERIC(14,4) NOT NULL DEFAULT 0.0000 CHECK (reserved_stock >= 0),
    par_level NUMERIC(14,4) NOT NULL DEFAULT 10.0000,
    reorder_level NUMERIC(14,4) NOT NULL DEFAULT 5.0000,
    critical_level NUMERIC(14,4) NOT NULL DEFAULT 2.0000,
    current_cost_per_unit NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    weighted_avg_cost_per_unit NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS preparations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    local_name VARCHAR(255),
    output_unit VARCHAR(20) NOT NULL CHECK (output_unit IN ('kg', 'g', 'l', 'ml', 'piece', 'portion')),
    standard_yield_ratio NUMERIC(6,4) NOT NULL DEFAULT 1.0000 CHECK (standard_yield_ratio > 0),
    shelf_life_hours INT NOT NULL DEFAULT 24,
    notes TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS preparation_components (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    preparation_id UUID NOT NULL REFERENCES preparations(id) ON DELETE CASCADE,
    ingredient_id UUID NOT NULL REFERENCES ingredients(id),
    required_quantity NUMERIC(14,4) NOT NULL CHECK (required_quantity > 0),
    unit VARCHAR(20) NOT NULL,
    notes TEXT
);

CREATE TABLE IF NOT EXISTS preparation_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_number VARCHAR(100) UNIQUE NOT NULL,
    preparation_id UUID NOT NULL REFERENCES preparations(id),
    raw_input_quantity NUMERIC(14,4) NOT NULL,
    output_quantity_produced NUMERIC(14,4) NOT NULL,
    output_unit VARCHAR(20) NOT NULL,
    prepared_by UUID NOT NULL REFERENCES app_users(id),
    prepared_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    cost_total NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    unit_cost NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'DEPLETED', 'EXPIRED', 'DISCARDED'))
);

-- ----------------------------------------------------------------------------
-- 5. KITCHEN STATIONS, MENU & RECIPES
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS kitchen_stations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    printer_ip VARCHAR(50),
    display_color VARCHAR(20) NOT NULL DEFAULT '#E11D48',
    is_active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS tax_rates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    code VARCHAR(50) UNIQUE NOT NULL,
    cgst_rate NUMERIC(6,3) NOT NULL DEFAULT 2.500,
    sgst_rate NUMERIC(6,3) NOT NULL DEFAULT 2.500,
    igst_rate NUMERIC(6,3) NOT NULL DEFAULT 5.000,
    vat_rate NUMERIC(6,3) NOT NULL DEFAULT 0.000,
    total_rate NUMERIC(6,3) NOT NULL DEFAULT 5.000,
    is_tax_inclusive BOOLEAN NOT NULL DEFAULT FALSE,
    is_tax_exempt BOOLEAN NOT NULL DEFAULT FALSE,
    hsn_sac_code VARCHAR(50) DEFAULT '996331',
    effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
    effective_to DATE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS menu_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    local_name VARCHAR(100),
    code VARCHAR(50) UNIQUE NOT NULL,
    display_order INT NOT NULL DEFAULT 0,
    icon_name VARCHAR(50),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS menu_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id UUID NOT NULL REFERENCES menu_categories(id),
    name VARCHAR(255) NOT NULL,
    local_name VARCHAR(255),
    code VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    selling_price NUMERIC(12,2) NOT NULL CHECK (selling_price >= 0),
    cost_price NUMERIC(12,2) DEFAULT 0.00,
    is_veg BOOLEAN NOT NULL DEFAULT FALSE,
    is_thali BOOLEAN NOT NULL DEFAULT FALSE,
    station_id UUID NOT NULL REFERENCES kitchen_stations(id),
    tax_rate_id UUID NOT NULL REFERENCES tax_rates(id),
    stock_status VARCHAR(50) NOT NULL DEFAULT 'AVAILABLE' CHECK (stock_status IN ('AVAILABLE', 'LOW_STOCK', 'OUT_OF_STOCK', 'TEMPORARILY_UNAVAILABLE', 'HIDDEN')),
    is_daily_special BOOLEAN NOT NULL DEFAULT FALSE,
    preparation_time_minutes INT NOT NULL DEFAULT 10,
    display_order INT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS menu_item_modifiers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    menu_item_id UUID NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    price_delta NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    is_default BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS recipes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    menu_item_id UUID UNIQUE NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
    version INT NOT NULL DEFAULT 1,
    status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('DRAFT', 'ACTIVE', 'INACTIVE')),
    effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
    effective_to DATE,
    preparation_time_minutes INT NOT NULL DEFAULT 10,
    portions_yielded NUMERIC(10,2) NOT NULL DEFAULT 1.00,
    estimated_cost NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS recipe_components (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
    component_type VARCHAR(50) NOT NULL DEFAULT 'RAW_INGREDIENT' CHECK (component_type IN ('RAW_INGREDIENT', 'PREPARATION_BATCH', 'SUB_RECIPE')),
    ingredient_id UUID REFERENCES ingredients(id),
    preparation_id UUID REFERENCES preparations(id),
    quantity NUMERIC(14,4) NOT NULL CHECK (quantity > 0),
    unit VARCHAR(20) NOT NULL,
    yield_factor NUMERIC(6,4) NOT NULL DEFAULT 1.0000,
    is_optional BOOLEAN NOT NULL DEFAULT FALSE,
    notes TEXT
);

-- ----------------------------------------------------------------------------
-- 6. ORDERS, ORDER ITEMS, KOT & KDS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_number VARCHAR(100) UNIQUE NOT NULL,
    party_id UUID NOT NULL REFERENCES dining_parties(id),
    party_code VARCHAR(50) NOT NULL,
    table_number INT NOT NULL,
    waiter_id UUID NOT NULL REFERENCES app_users(id),
    status VARCHAR(50) NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'KOT_SENT', 'BILLED', 'CANCELLED')),
    idempotency_key VARCHAR(100) UNIQUE NOT NULL,
    subtotal NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS kot (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kot_number VARCHAR(100) UNIQUE NOT NULL,
    order_id UUID NOT NULL REFERENCES orders(id),
    party_id UUID NOT NULL REFERENCES dining_parties(id),
    party_code VARCHAR(50) NOT NULL,
    table_number INT NOT NULL,
    waiter_id UUID NOT NULL REFERENCES app_users(id),
    station_id UUID NOT NULL REFERENCES kitchen_stations(id),
    status VARCHAR(50) NOT NULL DEFAULT 'NEW' CHECK (status IN ('NEW', 'ACKNOWLEDGED', 'PREPARING', 'READY', 'SERVED', 'CANCELLED')),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    acknowledged_at TIMESTAMPTZ,
    ready_at TIMESTAMPTZ,
    served_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    party_id UUID NOT NULL REFERENCES dining_parties(id),
    menu_item_id UUID NOT NULL REFERENCES menu_items(id),
    quantity INT NOT NULL CHECK (quantity > 0),
    unit_price NUMERIC(12,2) NOT NULL CHECK (unit_price >= 0),
    total_price NUMERIC(12,2) NOT NULL CHECK (total_price >= 0),
    seat_number INT,
    spice_level VARCHAR(50) DEFAULT 'MEDIUM' CHECK (spice_level IN ('MILD', 'MEDIUM', 'SPICY', 'THECHA_EXTRA_SPICY')),
    notes TEXT,
    kot_id UUID REFERENCES kot(id),
    kot_status VARCHAR(50) NOT NULL DEFAULT 'NEW' CHECK (kot_status IN ('NEW', 'ACKNOWLEDGED', 'PREPARING', 'READY', 'SERVED', 'CANCELLED')),
    is_cancelled BOOLEAN NOT NULL DEFAULT FALSE,
    cancelled_at TIMESTAMPTZ,
    cancelled_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS kot_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kot_id UUID NOT NULL REFERENCES kot(id) ON DELETE CASCADE,
    kot_number VARCHAR(100) NOT NULL,
    event_type VARCHAR(50) NOT NULL,
    performed_by UUID NOT NULL REFERENCES app_users(id),
    role VARCHAR(50) NOT NULL,
    reason TEXT,
    delta_summary TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 7. STOCK TRANSACTIONS & RESERVATIONS (IMMUTABLE LEDGER)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS stock_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ingredient_id UUID NOT NULL REFERENCES ingredients(id),
    transaction_type VARCHAR(50) NOT NULL CHECK (transaction_type IN (
        'PURCHASE', 'SALE_CONSUMPTION', 'PREPARATION_CONSUMPTION', 'PREPARATION_OUTPUT',
        'WASTAGE', 'SPOILAGE', 'STOCK_ADJUSTMENT', 'STOCK_COUNT',
        'TRANSFER_IN', 'TRANSFER_OUT', 'RETURN_TO_SUPPLIER', 'OPENING_BALANCE', 'MANUAL_CORRECTION'
    )),
    quantity NUMERIC(14,4) NOT NULL CHECK (quantity > 0),
    unit VARCHAR(20) NOT NULL,
    direction VARCHAR(10) NOT NULL CHECK (direction IN ('IN', 'OUT')),
    reference_type VARCHAR(50) NOT NULL,
    reference_id VARCHAR(100) NOT NULL,
    unit_cost NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    total_value NUMERIC(14,2) NOT NULL DEFAULT 0.00,
    running_balance NUMERIC(14,4) NOT NULL,
    performed_by UUID NOT NULL REFERENCES app_users(id),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS stock_reservations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    party_id UUID NOT NULL REFERENCES dining_parties(id),
    order_id UUID NOT NULL REFERENCES orders(id),
    order_item_id UUID NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
    ingredient_id UUID NOT NULL REFERENCES ingredients(id),
    quantity NUMERIC(14,4) NOT NULL CHECK (quantity > 0),
    unit VARCHAR(20) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'RESERVED' CHECK (status IN ('RESERVED', 'CONSUMED', 'RELEASED')),
    reserved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '2 hours')
);

CREATE TABLE IF NOT EXISTS suppliers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    contact_person VARCHAR(100),
    phone VARCHAR(50) NOT NULL,
    email VARCHAR(100),
    address TEXT,
    gstin VARCHAR(50),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS purchase_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    po_number VARCHAR(100) UNIQUE NOT NULL,
    supplier_id UUID NOT NULL REFERENCES suppliers(id),
    status VARCHAR(50) NOT NULL DEFAULT 'RECEIVED' CHECK (status IN ('DRAFT', 'SUBMITTED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED')),
    order_date DATE NOT NULL DEFAULT CURRENT_DATE,
    subtotal NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    tax_total NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    grand_total NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS purchase_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    purchase_order_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
    ingredient_id UUID NOT NULL REFERENCES ingredients(id),
    ordered_quantity NUMERIC(14,4) NOT NULL,
    received_quantity NUMERIC(14,4) NOT NULL,
    rejected_quantity NUMERIC(14,4) NOT NULL DEFAULT 0.0000,
    unit VARCHAR(20) NOT NULL,
    unit_rate NUMERIC(12,2) NOT NULL,
    tax_rate NUMERIC(5,2) NOT NULL DEFAULT 0.00,
    total_amount NUMERIC(12,2) NOT NULL,
    batch_number VARCHAR(100),
    expiry_date DATE
);

CREATE TABLE IF NOT EXISTS wastage_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ingredient_id UUID NOT NULL REFERENCES ingredients(id),
    quantity NUMERIC(14,4) NOT NULL CHECK (quantity > 0),
    unit VARCHAR(20) NOT NULL,
    reason VARCHAR(50) NOT NULL CHECK (reason IN ('BURNT_FOOD', 'SPOILED', 'EXPIRED', 'BROKEN_DROPPED', 'KITCHEN_ERROR', 'CUSTOMER_RETURN', 'PREPARATION_LOSS', 'OTHER')),
    estimated_cost NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    recorded_by UUID NOT NULL REFERENCES app_users(id),
    approved_by UUID REFERENCES app_users(id),
    approval_status VARCHAR(50) NOT NULL DEFAULT 'APPROVED' CHECK (approval_status IN ('APPROVED', 'PENDING_APPROVAL', 'REJECTED')),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS stock_counts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    count_date DATE NOT NULL DEFAULT CURRENT_DATE,
    conducted_by UUID NOT NULL REFERENCES app_users(id),
    status VARCHAR(50) NOT NULL DEFAULT 'COMPLETED' CHECK (status IN ('IN_PROGRESS', 'COMPLETED', 'RECONCILED')),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS stock_count_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stock_count_id UUID NOT NULL REFERENCES stock_counts(id) ON DELETE CASCADE,
    ingredient_id UUID NOT NULL REFERENCES ingredients(id),
    unit VARCHAR(20) NOT NULL,
    theoretical_stock NUMERIC(14,4) NOT NULL,
    physical_count NUMERIC(14,4) NOT NULL,
    variance_quantity NUMERIC(14,4) NOT NULL,
    variance_percentage NUMERIC(6,2) NOT NULL,
    variance_value NUMERIC(12,2) NOT NULL,
    variance_reason VARCHAR(50),
    adjustment_transaction_id UUID REFERENCES stock_transactions(id)
);

-- ----------------------------------------------------------------------------
-- 8. BILLING, DISCOUNTS, PAYMENTS & REFUNDS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS discounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    discount_type VARCHAR(50) NOT NULL CHECK (discount_type IN ('PERCENTAGE', 'FLAT_AMOUNT')),
    value NUMERIC(10,2) NOT NULL CHECK (value > 0),
    max_discount_amount NUMERIC(10,2),
    requires_manager_pin BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS bills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bill_number VARCHAR(100) UNIQUE NOT NULL,
    party_id UUID NOT NULL REFERENCES dining_parties(id),
    party_code VARCHAR(50) NOT NULL,
    table_id UUID NOT NULL REFERENCES dining_tables(id),
    table_number INT NOT NULL,
    waiter_id UUID NOT NULL REFERENCES app_users(id),
    cashier_id UUID NOT NULL REFERENCES app_users(id),
    status VARCHAR(50) NOT NULL DEFAULT 'OPEN' CHECK (status IN ('DRAFT', 'OPEN', 'FINALIZED', 'PAID', 'PARTIALLY_PAID', 'CANCELLED', 'REFUNDED')),
    subtotal NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    discount_id UUID REFERENCES discounts(id),
    discount_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    discount_reason TEXT,
    discount_approved_by UUID REFERENCES app_users(id),
    taxable_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    cgst_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    sgst_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    igst_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    vat_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    total_tax_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    round_off NUMERIC(6,2) NOT NULL DEFAULT 0.00,
    grand_total NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    paid_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    balance_due NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    settled_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    cancelled_by UUID REFERENCES app_users(id),
    cancelled_reason TEXT
);

CREATE TABLE IF NOT EXISTS bill_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bill_id UUID NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
    order_item_id UUID NOT NULL REFERENCES order_items(id),
    menu_item_id UUID NOT NULL REFERENCES menu_items(id),
    menu_item_name VARCHAR(255) NOT NULL,
    quantity INT NOT NULL,
    unit_price NUMERIC(12,2) NOT NULL,
    total_price NUMERIC(12,2) NOT NULL,
    seat_number INT,
    tax_rate_id UUID NOT NULL REFERENCES tax_rates(id),
    tax_rate_percentage NUMERIC(6,3) NOT NULL,
    tax_amount NUMERIC(12,2) NOT NULL,
    is_complimentary BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bill_id UUID NOT NULL REFERENCES bills(id),
    payment_method VARCHAR(50) NOT NULL CHECK (payment_method IN ('CASH', 'UPI', 'CARD', 'OTHER')),
    amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
    transaction_reference VARCHAR(100),
    received_by UUID NOT NULL REFERENCES app_users(id),
    status VARCHAR(50) NOT NULL DEFAULT 'SUCCESS' CHECK (status IN ('SUCCESS', 'REFUNDED', 'VOID')),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS refund_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bill_id UUID NOT NULL REFERENCES bills(id),
    payment_id UUID NOT NULL REFERENCES payments(id),
    amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
    reason TEXT NOT NULL,
    approved_by UUID NOT NULL REFERENCES app_users(id),
    refund_method VARCHAR(50) NOT NULL,
    refund_reference VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 9. TASKS, CHECKLISTS, NOTIFICATIONS & AUDIT LOGS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS daily_checklists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    checklist_type VARCHAR(50) NOT NULL CHECK (checklist_type IN ('OPENING', 'CLOSING')),
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    shift VARCHAR(50) NOT NULL DEFAULT 'MORNING',
    completed_by UUID NOT NULL REFERENCES app_users(id),
    verified_by UUID REFERENCES app_users(id),
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'COMPLETED', 'FLAGGED')),
    completed_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS daily_checklist_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    checklist_id UUID NOT NULL REFERENCES daily_checklists(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    category VARCHAR(50) NOT NULL CHECK (category IN ('SAFETY', 'HYGIENE', 'STOCK', 'FINANCE', 'OPERATIONS')),
    is_completed BOOLEAN NOT NULL DEFAULT FALSE,
    completed_at TIMESTAMPTZ,
    remarks TEXT
);

CREATE TABLE IF NOT EXISTS operational_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    priority VARCHAR(50) NOT NULL DEFAULT 'MEDIUM' CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH', 'URGENT')),
    status VARCHAR(50) NOT NULL DEFAULT 'TODO' CHECK (status IN ('TODO', 'IN_PROGRESS', 'DONE', 'OVERDUE', 'CANCELLED')),
    assigned_to UUID REFERENCES app_users(id),
    due_time TIMESTAMPTZ NOT NULL,
    is_recurring BOOLEAN NOT NULL DEFAULT FALSE,
    recurrence_rule VARCHAR(50),
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES app_users(id),
    role VARCHAR(50) NOT NULL,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(100) NOT NULL,
    entity_id VARCHAR(100) NOT NULL,
    old_value JSONB,
    new_value JSONB,
    reason TEXT,
    ip_address VARCHAR(50),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- INDEXES FOR MAXIMUM QUERY PERFORMANCE
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_dining_parties_table ON dining_parties(table_id, status);
CREATE INDEX IF NOT EXISTS idx_dining_parties_waiter ON dining_parties(assigned_waiter_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_party ON orders(party_id, status);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_kot_station ON kot(station_id, status);
CREATE INDEX IF NOT EXISTS idx_kot_party ON kot(party_id);
CREATE INDEX IF NOT EXISTS idx_stock_transactions_ingredient ON stock_transactions(ingredient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stock_reservations_status ON stock_reservations(ingredient_id, status);
CREATE INDEX IF NOT EXISTS idx_bills_party ON bills(party_id, status);
CREATE INDEX IF NOT EXISTS idx_bills_date ON bills(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
