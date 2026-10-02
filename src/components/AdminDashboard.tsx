import React, { useState, useEffect, useMemo } from "react";
import { Driver, TripLog, GPSBoxConfig, AppDataResponse, BulkFinesResult, FineRecord } from "../types";
import { API } from "../services/api";
import { BatchWaybillPrintModal } from "./BatchWaybillPrintModal";
import { WaybillEditModal } from "./WaybillEditModal";
import { DriverAutoOdoConfigModal } from "./DriverAutoOdoConfigModal";
import { WorkScheduleModal } from "./WorkScheduleModal";
import { DatabaseBackupModal } from "./DatabaseBackupModal";
import { IMDManagerView } from "./imd/IMDManagerView";
import { DailyDriverAssignmentView } from "./DailyDriverAssignmentView";
import { InternalFineReportView } from "./InternalFineReportView";
import {
  Truck,
  Fuel,
  Thermometer,
  Snowflake,
  Calendar,
  Search,
  Filter,
  Download,
  Trash2,
  RefreshCw,
  FileSpreadsheet,
  Users,
  Settings,
  Activity,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  MapPin,
  Sparkles,
  Zap,
  Gauge,
  ArrowUpDown,
  SlidersHorizontal,
  Flame,
  Printer,
  ShieldCheck,
  ShieldAlert,
  FileText,
  CreditCard,
  Database,
  Info,
  BookOpen
} from "lucide-react";

interface AdminDashboardProps {
  drivers: Driver[];
  onRefreshData: () => void;
  onOpenDriverWaybill: (driver: Driver) => void;
  onOpenVehicleSheet: (vehNumber: string) => void;
  onOpenDriverManagement: (driver?: Driver, createNew?: boolean) => void;
  onOpenGoogleSheets: () => void;
  onShowToast: (msg: string, type?: "success" | "error" | "info") => void;
  onOpenRegulation?: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  drivers,
  onRefreshData,
  onOpenDriverWaybill,
  onOpenVehicleSheet,
  onOpenDriverManagement,
  onOpenGoogleSheets,
  onShowToast,
  onOpenRegulation
}) => {
  const [activeTab, setActiveTab] = useState<"fleet" | "daily_assignment" | "internal_fines" | "masterlog" | "imd" | "gpsbox" | "fines">("fleet");
  const [appData, setAppData] = useState<AppDataResponse | null>(null);
  const [trips, setTrips] = useState<TripLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Fines Management State (erthub.mn)
  const [bulkFines, setBulkFines] = useState<BulkFinesResult | null>(null);
  const [loadingFines, setLoadingFines] = useState(false);
  const [fineFilter, setFineFilter] = useState<"all" | "fines" | "clean" | "error">("all");
  const [fineSearch, setFineSearch] = useState("");
  const [expandedFinePlate, setExpandedFinePlate] = useState<string | null>(null);

  // Filters & Sorting State
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    return new Date(today.getTime() - today.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [groupFilter, setGroupFilter] = useState<"all" | "KA" | "M">("all");
  const [tempFilter, setTempFilter] = useState<"all" | "cold" | "warning" | "warm">("all");
  const [fuelFilter, setFuelFilter] = useState<"all" | "low" | "medium" | "high">("all");
  const [sortBy, setSortBy] = useState<"default" | "temp_desc" | "temp_asc" | "fuel_asc" | "fuel_desc" | "diff_desc">("default");
  
  const [syncingSheet, setSyncingSheet] = useState(false);
  const [showBatchPrintModal, setShowBatchPrintModal] = useState(false);
  const [showWaybillEditModal, setShowWaybillEditModal] = useState(false);
  const [editWaybillDriverId, setEditWaybillDriverId] = useState<string>("");
  const [showAutoOdoConfigModal, setShowAutoOdoConfigModal] = useState(false);
  const [autoOdoDriverId, setAutoOdoDriverId] = useState<string>("");
  const [showWorkScheduleModal, setShowWorkScheduleModal] = useState(false);
  const [showDatabaseBackupModal, setShowDatabaseBackupModal] = useState(false);

  // GPSBox Config State
  const [gpsConfig, setGpsConfig] = useState<GPSBoxConfig>({
    url: "https://fms2.gpsbox.mn/",
    username: "teso",
    apiKey: "7FFA953B612BB59AB076B1C561D74BCC",
    syncStatus: "connected"
  });
  const [savingConfig, setSavingConfig] = useState(false);

  // GPSBox Full Audit State
  const [auditResult, setAuditResult] = useState<any>(null);
  const [loadingAudit, setLoadingAudit] = useState(false);
  const [auditSearch, setAuditSearch] = useState("");
  const [auditFilter, setAuditFilter] = useState<"all" | "matched" | "unmatched">("all");

  const handleRunAudit = async () => {
    setLoadingAudit(true);
    try {
      const res = await API.getGPSBoxAudit();
      setAuditResult(res);
      onShowToast(`GPSBox бүрэн аудит амжилттай: ${res.matchedCount}/${res.totalDrivers} машин холбогдсон`, "success");
    } catch (err: any) {
      onShowToast("GPSBox аудит хийхэд алдаа гарлаа: " + err.message, "error");
    } finally {
      setLoadingAudit(false);
    }
  };

  const [togglingAutoFill, setTogglingAutoFill] = useState(false);

  const handleToggleGPSAutoFill = async () => {
    if (togglingAutoFill) return;
    setTogglingAutoFill(true);
    try {
      const nextState = !(gpsConfig.autoFillEnabled !== false);
      const res = await API.toggleGPSAutoFill(nextState);
      setGpsConfig(prev => ({ ...prev, autoFillEnabled: res.autoFillEnabled }));
      onShowToast(res.message, res.autoFillEnabled ? "success" : "info");
      onRefreshData();
    } catch (err: any) {
      onShowToast(err.message || "GPS авто бөглөлтийн төлөв өөрчлөхөд алдаа гарлаа", "error");
    } finally {
      setTogglingAutoFill(false);
    }
  };

  const handleLoadFines = async (force = false) => {
    setLoadingFines(true);
    try {
      const res = await API.getFinesSummary(force);
      setBulkFines(res);
      if (force) {
        onShowToast(`Торгууль амжилттай шинэчлэгдлээ: ${res.fineCars} машин торгуультай, нийт ${res.totalAmount.toLocaleString()}₮`, "success");
      }
    } catch (err: any) {
      onShowToast("Торгуулийн нэгтгэл татахад алдаа гарлаа: " + err.message, "error");
    } finally {
      setLoadingFines(false);
    }
  };

  useEffect(() => {
    if (activeTab === "fines" && !bulkFines && !loadingFines) {
      handleLoadFines(false);
    }
  }, [activeTab]);

  const loadData = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const [appDataRes, tripsRes, configRes] = await Promise.all([
        API.getAppData(selectedDate),
        API.getTrips({ date: selectedDate }),
        API.saveGPSBoxConfig({}) // fetch config
      ]);
      setAppData(appDataRes);
      setTrips(tripsRes.trips);
      if (configRes.config) setGpsConfig(configRes.config);
    } catch (err: any) {
      console.error(err);
    } finally {
      if (showLoading) setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
    const timer = setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        loadData(false);
      }
    }, 60000); // 60s live refresh (prevents 429 Rate Limit)
    return () => clearInterval(timer);
  }, [selectedDate]);

  const handleManualSync = async () => {
    setRefreshing(true);
    try {
      const res = await API.syncGPSBoxNow();
      await loadData(false);
      onRefreshData();
      onShowToast(`GPSBox-с ${res.count} машины мэдээлэл амжилттай шинэчлэгдлээ!`, "success");
    } catch (err: any) {
      onShowToast("GPSBox холболтын алдаа гарлаа", "error");
    } finally {
      setRefreshing(false);
    }
  };

  const handleSyncGoogleSheet = async () => {
    setSyncingSheet(true);
    try {
      const res = await API.syncGoogleSheet();
      await loadData(false);
      onRefreshData();
      onShowToast(res.message || "Google Sheet-с 30 жолоочийн мэдээлэл амжилттай шинэчлэгдлээ!", "success");
    } catch (err: any) {
      onShowToast("Google Sheet синк хийхэд алдаа гарлаа", "error");
    } finally {
      setSyncingSheet(false);
    }
  };

  const handleExportWaybillsCsv = async () => {
    try {
      onShowToast("Бүх жолоочийн замын хуудсыг CSV хэлбэрээр бэлтгэж байна...", "info");
      const currentMonth = new Date().toISOString().slice(0, 7);
      const res = await API.getAllVehicleSheets(currentMonth);
      const sheets = res.sheets || [];

      if (sheets.length === 0) {
        onShowToast("Экспортлох замын хуудас олдсонгүй", "info");
        return;
      }

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

      sheets.forEach((sheet) => {
        const code = (sheet as any).driverCode || (sheet as any).id || sheet.vehicleNumber;
        const phone = (sheet as any).driverPhone || "";
        const model = sheet.model || "";
        const route = (sheet as any).defaultRoute || "";

        sheet.days.forEach((d) => {
          rows.push([
            `"${code}"`,
            `"${sheet.vehicleNumber}"`,
            `"${model}"`,
            `"${sheet.driverName}"`,
            `"${phone}"`,
            `"${d.salesRep || sheet.days[0]?.salesRep || ""}"`,
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

      const csvContent = "\uFEFF" + [headers.join(","), ...rows.map((e) => e.join(","))].join("\r\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `Zamiin_Huudas_${currentMonth}_All_${sheets.length}_Mashin.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      onShowToast(`Нийт ${sheets.length} машины замын хуудас цэвэр CSV-ээр амжилттай татагдлаа!`, "success");
    } catch (err: any) {
      onShowToast("CSV татахад алдаа гарлаа", "error");
    }
  };

  const handleDeleteTrip = async (id: string) => {
    if (!confirm("Энэ замын хуудсыг MasterLog-с устгах уу?")) return;
    try {
      await API.deleteTrip(id);
      onShowToast("Замын хуудас устгагдлаа", "success");
      loadData(false);
      onRefreshData();
    } catch (err: any) {
      onShowToast("Устгахад алдаа гарлаа", "error");
    }
  };

  const handleExportMasterLog = () => {
    if (!trips.length) {
      onShowToast("Экспортлох бүртгэл олдсонгүй", "info");
      return;
    }

    const headers = [
      "ID",
      "Огноо",
      "Жолооч ID",
      "Жолоочийн нэр",
      "Машины дугаар",
      "Борлуулалтын төлөөлөгч",
      "Бүс",
      "Эхлэх ODO",
      "Төгсгөх ODO",
      "Нийт км",
      "Түлш (л)",
      "Түлшний үнэ (₮)",
      "Төлбөрийн хэлбэр",
      "Чек/Баримт",
      "ШТС",
      "Төлөв"
    ];

    const rows = trips.map((t) => [
      t.id,
      t.date,
      t.driverId,
      `"${t.driverName}"`,
      `"${t.vehicleNumber}"`,
      `"${t.salesRep}"`,
      `"${t.zone}"`,
      t.startOdo,
      t.endOdo || "",
      t.totalKm || (t.endOdo ? t.endOdo - t.startOdo : 0),
      t.fuelLiters || 0,
      t.fuelCost || 0,
      `"${t.fuelPaymentMethod || ""}"`,
      `"${t.fuelReceiptNo || ""}"`,
      `"${t.fuelStation || ""}"`,
      `"${t.status}"`
    ]);

    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `MasterLog_${selectedDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    onShowToast("MasterLog CSV амжилттай татагдлаа", "success");
  };

  const handleSaveGpsConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingConfig(true);
    try {
      const res = await API.saveGPSBoxConfig(gpsConfig);
      onShowToast("GPSBox FMS2 тохиргоо амжилттай хадгалагдлаа", "success");
      setGpsConfig(res.config);
      handleManualSync();
    } catch (err: any) {
      onShowToast("Тохиргоо хадгалахад алдаа гарлаа", "error");
    } finally {
      setSavingConfig(false);
    }
  };

  // Extract numeric temp and fuel helper
  const getTempNum = (driver: any) => {
    if (driver.apiTempNum !== undefined && !isNaN(driver.apiTempNum)) return driver.apiTempNum;
    if (driver.telemetry?.tempNum !== undefined && !isNaN(driver.telemetry.tempNum)) return driver.telemetry.tempNum;
    const str = driver.apiTemp || driver.telemetry?.temp || "";
    const parsed = parseFloat(String(str).replace(/[^0-9.-]/g, ""));
    return isNaN(parsed) ? -20.0 : parsed;
  };

  const getFuelNum = (driver: any) => {
    if (driver.apiFuelNum !== undefined && !isNaN(driver.apiFuelNum)) return Number(driver.apiFuelNum);
    if (driver.telemetry?.fuelNum !== undefined && !isNaN(driver.telemetry.fuelNum)) return Number(driver.telemetry.fuelNum);
    const str = driver.apiFuel || driver.telemetry?.fuel || "";
    const parsed = parseFloat(String(str).replace(/[^0-9.-]/g, ""));
    return isNaN(parsed) ? 0 : parsed;
  };

  // Filtered and Sorted drivers
  const filteredDrivers = useMemo(() => {
    const rawList = appData?.drivers || drivers || [];
    
    let result = rawList.filter((d) => {
      const matchSearch =
        d.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        d.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        d.vehicle.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (d.salesRep && d.salesRep.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (d.defaultRoute && d.defaultRoute.toLowerCase().includes(searchTerm.toLowerCase()));

      const cleanId = (d.id || "").toUpperCase();
      const matchGroup =
        groupFilter === "all" ||
        (groupFilter === "KA" && cleanId.startsWith("KA")) ||
        (groupFilter === "M" && cleanId.startsWith("M"));

      if (!matchSearch || !matchGroup) return false;

      // Status filter
      const trip = appData?.tripStatus?.[d.id] || appData?.tripStatus?.[d.code];
      if (statusFilter === "started" && trip?.phase !== "started") return false;
      if (statusFilter === "complete" && trip?.phase !== "complete") return false;
      if (statusFilter === "not_started" && !!trip) return false;

      // Temperature filter
      const tNum = getTempNum(d);
      if (tempFilter === "cold" && tNum > -18) return false;
      if (tempFilter === "warning" && (tNum <= -18 || tNum > -15)) return false;
      if (tempFilter === "warm" && tNum <= -15) return false;

      // Fuel filter
      const fNum = getFuelNum(d);
      if (fuelFilter === "low" && fNum >= 25) return false;
      if (fuelFilter === "medium" && (fNum < 25 || fNum > 50)) return false;
      if (fuelFilter === "high" && fNum <= 50) return false;

      return true;
    });

    // Sorting
    result.sort((a, b) => {
      if (sortBy === "temp_desc") {
        return getTempNum(b) - getTempNum(a); // Warmest / Dangerous first
      }
      if (sortBy === "temp_asc") {
        return getTempNum(a) - getTempNum(b); // Coldest first
      }
      if (sortBy === "fuel_asc") {
        return getFuelNum(a) - getFuelNum(b); // Lowest fuel first
      }
      if (sortBy === "fuel_desc") {
        return getFuelNum(b) - getFuelNum(a); // Highest fuel first
      }
      if (sortBy === "diff_desc") {
        const tripA = appData?.tripStatus?.[a.id] || appData?.tripStatus?.[a.code];
        const tripB = appData?.tripStatus?.[b.id] || appData?.tripStatus?.[b.code];
        const diffA = tripA?.endOdo ? Math.abs((a.apiOdo || 0) - Number(tripA.endOdo)) : 0;
        const diffB = tripB?.endOdo ? Math.abs((b.apiOdo || 0) - Number(tripB.endOdo)) : 0;
        return diffB - diffA;
      }
      // Default: By ID/Code natural sort
      return a.id.localeCompare(b.id, undefined, { numeric: true, sensitivity: "base" });
    });

    return result;
  }, [appData, drivers, searchTerm, statusFilter, groupFilter, tempFilter, fuelFilter, sortBy]);

  // Quick statistics counts
  const stats = useMemo(() => {
    const list = appData?.drivers || drivers || [];
    let dangerTempCount = 0;
    let lowFuelCount = 0;
    list.forEach(d => {
      if (getTempNum(d) > -15) dangerTempCount++;
      if (getFuelNum(d) < 25) lowFuelCount++;
    });
    return { dangerTempCount, lowFuelCount };
  }, [appData, drivers]);

  return (
    <div className="w-full max-w-7xl mx-auto px-3 sm:px-6 py-4 space-y-5 print:p-0 print:m-0 print:max-w-none">
      <div className="space-y-5 print:hidden">
      
      {/* Management Toolbar (Minimal, tidy & mobile-optimized) */}
      <section id="manager-toolbar-section" className="bg-slate-900 border border-slate-800 rounded-2xl p-3 sm:p-4 text-white shadow-sm">
        {/* Row 1: Primary Actions */}
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
            {/* 1. GPS Sync */}
            <button
              onClick={handleManualSync}
              disabled={refreshing}
              className="flex-1 sm:flex-initial h-10 px-3.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-black flex items-center justify-center gap-2 transition-all shadow-sm active:scale-95 disabled:opacity-50 cursor-pointer"
              title="GPSBox сүүлийн заалтуудыг шууд татах"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
              <span>{refreshing ? "Татаж байна..." : "GPS Татах"}</span>
            </button>

            {/* 2. GPS Auto-Fill Toggle */}
            <button
              onClick={handleToggleGPSAutoFill}
              disabled={togglingAutoFill}
              className={`h-10 px-3.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all border cursor-pointer active:scale-95 disabled:opacity-60 shadow-sm ${
                gpsConfig.autoFillEnabled !== false
                  ? "bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700"
                  : "bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border-amber-500/40"
              }`}
              title="Замын хуудас : Гараар / Асаалттай горимыг бүх замын хуудсанд нэгэн зэрэг үйлчлүүлэх"
            >
              {togglingAutoFill ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-slate-300" />
              ) : (
                <span className={`w-2 h-2 rounded-full ${gpsConfig.autoFillEnabled !== false ? "bg-emerald-400 animate-pulse" : "bg-amber-400"}`} />
              )}
              <Gauge className="w-3.5 h-3.5 text-slate-300" />
              <span>Замын хуудас :</span>
              <span className={`font-black ${gpsConfig.autoFillEnabled !== false ? "text-emerald-300" : "text-amber-300"}`}>
                {togglingAutoFill ? "Хадгалж байна..." : (gpsConfig.autoFillEnabled !== false ? "Асаалттай" : "Гараар")}
              </span>
            </button>

            {/* 3. Add Driver */}
            <button
              onClick={() => onOpenDriverManagement(undefined, true)}
              className="h-10 px-3.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 text-xs font-bold flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer"
              title="Шинэ жолооч, машин бүртгэх"
            >
              <Users className="w-3.5 h-3.5 text-emerald-400" />
              <span>+ Шинэ жолооч</span>
            </button>
          </div>

          {/* Quick status count pill on desktop */}
          <div className="hidden lg:flex items-center gap-2 text-xs text-slate-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span>Нийт <strong>{drivers.length || appData?.drivers.length || 0}</strong> тээврийн хэрэгсэл хянагдаж байна</span>
          </div>
        </div>

        {/* Row 2: Secondary Tools (Clean, minimal, 2-col/3-col on mobile, flex on desktop) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:flex md:flex-wrap md:items-center gap-2 mt-3 pt-3 border-t border-slate-800/80">
          <button
            onClick={() => {
              setEditWaybillDriverId(drivers[0]?.id || "");
              setShowWaybillEditModal(true);
            }}
            className="h-9 px-2.5 sm:px-3 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/60 text-slate-200 text-xs font-semibold flex items-center gap-2 transition-all active:scale-95 cursor-pointer truncate"
            title="Жолоочийн сарын замын хуудасны өдрийн заалтуудыг засах, нөхөн бичих"
          >
            <FileText className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span className="truncate">Замын хуудас засах</span>
          </button>

          <button
            onClick={() => {
              setAutoOdoDriverId(drivers[0]?.id || "");
              setShowAutoOdoConfigModal(true);
            }}
            className="h-9 px-2.5 sm:px-3 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/60 text-slate-200 text-xs font-semibold flex items-center gap-2 transition-all active:scale-95 cursor-pointer truncate"
            title="Жолооч бүрийн сарын эхний заалт, өдрийн км, ODO автомат байршуулалтыг тохируулах"
          >
            <Sparkles className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
            <span className="truncate">Авто-ODO тохиргоо</span>
          </button>

          <button
            onClick={() => setShowBatchPrintModal(true)}
            className="h-9 px-2.5 sm:px-3 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/60 text-slate-200 text-xs font-semibold flex items-center gap-2 transition-all active:scale-95 cursor-pointer truncate"
            title="Бүх 30 машины замын хуудсыг A4 хөндлөн форматаар 1 даралтаар хэвлэх"
          >
            <Printer className="w-3.5 h-3.5 text-sky-400 shrink-0" />
            <span className="truncate">Хэвлэх (A4)</span>
          </button>

          <button
            onClick={() => setShowWorkScheduleModal(true)}
            className="h-9 px-2.5 sm:px-3 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/60 text-slate-200 text-xs font-semibold flex items-center gap-2 transition-all active:scale-95 cursor-pointer truncate"
            title="Ажлын болон амралтын хуваарь тохируулах"
          >
            <Calendar className="w-3.5 h-3.5 text-amber-300 shrink-0" />
            <span className="truncate">Цагийн хуваарь</span>
          </button>

          <button
            onClick={() => onOpenDriverManagement(undefined, false)}
            className="h-9 px-2.5 sm:px-3 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/60 text-slate-200 text-xs font-semibold flex items-center gap-2 transition-all active:scale-95 cursor-pointer truncate"
            title="Бүх жолооч, машин тохируулах"
          >
            <Users className="w-3.5 h-3.5 text-slate-300 shrink-0" />
            <span className="truncate">Жолооч & Машин ({drivers.length || appData?.drivers.length || 0})</span>
          </button>

          {onOpenRegulation && (
            <button
              onClick={onOpenRegulation}
              className="h-9 px-2.5 sm:px-3 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/40 text-amber-200 text-xs font-black flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer truncate shadow-xs"
              title="Авто тээвэр, түгээлтийн үйл ажиллагааны журам (Хавсралт №3) нээх"
            >
              <BookOpen className="w-3.5 h-3.5 text-amber-300 shrink-0" />
              <span className="font-mono truncate font-extrabold tracking-wider">//журам//</span>
            </button>
          )}

          <button
            onClick={onOpenGoogleSheets}
            className="h-9 px-2.5 sm:px-3 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/60 text-slate-200 text-xs font-semibold flex items-center gap-2 transition-all active:scale-95 cursor-pointer truncate"
            title="Google Sheets холболт & шууд синхрончлол"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span className="truncate">Google Sheets</span>
          </button>

          <button
            onClick={handleExportWaybillsCsv}
            className="h-9 px-2.5 sm:px-3 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/60 text-slate-200 text-xs font-semibold flex items-center gap-2 transition-all active:scale-95 cursor-pointer truncate"
            title="Бүх замын хуудсыг CSV форматаар татах"
          >
            <Download className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span className="truncate">CSV татах</span>
          </button>

          <button
            onClick={() => setShowDatabaseBackupModal(true)}
            className="h-9 px-2.5 sm:px-3 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/60 text-slate-200 text-xs font-semibold flex items-center gap-2 transition-all active:scale-95 cursor-pointer truncate"
            title="Өгөгдөл нөөцлөлт & хамгаалалт"
          >
            <Database className="w-3.5 h-3.5 text-teal-400 shrink-0" />
            <span className="truncate">Өгөгдөл нөөц</span>
          </button>

          <a
            href="/sales"
            target="_blank"
            rel="noopener noreferrer"
            className="h-9 px-2.5 sm:px-3 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/60 text-slate-200 text-xs font-semibold flex items-center gap-2 transition-all active:scale-95 cursor-pointer truncate"
            title="Борлуулалтын албаны дашборд руу шилжих (/sales)"
          >
            <ExternalLink className="w-3.5 h-3.5 text-purple-300 shrink-0" />
            <span className="truncate">Борлуулалт (/sales)</span>
          </a>
        </div>
      </section>

      {/* Metric Cards Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-bold uppercase">Нийт машин / Жолооч</span>
            <Truck className="w-4 h-4 text-[#0878bd]" />
          </div>
          <div className="text-2xl font-black text-[#123047]">
            {appData?.stats?.totalDrivers || drivers.length || 0}
          </div>
          <span className="text-[11px] text-emerald-600 font-semibold">
            ● {appData?.stats?.activeDrivers || drivers.length || 0} ажиллаж байна
          </span>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-bold uppercase">Өнөөдөр эхэлсэн</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-black text-amber-700">
            {appData?.stats?.todayStartedTrips || 0}
          </div>
          <span className="text-[11px] text-slate-500 font-medium">
            Замд явж байгаа замын хуудас
          </span>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-bold uppercase">Дууссан (Хаасан)</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-black text-emerald-700">
            {appData?.stats?.todayCompletedTrips || 0}
          </div>
          <span className="text-[11px] text-emerald-600 font-semibold">
            Баталгаажсан хуудас
          </span>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-bold uppercase">Шуурхай анхааруулга</span>
            <AlertTriangle className="w-4 h-4 text-rose-500" />
          </div>
          <div className="flex items-center gap-3 mt-1">
            <div className="flex items-center gap-1 text-xs font-bold text-rose-600">
              <Thermometer className="w-3.5 h-3.5" />
              <span>{stats.dangerTempCount} дулаарсан</span>
            </div>
            <div className="flex items-center gap-1 text-xs font-bold text-amber-600">
              <Fuel className="w-3.5 h-3.5" />
              <span>{stats.lowFuelCount} бага түлштэй</span>
            </div>
          </div>
          <span className="text-[10px] text-slate-400 mt-1 block">
            Шүүлтүүрээр шууд ялгаж харах боломжтой
          </span>
        </div>
      </div>

      {/* Tabs Bar */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab("fleet")}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-black transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
            activeTab === "fleet"
              ? "bg-[#0878bd] text-white shadow-sm"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          <Truck className="w-4 h-4" />
          <span>Бүх машин & GPS</span>
        </button>

        <button
          onClick={() => setActiveTab("daily_assignment")}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-black transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
            activeTab === "daily_assignment"
              ? "bg-[#0878bd] text-white shadow-sm"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Өдрийн жолоочийн бүртгэл</span>
          <span className="px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-900 text-[10px] font-black">
            Өдөр тутмын
          </span>
        </button>

        <button
          onClick={() => setActiveTab("internal_fines")}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-black transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
            activeTab === "internal_fines"
              ? "bg-[#0878bd] text-white shadow-sm"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span>Торгуулийн тайлан (IMT/IMD)</span>
          <span className="px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-900 text-[10px] font-black">
            Matrix
          </span>
        </button>

        <button
          onClick={() => setActiveTab("masterlog")}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-black transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
            activeTab === "masterlog"
              ? "bg-[#0878bd] text-white shadow-sm"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span>MasterLog</span>
        </button>

        <button
          onClick={() => setActiveTab("imd")}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-black transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
            activeTab === "imd"
              ? "bg-[#0878bd] text-white shadow-sm"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          <Sparkles className="w-4 h-4 text-blue-300" />
          <span>IMD Удирдлага</span>
          <span className="px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-900 text-[10px] font-black">
            Нэгдсэн
          </span>
        </button>

        <button
          onClick={() => setActiveTab("gpsbox")}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-black transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
            activeTab === "gpsbox"
              ? "bg-[#0878bd] text-white shadow-sm"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          <Settings className="w-4 h-4" />
          <span>GPSBox API</span>
        </button>

        <button
          onClick={() => setActiveTab("fines")}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-black transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
            activeTab === "fines"
              ? "bg-[#0878bd] text-white shadow-sm"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          <ShieldAlert className="w-4 h-4" />
          <span>Замын цагдаа торгууль</span>
          {bulkFines && bulkFines.fineCars > 0 && (
            <span className="px-1.5 py-0.5 rounded-full bg-rose-500 text-white text-[10px] font-black animate-pulse">
              {bulkFines.fineCars}
            </span>
          )}
        </button>
      </div>

      {/* TAB 1: FLEET REALTIME MONITOR */}
      {activeTab === "fleet" && (
        <div className="space-y-3.5">
          {/* Enhanced Search & Multi-Filter Toolbar */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs space-y-3">
            
            {/* Top row: Search, Status, Group, Date */}
            <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-2.5">
              <div className="flex flex-wrap items-center gap-2 flex-1">
                {/* Search Box */}
                <div className="relative flex-1 min-w-[200px] sm:min-w-[240px]">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Жолооч, машин (2611 УЕВ), код (M16, KA1)..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-3.5 py-2 rounded-xl border border-slate-300 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#0878bd]"
                  />
                </div>

                {/* Status Filter */}
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="py-2 px-3 rounded-xl border border-slate-300 text-xs sm:text-sm font-semibold bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0878bd]"
                >
                  <option value="all">Бүх төлөв ({appData?.drivers.length || drivers.length})</option>
                  <option value="started">🟡 Замд яваа</option>
                  <option value="complete">✅ Дууссан (Хаасан)</option>
                  <option value="not_started">⚪ Эхлээгүй</option>
                </select>

                {/* Group Filter (All / KA / M) */}
                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setGroupFilter("all")}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                      groupFilter === "all"
                        ? "bg-white text-[#123047] shadow-xs"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    Бүгд (30)
                  </button>
                  <button
                    type="button"
                    onClick={() => setGroupFilter("KA")}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                      groupFilter === "KA"
                        ? "bg-[#0878bd] text-white shadow-xs"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    KA бүс (5)
                  </button>
                  <button
                    type="button"
                    onClick={() => setGroupFilter("M")}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                      groupFilter === "M"
                        ? "bg-[#0878bd] text-white shadow-xs"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    M бүс (25)
                  </button>
                </div>
              </div>

              {/* Date Selector */}
              <div className="flex items-center gap-2 justify-end">
                <span className="text-xs text-slate-500 font-bold">Огноо:</span>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="py-1.5 px-3 rounded-xl border border-slate-300 text-xs sm:text-sm font-bold bg-slate-50 text-slate-800 focus:bg-white"
                />
              </div>
            </div>

            {/* Second row: Deep Freeze Temp Filter, Fuel Filter, and Sorting */}
            <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2.5">
              
              {/* Filter Controls (Temp & Fuel) */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  <SlidersHorizontal className="w-3 h-3" /> Шүүлтүүр:
                </span>

                {/* Temp Filter */}
                <div className="flex items-center gap-1 bg-sky-50/70 border border-sky-100 rounded-xl p-1">
                  <Snowflake className="w-3.5 h-3.5 text-[#0878bd] ml-1.5" />
                  <select
                    value={tempFilter}
                    onChange={(e) => setTempFilter(e.target.value as any)}
                    className="text-xs font-bold bg-transparent text-slate-800 pr-2 py-0.5 focus:outline-none cursor-pointer"
                  >
                    <option value="all">❄️ Бүх хөлдөөгч темп</option>
                    <option value="cold">❄️ Гүн хөлдөлт хэвийн (≤ -18°C)</option>
                    <option value="warning">⚠️ Хөргөлт суларсан (-15°C ~ -18°C)</option>
                    <option value="warm">🚨 Аюултай / Дулаарсан (&gt; -15°C)</option>
                  </select>
                </div>

                {/* Fuel Filter */}
                <div className="flex items-center gap-1 bg-amber-50/70 border border-amber-100 rounded-xl p-1">
                  <Fuel className="w-3.5 h-3.5 text-amber-600 ml-1.5" />
                  <select
                    value={fuelFilter}
                    onChange={(e) => setFuelFilter(e.target.value as any)}
                    className="text-xs font-bold bg-transparent text-slate-800 pr-2 py-0.5 focus:outline-none cursor-pointer"
                  >
                    <option value="all">⛽ Бүх түлшний түвшин</option>
                    <option value="low">⛽ Бага түлш (&lt; 25 л)</option>
                    <option value="medium">⛽ Дундаж түлш (25 - 50 л)</option>
                    <option value="high">⛽ Хангалттай түлш (&gt; 50 л)</option>
                  </select>
                </div>

                {/* Quick reset button */}
                {(tempFilter !== "all" || fuelFilter !== "all" || statusFilter !== "all" || groupFilter !== "all" || searchTerm) && (
                  <button
                    onClick={() => {
                      setTempFilter("all");
                      setFuelFilter("all");
                      setStatusFilter("all");
                      setGroupFilter("all");
                      setSearchTerm("");
                      setSortBy("default");
                    }}
                    className="text-[11px] font-bold text-slate-500 hover:text-rose-600 px-2 py-1 rounded-lg hover:bg-slate-100 transition-colors"
                  >
                    ✕ Цэвэрлэх
                  </button>
                )}
              </div>

              {/* Sorting Selection (Requested: хамгийн бага түлштэй машин, темпратур эхэнд гэх мэт) */}
              <div className="flex items-center gap-1.5 ml-auto">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  <ArrowUpDown className="w-3 h-3" /> Эрэмбэлэх:
                </span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="py-1.5 px-3 rounded-xl border border-slate-300 text-xs font-black bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0878bd] cursor-pointer"
                >
                  <option value="default">📋 Кодоор (M1... KA1...)</option>
                  <option value="fuel_asc">⛽ Түлш: Хамгийн бага түлштэй машин эхэндээ</option>
                  <option value="fuel_desc">⛽ Түлш: Хамгийн их түлштэй машин эхэндээ</option>
                  <option value="temp_desc">🌡️ Хөлдөөгч: Хамгийн дулаан (Аюултай) эхэндээ</option>
                  <option value="temp_asc">❄️ Хөлдөөгч: Хамгийн хүйтэн (Гүн хөлдөлттэй) эхэндээ</option>
                  <option value="diff_desc">⚠️ ODO: Зөрүү ихтэй нь эхэндээ</option>
                </select>
              </div>
            </div>

            {/* Quick Status Bar */}
            <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
              <span>
                Нийт <strong className="text-slate-900">{filteredDrivers.length}</strong> машин харагдаж байна
              </span>
              {filteredDrivers.length === 0 && (
                <span className="text-rose-600 font-bold">Таны сонгосон шүүлтүүрт тохирох машин олдсонгүй</span>
              )}
            </div>
          </div>

          {/* Vehicle Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {filteredDrivers.map((driver) => {
              const trip = appData?.tripStatus?.[driver.id] || appData?.tripStatus?.[driver.code];
              const isStarted = trip?.phase === "started";
              const isComplete = trip?.phase === "complete";
              const tele = driver.telemetry;

              // Odometer Comparison Logic
              const hasDriverOdo = (isComplete && trip?.endOdo != null) || (isStarted && trip?.startOdo != null);
              const driverOdoVal = isComplete ? (trip?.endOdo ?? 0) : (trip?.startOdo ?? 0);
              const apiOdoVal = driver.apiOdo || 0;
              const odoDiff = hasDriverOdo && apiOdoVal > 0 ? (apiOdoVal - driverOdoVal) : null;

              // Temp evaluation
              const tNum = getTempNum(driver);
              const isOptimal = tNum <= -18;
              const isWarning = tNum > -18 && tNum <= -15;

              // Fuel evaluation
              const fNum = getFuelNum(driver);
              const isLowFuel = fNum < 25;

              return (
                <div
                  key={driver.id}
                  className="bg-white rounded-2xl border border-slate-200/90 shadow-sm hover:shadow-md transition-all p-4 flex flex-col justify-between"
                >
                  <div>
                    {/* Card Header */}
                    <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-slate-100">
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-1 rounded-lg bg-[#0878bd]/10 text-[#0878bd] font-black text-xs">
                          {driver.code || driver.id}
                        </span>
                        <div>
                          <h3 className="text-sm font-black text-slate-900 truncate">
                            {driver.name}
                          </h3>
                          <span className="text-[11px] text-slate-500">
                            {driver.phone || "Утасгүй"}
                          </span>
                        </div>
                      </div>

                      {/* Status Badge */}
                      {isComplete ? (
                        <span className="px-2.5 py-1 rounded-full text-[11px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          Дууссан
                        </span>
                      ) : isStarted ? (
                        <span className="px-2.5 py-1 rounded-full text-[11px] font-black bg-amber-100 text-amber-800 border border-amber-200 flex items-center gap-1">
                          <Clock className="w-3 h-3 animate-spin" />
                          Замд яваа
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-slate-600">
                          Эхлээгүй
                        </span>
                      )}
                    </div>

                    {/* Vehicle & Rep Info */}
                    <div className="mt-3 space-y-1.5 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">Тээврийн хэрэгсэл:</span>
                        <span className="font-bold text-slate-900 font-mono">
                          {driver.vehicle} ({driver.model})
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">Худалдааны төлөөлөгч:</span>
                        <span className="font-semibold text-slate-800">
                          {driver.salesRep || "Тодорхойгүй"}
                        </span>
                      </div>
                      {driver.defaultRoute && (
                        <div className="text-[11px] text-slate-500 bg-slate-50 p-1.5 rounded-lg border border-slate-100 truncate" title={driver.defaultRoute}>
                          <span className="font-bold text-slate-600">Маршрут:</span> {driver.defaultRoute}
                        </div>
                      )}
                    </div>

                    {/* Live Telematics (Fuel, Freezer Temp, Speed) */}
                    <div className="mt-3.5 bg-slate-50/70 rounded-xl p-2.5 border border-slate-200/80 space-y-2">
                      <div className="text-[10px] font-black uppercase text-slate-400 tracking-wider flex items-center justify-between">
                        <span className="flex items-center gap-1">
                          <Activity className="w-3 h-3 text-[#0878bd]" />
                          <span>GPSBox Шууд Телематик</span>
                        </span>
                        <span className="text-[9px] text-slate-400 font-mono">
                          {tele?.lastUpdate || (driver as any)?.apiLastUpdate || "Шууд"}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs">
                        {/* Fuel Widget */}
                        <div className={`p-2 rounded-lg border ${
                          isLowFuel ? "bg-amber-50 border-amber-200" : "bg-white border-slate-200/80"
                        }`}>
                          <div className="flex items-center justify-between text-[10px] text-slate-500 font-bold uppercase">
                            <span className="flex items-center gap-1">
                              <Fuel className={`w-3 h-3 ${isLowFuel ? "text-amber-600" : "text-[#0878bd]"}`} />
                              <span>Түлш:</span>
                            </span>
                            {isLowFuel && (
                              <span className="text-[9px] font-black text-amber-700 bg-amber-100 px-1 rounded">
                                Бага!
                              </span>
                            )}
                          </div>
                          <div className="flex items-baseline justify-between mt-0.5">
                            <span className={`font-black text-xs sm:text-sm ${isLowFuel ? "text-amber-800 font-black" : "text-[#0878bd]"}`}>
                              {driver.apiFuel || `${fNum.toFixed(1)} л`}
                            </span>
                            <span className="text-[9px] text-slate-400 font-mono">
                              {driver.apiFuelPercent ? `${driver.apiFuelPercent}%` : ""}
                            </span>
                          </div>
                        </div>

                        {/* Ice Cream Deep Freeze Widget */}
                        <div className={`p-2 rounded-lg border ${
                          isOptimal 
                            ? "bg-cyan-50/50 border-cyan-200/80" 
                            : isWarning 
                            ? "bg-amber-50/50 border-amber-200" 
                            : "bg-rose-50/60 border-rose-200"
                        }`}>
                          <span className="text-[10px] text-slate-500 uppercase font-bold flex items-center justify-between">
                            <span className="flex items-center gap-1">
                              <Snowflake className={`w-3 h-3 ${isOptimal ? "text-cyan-600" : isWarning ? "text-amber-600" : "text-rose-600"}`} />
                              <span>Хөлдөөгч:</span>
                            </span>
                            <span className={`text-[9px] font-bold ${isOptimal ? "text-cyan-700" : isWarning ? "text-amber-700" : "text-rose-600"}`}>
                              {isOptimal ? "Хэвийн" : isWarning ? "Анхаар" : "Аюултай"}
                            </span>
                          </span>
                          <div className="flex items-baseline justify-between mt-0.5">
                            <span className={`font-black text-xs sm:text-sm ${
                              isOptimal ? "text-cyan-900" : isWarning ? "text-amber-900" : "text-rose-700"
                            }`}>
                              {driver.apiTemp || `${tNum.toFixed(1)}°C`}
                            </span>
                            <span className="text-[9px] text-slate-400 font-medium">≤ -18°C</span>
                          </div>
                        </div>
                      </div>

                      {/* Live API ODO vs Driver ODO Comparison Section */}
                      <div className="bg-white p-2.5 rounded-lg border border-slate-200/80 space-y-1 text-xs">
                        <div className="flex items-center justify-between text-slate-500">
                          <span className="text-[11px] flex items-center gap-1">
                            <Gauge className="w-3.5 h-3.5 text-[#0878bd]" />
                            <span>GPSBox ODO:</span>
                          </span>
                          <span className="font-mono font-black text-slate-800">
                            {driver.apiOdo ? `${Math.round(driver.apiOdo).toLocaleString()} км` : "—"}
                          </span>
                        </div>

                        {hasDriverOdo && (
                          <div className="flex items-center justify-between text-slate-500">
                            <span className="text-[11px]">Жолоочийн оруулсан:</span>
                            <span className="font-mono font-bold text-slate-700">
                              {driverOdoVal.toLocaleString()} км ({isComplete ? "Төгсгөл" : "Эхлэл"})
                            </span>
                          </div>
                        )}

                        {odoDiff !== null && (
                          <div className="pt-1 border-t border-slate-100 flex items-center justify-between text-[11px]">
                            <span className="text-slate-500 font-medium">ODO Зөрүү:</span>
                            <span
                              className={`font-mono font-black px-1.5 py-0.5 rounded text-[10px] ${
                                Math.abs(odoDiff) <= 5
                                  ? "bg-emerald-50 text-emerald-700"
                                  : "bg-rose-50 text-rose-700 border border-rose-200"
                              }`}
                            >
                              {odoDiff > 0 ? `+${odoDiff}` : odoDiff} км {Math.abs(odoDiff) > 5 ? "⚠️ Шалгах" : "✓"}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Card Bottom Actions */}
                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-1.5">
                    <button
                      onClick={() => onOpenDriverManagement(driver, false)}
                      className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 text-[11px] font-bold transition-colors"
                      title="Жолоочийн мэдээлэл, оноосон машин, ХТ тохируулах"
                    >
                      ✏️ Тохируулах
                    </button>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => onOpenVehicleSheet(driver.vehicle)}
                        className="px-2.5 py-1.5 rounded-lg bg-sky-50 hover:bg-sky-100 text-[#0878bd] text-[11px] font-black transition-colors flex items-center gap-1"
                        title="Сарын замын хуудасны цахим дэвтэр харах (A4 Хэвлэх)"
                      >
                        <FileSpreadsheet className="w-3 h-3" />
                        <span>Маягт (A4)</span>
                      </button>

                      <button
                        onClick={() => onOpenDriverWaybill(driver)}
                        className="px-3 py-1.5 rounded-lg bg-[#0878bd] hover:bg-[#076ba8] text-white text-[11px] font-black transition-all flex items-center gap-1 shadow-xs"
                      >
                        <span>Замын хуудас</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 2: MASTERLOG SUMMARY */}
      {activeTab === "masterlog" && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-black text-[#123047]">
                MasterLog: Өдрийн замын хуудасны нэгдсэн архив
              </h2>
              <p className="text-xs text-slate-500">
                Сонгосон өдөр: <strong className="text-slate-800">{selectedDate}</strong> (Нийт {trips.length} бүртгэл)
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleExportMasterLog}
                className="px-3.5 py-2 rounded-xl bg-[#0878bd] hover:bg-[#076ba8] text-white text-xs font-black flex items-center gap-1.5 shadow-sm transition-all"
              >
                <Download className="w-4 h-4" />
                <span>MasterLog CSV</span>
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse min-w-[850px]">
              <thead>
                <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                  <th className="p-3">Жолооч / Код</th>
                  <th className="p-3">Машин</th>
                  <th className="p-3">Худалдааны төлөөлөгч</th>
                  <th className="p-3">Бүс & Чиглэл</th>
                  <th className="p-3 text-right">Эхлэх ODO</th>
                  <th className="p-3 text-right">Төгсгөх ODO</th>
                  <th className="p-3 text-right font-black text-[#0878bd]">Нийт явсан км</th>
                  <th className="p-3 text-right">Түлш (л)</th>
                  <th className="p-3 text-center">Төлөв</th>
                  <th className="p-3 text-center">Үйлдэл</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {trips.length > 0 ? (
                  trips.map((t) => (
                    <tr key={t.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-3">
                        <span className="font-bold text-slate-900 block">{t.driverName}</span>
                        <span className="text-[10px] text-slate-400 font-mono">{t.driverId}</span>
                      </td>
                      <td className="p-3 font-mono font-bold text-slate-800">{t.vehicleNumber}</td>
                      <td className="p-3 text-slate-700">{t.salesRep}</td>
                      <td className="p-3 text-slate-600 truncate max-w-xs">{t.zone}</td>
                      <td className="p-3 text-right font-mono">{t.startOdo !== undefined && t.startOdo !== null ? Math.round(Number(t.startOdo)).toLocaleString() : "—"}</td>
                      <td className="p-3 text-right font-mono">{t.endOdo !== undefined && t.endOdo !== null ? Math.round(Number(t.endOdo)).toLocaleString() : "—"}</td>
                      <td className="p-3 text-right font-mono font-black text-emerald-700 bg-emerald-50/40">
                        {t.totalKm !== undefined && t.totalKm !== null ? `${Math.round(Number(t.totalKm)).toLocaleString()} км` : "—"}
                      </td>
                      <td className="p-3 text-right font-mono">
                        {t.fuelLiters ? `${t.fuelLiters} л` : "—"}
                      </td>
                      <td className="p-3 text-center">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-100 text-sky-800">
                          {t.status}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        <button
                          onClick={() => handleDeleteTrip(t.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors"
                          title="Устгах"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={10} className="p-8 text-center text-slate-400">
                      Сонгосон өдөр ({selectedDate}) замын хуудасны бүртгэл олдсонгүй.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: GPSBOX API CONFIG & LIVE TELEMETRY AUDIT */}
      {activeTab === "gpsbox" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Connection Config Form */}
            <div className="lg:col-span-1 bg-white rounded-2xl border border-slate-200 shadow-2xs p-5 space-y-4">
              <div>
                <h2 className="text-base font-black text-[#123047] flex items-center gap-2">
                  <Settings className="w-5 h-5 text-[#0878bd]" />
                  <span>GPSBox FMS2 API Холболт</span>
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  https://fms2.gpsbox.mn/ серверийн тохиргоо
                </p>
              </div>

              <form onSubmit={handleSaveGpsConfig} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    FMS Серверийн хаяг (URL)
                  </label>
                  <input
                    type="text"
                    value={gpsConfig.url}
                    onChange={(e) => setGpsConfig({ ...gpsConfig, url: e.target.value })}
                    className="w-full h-10 px-3.5 rounded-xl border border-slate-300 bg-white text-slate-900 text-xs font-medium focus:ring-2 focus:ring-[#0878bd] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Хэрэглэгчийн нэр (Username)
                  </label>
                  <input
                    type="text"
                    value={gpsConfig.username}
                    onChange={(e) => setGpsConfig({ ...gpsConfig, username: e.target.value })}
                    className="w-full h-10 px-3.5 rounded-xl border border-slate-300 bg-white text-slate-900 text-xs font-bold focus:ring-2 focus:ring-[#0878bd] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    API Түлхүүр (API Key)
                  </label>
                  <input
                    type="text"
                    value={gpsConfig.apiKey}
                    onChange={(e) => setGpsConfig({ ...gpsConfig, apiKey: e.target.value })}
                    className="w-full h-10 px-3.5 rounded-xl border border-slate-300 bg-white text-slate-900 text-xs font-mono focus:ring-2 focus:ring-[#0878bd] focus:outline-none"
                  />
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-xs text-slate-500">
                    Төлөв: <strong className="text-emerald-600">● Холбогдсон</strong>
                  </span>
                  <button
                    type="submit"
                    disabled={savingConfig}
                    className="px-4 py-2 rounded-xl bg-[#0878bd] hover:bg-[#076ba8] text-white text-xs font-black shadow-sm flex items-center gap-1.5 transition-all disabled:opacity-50"
                  >
                    {savingConfig ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : "Хадгалах"}
                  </button>
                </div>
              </form>
            </div>

            {/* Diagnostic Action Card */}
            <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-2xs p-5 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-black text-[#123047] flex items-center gap-2">
                      <Activity className="w-5 h-5 text-indigo-600" />
                      <span>Машин бүрийн телеметрийн бодит аудит</span>
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">
                      GPSBox FMS2-с машин тус бүрийн түлшний мэдрэгч (LLS/Аналог), хөргүүрийн темпратур (BLE/1-Wire), одометр зэрэг түүхий өгөгдлийг шалгах
                    </p>
                  </div>
                  <button
                    onClick={handleRunAudit}
                    disabled={loadingAudit}
                    className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black flex items-center gap-2 shadow-sm transition-all disabled:opacity-50 shrink-0"
                  >
                    {loadingAudit ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    <span>{loadingAudit ? "Шалгаж байна..." : "Бүрэн аудит ажиллуулах"}</span>
                  </button>
                </div>

                {auditResult && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-slate-100">
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Нийт жолооч</span>
                      <span className="text-lg font-black text-slate-800">{auditResult.totalDrivers}</span>
                    </div>
                    <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200">
                      <span className="text-[10px] uppercase font-bold text-emerald-600 block">GPSBox Холбогдсон</span>
                      <span className="text-lg font-black text-emerald-700">{auditResult.matchedCount}</span>
                    </div>
                    <div className="p-3 bg-sky-50 rounded-xl border border-sky-200">
                      <span className="text-[10px] uppercase font-bold text-sky-600 block">FMS Нийт төхөөрөмж</span>
                      <span className="text-lg font-black text-sky-700">{auditResult.totalGpsboxObjects}</span>
                    </div>
                    <div className="p-3 bg-amber-50 rounded-xl border border-amber-200">
                      <span className="text-[10px] uppercase font-bold text-amber-600 block">Хувь</span>
                      <span className="text-lg font-black text-amber-700">
                        {Math.round((auditResult.matchedCount / auditResult.totalDrivers) * 100)}%
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {!auditResult && (
                <div className="py-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200 mt-4">
                  <Activity className="w-8 h-8 text-slate-300 mx-auto mb-2 animate-pulse" />
                  <p className="text-xs text-slate-500 font-medium">
                    "Бүрэн аудит ажиллуулах" товч дээр дарж бүх 30 машины телеметрийн параметрүүдийг шууд шалгана уу.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Audit Detailed Table */}
          {auditResult && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
              <div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-black text-slate-800">
                    Машин тус бүрийн параметрийн шалгалтын үр дүн
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Серверээс ирсэн LLS1, LLS2, io9, BLE, 1-Wire мэдрэгчийн бодит тооцоолол
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Машин, жолооч хайх..."
                      value={auditSearch}
                      onChange={(e) => setAuditSearch(e.target.value)}
                      className="h-8 pl-8 pr-3 text-xs rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-1 focus:ring-[#0878bd]"
                    />
                  </div>

                  <select
                    value={auditFilter}
                    onChange={(e: any) => setAuditFilter(e.target.value)}
                    className="h-8 px-2.5 text-xs rounded-lg border border-slate-300 bg-white font-medium focus:outline-none"
                  >
                    <option value="all">Бүгд</option>
                    <option value="matched">Зөвхөн холбогдсон</option>
                    <option value="unmatched">Холболтгүй</option>
                  </select>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse min-w-[950px]">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                      <th className="p-3">Машин / Загвар</th>
                      <th className="p-3">Жолооч / Код</th>
                      <th className="p-3">GPSBox Холболт</th>
                      <th className="p-3 text-right">Одометр (км)</th>
                      <th className="p-3 text-right">Түлш (Бодит)</th>
                      <th className="p-3 text-right">Хөргүүрийн темпратур</th>
                      <th className="p-3">Сүүлийн GPS цаг</th>
                      <th className="p-3">Түүхий параметрүүд</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {auditResult.audit
                      .filter((item: any) => {
                        if (auditFilter === "matched" && !item.matched) return false;
                        if (auditFilter === "unmatched" && item.matched) return false;
                        if (auditSearch) {
                          const s = auditSearch.toLowerCase();
                          return (
                            item.vehicle?.toLowerCase().includes(s) ||
                            item.driverName?.toLowerCase().includes(s) ||
                            item.driverId?.toLowerCase().includes(s) ||
                            item.imei?.includes(s)
                          );
                        }
                        return true;
                      })
                      .map((item: any) => (
                        <tr key={item.driverId} className="hover:bg-slate-50/80 transition-colors">
                          <td className="p-3">
                            <span className="font-bold text-slate-900 block font-mono">{item.vehicle}</span>
                            <span className="text-[10px] text-slate-400">{item.model}</span>
                          </td>
                          <td className="p-3">
                            <span className="font-bold text-slate-800 block">{item.driverName}</span>
                            <span className="text-[10px] font-mono text-slate-400">{item.driverId}</span>
                          </td>
                          <td className="p-3">
                            {item.matched ? (
                              <div>
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                  <CheckCircle2 className="w-3 h-3" />
                                  <span>{item.status === "moving" ? "Хөдөлгөөнд" : "Идэвхтэй"}</span>
                                </span>
                                <span className="text-[9px] text-slate-400 block font-mono mt-0.5">
                                  IMEI: {item.imei}
                                </span>
                              </div>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                                <AlertTriangle className="w-3 h-3" />
                                <span>Автомат горим</span>
                              </span>
                            )}
                          </td>
                          <td className="p-3 text-right font-mono font-bold text-slate-800">
                            {item.odometer ? `${Math.round(item.odometer).toLocaleString()} км` : "—"}
                          </td>
                          <td className="p-3 text-right">
                            <span className="font-black text-amber-600 font-mono block">
                              {item.fuel} ({item.fuelPercent}%)
                            </span>
                            <span className="text-[9px] text-slate-400 block">
                              {item.fuelSource}
                            </span>
                          </td>
                          <td className="p-3 text-right">
                            <span className={`font-black font-mono block ${item.tempNum > -15 ? "text-rose-600" : "text-sky-600"}`}>
                              {item.temp}
                            </span>
                            <span className="text-[9px] text-slate-400 block">
                              {item.tempSource}
                            </span>
                          </td>
                          <td className="p-3 text-slate-500 font-mono text-[10px]">
                            {item.dtTracker || "—"}
                          </td>
                          <td className="p-3">
                            <div className="flex flex-wrap gap-1 max-w-xs text-[9px] font-mono text-slate-600">
                              {item.rawParams.io201_lls1 && (
                                <span className="px-1.5 py-0.5 bg-slate-100 rounded border border-slate-200">
                                  LLS1: {item.rawParams.io201_lls1}
                                </span>
                              )}
                              {item.rawParams.io203_lls2 && (
                                <span className="px-1.5 py-0.5 bg-slate-100 rounded border border-slate-200">
                                  LLS2: {item.rawParams.io203_lls2}
                                </span>
                              )}
                              {item.rawParams.io9_analog_mv && (
                                <span className="px-1.5 py-0.5 bg-slate-100 rounded border border-slate-200">
                                  io9: {item.rawParams.io9_analog_mv}mV
                                </span>
                              )}
                              {item.rawParams.io10800_ble_temp && (
                                <span className="px-1.5 py-0.5 bg-sky-50 text-sky-700 rounded border border-sky-200">
                                  BLE: {item.rawParams.io10800_ble_temp}
                                </span>
                              )}
                              {item.rawParams.io25_1wire_temp && (
                                <span className="px-1.5 py-0.5 bg-cyan-50 text-cyan-700 rounded border border-cyan-200">
                                  1W: {item.rawParams.io25_1wire_temp}
                                </span>
                              )}
                              {item.rawParams.io16_odo_m && (
                                <span className="px-1.5 py-0.5 bg-slate-100 rounded border border-slate-200">
                                  odo_m: {item.rawParams.io16_odo_m}
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: VEHICLE FINES & PENALTIES */}
      {activeTab === "fines" && (
        <div className="space-y-4">
          {/* Top Metrics Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
              <div className="flex items-center justify-between text-slate-500 mb-1">
                <span className="text-xs font-bold uppercase tracking-wider">Нийт автопарк</span>
                <Truck className="w-4 h-4 text-[#0878bd]" />
              </div>
              <div className="text-2xl font-black text-[#123047]">
                {bulkFines?.totalCars || drivers.length}
                <span className="text-xs font-normal text-slate-400 ml-1">машин</span>
              </div>
              <div className="text-[11px] text-slate-400 mt-1">Түгээлтийн нийт машин</div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
              <div className="flex items-center justify-between text-emerald-600 mb-1">
                <span className="text-xs font-bold uppercase tracking-wider">Цэвэр (Торгуульгүй)</span>
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div className="text-2xl font-black text-emerald-700">
                {bulkFines?.cleanCars ?? (drivers.length - (bulkFines?.fineCars || 0))}
                <span className="text-xs font-normal text-emerald-600 ml-1">машин</span>
              </div>
              <div className="text-[11px] text-emerald-600/80 mt-1 font-medium">Зөрчилгүй тээврийн хэрэгсэл</div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
              <div className="flex items-center justify-between text-rose-600 mb-1">
                <span className="text-xs font-bold uppercase tracking-wider">Төлөөгүй торгуультай</span>
                <ShieldAlert className="w-4 h-4" />
              </div>
              <div className="text-2xl font-black text-rose-600">
                {bulkFines?.fineCars ?? 0}
                <span className="text-xs font-normal text-rose-500 ml-1">машин</span>
              </div>
              <div className="text-[11px] text-rose-600/80 mt-1 font-medium">
                Нийт {bulkFines?.totalFineCount ?? 0} зөрчил
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
              <div className="flex items-center justify-between text-slate-500 mb-1">
                <span className="text-xs font-bold uppercase tracking-wider">Нийт төлөх дүн</span>
                <CreditCard className="w-4 h-4 text-rose-600" />
              </div>
              <div className="text-2xl font-black text-rose-600 truncate">
                {bulkFines?.totalAmount ? Number(bulkFines.totalAmount).toLocaleString() : 0}
                <span className="text-xs font-normal text-slate-400 ml-1">₮</span>
              </div>
              <div className="text-[11px] text-slate-400 mt-1 truncate">
                {bulkFines?.generatedAt
                  ? `Шүүсэн: ${new Date(bulkFines.generatedAt).toLocaleTimeString()}`
                  : "Шүүлт хийгдсэн"}
              </div>
            </div>
          </div>

          {/* Search & Actions Toolbar */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2 flex-1">
              {/* Search Box */}
              <div className="relative flex-1 min-w-[200px]">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Машин (2611 УЕВ), жолооч, код (M16)..."
                  value={fineSearch}
                  onChange={(e) => setFineSearch(e.target.value)}
                  className="w-full pl-9 pr-3.5 py-2 rounded-xl border border-slate-300 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#0878bd]"
                />
              </div>

              {/* Status Filter */}
              <select
                value={fineFilter}
                onChange={(e) => setFineFilter(e.target.value as any)}
                className="py-2 px-3 rounded-xl border border-slate-300 text-xs sm:text-sm font-semibold bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0878bd]"
              >
                <option value="all">Бүх машин ({drivers.length})</option>
                <option value="fines">⚠️ Зөвхөн торгуультай ({bulkFines?.fineCars || 0})</option>
                <option value="clean">✅ Зөвхөн цэвэр ({bulkFines?.cleanCars || 0})</option>
              </select>
            </div>

            {/* Refresh All Action */}
            <div className="flex items-center gap-2">
              <button
                id="refresh-all-fines-btn"
                onClick={() => handleLoadFines(true)}
                disabled={loadingFines}
                className="px-4 py-2 bg-[#0878bd] hover:bg-[#076ba8] text-white rounded-xl text-xs sm:text-sm font-black transition-all flex items-center gap-2 shadow-sm disabled:opacity-60 cursor-pointer"
              >
                <RefreshCw className={`w-4 h-4 ${loadingFines ? "animate-spin" : ""}`} />
                <span>{loadingFines ? "Бүх машиныг шүүж байна..." : "Бүх машины торгууль шинэчлэн шүүх"}</span>
              </button>
            </div>
          </div>

          {/* Fines Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-[#0878bd]" />
                <h3 className="text-sm font-black text-[#123047]">
                  Автопаркийн зөрчил, торгуулийн нэгдсэн хяналтын бүртгэл
                </h3>
              </div>
              <span className="text-xs text-slate-400 font-mono">
                Нийт: {drivers.length} тээврийн хэрэгсэл
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100/70 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                    <th className="p-3 pl-4">Бүсийн код / Жолооч</th>
                    <th className="p-3">Улсын дугаар & Модель</th>
                    <th className="p-3">Төлөв</th>
                    <th className="p-3 text-center">Зөрчлийн тоо</th>
                    <th className="p-3 text-right">Төлөгдөөгүй дүн</th>
                    <th className="p-3">Сүүлд шүүсэн</th>
                    <th className="p-3 pr-4 text-center">Үйлдэл</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {drivers
                    .filter((driver) => {
                      if (!fineSearch) return true;
                      const q = fineSearch.toLowerCase();
                      return (
                        driver.name.toLowerCase().includes(q) ||
                        driver.id.toLowerCase().includes(q) ||
                        driver.vehicle.toLowerCase().includes(q)
                      );
                    })
                    .filter((driver) => {
                      if (fineFilter === "all") return true;
                      const cleanVeh = (driver.vehicle || "").trim().toUpperCase();
                      const fineRow = bulkFines?.rows?.find(
                        (r) => r.plate.toUpperCase() === cleanVeh || r.displayPlate.toUpperCase() === cleanVeh
                      );
                      const isUnpaid = fineRow && (fineRow.status === "ТӨЛӨӨГҮЙ" || (typeof fineRow.count === "number" && fineRow.count > 0));
                      if (fineFilter === "fines") return isUnpaid;
                      if (fineFilter === "clean") return !isUnpaid;
                      return true;
                    })
                    .map((driver) => {
                      const cleanVeh = (driver.vehicle || "").trim().toUpperCase();
                      const fineRow = bulkFines?.rows?.find(
                        (r) => r.plate.toUpperCase() === cleanVeh || r.displayPlate.toUpperCase() === cleanVeh
                      );
                      const hasFine = fineRow && (fineRow.status === "ТӨЛӨӨГҮЙ" || (typeof fineRow.count === "number" && fineRow.count > 0));
                      const fineCount = fineRow ? fineRow.count : 0;
                      const fineTotal = fineRow ? fineRow.total : 0;
                      const isExpanded = expandedFinePlate === cleanVeh;

                      // Vehicle specific fine violation items
                      const vehicleFines = bulkFines?.fines?.filter(
                        (f) => f.plate.toUpperCase() === cleanVeh || f.displayPlate.toUpperCase() === cleanVeh
                      ) || [];

                      return (
                        <React.Fragment key={driver.id}>
                          <tr className={`hover:bg-slate-50/80 transition-colors ${hasFine ? "bg-amber-50/20" : ""}`}>
                            <td className="p-3 pl-4">
                              <div className="flex items-center gap-2">
                                <span className="w-8 h-8 rounded-lg bg-sky-50 text-[#0878bd] font-black flex items-center justify-center text-xs border border-sky-100 flex-shrink-0">
                                  {driver.id}
                                </span>
                                <div>
                                  <div className="font-bold text-slate-900">{driver.name}</div>
                                  <div className="text-[11px] text-slate-400">{driver.phone || "—"}</div>
                                </div>
                              </div>
                            </td>

                            <td className="p-3">
                              <div className="font-black text-slate-800 text-sm">{driver.vehicle}</div>
                              <div className="text-[11px] text-slate-500">{driver.model || "Isuzu NPR"}</div>
                            </td>

                            <td className="p-3">
                              {loadingFines && !fineRow ? (
                                <span className="inline-flex items-center gap-1 text-slate-400 font-medium">
                                  <RefreshCw className="w-3 h-3 animate-spin" />
                                  Шалгаж байна...
                                </span>
                              ) : hasFine ? (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-black bg-amber-100 text-amber-900 border border-amber-300">
                                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                                  ТӨЛӨӨГҮЙ
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                                  ЦЭВЭР
                                </span>
                              )}
                            </td>

                            <td className="p-3 text-center font-bold">
                              {hasFine ? (
                                <span className="px-2 py-0.5 rounded-full bg-amber-500 text-white font-black text-xs">
                                  {fineCount}
                                </span>
                              ) : (
                                <span className="text-slate-400 font-normal">0</span>
                              )}
                            </td>

                            <td className="p-3 text-right">
                              {hasFine ? (
                                <span className="text-sm font-black text-rose-600 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200">
                                  {Number(fineTotal).toLocaleString()} ₮
                                </span>
                              ) : (
                                <span className="text-emerald-700 font-bold">0 ₮</span>
                              )}
                            </td>

                            <td className="p-3 text-slate-500 text-[11px]">
                              {bulkFines?.generatedAt
                                ? `${new Date(bulkFines.generatedAt).toLocaleDateString()} ${new Date(bulkFines.generatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                                : "Бэлэн"}
                            </td>

                            <td className="p-3 pr-4 text-center">
                              {vehicleFines.length > 0 ? (
                                <button
                                  onClick={() => setExpandedFinePlate(isExpanded ? null : cleanVeh)}
                                  className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center gap-1 mx-auto transition-colors cursor-pointer"
                                >
                                  <span>{isExpanded ? "Хураах" : "Зөрчил харах"}</span>
                                  {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                                </button>
                              ) : (
                                <span className="text-slate-300 text-xs">—</span>
                              )}
                            </td>
                          </tr>

                          {/* Expanded Violations List */}
                          {isExpanded && vehicleFines.length > 0 && (
                            <tr className="bg-slate-50/90 border-b border-slate-200">
                              <td colSpan={7} className="p-4">
                                <div className="bg-white rounded-xl border border-slate-200 p-3.5 space-y-2">
                                  <div className="flex items-center justify-between pb-2 border-b border-slate-100 text-xs font-bold text-slate-700">
                                    <span className="flex items-center gap-1.5 text-[#0878bd]">
                                      <FileText className="w-4 h-4" />
                                      {driver.vehicle} машины бүртгэгдсэн зөрчлүүд ({vehicleFines.length})
                                    </span>
                                    <span className="text-rose-600 font-black">
                                      Нийт: {Number(fineTotal).toLocaleString()} ₮
                                    </span>
                                  </div>

                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                    {vehicleFines.map((vFine: FineRecord, vIdx: number) => (
                                      <div
                                        key={`${vFine.no}-${vIdx}`}
                                        className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs space-y-1"
                                      >
                                        <div className="flex items-center justify-between font-bold">
                                          <span className="font-mono text-slate-700">№ {vFine.no}</span>
                                          <span className="text-rose-600 font-black">
                                            {Number(vFine.amount).toLocaleString()} ₮
                                          </span>
                                        </div>
                                        <div className="text-slate-800 font-medium flex items-start gap-1">
                                          <Info className="w-3.5 h-3.5 text-slate-400 flex-shrink-0 mt-0.5" />
                                          <span>{vFine.violation}</span>
                                        </div>
                                        <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-200/60">
                                          <span className="flex items-center gap-1">
                                            <Clock className="w-3 h-3" />
                                            {vFine.date}
                                          </span>
                                          {vFine.location && vFine.location !== "—" && (
                                            <span className="flex items-center gap-1 truncate max-w-[200px]" title={vFine.location}>
                                              <MapPin className="w-3 h-3" />
                                              {vFine.location}
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
      </div>

      {/* TAB: IMD LOGISTICS MASTER MODULE */}
      {activeTab === "imd" && (
        <IMDManagerView
          drivers={appData?.drivers || drivers}
          onOpenDriverWaybill={(driverId) => {
            const drv = (appData?.drivers || drivers).find(d => d.id === driverId);
            if (drv) onOpenDriverWaybill(drv);
          }}
          onShowToast={onShowToast}
        />
      )}

      {/* TAB: DAILY DRIVER ASSIGNMENT & FINE DETECTION */}
      {activeTab === "daily_assignment" && (
        <DailyDriverAssignmentView
          onShowToast={onShowToast}
          onOpenReport={() => setActiveTab("internal_fines")}
        />
      )}

      {/* TAB: INTERNAL FINES REPORT & MATRIX */}
      {activeTab === "internal_fines" && (
        <InternalFineReportView
          onShowToast={onShowToast}
          onBackToDaily={() => setActiveTab("daily_assignment")}
        />
      )}

      {/* 1-Click Batch Waybill Print Modal */}
      {showBatchPrintModal && (
        <BatchWaybillPrintModal
          onClose={() => setShowBatchPrintModal(false)}
          onShowToast={onShowToast}
        />
      )}

      {/* Waybill Edit & Retroactive Fill Modal */}
      {showWaybillEditModal && (
        <WaybillEditModal
          isOpen={showWaybillEditModal}
          onClose={() => setShowWaybillEditModal(false)}
          drivers={appData?.drivers || drivers}
          selectedDriverId={editWaybillDriverId}
          onOpenAutoOdoConfig={(driver) => {
            setAutoOdoDriverId(driver.id);
            setShowAutoOdoConfigModal(true);
          }}
          onSaved={() => {
            loadData(false);
            onRefreshData();
            onShowToast("Замын хуудасны өөрчлөлт хадгалагдлаа!", "success");
          }}
        />
      )}

      {/* Driver Auto-ODO & API Daily KM Config Modal */}
      {showAutoOdoConfigModal && (
        <DriverAutoOdoConfigModal
          isOpen={showAutoOdoConfigModal}
          onClose={() => setShowAutoOdoConfigModal(false)}
          drivers={appData?.drivers || drivers}
          selectedDriverId={autoOdoDriverId}
          onSaved={() => {
            loadData(false);
            onRefreshData();
            onShowToast("Авто-ODO тохиргоо шинэчлэгдлээ!", "success");
          }}
        />
      )}

      {/* Official Work Schedule Modal */}
      {showWorkScheduleModal && (
        <WorkScheduleModal
          isOpen={showWorkScheduleModal}
          onClose={() => setShowWorkScheduleModal(false)}
          onSuccess={(msg) => {
            loadData(false);
            onRefreshData();
            onShowToast(msg, "success");
          }}
        />
      )}

      {/* Database Backup & Restore Protection Modal */}
      {showDatabaseBackupModal && (
        <DatabaseBackupModal
          isOpen={showDatabaseBackupModal}
          onClose={() => setShowDatabaseBackupModal(false)}
          appData={appData}
          onSuccess={(msg) => {
            loadData(false);
            onRefreshData();
            onShowToast(msg, "success");
          }}
        />
      )}

    </div>
  );
};
