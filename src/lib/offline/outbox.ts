/**
 * Kolhapuri Khanawal Restaurant Operating System
 * Phase 10: Outbox Queue & Offline Idempotent Synchronization
 */

import { OutboxMutation, ConnectivityStatus } from "@/types/offline";
import { getPendingOutboxMutations, markMutationSynced, queueOutboxMutation } from "./idb-storage";

export class OutboxSyncManager {
  private status: ConnectivityStatus = "ONLINE";
  private syncInProgress = false;

  constructor() {
    if (typeof window !== "undefined") {
      this.status = navigator.onLine ? "ONLINE" : "OFFLINE";
      window.addEventListener("online", () => this.handleNetworkChange(true));
      window.addEventListener("offline", () => this.handleNetworkChange(false));
    }
  }

  getStatus(): ConnectivityStatus {
    return this.status;
  }

  private handleNetworkChange(isOnline: boolean) {
    this.status = isOnline ? "ONLINE" : "OFFLINE";
    if (isOnline) {
      this.syncPendingMutations();
    }
  }

  /**
   * Queues an action into the outbox with an idempotency key UUID
   */
  async enqueueMutation<T>(
    mutationType: OutboxMutation["mutationType"],
    payload: T,
    metadata: { partyId?: string; partyCode?: string; tableNumber?: number } = {}
  ): Promise<OutboxMutation<T>> {
    const mutation: OutboxMutation<T> = {
      id: `mut-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      mutationType,
      partyId: metadata.partyId,
      partyCode: metadata.partyCode,
      tableNumber: metadata.tableNumber,
      payload,
      status: "PENDING",
      retryCount: 0,
      createdAt: new Date().toISOString(),
    };

    await queueOutboxMutation(mutation);

    if (this.status === "ONLINE") {
      this.syncPendingMutations();
    }

    return mutation;
  }

  /**
   * Replays queued mutations idempotently to the server
   */
  async syncPendingMutations(
    executor?: (mutation: OutboxMutation) => Promise<boolean>
  ): Promise<{ syncedCount: number; failedCount: number }> {
    if (this.syncInProgress) return { syncedCount: 0, failedCount: 0 };
    this.syncInProgress = true;
    this.status = "SYNCING";

    const pending = await getPendingOutboxMutations();
    let syncedCount = 0;
    let failedCount = 0;

    for (const mutation of pending) {
      try {
        let success = true;
        if (executor) {
          success = await executor(mutation);
        } else {
          success = await this.defaultMutationExecutor(mutation);
        }

        if (success) {
          await markMutationSynced(mutation.id);
          syncedCount += 1;
        } else {
          failedCount += 1;
        }
      } catch (err) {
        failedCount += 1;
        mutation.status = "FAILED";
        mutation.errorMessage = (err as Error).message;
        mutation.retryCount += 1;
      }
    }

    this.status = failedCount > 0 ? "SYNC_FAILED" : "ONLINE";
    this.syncInProgress = false;

    return { syncedCount, failedCount };
  }

  private async defaultMutationExecutor(mutation: OutboxMutation): Promise<boolean> {
    try {
      const { globalRestaurantStore } = await import("@/lib/store/restaurant-store");
      const payload = mutation.payload as any;

      switch (mutation.mutationType) {
        case "CREATE_PARTY":
          if (payload?.tableNumber && payload?.guestCount) {
            globalRestaurantStore.createPartyAtTable(
              payload.tableNumber,
              payload.guestCount,
              payload.descriptor,
              payload.isTakeaway,
              payload.customerName,
              payload.customerPhone
            );
          }
          return true;

        case "SEND_KOT":
          if (payload?.partyId && Array.isArray(payload?.items) && payload.items.length > 0) {
            const alreadyPlaced = globalRestaurantStore.orders.some(
              (o) => o.idempotencyKey === mutation.id
            );
            if (!alreadyPlaced) {
              globalRestaurantStore.placeOrder(
                payload.partyId,
                payload.items,
                Boolean(payload.allowNegativeStock)
              );
            }
          }
          return true;

        case "UPDATE_KOT_STATUS":
          if (payload?.kotId && payload?.newStatus) {
            globalRestaurantStore.advanceKotStatus(payload.kotId, payload.newStatus);
          }
          return true;

        case "SETTLE_BILL":
          if (payload?.billId && payload?.method && payload?.amount) {
            globalRestaurantStore.payBill(
              payload.billId,
              payload.method,
              payload.amount,
              payload.reference
            );
          }
          return true;

        default:
          return true;
      }
    } catch (e) {
      console.warn(`[OutboxSyncManager] Default executor error for ${mutation.mutationType}:`, e);
      return false;
    }
  }
}

export const outboxManager = new OutboxSyncManager();
