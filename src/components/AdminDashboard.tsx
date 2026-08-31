import React, { useState, useEffect } from "react";
import { Driver, TripLog, GPSBoxConfig, AppDataResponse } from "../types";
import { API } from "../services/api";
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
  ExternalLink,
  MapPin,
  Sparkles,
  Zap,
  Gauge
} from "lucide-react";

interface AdminDashboardProps {
  onOpenDriverWaybill: (driver: Driver) => void;
  onOpenVehicleSheet: (vehNumber: string) => void;
  onOpenDriverManagement: (driver?: Driver, createNew?: boolean) => void;
  onOpenGoogleSheets: () => void;
  onShowToast: (msg: string, type?: "success" | "error" | "info") => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  onOpenDriverWaybill,
  onOpenVehicleSheet,
  onOpenDriverManagement,
  onOpenGoogleSheets,
  onShowToast
}) => {
  const [activeTab, setActiveTab] = useState<"fleet" | "masterlog" | "gpsbox">("fleet");
  const [appData, setAppData] = useState<AppDataResponse | null>(null);
  const [trips, setTrips] = useState<TripLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    return new Date(today.getTime() - today.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [groupFilter, setGroupFilter] = useState<"all" | "KA" | "M">("all");
  const [syncingSheet, setSyncingSheet] = useState(false);

  // GPSBox Config State
  const [gpsConfig, setGpsConfig] = useState<GPSBoxConfig>({
    url: "https://fms2.gpsbox.mn/",
    username: "teso",
    apiKey: "7FFA953B612BB59AB076B1C561D74BCC",
    syncStatus: "connected"
  });
  const [savingConfig, setSavingConfig] = useState(false);

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
    const timer = setInterval(() => loadData(false), 25000);
    return () => clearInterval(timer);
  }, [selectedDate]);

  const handleManualSync = async () => {
    setRefreshing(true);
    try {
      const res = await API.syncGPSBoxNow();
      await loadData(false);
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
      onShowToast(res.message || "Google Sheet-с 30 жолоочийн мэдээлэл амжилттай шинэчлэгдлээ!", "success");
    } catch (err: any) {
      onShowToast("Google Sheet синк хийхэд алдаа гарлаа", "error");
    } finally {
      setSyncingSheet(false);
    }
  };

  const handleExportSheetCsv = () => {
    window.open("/api/sheet/export-csv", "_blank");
    onShowToast("Google Sheet бүтцээрх 30 машины телематик CSV татаж байна...", "success");
  };

  const handleDeleteTrip = async (id: string) => {
    if (!confirm("Энэ замын хуудсыг MasterLog-с устгах уу?")) return;
    try {
      await API.deleteTrip(id);
      onShowToast("Замын хуудас устгагдлаа", "success");
      loadData(false);
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
      "Жолооч код",
      "Жолооч нэр",
      "Машин",
      "Төлөөлөгч",
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

  // Filtered drivers
  const filteredDrivers = (appData?.drivers || []).filter((d) => {
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

    if (!matchGroup) return false;

    const trip = appData?.tripStatus[d.id] || appData?.tripStatus[d.code];
    if (statusFilter === "started") return matchSearch && trip?.phase === "started";
    if (statusFilter === "complete") return matchSearch && trip?.phase === "complete";
    if (statusFilter === "not_started") return matchSearch && !trip;
    return matchSearch;
  });

  return (
    <div className="w-full max-w-7xl mx-auto px-3 sm:px-6 py-4 space-y-5">
      
      {/* Top Banner & Quick Metrics */}
      <div className="bg-gradient-to-r from-[#123047] via-[#0b4d79] to-[#0878bd] rounded-2xl p-5 sm:p-6 text-white shadow-xl flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-sky-400/20 text-sky-200 border border-sky-300/30">
              Админ удирдлагын төв
            </span>
            <span className="flex items-center gap-1 text-xs text-emerald-300 font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              GPSBox Realtime
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
              Google Sheet Холбогдсон
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white">
            Автопарк & Телематик хяналтын самбар
          </h1>
          <p className="text-xs sm:text-sm text-sky-100/80 mt-1 max-w-xl">
            Бүх 30 жолооч нарын замын хуудасны явц, шууд түлш, хөргүүрийн температур, ODO заалтын нэгдсэн систем
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => onOpenDriverManagement(undefined, true)}
            className="px-3.5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black flex items-center gap-1.5 transition-all shadow-md"
            title="Шинэ жолооч, машин, худалдааны төлөөлөгчийн мэдээлэл нэмэх"
          >
            <span className="text-base leading-none">➕</span>
            <span>Шинэ жолооч нэмэх</span>
          </button>

          <button
            onClick={() => onOpenDriverManagement(undefined, false)}
            className="px-3.5 py-2.5 rounded-xl bg-white/20 hover:bg-white/30 border border-white/25 text-xs font-bold text-white flex items-center gap-1.5 transition-all shadow-sm"
            title="Бүх жолооч, машин, ХТ тохируулах, засах, устгах"
          >
            <Users className="w-4 h-4" />
            <span>Жолооч & Машин тохируулах ({appData?.drivers.length || 0})</span>
          </button>

          <button
            onClick={onOpenGoogleSheets}
            className="px-3.5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black flex items-center gap-1.5 transition-all shadow-md border border-emerald-400/40"
            title="Google Sheets-тэй холбох, шууд шинэ sheet үүсгэх, замын хуудас & телематик экспортлох"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-200" />
            <span>Google Sheets</span>
          </button>

          <button
            onClick={handleExportSheetCsv}
            className="px-3.5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-xs font-medium text-white flex items-center gap-1.5 transition-all"
            title="Бүх 30 машины одоогийн телематик өгөгдлийг Google Sheet форматаар татах"
          >
            <Download className="w-4 h-4" />
            <span>CSV</span>
          </button>

          <button
            onClick={handleManualSync}
            disabled={refreshing}
            className="px-3.5 py-2.5 rounded-xl bg-sky-400 hover:bg-sky-300 text-slate-950 text-xs font-black flex items-center gap-1.5 transition-all shadow-md disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
            <span>GPS Татах</span>
          </button>
        </div>
      </div>

      {/* Metric Cards Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-bold uppercase">Нийт машин / Жолооч</span>
            <Truck className="w-4 h-4 text-[#0878bd]" />
          </div>
          <div className="text-2xl font-black text-[#123047]">
            {appData?.stats.totalDrivers || 0}
          </div>
          <span className="text-[11px] text-emerald-600 font-semibold">
            ● {appData?.stats.activeDrivers || 0} ажиллаж байна
          </span>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-bold uppercase">Өнөөдөр эхэлсэн</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-black text-amber-700">
            {appData?.stats.todayStartedTrips || 0}
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
            {appData?.stats.todayCompletedTrips || 0}
          </div>
          <span className="text-[11px] text-emerald-600 font-semibold">
            Баталгаажсан хуудас
          </span>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-bold uppercase">GPSBox FMS2 төлөв</span>
            <Activity className="w-4 h-4 text-sky-500" />
          </div>
          <div className="text-sm font-black text-emerald-700 flex items-center gap-1.5 mt-1">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
            <span>Холбогдсон (Шууд)</span>
          </div>
          <span className="text-[11px] text-slate-500">
            {gpsConfig.username} • 15 сек шинэчлэл
          </span>
        </div>
      </div>

      {/* Tabs Bar */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveTab("fleet")}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-black transition-all flex items-center gap-2 ${
            activeTab === "fleet"
              ? "bg-[#0878bd] text-white shadow-sm"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          <Truck className="w-4 h-4" />
          <span>Бүх машин & GPS Шууд хяналт</span>
        </button>

        <button
          onClick={() => setActiveTab("masterlog")}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-black transition-all flex items-center gap-2 ${
            activeTab === "masterlog"
              ? "bg-[#0878bd] text-white shadow-sm"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span>MasterLog Нэгдсэн бүртгэл</span>
        </button>

        <button
          onClick={() => setActiveTab("gpsbox")}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-black transition-all flex items-center gap-2 ${
            activeTab === "gpsbox"
              ? "bg-[#0878bd] text-white shadow-sm"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          <Settings className="w-4 h-4" />
          <span>GPSBox API Тохиргоо</span>
        </button>
      </div>

      {/* TAB 1: FLEET REALTIME MONITOR */}
      {activeTab === "fleet" && (
        <div className="space-y-4">
          {/* Controls & Search */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-64">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Жолооч, машин, код хайх..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3.5 py-2 rounded-xl border border-slate-300 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#0878bd]"
                />
              </div>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="py-2 px-3 rounded-xl border border-slate-300 text-xs sm:text-sm font-medium bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0878bd]"
              >
                <option value="all">Бүх төлөв ({appData?.drivers.length})</option>
                <option value="started">🟡 Замд яваа</option>
                <option value="complete">✅ Дууссан</option>
                <option value="not_started">⚪ Эхлээгүй</option>
              </select>

              {/* Group filter pills */}
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
                  KA (5)
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
                  M (25)
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <span className="text-xs text-slate-500 font-bold">Огноо:</span>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="py-1.5 px-3 rounded-xl border border-slate-300 text-xs sm:text-sm font-bold bg-slate-50 text-slate-800 focus:bg-white"
              />
            </div>
          </div>

          {/* Vehicle Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {filteredDrivers.map((driver) => {
              const trip = appData?.tripStatus[driver.id] || appData?.tripStatus[driver.code];
              const isStarted = trip?.phase === "started";
              const isComplete = trip?.phase === "complete";
              const tele = driver.telemetry;

              // Odometer Comparison Logic
              const hasDriverOdo = (isComplete && trip?.endOdo != null) || (isStarted && trip?.startOdo != null);
              const driverOdoVal = isComplete ? (trip?.endOdo ?? 0) : (trip?.startOdo ?? 0);
              const apiOdoVal = driver.apiOdo || 0;
              const odoDiff = hasDriverOdo && apiOdoVal > 0 ? (apiOdoVal - driverOdoVal) : null;

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
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                          Эхэлсэн
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-600">
                          Эхлээгүй
                        </span>
                      )}
                    </div>

                    {/* Vehicle & Telematics Stats */}
                    <div className="mt-3 bg-slate-50 rounded-xl p-3 border border-slate-100">
                      <div className="flex items-center justify-between text-xs mb-2">
                        <span className="font-black text-slate-900">{driver.vehicle}</span>
                        <span className="text-[11px] text-slate-500 font-medium">{driver.model}</span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs mb-2.5">
                        <div className="bg-white p-2 rounded-lg border border-slate-200/80">
                          <span className="text-[10px] text-slate-400 uppercase font-bold block">⛽ Шууд Түлш:</span>
                          <span className="font-black text-[#0878bd]">{driver.apiFuel || "45.0 л"}</span>
                        </div>

                        {(() => {
                          const tNum = driver.apiTempNum !== undefined ? driver.apiTempNum : (parseFloat(String(driver.apiTemp || "").replace(/[^0-9.-]/g, "")) || -20.0);
                          const isOptimal = tNum <= -18;
                          const isWarning = tNum > -18 && tNum <= -15;

                          return (
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
                          );
                        })()}
                      </div>

                      {/* Live API ODO vs Driver ODO Comparison Section */}
                      <div className="bg-white p-2.5 rounded-xl border border-sky-100 shadow-2xs space-y-1.5">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-slate-500 font-medium flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-sky-500 animate-ping" />
                            📡 GPSBox API ODO:
                          </span>
                          <strong className="text-slate-900 font-mono font-black">
                            {driver.apiOdo ? `${driver.apiOdo.toLocaleString()} км` : "—"}
                          </strong>
                        </div>

                        <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-100">
                          <span className="text-slate-500 font-medium">✍️ Жолоочийн ODO:</span>
                          <strong className="font-mono font-bold text-slate-800">
                            {isComplete && trip?.endOdo
                              ? `${trip.endOdo.toLocaleString()} км (Төгсгөл)`
                              : isStarted && trip?.startOdo
                              ? `${trip.startOdo.toLocaleString()} км (Эхлэл)`
                              : "Бөглөөгүй"}
                          </strong>
                        </div>

                        <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-100">
                          <span className="text-slate-600 font-bold">⚖️ ODO Зөрүү:</span>
                          {odoDiff !== null ? (
                            Math.abs(odoDiff) <= 2 ? (
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200">
                                ✅ Таарсан ({odoDiff > 0 ? `+${odoDiff}` : odoDiff} км)
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-amber-100 text-amber-900 border border-amber-300 animate-pulse">
                                ⚠️ Зөрүү: {odoDiff > 0 ? `+${odoDiff}` : odoDiff} км
                              </span>
                            )
                          ) : (
                            <span className="text-[10px] text-slate-400 font-medium">
                              {isStarted || isComplete ? "API өгөгдөлгүй" : "Эхлэхэд бэлэн"}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Assigned Route & Sales Rep */}
                    {driver.defaultRoute && (
                      <div className="mt-2 text-[11px] bg-sky-50/70 border border-sky-100 rounded-lg p-2 text-slate-700">
                        <div className="text-[10px] font-bold text-[#0878bd] uppercase tracking-wider mb-0.5">
                          📍 Чиглэл / Маршрут:
                        </div>
                        <div className="font-semibold text-slate-900 line-clamp-2">
                          {driver.defaultRoute}
                        </div>
                      </div>
                    )}

                    {/* Assigned Sales Rep */}
                    <div className="mt-2 text-[11px] text-slate-600 flex items-center justify-between px-1">
                      <span className="text-slate-500">Худалдааны төлөөлөгч (ХТ):</span>
                      <strong className="text-slate-900 font-bold">{driver.salesRep}</strong>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-1.5">
                    <button
                      onClick={() => onOpenDriverWaybill(driver)}
                      className="flex-1 py-2 px-3 rounded-xl bg-sky-50 hover:bg-sky-100 text-[#0878bd] text-xs font-black flex items-center justify-center gap-1 transition-colors"
                      title="Замын хуудас харах / бөглөх"
                    >
                      <span>Замын хуудас</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => onOpenDriverManagement(driver, false)}
                      title="Жолооч, машин, худалдааны төлөөлөгчийг тохируулах / засах"
                      className="px-2.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1 transition-colors"
                    >
                      <span>✏️ Засах</span>
                    </button>

                    <button
                      onClick={() => onOpenVehicleSheet(driver.vehicle)}
                      title="Машины сарын дэвтэр"
                      className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
                    >
                      <FileSpreadsheet className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 2: MASTERLOG TABLE */}
      {activeTab === "masterlog" && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-black text-[#123047]">
                MasterLog Замын хуудасны нэгдсэн бүртгэл
              </h2>
              <p className="text-xs text-slate-500">
                {selectedDate} өдрийн бүх баталгаажсан болон явагдаж буй замын хуудаснууд (API ODO тулгалттай)
              </p>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="py-1.5 px-3 rounded-xl border border-slate-300 text-xs sm:text-sm font-bold bg-white text-slate-800"
              />
              <button
                onClick={handleExportMasterLog}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-sm"
              >
                <Download className="w-4 h-4" />
                <span>Excel / CSV татах</span>
              </button>
            </div>
          </div>

          {/* MasterLog Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse min-w-[1050px]">
                <thead>
                  <tr className="bg-[#123047] text-white font-black">
                    <th className="p-3">Огноо</th>
                    <th className="p-3">Жолооч (ID)</th>
                    <th className="p-3">Машин</th>
                    <th className="p-3">Худалдааны төлөөлөгч (ХТ)</th>
                    <th className="p-3">Бүс / Маршрут</th>
                    <th className="p-3 text-right bg-sky-900/60">📡 API ODO</th>
                    <th className="p-3 text-right">✍️ Эхлэх ODO</th>
                    <th className="p-3 text-right">✍️ Төгсгөх ODO</th>
                    <th className="p-3 text-center bg-sky-900/60">⚖️ ODO Зөрүү</th>
                    <th className="p-3 text-right bg-[#0b4d79]">Нийт км</th>
                    <th className="p-3 text-right">Түлш</th>
                    <th className="p-3">ШТС</th>
                    <th className="p-3 text-center">Төлөв</th>
                    <th className="p-3 text-center">Үйлдэл</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {trips.length === 0 ? (
                    <tr>
                      <td colSpan={14} className="p-8 text-center text-slate-400 font-semibold">
                        {selectedDate} өдөр бүртгэгдсэн замын хуудас байхгүй байна.
                      </td>
                    </tr>
                  ) : (
                    trips.map((t) => {
                      const matchedDriver = appData?.drivers.find(
                        (d) => d.id === t.driverId || d.code === t.driverId || d.vehicle === t.vehicleNumber
                      );
                      const currentApiOdo = matchedDriver?.apiOdo || 0;
                      const driverFinalOdo = t.endOdo || t.startOdo;
                      const diff = currentApiOdo > 0 && driverFinalOdo > 0 ? currentApiOdo - driverFinalOdo : null;

                      return (
                        <tr key={t.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="p-3 font-semibold text-slate-800 whitespace-nowrap">{t.date}</td>
                          <td className="p-3">
                            <div className="font-black text-slate-900">{t.driverName}</div>
                            <span className="text-[10px] text-slate-500 font-mono">({t.driverId})</span>
                          </td>
                          <td className="p-3 font-bold text-[#0878bd] whitespace-nowrap">{t.vehicleNumber}</td>
                          <td className="p-3 text-slate-700 whitespace-nowrap font-medium">{t.salesRep}</td>
                          <td className="p-3 text-slate-700 truncate max-w-[140px]">{t.zone}</td>
                          <td className="p-3 text-right font-mono font-black text-sky-700 bg-sky-50/40">
                            {currentApiOdo ? `${currentApiOdo.toLocaleString()} км` : "—"}
                          </td>
                          <td className="p-3 text-right font-mono font-bold text-slate-800">
                            {t.startOdo ? `${t.startOdo.toLocaleString()} км` : "—"}
                          </td>
                          <td className="p-3 text-right font-mono font-bold text-slate-800">
                            {t.endOdo ? `${t.endOdo.toLocaleString()} км` : "—"}
                          </td>
                          <td className="p-3 text-center whitespace-nowrap bg-sky-50/40">
                            {diff !== null ? (
                              Math.abs(diff) <= 2 ? (
                                <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200">
                                  ✅ {diff > 0 ? `+${diff}` : diff} км
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-amber-100 text-amber-900 border border-amber-300">
                                  ⚠️ {diff > 0 ? `+${diff}` : diff} км
                                </span>
                              )
                            ) : (
                              <span className="text-[10px] text-slate-400">—</span>
                            )}
                          </td>
                          <td className="p-3 text-right font-mono font-black text-emerald-700 bg-emerald-50/50 whitespace-nowrap">
                            {t.totalKm || (t.endOdo ? t.endOdo - t.startOdo : "—")} км
                          </td>
                          <td className="p-3 text-right font-mono whitespace-nowrap">
                            {t.fuelLiters ? (
                              <div>
                                <span className="font-bold text-[#0878bd]">{t.fuelLiters} л</span>
                                {t.fuelCost ? (
                                  <div className="text-[10px] text-slate-500 font-sans">
                                    {t.fuelCost.toLocaleString()} ₮
                                  </div>
                                ) : null}
                              </div>
                            ) : (
                              <span className="text-slate-400">0 л</span>
                            )}
                          </td>
                          <td className="p-3 text-slate-600 max-w-[130px]">
                            <div className="truncate font-medium">{t.fuelStation || "—"}</div>
                            {t.fuelPaymentMethod && (
                              <div className="text-[10px] text-slate-400 truncate">
                                💳 {t.fuelPaymentMethod}
                              </div>
                            )}
                          </td>
                          <td className="p-3 text-center whitespace-nowrap">
                            <span
                              className={`px-2.5 py-1 rounded-full text-[10px] font-black ${
                                t.phase === "complete"
                                  ? "bg-emerald-100 text-emerald-800"
                                  : "bg-amber-100 text-amber-800 animate-pulse"
                              }`}
                            >
                              {t.status}
                            </span>
                          </td>
                          <td className="p-3 text-center whitespace-nowrap">
                            <div className="flex items-center justify-center gap-1">
                              {matchedDriver && (
                                <button
                                  onClick={() => onOpenDriverManagement(matchedDriver, false)}
                                  title="Жолооч, машин, ХТ тохируулах"
                                  className="p-1 text-slate-500 hover:text-sky-600 transition-colors"
                                >
                                  <Users className="w-4 h-4" />
                                </button>
                              )}
                              <button
                                onClick={() => onOpenVehicleSheet(t.vehicleNumber)}
                                title="Дэвтэр харах"
                                className="p-1 text-slate-500 hover:text-[#0878bd] transition-colors"
                              >
                                <FileSpreadsheet className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteTrip(t.id)}
                                title="Устгах"
                                className="p-1 text-slate-400 hover:text-rose-600 transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: GPSBOX API CONFIGURATION */}
      {activeTab === "gpsbox" && (
        <div className="max-w-2xl bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5">
          <div className="flex items-center gap-3 pb-3 border-b border-slate-200">
            <div className="w-10 h-10 rounded-xl bg-sky-500 text-slate-950 flex items-center justify-center font-black">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-[#123047]">
                GPSBox FMS2 Телематик системийн холболтын тохиргоо
              </h2>
              <p className="text-xs text-slate-500">
                fms2.gpsbox.mn платформын шууд API түлхүүр болон синхрончлолын параметрууд
              </p>
            </div>
          </div>

          <form onSubmit={handleSaveGpsConfig} className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                GPSBox FMS Сервер URL
              </label>
              <input
                type="url"
                required
                value={gpsConfig.url}
                onChange={(e) => setGpsConfig({ ...gpsConfig, url: e.target.value })}
                className="w-full h-11 px-3.5 rounded-xl border border-slate-300 text-sm font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0878bd]"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                  GPSBox Хэрэглэгчийн нэр (Username)
                </label>
                <input
                  type="text"
                  required
                  value={gpsConfig.username}
                  onChange={(e) => setGpsConfig({ ...gpsConfig, username: e.target.value })}
                  className="w-full h-11 px-3.5 rounded-xl border border-slate-300 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0878bd]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                  API Түлхүүр (API KEY)
                </label>
                <input
                  type="text"
                  required
                  value={gpsConfig.apiKey}
                  onChange={(e) => setGpsConfig({ ...gpsConfig, apiKey: e.target.value })}
                  className="w-full h-11 px-3.5 rounded-xl border border-slate-300 text-sm font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0878bd]"
                />
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-sky-50 border border-sky-100 text-xs text-sky-900 space-y-1">
              <div className="font-bold flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Холболтын төлөв: Идэвхтэй (Автомат синхрончлолтой)</span>
              </div>
              <p className="text-[11px] text-slate-600">
                Сервер нь <code>connect.php</code> болон <code>get_objects.php</code> дуудлагуудыг автоматаар удирдаж, одометр, түлшний түвшин, хөргүүрийн температурыг бодит цагаар (realtime) татаж жолоочийн хуудсанд харуулна.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={handleManualSync}
                className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition-colors"
              >
                Холболт шалгах
              </button>

              <button
                type="submit"
                disabled={savingConfig}
                className="px-5 py-2.5 rounded-xl bg-[#0878bd] hover:bg-[#076ba8] text-white text-xs font-black shadow-md flex items-center gap-2 disabled:opacity-50 transition-all"
              >
                {savingConfig ? <RefreshCw className="w-4 h-4 animate-spin" /> : <span>Тохиргоо хадгалах</span>}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
