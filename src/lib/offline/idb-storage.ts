/**
 * Kolhapuri Khanawal Restaurant Operating System
 * Phase 10: IndexedDB Client Storage for Waiter PWA & Outbox Cache
 */

import { OutboxMutation } from "@/types/offline";

const DB_NAME = "kolhapuri_khanawal_db";
const DB_VERSION = 1;
const STORE_OUTBOX = "outbox_mutations";
const STORE_CACHE = "app_cache";

class LocalStorageFallback {
  private memoryStore: Map<string, any> = new Map();

  async get<T>(key: string): Promise<T | null> {
    if (typeof window !== "undefined" && window.localStorage) {
      const item = localStorage.getItem(`kk_${key}`);
      return item ? JSON.parse(item) : null;
    }
    return this.memoryStore.get(key) || null;
  }

  async set(key: string, value: any): Promise<void> {
    if (typeof window !== "undefined" && window.localStorage) {
      localStorage.setItem(`kk_${key}`, JSON.stringify(value));
    }
    this.memoryStore.set(key, value);
  }

  async remove(key: string): Promise<void> {
    if (typeof window !== "undefined" && window.localStorage) {
      localStorage.removeItem(`kk_${key}`);
    }
    this.memoryStore.delete(key);
  }
}

export const localStore = new LocalStorageFallback();

export async function queueOutboxMutation<T>(mutation: OutboxMutation<T>): Promise<void> {
  const queue = (await localStore.get<OutboxMutation[]>(STORE_OUTBOX)) || [];
  queue.push(mutation);
  await localStore.set(STORE_OUTBOX, queue);
}

export async function getPendingOutboxMutations(): Promise<OutboxMutation[]> {
  const queue = (await localStore.get<OutboxMutation[]>(STORE_OUTBOX)) || [];
  return queue.filter((m) => m.status === "PENDING" || m.status === "FAILED");
}

export async function markMutationSynced(mutationId: string): Promise<void> {
  const queue = (await localStore.get<OutboxMutation[]>(STORE_OUTBOX)) || [];
  const updated = queue.filter((m) => m.id !== mutationId);
  await localStore.set(STORE_OUTBOX, updated);
}
