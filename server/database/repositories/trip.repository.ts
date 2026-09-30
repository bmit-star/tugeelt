import { getDatabase, runInTransaction } from "../client";

export interface TripEntity {
  id: string;
  date: string;
  driverId: string;
  driverName: string;
  vehicleNumber: string;
  salesRep: string;
  zone: string;
  startOdo: number;
  endOdo?: number;
  totalKm?: number;
  fuelLiters?: number;
  fuelCost?: number;
  fuelStation?: string;
  fuelReceiptNo?: string;
  status: "pending" | "completed" | "approved";
  odoCalculationStatus: "pending" | "valid" | "invalid" | "manual_override" | "requires_review";
  routeNote?: string;
  manualOverrideReason?: string;
  manualOverrideBy?: string;
  manualOverrideAt?: string;
  createdAt: string;
  updatedAt: string;
}

export class TripRepository {
  private static mapRowToTrip(row: any): TripEntity {
    return {
      id: row.id,
      date: row.date,
      driverId: row.driver_id,
      driverName: row.driver_name,
      vehicleNumber: row.vehicle_number,
      salesRep: row.sales_rep || "",
      zone: row.zone || "",
      startOdo: Number(row.start_odo),
      endOdo: row.end_odo !== null && row.end_odo !== undefined ? Number(row.end_odo) : undefined,
      totalKm: row.total_km !== null && row.total_km !== undefined ? Number(row.total_km) : undefined,
      fuelLiters: row.fuel_liters !== null && row.fuel_liters !== undefined ? Number(row.fuel_liters) : undefined,
      fuelCost: row.fuel_cost !== null && row.fuel_cost !== undefined ? Number(row.fuel_cost) : undefined,
      fuelStation: row.fuel_station || "",
      fuelReceiptNo: row.fuel_receipt_no || "",
      status: row.status,
      odoCalculationStatus: row.odo_calculation_status || "valid",
      routeNote: row.route_note || "",
      manualOverrideReason: row.manual_override_reason || undefined,
      manualOverrideBy: row.manual_override_by || undefined,
      manualOverrideAt: row.manual_override_at || undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  static findAll(filters?: { date?: string; driverId?: string; vehicle?: string; status?: string }): TripEntity[] {
    const db = getDatabase();
    let query = "SELECT * FROM trips WHERE 1=1";
    const params: any[] = [];

    if (filters?.date) {
      query += " AND date = ?";
      params.push(filters.date);
    }
    if (filters?.driverId) {
      query += " AND driver_id = ?";
      params.push(filters.driverId);
    }
    if (filters?.vehicle) {
      query += " AND UPPER(REPLACE(vehicle_number, ' ', '')) = ?";
      params.push(filters.vehicle.trim().toUpperCase().replace(/\s+/g, ""));
    }
    if (filters?.status) {
      query += " AND status = ?";
      params.push(filters.status);
    }

    query += " ORDER BY date DESC, created_at DESC";
    const rows = db.prepare(query).all(...params);
    return rows.map(this.mapRowToTrip);
  }

  static findById(id: string): TripEntity | null {
    const db = getDatabase();
    const row = db.prepare("SELECT * FROM trips WHERE id = ?").get(id);
    return row ? this.mapRowToTrip(row) : null;
  }

  static findActiveTrip(driverId: string, date: string): TripEntity | null {
    const db = getDatabase();
    const row = db.prepare(`
      SELECT * FROM trips 
      WHERE driver_id = ? AND date = ? AND (end_odo IS NULL OR status = 'pending')
      ORDER BY created_at DESC LIMIT 1
    `).get(driverId, date);
    return row ? this.mapRowToTrip(row) : null;
  }

  static save(trip: TripEntity): void {
    const db = getDatabase();
    db.prepare(`
      INSERT OR REPLACE INTO trips (
        id, date, driver_id, driver_name, vehicle_number, sales_rep, zone,
        start_odo, end_odo, total_km, fuel_liters, fuel_cost, fuel_station,
        fuel_receipt_no, status, odo_calculation_status, route_note,
        manual_override_reason, manual_override_by, manual_override_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      trip.id,
      trip.date,
      trip.driverId,
      trip.driverName,
      trip.vehicleNumber,
      trip.salesRep || "",
      trip.zone || "",
      trip.startOdo,
      trip.endOdo !== undefined ? trip.endOdo : null,
      trip.totalKm !== undefined ? trip.totalKm : null,
      trip.fuelLiters !== undefined ? trip.fuelLiters : null,
      trip.fuelCost !== undefined ? trip.fuelCost : null,
      trip.fuelStation || "",
      trip.fuelReceiptNo || "",
      trip.status || "completed",
      trip.odoCalculationStatus || "valid",
      trip.routeNote || "",
      trip.manualOverrideReason || null,
      trip.manualOverrideBy || null,
      trip.manualOverrideAt || null,
      trip.createdAt || new Date().toISOString(),
      new Date().toISOString()
    );
  }

  static delete(id: string): boolean {
    const db = getDatabase();
    const res = db.prepare("DELETE FROM trips WHERE id = ?").run(id);
    return res.changes > 0;
  }
}
