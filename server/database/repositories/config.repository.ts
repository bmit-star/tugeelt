import { getDatabase } from "../client";

export class ConfigRepository {
  static get<T = any>(key: string): T | null {
    const db = getDatabase();
    const row = db.prepare("SELECT value_json FROM app_configs WHERE key = ?").get(key) as any;
    if (!row || !row.value_json) return null;
    try {
      return JSON.parse(row.value_json);
    } catch {
      return null;
    }
  }

  static set(key: string, value: any): void {
    const db = getDatabase();
    db.prepare(`
      INSERT OR REPLACE INTO app_configs (key, value_json, updated_at)
      VALUES (?, ?, ?)
    `).run(key, JSON.stringify(value), new Date().toISOString());
  }
}
