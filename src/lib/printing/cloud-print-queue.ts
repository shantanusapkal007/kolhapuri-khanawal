/**
 * Kolhapuri Khanawal Restaurant Operating System
 * Cloud Print Queue — Firestore-Backed Persistent Print Job Service
 *
 * PWA writes print jobs to Firestore `print_jobs` collection.
 * Local bridge on cashier PC claims and delivers them to the printer.
 * Admin dashboard subscribes to real-time updates via onSnapshot.
 *
 * Architecture:
 *   Phone PWA (HTTPS) → Firestore `print_jobs` → Local Bridge → Printer TCP :9100
 */

import { app } from "@/lib/firebase/config";
import {
  getFirestore,
  initializeFirestore,
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  onSnapshot,
  Timestamp,
  writeBatch,
  type Firestore,
  type Unsubscribe,
} from "firebase/firestore";
import { getAuth, signInAnonymously, type Auth } from "firebase/auth";
import type { CloudPrintJob, PrintBridgeHeartbeat } from "@/types/billing";

// ══════════════════════════════════════════════════════════════════
//  Constants
// ══════════════════════════════════════════════════════════════════

const RESTAURANT_ID = "kolhapuri-khanawal";
const PRINT_JOBS_COLLECTION = "print_jobs";
const BRIDGES_COLLECTION = "print_bridges";
const IDEMPOTENCY_WINDOW_MS = 60_000; // 60 seconds
const BRIDGE_ONLINE_THRESHOLD_MS = 45_000; // Bridge considered offline after 45s without heartbeat

// ══════════════════════════════════════════════════════════════════
//  Singleton Firestore & Auth Initialization
// ══════════════════════════════════════════════════════════════════

let db: Firestore | null = null;
let auth: Auth | null = null;
let authPromise: Promise<void> | null = null;

function getDb(): Firestore {
  if (!db) {
    try {
      db = initializeFirestore(app, {
        ignoreUndefinedProperties: true,
      });
    } catch {
      db = getFirestore(app);
    }
  }
  return db;
}

/**
 * Ensure Firebase Anonymous Auth is initialized.
 * Required for Firestore security rules to allow writes.
 * Silent — no login screen, no user interaction.
 */
async function ensureAuth(): Promise<void> {
  if (auth?.currentUser) return;
  if (authPromise) return authPromise;
  if (typeof window === "undefined") return; // SSR guard

  authPromise = (async () => {
    auth = getAuth(app);
    if (!auth.currentUser) {
      await signInAnonymously(auth);
    }
  })();

  try {
    await authPromise;
  } catch (err) {
    console.warn("[CloudPrintQueue] Anonymous auth failed:", err);
    // Continue without auth — Firestore rules may still allow if configured
    authPromise = null;
    throw err;
  }
}

// ══════════════════════════════════════════════════════════════════
//  Enqueue Print Job
// ══════════════════════════════════════════════════════════════════

export interface EnqueuePrintJobParams {
  type: CloudPrintJob["type"];
  title: string;
  stationCode: string;
  payloadBase64: string;
  paperWidth: "80mm" | "58mm";
  idempotencyKey?: string;
  createdBy: string;
  createdByName: string;
}

/**
 * Writes a new print job to Firestore `print_jobs` collection with status PENDING.
 * Checks idempotencyKey to prevent duplicate prints within 60s window.
 * Returns the created job document.
 */
export async function enqueuePrintJob(
  params: EnqueuePrintJobParams
): Promise<CloudPrintJob> {
  await ensureAuth();
  const firestore = getDb();
  const jobsRef = collection(firestore, PRINT_JOBS_COLLECTION);

  // Idempotency check: suppress duplicate prints within 60s
  if (params.idempotencyKey) {
    const cutoff = new Date(Date.now() - IDEMPOTENCY_WINDOW_MS).toISOString();
    const dupQuery = query(
      jobsRef,
      where("restaurantId", "==", RESTAURANT_ID),
      where("idempotencyKey", "==", params.idempotencyKey),
      where("createdAt", ">=", cutoff),
      where("status", "in", ["PENDING", "CLAIMED", "PRINTING", "SUCCESS"]),
      limit(1)
    );

    try {
      const dupSnap = await getDocs(dupQuery);
      if (!dupSnap.empty) {
        const existing = dupSnap.docs[0];
        console.warn(
          `[CloudPrintQueue] Duplicate print suppressed for key: ${params.idempotencyKey}`
        );
        return { id: existing.id, ...existing.data() } as CloudPrintJob;
      }
    } catch (err) {
      // If idempotency check fails, proceed with job creation anyway
      console.warn("[CloudPrintQueue] Idempotency check failed, proceeding:", err);
    }
  }

  const now = new Date().toISOString();
  const rawJobData: Record<string, any> = {
    restaurantId: RESTAURANT_ID,
    type: params.type,
    status: "PENDING",
    title: params.title,
    payloadBase64: params.payloadBase64,
    paperWidth: params.paperWidth || "80mm",
    createdAt: now,
    attempts: 0,
  };

  if (params.stationCode) rawJobData.stationCode = params.stationCode;
  if (params.idempotencyKey) rawJobData.idempotencyKey = params.idempotencyKey;
  if (params.createdBy) rawJobData.createdBy = params.createdBy;
  if (params.createdByName) rawJobData.createdByName = params.createdByName;

  // Filter out any undefined values so Firestore addDoc never receives unsupported undefined fields
  const jobData = Object.fromEntries(
    Object.entries(rawJobData).filter(([_, v]) => v !== undefined)
  ) as unknown as Omit<CloudPrintJob, "id">;

  try {
    const docRef = await addDoc(jobsRef, jobData);
    console.log(
      `[CloudPrintQueue] Enqueued job ${docRef.id} "${params.title}" (${params.type})`
    );
    return { id: docRef.id, ...jobData };
  } catch (firestoreErr: any) {
    console.warn(
      `[CloudPrintQueue] Cloud Firestore enqueue failed (${firestoreErr?.message || "Error"}). Attempting local bridge delivery...`
    );

    // Fallback: Dispatch directly through local print bridge route / daemon
    if (typeof window !== "undefined") {
      try {
        const localRes = await fetch("/api/print/bridge", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            payloadBase64: params.payloadBase64,
            stationCode: params.stationCode,
            title: params.title,
          }),
        });
        if (localRes.ok) {
          console.log(`[CloudPrintQueue] Delivered directly via local print bridge!`);
          return {
            id: `local-job-${Date.now()}`,
            ...jobData,
            status: "SUCCESS",
            completedAt: new Date().toISOString(),
          };
        }
      } catch (bridgeErr) {
        console.warn("[CloudPrintQueue] Local print bridge fallback also failed:", bridgeErr);
      }
    }

    throw firestoreErr;
  }
}

// ══════════════════════════════════════════════════════════════════
//  Job Management
// ══════════════════════════════════════════════════════════════════

/**
 * Retry a FAILED or UNCERTAIN job — resets status to PENDING.
 */
export async function retryPrintJob(jobId: string): Promise<void> {
  await ensureAuth();
  const firestore = getDb();
  const jobRef = doc(firestore, PRINT_JOBS_COLLECTION, jobId);

  await updateDoc(jobRef, {
    status: "PENDING",
    errorMessage: null,
    claimedAt: null,
    claimedBy: null,
    leaseExpiresAt: null,
    completedAt: null,
  });

  console.log(`[CloudPrintQueue] Job ${jobId} retried → PENDING`);
}

/**
 * Cancel a PENDING job — sets status to FAILED with cancellation message.
 */
export async function cancelPrintJob(jobId: string): Promise<void> {
  await ensureAuth();
  const firestore = getDb();
  const jobRef = doc(firestore, PRINT_JOBS_COLLECTION, jobId);

  await updateDoc(jobRef, {
    status: "FAILED",
    errorMessage: "Cancelled by user",
    completedAt: new Date().toISOString(),
  });

  console.log(`[CloudPrintQueue] Job ${jobId} cancelled`);
}

export const retryJob = retryPrintJob;
export const cancelJob = cancelPrintJob;

/**
 * Delete completed (SUCCESS) jobs older than the specified hours.
 */
export async function clearCompletedJobs(olderThanHours: number = 24): Promise<number> {
  await ensureAuth();
  const firestore = getDb();
  const cutoff = new Date(Date.now() - olderThanHours * 60 * 60 * 1000).toISOString();

  const oldJobsQuery = query(
    collection(firestore, PRINT_JOBS_COLLECTION),
    where("restaurantId", "==", RESTAURANT_ID),
    where("status", "==", "SUCCESS"),
    where("completedAt", "<=", cutoff),
    limit(50)
  );

  const snap = await getDocs(oldJobsQuery);
  if (snap.empty) return 0;

  const batch = writeBatch(firestore);
  snap.docs.forEach((d) => batch.delete(d.ref));
  await batch.commit();

  console.log(`[CloudPrintQueue] Cleared ${snap.size} completed jobs`);
  return snap.size;
}

// ══════════════════════════════════════════════════════════════════
//  Real-Time Subscriptions (for Admin Dashboard)
// ══════════════════════════════════════════════════════════════════

/**
 * Subscribe to real-time print job updates.
 * Returns an unsubscribe function.
 */
export function subscribeToPrintJobs(
  callback: (jobs: CloudPrintJob[]) => void,
  limitCount: number = 50
): Unsubscribe {
  const firestore = getDb();
  const jobsQuery = query(
    collection(firestore, PRINT_JOBS_COLLECTION),
    where("restaurantId", "==", RESTAURANT_ID),
    orderBy("createdAt", "desc"),
    limit(limitCount)
  );

  return onSnapshot(
    jobsQuery,
    (snapshot) => {
      const jobs: CloudPrintJob[] = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as CloudPrintJob[];
      callback(jobs);
    },
    (error) => {
      console.error("[CloudPrintQueue] Subscription error:", error);
      // Return empty array on error so UI doesn't break
      callback([]);
    }
  );
}

/**
 * Subscribe to bridge heartbeat status.
 * Probes the local print bridge daemon and listens to Cloud Firestore heartbeats.
 * Returns an unsubscribe function.
 */
export function subscribeToBridgeStatus(
  callback: (bridges: PrintBridgeHeartbeat[]) => void
): Unsubscribe {
  let firestoreBridges: PrintBridgeHeartbeat[] = [];
  let localBridge: PrintBridgeHeartbeat | null = null;
  let isSubscribed = true;

  const emitCombined = () => {
    if (!isSubscribed) return;
    const combinedMap = new Map<string, PrintBridgeHeartbeat>();
    if (localBridge) {
      combinedMap.set(localBridge.bridgeId, localBridge);
    }
    for (const fb of firestoreBridges) {
      combinedMap.set(fb.bridgeId, fb);
    }
    callback(Array.from(combinedMap.values()));
  };

  // 1. Direct Local Print Bridge Probe (via /api/print/bridge and port 9180)
  const probeLocalBridge = async () => {
    if (typeof window === "undefined" || !isSubscribed) return;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);
      const res = await fetch("/api/print/bridge", {
        signal: controller.signal,
        cache: "no-store",
        headers: { Accept: "application/json" },
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        if (data.online && data.bridge) {
          localBridge = data.bridge as PrintBridgeHeartbeat;
          emitCombined();
          return;
        }
      }

      // Fallback: Try direct connection to local daemon port 9180
      try {
        const directCtrl = new AbortController();
        const directTimer = setTimeout(() => directCtrl.abort(), 1500);
        const directRes = await fetch("http://127.0.0.1:9180/health", {
          signal: directCtrl.signal,
          headers: { Accept: "application/json" },
        });
        clearTimeout(directTimer);
        if (directRes.ok) {
          const directData = await directRes.json();
          if (directData.status === "ONLINE") {
            localBridge = {
              bridgeId: directData.bridgeId || "kk-bridge-local",
              restaurantId: directData.restaurantId || RESTAURANT_ID,
              hostname: directData.hostname || "Local POS Terminal",
              version: directData.version || "1.0.0",
              lastHeartbeat: new Date().toISOString(),
              status: "ONLINE",
              printerMapping: directData.mappedPrinters || directData.printerMapping || {
                DEFAULT: { ip: "192.168.0.108", port: 9100 },
              },
              jobsDelivered: directData.jobsDelivered || 0,
            };
            emitCombined();
            return;
          }
        }
      } catch {
        // Direct local bridge not reachable
      }

      localBridge = null;
      emitCombined();
    } catch {
      localBridge = null;
      emitCombined();
    }
  };

  // Immediate probe and recurring timer (every 3 seconds)
  probeLocalBridge();
  const pollTimer = setInterval(probeLocalBridge, 3000);

  // 2. Cloud Firestore real-time listener. Authentication must finish first;
  // without it, a fresh mobile PWA receives a permission error and shows offline.
  let unsubFirestore: Unsubscribe = () => {};
  void ensureAuth()
    .then(() => {
      if (!isSubscribed) return;
      const firestore = getDb();
      const bridgesQuery = query(
        collection(firestore, BRIDGES_COLLECTION),
        where("restaurantId", "==", RESTAURANT_ID)
      );
      unsubFirestore = onSnapshot(
        bridgesQuery,
        (snapshot) => {
          firestoreBridges = snapshot.docs.map((d) => ({
            bridgeId: d.id,
            ...d.data(),
          })) as PrintBridgeHeartbeat[];
          emitCombined();
        },
        (error) => {
          console.error("[CloudPrintQueue] Bridge heartbeat subscription failed:", error);
          firestoreBridges = [];
          emitCombined();
        }
      );
    })
    .catch((error) => {
      console.error("[CloudPrintQueue] Bridge status setup failed:", error);
      firestoreBridges = [];
      emitCombined();
    });

  return () => {
    isSubscribed = false;
    clearInterval(pollTimer);
    unsubFirestore();
  };
}

/**
 * Check if any bridge is currently online (heartbeat within threshold).
 */
export function isBridgeOnline(bridges: PrintBridgeHeartbeat[]): boolean {
  const now = Date.now();
  return bridges.some((b) => {
    const lastBeat = new Date(b.lastHeartbeat).getTime();
    return now - lastBeat < BRIDGE_ONLINE_THRESHOLD_MS;
  });
}

/**
 * Get the most recent online bridge, or null if none.
 */
export function getActiveBridge(
  bridges: PrintBridgeHeartbeat[]
): PrintBridgeHeartbeat | null {
  const now = Date.now();
  const online = bridges
    .filter((b) => now - new Date(b.lastHeartbeat).getTime() < BRIDGE_ONLINE_THRESHOLD_MS)
    .sort(
      (a, b) =>
        new Date(b.lastHeartbeat).getTime() - new Date(a.lastHeartbeat).getTime()
    );
  return online[0] || null;
}
