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
import http from "node:http";
import os from "node:os";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";

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
    log("⚠️", `Firebase Authentication not configured or restricted: ${err.message}`);
    log("ℹ️", "Proceeding with direct Firestore connection & Local HTTP Gateway...");
    return null;
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
//  Printer Delivery: Dual Mode (Network TCP & Windows USB Spooler)
// ══════════════════════════════════════════════════════════════════

/**
 * Sends binary ESC/POS payload over raw TCP socket to printer IP:9100.
 */
function deliverViaTcp(target, payloadBuffer, timeoutMs = TCP_TIMEOUT_MS) {
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
        socket.end();
      });
    });

    socket.on("drain", () => {
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

/**
 * Sends raw ESC/POS binary bytes to Windows local/USB thermal printer via Win32 RAW Spooler API.
 */
function deliverViaWindowsSpooler(printerName, payloadBuffer) {
  return new Promise((resolve, reject) => {
    if (process.platform !== "win32") {
      return reject(new Error("Windows Spooler is only supported on Windows"));
    }
    const tempFile = path.join(os.tmpdir(), `kk-print-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.bin`);
    fs.writeFileSync(tempFile, payloadBuffer);

    const script = `
$code = @"
using System;
using System.IO;
using System.Runtime.InteropServices;
public class RawPrinterHelper {
    [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Ansi)]
    public class DOCINFOA {
        [MarshalAs(UnmanagedType.LPStr)] public string pDocName;
        [MarshalAs(UnmanagedType.LPStr)] public string pOutputFile;
        [MarshalAs(UnmanagedType.LPStr)] public string pDataType;
    }
    [DllImport("winspool.Drv", EntryPoint="OpenPrinterA", SetLastError=true, CharSet=CharSet.Ansi, ExactSpelling=true, CallingConvention=CallingConvention.StdCall)]
    public static extern bool OpenPrinter([MarshalAs(UnmanagedType.LPStr)] string szPrinter, out IntPtr hPrinter, IntPtr pd);
    [DllImport("winspool.Drv", EntryPoint="ClosePrinter", SetLastError=true, ExactSpelling=true, CallingConvention=CallingConvention.StdCall)]
    public static extern bool ClosePrinter(IntPtr hPrinter);
    [DllImport("winspool.Drv", EntryPoint="StartDocPrinterA", SetLastError=true, CharSet=CharSet.Ansi, ExactSpelling=true, CallingConvention=CallingConvention.StdCall)]
    public static extern bool StartDocPrinter(IntPtr hPrinter, Int32 level, [In, MarshalAs(UnmanagedType.LPStruct)] DOCINFOA di);
    [DllImport("winspool.Drv", EntryPoint="EndDocPrinter", SetLastError=true, ExactSpelling=true, CallingConvention=CallingConvention.StdCall)]
    public static extern bool EndDocPrinter(IntPtr hPrinter);
    [DllImport("winspool.Drv", EntryPoint="StartPagePrinter", SetLastError=true, ExactSpelling=true, CallingConvention=CallingConvention.StdCall)]
    public static extern bool StartPagePrinter(IntPtr hPrinter);
    [DllImport("winspool.Drv", EntryPoint="EndPagePrinter", SetLastError=true, ExactSpelling=true, CallingConvention=CallingConvention.StdCall)]
    public static extern bool EndPagePrinter(IntPtr hPrinter);
    [DllImport("winspool.Drv", EntryPoint="WritePrinter", SetLastError=true, ExactSpelling=true, CallingConvention=CallingConvention.StdCall)]
    public static extern bool WritePrinter(IntPtr hPrinter, IntPtr pBytes, Int32 dwCount, out Int32 dwWritten);

    public static bool SendBytesToPrinter(string szPrinterName, byte[] bytes) {
        IntPtr hPrinter = IntPtr.Zero;
        DOCINFOA di = new DOCINFOA();
        di.pDocName = "RAW_POS_JOB";
        di.pDataType = "RAW";
        if (OpenPrinter(szPrinterName.Normalize(), out hPrinter, IntPtr.Zero)) {
            if (StartDocPrinter(hPrinter, 1, di)) {
                if (StartPagePrinter(hPrinter)) {
                    IntPtr pUnmanagedBytes = Marshal.AllocCoTaskMem(bytes.Length);
                    Marshal.Copy(bytes, 0, pUnmanagedBytes, bytes.Length);
                    int dwWritten = 0;
                    bool success = WritePrinter(hPrinter, pUnmanagedBytes, bytes.Length, out dwWritten);
                    Marshal.FreeCoTaskMem(pUnmanagedBytes);
                    EndPagePrinter(hPrinter);
                    EndDocPrinter(hPrinter);
                    ClosePrinter(hPrinter);
                    return success;
                }
                EndDocPrinter(hPrinter);
            }
            ClosePrinter(hPrinter);
        }
        return false;
    }
}
"@
if (-not ([System.Management.Automation.PSTypeName]'RawPrinterHelper').Type) {
    Add-Type -TypeDefinition $code -Language CSharp
}
$bytes = [System.IO.File]::ReadAllBytes('${tempFile.replace(/\\/g, "\\\\")}')
$res = [RawPrinterHelper]::SendBytesToPrinter('${printerName}', $bytes)
Write-Output "RESULT:$res"
`;

    execFile("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", script], { timeout: 10000 }, (err, stdout) => {
      try { fs.unlinkSync(tempFile); } catch {}
      if (err) {
        return reject(err);
      }
      if (stdout && stdout.includes("RESULT:True")) {
        return resolve({
          success: true,
          bytesSent: payloadBuffer.length,
          totalDuration: 100,
          printerIp: `windows:${printerName}`,
        });
      }
      reject(new Error(`Windows Spooler write to ${printerName} failed`));
    });
  });
}

/**
 * Delivers ESC/POS binary bytes to target.
 * Supports Network TCP (:9100) with automatic fallback to Windows USB printer ("POS80 Printer").
 */
async function deliverToPrinter(target, payloadBuffer, timeoutMs = TCP_TIMEOUT_MS) {
  // First attempt: Network TCP socket (e.g., 192.168.0.108:9100)
  try {
    return await deliverViaTcp(target, payloadBuffer, timeoutMs);
  } catch (tcpErr) {
    // If TCP connection failed/timed out, try Windows USB printer fallback
    const winPrinter = process.env.WINDOWS_PRINTER || "POS80 Printer";
    if (process.platform === "win32" && winPrinter) {
      log("🔀", `TCP to ${target.ip}:${target.port} failed (${tcpErr.message}). Trying Windows USB printer "${winPrinter}"...`);
      try {
        const winResult = await deliverViaWindowsSpooler(winPrinter, payloadBuffer);
        log("✅", `Delivered via Windows USB printer "${winPrinter}"!`);
        return winResult;
      } catch (winErr) {
        log("⚠️", `Windows USB fallback also failed: ${winErr.message}`);
      }
    }
    throw tcpErr;
  }
}

const recentDeliveredFingerprints = new Map();

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

  // Deduplication check: prevent physical double-print if identical job arrived within 15 seconds
  const dedupKey = jobData.idempotencyKey || `${jobData.type}_${jobData.stationCode}_${jobData.payloadBase64?.substring(0, 48)}`;
  const nowMs = Date.now();
  if (recentDeliveredFingerprints.has(dedupKey) && nowMs - recentDeliveredFingerprints.get(dedupKey) < 15000) {
    log("⚠️", `Duplicate job ${jobId} "${jobData.title}" suppressed by bridge daemon (already printed within 15s)`);
    await updateDoc(jobRef, {
      status: "SUCCESS",
      completedAt: new Date().toISOString(),
      printerIp: "DEDUP_SUPPRESSED",
      errorMessage: "Suppressed duplicate print within 15s window",
    }).catch(() => {});
    activeJobs.delete(jobId);
    return;
  }

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

    // Record delivery in dedup cache
    recentDeliveredFingerprints.set(dedupKey, Date.now());
    for (const [k, ts] of recentDeliveredFingerprints.entries()) {
      if (Date.now() - ts > 60000) recentDeliveredFingerprints.delete(k);
    }

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
//  Local HTTP Print Gateway (Port 9180)
// ══════════════════════════════════════════════════════════════════

const HTTP_PORT = parseInt(process.env.BRIDGE_HTTP_PORT || "9180", 10);
let httpServer = null;

function startHttpServer() {
  const server = http.createServer(async (req, res) => {
    // Enable CORS for local POS access
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    if (req.method === "GET" && (req.url === "/" || req.url === "/health")) {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          status: "ONLINE",
          bridgeId: BRIDGE_ID,
          restaurantId: RESTAURANT_ID,
          version: VERSION,
          uptimeSeconds: Math.floor(process.uptime()),
          jobsDelivered,
          mappedPrinters: printerMapping,
        })
      );
      return;
    }

    if (req.method === "POST" && req.url === "/print") {
      let body = "";
      req.on("data", (chunk) => {
        body += chunk;
      });
      req.on("end", async () => {
        try {
          const data = JSON.parse(body || "{}");
          const payloadBase64 = data.payloadBase64;
          const stationCode = (data.stationCode || data.printerName || "CASHIER").toUpperCase();
          const target = getTargetPrinter(stationCode);

          if (!payloadBase64) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Missing payloadBase64" }));
            return;
          }

          const rawBuffer = Buffer.from(payloadBase64, "base64");
          log(
            "📥",
            `HTTP print job received: "${data.title || "Untitled"}" → ${target.ip}:${target.port} (${rawBuffer.length} bytes)`
          );

          const result = await sendTcpRaw(target.ip, target.port, rawBuffer);
          jobsDelivered++;
          lastJobAt = new Date().toISOString();

          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: true, delivered: true, ...result }));
        } catch (err) {
          log("❌", `HTTP print error: ${err.message}`);
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: err.message }));
        }
      });
      return;
    }

    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Not found" }));
  });

  server.on("error", (err) => {
    if (err.code === "EADDRINUSE") {
      log("⚠️", `HTTP port ${HTTP_PORT} already in use. Local HTTP gateway disabled; continuing cloud queue.`);
    } else {
      log("⚠️", `HTTP server error: ${err.message}`);
    }
  });

  server.listen(HTTP_PORT, "0.0.0.0", () => {
    log("🌐", `Local HTTP Print Gateway active at http://localhost:${HTTP_PORT}/print`);
  });

  return server;
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

  // 2. Start Local HTTP Gateway (:9180)
  httpServer = startHttpServer();

  // 3. Publish Initial Heartbeat
  await sendHeartbeat("ONLINE");

  // 4. Start Heartbeat Timer (every 15s)
  heartbeatTimer = setInterval(() => sendHeartbeat("ONLINE"), HEARTBEAT_INTERVAL_MS);

  // 5. Start Lease Recovery Timer (every 10s)
  leaseRecoveryTimer = setInterval(recoverExpiredLeases, 10_000);

  // 6. Real-time Subscription to PENDING print jobs
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
  if (httpServer) {
    try { httpServer.close(); } catch {}
  }

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
