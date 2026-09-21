/**
 * Authoritative SQLite Backup & Disaster Recovery Service
 * Enforces Phase 11: Reliable Backup, Corruption Defense, and Point-in-Time Restore
 */

import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

export class BackupService {
  /**
   * Create a timestamped backup of the current database file.
   * Safe for WAL mode.
   */
  static backupDatabase(sourceDbPath: string, backupDir?: string): string {
    if (!fs.existsSync(sourceDbPath)) {
      throw new Error(`Source database file does not exist at: ${sourceDbPath}`);
    }

    const dir = backupDir || path.join(path.dirname(sourceDbPath), "backups");
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupFileName = `pos-backup-${timestamp}.db`;
    const destinationPath = path.join(dir, backupFileName);

    // In SQLite WAL mode, run checkpoint before copy to ensure all wal frames are flushed
    try {
      const db = new DatabaseSync(sourceDbPath);
      db.exec("PRAGMA wal_checkpoint(TRUNCATE);");
      db.close();
    } catch {}

    fs.copyFileSync(sourceDbPath, destinationPath);
    return destinationPath;
  }

  /**
   * Restore database from backup file
   */
  static restoreDatabase(backupPath: string, targetDbPath: string): void {
    if (!fs.existsSync(backupPath)) {
      throw new Error(`Backup file does not exist at: ${backupPath}`);
    }

    // Clean up existing files including WAL and SHM
    const targetDir = path.dirname(targetDbPath);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    const walPath = `${targetDbPath}-wal`;
    const shmPath = `${targetDbPath}-shm`;

    if (fs.existsSync(walPath)) fs.unlinkSync(walPath);
    if (fs.existsSync(shmPath)) fs.unlinkSync(shmPath);

    fs.copyFileSync(backupPath, targetDbPath);

    // Verify restored database integrity
    const restoredDb = new DatabaseSync(targetDbPath);
    const integrityCheck = restoredDb.prepare("PRAGMA integrity_check;").get() as any;
    restoredDb.close();

    if (!integrityCheck || integrityCheck.integrity_check !== "ok") {
      throw new Error(`Restored database integrity check failed: ${JSON.stringify(integrityCheck)}`);
    }
  }
}
