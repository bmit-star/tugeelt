import fs from "fs";
import path from "path";
import { GPSBOX_DAILY_DATA } from "../data/gpsbox-dataset";
import { getDatabase, runInTransaction } from "../database/client";
import { toIntKm, toLiters } from "../utils/numbers";
import { ubToday, ubMonth } from "../utils/time";

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
  "8428УНД": 174900
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
 * Returns dynamic chronological list of dates from startDateStr to endDateStr
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
 * Continuous Odometer Synchronization Engine
 * - Start: 1st of current month (or customStartDate if provided)
 * - Window: Only active drivers registered in the system (status !== 'deleted')
 * - NEVER overwrites manually edited / manager confirmed waybills
 * - Odometer chain: Day N End ODO = Day N+1 Start ODO
 * - Whole integer values for all ODO and KM calculations
 */
export function syncGpsboxTripsAndOdometer(
  dbState: any,
  customEndDate?: string,
  customStartDate?: string
): {
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
        dateRange: { start: ubToday(), end: ubToday(), totalDays: 1 },
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

  // Default start date is 1st of current month (not hardcoded historical 2026-09-01)
  const defaultStart = `${ubMonth()}-01`;
  const startDate = customStartDate || defaultStart;
  const endDate = customEndDate || ubToday();
  const dates = getDatesRange(startDate, endDate);

  const liveCache = loadLiveGpsboxCache();

  // 1. Gather ONLY registered, active drivers (status !== 'deleted')
  // Strictly prevent synthetic EX1..EX6 or non-driver vehicle creation
  const vehicleMap = new Map<string, any>();

  dbState.drivers.forEach((drv: any) => {
    if (drv && drv.vehicle && drv.status !== "deleted") {
      const clean = drv.vehicle.replace(/\s+/g, "").toUpperCase();
      vehicleMap.set(clean, {
        plate: clean,
        driverId: drv.id,
        driverName: drv.name,
        salesRep: drv.isIMD ? (drv.salesRep || "") : drv.salesRep,
        zone: drv.isIMD ? "" : (drv.zone || drv.defaultRoute || "Түгээлт"),
        isIMD: drv.isIMD || false,
        imei: drv.telemetry?.imei || drv.imei || null,
        initialOdo: drv.startOdo !== undefined ? toIntKm(drv.startOdo) : (INITIAL_ODO_MAP[clean] ? toIntKm(INITIAL_ODO_MAP[clean]) : null)
      });
    }
  });

  const generatedTrips: any[] = [];
  const generatedDailyGPS: any[] = [];
  const unmappedVehicles: string[] = [];

  // Existing trips index by plate+date to detect and protect manual/confirmed records
  const existingTripMap = new Map<string, any>();
  dbState.trips.forEach((t: any) => {
    if (t && t.vehicleNumber && t.date) {
      const clean = String(t.vehicleNumber).replace(/\s+/g, "").toUpperCase();
      existingTripMap.set(`${clean}_${t.date}`, t);
    }
  });

  // 2. Process each registered vehicle
  for (const [cleanPlate, vInfo] of vehicleMap.entries()) {
    const hasImei = Boolean(vInfo.imei);
    if (!hasImei && !INITIAL_ODO_MAP[cleanPlate]) {
      unmappedVehicles.push(cleanPlate);
    }

    const historicalEntries = GPSBOX_DAILY_DATA[cleanPlate] || [];
    const entryByDate: Record<string, { km: number; fuel: number }> = {};
    historicalEntries.forEach(e => {
      entryByDate[e.date] = e;
    });

    // Opening ODO
    let runningOdo: number | null = vInfo.initialOdo ?? null;

    for (const date of dates) {
      const tripKey = `${cleanPlate}_${date}`;
      const existing = existingTripMap.get(tripKey);

      // Check if existing trip is manual or confirmed by manager
      const isManualOrConfirmed = Boolean(
        existing && (
          existing.isManual === true ||
          existing.source === "manual" ||
          existing.source === "manager" ||
          existing.status === "CONFIRMED" ||
          existing.status === "LOCKED"
        )
      );

      if (isManualOrConfirmed && existing) {
        // PRESERVE MANUAL / CONFIRMED TRIP INTACT
        const startOdo = toIntKm(existing.startOdo);
        const endOdo = existing.endOdo !== undefined && existing.endOdo !== null ? toIntKm(existing.endOdo) : startOdo;
        const totalKm = endOdo >= startOdo ? (endOdo - startOdo) : toIntKm(existing.totalKm || 0);

        generatedTrips.push({
          ...existing,
          startOdo,
          endOdo,
          totalKm
        });

        runningOdo = endOdo;
        continue;
      }

      let entry = entryByDate[date];
      if (!entry && liveCache[date] && liveCache[date][cleanPlate]) {
        entry = liveCache[date][cleanPlate];
      }

      const km = entry ? toIntKm(entry.km) : 0;
      const fuel = entry ? toLiters(entry.fuel) : 0;

      let status = "CALCULATED";
      let odoCalcStatus = "valid";

      if (runningOdo === null) {
        status = "ODO_PENDING";
        odoCalcStatus = "pending";
      } else if (!hasImei && !entry) {
        status = "NO_DATA";
        odoCalcStatus = "no_data";
      }

      const dayStartOdo = runningOdo !== null ? toIntKm(runningOdo) : 0;
      const dayEndOdo = runningOdo !== null ? toIntKm(dayStartOdo + km) : 0;

      if (dayEndOdo < dayStartOdo || km < 0) {
        status = "ODO_ANOMALY";
        odoCalcStatus = "anomaly";
      }

      if (runningOdo !== null) {
        runningOdo = dayEndOdo;
      }

      let calculatedRouteNote = "Борлуулалт";
      let calculatedZone = vInfo.zone || "УБ Төв";
      let calculatedSalesRep = vInfo.salesRep || "Борлуулалт";

      if (vInfo.isIMD) {
        const matchedAsn = (dbState.assignments || []).find((a: any) => {
          const matchVeh = a.vehiclePlate && a.vehiclePlate.replace(/\s+/g, "").toUpperCase() === cleanPlate;
          return matchVeh && a.departureDate === date && a.status !== "Цуцлагдсан";
        });
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
        if (existing?.routeNote && existing.routeNote !== "Орон нутаг холын томилолт") {
          calculatedRouteNote = existing.routeNote;
        } else if (km > 0) {
          calculatedRouteNote = "Борлуулалт түгээлт";
        } else {
          calculatedRouteNote = "Хуваарьт зогсолт / 0 км";
        }
        calculatedZone = vInfo.zone || "Түгээлт";
        calculatedSalesRep = vInfo.salesRep || "Борлуулалт";
      }

      const tripId = existing?.id || `trip_${cleanPlate}_${date}`;
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
        source: "gpsbox_api" as const,
        fetchedAt: new Date().toISOString(),
        apiStatus: (km > 0 ? "success" : "no_data") as "success" | "no_data",
        startOdo: dayStartOdo,
        endOdo: dayEndOdo,
        note: calculatedRouteNote
      };
      generatedDailyGPS.push(dailyMileage);
    }
  }

  // 3. Merge non-destructively: only replace non-manual trips in the synced range
  const generatedMap = new Map<string, any>();
  generatedTrips.forEach(t => {
    generatedMap.set(`${t.vehicleNumber}_${t.date}`, t);
  });

  // Only retain trips for registered active vehicles
  const validExistingTrips = (dbState.trips || []).filter((existing: any) => {
    const keyPlate = (existing?.vehicleNumber || "").replace(/\s+/g, "").toUpperCase();
    return vehicleMap.has(keyPlate);
  });

  const mergedTrips = validExistingTrips.map((existing: any) => {
    const key = `${(existing.vehicleNumber || "").replace(/\s+/g, "").toUpperCase()}_${existing.date}`;
    const generated = generatedMap.get(key);
    if (!generated) return existing;

    // Do NOT overwrite manual/confirmed trips
    if (
      existing.isManual === true ||
      existing.source === "manual" ||
      existing.source === "manager" ||
      existing.status === "CONFIRMED" ||
      existing.status === "LOCKED"
    ) {
      generatedMap.delete(key);
      return existing;
    }

    generatedMap.delete(key);
    return generated;
  });

  // Append new generated trips that didn't exist before
  for (const remaining of generatedMap.values()) {
    mergedTrips.push(remaining);
  }

  dbState.trips = mergedTrips.sort((a: any, b: any) => a.date.localeCompare(b.date));

  // Daily GPS mileages merge
  const genGpsMap = new Map<string, any>();
  generatedDailyGPS.forEach(m => {
    genGpsMap.set(`${m.vehicleNumber}_${m.date}`, m);
  });

  // Only retain GPS mileages for registered active vehicles
  const validExistingGps = (dbState.dailyGPSMileages || []).filter((existing: any) => {
    const keyPlate = (existing?.vehicleNumber || "").replace(/\s+/g, "").toUpperCase();
    return vehicleMap.has(keyPlate);
  });

  const mergedGps = validExistingGps.map((existing: any) => {
    const key = `${(existing.vehicleNumber || "").replace(/\s+/g, "").toUpperCase()}_${existing.date}`;
    const gen = genGpsMap.get(key);
    if (!gen) return existing;
    genGpsMap.delete(key);
    return gen;
  });
  for (const rem of genGpsMap.values()) {
    mergedGps.push(rem);
  }
  dbState.dailyGPSMileages = mergedGps.sort((a: any, b: any) => a.date.localeCompare(b.date));

  // Audit
  let missingDaysCount = 0;
  let duplicateDaysCount = 0;
  let brokenChainCount = 0;
  let anomalyCount = 0;
  let negativeKmCount = 0;

  for (const [cleanPlate] of vehicleMap.entries()) {
    const vTrips = dbState.trips
      .filter((t: any) => (t.vehicleNumber || "").replace(/\s+/g, "").toUpperCase() === cleanPlate)
      .sort((a: any, b: any) => a.date.localeCompare(b.date));

    const dateCounts: Record<string, number> = {};
    vTrips.forEach((t: any) => {
      dateCounts[t.date] = (dateCounts[t.date] || 0) + 1;
      if (dateCounts[t.date] > 1) duplicateDaysCount++;
      if (t.totalKm < 0) negativeKmCount++;
      if (t.endOdo < t.startOdo) anomalyCount++;
    });

    dates.forEach(d => {
      if (!dateCounts[d]) missingDaysCount++;
    });

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
    allValid: brokenChainCount === 0 && anomalyCount === 0 && negativeKmCount === 0
  };

  // Sync into SQLite safely using upsert (NO blanket DELETE)
  try {
    const db = getDatabase();
    try {
      db.exec("ALTER TABLE trips ADD COLUMN is_manual INTEGER DEFAULT 0;");
    } catch (e) {}

    runInTransaction(() => {
      const upsertTrip = db.prepare(`
        INSERT INTO trips (
          id, date, driver_id, driver_name, vehicle_number,
          sales_rep, zone, start_odo, end_odo, total_km, fuel_liters,
          fuel_cost, fuel_station, fuel_receipt_no, status,
          odo_calculation_status, route_note, is_manual, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          start_odo = excluded.start_odo,
          end_odo = excluded.end_odo,
          total_km = excluded.total_km,
          fuel_liters = excluded.fuel_liters,
          fuel_station = excluded.fuel_station,
          status = excluded.status,
          odo_calculation_status = excluded.odo_calculation_status,
          route_note = excluded.route_note,
          updated_at = excluded.updated_at
        WHERE trips.is_manual = 0
      `);

      const nowStr = new Date().toISOString();

      for (const t of generatedTrips) {
        if (!t.isManual) {
          upsertTrip.run(
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
            t.status || "completed",
            t.odo_calculation_status || "valid",
            t.routeNote || "",
            nowStr,
            nowStr
          );
        }
      }
    });
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
 * Periodic Daily Odometer Worker
 */
export function runDailyOdometerAutomation(dbState: any) {
  try {
    const today = ubToday();
    const result = syncGpsboxTripsAndOdometer(dbState, today);
    return result;
  } catch (err: any) {
    console.error("[AUTO_ODO_ENGINE] Daily automation error:", err.message);
    return null;
  }
}
