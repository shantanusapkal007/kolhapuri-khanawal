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

      // Check if auth token exists in localStorage
      let token = "";
      try {
        token = localStorage.getItem("auth_session_token") || "";
      } catch {}

      const authHeaders: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (token) {
        authHeaders["Authorization"] = `Bearer ${token}`;
      }

      switch (mutation.mutationType) {
        case "CREATE_PARTY":
          if (payload?.tableNumber) {
            try {
              const res = await fetch("/api/tables", {
                method: "POST",
                headers: authHeaders,
                body: JSON.stringify({
                  action: "SEAT",
                  tableNumber: payload.tableNumber,
                  guestCount: payload.guestCount || 2,
                  descriptor: payload.descriptor,
                  customerName: payload.customerName,
                  customerPhone: payload.customerPhone,
                  isTakeaway: payload.isTakeaway,
                  packagingCharges: payload.packagingCharges,
                  waiterId: payload.waiterId,
                  waiterName: payload.waiterName,
                }),
              });
              if (res.ok) {
                const data = await res.json();
                if (data.party) {
                  // Synchronize local store party
                  const existingIdx = globalRestaurantStore.parties.findIndex((p) => p.id === data.party.id);
                  if (existingIdx >= 0) {
                    globalRestaurantStore.parties[existingIdx] = data.party;
                  } else {
                    globalRestaurantStore.parties.push(data.party);
                  }
                  return true;
                }
              }
            } catch {}

            // Fallback to local store
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
            try {
              const res = await fetch("/api/orders", {
                method: "POST",
                headers: authHeaders,
                body: JSON.stringify({
                  idempotencyKey: mutation.id,
                  partyId: payload.partyId,
                  items: payload.items,
                  notes: payload.notes,
                  waiterId: payload.waiterId,
                  waiterName: payload.waiterName,
                  stationCode: payload.stationCode,
                }),
              });
              if (res.ok) {
                const data = await res.json();
                if (data.order && data.kot) {
                  // Reconcile into local store
                  const existingOrdIdx = globalRestaurantStore.orders.findIndex((o) => o.id === data.order.id);
                  if (existingOrdIdx >= 0) {
                    globalRestaurantStore.orders[existingOrdIdx] = data.order;
                  } else {
                    globalRestaurantStore.orders.push(data.order);
                  }

                  const existingKotIdx = globalRestaurantStore.kots.findIndex((k) => k.id === data.kot.id);
                  if (existingKotIdx >= 0) {
                    globalRestaurantStore.kots[existingKotIdx] = data.kot;
                  } else {
                    globalRestaurantStore.kots.push(data.kot);
                  }
                  return true;
                }
              }
            } catch {}

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
            try {
              await fetch("/api/kots", {
                method: "POST",
                headers: authHeaders,
                body: JSON.stringify({
                  kotId: payload.kotId,
                  status: payload.newStatus,
                }),
              });
            } catch {}
            globalRestaurantStore.advanceKotStatus(payload.kotId, payload.newStatus);
          }
          return true;

        case "SETTLE_BILL":
          if (payload?.billId && payload?.method && payload?.amount) {
            try {
              const res = await fetch("/api/bills", {
                method: "POST",
                headers: authHeaders,
                body: JSON.stringify({
                  action: "PAY",
                  billId: payload.billId,
                  paymentMethod: payload.method,
                  tenderAmount: payload.amount,
                  idempotencyKey: mutation.id,
                  reference: payload.reference,
                }),
              });
              if (res.ok) {
                const data = await res.json();
                if (data.bill) {
                  const bIdx = globalRestaurantStore.bills.findIndex((b) => b.id === data.bill.id);
                  if (bIdx >= 0) globalRestaurantStore.bills[bIdx] = data.bill;
                  return true;
                }
              }
            } catch {}

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
