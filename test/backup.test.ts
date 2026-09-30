import { BackupService } from "../server/modules/backup/backup.service";

export function testBackup(): { name: string; passed: boolean; message?: string }[] {
  const results: { name: string; passed: boolean; message?: string }[] = [];

  // Test 1: Create backup and verify checksum
  try {
    const backup = BackupService.createBackup("automated_test_runner");
    const validation = BackupService.validateBackupForRestore(backup.fileName);

    const passed = backup.success && validation.valid && validation.checksumMatch;
    results.push({
      name: "Atomic Online Backup Creation & SHA-256 Validation",
      passed,
      message: passed ? undefined : `Validation errors: ${validation.errors.join(", ")}`
    });
  } catch (e: any) {
    results.push({ name: "Atomic Online Backup Creation & SHA-256 Validation", passed: false, message: e.message });
  }

  return results;
}
