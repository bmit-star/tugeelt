import { getDatabase, runInTransaction } from "../server/database/client";
import { verifyDatabase } from "../server/database/verify";

export function testDatabase(): { name: string; passed: boolean; message?: string }[] {
  const results: { name: string; passed: boolean; message?: string }[] = [];

  // Test 1: Verification of SQLite schema and integrity
  try {
    const report = verifyDatabase();
    results.push({
      name: "SQLite Data Integrity & Count Verification",
      passed: report.success,
      message: report.success ? undefined : `Verification failed: FK violations=${report.foreignKeyViolations}`
    });
  } catch (e: any) {
    results.push({ name: "SQLite Data Integrity & Count Verification", passed: false, message: e.message });
  }

  // Test 2: Transaction Rollback on Error
  try {
    const db = getDatabase();
    const testId = `rollback_test_${Date.now()}`;

    let threwError = false;
    try {
      runInTransaction(() => {
        db.prepare("INSERT INTO users (id, name, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?)").run(
          testId,
          "Rollback User",
          "viewer",
          new Date().toISOString(),
          new Date().toISOString()
        );
        // Force an error inside transaction
        throw new Error("Intentional error for rollback testing");
      });
    } catch (e) {
      threwError = true;
    }

    const check = db.prepare("SELECT * FROM users WHERE id = ?").get(testId);
    const passed = threwError && check === undefined;
    results.push({
      name: "Database Transaction Rollback on Failure",
      passed,
      message: passed ? undefined : "Record was not rolled back after error!"
    });
  } catch (e: any) {
    results.push({ name: "Database Transaction Rollback on Failure", passed: false, message: e.message });
  }

  return results;
}
