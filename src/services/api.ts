import { AppDataResponse, BulkFinesResult, Driver, GPSBoxConfig, TripLog, VehicleFineResult, VehicleSheetData } from "../types";

export const API = {
  async getAppData(date?: string): Promise<AppDataResponse> {
    const query = date ? `?date=${encodeURIComponent(date)}` : "";
    const res = await fetch(`/api/app-data${query}`);
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
  }
};

export const api = API;
