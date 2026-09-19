-- ============================================================================
-- KOLHAPURI KHANAWAL RESTAURANT OPERATING SYSTEM
-- Migration 004: Production Seed Data for Kolhapuri Khanawal
-- ============================================================================

-- 1. RESTAURANT RECORD
INSERT INTO restaurants (id, name, tagline, address, phone, gstin, fssai_number, currency, timezone, receipt_footer)
VALUES (
    'a0000000-0000-0000-0000-000000000001',
    'Kolhapuri Khanawal',
    'Authentic Kolhapuri Jevhan & Royal Thalis',
    'CSMT Station Road, Shahupuri, Kolhapur, Maharashtra 416001',
    '+91 98230 12345',
    '27AAAAA0000A1Z5',
    '11521000000001',
    'INR',
    'Asia/Kolkata',
    'धन्यवाद! पुन्हा भेट द्या! (Thank you! Visit again!)'
) ON CONFLICT DO NOTHING;

INSERT INTO restaurant_settings (restaurant_id, negative_stock_policy, auto_kds_routing, table_count, service_charge_percentage)
VALUES (
    'a0000000-0000-0000-0000-000000000001',
    'BLOCK',
    TRUE,
    12,
    0.00
) ON CONFLICT DO NOTHING;

-- 2. ROLES
INSERT INTO roles (id, code, name, description) VALUES
('b0000000-0000-0000-0000-000000000001', 'OWNER', 'Owner', 'Full access to financial, operational, and audit controls'),
('b0000000-0000-0000-0000-000000000002', 'MANAGER', 'Restaurant Manager', 'Daily operations, overrides, staff, and inventory management'),
('b0000000-0000-0000-0000-000000000003', 'CASHIER', 'Cashier', 'Billing, multi-tender payments, and shift reconciliation'),
('b0000000-0000-0000-0000-000000000004', 'WAITER', 'Service Staff / Waiter', 'Table occupancy, quick ordering, and KOT generation'),
('b0000000-0000-0000-0000-000000000005', 'KITCHEN', 'Kitchen Staff / Chef', 'Kitchen display system, KOT preparation and fulfillment'),
('b0000000-0000-0000-0000-000000000006', 'INVENTORY_MANAGER', 'Inventory Storekeeper', 'Purchase receiving, stock counts, and wastage logging')
ON CONFLICT DO NOTHING;

-- 3. APP USERS
INSERT INTO app_users (id, email, name, phone, role_id, pin_hash) VALUES
('c0000000-0000-0000-0000-000000000001', 'owner@kolhapurikhanawal.com', 'Shantanu (Owner)', '+91 98000 00001', 'b0000000-0000-0000-0000-000000000001', '1234'),
('c0000000-0000-0000-0000-000000000002', 'manager@kolhapurikhanawal.com', 'Vikram Patil (Manager)', '+91 98000 00002', 'b0000000-0000-0000-0000-000000000002', '1234'),
('c0000000-0000-0000-0000-000000000003', 'cashier@kolhapurikhanawal.com', 'Priya Kulkarni (Cashier)', '+91 98000 00003', 'b0000000-0000-0000-0000-000000000003', '1234'),
('c0000000-0000-0000-0000-000000000004', 'waiter.rahul@kolhapurikhanawal.com', 'Rahul Shinde (Waiter)', '+91 98000 00004', 'b0000000-0000-0000-0000-000000000004', '1234'),
('c0000000-0000-0000-0000-000000000005', 'waiter.amit@kolhapurikhanawal.com', 'Amit Jadhav (Waiter)', '+91 98000 00005', 'b0000000-0000-0000-0000-000000000004', '1234'),
('c0000000-0000-0000-0000-000000000006', 'chef.suresh@kolhapurikhanawal.com', 'Suresh Maharaj (Head Chef)', '+91 98000 00006', 'b0000000-0000-0000-0000-000000000005', '1234'),
('c0000000-0000-0000-0000-000000000007', 'inventory.mahesh@kolhapurikhanawal.com', 'Mahesh More (Storekeeper)', '+91 98000 00007', 'b0000000-0000-0000-0000-000000000006', '1234')
ON CONFLICT DO NOTHING;

-- 4. 12 PHYSICAL DINING TABLES
INSERT INTO dining_tables (id, table_number, name, min_capacity, max_capacity, section, status) VALUES
('d0000000-0000-0000-0000-000000000001', 1, 'Table 1', 1, 4, 'MAIN_HALL', 'AVAILABLE'),
('d0000000-0000-0000-0000-000000000002', 2, 'Table 2', 1, 4, 'MAIN_HALL', 'AVAILABLE'),
('d0000000-0000-0000-0000-000000000003', 3, 'Table 3', 1, 4, 'MAIN_HALL', 'AVAILABLE'),
('d0000000-0000-0000-0000-000000000004', 4, 'Table 4 (Window)', 2, 6, 'MAIN_HALL', 'AVAILABLE'),
('d0000000-0000-0000-0000-000000000005', 5, 'Table 5 (Window)', 2, 6, 'MAIN_HALL', 'AVAILABLE'),
('d0000000-0000-0000-0000-000000000006', 6, 'Table 6 (Large Group)', 4, 8, 'MAIN_HALL', 'AVAILABLE'),
('d0000000-0000-0000-0000-000000000007', 7, 'Table 7', 1, 4, 'FAMILY_SECTION', 'AVAILABLE'),
('d0000000-0000-0000-0000-000000000008', 8, 'Table 8', 1, 4, 'FAMILY_SECTION', 'AVAILABLE'),
('d0000000-0000-0000-0000-000000000009', 9, 'Table 9 (Family Sofa)', 2, 6, 'FAMILY_SECTION', 'AVAILABLE'),
('d0000000-0000-0000-0000-000000000010', 10, 'Table 10 (Family Sofa)', 2, 6, 'FAMILY_SECTION', 'AVAILABLE'),
('d0000000-0000-0000-0000-000000000011', 11, 'Table 11 (Veranda)', 1, 4, 'OUTDOOR_VERANDA', 'AVAILABLE'),
('d0000000-0000-0000-0000-000000000012', 12, 'Table 12 (Veranda)', 1, 4, 'OUTDOOR_VERANDA', 'AVAILABLE')
ON CONFLICT DO NOTHING;

-- 5. KITCHEN STATIONS
INSERT INTO kitchen_stations (id, code, name, display_color) VALUES
('e0000000-0000-0000-0000-000000000001', 'MAIN_KITCHEN', 'Main Kitchen (Curry & Rassa)', '#DC2626'),
('e0000000-0000-0000-0000-000000000002', 'THALI_SECTION', 'Thali Assembly & Rice Section', '#D97706'),
('e0000000-0000-0000-0000-000000000003', 'TANDOOR_BHAKRI', 'Bhakri & Chapati Tawa Section', '#059669'),
('e0000000-0000-0000-0000-000000000004', 'FRY_SECTION', 'Sukka & Fry Pan Section', '#7C3AED'),
('e0000000-0000-0000-0000-000000000005', 'BEVERAGE_DESSERT', 'Solkadhi & Beverage Bar', '#0284C7')
ON CONFLICT DO NOTHING;

-- 6. CONFIGURABLE TAX RATES
INSERT INTO tax_rates (id, name, code, cgst_rate, sgst_rate, igst_rate, total_rate, is_tax_inclusive, is_tax_exempt) VALUES
('f0000000-0000-0000-0000-000000000001', 'Restaurant GST Standard (5%)', 'GST_5', 2.500, 2.500, 5.000, 5.000, FALSE, FALSE),
('f0000000-0000-0000-0000-000000000002', 'Exempt Goods (0%)', 'EXEMPT_0', 0.000, 0.000, 0.000, 0.000, FALSE, TRUE),
('f0000000-0000-0000-0000-000000000003', 'Alcohol / Liquor VAT (10%)', 'VAT_10', 0.000, 0.000, 0.000, 10.000, FALSE, FALSE)
ON CONFLICT DO NOTHING;

-- 7. MENU CATEGORIES
INSERT INTO menu_categories (id, name, local_name, code, display_order, icon_name) VALUES
('10000000-0000-0000-0000-000000000001', 'Special Thalis', 'शाही कोल्हापुरी थाळी', 'THALIS', 1, 'Utensils'),
('10000000-0000-0000-0000-000000000002', 'Sukka & Fry Specials', 'सुक्का आणि फ्राय विशेष', 'SUKKA_FRY', 2, 'Flame'),
('10000000-0000-0000-0000-000000000003', 'Bhakri & Roti', 'गरमागरम भाकरी आणि चपाती', 'BREADS', 3, 'Disc'),
('10000000-0000-0000-0000-000000000004', 'Rice & Dal', 'भात आणि वरण', 'RICE_DAL', 4, 'Soup'),
('10000000-0000-0000-0000-000000000005', 'Extra Portions', 'अतिरिक्त रस्सा / मटण / चिकन', 'EXTRAS', 5, 'PlusCircle'),
('10000000-0000-0000-0000-000000000006', 'Solkadhi & Beverages', 'सोलकढी आणि पेय', 'BEVERAGES', 6, 'CupSoda')
ON CONFLICT DO NOTHING;

-- 8. INGREDIENT CATEGORIES & RAW INGREDIENTS (With Initial Stock from prompt)
INSERT INTO ingredient_categories (id, name, code) VALUES
('20000000-0000-0000-0000-000000000001', 'Meat & Poultry', 'MEAT'),
('20000000-0000-0000-0000-000000000002', 'Grains & Flours', 'GRAINS'),
('20000000-0000-0000-0000-000000000003', 'Pulses & Dal', 'PULSES'),
('20000000-0000-0000-0000-000000000004', 'Vegetables & Aromatics', 'VEG'),
('20000000-0000-0000-0000-000000000005', 'Oils & Ghee', 'OILS'),
('20000000-0000-0000-0000-000000000006', 'Kolhapuri Spices & Masala', 'SPICES'),
('20000000-0000-0000-0000-000000000007', 'Dairy & Coconut', 'DAIRY')
ON CONFLICT DO NOTHING;

INSERT INTO ingredients (id, category_id, name, local_name, base_unit, physical_stock, par_level, reorder_level, critical_level, current_cost_per_unit, weighted_avg_cost_per_unit) VALUES
('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'Fresh Chicken', 'कोंबडी / चिकन', 'kg', 2.0000, 10.0000, 5.0000, 1.0000, 240.00, 240.00),
('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', 'Fresh Mutton (Goat)', 'बोकडाचे मटण', 'kg', 5.0000, 15.0000, 6.0000, 2.0000, 750.00, 750.00),
('30000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000002', 'Indrayani Rice', 'इंद्रायणी सुगंधी तांदूळ', 'kg', 15.0000, 30.0000, 10.0000, 3.0000, 65.00, 65.00),
('30000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000003', 'Toor Dal', 'तुरीची डाळ', 'kg', 8.0000, 15.0000, 5.0000, 2.0000, 160.00, 160.00),
('30000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000004', 'Seasonal Vegetables (Bhaji)', 'मिश्र भाजी', 'kg', 5.0000, 12.0000, 4.0000, 1.5000, 50.00, 50.00),
('30000000-0000-0000-0000-000000000006', '20000000-0000-0000-0000-000000000005', 'Cold Pressed Groundnut Oil', 'शेंगदाणा तेल', 'l', 10.0000, 20.0000, 6.0000, 2.0000, 180.00, 180.00),
('30000000-0000-0000-0000-000000000007', '20000000-0000-0000-0000-000000000002', 'Fresh Chapati Wheat', 'चपाती (तयार)', 'piece', 150.0000, 300.0000, 100.0000, 20.0000, 6.00, 6.00),
('30000000-0000-0000-0000-000000000008', '20000000-0000-0000-0000-000000000002', 'Jowar Flour for Bhakri', 'ज्वारीचे पीठ', 'kg', 12.0000, 25.0000, 8.0000, 3.0000, 45.00, 45.00),
('30000000-0000-0000-0000-000000000009', '20000000-0000-0000-0000-000000000006', 'Special Kolhapuri Kanda Lasun Masala', 'कांदा लसूण मसाला', 'kg', 6.0000, 10.0000, 3.0000, 1.0000, 350.00, 350.00),
('30000000-0000-0000-0000-000000000010', '20000000-0000-0000-0000-000000000007', 'Coconut Milk & Kokum Extract', 'नारळ दूध आणि कोकम', 'l', 5.0000, 10.0000, 3.0000, 1.0000, 120.00, 120.00)
ON CONFLICT DO NOTHING;

-- 9. MENU ITEMS & RECIPES
INSERT INTO menu_items (id, category_id, name, local_name, code, description, selling_price, cost_price, is_veg, is_thali, station_id, tax_rate_id, is_daily_special, preparation_time_minutes) VALUES
('40000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Special Chicken Thali', 'स्पेशल चिकन थाळी (तांबडा-पांढरा रस्सा)', 'THALI_CHICKEN', 'Authentic Kolhapuri Chicken Thali with Chicken Sukka, Tambda Rassa, Pandhra Rassa, 2 Chapatis, Indrayani Rice, Dal & Kanda-Limbu', 320.00, 92.50, FALSE, TRUE, 'e0000000-0000-0000-0000-000000000002', 'f0000000-0000-0000-0000-000000000001', FALSE, 10),
('40000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'Special Mutton Thali', 'स्पेशल मटण थाळी', 'THALI_MUTTON', 'Tender Goat Mutton Sukka, Tambda Rassa, Pandhra Rassa, 2 Bhakri/Chapati, Rice & Dal', 440.00, 145.00, FALSE, TRUE, 'e0000000-0000-0000-0000-000000000002', 'f0000000-0000-0000-0000-000000000001', FALSE, 12),
('40000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', 'Kolhapuri Veg Thali', 'शाकाहारी कोल्हापुरी थाळी', 'THALI_VEG', 'Pithla Bhakri / Shev Bhaji, Dal Tadka, Indrayani Bhaat, 2 Chapatis, Sweet & Solkadhi', 220.00, 55.00, TRUE, TRUE, 'e0000000-0000-0000-0000-000000000002', 'f0000000-0000-0000-0000-000000000001', FALSE, 8),
('40000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000003', 'Jowar Bhakri', 'गरमागरम ज्वारीची भाकरी', 'BHAKRI_JOWAR', 'Freshly roasted traditional Jowar Bhakri with butter', 25.00, 7.50, TRUE, FALSE, 'e0000000-0000-0000-0000-000000000003', 'f0000000-0000-0000-0000-000000000001', FALSE, 4),
('40000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000003', 'Chapati (Ghadichi Polli)', 'घडीची चपाती', 'CHAPATI', 'Soft wheat chapati with pure ghee', 15.00, 6.00, TRUE, FALSE, 'e0000000-0000-0000-0000-000000000003', 'f0000000-0000-0000-0000-000000000001', FALSE, 3),
('40000000-0000-0000-0000-000000000006', '10000000-0000-0000-0000-000000000004', 'Extra Indrayani Rice Bowl', 'इंद्रायणी भात वाटी', 'EXTRA_RICE', 'Fragrant steamed Indrayani rice', 60.00, 16.25, TRUE, FALSE, 'e0000000-0000-0000-0000-000000000002', 'f0000000-0000-0000-0000-000000000001', FALSE, 2),
('40000000-0000-0000-0000-000000000007', '10000000-0000-0000-0000-000000000005', 'Extra Chicken Sukka Plate', 'अतिरिक्त चिकन सुक्का वाटी', 'EXTRA_CHICKEN', 'Extra portion of spicy Kolhapuri Chicken Sukka', 180.00, 48.00, FALSE, FALSE, 'e0000000-0000-0000-0000-000000000004', 'f0000000-0000-0000-0000-000000000001', FALSE, 6),
('40000000-0000-0000-0000-000000000008', '10000000-0000-0000-0000-000000000006', 'Royal Kolhapuri Solkadhi Glass', 'शाही सोलकढी ग्लास', 'SOLKADHI', 'Fresh coconut milk and kokum with roasted cumin and garlic', 40.00, 12.00, TRUE, FALSE, 'e0000000-0000-0000-0000-000000000005', 'f0000000-0000-0000-0000-000000000001', FALSE, 1),
('40000000-0000-0000-0000-000000000009', '10000000-0000-0000-0000-000000000006', 'Mattha / Buttermilk', 'ताक / मठ्ठा', 'BUTTERMILK', 'Refreshing churned spiced buttermilk with coriander and ginger', 30.00, 8.00, TRUE, FALSE, 'e0000000-0000-0000-0000-000000000005', 'f0000000-0000-0000-0000-000000000001', FALSE, 1),
('40000000-0000-0000-0000-000000000010', '10000000-0000-0000-0000-000000000006', 'Water Bottle (Small 500ml)', 'पाण्याची बाटली (लहान ५०० मिली)', 'WATER_500ML', 'Chilled packaged drinking water bottle (500 ml)', 10.00, 6.00, TRUE, FALSE, 'e0000000-0000-0000-0000-000000000005', 'f0000000-0000-0000-0000-000000000002', FALSE, 1),
('40000000-0000-0000-0000-000000000011', '10000000-0000-0000-0000-000000000006', 'Water Bottle (Big 1 Litre)', 'पाण्याची बाटली (मोठी १ लिटर)', 'WATER_1L', 'Chilled packaged drinking water bottle (1 Litre)', 20.00, 12.00, TRUE, FALSE, 'e0000000-0000-0000-0000-000000000005', 'f0000000-0000-0000-0000-000000000002', FALSE, 1)
ON CONFLICT DO NOTHING;

-- 10. RECIPES (With exact quantities from scenario: 100g Chicken, 250g Rice, 150g Dal, 100g Bhaji, 2 Chapatis, 15ml Oil, 5g Spices)
INSERT INTO recipes (id, menu_item_id, portions_yielded, estimated_cost, preparation_time_minutes) VALUES
('50000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', 1.00, 92.50, 10),
('50000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000008', 1.00, 12.00, 1)
ON CONFLICT DO NOTHING;

-- Chicken Thali Components
INSERT INTO recipe_components (recipe_id, component_type, ingredient_id, quantity, unit, yield_factor) VALUES
('50000000-0000-0000-0000-000000000001', 'RAW_INGREDIENT', '30000000-0000-0000-0000-000000000001', 0.1000, 'kg', 1.0000), -- 100g Chicken
('50000000-0000-0000-0000-000000000001', 'RAW_INGREDIENT', '30000000-0000-0000-0000-000000000003', 0.2500, 'kg', 1.0000), -- 250g Rice
('50000000-0000-0000-0000-000000000001', 'RAW_INGREDIENT', '30000000-0000-0000-0000-000000000004', 0.1500, 'kg', 1.0000), -- 150g Dal
('50000000-0000-0000-0000-000000000001', 'RAW_INGREDIENT', '30000000-0000-0000-0000-000000000005', 0.1000, 'kg', 1.0000), -- 100g Bhaji
('50000000-0000-0000-0000-000000000001', 'RAW_INGREDIENT', '30000000-0000-0000-0000-000000000007', 2.0000, 'piece', 1.0000), -- 2 Chapatis
('50000000-0000-0000-0000-000000000001', 'RAW_INGREDIENT', '30000000-0000-0000-0000-000000000006', 0.0150, 'l', 1.0000), -- 15ml Oil
('50000000-0000-0000-0000-000000000001', 'RAW_INGREDIENT', '30000000-0000-0000-0000-000000000009', 0.0050, 'kg', 1.0000) -- 5g Spices
ON CONFLICT DO NOTHING;

-- Solkadhi Components
INSERT INTO recipe_components (recipe_id, component_type, ingredient_id, quantity, unit, yield_factor) VALUES
('50000000-0000-0000-0000-000000000002', 'RAW_INGREDIENT', '30000000-0000-0000-0000-000000000010', 0.1000, 'l', 1.0000)
ON CONFLICT DO NOTHING;
