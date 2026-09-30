import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { getDatabase, runInTransaction } from "./client";
import { logger } from "../utils/logger";

export interface MigrationResult {
  success: boolean;
  backupFile: string;
  backupChecksum: string;
  counts: {
    jsonDrivers: number;
    dbDrivers: number;
    jsonTrips: number;
    dbTrips: number;
    jsonGpsMileages: number;
    dbGpsMileages: number;
    jsonFuelRefills: number;
    dbFuelRefills: number;
    jsonOrders: number;
    dbOrders: number;
    jsonAssignments: number;
    dbAssignments: number;
    jsonRoutes: number;
    dbRoutes: number;
    jsonLetters: number;
    dbLetters: number;
  };
  durationMs: number;
  duplicateCount: number;
  errors: string[];
}

export function runMigration(
  jsonFilePath = path.join(process.cwd(), "data", "fleet-db.json")
): MigrationResult {
  const startTime = Date.now();
  const errors: string[] = [];
  let duplicateCount = 0;

  if (!fs.existsSync(jsonFilePath)) {
    throw new Error(`Migration source JSON not found at ${jsonFilePath}`);
  }

  // 1. Read JSON file and compute checksum
  const jsonRaw = fs.readFileSync(jsonFilePath, "utf8");
  const backupChecksum = crypto.createHash("sha256").update(jsonRaw).digest("hex");

  // 2. Create pre-migration backup
  const backupDir = path.join(process.cwd(), "data", "backups");
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupFile = path.join(backupDir, `fleet-db.pre-migration-${timestamp}.json`);
  fs.writeFileSync(backupFile, jsonRaw, "utf8");
  logger.info("Created pre-migration JSON backup", { backupFile, backupChecksum });

  const data = JSON.parse(jsonRaw);
  const db = getDatabase();

  // 3. Transaction-safe migration
  runInTransaction(() => {
    // A. Migrate Drivers
    const drivers = Array.isArray(data.drivers) ? data.drivers : [];
    const insertDriver = db.prepare(`
      INSERT OR REPLACE INTO drivers (
        id, code, name, phone, vehicle, model, sales_rep, default_route,
        status, is_custom, is_imd, box_capacity, job_title, organization,
        total_assigned_km, auto_odo_config, auto_waybill_enabled, telemetry_json, km_privacy_pin, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const d of drivers) {
      insertDriver.run(
        String(d.id),
        String(d.code || d.id),
        String(d.name || "Жолооч"),
        String(d.phone || ""),
        String(d.vehicle || ""),
        String(d.model || ""),
        String(d.salesRep || ""),
        String(d.defaultRoute || ""),
        String(d.status || "active"),
        d.isCustom ? 1 : 0,
        d.isIMD ? 1 : 0,
        Number(d.boxCapacity) || null,
        String(d.jobTitle || ""),
        String(d.organization || ""),
        Number(d.totalAssignedKm) || 0,
        d.autoOdoConfig ? JSON.stringify(d.autoOdoConfig) : null,
        d.autoWaybillEnabled !== false ? 1 : 0,
        d.telemetry ? JSON.stringify(d.telemetry) : null,
        d.kmPrivacyPin ? String(d.kmPrivacyPin) : null,
        new Date().toISOString()
      );
    }

    // B. Migrate Vehicles (Derived from drivers)
    const insertVehicle = db.prepare(`
      INSERT OR REPLACE INTO vehicles (
        plate, model, driver_id, imei, default_driver_name, status, last_telemetry_json, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const seenPlates = new Set<string>();
    for (const d of drivers) {
      if (d.vehicle && !seenPlates.has(d.vehicle)) {
        seenPlates.add(d.vehicle);
        insertVehicle.run(
          String(d.vehicle).trim().toUpperCase(),
          String(d.model || ""),
          String(d.id),
          "",
          String(d.name || ""),
          "active",
          d.telemetry ? JSON.stringify(d.telemetry) : null,
          new Date().toISOString()
        );
      }
    }

    // C. Migrate Trips
    const trips = Array.isArray(data.trips) ? data.trips : [];
    const insertTrip = db.prepare(`
      INSERT OR REPLACE INTO trips (
        id, date, driver_id, driver_name, vehicle_number, sales_rep, zone,
        start_odo, end_odo, total_km, fuel_liters, fuel_cost, fuel_station,
        fuel_receipt_no, status, odo_calculation_status, route_note,
        manual_override_reason, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const t of trips) {
      insertTrip.run(
        String(t.id),
        String(t.date || new Date().toISOString().slice(0, 10)),
        String(t.driverId || ""),
        String(t.driverName || ""),
        String(t.vehicleNumber || ""),
        String(t.salesRep || ""),
        String(t.zone || ""),
        Number(t.startOdo) || 0,
        t.endOdo !== undefined && t.endOdo !== null ? Number(t.endOdo) : null,
        t.totalKm !== undefined && t.totalKm !== null ? Number(t.totalKm) : null,
        t.fuelLiters !== undefined ? Number(t.fuelLiters) : null,
        t.fuelCost !== undefined ? Number(t.fuelCost) : null,
        String(t.fuelStation || ""),
        String(t.fuelReceiptNo || ""),
        String(t.status || "completed"),
        String(t.odoCalculationStatus || (t.totalKm !== undefined ? "valid" : "pending")),
        String(t.routeNote || ""),
        String(t.manualOverrideReason || ""),
        String(t.createdAt || new Date().toISOString()),
        String(t.updatedAt || new Date().toISOString())
      );
    }

    // D. Migrate Daily GPS Mileages
    const gpsMileages = Array.isArray(data.dailyGPSMileages) ? data.dailyGPSMileages : [];
    const insertGps = db.prepare(`
      INSERT OR REPLACE INTO daily_gps_mileages (
        vehicle_number, date, driver_id, total_km, source, fetched_at, api_status, start_odo, end_odo, note
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const g of gpsMileages) {
      insertGps.run(
        String(g.vehicleNumber).trim().toUpperCase(),
        String(g.date),
        g.driverId ? String(g.driverId) : null,
        Number(g.totalKm) || 0,
        String(g.source || "gpsbox_api"),
        String(g.fetchedAt || new Date().toISOString()),
        String(g.apiStatus || "success"),
        g.startOdo !== undefined ? Number(g.startOdo) : null,
        g.endOdo !== undefined ? Number(g.endOdo) : null,
        g.note ? String(g.note) : null
      );
    }

    // E. Migrate Fuel Refills
    const fuelRefills = Array.isArray(data.fuelRefills) ? data.fuelRefills : [];
    const insertFuel = db.prepare(`
      INSERT OR REPLACE INTO fuel_refills (
        id, vehicle_number, driver_id, date_time, liters, station, cost, source, transaction_id, fuel_receipt_no, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const f of fuelRefills) {
      insertFuel.run(
        String(f.id),
        String(f.vehicleNumber).trim().toUpperCase(),
        f.driverId ? String(f.driverId) : null,
        String(f.dateTime || new Date().toISOString()),
        Number(f.liters) || 0,
        String(f.station || ""),
        Number(f.cost) || 0,
        String(f.source || "manual"),
        String(f.transactionId || ""),
        String(f.fuelReceiptNo || ""),
        new Date().toISOString()
      );
    }

    // F. Migrate IMD Orders
    const orders = Array.isArray(data.orders) ? data.orders : [];
    const insertOrder = db.prepare(`
      INSERT OR REPLACE INTO imd_orders (
        id, order_no, customer, customer_org, province, destination, quantity,
        received_date, delivery_date, status, assignment_id, share_token, notes, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const o of orders) {
      insertOrder.run(
        String(o.id),
        String(o.orderNo),
        String(o.customer || ""),
        String(o.customerOrg || ""),
        String(o.province || ""),
        String(o.destination || ""),
        String(o.quantity || ""),
        String(o.receivedDate || ""),
        String(o.deliveryDate || ""),
        String(o.status || "Хүлээгдэж буй"),
        o.assignmentId ? String(o.assignmentId) : null,
        o.shareToken ? String(o.shareToken) : null,
        o.notes ? String(o.notes) : null,
        String(o.createdAt || new Date().toISOString()),
        String(o.updatedAt || new Date().toISOString())
      );
    }

    // G. Migrate IMD Assignments
    const assignments = Array.isArray(data.assignments) ? data.assignments : [];
    const insertAssignment = db.prepare(`
      INSERT OR REPLACE INTO imd_assignments (
        id, order_id, vehicle_plate, primary_driver_id, primary_driver_name,
        secondary_driver_id, secondary_driver_name, departure_date, status, token, payload_json, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const a of assignments) {
      insertAssignment.run(
        String(a.id),
        String(a.orderId || ""),
        String(a.vehiclePlate || ""),
        String(a.primaryDriverId || ""),
        String(a.primaryDriverName || ""),
        a.secondaryDriverId ? String(a.secondaryDriverId) : null,
        a.secondaryDriverName ? String(a.secondaryDriverName) : null,
        String(a.departureDate || ""),
        String(a.status || "Хуваарилсан"),
        a.token ? String(a.token) : null,
        JSON.stringify(a),
        String(a.createdAt || new Date().toISOString()),
        String(a.updatedAt || new Date().toISOString())
      );
    }

    // H. Migrate IMD Routes
    const routes = Array.isArray(data.routes) ? data.routes : [];
    const insertRoute = db.prepare(`
      INSERT OR REPLACE INTO imd_routes (
        id, province, route_name, distance_km, estimated_hours, payload_json
      ) VALUES (?, ?, ?, ?, ?, ?)
    `);

    for (const r of routes) {
      insertRoute.run(
        String(r.id),
        String(r.province || ""),
        String(r.routeName || r.name || ""),
        Number(r.distanceKm || r.distance) || 0,
        Number(r.estimatedHours || r.hours) || 0,
        JSON.stringify(r)
      );
    }

    // I. Migrate Official Letters
    const letters = Array.isArray(data.officialLetters) ? data.officialLetters : [];
    const insertLetter = db.prepare(`
      INSERT OR REPLACE INTO official_letters (
        id, letter_number, order_id, assignment_id, file_id, file_name, file_url, status, payload_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const l of letters) {
      insertLetter.run(
        String(l.id),
        String(l.letterNumber || l.dugaar || l.id),
        l.orderId ? String(l.orderId) : null,
        l.assignmentId ? String(l.assignmentId) : null,
        l.fileId ? String(l.fileId) : null,
        l.fileName ? String(l.fileName) : null,
        l.fileUrl ? String(l.fileUrl) : null,
        String(l.status || "DONE"),
        JSON.stringify(l),
        String(l.createdAt || new Date().toISOString())
      );
    }

    // J. Migrate App Configurations
    const insertConfig = db.prepare(`
      INSERT OR REPLACE INTO app_configs (key, value_json, updated_at) VALUES (?, ?, ?)
    `);

    if (data.gpsboxConfig) {
      insertConfig.run("gpsboxConfig", JSON.stringify(data.gpsboxConfig), new Date().toISOString());
    }
    if (data.workScheduleConfig) {
      insertConfig.run("workScheduleConfig", JSON.stringify(data.workScheduleConfig), new Date().toISOString());
    }
    if (data.customTelemetry) {
      insertConfig.run("customTelemetry", JSON.stringify(data.customTelemetry), new Date().toISOString());
    }
    if (data.finesCache) {
      insertConfig.run("finesCache", JSON.stringify(data.finesCache), new Date().toISOString());
    }
    if (data.officialLetterConfig) {
      insertConfig.run("officialLetterConfig", JSON.stringify(data.officialLetterConfig), new Date().toISOString());
    }

    // K. Record Migration Log
    const counts = {
      jsonDrivers: drivers.length,
      dbDrivers: (db.prepare("SELECT COUNT(*) as c FROM drivers").get() as any).c,
      jsonTrips: trips.length,
      dbTrips: (db.prepare("SELECT COUNT(*) as c FROM trips").get() as any).c,
      jsonGpsMileages: gpsMileages.length,
      dbGpsMileages: (db.prepare("SELECT COUNT(*) as c FROM daily_gps_mileages").get() as any).c,
      jsonFuelRefills: fuelRefills.length,
      dbFuelRefills: (db.prepare("SELECT COUNT(*) as c FROM fuel_refills").get() as any).c,
      jsonOrders: orders.length,
      dbOrders: (db.prepare("SELECT COUNT(*) as c FROM imd_orders").get() as any).c,
      jsonAssignments: assignments.length,
      dbAssignments: (db.prepare("SELECT COUNT(*) as c FROM imd_assignments").get() as any).c,
      jsonRoutes: routes.length,
      dbRoutes: (db.prepare("SELECT COUNT(*) as c FROM imd_routes").get() as any).c,
      jsonLetters: letters.length,
      dbLetters: (db.prepare("SELECT COUNT(*) as c FROM official_letters").get() as any).c
    };

    const insertMigrationRun = db.prepare(`
      INSERT INTO migration_runs (id, version, name, applied_at, checksum, record_counts_json)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    insertMigrationRun.run(
      crypto.randomUUID(),
      "1.0.0",
      "json_to_sqlite_full_migration",
      new Date().toISOString(),
      backupChecksum,
      JSON.stringify(counts)
    );
  });

  const durationMs = Date.now() - startTime;
  const dbCounts = {
    jsonDrivers: (JSON.parse(jsonRaw).drivers || []).length,
    dbDrivers: (db.prepare("SELECT COUNT(*) as c FROM drivers").get() as any).c,
    jsonTrips: (JSON.parse(jsonRaw).trips || []).length,
    dbTrips: (db.prepare("SELECT COUNT(*) as c FROM trips").get() as any).c,
    jsonGpsMileages: (JSON.parse(jsonRaw).dailyGPSMileages || []).length,
    dbGpsMileages: (db.prepare("SELECT COUNT(*) as c FROM daily_gps_mileages").get() as any).c,
    jsonFuelRefills: (JSON.parse(jsonRaw).fuelRefills || []).length,
    dbFuelRefills: (db.prepare("SELECT COUNT(*) as c FROM fuel_refills").get() as any).c,
    jsonOrders: (JSON.parse(jsonRaw).orders || []).length,
    dbOrders: (db.prepare("SELECT COUNT(*) as c FROM imd_orders").get() as any).c,
    jsonAssignments: (JSON.parse(jsonRaw).assignments || []).length,
    dbAssignments: (db.prepare("SELECT COUNT(*) as c FROM imd_assignments").get() as any).c,
    jsonRoutes: (JSON.parse(jsonRaw).routes || []).length,
    dbRoutes: (db.prepare("SELECT COUNT(*) as c FROM imd_routes").get() as any).c,
    jsonLetters: (JSON.parse(jsonRaw).officialLetters || []).length,
    dbLetters: (db.prepare("SELECT COUNT(*) as c FROM official_letters").get() as any).c
  };

  logger.info("Migration completed successfully", { counts: dbCounts, durationMs });

  return {
    success: true,
    backupFile,
    backupChecksum,
    counts: dbCounts,
    durationMs,
    duplicateCount,
    errors
  };
}

// CLI runner
const isDirectRun = typeof process !== "undefined" && process.argv[1] && (process.argv[1].endsWith("migrate.ts") || process.argv[1].endsWith("migrate.js"));
if (isDirectRun) {
  try {
    const result = runMigration();
    console.log("=========================================");
    console.log("  FLEET DIGITAL — DATABASE MIGRATION     ");
    console.log("=========================================");
    console.log(`Status: SUCCESS`);
    console.log(`Duration: ${result.durationMs}ms`);
    console.log(`Backup File: ${result.backupFile}`);
    console.log(`Backup Checksum: ${result.backupChecksum.slice(0, 16)}...`);
    console.log("-----------------------------------------");
    console.log("Entity Counts (JSON -> SQLite):");
    console.log(`  Drivers:            ${result.counts.jsonDrivers} -> ${result.counts.dbDrivers}`);
    console.log(`  Trips:              ${result.counts.jsonTrips} -> ${result.counts.dbTrips}`);
    console.log(`  Daily GPS Mileages: ${result.counts.jsonGpsMileages} -> ${result.counts.dbGpsMileages}`);
    console.log(`  IMD Orders:         ${result.counts.jsonOrders} -> ${result.counts.dbOrders}`);
    console.log(`  IMD Assignments:    ${result.counts.jsonAssignments} -> ${result.counts.dbAssignments}`);
    console.log(`  IMD Routes:         ${result.counts.jsonRoutes} -> ${result.counts.dbRoutes}`);
    console.log(`  Official Letters:   ${result.counts.jsonLetters} -> ${result.counts.dbLetters}`);
    console.log("=========================================");
    process.exit(0);
  } catch (err: any) {
    console.error("Migration failed:", err);
    process.exit(1);
  }
}
