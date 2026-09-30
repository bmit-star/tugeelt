import express, { Request, Response } from "express";
import crypto from "crypto";
import { setupOfficialLettersModule, ensureLetterRecordAndFile } from "./server-official-letters";
import { restore40Assignments } from "./server/modules/imd/restore-assignments";
import { getDatabase } from "./server/database/client";

export interface IMDOrder {
  id: string;
  orderNo: string;
  customer: string;
  customerOrg?: string;
  receivedDate: string;
  deliveryDate: string;
  province: string;
  destination: string;
  quantity: number;
  unitPrice?: number;
  note?: string;
  status: "Шинэ" | "Хүлээгдэж буй" | "Томилолт хуваарилагдсан" | "Тээвэрт гарсан" | "Дууссан" | "Цуцлагдсан";
  shareToken: string;
  assignmentId?: string;
  primaryDriverId?: string;
  primaryDriverName?: string;
  vehiclePlate?: string;
  substituteDriverId?: string;
  substituteDriverName?: string;
  roundTripKm?: number;
  mealCount?: number;
  mealAllowance?: number;
  createdAt: string;
  updatedAt: string;
}

export interface IMDAssignment {
  id: string;
  orderId: string;
  orderNo: string;
  province: string;
  destination: string;
  vehicleId: string;
  vehiclePlate: string;
  primaryDriverId: string;
  primaryDriverName: string;
  primaryDriverPhone?: string;
  substituteDriverId?: string;
  substituteDriverName?: string;
  substituteDriverPhone?: string;
  departureDate: string;
  returnDate?: string;
  quantity: number;
  vehicleCapacity?: number; // Машины багтаамж (хайрцаг: 700, 1000, 1500)
  note?: string;
  status: "Төлөвлөсөн" | "Тээвэрт гарсан" | "Дууссан" | "Цуцлагдсан";
  token: string;
  startOdo?: number;
  endOdo?: number;
  actualKm?: number;
  roundTripKm?: number;
  mealCount?: number;
  mealPerPerson?: number;
  mealAllowance?: number;
  driverCount?: number;
  fuelLiters?: number;
  fuelStation?: string;
  waybillId?: string;
  albanBichigDugaar?: string;
  albanBichigPdfUrl?: string;
  isRegistered?: boolean;
  isMock?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface IMDRoute {
  id: string;
  province: string;
  destination: string;
  roundTripKm: number;
  roadPost: string;
  mealFrequency: string;
  mealCount?: number;
  tripCount?: number;
  totalBoxes?: number;
}

export interface IMDAuditLog {
  id: string;
  timestamp: string;
  user: string;
  action: string;
  details: string;
  oldValue?: any;
  newValue?: any;
}

export const DEFAULT_IMD_ROUTES: IMDRoute[] = [
  { id: "RT-ERDENET", province: "Орхон", destination: "Эрдэнэт", roundTripKm: 742, roadPost: "Дархан, Эрдэнэт", mealFrequency: "3 удаа", mealCount: 3, tripCount: 0, totalBoxes: 0 },
  { id: "RT-DARKHAN", province: "Дархан Уул", destination: "Дархан Уул", roundTripKm: 438, roadPost: "22-ын товчоо, Баруунхараа, Дархан", mealFrequency: "2 удаа", mealCount: 2, tripCount: 0, totalBoxes: 0 },
  { id: "RT-TOSONTSEnGEL", province: "Завхан", destination: "Тосонцэнгэл", roundTripKm: 1606, roadPost: "Цэцэрлэг, Солонготын даваа, Тосонцэнгэл", mealFrequency: "5 удаа", mealCount: 5, tripCount: 0, totalBoxes: 0 },
  { id: "RT-ULAANGOM", province: "Увс", destination: "Улаангом", roundTripKm: 2672, roadPost: "Тосонцэнгэл, Сонгино, Улаангом", mealFrequency: "6 удаа", mealCount: 6, tripCount: 0, totalBoxes: 0 },
  { id: "RT-UNDURKHAAN", province: "Хэнтий", destination: "Өндөрхаан", roundTripKm: 662, roadPost: "Багануур, Цэнхэрмандал, Өндөрхаан", mealFrequency: "3 удаа", mealCount: 3, tripCount: 0, totalBoxes: 0 },
  { id: "RT-MURUN", province: "Хөвсгөл", destination: "Мөрөн", roundTripKm: 1620, roadPost: "Дархан, Эрдэнэт, Булган, Мөрөн", mealFrequency: "5 удаа", mealCount: 5, tripCount: 0, totalBoxes: 0 },
  { id: "RT-KHOVD", province: "Ховд", destination: "Ховд", roundTripKm: 2851, roadPost: "Баянхонгор, Алтай, Дарви, Ховд", mealFrequency: "6 удаа", mealCount: 6, tripCount: 0, totalBoxes: 0 },
  { id: "RT-BARUUNURT", province: "Сүхбаатар", destination: "Баруун-Урт", roundTripKm: 1120, roadPost: "Багануур, Өндөрхаан, Баруун-Урт", mealFrequency: "4 удаа", mealCount: 4, tripCount: 0, totalBoxes: 0 },
  { id: "RT-DALANZADGAD", province: "Өмнөговь", destination: "Даланзадгад", roundTripKm: 1106, roadPost: "Мандалговь, Даланзадгад", mealFrequency: "4 удаа", mealCount: 4, tripCount: 0, totalBoxes: 0 },
  { id: "RT-ARVAIKHEER", province: "Өвөрхангай", destination: "Арвайхээр", roundTripKm: 860, roadPost: "Лүн, Элсэн тасархай, Арвайхээр", mealFrequency: "3 удаа", mealCount: 3, tripCount: 0, totalBoxes: 0 },
  { id: "RT-ULIASTAI", province: "Завхан", destination: "Улиастай", roundTripKm: 2030, roadPost: "Арвайхээр, Баянхонгор, Улиастай", mealFrequency: "5 удаа", mealCount: 5, tripCount: 0, totalBoxes: 0 },
  { id: "RT-MANDALGOVI", province: "Дундговь", destination: "Мандалговь", roundTripKm: 560, roadPost: "Зүүн дэлгэр, Мандалговь", mealFrequency: "2 удаа", mealCount: 2, tripCount: 0, totalBoxes: 0 },
  { id: "RT-CHOIBALSAN", province: "Дорнод", destination: "Чойбалсан", roundTripKm: 1310, roadPost: "Өндөрхаан, Хэрлэн, Чойбалсан", mealFrequency: "4 удаа", mealCount: 4, tripCount: 0, totalBoxes: 0 },
  { id: "RT-SAINSHAND", province: "Дорноговь", destination: "Сайншанд", roundTripKm: 926, roadPost: "Налайх, Чойр, Сайншанд", mealFrequency: "3 удаа", mealCount: 3, tripCount: 0, totalBoxes: 0 },
  { id: "RT-BAYANKHONGOR", province: "Баянхонгор", destination: "Баянхонгор", roundTripKm: 1260, roadPost: "Арвайхээр, Баянхонгор", mealFrequency: "4 удаа", mealCount: 4, tripCount: 0, totalBoxes: 0 },
  { id: "RT-TSETSERLEG", province: "Архангай", destination: "Цэцэрлэг хот", roundTripKm: 906, roadPost: "Лүн, Өгий нуур, Цэцэрлэг", mealFrequency: "3 удаа", mealCount: 3, tripCount: 0, totalBoxes: 0 },
  { id: "RT-ZAMYN-UUD", province: "Дорноговь", destination: "Замын-Үүд сум", roundTripKm: 1316, roadPost: "Чойр, Сайншанд, Замын-Үүд", mealFrequency: "4 удаа", mealCount: 4, tripCount: 0, totalBoxes: 0 },
  { id: "RT-ZUUN-KHARA", province: "Сэлэнгэ", destination: "Зүүн-Хараа сум", roundTripKm: 360, roadPost: "Баянчандмань, Зүүнхараа", mealFrequency: "2 удаа", mealCount: 2, tripCount: 0, totalBoxes: 0 },
  { id: "RT-ALTAI", province: "Говь-Алтай", destination: "Алтай хот", roundTripKm: 2074, roadPost: "Баянхонгор, Буурцаг, Алтай", mealFrequency: "5 удаа", mealCount: 5, tripCount: 0, totalBoxes: 0 },
  { id: "RT-SUKHBAATAR", province: "Сэлэнгэ", destination: "Сүхбаатар хот", roundTripKm: 700, roadPost: "Дархан, Сүхбаатар товчоо", mealFrequency: "3 удаа", mealCount: 3, tripCount: 0, totalBoxes: 0 },
  { id: "RT-KHARKHORIN", province: "Өвөрхангай", destination: "Хархорин", roundTripKm: 700, roadPost: "Лүн, Элсэн тасархай, Хархорин", mealFrequency: "3 удаа", mealCount: 3, tripCount: 0, totalBoxes: 0 },
  { id: "RT-BAGANUUR", province: "Улаанбаатар", destination: "Багануур дүүрэг", roundTripKm: 320, roadPost: "Налайх, Багануур", mealFrequency: "2 удаа", mealCount: 2, tripCount: 0, totalBoxes: 0 },
  { id: "RT-AIRAG", province: "Дорноговь", destination: "Айраг сум", roundTripKm: 640, roadPost: "Чойр, Айраг", mealFrequency: "3 удаа", mealCount: 3, tripCount: 0, totalBoxes: 0 },
  { id: "RT-CHOIR", province: "Говьсүмбэр", destination: "Чойр", roundTripKm: 480, roadPost: "Налайх, Баянтал, Чойр", mealFrequency: "2 удаа", mealCount: 2, tripCount: 0, totalBoxes: 0 }
];

export const OFFICIAL_BOX_CAPACITY_MAP: Record<string, number> = {
  "8374УНЕ": 1000,
  "3147УЕН": 700,
  "3148УЕМ": 700,
  "3148УЕО": 700,
  "5909УКО": 1500,
  "6530УКН": 1500,
  "8376УЕН": 700,
  "8428УНД": 700,
};

export function getVehicleBoxCapacity(plateOrDriverId?: string, driversList?: any[]): number {
  if (!plateOrDriverId) return 700;
  const clean = String(plateOrDriverId).replace(/\s+/g, "").toUpperCase();

  // 1. Check custom drivers list if boxCapacity is present
  if (driversList && driversList.length > 0) {
    const matched = driversList.find((d: any) => {
      const vPlate = d.vehicle ? String(d.vehicle).replace(/\s+/g, "").toUpperCase() : "";
      const dCode = d.code ? String(d.code).replace(/\s+/g, "").toUpperCase() : "";
      const dId = d.id ? String(d.id).replace(/\s+/g, "").toUpperCase() : "";
      return (
        vPlate === clean ||
        vPlate.includes(clean) ||
        clean.includes(vPlate) ||
        dId === clean ||
        dCode === clean ||
        (d.name && d.name.includes(clean))
      );
    });
    if (matched && matched.boxCapacity && Number(matched.boxCapacity) > 0) {
      return Number(matched.boxCapacity);
    }
  }

  // 2. Check standardized official capacity map
  for (const [plate, cap] of Object.entries(OFFICIAL_BOX_CAPACITY_MAP)) {
    const cleanP = plate.replace(/\s+/g, "").toUpperCase();
    if (clean === cleanP || clean.includes(cleanP) || cleanP.includes(clean)) {
      return cap;
    }
  }

  return 700;
}

export function getVehicleContinuousOdo(cleanPlate: string, dateStr: string, db: any): number {
  const normPlate = (cleanPlate || "").toUpperCase().replace(/\s+/g, "");

  // 1. Check previous trips before this date
  const pastTrips = (db.trips || [])
    .filter((t: any) => {
      const tVeh = (t.vehicleNumber || "").toUpperCase().replace(/\s+/g, "");
      return tVeh === normPlate && t.date < dateStr && t.endOdo !== undefined && t.endOdo !== null && Number(t.endOdo) > 0;
    })
    .sort((a: any, b: any) => b.date.localeCompare(a.date));

  if (pastTrips.length > 0 && pastTrips[0].endOdo) {
    return Number(pastTrips[0].endOdo);
  }

  // 2. Check DailyGPSMileages before this date
  const pastGPS = (db.dailyGPSMileages || [])
    .filter((m: any) => {
      const mVeh = (m.vehicleNumber || "").toUpperCase().replace(/\s+/g, "");
      return mVeh === normPlate && m.date < dateStr && m.endOdo !== undefined && m.endOdo !== null && Number(m.endOdo) > 0;
    })
    .sort((a: any, b: any) => b.date.localeCompare(a.date));

  if (pastGPS.length > 0 && pastGPS[0].endOdo) {
    return Number(pastGPS[0].endOdo);
  }

  // 3. Check driver master autoOdoConfig / apiOdo
  const driver = (db.drivers || []).find((d: any) => (d.vehicle || "").toUpperCase().replace(/\s+/g, "") === normPlate);
  if (driver?.autoOdoConfig?.monthStartOdo) return Number(driver.autoOdoConfig.monthStartOdo);
  if (driver?.apiOdo) return Number(driver.apiOdo);
  if (driver?.telemetry?.odo) return Number(driver.telemetry.odo);

  return 148000;
}

export function setupIMDModule(
  app: express.Express,
  db: any,
  saveDB: (db: any) => void,
  getTelemetryFn?: () => Promise<Record<string, any>>
) {
  // Ensure DB collections are initialized
  if (!db.orders) db.orders = [];
  if (!db.assignments) db.assignments = [];
  if (!db.routes || db.routes.length === 0) {
    db.routes = [...DEFAULT_IMD_ROUTES];
  } else {
    // Synchronize authoritative route distances & meal frequencies and clear fake tripCount
    DEFAULT_IMD_ROUTES.forEach(defRoute => {
      const idx = db.routes.findIndex((r: IMDRoute) => 
        r.id === defRoute.id || 
        r.destination.toLowerCase() === defRoute.destination.toLowerCase() ||
        r.province.toLowerCase() === defRoute.province.toLowerCase()
      );
      if (idx !== -1) {
        db.routes[idx].roundTripKm = defRoute.roundTripKm;
        db.routes[idx].destination = defRoute.destination;
        db.routes[idx].province = defRoute.province;
        db.routes[idx].mealCount = defRoute.mealCount;
        db.routes[idx].mealFrequency = defRoute.mealFrequency;
        // Purge legacy fake seed counts
        if (db.routes[idx].tripCount && !db.assignments.some((a: any) => a.province === defRoute.province || a.destination?.includes(defRoute.destination))) {
          db.routes[idx].tripCount = 0;
          db.routes[idx].totalBoxes = 0;
        }
      } else {
        db.routes.push(defRoute);
      }
    });
  }
  if (!db.auditLogs) db.auditLogs = [];

  // Endpoint to restore assignments is disabled by user request
  app.all("/api/imd/assignments/restore-40", (_req: Request, res: Response) => {
    res.status(403).json({
      status: "error",
      message: "Зохиомол томилолт сэргээх үйлдэл идэвхгүй болсон байна."
    });
  });

  // Startup data preservation: preserve all saved orders, assignments, trips, and user edits without rewriting
  // Endpoint to clear ONLY mock / dummy / test assignments - NEVER deletes real registered assignments
  app.post("/api/imd/assignments/clear-mock", (req: Request, res: Response) => {
    try {
      const { all, confirmPurgeAll } = req.body || {};

      // Helper to identify mock/sample/canonical template assignments
      const isMockItem = (item: any) => {
        if (!item) return false;
        // Explicit mock flags
        if (item.isMock === true || item.isSample === true || item.isTest === true) return true;
        // Template order numbers (001 to 040 from the mock generator)
        const oNo = (item.orderNo || "").toUpperCase();
        if (oNo.startsWith("ORD-IMD-260915-") && (item.id?.startsWith("asn_ord_imd_260915_") || item.id?.startsWith("order_ord_imd_260915_") || item.token?.startsWith("tok_"))) {
          return true;
        }
        // Test tokens or explicit mock IDs
        if (item.id?.startsWith("asn_ord_imd_260915_") || item.id?.startsWith("order_ord_imd_260915_")) return true;
        if (item.orderId?.startsWith("order_ord_imd_260915_")) return true;
        if (item.token?.includes("khv_0903") || item.token?.includes("dornogovi_0902")) return true;
        if (item.shareToken?.includes("khv_0903") || item.shareToken?.includes("dornogovi_0902") || item.shareToken?.includes("darkhan_0904")) return true;
        if (item.id?.startsWith("MOCK-") || item.id?.startsWith("TEST-")) return true;
        if (item.orderNo?.startsWith("MOCK-") || item.orderNo?.startsWith("TEST-")) return true;
        return false;
      };

      const initialAsnCount = (db.assignments || []).length;
      const initialOrdCount = (db.orders || []).length;

      let deletedAsnIds = new Set<string>();
      let deletedOrderIds = new Set<string>();

      if (all && confirmPurgeAll === "YES_PURGE_ALL_REGISTERED_DATA") {
        // Only if manager explicitly requested full system reset
        (db.assignments || []).forEach((a: any) => deletedAsnIds.add(a.id));
        (db.orders || []).forEach((o: any) => deletedOrderIds.add(o.id));
        db.assignments = [];
        db.orders = [];
        db.officialLetters = [];
      } else {
        // Find mock items to remove
        (db.assignments || []).forEach((a: any) => {
          if (isMockItem(a)) deletedAsnIds.add(a.id);
        });
        (db.orders || []).forEach((o: any) => {
          if (isMockItem(o)) deletedOrderIds.add(o.id);
        });

        db.orders = (db.orders || []).filter((o: any) => !isMockItem(o));
        db.assignments = (db.assignments || []).filter((a: any) => !isMockItem(a));
        db.officialLetters = (db.officialLetters || []).filter((l: any) => {
          if (l.id && l.id.startsWith("LTR-260915-")) return false;
          if (l.assignmentId && deletedAsnIds.has(l.assignmentId)) return false;
          if (l.orderId && deletedOrderIds.has(l.orderId)) return false;
          return true;
        });
      }

      // Remove mock test trips and normalize fake "Орон нутаг холын томилолт" notes to real transport notes
      db.trips = (db.trips || []).filter((t: any) => 
        t.id !== "trip_khv_3147_0903" && 
        t.id !== "trip_dor_3148_0902"
      ).map((t: any) => {
        if (t.routeNote === "Орон нутаг холын томилолт") {
          return {
            ...t,
            routeNote: t.totalKm > 0 ? "Түгээлт тээвэрлэлт" : "Хуваарьт зогсолт / 0 км"
          };
        }
        return t;
      });

      // Synchronize deletion into SQLite
      try {
        const sqlite = getDatabase();
        sqlite.prepare("DELETE FROM imd_assignments WHERE id LIKE 'asn_ord_imd_260915_%' OR order_id LIKE 'order_ord_imd_260915_%' OR id LIKE 'MOCK-%' OR id LIKE 'ASN-672516' OR id IN ('ASN-701050', 'ASN-685945')").run();
        sqlite.prepare("DELETE FROM imd_orders WHERE order_no LIKE 'ORD-IMD-260915-%' OR id LIKE 'order_ord_imd_260915_%' OR id LIKE 'MOCK-%' OR order_no IN ('ORD-IMD-260908-088', 'ORD-IMD-260910-201', 'ORD-IMD-260909-105') OR id IN ('ORD-701038', 'ORD-697345', 'ord_direct_1788919558857')").run();
      } catch (sqlErr) {
        console.warn("SQLite purge in clear-mock warning:", sqlErr);
      }

      saveDB(db);

      const removedAsns = initialAsnCount - (db.assignments || []).length;
      const removedOrds = initialOrdCount - (db.orders || []).length;

      const message = removedAsns > 0 || removedOrds > 0
        ? `Зохиомол ${removedAsns} томилолт, ${removedOrds} захиалга амжилттай устгагдлаа. Замын хуудасны зохиомол бичвэрүүд цэвэрлэгдэв.`
        : `Системд зохиомол томилолт байхгүй байна. Таны бүртгэсэн үндсэн ${db.assignments.length} томилолт бүрэн бүтэн хадгалагдсан.`;

      res.json({
        status: "success",
        message,
        deletedMockAssignments: removedAsns,
        deletedMockOrders: removedOrds,
        remainingAssignments: db.assignments.length
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  function logAudit(user: string, action: string, details: string, oldValue?: any, newValue?: any) {
    const entry: IMDAuditLog = {
      id: "aud_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
      timestamp: new Date().toISOString(),
      user: user || "Менежер",
      action,
      details,
      oldValue,
      newValue
    };
    if (!db.auditLogs) db.auditLogs = [];
    db.auditLogs.unshift(entry);
    if (db.auditLogs.length > 200) db.auditLogs.pop();
  }

  // 1. ORDERS CRUD
  app.get("/api/imd/orders", (req: Request, res: Response) => {
    try {
      const { status, province, search } = req.query;
      let list: IMDOrder[] = [...(db.orders || [])];

      if (status && status !== "all") {
        list = list.filter(o => o.status === status);
      }
      if (province && province !== "all") {
        list = list.filter(o => o.province === province);
      }
      if (search) {
        const q = String(search).toLowerCase();
        list = list.filter(o => 
          o.orderNo.toLowerCase().includes(q) ||
          o.customer.toLowerCase().includes(q) ||
          (o.customerOrg && o.customerOrg.toLowerCase().includes(q)) ||
          o.province.toLowerCase().includes(q) ||
          o.destination.toLowerCase().includes(q)
        );
      }

      // Sort recent first
      list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      res.json({ orders: list, total: list.length });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/imd/orders", (req: Request, res: Response) => {
    try {
      const body = req.body;
      if (!body.orderNo || !body.customer || !body.province) {
        return res.status(400).json({ error: "Захиалгын дугаар, харилцагч, аймаг заавал шаардлагатай" });
      }

      const orderId = "ORD-" + Date.now().toString().slice(-6);
      const shareToken = crypto.randomBytes(32).toString("hex");

      const newOrder: IMDOrder = {
        id: orderId,
        orderNo: body.orderNo.trim(),
        customer: body.customer.trim(),
        customerOrg: body.customerOrg ? body.customerOrg.trim() : undefined,
        receivedDate: body.receivedDate || new Date().toISOString().split("T")[0],
        deliveryDate: body.deliveryDate || new Date().toISOString().split("T")[0],
        province: body.province.trim(),
        destination: body.destination ? body.destination.trim() : body.province.trim(),
        quantity: Number(body.quantity) || 0,
        unitPrice: body.unitPrice ? Number(body.unitPrice) : undefined,
        note: body.note ? body.note.trim() : undefined,
        status: body.status || "Шинэ",
        shareToken,
        primaryDriverId: body.primaryDriverId,
        primaryDriverName: body.primaryDriverName,
        vehiclePlate: body.vehiclePlate,
        substituteDriverId: body.substituteDriverId,
        substituteDriverName: body.substituteDriverName,
        roundTripKm: body.roundTripKm ? Number(body.roundTripKm) : undefined,
        mealCount: body.mealCount ? Number(body.mealCount) : undefined,
        mealAllowance: body.mealAllowance ? Number(body.mealAllowance) : undefined,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      // If driver and vehicle are provided, automatically generate the Assignment
      if (body.vehiclePlate && (body.primaryDriverId || body.primaryDriverName)) {
        const asnId = "ASN-" + Date.now().toString().slice(-6);
        const token = "tok_drv_" + crypto.randomBytes(6).toString("hex");
        const cleanPlate = body.vehiclePlate.trim().toUpperCase();
        const vehicleCapacity = getVehicleBoxCapacity(cleanPlate, db.drivers);

        const driverCount = (body.substituteDriverId || body.substituteDriverName) ? 2 : 1;
        const mealCount = Number(body.mealCount) || 3;
        const mealPerPerson = mealCount * 25000;
        const mealAllowance = Number(body.mealAllowance) || (mealPerPerson * driverCount);

        const newAsn: IMDAssignment = {
          id: asnId,
          orderId: newOrder.id,
          orderNo: newOrder.orderNo,
          province: newOrder.province,
          destination: newOrder.destination,
          vehicleId: cleanPlate.replace(/\s+/g, ""),
          vehiclePlate: cleanPlate,
          primaryDriverId: body.primaryDriverId || "141",
          primaryDriverName: body.primaryDriverName || "Ми.Анхбаяр",
          substituteDriverId: body.substituteDriverId || undefined,
          substituteDriverName: body.substituteDriverName || undefined,
          departureDate: newOrder.deliveryDate || newOrder.receivedDate,
          quantity: newOrder.quantity || vehicleCapacity,
          vehicleCapacity,
          note: newOrder.note,
          status: "Тээвэрт гарсан",
          token,
          roundTripKm: Number(body.roundTripKm) || undefined,
          mealCount,
          mealAllowance,
          mealPerPerson,
          driverCount,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        newOrder.status = "Тээвэрт гарсан";
        newOrder.assignmentId = asnId;
        if (!db.assignments) db.assignments = [];
        db.assignments.unshift(newAsn);

        // Also ensure trip is logged for the driver's waybill view
        const tripDate = newAsn.departureDate;
        if (!db.trips.some((t: any) => t.vehicleNumber === newAsn.vehiclePlate && t.date === tripDate)) {
          db.trips.push({
            id: "trip_" + asnId.toLowerCase(),
            timestamp: new Date().toISOString(),
            date: tripDate,
            driverId: newAsn.primaryDriverId,
            driverName: newAsn.primaryDriverName,
            vehicleNumber: newAsn.vehiclePlate,
            salesRep: newAsn.substituteDriverName ? `Сэлгээ: ${newAsn.substituteDriverName}` : "Ганцаараа",
            zone: `${newAsn.province} - ${newAsn.destination} (${newAsn.roundTripKm || 0} км)`,
            startOdo: 100000,
            status: "🟡 ЭХЭЛСЭН",
            phase: "started",
            routeNote: `Томилолт: ${newAsn.orderNo}, ${newAsn.quantity} хайрцаг. Хоолны мөнгө: ${mealAllowance.toLocaleString()}₮ (${driverCount} жолооч x ${mealCount} хоол x 25,000₮)`
          });
        }
      }

      if (!db.orders) db.orders = [];
      db.orders.unshift(newOrder);
      logAudit(req.body.user || "Менежер", "ORDER_CREATED", `Шинэ захиалга бүртгэв: ${newOrder.orderNo} (${newOrder.province})`, null, newOrder);
      saveDB(db);

      res.status(201).json({ status: "success", order: newOrder });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put("/api/imd/orders/:id", (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const index = (db.orders || []).findIndex((o: IMDOrder) => o.id === id);
      if (index === -1) {
        return res.status(404).json({ error: "Захиалга олдсонгүй" });
      }

      const existing = db.orders[index];
      const updated: IMDOrder = {
        ...existing,
        ...req.body,
        id: existing.id,
        updatedAt: new Date().toISOString()
      };

      db.orders[index] = updated;
      logAudit(req.body.user || "Менежер", "ORDER_UPDATED", `Захиалга шинэчлэв: ${updated.orderNo}`, existing, updated);
      saveDB(db);

      res.json({ status: "success", order: updated });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/imd/orders/:id", (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const existing = (db.orders || []).find((o: IMDOrder) => o.id === id);
      if (!existing) {
        return res.status(404).json({ error: "Захиалга олдсонгүй" });
      }

      db.orders = (db.orders || []).filter((o: IMDOrder) => o.id !== id);
      // Unlink any associated assignment
      if (existing.assignmentId) {
        db.assignments = (db.assignments || []).filter((a: IMDAssignment) => a.id !== existing.assignmentId);
      }

      // Synchronize deletion into SQLite
      try {
        const sqlite = getDatabase();
        sqlite.prepare("DELETE FROM imd_orders WHERE id = ? OR order_no = ?").run(id, existing.orderNo);
        if (existing.assignmentId) {
          sqlite.prepare("DELETE FROM imd_assignments WHERE id = ?").run(existing.assignmentId);
        }
      } catch (sqlErr) {
        console.warn("SQLite order delete warning:", sqlErr);
      }

      logAudit("Менежер", "ORDER_DELETED", `Захиалга устгав: ${existing.orderNo}`, existing, null);
      saveDB(db);

      res.json({ status: "success", message: "Захиалга амжилттай устгагдлаа" });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 2. ASSIGNMENTS (ТОМИЛОЛТ) CRUD WITH CONFLICT CHECKS & WAYBILL SYNC
  app.get("/api/imd/assignments", (req: Request, res: Response) => {
    try {
      const { date, driverId, vehiclePlate, status, province } = req.query;
      let list: IMDAssignment[] = [...(db.assignments || [])];

      if (date) list = list.filter(a => a.departureDate === date);
      if (driverId) {
        const dStr = String(driverId).trim();
        const drv = (db.drivers || []).find((d: any) => d.id === dStr || d.code === dStr);
        const altCode = drv?.code;
        const altId = drv?.id;
        const drvPlate = drv?.vehicle ? drv.vehicle.replace(/\s+/g, "").toUpperCase() : "";
        list = list.filter(a => 
          a.primaryDriverId === dStr || 
          a.substituteDriverId === dStr ||
          (altCode && (a.primaryDriverId === altCode || a.substituteDriverId === altCode)) ||
          (altId && (a.primaryDriverId === altId || a.substituteDriverId === altId)) ||
          (drvPlate && a.vehiclePlate.replace(/\s+/g, "").toUpperCase() === drvPlate)
        );
      }
      if (vehiclePlate) {
        const cleanP = String(vehiclePlate).replace(/\s+/g, "").toUpperCase();
        list = list.filter(a => a.vehiclePlate.replace(/\s+/g, "").toUpperCase() === cleanP);
      }
      if (status && status !== "all") list = list.filter(a => a.status === status);
      if (province && province !== "all") list = list.filter(a => a.province === province);

      list.sort((a, b) => b.departureDate.localeCompare(a.departureDate));
      res.json({ assignments: list, total: list.length });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/imd/assignments", async (req: Request, res: Response) => {
    try {
      const body = req.body;
      const { 
        orderId, 
        province, 
        destination, 
        vehiclePlate, 
        primaryDriverId, 
        substituteDriverId, 
        departureDate, 
        quantity, 
        note, 
        force 
      } = body;

      if (!vehiclePlate || !primaryDriverId || !departureDate) {
        return res.status(400).json({ error: "Машин, үндсэн жолооч, гарах огноо заавал шаардлагатай" });
      }

      // Check Order Existence or Auto-Create for Direct/Historical Daily Assignment
      let order = orderId ? (db.orders || []).find((o: IMDOrder) => o.id === orderId) : null;
      if (!order) {
        const orderNoGenerated = `ORD-IMD-${departureDate.replace(/-/g, "").slice(2)}-${Math.floor(100 + Math.random() * 900)}`;
        order = {
          id: "ord_direct_" + Date.now(),
          orderNo: orderNoGenerated,
          customer: body.customer || "Өдөр тутмын томилолт",
          province: province || "Хөвсгөл",
          destination: destination || "Мөрөн",
          quantity: Number(quantity) || 1000,
          unit: "хайрцаг",
          orderDate: departureDate,
          deliveryDate: departureDate,
          status: "Томилолт хуваарилагдсан",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        if (!db.orders) db.orders = [];
        db.orders.unshift(order);
      }

      // Check Duplicate Order Assignment (Section 38)
      if (orderId) {
        const existingOrderAsn = (db.assignments || []).find((a: IMDAssignment) => a.orderId === orderId);
        if (existingOrderAsn && !force) {
          return res.status(409).json({
            conflictType: "order_duplicate",
            message: `⚠️ Энэ захиалга (${order.orderNo}) дээр аль хэдийн томилолт (${existingOrderAsn.id}) үүссэн байна. Та давхардуулахдаа итгэлтэй байна уу?`
          });
        }
      }

      // Conflict Check: Driver Conflict on Same Day (Section 39)
      const conflictingPrimaryDriverAsn = (db.assignments || []).find(
        (a: IMDAssignment) => a.departureDate === departureDate && (a.primaryDriverId === primaryDriverId || a.substituteDriverId === primaryDriverId)
      );
      if (conflictingPrimaryDriverAsn && !force) {
        return res.status(409).json({
          conflictType: "driver_conflict",
          message: `⚠️ Үндсэн жолооч ${conflictingPrimaryDriverAsn.primaryDriverName} ${departureDate} өдөр өөр томилолттой (${conflictingPrimaryDriverAsn.orderNo}, ${conflictingPrimaryDriverAsn.province}) байна.`
        });
      }

      if (substituteDriverId) {
        const conflictingSubDriverAsn = (db.assignments || []).find(
          (a: IMDAssignment) => a.departureDate === departureDate && (a.primaryDriverId === substituteDriverId || a.substituteDriverId === substituteDriverId)
        );
        if (conflictingSubDriverAsn && !force) {
          return res.status(409).json({
            conflictType: "sub_driver_conflict",
            message: `⚠️ Сэлгээ жолооч ${conflictingSubDriverAsn.substituteDriverName || substituteDriverId} ${departureDate} өдөр өөр томилолттой байна.`
          });
        }
      }

      // Conflict Check: Vehicle Conflict on Same Day (Section 39)
      const cleanPlate = vehiclePlate.replace(/\s+/g, "").toUpperCase();
      const conflictingVehicleAsn = (db.assignments || []).find(
        (a: IMDAssignment) => a.departureDate === departureDate && a.vehiclePlate.replace(/\s+/g, "").toUpperCase() === cleanPlate
      );
      if (conflictingVehicleAsn && !force) {
        return res.status(409).json({
          conflictType: "vehicle_conflict",
          message: `⚠️ Машин ${vehiclePlate} ${departureDate} өдөр өөр томилолттой (${conflictingVehicleAsn.orderNo}, ${conflictingVehicleAsn.province}) байна.`
        });
      }

      // Resolve driver names from Master
      const primaryDriver = (db.drivers || []).find((d: any) => d.id === primaryDriverId || d.code === primaryDriverId);
      const subDriver = substituteDriverId ? (db.drivers || []).find((d: any) => d.id === substituteDriverId || d.code === substituteDriverId) : null;

      const primaryDriverName = primaryDriver?.name || body.primaryDriverName || primaryDriverId;
      const substituteDriverName = subDriver ? subDriver.name : (body.substituteDriverName || undefined);

      const asnId = "ASN-" + Date.now().toString().slice(-6);
      const token = "tok_drv_" + crypto.randomBytes(6).toString("hex");

      // Resolve KM from official route table if not explicitly provided
      let resolvedKm = body.actualKm ? Number(body.actualKm) : 0;
      if (!resolvedKm) {
        const targetDest = (destination || province || order.destination || order.province || "").toLowerCase().trim();
        const matchedRoute = (db.routes || DEFAULT_IMD_ROUTES).find((r: IMDRoute) => 
          targetDest.includes(r.destination.toLowerCase()) || 
          targetDest.includes(r.province.toLowerCase()) ||
          r.destination.toLowerCase().includes(targetDest) ||
          r.province.toLowerCase().includes(targetDest)
        );
        if (matchedRoute) {
          resolvedKm = matchedRoute.roundTripKm;
        }
      }

      const totalApprovedKm = resolvedKm || Number(body.actualKm) || 1560;

      // Resolve continuous odometer
      const continuousStartOdo = body.startOdo ? Number(body.startOdo) : getVehicleContinuousOdo(cleanPlate, departureDate, db);
      const calculatedEndOdo = body.endOdo ? Number(body.endOdo) : (continuousStartOdo + totalApprovedKm);

      const vehicleCapacity = getVehicleBoxCapacity(cleanPlate, db.drivers);
      const newAssignment: IMDAssignment = {
        id: asnId,
        orderId,
        orderNo: order.orderNo,
        province: province || order.province,
        destination: destination || order.destination,
        vehicleId: cleanPlate,
        vehiclePlate: vehiclePlate.trim().toUpperCase(),
        primaryDriverId: primaryDriver?.id || primaryDriverId,
        primaryDriverName,
        primaryDriverPhone: primaryDriver?.phone,
        substituteDriverId: subDriver?.id || substituteDriverId,
        substituteDriverName,
        substituteDriverPhone: subDriver?.phone,
        departureDate,
        returnDate: body.returnDate,
        quantity: Number(quantity) || order.quantity || vehicleCapacity,
        vehicleCapacity,
        note: note ? note.trim() : undefined,
        status: body.status || "Тээвэрт гарсан",
        token,
        isRegistered: true,
        isMock: false,
        startOdo: continuousStartOdo,
        endOdo: calculatedEndOdo,
        actualKm: totalApprovedKm,
        fuelLiters: body.fuelLiters ? Number(body.fuelLiters) : undefined,
        fuelStation: body.fuelStation,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      if (!db.assignments) db.assignments = [];
      db.assignments.unshift(newAssignment);

      // Update Order Status and link assignment ID
      order.status = "Томилолт хуваарилагдсан";
      order.assignmentId = asnId;
      order.updatedAt = new Date().toISOString();

      // Automatically Link to TripLog / Waybill using IMD Approved KM Principle (Rule 6)
      const tripZone = newAssignment.province ? `${newAssignment.province} - ${newAssignment.destination}` : newAssignment.destination;
      const tripNoteOut = `Томилолт: ${order.orderNo} ${tripZone} (${newAssignment.quantity} хайрцаг)${substituteDriverName ? `. Сэлгээ: ${substituteDriverName}` : ""}`;
      const tripNoteReturn = `Томилолт (Буцах) ${order.orderNo}: ${tripZone} хаалт. Үндсэн: ${primaryDriverName}`;

      const hasReturnDate = newAssignment.returnDate && newAssignment.returnDate !== departureDate;
      const departureKm = hasReturnDate && totalApprovedKm > 0 ? Math.round(totalApprovedKm / 2) : totalApprovedKm;
      const returnKm = hasReturnDate && totalApprovedKm > 0 ? (totalApprovedKm - departureKm) : 0;

      // 1. Departure Day Trip / Waybill
      let existingTrip = (db.trips || []).find(
        (t: any) => t.date === departureDate && t.vehicleNumber.replace(/\s+/g, "").toUpperCase() === cleanPlate
      );

      const baseStartOdo = newAssignment.startOdo || continuousStartOdo;
      const departureEndOdo = baseStartOdo + departureKm;

      if (existingTrip) {
        existingTrip.driverId = primaryDriver?.id || primaryDriverId;
        existingTrip.driverName = primaryDriverName;
        existingTrip.zone = tripZone;
        existingTrip.salesRep = substituteDriverName ? `Сэлгээ: ${substituteDriverName}` : (primaryDriver?.salesRep || "IMD Томилолт");
        existingTrip.routeNote = tripNoteOut;
        existingTrip.startOdo = baseStartOdo;
        existingTrip.endOdo = departureEndOdo;
        existingTrip.totalKm = departureKm;
        existingTrip.status = "✅ ХЭВИЙН";
        existingTrip.phase = "complete";
      } else {
        const newTrip = {
          id: "trip_asn_" + asnId + "_dep",
          timestamp: `${departureDate} 08:30:00`,
          date: departureDate,
          driverId: primaryDriver?.id || primaryDriverId,
          driverName: primaryDriverName,
          vehicleNumber: vehiclePlate.trim().toUpperCase(),
          salesRep: substituteDriverName ? `Сэлгээ: ${substituteDriverName}` : (primaryDriver?.salesRep || "IMD Томилолт"),
          zone: tripZone,
          startOdo: baseStartOdo,
          endOdo: departureEndOdo,
          totalKm: departureKm,
          fuelLiters: newAssignment.fuelLiters,
          fuelStation: newAssignment.fuelStation,
          status: "✅ ХЭВИЙН",
          phase: "complete",
          routeNote: tripNoteOut
        };
        if (!db.trips) db.trips = [];
        db.trips.unshift(newTrip);
      }

      // 2. Return Day Trip / Waybill (If returnDate is specified and different from departureDate)
      if (hasReturnDate && returnKm > 0) {
        const returnDateStr = newAssignment.returnDate!;
        const existingReturnTrip = (db.trips || []).find(
          (t: any) => t.date === returnDateStr && t.vehicleNumber.replace(/\s+/g, "").toUpperCase() === cleanPlate
        );

        const returnStartOdo = departureEndOdo || (baseStartOdo + departureKm);
        const returnEndOdo = returnStartOdo + returnKm;

        if (existingReturnTrip) {
          existingReturnTrip.driverId = primaryDriver?.id || primaryDriverId;
          existingReturnTrip.driverName = primaryDriverName;
          existingReturnTrip.zone = tripZone + " (Буцах)";
          existingReturnTrip.routeNote = tripNoteReturn;
          existingReturnTrip.startOdo = returnStartOdo;
          existingReturnTrip.endOdo = returnEndOdo;
          existingReturnTrip.totalKm = returnKm;
          existingReturnTrip.status = "✅ ХЭВИЙН";
          existingReturnTrip.phase = "complete";
        } else {
          db.trips.unshift({
            id: "trip_asn_" + asnId + "_ret",
            timestamp: new Date().toISOString(),
            date: returnDateStr,
            driverId: primaryDriver?.id || primaryDriverId,
            driverName: primaryDriverName,
            vehicleNumber: vehiclePlate.trim().toUpperCase(),
            salesRep: substituteDriverName ? `Сэлгээ: ${substituteDriverName}` : "Үндсэн томилолт",
            zone: tripZone + " (Буцах)",
            startOdo: returnStartOdo,
            endOdo: returnEndOdo,
            totalKm: returnKm,
            status: "✅ ХЭВИЙН",
            phase: "complete",
            routeNote: tripNoteReturn
          });
        }
      }

      // Auto-generate official letter and PDF file immediately for new assignment
      try {
        await ensureLetterRecordAndFile(db, saveDB, newAssignment.id);
      } catch (letterErr) {
        console.error("Auto letter generation on assignment creation:", letterErr);
      }

      logAudit(req.body.user || "Менежер", "ASSIGNMENT_CREATED", `Томилолт хуваарилав: ${order.orderNo} -> ${vehiclePlate} (${primaryDriverName})`, null, newAssignment);
      saveDB(db);

      res.status(201).json({ status: "success", assignment: newAssignment });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put("/api/imd/assignments/:id", (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const index = (db.assignments || []).findIndex((a: IMDAssignment) => a.id === id);
      if (index === -1) {
        return res.status(404).json({ error: "Томилолт олдсонгүй" });
      }

      const existing = db.assignments[index];
      const updated: IMDAssignment = {
        ...existing,
        ...req.body,
        id: existing.id,
        updatedAt: new Date().toISOString()
      };

      // Auto-resolve route distance if not explicitly passed
      if (!updated.actualKm) {
        const targetDest = (updated.destination || updated.province || "").toLowerCase().trim();
        const matchedRoute = (db.routes || DEFAULT_IMD_ROUTES).find((r: IMDRoute) => 
          targetDest.includes(r.destination.toLowerCase()) || 
          targetDest.includes(r.province.toLowerCase()) ||
          r.destination.toLowerCase().includes(targetDest) ||
          r.province.toLowerCase().includes(targetDest)
        );
        if (matchedRoute) {
          updated.actualKm = matchedRoute.roundTripKm;
        }
      }

      // Calculate continuous odometers if not given
      const cleanPlate = updated.vehiclePlate.replace(/\s+/g, "").toUpperCase();
      if (!updated.startOdo) {
        updated.startOdo = getVehicleContinuousOdo(cleanPlate, updated.departureDate, db);
      }
      if (!updated.endOdo && updated.actualKm) {
        updated.endOdo = updated.startOdo + updated.actualKm;
      } else if (updated.endOdo && updated.startOdo) {
        updated.actualKm = Number(updated.endOdo) - Number(updated.startOdo);
      }

      db.assignments[index] = updated;

      // Also update linked order status
      const order = (db.orders || []).find((o: IMDOrder) => o.id === updated.orderId);
      if (order) {
        if (updated.status === "Дууссан") order.status = "Дууссан";
        else if (updated.status === "Тээвэрт гарсан") order.status = "Тээвэрт гарсан";
        else if (updated.status === "Цуцлагдсан") order.status = "Цуцлагдсан";
      }

      // Sync with trip log (автоматаар замын хуудсанд чиглэл болон одометр бичигдэнэ)
      const missionRoute = updated.province ? `${updated.province} - ${updated.destination}` : updated.destination;
      const tripNote = `Томилолт: ${updated.orderNo || ''} ${missionRoute} (${updated.quantity || 1000} хайрцаг)${updated.substituteDriverName ? `. Сэлгээ: ${updated.substituteDriverName}` : ''}`;
      
      // 4-Томилолтыг менежер цуцалхад замын хуудсаас арилгаж тооцоололоос хасна
      let trip: any = null;
      if (updated.status === "Цуцлагдсан") {
        db.trips = (db.trips || []).filter((t: any) => {
          const matchVeh = t.vehicleNumber && t.vehicleNumber.trim().toUpperCase().replace(/\s+/g, "") === cleanPlate;
          const matchDate = t.date === updated.departureDate || t.date === updated.returnDate;
          const matchNote = (t.routeNote && updated.orderNo && t.routeNote.includes(updated.orderNo)) || (t.id && t.id.includes(updated.id));
          return !(matchVeh && (matchNote || (matchDate && t.zone && (t.zone.includes(updated.destination) || (updated.province && t.zone.includes(updated.province))))));
        });
      } else {
        trip = (db.trips || []).find(
          (t: any) => t.date === updated.departureDate && t.vehicleNumber.replace(/\s+/g, "").toUpperCase() === cleanPlate
        );
        if (trip) {
          trip.zone = missionRoute;
          trip.routeNote = tripNote;
          if (updated.startOdo !== undefined) trip.startOdo = updated.startOdo;
          if (updated.endOdo !== undefined) trip.endOdo = updated.endOdo;
          if (updated.actualKm !== undefined) trip.totalKm = updated.actualKm;
          if (updated.fuelLiters !== undefined) trip.fuelLiters = updated.fuelLiters;
          if (updated.fuelStation) trip.fuelStation = updated.fuelStation;
          if (updated.substituteDriverName) trip.salesRep = `Сэлгээ: ${updated.substituteDriverName}`;
          trip.status = "✅ ХЭВИЙН";
          trip.phase = "complete";
        } else if (updated.departureDate) {
          trip = {
            id: `trip_asn_${updated.id}_${Date.now()}`,
            timestamp: `${updated.departureDate} 08:30:00`,
            date: updated.departureDate,
            driverId: updated.primaryDriverId,
            driverName: updated.primaryDriverName,
            vehicleNumber: updated.vehiclePlate,
            salesRep: updated.substituteDriverName ? `Сэлгээ: ${updated.substituteDriverName}` : "IMD Томилолт",
            zone: missionRoute,
            startOdo: updated.startOdo,
            endOdo: updated.endOdo,
            totalKm: updated.actualKm || 1560,
            fuelLiters: updated.fuelLiters,
            fuelStation: updated.fuelStation,
            status: "✅ ХЭВИЙН",
            phase: "complete",
            routeNote: tripNote
          };
          db.trips = db.trips || [];
          db.trips.push(trip);
        }
      }

      logAudit(req.body.user || "Менежер", "ASSIGNMENT_UPDATED", `Томилолт шинэчлэв: ${updated.orderNo} (${updated.status})`, existing, updated);
      saveDB(db);

      res.json({ status: "success", assignment: updated, trip });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Томилолт баталгаажуулах үед замын хуудас дээр чиглэл болон одометр автоматаар бичигдэх тусгай API
  app.post("/api/imd/assignments/:id/confirm", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const asn = (db.assignments || []).find((a: any) => a.id === id);
      if (!asn) return res.status(404).json({ error: "Томилолт олдсонгүй" });

      const cleanPlate = (asn.vehiclePlate || "").replace(/\s+/g, "").toUpperCase();
      const actualKm = Number(req.body.actualKm) || asn.actualKm || asn.roundTripKm || 1560;
      const startOdo = req.body.startOdo ? Number(req.body.startOdo) : (asn.startOdo || getVehicleContinuousOdo(cleanPlate, asn.departureDate, db));
      const endOdo = req.body.endOdo ? Number(req.body.endOdo) : (startOdo + actualKm);

      asn.startOdo = startOdo;
      asn.endOdo = endOdo;
      asn.actualKm = actualKm;
      asn.status = "Тээвэрт гарсан";
      asn.updatedAt = new Date().toISOString();

      const missionRoute = asn.province ? `${asn.province} - ${asn.destination}` : asn.destination;
      const tripNote = `Томилолт: ${asn.orderNo || ''} ${missionRoute} (${asn.quantity || 1000} хайрцаг)${asn.substituteDriverName ? `, Сэлгээ: ${asn.substituteDriverName}` : ''}`;

      let trip = (db.trips || []).find((t: any) =>
        t.date === asn.departureDate &&
        t.vehicleNumber?.replace(/\s+/g, "").toUpperCase() === cleanPlate
      );

      if (trip) {
        trip.zone = missionRoute;
        trip.startOdo = startOdo;
        trip.endOdo = endOdo;
        trip.totalKm = actualKm;
        trip.routeNote = tripNote;
        trip.status = "✅ ХЭВИЙН";
        trip.phase = "complete";
      } else {
        trip = {
          id: `trip_asn_${asn.id}_${Date.now()}`,
          timestamp: `${asn.departureDate} 08:30:00`,
          date: asn.departureDate,
          driverId: asn.primaryDriverId,
          driverName: asn.primaryDriverName,
          vehicleNumber: asn.vehiclePlate,
          salesRep: asn.substituteDriverName ? `Сэлгээ: ${asn.substituteDriverName}` : "IMD Томилолт",
          zone: missionRoute,
          startOdo,
          endOdo,
          totalKm: actualKm,
          status: "✅ ХЭВИЙН",
          phase: "complete",
          routeNote: tripNote
        };
        if (!db.trips) db.trips = [];
        db.trips.unshift(trip);
      }

      // Sync linked order status
      const order = (db.orders || []).find((o: any) => o.id === asn.orderId);
      if (order) {
        order.status = "Тээвэрт гарсан";
        order.updatedAt = new Date().toISOString();
      }

      // Auto-generate or ensure official letter and PDF file on assignment confirmation
      try {
        await ensureLetterRecordAndFile(db, saveDB, asn.id);
      } catch (letterErr) {
        console.error("Auto letter generation on assignment confirmation error:", letterErr);
      }

      logAudit(req.body.user || "Менежер", "ASSIGNMENT_CONFIRMED", `Томилолт баталгаажуулав: ${asn.orderNo} (${missionRoute}, ${actualKm} км, ODO: ${startOdo} -> ${endOdo})`, null, asn);
      saveDB(db);

      res.json({
        status: "success",
        message: `Томилолт амжилттай баталгаажлаа. Замын хуудсанд ${asn.departureDate}-ны өдөр чиглэл (${missionRoute}) болон одометр (${startOdo.toLocaleString()} -> ${endOdo.toLocaleString()} км) бичигдэж, албан бичиг бэлэн боллоо.`,
        assignment: asn,
        trip
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/imd/assignments/:id", (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const existing = (db.assignments || []).find((a: IMDAssignment) => a.id === id);
      if (!existing) {
        return res.status(404).json({ error: "Томилолт олдсонгүй" });
      }

      db.assignments = (db.assignments || []).filter((a: IMDAssignment) => a.id !== id);

      // Remove from SQLite database if present
      try {
        const sqlite = getDatabase();
        sqlite.prepare("DELETE FROM imd_assignments WHERE id = ? OR order_id = ?").run(id, existing.orderId || id);
      } catch (sqlErr) {
        console.warn("SQLite delete assignment warning:", sqlErr);
      }

      // Clean route notes on trips without breaking ODO chain
      const cleanPlate = (existing.vehiclePlate || "").trim().toUpperCase().replace(/\s+/g, "");
      db.trips = (db.trips || []).map((t: any) => {
        const matchVeh = t.vehicleNumber && t.vehicleNumber.trim().toUpperCase().replace(/\s+/g, "") === cleanPlate;
        const matchDate = t.date === existing.departureDate || t.date === existing.returnDate;
        const matchNote = (t.routeNote && existing.orderNo && t.routeNote.includes(existing.orderNo)) || (t.id && t.id.includes(existing.id));
        if (matchVeh && (matchNote || matchDate)) {
          if (t.routeNote && (t.routeNote.includes("томилолт") || t.routeNote.includes(existing.orderNo || ""))) {
            return {
              ...t,
              routeNote: t.totalKm > 0 ? "Түгээлт тээвэрлэлт" : "Хуваарьт зогсолт / 0 км"
            };
          }
        }
        return t;
      });

      // Remove related mock orders or revert real orders
      const order = (db.orders || []).find((o: IMDOrder) => o.id === existing.orderId);
      if (order) {
        const isMockOrder = existing.isMock || (existing.orderNo && existing.orderNo.startsWith("ORD-IMD-260915-"));
        if (isMockOrder) {
          db.orders = (db.orders || []).filter((o: IMDOrder) => o.id !== existing.orderId);
          try {
            const sqlite = getDatabase();
            sqlite.prepare("DELETE FROM imd_orders WHERE id = ? OR order_no = ?").run(existing.orderId, existing.orderNo);
          } catch (e) {}
        } else {
          order.status = "Хүлээгдэж буй";
          delete order.assignmentId;
        }
      }

      // Synchronize assignment deletion into SQLite
      try {
        const sqlite = getDatabase();
        sqlite.prepare("DELETE FROM imd_assignments WHERE id = ?").run(id);
      } catch (e) {}

      logAudit("Менежер", "ASSIGNMENT_DELETED", `Томилолт устгав: ${existing.orderNo}`, existing, null);
      saveDB(db);

      res.json({ status: "success", message: "Томилолт амжилттай устгагдаж, замын хуудасны тооцооноос хасагдлаа" });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 3. ROUTES & PROVINCES MASTER
  app.get("/api/imd/routes", (req: Request, res: Response) => {
    try {
      const routes = db.routes || DEFAULT_IMD_ROUTES;
      // Calculate dynamic trip count & total boxes from assignments
      const calculated = routes.map((r: IMDRoute) => {
        const asns = (db.assignments || []).filter((a: IMDAssignment) => a.province === r.province);
        const dynamicTripCount = asns.length > 0 ? asns.length : (r.tripCount || 0);
        const dynamicBoxes = asns.length > 0 ? asns.reduce((sum, a) => sum + (Number(a.quantity) || 0), 0) : (r.totalBoxes || 0);
        return {
          ...r,
          tripCount: dynamicTripCount,
          totalBoxes: dynamicBoxes
        };
      });
      res.json({ routes: calculated });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/imd/routes", (req: Request, res: Response) => {
    try {
      const body = req.body;
      if (!body.province) {
        return res.status(400).json({ error: "Аймгийн нэр шаардлагатай" });
      }

      const existingIdx = (db.routes || []).findIndex((r: IMDRoute) => r.province === body.province);
      if (existingIdx >= 0) {
        db.routes[existingIdx] = { ...db.routes[existingIdx], ...body };
      } else {
        const newRoute: IMDRoute = {
          id: "RT-" + Date.now().toString().slice(-4),
          province: body.province,
          destination: body.destination || body.province,
          roundTripKm: Number(body.roundTripKm) || 0,
          roadPost: body.roadPost || "",
          mealFrequency: body.mealFrequency || "Өдөрт 2 удаа",
          tripCount: 0,
          totalBoxes: 0
        };
        db.routes.push(newRoute);
      }

      saveDB(db);
      res.json({ status: "success", routes: db.routes });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 4. TODAY'S DASHBOARD & KPIS (Section 7, 20)
  app.get("/api/imd/dashboard", (req: Request, res: Response) => {
    try {
      const todayDate = (req.query.date as string) || new Date().toISOString().split("T")[0];

      const orders: IMDOrder[] = db.orders || [];
      const assignments: IMDAssignment[] = db.assignments || [];

      // Today's orders
      const todayOrders = orders.filter(o => o.receivedDate === todayDate || o.deliveryDate === todayDate);
      const todayAssignments = assignments.filter(a => a.departureDate === todayDate);

      const totalBoxes = todayAssignments.reduce((sum, a) => sum + (Number(a.quantity) || 0), 0);
      const unassignedOrders = orders.filter(o => o.status === "Шинэ" || o.status === "Хүлээгдэж буй").length;

      const dispatchedVehicles = new Set(todayAssignments.map(a => a.vehiclePlate.toUpperCase().replace(/\s+/g, ""))).size;
      const dispatchedDrivers = new Set(todayAssignments.map(a => a.primaryDriverId)).size;
      const substituteDriversCount = todayAssignments.filter(a => !!a.substituteDriverId).length;

      const assignedProvinces = new Set(todayAssignments.map(a => a.province));
      const pendingProvinces = (db.routes || DEFAULT_IMD_ROUTES).filter(
        (r: IMDRoute) => !assignedProvinces.has(r.province)
      ).length;

      const todayDispatches = todayAssignments.map(a => ({
        id: a.id,
        orderNo: a.orderNo,
        province: a.province,
        destination: a.destination,
        vehiclePlate: a.vehiclePlate,
        primaryDriverName: a.primaryDriverName,
        substituteDriverName: a.substituteDriverName,
        quantity: a.quantity,
        departureDate: a.departureDate,
        status: a.status,
        token: a.token,
        actualKm: a.actualKm,
        startOdo: a.startOdo,
        endOdo: a.endOdo,
        fuelLiters: a.fuelLiters
      }));

      const recentOrders = [...orders]
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, 10);

      // Calculate Traveled Provinces Summary and Total KM
      const routeBase: IMDRoute[] = db.routes || DEFAULT_IMD_ROUTES;
      const trips = db.trips || [];

      // Map to hold aggregated province stats
      const provinceStatsMap = new Map<string, {
        province: string;
        destination: string;
        roundTripKm: number;
        tripCount: number;
        totalKm: number;
        totalBoxes: number;
        mealCount?: number;
        drivers: Set<string>;
        vehicles: Set<string>;
        lastDispatchedDate?: string;
        hasActiveTrip?: boolean;
      }>();

      // Seed with standard 24 province route definitions (strict zero initial values, no fake/dummy counts)
      routeBase.forEach((r: IMDRoute) => {
        const destKey = r.destination || r.province;
        provinceStatsMap.set(destKey, {
          province: r.province,
          destination: r.destination || r.province,
          roundTripKm: Number(r.roundTripKm) || 0,
          tripCount: 0,
          totalKm: 0,
          totalBoxes: 0,
          mealCount: r.mealCount || 3,
          drivers: new Set<string>(),
          vehicles: new Set<string>(),
          lastDispatchedDate: undefined,
          hasActiveTrip: false
        });
      });

      // Augment with actual IMD assignments
      assignments.forEach((asn: IMDAssignment) => {
        const destKey = asn.destination || asn.province || "Тодорхойгүй";
        let stat = provinceStatsMap.get(destKey);
        if (!stat) {
          const matchedKey = Array.from(provinceStatsMap.keys()).find(k => k.includes(asn.province) || (provinceStatsMap.get(k)?.province === asn.province));
          if (matchedKey) stat = provinceStatsMap.get(matchedKey);
        }

        if (!stat) {
          stat = {
            province: asn.province || "Бусад",
            destination: asn.destination || asn.province || "Чиглэл",
            roundTripKm: Number(asn.roundTripKm) || 0,
            tripCount: 0,
            totalKm: 0,
            totalBoxes: 0,
            mealCount: asn.mealCount || 3,
            drivers: new Set<string>(),
            vehicles: new Set<string>(),
            lastDispatchedDate: undefined,
            hasActiveTrip: false
          };
          provinceStatsMap.set(destKey, stat);
        }

        stat.tripCount += 1;
        const addedKm = Number(asn.actualKm) || Number(asn.roundTripKm) || stat.roundTripKm || 0;
        stat.totalKm += addedKm;
        stat.totalBoxes += Number(asn.quantity) || 0;
        if (asn.primaryDriverName) stat.drivers.add(asn.primaryDriverName);
        if (asn.substituteDriverName) stat.drivers.add(asn.substituteDriverName);
        if (asn.vehiclePlate) stat.vehicles.add(asn.vehiclePlate);
        if (asn.departureDate && (!stat.lastDispatchedDate || asn.departureDate > stat.lastDispatchedDate)) {
          stat.lastDispatchedDate = asn.departureDate;
        }
        if (asn.status === "Тээвэрт гарсан") {
          stat.hasActiveTrip = true;
        }
      });

      // Augment with driver trips (waybills that went to provinces)
      trips.forEach((t: any) => {
        if (t.zone && !t.zone.includes("УБ") && !t.zone.includes("Улаанбаатар")) {
          for (const stat of provinceStatsMap.values()) {
            if (t.zone.includes(stat.province) || t.zone.includes(stat.destination)) {
              if (t.driverName) stat.drivers.add(t.driverName);
              if (t.vehicleNumber) stat.vehicles.add(t.vehicleNumber);
              if (t.date && (!stat.lastDispatchedDate || t.date > stat.lastDispatchedDate)) {
                stat.lastDispatchedDate = t.date;
              }
            }
          }
        }
      });

      const traveledList = Array.from(provinceStatsMap.values())
        .filter(p => p.tripCount > 0 || p.totalKm > 0)
        .map(p => ({
          province: p.province,
          destination: p.destination,
          roundTripKm: p.roundTripKm,
          tripCount: p.tripCount,
          totalKm: p.totalKm,
          totalBoxes: p.totalBoxes,
          mealCount: p.mealCount,
          drivers: Array.from(p.drivers),
          vehicles: Array.from(p.vehicles),
          lastDispatchedDate: p.lastDispatchedDate,
          hasActiveTrip: p.hasActiveTrip
        }))
        .sort((a, b) => b.totalKm - a.totalKm);

      const totalTraveledKm = traveledList.reduce((sum, p) => sum + p.totalKm, 0);
      const totalProvincesCount = new Set(traveledList.map(p => p.province)).size;
      const totalTripsCount = traveledList.reduce((sum, p) => sum + p.tripCount, 0);
      const totalBoxesDelivered = traveledList.reduce((sum, p) => sum + p.totalBoxes, 0);

      const traveledProvincesSummary = {
        totalKm: totalTraveledKm,
        totalProvinces: totalProvincesCount,
        totalTrips: totalTripsCount,
        totalBoxes: totalBoxesDelivered,
        list: traveledList
      };

      res.json({
        todayDate,
        stats: {
          todayOrders: todayOrders.length,
          todayAssignments: todayAssignments.length,
          todayBoxes: totalBoxes,
          unassignedOrders,
          dispatchedVehicles,
          dispatchedDrivers,
          substituteDriversCount,
          pendingProvinces,
          totalTraveledKm,
          totalTraveledProvincesCount: totalProvincesCount,
          totalTripsCount
        },
        traveledProvincesSummary,
        todayDispatches,
        recentOrders
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 5. DRIVER MONTHLY KM MATRIX (Section 13, 14, 15, 23)
  // "КМ-ийг таамаглаж болохгүй" - ONLY verified completed waybill & assignment km!
  app.get("/api/imd/driver-km-report", (req: Request, res: Response) => {
    try {
      const year = req.query.year ? Number(req.query.year) : 2026;
      const drivers = db.drivers || [];
      const trips = db.trips || [];
      const assignments = db.assignments || [];

      const result = drivers.map((driver: any) => {
        const cleanVeh = (driver.vehicle || "").toUpperCase().replace(/\s+/g, "");
        const driverId = driver.id;

        // Tally trips where this driver is primary or substitute
        const driverAssignments = assignments.filter((a: IMDAssignment) => 
          a.primaryDriverId === driverId || a.substituteDriverId === driverId || (a.vehiclePlate && a.vehiclePlate.toUpperCase().replace(/\s+/g, "") === cleanVeh)
        );

        const primaryTripsCount = driverAssignments.filter(a => a.primaryDriverId === driverId).length;
        const subTripsCount = driverAssignments.filter(a => a.substituteDriverId === driverId).length;

        // Verified KM per month 1..12
        const months: Record<number, number> = {};
        let totalRecordedKm = 0;
        let recordedMonthsCount = 0;

        for (let m = 1; m <= 12; m++) {
          const mPrefix = `${year}-${String(m).padStart(2, "0")}`;

          // Sum verified trips in this month
          const monthTrips = trips.filter((t: any) => {
            if (!t.date || !t.date.startsWith(mPrefix)) return false;
            const tVeh = (t.vehicleNumber || "").toUpperCase().replace(/\s+/g, "");
            return t.driverId === driverId || (cleanVeh && tVeh === cleanVeh);
          });

          // Also sum verified assignments with actualKm
          const monthAsns = driverAssignments.filter(
            a => a.departureDate && a.departureDate.startsWith(mPrefix) && a.status === "Дууссан" && a.actualKm
          );

          let kmSum = 0;
          let hasRecords = false;

          monthTrips.forEach((t: any) => {
            const km = Number(t.totalKm);
            if (!isNaN(km) && km > 0) {
              kmSum += km;
              hasRecords = true;
            }
          });

          // Add any assignments not already in trips
          monthAsns.forEach((a: IMDAssignment) => {
            const km = Number(a.actualKm);
            if (!isNaN(km) && km > 0) {
              // Ensure not double counted if trip already matched date
              const alreadyInTrip = monthTrips.some((t: any) => t.date === a.departureDate && Number(t.totalKm) === km);
              if (!alreadyInTrip) {
                kmSum += km;
                hasRecords = true;
              }
            }
          });

          if (hasRecords && kmSum > 0) {
            months[m] = kmSum;
            totalRecordedKm += kmSum;
            recordedMonthsCount++;
          } else {
            // Unrecorded or 0: keep undefined or 0
            months[m] = 0;
          }
        }

        return {
          driverId: driver.id,
          driverName: driver.name,
          driverCode: driver.code || driver.id,
          vehicle: driver.vehicle,
          isIMD: !!driver.isIMD,
          primaryTripsCount,
          subTripsCount,
          totalTripsCount: primaryTripsCount + subTripsCount,
          months,
          totalKm: totalRecordedKm,
          recordedMonthsCount
        };
      });

      // Sort with 8 official IMD drivers prioritized at the very top in exact order
      const OFFICIAL_IMD_CODES = ["775", "141", "9726", "14", "173", "314", "283", "5535"];
      result.sort((a, b) => {
        const aIdx = OFFICIAL_IMD_CODES.indexOf(String(a.driverCode));
        const bIdx = OFFICIAL_IMD_CODES.indexOf(String(b.driverCode));
        if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
        if (aIdx !== -1) return -1;
        if (bIdx !== -1) return 1;
        return a.driverName.localeCompare(b.driverName);
      });

      const imdDrivers = result.filter(r => OFFICIAL_IMD_CODES.includes(String(r.driverCode)) || OFFICIAL_IMD_CODES.includes(String(r.driverId)));
      const imdTotalKm = imdDrivers.reduce((sum, d) => sum + (d.totalKm || 0), 0);

      res.json({
        year,
        report: result,
        imdSummary: {
          totalKm: imdTotalKm,
          totalDrivers: imdDrivers.length,
          drivers: imdDrivers
        }
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 5.A INDIVIDUAL DRIVER MONTHLY PROVINCE KM STATS
  // "Нэвтрэл хийгээд орход энэ хэсгийн нэрний аль нэг хэсэгт тухайн сарын нийт томилолтонд явсан аймгуудын км ыг харуулна"
  app.get("/api/imd/driver-monthly-province-stats", (req: Request, res: Response) => {
    try {
      const driverId = req.query.driverId ? String(req.query.driverId) : "";
      const driverCode = req.query.driverCode ? String(req.query.driverCode) : driverId;
      const vehiclePlate = req.query.vehiclePlate ? String(req.query.vehiclePlate).replace(/\s+/g, "").toUpperCase() : "";
      const year = req.query.year ? Number(req.query.year) : 2026;
      
      const now = new Date();
      const currentMonth = now.getMonth() + 1;
      const month = req.query.month ? Number(req.query.month) : currentMonth;
      const monthPrefix = `${year}-${String(month).padStart(2, "0")}`;

      const drivers = db.drivers || [];
      const driver = drivers.find((d: any) => 
        (driverId && (d.id === driverId || d.code === driverId)) ||
        (driverCode && (d.id === driverCode || d.code === driverCode)) ||
        (vehiclePlate && (d.vehicle || "").replace(/\s+/g, "").toUpperCase() === vehiclePlate)
      );

      const resolvedDriverId = driver ? driver.id : driverId;
      const resolvedCode = driver ? (driver.code || driver.id) : driverCode;
      const resolvedName = driver ? driver.name : (req.query.driverName ? String(req.query.driverName) : "Жолооч");
      const cleanVeh = (driver?.vehicle || vehiclePlate || "").replace(/\s+/g, "").toUpperCase();

      // Зөвхөн албан ёсны 8 IMD аймаг, холын тээврийн жолооч нарын хувьд тооцно
      const IMD_AUTHORIZED_IDS = new Set(["775", "141", "9726", "14", "173", "314", "283", "5535"]);
      const IMD_AUTHORIZED_VEHICLES = new Set([
        "8374УНЕ", "3147УЕН", "3148УЕМ", "3148УЕО",
        "5909УКО", "6530УКН", "8376УЕН", "8428УНД"
      ]);

      const isAuthorizedIMD = 
        IMD_AUTHORIZED_IDS.has(String(resolvedDriverId).trim()) ||
        IMD_AUTHORIZED_IDS.has(String(resolvedCode).trim()) ||
        IMD_AUTHORIZED_VEHICLES.has(cleanVeh) ||
        (driver && driver.isIMD === true);

      if (!isAuthorizedIMD) {
        return res.json({
          driverId: resolvedDriverId,
          driverCode: resolvedCode,
          driverName: resolvedName,
          vehiclePlate: cleanVeh,
          isIMDDriver: false,
          year,
          monthNum: month,
          monthName: `${month}-р сар`,
          totalKm: 0,
          totalMonthlyMealAllowance: 0,
          mealTripsCount: 0,
          totalTripsCount: 0,
          provincesCount: 0,
          provincesList: [],
          trips: []
        });
      }

      const assignments = db.assignments || [];
      const trips = db.trips || [];

      // Assignments for this driver in target month
      const monthAssignments = assignments.filter((a: IMDAssignment) => {
        if (!a.departureDate || !a.departureDate.startsWith(monthPrefix)) return false;
        const matchesDriver = a.primaryDriverId === resolvedDriverId || 
                              a.substituteDriverId === resolvedDriverId || 
                              a.primaryDriverId === resolvedCode || 
                              a.substituteDriverId === resolvedCode;
        const aVeh = (a.vehiclePlate || "").replace(/\s+/g, "").toUpperCase();
        const matchesVeh = cleanVeh && aVeh === cleanVeh;
        return matchesDriver || matchesVeh;
      });

      // Trips for this driver in target month
      const monthTrips = trips.filter((t: any) => {
        if (!t.date || !t.date.startsWith(monthPrefix)) return false;
        const matchesDriver = t.driverId === resolvedDriverId || t.driverId === resolvedCode;
        const tVeh = (t.vehicleNumber || "").replace(/\s+/g, "").toUpperCase();
        const matchesVeh = cleanVeh && tVeh === cleanVeh;
        return matchesDriver || matchesVeh;
      });

      // Detailed province trips list
      const detailedTrips: any[] = [];
      const processedDatesAndKm = new Set<string>();

      // Helper to find province route config
      const findRouteDef = (destOrProv: string) => {
        if (!destOrProv) return undefined;
        const clean = destOrProv.trim().toLowerCase().replace(/[\s\-_]/g, "");
        const routesList = (db.routes && db.routes.length > 0) ? db.routes : DEFAULT_IMD_ROUTES;
        return routesList.find((r: any) => {
          const rd = (r.destination || "").toLowerCase().replace(/[\s\-_]/g, "");
          const rp = (r.province || "").toLowerCase().replace(/[\s\-_]/g, "");
          return rd.includes(clean) || clean.includes(rd) || rp.includes(clean) || clean.includes(rp);
        });
      };

      // 1. From Assignments
      monthAssignments.forEach((a: IMDAssignment) => {
        const km = Number(a.actualKm || a.roundTripKm || 0);
        const isPrimary = (a.primaryDriverId === resolvedDriverId || a.primaryDriverId === resolvedCode);
        const isSubstitute = (a.substituteDriverId === resolvedDriverId || a.substituteDriverId === resolvedCode);
        const role = isPrimary ? "Үндсэн жолооч" : "Сэлгээ жолооч";

        const hasSubDriver = Boolean(a.substituteDriverId && a.substituteDriverId !== a.primaryDriverId);
        const driverCount = hasSubDriver ? 2 : (Number(a.driverCount) || 1);
        const matchedRoute = findRouteDef(a.destination || a.province);
        const mealCount = Number(a.mealCount) || (matchedRoute ? matchedRoute.mealCount : 3);
        const totalTripMealMoney = Number(a.mealAllowance) || (mealCount * 25000 * driverCount);

        // ДҮРЭМ: 2 жолооч явахад хоолны мөнгө ҮНДСЭН ЖОЛООЧИД олгогдоно
        let driverReceivedMealAllowance = 0;
        if (isPrimary) {
          driverReceivedMealAllowance = totalTripMealMoney;
        } else if (isSubstitute) {
          driverReceivedMealAllowance = 0; // Сэлгээ жолоочид олгогдохгүй (үндсэн жолоочид олгогдсон)
        } else {
          driverReceivedMealAllowance = totalTripMealMoney;
        }
        
        detailedTrips.push({
          id: a.id,
          date: a.departureDate,
          province: a.province || "Орон нутаг",
          destination: a.destination || a.province || "Томилолт",
          km,
          vehicle: a.vehiclePlate,
          role,
          isPrimary,
          isSubstitute,
          driverCount,
          substituteDriverName: a.substituteDriverName,
          primaryDriverName: a.primaryDriverName,
          mealCount,
          totalTripMealMoney,
          driverReceivedMealAllowance,
          status: a.status,
          isAssignment: true
        });

        if (km > 0) {
          processedDatesAndKm.add(`${a.departureDate}_${km}`);
        }
      });

      detailedTrips.sort((a, b) => b.date.localeCompare(a.date));

      const totalKm = detailedTrips.reduce((sum, t) => sum + (t.km || 0), 0);
      const totalMonthlyMealAllowance = detailedTrips.reduce((sum, t) => sum + (t.driverReceivedMealAllowance || 0), 0);
      const mealTripsCount = detailedTrips.filter(t => (t.driverReceivedMealAllowance || 0) > 0).length;

      const provincesSet = new Set<string>();
      detailedTrips.forEach(t => {
        if (t.province) provincesSet.add(t.province);
      });
      const provincesList = Array.from(provincesSet);
      const provincesSummaryStr = provincesList.slice(0, 3).join(", ") + (provincesList.length > 3 ? ` зэрэг ${provincesList.length} аймаг` : "");

      res.json({
        driverId: resolvedDriverId,
        driverCode: resolvedCode,
        driverName: resolvedName,
        vehiclePlate: cleanVeh || driver?.vehicle || "",
        month: monthPrefix,
        monthNum: month,
        monthName: `${month}-р сар`,
        year,
        totalKm,
        totalTripsCount: detailedTrips.length,
        totalMonthlyMealAllowance,
        mealTripsCount,
        ratePerMeal: 25000,
        provincesCount: provincesList.length,
        provincesList,
        provincesSummaryStr,
        trips: detailedTrips
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 5.B MONTHLY PROVINCE ICE CREAM & DRIVERS DASHBOARD REPORT
  // "тухайн сард ямар аймаг хэдэн удаа ямар ямар жолооч машинаар хэдэн хайрцаг зайрмаг авсан мэдээлэл"
  app.get("/api/imd/province-icecream-report", (req: Request, res: Response) => {
    try {
      const year = req.query.year ? Number(req.query.year) : 2026;
      const monthQuery = req.query.month; // 1..12 or 'all'
      const targetMonth = (!monthQuery || monthQuery === "all") ? null : Number(monthQuery);

      const orders = db.orders || [];
      const assignments = db.assignments || [];

      // Combine orders and assignments for complete trip records
      const combinedTrips: Array<{
        id: string;
        orderNo: string;
        customer: string;
        province: string;
        destination: string;
        quantity: number;
        date: string;
        status: string;
        driverName: string;
        driverCode?: string;
        vehiclePlate: string;
      }> = [];

      // Process assignments (confirmed transports)
      assignments.forEach((asn: IMDAssignment) => {
        const dDate = asn.departureDate || asn.returnDate || "";
        const [yStr, mStr] = dDate.split("-");
        const yNum = Number(yStr);
        const mNum = Number(mStr);

        if (yNum && yNum !== year) return;
        if (targetMonth !== null && mNum && mNum !== targetMonth) return;

        combinedTrips.push({
          id: asn.id,
          orderNo: asn.orderNo || `ASN-${asn.id.slice(0, 6)}`,
          customer: "Харилцагч",
          province: asn.province || "Улаанбаатар",
          destination: asn.destination || asn.province || "",
          quantity: asn.quantity || 1000,
          date: dDate || `${year}-09-01`,
          status: asn.status || "Дууссан",
          driverName: asn.primaryDriverName || "Жолооч",
          vehiclePlate: asn.vehiclePlate || "-"
        });
      });

      // Also process orders that might not have assignment or have distinct records
      orders.forEach((ord: IMDOrder) => {
        // Skip unassigned in delivery report if wanted, or include assigned ones
        if ((ord.status as string) === "Хуваарилалт хүлээж буй" || ord.status === "Шинэ" || ord.status === "Хүлээгдэж буй") return;

        const oDate = ord.deliveryDate || ord.receivedDate || "";
        const [yStr, mStr] = oDate.split("-");
        const yNum = Number(yStr);
        const mNum = Number(mStr);

        if (yNum && yNum !== year) return;
        if (targetMonth !== null && mNum && mNum !== targetMonth) return;

        // Check if already in combinedTrips via assignment
        const exists = combinedTrips.some(t => t.orderNo === ord.orderNo);
        if (!exists) {
          const matchedAsn = ord.assignmentId ? assignments.find((a: IMDAssignment) => a.id === ord.assignmentId) : null;
          combinedTrips.push({
            id: ord.id,
            orderNo: ord.orderNo,
            customer: ord.customer,
            province: ord.province,
            destination: ord.destination,
            quantity: ord.quantity,
            date: oDate || `${year}-09-01`,
            status: ord.status,
            driverName: matchedAsn ? matchedAsn.primaryDriverName : "Томилогдсон",
            vehiclePlate: matchedAsn ? matchedAsn.vehiclePlate : "-"
          });
        }
      });

      // Group by province
      const provinceMap: Record<string, {
        province: string;
        tripCount: number;
        totalBoxes: number;
        drivers: Set<string>;
        vehicles: Set<string>;
        destinations: Set<string>;
        trips: typeof combinedTrips;
      }> = {};

      combinedTrips.forEach(trip => {
        const prov = (trip.province || "Тодорхойгүй").trim();
        if (!provinceMap[prov]) {
          provinceMap[prov] = {
            province: prov,
            tripCount: 0,
            totalBoxes: 0,
            drivers: new Set(),
            vehicles: new Set(),
            destinations: new Set(),
            trips: []
          };
        }

        provinceMap[prov].tripCount += 1;
        provinceMap[prov].totalBoxes += (trip.quantity || 0);
        if (trip.driverName && trip.driverName !== "-") provinceMap[prov].drivers.add(trip.driverName);
        if (trip.vehiclePlate && trip.vehiclePlate !== "-") provinceMap[prov].vehicles.add(trip.vehiclePlate);
        if (trip.destination) provinceMap[prov].destinations.add(trip.destination);
        provinceMap[prov].trips.push(trip);
      });

      const provincesResult = Object.values(provinceMap).map(p => ({
        province: p.province,
        tripCount: p.tripCount,
        totalBoxes: p.totalBoxes,
        drivers: Array.from(p.drivers),
        vehicles: Array.from(p.vehicles),
        destinations: Array.from(p.destinations),
        trips: p.trips.sort((a, b) => (b.date || "").localeCompare(a.date || ""))
      })).sort((a, b) => b.totalBoxes - a.totalBoxes);

      const totalTrips = combinedTrips.length;
      const totalBoxes = combinedTrips.reduce((s, t) => s + (t.quantity || 0), 0);
      const allDrivers = new Set(combinedTrips.map(t => t.driverName).filter(Boolean));
      const allVehicles = new Set(combinedTrips.map(t => t.vehiclePlate).filter(Boolean));

      res.json({
        year,
        month: targetMonth || "all",
        summary: {
          totalTrips,
          totalBoxes,
          totalProvinces: provincesResult.length,
          totalDrivers: allDrivers.size,
          totalVehicles: allVehicles.size
        },
        provinces: provincesResult
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 5.C PUBLIC CUSTOMER PORTAL
  // "Хуваарилалт Хүлээж Буй- хэсгийг харуулахгүй захиалагч талд харуулах IMD Томилолт & Захиалга Удирдлагын Нэгдсэн Систем"
  app.get("/api/imd/public/portal", async (req: Request, res: Response) => {
    try {
      const orders = db.orders || [];
      const assignments = db.assignments || [];

      // Fetch live GPSBox telemetry if available
      let liveTelemetry: Record<string, any> = {};
      if (getTelemetryFn) {
        try {
          liveTelemetry = await getTelemetryFn();
        } catch (e) {}
      }

      // Unassigned orders (Хуваарилалт хүлээж буй захиалгууд)
      // Architecture check: an order is unassigned if it has no active assignment in db.assignments and is not finished/cancelled
      const unassignedOrders = orders
        .filter((o: IMDOrder) => {
          if (!o || !o.orderNo) return false;
          if ((o.status as string) === "Дууссан" || (o.status as string) === "Хүргэгдсэн" || o.status === "Цуцлагдсан") return false;
          
          const hasLinkedAsn = o.assignmentId && assignments.some((a: IMDAssignment) => a.id === o.assignmentId && a.status !== "Цуцлагдсан");
          const hasMatchingAsn = assignments.some((a: IMDAssignment) => 
            (a.orderId === o.id || (a.orderNo && a.orderNo.trim().toUpperCase() === o.orderNo.trim().toUpperCase())) && 
            a.status !== "Цуцлагдсан"
          );
          
          if (hasLinkedAsn || hasMatchingAsn) return false;
          return true;
        })
        .map((o: IMDOrder) => ({
          id: o.id,
          orderNo: o.orderNo,
          customer: o.customer,
          province: o.province || "Орон нутаг",
          destination: o.destination || o.province || "",
          quantity: o.quantity || 0,
          deliveryDate: o.deliveryDate,
          createdAt: o.receivedDate || o.createdAt?.split("T")[0] || "",
          status: "Хуваарилалт хүлээж буй"
        }));

      // Confirmed, dispatched, in-transit, and completed deliveries
      const clientOrders: any[] = [];
      const processedOrderIds = new Set<string>();
      const processedOrderNos = new Set<string>();

      // 1. First process orders that have manager assignments or confirmed delivery status
      orders.forEach((o: IMDOrder) => {
        if (!o || !o.orderNo) return;
        if (o.status === "Цуцлагдсан") return;

        // Find linked assignment
        const asn = assignments.find((a: IMDAssignment) => 
          (o.assignmentId && a.id === o.assignmentId) || 
          (a.orderId && a.orderId === o.id) || 
          (a.orderNo && a.orderNo.trim().toUpperCase() === o.orderNo.trim().toUpperCase())
        );

        // If it has no active assignment and is not completed, it is unassigned
        const isCompleted = (o.status as string) === "Дууссан" || (o.status as string) === "Хүргэгдсэн";
        if (!asn && !isCompleted) return;

        processedOrderIds.add(o.id);
        processedOrderNos.add(o.orderNo.trim().toUpperCase());

        // Resolve driver name from master drivers if needed
        let driverName = asn?.primaryDriverName || o.primaryDriverName;
        if (!driverName || driverName === "Томилогдсон" || /^\d+$/.test(driverName)) {
          const dId = asn?.primaryDriverId || o.primaryDriverId;
          const foundDrv = (db.drivers || []).find((d: any) => d.id === dId || d.code === dId);
          if (foundDrv) driverName = foundDrv.name;
        }

        clientOrders.push({
          id: o.id,
          orderNo: o.orderNo,
          customer: o.customer,
          customerOrg: o.customerOrg || "Захиалагч",
          province: o.province || asn?.province || "Орон нутаг",
          destination: o.destination || asn?.destination || o.province,
          quantity: o.quantity || asn?.quantity || 0,
          deliveryDate: o.deliveryDate || asn?.returnDate || asn?.departureDate,
          departureDate: asn?.departureDate || o.deliveryDate,
          status: asn?.status || o.status,
          vehiclePlate: asn ? asn.vehiclePlate : (o.vehiclePlate || "-"),
          primaryDriverName: driverName || "Томилогдсон",
          primaryDriverPhone: asn?.primaryDriverPhone || "",
          substituteDriverName: asn?.substituteDriverName || "",
          startOdo: asn?.startOdo,
          endOdo: asn?.endOdo,
          actualKm: asn?.actualKm,
          albanBichigDugaar: asn?.albanBichigDugaar || (o as any).albanBichigDugaar || "",
          albanBichigPdfUrl: asn?.albanBichigPdfUrl || (o as any).albanBichigPdfUrl || "",
          note: asn?.note || (o as any).notes || "",
          shareToken: o.shareToken || asn?.token || o.id
        });
      });

      // 2. Also include active assignments created directly in the assignments tab
      assignments.forEach((asn: IMDAssignment) => {
        if (!asn.orderNo || asn.status === "Цуцлагдсан") return;
        const normOrderNo = asn.orderNo.trim().toUpperCase();
        if (processedOrderNos.has(normOrderNo) || (asn.orderId && processedOrderIds.has(asn.orderId))) {
          return;
        }

        // Resolve driver name
        let driverName = asn.primaryDriverName;
        if (!driverName || driverName === "Томилогдсон" || /^\d+$/.test(driverName)) {
          const foundDrv = (db.drivers || []).find((d: any) => d.id === asn.primaryDriverId || d.code === asn.primaryDriverId);
          if (foundDrv) driverName = foundDrv.name;
        }

        clientOrders.push({
          id: asn.id,
          orderNo: asn.orderNo,
          customer: "Борлуулалтын салбар",
          customerOrg: asn.province?.startsWith("Улаанбаатар") ? "Улаанбаатар салбар" : `${asn.province} салбар`,
          province: asn.province || "Орон нутаг",
          destination: asn.destination || asn.province,
          quantity: asn.quantity || 1000,
          deliveryDate: asn.returnDate || asn.departureDate,
          departureDate: asn.departureDate,
          status: asn.status,
          vehiclePlate: asn.vehiclePlate || "-",
          primaryDriverName: driverName || "Томилогдсон",
          primaryDriverPhone: asn.primaryDriverPhone || "",
          substituteDriverName: asn.substituteDriverName || "",
          startOdo: asn.startOdo,
          endOdo: asn.endOdo,
          actualKm: asn.actualKm,
          albanBichigDugaar: asn.albanBichigDugaar || "",
          albanBichigPdfUrl: asn.albanBichigPdfUrl || "",
          note: asn.note || "",
          shareToken: asn.token || asn.id
        });
      });

      // Strictly IMD Regional Truck assignments (10 official long-distance trucks)
      const regionalPlates = new Set([
        "8374УНЕ", "3147УЕН", "3148УЕМ", "3148УЕО", "5909УКО", 
        "6530УКН", "8376УЕН", "8428УНД", "8531УББ", "9988УНБ", "3147УНЭ"
      ]);

      const imdAssignmentsOnly = clientOrders.filter(c => {
        const veh = (c.vehiclePlate || "").replace(/\s+/g, "").toUpperCase();
        if (regionalPlates.has(veh)) return true;
        if (c.province && !c.province.startsWith("Улаанбаатар")) return true;
        return false;
      });

      // Official IMD Regional Fleet (10 heavy trucks)
      const imdFleet = (db.drivers || [])
        .filter((d: any) => {
          const veh = (d.vehicle || "").replace(/\s+/g, "").toUpperCase();
          return d.isIMD || regionalPlates.has(veh);
        })
        .map((d: any) => {
          const cleanVeh = (d.vehicle || "").toUpperCase().replace(/\s+/g, "");
          const digits = cleanVeh.replace(/\D/g, "");
          const tele = liveTelemetry[cleanVeh] || 
            (digits.length >= 4 && liveTelemetry[digits]) || 
            (d.id ? liveTelemetry[d.id.toUpperCase()] : null) || 
            null;
          
          const activeAsn = (db.assignments || []).find((a: any) => {
            const aVeh = (a.vehiclePlate || "").toUpperCase().replace(/\s+/g, "");
            return (aVeh === cleanVeh || (digits.length >= 4 && aVeh.replace(/\D/g, "") === digits)) && a.status !== "Дууссан" && a.status !== "Цуцлагдсан";
          });

          const isMoving = (tele?.speed || 0) > 0;
          const statusText = activeAsn 
            ? (isMoving ? "Тээвэрт гарсан (Хөдөлж байна)" : "Тээвэрт гарсан (Түр зогссон)") 
            : (isMoving ? `Хөдөлгөөнд (${tele?.speed} км/ц)` : (d.status === "active" ? "Идэвхтэй / Бэлэн" : "Амарсан"));

          return {
            id: d.id,
            code: d.code || d.id,
            name: d.name,
            phone: d.phone,
            vehiclePlate: d.vehicle,
            model: d.model || "Hyundai HD65 (Хөлдөөгчтэй)",
            salesRep: activeAsn?.destination || ((d.salesRep === "IMD Томилолт" || d.salesRep === "IMD Томилолт түгээлт" || d.salesRep === "undefined") ? "" : (d.salesRep || "")),
            zone: activeAsn?.province || d.zone || d.defaultRoute || "Орон нутгийн чиглэл",
            defaultRoute: (d.defaultRoute === "Орон нутаг томилолт") ? "Орон нутаг тээвэр" : (d.defaultRoute || d.zone || "Орон нутгийн чиглэл"),
            boxCapacity: d.boxCapacity || 2500,
            currentOdo: tele?.odo || d.apiOdo || d.autoOdoConfig?.monthStartOdo || 180000,
            todayKm: 0,
            status: statusText,
            lat: tele?.lat ? Number(tele.lat) : 47.9056,
            lng: tele?.lng ? Number(tele.lng) : 106.9328,
            speed: tele?.speed !== undefined ? Number(tele.speed) : 0,
            temp: tele?.temp || "--°C",
            tempNum: tele?.tempNum ?? null,
            fuel: tele?.fuel || "--",
            fuelPercent: tele?.fuelPercent ?? null,
            dtTracker: tele?.dtTracker || null,
            isLive: Boolean(tele),
            isIMD: true,
            activeAssignment: activeAsn ? {
              id: activeAsn.id,
              orderNo: activeAsn.orderNo,
              province: activeAsn.province,
              destination: activeAsn.destination,
              status: activeAsn.status,
              departureDate: activeAsn.departureDate || activeAsn.deliveryDate
            } : null
          };
        });

      // City sales delivery fleet (30 vehicles: 5 KA + 25 M)
      const cityFleet = (db.drivers || [])
        .filter((d: any) => {
          const veh = (d.vehicle || "").replace(/\s+/g, "").toUpperCase();
          return !regionalPlates.has(veh) && !d.isIMD;
        })
        .map((d: any) => {
          const cleanVeh = (d.vehicle || "").toUpperCase().replace(/\s+/g, "");
          const digits = cleanVeh.replace(/\D/g, "");
          const tele = liveTelemetry[cleanVeh] || (digits.length >= 4 && liveTelemetry[digits]) || liveTelemetry[d.id?.toUpperCase()] || null;
          const trip = (db.trips || []).find((t: any) => (t.vehicleNumber || "").toUpperCase().replace(/\s+/g, "") === cleanVeh);
          const startOdo = d.autoOdoConfig?.monthStartOdo || d.apiOdo || 148000;
          return {
            id: d.id,
            code: d.code || d.id,
            name: d.name,
            phone: d.phone,
            vehiclePlate: d.vehicle,
            model: d.model || (d.id?.startsWith("KA") ? "Hyundai HD65 Сүлжээ" : "Hyundai Mighty Түгээлт"),
            salesRep: d.salesRep || "ХТ",
            zone: d.zone || d.defaultRoute || "Улаанбаатар",
            defaultRoute: d.defaultRoute || d.zone || "Улаанбаатар",
            boxCapacity: d.boxCapacity || 1600,
            currentOdo: tele?.odo || trip?.endOdo || trip?.startOdo || startOdo,
            todayKm: trip?.totalKm || 0,
            status: d.status === "active" ? "Түгээлтэнд гарсан" : "Амарсан",
            lat: tele?.lat || 47.9056,
            lng: tele?.lng || 106.9328,
            speed: tele?.speed ?? 0,
            temp: tele?.temp || "--°C",
            tempNum: tele?.tempNum ?? null,
            fuel: tele?.fuel || "--",
            fuelPercent: tele?.fuelPercent ?? null,
            dtTracker: tele?.dtTracker || null,
            isLive: Boolean(tele)
          };
        });

      // Enrich shipments with live GPS position if available
      imdAssignmentsOnly.forEach(asn => {
        const cleanVeh = (asn.vehiclePlate || "").toUpperCase().replace(/\s+/g, "");
        const digits = cleanVeh.replace(/\D/g, "");
        const tele = liveTelemetry[cleanVeh] || (digits.length >= 4 && liveTelemetry[digits]) || null;
        if (tele) {
          asn.lat = tele.lat;
          asn.lng = tele.lng;
          asn.speed = tele.speed;
          asn.temp = tele.temp;
          asn.fuel = tele.fuel;
          asn.dtTracker = tele.dtTracker;
          asn.isLive = true;
        }
      });

      // Sort by date desc
      imdAssignmentsOnly.sort((a, b) => (b.departureDate || b.deliveryDate || "").localeCompare(a.departureDate || a.deliveryDate || ""));

      // Calculate Province Summaries: (хэдэн удаа ямар аймаг авсан, хэн хэн түгээгч хэдний өдөр хүргэсэн)
      const provMap: Record<string, {
        province: string;
        deliveryCount: number;
        totalBoxes: number;
        drivers: Set<string>;
        vehicles: Set<string>;
        dates: Set<string>;
        lastDate: string;
      }> = {};

      imdAssignmentsOnly.forEach(ord => {
        const prov = (ord.province || "Орон нутаг").trim();
        if (!provMap[prov]) {
          provMap[prov] = {
            province: prov,
            deliveryCount: 0,
            totalBoxes: 0,
            drivers: new Set(),
            vehicles: new Set(),
            dates: new Set(),
            lastDate: ""
          };
        }
        provMap[prov].deliveryCount += 1;
        provMap[prov].totalBoxes += (ord.quantity || 0);
        if (ord.primaryDriverName && ord.primaryDriverName !== "Томилогдсон") {
          provMap[prov].drivers.add(ord.primaryDriverName);
        }
        if (ord.vehiclePlate && ord.vehiclePlate !== "Батлагдсан" && ord.vehiclePlate !== "-") {
          provMap[prov].vehicles.add(ord.vehiclePlate);
        }
        const tripDate = ord.deliveryDate || ord.departureDate;
        if (tripDate) {
          provMap[prov].dates.add(tripDate);
          if (!provMap[prov].lastDate || tripDate > provMap[prov].lastDate) {
            provMap[prov].lastDate = tripDate;
          }
        }
      });

      const provinceSummaries = Object.values(provMap).map(p => ({
        province: p.province,
        deliveryCount: p.deliveryCount,
        totalBoxes: p.totalBoxes,
        drivers: Array.from(p.drivers),
        vehicles: Array.from(p.vehicles),
        deliveryDates: Array.from(p.dates).sort().reverse(),
        lastDeliveryDate: p.lastDate,
        unassignedCount: unassignedOrders.filter(u => u.province === p.province).length
      })).sort((a, b) => b.deliveryCount - a.deliveryCount || b.totalBoxes - a.totalBoxes);

      const totalDeliveries = imdAssignmentsOnly.length;
      const inTransit = imdAssignmentsOnly.filter(c => c.status === "Тээвэрт гарсан").length;
      const completed = imdAssignmentsOnly.filter(c => c.status === "Дууссан" || c.status === "Хүргэгдсэн").length;
      const scheduled = imdAssignmentsOnly.filter(c => c.status === "Төлөвлөсөн" || c.status === "Батлагдсан").length;
      const totalBoxes = imdAssignmentsOnly.reduce((sum, c) => sum + (c.quantity || 0), 0);

      res.json({
        title: "Орон Нутгийн Түгээлт & Хотын Борлуулалтын Хяналтын Систем",
        summary: {
          totalDeliveries,
          inTransit,
          completed,
          scheduled,
          totalBoxes,
          totalProvinces: provinceSummaries.length,
          unassignedOrdersCount: unassignedOrders.length,
          cityFleetCount: cityFleet.length,
          imdFleetCount: imdFleet.length
        },
        provinceSummaries,
        unassignedOrders,
        shipments: imdAssignmentsOnly,
        assignments: imdAssignmentsOnly,
        cityFleet,
        imdFleet
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 5.D PUBLIC VEHICLE LOCATION API FOR MAP (/sales view)
  app.get("/api/imd/public/vehicle-location/:plate", async (req: Request, res: Response) => {
    try {
      const { plate } = req.params;
      const cleanPlate = decodeURIComponent(plate).replace(/[\s\-_()]/g, "").toUpperCase();
      const digits = cleanPlate.replace(/\D/g, "");

      let liveTelemetry: Record<string, any> = {};
      if (getTelemetryFn) {
        try {
          liveTelemetry = await getTelemetryFn();
        } catch (e) {}
      }

      const driver = (db.drivers || []).find((d: any) => {
        const vClean = (d.vehicle || "").replace(/[\s\-_()]/g, "").toUpperCase();
        return (
          vClean === cleanPlate ||
          (digits.length >= 4 && vClean.replace(/\D/g, "") === digits) ||
          (d.id && d.id.toUpperCase() === cleanPlate) ||
          (d.code && d.code.toUpperCase() === cleanPlate)
        );
      });

      const tele = liveTelemetry[cleanPlate] || 
        (digits.length >= 4 && liveTelemetry[digits]) || 
        (driver ? (liveTelemetry[driver.id?.toUpperCase()] || liveTelemetry[(driver.vehicle || "").toUpperCase().replace(/\s+/g, "")]) : null) || 
        null;

      // Default coords for UB distribution hub if offline: 47.9056, 106.9328 (Icemark Depot)
      const lat = tele?.lat ? Number(tele.lat) : 47.9056;
      const lng = tele?.lng ? Number(tele.lng) : 106.9328;

      res.json({
        success: true,
        vehiclePlate: driver?.vehicle || plate,
        driverName: driver?.name || "Томилогдсон жолооч",
        phone: driver?.phone || "",
        model: driver?.model || "Түгээлтийн машин",
        salesRep: driver?.salesRep || "Борлуулалтын төлөөлөгч",
        zone: driver?.zone || driver?.defaultRoute || "Улаанбаатар",
        lat,
        lng,
        speed: tele?.speed !== undefined ? Number(tele.speed) : 0,
        odometer: tele?.odo || driver?.autoOdoConfig?.monthStartOdo || 0,
        fuel: tele?.fuel || "--",
        fuelPercent: tele?.fuelPercent ?? null,
        temp: tele?.temp || "--°C",
        tempNum: tele?.tempNum ?? null,
        status: tele?.status || (tele && tele.speed > 0 ? "moving" : "active"),
        dtTracker: tele?.dtTracker || new Date().toLocaleString("mn-MN"),
        lastUpdate: tele?.lastUpdate || new Date().toLocaleTimeString("mn-MN"),
        isLive: Boolean(tele)
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 6. PUBLIC CUSTOMER SHARE VIEW (Section 8.B, 35)
  // Clean, minimal information: Order #, Status, Province/Destination, Vehicle, Driver, Date, Quantity.
  // Never exposes fuel, driver phone, internal GPS telemetry or fines!
  app.get("/api/imd/public/order/:token", (req: Request, res: Response) => {
    try {
      const { token } = req.params;
      if (!token || token.length < 8) {
        return res.status(400).json({ error: "Буруу токен формат" });
      }
      // Only match against shareToken, NEVER plain order id to prevent IDOR enumeration
      const order = (db.orders || []).find((o: IMDOrder) => o.shareToken === token);

      if (!order) {
        return res.status(404).json({ error: "Захиалга олдсонгүй эсвэл линк буруу байна" });
      }

      const assignment = order.assignmentId 
        ? (db.assignments || []).find((a: IMDAssignment) => a.id === order.assignmentId)
        : null;

      // Strictly safe public data
      const safeData = {
        orderNo: order.orderNo,
        customer: order.customer,
        customerOrg: order.customerOrg || "Захиалагч",
        status: order.status,
        province: order.province,
        destination: order.destination,
        quantity: order.quantity,
        receivedDate: order.receivedDate,
        deliveryDate: order.deliveryDate,
        vehiclePlate: assignment ? assignment.vehiclePlate : "Хуваарилагдаж байна",
        primaryDriverName: assignment ? assignment.primaryDriverName : "Томилолтод бэлтгэж байна",
        departureDate: assignment ? assignment.departureDate : order.deliveryDate,
        isDispatched: assignment ? assignment.status === "Тээвэрт гарсан" || assignment.status === "Дууссан" : false
      };

      res.json(safeData);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 7. DRIVER DEDICATED TRIP VIEW (Section 8.A, 34)
  // Displays driver's assigned trip, waybill fields, vehicle GPS status, this month's verified KM!
  app.get("/api/imd/driver/trip/:token", (req: Request, res: Response) => {
    try {
      const { token } = req.params;
      const assignment = (db.assignments || []).find(
        (a: IMDAssignment) => a.token === token || a.id === token
      );

      if (!assignment) {
        return res.status(404).json({ error: "Томилолт олдсонгүй" });
      }

      const order = (db.orders || []).find((o: IMDOrder) => o.id === assignment.orderId);

      // Get driver monthly verified KM
      const currentMonth = assignment.departureDate.slice(0, 7);
      const cleanVeh = assignment.vehiclePlate.toUpperCase().replace(/\s+/g, "");
      const monthTrips = (db.trips || []).filter((t: any) => {
        if (!t.date || !t.date.startsWith(currentMonth)) return false;
        const tVeh = (t.vehicleNumber || "").toUpperCase().replace(/\s+/g, "");
        return t.driverId === assignment.primaryDriverId || (cleanVeh && tVeh === cleanVeh);
      });

      const monthKm = monthTrips.reduce((sum: number, t: any) => sum + (Number(t.totalKm) || 0), 0);

      res.json({
        assignment,
        order: order || null,
        monthKm,
        currentMonth
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 8. EXCEL & DATA IMPORT HANDLER (Section 9, 10, 26, 27)
  // Handles mapped headers, normalizes names/plates, and returns execution summary
  app.post("/api/imd/import-excel", (req: Request, res: Response) => {
    try {
      const { rows } = req.body;
      if (!Array.isArray(rows) || rows.length === 0) {
        return res.status(400).json({ error: "Импортлох мэдээлэл хоосон байна" });
      }

      let successCount = 0;
      let newCount = 0;
      let updatedCount = 0;
      let errorCount = 0;
      const errors: string[] = [];
      const importedAssignments: IMDAssignment[] = [];

      rows.forEach((row: any, idx: number) => {
        try {
          // Normalize column keys
          const plateRaw = row["Авто машины улсын дугаар"] || row["Улсын дугаар"] || row["Машин"] || row["plate"] || "";
          const driverRaw = row["Үндсэн/сэлгээ түгээгч"] || row["Жолооч"] || row["driver"] || "";
          const routeRaw = row["Томилолт чиглэл"] || row["Чиглэл"] || row["Аймаг"] || row["route"] || "";
          const orderNoRaw = row["Албан бичгийн дугаар"] || row["Захиалгын дугаар"] || row["orderNo"] || `IMP-${Date.now().toString().slice(-4)}-${idx + 1}`;
          const kmRaw = row["Нийт явсан км"] || row["Явсан км"] || row["км"] || row["totalKm"] || 0;
          const boxRaw = row["Захиалгын хэмжээ"] || row["Хайрцаг"] || row["quantity"] || 1000;
          const recDateRaw = row["Захиалга ирсэн огноо"] || row["Ирсэн огноо"] || new Date().toISOString().split("T")[0];
          const depDateRaw = row["Тээвэрт гарсан огноо"] || row["Гарсан огноо"] || new Date().toISOString().split("T")[0];
          const unitPriceRaw = row["Томилолтын нэгж үнэ"] || row["Нэгж үнэ"] || 1000;

          if (!plateRaw || !driverRaw) {
            errorCount++;
            errors.push(`Мөр ${idx + 1}: Машины дугаар эсвэл жолооч тодорхойгүй байна.`);
            return;
          }

          // Normalize Vehicle Plate
          const cleanPlate = String(plateRaw).trim().toUpperCase().replace(/\s+/g, "");

          // Normalize Driver Name & Substitute Driver (e.g. "Ми.Анхбаяр (141)" or "Ми.Анхбаяр / Жа.Алтанхуяг")
          let primaryName = String(driverRaw).trim();
          let subName: string | undefined = undefined;

          if (primaryName.includes("/")) {
            const parts = primaryName.split("/");
            primaryName = parts[0].trim();
            subName = parts[1].trim();
          } else if (primaryName.toLowerCase().includes("сэлгээ")) {
            const parts = primaryName.split(/сэлгээ/i);
            primaryName = parts[0].trim();
            subName = parts[1].trim();
          }

          // Extract code if present e.g. "Ми.Анхбаяр (141)"
          let primaryCode: string | undefined;
          const codeMatch = primaryName.match(/\((\d+)\)/);
          if (codeMatch) {
            primaryCode = codeMatch[1];
            primaryName = primaryName.replace(/\(\d+\)/, "").trim();
          }

          // Match driver with master or add
          let matchedDriver = (db.drivers || []).find(
            (d: any) => d.name.includes(primaryName) || (primaryCode && d.code === primaryCode) || (cleanPlate && d.vehicle.replace(/\s+/g, "").toUpperCase() === cleanPlate)
          );

          if (!matchedDriver) {
            matchedDriver = {
              id: primaryCode || "DRV-" + Date.now().toString().slice(-4),
              code: primaryCode || "IMP",
              name: primaryName,
              phone: "9911-0000",
              vehicle: cleanPlate,
              model: "Isuzu",
              salesRep: "Томилолт түгээлт",
              status: "active",
              isCustom: true
            };
            db.drivers.push(matchedDriver);
          }

          // Create or update Order
          let order = (db.orders || []).find((o: IMDOrder) => o.orderNo === String(orderNoRaw).trim());
          const provinceClean = routeRaw.split(/[\s,-]/)[0] || "Улаанбаатар";
          const destClean = routeRaw || provinceClean;

          if (!order) {
            order = {
              id: "ORD-" + Date.now().toString().slice(-5) + "-" + idx,
              orderNo: String(orderNoRaw).trim(),
              customer: row["Захиалагч"] || "Аймгийн захиалагч",
              customerOrg: row["Байгууллага"] || "Салбар нэгж",
              receivedDate: String(recDateRaw).slice(0, 10),
              deliveryDate: String(depDateRaw).slice(0, 10),
              province: provinceClean,
              destination: destClean,
              quantity: Number(boxRaw) || 1000,
              unitPrice: Number(unitPriceRaw) || 1000,
              status: Number(kmRaw) > 0 ? "Дууссан" : "Тээвэрт гарсан",
              shareToken: crypto.randomBytes(32).toString("hex"),
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            };
            db.orders.push(order);
            newCount++;
          } else {
            updatedCount++;
          }

          // Create Assignment
          const asnId = "ASN-" + Date.now().toString().slice(-5) + "-" + idx;
          const token = "tok_drv_" + crypto.randomBytes(6).toString("hex");

          const assignment: IMDAssignment = {
            id: asnId,
            orderId: order.id,
            orderNo: order.orderNo,
            province: provinceClean,
            destination: destClean,
            vehicleId: cleanPlate,
            vehiclePlate: cleanPlate,
            primaryDriverId: matchedDriver.id,
            primaryDriverName: primaryName,
            substituteDriverName: subName,
            departureDate: String(depDateRaw).slice(0, 10),
            quantity: Number(boxRaw) || 1000,
            status: Number(kmRaw) > 0 ? "Дууссан" : "Тээвэрт гарсан",
            actualKm: Number(kmRaw) || undefined,
            token,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };

          db.assignments.push(assignment);
          order.assignmentId = asnId;
          importedAssignments.push(assignment);
          successCount++;
        } catch (itemErr: any) {
          errorCount++;
          errors.push(`Мөр ${idx + 1}: ${itemErr.message}`);
        }
      });

      logAudit("Менежер", "EXCEL_IMPORTED", `Excel импортлов: ${successCount} амжилттай, ${newCount} шинэ, ${updatedCount} шинэчлэгдсэн, ${errorCount} алдаатай.`);
      saveDB(db);

      res.json({
        success: true,
        message: `Excel мэдээлэл амжилттай боловсруулагдлаа: ${successCount} мөр амжилттай.`,
        totalRows: rows.length,
        successCount,
        newCount,
        updatedCount,
        errorCount,
        errors: errors.slice(0, 10),
        importedAssignments: importedAssignments.slice(0, 5)
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 9. AUDIT LOGS
  app.get("/api/imd/audit-logs", (req: Request, res: Response) => {
    try {
      res.json({ auditLogs: db.auditLogs || [] });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 9.5 IMD VEHICLES & BOX CAPACITY MANAGEMENT
  app.get("/api/imd/vehicles", (req: Request, res: Response) => {
    try {
      const drivers = db.drivers || [];
      const assignments = db.assignments || [];

      // Collect all IMD vehicles
      const vehiclesMap = new Map<string, any>();

      // 1. First add known IMD drivers
      drivers.forEach((d: any) => {
        if (d.vehicle && (d.isIMD || d.organization?.includes("Дистрибьюшн") || OFFICIAL_BOX_CAPACITY_MAP[d.vehicle.replace(/\s+/g, "").toUpperCase()])) {
          const cleanPlate = d.vehicle.replace(/\s+/g, "").toUpperCase();
          const cap = d.boxCapacity || OFFICIAL_BOX_CAPACITY_MAP[cleanPlate] || 700;
          
          // Find active assignment if any
          const activeAsn = assignments.find((a: any) => 
            a.vehiclePlate?.replace(/\s+/g, "").toUpperCase() === cleanPlate && 
            (a.status === "Тээвэрт гарсан" || a.status === "Төлөвлөсөн")
          );

          const totalTrips = assignments.filter((a: any) => 
            a.vehiclePlate?.replace(/\s+/g, "").toUpperCase() === cleanPlate && a.status === "Дууссан"
          ).length;

          vehiclesMap.set(cleanPlate, {
            id: d.id,
            plate: d.vehicle,
            cleanPlate,
            boxCapacity: cap,
            driverId: d.id,
            driverCode: d.code,
            driverName: d.name,
            driverPhone: d.phone,
            model: d.model || "Isuzu Forward",
            status: d.status || "active",
            organization: d.organization || "Айсмарк Дистрибьюшн ХХК",
            defaultRoute: d.defaultRoute,
            jobTitle: d.jobTitle || "ТҮГЭЭГЧ",
            activeAssignment: activeAsn || null,
            totalTrips
          });
        }
      });

      // 2. Ensure all 8 official vehicles are present even if not marked isIMD
      for (const [plate, cap] of Object.entries(OFFICIAL_BOX_CAPACITY_MAP)) {
        const cleanPlate = plate.replace(/\s+/g, "").toUpperCase();
        if (!vehiclesMap.has(cleanPlate)) {
          const matchedDriver = drivers.find((d: any) => d.vehicle?.replace(/\s+/g, "").toUpperCase() === cleanPlate);
          vehiclesMap.set(cleanPlate, {
            id: matchedDriver?.id || cleanPlate,
            plate,
            cleanPlate,
            boxCapacity: cap,
            driverId: matchedDriver?.id || "",
            driverCode: matchedDriver?.code || "",
            driverName: matchedDriver?.name || "Жолооч",
            driverPhone: matchedDriver?.phone || "",
            model: matchedDriver?.model || "Isuzu Forward",
            status: matchedDriver?.status || "active",
            organization: "Айсмарк Дистрибьюшн ХХК",
            defaultRoute: matchedDriver?.defaultRoute || "Орон нутаг томилолт",
            jobTitle: "ТҮГЭЭГЧ",
            activeAssignment: null,
            totalTrips: 0
          });
        }
      }

      const vehicles = Array.from(vehiclesMap.values());
      res.json({ vehicles, totalFleetCapacity: vehicles.reduce((sum, v) => sum + (v.boxCapacity || 0), 0) });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/imd/vehicles", (req: Request, res: Response) => {
    try {
      const { plate, boxCapacity, driverName, phone, model, defaultRoute, organization, code } = req.body;
      if (!plate || !plate.trim()) {
        return res.status(400).json({ error: "Машины улсын дугаар заавал шаардлагатай!" });
      }

      const cleanPlate = plate.trim().toUpperCase();
      const capNum = Number(boxCapacity) > 0 ? Number(boxCapacity) : (OFFICIAL_BOX_CAPACITY_MAP[cleanPlate.replace(/\s+/g, "")] || 700);
      const cleanName = driverName ? driverName.trim() : `Жолооч (${cleanPlate})`;
      const cleanCode = code ? String(code).trim().toUpperCase() : (cleanPlate.replace(/[^0-9]/g, "") || Date.now().toString().slice(-4));

      // Find if driver exists by vehicle or code
      if (!db.drivers) db.drivers = [];
      const existingIdx = db.drivers.findIndex((d: any) => 
        d.vehicle?.replace(/\s+/g, "").toUpperCase() === cleanPlate.replace(/\s+/g, "") ||
        d.code?.toUpperCase() === cleanCode ||
        d.id?.toUpperCase() === cleanCode
      );

      let savedDriver: any;
      if (existingIdx !== -1) {
        db.drivers[existingIdx] = {
          ...db.drivers[existingIdx],
          vehicle: cleanPlate,
          boxCapacity: capNum,
          name: cleanName,
          phone: phone ? phone.trim() : db.drivers[existingIdx].phone,
          model: model ? model.trim() : db.drivers[existingIdx].model,
          defaultRoute: defaultRoute !== undefined ? defaultRoute.trim() : db.drivers[existingIdx].defaultRoute,
          organization: organization ? organization.trim() : (db.drivers[existingIdx].organization || "Айсмарк Дистрибьюшн ХХК"),
          isIMD: true,
          jobTitle: "ТҮГЭЭГЧ"
        };
        savedDriver = db.drivers[existingIdx];
      } else {
        savedDriver = {
          id: cleanCode,
          code: cleanCode,
          name: cleanName,
          phone: phone ? phone.trim() : "",
          vehicle: cleanPlate,
          boxCapacity: capNum,
          model: model ? model.trim() : "Isuzu Forward",
          salesRep: "IMD Томилолт",
          defaultRoute: defaultRoute ? defaultRoute.trim() : "Орон нутаг холын томилолт",
          status: "active",
          organization: organization ? organization.trim() : "Айсмарк Дистрибьюшн ХХК",
          isIMD: true,
          jobTitle: "ТҮГЭЭГЧ",
          isCustom: true
        };
        db.drivers.push(savedDriver);
      }

      saveDB(db);
      logAudit("Менежер", "VEHICLE_REGISTER", `IMD тээврийн хэрэгсэл бүртгэгдлээ: ${cleanPlate} (${capNum} хайрцаг, ${cleanName})`, null, {
        plate: cleanPlate,
        boxCapacity: capNum,
        driver: cleanName
      });

      res.json({
        status: "success",
        vehicle: {
          id: savedDriver.id,
          plate: savedDriver.vehicle,
          cleanPlate: savedDriver.vehicle.replace(/\s+/g, "").toUpperCase(),
          boxCapacity: savedDriver.boxCapacity,
          driverId: savedDriver.id,
          driverCode: savedDriver.code,
          driverName: savedDriver.name,
          driverPhone: savedDriver.phone,
          model: savedDriver.model,
          status: savedDriver.status,
          organization: savedDriver.organization,
          defaultRoute: savedDriver.defaultRoute,
          jobTitle: savedDriver.jobTitle
        }
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put("/api/imd/vehicles/:plate", (req: Request, res: Response) => {
    try {
      const { plate } = req.params;
      const cleanPlate = decodeURIComponent(plate).replace(/\s+/g, "").toUpperCase();
      const { boxCapacity, driverName, phone, model, status, defaultRoute, organization } = req.body;

      const driverIdx = (db.drivers || []).findIndex((d: any) => d.vehicle?.replace(/\s+/g, "").toUpperCase() === cleanPlate);
      if (driverIdx === -1) {
        return res.status(404).json({ error: "Машин олдсонгүй" });
      }

      if (boxCapacity !== undefined && boxCapacity !== "") {
        db.drivers[driverIdx].boxCapacity = Number(boxCapacity);
      }
      if (driverName) db.drivers[driverIdx].name = driverName.trim();
      if (phone) db.drivers[driverIdx].phone = phone.trim();
      if (model) db.drivers[driverIdx].model = model.trim();
      if (status) db.drivers[driverIdx].status = status;
      if (defaultRoute !== undefined) db.drivers[driverIdx].defaultRoute = defaultRoute.trim();
      if (organization) db.drivers[driverIdx].organization = organization.trim();
      db.drivers[driverIdx].isIMD = true;

      saveDB(db);
      logAudit("Менежер", "VEHICLE_UPDATE", `IMD тээврийн хэрэгслийн мэдээлэл шинэчлэгдлээ: ${cleanPlate} (${db.drivers[driverIdx].boxCapacity} хайрцаг)`, null, {
        plate: cleanPlate,
        boxCapacity: db.drivers[driverIdx].boxCapacity
      });

      res.json({ status: "success", driver: db.drivers[driverIdx] });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 10. IMD OFFICIAL LETTERS MODULE (Google Docs / Drive / PDF Integration)
  setupOfficialLettersModule(app, db, saveDB, logAudit);
}
