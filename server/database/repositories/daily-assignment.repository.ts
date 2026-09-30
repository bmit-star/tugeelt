import { getDatabase, runInTransaction } from "../client";
import { logger } from "../../utils/logger";

export interface DailyAssignmentEntity {
  id: string;
  businessDate: string;
  vehiclePlate: string;
  vehicleDivision: "IMT" | "IMD";
  routeId: string;
  routeName: string;
  originalDriverId: string;
  originalDriverName: string;
  originalDriverCode: string;
  actualDriverId: string;
  actualDriverName: string;
  actualDriverCode: string;
  driverPhone?: string;
  driverStatus?: string;
  driverReason?: string;
  salesRep?: string;
  salesRepPhone?: string;
  srCode?: string;
  originalVehiclePlate?: string;
  vehicleStatus?: string;
  vehicleReason?: string;
  actualVehiclePlate?: string;
  vehicleChanged?: boolean;
  routeStatus?: string;
  driverChanged: boolean;
  status: string;
  notes?: string;
  createdAt: string;
  createdBy?: string;
  updatedAt: string;
  updatedBy?: string;
}

export interface DriverFineEntity {
  id: string;
  assignmentId: string;
  businessDate: string;
  vehiclePlate: string;
  vehicleDivision: "IMT" | "IMD";
  routeId: string;
  routeName: string;
  originalDriverId: string;
  originalDriverName: string;
  originalDriverCode: string;
  actualDriverId: string;
  actualDriverName: string;
  actualDriverCode: string;
  fineReason: string;
  fineAmount: number;
  driverDeduction: number;
  organization: string;
  feeAmount: number;
  status: "active" | "deducted" | "cancelled";
  notes?: string;
  createdAt: string;
  createdBy?: string;
}

export class DailyAssignmentRepository {
  private static mapRowToAssignment(row: any): DailyAssignmentEntity {
    return {
      id: row.id,
      businessDate: row.business_date,
      vehiclePlate: row.vehicle_plate,
      vehicleDivision: row.vehicle_division,
      routeId: row.route_id || "",
      routeName: row.route_name || "",
      originalDriverId: row.original_driver_id,
      originalDriverName: row.original_driver_name,
      originalDriverCode: row.original_driver_code || "",
      actualDriverId: row.actual_driver_id,
      actualDriverName: row.actual_driver_name,
      actualDriverCode: row.actual_driver_code || "",
      driverPhone: row.driver_phone || "",
      driverStatus: row.driver_status || "Идэвхтэй",
      driverReason: row.driver_reason || "",
      salesRep: row.sales_rep || "",
      salesRepPhone: row.sales_rep_phone || "",
      srCode: row.sr_code || "",
      originalVehiclePlate: row.original_vehicle_plate || row.vehicle_plate,
      vehicleStatus: row.vehicle_status || "Хэвийн",
      vehicleReason: row.vehicle_reason || "",
      actualVehiclePlate: row.actual_vehicle_plate || row.vehicle_plate,
      vehicleChanged: Number(row.vehicle_changed) === 1,
      routeStatus: row.route_status || "Гарсан",
      driverChanged: Number(row.driver_changed) === 1,
      status: row.status || "active",
      notes: row.notes || undefined,
      createdAt: row.created_at,
      createdBy: row.created_by || undefined,
      updatedAt: row.updated_at,
      updatedBy: row.updated_by || undefined
    };
  }

  private static mapRowToFine(row: any): DriverFineEntity {
    return {
      id: row.id,
      assignmentId: row.assignment_id,
      businessDate: row.business_date,
      vehiclePlate: row.vehicle_plate,
      vehicleDivision: row.vehicle_division,
      routeId: row.route_id || "",
      routeName: row.route_name || "",
      originalDriverId: row.original_driver_id,
      originalDriverName: row.original_driver_name,
      originalDriverCode: row.original_driver_code || "",
      actualDriverId: row.actual_driver_id,
      actualDriverName: row.actual_driver_name,
      actualDriverCode: row.actual_driver_code || "",
      fineReason: row.fine_reason,
      fineAmount: Number(row.fine_amount) || 0,
      driverDeduction: Number(row.driver_deduction) || 0,
      organization: row.organization || (row.vehicle_division === "IMD" ? "Айсмарк Дистрибьюшн ХХК" : "АЙСМАРК ТРЕЙД ХХК"),
      feeAmount: Number(row.fee_amount) || 0,
      status: row.status || "active",
      notes: row.notes || undefined,
      createdAt: row.created_at,
      createdBy: row.created_by || undefined
    };
  }

  /**
   * Find assignments by date
   */
  static findByDate(businessDate: string): DailyAssignmentEntity[] {
    const db = getDatabase();
    const rows = db.prepare("SELECT * FROM daily_driver_assignments WHERE business_date = ? ORDER BY route_id ASC, vehicle_plate ASC").all(businessDate);
    return rows.map(r => this.mapRowToAssignment(r));
  }

  /**
   * Find assignments by month with optional filters
   */
  static findByMonth(month: string, division?: string): DailyAssignmentEntity[] {
    const db = getDatabase();
    let query = "SELECT * FROM daily_driver_assignments WHERE business_date LIKE ?";
    const params: any[] = [`${month}%`];

    if (division && division !== "all") {
      query += " AND vehicle_division = ?";
      params.push(division);
    }

    query += " ORDER BY business_date DESC, route_id ASC";
    const rows = db.prepare(query).all(...params);
    return rows.map(r => this.mapRowToAssignment(r));
  }

  /**
   * Find all fines with flexible filtering (month, date, division, driverId)
   */
  static findFines(filters?: { month?: string; date?: string; division?: string; driverId?: string }): DriverFineEntity[] {
    const db = getDatabase();
    let query = "SELECT * FROM driver_change_fines WHERE 1=1";
    const params: any[] = [];

    if (filters?.date) {
      query += " AND business_date = ?";
      params.push(filters.date);
    } else if (filters?.month) {
      query += " AND business_date LIKE ?";
      params.push(`${filters.month}%`);
    }

    if (filters?.division && filters.division !== "all") {
      query += " AND vehicle_division = ?";
      params.push(filters.division);
    }

    if (filters?.driverId) {
      query += " AND (actual_driver_id = ? OR original_driver_id = ?)";
      params.push(filters.driverId, filters.driverId);
    }

    query += " ORDER BY business_date DESC, vehicle_plate ASC";
    const rows = db.prepare(query).all(...params);
    return rows.map(r => this.mapRowToFine(r));
  }

  /**
   * Monthly aggregate report:
   * 1. Vehicle Swaps
   * 2. Driver Swaps
   * 3. Non-departure routes
   */
  static getMonthlyExceptionReport(month: string, division?: string) {
    const assignments = this.findByMonth(month, division);

    const vehicleSwaps = assignments.filter(a => a.vehicleChanged);
    const driverSwaps = assignments.filter(a => a.driverChanged);
    const nonDepartures = assignments.filter(a => a.routeStatus === "Гараагүй" || a.routeStatus === "Цуцалсан" || a.routeStatus === "Хойшилсон");

    return {
      month,
      division: division || "all",
      totalRecordedDays: Array.from(new Set(assignments.map(a => a.businessDate))).length,
      totalAssignments: assignments.length,
      vehicleSwapsCount: vehicleSwaps.length,
      driverSwapsCount: driverSwaps.length,
      nonDeparturesCount: nonDepartures.length,
      vehicleSwaps,
      driverSwaps,
      nonDepartures
    };
  }

  /**
   * Save daily assignments in a strict ACID transaction (Idempotent)
   */
  static saveBatchAssignments(
    businessDate: string,
    assignments: Array<{
      vehiclePlate: string;
      vehicleDivision: "IMT" | "IMD";
      routeId?: string;
      routeName?: string;
      originalDriverId: string;
      originalDriverName: string;
      originalDriverCode?: string;
      actualDriverId: string;
      actualDriverName: string;
      actualDriverCode?: string;
      driverPhone?: string;
      driverStatus?: string;
      driverReason?: string;
      salesRep?: string;
      salesRepPhone?: string;
      srCode?: string;
      originalVehiclePlate?: string;
      vehicleStatus?: string;
      vehicleReason?: string;
      actualVehiclePlate?: string;
      vehicleChanged?: boolean;
      routeStatus?: string;
      notes?: string;
    }>,
    fineRule = { fineAmount: 10000, driverDeduction: 10000, feeAmount: 0, reason: "Жолооч солигдсон" },
    actor = "system"
  ): { savedCount: number; finesGeneratedCount: number; finesRemovedCount: number } {
    return runInTransaction(() => {
      const db = getDatabase();
      const now = new Date().toISOString();
      let finesGeneratedCount = 0;
      let finesRemovedCount = 0;

      const upsertAssignStmt = db.prepare(`
        INSERT INTO daily_driver_assignments (
          id, business_date, vehicle_plate, vehicle_division,
          route_id, route_name, original_driver_id, original_driver_name, original_driver_code,
          actual_driver_id, actual_driver_name, actual_driver_code,
          driver_phone, driver_status, driver_reason,
          sales_rep, sales_rep_phone, sr_code,
          original_vehicle_plate, vehicle_status, vehicle_reason, actual_vehicle_plate,
          vehicle_changed, route_status, driver_changed,
          status, notes, created_at, created_by, updated_at, updated_by
        ) VALUES (
          ?, ?, ?, ?,
          ?, ?, ?, ?, ?,
          ?, ?, ?,
          ?, ?, ?,
          ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?,
          'active', ?, ?, ?, ?, ?
        )
        ON CONFLICT(id) DO UPDATE SET
          actual_driver_id = excluded.actual_driver_id,
          actual_driver_name = excluded.actual_driver_name,
          actual_driver_code = excluded.actual_driver_code,
          driver_phone = excluded.driver_phone,
          driver_status = excluded.driver_status,
          driver_reason = excluded.driver_reason,
          sales_rep = excluded.sales_rep,
          sales_rep_phone = excluded.sales_rep_phone,
          sr_code = excluded.sr_code,
          original_vehicle_plate = excluded.original_vehicle_plate,
          vehicle_status = excluded.vehicle_status,
          vehicle_reason = excluded.vehicle_reason,
          actual_vehicle_plate = excluded.actual_vehicle_plate,
          vehicle_changed = excluded.vehicle_changed,
          route_status = excluded.route_status,
          driver_changed = excluded.driver_changed,
          route_id = excluded.route_id,
          route_name = excluded.route_name,
          notes = excluded.notes,
          updated_at = excluded.updated_at,
          updated_by = excluded.updated_by
      `);

      const upsertFineStmt = db.prepare(`
        INSERT INTO driver_change_fines (
          id, assignment_id, business_date, vehicle_plate, vehicle_division,
          route_id, route_name, original_driver_id, original_driver_name, original_driver_code,
          actual_driver_id, actual_driver_name, actual_driver_code, fine_reason,
          fine_amount, driver_deduction, organization, fee_amount,
          status, notes, created_at, created_by
        ) VALUES (
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?, ?,
          'active', ?, ?, ?
        )
        ON CONFLICT(id) DO UPDATE SET
          actual_driver_id = excluded.actual_driver_id,
          actual_driver_name = excluded.actual_driver_name,
          actual_driver_code = excluded.actual_driver_code,
          route_id = excluded.route_id,
          route_name = excluded.route_name,
          fine_reason = excluded.fine_reason,
          fine_amount = excluded.fine_amount,
          driver_deduction = excluded.driver_deduction,
          organization = excluded.organization,
          fee_amount = excluded.fee_amount,
          notes = excluded.notes
      `);

      const deleteFineStmt = db.prepare(`
        DELETE FROM driver_change_fines WHERE id = ?
      `);

      for (const item of assignments) {
        const cleanPlate = (item.originalVehiclePlate || item.vehiclePlate).replace(/\s+/g, "").toUpperCase();
        const routeKey = item.routeId ? item.routeId.replace(/\s+/g, "") : cleanPlate;
        const assignId = `dda_${businessDate}_${routeKey}`;
        const fineId = `fine_${businessDate}_${routeKey}`;

        // Compare driver: if actualDriverName differs from originalDriverName (or status != Идэвхтэй)
        const isDriverChanged = (item.originalDriverId || "").trim() !== (item.actualDriverId || "").trim() ||
          ((item.actualDriverName || "").trim() !== "" && (item.actualDriverName || "").trim() !== (item.originalDriverName || "").trim());
        const driverChangedInt = isDriverChanged ? 1 : 0;

        // Compare vehicle
        const cleanOrigPlate = (item.originalVehiclePlate || item.vehiclePlate).replace(/\s+/g, "").toUpperCase();
        const cleanActualPlate = (item.actualVehiclePlate || item.vehiclePlate).replace(/\s+/g, "").toUpperCase();
        const isVehicleChanged = item.vehicleChanged ?? (cleanOrigPlate !== cleanActualPlate && cleanActualPlate !== "");
        const vehicleChangedInt = isVehicleChanged ? 1 : 0;

        const effectiveRouteStatus = item.routeStatus || "Гарсан";

        upsertAssignStmt.run(
          assignId,
          businessDate,
          item.vehiclePlate,
          item.vehicleDivision,
          item.routeId || "",
          item.routeName || "",
          item.originalDriverId,
          item.originalDriverName,
          item.originalDriverCode || "",
          item.actualDriverId,
          item.actualDriverName,
          item.actualDriverCode || "",
          item.driverPhone || "",
          item.driverStatus || "Идэвхтэй",
          item.driverReason || "",
          item.salesRep || "",
          item.salesRepPhone || "",
          item.srCode || "",
          item.originalVehiclePlate || item.vehiclePlate,
          item.vehicleStatus || "Хэвийн",
          item.vehicleReason || "",
          item.actualVehiclePlate || item.vehiclePlate,
          vehicleChangedInt,
          effectiveRouteStatus,
          driverChangedInt,
          item.notes || null,
          now,
          actor,
          now,
          actor
        );

        if (isDriverChanged) {
          const orgName = item.vehicleDivision === "IMD" 
            ? "Айсмарк Дистрибьюшн ХХК" 
            : "АЙСМАРК ТРЕЙД ХХК";

          const fineReasonText = item.driverReason 
            ? `Жолооч солигдсон (${item.driverStatus || "Солигдсон"}: ${item.driverReason})`
            : (fineRule.reason || "Жолооч солигдсон");

          upsertFineStmt.run(
            fineId,
            assignId,
            businessDate,
            item.actualVehiclePlate || item.vehiclePlate,
            item.vehicleDivision,
            item.routeId || "",
            item.routeName || "",
            item.originalDriverId,
            item.originalDriverName,
            item.originalDriverCode || "",
            item.actualDriverId,
            item.actualDriverName,
            item.actualDriverCode || "",
            fineReasonText,
            fineRule.fineAmount || 10000,
            fineRule.driverDeduction || 10000,
            orgName,
            fineRule.feeAmount || 0,
            item.notes || null,
            now,
            actor
          );
          finesGeneratedCount++;
        } else {
          // If original driver is driving, remove any previous fine record for this day and vehicle/route
          const delRes = deleteFineStmt.run(fineId);
          if (delRes && (delRes as any).changes > 0) {
            finesRemovedCount++;
          }
        }
      }

      return {
        savedCount: assignments.length,
        finesGeneratedCount,
        finesRemovedCount
      };
    });
  }
}
