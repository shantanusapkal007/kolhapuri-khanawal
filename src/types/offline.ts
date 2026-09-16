/**
 * Kolhapuri Khanawal Restaurant Operating System
 * Phase 0: Offline Outbox Queue & Client Mutation Types
 */

export type ConnectivityStatus = "ONLINE" | "OFFLINE" | "SYNCING" | "SYNC_FAILED";

export type OutboxMutationType =
  | "CREATE_PARTY"
  | "SEND_KOT"
  | "UPDATE_KOT_STATUS"
  | "CANCEL_KOT_ITEM"
  | "REQUEST_BILL"
  | "RECORD_PAYMENT"
  | "SETTLE_BILL"
  | "TRANSFER_PARTY"
  | "MERGE_PARTIES";

export interface OutboxMutation<T = unknown> {
  id: string; // client UUID idempotency key
  mutationType: OutboxMutationType;
  partyId?: string;
  partyCode?: string;
  tableNumber?: number;
  payload: T;
  status: "PENDING" | "PROCESSING" | "SYNCED" | "FAILED";
  retryCount: number;
  createdAt: string;
  lastAttemptAt?: string;
  errorMessage?: string;
}

export interface CachedTableState {
  tableId: string;
  tableNumber: number;
  status: string;
  partiesCount: number;
  updatedAt: string;
}

export interface CachedMenuState {
  categories: unknown[];
  items: unknown[];
  updatedAt: string;
}
