import crypto from "node:crypto";
import { getDatabase } from "../client";

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  user: string;
  action: string;
  description: string;
  oldValue?: any;
  newValue?: any;
  ip?: string;
  requestId?: string;
}

export class AuditRepository {
  static log(
    user: string,
    action: string,
    description: string,
    oldValue: any = null,
    newValue: any = null,
    ip = "",
    requestId = ""
  ): void {
    const db = getDatabase();
    const id = `audit_${Date.now()}_${crypto.randomUUID().slice(0, 6)}`;
    const timestamp = new Date().toISOString();

    db.prepare(`
      INSERT INTO audit_logs (
        id, timestamp, user, action, description, old_value_json, new_value_json, ip, request_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      timestamp,
      user,
      action,
      description,
      oldValue ? JSON.stringify(oldValue) : null,
      newValue ? JSON.stringify(newValue) : null,
      ip,
      requestId
    );
  }

  static getRecent(limit = 100): AuditLogEntry[] {
    const db = getDatabase();
    const rows = db.prepare("SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT ?").all(limit);
    return rows.map((r: any) => ({
      id: r.id,
      timestamp: r.timestamp,
      user: r.user,
      action: r.action,
      description: r.description,
      oldValue: r.old_value_json ? JSON.parse(r.old_value_json) : null,
      newValue: r.new_value_json ? JSON.parse(r.new_value_json) : null,
      ip: r.ip || "",
      requestId: r.request_id || ""
    }));
  }
}
