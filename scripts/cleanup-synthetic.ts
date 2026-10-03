import fs from "node:fs";
import path from "node:path";
import { getDatabase } from "../server/database/client";

interface CleanupReport {
  dryRun: boolean;
  backupFile?: string;
  initialTripsCount: number;
  remainingTripsCount: number;
  purgedTripsCount: number;
  initialGpsCount: number;
  remainingGpsCount: number;
  purgedGpsCount: number;
  purgedExDriversCount: number;
  purgedDriverIds: string[];
  purgedPlates: string[];
}

export function runCleanupSynthetic(dryRun = false): CleanupReport {
  const dbFile = path.resolve(process.cwd(), "data/fleet-db.json");
  const backupDir = path.resolve(process.cwd(), "data/backups");
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const raw = fs.readFileSync(dbFile, "utf-8");
  const state = JSON.parse(raw);

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  let backupFile: string | undefined;

  if (!dryRun) {
    backupFile = path.join(backupDir, `fleet-db.pre-cleanup-${timestamp}.json`);
    fs.writeFileSync(backupFile, raw, "utf-8");
  }

  // 1. Identify active registered driver IDs and plates
  const activeDrivers = (state.drivers || []).filter((d: any) => d && d.status !== "deleted");
  const activeDriverIds = new Set<string>(
    activeDrivers.map((d: any) => String(d.id || "").trim().toUpperCase()).filter(Boolean)
  );
  const activePlates = new Set<string>(
    activeDrivers.map((d: any) => String(d.vehicle || "").trim().toUpperCase().replace(/\s+/g, "")).filter(Boolean)
  );

  const syntheticDriverIds = new Set(["EX1", "EX2", "EX3", "EX4", "EX5", "EX6"]);
  const syntheticPlates = new Set(["1296УНА", "1036УЕВ", "6830УЕХ", "7254УАУ", "7263УНЧ", "7431УАХ"]);

  // 2. Filter drivers (strip EX1..EX6 if present)
  const initialDriversCount = (state.drivers || []).length;
  state.drivers = (state.drivers || []).filter((d: any) => {
    if (!d || !d.id) return false;
    const cleanId = String(d.id).trim().toUpperCase();
    return !syntheticDriverIds.has(cleanId);
  });
  const purgedExDriversCount = initialDriversCount - state.drivers.length;

  // 3. Filter trips
  const initialTripsCount = (state.trips || []).length;
  const purgedDriverIdsSet = new Set<string>();
  const purgedPlatesSet = new Set<string>();

  state.trips = (state.trips || []).filter((t: any) => {
    if (!t) return false;
    const dId = String(t.driverId || "").trim().toUpperCase();
    const plate = String(t.vehicleNumber || "").trim().toUpperCase().replace(/\s+/g, "");

    // Check synthetic markers
    if (syntheticDriverIds.has(dId) || syntheticPlates.has(plate)) {
      purgedDriverIdsSet.add(dId);
      purgedPlatesSet.add(plate);
      return false;
    }

    // Check if associated with active driver or plate
    const hasValidDriver = activeDriverIds.has(dId);
    const hasValidPlate = activePlates.has(plate);

    if (!hasValidDriver && !hasValidPlate) {
      purgedDriverIdsSet.add(dId);
      purgedPlatesSet.add(plate);
      return false;
    }

    return true;
  });

  const remainingTripsCount = state.trips.length;
  const purgedTripsCount = initialTripsCount - remainingTripsCount;

  // 4. Filter daily GPS mileages
  const initialGpsCount = (state.dailyGPSMileages || []).length;
  state.dailyGPSMileages = (state.dailyGPSMileages || []).filter((m: any) => {
    if (!m) return false;
    const dId = String(m.driverId || "").trim().toUpperCase();
    const plate = String(m.vehicleNumber || "").trim().toUpperCase().replace(/\s+/g, "");

    if (syntheticDriverIds.has(dId) || syntheticPlates.has(plate)) return false;
    return activeDriverIds.has(dId) || activePlates.has(plate);
  });
  const remainingGpsCount = state.dailyGPSMileages.length;
  const purgedGpsCount = initialGpsCount - remainingGpsCount;

  // Record migration in state metadata
  if (!state.meta) state.meta = {};
  if (!state.meta.migrations) state.meta.migrations = [];
  if (!state.meta.migrations.includes("cleanup-synthetic-v1")) {
    state.meta.migrations.push("cleanup-synthetic-v1");
  }

  // 5. Save changes if not dry-run
  if (!dryRun) {
    const compactJson = JSON.stringify(state);
    const tempFile = dbFile + ".tmp";
    fs.writeFileSync(tempFile, compactJson, "utf-8");
    fs.renameSync(tempFile, dbFile);

    // Sync to SQLite
    try {
      const sqlite = getDatabase();
      sqlite.exec("BEGIN IMMEDIATE;");
      try {
        // Delete synthetic/orphaned trips from SQLite
        const tripsToDelete = sqlite.prepare(`
          DELETE FROM trips 
          WHERE driver_id IN ('EX1','EX2','EX3','EX4','EX5','EX6')
             OR UPPER(REPLACE(vehicle_number, ' ', '')) IN ('1296УНА','1036УЕВ','6830УЕХ','7254УАУ','7263УНЧ','7431УАХ')
        `);
        tripsToDelete.run();

        const gpsToDelete = sqlite.prepare(`
          DELETE FROM daily_gps_mileages 
          WHERE driver_id IN ('EX1','EX2','EX3','EX4','EX5','EX6')
             OR UPPER(REPLACE(vehicle_number, ' ', '')) IN ('1296УНА','1036УЕВ','6830УЕХ','7254УАУ','7263УНЧ','7431УАХ')
        `);
        gpsToDelete.run();

        sqlite.exec("COMMIT;");
      } catch (sqErr) {
        sqlite.exec("ROLLBACK;");
        console.error("SQLite cleanup error:", sqErr);
      }
    } catch (e) {
      console.warn("SQLite connection warning during cleanup:", e);
    }
  }

  return {
    dryRun,
    backupFile,
    initialTripsCount,
    remainingTripsCount,
    purgedTripsCount,
    initialGpsCount,
    remainingGpsCount,
    purgedGpsCount,
    purgedExDriversCount,
    purgedDriverIds: Array.from(purgedDriverIdsSet),
    purgedPlates: Array.from(purgedPlatesSet)
  };
}

if (process.argv[1] && process.argv[1].includes("cleanup-synthetic")) {
  const isDryRun = process.argv.includes("--dry-run");
  console.log(`[CLEANUP] Running cleanup-synthetic (dryRun=${isDryRun})...`);
  const report = runCleanupSynthetic(isDryRun);
  console.log("=========================================");
  console.log("   CLEANUP SYNTHETIC DATA REPORT         ");
  console.log("=========================================");
  console.log(`Dry Run:            ${report.dryRun}`);
  console.log(`Backup File:        ${report.backupFile || "None"}`);
  console.log(`Purged EX Drivers:  ${report.purgedExDriversCount}`);
  console.log(`Purged Trips:       ${report.purgedTripsCount} (${report.initialTripsCount} -> ${report.remainingTripsCount})`);
  console.log(`Purged GPS Records: ${report.purgedGpsCount} (${report.initialGpsCount} -> ${report.remainingGpsCount})`);
  console.log(`Purged Driver IDs:  ${report.purgedDriverIds.join(", ") || "None"}`);
  console.log(`Purged Plates:      ${report.purgedPlates.join(", ") || "None"}`);
  console.log("=========================================");
}
