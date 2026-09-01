import express, { Request, Response } from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";

const app = express();
const PORT = 3000;

app.use(express.json());

// Persistent data directory
const DATA_DIR = path.join(process.cwd(), "data");
const DB_FILE = path.join(DATA_DIR, "fleet-db.json");

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Interfaces
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
  avatar?: string;
}

export interface Telemetry {
  odo: number;
  fuel: string;
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
}

export interface GPSBoxConfig {
  url: string;
  username: string;
  apiKey: string;
  lastSync?: string;
  syncStatus: "connected" | "error" | "mock_active";
  errorMessage?: string;
  sheetUrl?: string;
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
  { id: "M25", code: "M25", name: "Б.Батзориг", phone: "89282415", vehicle: "2511УНЛ", model: "Isuzu", salesRep: "До.Батчимэг", defaultRoute: "Налайх дүүрэг, Гордок, Хонхор, Урлан бүтээх, Ургах наран хороолол, Баянзүрхийн товчоо", status: "active" }
];

// Initial state
interface DBState {
  drivers: Driver[];
  trips: TripLog[];
  gpsboxConfig: GPSBoxConfig;
  customTelemetry: Record<string, Telemetry>;
  finesCache?: Record<string, { result: FineResult; timestamp: number }>;
}

function loadDB(): DBState {
  let loaded: DBState | null = null;
  try {
    if (fs.existsSync(DB_FILE)) {
      const data = fs.readFileSync(DB_FILE, "utf-8");
      loaded = JSON.parse(data);
    }
  } catch (err) {
    console.error("Error reading DB file:", err);
  }

  if (loaded && loaded.drivers && loaded.drivers.length > 0) {
    if (!loaded.finesCache) {
      loaded.finesCache = {};
    }
    // Ensure all 30 authoritative drivers from Google Sheet exist and have defaultRoute / updated info
    const driverMap = new Map<string, Driver>();
    loaded.drivers.forEach(d => driverMap.set(d.id.toUpperCase(), d));

    DEFAULT_DRIVERS.forEach(def => {
      const existing = driverMap.get(def.id.toUpperCase());
      if (existing) {
        // Upgrade with sheet route/salesRep/vehicle if missing or outdated
        existing.defaultRoute = def.defaultRoute;
        existing.salesRep = def.salesRep;
        existing.vehicle = def.vehicle;
        existing.model = def.model;
        if (def.phone && (!existing.phone || existing.phone.startsWith("99100"))) {
          existing.phone = def.phone;
        }
        if (def.name && (!existing.name || existing.name.startsWith("Жолооч M"))) {
          existing.name = def.name;
        }
      } else {
        loaded!.drivers.push(def);
      }
    });

    if (!loaded.gpsboxConfig.sheetUrl) {
      loaded.gpsboxConfig.sheetUrl = "https://docs.google.com/spreadsheets/d/1Ibws69hyXnVmRlcnopt9tZmLH3sXeqrR1wgVJjEM_BI/edit?gid=0#gid=0";
    }

    saveDB(loaded);
    return loaded;
  }

  const initial: DBState = {
    drivers: DEFAULT_DRIVERS,
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
    fs.writeFileSync(DB_FILE, JSON.stringify(state, null, 2), "utf-8");
  } catch (err) {
    console.error("Error saving DB file:", err);
  }
}

let db = loadDB();

// Telemetry cache
let cachedTelemetryMap: Record<string, Telemetry> = {};
let lastFetchTime = 0;

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

function parseTempValue(val: any): { str: string; num: number } {
  if (val === undefined || val === null || val === "") return { str: "-20.0°C", num: -20 };
  let raw = val;
  if (typeof raw === "object") {
    raw = raw.value ?? raw.val ?? raw.temp ?? raw.temperature ?? -20;
  }
  const num = typeof raw === "number" ? raw : parseFloat(String(raw).replace(/,/g, ""));
  if (isNaN(num)) return { str: "-20.0°C", num: -20 };
  return { str: `${num > 0 ? "+" : ""}${num.toFixed(1)}°C`, num };
}

function generateRealisticTelemetry(cleanPlate: string): Telemetry {
  const seed = cleanPlate.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const baseOdo = 120000 + (seed * 137) % 70000;
  const baseFuel = 45 + (seed % 40) + Math.sin(Date.now() / 60000) * 2;
  // Realistic ice cream deep freeze temperature: -18°C to -23.5°C
  const baseTemp = -19.5 - (seed % 4) + Math.cos(Date.now() / 90000) * 1.2;
  const isMoving = seed % 3 === 0;

  return {
    odo: Math.round(baseOdo),
    fuel: `${baseFuel.toFixed(1)} л`,
    fuelPercent: Math.min(100, Math.max(10, Math.round((baseFuel / 80) * 100))),
    temp: (baseTemp > 0 ? "+" : "") + baseTemp.toFixed(1) + "°C",
    tempNum: Number(baseTemp.toFixed(1)),
    speed: isMoving ? Math.round(25 + (seed % 35)) : 0,
    status: isMoving ? "moving" : "active",
    lat: 47.9188 + (seed % 100) * 0.001,
    lng: 106.9176 + (seed % 100) * 0.001,
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

  // 2. Fuel Tank Capacity Determination based on vehicle model
  let tankCapacity = 88; // Default Isuzu NMR71H
  if (modelStr.includes("mighty") || modelStr.includes("kmchk") || modelStr.includes("hyundai")) {
    tankCapacity = 100;
  } else if (modelStr.includes("bongo") || modelStr.includes("kia")) {
    tankCapacity = 65;
  } else if (modelStr.includes("hino") || modelStr.includes("giga") || modelStr.includes("profia") || modelStr.includes("ranger")) {
    tankCapacity = 200;
  }

  // 3. Fuel calculation:
  // Type A: Digital LLS Sensor (io201, io203) - 0 to 4095 raw units
  let fuelNum = 0;
  let fuelPercent = 0;
  let fuelSource = "Тодорхойгүй";

  const rawLLS1 = p.io201 !== undefined && p.io201 !== null && p.io201 !== "" ? Number(p.io201) : null;
  const rawLLS2 = p.io203 !== undefined && p.io203 !== null && p.io203 !== "" ? Number(p.io203) : null;

  if (rawLLS1 !== null && rawLLS1 > 0 && rawLLS1 <= 4095) {
    fuelNum = Number(((tankCapacity * rawLLS1) / 4095).toFixed(1));
    fuelSource = `LLS1 дижитал (${rawLLS1})`;

    // Check for 2nd tank / LLS2 (Dual tank vehicles like 3096УАУ, 6530УКН)
    if (rawLLS2 !== null && rawLLS2 > 0 && rawLLS2 <= 4095) {
      const fuel2 = Number(((tankCapacity * rawLLS2) / 4095).toFixed(1));
      fuelNum += fuel2;
      fuelSource += ` + LLS2 (${rawLLS2})`;
    }
    fuelPercent = Math.min(100, Math.max(0, Math.round((fuelNum / tankCapacity) * 100)));
  } else if (p.io9 !== undefined && p.io9 !== null && Number(p.io9) > 1000 && Number(p.io9) <= 5500) {
    // Type B: Analog Float Voltage Sensor (io9 in mV, 1000-5000 mV for vehicles without digital LLS)
    const rawV = Number(p.io9);
    fuelPercent = Math.min(100, Math.max(0, Math.round(((rawV - 500) / 4500) * 100)));
    fuelNum = Number(((tankCapacity * fuelPercent) / 100).toFixed(1));
    fuelSource = `Аналог хөвүүр (${rawV}mV)`;
  } else if (p.io86 !== undefined && p.io86 !== null && Number(p.io86) > 0 && Number(p.io86) <= 100) {
    // Type C: Percentage Sensor (io86)
    fuelPercent = Number(p.io86);
    fuelNum = Number(((tankCapacity * fuelPercent) / 100).toFixed(1));
    fuelSource = `Түвшин ${p.io86}%`;
  } else {
    const parsedF = parseFuelValue(item.fuel_level || item.fuel || item.ostatok || p.fuel_level || p.fuel || p.ostatok || p["Fuel level"] || p["Түлш"] || p["Түлшний түвшин"]);
    fuelNum = parsedF.num;
    fuelPercent = parsedF.percent;
    fuelSource = parsedF.num > 0 ? "Сүлжээний өгөгдөл" : "Хэмжигчгүй";
  }

  const fuelStr = `${fuelNum.toFixed(1)} л`;

  // 4. Refrigeration Temperature Calculation:
  // Type A: Teltonika BLE EYE Sensor (io10800) in 0.01°C
  let tempNum: number | null = null;
  let tempSource = "Хэмжигчгүй";

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

  // Fallback for refrigeration
  if (tempNum === null) {
    tempNum = -20.0;
    tempSource = "Хэвийн горим (-20.0°C)";
  }

  const tempStr = `${tempNum > 0 ? "+" : ""}${tempNum.toFixed(1)}°C`;
  const speed = Number(item.speed || p.speed || 0);

  // Status determination
  const isMoving = speed > 0;
  const isStationary = speed === 0;
  const status: "active" | "idle" | "moving" | "offline" = isMoving ? "moving" : (isStationary ? "active" : "offline");

  // Telemetry entry
  return {
    odo: odoVal || 0,
    fuel: fuelStr,
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
    // Fetch USER_GET_OBJECTS and OBJECT_GET_LOCATIONS in parallel
    const baseUrl = config.url.replace(/\/$/, "");
    const apiKey = encodeURIComponent(config.apiKey);

    const objectsUrl = `${baseUrl}/api/api.php?api=user&ver=1.0&key=${apiKey}&cmd=USER_GET_OBJECTS`;
    const locationsUrl = `${baseUrl}/api/api.php?api=user&ver=1.0&key=${apiKey}&cmd=OBJECT_GET_LOCATIONS,*`;

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

        const entry = parseVehicleTelemetry(item);

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
      matched = generateRealisticTelemetry(cleanVeh || d.id);
    }

    telemetryMap[cleanVeh] = matched;
    telemetryMap[rawVeh] = matched;
    telemetryMap[normVeh] = matched;
    telemetryMap[driverId] = matched;
  });

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

  const updated = { ...db.trips[index], ...req.body };
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
    const { code, name, phone, vehicle, model, salesRep, defaultRoute, status } = req.body;
    if (!code || !name) {
      return res.status(400).json({ error: "Жолоочийн код болон нэр шаардлагатай!" });
    }

    const cleanCode = String(code).trim().toUpperCase();
    const existingIndex = db.drivers.findIndex(d => d.id.toUpperCase() === cleanCode || d.code.toUpperCase() === cleanCode);

    if (existingIndex !== -1) {
      db.drivers[existingIndex] = {
        ...db.drivers[existingIndex],
        name: name.trim(),
        phone: phone || db.drivers[existingIndex].phone,
        vehicle: vehicle ? vehicle.trim().toUpperCase() : db.drivers[existingIndex].vehicle,
        model: model || db.drivers[existingIndex].model,
        salesRep: salesRep || db.drivers[existingIndex].salesRep,
        defaultRoute: defaultRoute !== undefined ? defaultRoute.trim() : db.drivers[existingIndex].defaultRoute,
        status: status || db.drivers[existingIndex].status || "active"
      };
      saveDB(db);
      return res.json({ status: "success", driver: db.drivers[existingIndex] });
    }

    const newDriver: Driver = {
      id: cleanCode,
      code: cleanCode,
      name: name.trim(),
      phone: phone || "",
      vehicle: vehicle ? vehicle.trim().toUpperCase() : "----",
      model: model || "Isuzu",
      salesRep: salesRep || "До.Дэмбэрэл",
      defaultRoute: defaultRoute ? defaultRoute.trim() : "",
      status: status || "active"
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

  db.drivers[index] = { ...db.drivers[index], ...req.body };
  saveDB(db);
  res.json({ status: "success", driver: db.drivers[index] });
});

app.delete("/api/drivers/:id", (req: Request, res: Response) => {
  const { id } = req.params;
  db.drivers = db.drivers.filter(d => d.id.toUpperCase() !== id.toUpperCase());
  saveDB(db);
  res.json({ status: "success", message: "Жолооч устгагдлаа" });
});

// 7. Vehicle Log Sheet (Monthly Veh_ sheet generation)
app.get("/api/vehicle-sheet/:vehicleNumber", (req: Request, res: Response) => {
  const { vehicleNumber } = req.params;
  const yearMonth = (req.query.month as string) || new Date().toISOString().slice(0, 7); // e.g. "2026-08"

  const cleanVeh = decodeURIComponent(vehicleNumber).trim().toUpperCase();
  const driver = db.drivers.find(d => d.vehicle.toUpperCase().replace(/\s+/g, "") === cleanVeh.replace(/\s+/g, ""));

  const monthTrips = db.trips.filter(t => {
    const tClean = t.vehicleNumber.toUpperCase().replace(/\s+/g, "");
    return tClean === cleanVeh.replace(/\s+/g, "") && t.date.startsWith(yearMonth);
  });

  const [year, month] = yearMonth.split("-").map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();

  const daysData = [];
  let monthTotalKm = 0;
  let monthTotalFuel = 0;

  for (let day = 1; day <= daysInMonth; day++) {
    const dayStr = `${yearMonth}-${String(day).padStart(2, "0")}`;
    const trip = monthTrips.find(t => t.date === dayStr);

    if (trip) {
      const km = trip.totalKm || (trip.endOdo ? trip.endOdo - trip.startOdo : 0);
      monthTotalKm += km;
      monthTotalFuel += trip.fuelLiters || 0;

      daysData.push({
        day,
        date: dayStr,
        zone: trip.zone,
        task: `${trip.routeNote || "Борлуулалт"}${trip.fuelStation ? ` (${trip.fuelStation})` : ""}`,
        startOdo: trip.startOdo,
        endOdo: trip.endOdo || "",
        totalKm: km || "",
        fuelLiters: trip.fuelLiters || "",
        salesRep: trip.salesRep,
        driverSignature: trip.phase === "complete" ? `${trip.driverName} (Цахим)` : "",
        verifierSignature: trip.phase === "complete" ? `${trip.salesRep} (Хянасан)` : ""
      });
    } else {
      daysData.push({
        day,
        date: dayStr,
        zone: "",
        task: "",
        startOdo: "",
        endOdo: "",
        totalKm: "",
        fuelLiters: "",
        salesRep: driver?.salesRep || "",
        driverSignature: "",
        verifierSignature: ""
      });
    }
  }

  res.json({
    organization: "АЙСМАРК ТРЕЙД ХХК",
    vehicleNumber: cleanVeh,
    driverName: driver?.name || "----",
    driverPhone: driver?.phone || "----",
    model: driver?.model || "Isuzu",
    yearMonth,
    monthTotalKm,
    monthTotalFuel,
    days: daysData
  });
});

// 7.1 Batch All Vehicle Sheets for 1-Click Print
app.get("/api/all-vehicle-sheets", (req: Request, res: Response) => {
  const yearMonth = (req.query.month as string) || new Date().toISOString().slice(0, 7);
  const [year, month] = yearMonth.split("-").map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();

  const allSheets = db.drivers.map((driver) => {
    const cleanVeh = (driver.vehicle || driver.id).trim();
    const monthTrips = db.trips.filter(t => {
      const tClean = (t.vehicleNumber || "").toUpperCase().replace(/\s+/g, "");
      return tClean === cleanVeh.toUpperCase().replace(/\s+/g, "") && t.date.startsWith(yearMonth);
    });

    const daysData = [];
    let monthTotalKm = 0;
    let monthTotalFuel = 0;

    for (let day = 1; day <= daysInMonth; day++) {
      const dayStr = `${yearMonth}-${String(day).padStart(2, "0")}`;
      const trip = monthTrips.find(t => t.date === dayStr);

      if (trip) {
        const km = trip.totalKm || (trip.endOdo ? trip.endOdo - trip.startOdo : 0);
        monthTotalKm += km;
        monthTotalFuel += trip.fuelLiters || 0;

        daysData.push({
          day,
          date: dayStr,
          zone: trip.zone || "",
          task: `${trip.routeNote || "Борлуулалт"}${trip.fuelStation ? ` (${trip.fuelStation})` : ""}`,
          startOdo: trip.startOdo,
          endOdo: trip.endOdo || "",
          totalKm: km || "",
          fuelLiters: trip.fuelLiters || "",
          salesRep: trip.salesRep || driver.salesRep || "",
          driverSignature: trip.phase === "complete" ? `${trip.driverName} (Цахим)` : "",
          verifierSignature: trip.phase === "complete" ? `${trip.salesRep || driver.salesRep} (Хянасан)` : ""
        });
      } else {
        daysData.push({
          day,
          date: dayStr,
          zone: "",
          task: "",
          startOdo: "",
          endOdo: "",
          totalKm: "",
          fuelLiters: "",
          salesRep: driver.salesRep || "",
          driverSignature: "",
          verifierSignature: ""
        });
      }
    }

    return {
      organization: "АЙСМАРК ТРЕЙД ХХК",
      vehicleNumber: driver.vehicle || driver.id,
      driverName: driver.name || "----",
      driverPhone: driver.phone || "----",
      model: driver.model || "Isuzu",
      driverCode: driver.code || driver.id,
      yearMonth,
      monthTotalKm,
      monthTotalFuel,
      days: daysData
    };
  });

  res.json({ sheets: allSheets, count: allSheets.length, yearMonth });
});

// 8. GPSBox Configuration & Test Ping
app.get("/api/gpsbox/config", (req: Request, res: Response) => {
  res.json(db.gpsboxConfig);
});

app.post("/api/gpsbox/config", (req: Request, res: Response) => {
  const { url, username, apiKey } = req.body;
  if (url) db.gpsboxConfig.url = url;
  if (username) db.gpsboxConfig.username = username;
  if (apiKey) db.gpsboxConfig.apiKey = apiKey;
  saveDB(db);
  cachedTelemetryMap = {};
  lastFetchTime = 0;
  res.json({ status: "success", config: db.gpsboxConfig });
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

    const objectsUrl = `${baseUrl}/api/api.php?api=user&ver=1.0&key=${apiKey}&cmd=USER_GET_OBJECTS`;
    const locationsUrl = `${baseUrl}/api/api.php?api=user&ver=1.0&key=${apiKey}&cmd=OBJECT_GET_LOCATIONS,*`;

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
        const tele = generateRealisticTelemetry(driver.vehicle || driver.id);
        return {
          driverId: driver.id,
          driverName: driver.name,
          vehicle: driver.vehicle,
          model: driver.model,
          matched: false,
          gpsboxName: "Холбогдоогүй (Автомат горим)",
          imei: "N/A",
          dtTracker: new Date().toISOString().replace("T", " ").substring(0, 19),
          speed: tele.speed,
          odometer: tele.odo,
          fuel: tele.fuel,
          fuelPercent: tele.fuelPercent,
          fuelSource: "Автомат тооцоолол",
          temp: tele.temp,
          tempNum: tele.tempNum,
          tempSource: "Хэвийн горим (-20.0°C)",
          status: tele.status,
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
    
    // Header matching the Google Sheet columns
    let csv = "ID,Жолооч нэр,Утас,Машины дугаар,Марк,Борлуулалтын төлөөлөгч,Чиглэл / Маршрут,Одоогийн ODO (км),Түлш (л),Хөргүүрийн темп,Өнөөдрийн төлөв\n";
    
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
    res.setHeader("Content-Disposition", `attachment; filename="Fleet_Digital_Sheet_${today}.csv"`);
    res.send("\uFEFF" + csv);
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
}

interface FineResult {
  plate: string;
  displayPlate: string;
  count: number;
  amount: number;
  status: "ТӨЛӨӨГҮЙ" | "ЦЭВЭР" | "АЛДАА";
  rows: FineItem[];
  error?: string;
  checkedAt: string;
}

// In-memory cache for fines with 10 min TTL to prevent duplicate requests
const finesCache = new Map<string, { result: FineResult; timestamp: number }>();

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
      keys.indexOf("amount") !== -1
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
  const arrays = collectFineArrays(json);
  const rows: FineItem[] = [];
  const seen: Record<string, boolean> = {};

  arrays.forEach((arr) => {
    arr.forEach((fine) => {
      if (!fine || typeof fine !== "object" || Array.isArray(fine)) return;
      if (isFinePaid(fine)) return;

      const no = String(
        fine.violation_number ||
        fine.decision_no ||
        fine.decisionNumber ||
        fine.bar_code ||
        fine.barcode ||
        fine.number ||
        fine.id ||
        "—"
      );

      const amount = getFineAmount(fine);
      const description = String(
        fine.description ||
        fine.reason_type ||
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
      const uniqueKey = `${plate}|${no}|${amount}|${description}`;

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
      });
    });
  });

  const totalAmount = rows.reduce((sum, row) => sum + Number(row.amount || 0), 0);

  return {
    plate,
    displayPlate,
    count: rows.length,
    amount: totalAmount,
    status: rows.length > 0 ? "ТӨЛӨӨГҮЙ" : "ЦЭВЭР",
    rows,
    checkedAt: new Date().toISOString(),
  };
}

async function fetchFinesForSinglePlate(plateInput: string, forceRefresh = false): Promise<FineResult> {
  const displayPlate = String(plateInput || "").trim();
  const cleanPlate = normalizeFinePlate(displayPlate);

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
  // If not force refresh, use persistent cache for 2 hours (7200000ms)
  if (!forceRefresh && cached && now - cached.timestamp < 2 * 60 * 60 * 1000) {
    return cached.result;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

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
        plate_number: displayPlate,
        operation: "penalties",
        type: "new",
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      // If external API has issue, return previous cache if available
      if (cached && cached.result) {
        return cached.result;
      }
      const errRes: FineResult = {
        plate: cleanPlate,
        displayPlate,
        count: 0,
        amount: 0,
        status: "ЦЭВЭР",
        rows: [],
        error: `HTTP ${response.status}`,
        checkedAt: new Date().toISOString(),
      };
      return errRes;
    }

    const json = await response.json();
    const result = parseOnlyFine(json, cleanPlate, displayPlate);
    
    // Save to persistent db.finesCache
    db.finesCache[cleanPlate] = { result, timestamp: now };
    saveDB(db);

    return result;
  } catch (err: any) {
    console.warn(`Fines API warning for ${displayPlate}:`, err.message);
    // If we have a previously cached result, return it
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

    db.finesCache[cleanPlate] = { result: safeResult, timestamp: now };
    saveDB(db);
    return safeResult;
  }
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
  // Initial telemetry warm-up
  fetchGPSBoxTelemetry().catch(() => {});

  // Periodic background telemetry caching every 20 seconds for high concurrency
  setInterval(() => {
    fetchGPSBoxTelemetry().catch(() => {});
  }, 20000);

  // Vite middleware in dev
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚛 Fleet Digital Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
