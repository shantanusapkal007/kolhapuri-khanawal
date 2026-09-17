/**
 * Kolhapuri Khanawal Restaurant Operating System
 * Local Print Bridge Daemon v1.0.0
 *
 * Runs locally on the restaurant's cashier Windows PC / Raspberry Pi / POS terminal.
 * Connects outbound to Cloud Firestore (no public ports needed).
 * Claims pending print jobs atomically and delivers them over local LAN TCP :9100
 * to the thermal receipt printer (e.g., POSIFLOW KP307-UEWB at 192.168.0.108).
 *
 * Usage:
 *   node scripts/print-bridge.mjs
 *   node scripts/print-bridge.mjs --env scripts/.bridge-env
 */

import net from "node:net";
import os from "node:os";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { initializeApp, getApps } from "firebase/app";
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  updateDoc,
  query,
  where,
  onSnapshot,
  runTransaction,
  getDocs,
} from "firebase/firestore";
import {
  getAuth,
  signInWithEmailAndPassword,
  signInAnonymously,
} from "firebase/auth";

// ══════════════════════════════════════════════════════════════════
//  Environment Configuration Loader
// ══════════════════════════════════════════════════════════════════

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    for (const rawLine of content.split("\n")) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;
      const eqIdx = line.indexOf("=");
      if (eqIdx === -1) continue;
      const key = line.slice(0, eqIdx).trim();
      let val = line.slice(eqIdx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  } catch (err) {
    console.warn(`[Bridge Env] Note: Could not read ${filePath}:`, err.message);
  }
}

// Check command line arguments for --env
const args = process.argv.slice(2);
const envArgIdx = args.indexOf("--env");
if (envArgIdx !== -1 && args[envArgIdx + 1]) {
  loadEnvFile(path.resolve(process.cwd(), args[envArgIdx + 1]));
} else {
  // Try default locations
  loadEnvFile(path.join(__dirname, ".bridge-env"));
  loadEnvFile(path.resolve(process.cwd(), ".env.local"));
  loadEnvFile(path.resolve(process.cwd(), ".env"));
}

// ══════════════════════════════════════════════════════════════════
//  Settings & Constants
// ══════════════════════════════════════════════════════════════════

const RESTAURANT_ID = process.env.BRIDGE_RESTAURANT_ID || "kolhapuri-khanawal";
const HOSTNAME = os.hostname();
const SANITIZED_HOST = HOSTNAME.toLowerCase().replace(/[^a-z0-9]/g, "-");
const BRIDGE_ID = process.env.BRIDGE_ID || `kk-bridge-${SANITIZED_HOST}`;
const VERSION = "1.0.0";
const HEARTBEAT_INTERVAL_MS = 15_000; // 15 seconds
const LEASE_DURATION_MS = 60_000;     // 60 seconds lease
const TCP_TIMEOUT_MS = parseInt(process.env.BRIDGE_TCP_TIMEOUT_MS || "6000", 10);

// Parse Station to Printer Mapping from environment
// Examples:
//   PRINTER_CASHIER=192.168.0.108:9100
//   PRINTER_MAIN_KITCHEN=192.168.0.108:9100
//   DEFAULT_PRINTER=192.168.0.108:9100
const printerMapping = {};
const defaultTarget = process.env.DEFAULT_PRINTER || "192.168.0.108:9100";

function parseHostPort(str) {
  const [host, portStr] = (str || "").split(":");
  return {
    ip: host || "192.168.0.108",
    port: parseInt(portStr || "9100", 10),
  };
}

printerMapping["DEFAULT"] = parseHostPort(defaultTarget);
printerMapping["CASHIER"] = parseHostPort(process.env.PRINTER_CASHIER || defaultTarget);
printerMapping["MAIN_KITCHEN"] = parseHostPort(process.env.PRINTER_MAIN_KITCHEN || defaultTarget);
printerMapping["THALI_SECTION"] = parseHostPort(process.env.PRINTER_THALI_SECTION || defaultTarget);
printerMapping["TANDOOR_BHAKRI"] = parseHostPort(process.env.PRINTER_TANDOOR_BHAKRI || defaultTarget);
printerMapping["FRY_SECTION"] = parseHostPort(process.env.PRINTER_FRY_SECTION || defaultTarget);
printerMapping["BEVERAGE_DESSERT"] = parseHostPort(process.env.PRINTER_BEVERAGE_DESSERT || defaultTarget);

// Also look for any custom PRINTER_<STATION> keys
for (const key of Object.keys(process.env)) {
  if (key.startsWith("PRINTER_")) {
    const station = key.replace("PRINTER_", "").toUpperCase();
    printerMapping[station] = parseHostPort(process.env[key]);
  }
}

// ══════════════════════════════════════════════════════════════════
//  Firebase Initialization
// ══════════════════════════════════════════════════════════════════

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || process.env.FIREBASE_API_KEY || "AIzaSyBjg1aUq7UZCbUy1QhE-cuIsJCA_qOWXHw",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || process.env.FIREBASE_AUTH_DOMAIN || "kolhapuri-khanawal.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID || "kolhapuri-khanawal",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || process.env.FIREBASE_STORAGE_BUCKET || "kolhapuri-khanawal.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || process.env.FIREBASE_MESSAGING_SENDER_ID || "411458352091",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || process.env.FIREBASE_APP_ID || "1:411458352091:web:df9c228a995a18cb0cadfe",
};

const app = getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// ══════════════════════════════════════════════════════════════════
//  Bridge State & Counters
// ══════════════════════════════════════════════════════════════════

let jobsDelivered = 0;
let lastJobAt = null;
let heartbeatTimer = null;
let leaseRecoveryTimer = null;
let isShuttingDown = false;
const activeJobs = new Set(); // in-memory set to prevent double claiming in same bridge

function log(emoji, message, extra = "") {
  const time = new Date().toLocaleTimeString("en-IN", { hour12: false });
  console.log(`[${time}] ${emoji} ${message} ${extra}`.trim());
}

// ══════════════════════════════════════════════════════════════════
//  Authentication
// ══════════════════════════════════════════════════════════════════

async function authenticate() {
  const email = process.env.BRIDGE_EMAIL;
  const password = process.env.BRIDGE_PASSWORD;

  if (email && password) {
    try {
      const userCred = await signInWithEmailAndPassword(auth, email, password);
      log("✅", `Firebase authenticated via Email as: ${userCred.user.email}`);
      return userCred.user;
    } catch (err) {
      log("⚠️", `Email sign-in failed (${err.message}). Falling back to Anonymous Auth...`);
    }
  }

  try {
    const anonCred = await signInAnonymously(auth);
    log("✅", `Firebase authenticated silently (Anonymous UID: ${anonCred.user.uid.slice(0, 8)}...)`);
    return anonCred.user;
  } catch (err) {
    log("❌", `Firebase Authentication failed: ${err.message}`);
    throw err;
  }
}

// ══════════════════════════════════════════════════════════════════
//  Heartbeat Service
// ══════════════════════════════════════════════════════════════════

async function sendHeartbeat(status = "ONLINE") {
  if (isShuttingDown && status !== "OFFLINE") return;
  try {
    const bridgeRef = doc(db, "print_bridges", BRIDGE_ID);
    const payload = {
      bridgeId: BRIDGE_ID,
      restaurantId: RESTAURANT_ID,
      hostname: HOSTNAME,
      version: VERSION,
      lastHeartbeat: new Date().toISOString(),
      status,
      printerMapping,
      jobsDelivered,
    };
    if (lastJobAt) {
      payload.lastJobAt = lastJobAt;
    }
    await setDoc(bridgeRef, payload, { merge: true });
    if (status === "ONLINE") {
      log("💓", `Heartbeat sent (Delivered: ${jobsDelivered} jobs)`);
    }
  } catch (err) {
    log("⚠️", `Heartbeat write failed: ${err.message}`);
  }
}

// ══════════════════════════════════════════════════════════════════
//  Raw TCP Socket Delivery (ESC/POS to Thermal Printer)
// ══════════════════════════════════════════════════════════════════

/**
 * Sends binary ESC/POS payload over raw TCP socket to printer IP:9100.
 * Distinguishes between connection failure (safe to retry) vs
 * mid-transmission write error (UNCERTAIN status).
 */
function deliverToPrinter(target, payloadBuffer, timeoutMs = TCP_TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    const { ip, port } = target;
    const socket = new net.Socket();
    let bytesSent = 0;
    let connected = false;
    let startTime = Date.now();

    socket.setTimeout(timeoutMs);

    socket.connect(port, ip, () => {
      connected = true;
      const latency = Date.now() - startTime;
      log("🔌", `TCP connected to ${ip}:${port} (${latency}ms)`);

      // Write ESC/POS bytes
      socket.write(payloadBuffer, (err) => {
        if (err) {
          log("⚠️", `Write error on ${ip}:${port}: ${err.message}`);
          return; // 'error' event will handle socket closure
        }
        bytesSent = payloadBuffer.length;
      });
    });

    socket.on("drain", () => {
      // Buffer drained to network stack, safely close
      socket.end();
    });

    socket.on("close", (hadError) => {
      if (!hadError && bytesSent > 0) {
        const totalDuration = Date.now() - startTime;
        resolve({
          success: true,
          bytesSent,
          totalDuration,
          printerIp: `${ip}:${port}`,
        });
      }
    });

    socket.on("timeout", () => {
      socket.destroy();
      const err = new Error(`TCP socket timeout after ${timeoutMs}ms to ${ip}:${port}`);
      err.bytesSent = bytesSent;
      err.connected = connected;
      reject(err);
    });

    socket.on("error", (err) => {
      socket.destroy();
      err.bytesSent = bytesSent;
      err.connected = connected;
      reject(err);
    });
  });
}

// ══════════════════════════════════════════════════════════════════
//  Job Processing & Atomic Transaction Claim
// ══════════════════════════════════════════════════════════════════

async function processJob(jobId) {
  if (activeJobs.has(jobId)) return;
  activeJobs.add(jobId);

  const jobRef = doc(db, "print_jobs", jobId);

  let jobData = null;

  try {
    // 1. ATOMIC CLAIM via runTransaction
    await runTransaction(db, async (transaction) => {
      const jobSnap = await transaction.get(jobRef);
      if (!jobSnap.exists()) {
        throw new Error("Job document does not exist");
      }

      const data = jobSnap.data();
      const now = new Date();

      // Check if job is claimable:
      // Status must be PENDING, or CLAIMED with an expired lease
      const isPending = data.status === "PENDING";
      const isExpiredClaim =
        data.status === "CLAIMED" &&
        data.leaseExpiresAt &&
        new Date(data.leaseExpiresAt).getTime() < now.getTime();

      if (!isPending && !isExpiredClaim) {
        // Someone else claimed or completed it
        throw new Error("ALREADY_CLAIMED");
      }

      const leaseExpiresAt = new Date(now.getTime() + LEASE_DURATION_MS).toISOString();
      const attempts = (data.attempts || 0) + 1;

      transaction.update(jobRef, {
        status: "CLAIMED",
        claimedAt: now.toISOString(),
        claimedBy: BRIDGE_ID,
        leaseExpiresAt,
        attempts,
      });

      jobData = { ...data, id: jobId, attempts };
    });
  } catch (err) {
    activeJobs.delete(jobId);
    if (err.message === "ALREADY_CLAIMED") {
      return; // Gracefully skip, handled by another bridge
    }
    log("⚠️", `Failed to claim job ${jobId}: ${err.message}`);
    return;
  }

  log("📋", `Claimed job ${jobId} "${jobData.title}" (${jobData.type}) for station: ${jobData.stationCode}`);

  // 2. Decode payload
  let payloadBuffer;
  try {
    payloadBuffer = Buffer.from(jobData.payloadBase64, "base64");
  } catch (decodeErr) {
    log("❌", `Corrupted payload in job ${jobId}: ${decodeErr.message}`);
    await updateDoc(jobRef, {
      status: "FAILED",
      errorMessage: `Payload base64 decoding failed: ${decodeErr.message}`,
      completedAt: new Date().toISOString(),
    }).catch(() => {});
    activeJobs.delete(jobId);
    return;
  }

  // 3. Resolve target printer IP & port
  const target = printerMapping[jobData.stationCode] || printerMapping["CASHIER"] || printerMapping["DEFAULT"];

  // 4. Send to physical printer
  try {
    const result = await deliverToPrinter(target, payloadBuffer);

    // Delivery succeeded
    await updateDoc(jobRef, {
      status: "SUCCESS",
      completedAt: new Date().toISOString(),
      printerIp: result.printerIp,
      errorMessage: null,
    });

    jobsDelivered++;
    lastJobAt = new Date().toISOString();
    log("✅", `Delivered ${result.bytesSent} bytes → SUCCESS (${result.totalDuration}ms) for "${jobData.title}"`);
  } catch (printErr) {
    const nowIso = new Date().toISOString();
    log("❌", `Print delivery error on job ${jobId}: ${printErr.message}`);

    if (printErr.bytesSent && printErr.bytesSent > 0) {
      // Data was partially sent over TCP before error occurred
      // Marked as UNCERTAIN because printer buffer might have received it
      log("🟠", `Marking job ${jobId} as UNCERTAIN (bytes partially dispatched: ${printErr.bytesSent})`);
      await updateDoc(jobRef, {
        status: "UNCERTAIN",
        completedAt: nowIso,
        printerIp: `${target.ip}:${target.port}`,
        errorMessage: `Uncertain delivery: ${printErr.message} (${printErr.bytesSent} bytes sent before disconnect)`,
      }).catch(() => {});
    } else {
      // Connection failed before any bytes were transmitted
      const maxAttempts = 3;
      if (jobData.attempts < maxAttempts) {
        log("🔄", `Returning job ${jobId} to PENDING for retry (${jobData.attempts}/${maxAttempts})`);
        await updateDoc(jobRef, {
          status: "PENDING",
          claimedBy: null,
          claimedAt: null,
          leaseExpiresAt: null,
          errorMessage: `Attempt ${jobData.attempts} failed: ${printErr.message}`,
        }).catch(() => {});
      } else {
        log("🔴", `Job ${jobId} reached max attempts (${maxAttempts}) → FAILED`);
        await updateDoc(jobRef, {
          status: "FAILED",
          completedAt: nowIso,
          printerIp: `${target.ip}:${target.port}`,
          errorMessage: `Failed after ${maxAttempts} attempts: ${printErr.message}`,
        }).catch(() => {});
      }
    }
  } finally {
    activeJobs.delete(jobId);
  }
}

// ══════════════════════════════════════════════════════════════════
//  Expired Lease Recovery Service
// ══════════════════════════════════════════════════════════════════

async function recoverExpiredLeases() {
  if (isShuttingDown) return;
  try {
    const now = new Date().toISOString();
    const q = query(
      collection(db, "print_jobs"),
      where("restaurantId", "==", RESTAURANT_ID),
      where("status", "==", "CLAIMED")
    );
    const snap = await getDocs(q);
    for (const d of snap.docs) {
      const data = d.data();
      if (data.leaseExpiresAt && data.leaseExpiresAt < now) {
        if (!activeJobs.has(d.id)) {
          log("⚠️", `Found expired lease on job ${d.id} (claimed by ${data.claimedBy}). Recovering...`);
          processJob(d.id);
        }
      }
    }
  } catch (err) {
    // Non-critical, ignore
  }
}

// ══════════════════════════════════════════════════════════════════
//  Main Bridge Startup
// ══════════════════════════════════════════════════════════════════

async function startBridge() {
  console.clear ? console.clear() : null;
  console.log("════════════════════════════════════════════════════════════════════════");
  console.log(" 🖨️  KOLHAPURI KHANAWAL — LOCAL PRINT BRIDGE DAEMON v" + VERSION);
  console.log("════════════════════════════════════════════════════════════════════════");
  console.log(` Bridge ID       : ${BRIDGE_ID}`);
  console.log(` Hostname        : ${HOSTNAME}`);
  console.log(` Restaurant ID   : ${RESTAURANT_ID}`);
  console.log(` Firebase Project: ${firebaseConfig.projectId}`);
  console.log(` Mapped Printers :`);
  for (const [station, target] of Object.entries(printerMapping)) {
    console.log(`   • [${station.padEnd(16)}] → ${target.ip}:${target.port}`);
  }
  console.log("────────────────────────────────────────────────────────────────────────");

  // 1. Authenticate to Firebase
  await authenticate();

  // 2. Publish Initial Heartbeat
  await sendHeartbeat("ONLINE");

  // 3. Start Heartbeat Timer (every 15s)
  heartbeatTimer = setInterval(() => sendHeartbeat("ONLINE"), HEARTBEAT_INTERVAL_MS);

  // 4. Start Lease Recovery Timer (every 10s)
  leaseRecoveryTimer = setInterval(recoverExpiredLeases, 10_000);

  // 5. Real-time Subscription to PENDING print jobs
  const jobsQuery = query(
    collection(db, "print_jobs"),
    where("restaurantId", "==", RESTAURANT_ID),
    where("status", "==", "PENDING")
  );

  log("📡", "Listening for pending print jobs from PWA mobile phones & cashier UI...");

  onSnapshot(
    jobsQuery,
    (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === "added" || change.type === "modified") {
          const docId = change.doc.id;
          processJob(docId);
        }
      });
    },
    (err) => {
      log("❌", `Subscription error on print_jobs: ${err.message}`);
    }
  );
}

// ══════════════════════════════════════════════════════════════════
//  Graceful Shutdown
// ══════════════════════════════════════════════════════════════════

async function gracefulShutdown(signal) {
  if (isShuttingDown) return;
  isShuttingDown = true;

  console.log("\n");
  log("🛑", `Received ${signal}. Shutting down Print Bridge gracefully...`);

  clearInterval(heartbeatTimer);
  clearInterval(leaseRecoveryTimer);

  try {
    await sendHeartbeat("OFFLINE");
    log("👋", "Bridge marked OFFLINE in cloud database. Goodbye!");
  } catch (err) {
    // Ignore on exit
  }

  process.exit(0);
}

process.on("SIGINT", () => gracefulShutdown("SIGINT"));
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));

// Launch
startBridge().catch((err) => {
  console.error("\n❌ Fatal error in print bridge:", err);
  process.exit(1);
});
