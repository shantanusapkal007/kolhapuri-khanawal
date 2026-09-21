# PRODUCTION_BASELINE.md — Kolhapuri Khanawal POS System

**Date:** September 21, 2026  
**Document Version:** 1.0.0 (Pre-Migration Baseline)  
**Status:** Verified Working Baseline (37 Test Files, 265 Tests Passing, Build Clean)

---

## 1. Current Architecture & Data Flow

```
┌────────────────────────────────────────────────────────────────────────┐
│                          CLIENT PWA LAYER                              │
│  React 19 / Next.js 16.3.4 (App Router) • Service Worker (sw.js)      │
│  Tailwind CSS 4 • Lucide Icons • Haptics • Android Back Button Trap   │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   CLIENT STATE & BUSINESS LOGIC                        │
│  globalRestaurantStore (RestaurantStore singleton)                     │
│  - In-memory objects: tables, parties, orders, kots, bills, ledger     │
│  - Browser persistence: localStorage ("kk_live_operations_v1", etc.)  │
│  - Cross-tab bus: BroadcastChannel("kk_operational_sync_bus")         │
└──────────────────┬───────────────────────────────────┬─────────────────┘
                   │                                   │
                   ▼ (Every 80ms / Poll 4s)            ▼ (Print Action)
┌──────────────────────────────────────┐   ┌─────────────────────────────┐
│       SERVER RELAY (EPHEMERAL)       │   │     HARDWARE PRINTING       │
│  Next.js API Route Handlers          │   │  - ESC/POS over RawBT       │
│  - GET /api/sync (in-memory cache)   │   │  - TCP 9100 (/api/print)    │
│  - POST /api/sync (full snapshot)    │   │  - Print Bridge (:9180)     │
│  * NO PERSISTENT DATABASE CONNECTED  │   │  - Browser window.print()   │
└──────────────────────────────────────┘   └─────────────────────────────┘
```

### Key Data Flows
1. **Order & KOT Flow:**  
   UI (`WaiterOrderClient.tsx`) $\rightarrow$ `store.placeOrder()` $\rightarrow$ `order-service.ts` $\rightarrow$ `store.orders.push()`, `store.kots.push()` $\rightarrow$ Save to `localStorage["kk_live_operations_v1"]` $\rightarrow$ POST full snapshot to `/api/sync`.
2. **Billing Flow:**  
   UI (`billing/page.tsx`) $\rightarrow$ `store.generateBillForParty()` $\rightarrow$ `billing-service.ts` $\rightarrow$ `store.payBill()` $\rightarrow$ Update party to `CLOSED` $\rightarrow$ Refresh table status $\rightarrow$ Dispatch ESC/POS drawer kick and receipt print.
3. **Multi-Device Polling:**  
   Other client devices poll `GET /api/sync` every 4,000ms. If server version > local version, client runs `applySyncSnapshot()`, replacing their entire in-memory dataset with the server snapshot.

---

## 2. Existing Working Features Inventory

### A. Order Taking & Waiter POS
- **Fast 1-Tap Ordering:** High-speed ordering screen without confirmation dialogs.
- **Draft Cart Persistence:** Uncommitted items survive table hops without loss (`getDraftCart` / `saveDraftCart` per party).
- **Dish Variants Stepper:** Half and Full variants with automatic proportional pricing (Handi, Sukka, Biryani, Curries).
- **Bilingual Menu Search:** Instant real-time filtering in authentic Devanagari (`चिकन`, `मटण`, `भाकरी`, `पाणी`) and English.
- **Quick Quantity Chips:** `+1`, `+2`, `+5` one-tap increments on item cards.
- **Fast Sellers Strip ("वारंवार मागवले जाणारे"):** High-frequency thalis, bhakris, rassa, solkadhi, and water bottles at the top of the menu.
- **Cooking Instructions Pills:** Pre-set tags (`कमी तिखट`, `झणझणीत`, `रस्सा वेगळा`, `गरम द्या`) avoiding on-screen typing.

### B. Dining Floor & Tables
- **11 Physical Tables:** Structured as Section A (`A1`..`A3`), Section B (`B1`..`B4`), Section C (`C1`..`C4`).
- **Dynamic Occupancy:** Real-time calculation of active parties and guest count per table.
- **Takeaway / Parcel Flow:** Dedicated Parcel mode with automatic packaging charge calculations.
- **Table Operations:** Table transfer, party merging, and item split to new tables.

### C. Kitchen Operations (KOT & KDS)
- **Station Routing:** Automatic dish routing to `MAIN_KITCHEN`, `THALI_SECTION`, `TANDOOR_BHAKRI`, `FRY_SECTION`, and `BEVERAGE_DESSERT`.
- **Continuous Ordering:** Waiters can add follow-up items continuously without losing table context.
- **Kitchen Display Screen (`/kitchen`):** Audio chimes, status progression (`RECEIVED` $\rightarrow$ `PREPARING` $\rightarrow$ `READY` $\rightarrow$ `SERVED`), and ticket timers.

### D. Billing, Cashier & Payments
- **Statutory Calculation Engine:** GST calculation (5% or 0% exempt mode), proportional discount scaling per CGST Act Sec 15(3), and mathematical roundoff to the nearest rupee.
- **1-Tap Cash Settlement:** Single tap records cash payment, clears balance, closes party, kicks ESC/POS cash drawer, and prints receipt.
- **1-Tap UPI Settlement:** Single tap records UPI payment with merchant QR reference and prints bill.
- **Custom / Split Tender:** Multi-tender support for split payments (Cash + UPI, partial amounts, UTR tracking).
- **Day-End Z-Report:** Aggregates gross sales, net sales, category totals, and payment breakdowns.

### E. Hardware Printing & ESC/POS Engine
- **Devanagari Bitmap Rasterization:** High-contrast 1-bit monochrome raster generator rendering Marathi script on 58mm and 80mm thermal paper.
- **Multi-Protocol Connectivity:**
  - RawBT Android Service (Intent and localhost WebSocket).
  - Direct TCP Port 9100 Network Socket dispatch via `/api/print/network`.
  - Local Print Bridge Daemon (`scripts/print-bridge.mjs` on port 9180).
  - Browser System Spooler iframe print fallback.
- **Duplicate Print Protection:** Spooler memory cache blocks identical print jobs within 10 seconds.

### F. PWA & Mobile Polish
- **Full Viewport Responsiveness:** Tested on 320px, 375px, 390px, 414px, and desktop 12-column grid.
- **Android Back Button Trap:** Intercepts hardware back button to close modals/sheets before exiting the PWA.
- **Haptic Feedback:** Tactile confirmation on buttons and success alerts.
- **Offline Shell:** Service worker pre-caches assets for offline startup.

---

## 3. Existing Routes & APIs

### App Routes (45 compiled routes):
- `/` — Role router
- `/login` — Waiter & Admin authentication portal
- `/dashboard` — Restaurant owner KPI dashboard & checklist tracker
- `/waiter` — Floor layout & table occupancy map
- `/waiter/order/[partyId]` — High-speed waiter order taking screen
- `/kitchen` — Live Kitchen Display System (KDS)
- `/billing` — Cashier billing, multi-tender settlement & Z-report
- `/menu` — Menu catalog management & pricing
- `/inventory` — Stock levels, WAC costing, par levels & reorder alerts
- `/recipes` — Recipe BOM definitions & dish cost breakdowns
- `/purchases` — Fast vendor purchase entries
- `/purchase-planner` — Predictive procurement recommendations
- `/suppliers` — Supplier ledger & advance management
- `/expenses` — 6-bucket hotel expense entry & analytics
- `/cash-upi` — Cash drawer & UPI ledger reconciliation
- `/checklists` — Morning opening and night closing checklists
- `/daily-closing` — End-of-day register closing snapshot
- `/reports` — Inventory variance & theoretical leakage analytics
- `/settings` — Restaurant profile, GST rates, printer config & backup

### API Route Handlers:
- `GET /api/sync` — Retrieves in-memory server state snapshot
- `POST /api/sync` — Pushes client state snapshot to in-memory relay
- `GET /api/print/network` — Probes/scans network thermal printers on port 9100
- `POST /api/print/network` — Dispatches raw ESC/POS bytes over TCP socket
- `GET /api/print/bridge` — Health check for local print bridge daemon
- `POST /api/print/bridge` — Proxies print jobs to local bridge daemon

---

## 4. Existing Tests & Verification Status

- **Test Runner:** Vitest v3.2.7
- **Test Files:** 37 passed (100%)
- **Total Tests:** 265 passed (100%)
- **TypeScript Check (`tsc --noEmit`):** 0 errors
- **Production Build (`next build`):** Compiled successfully (45 static/SSG/dynamic routes)

---

## 5. Known Production Risks & Architectural Vulnerabilities

| Area | Vulnerability | Severity |
| :--- | :--- | :---: |
| **Persistence** | Zero persistent database. Data resides in client `localStorage` and node process memory. | 🔴 P0 |
| **Concurrency** | Full snapshot replacement in `/api/sync` causes concurrent orders from multiple devices to overwrite each other. | 🔴 P0 |
| **Security** | No server-side auth or route guards (`middleware.ts`). Default unauthenticated user has `WAITER` role. | 🔴 P0 |
| **Sequences** | In-memory sequence counters (`kotSequence`, `billSequence`) collide across devices and reset on page reload. | 🔴 P0 |
| **Billing** | Applying a discount burns a new statutory bill number; open bills do not auto-refresh when new KOT items arrive. | 🔴 P0 |
| **Inventory** | Stock checks are client-side in-memory; simultaneous orders for the last serving cause negative physical stock. | 🔴 P0 |
| **Scalability** | Serializing full operational state to `localStorage` will hit the 5MB browser quota within 1–2 weeks. | 🟠 P1 |

---

## 6. Features That Must Remain Unchanged

1. **Order Taking Speed & UX:** No confirmation popups, 1-tap item add, quick chips, Half/Full variant toggles.
2. **Draft Cart Auto-Persistence:** Switching tables must never lose uncommitted draft carts.
3. **11 Tables Architecture:** Table naming (`A1`..`A3`, `B1`..`B4`, `C1`..`C4`) and section filters.
4. **Devanagari Bilingual Formatting:** Authentic Marathi dish names on KOTs, bills, and search.
5. **1-Tap Cash & UPI Settlement:** Instant closing with ESC/POS drawer kick.
6. **Printer Multi-Engine:** RawBT, TCP 9100, print bridge, and browser fallback.
7. **PWA Standalone UX:** Android back-button trap and haptics.
