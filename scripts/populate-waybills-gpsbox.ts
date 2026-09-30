import fs from "fs";
import path from "path";
import { DatabaseSync } from "node:sqlite";
import { GPSBOX_DAILY_DATA } from "../server/data/gpsbox-dataset";

interface TripRecord {
  id: string;
  timestamp: string;
  date: string;
  driverId: string;
  driverName: string;
  vehicleNumber: string;
  salesRep: string;
  zone: string;
  startOdo: number;
  endOdo: number;
  totalKm: number;
  fuelLiters?: number;
  fuelCost?: number;
  fuelStation?: string;
  fuelReceiptNo?: string;
  routeNote: string;
  status: string;
  phase: string;
  source: string;
  isManual: boolean;
  createdAt: string;
  updatedAt: string;
}

interface DailyGPSRecord {
  vehicleNumber: string;
  driverId: string;
  date: string;
  totalKm: number;
  source: string;
  fetchedAt: string;
  apiStatus: string;
  startOdo: number;
  endOdo: number;
  note: string;
}

export async function populateWaybills() {
  const dbPath = path.resolve("./data/fleet-db.json");
  const sqlitePath = path.resolve("./data/fleet.sqlite");

  const rawDb = JSON.parse(fs.readFileSync(dbPath, "utf-8"));
  rawDb.trips = rawDb.trips || [];
  rawDb.dailyGPSMileages = rawDb.dailyGPSMileages || [];
  rawDb.drivers = rawDb.drivers || [];

  // Map of vehicle to initial startOdo
  const initialOdoMap: Record<string, number> = {
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

  // Build driver lookup map by clean vehicle plate
  const driverByPlate: Record<string, any> = {};
  rawDb.drivers.forEach((d: any) => {
    if (d.vehicle) {
      const clean = d.vehicle.replace(/\s+/g, "").toUpperCase();
      driverByPlate[clean] = d;
    }
  });

  // Default driver metadata for non-assigned vehicles
  const defaultDrivers: Record<string, { id: string; name: string; salesRep: string; zone: string }> = {
    "1296УНА": { id: "EX1", name: "Түгээгч жолооч", salesRep: "Борлуулалт", zone: "Нөөц" },
    "1036УЕВ": { id: "EX2", name: "Түгээгч жолооч", salesRep: "Борлуулалт", zone: "Нөөц" },
    "6830УЕХ": { id: "EX3", name: "Түгээгч жолооч", salesRep: "Борлуулалт", zone: "Орон нутаг" },
    "7254УАУ": { id: "EX4", name: "Түгээгч жолооч", salesRep: "Борлуулалт", zone: "Нөөц" },
    "7263УНЧ": { id: "EX5", name: "Түгээгч жолооч", salesRep: "Борлуулалт", zone: "Нөөц" },
    "7431УАХ": { id: "EX6", name: "Түгээгч жолооч", salesRep: "Борлуулалт", zone: "Нөөц" }
  };

  const dates = [
    "2026-09-01", "2026-09-02", "2026-09-03", "2026-09-04", "2026-09-05",
    "2026-09-06", "2026-09-07", "2026-09-08", "2026-09-09", "2026-09-10",
    "2026-09-11", "2026-09-12", "2026-09-13", "2026-09-14", "2026-09-15",
    "2026-09-16", "2026-09-17"
  ];

  console.log(`Starting waybill population for ${Object.keys(GPSBOX_DAILY_DATA).length} vehicles across 17 days...`);

  // Track new trips and daily mileages
  const updatedTrips: TripRecord[] = [];
  const updatedDailyMileages: DailyGPSRecord[] = [];

  // Retain any trips outside 2026-09-01 to 2026-09-17 or for vehicles NOT in GPSBOX
  const existingOtherTrips = (rawDb.trips as TripRecord[]).filter(t => {
    const clean = t.vehicleNumber.replace(/\s+/g, "").toUpperCase();
    return !GPSBOX_DAILY_DATA[clean] || t.date < "2026-09-01" || t.date > "2026-09-17";
  });

  const existingOtherMileages = (rawDb.dailyGPSMileages as DailyGPSRecord[]).filter(m => {
    const clean = m.vehicleNumber.replace(/\s+/g, "").toUpperCase();
    return !GPSBOX_DAILY_DATA[clean] || m.date < "2026-09-01" || m.date > "2026-09-17";
  });

  for (const [plate, dailyEntries] of Object.entries(GPSBOX_DAILY_DATA)) {
    const cleanPlate = plate.replace(/\s+/g, "").toUpperCase();
    const matchedDriver = driverByPlate[cleanPlate] || defaultDrivers[cleanPlate] || {
      id: cleanPlate,
      name: "Жолооч",
      salesRep: "Борлуулалт",
      zone: "Түгээлт"
    };

    let runningOdo = initialOdoMap[cleanPlate] ?? 100000;

    // Create a map by date for easy lookup
    const entryByDate: Record<string, { km: number; fuel: number }> = {};
    dailyEntries.forEach(e => {
      entryByDate[e.date] = e;
    });

    for (const date of dates) {
      const entry = entryByDate[date] || { km: 0, fuel: 0 };
      const km = Math.round(entry.km * 100) / 100;
      const fuel = Math.round(entry.fuel * 100) / 100;

      const dayStartOdo = Math.round(runningOdo * 100) / 100;
      const dayEndOdo = Math.round((dayStartOdo + km) * 100) / 100;

      // Update running odometer for next day
      runningOdo = dayEndOdo;

      const tripId = `trip_${cleanPlate}_${date}_${Date.now()}`;
      const trip: TripRecord = {
        id: tripId,
        timestamp: `${date} 08:30:00`,
        date,
        driverId: matchedDriver.id || cleanPlate,
        driverName: matchedDriver.name || "Жолооч",
        vehicleNumber: plate,
        salesRep: matchedDriver.salesRep || "Борлуулалт",
        zone: matchedDriver.defaultRoute || matchedDriver.zone || matchedDriver.id || "Түгээлт",
        startOdo: dayStartOdo,
        endOdo: dayEndOdo,
        totalKm: km,
        fuelLiters: fuel,
        fuelCost: 0,
        fuelStation: "",
        fuelReceiptNo: "",
        routeNote: km > 0 ? (matchedDriver.isIMD ? "Орон нутаг холын томилолт" : "Борлуулалт түгээлт") : "Хуваарьт зогсолт / 0 км",
        status: km > 0 ? "completed" : "pending",
        phase: "complete",
        source: "gpsbox_api",
        isManual: false,
        createdAt: `${date}T08:30:00.000Z`,
        updatedAt: new Date().toISOString()
      };
      updatedTrips.push(trip);

      const dailyMileage: DailyGPSRecord = {
        vehicleNumber: plate,
        driverId: matchedDriver.id || cleanPlate,
        date,
        totalKm: km,
        source: "gpsbox_api",
        fetchedAt: new Date().toISOString(),
        apiStatus: "success",
        startOdo: dayStartOdo,
        endOdo: dayEndOdo,
        note: `GPSBox бодит заалтаас тооцов (ODO: ${dayStartOdo} -> ${dayEndOdo}, ${km} км)`
      };
      updatedDailyMileages.push(dailyMileage);
    }

    // Update driver currentOdo and odometer in rawDb.drivers
    const drvIndex = rawDb.drivers.findIndex((d: any) => d.vehicle?.replace(/\s+/g, "").toUpperCase() === cleanPlate);
    if (drvIndex !== -1) {
      rawDb.drivers[drvIndex].currentOdo = runningOdo;
      rawDb.drivers[drvIndex].startOdo = initialOdoMap[cleanPlate] ?? rawDb.drivers[drvIndex].startOdo;
    }
  }

  // Combine and sort trips by date and vehicle
  rawDb.trips = [...existingOtherTrips, ...updatedTrips].sort((a, b) => a.date.localeCompare(b.date));
  rawDb.dailyGPSMileages = [...existingOtherMileages, ...updatedDailyMileages].sort((a, b) => a.date.localeCompare(b.date));

  // Write to fleet-db.json
  fs.writeFileSync(dbPath, JSON.stringify(rawDb, null, 2), "utf-8");
  console.log(`Successfully updated fleet-db.json with ${rawDb.trips.length} trips and ${rawDb.dailyGPSMileages.length} daily GPS records.`);

  // Write to SQLite
  if (fs.existsSync(sqlitePath)) {
    try {
      const sqlite = new DatabaseSync(sqlitePath);
      
      sqlite.exec("BEGIN IMMEDIATE;");

      // Delete matching 2026-09-01..2026-09-17 records in sqlite
      sqlite.exec("DELETE FROM trips WHERE date >= '2026-09-01' AND date <= '2026-09-17';");
      sqlite.exec("DELETE FROM daily_gps_mileages WHERE date >= '2026-09-01' AND date <= '2026-09-17';");

      const insertTrip = sqlite.prepare(`
        INSERT OR REPLACE INTO trips (
          id, date, driver_id, driver_name, vehicle_number,
          sales_rep, zone, start_odo, end_odo, total_km, fuel_liters,
          fuel_cost, fuel_station, fuel_receipt_no, status,
          odo_calculation_status, route_note, manual_override_reason,
          manual_override_by, manual_override_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const insertDaily = sqlite.prepare(`
        INSERT OR REPLACE INTO daily_gps_mileages (
          vehicle_number, date, driver_id, total_km,
          source, fetched_at, api_status, start_odo, end_odo, note
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const t of updatedTrips) {
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
          t.status,
          "valid",
          t.routeNote,
          null,
          null,
          null,
          t.createdAt,
          t.updatedAt
        );
      }

      for (const d of updatedDailyMileages) {
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

      sqlite.exec("COMMIT;");
      sqlite.close();
      console.log(`Successfully synced SQLite with ${updatedTrips.length} trips and ${updatedDailyMileages.length} daily GPS records.`);
    } catch (sqlErr) {
      console.warn("SQLite sync warning:", sqlErr);
    }
  }

  console.log("Population completed successfully!");
}

populateWaybills().catch(console.error);
