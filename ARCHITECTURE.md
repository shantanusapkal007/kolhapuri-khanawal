# ARCHITECTURE.md — Kolhapuri Khanawal Restaurant OS

## 1. Modular Monolith Architecture

The application is structured as a modular monolith in Next.js 16.3.x App Router, with clean domain boundaries:

```
src/
├── app/
│   ├── (waiter)/waiter/     # Waiter floor, party management & quick order screens
│   ├── (kitchen)/kitchen/   # Multi-station Kitchen Display System (KDS)
│   ├── (cashier)/billing/   # Cashier desk, itemized receipts, split payment settlement
│   ├── (admin)/dashboard/   # Executive operations dashboard
│   ├── (admin)/inventory/   # Stock ledger, physical count reconciliation, purchase intake
│   ├── (admin)/recipes/     # Recipe engine, intermediate preparations, margin analysis
│   ├── (admin)/reports/     # Theoretical vs actual stock variance & forecasting
│   └── (admin)/checklists/  # Opening & closing operational safety checklists
├── components/
│   └── navigation/          # Navbar, active role switcher, connectivity outbox pill
├── lib/
│   ├── inventory/           # Unit conversions, preparations, recipe portions, stock ledger
│   ├── tables/              # Table occupancy computation, party lifecycle, seat allocation
│   ├── orders/              # Atomic order placement, KOT generation, station routing
│   ├── billing/             # Configurable tax engine, discount validation, split payments
│   ├── auth/                # Granular RBAC permissions matrix
│   ├── offline/             # IndexedDB local cache, mutation outbox queue, sync manager
│   ├── reports/             # Theoretical variance formula, statistical forecasting
│   └── store/               # Central live domain state store
└── types/                   # Strict TypeScript domain models
```

---

## 2. Core Operational Hierarchy

```
Physical Table (1..12)
    └── Dining Party (T{table}-P{party}, e.g., T4-P01, T4-P02)
            ├── Optional Seats (Seat 1..N)
            ├── Order (with client idempotency UUID)
            │      └── Order Items (+ Modifiers, Spice Level, Notes)
            │             ├── Stock Reservation (Physical - Reserved = Available)
            │             └── KOT (Kitchen Order Ticket, KOT-2026-XXXXXX)
            │                    └── Kitchen Stations (Thali, Curry, Bhakri, Fry, Drinks)
            └── Bill (BILL-2026-XXXXXX)
                   ├── Configurable Taxes (CGST 2.5% + SGST 2.5%, Exempt, VAT)
                   └── Multi-Tender Payments (Cash, UPI QR, Card)
```

---

## 3. High-Performance Mobile Strategy

1. **Android Thumb Optimization:** All primary waiter actions (category selection, $+1/-1$ quantity adjustments, spice level pills, 1-tap Send KOT) are thumb-accessible with large touch targets.
2. **Offline Outbox Pattern:** Waiter orders are written to IndexedDB with a client UUID mutation ID before submission. If connection is lost, orders queue seamlessly and replay idempotently upon reconnect with zero duplicated items or KOTs.
3. **Optimistic UI with Transactional Rollback:** UI updates optimistically while PostgreSQL transactions enforce atomic stock checks and sequence generation.
