import fs from "node:fs";
import path from "node:path";
import { getDatabase } from "./client";

export function verifyDatabase(
  jsonFilePath = path.join(process.cwd(), "data", "fleet-db.json")
) {
  const db = getDatabase();
  const jsonRaw = fs.readFileSync(jsonFilePath, "utf8");
  const json = JSON.parse(jsonRaw);

  const tableCounts: Record<string, { json: number; db: number; match: boolean }> = {};

  const check = (name: string, jsonArray: any[], sqlTable: string) => {
    const jCount = (jsonArray || []).length;
    const dbCount = (db.prepare(`SELECT COUNT(*) as c FROM ${sqlTable}`).get() as any).c;
    tableCounts[name] = {
      json: jCount,
      db: dbCount,
      match: jCount === dbCount
    };
  };

  check("Drivers", json.drivers, "drivers");
  check("Trips", json.trips, "trips");
  check("Daily GPS Mileages", json.dailyGPSMileages, "daily_gps_mileages");
  check("Fuel Refills", json.fuelRefills, "fuel_refills");
  check("IMD Orders", json.orders, "imd_orders");
  check("IMD Assignments", json.assignments, "imd_assignments");
  check("IMD Routes", json.routes, "imd_routes");
  check("Official Letters", json.officialLetters, "official_letters");

  // SQLite PRAGMA checks
  const integrityResult = (db.prepare("PRAGMA integrity_check;").get() as any).integrity_check;
  const fkCheckResult = db.prepare("PRAGMA foreign_key_check;").all();

  const allMatched = Object.values(tableCounts).every((t) => t.match);
  const integrityPassed = integrityResult === "ok" && fkCheckResult.length === 0;

  return {
    success: allMatched && integrityPassed,
    allMatched,
    integrityPassed,
    integrityResult,
    foreignKeyViolations: fkCheckResult.length,
    tableCounts
  };
}

const isDirectRun = typeof process !== "undefined" && process.argv[1] && (process.argv[1].endsWith("verify.ts") || process.argv[1].endsWith("verify.js"));
if (isDirectRun) {
  const result = verifyDatabase();
  console.log("=========================================");
  console.log("  FLEET DIGITAL — DATABASE VERIFICATION   ");
  console.log("=========================================");
  console.log(`SQLite Integrity:   ${result.integrityResult}`);
  console.log(`FK Violations:      ${result.foreignKeyViolations}`);
  console.log("-----------------------------------------");
  console.log("Table Verification Report:");
  console.log("| Entity               | JSON Count | DB Count | Status |");
  console.log("|----------------------|------------|----------|--------|");
  for (const [name, row] of Object.entries(result.tableCounts)) {
    const status = row.match ? "PASS" : "FAIL";
    console.log(`| ${name.padEnd(20)} | ${String(row.json).padStart(10)} | ${String(row.db).padStart(8)} | ${status.padStart(6)} |`);
  }
  console.log("=========================================");
  console.log(`Overall Result: ${result.success ? "VERIFIED (ALL PASS)" : "VERIFICATION FAILED"}`);
  console.log("=========================================");

  if (!result.success) {
    process.exit(1);
  }
}
