/**
 * Kolhapuri Khanawal Restaurant Operating System
 * Phase 4: Dining Party Lifecycle, Seat Tagging, Transfers & Merges
 */

import {
  DiningParty,
  DiningTable,
  PartyTransferRecord,
  PartyMergeRecord,
  PartySeat,
} from "@/types/tables";
import { OrderItem } from "@/types/orders";

export interface CreatePartyParams {
  table: DiningTable;
  existingPartiesForTableToday: DiningParty[];
  guestCount: number;
  assignedWaiterId: string;
  assignedWaiterName: string;
  descriptor?: string;
  notes?: string;
}

/**
 * Creates a new independent dining party at a physical table
 */
export function openDiningParty(params: CreatePartyParams): {
  party: DiningParty;
  seats: PartySeat[];
} {
  const {
    table,
    existingPartiesForTableToday,
    guestCount,
    assignedWaiterId,
    assignedWaiterName,
    descriptor,
    notes,
  } = params;

  const partyNumber = existingPartiesForTableToday.length + 1;
  const partyCode = `T${table.tableNumber}-P${String(partyNumber).padStart(2, "0")}`;
  const now = new Date().toISOString();
  const partyId = `party-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

  const party: DiningParty = {
    id: partyId,
    partyCode,
    tableId: table.id,
    tableNumber: table.tableNumber,
    tableName: table.name || `Table ${table.tableNumber}`,
    guestCount,
    assignedWaiterId,
    assignedWaiterName,
    status: "OPEN",
    descriptor,
    runningSubtotal: 0,
    runningGrandTotal: 0,
    openedAt: now,
    lastActivityAt: now,
    notes,
  };

  // Generate optional seat slots
  const seats: PartySeat[] = Array.from({ length: guestCount }, (_, i) => ({
    id: `seat-${partyId}-${i + 1}`,
    partyId,
    seatNumber: i + 1,
    label: `Seat ${i + 1}`,
  }));

  return { party, seats };
}

/**
 * Transfers a single party from one table to another (without affecting other parties at either table)
 */
export function transferParty(
  party: DiningParty,
  fromTable: DiningTable,
  toTable: DiningTable,
  transferredBy: string,
  transferredByName: string,
  reason?: string
): {
  updatedParty: DiningParty;
  transferRecord: PartyTransferRecord;
} {
  const now = new Date().toISOString();

  const updatedParty: DiningParty = {
    ...party,
    tableId: toTable.id,
    tableNumber: toTable.tableNumber,
    lastActivityAt: now,
  };

  const transferRecord: PartyTransferRecord = {
    id: `transfer-${Date.now()}`,
    partyId: party.id,
    partyCode: party.partyCode,
    fromTableId: fromTable.id,
    fromTableNumber: fromTable.tableNumber,
    toTableId: toTable.id,
    toTableNumber: toTable.tableNumber,
    transferredBy,
    transferredByName,
    reason,
    timestamp: now,
  };

  return { updatedParty, transferRecord };
}

/**
 * Merges two or more parties into a target party with complete audit trail
 */
export function mergeParties(
  sourceParties: DiningParty[],
  targetParty: DiningTable,
  mergedBy: string,
  mergedByName: string
): {
  targetPartyUpdated: DiningParty;
  closedParties: DiningParty[];
  mergeRecord: PartyMergeRecord;
} {
  const now = new Date().toISOString();
  const primaryParty = sourceParties[0];
  const combinedGuestCount = sourceParties.reduce((sum, p) => sum + p.guestCount, 0);
  const combinedSubtotal = sourceParties.reduce((sum, p) => sum + p.runningSubtotal, 0);

  const targetPartyUpdated: DiningParty = {
    ...primaryParty,
    guestCount: combinedGuestCount,
    runningSubtotal: combinedSubtotal,
    lastActivityAt: now,
  };

  const closedParties = sourceParties.slice(1).map((p) => ({
    ...p,
    status: "CLOSED" as const,
    closedAt: now,
    notes: `Merged into party ${primaryParty.partyCode}`,
  }));

  const mergeRecord: PartyMergeRecord = {
    id: `merge-${Date.now()}`,
    sourcePartyIds: sourceParties.map((p) => p.id),
    sourcePartyCodes: sourceParties.map((p) => p.partyCode),
    targetPartyId: primaryParty.id,
    targetPartyCode: primaryParty.partyCode,
    tableId: primaryParty.tableId,
    tableNumber: primaryParty.tableNumber,
    mergedBy,
    mergedByName,
    timestamp: now,
  };

  return { targetPartyUpdated, closedParties, mergeRecord };
}

/**
 * Splits items from an existing party into a new separate dining party
 */
export function splitPartyItems(
  sourceParty: DiningParty,
  itemsToMove: OrderItem[],
  newTable: DiningTable,
  existingPartiesForNewTable: DiningParty[],
  splitBy: string,
  splitByName: string
): {
  newParty: DiningParty;
  updatedSourceParty: DiningParty;
  movedItems: OrderItem[];
} {
  const { party: newParty } = openDiningParty({
    table: newTable,
    existingPartiesForTableToday: existingPartiesForNewTable,
    guestCount: Math.max(1, Math.floor(sourceParty.guestCount / 2)),
    assignedWaiterId: sourceParty.assignedWaiterId,
    assignedWaiterName: sourceParty.assignedWaiterName,
    descriptor: `Split from ${sourceParty.partyCode}`,
  });

  const movedSubtotal = itemsToMove.reduce((sum, it) => sum + it.totalPrice, 0);

  const updatedSourceParty: DiningParty = {
    ...sourceParty,
    runningSubtotal: Math.max(0, sourceParty.runningSubtotal - movedSubtotal),
    lastActivityAt: new Date().toISOString(),
  };

  const movedItems = itemsToMove.map((it) => ({
    ...it,
    partyId: newParty.id,
  }));

  return { newParty, updatedSourceParty, movedItems };
}
