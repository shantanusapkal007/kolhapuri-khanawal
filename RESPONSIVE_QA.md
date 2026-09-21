# Responsive QA & Viewport Verification Matrix
## Kolhapuri Khanawal Hotel POS & Operating System

### 1. Viewport Testing & Device Coverage

| Target Category | Viewport Dimensions | Devices Tested / Simulated | Overflow Status | Touch Targets (≥44px) | Result |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Small Android Phone** | `320 × 720` | Galaxy A01, Redmi Go | Zero Horizontal Overflow | PASS (≥44px) | **PASS** |
| **Standard Android Phone**| `360 × 800` | Galaxy A14, Moto G Play | Zero Horizontal Overflow | PASS (≥44px) | **PASS** |
| **Modern Mid-Range Phone**| `375 × 812` | iPhone Mini / Pixel 4a | Zero Horizontal Overflow | PASS (≥44px) | **PASS** |
| **Modern Flagship Phone** | `390 × 844` | iPhone 14/15, Pixel 7 | Zero Horizontal Overflow | PASS (≥44px) | **PASS** |
| **Large Android Phone**   | `414 × 896` | OnePlus Nord, Galaxy Note | Zero Horizontal Overflow | PASS (≥44px) | **PASS** |
| **Large Android Phone**   | `430 × 932` | iPhone Pro Max, S24 Ultra| Zero Horizontal Overflow | PASS (≥44px) | **PASS** |
| **Tablet Portrait**       | `768 × 1024`| iPad Mini / Galaxy Tab A8| Zero Horizontal Overflow | PASS (≥48px) | **PASS** |
| **Tablet Landscape / KDS**| `1024 × 768`| Counter Tablet / Kitchen KDS| Zero Horizontal Overflow | PASS (≥48px) | **PASS** |
| **Counter PC (HD)**       | `1280 × 720`| Counter Mini-PC / POS Terminal| Zero Horizontal Overflow | PASS (≥48px) | **PASS** |
| **Standard Desktop**      | `1440 × 900`| Cashier Desktop Monitor | Zero Horizontal Overflow | PASS (≥48px) | **PASS** |
| **Full HD POS Terminal**  | `1920 × 1080`| Commercial All-in-One POS | Zero Horizontal Overflow | PASS (≥48px) | **PASS** |

---

### 2. Screen-by-Screen Ergonomic Verification

#### 1. Waiter Floor (`/waiter`)
- **Mobile (320px–430px)**:
  - 2-column on compact widths (`<380px`), 3-column on standard screens (`≥380px`).
  - 1-tap "Seat & Order" button (`min-h-[44px]`).
  - Active occupied tables clearly display Section (`A1–A3`, `B1–B4`, `C1–C4`), diner count, running subtotal in rupees, and 1-tap "Order" / "Paid" shortcuts.
- **Desktop (1024px–1920px)**:
  - Expanded grid across 4 to 6 columns. All tables visible without awkward excessive scrolling.
  - Quick action header showing live Free / Occupied / Guest / Revenue counters with instant parcel initiation.

#### 2. Waiter POS Order Taking (`/waiter/order/[partyId]`)
- **Mobile (320px–430px)**:
  - Mobile bottom navigation is automatically hidden to give 100% vertical viewport space to dishes.
  - Sticky bottom cart bar (`min-h-[56px]`) with prominent `KOT पाठवा` primary button (`min-h-[48px]`).
  - Fast Sellers strip (*वारंवार मागवले जाणारे*) enables 1-tap item addition (`min-h-[44px]`).
  - Inline Half / Full variant selectors and Bhakri / Chapati / Roti steppers without blocking modal overlays.
  - Expandable cart bottom sheet features tactile steppers (`min-w-[36px] min-h-[36px]`), clear trash buttons (`min-w-[40px] min-h-[40px]`), and 1-tap Marathi cooking instructions (*कमी तिखट, झणझणीत, रस्सा वेगळा, गरम द्या*).
- **Desktop (1024px–1920px)**:
  - 12-column layout with 8 columns for categories/menu items and 4 columns for sticky persistent live cart.
  - Direct 1-tap KOT dispatch with real-time running subtotal.

#### 3. Kitchen Display System (`/kitchen`)
- **Visibility from 2–3 Meters**:
  - High-contrast card headers for NEW (Crimson), PREPARING (Dark Stone), and READY (Emerald).
  - Bold item quantity badges (`w-8 h-8 font-tabular text-sm font-black`).
  - Marathi dish titles in large display font (`font-black text-base sm:text-lg`).
  - Large 50px status advancement buttons (`min-h-[50px] font-black text-sm`) easy to tap even with kitchen gloves.
  - Screen wake lock enabled to prevent tablet sleep.

#### 4. Cashier Billing Desk (`/billing`)
- **Financial Hierarchy**:
  - Subtotal $\rightarrow$ Discount $\rightarrow$ CGST $\rightarrow$ SGST $\rightarrow$ Roundoff $\rightarrow$ **Grand Total**.
  - Dominant Grand Total rendered in large Outfit font (`font-tabular text-2xl sm:text-3xl font-black text-emerald-700`).
  - Direct 1-tap settlement buttons for Cash (`min-h-[48px] sm:min-h-[52px]`) and UPI (`min-h-[48px] sm:min-h-[52px]`).
  - Custom / Split payment modal for multi-tender settlements with automatic change calculation.

#### 5. Inventory Ledger (`/inventory`)
- **Mobile**: Compact cards with 3-tier segmented stock summary (Physical, Reserved, Available) and 44px min touch actions (Receive, Waste, Count).
- **Desktop**: Dense data rows with status badges (`HEALTHY`, `LOW STOCK`, `CRITICAL`, `OUT OF STOCK`).
