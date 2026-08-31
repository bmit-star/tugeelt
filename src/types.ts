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
  apiOdo?: number;
  apiFuel?: string;
  apiFuelPercent?: number;
  apiTemp?: string;
  apiTempNum?: number;
  apiSpeed?: number;
  telemetry?: Telemetry;
}

export interface Telemetry {
  odo: number;
  fuel: string;
  fuelPercent?: number;
  temp: string;
  tempNum?: number;
  speed: number;
  lat?: number;
  lng?: number;
  status: "active" | "idle" | "moving" | "offline";
  lastUpdate: string;
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

export interface AppDataResponse {
  drivers: Driver[];
  tripStatus: Record<string, { phase: "started" | "complete"; startOdo: number; endOdo?: number | null; totalKm?: number; tripId: string }>;
  submittedIds: string[];
  targetDate: string;
  gpsboxConfig: GPSBoxConfig;
  stats: {
    totalDrivers: number;
    activeDrivers: number;
    todayStartedTrips: number;
    todayCompletedTrips: number;
  };
}

export interface GPSBoxConfig {
  url: string;
  username: string;
  apiKey: string;
  lastSync?: string;
  syncStatus: "connected" | "error" | "mock_active";
  errorMessage?: string;
}

export interface VehicleSheetData {
  organization: string;
  vehicleNumber: string;
  driverName: string;
  driverPhone: string;
  model: string;
  yearMonth: string;
  monthTotalKm: number;
  monthTotalFuel: number;
  days: {
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
  }[];
}

export interface FineRecord {
  plate: string;
  displayPlate: string;
  no: string;
  date: string;
  amount: number;
  location: string;
  violation: string;
}

export interface VehicleFineResult {
  plate: string;
  displayPlate: string;
  count: number;
  amount: number;
  status: "ТӨЛӨӨГҮЙ" | "ЦЭВЭР" | "АЛДАА";
  rows: FineRecord[];
  error?: string;
  checkedAt: string;
}

export interface BulkFinesResult {
  generatedAt: string;
  totalCars: number;
  fineCars: number;
  cleanCars: number;
  errorCars: number;
  totalFineCount: number;
  totalAmount: number;
  rows: {
    plate: string;
    displayPlate: string;
    count: number | string;
    total: number | string;
    status: string;
    error?: string;
  }[];
  fines: FineRecord[];
  error?: string;
}
