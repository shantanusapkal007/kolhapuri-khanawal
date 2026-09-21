# UI_AUDIT.md — Kolhapuri Khanawal Restaurant OS
**Comprehensive Frontend, UX, Visual Hierarchy & Performance Audit**
**Date:** September 21, 2026  
**Auditor:** Lead Frontend Architect & Performance Engineer  
**Baseline Verification Status:**
- `npm run typecheck`: **PASS (0 errors)**
- `npm test`: **PASS (51 test files, 301 tests passing)**
- `npx vitest run forensic`: **PASS (11 test files, 24 tests passing)**
- `npm run build`: **PASS (54/54 routes compiled cleanly)**

---

## 1. EXECUTIVE AUDIT SUMMARY

The Kolhapuri Khanawal Restaurant POS is functionally complete, rock-solid in its backend ACID persistence (Node 22 `node:sqlite`), and feature-rich. However, the frontend presentation and interaction layer currently exhibits several critical UX and operational friction points:

1. **Inconsistent Design System & Fragmented Styles:**
   - Overlapping utility classes (`luxury-card`, `premium-card`, `glass-panel`, `glass-bottom-bar`, `animate-urgent`, `animate-bill-radar`) with ad-hoc box shadows, heavy gradient overlays, and arbitrary padding (`p-2.5`, `p-5`, `p-8`).
   - Lack of a strict 4px/8px/12px/16px/20px/24px/32px spacing scale.
2. **Mobile Overcrowding (320px – 430px Android Phones):**
   - Top headers contain multiple simultaneous pills (occupancy, sync, printer, bell, user, parcel toggle) that squeeze and truncate page titles on screens under 390px.
   - Waiter order taking header displays up to 4 action buttons alongside running totals, risking accidental clicks during rush hours.
3. **Information Density & Screen Real Estate Utilization (Desktop ≥1024px):**
   - Sidebar takes up 288px (`lg:pl-72`), while the main container is restricted by `max-w-7xl` with excessive margins, leaving empty gutters on 1080p and 1440p displays.
4. **Waiter POS Ergonomics (Priority 1):**
   - `WaiterOrderClient.tsx` has grown to 2,654 lines with 10+ embedded modal states.
   - Modifiers and bread options sometimes prompt dialogs when inline stepper buttons would be 3x faster.
   - The sticky cart bar and bottom sheet need streamlined touch targets (minimum 48px for Send KOT) with instant haptic and visual feedback.
5. **Kitchen Display System (KDS):**
   - Visual distinction between `RECEIVED`, `PREPARING`, and `READY` is present but uses small badges that are difficult to discern from 2–3 meters in steam-filled kitchen environments.
6. **Cashier Billing Desk:**
   - Financial totals (Subtotal, GST, Roundoff, Grand Total) are scattered across tabs. The Grand Total and Payment Methods (CASH, UPI, CARD, SPLIT) need to be visually dominant and thumb-accessible.

---

## 2. DETAILED SCREEN-BY-SCREEN INVENTORY & PROBLEMS

### 1. Global Shell & Navigation
- **Routes:** All routes wrapped by `AppShell.tsx` (`TopHeader.tsx`, `Sidebar.tsx`, `MobileBottomNav.tsx`)
- **Primary Users:** Waiters, Cashiers, Kitchen Staff, Owner/Manager
- **Current Problems:**
  - **Desktop:** Sidebar is 288px wide with 22 menu items listed vertically. Navigation groups ("CORE OPERATIONS", "BACK-OFFICE") create visual noise with emojis and duplicate links (`/waiter` is listed in both groups).
  - **Mobile:** `TopHeader` contains 5 independent status buttons (`Menu`, `Title`, `Sync`, `Printer`, `Bell`), which wrap or overlap on 320px–360px widths.
  - **Bottom Navigation:** Bottom bar is present on all pages except `/waiter/order`, but has small labels and inconsistent touch feedback.
- **Proposed Redesign:**
  - Standardize Top Header to a clean, 52px fixed bar with clear breadcrumb identity, consolidated operational status pill (LAN + Printer in one compact widget), and prominent user profile.
  - Compact, modern desktop sidebar (240px) with clean grouping, subtle active indicator, and badge counts.
  - Mobile bottom navigation with 48px touch targets for the 4 core destinations: **Tables**, **Menu**, **Kitchen**, **Billing**.

---

### 2. Waiter POS Screen (`/waiter/order/[partyId]`) — HIGHEST PRIORITY
- **File:** `src/app/(waiter)/waiter/order/[partyId]/WaiterOrderClient.tsx`
- **Primary User:** Waiter taking orders tableside on an Android smartphone
- **Primary Task:** Select items $\rightarrow$ customize (Half/Full, Bhakri) $\rightarrow$ send KOT in <15 seconds
- **Current Problems:**
  - Header has too many competing elements: Back arrow, Table pill, Customer name button, Bill total tile, Parcel button, More menu button.
  - Search bar input has smaller font on iOS/Android causing zoom triggers if not forced to 16px.
  - Category horizontal scrolling strip has small padding and lacks clear edge fading.
  - Half/Full variant toggles sometimes get lost below long dish descriptions.
  - Sticky bottom cart bar has multiple buttons with text that truncates on 320px screens.
- **Proposed Redesign:**
  - **Sleek Header (48px):** Clean back button, bold Table badge (`TABLE A1`), party guest count, and dominant running total.
  - **Fast Sellers Strip (*वारंवार मागवले जाणारे*):** Prominent horizontal chips with 1-tap addition for Water Bottles, Extra Rassa, Bhakri, and Thalis.
  - **Product Cards:** 2-line clean hierarchy: Bold Devanagari local name + English subtitle, clear price in tabular numerals, inline Half/Full selector, and large 44px `+` / `-` quantity buttons.
  - **Sticky Bottom Cart Bar:** High-contrast floating bar: `[ 3 Items • ₹650 ]` with a prominent, visually dominant `[ SEND KOT ]` button (height 50px).
  - **Cart Bottom Sheet:** Smooth slide-up drawer with internal scrolling, instant quantity editing, bread selection pills, and sticky bottom action bar.

---

### 3. Floor & Dining Tables (`/waiter`)
- **File:** `src/app/(waiter)/waiter/page.tsx`
- **Primary Users:** Waiter (seating & ordering), Cashier (monitoring table status)
- **Primary Task:** Identify free tables, open dining party, initiate order, transfer table
- **Current Problems:**
  - 11 tables (`A1..A3`, `B1..B4`, `C1..C4`) are displayed as cards with varying heights depending on guest count and notes.
  - Status colors (`AVAILABLE`, `OCCUPIED`, `SHARED`, `BILL_REQUESTED`) use gradient borders with blinking animations (`animate-bill-radar`) that can cause visual fatigue.
  - Filter bar has 10 tabs (`ALL`, `SECTION_A`, `SECTION_B`, `SECTION_C`, `AVAILABLE`, `OCCUPIED`, `SHARED`, `BILL_REQUESTED`, `PARCELS`, `DELIVERY`), causing horizontal overflow.
- **Proposed Redesign:**
  - Uniform, clean table cards grouped logically into Section A, B, and C grids.
  - Clean, restrained status indicators:
    - `AVAILABLE`: Crisp neutral border, capacity indicator, 1-tap "Open Table".
    - `OCCUPIED`: Warm amber accent, party code, running total, elapsed time, 1-tap "Order".
    - `BILL REQUESTED`: Radiant amber badge, total due, 1-tap "Settle / Bill".
  - Streamlined segmented control for sections and quick status filters.

---

### 4. Kitchen Display System (`/kitchen`)
- **File:** `src/app/(kitchen)/kitchen/page.tsx`
- **Primary User:** Kitchen Cook / Kitchen Supervisor (viewing from 2–3 meters)
- **Primary Task:** Read incoming KOTs, see dish quantities and cooking instructions, advance status
- **Current Problems:**
  - KOT cards use small text for table numbers and items.
  - Elapsed timers use small fonts.
  - Modifiers (e.g. `रस्सा वेगळा`, `कमी तिखट`) blend into the item name text.
- **Proposed Redesign:**
  - Large, bold card header: Giant table identifier (`TABLE A1` / `PARCEL P01`), bold KOT sequence (`KOT #1`), high-contrast elapsed timer.
  - High-visibility item rows: Quantity in a large tabular badge (`2×`), bold Marathi item name, and highlighted modifier pills.
  - 48px tactile status progression button: `RECEIVED` $\rightarrow$ `PREPARING` $\rightarrow$ `READY` $\rightarrow$ `SERVED`.

---

### 5. Cashier Billing Desk (`/billing`)
- **File:** `src/app/(cashier)/billing/page.tsx`
- **Primary User:** Cashier / Manager
- **Primary Task:** Verify ordered items, apply discount if authorized, settle payment via Cash/UPI, print receipt
- **Current Problems:**
  - Split view on desktop has table list on left and receipt on right, but the bill breakdown is cluttered with tabs (`ALL`, `BY_SEAT`).
  - Grand Total is not immediately the most dominant figure on the screen.
  - Payment buttons (CASH, UPI, CARD, SPLIT) are buried inside an extra popup modal.
- **Proposed Redesign:**
  - Desktop 2-column layout: Left column = Active Seated Tables list; Right column = Active Bill Settlement Workspace.
  - Clear financial hierarchy:
    - Subtotal
    - Discount (with 1-tap preset chips: 5%, 10%, ₹50)
    - Net Taxable
    - CGST (2.5%) + SGST (2.5%)
    - Roundoff
    - **GRAND TOTAL (Giant font, high contrast, dominant)**
  - Direct 1-tap payment selection on the billing screen (no unnecessary popups):
    - `[ CASH ]` (pre-fills exact amount, 1-tap settle + drawer kick)
    - `[ UPI ]` (shows merchant QR code + UTR reference input)
    - `[ SPLIT ]` (cash + UPI split)
  - Full-width, prominent `PAY & PRINT` action button with double-tap protection.

---

### 6. Back-Office Screens (Dashboard, Inventory, Reports, Settings)
- **Files:** `src/app/(admin)/dashboard/page.tsx`, `inventory/page.tsx`, `reports/page.tsx`, `settings/page.tsx`
- **Primary Users:** Restaurant Owner, General Manager
- **Current Problems:**
  - Dashboard has oversized cards with lots of decorative text and redundant stat cards.
  - Inventory table has horizontal overflow on tablets and small laptops.
  - Reports display charts that don't scale cleanly on mobile viewports.
- **Proposed Redesign:**
  - Clean KPI metric cards with tabular numbers and clear change indicators.
  - Dense, responsive data tables with horizontal scroll containment and column priority hiding.
  - Mobile card-list view for inventory stock items with `IN STOCK`, `LOW STOCK`, and `CRITICAL` badges.

---

## 3. REUSABLE COMPONENT ARCHITECTURE PLAN

Instead of repeating styling and interaction code, the following shared UI primitives will be standardized:
1. `src/components/ui/StatusBadge.tsx`: Consistent badge for table states, KOT status, inventory levels.
2. `src/components/ui/PrimaryButton.tsx`: High-contrast, 48px touch target with loading spinner state and tactile press feedback.
3. `src/components/ui/QuantityStepper.tsx`: 44px `+` and `-` touch buttons with tabular quantity display.
4. `src/components/ui/BottomSheet.tsx`: Reusable mobile bottom drawer with backdrop blur, internal scroll, and swipe-down handle.
5. `src/components/ui/MetricCard.tsx`: Standardized KPI card for executive dashboard and reports.
6. `src/components/ui/SearchInput.tsx`: 44px search field with clear button and instant debounced/local filtering.

---

## 4. BASELINE COMPLIANCE CONFIRMATION

- **TypeScript:** 0 Errors
- **Tests:** 301/301 Passed
- **Forensic Integration:** 24/24 Passed
- **Build:** 54/54 Compiled Cleanly
- **Business Logic:** 100% Unaltered
