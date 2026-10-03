import React, { useState, useEffect, useMemo } from "react";
import { API } from "../services/api";
import { MonthlyExceptionReportView } from "./MonthlyExceptionReportView";
import {
  Calendar,
  Search,
  Filter,
  Save,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Truck,
  Users,
  Building2,
  FileSpreadsheet,
  AlertCircle,
  Clock,
  RotateCcw,
  FileText,
  Phone,
  XCircle,
  HelpCircle
} from "lucide-react";

interface DailyDriverAssignmentViewProps {
  onShowToast: (msg: string, type?: "success" | "error" | "info") => void;
  onOpenReport?: () => void;
}

interface MasterDriverOption {
  id: string;
  code: string;
  name: string;
  phone: string;
  vehicle: string;
  isIMD: boolean;
  division: "IMT" | "IMD";
}

interface AssignmentRow {
  id: string;
  businessDate: string;
  routeId: string;
  routeName: string;
  originalDriverId: string;
  originalDriverName: string;
  originalDriverCode: string;
  driverPhone?: string;
  driverStatus?: string;
  driverReason?: string;
  actualDriverId: string;
  actualDriverName: string;
  actualDriverCode: string;
  actualDriverPhone?: string;
  salesRep?: string;
  salesRepPhone?: string;
  srCode?: string;
  originalVehiclePlate: string;
  vehiclePlate: string;
  vehicleStatus?: string;
  vehicleReason?: string;
  actualVehiclePlate: string;
  vehicleChanged?: boolean;
  routeStatus?: string;
  driverChanged: boolean;
  vehicleDivision: "IMT" | "IMD";
  notes?: string;
}

export const DailyDriverAssignmentView: React.FC<DailyDriverAssignmentViewProps> = ({
  onShowToast,
  onOpenReport
}) => {
  // Asia/Ulaanbaatar default date (YYYY-MM-DD)
  const getTodayUb = () => {
    const d = new Date(Date.now() + 8 * 3600 * 1000);
    return d.toISOString().slice(0, 10);
  };

  const [mainTab, setMainTab] = useState<"daily_register" | "monthly_exceptions">("daily_register");
  const [selectedDate, setSelectedDate] = useState<string>(getTodayUb());
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [masterDrivers, setMasterDrivers] = useState<MasterDriverOption[]>([]);
  const [fineConfig, setFineConfig] = useState<any>({ defaultFineAmount: 10000 });
  const [isSavedInDb, setIsSavedInDb] = useState<boolean>(false);

  // Filters
  const [divisionFilter, setDivisionFilter] = useState<"all" | "IMT" | "IMD">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "changed" | "driver_issue" | "vehicle_issue" | "cancelled" | "normal">("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const loadAssignments = async (date: string) => {
    setLoading(true);
    try {
      const res = await API.getDailyAssignments(date);
      setAssignments(res.assignments || []);
      setMasterDrivers(res.masterDrivers || []);
      setIsSavedInDb(res.isSaved || false);
      if (res.fineConfig) {
        setFineConfig(res.fineConfig);
      }
    } catch (err: any) {
      onShowToast(err.message || "Өдрийн хуваарилалт татахад алдаа гарлаа", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAssignments(selectedDate);
  }, [selectedDate]);

  // Handle actual driver change
  const handleDriverChange = (routeId: string, newDriverId: string) => {
    const selectedMaster = masterDrivers.find(d => d.id === newDriverId);
    if (!selectedMaster) return;

    setAssignments(prev =>
      prev.map(row => {
        if (row.routeId === routeId) {
          const isChanged = (row.originalDriverName || "").trim().toLowerCase() !== (selectedMaster.name || "").trim().toLowerCase();
          return {
            ...row,
            actualDriverId: selectedMaster.id,
            actualDriverName: selectedMaster.name,
            actualDriverCode: selectedMaster.code,
            actualDriverPhone: selectedMaster.phone || row.driverPhone,
            driverChanged: isChanged,
            driverStatus: isChanged ? (row.driverStatus === "Идэвхтэй" ? "Солигдсон" : row.driverStatus) : "Идэвхтэй"
          };
        }
        return row;
      })
    );
  };

  // Handle actual vehicle change
  const handleVehicleChange = (routeId: string, newPlate: string) => {
    const cleanPlate = newPlate.trim().toUpperCase();
    setAssignments(prev =>
      prev.map(row => {
        if (row.routeId === routeId) {
          const origClean = (row.originalVehiclePlate || "").replace(/\s+/g, "").toUpperCase();
          const newClean = cleanPlate.replace(/\s+/g, "").toUpperCase();
          const isChanged = Boolean(cleanPlate && origClean !== newClean);
          return {
            ...row,
            actualVehiclePlate: cleanPlate,
            vehiclePlate: cleanPlate || row.originalVehiclePlate,
            vehicleChanged: isChanged,
            vehicleStatus: isChanged ? (row.vehicleStatus === "Хэвийн" ? "Засвартай" : row.vehicleStatus) : row.vehicleStatus
          };
        }
        return row;
      })
    );
  };

  // Handle row field change
  const handleRowFieldChange = (routeId: string, field: keyof AssignmentRow, value: any) => {
    setIsSavedInDb(false);
    setAssignments(prev =>
      prev.map(row => {
        if (row.routeId === routeId) {
          return {
            ...row,
            [field]: value
          };
        }
        return row;
      })
    );
  };

  // Reset a vehicle's driver to original
  const handleResetToOriginal = (routeId: string) => {
    setAssignments(prev =>
      prev.map(row => {
        if (row.routeId === routeId) {
          return {
            ...row,
            actualDriverId: row.originalDriverId,
            actualDriverName: row.originalDriverName,
            actualDriverCode: row.originalDriverCode,
            actualDriverPhone: row.driverPhone,
            actualVehiclePlate: row.originalVehiclePlate,
            vehiclePlate: row.originalVehiclePlate,
            driverChanged: false,
            vehicleChanged: false,
            driverStatus: "Идэвхтэй",
            driverReason: "",
            vehicleStatus: "Хэвийн",
            vehicleReason: "",
            routeStatus: "Гарсан"
          };
        }
        return row;
      })
    );
  };

  // Save all assignments
  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await API.saveDailyAssignments(selectedDate, assignments, fineConfig);
      setIsSavedInDb(true);
      onShowToast(
        `${selectedDate} өдрийн бүртгэл амжилттай хадгалагдлаа! (${res.finesGeneratedCount} жолооч солигдсон торгууль үүсэв)`,
        "success"
      );
      loadAssignments(selectedDate);
    } catch (err: any) {
      onShowToast(err.message || "Хадгалахад алдаа гарлаа", "error");
    } finally {
      setSaving(false);
    }
  };

  // Filtered rows
  const filteredAssignments = useMemo(() => {
    return assignments.filter(item => {
      // Division filter
      if (divisionFilter !== "all" && item.vehicleDivision !== divisionFilter) {
        return false;
      }

      // Status filter
      if (statusFilter === "changed" && !item.driverChanged && !item.vehicleChanged) return false;
      if (statusFilter === "driver_issue" && (item.driverStatus === "Идэвхтэй" || !item.driverStatus)) return false;
      if (statusFilter === "vehicle_issue" && (item.vehicleStatus === "Хэвийн" || !item.vehicleStatus)) return false;
      if (statusFilter === "cancelled" && item.routeStatus === "Гарсан") return false;
      if (statusFilter === "normal" && (item.driverChanged || item.vehicleChanged || item.routeStatus !== "Гарсан")) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchPlate = (item.vehiclePlate || "").toLowerCase().includes(q) || (item.originalVehiclePlate || "").toLowerCase().includes(q);
        const matchOrig = (item.originalDriverName || "").toLowerCase().includes(q) || (item.originalDriverCode || "").toLowerCase().includes(q);
        const matchAct = (item.actualDriverName || "").toLowerCase().includes(q) || (item.actualDriverCode || "").toLowerCase().includes(q);
        const matchRoute = (item.routeName || "").toLowerCase().includes(q) || (item.routeId || "").toLowerCase().includes(q);
        const matchSalesRep = (item.salesRep || "").toLowerCase().includes(q) || (item.srCode || "").toLowerCase().includes(q);
        return matchPlate || matchOrig || matchAct || matchRoute || matchSalesRep;
      }

      return true;
    });
  }, [assignments, divisionFilter, statusFilter, searchQuery]);

  // Statistics exactly matching image.png:
  // 1. Нийт чиглэл (Total Routes)
  const totalCount = assignments.length;
  // 2. Жолоочийн асуудал (Driver Issues)
  const driverIssuesCount = assignments.filter(a => a.driverStatus && a.driverStatus !== "Идэвхтэй").length;
  // 3. Машины асуудал (Vehicle Issues)
  const vehicleIssuesCount = assignments.filter(a => (a.vehicleStatus && a.vehicleStatus !== "Хэвийн") || a.vehicleChanged).length;
  // 4. Гараагүй/Цуцалсан (Non-departures)
  const nonDeparturesCount = assignments.filter(a => a.routeStatus && a.routeStatus !== "Гарсан").length;
  // 5. Өөрчилсөн (Changed)
  const changedCount = assignments.filter(a => a.driverChanged || a.vehicleChanged).length;

  const imtCount = assignments.filter(a => a.vehicleDivision === "IMT").length;
  const imdCount = assignments.filter(a => a.vehicleDivision === "IMD").length;

  return (
    <div className="space-y-6">
      {/* Primary Sub-Navigation Bar */}
      <div className="bg-white p-2 rounded-2xl border border-slate-200/90 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
          <button
            onClick={() => setMainTab("daily_register")}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              mainTab === "daily_register"
                ? "bg-[#0878bd] text-white shadow-xs font-black"
                : "text-slate-700 bg-sky-50/70 hover:bg-sky-100"
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span>Өдрийн Жолооч & Машины Бүртгэл</span>
          </button>

          <button
            onClick={() => setMainTab("monthly_exceptions")}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              mainTab === "monthly_exceptions"
                ? "bg-purple-700 text-white shadow-xs font-black"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Сар Бүрийн Өөрчлөлтийн Тайлан (Машин, Жолооч, Бүс)</span>
          </button>
        </div>

        {onOpenReport && (
          <button
            onClick={onOpenReport}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100 font-bold text-xs transition-colors cursor-pointer shrink-0"
            title="Торгуулийн матриц тайлан"
          >
            <FileText className="w-3.5 h-3.5 text-amber-700" />
            <span>Торгуулийн Сарын Матриц</span>
          </button>
        )}
      </div>

      {mainTab === "monthly_exceptions" ? (
        <MonthlyExceptionReportView onShowToast={onShowToast} />
      ) : (
        <>
          {/* Top Banner / Luxury Controls */}
          <div className="bg-white/80 backdrop-blur-md p-6 rounded-3xl border border-slate-200/80 shadow-sm transition-all">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  <h2 className="text-xl font-black text-slate-800 tracking-tight">
                    Өдрийн Жолоочийн Бүртгэл & Чиглэлийн Төлөв
                  </h2>
                  {isSavedInDb ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Баталгаажсан
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
                      <Clock className="w-3.5 h-3.5" /> Хадгалагдаагүй
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 font-medium">
                  Өдөр бүр ямар машин дээр ямар жолооч явсныг бүртгэнэ. Бүртгэгдсэн төлөв <code className="px-1.5 py-0.5 bg-sky-50 text-sky-800 rounded font-bold font-mono">/sales</code> хэсэгт бодит цагаар харагдана.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                {/* Date Picker */}
                <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl shadow-2xs">
                  <Calendar className="w-4 h-4 text-slate-400" />
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={e => setSelectedDate(e.target.value)}
                    className="bg-transparent text-sm font-black text-slate-800 focus:outline-none cursor-pointer"
                  />
                </div>

                {/* Refresh */}
                <button
                  onClick={() => loadAssignments(selectedDate)}
                  disabled={loading}
                  className="p-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-50 cursor-pointer"
                  title="Шинэчлэх"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                </button>

                {/* Save Button */}
                <button
                  onClick={handleSave}
                  disabled={saving || loading}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#0878bd] hover:bg-[#076ba8] text-white font-bold text-xs shadow-sm hover:shadow transition-all disabled:opacity-50 cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>{saving ? "Хадгалж байна..." : "Өдрийн Бүртгэл Хадгалах"}</span>
                </button>
              </div>
            </div>

            {/* 5 Stats Cards Row matching image.png */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5 mt-6">
              {/* Card 1: Нийт чиглэл */}
              <div className="bg-slate-50/80 p-3.5 rounded-2xl border border-slate-200/70 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-slate-200/80 text-slate-700 flex items-center justify-center font-black">
                  <Truck className="w-5 h-5 text-slate-700" />
                </div>
                <div>
                  <div className="text-[11px] font-bold text-slate-500 uppercase">Нийт чиглэл</div>
                  <div className="text-xl font-black text-slate-800">{totalCount}</div>
                  <div className="text-[10px] text-slate-400">Нийт хуваарилагдсан</div>
                </div>
              </div>

              {/* Card 2: Жолоочийн асуудал */}
              <div className={`p-3.5 rounded-2xl border flex items-center gap-3 transition-colors ${
                driverIssuesCount > 0 ? "bg-amber-50/90 border-amber-300" : "bg-slate-50/80 border-slate-200/70"
              }`}>
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black ${
                  driverIssuesCount > 0 ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-400"
                }`}>
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <div className={`text-[11px] font-bold uppercase ${driverIssuesCount > 0 ? "text-amber-900" : "text-slate-500"}`}>
                    Жолоочийн асуудал
                  </div>
                  <div className={`text-xl font-black ${driverIssuesCount > 0 ? "text-amber-950" : "text-slate-700"}`}>
                    {driverIssuesCount}
                  </div>
                  <div className="text-[10px] text-amber-700 font-medium">Чөлөө, эмнэлэг гэх мэт</div>
                </div>
              </div>

              {/* Card 3: Машины асуудал */}
              <div className={`p-3.5 rounded-2xl border flex items-center gap-3 transition-colors ${
                vehicleIssuesCount > 0 ? "bg-purple-50/90 border-purple-300" : "bg-slate-50/80 border-slate-200/70"
              }`}>
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black ${
                  vehicleIssuesCount > 0 ? "bg-purple-100 text-purple-800" : "bg-slate-100 text-slate-400"
                }`}>
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <div className={`text-[11px] font-bold uppercase ${vehicleIssuesCount > 0 ? "text-purple-900" : "text-slate-500"}`}>
                    Машины асуудал
                  </div>
                  <div className={`text-xl font-black ${vehicleIssuesCount > 0 ? "text-purple-950" : "text-slate-700"}`}>
                    {vehicleIssuesCount}
                  </div>
                  <div className="text-[10px] text-purple-700 font-medium">Засвар, үйлчилгээтэй</div>
                </div>
              </div>

              {/* Card 4: Гараагүй/Цуцалсан */}
              <div className={`p-3.5 rounded-2xl border flex items-center gap-3 transition-colors ${
                nonDeparturesCount > 0 ? "bg-rose-50/90 border-rose-300" : "bg-slate-50/80 border-slate-200/70"
              }`}>
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black ${
                  nonDeparturesCount > 0 ? "bg-rose-100 text-rose-800" : "bg-slate-100 text-slate-400"
                }`}>
                  <XCircle className="w-5 h-5" />
                </div>
                <div>
                  <div className={`text-[11px] font-bold uppercase ${nonDeparturesCount > 0 ? "text-rose-900" : "text-slate-500"}`}>
                    Гараагүй/Цуцалсан
                  </div>
                  <div className={`text-xl font-black ${nonDeparturesCount > 0 ? "text-rose-950" : "text-slate-700"}`}>
                    {nonDeparturesCount}
                  </div>
                  <div className="text-[10px] text-rose-700 font-medium">Ажиллаагүй чиглэл</div>
                </div>
              </div>

              {/* Card 5: Өөрчилсөн */}
              <div className={`p-3.5 rounded-2xl border flex items-center gap-3 transition-colors ${
                changedCount > 0 ? "bg-sky-50/90 border-sky-300" : "bg-slate-50/80 border-slate-200/70"
              }`}>
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black ${
                  changedCount > 0 ? "bg-sky-100 text-sky-800" : "bg-slate-100 text-slate-400"
                }`}>
                  <RotateCcw className="w-5 h-5" />
                </div>
                <div>
                  <div className={`text-[11px] font-bold uppercase ${changedCount > 0 ? "text-sky-900" : "text-slate-500"}`}>
                    Өөрчилсөн
                  </div>
                  <div className={`text-xl font-black ${changedCount > 0 ? "text-sky-950" : "text-slate-700"}`}>
                    {changedCount}
                  </div>
                  <div className="text-[10px] text-sky-700 font-medium">Нийт солигдсон</div>
                </div>
              </div>
            </div>
          </div>

          {/* Filter / Search Bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              {/* Division Filter */}
              <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-bold">
                <button
                  onClick={() => setDivisionFilter("all")}
                  className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                    divisionFilter === "all" ? "bg-white text-slate-800 shadow-2xs" : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  Бүгд ({assignments.length})
                </button>
                <button
                  onClick={() => setDivisionFilter("IMT")}
                  className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                    divisionFilter === "IMT" ? "bg-white text-sky-700 shadow-2xs font-black" : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  IMT Хот ({imtCount})
                </button>
                <button
                  onClick={() => setDivisionFilter("IMD")}
                  className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                    divisionFilter === "IMD" ? "bg-white text-amber-700 shadow-2xs font-black" : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  IMD Орон нутаг ({imdCount})
                </button>
              </div>

              {/* Status Filter */}
              <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-bold overflow-x-auto no-scrollbar">
                <button
                  onClick={() => setStatusFilter("all")}
                  className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                    statusFilter === "all" ? "bg-white text-slate-800 shadow-2xs" : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  Бүгд
                </button>
                <button
                  onClick={() => setStatusFilter("changed")}
                  className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                    statusFilter === "changed" ? "bg-sky-100 text-sky-900 shadow-2xs font-black" : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  Солигдсон ({changedCount})
                </button>
                <button
                  onClick={() => setStatusFilter("driver_issue")}
                  className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                    statusFilter === "driver_issue" ? "bg-amber-100 text-amber-900 shadow-2xs font-black" : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  Жолоочийн асуудал ({driverIssuesCount})
                </button>
                <button
                  onClick={() => setStatusFilter("vehicle_issue")}
                  className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                    statusFilter === "vehicle_issue" ? "bg-purple-100 text-purple-900 shadow-2xs font-black" : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  Машины асуудал ({vehicleIssuesCount})
                </button>
                <button
                  onClick={() => setStatusFilter("cancelled")}
                  className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                    statusFilter === "cancelled" ? "bg-rose-100 text-rose-900 shadow-2xs font-black" : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  Гараагүй ({nonDeparturesCount})
                </button>
              </div>
            </div>

            {/* Search Input */}
            <div className="relative min-w-[240px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Машин, жолооч, чиглэл, борлуулагч..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-1.5 text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-sky-500"
              />
            </div>
          </div>

          {/* Main Table matching image.png */}
          <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50/90 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                    <th className="p-3 pl-4 whitespace-nowrap">Д/д</th>
                    <th className="p-3 whitespace-nowrap">Чиглэл</th>
                    <th className="p-3 min-w-[140px]">Бүсчлэл</th>
                    <th className="p-3 whitespace-nowrap">Үндсэн жолооч</th>
                    <th className="p-3 min-w-[115px]">Утас</th>
                    <th className="p-3 min-w-[110px]">Төлөв</th>
                    <th className="p-3 min-w-[120px]">Шалтгаан</th>
                    <th className="p-3 min-w-[160px]">Орлон явсан жолооч</th>
                    <th className="p-3 min-w-[140px]">Борлуулагч</th>
                    <th className="p-3 min-w-[115px]">Утас</th>
                    <th className="p-3 min-w-[85px]">СР Код</th>
                    <th className="p-3 whitespace-nowrap">Үндсэн тэрэг</th>
                    <th className="p-3 min-w-[110px]">Төлөв</th>
                    <th className="p-3 min-w-[120px]">Шалтгаан</th>
                    <th className="p-3 min-w-[120px]">Орлон явсан тэрэг</th>
                    <th className="p-3 min-w-[100px] pr-4">Чиглэлийн төлөв</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {loading ? (
                    <tr>
                      <td colSpan={16} className="py-16 text-center text-slate-400">
                        <div className="flex items-center justify-center gap-2">
                          <RefreshCw className="w-4 h-4 animate-spin text-sky-600" />
                          <span>Өдрийн бүртгэлийг уншиж байна...</span>
                        </div>
                      </td>
                    </tr>
                  ) : filteredAssignments.length === 0 ? (
                    <tr>
                      <td colSpan={16} className="py-16 text-center text-slate-400">
                        Бүртгэл олдсонгүй
                      </td>
                    </tr>
                  ) : (
                    filteredAssignments.map((row, idx) => {
                      const isDriverDifferent = row.driverChanged;
                      const isVehicleDifferent = row.vehicleChanged;

                      return (
                        <tr
                          key={row.routeId || row.id || idx}
                          className={`hover:bg-slate-50/80 transition-colors ${
                            isDriverDifferent || isVehicleDifferent ? "bg-amber-50/20" : ""
                          }`}
                        >
                          {/* Д/д */}
                          <td className="p-3 pl-4 text-slate-400 font-mono text-[11px]">
                            {idx + 1}
                          </td>

                          {/* Чиглэл (KA1, M1, etc) */}
                          <td className="p-3 font-mono font-black text-slate-900 whitespace-nowrap">
                            <span className="flex items-center gap-1">
                              <span className={`w-1.5 h-1.5 rounded-full ${
                                row.vehicleDivision === "IMD" ? "bg-amber-500" : "bg-sky-500"
                              }`}></span>
                              {row.routeId}
                            </span>
                          </td>

                          {/* Бүсчлэл */}
                          <td className="p-3 text-slate-700 max-w-[180px] truncate" title={row.routeName}>
                            {row.routeName}
                          </td>

                          {/* Үндсэн жолооч */}
                          <td className="p-3 font-bold text-slate-800 whitespace-nowrap">
                            {row.originalDriverName}
                          </td>

                          {/* Жолоочийн Утас */}
                          <td className="p-3">
                            <input
                              type="text"
                              placeholder="Утас..."
                              value={row.driverPhone || ""}
                              onChange={e => handleRowFieldChange(row.routeId, "driverPhone", e.target.value)}
                              className="w-full min-w-[95px] max-w-[115px] bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-mono font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-sky-500 placeholder-slate-400 transition-colors shadow-2xs"
                              title="Жолоочийн утасны дугаар"
                            />
                          </td>

                          {/* Жолоочийн Төлөв */}
                          <td className="p-3">
                            <select
                              value={row.driverStatus || "Идэвхтэй"}
                              onChange={e => handleRowFieldChange(row.routeId, "driverStatus", e.target.value)}
                              className={`w-full py-1 px-1.5 rounded-lg border text-xs font-bold cursor-pointer focus:outline-none ${
                                row.driverStatus === "Идэвхтэй" || !row.driverStatus
                                  ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                                  : row.driverStatus === "Солигдсон"
                                  ? "bg-amber-50 text-amber-900 border-amber-300"
                                  : "bg-rose-50 text-rose-800 border-rose-200"
                              }`}
                            >
                              <option value="Идэвхтэй">Идэвхтэй</option>
                              <option value="Солигдсон">Солигдсон</option>
                              <option value="Чөлөөтэй">Чөлөөтэй</option>
                              <option value="Өвчтэй">Өвчтэй</option>
                              <option value="Тасалсан">Тасалсан</option>
                            </select>
                          </td>

                          {/* Жолоочийн Шалтгаан */}
                          <td className="p-3">
                            <input
                              type="text"
                              placeholder="Шалтгаан..."
                              value={row.driverReason || ""}
                              onChange={e => handleRowFieldChange(row.routeId, "driverReason", e.target.value)}
                              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-sky-500 placeholder-slate-400"
                            />
                          </td>

                          {/* Орлон явсан жолооч */}
                          <td className="p-3">
                            <div className="flex items-center gap-1.5">
                              <select
                                value={row.actualDriverId || row.originalDriverId}
                                onChange={e => handleDriverChange(row.routeId, e.target.value)}
                                className={`w-full py-1 px-2 rounded-lg border text-xs font-bold cursor-pointer focus:outline-none ${
                                  isDriverDifferent
                                    ? "bg-amber-100/90 text-amber-950 border-amber-400 ring-1 ring-amber-300"
                                    : "bg-slate-50 border-slate-200 text-slate-800"
                                }`}
                              >
                                {masterDrivers.map(d => (
                                  <option key={d.id} value={d.id}>
                                    {d.name} ({d.code})
                                  </option>
                                ))}
                              </select>

                              {isDriverDifferent && (
                                <button
                                  onClick={() => handleResetToOriginal(row.routeId)}
                                  className="p-1 rounded-md text-amber-700 hover:bg-amber-100 transition-colors cursor-pointer shrink-0"
                                  title="Үндсэн жолооч руу буцаах"
                                >
                                  <RotateCcw className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>

                          {/* Борлуулагч */}
                          <td className="p-3">
                            <input
                              type="text"
                              placeholder="Борлуулагч..."
                              value={row.salesRep || ""}
                              onChange={e => handleRowFieldChange(row.routeId, "salesRep", e.target.value)}
                              className="w-full min-w-[120px] max-w-[155px] bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-sky-500 placeholder-slate-400 transition-colors shadow-2xs"
                              title="Борлуулагчийн нэр"
                            />
                          </td>

                          {/* Борлуулагчийн Утас */}
                          <td className="p-3">
                            <input
                              type="text"
                              placeholder="Утас..."
                              value={row.salesRepPhone || ""}
                              onChange={e => handleRowFieldChange(row.routeId, "salesRepPhone", e.target.value)}
                              className="w-full min-w-[95px] max-w-[115px] bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-mono font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-sky-500 placeholder-slate-400 transition-colors shadow-2xs"
                              title="Борлуулагчийн утасны дугаар"
                            />
                          </td>

                          {/* СР Код */}
                          <td className="p-3">
                            <input
                              type="text"
                              placeholder="СР..."
                              value={row.srCode || ""}
                              onChange={e => handleRowFieldChange(row.routeId, "srCode", e.target.value)}
                              className="w-full min-w-[65px] max-w-[85px] bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-mono font-medium text-slate-600 focus:outline-none focus:ring-1 focus:ring-sky-500 placeholder-slate-400 transition-colors shadow-2xs"
                              title="Худалдааны төлөөлөгчийн код"
                            />
                          </td>

                          {/* Үндсэн тэрэг */}
                          <td className="p-3 font-mono font-bold text-slate-800 whitespace-nowrap">
                            {row.originalVehiclePlate}
                          </td>

                          {/* Машины Төлөв */}
                          <td className="p-3">
                            <select
                              value={row.vehicleStatus || "Хэвийн"}
                              onChange={e => handleRowFieldChange(row.routeId, "vehicleStatus", e.target.value)}
                              className={`w-full py-1 px-1.5 rounded-lg border text-xs font-bold cursor-pointer focus:outline-none ${
                                row.vehicleStatus === "Хэвийн" || !row.vehicleStatus
                                  ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                                  : "bg-purple-50 text-purple-900 border-purple-300"
                              }`}
                            >
                              <option value="Хэвийн">Хэвийн</option>
                              <option value="Засвартай">Засвартай</option>
                              <option value="Техникийн саатал">Техникийн саатал</option>
                              <option value="Гүйлт дууссан">Гүйлт дууссан</option>
                              <option value="Осолтой">Осолтой</option>
                            </select>
                          </td>

                          {/* Машины Шалтгаан */}
                          <td className="p-3">
                            <input
                              type="text"
                              placeholder="Эвдрэл, засвар..."
                              value={row.vehicleReason || ""}
                              onChange={e => handleRowFieldChange(row.routeId, "vehicleReason", e.target.value)}
                              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-sky-500 placeholder-slate-400"
                            />
                          </td>

                          {/* Орлон явсан тэрэг */}
                          <td className="p-3">
                            <input
                              type="text"
                              placeholder="Тэрэгний дугаар..."
                              value={row.actualVehiclePlate || row.originalVehiclePlate || ""}
                              onChange={e => handleVehicleChange(row.routeId, e.target.value)}
                              className={`w-full py-1 px-2 rounded-lg border text-xs font-mono font-bold focus:outline-none ${
                                isVehicleDifferent
                                  ? "bg-purple-100 text-purple-950 border-purple-400 ring-1 ring-purple-300"
                                  : "bg-slate-50 border-slate-200 text-slate-800"
                              }`}
                            />
                          </td>

                          {/* Чиглэлийн төлөв */}
                          <td className="p-3 pr-4">
                            <select
                              value={row.routeStatus || "Гарсан"}
                              onChange={e => handleRowFieldChange(row.routeId, "routeStatus", e.target.value)}
                              className={`w-full py-1 px-2 rounded-lg border text-xs font-bold cursor-pointer focus:outline-none ${
                                row.routeStatus === "Гарсан" || !row.routeStatus
                                  ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                                  : "bg-rose-50 text-rose-900 border-rose-300"
                              }`}
                            >
                              <option value="Гарсан">Гарсан</option>
                              <option value="Гараагүй">Гараагүй</option>
                              <option value="Цуцалсан">Цуцалсан</option>
                              <option value="Хойшилсон">Хойшилсон</option>
                            </select>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
