-- ============================================================================
-- KOLHAPURI KHANAWAL RESTAURANT OPERATING SYSTEM
-- Migration 002: Explicit Transactional Stored Procedures & Sequential Generators
-- ============================================================================

-- Sequence for KOT and Bill numbers
CREATE SEQUENCE IF NOT EXISTS kot_number_seq START WITH 1001 INCREMENT BY 1;
CREATE SEQUENCE IF NOT EXISTS bill_number_seq START WITH 1001 INCREMENT BY 1;
CREATE SEQUENCE IF NOT EXISTS party_number_seq START WITH 1 INCREMENT BY 1;

-- ----------------------------------------------------------------------------
-- 1. SEQUENTIAL GENERATOR FUNCTIONS
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION generate_kot_number()
RETURNS VARCHAR(100) AS $$
DECLARE
    next_val INT;
    cur_year VARCHAR(4);
BEGIN
    next_val := nextval('kot_number_seq');
    cur_year := TO_CHAR(CURRENT_DATE, 'YYYY');
    RETURN 'KOT-' || cur_year || '-' || LPAD(next_val::TEXT, 6, '0');
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION generate_bill_number()
RETURNS VARCHAR(100) AS $$
DECLARE
    next_val INT;
    cur_year VARCHAR(4);
BEGIN
    next_val := nextval('bill_number_seq');
    cur_year := TO_CHAR(CURRENT_DATE, 'YYYY');
    RETURN 'BILL-' || cur_year || '-' || LPAD(next_val::TEXT, 6, '0');
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION generate_party_code(p_table_number INT)
RETURNS VARCHAR(50) AS $$
DECLARE
    today_party_count INT;
    cur_code VARCHAR(50);
BEGIN
    SELECT COUNT(*) + 1 INTO today_party_count
    FROM dining_parties
    WHERE table_number = p_table_number
      AND opened_at::DATE = CURRENT_DATE;

    RETURN 'T' || p_table_number::TEXT || '-P' || LPAD(today_party_count::TEXT, 2, '0');
END;
$$ LANGUAGE plpgsql;

-- ----------------------------------------------------------------------------
-- 2. CREATE ORDER & KOT TRANSACTION (WITH EXPLICIT ROW LOCKING & 3-TIER STOCK CHECK)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION create_order_and_kot_tx(
    p_party_id UUID,
    p_waiter_id UUID,
    p_idempotency_key VARCHAR(100),
    p_items JSONB, -- Array of { menu_item_id, quantity, seat_number, spice_level, notes }
    p_allow_override BOOLEAN DEFAULT FALSE
)
RETURNS JSONB AS $$
DECLARE
    v_party RECORD;
    v_order_id UUID;
    v_order_number VARCHAR(100);
    v_kot_id UUID;
    v_kot_number VARCHAR(100);
    v_item JSONB;
    v_menu_item RECORD;
    v_recipe RECORD;
    v_component RECORD;
    v_ingredient RECORD;
    v_required_qty NUMERIC(14,4);
    v_available_qty NUMERIC(14,4);
    v_subtotal NUMERIC(12,2) := 0.00;
    v_order_item_id UUID;
    v_existing_order_id UUID;
BEGIN
    -- Idempotency check: if order with this key exists, return existing order
    SELECT id INTO v_existing_order_id FROM orders WHERE idempotency_key = p_idempotency_key;
    IF v_existing_order_id IS NOT NULL THEN
        RETURN jsonb_build_object('success', true, 'order_id', v_existing_order_id, 'is_duplicate', true);
    END IF;

    -- Validate Party
    SELECT * INTO v_party FROM dining_parties WHERE id = p_party_id;
    IF v_party IS NULL THEN
        RAISE EXCEPTION 'Party not found with id %', p_party_id;
    END IF;

    IF v_party.status IN ('CLOSED', 'CANCELLED') THEN
        RAISE EXCEPTION 'Cannot place order for party in % status', v_party.status;
    END IF;

    -- Generate Numbers
    v_order_number := 'ORD-' || TO_CHAR(CURRENT_DATE, 'YYYY') || '-' || LPAD(nextval('kot_number_seq')::TEXT, 6, '0');
    v_kot_number := generate_kot_number();

    -- Create Order Shell
    INSERT INTO orders (
        order_number, party_id, party_code, table_number, waiter_id,
        status, idempotency_key, subtotal
    ) VALUES (
        v_order_number, v_party.id, v_party.party_code, v_party.table_number, p_waiter_id,
        'KOT_SENT', p_idempotency_key, 0.00
    ) RETURNING id INTO v_order_id;

    -- Create KOT Shell (Assign station based on first item station or default main)
    INSERT INTO kot (
        kot_number, order_id, party_id, party_code, table_number, waiter_id,
        station_id, status
    ) VALUES (
        v_kot_number, v_order_id, v_party.id, v_party.party_code, v_party.table_number, p_waiter_id,
        (SELECT id FROM kitchen_stations WHERE code = 'MAIN_KITCHEN' LIMIT 1), 'NEW'
    ) RETURNING id INTO v_kot_id;

    -- Process each ordered item
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        SELECT * INTO v_menu_item FROM menu_items WHERE id = (v_item->>'menu_item_id')::UUID;
        IF v_menu_item IS NULL THEN
            RAISE EXCEPTION 'Menu item not found: %', v_item->>'menu_item_id';
        END IF;

        -- Check Recipe & Validate Stock with FOR UPDATE lock
        SELECT * INTO v_recipe FROM recipes WHERE menu_item_id = v_menu_item.id AND status = 'ACTIVE';
        IF v_recipe IS NOT NULL THEN
            FOR v_component IN SELECT * FROM recipe_components WHERE recipe_id = v_recipe.id AND component_type = 'RAW_INGREDIENT'
            LOOP
                -- Row lock ingredient
                SELECT * INTO v_ingredient FROM ingredients WHERE id = v_component.ingredient_id FOR UPDATE;
                IF v_ingredient IS NOT NULL THEN
                    v_required_qty := (v_component.quantity * (v_item->>'quantity')::INT * v_component.yield_factor);
                    v_available_qty := (v_ingredient.physical_stock - v_ingredient.reserved_stock);

                    IF v_available_qty < v_required_qty AND NOT p_allow_override THEN
                        RAISE EXCEPTION 'ERR_INSUFFICIENT_STOCK: % stock is insufficient. Available: % %, Required: % %',
                            v_ingredient.name, v_available_qty, v_ingredient.base_unit, v_required_qty, v_ingredient.base_unit;
                    END IF;

                    -- Reserve Stock
                    UPDATE ingredients
                    SET reserved_stock = reserved_stock + v_required_qty,
                        updated_at = NOW()
                    WHERE id = v_ingredient.id;
                END IF;
            END LOOP;
        END IF;

        -- Insert Order Item
        INSERT INTO order_items (
            order_id, party_id, menu_item_id, quantity, unit_price, total_price,
            seat_number, spice_level, notes, kot_id, kot_status
        ) VALUES (
            v_order_id, v_party.id, v_menu_item.id, (v_item->>'quantity')::INT,
            v_menu_item.selling_price, (v_menu_item.selling_price * (v_item->>'quantity')::INT),
            (v_item->>'seat_number')::INT,
            COALESCE(v_item->>'spice_level', 'MEDIUM'),
            v_item->>'notes',
            v_kot_id, 'NEW'
        ) RETURNING id INTO v_order_item_id;

        -- Record stock reservations
        IF v_recipe IS NOT NULL THEN
            FOR v_component IN SELECT * FROM recipe_components WHERE recipe_id = v_recipe.id AND component_type = 'RAW_INGREDIENT'
            LOOP
                v_required_qty := (v_component.quantity * (v_item->>'quantity')::INT * v_component.yield_factor);
                INSERT INTO stock_reservations (
                    party_id, order_id, order_item_id, ingredient_id, quantity, unit, status
                ) VALUES (
                    v_party.id, v_order_id, v_order_item_id, v_component.ingredient_id, v_required_qty, v_component.unit, 'RESERVED'
                );
            END LOOP;
        END IF;

        v_subtotal := v_subtotal + (v_menu_item.selling_price * (v_item->>'quantity')::INT);
    END LOOP;

    -- Update Order subtotal
    UPDATE orders SET subtotal = v_subtotal WHERE id = v_order_id;

    -- Update Party running total and state to FOOD_PENDING
    UPDATE dining_parties
    SET status = 'FOOD_PENDING',
        last_activity_at = NOW()
    WHERE id = v_party.id;

    -- Audit Log Event
    INSERT INTO kot_events (
        kot_id, kot_number, event_type, performed_by, role, delta_summary
    ) VALUES (
        v_kot_id, v_kot_number, 'CREATED', p_waiter_id, 'WAITER',
        'Created KOT with ' || jsonb_array_length(p_items)::TEXT || ' items. Subtotal: ₹' || v_subtotal::TEXT
    );

    RETURN jsonb_build_object(
        'success', true,
        'order_id', v_order_id,
        'order_number', v_order_number,
        'kot_id', v_kot_id,
        'kot_number', v_kot_number,
        'subtotal', v_subtotal
    );
END;
$$ LANGUAGE plpgsql;

-- ----------------------------------------------------------------------------
-- 3. COMMIT KOT & CONSUME STOCK TO LEDGER (UPON KITCHEN PREPARATION)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION commit_kot_consumption_tx(
    p_kot_id UUID,
    p_performed_by UUID
)
RETURNS JSONB AS $$
DECLARE
    v_kot RECORD;
    v_res RECORD;
    v_ing RECORD;
    v_new_balance NUMERIC(14,4);
BEGIN
    SELECT * INTO v_kot FROM kot WHERE id = p_kot_id FOR UPDATE;
    IF v_kot IS NULL THEN
        RAISE EXCEPTION 'KOT not found: %', p_kot_id;
    END IF;

    -- Process all pending reservations for this KOT
    FOR v_res IN
        SELECT r.*
        FROM stock_reservations r
        JOIN order_items oi ON r.order_item_id = oi.id
        WHERE oi.kot_id = p_kot_id AND r.status = 'RESERVED'
        FOR UPDATE
    LOOP
        -- Lock ingredient
        SELECT * INTO v_ing FROM ingredients WHERE id = v_res.ingredient_id FOR UPDATE;

        v_new_balance := v_ing.physical_stock - v_res.quantity;

        -- Update ingredient: decrement physical and reserved
        UPDATE ingredients
        SET physical_stock = v_new_balance,
            reserved_stock = GREATEST(0, reserved_stock - v_res.quantity),
            updated_at = NOW()
        WHERE id = v_ing.id;

        -- Write Immutable Stock Transaction
        INSERT INTO stock_transactions (
            ingredient_id, transaction_type, quantity, unit, direction,
            reference_type, reference_id, unit_cost, total_value, running_balance,
            performed_by, notes
        ) VALUES (
            v_ing.id, 'SALE_CONSUMPTION', v_res.quantity, v_res.unit, 'OUT',
            'KOT_ORDER', v_kot.kot_number, v_ing.weighted_avg_cost_per_unit,
            (v_res.quantity * v_ing.weighted_avg_cost_per_unit), v_new_balance,
            p_performed_by, 'Recipe consumption for ' || v_kot.kot_number
        );

        -- Mark reservation as consumed
        UPDATE stock_reservations SET status = 'CONSUMED' WHERE id = v_res.id;
    END LOOP;

    -- Update KOT status to PREPARING / READY
    UPDATE kot
    SET status = 'PREPARING',
        acknowledged_at = COALESCE(acknowledged_at, NOW())
    WHERE id = p_kot_id;

    RETURN jsonb_build_object('success', true, 'kot_number', v_kot.kot_number);
END;
$$ LANGUAGE plpgsql;

-- ----------------------------------------------------------------------------
-- 4. PROCESS BILL PAYMENT & SETTLE PARTY / TABLE OCCUPANCY
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION process_bill_payment_tx(
    p_bill_id UUID,
    p_payment_method VARCHAR(50),
    p_amount NUMERIC(12,2),
    p_reference VARCHAR(100),
    p_cashier_id UUID
)
RETURNS JSONB AS $$
DECLARE
    v_bill RECORD;
    v_new_paid NUMERIC(12,2);
    v_new_balance NUMERIC(12,2);
    v_table_active_parties INT;
BEGIN
    SELECT * INTO v_bill FROM bills WHERE id = p_bill_id FOR UPDATE;
    IF v_bill IS NULL THEN
        RAISE EXCEPTION 'Bill not found: %', p_bill_id;
    END IF;

    -- Record Payment
    INSERT INTO payments (
        bill_id, payment_method, amount, transaction_reference,
        received_by, status
    ) VALUES (
        p_bill_id, p_payment_method, p_amount, p_reference,
        p_cashier_id, 'SUCCESS'
    );

    v_new_paid := v_bill.paid_amount + p_amount;
    v_new_balance := GREATEST(0.00, v_bill.grand_total - v_new_paid);

    IF v_new_balance <= 0.00 THEN
        -- Bill Fully Paid
        UPDATE bills
        SET paid_amount = v_new_paid,
            balance_due = 0.00,
            status = 'PAID',
            settled_at = NOW()
        WHERE id = p_bill_id;

        -- Close the Dining Party
        UPDATE dining_parties
        SET status = 'CLOSED',
            closed_at = NOW()
        WHERE id = v_bill.party_id;

        -- Check Physical Table occupancy: any other active parties?
        SELECT COUNT(*) INTO v_table_active_parties
        FROM dining_parties
        WHERE table_id = v_bill.table_id
          AND status NOT IN ('CLOSED', 'CANCELLED');

        IF v_table_active_parties = 0 THEN
            UPDATE dining_tables SET status = 'AVAILABLE', updated_at = NOW() WHERE id = v_bill.table_id;
        ELSIF v_table_active_parties = 1 THEN
            UPDATE dining_tables SET status = 'OCCUPIED', updated_at = NOW() WHERE id = v_bill.table_id;
        ELSE
            UPDATE dining_tables SET status = 'SHARED', updated_at = NOW() WHERE id = v_bill.table_id;
        END IF;

    ELSE
        -- Partially Paid
        UPDATE bills
        SET paid_amount = v_new_paid,
            balance_due = v_new_balance,
            status = 'PARTIALLY_PAID'
        WHERE id = p_bill_id;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'bill_number', v_bill.bill_number,
        'paid_amount', v_new_paid,
        'balance_due', v_new_balance,
        'is_fully_paid', (v_new_balance <= 0.00)
    );
END;
$$ LANGUAGE plpgsql;
