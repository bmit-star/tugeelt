import { testAuth } from "./auth.test";
import { testDatabase } from "./database.test";
import { testTokens } from "./tokens.test";
import { testOdo } from "./odo.test";
import { testAppScript } from "./app-script.test";
import { testBackup } from "./backup.test";

interface TestResult {
  suite: string;
  name: string;
  passed: boolean;
  message?: string;
}

export function runAllTests(): { total: number; passed: number; failed: number; results: TestResult[] } {
  const allResults: TestResult[] = [];

  const suites: [string, () => { name: string; passed: boolean; message?: string }[]][] = [
    ["1. Authentication & RBAC Isolation", testAuth],
    ["2. Database Integrity & Transactions", testDatabase],
    ["3. Cryptographic Public Tokens", testTokens],
    ["4. ODO & Telemetry Validation", testOdo],
    ["5. Apps Script Security & HMAC", testAppScript],
    ["6. Backups & Disaster Recovery", testBackup]
  ];

  for (const [suiteName, fn] of suites) {
    try {
      const suiteResults = fn();
      for (const r of suiteResults) {
        allResults.push({ suite: suiteName, ...r });
      }
    } catch (err: any) {
      allResults.push({
        suite: suiteName,
        name: "Suite Execution",
        passed: false,
        message: err.message
      });
    }
  }

  const total = allResults.length;
  const passed = allResults.filter((r) => r.passed).length;
  const failed = total - passed;

  return { total, passed, failed, results: allResults };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log("================================================================================");
  console.log("             FLEET DIGITAL — COMPREHENSIVE SECURITY & INTEGRITY TEST            ");
  console.log("================================================================================");

  const { total, passed, failed, results } = runAllTests();

  let currentSuite = "";
  for (const r of results) {
    if (r.suite !== currentSuite) {
      currentSuite = r.suite;
      console.log(`\n▶ ${currentSuite}`);
    }
    const status = r.passed ? "✔ PASS" : "✖ FAIL";
    console.log(`  [${status}] ${r.name}`);
    if (!r.passed && r.message) {
      console.log(`         Error: ${r.message}`);
    }
  }

  console.log("\n================================================================================");
  console.log(`SUMMARY: Total: ${total} | Passed: ${passed} | Failed: ${failed}`);
  console.log(`STATUS:  ${failed === 0 ? "ALL SECURITY & INTEGRITY CHECKS PASSED" : "FAILURES DETECTED"}`);
  console.log("================================================================================");

  if (failed > 0) {
    process.exit(1);
  }
}
