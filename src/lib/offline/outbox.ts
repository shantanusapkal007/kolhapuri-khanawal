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
}

export const outboxManager = new OutboxSyncManager();
