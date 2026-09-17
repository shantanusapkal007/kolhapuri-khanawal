/**
 * Kolhapuri Khanawal Restaurant Operating System
 * Phase 4: Physical Table Occupancy & Floor Management Service
 */

import { DiningTable, PhysicalTableStatus, DiningParty } from "@/types/tables";

/**
 * Authoritatively calculates the physical table status based on its active dining parties
 */
export function calculateTableStatus(
  table: DiningTable,
  activeParties: DiningParty[]
): {
  status: PhysicalTableStatus;
  activePartiesCount: number;
  totalActiveGuests: number;
  remainingCapacity: number;
} {
  // If table is explicitly reserved or blocked by manager
  if (table.status === "RESERVED" || table.status === "BLOCKED") {
    return {
      status: table.status,
      activePartiesCount: 0,
      totalActiveGuests: 0,
      remainingCapacity: 0,
    };
  }

  // Filter parties that are not closed or cancelled, and exclude takeaway/parcel orders
  const validParties = activeParties.filter(
    (p) => p.status !== "CLOSED" && p.status !== "CANCELLED" && !p.isTakeaway
  );

  const activePartiesCount = validParties.length;
  const totalActiveGuests = validParties.reduce((sum, p) => sum + p.guestCount, 0);
  const remainingCapacity = Math.max(0, table.maxCapacity - totalActiveGuests);

  let status: PhysicalTableStatus = "AVAILABLE";
  if (activePartiesCount === 1) {
    status = "OCCUPIED";
  } else if (activePartiesCount > 1) {
    status = "SHARED";
  }

  return {
    status,
    activePartiesCount,
    totalActiveGuests,
    remainingCapacity,
  };
}

/**
 * Updates a table with freshly calculated active party counts and status
 */
export function refreshTableOccupancy(
  table: DiningTable,
  parties: DiningParty[]
): DiningTable {
  const tableParties = parties.filter((p) => p.tableId === table.id);
  const { status, activePartiesCount, totalActiveGuests } = calculateTableStatus(
    table,
    tableParties
  );

  return {
    ...table,
    status,
    activePartiesCount,
    totalActiveGuests,
    updatedAt: new Date().toISOString(),
  };
}
