# TESTING.md — Automated Verification & Critical Test Scenarios

## 1. Automated Test Suites (Vitest)

Run the full test suite with:

```bash
npx vitest run
```

### Coverage Breakdown:

| Test File | Test Scenarios Covered |
| :--- | :--- |
| `tests/inventory-ledger.test.ts` | Initial 20 Chicken Thalis availability from 2kg Chicken; sequential stock depletion (Order 3 $\rightarrow$ 17 remaining, Order 10 $\rightarrow$ 7 remaining, Order 7 $\rightarrow$ 0 remaining, 8th order blocked); concurrent order race condition prevention; KOT kitchen stock consumption commit; Theoretical vs Actual variance calculation ($-1.5\text{ kg}, -13.64\%$). |
| `tests/table-party-seats.test.ts` | Two independent parties sharing Table 4; Party A closes while Table 4 remains `OCCUPIED` by Party B; Table 4 becomes `AVAILABLE` only after Party B settles; Table Transfer (moving only Party B to Table 9); Party Merge with combined guest counts and subtotals. |
| `tests/billing-tax.test.ts` | 5% GST tax calculation split into 2.5% CGST and 2.5% SGST; Exempt 0% tax handling; Multi-tender split payment (₹500 Cash + ₹172 UPI settling ₹672 bill in full). |
| `tests/offline-idempotency.test.ts` | Offline mutation queuing in IndexedDB with client UUIDs; idempotent replay with zero duplicate transactions upon network recovery. |
| `tests/rbac-security.test.ts` | Strict RBAC enforcement: WAITER denied cost view, recipe edit, and bill cancellation; KITCHEN denied financial reports; CASHIER permitted billing. |

---

## 2. Realistic Concurrency Scenario Test Results

```
 RUN  v3.2.7 E:/projects/kolhapuri khanawal

 ✓ tests/offline-idempotency.test.ts (2 tests)
 ✓ tests/rbac-security.test.ts (4 tests)
 ✓ tests/billing-tax.test.ts (3 tests)
 ✓ tests/table-party-seats.test.ts (3 tests)
 ✓ tests/inventory-ledger.test.ts (5 tests)

 Test Files  5 passed (5)
      Tests  17 passed (17)
```
