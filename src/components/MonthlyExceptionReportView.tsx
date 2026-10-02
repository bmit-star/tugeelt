import React, { useState, useEffect, useMemo } from "react";
import { API } from "../services/api";
import {
  Calendar,
  Filter,
  FileSpreadsheet,
  Printer,
  RefreshCw,
  Truck,
  Users,
  AlertTriangle,
  XCircle,
  Building2,
  CheckCircle2,
  ChevronRight,
  ShieldCheck,
  Search,
  DollarSign,
  X
} from "lucide-react";

interface Props {
  onShowToast: (msg: string, type?: "success" | "error" | "info") => void;
  onClose?: () => void;
}

export const MonthlyExceptionReportView: React.FC<Props> = ({
  onShowToast,
  onClose
}) => {
  // Asia/Ulaanbaatar default month (YYYY-MM)
  const getTodayMonthUb = () => {
    const d = new Date(Date.now() + 8 * 3600 * 1000);
    return d.toISOString().slice(0, 7);
  };

  const [selectedMonth, setSelectedMonth] = useState<string>(getTodayMonthUb());
  const [divisionFilter, setDivisionFilter] = useState<"all" | "IMT" | "IMD">("all");
  const [activeTab, setActiveTab] = useState<"vehicle_swaps" | "driver_swaps" | "non_departures">("vehicle_swaps");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);

  const [reportData, setReportData] = useState<{
    totalRecordedDays: number;
    totalAssignments: number;
    vehicleSwapsCount: number;
    driverSwapsCount: number;
    nonDeparturesCount: number;
    vehicleSwaps: any[];
    driverSwaps: any[];
    nonDepartures: any[];
  }>({
    totalRecordedDays: 0,
    totalAssignments: 0,
    vehicleSwapsCount: 0,
    driverSwapsCount: 0,
    nonDeparturesCount: 0,
    vehicleSwaps: [],
    driverSwaps: [],
    nonDepartures: []
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await API.getMonthlyExceptionReport(selectedMonth, divisionFilter);
      setReportData({
        totalRecordedDays: res.totalRecordedDays || 0,
        totalAssignments: res.totalAssignments || 0,
        vehicleSwapsCount: res.vehicleSwapsCount || 0,
        driverSwapsCount: res.driverSwapsCount || 0,
        nonDeparturesCount: res.nonDeparturesCount || 0,
        vehicleSwaps: res.vehicleSwaps || [],
        driverSwaps: res.driverSwaps || [],
        nonDepartures: res.nonDepartures || []
      });
    } catch (err: any) {
      onShowToast(err.message || "Сарын өөрчлөлтийн тайлан татахад алдаа гарлаа", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedMonth, divisionFilter]);

  // Filter current active list by search query
  const filteredList = useMemo(() => {
    let list: any[] = [];
    if (activeTab === "vehicle_swaps") list = reportData.vehicleSwaps || [];
    else if (activeTab === "driver_swaps") list = reportData.driverSwaps || [];
    else list = reportData.nonDepartures || [];

    if (!Array.isArray(list)) return [];
    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase().trim();
    return list.filter(item => {
      if (!item) return false;
      const matchRoute = (item.routeName || "").toLowerCase().includes(q) || (item.routeId || "").toLowerCase().includes(q);
      const matchPlate = (item.vehiclePlate || "").toLowerCase().includes(q) || (item.originalVehiclePlate || "").toLowerCase().includes(q) || (item.actualVehiclePlate || "").toLowerCase().includes(q);
      const matchDriver = (item.originalDriverName || "").toLowerCase().includes(q) || (item.actualDriverName || "").toLowerCase().includes(q);
      const matchSalesRep = (item.salesRep || "").toLowerCase().includes(q);
      const matchReason = (item.vehicleReason || item.driverReason || "").toLowerCase().includes(q);
      return matchRoute || matchPlate || matchDriver || matchSalesRep || matchReason;
    });
  }, [activeTab, reportData, searchQuery]);

  // Export to Excel (dynamically loads XLSX on demand)
  const handleExportExcel = async () => {
    try {
      const XLSX = await import("xlsx");
      const wb = XLSX.utils.book_new();

      // Sheet 1: Vehicle Swaps (Машин сольсон тайлан)
      const vData = (reportData.vehicleSwaps || []).map((row, idx) => ({
        "Д/д": idx + 1,
        "Огноо": row.businessDate || "-",
        "Харьяалал": row.vehicleDivision || "IMT",
        "Чиглэл": row.routeId || "-",
        "Бүсчлэл": row.routeName || "-",
        "Үндсэн тэрэг": row.originalVehiclePlate || "-",
        "Солигдсон тэрэг": row.actualVehiclePlate || row.vehiclePlate || "-",
        "Машины төлөв": row.vehicleStatus || "Засвартай",
        "Шалтгаан": row.vehicleReason || "",
        "Жолооч": row.actualDriverName || row.originalDriverName || "-",
        "Борлуулагч": row.salesRep || ""
      }));
      const wsV = XLSX.utils.json_to_sheet(vData);
      XLSX.utils.book_append_sheet(wb, wsV, "Машин_Сольсон");

      // Sheet 2: Driver Swaps (Жолооч сольсон тайлан)
      const dData = (reportData.driverSwaps || []).map((row, idx) => ({
        "Д/д": idx + 1,
        "Огноо": row.businessDate || "-",
        "Харьяалал": row.vehicleDivision || "IMT",
        "Чиглэл": row.routeId || "-",
        "Бүсчлэл": row.routeName || "-",
        "Машин": row.vehiclePlate || "-",
        "Үндсэн жолооч": row.originalDriverName || "-",
        "Явсан жолооч": row.actualDriverName || "-",
        "Жолоочийн төлөв": row.driverStatus || "Солигдсон",
        "Шалтгаан": row.driverReason || "",
        "Торгууль (₮)": 10000,
        "Борлуулагч": row.salesRep || ""
      }));
      const wsD = XLSX.utils.json_to_sheet(dData);
      XLSX.utils.book_append_sheet(wb, wsD, "Жолооч_Сольсон");

      // Sheet 3: Non-departures (Бүс гараагүй тайлан)
      const nData = (reportData.nonDepartures || []).map((row, idx) => ({
        "Д/д": idx + 1,
        "Огноо": row.businessDate || "-",
        "Харьяалал": row.vehicleDivision || "IMT",
        "Чиглэл": row.routeId || "-",
        "Бүсчлэл": row.routeName || "-",
        "Машин": row.vehiclePlate || "-",
        "Жолооч": row.originalDriverName || "-",
        "Чиглэлийн төлөв": row.routeStatus || "Гараагүй",
        "Машины шалтгаан": row.vehicleReason || "",
        "Жолоочийн шалтгаан": row.driverReason || "",
        "Борлуулагч": row.salesRep || ""
      }));
      const wsN = XLSX.utils.json_to_sheet(nData);
      XLSX.utils.book_append_sheet(wb, wsN, "Бүс_Гараагүй");

      XLSX.writeFile(wb, `Сар_бүрийн_өөрчлөлтийн_тайлан_${selectedMonth}.xlsx`);
      onShowToast("Excel файл амжилттай татагдлаа", "success");
    } catch (e: any) {
      onShowToast(e.message || "Excel татахад алдаа гарлаа", "error");
    }
  };

  // Print
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="bg-white/90 backdrop-blur-md p-6 rounded-3xl border border-slate-200/90 shadow-sm transition-all">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-pulse"></span>
              <h2 className="text-xl font-black text-slate-800 tracking-tight">
                Сар Бүрийн Өөрчлөлтийн Нэгдсэн Тайлан
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                {selectedMonth} Сар
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium">
              Машин сольсон, жолооч сольсон болон бүс гараагүй чиглэлүүдийн сарын нэгтгэсэн шалгалтын тайлан.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Month Picker */}
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl shadow-2xs">
              <Calendar className="w-4 h-4 text-slate-400" />
              <input
                type="month"
                value={selectedMonth}
                onChange={e => setSelectedMonth(e.target.value)}
                className="bg-transparent text-sm font-black text-slate-800 focus:outline-none cursor-pointer"
              />
            </div>

            {/* Division Filter */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-bold">
              <button
                onClick={() => setDivisionFilter("all")}
                className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                  divisionFilter === "all" ? "bg-white text-slate-800 shadow-2xs" : "text-slate-500 hover:text-slate-800"
                }`}
              >
                Бүх харьяалал
              </button>
              <button
                onClick={() => setDivisionFilter("IMT")}
                className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                  divisionFilter === "IMT" ? "bg-white text-sky-700 shadow-2xs font-black" : "text-slate-500 hover:text-slate-800"
                }`}
              >
                IMT Хот
              </button>
              <button
                onClick={() => setDivisionFilter("IMD")}
                className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                  divisionFilter === "IMD" ? "bg-white text-amber-700 shadow-2xs font-black" : "text-slate-500 hover:text-slate-800"
                }`}
              >
                IMD Орон нутаг
              </button>
            </div>

            {/* Excel Export */}
            <button
              onClick={handleExportExcel}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-bold text-xs transition-colors cursor-pointer"
              title="Excel татах"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span className="hidden sm:inline">Excel Татах</span>
            </button>

            {/* Print */}
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 font-bold text-xs transition-colors cursor-pointer"
              title="Хэвлэх"
            >
              <Printer className="w-4 h-4" />
              <span className="hidden sm:inline">Хэвлэх</span>
            </button>

            {/* Refresh */}
            <button
              onClick={loadData}
              disabled={loading}
              className="p-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-50 cursor-pointer"
              title="Шинэчлэх"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>

            {onClose && (
              <button
                onClick={onClose}
                className="p-2.5 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors cursor-pointer"
                title="Хаах"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* 4 Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 mt-6">
          {/* Card 1: Total recorded days */}
          <div className="bg-slate-50/80 p-3.5 rounded-2xl border border-slate-200/70 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center font-black">
              <Calendar className="w-5 h-5 text-slate-600" />
            </div>
            <div>
              <div className="text-[11px] font-bold text-slate-500 uppercase">Бүртгэгдсэн Өдөр</div>
              <div className="text-lg font-black text-slate-800">{reportData.totalRecordedDays} өдөр</div>
              <div className="text-[10px] text-slate-400">Нийт {reportData.totalAssignments} чиглэл бүртгэгдсэн</div>
            </div>
          </div>

          {/* Card 2: Vehicle Swaps */}
          <div
            onClick={() => setActiveTab("vehicle_swaps")}
            className={`p-3.5 rounded-2xl border flex items-center gap-3 cursor-pointer transition-all ${
              activeTab === "vehicle_swaps"
                ? "bg-purple-50/90 border-purple-300 ring-2 ring-purple-200"
                : "bg-purple-50/40 border-purple-200/60 hover:bg-purple-50"
            }`}
          >
            <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-black">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[11px] font-bold text-purple-900 uppercase">Машин Сольсон</div>
              <div className="text-lg font-black text-purple-950">{reportData.vehicleSwapsCount} удаа</div>
              <div className="text-[10px] text-purple-700 font-medium">Засвартай, техникийн саатал</div>
            </div>
          </div>

          {/* Card 3: Driver Swaps */}
          <div
            onClick={() => setActiveTab("driver_swaps")}
            className={`p-3.5 rounded-2xl border flex items-center gap-3 cursor-pointer transition-all ${
              activeTab === "driver_swaps"
                ? "bg-amber-50/90 border-amber-300 ring-2 ring-amber-200"
                : "bg-amber-50/40 border-amber-200/60 hover:bg-amber-50"
            }`}
          >
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-black">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[11px] font-bold text-amber-900 uppercase">Жолооч Сольсон</div>
              <div className="text-lg font-black text-amber-950">{reportData.driverSwapsCount} удаа</div>
              <div className="text-[10px] text-amber-700 font-medium">
                {(reportData.driverSwapsCount * 10000).toLocaleString()} ₮ торгууль
              </div>
            </div>
          </div>

          {/* Card 4: Non-departures */}
          <div
            onClick={() => setActiveTab("non_departures")}
            className={`p-3.5 rounded-2xl border flex items-center gap-3 cursor-pointer transition-all ${
              activeTab === "non_departures"
                ? "bg-rose-50/90 border-rose-300 ring-2 ring-rose-200"
                : "bg-rose-50/40 border-rose-200/60 hover:bg-rose-50"
            }`}
          >
            <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center font-black">
              <XCircle className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[11px] font-bold text-rose-900 uppercase">Бүс Гараагүй</div>
              <div className="text-lg font-black text-rose-950">{reportData.nonDeparturesCount} удаа</div>
              <div className="text-[10px] text-rose-700 font-medium">Гараагүй / Цуцалсан</div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs and Search Bar */}
      <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveTab("vehicle_swaps")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === "vehicle_swaps"
                ? "bg-purple-700 text-white shadow-xs font-black"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <Truck className="w-3.5 h-3.5" />
            <span>Машин Сольсон Тайлан</span>
            <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${
              activeTab === "vehicle_swaps" ? "bg-white/20 text-white" : "bg-purple-100 text-purple-800"
            }`}>
              {reportData.vehicleSwapsCount}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("driver_swaps")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === "driver_swaps"
                ? "bg-amber-600 text-white shadow-xs font-black"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Жолооч Сольсон Тайлан</span>
            <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${
              activeTab === "driver_swaps" ? "bg-white/20 text-white" : "bg-amber-100 text-amber-800"
            }`}>
              {reportData.driverSwapsCount}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("non_departures")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === "non_departures"
                ? "bg-rose-700 text-white shadow-xs font-black"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <XCircle className="w-3.5 h-3.5" />
            <span>Бүс Гараагүй Тайлан</span>
            <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${
              activeTab === "non_departures" ? "bg-white/20 text-white" : "bg-rose-100 text-rose-800"
            }`}>
              {reportData.nonDeparturesCount}
            </span>
          </button>
        </div>

        {/* Search */}
        <div className="relative min-w-[240px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Чиглэл, машин, жолооч, шалтгаан хайх..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-1.5 text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* Main Table Content */}
      <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          {activeTab === "vehicle_swaps" && (
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-purple-50/60 border-b border-purple-100 text-purple-900 font-bold uppercase tracking-wider text-[11px]">
                  <th className="p-3 pl-5">Д/д</th>
                  <th className="p-3">Огноо</th>
                  <th className="p-3">Харьяалал</th>
                  <th className="p-3">Чиглэл</th>
                  <th className="p-3">Бүсчлэл</th>
                  <th className="p-3">Үндсэн тэрэг</th>
                  <th className="p-3">Солигдсон тэрэг</th>
                  <th className="p-3">Машины төлөв</th>
                  <th className="p-3">Шалтгаан</th>
                  <th className="p-3">Жолооч</th>
                  <th className="p-3 pr-5">Борлуулагч</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {filteredList.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="py-12 text-center text-slate-400">
                      {loading ? (
                        <div className="flex items-center justify-center gap-2">
                          <RefreshCw className="w-4 h-4 animate-spin text-purple-600" />
                          <span>Тайлан уншиж байна...</span>
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
                          <div className="text-slate-600 font-bold">Сонгосон хугацаанд машин солигдсон бүртгэл байхгүй байна</div>
                        </div>
                      )}
                    </td>
                  </tr>
                ) : (
                  filteredList.map((row, idx) => (
                    <tr key={row.id || idx} className="hover:bg-purple-50/30 transition-colors">
                      <td className="p-3 pl-5 text-slate-400 font-mono text-[11px]">{idx + 1}</td>
                      <td className="p-3 font-mono font-bold text-slate-700 whitespace-nowrap">{row.businessDate}</td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-black ${
                          row.vehicleDivision === "IMD" ? "bg-amber-100 text-amber-800" : "bg-sky-100 text-sky-800"
                        }`}>
                          {row.vehicleDivision}
                        </span>
                      </td>
                      <td className="p-3 font-mono font-black text-purple-950">{row.routeId}</td>
                      <td className="p-3 text-slate-800 max-w-[200px] truncate" title={row.routeName}>{row.routeName}</td>
                      <td className="p-3 font-mono font-bold text-slate-500 line-through">{row.originalVehiclePlate}</td>
                      <td className="p-3 font-mono font-black text-purple-700 bg-purple-50/60 px-2 rounded">
                        {row.actualVehiclePlate || row.vehiclePlate}
                      </td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-800 border border-rose-200">
                          {row.vehicleStatus || "Засвартай"}
                        </span>
                      </td>
                      <td className="p-3 text-slate-600 max-w-[180px] truncate" title={row.vehicleReason}>
                        {row.vehicleReason || "-"}
                      </td>
                      <td className="p-3 font-bold text-slate-800">{row.actualDriverName || row.originalDriverName}</td>
                      <td className="p-3 pr-5 text-slate-600">{row.salesRep || "-"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}

          {activeTab === "driver_swaps" && (
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-amber-50/60 border-b border-amber-100 text-amber-900 font-bold uppercase tracking-wider text-[11px]">
                  <th className="p-3 pl-5">Д/д</th>
                  <th className="p-3">Огноо</th>
                  <th className="p-3">Харьяалал</th>
                  <th className="p-3">Чиглэл</th>
                  <th className="p-3">Бүсчлэл</th>
                  <th className="p-3">Машин</th>
                  <th className="p-3">Үндсэн жолооч</th>
                  <th className="p-3">Солигдож явсан жолооч</th>
                  <th className="p-3">Шалтгаан</th>
                  <th className="p-3">Торгууль</th>
                  <th className="p-3 pr-5">Борлуулагч</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {filteredList.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="py-12 text-center text-slate-400">
                      {loading ? (
                        <div className="flex items-center justify-center gap-2">
                          <RefreshCw className="w-4 h-4 animate-spin text-amber-600" />
                          <span>Тайлан уншиж байна...</span>
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
                          <div className="text-slate-600 font-bold">Сонгосон хугацаанд жолооч солигдсон бүртгэл байхгүй байна</div>
                        </div>
                      )}
                    </td>
                  </tr>
                ) : (
                  filteredList.map((row, idx) => (
                    <tr key={row.id || idx} className="hover:bg-amber-50/30 transition-colors">
                      <td className="p-3 pl-5 text-slate-400 font-mono text-[11px]">{idx + 1}</td>
                      <td className="p-3 font-mono font-bold text-slate-700 whitespace-nowrap">{row.businessDate}</td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-black ${
                          row.vehicleDivision === "IMD" ? "bg-amber-100 text-amber-800" : "bg-sky-100 text-sky-800"
                        }`}>
                          {row.vehicleDivision}
                        </span>
                      </td>
                      <td className="p-3 font-mono font-black text-amber-950">{row.routeId}</td>
                      <td className="p-3 text-slate-800 max-w-[200px] truncate" title={row.routeName}>{row.routeName}</td>
                      <td className="p-3 font-mono font-bold text-slate-700">{row.vehiclePlate}</td>
                      <td className="p-3 font-medium text-slate-500 line-through">{row.originalDriverName}</td>
                      <td className="p-3 font-bold text-amber-900 bg-amber-50/60 px-2 rounded">
                        {row.actualDriverName}
                      </td>
                      <td className="p-3 text-slate-600 max-w-[180px] truncate" title={row.driverReason}>
                        {row.driverReason || "-"}
                      </td>
                      <td className="p-3 font-mono font-black text-rose-600">
                        10,000 ₮
                      </td>
                      <td className="p-3 pr-5 text-slate-600">{row.salesRep || "-"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}

          {activeTab === "non_departures" && (
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-rose-50/60 border-b border-rose-100 text-rose-900 font-bold uppercase tracking-wider text-[11px]">
                  <th className="p-3 pl-5">Д/д</th>
                  <th className="p-3">Огноо</th>
                  <th className="p-3">Харьяалал</th>
                  <th className="p-3">Чиглэл</th>
                  <th className="p-3">Бүсчлэл</th>
                  <th className="p-3">Төлөв</th>
                  <th className="p-3">Үндсэн жолооч</th>
                  <th className="p-3">Үндсэн тэрэг</th>
                  <th className="p-3">Шалтгаан</th>
                  <th className="p-3 pr-5">Борлуулагч</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {filteredList.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-12 text-center text-slate-400">
                      {loading ? (
                        <div className="flex items-center justify-center gap-2">
                          <RefreshCw className="w-4 h-4 animate-spin text-rose-600" />
                          <span>Тайлан уншиж байна...</span>
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
                          <div className="text-slate-600 font-bold">Сонгосон хугацаанд бүс гараагүй/цуцлагдсан тохиолдол байхгүй байна</div>
                        </div>
                      )}
                    </td>
                  </tr>
                ) : (
                  filteredList.map((row, idx) => (
                    <tr key={row.id || idx} className="hover:bg-rose-50/30 transition-colors">
                      <td className="p-3 pl-5 text-slate-400 font-mono text-[11px]">{idx + 1}</td>
                      <td className="p-3 font-mono font-bold text-slate-700 whitespace-nowrap">{row.businessDate}</td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-black ${
                          row.vehicleDivision === "IMD" ? "bg-amber-100 text-amber-800" : "bg-sky-100 text-sky-800"
                        }`}>
                          {row.vehicleDivision}
                        </span>
                      </td>
                      <td className="p-3 font-mono font-black text-rose-950">{row.routeId}</td>
                      <td className="p-3 text-slate-800 max-w-[200px] truncate" title={row.routeName}>{row.routeName}</td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-800 border border-rose-200">
                          {row.routeStatus}
                        </span>
                      </td>
                      <td className="p-3 font-bold text-slate-800">{row.originalDriverName}</td>
                      <td className="p-3 font-mono font-bold text-slate-700">{row.vehiclePlate}</td>
                      <td className="p-3 text-rose-700 max-w-[220px] truncate" title={row.vehicleReason || row.driverReason}>
                        {row.vehicleReason || row.driverReason || "Шалтгаан тодорхойгүй"}
                      </td>
                      <td className="p-3 pr-5 text-slate-600">{row.salesRep || "-"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

export default MonthlyExceptionReportView;
