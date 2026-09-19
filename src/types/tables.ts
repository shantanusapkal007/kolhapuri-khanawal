/**
 * Kolhapuri Khanawal Restaurant Operating System
 * Phase 0: Physical Tables, Multi-Party Lifecycle & Seat Allocation Types
 */

export type PhysicalTableStatus =
  | "AVAILABLE" // 0 active parties
  | "OCCUPIED"  // Exactly 1 active party
  | "SHARED"    // 2+ active parties
  | "RESERVED"
  | "BLOCKED";

export type DiningPartyStatus =
  | "OPEN"
  | "ORDERING"
  | "FOOD_PENDING"
  | "WAITING_FOR_BILL"
  | "PAYMENT_PENDING"
  | "CLOSED"
  | "TRANSFERRED"
  | "CANCELLED";

export interface DiningTable {
  id: string;
  tableNumber: number; // 1..12
  name: string;        // e.g. "Table 1", "Table 6 (Window)"
  minCapacity: number;
  maxCapacity: number;
  section: "MAIN_HALL" | "FAMILY_SECTION" | "OUTDOOR_VERANDA";
  status: PhysicalTableStatus;
  activePartiesCount: number;
  totalActiveGuests: number;
  qrCodeToken?: string;
  notes?: string;
  updatedAt: string;
}

export interface DiningParty {
  id: string;
  partyCode: string; // e.g. "T4-P01", "T6-P02"
  tableId: string;
  tableNumber: number;
  guestCount: number;
  assignedWaiterId: string;
  assignedWaiterName: string;
  status: DiningPartyStatus;
  descriptor?: string; // e.g. "Window side", "Family with kids", "Blue shirt"
  runningSubtotal: number;
  runningGrandTotal: number;
  openedAt: string;
  closedAt?: string;
  lastActivityAt: string;
  notes?: string;
  isTakeaway?: boolean;
  customerName?: string;
  customerPhone?: string;
  packagingCharges?: number;
  dailyOrderNumber?: number; // Sequential dine-in order of the business day (starts at 10:00 AM)
  dailyParcelNumber?: number; // Sequential parcel order of the business day (starts at 10:00 AM)
}

export interface PartySeat {
  id: string;
  partyId: string;
  seatNumber: number; // 1, 2, 3, 4...
  label?: string;     // e.g. "Seat 1 (Host)", "Seat 2"
}

export interface PartyTransferRecord {
  id: string;
  partyId: string;
  partyCode: string;
  fromTableId: string;
  fromTableNumber: number;
  toTableId: string;
  toTableNumber: number;
  transferredBy: string;
  transferredByName: string;
  reason?: string;
  timestamp: string;
}

export interface PartyMergeRecord {
  id: string;
  sourcePartyIds: string[];
  sourcePartyCodes: string[];
  targetPartyId: string;
  targetPartyCode: string;
  tableId: string;
  tableNumber: number;
  mergedBy: string;
  mergedByName: string;
  timestamp: string;
}
