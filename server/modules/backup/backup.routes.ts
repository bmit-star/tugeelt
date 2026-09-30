import { Router, Request, Response } from "express";
import { BackupService } from "./backup.service";
import { verifyDatabase } from "../../database/verify";
import { requireAuth, requireRole, AuthenticatedRequest } from "../../middleware/auth.middleware";
import { logger } from "../../utils/logger";

export const backupRouter = Router();

// List backups
backupRouter.get("/", requireAuth(), requireRole("admin", "manager"), (req: Request, res: Response) => {
  const backups = BackupService.listBackups();
  res.json({ success: true, backups });
});

// Create backup
backupRouter.post("/", requireAuth(), requireRole("admin", "manager"), (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  try {
    const backup = BackupService.createBackup(authReq.user?.name || "manager");
    res.json({ success: true, backup });
  } catch (err: any) {
    logger.error("Backup creation failed", err);
    res.status(500).json({ error: "Нөөцлөлт үүсгэхэд алдаа гарлаа: " + err.message });
  }
});

// Restore backup (Admin only)
backupRouter.post("/restore", requireAuth(), requireRole("admin"), (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  const { fileName } = req.body;

  if (!fileName) {
    return res.status(400).json({ error: "fileName талбар шаардлагатай." });
  }

  try {
    const result = BackupService.restoreBackup(fileName, authReq.user?.name || "admin");
    res.json(result);
  } catch (err: any) {
    logger.error("Backup restoration failed", err);
    res.status(500).json({ error: err.message });
  }
});

// Verify database health & integrity
backupRouter.get("/verify", requireAuth(), requireRole("admin", "manager"), (req: Request, res: Response) => {
  try {
    const report = verifyDatabase();
    res.json(report);
  } catch (err: any) {
    res.status(500).json({ error: "Verification failed: " + err.message });
  }
});
