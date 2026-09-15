-- ============================================================================
-- KOLHAPURI KHANAWAL RESTAURANT OPERATING SYSTEM
-- Migration 003: Row Level Security (RLS) & Authorization Matrix
-- ============================================================================

-- Enable RLS on all operational and financial tables
ALTER TABLE dining_tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE dining_parties ENABLE ROW LEVEL SECURITY;
ALTER TABLE party_seats ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE kot ENABLE ROW LEVEL SECURITY;
ALTER TABLE kot_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipe_components ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE preparations ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE bill_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Helper function to get current user's role code
CREATE OR REPLACE FUNCTION current_user_role()
RETURNS VARCHAR(50) AS $$
DECLARE
    v_role_code VARCHAR(50);
BEGIN
    SELECT r.code INTO v_role_code
    FROM app_users u
    JOIN roles r ON u.role_id = r.id
    WHERE u.id = auth.uid()::UUID;

    RETURN COALESCE(v_role_code, 'ANONYMOUS');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ----------------------------------------------------------------------------
-- POLICIES: DINING TABLES & PARTIES (All staff can view, Waiters/Managers can edit)
-- ----------------------------------------------------------------------------
CREATE POLICY "Staff can view tables" ON dining_tables FOR SELECT USING (true);
CREATE POLICY "Managers can update tables" ON dining_tables FOR ALL USING (current_user_role() IN ('OWNER', 'MANAGER'));

CREATE POLICY "Staff can view active parties" ON dining_parties FOR SELECT USING (true);
CREATE POLICY "Waiters and Cashiers can manage parties" ON dining_parties FOR ALL USING (
    current_user_role() IN ('OWNER', 'MANAGER', 'CASHIER', 'WAITER')
);

-- ----------------------------------------------------------------------------
-- POLICIES: ORDERS & KOT
-- ----------------------------------------------------------------------------
CREATE POLICY "Staff can view orders" ON orders FOR SELECT USING (true);
CREATE POLICY "Waiters and Cashiers can create orders" ON orders FOR INSERT WITH CHECK (
    current_user_role() IN ('OWNER', 'MANAGER', 'CASHIER', 'WAITER')
);

CREATE POLICY "Kitchen and Waiters can view KOT" ON kot FOR SELECT USING (true);
CREATE POLICY "Waiters can insert KOT" ON kot FOR INSERT WITH CHECK (
    current_user_role() IN ('OWNER', 'MANAGER', 'WAITER')
);
CREATE POLICY "Kitchen and Managers can update KOT status" ON kot FOR UPDATE USING (
    current_user_role() IN ('OWNER', 'MANAGER', 'KITCHEN')
);

-- ----------------------------------------------------------------------------
-- POLICIES: INVENTORY, RECIPES & COSTING (STRICT: Waiters cannot view cost/edit)
-- ----------------------------------------------------------------------------
CREATE POLICY "Staff can view menu and stock availability" ON menu_items FOR SELECT USING (true);
CREATE POLICY "Only Managers can edit menu" ON menu_items FOR ALL USING (current_user_role() IN ('OWNER', 'MANAGER'));

CREATE POLICY "Managers and Kitchen can view recipes" ON recipes FOR SELECT USING (
    current_user_role() IN ('OWNER', 'MANAGER', 'KITCHEN', 'INVENTORY_MANAGER')
);
CREATE POLICY "Only Managers can edit recipes" ON recipes FOR ALL USING (
    current_user_role() IN ('OWNER', 'MANAGER', 'INVENTORY_MANAGER')
);

CREATE POLICY "Authorized staff can view ingredients" ON ingredients FOR SELECT USING (
    current_user_role() IN ('OWNER', 'MANAGER', 'INVENTORY_MANAGER', 'KITCHEN', 'CASHIER', 'WAITER')
);
CREATE POLICY "Only Inventory Managers can adjust ingredients" ON ingredients FOR ALL USING (
    current_user_role() IN ('OWNER', 'MANAGER', 'INVENTORY_MANAGER')
);

CREATE POLICY "Authorized staff can view stock ledger" ON stock_transactions FOR SELECT USING (
    current_user_role() IN ('OWNER', 'MANAGER', 'INVENTORY_MANAGER')
);

-- ----------------------------------------------------------------------------
-- POLICIES: BILLS & PAYMENTS (Strict: Waiters cannot view financial margins/cancel)
-- ----------------------------------------------------------------------------
CREATE POLICY "Cashier and Managers can manage bills" ON bills FOR ALL USING (
    current_user_role() IN ('OWNER', 'MANAGER', 'CASHIER')
);
CREATE POLICY "Cashier and Managers can record payments" ON payments FOR ALL USING (
    current_user_role() IN ('OWNER', 'MANAGER', 'CASHIER')
);

-- ----------------------------------------------------------------------------
-- POLICIES: AUDIT LOGS (Immutable: Only viewable by Owner and Manager)
-- ----------------------------------------------------------------------------
CREATE POLICY "Only Owners and Managers view audit logs" ON audit_logs FOR SELECT USING (
    current_user_role() IN ('OWNER', 'MANAGER')
);
