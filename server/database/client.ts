import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { config } from "../config/env";
import { SCHEMA_SQL } from "./schema";
import { logger } from "../utils/logger";

let instance: DatabaseSync | null = null;

export function getDatabase(dbFilePath = config.dbPath): DatabaseSync {
  if (instance) return instance;

  const dbDir = path.dirname(dbFilePath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  logger.info("Initializing SQLite database connection", { dbFilePath });
  
  const initDb = (filePath: string): DatabaseSync => {
    const db = new DatabaseSync(filePath);
    // Configure high-performance & durable WAL mode
    db.exec("PRAGMA journal_mode = WAL;");
    db.exec("PRAGMA synchronous = NORMAL;");
    db.exec("PRAGMA foreign_keys = ON;");
    db.exec("PRAGMA busy_timeout = 10000;");

    // Verify integrity
    const check = db.prepare("PRAGMA integrity_check;").get() as any;
    if (check && check.integrity_check && check.integrity_check !== "ok") {
      throw new Error(`Integrity check failed: ${check.integrity_check}`);
    }

    // Bootstrap tables and indices if not already present
    const hasUsers = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='users';").get();
    if (!hasUsers) {
      db.exec(SCHEMA_SQL);
    } else {
      try {
        db.exec("ALTER TABLE trips ADD COLUMN is_manual INTEGER DEFAULT 0;");
      } catch (e) {}

      const ddaCols = [
        "driver_phone TEXT",
        "driver_status TEXT",
        "driver_reason TEXT",
        "sales_rep TEXT",
        "sales_rep_phone TEXT",
        "sr_code TEXT",
        "original_vehicle_plate TEXT",
        "vehicle_status TEXT",
        "vehicle_reason TEXT",
        "actual_vehicle_plate TEXT",
        "vehicle_changed INTEGER DEFAULT 0",
        "route_status TEXT"
      ];
      for (const col of ddaCols) {
        try {
          db.exec(`ALTER TABLE daily_driver_assignments ADD COLUMN ${col};`);
        } catch (e) {}
      }
    }

    return db;
  };

  try {
    instance = initDb(dbFilePath);
  } catch (err: any) {
    logger.error("Database initialization or integrity error, creating fresh database backup:", err.message);
    try {
      if (fs.existsSync(dbFilePath)) {
        const corruptBackup = `${dbFilePath}.corrupt.${Date.now()}`;
        fs.renameSync(dbFilePath, corruptBackup);
        if (fs.existsSync(`${dbFilePath}-wal`)) {
          fs.renameSync(`${dbFilePath}-wal`, `${corruptBackup}-wal`);
        }
        if (fs.existsSync(`${dbFilePath}-shm`)) {
          fs.renameSync(`${dbFilePath}-shm`, `${corruptBackup}-shm`);
        }
        logger.info(`Backed up corrupted database to ${corruptBackup}`);
      }
      instance = initDb(dbFilePath);
    } catch (recreateErr: any) {
      logger.error("Fatal: failed to recreate database after corruption:", recreateErr.message);
      throw recreateErr;
    }
  }

  return instance;
}

// Transaction execution helper with automatic rollback
export function runInTransaction<T>(fn: () => T): T {
  const db = getDatabase();
  db.exec("BEGIN IMMEDIATE;");
  try {
    const result = fn();
    db.exec("COMMIT;");
    return result;
  } catch (error) {
    db.exec("ROLLBACK;");
    logger.error("Transaction rolled back due to error", error);
    throw error;
  }
}

// Async mutex for resource locking (e.g. concurrent letter numbers or trip completes)
class AsyncLockManager {
  private locks = new Map<string, Promise<void>>();

  async acquire<T>(resource: string, fn: () => Promise<T>): Promise<T> {
    while (this.locks.has(resource)) {
      await this.locks.get(resource);
    }

    let release: () => void;
    const lockPromise = new Promise<void>((resolve) => {
      release = resolve;
    });

    this.locks.set(resource, lockPromise);

    try {
      return await fn();
    } finally {
      this.locks.delete(resource);
      release!();
    }
  }
}

export const lockManager = new AsyncLockManager();

// Close DB (for tests or clean shutdowns)
export function closeDatabase(): void {
  if (instance) {
    try {
      instance.close();
    } catch (e) {
      // ignore
    }
    instance = null;
  }
}
