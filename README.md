# Kolhapuri Khanawal — Restaurant Operating System

Production-grade restaurant management operating system engineered specifically for **Kolhapuri Khanawal**, a traditional 12-table Maharashtrian restaurant serving authentic Thalis, Sukka dishes, Bhakri, and Solkadhi.

---

## 🍽️ Key Product Features

- **Decoupled Table & Shared Party Model:**
  - `Physical Table (1..12)` $\rightarrow$ `Dining Party (T{table}-P{party})` $\rightarrow$ `Order` $\rightarrow$ `KOT` $\rightarrow$ `Bill` $\rightarrow$ `Payments`.
  - Supports multiple independent customer parties sharing the same physical table with independent waiters, KOTs, bills, and payment settlements.
  - Supports 1-tap party transfers, party merges with audit log, and item/seat splitting.
- **Transactional Stock Ledger & 3-Tier Model:**
  - Double-entry stock movements (`PURCHASE`, `SALE_CONSUMPTION`, `WASTAGE`, `STOCK_COUNT`, `STOCK_ADJUSTMENT`).
  - 3-Tier State: $\text{Available Stock} = \text{Physical Stock} - \text{Reserved Stock}$.
  - Concurrency-safe atomic reservations with row-level locking (`SELECT ... FOR UPDATE`).
  - Strict negative-stock protection (blocks sales on insufficient inventory unless authorized manager override).
- **Culinary Preparations & Recipe Yields:**
  - $\text{Raw Ingredients} \rightarrow \text{Preparation Batches (Yield Factor)} \rightarrow \text{Menu Recipe Consumption}$.
  - Realtime theoretical portion availability (e.g. 20 Chicken Thalis remaining from 2kg raw chicken).
- **Waiter Mobile PWA & Offline Outbox:**
  - Android-optimized thumb-friendly interface (360px - 412px viewports).
  - Fast category filtering, search in English & Marathi, spice levels (Mild, Medium, Kolhapuri Spicy, Thecha Extra Spicy), optional seat tagging (`Seat 1..N`), and 1-tap KOT creation.
  - IndexedDB outbox queue with client mutation UUIDs for guaranteed zero duplicate orders during network disconnects.
- **Multi-Station Kitchen Display System (KDS):**
  - Station routing (Main Kitchen, Thali Section, Bhakri/Roti, Sukka/Fry, Solkadhi Bar).
  - Elapsed timers with visual urgency colors ($<5\text{ min}$, $5-12\text{ min}$, $>12\text{ min}$ urgent flash).
- **Configurable Tax Engine & Split Billing:**
  - Multi-rate tax engine (CGST 2.5% + SGST 2.5%, exempt 0%, VAT 10%).
  - Multi-tender split payment (Cash, UPI with dynamic QR preview, Card).
  - 80mm thermal receipt preview with Marathi receipt footer.
- **Theoretical vs. Actual Stock Variance & Food Costing:**
  - Formula: $(\text{Opening} + \text{Purchases} - \text{Sales} - \text{Wastage}) - \text{Physical Count} = \text{Variance}$.
  - Financial leakage value calculation and CSV export.
- **Staff Operations & Checklists:**
  - Daily Opening & Closing Checklists (Gas line safety, hygiene, opening cash float, poultry inspection).

---

## 🛠️ Technology Stack

- **Frontend:** Next.js 16.3.x Active LTS, React 19.2+, TypeScript (strict mode), Tailwind CSS, Lucide icons, TanStack Query.
- **Authoritative Backend:** Supabase PostgreSQL 17 with RLS, PostgreSQL transactional stored procedures, sequential generators.
- **Client Cache / PWA:** IndexedDB (`idb`), Service Worker, Offline Outbox Queue.
- **Testing:** Vitest, Playwright.

---

## 🚀 Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Run unit & domain tests
npm run test

# 3. Start local development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 📚 Architectural Documentation

- [ARCHITECTURE.md](ARCHITECTURE.md) — Comprehensive System Design & Monolith Architecture
- [DATABASE.md](DATABASE.md) — PostgreSQL 17 Relational Schema, Triggers & Stored Procedures
- [PERMISSIONS.md](PERMISSIONS.md) — Granular RBAC Permissions Matrix
- [INVENTORY_ENGINE.md](INVENTORY_ENGINE.md) — 3-Tier Stock Ledger, Recipe Yields & Negative Stock Protection
- [OFFLINE_SYNC.md](OFFLINE_SYNC.md) — IndexedDB Outbox Queue & Idempotency Architecture
- [RESTAURANT_WORKFLOWS.md](RESTAURANT_WORKFLOWS.md) — Table, Party, KOT, and Billing Lifecycle Workflows
- [TESTING.md](TESTING.md) — Test Strategy, Vitest Suites & Concurrency Scenarios
- [DEPLOYMENT.md](DEPLOYMENT.md) — Production Deployment, Supabase Configuration & Backup Strategies
