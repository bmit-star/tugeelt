import { getDatabase, runInTransaction } from "./client";
import { logger } from "../utils/logger";

export function seedInitialAdmin() {
  const db = getDatabase();
  runInTransaction(() => {
    // Check if default admin exists
    const admin = db.prepare("SELECT * FROM users WHERE email = ?").get("admin@fleetdigital.mn");
    if (!admin) {
      db.prepare(`
        INSERT INTO users (id, email, name, role, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        "user_admin_01",
        "admin@fleetdigital.mn",
        "Системийн Админ",
        "admin",
        new Date().toISOString(),
        new Date().toISOString()
      );
      logger.info("Default system admin seeded successfully");
    }
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  seedInitialAdmin();
  console.log("Database seeded successfully");
}
