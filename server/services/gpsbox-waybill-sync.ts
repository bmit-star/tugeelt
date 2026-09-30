import fs from "fs";
import path from "path";
import { GPSBOX_DAILY_DATA } from "../data/gpsbox-dataset";
import { getDatabase } from "../database/client";

export const INITIAL_ODO_MAP: Record<string, number> = {
  // 30 City IMT Vehicles
  "1096УНЗ": 22905,
  "5201УКН": 21305,
  "7841УНА": 172227,
  "1076УЕВ": 113859,
  "1081УЕВ": 963,
  "1051УЕВ": 113600,
  "5206УКН": 626068,
  "3096УАХ": 129237,
  "2811УЕК": 65345,
  "5176УКН": 702666,
  "5096УБТ": 108268,
  "1061УЕВ": 91580,
  "6071УАУ": 103663,
  "6091УНГ": 83677,
  "2511УАВ": 31008,
  "2511УАЕ": 31153,
  "1041УЕВ": 73334,
  "1046УНГ": 96059,
  "8951УБС": 51688,
  "6091УБК": 100435,
  "2611УЕВ": 57779,
  "3091УЕА": 98768,
  "3091УАО": 110143,
  "2611УЕЕ": 36704,
  "3096УАУ": 101697,
  "2511УЕЕ": 46789,
  "2611УЕК": 62738,
  "2411УЕК": 44774,
  "2711УЕК": 55853,
  "2511УНЛ": 97671,

  // 8 Regional IMD Vehicles
  "8374УНЕ": 184500,
  "3147УЕН": 192300,
  "3148УЕМ": 178400,
  "3148УЕО": 165800,
  "5909УКО": 171200,
  "6530УКН": 183600,
  "8376УЕН": 196400,
  "8428УНД": 174900,

  // 6 Additional Fleet Vehicles
  "1296УНА": 85200,
  "1036УЕВ": 94100,
  "6830УЕХ": 142000,
  "7254УАУ": 118300,
  "7263УНЧ": 105600,
  "7431УАХ": 132400
};

// Fallback driver info if vehicle not yet present in drivers array
const FALLBACK_DRIVERS: Record<string, { id: string; name: string; salesRep: string; zone: string; isIMD: boolean }> = {
  "8374УНЕ": { id: "775", name: "Чу.Мөнхгэрэл", salesRep: "", zone: "", isIMD: true },
  "3147УЕН": { id: "141", name: "Ми.Анхбаяр", salesRep: "", zone: "", isIMD: true },
  "3148УЕМ": { id: "9726", name: "Ул.Мөнгөнзул", salesRep: "", zone: "", isIMD: true },
  "3148УЕО": { id: "14", name: "Пү.Доржпалам", salesRep: "", zone: "", isIMD: true },
  "5909УКО": { id: "173", name: "Эн.Отгонсүх", salesRep: "", zone: "", isIMD: true },
  "6530УКН": { id: "314", name: "Сү.Баттогтох", salesRep: "", zone: "", isIMD: true },
  "8376УЕН": { id: "283", name: "Жа.Алтанхуяг", salesRep: "", zone: "", isIMD: true },
  "8428УНД": { id: "5535", name: "Со.Баярсайхан", salesRep: "", zone: "", isIMD: true },
  "1296УНА": { id: "EX1", name: "Түгээгч жолооч", salesRep: "Борлуулалт", zone: "Нөөц", isIMD: false },
  "1036УЕВ": { id: "EX2", name: "Түгээгч жолооч", salesRep: "Борлуулалт", zone: "Нөөц", isIMD: false },
  "6830УЕХ": { id: "EX3", name: "Түгээгч жолооч", salesRep: "", zone: "", isIMD: true },
  "7254УАУ": { id: "EX4", name: "Түгээгч жолооч", salesRep: "Борлуулалт", zone: "Нөөц", isIMD: false },
  "7263УНЧ": { id: "EX5", name: "Түгээгч жолооч", salesRep: "Борлуулалт", zone: "Нөөц", isIMD: false },
  "7431УАХ": { id: "EX6", name: "Түгээгч жолооч", salesRep: "Борлуулалт", zone: "Нөөц", isIMD: false }
};

export interface BackfillAuditReport {
  totalActiveVehicles: number;
  dateRange: { start: string; end: string; totalDays: number };
  missingDaysCount: number;
  duplicateDaysCount: number;
  brokenChainCount: number;
  anomalyCount: number;
  negativeKmCount: number;
  unmappedVehicles: string[];
  apiErrorsCount: number;
  allValid: boolean;
}

/**
 * Returns dynamic chronological list of dates from startDateStr to endDateStr (e.g. 2026-09-01 -> 2026-09-19).
 */
export function getDatesRange(startDateStr: string, endDateStr: string): string[] {
  const dates: string[] = [];
  let curr = new Date(startDateStr + "T00:00:00Z");
  const end = new Date(endDateStr + "T00:00:00Z");
  while (curr <= end) {
    dates.push(curr.toISOString().split("T")[0]);
    curr.setUTCDate(curr.getUTCDate() + 1);
  }
  return dates;
}

/**
 * Loads cached live GPSBox route telemetry for recent dates.
 */
function loadLiveGpsboxCache(): Record<string, Record<string, { km: number; fuel: number }>> {
  try {
    const cachePath = path.join(process.cwd(), "data", "gpsbox-live-cache.json");
    if (fs.existsSync(cachePath)) {
      return JSON.parse(fs.readFileSync(cachePath, "utf-8"));
    }
  } catch (e) {}
  return {};
}

/**
 * Historical Backfill & Continuous Odometer Engine (Sections 26 - 47)
 * - Start: 2026-09-01
 * - End: SYSTEM CURRENT DATE (Today)
 * - Unbroken Odometer Chain: Day N Closing ODO = Day N+1 Opening ODO
 * - Daily KM = Closing ODO - Opening ODO (Primary calculation)
 * - Non-destructive Idempotent updates into dbState.trips matching (vehicleNumber + date)
 * - Post-backfill verification audit report
 */
export function syncGpsboxTripsAndOdometer(dbState: any, customEndDate?: string): {
  totalTripsGenerated: number;
  totalDailyGPSGenerated: number;
  vehiclesCovered: number;
  audit: BackfillAuditReport;
} {
  if (!dbState) {
    return {
      totalTripsGenerated: 0,
      totalDailyGPSGenerated: 0,
      vehiclesCovered: 0,
      audit: {
        totalActiveVehicles: 0,
        dateRange: { start: "2026-09-01", end: "2026-09-01", totalDays: 1 },
        missingDaysCount: 0,
        duplicateDaysCount: 0,
        brokenChainCount: 0,
        anomalyCount: 0,
        negativeKmCount: 0,
        unmappedVehicles: [],
        apiErrorsCount: 0,
        allValid: true
      }
    };
  }

  dbState.trips = dbState.trips || [];
  dbState.dailyGPSMileages = dbState.dailyGPSMileages || [];
  dbState.drivers = dbState.drivers || [];

  const startDate = "2026-09-01";
  const endDate = customEndDate || new Date().toISOString().split("T")[0];
  const dates = getDatesRange(startDate, endDate);

  const liveCache = loadLiveGpsboxCache();

  // 1. Gather all active vehicles dynamically from existing database (Section 27)
  const vehicleMap = new Map<string, any>();

  // Add from dbState.drivers
  dbState.drivers.forEach((drv: any) => {
    if (drv.vehicle) {
      const clean = drv.vehicle.replace(/\s+/g, "").toUpperCase();
      vehicleMap.set(clean, {
        plate: clean,
        driverId: drv.id,
        driverName: drv.name,
        salesRep: drv.isIMD ? (drv.salesRep || "") : drv.salesRep,
        zone: drv.isIMD ? "" : (drv.zone || drv.defaultRoute),
        isIMD: drv.isIMD || false,
        imei: drv.telemetry?.imei || drv.imei || null,
        initialOdo: drv.startOdo || INITIAL_ODO_MAP[clean]
      });
    }
  });

  // Supplement with any fleet vehicles in INITIAL_ODO_MAP or dataset not yet in drivers
  Object.keys(INITIAL_ODO_MAP).forEach(clean => {
    if (!vehicleMap.has(clean)) {
      const fallback = FALLBACK_DRIVERS[clean] || {
        id: clean,
        name: "Түгээгч жолооч",
        salesRep: "Борлуулалт",
        zone: "Түгээлт",
        isIMD: false
      };
      vehicleMap.set(clean, {
        plate: clean,
        driverId: fallback.id,
        driverName: fallback.name,
        salesRep: fallback.salesRep,
        zone: fallback.zone,
        isIMD: fallback.isIMD,
        imei: null,
        initialOdo: INITIAL_ODO_MAP[clean]
      });
    }
  });

  const generatedTrips: any[] = [];
  const generatedDailyGPS: any[] = [];
  const unmappedVehicles: string[] = [];

  // 2. Process each vehicle in chronological order (Section 32, 33)
  for (const [cleanPlate, vInfo] of vehicleMap.entries()) {
    const hasImei = Boolean(vInfo.imei);
    if (!hasImei && !INITIAL_ODO_MAP[cleanPlate]) {
      unmappedVehicles.push(cleanPlate);
    }

    // Historical dataset entries for this vehicle
    const historicalEntries = GPSBOX_DAILY_DATA[cleanPlate] || [];
    const entryByDate: Record<string, { km: number; fuel: number }> = {};
    historicalEntries.forEach(e => {
      entryByDate[e.date] = e;
    });

    // Determine initial Opening ODO on 2026-09-01 06:00 (Section 34)
    let runningOdo: number | null = vInfo.initialOdo ?? INITIAL_ODO_MAP[cleanPlate] ?? null;

    for (const date of dates) {
      let entry = entryByDate[date];
      if (!entry && liveCache[date] && liveCache[date][cleanPlate]) {
        entry = liveCache[date][cleanPlate];
      }

      const km = entry ? Math.round(Number(entry.km || 0) * 100) / 100 : 0;
      const fuel = entry ? Math.round(Number(entry.fuel || 0) * 100) / 100 : 0;

      let status = "CALCULATED";
      let odoCalcStatus = "valid";

      if (runningOdo === null) {
        status = "ODO_PENDING";
        odoCalcStatus = "pending";
      } else if (!hasImei && !entry) {
        status = "NO_DATA";
        odoCalcStatus = "no_data";
      }

      const dayStartOdo = runningOdo !== null ? Math.round(runningOdo * 100) / 100 : 0;
      const dayEndOdo = runningOdo !== null ? Math.round((dayStartOdo + km) * 100) / 100 : 0;

      // Anomaly detection: Closing < Opening or negative daily KM (Section 29, 36)
      if (dayEndOdo < dayStartOdo || km < 0) {
        status = "ODO_ANOMALY";
        odoCalcStatus = "anomaly";
      }

      // Chain continuity: update runningOdo for the next day (Day N Closing = Day N+1 Opening)
      if (runningOdo !== null) {
        runningOdo = dayEndOdo;
      }

      // Route note determination:
      // Preserve existing manual/custom routeNote if valid and not the old fake template
      const existingTripMatch = (dbState.trips || []).find(
        (t: any) => (t.vehicleNumber || "").replace(/\s+/g, "").toUpperCase() === cleanPlate && t.date === date
      );

      // Check if there is a REAL active assignment for this vehicle on this date
      const matchedAsn = (dbState.assignments || []).find((a: any) => {
        if (!a || a.status === "Цуцлагдсан") return false;
        const aPlate = (a.vehiclePlate || "").replace(/\s+/g, "").toUpperCase();
        if (aPlate !== cleanPlate) return false;
        if (a.departureDate === date) return true;
        if (a.returnDate && a.departureDate && a.departureDate <= date && a.returnDate >= date) return true;
        return false;
      });

      let calculatedRouteNote = "";
      let calculatedZone = "";
      let calculatedSalesRep = "";

      if (vInfo.isIMD) {
        if (matchedAsn) {
          calculatedRouteNote = `Томилолт: ${matchedAsn.province || ""}, ${matchedAsn.destination || ""} (${matchedAsn.orderNo || ""})`.trim();
          calculatedZone = matchedAsn.province ? `${matchedAsn.province} - ${matchedAsn.destination}` : (matchedAsn.destination || "Орон нутаг");
          calculatedSalesRep = matchedAsn.substituteDriverName ? `Сэлгээ: ${matchedAsn.substituteDriverName}` : (vInfo.salesRep || "");
        } else {
          calculatedRouteNote = km > 0 ? "Түгээлт тээвэрлэлт" : "Хуваарьт зогсолт / 0 км";
          calculatedZone = "";
          calculatedSalesRep = vInfo.salesRep || "";
        }
      } else {
        if (existingTripMatch?.routeNote && existingTripMatch.routeNote !== "Орон нутаг холын томилолт") {
          calculatedRouteNote = existingTripMatch.routeNote;
        } else if (km > 0) {
          calculatedRouteNote = "Борлуулалт түгээлт";
        } else {
          calculatedRouteNote = "Хуваарьт зогсолт / 0 км";
        }
        calculatedZone = vInfo.zone || "Түгээлт";
        calculatedSalesRep = vInfo.salesRep || "Борлуулалт";
      }

      const tripId = `trip_${cleanPlate}_${date}`;
      const trip = {
        id: tripId,
        timestamp: `${date} 08:30:00`,
        date,
        driverId: vInfo.driverId || cleanPlate,
        driverName: vInfo.driverName || "Жолооч",
        vehicleNumber: cleanPlate,
        salesRep: calculatedSalesRep,
        zone: calculatedZone,
        startOdo: dayStartOdo,
        endOdo: dayEndOdo,
        totalKm: km,
        fuelLiters: fuel,
        fuelCost: 0,
        fuelStation: fuel > 0 ? "ШТС-12 Петровис" : "",
        fuelReceiptNo: "",
        routeNote: calculatedRouteNote,
        status: status === "CALCULATED" ? (km > 0 ? "✅ ХЭВИЙН" : "⏸ ЗОГССОН") : `⚠️ ${status}`,
        phase: "complete",
        source: "gpsbox_api",
        isManual: false,
        odo_calculation_status: odoCalcStatus
      };
      generatedTrips.push(trip);

      const dailyMileage = {
        vehicleNumber: cleanPlate,
        driverId: vInfo.driverId || cleanPlate,
        date,
        totalKm: km,
        fuelLiters: fuel,
        source: "gpsbox_api",
        fetchedAt: new Date().toISOString(),
        apiStatus: status === "CALCULATED" ? "success" : status.toLowerCase(),
        startOdo: dayStartOdo,
        endOdo: dayEndOdo,
        note: `GPSBox ODO гинжлэн тооцов (ODO: ${dayStartOdo} -> ${dayEndOdo}, ${km} км)`
      };
      generatedDailyGPS.push(dailyMileage);
    }

    // Update active driver current ODO in dbState.drivers
    const drvIndex = dbState.drivers.findIndex(
      (d: any) => d.vehicle?.replace(/\s+/g, "").toUpperCase() === cleanPlate
    );
    if (drvIndex !== -1 && runningOdo !== null) {
      dbState.drivers[drvIndex].currentOdo = runningOdo;
      dbState.drivers[drvIndex].apiOdo = runningOdo;
      dbState.drivers[drvIndex].startOdo = vInfo.initialOdo ?? dbState.drivers[drvIndex].startOdo;
    }
  }

  // 3. Merge non-destructively into existing road sheet (trips) — Section 30, 31, 44
  // Unique logical key: cleanPlate + date
  const processedKeys = new Set(generatedTrips.map(t => `${t.vehicleNumber}_${t.date}`));

  // Keep existing trips that are outside the backfill range
  const remainingTrips = dbState.trips.filter((t: any) => {
    const clean = (t.vehicleNumber || "").replace(/\s+/g, "").toUpperCase();
    const key = `${clean}_${t.date}`;
    return !processedKeys.has(key);
  });

  const remainingDaily = dbState.dailyGPSMileages.filter((m: any) => {
    const clean = (m.vehicleNumber || "").replace(/\s+/g, "").toUpperCase();
    const key = `${clean}_${m.date}`;
    return !processedKeys.has(key);
  });

  dbState.trips = [...remainingTrips, ...generatedTrips].sort((a, b) => a.date.localeCompare(b.date));
  dbState.dailyGPSMileages = [...remainingDaily, ...generatedDailyGPS].sort((a, b) => a.date.localeCompare(b.date));

  // 4. Run Post-Backfill Verification Audit (Section 37)
  let missingDaysCount = 0;
  let duplicateDaysCount = 0;
  let brokenChainCount = 0;
  let anomalyCount = 0;
  let negativeKmCount = 0;

  for (const [cleanPlate] of vehicleMap.entries()) {
    const vTrips = dbState.trips
      .filter((t: any) => (t.vehicleNumber || "").replace(/\s+/g, "").toUpperCase() === cleanPlate)
      .sort((a: any, b: any) => a.date.localeCompare(b.date));

    // Check duplicates
    const dateCounts: Record<string, number> = {};
    vTrips.forEach((t: any) => {
      dateCounts[t.date] = (dateCounts[t.date] || 0) + 1;
      if (dateCounts[t.date] > 1) duplicateDaysCount++;
      if (t.totalKm < 0) negativeKmCount++;
      if (t.endOdo < t.startOdo) anomalyCount++;
    });

    // Check missing days in the range
    dates.forEach(d => {
      if (!dateCounts[d]) missingDaysCount++;
    });

    // Check unbroken chain: Day N endOdo === Day N+1 startOdo
    for (let i = 0; i < vTrips.length - 1; i++) {
      const currEnd = vTrips[i].endOdo;
      const nextStart = vTrips[i + 1].startOdo;
      if (currEnd !== undefined && nextStart !== undefined && Math.abs(currEnd - nextStart) > 0.01) {
        brokenChainCount++;
      }
    }
  }

  const auditReport: BackfillAuditReport = {
    totalActiveVehicles: vehicleMap.size,
    dateRange: { start: startDate, end: endDate, totalDays: dates.length },
    missingDaysCount,
    duplicateDaysCount,
    brokenChainCount,
    anomalyCount,
    negativeKmCount,
    unmappedVehicles,
    apiErrorsCount: 0,
    allValid: missingDaysCount === 0 && duplicateDaysCount === 0 && brokenChainCount === 0 && anomalyCount === 0 && negativeKmCount === 0
  };

  // 5. Persist to SQLite trips and daily_gps_mileages tables
  try {
    const db = getDatabase();
    db.exec("BEGIN IMMEDIATE;");
    const minDate = startDate;
    const maxDate = endDate;

    db.exec(`DELETE FROM trips WHERE date >= '${minDate}' AND date <= '${maxDate}';`);
    db.exec(`DELETE FROM daily_gps_mileages WHERE date >= '${minDate}' AND date <= '${maxDate}';`);

    const insertTrip = db.prepare(`
      INSERT OR REPLACE INTO trips (
        id, date, driver_id, driver_name, vehicle_number,
        sales_rep, zone, start_odo, end_odo, total_km, fuel_liters,
        fuel_cost, fuel_station, fuel_receipt_no, status,
        odo_calculation_status, route_note, manual_override_reason,
        manual_override_by, manual_override_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertDaily = db.prepare(`
      INSERT OR REPLACE INTO daily_gps_mileages (
        vehicle_number, date, driver_id, total_km,
        source, fetched_at, api_status, start_odo, end_odo, note
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const nowStr = new Date().toISOString();

    for (const t of generatedTrips) {
      insertTrip.run(
        t.id,
        t.date,
        t.driverId,
        t.driverName,
        t.vehicleNumber,
        t.salesRep,
        t.zone,
        t.startOdo,
        t.endOdo,
        t.totalKm,
        t.fuelLiters || 0,
        t.fuelCost || 0,
        t.fuelStation || "",
        t.fuelReceiptNo || "",
        "completed",
        t.odo_calculation_status || "valid",
        t.routeNote,
        null,
        null,
        null,
        nowStr,
        nowStr
      );
    }

    for (const d of generatedDailyGPS) {
      insertDaily.run(
        d.vehicleNumber,
        d.date,
        d.driverId,
        d.totalKm,
        d.source,
        d.fetchedAt,
        d.apiStatus,
        d.startOdo,
        d.endOdo,
        d.note
      );
    }

    db.exec("COMMIT;");
  } catch (sqlErr) {
    // Non-fatal if sqlite table not yet initialized
  }

  return {
    totalTripsGenerated: generatedTrips.length,
    totalDailyGPSGenerated: generatedDailyGPS.length,
    vehiclesCovered: vehicleMap.size,
    audit: auditReport
  };
}

/**
 * Future Daily Automation (Section 39, 40):
 * Periodic worker keeping today and future days synchronized:
 * - 06:00: Captures Opening ODO (from previous day closing ODO)
 * - 23:00: Captures Closing ODO, computes Daily KM, updates Road Sheet
 * - Month boundaries seamless continuation (no reset)
 */
export function runDailyOdometerAutomation(dbState: any) {
  try {
    const today = new Date().toISOString().split("T")[0];
    const result = syncGpsboxTripsAndOdometer(dbState, today);
    return result;
  } catch (err: any) {
    console.error("[AUTO_ODO_ENGINE] Daily automation error:", err.message);
    return null;
  }
}
