# PERMISSIONS.md — Granular Role-Based Access Control (RBAC)

## 1. Role Matrix

The system enforces strict multi-tier permissions across 6 operational roles:

| Permission Code | Description | OWNER | MANAGER | CASHIER | WAITER | KITCHEN | INVENTORY_MGR |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| `orders.create` | Place table orders | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| `orders.modify` | Add/change order items | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| `orders.cancel` | Cancel order before cooking | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `kot.create` | Send KOT to kitchen | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ |
| `kot.status_update` | Advance KOT status | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ |
| `bill.create` | Generate party bill | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| `bill.discount` | Apply bill discount | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| `bill.cancel` | Cancel finalized bill | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `payment.record` | Settle multi-tender payment | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| `inventory.view` | View stock availability | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `inventory.adjust` | Adjust physical stock count | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ |
| `inventory.cost_view`| View supplier cost & WAC | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ |
| `recipe.view` | View recipe components | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ |
| `recipe.edit` | Edit recipe ratios & yields | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `reports.financial` | View sales, margins & leakage| ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `override.negative_stock` | Override stock block | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `party.transfer` | Move party to another table | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| `party.merge` | Merge two dining parties | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |

---

## 2. Multi-Layer Security Enforcement

1. **Database Level:** Supabase PostgreSQL Row Level Security (RLS) policies evaluate `current_user_role()` on every query.
2. **Server API Level:** Next.js server actions validate authenticated session claims and role permissions before executing database procedures.
3. **UI Level:** UI views, cost figures, and sensitive action buttons are strictly conditionally rendered based on active role context.
