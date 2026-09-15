# RESTAURANT_WORKFLOWS.md — End-to-End Service Lifecycle

## 1. Physical Table & Shared Dining Party Lifecycle

```mermaid
stateDiagram-v2
    [*] --> AVAILABLE: 0 Active Parties
    AVAILABLE --> OCCUPIED: Party A Arrives (T4-P01)
    OCCUPIED --> SHARED: Party B Arrives (T4-P02 at same table)
    SHARED --> OCCUPIED: Party A Pays & Leaves (Party B remains)
    OCCUPIED --> AVAILABLE: Party B Pays & Leaves
```

---

## 2. Order & Kitchen Preparation Workflow

```mermaid
stateDiagram-v2
    [*] --> NEW: Waiter sends 1-Tap KOT
    NEW --> ACKNOWLEDGED: Kitchen acknowledges order
    ACKNOWLEDGED --> PREPARING: Kitchen starts cooking (Stock Consumed in Ledger)
    PREPARING --> READY: Food plated & bell rung (Waiter alert fired)
    READY --> SERVED: Waiter delivers dishes to customer table
    SERVED --> [*]
```

---

## 3. Billing & Payment Settlement Workflow

1. **Party Requests Bill:** Waiter taps "Request Bill" for Party `T6-P01`.
2. **Cashier Console:** Cashier selects `T6-P01`, applies authorized discount (with manager PIN if $> 10\%$).
3. **Tax & Round-Off:** Configurable GST (CGST 2.5% + SGST 2.5%) computed deterministically, rounded to exact Indian Rupees.
4. **Multi-Tender Settlement:** Customer splits tender (e.g. ₹500 Cash + ₹180 UPI).
5. **Auto Table Refresh:** When the last party at Table 6 settles, Table 6 status changes from `OCCUPIED` to `AVAILABLE`.
