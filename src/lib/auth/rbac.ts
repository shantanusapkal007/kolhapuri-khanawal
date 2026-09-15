/**
 * Kolhapuri Khanawal Restaurant Operating System
 * Phase 8: Granular Role-Based Access Control (RBAC)
 */

import { RoleType, PermissionCode } from "@/types/domain";

export const ROLE_PERMISSIONS: Record<RoleType, PermissionCode[]> = {
  OWNER: [
    "orders.create",
    "orders.modify",
    "orders.cancel",
    "kot.create",
    "kot.cancel",
    "kot.status_update",
    "bill.create",
    "bill.discount",
    "bill.cancel",
    "bill.refund",
    "payment.record",
    "inventory.view",
    "inventory.adjust",
    "inventory.purchase",
    "inventory.cost_view",
    "recipe.view",
    "recipe.edit",
    "preparation.manage",
    "reports.view",
    "reports.financial",
    "staff.manage",
    "settings.manage",
    "override.negative_stock",
    "party.transfer",
    "party.merge",
    "party.split",
  ],
  MANAGER: [
    "orders.create",
    "orders.modify",
    "orders.cancel",
    "kot.create",
    "kot.cancel",
    "kot.status_update",
    "bill.create",
    "bill.discount",
    "bill.cancel",
    "payment.record",
    "inventory.view",
    "inventory.adjust",
    "inventory.purchase",
    "inventory.cost_view",
    "recipe.view",
    "recipe.edit",
    "preparation.manage",
    "reports.view",
    "reports.financial",
    "staff.manage",
    "override.negative_stock",
    "party.transfer",
    "party.merge",
    "party.split",
  ],
  CASHIER: [
    "orders.create",
    "orders.modify",
    "bill.create",
    "bill.discount",
    "payment.record",
    "inventory.view",
    "reports.view",
    "party.transfer",
    "party.merge",
    "party.split",
  ],
  WAITER: [
    "orders.create",
    "orders.modify",
    "kot.create",
    "bill.create",
    "inventory.view",
    "party.transfer",
  ],
  KITCHEN: [
    "kot.status_update",
    "recipe.view",
    "preparation.manage",
    "inventory.view",
  ],
  INVENTORY_MANAGER: [
    "inventory.view",
    "inventory.adjust",
    "inventory.purchase",
    "inventory.cost_view",
    "recipe.view",
    "preparation.manage",
    "reports.view",
  ],
  PURCHASE_STAFF: [
    "inventory.view",
    "inventory.purchase",
    "inventory.cost_view",
  ],
  OTHER_STAFF: [
    "inventory.view",
  ],
};

/**
 * Checks whether a given role is authorized for a specific permission
 */
export function hasPermission(
  role: RoleType,
  permission: PermissionCode
): boolean {
  const permissions = ROLE_PERMISSIONS[role] || [];
  return permissions.includes(permission);
}

/**
 * Validates permission and throws an authorization error if denied
 */
export function requirePermission(
  role: RoleType,
  permission: PermissionCode
): void {
  if (!hasPermission(role, permission)) {
    throw new Error(
      `Access Denied: Role '${role}' is not authorized for permission '${permission}'`
    );
  }
}
