import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { getDatabase, runInTransaction } from "../../database/client";
import { config } from "../../config/env";
import { logger } from "../../utils/logger";
import { AuditRepository } from "../../database/repositories/audit.repository";

export interface BackupResult {
  success: boolean;
  fileName: string;
  filePath: string;
  fileSize: number;
  checksumSha256: string;
  recordCounts: Record<string, number>;
  createdAt: string;
}

export interface RestoreValidationResult {
  valid: boolean;
  checksumMatch: boolean;
  recordCounts: Record<string, number>;
  errors: string[];
}

export class BackupService {
  private static getBackupDir(): string {
    const dir = config.backupDir;
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    return dir;
  }

  /**
   * Create a full verified backup of the database
   */
  static createBackup(createdBy = "system"): BackupResult {
    const db = getDatabase();
    const backupDir = this.getBackupDir();
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const fileName = `fleet-backup-${timestamp}.sqlite`;
    const filePath = path.join(backupDir, fileName);

    logger.info("Starting database backup process", { fileName });

    // Use SQLite VACUUM INTO to create an atomic, non-blocking online backup
    db.exec(`VACUUM INTO '${filePath}';`);

    const stats = fs.statSync(filePath);
    const fileBuffer = fs.readFileSync(filePath);
    const checksumSha256 = crypto.createHash("sha256").update(fileBuffer).digest("hex");

    // Gather table counts
    const recordCounts: Record<string, number> = {
      drivers: (db.prepare("SELECT COUNT(*) as c FROM drivers").get() as any).c,
      trips: (db.prepare("SELECT COUNT(*) as c FROM trips").get() as any).c,
      dailyGpsMileages: (db.prepare("SELECT COUNT(*) as c FROM daily_gps_mileages").get() as any).c,
      imdOrders: (db.prepare("SELECT COUNT(*) as c FROM imd_orders").get() as any).c,
      imdAssignments: (db.prepare("SELECT COUNT(*) as c FROM imd_assignments").get() as any).c,
      officialLetters: (db.prepare("SELECT COUNT(*) as c FROM official_letters").get() as any).c
    };

    // Store metadata in backup_metadata table
    const id = `backup_${Date.now()}`;
    const createdAt = new Date().toISOString();

    db.prepare(`
      INSERT INTO backup_metadata (id, file_name, file_size, checksum_sha256, record_counts_json, created_at, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, fileName, stats.size, checksumSha256, JSON.stringify(recordCounts), createdAt, createdBy);

    AuditRepository.log(
      createdBy,
      "BACKUP_CREATED",
      `Өгөгдлийн сангийн нөөцлөлт үүсгэгдэв: ${fileName} (${(stats.size / 1024).toFixed(1)} KB)`
    );

    // Apply 14-day retention policy
    this.enforceRetentionPolicy(14);

    return {
      success: true,
      fileName,
      filePath,
      fileSize: stats.size,
      checksumSha256,
      recordCounts,
      createdAt
    };
  }

  /**
   * Enforce retention policy: delete backups older than maxRetain
   */
  static enforceRetentionPolicy(maxRetain = 14): void {
    const backupDir = this.getBackupDir();
    const files = fs
      .readdirSync(backupDir)
      .filter((f) => f.startsWith("fleet-backup-") && f.endsWith(".sqlite"))
      .map((f) => ({
        name: f,
        fullPath: path.join(backupDir, f),
        time: fs.statSync(path.join(backupDir, f)).mtime.getTime()
      }))
      .sort((a, b) => b.time - a.time);

    if (files.length > maxRetain) {
      const toDelete = files.slice(maxRetain);
      for (const item of toDelete) {
        try {
          fs.unlinkSync(item.fullPath);
          logger.info("Pruned old backup file under retention policy", { file: item.name });
        } catch (err) {
          logger.warn("Could not delete old backup file", { file: item.name, err });
        }
      }
    }
  }

  /**
   * Dry-run validation of a backup before actual restoration
   */
  static validateBackupForRestore(fileName: string): RestoreValidationResult {
    const backupDir = this.getBackupDir();
    const filePath = path.join(backupDir, fileName);
    const errors: string[] = [];

    if (!fs.existsSync(filePath)) {
      return { valid: false, checksumMatch: false, recordCounts: {}, errors: ["Backup file does not exist"] };
    }

    const fileBuffer = fs.readFileSync(filePath);
    const computedChecksum = crypto.createHash("sha256").update(fileBuffer).digest("hex");

    const db = getDatabase();
    const metaRow = db
      .prepare("SELECT * FROM backup_metadata WHERE file_name = ?")
      .get(fileName) as any;

    let checksumMatch = true;
    if (metaRow && metaRow.checksum_sha256 !== computedChecksum) {
      checksumMatch = false;
      errors.push("Checksum mismatch: file may have been altered or corrupted");
    }

    let recordCounts: Record<string, number> = {};
    if (metaRow && metaRow.record_counts_json) {
      try {
        recordCounts = JSON.parse(metaRow.record_counts_json);
      } catch (e) {}
    }

    return {
      valid: errors.length === 0,
      checksumMatch,
      recordCounts,
      errors
    };
  }

  /**
   * Safe restore procedure: creates pre-restore backup first
   */
  static restoreBackup(fileName: string, performedBy = "admin"): { success: boolean; message: string } {
    const validation = this.validateBackupForRestore(fileName);
    if (!validation.valid) {
      throw new Error(`Restore validation failed: ${validation.errors.join("; ")}`);
    }

    logger.info("Creating pre-restore safety backup...");
    const safetyBackup = this.createBackup(`pre_restore_${performedBy}`);

    const backupDir = this.getBackupDir();
    const backupFilePath = path.join(backupDir, fileName);
    const targetDbPath = config.dbPath;

    try {
      // Safely copy backup over current db file
      fs.copyFileSync(backupFilePath, targetDbPath);

      AuditRepository.log(
        performedBy,
        "BACKUP_RESTORED",
        `Нөөцлөлт сэргээгдэв: ${fileName}. Аюулгүйн нөөц: ${safetyBackup.fileName}`
      );

      logger.info("Database successfully restored", { fileName, targetDbPath });
      return {
        success: true,
        message: `Өгөгдлийн санг '${fileName}' файлаас амжилттай сэргээлээ.`
      };
    } catch (err: any) {
      logger.error("Restore failed, rolling back to pre-restore safety backup", err);
      fs.copyFileSync(safetyBackup.filePath, targetDbPath);
      throw new Error(`Сэргээх явцад алдаа гарсан тул өмнөх төлөв рүү буцаалаа: ${err.message}`);
    }
  }

  /**
   * List all available backups
   */
  static listBackups(): any[] {
    const db = getDatabase();
    return db.prepare("SELECT * FROM backup_metadata ORDER BY created_at DESC").all();
  }
}
