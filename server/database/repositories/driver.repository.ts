import { getDatabase, runInTransaction } from "../client";
import { Driver } from "../../../src/types";

export class DriverRepository {
  private static mapRowToDriver(row: any): Driver {
    return {
      id: row.id,
      code: row.code,
      name: row.name,
      phone: row.phone || "",
      vehicle: row.vehicle,
      model: row.model || "",
      salesRep: row.sales_rep || "",
      defaultRoute: row.default_route || "",
      status: row.status as "active" | "inactive",
      isCustom: row.is_custom === 1,
      isIMD: row.is_imd === 1,
      boxCapacity: row.box_capacity ? Number(row.box_capacity) : undefined,
      jobTitle: row.job_title || "",
      organization: row.organization || "",
      totalAssignedKm: row.total_assigned_km ? Number(row.total_assigned_km) : 0,
      autoOdoConfig: row.auto_odo_config ? JSON.parse(row.auto_odo_config) : undefined,
      autoWaybillEnabled: row.auto_waybill_enabled === 1,
      telemetry: row.telemetry_json ? JSON.parse(row.telemetry_json) : undefined
    };
  }

  static findAll(): Driver[] {
    const db = getDatabase();
    const rows = db.prepare("SELECT * FROM drivers ORDER BY name ASC").all();
    return rows.map(this.mapRowToDriver);
  }

  static findById(id: string): Driver | null {
    const db = getDatabase();
    const row = db.prepare("SELECT * FROM drivers WHERE id = ? OR code = ?").get(id, id);
    return row ? this.mapRowToDriver(row) : null;
  }

  static findByVehicle(vehiclePlate: string): Driver | null {
    const db = getDatabase();
    const cleanPlate = vehiclePlate.trim().toUpperCase().replace(/\s+/g, "");
    const row = db.prepare(`
      SELECT * FROM drivers 
      WHERE UPPER(REPLACE(vehicle, ' ', '')) = ?
    `).get(cleanPlate);
    return row ? this.mapRowToDriver(row) : null;
  }

  static save(driver: Driver): void {
    const db = getDatabase();
    db.prepare(`
      INSERT OR REPLACE INTO drivers (
        id, code, name, phone, vehicle, model, sales_rep, default_route,
        status, is_custom, is_imd, box_capacity, job_title, organization,
        total_assigned_km, auto_odo_config, auto_waybill_enabled, telemetry_json, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      driver.id,
      driver.code || driver.id,
      driver.name,
      driver.phone || "",
      driver.vehicle,
      driver.model || "",
      driver.salesRep || "",
      driver.defaultRoute || "",
      driver.status || "active",
      driver.isCustom ? 1 : 0,
      driver.isIMD ? 1 : 0,
      driver.boxCapacity || null,
      driver.jobTitle || "",
      driver.organization || "",
      driver.totalAssignedKm || 0,
      driver.autoOdoConfig ? JSON.stringify(driver.autoOdoConfig) : null,
      driver.autoWaybillEnabled !== false ? 1 : 0,
      driver.telemetry ? JSON.stringify(driver.telemetry) : null,
      new Date().toISOString()
    );
  }

  static delete(id: string): boolean {
    const db = getDatabase();
    const res = db.prepare("DELETE FROM drivers WHERE id = ?").run(id);
    return res.changes > 0;
  }
}
