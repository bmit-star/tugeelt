import { getDatabase } from "../client";

export interface DailyGPSMileageEntity {
  vehicleNumber: string;
  date: string;
  driverId?: string;
  totalKm: number;
  source: "gpsbox_api" | "manual";
  fetchedAt: string;
  apiStatus: "success" | "error" | "no_data";
  startOdo?: number;
  endOdo?: number;
  note?: string;
}

export class TelemetryRepository {
  static getDailyMileage(vehicleNumber: string, date: string): DailyGPSMileageEntity | null {
    const db = getDatabase();
    const cleanVeh = vehicleNumber.trim().toUpperCase().replace(/\s+/g, "");
    const row = db.prepare(`
      SELECT * FROM daily_gps_mileages
      WHERE UPPER(REPLACE(vehicle_number, ' ', '')) = ? AND date = ?
    `).get(cleanVeh, date);

    if (!row) return null;
    return {
      vehicleNumber: (row as any).vehicle_number,
      date: (row as any).date,
      driverId: (row as any).driver_id || undefined,
      totalKm: Number((row as any).total_km) || 0,
      source: (row as any).source,
      fetchedAt: (row as any).fetched_at,
      apiStatus: (row as any).api_status,
      startOdo: (row as any).start_odo !== null ? Number((row as any).start_odo) : undefined,
      endOdo: (row as any).end_odo !== null ? Number((row as any).end_odo) : undefined,
      note: (row as any).note || undefined
    };
  }

  static getMonthMileages(vehicleNumber: string, yearMonth: string): DailyGPSMileageEntity[] {
    const db = getDatabase();
    const cleanVeh = vehicleNumber.trim().toUpperCase().replace(/\s+/g, "");
    const rows = db.prepare(`
      SELECT * FROM daily_gps_mileages
      WHERE UPPER(REPLACE(vehicle_number, ' ', '')) = ? AND date LIKE ?
      ORDER BY date ASC
    `).all(cleanVeh, `${yearMonth}%`);

    return rows.map((row: any) => ({
      vehicleNumber: row.vehicle_number,
      date: row.date,
      driverId: row.driver_id || undefined,
      totalKm: Number(row.total_km) || 0,
      source: row.source,
      fetchedAt: row.fetched_at,
      apiStatus: row.api_status,
      startOdo: row.start_odo !== null ? Number(row.start_odo) : undefined,
      endOdo: row.end_odo !== null ? Number(row.end_odo) : undefined,
      note: row.note || undefined
    }));
  }

  static saveDailyMileage(mileage: DailyGPSMileageEntity): void {
    const db = getDatabase();
    const cleanVeh = mileage.vehicleNumber.trim().toUpperCase().replace(/\s+/g, "");
    db.prepare(`
      INSERT OR REPLACE INTO daily_gps_mileages (
        vehicle_number, date, driver_id, total_km, source, fetched_at, api_status, start_odo, end_odo, note
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      cleanVeh,
      mileage.date,
      mileage.driverId || null,
      mileage.totalKm,
      mileage.source || "gpsbox_api",
      mileage.fetchedAt || new Date().toISOString(),
      mileage.apiStatus || "success",
      mileage.startOdo !== undefined ? mileage.startOdo : null,
      mileage.endOdo !== undefined ? mileage.endOdo : null,
      mileage.note || null
    );
  }
}
