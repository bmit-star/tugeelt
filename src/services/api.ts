import { 
  AppDataResponse, 
  BulkFinesResult, 
  Driver, 
  GPSBoxConfig, 
  TripLog, 
  VehicleFineResult, 
  VehicleSheetData,
  IMDOrder,
  IMDAssignment,
  IMDRoute,
  IMDDashboardData,
  IMDMonthlyDriverKM,
  IMDExcelImportResult,
  IMDAuditLog,
  IMDDriverMonthlyProvinceStats,
  IMDOfficialLetter
} from "../types";
import { getStoredSessionToken, clearStoredSessionToken, driverLogin, managerLogin } from "./auth";

function getAuthHeaders(extraHeaders?: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(extraHeaders || {})
  };
  const token = getStoredSessionToken();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}

export async function fetchWithRetry(url: string, init?: RequestInit, retries = 2, delayMs = 500): Promise<Response> {
  try {
    const res = await fetch(url, init);
    if (res.status === 401) {
      clearStoredSessionToken();
    }
    return res;
  } catch (err: any) {
    if (retries > 0) {
      await new Promise(r => setTimeout(r, delayMs));
      return fetchWithRetry(url, init, retries - 1, delayMs * 1.5);
    }
    throw err;
  }
}

export const API = {
  driverLogin,
  managerLogin,

  async getAppData(date?: string): Promise<AppDataResponse> {
    const query = date ? `?date=${encodeURIComponent(date)}` : "";
    const res = await fetchWithRetry(`/api/app-data${query}`, {
      headers: getAuthHeaders()
    });
    if (!res.ok) throw new Error("Аппликейшны өгөгдөл татахад алдаа гарлаа");
    return res.json();
  },

  async checkVehicleFines(plate: string, force = false): Promise<VehicleFineResult> {
    const res = await fetch("/api/fines/check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plate, force }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Торгууль шалгахад алдаа гарлаа");
    return json;
  },

  async getFinesSummary(force = false): Promise<BulkFinesResult> {
    const res = await fetch(`/api/fines/summary${force ? "?force=true" : ""}`);
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Торгуулийн нэгтгэл авахад алдаа гарлаа");
    return json;
  },

  async checkBulkFines(plates?: string[], force = false): Promise<BulkFinesResult> {
    const res = await fetch("/api/fines/check-bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plates, force }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Торгууль шалгахад алдаа гарлаа");
    return json;
  },

  async startTrip(data: {
    date: string;
    driverId: string;
    driverName: string;
    vehicleNumber: string;
    salesRep: string;
    zone: string;
    startOdo: number;
    routeNote?: string;
  }): Promise<{ status: string; message: string; trip: TripLog }> {
    const res = await fetch("/api/trips/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.message || "Эхлэх ODO хадгалахад алдаа гарлаа");
    return json;
  },

  async endTrip(data: {
    date: string;
    driverId: string;
    endOdo: number;
    fuelLiters: number;
    fuelStation: string;
    fuelCost?: number;
    fuelPaymentMethod?: string;
    fuelReceiptNo?: string;
    routeNote?: string;
  }): Promise<{ status: string; message: string; trip: TripLog }> {
    const res = await fetch("/api/trips/end", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.message || "Төгсгөх ODO хадгалахад алдаа гарлаа");
    return json;
  },

  async getTrips(filters?: { date?: string; driverId?: string; zone?: string; status?: string; vehicle?: string }): Promise<{ trips: TripLog[]; total: number }> {
    const params = new URLSearchParams();
    if (filters?.date) params.append("date", filters.date);
    if (filters?.driverId) params.append("driverId", filters.driverId);
    if (filters?.zone) params.append("zone", filters.zone);
    if (filters?.status) params.append("status", filters.status);
    if (filters?.vehicle) params.append("vehicle", filters.vehicle);

    const res = await fetch(`/api/trips?${params.toString()}`);
    if (!res.ok) throw new Error("Замын хуудаснуудыг татахад алдаа гарлаа");
    return res.json();
  },

  async deleteTrip(id: string): Promise<void> {
    const res = await fetch(`/api/trips/${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error("Устгахад алдаа гарлаа");
  },

  async getDrivers(): Promise<Driver[]> {
    const res = await fetch("/api/drivers");
    if (!res.ok) throw new Error("Жолоочдын жагсаалт авахад алдаа гарлаа");
    return res.json();
  },

  async saveDriver(driver: Partial<Driver> & { isNew?: boolean }): Promise<{ status: string; driver: Driver }> {
    const isUpdating = !driver.isNew && !!driver.id;
    const url = isUpdating ? `/api/drivers/${driver.id}` : "/api/drivers";
    const method = isUpdating ? "PUT" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(driver),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Жолооч хадгалахад алдаа гарлаа");
    return json;
  },

  async deleteDriver(id: string): Promise<void> {
    const res = await fetch(`/api/drivers/${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error("Жолооч устгахад алдаа гарлаа");
  },

  async getVehicleSheet(vehicleNumber: string, month?: string): Promise<VehicleSheetData> {
    const query = month ? `?month=${month}` : "";
    const res = await fetch(`/api/vehicle-sheet/${encodeURIComponent(vehicleNumber)}${query}`);
    if (!res.ok) throw new Error("Машины замын хуудасны цахим дэвтэр авахад алдаа гарлаа");
    return res.json();
  },

  async getAllVehicleSheets(month?: string): Promise<{ sheets: VehicleSheetData[]; count: number; yearMonth: string }> {
    const query = month ? `?month=${month}` : "";
    const res = await fetch(`/api/all-vehicle-sheets${query}`);
    if (!res.ok) throw new Error("Бүх машины замын хуудас авахад алдаа гарлаа");
    return res.json();
  },

  async syncGPSBoxNow(): Promise<{ status: string; count: number; syncStatus: string; lastSync: string }> {
    const res = await fetch("/api/gpsbox/sync-now", { method: "POST" });
    if (!res.ok) throw new Error("GPSBox синхрончлол амжилтгүй боллоо");
    return res.json();
  },

  async getGPSBoxAudit(): Promise<{
    status: string;
    totalDrivers: number;
    matchedCount: number;
    totalGpsboxObjects: number;
    apiEndpoint: string;
    audit: Array<{
      driverId: string;
      driverName: string;
      vehicle: string;
      model: string;
      matched: boolean;
      gpsboxName: string;
      imei: string;
      dtTracker: string;
      speed: number;
      odometer: number;
      fuel: string;
      fuelPercent: number;
      fuelSource: string;
      temp: string;
      tempNum: number;
      tempSource: string;
      voltage?: string;
      battery?: string;
      gsmSignal?: string;
      status: string;
      rawParams: any;
    }>;
  }> {
    const res = await fetch("/api/gpsbox/audit");
    if (!res.ok) throw new Error("GPSBox бүрэн шалгалтын мэдээлэл татахад алдаа гарлаа");
    return res.json();
  },

  async saveGPSBoxConfig(config: Partial<GPSBoxConfig>): Promise<{ status: string; config: GPSBoxConfig }> {
    const res = await fetch("/api/gpsbox/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(config),
    });
    if (!res.ok) throw new Error("Тохиргоо хадгалахад алдаа гарлаа");
    return res.json();
  },

  async syncGoogleSheet(sheetUrl?: string): Promise<{ status: string; message: string; count: number; drivers: Driver[] }> {
    const res = await fetch("/api/sheet/sync-all", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sheetUrl }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Google Sheet синк хийхэд алдаа гарлаа");
    return json;
  },

  async saveWaybillDay(data: {
    driverId: string;
    vehicleNumber?: string;
    date: string;
    startOdo: number;
    endOdo?: number;
    totalKm?: number;
    fuelLiters?: number;
    fuelStation?: string;
    routeNote?: string;
    zone?: string;
    salesRep?: string;
    phase?: "started" | "complete";
  }): Promise<{ status: string; message: string; trip: TripLog }> {
    const res = await fetch("/api/waybills/save-day", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || json.message || "Өдрийн замын хуудас хадгалахад алдаа гарлаа");
    return json;
  },

  async saveWaybillMonthBatch(data: {
    driverId: string;
    vehicleNumber: string;
    month: string;
    days: Array<{
      day: number;
      date: string;
      zone: string;
      task: string;
      startOdo: number | string;
      endOdo: number | string;
      totalKm: number | string;
      fuelLiters: number | string;
      salesRep?: string;
    }>;
  }): Promise<{ status: string; message: string; count: number }> {
    const res = await fetch("/api/waybills/save-month-batch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || json.message || "Замын хуудсыг багцаар хадгалахад алдаа гарлаа");
    return json;
  },

  async autoGenerateWaybillMonth(data: {
    driverId: string;
    month: string;
    monthStartOdo?: number;
    baseDailyKm?: number;
    dailyKmMode?: "gps_api" | "route_preset" | "fixed_average";
    workDays?: "mon_sat" | "mon_fri" | "all_days";
    fuelFrequencyDays?: number;
    fuelLitersPerRefill?: number;
    fuelStation?: string;
  }): Promise<{ status: string; message: string; sheet: VehicleSheetData }> {
    const res = await fetch("/api/waybills/auto-generate-month", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || json.message || "Замын хуудас автоматаар бодож бөглөхөд алдаа гарлаа");
    return json;
  },

  async saveDriverAutoOdoConfig(driverId: string, config: any): Promise<{ status: string; driver: Driver }> {
    const res = await fetch(`/api/drivers/${driverId}/auto-odo-config`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(config),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Авто-ODO тохиргоо хадгалахад алдаа гарлаа");
    return json;
  },

  async getIMTDepotConfig(): Promise<{ status: string; config: any }> {
    const res = await fetch("/api/waybills/imt-depot-config");
    return res.json();
  },

  async getGPSDailyMileage(vehicleNumber: string, date?: string): Promise<{ status: string; data: any; message?: string }> {
    const query = date ? `?date=${encodeURIComponent(date)}` : "";
    const res = await fetch(`/api/gpsbox/daily-mileage/${encodeURIComponent(vehicleNumber)}${query}`);
    return res.json();
  },

  async registerDailyGPSMileage(data: {
    vehicleNumber: string;
    driverId?: string;
    date: string;
    totalKm: number;
    source?: "gpsbox_api" | "manual";
    note?: string;
  }): Promise<{ status: string; message: string; data: any }> {
    const res = await fetch("/api/gpsbox/daily-mileage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "GPS км бүртгэхэд алдаа гарлаа");
    return json;
  },

  async getFuelRefills(vehicleNumber: string, from?: string, to?: string): Promise<{ status: string; count: number; refills: any[] }> {
    const params = new URLSearchParams();
    if (from) params.append("from", from);
    if (to) params.append("to", to);
    const res = await fetch(`/api/fuel/refills/${encodeURIComponent(vehicleNumber)}?${params.toString()}`);
    return res.json();
  },

  async addFuelRefill(data: {
    vehicleNumber: string;
    driverId?: string;
    dateTime: string;
    liters: number;
    station?: string;
    cost?: number;
    transactionId?: string;
    fuelReceiptNo?: string;
  }): Promise<{ status: string; message: string; refill: any }> {
    const res = await fetch("/api/fuel/refills", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Түлшний цэнэглэлт бүртгэхэд алдаа гарлаа");
    return json;
  },

  async syncRealWaybillData(data: {
    driverId?: string;
    vehicleNumber?: string;
    month?: string;
  }): Promise<{ status: string; message: string; syncedDaysCount: number; sheet: VehicleSheetData }> {
    const res = await fetch("/api/waybills/sync-real-data", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Бодит GPS синк хийхэд алдаа гарлаа");
    return json;
  },

  async autoPopulateAllConfiguredWaybills(month: string): Promise<{ status: string; message: string; updatedDriversCount: number }> {
    const res = await fetch("/api/waybills/auto-populate-all-configured", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ month }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Бүх тэрэгний замын хуудсыг бодит өгөгдлөөр синк хийхэд алдаа гарлаа");
    return json;
  },

  async getWorkSchedule(): Promise<any> {
    const res = await fetch("/api/work-schedule");
    if (!res.ok) throw new Error("Албаны хуваарь авахад алдаа гарлаа");
    return res.json();
  },

  async saveWorkSchedule(config: any): Promise<{ status: string; message: string; config: any }> {
    const res = await fetch("/api/work-schedule", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(config),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Албаны хуваарь хадгалахад алдаа гарлаа");
    return json;
  },

  async backupDatabase(): Promise<any> {
    const res = await fetch("/api/backup-db");
    if (!res.ok) throw new Error("Өгөгдлийн сан татахад алдаа гарлаа");
    return res.json();
  },

  async restoreDatabase(data: any): Promise<{ status: string; message: string; stats: any }> {
    const res = await fetch("/api/restore-db", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Өгөгдлийн сан сэргээхэд алдаа гарлаа");
    return json;
  },

  // ================= IMD LOGISTICS MASTER MODULE API =================

  async getIMDOrders(filters?: { status?: string; province?: string; search?: string }): Promise<{ orders: IMDOrder[]; total: number }> {
    const params = new URLSearchParams();
    if (filters?.status) params.append("status", filters.status);
    if (filters?.province) params.append("province", filters.province);
    if (filters?.search) params.append("search", filters.search);
    const res = await fetch(`/api/imd/orders?${params.toString()}`);
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Захиалга татахад алдаа гарлаа");
    return json;
  },

  async createIMDOrder(data: Partial<IMDOrder>): Promise<{ status: string; order: IMDOrder }> {
    const res = await fetch("/api/imd/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Захиалга бүртгэхэд алдаа гарлаа");
    return json;
  },

  async updateIMDOrder(id: string, data: Partial<IMDOrder>): Promise<{ status: string; order: IMDOrder }> {
    const res = await fetch(`/api/imd/orders/${encodeURIComponent(id)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Захиалга шинэчлэхэд алдаа гарлаа");
    return json;
  },

  async deleteIMDOrder(id: string): Promise<{ status: string; message: string }> {
    const res = await fetch(`/api/imd/orders/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Захиалга устгахад алдаа гарлаа");
    return json;
  },

  async getIMDAssignments(filters?: { date?: string; driverId?: string; vehiclePlate?: string; status?: string; province?: string }): Promise<{ assignments: IMDAssignment[]; total: number }> {
    const params = new URLSearchParams();
    if (filters?.date) params.append("date", filters.date);
    if (filters?.driverId) params.append("driverId", filters.driverId);
    if (filters?.vehiclePlate) params.append("vehiclePlate", filters.vehiclePlate);
    if (filters?.status) params.append("status", filters.status);
    if (filters?.province) params.append("province", filters.province);
    const res = await fetch(`/api/imd/assignments?${params.toString()}`);
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Томилолт татахад алдаа гарлаа");
    return json;
  },

  async createIMDAssignment(data: Partial<IMDAssignment> & { force?: boolean }): Promise<{ status: string; assignment: IMDAssignment; conflictType?: string; message?: string }> {
    const res = await fetch("/api/imd/assignments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!res.ok) {
      const err: any = new Error(json.message || json.error || "Томилолт үүсгэхэд алдаа гарлаа");
      err.conflictType = json.conflictType;
      err.status = res.status;
      throw err;
    }
    return json;
  },

  async updateIMDAssignment(id: string, data: Partial<IMDAssignment>): Promise<{ status: string; assignment: IMDAssignment }> {
    const res = await fetch(`/api/imd/assignments/${encodeURIComponent(id)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Томилолт шинэчлэхэд алдаа гарлаа");
    return json;
  },

  async deleteIMDAssignment(id: string): Promise<{ status: string; message: string }> {
    const res = await fetch(`/api/imd/assignments/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Томилолт цуцлахад алдаа гарлаа");
    return json;
  },

  async confirmIMDAssignment(id: string, data?: { actualKm?: number; startOdo?: number; endOdo?: number }): Promise<{ status: string; message: string; assignment: IMDAssignment; trip: any }> {
    const res = await fetch(`/api/imd/assignments/${encodeURIComponent(id)}/confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data || {}),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Томилолт баталгаажуулахад алдаа гарлаа");
    return json;
  },

  async getIMDRoutes(): Promise<{ routes: IMDRoute[] }> {
    const res = await fetch("/api/imd/routes");
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Чиглэлийн мэдээлэл авахад алдаа гарлаа");
    return json;
  },

  async saveIMDRoute(data: Partial<IMDRoute>): Promise<{ status: string; routes: IMDRoute[] }> {
    const res = await fetch("/api/imd/routes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Чиглэл хадгалахад алдаа гарлаа");
    return json;
  },

  async getIMDDashboard(date?: string): Promise<IMDDashboardData> {
    const param = date ? `?date=${encodeURIComponent(date)}` : "";
    const res = await fetch(`/api/imd/dashboard${param}`);
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Dashboard өгөгдөл татахад алдаа гарлаа");
    return json;
  },

  async getIMDDriverKMReport(year = 2026): Promise<{ year: number; report: IMDMonthlyDriverKM[] }> {
    const res = await fetch(`/api/imd/driver-km-report?year=${year}`);
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Жолоочийн км тайлан авахад алдаа гарлаа");
    return json;
  },

  async getIMDDriverMonthlyProvinceStats(driverId: string, month?: number, year?: number): Promise<IMDDriverMonthlyProvinceStats> {
    const fallback: IMDDriverMonthlyProvinceStats = {
      driverId: driverId || "",
      driverCode: driverId || "",
      driverName: "Жолооч",
      vehiclePlate: "",
      month: `${year || 2026}-${String(month || 9).padStart(2, "0")}`,
      monthNum: month || 9,
      monthName: `${month || 9}-р сар`,
      year: year || 2026,
      totalKm: 0,
      totalTripsCount: 0,
      totalMonthlyMealAllowance: 0,
      mealTripsCount: 0,
      ratePerMeal: 25000,
      provincesCount: 0,
      provincesList: [],
      provincesSummaryStr: "",
      trips: [],
    };
    try {
      const params = new URLSearchParams();
      if (driverId) params.append("driverId", driverId);
      if (month) params.append("month", String(month));
      if (year) params.append("year", String(year));
      const res = await fetch(`/api/imd/driver-monthly-province-stats?${params.toString()}`);
      const contentType = res.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) {
        return fallback;
      }
      const json = await res.json();
      if (!res.ok) return fallback;
      return json;
    } catch {
      return fallback;
    }
  },

  async importIMDExcel(rows: any[]): Promise<IMDExcelImportResult> {
    const res = await fetch("/api/imd/import-excel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rows }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Excel импорт хийхэд алдаа гарлаа");
    return json;
  },

  async getIMDPublicOrder(token: string): Promise<any> {
    const res = await fetch(`/api/imd/public/order/${encodeURIComponent(token)}`);
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Захиалгын мэдээлэл олдсонгүй");
    return json;
  },

  async getIMDDriverTrip(token: string): Promise<any> {
    const res = await fetch(`/api/imd/driver/trip/${encodeURIComponent(token)}`);
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Томилолтын мэдээлэл олдсонгүй");
    return json;
  },

  async getIMDProvinceIceCreamReport(year = 2026, month: number | "all" = "all"): Promise<any> {
    const res = await fetch(`/api/imd/province-icecream-report?year=${year}&month=${month}`);
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Аймгийн тээвэр, зайрмагны тайлан татахад алдаа гарлаа");
    return json;
  },

  async getIMDClientPortal(): Promise<any> {
    const res = await fetchWithRetry("/api/imd/public/portal");
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Харилцагчийн порталын мэдээлэл татахад алдаа гарлаа");
    return json;
  },

  async getVehicleLocation(plate: string): Promise<any> {
    const res = await fetch(`/api/imd/public/vehicle-location/${encodeURIComponent(plate)}`);
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Машины байршил татахад алдаа гарлаа");
    return json;
  },

  async restore40Assignments(): Promise<any> {
    const res = await fetch("/api/imd/assignments/restore-40", {
      method: "POST",
      headers: { "Content-Type": "application/json" }
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Томилолт сэргээхэд алдаа гарлаа");
    return json;
  },

  async getIMDAuditLogs(): Promise<{ auditLogs: IMDAuditLog[] }> {
    const res = await fetch("/api/imd/audit-logs");
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Аудит лог авахад алдаа гарлаа");
    return json;
  },

  // ================= IMD OFFICIAL LETTERS (ALBAN BICHIG) API =================
  async getIMDOfficialLetters(): Promise<{ letters: IMDOfficialLetter[]; total: number; config: any }> {
    const res = await fetch("/api/imd/official-letters");
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Албан бичгийн жагсаалт татахад алдаа гарлаа");
    return json;
  },

  async generateIMDOfficialLetter(payload: {
    orderId?: string;
    assignmentId?: string;
    forceRegenerate?: boolean;
    googleAccessToken?: string;
  }): Promise<{
    success: boolean;
    status: string;
    letter: IMDOfficialLetter;
    fileId: string;
    fileName: string;
    fileUrl: string;
    downloadUrl: string;
  }> {
    const res = await fetch("/api/imd/official-letters/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || json.message || "Албан бичиг үүсгэхэд алдаа гарлаа");
    return json;
  },

  downloadAllMergedIMDOfficialLettersUrl: "/api/imd/official-letters/download-all-merged",

  async mergeIMDOfficialLetters(letterIds?: string[]): Promise<{
    success: boolean;
    fileName: string;
    totalMerged: number;
    base64: string;
  }> {
    const res = await fetch("/api/imd/official-letters/merge-pdf", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ letterIds: letterIds || [] })
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "PDF файлуудыг нэгтгэхэд алдаа гарлаа");
    return json;
  },

  async getIMDOfficialLetterConfig(): Promise<{ success: boolean; config: any }> {
    const res = await fetch("/api/imd/official-letters/config");
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Тохиргоо авахад алдаа гарлаа");
    return json;
  },

  async saveIMDOfficialLetterConfig(config: any): Promise<{ success: boolean; config: any }> {
    const res = await fetch("/api/imd/official-letters/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(config)
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Тохиргоо хадгалахад алдаа гарлаа");
    return json;
  },

  async deleteIMDOfficialLetter(id: string): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`/api/imd/official-letters/${encodeURIComponent(id)}`, {
      method: "DELETE"
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Албан бичиг устгахад алдаа гарлаа");
    return json;
  },

  async getIMDAppsScriptStats(): Promise<{
    success: boolean;
    stats: {
      totalRange: number;
      startRow: number;
      endRow: number;
      doneCount: number;
      pendingCount: number;
    };
  }> {
    const res = await fetch("/api/imd/official-letters/apps-script/stats");
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Статистик татахад алдаа гарлаа");
    return json;
  },

  async addNewIMDOrderFromTemplate(orderData: {
    tug1: string;
    tug2?: string;
    chiglel: string;
    size?: string;
    ognooIrsen?: string;
    ognooGarsan?: string;
  }): Promise<{
    success: boolean;
    message: string;
    order: any;
    assignment: any;
    dugaar: string;
  }> {
    const res = await fetch("/api/imd/official-letters/apps-script/new-order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(orderData)
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Шинэ захиалга үүсгэхэд алдаа гарлаа");
    return json;
  },

  async runPendingIMDGeneration(): Promise<{
    success: boolean;
    count: number;
    message: string;
    list: any[];
  }> {
    const res = await fetch("/api/imd/official-letters/apps-script/run-generation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Дараалал боловсруулахад алдаа гарлаа");
    return json;
  },

  async toggleGPSAutoFill(enabled?: boolean, driverId?: string): Promise<{ status: string; autoFillEnabled: boolean; message: string }> {
    const res = await fetch("/api/gpsbox/toggle-autofill", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled, driverId }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.message || "GPS авто бөглөлтийн төлөв өөрчлөхөд алдаа гарлаа");
    return json;
  },

  async submitManualWaybill(payload: {
    date: string;
    driverId: string;
    startOdo: number;
    endOdo: number;
    totalKm?: number;
    fuelLiters?: number;
    fuelStation?: string;
    fuelCost?: number;
    fuelPaymentMethod?: string;
    fuelReceiptNo?: string;
    routeNote?: string;
    salesRep?: string;
    zone?: string;
  }): Promise<{ status: string; message: string; trip: TripLog }> {
    const res = await fetch("/api/trips/manual-entry", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.message || "Гараар замын хуудас бүртгэхэд алдаа гарлаа");
    return json;
  },

  async clearIMDMockAssignments(all?: boolean): Promise<{ status: string; message: string; remainingAssignments: number }> {
    const res = await fetch("/api/imd/assignments/clear-mock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ all }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || json.message || "Зохиомол томилолт цэвэрлэхэд алдаа гарлаа");
    return json;
  },

  async getIMDVehicles(): Promise<{ vehicles: any[]; totalFleetCapacity: number }> {
    const res = await fetch("/api/imd/vehicles");
    if (!res.ok) throw new Error("IMD тээврийн хэрэгслүүдийн жагсаалт авахад алдаа гарлаа");
    return res.json();
  },

  async saveIMDVehicle(data: {
    plate: string;
    boxCapacity: number;
    driverName?: string;
    phone?: string;
    model?: string;
    defaultRoute?: string;
    organization?: string;
    code?: string;
  }): Promise<{ status: string; vehicle: any }> {
    const res = await fetch("/api/imd/vehicles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Машин бүртгэхэд алдаа гарлаа");
    return json;
  },

  async updateIMDVehicle(plate: string, data: any): Promise<{ status: string; driver: any }> {
    const res = await fetch(`/api/imd/vehicles/${encodeURIComponent(plate)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Машины мэдээлэл шинэчлэхэд алдаа гарлаа");
    return json;
  },

  async setDriverKmPrivacy(
    driverId: string, 
    action: "set" | "verify" | "remove", 
    pin: string,
    currentPin?: string
  ): Promise<{ success: boolean; message?: string; hasKmPin?: boolean; unlocked?: boolean }> {
    const res = await fetch(`/api/drivers/${encodeURIComponent(driverId)}/km-privacy`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ action, pin, currentPin }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Км нууцлалын үйлдэл амжилтгүй боллоо");
    return json;
  },

  // 1. Get daily assignments
  async getDailyAssignments(date: string): Promise<{
    success: boolean;
    date: string;
    isSaved: boolean;
    summary: {
      totalCount: number;
      normalCount: number;
      changedCount: number;
      imtCount: number;
      imdCount: number;
    };
    assignments: any[];
    masterDrivers: any[];
    fineConfig?: any;
  }> {
    const res = await fetchWithRetry(`/api/daily-assignments?date=${encodeURIComponent(date)}`, {
      headers: getAuthHeaders(),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Өдрийн бүртгэлийг татахад алдаа гарлаа");
    return json;
  },

  // 2. Save batch daily assignments
  async saveDailyAssignments(date: string, assignments: any[], fineConfig?: any): Promise<{
    success: boolean;
    message: string;
    savedCount: number;
    finesGeneratedCount: number;
  }> {
    const res = await fetchWithRetry("/api/daily-assignments", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeaders(),
      },
      body: JSON.stringify({ date, assignments, fineConfig }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Өдрийн бүртгэлийг хадгалахад алдаа гарлаа");
    return json;
  },

  // 3. Get comprehensive internal fines report
  async getInternalFineReport(params: {
    month?: string;
    date?: string;
    division?: string;
    driverId?: string;
    route?: string;
  }): Promise<{
    success: boolean;
    month: string;
    date?: string;
    division: string;
    summary: {
      totalFines: number;
      totalAmount: number;
      imtCount: number;
      imtAmount: number;
      imdCount: number;
      imdAmount: number;
      daysInMonth: number;
    };
    records: any[];
    monthlyMatrix: any[];
    signatureReport: any[];
  }> {
    const q = new URLSearchParams();
    if (params.month) q.append("month", params.month);
    if (params.date) q.append("date", params.date);
    if (params.division) q.append("division", params.division);
    if (params.driverId) q.append("driverId", params.driverId);
    if (params.route) q.append("route", params.route);

    const res = await fetch(`/api/fines/internal/report?${q.toString()}`, {
      headers: getAuthHeaders(),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Торгуулийн тайлан татахад алдаа гарлаа");
    return json;
  },

  // 4. Get fine config
  async getInternalFineConfig(): Promise<{ success: boolean; config: any }> {
    const res = await fetch("/api/fines/internal/config", {
      headers: getAuthHeaders(),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Торгуулийн тохиргоо авахад алдаа гарлаа");
    return json;
  },

  // 5. Update fine config
  async saveInternalFineConfig(config: any): Promise<{ success: boolean; config: any; message: string }> {
    const res = await fetch("/api/fines/internal/config", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeaders(),
      },
      body: JSON.stringify(config),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Торгуулийн тохиргоо шинэчлэхэд алдаа гарлаа");
    return json;
  },

  // 5.1 Run 23:00 Automated Daily Fine Audit (Manual trigger or check)
  async run2300FineAudit(date?: string): Promise<{
    success: boolean;
    result: {
      date: string;
      runAt: string;
      scannedVehicles: number;
      detectedViolations: number;
      newFinesCreated: number;
      details: any[];
    };
  }> {
    const res = await fetch("/api/fines/internal/run-2300-scan", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeaders(),
      },
      body: JSON.stringify({ date }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "23:00 цагийн торгуулийн шалгалт хийхэд алдаа гарлаа");
    return json;
  },

  // 5.2 Get 23:00 Audit Status
  async get2300FineAuditStatus(): Promise<{
    success: boolean;
    lastResult: any;
    lastAuditedDate: string;
    serverUbTime: string;
  }> {
    const res = await fetch("/api/fines/internal/audit-status", {
      headers: getAuthHeaders(),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Шалгалтын төлөв авахад алдаа гарлаа");
    return json;
  },

  // 6. Get monthly exception reports (Машин солисон, Жолооч солисон, Бүс гараагүй)
  async getMonthlyExceptionReport(month?: string, division?: string): Promise<{
    success: boolean;
    month: string;
    division: string;
    totalRecordedDays: number;
    totalAssignments: number;
    vehicleSwapsCount: number;
    driverSwapsCount: number;
    nonDeparturesCount: number;
    vehicleSwaps: any[];
    driverSwaps: any[];
    nonDepartures: any[];
  }> {
    const q = new URLSearchParams();
    if (month) q.append("month", month);
    if (division) q.append("division", division);
    const res = await fetchWithRetry(`/api/daily-assignments/monthly-exceptions?${q.toString()}`, {
      headers: getAuthHeaders(),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Сарын өөрчлөлтийн тайлан татахад алдаа гарлаа");
    return json;
  },

  // 7. Get real-time daily status for sales dashboard
  async getSalesDailyStatus(date?: string): Promise<{
    success: boolean;
    date: string;
    summary: {
      totalCount: number;
      driverIssues: number;
      vehicleIssues: number;
      nonDepartures: number;
      changedCount: number;
    };
    routes: any[];
  }> {
    const q = date ? `?date=${encodeURIComponent(date)}` : "";
    const res = await fetchWithRetry(`/api/sales/daily-status${q}`, {
      headers: getAuthHeaders(),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Борлуулалтын өдрийн төлөв татахад алдаа гарлаа");
    return json;
  }
};

export const api = API;
