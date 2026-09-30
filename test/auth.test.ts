import { createSessionToken, verifySessionToken } from "../server/auth/token.service";
import { ROLE_PERMISSIONS } from "../server/auth/auth.types";

export function testAuth(): { name: string; passed: boolean; message?: string }[] {
  const results: { name: string; passed: boolean; message?: string }[] = [];

  // Test 1: Create and verify valid session token
  try {
    const token = createSessionToken({
      userId: "driver_01",
      driverId: "M16",
      name: "Жолооч Бат",
      role: "driver",
      permissions: ROLE_PERMISSIONS.driver
    });

    const user = verifySessionToken(token);
    const passed = !!(user && user.userId === "driver_01" && user.role === "driver");
    results.push({
      name: "Session Token Creation & Signature Verification",
      passed,
      message: passed ? undefined : "User payload mismatch or verification returned null"
    });
  } catch (e: any) {
    results.push({ name: "Session Token Creation & Signature Verification", passed: false, message: e.message });
  }

  // Test 2: Tampered token signature verification failure
  try {
    const token = createSessionToken({
      userId: "driver_01",
      name: "Жолооч Бат",
      role: "driver",
      permissions: ROLE_PERMISSIONS.driver
    });

    // Tamper with payload
    const parts = token.split(".");
    const tamperedPayload = Buffer.from(JSON.stringify({ userId: "admin", role: "admin" })).toString("base64url");
    const tamperedToken = `${parts[0]}.${tamperedPayload}.${parts[2]}`;

    const user = verifySessionToken(tamperedToken);
    const passed = user === null; // MUST reject tampered token
    results.push({
      name: "Tampered Token Signature Rejection",
      passed,
      message: passed ? undefined : "Security failure: tampered token was accepted!"
    });
  } catch (e: any) {
    results.push({ name: "Tampered Token Signature Rejection", passed: false, message: e.message });
  }

  // Test 3: Expired token rejection
  try {
    // Create token that expired 1 second ago
    const expiredToken = createSessionToken(
      {
        userId: "driver_01",
        name: "Жолооч Бат",
        role: "driver",
        permissions: ROLE_PERMISSIONS.driver
      },
      -1000
    );

    const user = verifySessionToken(expiredToken);
    const passed = user === null;
    results.push({
      name: "Expired Token Rejection",
      passed,
      message: passed ? undefined : "Security failure: expired token was accepted!"
    });
  } catch (e: any) {
    results.push({ name: "Expired Token Rejection", passed: false, message: e.message });
  }

  // Test 4: Driver role permissions boundary
  try {
    const driverPerms = new Set(ROLE_PERMISSIONS.driver);
    const hasBackupRestore = driverPerms.has("backup.restore");
    const hasDriversWrite = driverPerms.has("drivers.write");
    const passed = !hasBackupRestore && !hasDriversWrite;
    results.push({
      name: "Role Privilege Isolation (Driver cannot restore backups or edit drivers)",
      passed,
      message: passed ? undefined : "Driver has excessive administrative permissions"
    });
  } catch (e: any) {
    results.push({ name: "Role Privilege Isolation", passed: false, message: e.message });
  }

  return results;
}
