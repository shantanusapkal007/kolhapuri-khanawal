import { describe, it, expect, beforeEach } from "vitest";
import { OutboxSyncManager } from "@/lib/offline/outbox";
import { getPendingOutboxMutations, localStore } from "@/lib/offline/idb-storage";

describe("Offline Outbox Queue & Client Idempotency Synchronization", () => {
  let manager: OutboxSyncManager;

  beforeEach(async () => {
    await localStore.remove("outbox_mutations");
    manager = new OutboxSyncManager();
    // Simulate offline mode during queuing
    (manager as any).status = "OFFLINE";
  });

  it("should queue mutations locally when offline and provide a unique client UUID", async () => {
    const mutation = await manager.enqueueMutation(
      "SEND_KOT",
      {
        partyId: "party-123",
        items: [{ menuItemId: "menu-chicken-thali", quantity: 2 }],
      },
      { partyCode: "T4-P01", tableNumber: 4 }
    );

    expect(mutation.id).toMatch(/^mut-/);
    expect(mutation.status).toBe("PENDING");
    expect(mutation.partyCode).toBe("T4-P01");

    const pending = await getPendingOutboxMutations();
    expect(pending.length).toBe(1);
    expect(pending[0].id).toBe(mutation.id);
  });

  it("should replay mutations idempotently without duplication upon synchronization", async () => {
    // Queue 2 mutations while offline
    await manager.enqueueMutation("CREATE_PARTY", { tableNumber: 6, guestCount: 3 });
    await manager.enqueueMutation("SEND_KOT", { partyId: "p1", items: [] });

    let executedCount = 0;
    const mockServerExecutor = async (mut: any) => {
      executedCount += 1;
      return true;
    };

    // Reconnect & sync
    const syncResult = await manager.syncPendingMutations(mockServerExecutor);
    expect(syncResult.syncedCount).toBe(2);
    expect(executedCount).toBe(2);

    // After sync, outbox must be empty
    const pendingAfter = await getPendingOutboxMutations();
    expect(pendingAfter.length).toBe(0);
  });
});
