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
  const db = new DatabaseSync(dbFilePath);

  // Configure high-performance & durable WAL mode
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA synchronous = NORMAL;");
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec("PRAGMA busy_timeout = 10000;");

  // Bootstrap tables and indices
  db.exec(SCHEMA_SQL);

  // Safe incremental schema adjustments
  try {
    db.exec("ALTER TABLE drivers ADD COLUMN km_privacy_pin TEXT;");
  } catch (e) {
    // Column already exists or schema initialized fresh
  }

  instance = db;
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
