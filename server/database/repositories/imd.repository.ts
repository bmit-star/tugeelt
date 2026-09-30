import { getDatabase, runInTransaction } from "../client";

export class IMDRepository {
  // Orders
  static findAllOrders(): any[] {
    const db = getDatabase();
    const rows = db.prepare("SELECT * FROM imd_orders ORDER BY received_date DESC, created_at DESC").all();
    return rows.map((r: any) => ({
      id: r.id,
      orderNo: r.order_no,
      customer: r.customer,
      customerOrg: r.customer_org || "",
      province: r.province,
      destination: r.destination,
      quantity: r.quantity || "",
      receivedDate: r.received_date,
      deliveryDate: r.delivery_date,
      status: r.status,
      assignmentId: r.assignment_id || undefined,
      shareToken: r.share_token || undefined,
      notes: r.notes || "",
      createdAt: r.created_at,
      updatedAt: r.updated_at
    }));
  }

  static findOrderById(id: string): any | null {
    const db = getDatabase();
    const r = db.prepare("SELECT * FROM imd_orders WHERE id = ?").get(id) as any;
    if (!r) return null;
    return {
      id: r.id,
      orderNo: r.order_no,
      customer: r.customer,
      customerOrg: r.customer_org || "",
      province: r.province,
      destination: r.destination,
      quantity: r.quantity || "",
      receivedDate: r.received_date,
      deliveryDate: r.delivery_date,
      status: r.status,
      assignmentId: r.assignment_id || undefined,
      shareToken: r.share_token || undefined,
      notes: r.notes || "",
      createdAt: r.created_at,
      updatedAt: r.updated_at
    };
  }

  static saveOrder(order: any): void {
    const db = getDatabase();
    db.prepare(`
      INSERT OR REPLACE INTO imd_orders (
        id, order_no, customer, customer_org, province, destination, quantity,
        received_date, delivery_date, status, assignment_id, share_token, notes, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      order.id,
      order.orderNo,
      order.customer,
      order.customerOrg || "",
      order.province,
      order.destination,
      order.quantity || "",
      order.receivedDate,
      order.deliveryDate,
      order.status || "Хүлээгдэж буй",
      order.assignmentId || null,
      order.shareToken || null,
      order.notes || null,
      order.createdAt || new Date().toISOString(),
      new Date().toISOString()
    );
  }

  // Assignments
  static findAllAssignments(): any[] {
    const db = getDatabase();
    const rows = db.prepare("SELECT * FROM imd_assignments ORDER BY departure_date DESC, created_at DESC").all();
    return rows.map((r: any) => {
      const payload = r.payload_json ? JSON.parse(r.payload_json) : {};
      return {
        ...payload,
        id: r.id,
        orderId: r.order_id,
        vehiclePlate: r.vehicle_plate,
        primaryDriverId: r.primary_driver_id,
        primaryDriverName: r.primary_driver_name,
        secondaryDriverId: r.secondary_driver_id || undefined,
        secondaryDriverName: r.secondary_driver_name || undefined,
        departureDate: r.departure_date,
        status: r.status,
        token: r.token || undefined
      };
    });
  }

  static findAssignmentById(id: string): any | null {
    const db = getDatabase();
    const r = db.prepare("SELECT * FROM imd_assignments WHERE id = ?").get(id) as any;
    if (!r) return null;
    const payload = r.payload_json ? JSON.parse(r.payload_json) : {};
    return {
      ...payload,
      id: r.id,
      orderId: r.order_id,
      vehiclePlate: r.vehicle_plate,
      primaryDriverId: r.primary_driver_id,
      primaryDriverName: r.primary_driver_name,
      secondaryDriverId: r.secondary_driver_id || undefined,
      secondaryDriverName: r.secondary_driver_name || undefined,
      departureDate: r.departure_date,
      status: r.status,
      token: r.token || undefined
    };
  }

  static saveAssignment(assignment: any): void {
    const db = getDatabase();
    db.prepare(`
      INSERT OR REPLACE INTO imd_assignments (
        id, order_id, vehicle_plate, primary_driver_id, primary_driver_name,
        secondary_driver_id, secondary_driver_name, departure_date, status, token, payload_json, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      assignment.id,
      assignment.orderId,
      assignment.vehiclePlate,
      assignment.primaryDriverId,
      assignment.primaryDriverName,
      assignment.secondaryDriverId || null,
      assignment.secondaryDriverName || null,
      assignment.departureDate,
      assignment.status || "Хуваарилсан",
      assignment.token || null,
      JSON.stringify(assignment),
      assignment.createdAt || new Date().toISOString(),
      new Date().toISOString()
    );
  }

  // Official Letters
  static findAllLetters(): any[] {
    const db = getDatabase();
    const rows = db.prepare("SELECT * FROM official_letters ORDER BY created_at DESC").all();
    return rows.map((r: any) => {
      const payload = r.payload_json ? JSON.parse(r.payload_json) : {};
      return {
        ...payload,
        id: r.id,
        letterNumber: r.letter_number,
        orderId: r.order_id,
        assignmentId: r.assignment_id,
        fileId: r.file_id,
        fileName: r.file_name,
        fileUrl: r.file_url,
        status: r.status,
        createdAt: r.created_at
      };
    });
  }

  static saveLetter(letter: any): void {
    const db = getDatabase();
    db.prepare(`
      INSERT OR REPLACE INTO official_letters (
        id, letter_number, order_id, assignment_id, file_id, file_name, file_url, status, payload_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      letter.id,
      letter.letterNumber || letter.dugaar || letter.id,
      letter.orderId || null,
      letter.assignmentId || null,
      letter.fileId || null,
      letter.fileName || null,
      letter.fileUrl || null,
      letter.status || "DONE",
      JSON.stringify(letter),
      letter.createdAt || new Date().toISOString()
    );
  }

  // Routes
  static findAllRoutes(): any[] {
    const db = getDatabase();
    const rows = db.prepare("SELECT * FROM imd_routes ORDER BY province ASC").all();
    return rows.map((r: any) => ({
      id: r.id,
      province: r.province,
      routeName: r.route_name,
      distanceKm: Number(r.distance_km),
      estimatedHours: Number(r.estimated_hours)
    }));
  }
}
