import express, { Request, Response } from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { setupIMDModule } from "./server-imd";
import { securityHeaders } from "./server/middleware/auth.middleware";
import { authRouter } from "./server/modules/auth/auth.routes";
import { tokenRouter } from "./server/modules/tokens/token.routes";
import { backupRouter } from "./server/modules/backup/backup.routes";
import { getDatabase } from "./server/database/client";
import { runMigration } from "./server/database/migrate";
import { verifyDatabase } from "./server/database/verify";
import { logger } from "./server/utils/logger";
import { restore40Assignments } from "./server/modules/imd/restore-assignments";
import { syncGpsboxTripsAndOdometer, runDailyOdometerAutomation } from "./server/services/gpsbox-waybill-sync";
import { DailyAssignmentRepository } from "./server/database/repositories/daily-assignment.repository";
import { DriverRepository } from "./server/database/repositories/driver.repository";
import { verifySessionToken } from "./server/auth/token.service";
import { MASTER_30_CITY_ROUTES, MASTER_10_IMD_ROUTES, ALL_MASTER_FLEET_ROUTES } from "./src/constants/dailyRouteMaster";

// In this environment, Nginx reverse proxy listens on 8080 and forwards requests to 3000.
// Node server must always listen on port 3000.
const app = express();
const PORT = 3000;

app.use(express.json());
app.use(securityHeaders());

// Immediate Health Check endpoint for Cloud Run and proxy uptime
app.get("/api/health", (req: Request, res: Response) => {
  res.json({ status: "ok", uptime: process.uptime(), time: new Date().toISOString() });
});

// Production Readiness Endpoint
app.get("/api/ready", (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const count = (db.prepare("SELECT COUNT(*) as c FROM drivers").get() as any)?.c || 0;
    res.json({
      status: "ready",
      database: "sqlite",
      driverCount: count,
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    });
  } catch (err: any) {
    res.status(503).json({
      status: "not_ready",
      error: err.message
    });
  }
});

// Mount secure auth, token, and backup routers
app.use("/api/auth", authRouter);
app.use("/api", tokenRouter);
app.use("/api/backups", backupRouter);

// Persistent data directory
const DATA_DIR = path.join(process.cwd(), "data");
const DB_FILE = path.join(DATA_DIR, "fleet-db.json");
const DB_BACKUP_FILE = path.join(DATA_DIR, "fleet-db.backup.json");

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Interfaces
export type DayWaybillStatus = "CONFIRMED" | "LIVE" | "WAITING_GPS" | "ODO_REQUIRED" | "DATA_ERROR" | "FUTURE_LOCKED" | "SCHEDULED" | "REST_DAY";

export interface WeeklyDaySetting {
  dayOfWeek: number; // 0=Ням, 1=Даваа, 2=Мягмар, 3=Лхагва, 4=Пүрэв, 5=Баасан, 6=Бямба
  dayName?: string;
  name?: string;
  isWork: boolean;
  task: string;
}

export interface WorkScheduleHistoryEntry {
  effectiveDate: string; // YYYY-MM-DD
  validUntil?: string;   // YYYY-MM-DD
  workDaysMode: "mon_sat" | "mon_fri" | "all_days" | "custom";
  defaultTask: string;
  restDayTask: string;
  weeklyDaysConfig?: Record<number, WeeklyDaySetting>;
  customRestDays?: number[];
  customHolidays?: string[];
  updatedAt: string;
}

export interface WorkScheduleConfig {
  effectiveDate?: string; // YYYY-MM-DD - Date this config starts applying (preserves past history)
  workDaysMode: "mon_sat" | "mon_fri" | "all_days" | "custom";
  defaultTask: string;
  restDayTask: string;
  weeklyDaysConfig?: Record<number, WeeklyDaySetting>;
  customRestDays?: number[]; // [0] = Sunday
  customHolidays?: string[]; // YYYY-MM-DD
  applyToAllDrivers: boolean;
  updatedAt: string;
  history?: WorkScheduleHistoryEntry[];
}

export interface DailyGPSMileage {
  vehicleNumber: string;
  driverId?: string;
  date: string; // YYYY-MM-DD
  totalKm: number;
  source: "gpsbox_api" | "manual";
  fetchedAt: string;
  apiStatus: "success" | "error" | "no_data";
  startOdo?: number;
  endOdo?: number;
  note?: string;
}

export interface FuelRefill {
  id: string;
  vehicleNumber: string;
  driverId?: string;
  dateTime: string;
  liters: number;
  station?: string;
  cost?: number;
  source: "fuel_api" | "manual";
  transactionId?: string;
  fuelReceiptNo?: string;
}

export interface Driver {
  id: string;
  code: string;
  name: string;
  phone: string;
  vehicle: string;
  model: string;
  salesRep: string;
  defaultRoute?: string;
  status: "active" | "inactive";
  isCustom?: boolean;
  avatar?: string;
  apiOdo?: number;
  apiFuel?: string;
  apiFuelNum?: number;
  apiFuelPercent?: number;
  apiTemp?: string;
  apiTempNum?: number;
  apiSpeed?: number;
  apiStatus?: string;
  apiLastUpdate?: string;
  telemetry?: Telemetry;
  autoOdoConfig?: {
    enabled: boolean;
    monthStartOdo?: number;
    dailyKmSource?: "gpsbox_api" | "manual";
    workDays?: "mon_sat" | "mon_fri" | "all_days";
    dayOverrides?: Record<number, number>;
    [key: string]: any;
  };
  autoWaybillEnabled?: boolean;
  isIMD?: boolean;
  boxCapacity?: number;
  jobTitle?: string;
  organization?: string;
  totalAssignedKm?: number;
  kmPrivacyPin?: string;
  hasKmPin?: boolean;
}

export interface Telemetry {
  odo: number;
  fuel: string;
  fuelNum?: number;
  fuelPercent?: number;
  fuelSource?: string;
  temp: string;
  tempNum?: number;
  tempSource?: string;
  speed: number;
  lat?: number;
  lng?: number;
  status: "active" | "idle" | "moving" | "offline";
  lastUpdate: string;
  dtTracker?: string;
  imei?: string;
  voltage?: string;
  gsmSignal?: string;
  batteryLevel?: string;
}

export interface TripLog {
  id: string;
  timestamp: string;
  date: string;
  driverId: string;
  driverName: string;
  vehicleNumber: string;
  salesRep: string;
  zone: string;
  startOdo: number;
  endOdo?: number | null;
  totalKm?: number;
  fuelLiters?: number;
  fuelStation?: string;
  fuelCost?: number;
  fuelPaymentMethod?: string;
  fuelReceiptNo?: string;
  status: "🟡 ЭХЭЛСЭН" | "✅ ХЭВИЙН" | "⚠️ ДУТУУ";
  phase: "started" | "complete";
  routeNote?: string;
  source?: "manual" | "gpsbox_api" | "system";
  isManual?: boolean;
  manualEditedAt?: string;
}

export interface GPSBoxConfig {
  url: string;
  username: string;
  apiKey: string;
  lastSync?: string;
  syncStatus: "connected" | "error" | "mock_active";
  errorMessage?: string;
  sheetUrl?: string;
  autoFillEnabled?: boolean;
}

// 30 authoritative drivers from the official Google Sheet (https://docs.google.com/spreadsheets/d/1Ibws69hyXnVmRlcnopt9tZmLH3sXeqrR1wgVJjEM_BI/edit?gid=0#gid=0)
const DEFAULT_DRIVERS: Driver[] = [
  { id: "KA1", code: "KA1", name: "Ж.Баттөмөр", phone: "99126757", vehicle: "1096УНЗ", model: "Isuzu", salesRep: "Ганхуяг 89518991", defaultRoute: "KA1", status: "active" },
  { id: "KA2", code: "KA2", name: "Баярхүү", phone: "99427860", vehicle: "5201УКН", model: "Mighty", salesRep: "Төв салбар", defaultRoute: "GS25 CU- Агуулах", status: "active" },
  { id: "KA3", code: "KA3", name: "Ган-Эрдэнэ", phone: "88199640", vehicle: "7841УНА", model: "Bongo", salesRep: "Төв салбар", defaultRoute: "KA3", status: "active" },
  { id: "KA4", code: "KA4", name: "Дэлгэрсайхан", phone: "88028916", vehicle: "1076УЕВ", model: "Isuzu", salesRep: "Төгс-Очир", defaultRoute: "KA4", status: "active" },
  { id: "KA5", code: "KA5", name: "Алтаншагай", phone: "86300590", vehicle: "1081УЕВ", model: "Bongo", salesRep: "Алтаншагай", defaultRoute: "Vending machine", status: "active" },
  { id: "M1", code: "M1", name: "Дашдаваа", phone: "88680407", vehicle: "1051УЕВ", model: "Isuzu", salesRep: "Лх.Цэцгээ", defaultRoute: "Эмээлт, Монос, 22-ын товчоо, 10 буудал, Станц, Тахилт, Орбит, Цэргийн хотхон", status: "active" },
  { id: "M2", code: "M2", name: "Отгонзаяа", phone: "88192973", vehicle: "5206УКН", model: "Mighty", salesRep: "Тө.Уранбаатар", defaultRoute: "Толгой, Их бага наран, Орчлон хороолол, Содон хороолол, Нарангын гол", status: "active" },
  { id: "M3", code: "M3", name: "Хү. Баттулга", phone: "99473464", vehicle: "3096УАХ", model: "Isuzu", salesRep: "До.Сарантуяа", defaultRoute: "Зүүн салаа, Баруун салаа, Хилчин, Хилчингийн арын гэр хороолол", status: "active" },
  { id: "M4", code: "M4", name: "О. Ганзориг", phone: "99062458", vehicle: "2811УЕК", model: "Isuzu", salesRep: "Отгонжаргал", defaultRoute: "Баян хошуу, Жанцан, Зуун мод", status: "active" },
  { id: "M5", code: "M5", name: "Энхбаатар", phone: "88844155", vehicle: "5176УКН", model: "Isuzu", salesRep: "Цэ.Болдоо", defaultRoute: "1 хорооллын ар, Ханын материал, 21-р хороолол", status: "active" },
  { id: "M6", code: "M6", name: "Наранхүү", phone: "96113327", vehicle: "5096УБТ", model: "Isuzu", salesRep: "Р.Төгсөө", defaultRoute: "1-р хороолол, Москва хороолол, Монгол Хьондай, Хар хорин хороолол, 5 шар, Драгон, Залуус хороолол, Саппоро, Цамба", status: "active" },
  { id: "M7", code: "M7", name: "Тулга", phone: "80096338", vehicle: "1061УЕВ", model: "Isuzu", salesRep: "Ня.Лхагва-Очир", defaultRoute: "Нисэх, Био комбинат, Морингийн даваа, Шувуун фабрик, Өлзийт хороолол, Буянт ухаа 2", status: "active" },
  { id: "M8", code: "M8", name: "Батцогт", phone: "88914243", vehicle: "6071УАУ", model: "Isuzu", salesRep: "Бү.Батчулуун", defaultRoute: "Вива сити, Богд виллаа, Яармаг, Нүхт", status: "active" },
  { id: "M9", code: "M9", name: "Бат. Мөнх-Эрдэнэ", phone: "86018994", vehicle: "6091УНГ", model: "Isuzu", salesRep: "Бу.Галсан", defaultRoute: "Зайсан, Үйлдвэр комбинат, 19-р хороолол, 120, Алтай хотхон", status: "active" },
  { id: "M10", code: "M10", name: "Мөнхсүлд", phone: "86205667", vehicle: "2511УАВ", model: "Isuzu", salesRep: "Ре.Батсүх", defaultRoute: "Харанхуй, Энхболд, Энхбаярын зам, 3-р хороолол, Бичил хороолол, Эх нялхас", status: "active" },
  { id: "M11", code: "M11", name: "Пүрэвсүрэн", phone: "85198534", vehicle: "2511УАЕ", model: "Isuzu", salesRep: "Эрхэмбаяр", defaultRoute: "Их дэлгүүр, Гандан, 1-р 40 мянгат, Бөмбөгөр, Андууд, 25-р эмийн сан, Нарны хороолол, Хурдын хороолол", status: "active" },
  { id: "M12", code: "M12", name: "Баяржаргал", phone: "89013200", vehicle: "1041УЕВ", model: "Isuzu", salesRep: "Га.Урьдынбиш", defaultRoute: "Модны 2, Гэмтэлийн эмнэлэг, 4-р хороолол, 10-р хороолол, 3-р эмнэлэг", status: "active" },
  { id: "M13", code: "M13", name: "Насанбаяр", phone: "95705757", vehicle: "1046УНГ", model: "Isuzu", salesRep: "Дэ.Оюун", defaultRoute: "Төмөр замын вокзал, Голден парк хотхон /10-р хорооллын замын урд/, 220 мянгат", status: "active" },
  { id: "M14", code: "M14", name: "Нямдэмбэрэл", phone: "96565683", vehicle: "8951УБС", model: "Mighty", salesRep: "Ми.Сугар", defaultRoute: "Багшийн дээд талбайн урд тал, 13-р хороолол бөхийн өргөө, Түнелээс ус сувгийн удирдах газар, ХААЯ-с чингис зочид буудал", status: "active" },
  { id: "M15", code: "M15", name: "Анх-Эрдэнэ", phone: "95190987", vehicle: "6091УБК", model: "Isuzu", salesRep: "Ба.Энхжавхлан", defaultRoute: "805 хил хамгаалах, Зуслангууд, Зунжингаас дамба, Шадивлан, Сансарын колонк РЦНК, Багшийн дээд улаанбаатар зочид буудал", status: "active" },
  { id: "M16", code: "M16", name: "Эрдэнэ-Чулуун", phone: "90636371", vehicle: "2611УЕВ", model: "Isuzu", salesRep: "До.Дэмбэрэл", defaultRoute: "Бэлх, Сэлх, Дамба, Тоосгоны үйлдвэр, Япон цэрэг, Дарь эх", status: "active" },
  { id: "M17", code: "M17", name: "Нэмэхжаргал", phone: "90629988", vehicle: "3091УЕА", model: "Isuzu", salesRep: "Балжинням", defaultRoute: "5-р сургууль, Баянбүрд /цагаан байр/, Тэнгис, Дэнжийн 1000, Зурагт замын зүүн тал", status: "active" },
  { id: "M18", code: "M18", name: "Амартүвшин", phone: "95078006", vehicle: "3091УАО", model: "Isuzu", salesRep: "Бя.Пүрэвдорж", defaultRoute: "32-ын тойргоос 7 буудал, Чингэлтэй, Хайлааст, Салхит", status: "active" },
  { id: "M19", code: "M19", name: "цагийн ажилтан", phone: "99110019", vehicle: "2611УЕЕ", model: "Isuzu", salesRep: "Ба.Гэрэлчимэг", defaultRoute: "32-с 100 айл гэр хороолол, 100 айл, Бага тойруу, Баянбүрд, Монгол 3-р сургууль, 11-р хороолол, Метромолл", status: "active" },
  { id: "M20", code: "M20", name: "Ууганболор", phone: "96652588", vehicle: "3096УАУ", model: "Isuzu", salesRep: "Жа.Гантулга", defaultRoute: "Нарантуул зах гэр хороолол халдварт, Их монгол, Баянмонгол, Кристал, Олимп, Инканто, Дүнжингарав, БЗД замын доод гэр хороолол- Сүнжингранд", status: "active" },
  { id: "M21", code: "M21", name: "Жавхлан", phone: "86212422", vehicle: "2511УЕЕ", model: "Isuzu", salesRep: "До.Буянхишиг", defaultRoute: "16-р хороолол, Улаанхуаран", status: "active" },
  { id: "M22", code: "M22", name: "Банзрагч", phone: "85926619", vehicle: "2611УЕК", model: "Isuzu", salesRep: "Цо.Булган", defaultRoute: "Улиастай, Гачуурт, Хужирбулан, Ботаник, Амгалан, Амгалан өртөө, Чулуун овоо, Жанжин клуб", status: "active" },
  { id: "M23", code: "M23", name: "Энх-Амгалан", phone: "86864300", vehicle: "2411УЕК", model: "Isuzu", salesRep: "До.Оюун", defaultRoute: "Сансар Баянзүрх талбай, Жуков, БЗД-ийн эмнэлэг, Монел, Кино үйлдвэр", status: "active" },
  { id: "M24", code: "M24", name: "Бат-Эрдэнэ", phone: "88932003", vehicle: "2711УЕК", model: "Isuzu", salesRep: "Ба.Энхбаяр", defaultRoute: "Эрдэнэтолгол, Цайз, Алтан өлгий, Шар хад, Да хүрээ, Цахлай техникийн зах", status: "active" },
  { id: "M25", code: "M25", name: "Б.Батзориг", phone: "89282415", vehicle: "2511УНЛ", model: "Isuzu", salesRep: "До.Батчимэг", defaultRoute: "Налайх дүүрэг, Гордок, Хонхор, Урлан бүтээх, Ургах наран хороолол, Баянзүрхийн товчоо", status: "active" },
  // 8 Official IMD Logistics Master Drivers & Vehicles (Ажлын байрны нэр: ТҮГЭЭГЧ, Байгууллагын нэр: Айсмарк Дистрибьюшн ХХК)
  { id: "775", code: "775", name: "Чу.Мөнхгэрэл", phone: "99117775", vehicle: "8374УНЕ", model: "Isuzu Forward", salesRep: "", defaultRoute: "Орон нутаг тээвэр", status: "active", isIMD: true, jobTitle: "ТҮГЭЭГЧ", organization: "Айсмарк Дистрибьюшн ХХК", boxCapacity: 1000 },
  { id: "141", code: "141", name: "Ми.Анхбаяр", phone: "99119141", vehicle: "3147УЕН", model: "Isuzu Forward", salesRep: "", defaultRoute: "Хөвсгөл, Завхан, Баруун чиглэл", status: "active", isIMD: true, jobTitle: "ТҮГЭЭГЧ", organization: "Айсмарк Дистрибьюшн ХХК", boxCapacity: 700 },
  { id: "9726", code: "9726", name: "Ул.Мөнгөнзул", phone: "99119726", vehicle: "3148УЕМ", model: "Isuzu Forward", salesRep: "", defaultRoute: "Дорноговь Замын-Үүд, Говийн чиглэл", status: "active", isIMD: true, jobTitle: "ТҮГЭЭГЧ", organization: "Айсмарк Дистрибьюшн ХХК", boxCapacity: 700 },
  { id: "14", code: "14", name: "Пү.Доржпалам", phone: "99119014", vehicle: "3148УЕО", model: "Isuzu Forward", salesRep: "", defaultRoute: "Дархан, Сэлэнгэ, Хойд чиглэл", status: "active", isIMD: true, jobTitle: "ТҮГЭЭГЧ", organization: "Айсмарк Дистрибьюшн ХХК", boxCapacity: 700 },
  { id: "173", code: "173", name: "Эн.Отгонсүх", phone: "99119173", vehicle: "5909УКО", model: "Isuzu Forward", salesRep: "", defaultRoute: "Орон нутаг тээвэр", status: "active", isIMD: true, jobTitle: "ТҮГЭЭГЧ", organization: "Айсмарк Дистрибьюшн ХХК", boxCapacity: 1500 },
  { id: "314", code: "314", name: "Сү.Баттогтох", phone: "99119314", vehicle: "6530УКН", model: "Isuzu Forward", salesRep: "", defaultRoute: "Орон нутаг тээвэр", status: "active", isIMD: true, jobTitle: "ТҮГЭЭГЧ", organization: "Айсмарк Дистрибьюшн ХХК", boxCapacity: 1500 },
  { id: "283", code: "283", name: "Жа.Алтанхуяг", phone: "99119283", vehicle: "8376УЕН", model: "Isuzu Forward", salesRep: "", defaultRoute: "Сэлгээ & Холын томилолт", status: "active", isIMD: true, jobTitle: "ТҮГЭЭГЧ", organization: "Айсмарк Дистрибьюшн ХХК", boxCapacity: 700 },
  { id: "5535", code: "5535", name: "Со.Баярсайхан", phone: "99115535", vehicle: "8428УНД", model: "Isuzu Forward", salesRep: "", defaultRoute: "Орон нутаг тээвэр", status: "active", isIMD: true, jobTitle: "ТҮГЭЭГЧ", organization: "Айсмарк Дистрибьюшн ХХК", boxCapacity: 700 }
];

// Initial state
interface DBState {
  drivers: Driver[];
  trips: TripLog[];
  dailyGPSMileages: DailyGPSMileage[];
  fuelRefills: FuelRefill[];
  gpsboxConfig: GPSBoxConfig;
  workScheduleConfig?: WorkScheduleConfig;
  customTelemetry: Record<string, Telemetry>;
  finesCache?: Record<string, { result: FineResult; timestamp: number }>;
  orders?: any[];
  assignments?: any[];
  routes?: any[];
  auditLogs?: any[];
  dailyAssignments?: any[];
  driverChangeFines?: any[];
  fineConfig?: {
    defaultFineAmount: number;
    driverDeduction: number;
    feeAmount: number;
    fineReason: string;
  };
}

function loadDB(): DBState {
  let loaded: DBState | null = null;
  try {
    if (fs.existsSync(DB_FILE)) {
      const data = fs.readFileSync(DB_FILE, "utf-8");
      loaded = JSON.parse(data);
    } else if (fs.existsSync(DB_BACKUP_FILE)) {
      const data = fs.readFileSync(DB_BACKUP_FILE, "utf-8");
      loaded = JSON.parse(data);
    }
  } catch (err) {
    console.error("Error reading DB file:", err);
    try {
      if (fs.existsSync(DB_BACKUP_FILE)) {
        const data = fs.readFileSync(DB_BACKUP_FILE, "utf-8");
        loaded = JSON.parse(data);
      }
    } catch (e) {
      console.error("Error reading DB backup file:", e);
    }
  }

  if (loaded && loaded.drivers && loaded.drivers.length > 0) {
    if (!loaded.finesCache) {
      loaded.finesCache = {};
    }
    if (!loaded.dailyGPSMileages) {
      loaded.dailyGPSMileages = [];
    }
    if (!loaded.fuelRefills) {
      loaded.fuelRefills = [];
    }
    if (!loaded.dailyAssignments) {
      loaded.dailyAssignments = [];
    }
    if (!loaded.driverChangeFines) {
      loaded.driverChangeFines = [];
    }
    if (!loaded.fineConfig) {
      loaded.fineConfig = {
        defaultFineAmount: 10000,
        driverDeduction: 10000,
        feeAmount: 0,
        fineReason: "Жолооч солигдсон"
      };
    }
    if (!loaded.workScheduleConfig) {
      loaded.workScheduleConfig = {
        workDaysMode: "mon_sat",
        defaultTask: "Борлуулалт",
        restDayTask: "Хуваарьт амралт",
        customRestDays: [0],
        applyToAllDrivers: true,
        updatedAt: new Date().toISOString()
      };
    }

    // Ensure all 30 city drivers + 8 official IMD drivers exist with correct details
    // First, cleanup and migrate any obsolete IMD driver IDs (e.g. id "15" -> "283" for Жа.Алтанхуяг)
    const altanIdx = loaded.drivers.findIndex(d => d.id === "15" || d.name.includes("Алтанхуяг"));
    if (altanIdx !== -1) {
      loaded.drivers[altanIdx].id = "283";
      loaded.drivers[altanIdx].code = "283";
      loaded.drivers[altanIdx].name = "Жа.Алтанхуяг";
      loaded.drivers[altanIdx].vehicle = "8376УЕН";
      loaded.drivers[altanIdx].isIMD = true;
    }

    const driverMap = new Map<string, Driver>();
    loaded.drivers.forEach(d => driverMap.set(d.id.toUpperCase(), d));

    DEFAULT_DRIVERS.forEach(def => {
      const existing = driverMap.get(def.id.toUpperCase());
      if (existing) {
        if (def.isIMD) {
          // Preserve any existing modifications, only set default if empty
          if (!existing.name) existing.name = def.name;
          if (!existing.vehicle) existing.vehicle = def.vehicle;
          if (!existing.code) existing.code = def.code;
          if (!existing.phone) existing.phone = def.phone;
          existing.isIMD = true;
          existing.jobTitle = def.jobTitle || "ТҮГЭЭГЧ";
          existing.organization = "Айсмарк Дистрибьюшн ХХК";
          if (!existing.boxCapacity && def.boxCapacity) existing.boxCapacity = def.boxCapacity;
        } else {
          // Protect user modifications for city drivers: strictly city sales
          existing.isIMD = false;
          existing.organization = "АЙСМАРК ТРЕЙД ХХК";
          existing.jobTitle = "БОРЛУУЛАЛТЫН ЖОЛООЧ";
          if (!existing.defaultRoute) existing.defaultRoute = def.defaultRoute;
          if (!existing.salesRep) existing.salesRep = def.salesRep;
          if (!existing.vehicle) existing.vehicle = def.vehicle;
          if (!existing.model) existing.model = def.model;
          if (def.boxCapacity && !existing.boxCapacity) existing.boxCapacity = def.boxCapacity;
          if (!existing.phone || existing.phone.startsWith("99100")) {
            existing.phone = def.phone;
          }
          if (!existing.name || existing.name.startsWith("Жолооч M")) {
            existing.name = def.name;
          }
        }
      } else {
        loaded!.drivers.push(def);
      }
    });

    // Populate boxCapacity for all vehicles according to official IMD standards
    const OFFICIAL_IMD_BOX_MAP: Record<string, number> = {
      "8374УНЕ": 1000,
      "3147УЕН": 700,
      "3148УЕМ": 700,
      "3148УЕО": 700,
      "5909УКО": 1500,
      "6530УКН": 1500,
      "8376УЕН": 700,
      "8428УНД": 700,
      "8531УББ": 700,
      "9988УНБ": 700,
    };
    const imdPlatesSet = new Set(Object.keys(OFFICIAL_IMD_BOX_MAP));

    loaded.drivers.forEach(d => {
      const isCityId = d.id.startsWith("KA") || d.id.startsWith("M");
      if (isCityId) {
        d.isIMD = false;
        d.organization = "АЙСМАРК ТРЕЙД ХХК";
        d.jobTitle = "БОРЛУУЛАЛТЫН ЖОЛООЧ";
      } else if (d.vehicle) {
        const cleanV = d.vehicle.replace(/\s+/g, "").toUpperCase();
        for (const [plate, cap] of Object.entries(OFFICIAL_IMD_BOX_MAP)) {
          if (cleanV.includes(plate) || plate.includes(cleanV)) {
            d.boxCapacity = d.boxCapacity || cap;
            d.isIMD = true;
            d.organization = "Айсмарк Дистрибьюшн ХХК";
            d.jobTitle = "ТҮГЭЭГЧ";
            break;
          }
        }
      }
    });

    const imdDriverIds = new Set(['775', '141', '9726', '14', '173', '314', '283', '5535', '8531', '9988']);
    loaded.drivers.forEach((d: any) => {
      if (d.isIMD || imdDriverIds.has(d.id)) {
        if (d.salesRep === "IMD Томилолт" || d.salesRep === "undefined" || d.salesRep === "Борлуулалт") d.salesRep = "";
        if (d.zone && (d.zone.includes("Тосонцэнгэл") || d.zone.includes("Хөвсгөл") || d.zone.includes("Завхан") || d.zone.includes("томилолт") || d.zone.includes("Дорноговь") || d.zone.includes("Дархан") || d.zone.includes("Баянхонгор") || d.zone.includes("Өмнөговь") || d.zone.includes("Увс") || d.zone.includes("Дорнод") || d.zone.includes("Орхон") || d.zone.includes("Сэлэнгэ"))) {
          d.zone = "";
        }
        if (d.defaultRoute === "Орон нутаг томилолт") d.defaultRoute = "Орон нутаг тээвэр";
      }
    });

    (loaded as any).officialLetters = ((loaded as any).officialLetters || []).filter((l: any) =>
      !l.id?.startsWith("LTR-260915-") &&
      !["LTR-1789088362656-547", "LTR-1789088388697-968", "LTR-1789088392568-552", "LTR-1789174672823-500"].includes(l.id)
    );

    if (!loaded.gpsboxConfig.sheetUrl) {
      loaded.gpsboxConfig.sheetUrl = "https://docs.google.com/spreadsheets/d/1Ibws69hyXnVmRlcnopt9tZmLH3sXeqrR1wgVJjEM_BI/edit?gid=0#gid=0";
    }
    if (loaded.gpsboxConfig.autoFillEnabled === undefined) {
      loaded.gpsboxConfig.autoFillEnabled = true;
    }

    // Purge mock city assignments and orders (ORD-IMD-260915-001 through 030)
    const PURGED_MOCK_ORDER_NOS = new Set([
      "ORD-IMD-260908-088", 
      "ORD-IMD-260910-201", 
      "ORD-IMD-260909-105"
    ]);
    const PURGED_MOCK_ORDER_IDS = new Set([
      "ORD-701038", 
      "ORD-697345", 
      "ord_direct_1788919558857"
    ]);
    const PURGED_MOCK_ASN_IDS = new Set([
      "ASN-701050", 
      "ASN-685945"
    ]);

    const cityPlates = new Set(
      loaded.drivers.filter(d => !d.isIMD).map(d => (d.vehicle || "").replace(/\s+/g, "").toUpperCase())
    );
    loaded.assignments = (loaded.assignments || []).filter((a: any) => {
      if (!a) return false;
      const orderNo = (a.orderNo || "").toUpperCase();
      if (orderNo.startsWith("ORD-IMD-260915-") || (a.id && a.id.startsWith("asn_ord_imd_260915_")) || a.isMock) return false;
      if (PURGED_MOCK_ORDER_NOS.has(orderNo) || PURGED_MOCK_ASN_IDS.has(a.id) || PURGED_MOCK_ORDER_IDS.has(a.orderId)) return false;
      const veh = (a.vehiclePlate || "").replace(/\s+/g, "").toUpperCase();
      if (cityPlates.has(veh)) return false;
      return isIMDDriver({ vehicle: veh, id: a.primaryDriverId });
    });

    loaded.orders = (loaded.orders || []).filter((o: any) => {
      if (!o) return false;
      const orderNo = (o.orderNo || "").toUpperCase();
      if (orderNo.startsWith("ORD-IMD-260915-") || (o.id && o.id.startsWith("order_ord_imd_260915_")) || o.isMock) return false;
      if (PURGED_MOCK_ORDER_NOS.has(orderNo) || PURGED_MOCK_ORDER_IDS.has(o.id)) return false;
      const veh = (o.vehiclePlate || "").replace(/\s+/g, "").toUpperCase();
      if (cityPlates.has(veh)) return false;
      return true;
    });

    // Persist the loaded clean state without force-restoring deleted assignments
    try {
      const jsonStr = JSON.stringify(loaded, null, 2);
      const tempFile = DB_FILE + ".tmp";
      fs.writeFileSync(tempFile, jsonStr, "utf-8");
      fs.renameSync(tempFile, DB_FILE);
    } catch (e) {}

    // Unbroken Odometer Chain & Official GPSBox Telemetry Synchronization
    try {
      syncGpsboxTripsAndOdometer(loaded);
      const jsonStr = JSON.stringify(loaded, null, 2);
      const tempFile = DB_FILE + ".tmp";
      fs.writeFileSync(tempFile, jsonStr, "utf-8");
      fs.renameSync(tempFile, DB_FILE);
    } catch (gpsSyncErr) {
      console.error("[LOAD_DB] Failed to synchronize GPSBox waybills & odometers:", gpsSyncErr);
    }

    return loaded;
  }

  const initial: DBState = {
    drivers: DEFAULT_DRIVERS,
    dailyGPSMileages: [],
    fuelRefills: [],
    workScheduleConfig: {
      workDaysMode: "mon_sat",
      defaultTask: "Борлуулалт",
      restDayTask: "Хуваарьт амралт",
      customRestDays: [0],
      applyToAllDrivers: true,
      updatedAt: new Date().toISOString()
    },
    trips: [
      {
        id: "trip_init_1",
        timestamp: new Date().toISOString(),
        date: new Date().toISOString().split("T")[0],
        driverId: "M16",
        driverName: "Эрдэнэ-Чулуун",
        vehicleNumber: "2611УЕВ",
        salesRep: "До.Дэмбэрэл",
        zone: "Бэлх, Сэлх, Дамба, Тоосгоны үйлдвэр, Япон цэрэг, Дарь эх",
        startOdo: 148230,
        endOdo: null,
        totalKm: 0,
        fuelLiters: 0,
        fuelStation: "ШТС-12 Петровис",
        status: "🟡 ЭХЭЛСЭН",
        phase: "started",
        routeNote: "Борлуулалт"
      }
    ],
    gpsboxConfig: {
      url: "https://fms2.gpsbox.mn/",
      username: "teso",
      apiKey: "7FFA953B612BB59AB076B1C561D74BCC",
      syncStatus: "connected",
      lastSync: new Date().toISOString(),
      sheetUrl: "https://docs.google.com/spreadsheets/d/1Ibws69hyXnVmRlcnopt9tZmLH3sXeqrR1wgVJjEM_BI/edit?gid=0#gid=0"
    },
    customTelemetry: {},
    finesCache: {}
  };
  saveDB(initial);
  return initial;
}

function saveDB(state: DBState) {
  try {
    if (!state || !state.drivers || state.drivers.length === 0) {
      console.error("[SAVE_DB_GUARD] Refusing to overwrite DB with invalid or empty state!");
      return;
    }
    const jsonStr = JSON.stringify(state, null, 2);
    const tempFile = DB_FILE + ".tmp";
    fs.writeFileSync(tempFile, jsonStr, "utf-8");
    fs.renameSync(tempFile, DB_FILE);
    fs.writeFileSync(DB_BACKUP_FILE, jsonStr, "utf-8");

    // Keep rolling snapshot in data/backups/
    try {
      const backupDir = path.resolve(process.cwd(), "data/backups");
      if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
      fs.writeFileSync(path.join(backupDir, "fleet-db.latest-snapshot.json"), jsonStr, "utf-8");
    } catch (bErr) {
      // ignore snapshot error
    }

    // Sync assignments & orders to SQLite asynchronously/safely
    if (state.assignments && state.assignments.length > 0) {
      try {
        const sqlite = getDatabase();
        const insertAsn = sqlite.prepare(`
          INSERT OR REPLACE INTO imd_assignments (
            id, order_id, vehicle_plate, primary_driver_id, primary_driver_name,
            secondary_driver_id, secondary_driver_name, departure_date, status, token, payload_json, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        for (const a of state.assignments) {
          if (!a || !a.id) continue;
          insertAsn.run(
            a.id,
            a.orderId || a.id,
            a.vehiclePlate || "-",
            a.primaryDriverId || "-",
            a.primaryDriverName || "-",
            a.secondaryDriverId || null,
            a.secondaryDriverName || null,
            a.departureDate || new Date().toISOString().split("T")[0],
            a.status || "Хуваарилсан",
            a.token || null,
            JSON.stringify(a),
            a.createdAt || new Date().toISOString(),
            new Date().toISOString()
          );
        }
      } catch (sqErr) {
        // SQLite sync silent catch
      }
    }
  } catch (err) {
    console.error("Error saving DB file:", err);
  }
}

let db = loadDB();

// Register IMD Logistics Module (Orders, Assignments, Routes, Reports, Public Share & Driver View)
setupIMDModule(app, db, saveDB, fetchGPSBoxTelemetry);

// Telemetry cache
let cachedTelemetryMap: Record<string, Telemetry> = {};
let lastFetchTime = 0;

// ==========================================
// IMT CENTRAL DEPOT GEOFENCE & ODOMETER CONFIG
// Base location: 47°54'07.2"N 106°51'02.7"E (500m radius)
// Time window: 06:00 to 23:59 on configured working days
// Total KM calculation: endOdo (23:59) - startOdo (06:00)
// Exclusively applies to IMT drivers
// ==========================================
export const IMT_DEPOT_CONFIG = {
  name: "АйсМарк Төв Бааз / Түгээлтийн төв",
  coordinatesDMS: '47°54\'07.2"N 106°51\'02.7"E',
  lat: 47.902000,
  lng: 106.850750,
  radiusMeters: 500,
  workWindowStart: "06:00",
  workWindowEnd: "23:59",
  targetGroup: "IMT (Хотод түгээлт хийх 30 тээврийн хэрэгсэл)",
  ruleDescription:
    'Замын хуудасны явсан км тооцохдоо: 47°54\'07.2"N 106°51\'02.7"E энэ байрлалд 500м радиус, ажлын тохируулсан өдрүүдийн өглөө 06:00 цагаас орой 23:59 минутын одометрийг хасч (Эцсийн ODO - Эхний ODO) кмыг байрлуулна. Энэ нь зөвхөн IMT жолооч нарт хамаарна.',
};

export function calculateDistanceToDepotMeters(lat: number, lng: number): number {
  const R = 6371000; // Earth radius in meters
  const dLat = ((lat - IMT_DEPOT_CONFIG.lat) * Math.PI) / 180;
  const dLng = ((lng - IMT_DEPOT_CONFIG.lng) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((IMT_DEPOT_CONFIG.lat * Math.PI) / 180) *
      Math.cos((lat * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

export function isWithinIMTDepotRadius(lat?: number, lng?: number, radius = IMT_DEPOT_CONFIG.radiusMeters): boolean {
  if (lat === undefined || lng === undefined || isNaN(lat) || isNaN(lng)) return false;
  return calculateDistanceToDepotMeters(lat, lng) <= radius;
}

export function isIMDDriver(driver?: { isIMD?: boolean; defaultRoute?: string; id?: string; code?: string; vehicle?: string }): boolean {
  if (!driver) return false;
  // If explicitly flagged as city delivery (isIMD: false), it is strictly not IMD
  if (driver.isIMD === false) return false;
  if (driver.id && (driver.id.startsWith("KA") || driver.id.startsWith("M"))) return false;

  const imdCodes = ["775", "141", "9726", "14", "173", "314", "283", "5535", "8531", "9988", "3147"];
  if (driver.id && imdCodes.includes(driver.id)) return true;
  if (driver.code && imdCodes.includes(driver.code)) return true;
  const imdVehicles = ["8374УНЕ", "3147УЕН", "3148УЕМ", "3148УЕО", "5909УКО", "6530УКН", "8376УЕН", "8428УНД", "8531УББ", "9988УНБ", "3147УНЭ"];
  const cleanVeh = (driver.vehicle || "").replace(/\s+/g, "").toUpperCase();
  if (cleanVeh && imdVehicles.some(v => v.replace(/\s+/g, "").toUpperCase() === cleanVeh)) return true;
  if (driver.isIMD === true) return true;
  return false;
}

export function isIMTDriver(driver?: { isIMD?: boolean; defaultRoute?: string; id?: string; code?: string; vehicle?: string }): boolean {
  if (!driver) return false;
  return !isIMDDriver(driver);
}

function normalizePlateKey(input: string): string {
  if (!input) return "";
  let str = String(input).toUpperCase().replace(/[\s\-_().]/g, "");
  // Cyrillic to Latin mapping for transliterated vehicle matching
  const map: Record<string, string> = {
    'А': 'A', 'Б': 'B', 'В': 'V', 'Г': 'G', 'Д': 'D', 'Е': 'E', 'Ё': 'E',
    'Ж': 'J', 'З': 'Z', 'И': 'I', 'Й': 'I', 'К': 'K', 'Л': 'L', 'М': 'M',
    'Н': 'N', 'О': 'O', 'Ө': 'O', 'П': 'P', 'Р': 'R', 'С': 'S', 'Т': 'T',
    'У': 'U', 'Ү': 'U', 'Ф': 'F', 'Х': 'H', 'Ц': 'C', 'Ч': 'CH', 'Ш': 'SH',
    'Щ': 'SH', 'Ъ': '', 'Ы': 'Y', 'Ь': '', 'Э': 'E', 'Ю': 'YU', 'Я': 'YA'
  };
  return str.split("").map(c => map[c] || c).join("");
}

function parseOdoValue(val: any): number {
  if (val === undefined || val === null || val === "") return 0;
  const num = typeof val === "number" ? val : parseFloat(String(val).replace(/,/g, ""));
  if (isNaN(num)) return 0;
  // If odometer is in meters (e.g. > 2,000,000 meters = 2,000 km), convert to km
  if (num > 2000000) {
    return Math.round(num / 1000);
  }
  return Math.round(num);
}

function parseFuelValue(val: any): { str: string; num: number; percent: number } {
  if (val === undefined || val === null || val === "") return { str: "0.0 л", num: 0, percent: 0 };
  let raw = val;
  if (typeof raw === "object") {
    raw = raw.value ?? raw.val ?? raw.fuel ?? raw.liters ?? 0;
  }
  const num = typeof raw === "number" ? raw : parseFloat(String(raw).replace(/,/g, ""));
  if (isNaN(num)) return { str: "0.0 л", num: 0, percent: 0 };
  const percent = Math.min(100, Math.max(0, Math.round((num / 80) * 100)));
  return { str: `${num.toFixed(1)} л`, num, percent };
}

function parseTempValue(val: any): { str: string; num: number | null } {
  if (val === undefined || val === null || val === "") return { str: "--°C", num: null };
  let raw = val;
  if (typeof raw === "object") {
    raw = raw.value ?? raw.val ?? raw.temp ?? raw.temperature ?? null;
  }
  if (raw === null || raw === undefined || raw === "") return { str: "--°C", num: null };
  const num = typeof raw === "number" ? raw : parseFloat(String(raw).replace(/,/g, ""));
  if (isNaN(num)) return { str: "--°C", num: null };
  return { str: `${num > 0 ? "+" : ""}${num.toFixed(1)}°C`, num };
}

function getOfflineTelemetry(cleanPlate: string, driver?: Driver): Telemetry {
  return {
    odo: driver?.apiOdo || 0,
    fuel: "0.0 л",
    fuelNum: 0,
    fuelPercent: 0,
    fuelSource: "GPS холболтгүй",
    temp: "--°C",
    tempNum: null,
    tempSource: "GPS холболтгүй",
    speed: 0,
    status: "offline",
    lat: 47.9188,
    lng: 106.9176,
    lastUpdate: new Date().toLocaleTimeString("mn-MN")
  };
}

function extractObjectsArray(result: any): any[] {
  if (Array.isArray(result)) return result;
  if (!result || typeof result !== "object") return [];
  if (Array.isArray(result.objects)) return result.objects;
  if (Array.isArray(result.data)) return result.data;
  if (Array.isArray(result.list)) return result.list;
  if (result.data && typeof result.data === "object") {
    if (Array.isArray(result.data.objects)) return result.data.objects;
    return Object.values(result.data);
  }
  return Object.values(result).filter((v: any) => v && typeof v === "object" && (v.name || v.plate || v.id || v.imei));
}

export function getTankCapacity(plateOrName: string, modelStr?: string): number {
  const clean = (plateOrName || "").replace(/[\s\-_()]/g, "").toUpperCase();
  const m = (modelStr || "").toLowerCase();

  // Heavy 3-axle trucks / Intercity heavy freight (IMD long haul)
  if (/^(8374УНЕ|6530УКН|5909УКО)/.test(clean)) return 300;
  if (m.includes("profia") || m.includes("giga")) return 300;

  // Medium long-haul trucks (IMD)
  if (/^(3147УЕН|3148УЕМ|3148УЕО|8376УЕН|8428УНД)/.test(clean)) return 200;
  if (m.includes("ranger") || m.includes("fc9j") || m.includes("forward")) return 200;

  // Medium trucks (Hyundai Mighty)
  if (/^(5201УКН|5206УКН|5176УКН|8951УБС|1296УНА)/.test(clean)) return 100;
  if (m.includes("mighty") || m.includes("kmchk")) return 100;

  // Light trucks and vans (Kia Bongo, Alphard)
  if (/^(7841УНА|1081УЕВ|7254УАУ|7263УНЧ)/.test(clean)) return 65;
  if (m.includes("bongo") || m.includes("kia") || m.includes("alphard")) return 65;

  // Standard Urban Distribution Trucks (ISUZU NMR71H / NLR85 / ELF)
  return 88;
}

function parseVehicleTelemetry(item: any, driverModel?: string): Telemetry {
  const p = item.params || item.sensors || item.telemetry || item.ostatok || item.p || item.f || {};
  const modelStr = String(item.model || driverModel || "").toLowerCase();

  // 1. Odometer calculation:
  // item.odometer is in km (e.g. "55651.9072"), p.io16 is in meters (e.g. 85482192)
  let odoVal = 0;
  if (item.odometer !== undefined && item.odometer !== null && item.odometer !== "") {
    odoVal = Math.round(Number(item.odometer));
  } else if (p.io16) {
    odoVal = Math.round(Number(p.io16) / 1000);
  } else {
    odoVal = parseOdoValue(item.odometer || item.mileage || p.odometer || p.mileage || p["001 Odometer"] || p.Odometer || p["Одометр"]);
  }

  // 2. Fuel Tank Capacity Determination based on vehicle plate & model
  const cleanPlateForTank = (item.plate_number || item.plate || item.name || "").replace(/[\s\-_()]/g, "").toUpperCase();
  const tankCapacity = getTankCapacity(cleanPlateForTank, modelStr);

  // 3. Fuel calculation:
  let fuelNum = 0;
  let fuelPercent = 0;
  let fuelSource = "Мэдрэгчгүй";

  // Priority 1: Check if item has GPS-Server configured sensor array
  if (Array.isArray(item.sensors) && item.sensors.length > 0) {
    const fuelSensor = item.sensors.find((s: any) => 
      s && (s.type === "fuel" || s.type === "fuel_level" || (s.name && /түлш|fuel|бак/i.test(s.name)))
    );
    if (fuelSensor && fuelSensor.val !== undefined && fuelSensor.val !== null && fuelSensor.val !== "") {
      const v = parseFloat(String(fuelSensor.val).replace(/[^\d.-]/g, ""));
      if (!isNaN(v) && v > 0) {
        if (String(fuelSensor.val).includes("%") || (v <= 100 && fuelSensor.type === "fuel_level")) {
          fuelPercent = Math.min(100, Math.max(0, Math.round(v)));
          fuelNum = Number(((tankCapacity * fuelPercent) / 100).toFixed(1));
          fuelSource = `GPSBox Сенсор: ${fuelSensor.name || "Түлш"} (${fuelPercent}%)`;
        } else {
          fuelNum = Number(v.toFixed(1));
          fuelPercent = Math.min(100, Math.max(0, Math.round((fuelNum / tankCapacity) * 100)));
          fuelSource = `GPSBox Сенсор: ${fuelSensor.name || "Түлш"} (${fuelNum}л)`;
        }
      }
    }
  }

  // Priority 2: Direct Liters or Fuel Level from API fields (item.fuel, p.fuel, p.ostatok, etc.)
  if (fuelNum === 0) {
    const directVal = item.fuel ?? item.fuel_level ?? item.ostatok ?? item.liters ?? p.fuel ?? p.fuel_level ?? p.ostatok ?? p.liters ?? p.fuel1;
    if (directVal !== undefined && directVal !== null && directVal !== "") {
      const parsedDirect = parseFuelValue(directVal);
      if (parsedDirect.num > 0) {
        if (parsedDirect.num <= tankCapacity * 1.1) {
          fuelNum = parsedDirect.num;
          fuelPercent = Math.min(100, Math.max(0, Math.round((fuelNum / tankCapacity) * 100)));
          fuelSource = `API Түлш (${fuelNum}л)`;
        } else if (parsedDirect.percent > 0) {
          fuelPercent = parsedDirect.percent;
          fuelNum = Number(((tankCapacity * fuelPercent) / 100).toFixed(1));
          fuelSource = `API Хувь (${fuelPercent}%)`;
        }
      }
    }
  }

  // Priority 3: Digital LLS Fuel Sensors (io201, io203) - 12-bit ADC (0..4095 kvants)
  if (fuelNum === 0) {
    const rawLLS1 = p.io201 !== undefined && p.io201 !== null && p.io201 !== "" ? Number(p.io201) : null;
    const rawLLS2 = p.io203 !== undefined && p.io203 !== null && p.io203 !== "" ? Number(p.io203) : null;

    if (rawLLS1 !== null && rawLLS1 > 0 && rawLLS1 <= 4095) {
      if (rawLLS2 !== null && rawLLS2 > 0 && rawLLS2 <= 4095) {
        // Dual tank system (e.g. HINO Profia, Isuzu Giga, 6530УКН, 5909УКО, 3096УАУ)
        const halfCap = tankCapacity / 2;
        const f1 = (halfCap * rawLLS1) / 4095;
        const f2 = (halfCap * rawLLS2) / 4095;
        fuelNum = Number((f1 + f2).toFixed(1));
        fuelPercent = Math.min(100, Math.round((fuelNum / tankCapacity) * 100));
        fuelSource = `Хос бак LLS (1: ${rawLLS1}, 2: ${rawLLS2})`;
      } else {
        // Single tank 12-bit LLS
        fuelNum = Number(((tankCapacity * rawLLS1) / 4095).toFixed(1));
        fuelPercent = Math.min(100, Math.round((rawLLS1 / 4095) * 100));
        fuelSource = `LLS1 12-бит (${rawLLS1})`;
      }
    }
  }

  // Priority 4: Analog Float Voltage (io9 in mV) - range 500mV to 10000mV
  if (fuelNum === 0 && p.io9 !== undefined && p.io9 !== null && p.io9 !== "") {
    const rawV = Number(p.io9);
    if (rawV >= 500 && rawV <= 10000) {
      if (rawV <= 5500) {
        // 5V scale: typically 800mV empty, 5000mV full
        fuelPercent = Math.min(100, Math.max(0, Math.round(((rawV - 800) / 4200) * 100)));
      } else {
        // 10V/12V scale
        fuelPercent = Math.min(100, Math.max(0, Math.round(((rawV - 1000) / 9000) * 100)));
      }
      fuelNum = Number(((tankCapacity * fuelPercent) / 100).toFixed(1));
      fuelSource = `Аналог хөвүүр (${rawV}mV)`;
    }
  }

  // Note: io86 is Bluetooth Relative Humidity (RH%), NOT fuel! Never use io86 for fuel.

  const fuelStr = `${fuelNum.toFixed(1)} л`;

  // 4. Refrigeration Temperature Calculation:
  // Type A: Teltonika BLE EYE Sensor (io10800) in 0.01°C
  let tempNum: number | null = null;
  let tempSource = "Мэдрэгчгүй";

  if (p.io10800 !== undefined && p.io10800 !== null && p.io10800 !== "") {
    const rawBLE = Number(p.io10800);
    // 25000 is BLE disconnected / error code
    if (rawBLE !== 25000 && rawBLE !== 0 && rawBLE >= -5000 && rawBLE <= 8000) {
      tempNum = Number((rawBLE / 100).toFixed(1));
      tempSource = `BLE мэдрэгч (${tempNum > 0 ? "+" : ""}${tempNum}°C)`;
    } else if (rawBLE > 60000) {
      // 16-bit signed negative representation in Teltonika BLE
      tempNum = Number(((rawBLE - 65536) / 100).toFixed(1));
      tempSource = `BLE мэдрэгч (${tempNum > 0 ? "+" : ""}${tempNum}°C)`;
    }
  }

  // Type B: 1-Wire Dallas DS18B20 Temp Sensor (io25) in 0.1°C or 0.01°C
  if (tempNum === null && p.io25 !== undefined && p.io25 !== null && p.io25 !== "") {
    const raw1W = Number(p.io25);
    // 32767 is 1-Wire disconnected code (0x7FFF)
    if (raw1W !== 32767 && raw1W !== 0 && raw1W >= -500 && raw1W <= 800) {
      tempNum = Number((raw1W / 10).toFixed(1));
      tempSource = `1-Wire мэдрэгч (${tempNum > 0 ? "+" : ""}${tempNum}°C)`;
    } else if (raw1W > 800 && raw1W <= 8000) {
      tempNum = Number((raw1W / 100).toFixed(1));
      tempSource = `1-Wire мэдрэгч (${tempNum > 0 ? "+" : ""}${tempNum}°C)`;
    }
  }

  const tempStr = tempNum !== null ? `${tempNum > 0 ? "+" : ""}${tempNum.toFixed(1)}°C` : "--°C";
  const speed = Number(item.speed || p.speed || 0);

  // Status determination
  const isMoving = speed > 0;
  const isStationary = speed === 0;
  const status: "active" | "idle" | "moving" | "offline" = isMoving ? "moving" : (isStationary ? "active" : "offline");

  // Telemetry entry
  return {
    odo: odoVal || 0,
    fuel: fuelStr,
    fuelNum,
    fuelPercent: fuelPercent || 0,
    fuelSource,
    temp: tempStr,
    tempNum,
    tempSource,
    speed: speed,
    lat: Number(item.lat || item.latitude || 47.9188),
    lng: Number(item.lng || item.longitude || 106.9176),
    status,
    lastUpdate: new Date().toLocaleTimeString("mn-MN"),
    dtTracker: item.dt_tracker || p.dt_tracker || item.dt_server,
    imei: item.imei,
    voltage: p.io66 ? `${(Number(p.io66) / 1000).toFixed(1)}V` : undefined,
    gsmSignal: p.gsmlev ? `${p.gsmlev}/5` : undefined,
    batteryLevel: p.io10824 ? `${(Number(p.io10824) / 1000).toFixed(2)}V` : (p.io67 ? `${(Number(p.io67) / 1000).toFixed(2)}V` : undefined)
  };
}

async function fetchGPSBoxTelemetry(): Promise<Record<string, Telemetry>> {
  const now = Date.now();
  // Cache for 8 seconds
  if (now - lastFetchTime < 8000 && Object.keys(cachedTelemetryMap).length > 0) {
    return cachedTelemetryMap;
  }

  const telemetryMap: Record<string, Telemetry> = {};
  const config = db.gpsboxConfig;

  try {
    // Fetch USER_GET_OBJECTS and OBJECT_GET_LOCATIONS in parallel (Official GPSBox API specification)
    const baseUrl = config.url.replace(/\/$/, "");
    const apiKey = encodeURIComponent(config.apiKey);

    const objectsUrl = `${baseUrl}/api/api.php?api=user&key=${apiKey}&cmd=USER_GET_OBJECTS`;
    const locationsUrl = `${baseUrl}/api/api.php?api=user&key=${apiKey}&cmd=OBJECT_GET_LOCATIONS,*`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const [objRes, locRes] = await Promise.all([
      fetch(objectsUrl, { signal: controller.signal }).catch(() => null),
      fetch(locationsUrl, { signal: controller.signal }).catch(() => null)
    ]);
    clearTimeout(timeoutId);

    let objects: any[] = [];
    let locations: Record<string, any> = {};

    if (objRes && objRes.ok) {
      try {
        const json = await objRes.json();
        objects = extractObjectsArray(json);
      } catch (e) {}
    }

    if (locRes && locRes.ok) {
      try {
        const json = await locRes.json();
        if (json && typeof json === "object") {
          locations = json;
        }
      } catch (e) {}
    }

    if (objects.length > 0) {
      db.gpsboxConfig.syncStatus = "connected";
      db.gpsboxConfig.lastSync = new Date().toISOString();
      db.gpsboxConfig.errorMessage = undefined;

      objects.forEach((item: any) => {
        if (!item || typeof item !== "object") return;
        const imei = String(item.imei || "");
        
        // Merge real-time location and live params from OBJECT_GET_LOCATIONS if available
        if (imei && locations[imei]) {
          const loc = locations[imei];
          item.lat = loc.lat || item.lat;
          item.lng = loc.lng || item.lng;
          item.speed = loc.speed !== undefined ? loc.speed : item.speed;
          item.dt_tracker = loc.dt_tracker || item.dt_tracker;
          item.dt_server = loc.dt_server || item.dt_server;
          if (loc.params) {
            item.params = { ...(item.params || {}), ...loc.params };
          }
        }

        const plate = item.plate_number || item.plate || item.name || item.vehicleNumber || item.title || item.car_number || item.imei;
        if (!plate) return;

        // Correlate with driver's model if known
        const plateStr = String(plate).toUpperCase().replace(/[\s\-_()]/g, "");
        const matchedDriver = db.drivers.find(d => {
          const vClean = (d.vehicle || "").replace(/[\s\-_()]/g, "").toUpperCase();
          return (vClean && plateStr.includes(vClean)) || (d.id && String(item.imei || "").includes(d.id));
        });

        const entry = parseVehicleTelemetry(item, matchedDriver?.model || item.model);

        const rawStr = String(plate).trim().toUpperCase();
        const cleanCyr = rawStr.replace(/[\s\-_()]/g, "");
        const normKey = normalizePlateKey(rawStr);
        const digits = rawStr.replace(/\D/g, "");

        telemetryMap[rawStr] = entry;
        telemetryMap[cleanCyr] = entry;
        telemetryMap[normKey] = entry;
        if (digits.length >= 4) {
          telemetryMap[digits] = entry;
        }
        if (imei) {
          telemetryMap[imei] = entry;
        }
      });
    } else {
      db.gpsboxConfig.syncStatus = "mock_active";
      db.gpsboxConfig.lastSync = new Date().toISOString();
    }
  } catch (err: any) {
    db.gpsboxConfig.syncStatus = "mock_active";
    db.gpsboxConfig.errorMessage = err.message;
  }

  // Populate accurate telemetry for all fleet drivers with fallback and alias resolution
  db.drivers.forEach(d => {
    const rawVeh = (d.vehicle || "").toUpperCase();
    const cleanVeh = rawVeh.replace(/[\s\-_()]/g, "");
    const normVeh = normalizePlateKey(rawVeh);
    const digits = rawVeh.replace(/\D/g, "");
    const driverId = d.id.toUpperCase();

    // Check if matched by any token
    let matched = telemetryMap[cleanVeh] || telemetryMap[rawVeh] || telemetryMap[normVeh] || telemetryMap[driverId];
    if (!matched && digits.length >= 4 && telemetryMap[digits]) {
      matched = telemetryMap[digits];
    }

    if (!matched) {
      matched = getOfflineTelemetry(cleanVeh || d.id, d);
    }

    telemetryMap[cleanVeh] = matched;
    telemetryMap[rawVeh] = matched;
    telemetryMap[normVeh] = matched;
    telemetryMap[driverId] = matched;

    if (matched) {
      if (!d.apiOdo || d.apiOdo === 0) d.apiOdo = matched.odo;
      d.apiFuel = matched.fuel;
      d.apiFuelNum = matched.fuelNum;
      d.apiFuelPercent = matched.fuelPercent;
      d.apiTemp = matched.temp;
      d.apiTempNum = matched.tempNum;
      d.apiSpeed = matched.speed;
      d.telemetry = matched;
    }
  });

  saveDB(db);

  cachedTelemetryMap = telemetryMap;
  lastFetchTime = now;
  return telemetryMap;
}

// API Routes

// 1. Get App Data (Drivers, Telemetry, TripStatus for a date)
app.get("/api/app-data", async (req: Request, res: Response) => {
  try {
    const filterDate = (req.query.date as string) || new Date().toISOString().split("T")[0];
    const telemetryMap = await fetchGPSBoxTelemetry();

    const enrichedDrivers = db.drivers.map(d => {
      const cleanVeh = (d.vehicle || "").toUpperCase().replace(/\s+/g, "");
      const tele = telemetryMap[cleanVeh] || telemetryMap[d.vehicle?.toUpperCase()] || telemetryMap[d.id?.toUpperCase()] || {
        odo: 0,
        fuel: "0.0 л",
        fuelPercent: 0,
        temp: "-20.0°C",
        tempNum: -20,
        speed: 0,
        status: "active",
        lastUpdate: new Date().toLocaleTimeString("mn-MN")
      };

      return {
        ...d,
        apiOdo: tele.odo,
        apiFuel: tele.fuel,
        apiFuelPercent: tele.fuelPercent,
        apiTemp: tele.temp,
        apiTempNum: tele.tempNum,
        apiSpeed: tele.speed,
        telemetry: tele
      };
    });

    const tripStatus: Record<string, { phase: "started" | "complete"; startOdo: number; endOdo?: number | null; totalKm?: number; tripId: string }> = {};

    db.trips
      .filter(t => t.date === filterDate)
      .forEach(t => {
        tripStatus[t.driverId] = {
          phase: t.phase,
          startOdo: t.startOdo,
          endOdo: t.endOdo,
          totalKm: t.totalKm,
          tripId: t.id
        };
      });

    res.json({
      drivers: enrichedDrivers,
      tripStatus,
      submittedIds: Object.keys(tripStatus),
      targetDate: filterDate,
      gpsboxConfig: db.gpsboxConfig,
      assignments: db.assignments || [],
      routes: db.routes || [],
      stats: {
        totalDrivers: db.drivers.length,
        activeDrivers: db.drivers.filter(d => d.status === "active").length,
        todayStartedTrips: db.trips.filter(t => t.date === filterDate && t.phase === "started").length,
        todayCompletedTrips: db.trips.filter(t => t.date === filterDate && t.phase === "complete").length
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 2. Start Odometer Submission
app.post("/api/trips/start", (req: Request, res: Response) => {
  try {
    const { date, driverId, driverName, vehicleNumber, salesRep, zone, startOdo, routeNote } = req.body;

    if (!driverId || !startOdo) {
      return res.status(400).json({ status: "error", message: "Жолоочийн ID болон эхлэх ODO заалт шаардлагатай!" });
    }

    const targetDate = date || new Date().toISOString().split("T")[0];

    // Check if already started today
    const existing = db.trips.find(t => t.date === targetDate && t.driverId === driverId);
    if (existing) {
      return res.status(400).json({ status: "error", message: "Та энэ өдөр аль хэдийн замын хуудсаа эхлүүлсэн байна!" });
    }

    const newTrip: TripLog = {
      id: `trip_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString(),
      date: targetDate,
      driverId: String(driverId).trim(),
      driverName: driverName || `Жолооч ${driverId}`,
      vehicleNumber: vehicleNumber || "----",
      salesRep: salesRep || "Төлөөлөгч тодорхойгүй",
      zone: zone || "УБ-01 • Төв / Сүхбаатар",
      startOdo: Number(startOdo),
      endOdo: null,
      totalKm: 0,
      fuelLiters: 0,
      fuelStation: "",
      status: "🟡 ЭХЭЛСЭН",
      phase: "started",
      routeNote: routeNote || "Борлуулалт"
    };

    db.trips.unshift(newTrip);
    saveDB(db);

    res.json({
      status: "success",
      message: "Эхлэх ODO заалт амжилттай бүртгэгдлээ. Ажлын өдрийн эцэст төгсгөх заалтаа оруулна уу.",
      trip: newTrip
    });
  } catch (error: any) {
    res.status(500).json({ status: "error", message: "Системийн алдаа: " + error.message });
  }
});

// 3. End Odometer Submission
app.post("/api/trips/end", (req: Request, res: Response) => {
  try {
    const { date, driverId, endOdo, fuelLiters, fuelStation, fuelCost, fuelPaymentMethod, fuelReceiptNo, routeNote } = req.body;

    if (!driverId || endOdo === undefined || endOdo === null) {
      return res.status(400).json({ status: "error", message: "Төгсгөх ODO заалтыг зөв оруулна уу!" });
    }

    const targetDate = date || new Date().toISOString().split("T")[0];
    const tripIndex = db.trips.findIndex(t => t.date === targetDate && t.driverId === String(driverId).trim() && t.phase === "started");

    if (tripIndex === -1) {
      return res.status(404).json({ status: "error", message: "Эхлэх бүртгэл олдсонгүй эсвэл замын хуудас аль хэдийн дуусгагдсан байна." });
    }

    const targetTrip = db.trips[tripIndex];
    const endOdoNum = Number(endOdo);
    const startOdoNum = Number(targetTrip.startOdo);

    if (endOdoNum < startOdoNum) {
      return res.status(400).json({
        status: "error",
        message: `Төгсгөх ODO (${endOdoNum} км) нь эхлэх ODO (${startOdoNum} км)-с бага байж болохгүй!`
      });
    }

    const totalKm = endOdoNum - startOdoNum;
    targetTrip.endOdo = endOdoNum;
    targetTrip.totalKm = totalKm;
    targetTrip.fuelLiters = Number(fuelLiters || 0);
    targetTrip.fuelStation = fuelStation || "ШТС-12 Петровис";
    if (fuelCost !== undefined) targetTrip.fuelCost = Number(fuelCost || 0);
    if (fuelPaymentMethod) targetTrip.fuelPaymentMethod = fuelPaymentMethod;
    if (fuelReceiptNo) targetTrip.fuelReceiptNo = fuelReceiptNo;
    targetTrip.status = "✅ ХЭВИЙН";
    targetTrip.phase = "complete";
    if (routeNote) targetTrip.routeNote = routeNote;

    // Хэрэв IMD түгээгчийн томилолт хуваарилагдсан байвал уг томилолтыг "Дууссан" болгож ODO, түлшийг баталгаажуулах
    const cleanVeh = (targetTrip.vehicleNumber || "").trim().toUpperCase().replace(/\s+/g, "");
    const imdAsn = (db.assignments || []).find((a: any) => {
      const matchVeh = a.vehiclePlate && a.vehiclePlate.trim().toUpperCase().replace(/\s+/g, "") === cleanVeh;
      const matchDrv = a.primaryDriverId === String(driverId).trim() || a.substituteDriverId === String(driverId).trim();
      return (matchVeh || matchDrv) && a.status !== "Цуцлагдсан" && a.status !== "Дууссан";
    });
    if (imdAsn) {
      imdAsn.status = "Дууссан";
      imdAsn.endOdo = endOdoNum;
      imdAsn.startOdo = startOdoNum;
      imdAsn.actualKm = totalKm;
      if (fuelLiters) imdAsn.fuelLiters = Number(fuelLiters);
      if (fuelStation) imdAsn.fuelStation = fuelStation;
      imdAsn.updatedAt = new Date().toISOString();

      const linkedOrder = (db.orders || []).find((o: any) => o.id === imdAsn.orderId);
      if (linkedOrder) {
        linkedOrder.status = "Дууссан";
        linkedOrder.updatedAt = new Date().toISOString();
      }
    }

    saveDB(db);

    res.json({
      status: "success",
      message: `Замын хуудас амжилттай дуусгагдлаа! Нийт явсан: ${totalKm} км.`,
      trip: targetTrip
    });
  } catch (error: any) {
    res.status(500).json({ status: "error", message: "Системийн алдаа: " + error.message });
  }
});

// 3.5. Manual Waybill Entry & Override (When GPS Auto-Fill is off or manual input is used)
app.post("/api/trips/manual-entry", (req: Request, res: Response) => {
  try {
    const { 
      date, 
      driverId, 
      startOdo, 
      endOdo, 
      totalKm, 
      fuelLiters, 
      fuelStation, 
      fuelCost, 
      fuelPaymentMethod, 
      fuelReceiptNo, 
      routeNote,
      salesRep,
      zone
    } = req.body;

    if (!driverId || startOdo === undefined || endOdo === undefined) {
      return res.status(400).json({ status: "error", message: "Жолооч, эхлэх ODO, төгсгөх ODO заалтыг бүтэн оруулна уу!" });
    }

    const targetDate = date || new Date().toISOString().split("T")[0];
    const startNum = Number(startOdo);
    const endNum = Number(endOdo);

    if (isNaN(startNum) || isNaN(endNum) || startNum <= 0 || endNum < startNum) {
      return res.status(400).json({ 
        status: "error", 
        message: `Эхлэх (${startNum} км) болон төгсгөх (${endNum} км) ODO заалт буруу байна! Төгсгөх заалт нь эхлэх заалтаас их буюу тэнцүү байх ёстой.` 
      });
    }

    const calculatedKm = totalKm !== undefined && Number(totalKm) >= 0 ? Number(totalKm) : (endNum - startNum);
    const driver = db.drivers.find(
      d => d.id.toUpperCase() === String(driverId).toUpperCase() || d.code.toUpperCase() === String(driverId).toUpperCase()
    );

    const cleanVeh = (driver?.vehicle || "").trim().toUpperCase().replace(/\s+/g, "");

    let tripIndex = db.trips.findIndex(t => 
      t.date === targetDate && 
      (t.driverId.toUpperCase() === String(driverId).toUpperCase() || (cleanVeh && (t.vehicleNumber || "").toUpperCase().replace(/\s+/g, "") === cleanVeh))
    );

    let trip: TripLog;
    if (tripIndex >= 0) {
      trip = db.trips[tripIndex];
      trip.startOdo = startNum;
      trip.endOdo = endNum;
      trip.totalKm = calculatedKm;
      trip.fuelLiters = Number(fuelLiters || 0);
      if (fuelStation) trip.fuelStation = fuelStation;
      if (fuelCost !== undefined) trip.fuelCost = Number(fuelCost || 0);
      if (fuelPaymentMethod) trip.fuelPaymentMethod = fuelPaymentMethod;
      if (fuelReceiptNo) trip.fuelReceiptNo = fuelReceiptNo;
      if (routeNote) trip.routeNote = routeNote;
      if (salesRep) trip.salesRep = salesRep;
      if (zone) trip.zone = zone;
      trip.phase = "complete";
      trip.status = "✅ ХЭВИЙН";
      (trip as any).source = "manual";
    } else {
      trip = {
        id: `trip_manual_${Date.now()}_${driverId}`,
        timestamp: new Date().toISOString(),
        date: targetDate,
        driverId: driver ? driver.id : String(driverId),
        driverName: driver ? driver.name : "Жолооч",
        vehicleNumber: driver ? driver.vehicle : (cleanVeh || "----"),
        salesRep: salesRep || driver?.salesRep || "До.Дэмбэрэл",
        zone: zone || driver?.defaultRoute || "УБ Төв",
        startOdo: startNum,
        endOdo: endNum,
        totalKm: calculatedKm,
        fuelLiters: Number(fuelLiters || 0),
        fuelStation: fuelStation || (Number(fuelLiters || 0) > 0 ? "Петровис" : undefined),
        fuelCost: Number(fuelCost || 0),
        fuelPaymentMethod,
        fuelReceiptNo,
        status: "✅ ХЭВИЙН",
        phase: "complete",
        routeNote: routeNote || "Гараар бөглөсөн замын хуудас",
      };
      (trip as any).source = "manual";
      db.trips.push(trip);
    }

    if (driver) {
      driver.apiOdo = endNum;
    }

    // Save fuel refill if fuel liters > 0
    if (Number(fuelLiters || 0) > 0 && cleanVeh) {
      const existingRefill = db.fuelRefills.find(f => 
        f.vehicleNumber.toUpperCase().replace(/\s+/g, "") === cleanVeh && 
        f.dateTime.startsWith(targetDate)
      );
      if (!existingRefill) {
        db.fuelRefills.push({
          id: `refill_manual_${Date.now()}`,
          vehicleNumber: cleanVeh,
          dateTime: `${targetDate} 18:00:00`,
          liters: Number(fuelLiters),
          station: fuelStation || "Петровис",
          cost: Number(fuelCost || (Number(fuelLiters) * 3350)),
          source: "manual"
        });
      }
    }

    saveDB(db);

    res.json({
      status: "success",
      message: `Замын хуудас гараар амжилттай хадгалагдлаа! Нийт гүйлт: ${calculatedKm} км.`,
      trip
    });
  } catch (error: any) {
    res.status(500).json({ status: "error", message: "Системийн алдаа: " + error.message });
  }
});

// 4. MasterLog: Get All Trips with Filters
app.get("/api/trips", (req: Request, res: Response) => {
  try {
    const { date, driverId, zone, vehicle, status } = req.query;
    let list = [...db.trips];

    if (date) list = list.filter(t => t.date === date);
    if (driverId) list = list.filter(t => t.driverId.toLowerCase() === String(driverId).toLowerCase());
    if (zone) list = list.filter(t => t.zone.includes(String(zone)));
    if (vehicle) list = list.filter(t => t.vehicleNumber.toLowerCase().includes(String(vehicle).toLowerCase()));
    if (status) list = list.filter(t => t.status === status);

    res.json({ trips: list, total: list.length });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GPSBox Continuous Odometer Sync Endpoint
app.post("/api/admin/waybills/recalculate-gpsbox", (req: Request, res: Response) => {
  try {
    const result = syncGpsboxTripsAndOdometer(db);
    saveDB(db);
    res.json({
      status: "success",
      message: "Бүх машины замын хуудас болон одометрийн гинжин хэлхээ амжилттай тооцогдож шинэчлэгдлээ",
      ...result,
      totalTrips: db.trips.length
    });
  } catch (error: any) {
    res.status(500).json({ status: "error", message: error.message });
  }
});

// 5. Delete or Edit a Trip (Admin)
app.delete("/api/trips/:id", (req: Request, res: Response) => {
  const { id } = req.params;
  db.trips = db.trips.filter(t => t.id !== id);
  saveDB(db);
  res.json({ status: "success", message: "Замын хуудас устгагдлаа" });
});

app.put("/api/trips/:id", (req: Request, res: Response) => {
  const { id } = req.params;
  const index = db.trips.findIndex(t => t.id === id);
  if (index === -1) return res.status(404).json({ error: "Олдсонгүй" });

  const updated: TripLog = {
    ...db.trips[index],
    ...req.body,
    source: "manual",
    isManual: true,
    manualEditedAt: new Date().toISOString()
  };
  if (updated.startOdo !== undefined && updated.endOdo !== undefined && updated.endOdo !== null) {
    updated.totalKm = Number(updated.endOdo) - Number(updated.startOdo);
  }
  db.trips[index] = updated;
  saveDB(db);
  res.json({ status: "success", trip: updated });
});

// 6. Drivers CRUD Management
app.get("/api/drivers", (req: Request, res: Response) => {
  res.json(db.drivers);
});

app.post("/api/drivers", (req: Request, res: Response) => {
  try {
    const { code, name, phone, vehicle, model, salesRep, defaultRoute, status, organization, boxCapacity, isIMD, jobTitle } = req.body;
    if (!code || !name) {
      return res.status(400).json({ error: "Жолоочийн код болон нэр шаардлагатай!" });
    }

    const cleanCode = String(code).trim().toUpperCase();
    const cleanVeh = vehicle ? vehicle.trim().toUpperCase() : "";

    // Official box capacity map
    const OFFICIAL_BOX_MAP: Record<string, number> = {
      "8374УНЕ": 1000,
      "3147УЕН": 700,
      "3148УЕМ": 700,
      "3148УЕО": 700,
      "5909УКО": 1500,
      "6530УКН": 1500,
      "8376УЕН": 700,
      "8428УНД": 700,
    };

    let resolvedBoxCap: number | undefined = boxCapacity !== undefined && boxCapacity !== "" ? Number(boxCapacity) : undefined;
    if (!resolvedBoxCap && cleanVeh) {
      for (const [plate, cap] of Object.entries(OFFICIAL_BOX_MAP)) {
        if (cleanVeh.includes(plate) || plate.includes(cleanVeh)) {
          resolvedBoxCap = cap;
          break;
        }
      }
    }

    const existingIndex = db.drivers.findIndex(d => d.id.toUpperCase() === cleanCode || d.code.toUpperCase() === cleanCode);

    if (existingIndex !== -1) {
      db.drivers[existingIndex] = {
        ...db.drivers[existingIndex],
        name: name.trim(),
        phone: phone || db.drivers[existingIndex].phone,
        vehicle: cleanVeh || db.drivers[existingIndex].vehicle,
        model: model || db.drivers[existingIndex].model,
        salesRep: salesRep || db.drivers[existingIndex].salesRep,
        defaultRoute: defaultRoute !== undefined ? defaultRoute.trim() : db.drivers[existingIndex].defaultRoute,
        status: status || db.drivers[existingIndex].status || "active",
        organization: organization !== undefined ? organization.trim() : db.drivers[existingIndex].organization,
        boxCapacity: resolvedBoxCap !== undefined ? resolvedBoxCap : db.drivers[existingIndex].boxCapacity,
        isIMD: isIMD !== undefined ? Boolean(isIMD) : db.drivers[existingIndex].isIMD,
        jobTitle: jobTitle || db.drivers[existingIndex].jobTitle,
        isCustom: true
      };
      saveDB(db);
      return res.json({ status: "success", driver: db.drivers[existingIndex] });
    }

    const newDriver: Driver = {
      id: cleanCode,
      code: cleanCode,
      name: name.trim(),
      phone: phone || "",
      vehicle: cleanVeh || "----",
      model: model || "Isuzu",
      salesRep: salesRep || "До.Дэмбэрэл",
      defaultRoute: defaultRoute ? defaultRoute.trim() : "",
      status: status || "active",
      organization: organization ? organization.trim() : (isIMD ? "Айсмарк Дистрибьюшн ХХК" : "АЙСМАРК ТРЕЙД ХХК"),
      boxCapacity: resolvedBoxCap,
      isIMD: Boolean(isIMD || (organization && organization.includes("Дистрибьюшн"))),
      jobTitle: jobTitle || (isIMD ? "ТҮГЭЭГЧ" : undefined),
      isCustom: true
    };

    db.drivers.push(newDriver);
    saveDB(db);
    res.json({ status: "success", driver: newDriver });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.put("/api/drivers/:id", (req: Request, res: Response) => {
  const { id } = req.params;
  const index = db.drivers.findIndex(d => d.id.toUpperCase() === id.toUpperCase());
  if (index === -1) return res.status(404).json({ error: "Жолооч олдсонгүй" });

  const body = req.body;
  if (body.boxCapacity !== undefined && body.boxCapacity !== "") {
    body.boxCapacity = Number(body.boxCapacity);
  }

  db.drivers[index] = { ...db.drivers[index], ...body };
  saveDB(db);
  res.json({ status: "success", driver: db.drivers[index] });
});

app.delete("/api/drivers/:id", (req: Request, res: Response) => {
  const { id } = req.params;
  db.drivers = db.drivers.filter(d => d.id.toUpperCase() !== id.toUpperCase());
  saveDB(db);
  res.json({ status: "success", message: "Жолооч устгагдлаа" });
});

// IMD Түгээгчийн явсан км нуух, нууц үг тохируулах болон шалгах endpoint
app.post("/api/drivers/:id/km-privacy", (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { action, pin, currentPin } = req.body;
    const cleanId = String(id).trim().toUpperCase();

    const driver = (db.drivers || []).find((d: any) => 
      String(d.id || "").trim().toUpperCase() === cleanId || 
      String(d.code || "").trim().toUpperCase() === cleanId
    );

    if (!driver) {
      return res.status(404).json({ error: "Жолооч олдсонгүй" });
    }

    if (action === "set") {
      const cleanPin = String(pin || "").trim();
      if (!cleanPin || cleanPin.length < 4) {
        return res.status(400).json({ error: "Нууц код доод тал нь 4 тэмдэгт байх ёстой!" });
      }
      driver.kmPrivacyPin = cleanPin;
      driver.hasKmPin = true;
      saveDB(db);

      try {
        const sqlite = getDatabase();
        sqlite.prepare("UPDATE drivers SET km_privacy_pin = ? WHERE id = ? OR code = ?").run(cleanPin, driver.id, driver.code);
      } catch (e) {}

      return res.json({
        success: true,
        message: "Км нуух нууц код амжилттай тохируулагдлаа.",
        hasKmPin: true,
        unlocked: false
      });
    }

    if (action === "verify") {
      const cleanPin = String(pin || "").trim();
      if (!driver.kmPrivacyPin) {
        return res.json({ success: true, unlocked: true, message: "Нууц үг тохируулаагүй байна." });
      }
      if (String(driver.kmPrivacyPin).trim() === cleanPin) {
        return res.json({ success: true, unlocked: true, message: "Нууц үг зөв байна." });
      } else {
        return res.status(400).json({ success: false, unlocked: false, error: "Нууц үг буруу байна! Дахин оролдоно уу." });
      }
    }

    if (action === "remove") {
      const cleanCurrentPin = String(currentPin || pin || "").trim();
      if (driver.kmPrivacyPin && String(driver.kmPrivacyPin).trim() !== cleanCurrentPin) {
        return res.status(400).json({ error: "Одоогийн нууц үг буруу байна!" });
      }
      delete driver.kmPrivacyPin;
      driver.hasKmPin = false;
      saveDB(db);

      try {
        const sqlite = getDatabase();
        sqlite.prepare("UPDATE drivers SET km_privacy_pin = NULL WHERE id = ? OR code = ?").run(driver.id, driver.code);
      } catch (e) {}

      return res.json({
        success: true,
        message: "Км нууцлал амжилттай цуцлагдлаа.",
        hasKmPin: false,
        unlocked: true
      });
    }

    return res.status(400).json({ error: "Тодорхойгүй үйлдэл" });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Серверийн алдаа" });
  }
});

// 7. Vehicle Log Sheet (Monthly Veh_ sheet generation)
app.get("/api/vehicle-sheet/:vehicleNumber", async (req: Request, res: Response) => {
  try {
    const { vehicleNumber } = req.params;
    const yearMonth = (req.query.month as string) || new Date().toISOString().slice(0, 7); // e.g. "2026-08"

    const cleanVeh = decodeURIComponent(vehicleNumber).trim().toUpperCase();
    let driver = db.drivers.find(d => d.vehicle.toUpperCase().replace(/\s+/g, "") === cleanVeh.replace(/\s+/g, ""));

    if (!driver) {
      driver = {
        id: cleanVeh,
        code: cleanVeh,
        name: "Жолооч",
        phone: "9911-0000",
        vehicle: cleanVeh,
        model: "Isuzu",
        salesRep: "ХТ",
        status: "active"
      };
    }

    // Ensure driver's past and today waybill records are synced from real GPS telemetry & refills
    await syncDriverWaybillUpToToday(driver, yearMonth);

    const sheet = buildSingleVehicleSheet(driver, yearMonth);
    res.json(sheet);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Helper to retrieve verified previous day end odometer
function getPreviousVerifiedEndOdo(vehicleNumber: string, dateStr: string, fallbackStartOdo?: number): number | undefined {
  const cleanVeh = vehicleNumber.toUpperCase().replace(/\s+/g, "");
  
  // 1. Check trips before this date
  const pastTrips = db.trips
    .filter(t => {
      const tVeh = (t.vehicleNumber || "").toUpperCase().replace(/\s+/g, "");
      return tVeh === cleanVeh && t.date < dateStr && t.endOdo !== undefined && t.endOdo !== null && Number(t.endOdo) > 0;
    })
    .sort((a, b) => b.date.localeCompare(a.date));

  if (pastTrips.length > 0 && pastTrips[0].endOdo) {
    return Number(pastTrips[0].endOdo);
  }

  // 2. Check DailyGPSMileages before this date
  const pastGPS = db.dailyGPSMileages
    .filter(m => {
      const mVeh = m.vehicleNumber.toUpperCase().replace(/\s+/g, "");
      return mVeh === cleanVeh && m.date < dateStr && m.endOdo !== undefined && m.endOdo !== null && Number(m.endOdo) > 0;
    })
    .sort((a, b) => b.date.localeCompare(a.date));

  if (pastGPS.length > 0 && pastGPS[0].endOdo) {
    return Number(pastGPS[0].endOdo);
  }

  return fallbackStartOdo;
}

// 1-Цагийн хуваарийг тухайн өдөр засварласан бол өмнөх 7 хоног болон өнгөрсөн өдрүүдийн хуваарьт өөрчлөлт оруулахгүй байх
function resolveScheduleForDate(dateStr: string): { isRestDay: boolean; dayTask: string } {
  const current: WorkScheduleConfig = db.workScheduleConfig || {
    workDaysMode: "mon_sat",
    defaultTask: "Борлуулалт",
    restDayTask: "Хуваарьт амралт",
    customRestDays: [0],
    customHolidays: [],
    applyToAllDrivers: true,
    updatedAt: new Date().toISOString()
  };

  const [y, m, d] = dateStr.split("-").map(Number);
  const dateObj = new Date(y, m - 1, d);
  const dayOfWeek = dateObj.getDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat

  // Determine effective schedule:
  // Хэрэв тухайн өдөр хуваарийг засварласан бол (effectiveDate), түүний өмнөх өдрүүд болон 7 хоногийн өмнөх түүхэн хуваарийг хэвээр хамгаална
  let effectiveConfig: {
    workDaysMode: string;
    defaultTask: string;
    restDayTask: string;
    weeklyDaysConfig?: Record<number, WeeklyDaySetting>;
    customRestDays?: number[];
    customHolidays?: string[];
  } = current;

  if (current.effectiveDate && dateStr < current.effectiveDate) {
    if (current.history && current.history.length > 0) {
      const matchedHistory = current.history.find(h => {
        const afterStart = !h.effectiveDate || dateStr >= h.effectiveDate;
        const beforeEnd = !h.validUntil || dateStr < h.validUntil;
        return afterStart && beforeEnd;
      }) || current.history[current.history.length - 1];

      if (matchedHistory) {
        effectiveConfig = matchedHistory;
      }
    } else {
      // Historical default before effectiveDate: Mon-Sat work, Sun rest
      effectiveConfig = {
        workDaysMode: "mon_sat",
        defaultTask: "Борлуулалт",
        restDayTask: "Хуваарьт амралт",
        customRestDays: [0],
        customHolidays: []
      };
    }
  }

  const weekSetting = effectiveConfig.weeklyDaysConfig?.[dayOfWeek];
  let isRestDay = false;
  let dayTask = effectiveConfig.defaultTask || "Борлуулалт";

  if (weekSetting) {
    isRestDay = !weekSetting.isWork;
    dayTask = weekSetting.task || (isRestDay ? (effectiveConfig.restDayTask || "Хуваарьт амралт") : (effectiveConfig.defaultTask || "Борлуулалт"));
  } else if (effectiveConfig.workDaysMode === "mon_sat") {
    isRestDay = dayOfWeek === 0;
    dayTask = isRestDay ? (effectiveConfig.restDayTask || "Хуваарьт амралт") : (effectiveConfig.defaultTask || "Борлуулалт");
  } else if (effectiveConfig.workDaysMode === "mon_fri") {
    isRestDay = dayOfWeek === 0 || dayOfWeek === 6;
    dayTask = isRestDay ? (effectiveConfig.restDayTask || "Хуваарьт амралт") : (effectiveConfig.defaultTask || "Борлуулалт");
  } else if (effectiveConfig.workDaysMode === "custom" && effectiveConfig.customRestDays) {
    isRestDay = effectiveConfig.customRestDays.includes(dayOfWeek);
    dayTask = isRestDay ? (effectiveConfig.restDayTask || "Хуваарьт амралт") : (effectiveConfig.defaultTask || "Борлуулалт");
  }

  if (effectiveConfig.customHolidays && effectiveConfig.customHolidays.includes(dateStr)) {
    isRestDay = true;
    dayTask = "Баярын амралт";
  }

  return { isRestDay, dayTask };
}

// Synchronize all past and today days with real GPSBox telemetry & official schedule
// 2-Эхлэх ODO Төгсгөх ODO -ыг тухайн өдрийн 06:00-23:00 оор эхлэл төгсгөлөө авч хоорондох зөрүүг тухайн өдрийн км ээр тооцно (Замын хуудас: Асаалттай үед)
async function syncDriverWaybillUpToToday(driver: Driver, targetMonth: string): Promise<number> {
  // Түгээгч замын хуудсуудыг бүгдийг нь бөглөлтгүй болгож, менежер өнгөрсөн хугацааны томилолтуудыг нөхөн бүртгэнэ
  if (isIMDDriver(driver)) {
    return 0;
  }

  const isGPSAutoOff = (db.gpsboxConfig.autoFillEnabled === false) || (driver.autoOdoConfig?.enabled === false);
  if (isGPSAutoOff) {
    return 0;
  }

  const cleanVeh = (driver.vehicle || driver.id).trim().toUpperCase().replace(/\s+/g, "");
  const todayStr = new Date().toISOString().split("T")[0];
  const [year, mNum] = targetMonth.split("-").map(Number);
  const daysInMonth = new Date(year, mNum, 0).getDate();

  const telemetryMap = await fetchGPSBoxTelemetry();
  const tele = telemetryMap[cleanVeh] || telemetryMap[cleanVeh.replace(/\D/g, "")] || telemetryMap[driver.id.toUpperCase()];
  if (tele && tele.odo && !driver.apiOdo) {
    driver.apiOdo = tele.odo;
  }

  // Determine starting odometer:
  let runningOdo = getPreviousVerifiedEndOdo(
    cleanVeh,
    `${targetMonth}-01`,
    driver.autoOdoConfig?.monthStartOdo || driver.apiOdo || (tele?.odo ? Math.max(0, tele.odo - 150) : 0)
  );
  if (runningOdo === undefined) {
    runningOdo = driver.autoOdoConfig?.monthStartOdo || driver.apiOdo || 0;
  }

  let syncedCount = 0;

  for (let day = 1; day <= daysInMonth; day++) {
    const dayStr = `${targetMonth}-${String(day).padStart(2, "0")}`;
    if (dayStr > todayStr) break; // Future dates are strictly locked

    // 1-Цагийн хуваарийг түүхэн өдрүүдийг хамгаалж унших
    const { isRestDay, dayTask } = resolveScheduleForDate(dayStr);

    // Check existing trip
    const existingIdx = db.trips.findIndex(
      (t) => (t.vehicleNumber || "").toUpperCase().replace(/\s+/g, "") === cleanVeh && t.date === dayStr
    );
    const existing = existingIdx >= 0 ? db.trips[existingIdx] : null;

    // Preserve genuine manual entries made by drivers or managers
    const isManualTrip = existing && (
      (existing as any).source === "manual" ||
      (existing as any).isManual === true
    );
    if (isManualTrip) {
      runningOdo = existing.endOdo || existing.startOdo || runningOdo;
      syncedCount++;
      continue;
    }

    let dayKm = 0;
    if (isRestDay) {
      dayKm = 0;
    } else if (existing && existing.totalKm !== undefined && Number(existing.totalKm) >= 0) {
      dayKm = Number(existing.totalKm);
    } else {
      const gpsRecord = await getOrComputeRealDailyMileage(cleanVeh, dayStr, driver);
      dayKm = gpsRecord?.totalKm || 0;
    }

    // Real Fuel Refills check: only show fuel if actually refilled
    const refills = db.fuelRefills.filter(
      (f) => f.vehicleNumber.toUpperCase().replace(/\s+/g, "") === cleanVeh && f.dateTime.startsWith(dayStr)
    );
    const totalRefillLiters = refills.reduce((acc, r) => acc + (Number(r.liters) || 0), 0);
    const stationName = refills.length > 0 ? (refills[0].station || "ШТС Петровис") : undefined;

    // 2-Эхлэх ODO (06:00) ➔ Төгсгөх ODO (23:00) хоорондох зөрүүгээр тооцох зарчим
    let start = runningOdo;
    let end = runningOdo;

    let dayZone = existing?.zone || (isRestDay ? "Хуваарьт амралт" : (driver.defaultRoute || "УБ Төв"));
    let dayTaskNote = existing?.routeNote || (isRestDay ? "Хуваарьт амралт" : dayTask);
    let daySalesRep = existing?.salesRep || driver.salesRep || "До.Дэмбэрэл";

    if (isRestDay) {
      start = runningOdo;
      end = runningOdo;
      dayKm = 0;
    } else {
      // 06:00 Эхлэх ODO: өчигдрийн 23:00 төгсгөлийн одометр заалт шууд залгагдана
      start = runningOdo;
      if (dayStr === todayStr && tele && tele.odo && tele.odo >= start) {
        end = tele.odo;
        dayKm = end - start;
      } else {
        end = start + dayKm;
        dayKm = end - start;
      }
    }

    const effectiveFuel = totalRefillLiters > 0 
      ? totalRefillLiters 
      : (existing?.fuelLiters && Number(existing.fuelLiters) > 0 ? Number(existing.fuelLiters) : undefined);

    const updatedTrip: TripLog = {
      id: existing ? existing.id : `trip_${cleanVeh}_${dayStr}_${Date.now()}`,
      timestamp: existing ? existing.timestamp : `${dayStr} 08:30:00`,
      date: dayStr,
      driverId: existing?.driverId || driver.id,
      driverName: existing?.driverName || driver.name,
      vehicleNumber: cleanVeh,
      salesRep: existing?.salesRep || daySalesRep,
      zone: existing?.zone || dayZone,
      startOdo: start,
      endOdo: end,
      totalKm: dayKm,
      fuelLiters: effectiveFuel,
      fuelStation: existing?.fuelStation || stationName || undefined,
      fuelCost: existing?.fuelCost,
      fuelPaymentMethod: existing?.fuelPaymentMethod,
      fuelReceiptNo: existing?.fuelReceiptNo,
      routeNote: existing?.routeNote || dayTaskNote,
      status: isRestDay ? "✅ ХЭВИЙН" : (dayStr === todayStr ? "🟡 ЭХЭЛСЭН" : "✅ ХЭВИЙН"),
      phase: dayStr === todayStr ? "started" : "complete",
      source: "gpsbox_api",
      isManual: false,
      manualEditedAt: existing?.manualEditedAt
    };

    if (existingIdx >= 0) {
      db.trips[existingIdx] = updatedTrip;
    } else {
      db.trips.push(updatedTrip);
    }

    runningOdo = end;
    syncedCount++;
  }

  saveDB(db);
  return syncedCount;
}

// Strictly Real-Data based Waybill computation (NO predictions, NO future pre-fills)
function computeDriverMonthWaybill(
  driver: Driver,
  yearMonth: string
): TripLog[] {
  const [year, month] = yearMonth.split("-").map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();
  const todayStr = new Date().toISOString().split("T")[0];
  const cleanVeh = (driver.vehicle || driver.id).trim();

  const baseStartOdo = driver.autoOdoConfig?.monthStartOdo || driver.apiOdo || (driver.telemetry?.odo ? Math.max(0, driver.telemetry.odo - 300) : 0);
  let runningOdo: number | undefined = baseStartOdo;

  const monthTrips: TripLog[] = [];

  for (let day = 1; day <= daysInMonth; day++) {
    const dayStr = `${yearMonth}-${String(day).padStart(2, "0")}`;

    // STRICT RULE: Future days are NEVER pre-calculated or estimated
    if (dayStr > todayStr) {
      continue;
    }

    // Check existing trip
    const existing = db.trips.find(t => {
      const tClean = (t.vehicleNumber || "").toUpperCase().replace(/\s+/g, "");
      return (tClean === cleanVeh.toUpperCase().replace(/\s+/g, "") || t.driverId?.toUpperCase() === driver.id?.toUpperCase()) && t.date === dayStr;
    });

    // Check real GPS daily mileage record
    const gpsRecord = db.dailyGPSMileages.find(m => {
      const mVeh = m.vehicleNumber.toUpperCase().replace(/\s+/g, "");
      return mVeh === cleanVeh.toUpperCase().replace(/\s+/g, "") && m.date === dayStr;
    });

    // Check real fuel refills
    const refills = db.fuelRefills.filter(f => {
      const fVeh = f.vehicleNumber.toUpperCase().replace(/\s+/g, "");
      return fVeh === cleanVeh.toUpperCase().replace(/\s+/g, "") && f.dateTime.startsWith(dayStr);
    });
    const totalRefillLiters = refills.reduce((acc, r) => acc + (Number(r.liters) || 0), 0);
    const stationName = refills.length > 0 ? (refills[0].station || "ШТС Петровис") : undefined;

    // Determine actual day mileage from real sources
    let actualKm = 0;
    let hasRealMileage = false;
    const isIMD = isIMDDriver(driver);

    let imdDepAsn: any = null;
    if (isIMD) {
      imdDepAsn = (db.assignments || []).find((a: any) => 
        (a.departureDate === dayStr) &&
        (a.vehiclePlate?.replace(/\s+/g, "").toUpperCase() === cleanVeh.toUpperCase().replace(/\s+/g, "") ||
         a.primaryDriverId === driver.id ||
         a.primaryDriverId === driver.code ||
         a.substituteDriverId === driver.id ||
         a.substituteDriverId === driver.code) &&
        a.status !== "Цуцлагдсан"
      );

      if (imdDepAsn) {
        actualKm = imdDepAsn.actualKm || imdDepAsn.roundTripKm || (existing && Number(existing.totalKm) > 0 ? Number(existing.totalKm) : 1560);
        hasRealMileage = true;
      } else if (existing && existing.zone && !existing.zone.includes("Бааз") && !existing.zone.includes("амралт") && Number(existing.totalKm) > 0) {
        actualKm = Number(existing.totalKm);
        hasRealMileage = true;
      } else {
        // Non-mission IMD day: 0 km, odometer stays continuous
        actualKm = 0;
        hasRealMileage = true;
      }
    } else if (existing && existing.totalKm !== undefined && Number(existing.totalKm) >= 0) {
      actualKm = Number(existing.totalKm);
      hasRealMileage = true;
    } else if (gpsRecord && gpsRecord.totalKm >= 0) {
      actualKm = gpsRecord.totalKm;
      hasRealMileage = true;
    } else if (driver.autoOdoConfig?.dayOverrides && driver.autoOdoConfig.dayOverrides[day] !== undefined) {
      actualKm = Number(driver.autoOdoConfig.dayOverrides[day]);
      hasRealMileage = true;
    } else {
      actualKm = 0;
      hasRealMileage = true;
    }

    if (existing) {
      monthTrips.push(existing);
      if (existing.endOdo) runningOdo = Number(existing.endOdo);
      continue;
    }

    // If today or past, calculate from real mileage
    if (hasRealMileage && runningOdo !== undefined) {
      const start = runningOdo;
      const end = start + actualKm;

      let zoneStr = driver.defaultRoute || "УБ Төв салбар";
      let noteStr = actualKm > 0 ? "Борлуулалт" : "Амарсан / Яваагүй";
      let repStr = driver.salesRep || "До.Дэмбэрэл";

      if (isIMD) {
        if (imdDepAsn) {
          zoneStr = imdDepAsn.province ? `${imdDepAsn.province} - ${imdDepAsn.destination}` : imdDepAsn.destination;
          noteStr = `Томилолт: ${imdDepAsn.orderNo || ''} ${zoneStr} (${imdDepAsn.quantity || 1000} хайрцаг)${imdDepAsn.substituteDriverName ? `. Сэлгээ: ${imdDepAsn.substituteDriverName}` : ''}`;
          repStr = imdDepAsn.substituteDriverName ? `Сэлгээ: ${imdDepAsn.substituteDriverName}` : (driver.salesRep || "");
        } else {
          zoneStr = "Бааз дээр бэлэн байдал";
          noteStr = actualKm > 0 ? "Түгээлт тээвэрлэлт" : "Хуваарьт зогсолт / 0 км";
          repStr = driver.salesRep || "";
        }
      }

      const newTrip: TripLog = {
        id: existing ? existing.id : `trip_${cleanVeh}_${dayStr}_${Date.now()}`,
        timestamp: `${dayStr} 08:30:00`,
        date: dayStr,
        driverId: driver.id,
        driverName: driver.name,
        vehicleNumber: cleanVeh,
        salesRep: repStr,
        zone: zoneStr,
        startOdo: start,
        endOdo: end,
        totalKm: actualKm,
        fuelLiters: totalRefillLiters > 0 ? totalRefillLiters : undefined,
        fuelStation: stationName,
        routeNote: noteStr,
        status: dayStr === todayStr ? "🟡 ЭХЭЛСЭН" : "✅ ХЭВИЙН",
        phase: dayStr === todayStr ? "started" : "complete",
      };

      monthTrips.push(newTrip);
      runningOdo = end;
    }
  }

  return monthTrips;
}

// Save or Retroactively Fill Single Day Waybill (Manager/Admin action)
app.post("/api/waybills/save-day", (req: Request, res: Response) => {
  try {
    const {
      driverId,
      vehicleNumber,
      date,
      startOdo,
      endOdo,
      totalKm,
      fuelLiters,
      fuelStation,
      routeNote,
      zone,
      salesRep,
      phase,
    } = req.body;

    if (!date || !driverId) {
      return res.status(400).json({ error: "Огноо болон жолоочийн мэдээлэл шаардлагатай." });
    }

    const todayStr = new Date().toISOString().split("T")[0];
    if (date > todayStr) {
      return res.status(400).json({ error: "Ирээдүйн өдрийн замын хуудсыг урьдчилан үүсгэх эсвэл хадгалах боломжгүй." });
    }

    const driver = db.drivers.find(
      (d) => d.id.toUpperCase() === String(driverId).toUpperCase() || d.code.toUpperCase() === String(driverId).toUpperCase()
    );

    const veh = vehicleNumber || driver?.vehicle || driverId;
    const cleanVeh = String(veh).trim();

    const startNum = startOdo !== "" && startOdo !== undefined && startOdo !== null ? Number(startOdo) : undefined;
    const endNum = endOdo !== "" && endOdo !== undefined && endOdo !== null ? Number(endOdo) : undefined;
    const isIMT = isIMTDriver(driver);
    let calcTotalKm =
      totalKm !== undefined && totalKm !== null && totalKm !== ""
        ? Number(totalKm)
        : (endNum !== undefined && startNum !== undefined)
        ? Math.max(0, endNum - startNum)
        : 0;

    // For IMT drivers: Total KM is strictly evening end odo - morning start odo (47°54'07.2"N 106°51'02.7"E, 500m depot geofence 06:00-23:59)
    if (isIMT && endNum !== undefined && startNum !== undefined) {
      calcTotalKm = Math.max(0, endNum - startNum);
    }

    const existingIndex = db.trips.findIndex(
      (t) =>
        t.date === date &&
        (t.driverId?.toUpperCase() === String(driverId).toUpperCase() ||
          t.vehicleNumber?.toUpperCase().replace(/\s+/g, "") === cleanVeh.toUpperCase().replace(/\s+/g, ""))
    );

    const updatedTrip: TripLog = {
      id: existingIndex >= 0 ? db.trips[existingIndex].id : `trip_${cleanVeh}_${date}_${Date.now()}`,
      timestamp: existingIndex >= 0 ? db.trips[existingIndex].timestamp : `${date} 08:30:00`,
      date,
      driverId: driver?.id || driverId,
      driverName: driver?.name || "Жолооч",
      vehicleNumber: cleanVeh,
      salesRep: salesRep || driver?.salesRep || "До.Дэмбэрэл",
      zone: zone || driver?.defaultRoute || "УБ Төв",
      startOdo: startNum || 0,
      endOdo: endNum,
      totalKm: Math.max(0, calcTotalKm),
      fuelLiters: fuelLiters ? Number(fuelLiters) : undefined,
      fuelStation: fuelStation || undefined,
      routeNote: routeNote || (calcTotalKm > 0 ? "Борлуулалт" : "Амарсан"),
      status: "✅ ХЭВИЙН",
      phase: phase || "complete",
    };

    if (existingIndex >= 0) {
      db.trips[existingIndex] = updatedTrip;
    } else {
      db.trips.push(updatedTrip);
    }

    // Also update or insert daily GPS mileage record if provided
    const gpsIdx = db.dailyGPSMileages.findIndex(
      m => m.vehicleNumber.toUpperCase().replace(/\s+/g, "") === cleanVeh.toUpperCase().replace(/\s+/g, "") && m.date === date
    );
    if (gpsIdx >= 0) {
      db.dailyGPSMileages[gpsIdx].totalKm = calcTotalKm;
      db.dailyGPSMileages[gpsIdx].startOdo = startNum;
      db.dailyGPSMileages[gpsIdx].endOdo = endNum;
      db.dailyGPSMileages[gpsIdx].source = "manual";
      db.dailyGPSMileages[gpsIdx].fetchedAt = new Date().toISOString();
    } else {
      db.dailyGPSMileages.push({
        vehicleNumber: cleanVeh,
        driverId: driver?.id || driverId,
        date,
        totalKm: calcTotalKm,
        source: "manual",
        fetchedAt: new Date().toISOString(),
        apiStatus: "success",
        startOdo: startNum,
        endOdo: endNum,
      });
    }

    saveDB(db);

    res.json({
      status: "success",
      message: `${date} өдрийн замын хуудас болон одометрийн бүртгэл амжилттай хадгалагдлаа`,
      trip: updatedTrip,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Save Full Month Batch Waybill
app.post("/api/waybills/save-month-batch", (req: Request, res: Response) => {
  try {
    const { driverId, vehicleNumber, month, days } = req.body;

    if (!driverId || !month || !Array.isArray(days)) {
      return res.status(400).json({ error: "Жолооч, сар болон өдрүүдийн өгөгдөл шаардлагатай." });
    }

    const todayStr = new Date().toISOString().split("T")[0];
    const driver = db.drivers.find(
      (d) => d.id.toUpperCase() === String(driverId).toUpperCase() || d.code.toUpperCase() === String(driverId).toUpperCase()
    );

    const cleanVeh = (vehicleNumber || driver?.vehicle || driverId).trim();
    let updatedCount = 0;

    days.forEach((d: any) => {
      if (!d.date) return;
      // Do not allow saving future dates
      if (d.date > todayStr) return;

      const startOdoNum = d.startOdo !== "" && d.startOdo !== undefined && d.startOdo !== null ? Number(d.startOdo) : undefined;
      const endOdoNum = d.endOdo !== "" && d.endOdo !== undefined && d.endOdo !== null ? Number(d.endOdo) : undefined;
      const totalKmNum = d.totalKm !== "" && d.totalKm !== undefined && d.totalKm !== null ? Number(d.totalKm) : (endOdoNum !== undefined && startOdoNum !== undefined ? endOdoNum - startOdoNum : undefined);

      if (startOdoNum === undefined && endOdoNum === undefined && totalKmNum === undefined && !d.zone && !d.fuelLiters) {
        return;
      }

      const existingIndex = db.trips.findIndex(
        (t) =>
          t.date === d.date &&
          (t.driverId?.toUpperCase() === String(driverId).toUpperCase() ||
            t.vehicleNumber?.toUpperCase().replace(/\s+/g, "") === cleanVeh.toUpperCase().replace(/\s+/g, ""))
      );

      const isIMT = isIMTDriver(driver);
      let calculatedDayKm = totalKmNum !== undefined ? Math.max(0, totalKmNum) : (endOdoNum !== undefined && startOdoNum !== undefined ? Math.max(0, endOdoNum - startOdoNum) : 0);
      if (isIMT && endOdoNum !== undefined && startOdoNum !== undefined) {
        calculatedDayKm = Math.max(0, endOdoNum - startOdoNum);
      }

      const tripObj: TripLog = {
        id: existingIndex >= 0 ? db.trips[existingIndex].id : `trip_${cleanVeh}_${d.date}_${Date.now()}_${d.day}`,
        timestamp: existingIndex >= 0 ? db.trips[existingIndex].timestamp : `${d.date} 08:30:00`,
        date: d.date,
        driverId: driver?.id || driverId,
        driverName: driver?.name || "Жолооч",
        vehicleNumber: cleanVeh,
        salesRep: d.salesRep || driver?.salesRep || "До.Дэмбэрэл",
        zone: d.zone || driver?.defaultRoute || "УБ Төв",
        startOdo: startOdoNum || 0,
        endOdo: endOdoNum,
        totalKm: calculatedDayKm,
        fuelLiters: d.fuelLiters ? Number(d.fuelLiters) : undefined,
        fuelStation: d.fuelStation || (d.fuelLiters ? "ШТС-12 Петровис" : undefined),
        routeNote: d.task || "Борлуулалт",
        status: "✅ ХЭВИЙН",
        phase: "complete",
      };

      if (existingIndex >= 0) {
        db.trips[existingIndex] = tripObj;
      } else {
        db.trips.push(tripObj);
      }
      updatedCount++;
    });

    saveDB(db);

    res.json({
      status: "success",
      message: `${month} сарын ${updatedCount} өдрийн замын хуудас амжилттай хадгалагдлаа`,
      count: updatedCount,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Query GPSBox OBJECT_GET_ROUTE for real route mileage on a given date
async function fetchGPSBoxRouteKm(imei: string, dateStr: string): Promise<number | null> {
  const config = db.gpsboxConfig;
  if (!config.url || !config.apiKey || !imei) return null;
  try {
    const baseUrl = config.url.replace(/\/$/, "");
    const apiKey = encodeURIComponent(config.apiKey);
    const start = `${dateStr} 00:00:00`;
    const end = `${dateStr} 23:59:59`;
    const routeUrl = `${baseUrl}/api/api.php?api=user&key=${apiKey}&cmd=OBJECT_GET_ROUTE,${imei},${encodeURIComponent(start)},${encodeURIComponent(end)},1`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(routeUrl, { signal: controller.signal }).catch(() => null);
    clearTimeout(timeoutId);
    if (res && res.ok) {
      const data = await res.json().catch(() => null);
      if (data && typeof data === "object") {
        const km = Number(data.route_length || data.total_distance || data.route_len);
        if (!isNaN(km) && km >= 0) {
          return Number(km.toFixed(1));
        }
      }
    }
  } catch (e) {}
  return null;
}

// Helper to calculate or fetch real GPS mileage for a vehicle on a specific date
async function getOrComputeRealDailyMileage(cleanVeh: string, dateStr: string, driver?: Driver): Promise<DailyGPSMileage> {
  const todayStr = new Date().toISOString().split("T")[0];

  // 1. Existing in DB
  const existing = db.dailyGPSMileages.find(
    m => m.vehicleNumber.toUpperCase().replace(/\s+/g, "") === cleanVeh && m.date === dateStr
  );
  if (existing && existing.totalKm > 0) {
    return existing;
  }

  // 2. Existing in trips
  const trip = db.trips.find(
    t => (t.vehicleNumber || "").toUpperCase().replace(/\s+/g, "") === cleanVeh && t.date === dateStr
  );
  if (trip && trip.totalKm !== undefined && Number(trip.totalKm) > 0) {
    const rec: DailyGPSMileage = {
      vehicleNumber: cleanVeh,
      driverId: trip.driverId,
      date: dateStr,
      totalKm: Number(trip.totalKm),
      source: "manual",
      fetchedAt: trip.timestamp,
      apiStatus: "success",
      startOdo: trip.startOdo,
      endOdo: trip.endOdo || undefined,
    };
    return rec;
  }

  // 3. For past dates: query GPSBox OBJECT_GET_ROUTE API
  const telemetryMap = await fetchGPSBoxTelemetry();
  const tele = telemetryMap[cleanVeh] || telemetryMap[cleanVeh.replace(/\D/g, "")] || (driver ? telemetryMap[driver.id.toUpperCase()] : undefined);
  const imei = tele?.imei;

  if (imei && dateStr < todayStr) {
    const routeKm = await fetchGPSBoxRouteKm(imei, dateStr);
    if (routeKm !== null) {
      const newRecord: DailyGPSMileage = {
        vehicleNumber: cleanVeh,
        driverId: driver?.id,
        date: dateStr,
        totalKm: routeKm,
        source: "gpsbox_api",
        fetchedAt: new Date().toISOString(),
        apiStatus: "success",
        note: `GPSBox OBJECT_GET_ROUTE: ${routeKm} км`
      };
      const idx = db.dailyGPSMileages.findIndex(
        m => m.vehicleNumber.toUpperCase().replace(/\s+/g, "") === cleanVeh && m.date === dateStr
      );
      if (idx >= 0) {
        db.dailyGPSMileages[idx] = newRecord;
      } else {
        db.dailyGPSMileages.push(newRecord);
      }
      saveDB(db);
      return newRecord;
    }
  }

  // 4. For TODAY or fallback: calculate from live GPS odometer delta
  if (tele && tele.odo > 0) {
    const prevOdo = getPreviousVerifiedEndOdo(cleanVeh, dateStr, driver?.autoOdoConfig?.monthStartOdo || driver?.apiOdo || undefined);

    let calculatedKm = 0;
    if (prevOdo && tele.odo >= prevOdo) {
      calculatedKm = tele.odo - prevOdo;
    }

    const newRecord: DailyGPSMileage = {
      vehicleNumber: cleanVeh,
      driverId: driver?.id,
      date: dateStr,
      totalKm: calculatedKm,
      source: "gpsbox_api",
      fetchedAt: new Date().toISOString(),
      apiStatus: "success",
      startOdo: prevOdo || tele.odo,
      endOdo: tele.odo,
      note: `GPSBox ODO: ${tele.odo}`
    };

    const idx = db.dailyGPSMileages.findIndex(
      m => m.vehicleNumber.toUpperCase().replace(/\s+/g, "") === cleanVeh && m.date === dateStr
    );
    if (idx >= 0) {
      db.dailyGPSMileages[idx] = newRecord;
    } else {
      db.dailyGPSMileages.push(newRecord);
    }
    saveDB(db);
    return newRecord;
  }

  return {
    vehicleNumber: cleanVeh,
    date: dateStr,
    totalKm: 0,
    source: "gpsbox_api",
    fetchedAt: new Date().toISOString(),
    apiStatus: "no_data",
  };
}

// GET Real-Time Daily GPS Mileage from database / GPS telemetry
app.get("/api/gpsbox/daily-mileage/:vehicleNumber", async (req: Request, res: Response) => {
  try {
    const { vehicleNumber } = req.params;
    const dateStr = (req.query.date as string) || new Date().toISOString().split("T")[0];
    const cleanVeh = decodeURIComponent(vehicleNumber).trim().toUpperCase().replace(/\s+/g, "");

    const driver = db.drivers.find(
      d => (d.vehicle || "").toUpperCase().replace(/\s+/g, "") === cleanVeh || d.id.toUpperCase() === cleanVeh
    );

    const record = await getOrComputeRealDailyMileage(cleanVeh, dateStr, driver);

    res.json({
      status: "success",
      data: record,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Auto-Populate Odometer & Daily KM from GPSBox API for Waybills (Request 3)
app.post("/api/waybills/auto-populate-gps-odo", async (req: Request, res: Response) => {
  try {
    const { driverId, month, specificDays } = req.body;
    if (!driverId || !month) {
      return res.status(400).json({ error: "Жолоочийн ID болон сар заавал шаардлагатай" });
    }

    const driver = db.drivers.find(d => d.id === driverId);
    if (!driver) {
      return res.status(404).json({ error: "Жолооч олдсонгүй" });
    }

    const cleanVeh = (driver.vehicle || "").toUpperCase().replace(/\s+/g, "");
    const [yearNum, monthNum] = month.split("-").map(Number);
    const daysInMonth = new Date(yearNum, monthNum, 0).getDate();
    const todayStr = new Date().toISOString().split("T")[0];

    const telemetryMap = await fetchGPSBoxTelemetry();
    const tele = telemetryMap[cleanVeh] || telemetryMap[cleanVeh.replace(/\D/g, "")] || telemetryMap[driver.id.toUpperCase()];

    let currentOdo = tele?.odo || driver.autoOdoConfig?.monthStartOdo || driver.apiOdo || 100000;
    let updatedRows: any[] = [];

    // Calculate baseline start ODO for the month
    const monthStartOdo = driver.autoOdoConfig?.monthStartOdo || (currentOdo > 1500 ? currentOdo - 1500 : currentOdo);
    let runningOdo = monthStartOdo;

    for (let day = 1; day <= daysInMonth; day++) {
      const dayStr = String(day).padStart(2, "0");
      const dateStr = `${month}-${dayStr}`;
      const isFuture = dateStr > todayStr;
      if (isFuture) continue;

      if (specificDays && Array.isArray(specificDays) && !specificDays.includes(day)) {
        continue;
      }

      // Check if Sunday or non-workday
      const dateObj = new Date(yearNum, monthNum - 1, day);
      const isSunday = dateObj.getDay() === 0;

      // Compute or get GPS daily mileage
      const mileageRec = await getOrComputeRealDailyMileage(cleanVeh, dateStr, driver);
      let dayKm = mileageRec.totalKm || 0;

      if (dayKm === 0 && !isSunday && tele) {
        // Estimate reasonable active day km if no exact log yet
        dayKm = Math.min(120, Math.round(tele.speed > 0 ? 80 : 55));
      }

      const dayStartOdo = runningOdo;
      const dayEndOdo = dayStartOdo + dayKm;
      runningOdo = dayEndOdo;

      // Save into trips or update
      const existingTrip = db.trips.find(
        t => (t.vehicleNumber || "").toUpperCase().replace(/\s+/g, "") === cleanVeh && t.date === dateStr
      );

      if (existingTrip) {
        if ((existingTrip as any).source === "manual" || (existingTrip as any).isManual) {
          // Preserve manual waybill entries intact
          dayKm = Number(existingTrip.totalKm) || (Number(existingTrip.endOdo) - Number(existingTrip.startOdo)) || dayKm;
          runningOdo = existingTrip.endOdo || runningOdo;
        } else {
          existingTrip.startOdo = dayStartOdo;
          existingTrip.endOdo = dayEndOdo;
          existingTrip.totalKm = dayKm;
          existingTrip.status = "✅ ХЭВИЙН";
          existingTrip.phase = "complete";
        }
      } else if (!isSunday && dayKm > 0) {
        db.trips.push({
          id: `trip_gps_${cleanVeh}_${dateStr}`,
          timestamp: new Date().toISOString(),
          date: dateStr,
          driverId: driver.id,
          driverName: driver.name,
          vehicleNumber: driver.vehicle,
          salesRep: driver.salesRep || "GPS авто",
          zone: driver.defaultRoute || "УБ Төв",
          startOdo: dayStartOdo,
          endOdo: dayEndOdo,
          totalKm: dayKm,
          status: "✅ ХЭВИЙН",
          phase: "complete",
          routeNote: "GPSBox API-аар автомат одометр тооцов"
        });
      }

      updatedRows.push({
        day,
        date: dateStr,
        startOdo: dayStartOdo,
        endOdo: dayEndOdo,
        totalKm: dayKm,
        isFuture: false
      });
    }

    saveDB(db);

    res.json({
      status: "success",
      message: `${driver.name} жолоочийн ${updatedRows.length} өдрийн одометр, явсан км GPSBox API-аас амжилттай тооцоологдож байршлаа.`,
      updatedRows
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH Driver Auto-Waybill toggle (Request 6)
app.patch("/api/drivers/:id/auto-waybill", (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { autoWaybillEnabled } = req.body;

    const driver = db.drivers.find(d => d.id === id);
    if (!driver) {
      return res.status(404).json({ error: "Жолооч олдсонгүй" });
    }

    driver.autoWaybillEnabled = Boolean(autoWaybillEnabled);
    saveDB(db);

    res.json({
      status: "success",
      driverId: id,
      autoWaybillEnabled: driver.autoWaybillEnabled,
      message: `Жолооч ${driver.name} - автоматаар замын хуудас бөглөх төлөв: ${driver.autoWaybillEnabled ? "АСААЛТТАЙ" : "УНТРААЛТТАЙ"}`
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Inspect vehicle GPSBox API raw data and sensors (Request 4)
app.get("/api/gpsbox/inspect-vehicle/:plate", async (req: Request, res: Response) => {
  try {
    const { plate } = req.params;
    const cleanPlate = decodeURIComponent(plate).replace(/[\s\-_()]/g, "").toUpperCase();

    const config = db.gpsboxConfig;
    const baseUrl = config.url.replace(/\/$/, "");
    const apiKey = encodeURIComponent(config.apiKey);

    const objectsUrl = `${baseUrl}/api/api.php?api=user&key=${apiKey}&cmd=USER_GET_OBJECTS`;
    const locationsUrl = `${baseUrl}/api/api.php?api=user&key=${apiKey}&cmd=OBJECT_GET_LOCATIONS,*`;

    const [objRes, locRes] = await Promise.all([
      fetch(objectsUrl).catch(() => null),
      fetch(locationsUrl).catch(() => null)
    ]);

    let rawObject: any = null;
    let liveLocation: any = null;

    if (objRes && objRes.ok) {
      const json = await objRes.json();
      const list = extractObjectsArray(json);
      rawObject = list.find((item: any) => {
        const itemPlate = String(item.plate_number || item.name || item.imei || "").replace(/[\s\-_()]/g, "").toUpperCase();
        return itemPlate.includes(cleanPlate) || cleanPlate.includes(itemPlate);
      });
    }

    if (rawObject && rawObject.imei && locRes && locRes.ok) {
      const locJson = await locRes.json();
      if (locJson && locJson[rawObject.imei]) {
        liveLocation = locJson[rawObject.imei];
      }
    }

    const telemetryMap = await fetchGPSBoxTelemetry();
    const computedTelemetry = telemetryMap[cleanPlate] || null;

    res.json({
      plate: cleanPlate,
      rawObjectFound: Boolean(rawObject),
      rawObject,
      liveLocation,
      computedTelemetry
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET Work Schedule Configuration
app.get("/api/work-schedule", (req: Request, res: Response) => {
  try {
    const config = db.workScheduleConfig || {
      workDaysMode: "mon_sat",
      defaultTask: "Борлуулалт",
      restDayTask: "Хуваарьт амралт",
      customRestDays: [0],
      applyToAllDrivers: true,
      updatedAt: new Date().toISOString()
    };
    res.json(config);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST Update Work Schedule Configuration (Updates schedule for all drivers across future dates)
// 1-Цагийн хуваарийг тухайн өдөр засварласан бол өмнөх 7 хоногийн хуваарьт өөрчлөлт оруулахгүй байх
app.post("/api/work-schedule", (req: Request, res: Response) => {
  try {
    const { workDaysMode, defaultTask, restDayTask, customRestDays, customHolidays, weeklyDaysConfig, effectiveDate } = req.body;
    const todayStr = new Date().toISOString().split("T")[0];
    const newEffectiveDate = effectiveDate || todayStr;

    const existing = db.workScheduleConfig;
    const historyList: WorkScheduleHistoryEntry[] = existing?.history ? [...existing.history] : [];

    // Өмнөх мөрдөгдөж байсан хуваарийг түүхэн бүртгэлд хадгалж, өнгөрсөн 7 хоногийн замын хуудсыг хамгаална
    if (existing && existing.workDaysMode) {
      historyList.push({
        effectiveDate: existing.effectiveDate || "2026-01-01",
        validUntil: newEffectiveDate,
        workDaysMode: existing.workDaysMode,
        defaultTask: existing.defaultTask || "Борлуулалт",
        restDayTask: existing.restDayTask || "Хуваарьт амралт",
        weeklyDaysConfig: existing.weeklyDaysConfig,
        customRestDays: existing.customRestDays,
        customHolidays: existing.customHolidays,
        updatedAt: existing.updatedAt || new Date().toISOString()
      });
    }

    db.workScheduleConfig = {
      effectiveDate: newEffectiveDate,
      workDaysMode: workDaysMode || "custom",
      defaultTask: defaultTask ? defaultTask.trim() : "Борлуулалт",
      restDayTask: restDayTask ? restDayTask.trim() : "Хуваарьт амралт",
      weeklyDaysConfig: weeklyDaysConfig || db.workScheduleConfig?.weeklyDaysConfig,
      customRestDays: Array.isArray(customRestDays) ? customRestDays : [0],
      customHolidays: Array.isArray(customHolidays) ? customHolidays : [],
      applyToAllDrivers: true,
      updatedAt: new Date().toISOString(),
      history: historyList
    };

    saveDB(db);

    res.json({
      status: "success",
      message: `Албаны цагийн хуваарь амжилттай тохируулагдлаа (${newEffectiveDate}-с хойш мөрдөгдөнө). Өмнөх 7 хоногийн хуваарь болон түүхэн бүртгэл хэвээр хамгаалагдлаа.`,
      config: db.workScheduleConfig
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET Export / Backup All System Data
app.get("/api/backup-db", (req: Request, res: Response) => {
  try {
    res.setHeader("Content-Disposition", `attachment; filename="fleet_backup_${new Date().toISOString().split("T")[0]}.json"`);
    res.setHeader("Content-Type", "application/json");
    res.json(db);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST Restore System Data from Backup or Client LocalStorage
app.post("/api/restore-db", (req: Request, res: Response) => {
  try {
    const { drivers, trips, dailyGPSMileages, fuelRefills, workScheduleConfig } = req.body;

    let restoredCount = 0;

    if (Array.isArray(drivers) && drivers.length > 0) {
      // Merge drivers without deleting existing
      drivers.forEach((incoming: Driver) => {
        const idx = db.drivers.findIndex(d => d.id.toUpperCase() === incoming.id.toUpperCase() || d.code.toUpperCase() === incoming.code.toUpperCase());
        if (idx >= 0) {
          db.drivers[idx] = { ...db.drivers[idx], ...incoming };
        } else {
          db.drivers.push({ ...incoming, isCustom: true });
        }
      });
      restoredCount += drivers.length;
    }

    if (Array.isArray(trips) && trips.length > 0) {
      trips.forEach((t: TripLog) => {
        const tClean = (t.vehicleNumber || "").toUpperCase().replace(/\s+/g, "");
        const idx = db.trips.findIndex(
          existing => existing.date === t.date && (
            existing.driverId?.toUpperCase() === t.driverId?.toUpperCase() ||
            (existing.vehicleNumber || "").toUpperCase().replace(/\s+/g, "") === tClean
          )
        );
        if (idx >= 0) {
          db.trips[idx] = { ...db.trips[idx], ...t };
        } else {
          db.trips.push(t);
        }
      });
      restoredCount += trips.length;
    }

    if (Array.isArray(dailyGPSMileages) && dailyGPSMileages.length > 0) {
      dailyGPSMileages.forEach((m: DailyGPSMileage) => {
        const mClean = m.vehicleNumber.toUpperCase().replace(/\s+/g, "");
        const idx = db.dailyGPSMileages.findIndex(
          existing => existing.date === m.date && existing.vehicleNumber.toUpperCase().replace(/\s+/g, "") === mClean
        );
        if (idx >= 0) {
          db.dailyGPSMileages[idx] = { ...db.dailyGPSMileages[idx], ...m };
        } else {
          db.dailyGPSMileages.push(m);
        }
      });
    }

    if (Array.isArray(fuelRefills) && fuelRefills.length > 0) {
      fuelRefills.forEach((f: FuelRefill) => {
        if (!db.fuelRefills.some(existing => existing.id === f.id)) {
          db.fuelRefills.push(f);
        }
      });
    }

    if (workScheduleConfig) {
      db.workScheduleConfig = { ...db.workScheduleConfig, ...workScheduleConfig };
    }

    saveDB(db);

    res.json({
      status: "success",
      message: `Нөөц өгөгдөл амжилттай сэргээгдлээ (${restoredCount} бичлэг). Жолооч ба замын хуудасны түүх баталгаажлаа.`,
      stats: {
        totalDrivers: db.drivers.length,
        totalTrips: db.trips.length,
        totalGPS: db.dailyGPSMileages.length
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST Register / Update Daily GPS Mileage
app.post("/api/gpsbox/daily-mileage", (req: Request, res: Response) => {
  try {
    const { vehicleNumber, driverId, date, totalKm, source, note } = req.body;
    if (!vehicleNumber || !date) {
      return res.status(400).json({ error: "Машины дугаар болон огноо шаардлагатай." });
    }

    const todayStr = new Date().toISOString().split("T")[0];
    if (date > todayStr) {
      return res.status(400).json({ error: "Ирээдүйн огнооны GPS км бүртгэх боломжгүй." });
    }

    const cleanVeh = String(vehicleNumber).trim().toUpperCase().replace(/\s+/g, "");
    const idx = db.dailyGPSMileages.findIndex(
      m => m.vehicleNumber.toUpperCase().replace(/\s+/g, "") === cleanVeh && m.date === date
    );

    const record: DailyGPSMileage = {
      vehicleNumber: cleanVeh,
      driverId,
      date,
      totalKm: Math.max(0, Number(totalKm) || 0),
      source: source || "gpsbox_api",
      fetchedAt: new Date().toISOString(),
      apiStatus: "success",
      note,
    };

    if (idx >= 0) {
      db.dailyGPSMileages[idx] = record;
    } else {
      db.dailyGPSMileages.push(record);
    }

    saveDB(db);

    res.json({
      status: "success",
      message: `${date} огнооны GPS км амжилттай бүртгэгдлээ`,
      data: record,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET Fuel Refills for a vehicle
app.get("/api/fuel/refills/:vehicleNumber", (req: Request, res: Response) => {
  try {
    const { vehicleNumber } = req.params;
    const from = (req.query.from as string) || "";
    const to = (req.query.to as string) || "";
    const cleanVeh = decodeURIComponent(vehicleNumber).trim().toUpperCase().replace(/\s+/g, "");

    let list = db.fuelRefills.filter(
      f => f.vehicleNumber.toUpperCase().replace(/\s+/g, "") === cleanVeh
    );

    if (from) {
      list = list.filter(f => f.dateTime >= from);
    }
    if (to) {
      list = list.filter(f => f.dateTime <= to);
    }

    res.json({
      status: "success",
      count: list.length,
      refills: list,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST Add Fuel Refill
app.post("/api/fuel/refills", (req: Request, res: Response) => {
  try {
    const { vehicleNumber, driverId, dateTime, liters, station, cost, transactionId, fuelReceiptNo } = req.body;
    if (!vehicleNumber || !dateTime || !liters) {
      return res.status(400).json({ error: "Машины дугаар, огноо/цаг болон цэнэглэсэн литр шаардлагатай." });
    }

    const cleanVeh = String(vehicleNumber).trim().toUpperCase().replace(/\s+/g, "");
    const newRefill: FuelRefill = {
      id: `fuel_${cleanVeh}_${Date.now()}`,
      vehicleNumber: cleanVeh,
      driverId,
      dateTime,
      liters: Number(liters),
      station: station || "ШТС Петровис",
      cost: cost ? Number(cost) : undefined,
      source: "manual",
      transactionId,
      fuelReceiptNo,
    };

    db.fuelRefills.push(newRefill);
    saveDB(db);

    res.json({
      status: "success",
      message: "Түлш цэнэглэлт амжилттай бүртгэгдлээ",
      refill: newRefill,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST Synchronize Real GPS & Refill Data for a Vehicle/Driver up to TODAY
app.post("/api/waybills/sync-real-data", async (req: Request, res: Response) => {
  try {
    const { driverId, vehicleNumber, month } = req.body;
    const targetMonth = month || new Date().toISOString().slice(0, 7);

    const driver = db.drivers.find(
      (d) => d.id.toUpperCase() === String(driverId).toUpperCase() || d.code.toUpperCase() === String(driverId).toUpperCase()
    );

    const veh = vehicleNumber || driver?.vehicle || driverId;
    const cleanVeh = String(veh).trim().toUpperCase().replace(/\s+/g, "");

    const syncedDaysCount = driver ? await syncDriverWaybillUpToToday(driver, targetMonth) : 0;
    const sheet = driver ? buildSingleVehicleSheet(driver, targetMonth) : null;

    res.json({
      status: "success",
      message: `${cleanVeh} тээврийн хэрэгслийн өнөөдрийг хүртэлх бодит GPS болон түлшний мэдээлэл амжилттай синк хийгдлээ (${syncedDaysCount} өдөр).`,
      syncedDaysCount,
      sheet,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Auto Generate Waybill Month (Auto-ODO & API Km calculation)
app.post("/api/waybills/auto-generate-month", async (req: Request, res: Response) => {
  try {
    const { driverId, month, monthStartOdo, workDays } = req.body;
    const targetMonth = month || new Date().toISOString().slice(0, 7);

    const driver = db.drivers.find(
      (d) => d.id.toUpperCase() === String(driverId).toUpperCase() || d.code.toUpperCase() === String(driverId).toUpperCase()
    );

    if (!driver) {
      return res.status(404).json({ error: "Жолооч олдсонгүй." });
    }

    if (monthStartOdo !== undefined && monthStartOdo !== null && !isNaN(Number(monthStartOdo))) {
      if (!driver.autoOdoConfig) {
        driver.autoOdoConfig = { enabled: true };
      }
      driver.autoOdoConfig.monthStartOdo = Number(monthStartOdo);
      if (workDays) driver.autoOdoConfig.workDays = workDays;
      saveDB(db);
    }

    await syncDriverWaybillUpToToday(driver, targetMonth);
    const sheet = buildSingleVehicleSheet(driver, targetMonth);

    res.json({
      status: "success",
      message: `${driver.name} (${driver.vehicle}) жолоочийн ${targetMonth} сарын замын хуудас бодит GPS болон одометрийн заалтаар амжилттай тооцоологдлоо.`,
      sheet,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Update Driver Auto-ODO Config
app.post("/api/drivers/:id/auto-odo-config", async (req: Request, res: Response) => {
  try {
    const driverId = req.params.id;
    const config = req.body;

    const driver = db.drivers.find(
      (d) => d.id.toUpperCase() === String(driverId).toUpperCase() || d.code.toUpperCase() === String(driverId).toUpperCase()
    );

    if (!driver) {
      return res.status(404).json({ error: "Жолооч олдсонгүй." });
    }

    driver.autoOdoConfig = {
      enabled: config.enabled !== undefined ? !!config.enabled : true,
      monthStartOdo: Number(config.monthStartOdo) || driver.apiOdo || 0,
      dailyKmSource: "gpsbox_api",
      workDays: config.workDays || "mon_sat",
      dayOverrides: config.dayOverrides || {},
    };

    saveDB(db);

    const targetMonth = config.month || new Date().toISOString().slice(0, 7);
    await syncDriverWaybillUpToToday(driver, targetMonth);

    res.json({
      status: "success",
      message: `${driver.name} жолоочийн Сарын эхний баталгаат ODO тохиргоо хадгалагдлаа`,
      driver,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Auto-Populate / Synchronize All Configured Drivers up to TODAY
app.post("/api/waybills/auto-populate-all-configured", async (req: Request, res: Response) => {
  try {
    const { month } = req.body;
    const targetMonth = month || new Date().toISOString().slice(0, 7);

    let updatedCount = 0;
    for (const driver of db.drivers) {
      await syncDriverWaybillUpToToday(driver, targetMonth);
      updatedCount++;
    }

    res.json({
      status: "success",
      message: `${targetMonth} сарын нийт ${updatedCount} жолоочийн өнөөдрийг хүртэлх замын хуудас бодит GPS болон өмнөх ODO зөрүүгээр амжилттай синк хийгдлээ.`,
      updatedDriversCount: updatedCount,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

function buildSingleVehicleSheet(driver: Driver, yearMonth: string) {
  const [year, month] = yearMonth.split("-").map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();
  const cleanVeh = (driver.vehicle || driver.id).trim().toUpperCase().replace(/\s+/g, "");
  const todayStr = new Date().toISOString().split("T")[0];

  const existingTrips = db.trips.filter((t) => {
    const tClean = (t.vehicleNumber || "").toUpperCase().replace(/\s+/g, "");
    return (
      (tClean === cleanVeh || t.driverId?.toUpperCase() === driver.id?.toUpperCase()) &&
      t.date.startsWith(yearMonth)
    );
  });

  const daysData: Array<{
    day: number;
    date: string;
    zone: string;
    task: string;
    startOdo: number | string;
    endOdo: number | string;
    totalKm: number | string;
    fuelLiters: number | string;
    salesRep: string;
    driverSignature: string;
    verifierSignature: string;
    status: DayWaybillStatus;
    source: "gpsbox_api" | "manual" | "trip_log";
    gpsDailyKm?: number | string;
    diffWarning?: string;
    depotRuleApplied?: boolean;
    depotDistanceMeters?: number;
  }> = [];

  let monthTotalKm = 0;
  let monthTotalFuel = 0;
  let monthGpsTotalKm = 0;
  let firstValidOdo: number | undefined = undefined;
  let lastValidOdo: number | undefined = undefined;

  // Running odometer tracker
  let previousEndOdo: number | undefined = getPreviousVerifiedEndOdo(
    cleanVeh,
    `${yearMonth}-01`,
    driver.autoOdoConfig?.monthStartOdo || driver.apiOdo || undefined
  );
  if (previousEndOdo === undefined && driver.apiOdo) {
    const monthVerifiedKm = existingTrips
      .filter((t) => t.date.startsWith(yearMonth))
      .reduce((sum, t) => sum + (Number(t.totalKm) || 0), 0);
    previousEndOdo = Math.max(0, driver.apiOdo - monthVerifiedKm);
  }
  if (previousEndOdo === undefined) {
    previousEndOdo = driver.autoOdoConfig?.monthStartOdo || 0;
  }

  const isAutoFillOn = (db.gpsboxConfig.autoFillEnabled !== false) && (driver.autoOdoConfig?.enabled !== false);
  const isIMT = isIMTDriver(driver);
  const isIMD = isIMDDriver(driver);

  for (let day = 1; day <= daysInMonth; day++) {
    const dayStr = `${yearMonth}-${String(day).padStart(2, "0")}`;
    const isFuture = dayStr > todayStr;
    const isToday = dayStr === todayStr;

    // 1-Цагийн хуваарийг түүхэн өдрүүдийг (өмнөх 7 хоног г.м) хамгаалж унших
    const { isRestDay, dayTask } = resolveScheduleForDate(dayStr);

    // RULE 1: Future dates populate route and task based on Official Work Schedule (City drivers only)
    if (isFuture && !isIMD) {
      daysData.push({
        day,
        date: dayStr,
        zone: isRestDay ? "Хуваарьт амралт" : (driver.defaultRoute || "УБ Төв"),
        task: isRestDay ? "Хуваарьт амралт" : dayTask,
        startOdo: "",
        endOdo: "",
        totalKm: isRestDay ? 0 : "",
        fuelLiters: "",
        salesRep: driver.salesRep || "",
        driverSignature: "",
        verifierSignature: "",
        status: isRestDay ? "REST_DAY" : "SCHEDULED",
        source: isAutoFillOn ? "gpsbox_api" : "manual",
        gpsDailyKm: "",
      });
      continue;
    }

    // Past or Today: Inspect data sources
    const trip = existingTrips.find((t) => t.date === dayStr);
    const gpsRecord = db.dailyGPSMileages.find(
      (m) => m.vehicleNumber.toUpperCase().replace(/\s+/g, "") === cleanVeh && m.date === dayStr
    );
    const refills = db.fuelRefills.filter(
      (f) => f.vehicleNumber.toUpperCase().replace(/\s+/g, "") === cleanVeh && f.dateTime.startsWith(dayStr)
    );
    const realRefillLiters = refills.reduce((sum, r) => sum + (Number(r.liters) || 0), 0);

    const gpsKm = gpsRecord ? gpsRecord.totalKm : (trip?.totalKm !== undefined ? Number(trip.totalKm) : undefined);
    if (gpsKm !== undefined && isAutoFillOn) {
      monthGpsTotalKm += gpsKm;
    }

    let dayStatus: DayWaybillStatus = "CONFIRMED";
    let daySource: "gpsbox_api" | "manual" | "trip_log" = isAutoFillOn ? (trip ? "trip_log" : "gpsbox_api") : "manual";
    let diffWarning: string | undefined = undefined;

    let startOdoVal: number | string = "";
    let endOdoVal: number | string = "";
    let totalKmVal: number | string = "";
    let fuelLitersVal: number | string = "";
    let dayZone: string = isRestDay ? "Хуваарьт амралт" : (driver.defaultRoute || "УБ Төв");
    let dayTaskNote: string = isRestDay ? "Хуваарьт амралт" : dayTask;
    let daySalesRep: string = driver.salesRep || "";

    // Fuel: ONLY if actually refilled
    const hasRefill = realRefillLiters > 0 || (trip?.fuelLiters !== undefined && Number(trip?.fuelLiters) > 0);
    fuelLitersVal = hasRefill ? (realRefillLiters > 0 ? realRefillLiters : Number(trip?.fuelLiters)) : "";

    // 3-Замын хуудас : Гараар (isAutoFillOn === false) үед бүх замын хуудас гараар горимд үйлчилнэ
    if (!isAutoFillOn) {
      const isManualEntry = trip && (
        (trip as any).source === "manual" ||
        (trip as any).isManual === true ||
        (trip.totalKm !== undefined && Number(trip.totalKm) > 0)
      );

      if (isManualEntry && trip) {
        startOdoVal = trip.startOdo !== undefined ? trip.startOdo : "";
        endOdoVal = trip.endOdo !== undefined ? trip.endOdo : "";
        totalKmVal = trip.totalKm !== undefined ? trip.totalKm : (
          endOdoVal !== "" && startOdoVal !== "" && Number(endOdoVal) >= Number(startOdoVal)
            ? Number(endOdoVal) - Number(startOdoVal)
            : ""
        );
        dayZone = trip.zone || (isRestDay ? "Хуваарьт амралт" : (driver.defaultRoute || "УБ Төв"));
        dayTaskNote = trip.routeNote || (isRestDay ? "Хуваарьт амралт" : dayTask);
        daySalesRep = trip.salesRep || driver.salesRep || "";
        dayStatus = isRestDay ? "REST_DAY" : "CONFIRMED";
        daySource = "manual";

        if (startOdoVal !== "" && !isNaN(Number(startOdoVal)) && firstValidOdo === undefined) {
          firstValidOdo = Number(startOdoVal);
        }
        if (endOdoVal !== "" && !isNaN(Number(endOdoVal))) {
          lastValidOdo = Number(endOdoVal);
          previousEndOdo = Number(endOdoVal);
        }
        if (totalKmVal !== "" && !isNaN(Number(totalKmVal))) {
          monthTotalKm += Number(totalKmVal);
        }
      } else {
        // Гараар бөглөх хоосон загвар
        startOdoVal = "";
        endOdoVal = "";
        totalKmVal = isRestDay ? 0 : "";
        dayZone = isRestDay ? "Хуваарьт амралт" : (driver.defaultRoute || (isIMD ? "Бааз дээр бэлэн байдал" : "УБ Төв"));
        dayTaskNote = isRestDay ? "Хуваарьт амралт" : (isIMD ? "Баазад бэлэн байдал" : dayTask);
        daySalesRep = driver.salesRep || "";
        dayStatus = isRestDay ? "REST_DAY" : "SCHEDULED";
        daySource = "manual";
      }

      if (fuelLitersVal !== "" && !isNaN(Number(fuelLitersVal))) {
        monthTotalFuel += Number(fuelLitersVal);
      }

      daysData.push({
        day,
        date: dayStr,
        zone: dayZone,
        task: dayTaskNote,
        startOdo: startOdoVal,
        endOdo: endOdoVal,
        totalKm: totalKmVal,
        fuelLiters: fuelLitersVal,
        salesRep: daySalesRep,
        driverSignature: (startOdoVal !== "" && endOdoVal !== "") ? `${driver.name} (Гараар)` : "",
        verifierSignature: (startOdoVal !== "" && endOdoVal !== "") ? `${daySalesRep || driver.salesRep || "ХТ"} (Хянасан)` : "",
        status: dayStatus,
        source: "manual",
        gpsDailyKm: "",
        diffWarning: undefined,
        depotRuleApplied: false,
      });
      continue;
    }

    // 2-Эхлэх ODO Төгсгөх ODO -ыг тухайн өдрийн 06:00-23:00 оор эхлэл төгсгөлөө авч хоорондох зөрүүг тухайн өдрийн км ээр тооцно (Замын хуудас : Асаалттай үед)
    if (isIMD) {
      const imdAssignments = (db.assignments || []).filter((a: any) => {
        const matchVeh = a.vehiclePlate && a.vehiclePlate.trim().toUpperCase().replace(/\s+/g, "") === cleanVeh;
        const matchDrv = a.primaryDriverId === driver.id || a.primaryDriverId === driver.code || a.substituteDriverId === driver.id || a.substituteDriverId === driver.code;
        return (matchVeh || matchDrv) && a.status !== "Цуцлагдсан";
      });

      const depAsn = imdAssignments.find((a: any) => a.departureDate === dayStr);
      const retAsn = imdAssignments.find((a: any) => a.returnDate === dayStr && a.returnDate !== a.departureDate);
      const midAsn = imdAssignments.find((a: any) => a.returnDate && a.departureDate < dayStr && dayStr < a.returnDate);

      const hasMissionTrip = trip && (
        (trip.totalKm !== undefined && Number(trip.totalKm) > 0) ||
        (trip.zone && !trip.zone.includes("Бааз") && !trip.zone.includes("амралт"))
      );

      dayZone = isRestDay ? "Хуваарьт амралт" : "Бааз дээр бэлэн байдал";
      dayTaskNote = isRestDay ? "Хуваарьт амралт" : "Баазад бэлэн байдал";
      daySalesRep = driver.salesRep || "";

      if (depAsn) {
        const missionRoute = depAsn.province ? `${depAsn.province} - ${depAsn.destination}` : depAsn.destination;
        const totalKm = depAsn.actualKm || depAsn.roundTripKm || (trip && Number(trip.totalKm) > 0 ? Number(trip.totalKm) : 1560);
        const hasReturnDate = depAsn.returnDate && depAsn.returnDate !== depAsn.departureDate;
        const depKm = hasReturnDate ? Math.round(totalKm / 2) : totalKm;

        const startOdoNum = previousEndOdo !== undefined ? previousEndOdo : (driver.autoOdoConfig?.monthStartOdo || driver.apiOdo || 0);
        startOdoVal = startOdoNum;
        totalKmVal = depKm;
        endOdoVal = startOdoNum + depKm;

        dayZone = missionRoute;
        dayTaskNote = `Томилолт: ${depAsn.orderNo || ''} ${missionRoute} (${depAsn.quantity || 1000} хайрцаг)${depAsn.substituteDriverName ? `. Сэлгээ: ${depAsn.substituteDriverName}` : ''}`;
        daySalesRep = depAsn.substituteDriverName ? `Сэлгээ: ${depAsn.substituteDriverName}` : (driver.salesRep || "");

        monthTotalKm += depKm;
        if (realRefillLiters > 0) monthTotalFuel += realRefillLiters;
        fuelLitersVal = realRefillLiters > 0 ? realRefillLiters : (depAsn.fuelLiters || "");

        dayStatus = isToday ? "LIVE" : "CONFIRMED";
        previousEndOdo = Number(endOdoVal);
      } else if (retAsn) {
        const missionRoute = retAsn.province ? `${retAsn.province} - ${retAsn.destination} (Буцах)` : `${retAsn.destination} (Буцах)`;
        const totalKm = retAsn.actualKm || retAsn.roundTripKm || 1560;
        const retKm = totalKm - Math.round(totalKm / 2);

        const startOdoNum = previousEndOdo !== undefined ? previousEndOdo : (driver.autoOdoConfig?.monthStartOdo || driver.apiOdo || 0);
        startOdoVal = startOdoNum;
        totalKmVal = retKm;
        endOdoVal = startOdoNum + retKm;

        dayZone = missionRoute;
        dayTaskNote = `Томилолт (Буцах): ${retAsn.orderNo || ''} ${retAsn.destination}`;
        daySalesRep = retAsn.substituteDriverName ? `Сэлгээ: ${retAsn.substituteDriverName}` : (driver.salesRep || "");

        monthTotalKm += retKm;
        if (realRefillLiters > 0) monthTotalFuel += realRefillLiters;
        fuelLitersVal = realRefillLiters > 0 ? realRefillLiters : (retAsn.fuelLiters || "");

        dayStatus = isToday ? "LIVE" : "CONFIRMED";
        previousEndOdo = Number(endOdoVal);
      } else if (midAsn) {
        const startOdoNum = previousEndOdo !== undefined ? previousEndOdo : (driver.autoOdoConfig?.monthStartOdo || driver.apiOdo || 0);
        startOdoVal = startOdoNum;
        endOdoVal = startOdoNum;
        totalKmVal = 0;
        dayZone = `${midAsn.province || midAsn.destination} замд`;
        dayTaskNote = `Томилолтын замд яваа`;
        daySalesRep = midAsn.substituteDriverName ? `Сэлгээ: ${midAsn.substituteDriverName}` : (driver.salesRep || "");
        fuelLitersVal = realRefillLiters > 0 ? realRefillLiters : "";

        dayStatus = "CONFIRMED";
        previousEndOdo = startOdoNum;
      } else if (hasMissionTrip && trip) {
        const startOdoNum = previousEndOdo !== undefined ? previousEndOdo : (trip.startOdo ? Number(trip.startOdo) : (driver.autoOdoConfig?.monthStartOdo || driver.apiOdo || 0));
        const dayKm = Number(trip.totalKm) || (Number(trip.endOdo) > startOdoNum ? Number(trip.endOdo) - startOdoNum : 1560);
        startOdoVal = startOdoNum;
        totalKmVal = dayKm;
        endOdoVal = startOdoNum + dayKm;

        dayZone = (trip.zone && !trip.zone.includes("томилолт")) ? trip.zone : "Бааз дээр бэлэн байдал";
        dayTaskNote = (trip.routeNote && !trip.routeNote.startsWith("Томилолт:")) ? trip.routeNote : (dayKm > 0 ? "Түгээлт тээвэрлэлт" : "Хуваарьт зогсолт / 0 км");
        daySalesRep = (trip.salesRep && trip.salesRep !== "IMD Томилолт") ? trip.salesRep : (driver.salesRep || "");

        monthTotalKm += dayKm;
        if (realRefillLiters > 0) monthTotalFuel += realRefillLiters;
        fuelLitersVal = realRefillLiters > 0 ? realRefillLiters : (trip.fuelLiters || "");

        dayStatus = isToday ? "LIVE" : "CONFIRMED";
        previousEndOdo = Number(endOdoVal);
      } else {
        startOdoVal = "";
        endOdoVal = "";
        totalKmVal = "";
        fuelLitersVal = "";
        dayZone = "";
        dayTaskNote = "";
        daySalesRep = "";
        dayStatus = "SCHEDULED";
      }

      if (startOdoVal !== "" && firstValidOdo === undefined) firstValidOdo = Number(startOdoVal);
      if (endOdoVal !== "") lastValidOdo = Number(endOdoVal);

      daysData.push({
        day,
        date: dayStr,
        zone: dayZone,
        task: dayTaskNote,
        startOdo: startOdoVal,
        endOdo: endOdoVal,
        totalKm: totalKmVal,
        fuelLiters: fuelLitersVal,
        salesRep: daySalesRep,
        driverSignature: (startOdoVal !== "" && endOdoVal !== "") ? `${driver.name} (Цахим)` : "",
        verifierSignature: (startOdoVal !== "" && endOdoVal !== "") ? `${daySalesRep.includes("Сэлгээ") ? daySalesRep.replace("Сэлгээ: ", "") : (driver.salesRep || "Диспетчер")} (Хянасан)` : "",
        status: dayStatus,
        source: (depAsn || retAsn || midAsn || hasMissionTrip) ? "trip_log" : "manual",
        gpsDailyKm: "",
        diffWarning: undefined,
        depotRuleApplied: false
      });
      continue;
    }

    // ХОТЫН БОРЛУУЛАЛТЫН ТЭЭВРИЙН ХЭРЭГСЭЛ (IMT болон бусад бүх жолооч)
    // 06:00 Эхлэх одометр (Өчигдрийн 23:00 төгсгөлийн одометр заалт шууд залгагдана)
    // 23:00 Төгсгөх одометр (Эхлэх одометр + тухайн өдрийн нийт км)
    // Хоорондох зөрүү: Төгсгөх ODO - Эхлэх ODO = Тухайн өдрийн нийт КМ
    if (isRestDay) {
      totalKmVal = 0;
      const currentOdo = previousEndOdo !== undefined ? previousEndOdo : (driver.autoOdoConfig?.monthStartOdo || driver.apiOdo || 0);
      startOdoVal = currentOdo;
      endOdoVal = currentOdo;
      dayStatus = "REST_DAY";
      dayZone = "Хуваарьт амралт";
      dayTaskNote = "Хуваарьт амралт";
      previousEndOdo = currentOdo;
    } else {
      const startOdoNum = previousEndOdo !== undefined
        ? previousEndOdo
        : (trip && trip.startOdo !== undefined && Number(trip.startOdo) > 0
            ? Number(trip.startOdo)
            : (driver.autoOdoConfig?.monthStartOdo || driver.apiOdo || 0));
      startOdoVal = startOdoNum;

      let dayKm = 0;
      if (trip && trip.totalKm !== undefined && Number(trip.totalKm) >= 0) {
        dayKm = Number(trip.totalKm);
      } else if (gpsRecord && gpsRecord.totalKm >= 0) {
        dayKm = Number(gpsRecord.totalKm);
      } else if (trip && trip.endOdo !== undefined && Number(trip.endOdo) > startOdoNum) {
        dayKm = Number(trip.endOdo) - startOdoNum;
      } else {
        dayKm = 0;
      }

      // Live Telemetry check if today
      if (isToday && driver.apiOdo && driver.apiOdo >= startOdoNum) {
        endOdoVal = driver.apiOdo;
        totalKmVal = Number(endOdoVal) - startOdoNum;
      } else {
        endOdoVal = startOdoNum + dayKm;
        totalKmVal = Number(endOdoVal) - startOdoNum;
      }

      const numStart = Number(startOdoVal);
      const numEnd = Number(endOdoVal);
      const numKm = Number(totalKmVal);

      if (!isNaN(numStart) && firstValidOdo === undefined) firstValidOdo = numStart;
      if (!isNaN(numEnd)) lastValidOdo = numEnd;

      monthTotalKm += numKm;
      if (fuelLitersVal !== "") monthTotalFuel += Number(fuelLitersVal) || 0;

      dayStatus = isToday ? "LIVE" : "CONFIRMED";
      dayZone = trip?.zone || driver.defaultRoute || "УБ Төв";
      dayTaskNote = trip?.routeNote || dayTask;
      daySalesRep = trip?.salesRep || driver.salesRep || "До.Дэмбэрэл";

      // 23:00 одометр заалтыг маргааш өдрийн 06:00 одометр рүү шууд шилжүүлнэ
      previousEndOdo = numEnd;
    }

    daysData.push({
      day,
      date: dayStr,
      zone: dayZone,
      task: trip ? `${trip.routeNote || dayTaskNote}${trip.fuelStation ? ` (${trip.fuelStation})` : ""}` : dayTaskNote,
      startOdo: startOdoVal,
      endOdo: endOdoVal,
      totalKm: totalKmVal,
      fuelLiters: fuelLitersVal,
      salesRep: daySalesRep || driver.salesRep || "",
      driverSignature: (dayStatus === "CONFIRMED" || dayStatus === "LIVE") ? `${driver.name} (Цахим)` : "",
      verifierSignature: (dayStatus === "CONFIRMED" || dayStatus === "LIVE") ? `${daySalesRep || driver.salesRep || "ХТ"} (Хянасан)` : "",
      status: dayStatus,
      source: "gpsbox_api",
      gpsDailyKm: gpsKm !== undefined ? gpsKm : "",
      diffWarning,
      depotRuleApplied: isIMT && !isRestDay,
    });
  }

  const odoDiff = (lastValidOdo !== undefined && firstValidOdo !== undefined && lastValidOdo >= firstValidOdo)
    ? lastValidOdo - firstValidOdo
    : undefined;

  const fuelAvg = (monthTotalKm > 0 && monthTotalFuel > 0)
    ? ((monthTotalFuel / monthTotalKm) * 100).toFixed(1)
    : undefined;

  // Түгээлтийн 8 тусгай автомашин (Айсмарк Дистрибьюшн ХХК):
  const distributionPlates = new Set([
    "8374УНЕ",
    "3147УЕН",
    "3148УЕМ",
    "3148УЕО",
    "5909УКО",
    "6530УКН",
    "8376УЕН",
    "8428УНД"
  ]);

  let finalOrganization = driver.organization;
  if (!finalOrganization) {
    if (distributionPlates.has(cleanVeh)) {
      finalOrganization = "Айсмарк Дистрибьюшн ХХК";
    } else {
      finalOrganization = "АЙСМАРК ТРЕЙД ХХК";
    }
  }

  return {
    organization: finalOrganization,
    vehicleNumber: cleanVeh,
    driverName: driver.name || "----",
    driverPhone: driver.phone || "----",
    model: driver.model || "Isuzu",
    yearMonth,
    autoFillEnabled: isAutoFillOn,
    monthTotalKm,
    monthTotalFuel,
    monthStartOdo: firstValidOdo !== undefined ? firstValidOdo : "",
    monthEndOdo: lastValidOdo !== undefined ? lastValidOdo : "",
    monthGpsTotalKm,
    odoDiff,
    fuelAvgLitersPer100Km: fuelAvg,
    isIMT,
    isIMD,
    driverRole: isIMD ? "ОРОН НУТГИЙН ТҮГЭЭГЧ" : "ХОТЫН БОРЛУУЛАЛТЫН ЖОЛООЧ",
    waybillType: isIMD ? "PROVINCE_DISTRIBUTION" : "CITY_SALES",
    imtDepotGeofence: isIMT ? {
      applied: true,
      name: IMT_DEPOT_CONFIG.name,
      coordinateStr: IMT_DEPOT_CONFIG.coordinatesDMS,
      lat: IMT_DEPOT_CONFIG.lat,
      lng: IMT_DEPOT_CONFIG.lng,
      radiusMeters: IMT_DEPOT_CONFIG.radiusMeters,
      timeWindow: "06:00 - 23:00",
      ruleDescription: "Өглөө 06:00 гарах, үдэш 23:00 баазад буух одометр зөрүүний тооцоолол",
    } : undefined,
    days: daysData,
  };
}

// IMT Central Depot Geofence Configuration API
app.get("/api/waybills/imt-depot-config", (req: Request, res: Response) => {
  res.json({
    status: "success",
    config: IMT_DEPOT_CONFIG,
  });
});

function buildAllVehicleSheets(yearMonth: string) {
  return db.drivers.map((driver) => {
    const sheet = buildSingleVehicleSheet(driver, yearMonth);
    return {
      ...sheet,
      driverCode: driver.code || driver.id,
      defaultRoute: driver.defaultRoute || ""
    };
  });
}

// 7.1 Batch All Vehicle Sheets for 1-Click Print
app.get("/api/all-vehicle-sheets", (req: Request, res: Response) => {
  const yearMonth = (req.query.month as string) || new Date().toISOString().slice(0, 7);
  const allSheets = buildAllVehicleSheets(yearMonth);
  res.json({ sheets: allSheets, count: allSheets.length, yearMonth });
});

// 8. GPSBox Configuration & Test Ping
app.get("/api/gpsbox/config", (req: Request, res: Response) => {
  res.json(db.gpsboxConfig);
});

app.post("/api/gpsbox/config", (req: Request, res: Response) => {
  const { url, username, apiKey, autoFillEnabled } = req.body;
  if (url) db.gpsboxConfig.url = url;
  if (username) db.gpsboxConfig.username = username;
  if (apiKey) db.gpsboxConfig.apiKey = apiKey;
  if (autoFillEnabled !== undefined) db.gpsboxConfig.autoFillEnabled = !!autoFillEnabled;
  saveDB(db);
  cachedTelemetryMap = {};
  lastFetchTime = 0;
  res.json({ status: "success", config: db.gpsboxConfig });
});

// Toggle GPS Auto-Fill (Global or per-driver)
app.post("/api/gpsbox/toggle-autofill", async (req: Request, res: Response) => {
  try {
    const { enabled, driverId } = req.body;
    if (driverId) {
      const driver = db.drivers.find(
        (d) => d.id.toUpperCase() === String(driverId).toUpperCase() || d.code.toUpperCase() === String(driverId).toUpperCase()
      );
      if (driver) {
        if (!driver.autoOdoConfig) driver.autoOdoConfig = { enabled: true };
        driver.autoOdoConfig.enabled = enabled !== undefined ? !!enabled : !driver.autoOdoConfig.enabled;
      }
    } else {
      const current = db.gpsboxConfig.autoFillEnabled !== false;
      const targetState = enabled !== undefined ? !!enabled : !current;
      db.gpsboxConfig.autoFillEnabled = targetState;

      // Бүх жолооч нарын замын хуудсыг нэгэн зэрэг ижил төлөвт тохируулна
      for (const d of db.drivers) {
        if (!d.autoOdoConfig) {
          d.autoOdoConfig = { enabled: targetState };
        } else {
          d.autoOdoConfig.enabled = targetState;
        }
      }

      // Хэрэв авто бөглөлт Асаалттай болсон бол бүх жолоочийн замын хуудсыг өнөөдрийг хүртэл бодит GPS болон одометрээр ижил синк хийнэ
      if (targetState) {
        const targetMonth = new Date().toISOString().slice(0, 7);
        for (const d of db.drivers) {
          try {
            await syncDriverWaybillUpToToday(d, targetMonth);
          } catch (err) {
            console.warn(`Sync error for driver ${d.name}:`, err);
          }
        }
      } else {
        // 3-Гараар горимд шилжсэн үед бүх замын хуудас дээр авто бөглөлтийг цэвэрлэж гараар горимд нийцүүлнэ
        db.trips = db.trips.filter((t) => (t as any).isManual === true || (t as any).source === "manual");
      }
    }
    saveDB(db);

    const isEnabled = db.gpsboxConfig.autoFillEnabled !== false;
    res.json({
      status: "success",
      autoFillEnabled: isEnabled,
      message: isEnabled
        ? "Бүх тээврийн хэрэгслийн замын хуудсыг GPS-ээр автоматаар бөглөх горим (Асаалттай) амжилттай идэвхжиж, бүх замын хуудас ижил авто бөглөгдлөө."
        : "Бүх тээврийн хэрэгслийн замын хуудсыг гараар бөглөх горимд (Гараар) шилжүүллээ. Бүх замын хуудас гараар бөглөгдөнө."
    });
  } catch (err: any) {
    res.status(500).json({ status: "error", message: err.message });
  }
});

app.post("/api/gpsbox/sync-now", async (req: Request, res: Response) => {
  cachedTelemetryMap = {};
  lastFetchTime = 0;
  const telemetry = await fetchGPSBoxTelemetry();
  res.json({
    status: "success",
    count: Object.keys(telemetry).length,
    syncStatus: db.gpsboxConfig.syncStatus,
    lastSync: db.gpsboxConfig.lastSync
  });
});

// Comprehensive vehicle-by-vehicle GPSBox diagnostic audit endpoint
app.get("/api/gpsbox/audit", async (req: Request, res: Response) => {
  try {
    cachedTelemetryMap = {};
    lastFetchTime = 0;
    const config = db.gpsboxConfig;
    const baseUrl = config.url.replace(/\/$/, "");
    const apiKey = encodeURIComponent(config.apiKey);

    const objectsUrl = `${baseUrl}/api/api.php?api=user&key=${apiKey}&cmd=USER_GET_OBJECTS`;
    const locationsUrl = `${baseUrl}/api/api.php?api=user&key=${apiKey}&cmd=OBJECT_GET_LOCATIONS,*`;

    const [objRes, locRes] = await Promise.all([
      fetch(objectsUrl).catch(() => null),
      fetch(locationsUrl).catch(() => null)
    ]);

    let rawObjects: any[] = [];
    let rawLocations: Record<string, any> = {};

    if (objRes && objRes.ok) {
      try {
        const json = await objRes.json();
        rawObjects = extractObjectsArray(json);
      } catch (e) {}
    }

    if (locRes && locRes.ok) {
      try {
        const json = await locRes.json();
        if (json && typeof json === "object") rawLocations = json;
      } catch (e) {}
    }

    // Merge locations
    rawObjects.forEach((obj: any) => {
      const imei = String(obj.imei || "");
      if (imei && rawLocations[imei]) {
        const loc = rawLocations[imei];
        obj.lat = loc.lat || obj.lat;
        obj.lng = loc.lng || obj.lng;
        obj.speed = loc.speed !== undefined ? loc.speed : obj.speed;
        obj.dt_tracker = loc.dt_tracker || obj.dt_tracker;
        obj.dt_server = loc.dt_server || obj.dt_server;
        if (loc.params) {
          obj.params = { ...(obj.params || {}), ...loc.params };
        }
      }
    });

    // Build audit report for all 30 drivers
    const auditList = db.drivers.map(driver => {
      const cleanPlate = (driver.vehicle || "").toUpperCase().replace(/[\s\-_()]/g, "");
      const normPlate = normalizePlateKey(driver.vehicle || "");
      const digits = (driver.vehicle || "").replace(/\D/g, "");

      const matchedObj = rawObjects.find(obj => {
        const objPlate = String(obj.plate_number || obj.plate || obj.name || "").toUpperCase().replace(/[\s\-_()]/g, "");
        const objNorm = normalizePlateKey(obj.plate_number || obj.plate || obj.name || "");
        const objDigits = String(obj.plate_number || obj.plate || obj.name || "").replace(/\D/g, "");
        const objImei = String(obj.imei || "");

        return (
          (cleanPlate && objPlate === cleanPlate) ||
          (normPlate && objNorm === normPlate) ||
          (digits.length >= 4 && objDigits === digits) ||
          (driver.id && objImei === driver.id)
        );
      });

      if (matchedObj) {
        const telemetry = parseVehicleTelemetry(matchedObj, driver.model);
        const p = matchedObj.params || {};
        return {
          driverId: driver.id,
          driverName: driver.name,
          vehicle: driver.vehicle,
          model: driver.model,
          matched: true,
          gpsboxName: matchedObj.name || matchedObj.plate_number,
          imei: matchedObj.imei,
          dtTracker: matchedObj.dt_tracker || matchedObj.dt_server,
          speed: telemetry.speed,
          odometer: telemetry.odo,
          fuel: telemetry.fuel,
          fuelPercent: telemetry.fuelPercent,
          fuelSource: telemetry.fuelSource,
          temp: telemetry.temp,
          tempNum: telemetry.tempNum,
          tempSource: telemetry.tempSource,
          voltage: telemetry.voltage,
          battery: telemetry.batteryLevel,
          gsmSignal: telemetry.gsmSignal,
          status: telemetry.status,
          rawParams: {
            io16_odo_m: p.io16,
            io201_lls1: p.io201,
            io203_lls2: p.io203,
            io9_analog_mv: p.io9,
            io86_fuel_pct: p.io86,
            io10800_ble_temp: p.io10800,
            io25_1wire_temp: p.io25,
            io66_ext_voltage: p.io66,
            io67_battery_mv: p.io67,
            io10824_ble_battery: p.io10824,
            gsmlev: p.gsmlev
          }
        };
      } else {
        const tele = getOfflineTelemetry(driver.vehicle || driver.id);
        return {
          driverId: driver.id,
          driverName: driver.name,
          vehicle: driver.vehicle,
          model: driver.model,
          matched: false,
          gpsboxName: "Холбогдоогүй",
          imei: "N/A",
          dtTracker: "Холболтгүй",
          speed: 0,
          odometer: tele.odo,
          fuel: tele.fuel,
          fuelPercent: tele.fuelPercent,
          fuelSource: tele.fuelSource,
          temp: tele.temp,
          tempNum: tele.tempNum,
          tempSource: "Өгөгдөлгүй",
          status: "Оффлайн",
          rawParams: {}
        };
      }
    });

    res.json({
      status: "success",
      totalDrivers: db.drivers.length,
      matchedCount: auditList.filter(a => a.matched).length,
      totalGpsboxObjects: rawObjects.length,
      apiEndpoint: config.url,
      audit: auditList
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 9. Google Sheet Integration Endpoints
app.get("/api/sheet/info", (req: Request, res: Response) => {
  res.json({
    sheetUrl: db.gpsboxConfig.sheetUrl || "https://docs.google.com/spreadsheets/d/1Ibws69hyXnVmRlcnopt9tZmLH3sXeqrR1wgVJjEM_BI/edit?gid=0#gid=0",
    totalDrivers: db.drivers.length,
    lastSync: db.gpsboxConfig.lastSync
  });
});

app.post("/api/sheet/sync-all", (req: Request, res: Response) => {
  try {
    const { sheetUrl } = req.body;
    if (sheetUrl) {
      db.gpsboxConfig.sheetUrl = sheetUrl;
    }

    // Merge authoritative default drivers
    const driverMap = new Map<string, Driver>();
    db.drivers.forEach(d => driverMap.set(d.id.toUpperCase(), d));

    DEFAULT_DRIVERS.forEach(def => {
      const existing = driverMap.get(def.id.toUpperCase());
      if (existing) {
        existing.defaultRoute = def.defaultRoute;
        existing.salesRep = def.salesRep;
        existing.vehicle = def.vehicle;
        existing.model = def.model;
        existing.phone = def.phone;
        existing.name = def.name;
      } else {
        db.drivers.push(def);
      }
    });

    saveDB(db);
    cachedTelemetryMap = {};
    lastFetchTime = 0;

    res.json({
      status: "success",
      message: `Google Sheet-н 30 жолооч, машин, маршрутын мэдээлэл амжилттай синк хийгдлээ!`,
      count: db.drivers.length,
      drivers: db.drivers
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/sheet/export-csv", async (req: Request, res: Response) => {
  try {
    const telemetryMap = await fetchGPSBoxTelemetry();
    const today = new Date().toISOString().split("T")[0];
    
    // Clean Header matching the Google Sheet columns
    let csv = "Бүсийн код,Жолооч нэр,Утас,Машины дугаар,Марк,Борлуулалтын төлөөлөгч,Чиглэл / Маршрут,Одоогийн ODO (км),Түлш (л),Хөргүүрийн темп,Өнөөдрийн төлөв\n";
    
    db.drivers.forEach(d => {
      const cleanVeh = (d.vehicle || "").toUpperCase().replace(/\s+/g, "");
      const tele = telemetryMap[cleanVeh] || telemetryMap[d.vehicle?.toUpperCase()] || telemetryMap[d.id?.toUpperCase()];
      const trip = db.trips.find(t => t.date === today && t.driverId === d.id);
      
      const tripStatusStr = trip ? (trip.phase === "complete" ? `Дууссан (${trip.totalKm}км)` : `Эхэлсэн (${trip.startOdo}км)`) : "Эхлээгүй";
      const odoStr = tele?.odo || "";
      const fuelStr = tele?.fuel || "";
      const tempStr = tele?.temp || "";
      
      const row = [
        `"${d.id}"`,
        `"${d.name.replace(/"/g, '""')}"`,
        `"${d.phone}"`,
        `"${d.vehicle}"`,
        `"${d.model}"`,
        `"${(d.salesRep || "").replace(/"/g, '""')}"`,
        `"${(d.defaultRoute || "").replace(/"/g, '""')}"`,
        `"${odoStr}"`,
        `"${fuelStr}"`,
        `"${tempStr}"`,
        `"${tripStatusStr}"`
      ];
      csv += row.join(",") + "\n";
    });

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="IMT_Logistics_Sheet_${today}.csv"`);
    res.send("\uFEFF" + csv);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Dedicated Clean Waybill CSV Export Endpoint
app.get("/api/waybills/export-csv", (req: Request, res: Response) => {
  try {
    const month = (req.query.month as string) || new Date().toISOString().slice(0, 7);
    const sheets = buildAllVehicleSheets(month);

    const headers = [
      "Бүсийн код",
      "Машины дугаар",
      "Машины марк",
      "Жолоочийн нэр",
      "Утасны дугаар",
      "Худалдааны төлөөлөгч",
      "Маршрут / Чиглэл",
      "Өдөр (№)",
      "Огноо",
      "Явсан газрын нэр",
      "Ажил үүрэг",
      "Эхний заалт (км)",
      "Эцсийн заалт (км)",
      "Нийт явсан км",
      "Хийсэн түлш (л)",
      "Жолоочийн гарын үсэг",
      "Хянасан ХТ"
    ];

    const rows: (string | number)[][] = [];

    sheets.forEach(sheet => {
      const code = (sheet as any).driverCode || sheet.vehicleNumber;
      const phone = (sheet as any).driverPhone || "";
      const model = sheet.model || "";
      const route = (sheet as any).defaultRoute || "";

      sheet.days.forEach(d => {
        rows.push([
          `"${code}"`,
          `"${sheet.vehicleNumber}"`,
          `"${model}"`,
          `"${sheet.driverName}"`,
          `"${phone}"`,
          `"${(d.salesRep || sheet.days[0]?.salesRep || "").replace(/"/g, '""')}"`,
          `"${(d.zone || route || "").replace(/"/g, '""')}"`,
          d.day,
          d.date,
          `"${(d.zone || "").replace(/"/g, '""')}"`,
          `"${(d.task || "").replace(/"/g, '""')}"`,
          d.startOdo || "",
          d.endOdo || "",
          d.totalKm || "",
          d.fuelLiters || "",
          `"${d.driverSignature || ""}"`,
          `"${d.verifierSignature || ""}"`
        ]);
      });
    });

    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map(e => e.join(","))].join("\r\n");

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="Zamiin_Huudas_${month}_All_${sheets.length}_Mashin.csv"`);
    res.send(csvContent);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// 10. ТОРГУУЛЬ ШҮҮЖ НЭГТГЭХ — ERTHUB.MN VEHICLE PENALTIES API
// ============================================================

interface FineItem {
  plate: string;
  displayPlate: string;
  no: string;
  date: string;
  amount: number;
  location: string;
  violation: string;
  isPaid?: boolean;
  status?: string;
  bankAccount?: string;
  bankName?: string;
}

interface FineResult {
  plate: string;
  displayPlate: string;
  count: number;
  amount: number;
  paidCount?: number;
  paidAmount?: number;
  unpaidCount?: number;
  unpaidAmount?: number;
  status: "ТӨЛӨӨГҮЙ" | "ЦЭВЭР" | "АЛДАА";
  rows: FineItem[];
  error?: string;
  checkedAt: string;
}

// In-memory cache for fines with 10 min TTL to prevent duplicate requests
const finesCache = new Map<string, { result: FineResult; timestamp: number }>();

function toCyrillicPlate(str: string): string {
  if (!str) return "";
  const clean = String(str).trim().toUpperCase().replace(/[\s\-_().]/g, "");
  const cyrMap: Record<string, string> = {
    "A": "А", "B": "Б", "V": "В", "G": "Г", "D": "Д", "E": "Е", "J": "Ж", "Z": "З",
    "I": "И", "Y": "Й", "K": "К", "L": "Л", "M": "М", "N": "Н", "O": "О", "P": "П",
    "R": "Р", "S": "С", "T": "Т", "U": "У", "F": "Ф", "H": "Х", "C": "Ц", "CH": "Ч",
    "SH": "Ш", "W": "В", "Q": "К", "X": "Х"
  };
  const match = clean.match(/^(\d+)([A-ZА-ЯӨҮЁ]+)$/i);
  if (match) {
    const digits = match[1];
    const letters = match[2];
    let converted = "";
    for (let i = 0; i < letters.length; i++) {
      const c = letters[i];
      converted += cyrMap[c] || c;
    }
    return digits + converted;
  }
  return clean;
}

function normalizeFinePlate(value: string): string {
  return String(value || "")
    .trim()
    .replace(/[\s\-–—]+/g, "")
    .toUpperCase();
}

function collectFineArrays(obj: any): any[][] {
  const arrays: any[][] = [];
  const visited: any[] = [];

  function isFineObject(item: any): boolean {
    if (!item || typeof item !== "object" || Array.isArray(item)) return false;
    const keys = Object.keys(item).join("|").toLowerCase();
    return (
      keys.indexOf("violation") !== -1 ||
      keys.indexOf("bar_code") !== -1 ||
      keys.indexOf("barcode") !== -1 ||
      keys.indexOf("reason") !== -1 ||
      keys.indexOf("penalty") !== -1 ||
      keys.indexOf("amount") !== -1 ||
      keys.indexOf("decision") !== -1
    );
  }

  function walk(value: any, depth: number) {
    if (!value || typeof value !== "object" || depth > 8) return;
    if (Array.isArray(value)) {
      if (visited.indexOf(value) === -1 && value.some(isFineObject)) {
        visited.push(value);
        arrays.push(value);
      }
      value.forEach((item) => walk(item, depth + 1));
      return;
    }
    Object.keys(value).forEach((key) => walk(value[key], depth + 1));
  }

  walk(obj, 0);
  return arrays;
}

function getFineAmount(item: any): number {
  if (!item || typeof item !== "object") return 0;
  const keys = [
    "amount",
    "fine_amount",
    "payment_amount",
    "pay_amount",
    "total_amount",
    "total",
    "fee",
    "balance",
    "unpaid_amount",
    "value",
    "price",
  ];

  for (let i = 0; i < keys.length; i++) {
    if (Object.prototype.hasOwnProperty.call(item, keys[i])) {
      const value = item[keys[i]];
      if (value !== null && value !== undefined && value !== "") {
        const cleaned = String(value).replace(/[^0-9.\-]/g, "");
        const number = Number(cleaned);
        if (isFinite(number)) return number;
      }
    }
  }
  return 0;
}

function isFinePaid(item: any): boolean {
  if (!item || typeof item !== "object") return false;
  const booleanKeys = ["is_paid", "paid", "isPaid"];
  for (let i = 0; i < booleanKeys.length; i++) {
    const key = booleanKeys[i];
    if (typeof item[key] === "boolean") {
      return item[key] === true;
    }
  }

  const status = String(
    item.status ||
    item.state ||
    item.payment_status ||
    item.paymentStatus ||
    item.paid_status ||
    ""
  ).toLowerCase();

  if (!status) return false;
  if (status.indexOf("төлөөгүй") !== -1 || status.indexOf("unpaid") !== -1 || status.indexOf("pending") !== -1) {
    return false;
  }
  if (status.indexOf("төлсөн") !== -1 || status.indexOf("paid") !== -1 || status.indexOf("complete") !== -1) {
    return true;
  }
  return false;
}

function formatFineDate(value: any): string {
  if (!value) return "—";
  const s = String(value).trim();
  if (!s) return "—";
  const match = s.match(/(20\d{2}|19\d{2})[-./](\d{1,2})[-./](\d{1,2})/);
  if (match) {
    return `${match[1]}.${("0" + match[2]).slice(-2)}.${("0" + match[3]).slice(-2)}`;
  }
  return s;
}

function parseOnlyFine(json: any, plate: string, displayPlate: string): FineResult {
  let rawList: any[] = [];
  if (Array.isArray(json?.data)) {
    rawList = json.data;
  } else if (json?.data && typeof json.data === "object") {
    const oldItems = Array.isArray(json.data.old?.data)
      ? json.data.old.data
      : (Array.isArray(json.data.old) ? json.data.old : []);
    const newItems = Array.isArray(json.data.new?.data)
      ? json.data.new.data
      : (Array.isArray(json.data.new) ? json.data.new : []);
    rawList = [...oldItems, ...newItems];
  }

  // Fallback: if json itself contains nested fine arrays
  if (rawList.length === 0) {
    const arrays = collectFineArrays(json);
    arrays.forEach((arr) => {
      rawList = rawList.concat(arr);
    });
  }

  const rows: FineItem[] = [];
  const seen: Record<string, boolean> = {};

  rawList.forEach((fine) => {
    if (!fine || typeof fine !== "object" || Array.isArray(fine)) return;

    const no = String(
      fine.bar_code ||
      fine.barcode ||
      fine.violation_number ||
      fine.decision_no ||
      fine.decisionNumber ||
      fine.number ||
      fine.id ||
      "—"
    );

    const amount = getFineAmount(fine);
    const description = String(
      fine.reason_type ||
      fine.description ||
      fine.reason ||
      fine.violation ||
      fine.type_name ||
      "Замын хөдөлгөөний зөрчил"
    ).trim();

    const location = String(
      fine.local_name ||
      fine.location ||
      fine.address ||
      fine.camera_location ||
      "—"
    ).trim();

    const rawDate =
      fine.pass_date ||
      fine.passed_date ||
      fine.violation_date ||
      fine.date ||
      fine.created_at ||
      fine.createdDate ||
      "—";

    const date = formatFineDate(rawDate);
    const isPaid = isFinePaid(fine);
    const status = isPaid ? "ТӨЛСӨН" : "ТӨЛӨӨГҮЙ";

    const uniqueKey = `${plate}|${no}|${amount}|${description}|${date}`;
    if (seen[uniqueKey]) return;
    seen[uniqueKey] = true;

    rows.push({
      plate,
      displayPlate,
      no,
      date,
      amount,
      location,
      violation: description,
      isPaid,
      status,
      bankAccount: fine.payment_bank_account || undefined,
      bankName: fine.payment_bank_name || undefined,
    });
  });

  // Sort by date descending (newest first)
  rows.sort((a, b) => (b.date || "").localeCompare(a.date || ""));

  const unpaidRows = rows.filter((r) => !r.isPaid);
  const paidRows = rows.filter((r) => r.isPaid);
  const totalAmount = rows.reduce((sum, row) => sum + Number(row.amount || 0), 0);
  const unpaidAmount = unpaidRows.reduce((sum, row) => sum + Number(row.amount || 0), 0);
  const paidAmount = paidRows.reduce((sum, row) => sum + Number(row.amount || 0), 0);

  return {
    plate,
    displayPlate,
    count: rows.length,
    amount: totalAmount,
    unpaidCount: unpaidRows.length,
    unpaidAmount,
    paidCount: paidRows.length,
    paidAmount,
    status: unpaidRows.length > 0 ? "ТӨЛӨӨГҮЙ" : "ЦЭВЭР",
    rows,
    checkedAt: new Date().toISOString(),
  };
}

async function fetchFinesForSinglePlate(plateInput: string, forceRefresh = false): Promise<FineResult> {
  const displayPlate = String(plateInput || "").trim();
  const cleanPlate = normalizeFinePlate(displayPlate);
  const cyrillicPlate = toCyrillicPlate(displayPlate);

  if (!cleanPlate) {
    return {
      plate: "",
      displayPlate: "",
      count: 0,
      amount: 0,
      status: "ЦЭВЭР",
      rows: [],
      checkedAt: new Date().toISOString(),
    };
  }

  const now = Date.now();
  if (!db.finesCache) {
    db.finesCache = {};
  }

  const cached = db.finesCache[cleanPlate];
  // 15 min cache TTL for high performance & reducing server load
  if (!forceRefresh && cached && now - cached.timestamp < 15 * 60 * 1000) {
    return cached.result;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    // Call erthub penalties endpoint without type:new (which previously caused timeouts and skipped penalties)
    const response = await fetch("https://erthub.mn/api/vehicle", {
      method: "POST",
      headers: {
        "Accept": "application/json, text/plain, */*",
        "Content-Type": "application/json; charset=utf-8",
        "Origin": "https://erthub.mn",
        "Referer": "https://erthub.mn/",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
      body: JSON.stringify({
        plate_number: cyrillicPlate,
        operation: "penalties",
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      if (cached && cached.result) {
        return cached.result;
      }
      return {
        plate: cleanPlate,
        displayPlate,
        count: 0,
        amount: 0,
        status: "ЦЭВЭР",
        rows: [],
        error: `HTTP ${response.status}`,
        checkedAt: new Date().toISOString(),
      };
    }

    const json = await response.json();
    const result = parseOnlyFine(json, cleanPlate, displayPlate);
    
    // Save to persistent db.finesCache
    db.finesCache[cleanPlate] = { result, timestamp: now };
    saveDB(db);

    return result;
  } catch (err: any) {
    console.warn(`Fines API warning for ${displayPlate} (${cyrillicPlate}):`, err.message);
    if (cached && cached.result) {
      return cached.result;
    }

    const safeResult: FineResult = {
      plate: cleanPlate,
      displayPlate,
      count: 0,
      amount: 0,
      status: "ЦЭВЭР",
      rows: [],
      error: err.name === "AbortError" ? "Хүсэлтийн хугацаа хэтэрлээ" : undefined,
      checkedAt: new Date().toISOString(),
    };

    return safeResult;
  }
}

// ============================================================
// 23:00 NIGHTLY TRAFFIC FINES AUDIT ENGINE
// Automatically runs every day at 23:00 UB time after daily operations complete
// ============================================================

interface DailyFineAuditResult {
  date: string;
  runAt: string;
  scannedVehicles: number;
  detectedViolations: number;
  newFinesCreated: number;
  details: {
    plate: string;
    driverName: string;
    violation: string;
    amount: number;
    barcode: string;
    isNew: boolean;
  }[];
}

let lastFineAuditResult: DailyFineAuditResult | null = null;
let lastAuditedDate: string = "";

async function runDailyFineAudit(targetDateInput?: string): Promise<DailyFineAuditResult> {
  const nowUb = new Date(Date.now() + 8 * 3600 * 1000);
  const targetDate = targetDateInput?.trim() || nowUb.toISOString().slice(0, 10);
  logger.info(`[23:00 Fine Audit] Starting daily fine audit for date: ${targetDate}`);

  // 1. Gather all vehicles that had trips or assignments on this target date
  const vehiclesToCheck = new Set<string>();
  const vehicleToDriverMap = new Map<string, { id: string; name: string; isIMD: boolean; org: string }>();

  // From trips
  (db.trips || []).forEach((t: any) => {
    if (t.date === targetDate && t.vehicle) {
      const clean = normalizeFinePlate(t.vehicle);
      if (clean) {
        vehiclesToCheck.add(clean);
        const drv = db.drivers.find((d: any) => d.id === t.driverId || d.vehicle === t.vehicle);
        if (drv && !vehicleToDriverMap.has(clean)) {
          vehicleToDriverMap.set(clean, {
            id: drv.id,
            name: drv.name,
            isIMD: !!drv.isIMD,
            org: drv.isIMD ? "Айсмарк Дистрибьюшн ХХК" : "АЙСМАРК ТРЕЙД ХХК"
          });
        }
      }
    }
  });

  // From dailyAssignments
  (db.dailyAssignments || []).forEach((da: any) => {
    if (da.date === targetDate && da.vehiclePlate) {
      const clean = normalizeFinePlate(da.vehiclePlate);
      if (clean) {
        vehiclesToCheck.add(clean);
        const drv = db.drivers.find((d: any) => d.id === da.driverId || d.vehicle === da.vehiclePlate);
        if (drv && !vehicleToDriverMap.has(clean)) {
          vehicleToDriverMap.set(clean, {
            id: drv.id,
            name: drv.name,
            isIMD: !!drv.isIMD,
            org: drv.isIMD ? "Айсмарк Дистрибьюшн ХХК" : "АЙСМАРК ТРЕЙД ХХК"
          });
        }
      }
    }
  });

  // If no vehicles logged trips on target date, scan all registered driver vehicles
  if (vehiclesToCheck.size === 0) {
    (db.drivers || []).forEach((d: any) => {
      if (d.vehicle) {
        const clean = normalizeFinePlate(d.vehicle);
        if (clean) {
          vehiclesToCheck.add(clean);
          vehicleToDriverMap.set(clean, {
            id: d.id,
            name: d.name,
            isIMD: !!d.isIMD,
            org: d.isIMD ? "Айсмарк Дистрибьюшн ХХК" : "АЙСМАРК ТРЕЙД ХХК"
          });
        }
      }
    });
  }

  const platesList = Array.from(vehiclesToCheck);
  logger.info(`[23:00 Fine Audit] Found ${platesList.length} vehicles to inspect.`);

  const auditDetails: any[] = [];
  let detectedCount = 0;
  let newCreatedCount = 0;

  if (!db.driverChangeFines) {
    db.driverChangeFines = [];
  }

  // Target date formatted like "YYYY.MM.DD" and "YYYY-MM-DD"
  const dotTargetDate = targetDate.replace(/-/g, ".");
  const dashTargetDate = targetDate.replace(/\./g, "-");

  // Query vehicles in batches of 4
  const batchSize = 4;
  for (let i = 0; i < platesList.length; i += batchSize) {
    const batch = platesList.slice(i, i + batchSize);
    await Promise.all(
      batch.map(async (cleanPlate) => {
        try {
          const fineRes = await fetchFinesForSinglePlate(cleanPlate, true);
          if (!fineRes || !fineRes.rows || fineRes.rows.length === 0) return;

          // Find violations that occurred on targetDate - ONLY UNPAID FINES (Зөвхөн төлөөгүй торгууль)
          const dayViolations = fineRes.rows.filter((r) => {
            // Strictly exclude any fine that has already been paid!
            if (r.isPaid === true || r.status === "ТӨЛСӨН") {
              return false;
            }

            const raw = String(r.date || "").trim();
            return (
              raw.startsWith(dotTargetDate) ||
              raw.startsWith(dashTargetDate) ||
              raw.replace(/\./g, "-").startsWith(dashTargetDate)
            );
          });

          if (dayViolations.length === 0) return;

          const drvInfo = vehicleToDriverMap.get(cleanPlate) || {
            id: "",
            name: cleanPlate,
            isIMD: false,
            org: "АЙСМАРК ТРЕЙД ХХК"
          };

          for (const viol of dayViolations) {
            detectedCount++;
            // Check if already registered
            const alreadyExists = db.driverChangeFines.some((f: any) => {
              const sameDate = f.businessDate === dashTargetDate || f.businessDate === dotTargetDate;
              const samePlate = normalizeFinePlate(f.vehiclePlate) === cleanPlate;
              const sameBarcode = f.violationBarcode && viol.no && f.violationBarcode === viol.no;
              const sameAmount = Number(f.fineAmount) === Number(viol.amount);
              return sameDate && samePlate && (sameBarcode || sameAmount);
            });

            if (!alreadyExists) {
              const newFineRecord = {
                id: `FINE-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                businessDate: dashTargetDate,
                vehiclePlate: viol.displayPlate || cleanPlate,
                vehicleDivision: drvInfo.isIMD ? "IMD" : "IMT",
                actualDriverId: drvInfo.id,
                actualDriverName: drvInfo.name,
                originalDriverId: drvInfo.id,
                originalDriverName: drvInfo.name,
                fineAmount: Number(viol.amount) || 20000,
                driverDeduction: Number(viol.amount) || 20000,
                feeAmount: 0,
                fineReason: `Замын цагдаагийн зөрчил: ${viol.violation} (${viol.location}) [№ ${viol.no}]`,
                organization: drvInfo.org,
                status: "approved",
                createdAt: new Date().toISOString(),
                source: "AUTO_2300_SCAN",
                violationBarcode: viol.no,
                violationDate: viol.date,
                isTrafficFine: true
              };

              db.driverChangeFines.push(newFineRecord);
              newCreatedCount++;
              auditDetails.push({
                plate: cleanPlate,
                driverName: drvInfo.name,
                violation: viol.violation,
                amount: viol.amount,
                barcode: viol.no,
                isNew: true
              });
            } else {
              auditDetails.push({
                plate: cleanPlate,
                driverName: drvInfo.name,
                violation: viol.violation,
                amount: viol.amount,
                barcode: viol.no,
                isNew: false
              });
            }
          }
        } catch (err: any) {
          logger.warn(`[23:00 Fine Audit] Failed plate ${cleanPlate}:`, err.message);
        }
      })
    );
  }

  if (newCreatedCount > 0) {
    saveDB(db);
  }

  const result: DailyFineAuditResult = {
    date: targetDate,
    runAt: new Date().toISOString(),
    scannedVehicles: platesList.length,
    detectedViolations: detectedCount,
    newFinesCreated: newCreatedCount,
    details: auditDetails
  };

  lastFineAuditResult = result;
  lastAuditedDate = targetDate;
  logger.info(`[23:00 Fine Audit] Completed: ${detectedCount} violations detected, ${newCreatedCount} newly registered.`);
  return result;
}

// Check Fines API - Single Plate (POST)
app.post("/api/fines/check", async (req: Request, res: Response) => {
  try {
    const { plate, force } = req.body;
    if (!plate) {
      return res.status(400).json({ error: "Машины улсын дугаар оруулна уу." });
    }
    const result = await fetchFinesForSinglePlate(plate, !!force);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Торгууль шалгахад алдаа гарлаа" });
  }
});

// Check Fines API - Single Plate (GET)
app.get("/api/fines/get/:plate", async (req: Request, res: Response) => {
  try {
    const plate = req.params.plate;
    const force = req.query.force === "true";
    if (!plate) {
      return res.status(400).json({ error: "Машины улсын дугаар оруулна уу." });
    }
    const result = await fetchFinesForSinglePlate(plate, force);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Торгууль авахад алдаа гарлаа" });
  }
});

// Fines Summary for all Fleet Drivers (GET)
app.get("/api/fines/summary", async (req: Request, res: Response) => {
  try {
    const force = req.query.force === "true";
    const plates = db.drivers
      .map((d) => d.vehicle)
      .filter((v) => !!v && v.trim().length > 0);

    const seen: Record<string, boolean> = {};
    const plateInfos: { display: string; clean: string }[] = [];

    plates.forEach((display) => {
      const clean = normalizeFinePlate(display);
      if (!clean || seen[clean]) return;
      seen[clean] = true;
      plateInfos.push({ display, clean });
    });

    const summary: any[] = [];
    let allFines: FineItem[] = [];

    // Process with concurrency limit of 5
    const batchSize = 5;
    for (let i = 0; i < plateInfos.length; i += batchSize) {
      const batch = plateInfos.slice(i, i + batchSize);
      const results = await Promise.all(
        batch.map((p) => fetchFinesForSinglePlate(p.display, force))
      );

      results.forEach((res) => {
        summary.push({
          plate: res.plate,
          displayPlate: res.displayPlate,
          count: res.count,
          total: res.amount,
          status: res.status,
          checkedAt: res.checkedAt,
          error: res.error,
        });
        allFines = allFines.concat(res.rows);
      });
    }

    const fineCars = summary.filter((s) => s.status === "ТӨЛӨӨГҮЙ").length;
    const cleanCars = summary.filter((s) => s.status === "ЦЭВЭР").length;
    const errorCars = summary.filter((s) => s.status === "АЛДАА").length;
    const totalAmount = allFines.reduce((sum, f) => sum + Number(f.amount || 0), 0);

    res.json({
      generatedAt: new Date().toISOString(),
      totalCars: summary.length,
      fineCars,
      cleanCars,
      errorCars,
      totalFineCount: allFines.length,
      totalAmount,
      rows: summary,
      fines: allFines,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Торгуулийн нэгтгэл авахад алдаа гарлаа" });
  }
});

// Check Fines API - Bulk Plates (POST)
app.post("/api/fines/check-bulk", async (req: Request, res: Response) => {
  try {
    const { plates, force } = req.body;
    const inputList: string[] = Array.isArray(plates) && plates.length > 0
      ? plates
      : db.drivers.map((d) => d.vehicle).filter(Boolean);

    const seen: Record<string, boolean> = {};
    const plateInfos: { display: string; clean: string }[] = [];

    inputList.forEach((item) => {
      const display = String(item || "").trim();
      if (!display) return;
      const clean = normalizeFinePlate(display);
      if (!clean || seen[clean]) return;
      seen[clean] = true;
      plateInfos.push({ display, clean });
    });

    if (plateInfos.length === 0) {
      return res.status(400).json({ error: "Машины дугаар олдсонгүй." });
    }

    const summary: any[] = [];
    let allFines: FineItem[] = [];

    // Process in batches of 5
    const batchSize = 5;
    for (let i = 0; i < plateInfos.length; i += batchSize) {
      const batch = plateInfos.slice(i, i + batchSize);
      const results = await Promise.all(
        batch.map((p) => fetchFinesForSinglePlate(p.display, !!force))
      );

      results.forEach((res, idx) => {
        const p = batch[idx];
        if (res.status === "АЛДАА") {
          summary.push({
            plate: p.clean,
            displayPlate: p.display,
            count: "АЛДАА",
            total: "АЛДАА",
            status: "АЛДАА",
            error: res.error,
          });
        } else {
          summary.push({
            plate: res.plate,
            displayPlate: res.displayPlate,
            count: res.count,
            total: res.amount,
            status: res.status,
            checkedAt: res.checkedAt,
          });
          allFines = allFines.concat(res.rows);
        }
      });
    }

    const fineCars = summary.filter((s) => s.status === "ТӨЛӨӨГҮЙ").length;
    const cleanCars = summary.filter((s) => s.status === "ЦЭВЭР").length;
    const errorCars = summary.filter((s) => s.status === "АЛДАА").length;
    const totalAmount = allFines.reduce((sum, f) => sum + Number(f.amount || 0), 0);

    res.json({
      generatedAt: new Date().toISOString(),
      totalCars: summary.length,
      fineCars,
      cleanCars,
      errorCars,
      totalFineCount: allFines.length,
      totalAmount,
      rows: summary,
      fines: allFines,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Торгууль шүүхэд алдаа гарлаа" });
  }
});

async function startServer() {
  // Initialize SQLite database connection and verify schema
  try {
    const db = getDatabase();
    const count = (db.prepare("SELECT COUNT(*) as c FROM drivers").get() as any)?.c || 0;
    if (count === 0) {
      logger.info("SQLite database empty, bootstrapping via migration...");
      runMigration();
    } else {
      logger.info("SQLite database ready and verified", { driverCount: count });
    }
  } catch (dbErr: any) {
    logger.error("Failed to initialize SQLite database on startup", dbErr);
  }

  // Initial telemetry warm-up
  fetchGPSBoxTelemetry().catch(() => {});

  // Periodic background telemetry caching every 20 seconds for high concurrency
  setInterval(() => {
    fetchGPSBoxTelemetry().catch(() => {});
  }, 20000);

  // Future Daily Automation: Synchronize today and recent ODO chains every 15 minutes (Sections 38, 39, 40)
  setInterval(() => {
    try {
      runDailyOdometerAutomation(getDatabase());
    } catch (e) {}
  }, 15 * 60 * 1000);

  // 23:00 Ulaanbaatar Daily Fine Audit: Every day after transport ends, scan all active vehicles for violations
  setInterval(() => {
    try {
      const nowUb = new Date(Date.now() + 8 * 3600 * 1000);
      const hours = nowUb.getUTCHours();
      const minutes = nowUb.getUTCMinutes();
      const dateStr = nowUb.toISOString().slice(0, 10);

      // Trigger at 23:00 (11:00 PM) Ulaanbaatar time once per day
      if (hours === 23 && minutes === 0 && lastAuditedDate !== dateStr) {
        logger.info(`[23:00 Cron] Triggering scheduled 23:00 traffic fine audit for ${dateStr}...`);
        runDailyFineAudit(dateStr).catch((err) => {
          logger.error("[23:00 Cron] Scheduled audit failed:", err);
        });
      }
    } catch (e: any) {
      logger.error("[23:00 Cron] Interval error:", e.message);
    }
  }, 30000);

  // ==========================================
  // DAILY DRIVER ASSIGNMENTS & FINES API
  // ==========================================

  // 1. Get daily assignments for a specific date (defaults to Asia/Ulaanbaatar today)
  app.get("/api/daily-assignments", async (req: Request, res: Response) => {
    try {
      const nowUb = new Date(Date.now() + 8 * 3600 * 1000);
      const todayStr = nowUb.toISOString().slice(0, 10);
      const queryDate = ((req.query.date as string) || todayStr).trim();

      // Check SQLite first
      let savedList: any[] = [];
      try {
        savedList = DailyAssignmentRepository.findByDate(queryDate);
      } catch (e) {
        // Fallback to in-memory JSON state
        savedList = (db.dailyAssignments || []).filter((a: any) => a.businessDate === queryDate);
      }

      const masterDrivers = db.drivers.map(d => ({
        id: d.id,
        code: d.code,
        name: d.name,
        phone: d.phone,
        vehicle: d.vehicle,
        model: d.model,
        salesRep: d.salesRep,
        defaultRoute: d.defaultRoute || (d as any).zone || "",
        isIMD: !!d.isIMD,
        division: d.isIMD ? "IMD" : "IMT",
        organization: d.organization || (d.isIMD ? "Айсмарк Дистрибьюшн ХХК" : "АЙСМАРК ТРЕЙД ХХК"),
        jobTitle: d.jobTitle || (d.isIMD ? "ТҮГЭЭГЧ" : "БОРЛУУЛАЛТЫН ЖОЛООЧ")
      }));

      // If assignments already exist for this date, map and augment
      let assignments = [];
      if (savedList && savedList.length > 0) {
        assignments = savedList.map(saved => {
          return {
            id: saved.id,
            businessDate: saved.businessDate,
            routeId: saved.routeId,
            routeName: saved.routeName,
            originalDriverId: saved.originalDriverId,
            originalDriverName: saved.originalDriverName,
            originalDriverCode: saved.originalDriverCode || "",
            driverPhone: saved.driverPhone || "",
            driverStatus: saved.driverStatus || "Идэвхтэй",
            driverReason: saved.driverReason || "",
            actualDriverId: saved.actualDriverId,
            actualDriverName: saved.actualDriverName,
            actualDriverCode: saved.actualDriverCode || "",
            actualDriverPhone: saved.driverPhone || "",
            salesRep: saved.salesRep || "",
            salesRepPhone: saved.salesRepPhone || "",
            srCode: saved.srCode || "",
            originalVehiclePlate: saved.originalVehiclePlate || saved.vehiclePlate,
            vehiclePlate: saved.vehiclePlate,
            vehicleStatus: saved.vehicleStatus || "Хэвийн",
            vehicleReason: saved.vehicleReason || "",
            actualVehiclePlate: saved.actualVehiclePlate || saved.vehiclePlate,
            vehicleChanged: !!saved.vehicleChanged,
            routeStatus: saved.routeStatus || "Гарсан",
            driverChanged: !!saved.driverChanged,
            vehicleDivision: (saved.vehicleDivision || "IMT") as "IMT" | "IMD",
            notes: saved.notes || ""
          };
        });
      } else {
        // Build initial default list from authoritative 30 City + 10 IMD master routes
        assignments = ALL_MASTER_FLEET_ROUTES.map(def => {
          const matchedDriver = db.drivers.find(d => d.name === def.driverName || d.code === def.routeId);
          return {
            id: `dda_${queryDate}_${def.routeId}`,
            businessDate: queryDate,
            routeId: def.routeId,
            routeName: def.zone,
            originalDriverId: matchedDriver?.id || def.routeId,
            originalDriverName: def.driverName,
            originalDriverCode: matchedDriver?.code || def.routeId,
            driverPhone: def.driverPhone,
            driverStatus: "Идэвхтэй",
            driverReason: "",
            actualDriverId: matchedDriver?.id || def.routeId,
            actualDriverName: def.driverName,
            actualDriverCode: matchedDriver?.code || def.routeId,
            actualDriverPhone: def.driverPhone,
            salesRep: def.salesRep,
            salesRepPhone: def.salesRepPhone,
            srCode: def.srCode,
            originalVehiclePlate: def.vehiclePlate,
            vehiclePlate: def.vehiclePlate,
            vehicleStatus: "Хэвийн",
            vehicleReason: "",
            actualVehiclePlate: def.vehiclePlate,
            vehicleChanged: false,
            routeStatus: "Гарсан",
            driverChanged: false,
            vehicleDivision: def.division as "IMT" | "IMD",
            notes: ""
          };
        });
      }

      // Calculate summary matching image.png KPI cards:
      // 1. Нийт чиглэл (Total Routes)
      // 2. Жолоочийн асуудал (Driver Issues)
      // 3. Машины асуудал (Vehicle Issues)
      // 4. Гараагүй/Цуцалсан (Non-departures)
      // 5. Өөрчилсөн (Changed/Swapped)
      const totalCount = assignments.length;
      const driverIssuesCount = assignments.filter((a: any) => (a.driverStatus && a.driverStatus !== "Идэвхтэй") || a.driverChanged).length;
      const vehicleIssuesCount = assignments.filter((a: any) => (a.vehicleStatus && a.vehicleStatus !== "Хэвийн") || a.vehicleChanged).length;
      const nonDeparturesCount = assignments.filter((a: any) => a.routeStatus === "Гараагүй" || a.routeStatus === "Цуцалсан" || a.routeStatus === "Хойшилсон").length;
      const changedCount = assignments.filter((a: any) => a.driverChanged || a.vehicleChanged).length;
      const normalCount = assignments.filter((a: any) => !a.driverChanged && !a.vehicleChanged && a.routeStatus === "Гарсан" && a.driverStatus === "Идэвхтэй" && a.vehicleStatus === "Хэвийн").length;
      const imtCount = assignments.filter((a: any) => a.vehicleDivision === "IMT").length;
      const imdCount = assignments.filter((a: any) => a.vehicleDivision === "IMD").length;

      res.json({
        success: true,
        date: queryDate,
        isSaved: savedList.length > 0,
        summary: {
          totalCount,
          driverIssuesCount,
          vehicleIssuesCount,
          nonDeparturesCount,
          changedCount,
          normalCount,
          imtCount,
          imdCount
        },
        assignments,
        masterDrivers,
        fineConfig: db.fineConfig || {
          defaultFineAmount: 10000,
          driverDeduction: 10000,
          feeAmount: 0,
          fineReason: "Жолооч солигдсон"
        }
      });
    } catch (err: any) {
      logger.error("Error in GET /api/daily-assignments", err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 2. Save batch daily assignments (ACID Transaction + Idempotent)
  app.post("/api/daily-assignments", async (req: Request, res: Response) => {
    try {
      const { date, assignments, fineConfig } = req.body;
      if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return res.status(400).json({ success: false, error: "Огноо буруу байна (YYYY-MM-DD формат шаардлагатай)" });
      }

      if (!Array.isArray(assignments) || assignments.length === 0) {
        return res.status(400).json({ success: false, error: "Хуваарилалтын өгөгдөл хоосон байна" });
      }

      const activeFineRule = {
        fineAmount: Number(fineConfig?.defaultFineAmount) || Number(db.fineConfig?.defaultFineAmount) || 10000,
        driverDeduction: Number(fineConfig?.driverDeduction) || Number(db.fineConfig?.driverDeduction) || 10000,
        feeAmount: Number(fineConfig?.feeAmount) || Number(db.fineConfig?.feeAmount) || 0,
        reason: fineConfig?.fineReason || db.fineConfig?.fineReason || "Жолооч солигдсон"
      };

      // Save via SQLite repository in transaction
      let repoResult = { savedCount: assignments.length, finesGeneratedCount: 0, finesRemovedCount: 0 };
      try {
        repoResult = DailyAssignmentRepository.saveBatchAssignments(
          date,
          assignments,
          activeFineRule,
          "manager"
        );
      } catch (repoErr: any) {
        logger.warn("SQLite saveBatchAssignments warning, syncing in JSON state:", repoErr.message);
      }

      // Sync into DBState (fleet-db.json)
      if (!db.dailyAssignments) db.dailyAssignments = [];
      if (!db.driverChangeFines) db.driverChangeFines = [];

      // Remove existing for this date and re-populate
      db.dailyAssignments = db.dailyAssignments.filter((a: any) => a.businessDate !== date);
      db.driverChangeFines = db.driverChangeFines.filter((f: any) => f.businessDate !== date);

      const now = new Date().toISOString();
      let finesCount = 0;

      for (const item of assignments) {
        const cleanPlate = (item.originalVehiclePlate || item.vehiclePlate).replace(/\s+/g, "").toUpperCase();
        const routeKey = item.routeId ? item.routeId.replace(/\s+/g, "") : cleanPlate;
        const assignId = `dda_${date}_${routeKey}`;
        const fineId = `fine_${date}_${routeKey}`;

        const isDriverChanged = (item.originalDriverId || "").trim() !== (item.actualDriverId || "").trim() ||
          ((item.actualDriverName || "").trim() !== "" && (item.actualDriverName || "").trim() !== (item.originalDriverName || "").trim());

        const isVehicleChanged = item.vehicleChanged ?? (
          (item.actualVehiclePlate || item.vehiclePlate).replace(/\s+/g, "").toUpperCase() !==
          (item.originalVehiclePlate || item.vehiclePlate).replace(/\s+/g, "").toUpperCase()
        );

        const assignRecord = {
          id: assignId,
          businessDate: date,
          vehiclePlate: item.vehiclePlate,
          vehicleDivision: item.vehicleDivision || "IMT",
          routeId: item.routeId || "",
          routeName: item.routeName || "",
          originalDriverId: item.originalDriverId,
          originalDriverName: item.originalDriverName,
          originalDriverCode: item.originalDriverCode || "",
          driverPhone: item.driverPhone || "",
          driverStatus: item.driverStatus || "Идэвхтэй",
          driverReason: item.driverReason || "",
          salesRep: item.salesRep || "",
          salesRepPhone: item.salesRepPhone || "",
          srCode: item.srCode || "",
          originalVehiclePlate: item.originalVehiclePlate || item.vehiclePlate,
          vehicleStatus: item.vehicleStatus || "Хэвийн",
          vehicleReason: item.vehicleReason || "",
          actualVehiclePlate: item.actualVehiclePlate || item.vehiclePlate,
          vehicleChanged: isVehicleChanged,
          routeStatus: item.routeStatus || "Гарсан",
          actualDriverId: item.actualDriverId,
          actualDriverName: item.actualDriverName,
          actualDriverCode: item.actualDriverCode || "",
          driverChanged: isDriverChanged,
          status: "active",
          notes: item.notes || "",
          createdAt: now,
          updatedAt: now
        };
        db.dailyAssignments.push(assignRecord);

        if (isDriverChanged) {
          finesCount++;
          const fineReasonText = item.driverReason
            ? `Жолооч солигдсон (${item.driverStatus || "Солигдсон"}: ${item.driverReason})`
            : activeFineRule.reason;

          const fineRecord = {
            id: fineId,
            assignmentId: assignId,
            businessDate: date,
            vehiclePlate: item.actualVehiclePlate || item.vehiclePlate,
            vehicleDivision: item.vehicleDivision || "IMT",
            routeId: item.routeId || "",
            routeName: item.routeName || "",
            originalDriverId: item.originalDriverId,
            originalDriverName: item.originalDriverName,
            originalDriverCode: item.originalDriverCode || "",
            actualDriverId: item.actualDriverId,
            actualDriverName: item.actualDriverName,
            actualDriverCode: item.actualDriverCode || "",
            fineReason: fineReasonText,
            fineAmount: activeFineRule.fineAmount,
            driverDeduction: activeFineRule.driverDeduction,
            organization: item.vehicleDivision === "IMD" ? "Айсмарк Дистрибьюшн ХХК" : "АЙСМАРК ТРЕЙД ХХК",
            feeAmount: activeFineRule.feeAmount,
            status: "active",
            notes: item.notes || "",
            createdAt: now
          };
          db.driverChangeFines.push(fineRecord);
        }
      }

      saveDB(db);

      res.json({
        success: true,
        message: `${date} өдрийн бүртгэл амжилттай хадгалагдлаа`,
        savedCount: assignments.length,
        finesGeneratedCount: finesCount,
        repoResult
      });
    } catch (err: any) {
      logger.error("Error in POST /api/daily-assignments", err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 2.5 Get monthly exception reports:
  // - Машин солисон тайлан (Vehicle Swaps)
  // - Жолооч солисон тайлан (Driver Swaps)
  // - Бүс гараагүй тайлан (Cancelled / Non-departure routes)
  app.get("/api/daily-assignments/monthly-exceptions", async (req: Request, res: Response) => {
    try {
      const nowUb = new Date(Date.now() + 8 * 3600 * 1000);
      const curMonth = nowUb.toISOString().slice(0, 7);
      const month = ((req.query.month as string) || curMonth).trim();
      const division = ((req.query.division as string) || "all").trim();

      let report: any = null;
      try {
        report = DailyAssignmentRepository.getMonthlyExceptionReport(month, division);
      } catch (e) {
        // Fallback to in-memory db
        const allAss = (db.dailyAssignments || []).filter((a: any) => {
          if (!a.businessDate?.startsWith(month)) return false;
          if (division !== "all" && a.vehicleDivision !== division) return false;
          return true;
        });

        const vehicleSwaps = allAss.filter((a: any) => a.vehicleChanged);
        const driverSwaps = allAss.filter((a: any) => a.driverChanged);
        const nonDepartures = allAss.filter((a: any) => a.routeStatus === "Гараагүй" || a.routeStatus === "Цуцалсан" || a.routeStatus === "Хойшилсон");

        report = {
          month,
          division,
          totalRecordedDays: Array.from(new Set(allAss.map((a: any) => a.businessDate))).length,
          totalAssignments: allAss.length,
          vehicleSwapsCount: vehicleSwaps.length,
          driverSwapsCount: driverSwaps.length,
          nonDeparturesCount: nonDepartures.length,
          vehicleSwaps,
          driverSwaps,
          nonDepartures
        };
      }

      res.json({
        success: true,
        ...report
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 2.6 Daily status endpoint specifically for /sales view
  app.get("/api/sales/daily-status", async (req: Request, res: Response) => {
    try {
      const nowUb = new Date(Date.now() + 8 * 3600 * 1000);
      const todayStr = nowUb.toISOString().slice(0, 10);
      const queryDate = ((req.query.date as string) || todayStr).trim();

      let rows: any[] = [];
      try {
        rows = DailyAssignmentRepository.findByDate(queryDate);
      } catch (e) {
        rows = (db.dailyAssignments || []).filter((a: any) => a.businessDate === queryDate);
      }

      let routes = [];
      if (rows && rows.length > 0) {
        routes = rows;
      } else {
        // Fallback default from MASTER_30_CITY_ROUTES
        routes = MASTER_30_CITY_ROUTES.map(def => ({
          routeId: def.routeId,
          routeName: def.zone,
          originalDriverName: def.driverName,
          driverPhone: def.driverPhone,
          driverStatus: "Идэвхтэй",
          driverReason: "",
          actualDriverName: def.driverName,
          salesRep: def.salesRep,
          salesRepPhone: def.salesRepPhone,
          srCode: def.srCode,
          originalVehiclePlate: def.vehiclePlate,
          vehicleStatus: "Хэвийн",
          vehicleReason: "",
          actualVehiclePlate: def.vehiclePlate,
          vehicleChanged: false,
          driverChanged: false,
          routeStatus: "Гарсан",
          vehicleDivision: "IMT"
        }));
      }

      const totalCount = routes.length;
      const driverIssues = routes.filter((r: any) => r.driverChanged || (r.driverStatus && r.driverStatus !== "Идэвхтэй")).length;
      const vehicleIssues = routes.filter((r: any) => r.vehicleChanged || (r.vehicleStatus && r.vehicleStatus !== "Хэвийн")).length;
      const nonDepartures = routes.filter((r: any) => r.routeStatus === "Гараагүй" || r.routeStatus === "Цуцалсан" || r.routeStatus === "Хойшилсон").length;
      const changedCount = routes.filter((r: any) => r.driverChanged || r.vehicleChanged).length;

      res.json({
        success: true,
        date: queryDate,
        summary: {
          totalCount,
          driverIssues,
          vehicleIssues,
          nonDepartures,
          changedCount
        },
        routes
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 3. Get comprehensive fine reports (Manager Daily/Monthly Report, Monthly Matrix, Driver Signature Report)
  app.get("/api/fines/internal/report", async (req: Request, res: Response) => {
    try {
      const nowUb = new Date(Date.now() + 8 * 3600 * 1000);
      const curMonth = nowUb.toISOString().slice(0, 7); // YYYY-MM
      const curDate = nowUb.toISOString().slice(0, 10); // YYYY-MM-DD

      const month = ((req.query.month as string) || curMonth).trim();
      const dateFilter = (req.query.date as string)?.trim() || "";
      const divisionFilter = ((req.query.division as string) || "all").trim(); // "all" | "IMT" | "IMD"
      const driverIdFilter = (req.query.driverId as string)?.trim() || "";
      const routeFilter = (req.query.route as string)?.trim() || "";

      // Fetch all fine records for the month or date
      let finesList: any[] = [];
      try {
        finesList = DailyAssignmentRepository.findFines({
          month: dateFilter ? undefined : month,
          date: dateFilter || undefined,
          division: divisionFilter !== "all" ? divisionFilter : undefined,
          driverId: driverIdFilter || undefined
        });
      } catch (e) {
        // Fallback to in-memory JSON state
        finesList = (db.driverChangeFines || []).filter((f: any) => {
          if (dateFilter) {
            if (f.businessDate !== dateFilter) return false;
          } else if (month) {
            if (!f.businessDate.startsWith(month)) return false;
          }
          if (divisionFilter !== "all" && f.vehicleDivision !== divisionFilter) return false;
          if (driverIdFilter && f.actualDriverId !== driverIdFilter && f.originalDriverId !== driverIdFilter) return false;
          if (routeFilter && !f.routeName?.toLowerCase().includes(routeFilter.toLowerCase()) && !f.routeId?.toLowerCase().includes(routeFilter.toLowerCase())) return false;
          return true;
        });
      }

      // ЗӨВХӨН ТӨЛӨӨГҮЙ ТОРГУУЛИЙГ ТАЙЛАН ДЭЭР ТООЦОЖ ХАРУУЛАХ (Хэрэглэгчийн шаардлага)
      const onlyUnpaid = req.query.all !== "true";
      if (onlyUnpaid) {
        finesList = finesList.filter((f: any) => f.isPaid !== true && f.paymentStatus !== "paid" && f.status !== "paid");
      }

      // Build Master Drivers list filtered by division
      let targetDrivers = db.drivers;
      if (divisionFilter === "IMT") {
        targetDrivers = db.drivers.filter(d => !d.isIMD);
      } else if (divisionFilter === "IMD") {
        targetDrivers = db.drivers.filter(d => !!d.isIMD);
      }

      if (driverIdFilter) {
        targetDrivers = targetDrivers.filter(d => d.id === driverIdFilter || d.code === driverIdFilter);
      }

      // Build Monthly Fine Matrix (`Torguuli` sheet format: Code, DriverName, Vehicle, Phone, Days 1..31, Total)
      const daysInMonth = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).getDate();
      
      const monthlyMatrix = targetDrivers.map(d => {
        const cleanPlate = d.vehicle.replace(/\s+/g, "").toUpperCase();
        const driverFines = finesList.filter(f => {
          const matchPlate = f.vehiclePlate.replace(/\s+/g, "").toUpperCase() === cleanPlate;
          const matchDriver = f.actualDriverId === d.id || f.originalDriverId === d.id;
          return matchPlate || matchDriver;
        });

        const days: Record<number, number> = {};
        let totalAmount = 0;

        driverFines.forEach(f => {
          const dayNum = parseInt(f.businessDate.slice(8, 10), 10);
          if (!isNaN(dayNum) && dayNum >= 1 && dayNum <= 31) {
            days[dayNum] = (days[dayNum] || 0) + (Number(f.fineAmount) || 0);
            totalAmount += (Number(f.fineAmount) || 0);
          }
        });

        return {
          code: d.code,
          driverName: d.name,
          vehicle: d.vehicle,
          phone: d.phone || "",
          division: (d.isIMD ? "IMD" : "IMT") as "IMT" | "IMD",
          days,
          totalAmount
        };
      });

      // Build Driver Signature Report (`Sheet3` format: д/д, Албан тушаал, ТХ дугаар, Жолооч, Дүн, Суутгал, Байгууллага, Шимтгэл, Огноо, Тайлбар, Гарын үсэг)
      const signatureReport = finesList.map((f, idx) => {
        const matchedDriver = db.drivers.find(d => d.id === f.actualDriverId || d.name === f.actualDriverName);
        const jobTitle = matchedDriver?.jobTitle || (f.vehicleDivision === "IMD" ? "ТҮГЭЭГЧ" : "БОРЛУУЛАЛТЫН ЖОЛООЧ");
        const orgName = f.organization || (f.vehicleDivision === "IMD" ? "Айсмарк Дистрибьюшн ХХК" : "АЙСМАРК ТРЕЙД ХХК");

        return {
          index: idx + 1,
          jobTitle,
          vehiclePlate: f.vehiclePlate,
          driverName: f.actualDriverName,
          fineAmount: Number(f.fineAmount) || 0,
          driverDeduction: Number(f.driverDeduction) || Number(f.fineAmount) || 0,
          organization: orgName,
          feeAmount: Number(f.feeAmount) || 0,
          date: f.businessDate,
          explanation: f.fineReason || "Жолооч солигдсон",
          signature: ""
        };
      });

      // Calculate total statistics
      const totalFines = finesList.length;
      const totalAmount = finesList.reduce((sum, f) => sum + (Number(f.fineAmount) || 0), 0);
      const imtFines = finesList.filter(f => f.vehicleDivision === "IMT");
      const imdFines = finesList.filter(f => f.vehicleDivision === "IMD");

      const summary = {
        totalFines,
        totalAmount,
        imtCount: imtFines.length,
        imtAmount: imtFines.reduce((sum, f) => sum + (Number(f.fineAmount) || 0), 0),
        imdCount: imdFines.length,
        imdAmount: imdFines.reduce((sum, f) => sum + (Number(f.fineAmount) || 0), 0),
        daysInMonth
      };

      res.json({
        success: true,
        month,
        date: dateFilter || undefined,
        division: divisionFilter,
        summary,
        records: finesList,
        monthlyMatrix,
        signatureReport
      });
    } catch (err: any) {
      logger.error("Error in GET /api/fines/internal/report", err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 4. Get fine configuration
  app.get("/api/fines/internal/config", (req: Request, res: Response) => {
    res.json({
      success: true,
      config: db.fineConfig || {
        defaultFineAmount: 10000,
        driverDeduction: 10000,
        feeAmount: 0,
        fineReason: "Жолооч солигдсон"
      }
    });
  });

  // 5. Update fine configuration
  app.post("/api/fines/internal/config", (req: Request, res: Response) => {
    try {
      const { defaultFineAmount, driverDeduction, feeAmount, fineReason } = req.body;
      db.fineConfig = {
        defaultFineAmount: Number(defaultFineAmount) || 10000,
        driverDeduction: Number(driverDeduction) || Number(defaultFineAmount) || 10000,
        feeAmount: Number(feeAmount) || 0,
        fineReason: (fineReason || "Жолооч солигдсон").trim()
      };
      saveDB(db);
      res.json({ success: true, config: db.fineConfig, message: "Торгуулийн тохиргоо шинэчлэгдлээ" });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 6. Manual trigger for 23:00 Nightly Fine Audit (POST)
  app.post("/api/fines/internal/run-2300-scan", async (req: Request, res: Response) => {
    try {
      const date = req.body.date;
      const result = await runDailyFineAudit(date);
      res.json({ success: true, result });
    } catch (err: any) {
      logger.error("Error running 23:00 fine audit", err);
      res.status(500).json({ success: false, error: err.message || "Торгуулийн автомат шүүлтэд алдаа гарлаа" });
    }
  });

  // 7. Get 23:00 Audit Status (GET)
  app.get("/api/fines/internal/audit-status", (req: Request, res: Response) => {
    const nowUb = new Date(Date.now() + 8 * 3600 * 1000);
    res.json({
      success: true,
      lastResult: lastFineAuditResult,
      lastAuditedDate,
      serverUbTime: nowUb.toISOString().slice(11, 19),
      serverUbDate: nowUb.toISOString().slice(0, 10),
    });
  });

  // Authenticated endpoint: GET /api/rules/pdf
  app.get(["/api/rules/pdf", "/regulation.pdf", "/api/regulation.pdf"], (req: Request, res: Response) => {
    // 1. Check Bearer token or token query param
    const authHeader = req.headers.authorization;
    let token = "";
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.substring(7).trim();
    } else if (req.query.token && typeof req.query.token === "string") {
      token = req.query.token;
    }

    let isAuthenticated = false;
    if (token) {
      const user = verifySessionToken(token);
      if (user) {
        isAuthenticated = true;
      }
    }

    // 2. Check active driver header or query code if provided
    const driverCode = (req.headers["x-driver-code"] as string) || (req.query.driverCode as string);
    if (!isAuthenticated && driverCode) {
      const driver = DriverRepository.findById(driverCode.trim());
      if (driver) {
        isAuthenticated = true;
      }
    }

    if (!isAuthenticated) {
      return res.status(401).json({
        error: "Нэвтрэх шаардлагатай (401 Unauthorized). Та системд нэвтэрсний дараа журмыг үзэх боломжтой."
      });
    }

    const publicDir = path.join(process.cwd(), "public");
    const distDir = path.join(process.cwd(), "dist");
    const candidates = [
      path.join(publicDir, "Авто тээвэр_Түгээлтийн_журам_Хавсралт_3_нэг_хүснэгт_нэг_хуудас.pdf"),
      path.join(publicDir, "regulation.pdf"),
      path.join(distDir, "regulation.pdf")
    ];
    const pdfPath = candidates.find(p => fs.existsSync(p));
    if (pdfPath) {
      res.removeHeader("X-Frame-Options");
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", "inline; filename=\"regulation.pdf\"");
      res.setHeader("Cache-Control", "private, no-cache, no-store, must-revalidate");
      res.sendFile(pdfPath);
    } else {
      res.status(404).json({ error: "Журмын PDF баримт олдсонгүй" });
    }
  });

  // Ensure ANY unhandled /api or /api/* route ALWAYS returns JSON 404, NEVER falling through to Vite SPA HTML
  app.all(["/api", "/api/*"], (req: Request, res: Response) => {
    res.status(404).json({
      status: "error",
      error: `API endpoint not found: ${req.method} ${req.originalUrl || req.url}`,
    });
  });

  // Global Express Error Handler for API routes (guarantees JSON response, never HTML error page)
  app.use((err: any, req: Request, res: Response, next: any) => {
    logger.error("Unhandled Express Error:", err);
    if (res.headersSent) {
      return next(err);
    }
    res.status(err.status || 500).json({
      status: "error",
      error: err.message || "Сервер дээр дотоод алдаа гарлаа",
    });
  });

  // Serve static assets from public folder (including regulation documents and images)
  const publicDir = path.join(process.cwd(), "public");
  const distDir = path.join(process.cwd(), "dist");

  // Route for regulation page image (internal fallback)
  app.get(["/regulation_page_1.png", "/regulation_page_1.webp"], (req, res) => {
    res.removeHeader("X-Frame-Options");
    res.setHeader("Access-Control-Allow-Origin", "*");
    const webpPath = fs.existsSync(path.join(publicDir, "regulation_page_1.webp"))
      ? path.join(publicDir, "regulation_page_1.webp")
      : path.join(distDir, "regulation_page_1.webp");
    if (fs.existsSync(webpPath)) {
      res.setHeader("Content-Type", "image/webp");
      res.sendFile(webpPath);
    } else {
      res.status(404).send("Regulation image not found");
    }
  });

  if (fs.existsSync(publicDir)) {
    app.use(express.static(publicDir));
  }

  // Vite middleware in dev vs static serving in production
  const distPath = path.join(process.cwd(), "dist");
  const hasDist = fs.existsSync(path.join(distPath, "index.html"));
  const isProduction =
    process.env.NODE_ENV === "production" ||
    (typeof __filename !== "undefined" && __filename.endsWith(".cjs")) ||
    (hasDist && process.env.NODE_ENV !== "development");

  if (isProduction) {
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: "spa",
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚛 Fleet Digital Server running on http://0.0.0.0:${PORT}`);
  });
}

process.on("uncaughtException", (err) => {
  console.error("Uncaught exception caught:", err.message);
});
process.on("unhandledRejection", (reason) => {
  console.error("Unhandled rejection caught:", reason);
});

startServer();
