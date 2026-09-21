/**
 * Authoritative Server-Side SQLite Database Connection
 * Built on Node.js 22 native DatabaseSync with WAL Journaling & Foreign Keys
 */

import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

let dbInstance: DatabaseSync | null = null;

export function getDatabase(): DatabaseSync {
  if (dbInstance) {
    return dbInstance;
  }

  const isTest = process.env.NODE_ENV === "test" || Boolean(process.env.VITEST);
  
  if (isTest && process.env.USE_FILE_DB !== "true") {
    // Isolated in-memory database for fast automated test suites
    dbInstance = new DatabaseSync(":memory:");
  } else {
    // Determine writable data directory.
    // In serverless environments (e.g. Vercel, AWS Lambda where process.cwd() is /var/task),
    // the application directory is strictly read-only and writable storage is in os.tmpdir() (/tmp).
    let dataDir = process.env.DATA_DIR;

    if (!dataDir) {
      const isServerless = Boolean(
        process.env.VERCEL ||
        process.env.AWS_LAMBDA_FUNCTION_NAME ||
        (typeof process.cwd === "function" && process.cwd().startsWith("/var/task"))
      );

      if (isServerless) {
        dataDir = path.join(os.tmpdir(), "kolhapuri-data");
      } else {
        dataDir = path.resolve(process.cwd(), "data");
      }
    }

    try {
      if (!fs.existsSync(/*turbopackIgnore: true*/ dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
    } catch {
      // Fallback to OS temporary directory if working directory is read-only (e.g. /var/task)
      dataDir = path.join(os.tmpdir(), "kolhapuri-data");
      try {
        if (!fs.existsSync(/*turbopackIgnore: true*/ dataDir)) {
          fs.mkdirSync(dataDir, { recursive: true });
        }
      } catch {}
    }

    const dbPath = path.join(dataDir, "pos.db");
    try {
      dbInstance = new DatabaseSync(dbPath);
    } catch {
      dbInstance = new DatabaseSync(":memory:");
    }
  }

  // Optimize SQLite for high-speed multi-terminal concurrent restaurant operations
  dbInstance.exec(`
    PRAGMA foreign_keys = ON;
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = NORMAL;
    PRAGMA busy_timeout = 5000;
  `);

  return dbInstance;
}

let transactionDepth = 0;

/**
 * Execute a function within a SQLite transaction.
 * Supports nested transactions via SQLite SAVEPOINT.
 * Automatically commits on success and rolls back on error.
 */
export function runTransaction<T>(fn: (db: DatabaseSync) => T): T {
  const db = getDatabase();
  const isOuter = transactionDepth === 0;
  const currentDepth = transactionDepth;

  if (isOuter) {
    db.exec("BEGIN IMMEDIATE TRANSACTION");
  } else {
    db.exec(`SAVEPOINT sp_${currentDepth}`);
  }

  transactionDepth++;
  try {
    const result = fn(db);
    transactionDepth--;
    if (isOuter) {
      db.exec("COMMIT");
    } else {
      db.exec(`RELEASE SAVEPOINT sp_${currentDepth}`);
    }
    return result;
  } catch (error) {
    transactionDepth--;
    if (isOuter) {
      try {
        db.exec("ROLLBACK");
      } catch {}
    } else {
      try {
        db.exec(`ROLLBACK TO SAVEPOINT sp_${currentDepth}`);
      } catch {}
    }
    throw error;
  }
}
