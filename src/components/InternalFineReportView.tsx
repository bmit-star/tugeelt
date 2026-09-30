import React, { useState, useEffect, useMemo, useRef } from "react";
import { API } from "../services/api";
import {
  FileSpreadsheet,
  Calendar,
  Filter,
  Printer,
  Download,
  Search,
  Building2,
  Users,
  AlertTriangle,
  FileText,
  Grid,
  CheckCircle2,
  RefreshCw,
  Clock,
  Sparkles,
  ChevronRight,
  ShieldAlert,
  ArrowRight
} from "lucide-react";

interface InternalFineReportViewProps {
  onShowToast: (msg: string, type?: "success" | "error" | "info") => void;
  onBackToDaily?: () => void;
}

export const InternalFineReportView: React.FC<InternalFineReportViewProps> = ({
  onShowToast,
  onBackToDaily
}) => {
  // Current UB month (YYYY-MM) and date (YYYY-MM-DD)
  const getCurMonth = () => {
    const d = new Date(Date.now() + 8 * 3600 * 1000);
    return d.toISOString().slice(0, 7);
  };
  const getCurDate = () => {
    const d = new Date(Date.now() + 8 * 3600 * 1000);
    return d.toISOString().slice(0, 10);
  };

  const [selectedMonth, setSelectedMonth] = useState<string>(getCurMonth());
  const [selectedDivision, setSelectedDivision] = useState<"all" | "IMT" | "IMD">("all");
  const [activeTab, setActiveTab] = useState<"matrix" | "list" | "signature" | "print">("matrix");
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>("");

  // 23:00 Night Audit state
  const [auditLoading, setAuditLoading] = useState<boolean>(false);
  const [auditStatus, setAuditStatus] = useState<{
    lastResult: any;
    lastAuditedDate: string;
    serverUbTime: string;
    serverUbDate?: string;
  } | null>(null);

  // Client-side cache to leverage client device memory and reduce server requests
  const reportCacheRef = useRef<Map<string, { data: any; timestamp: number }>>(new Map());

  const [reportData, setReportData] = useState<{
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
  }>({
    summary: {
      totalFines: 0,
      totalAmount: 0,
      imtCount: 0,
      imtAmount: 0,
      imdCount: 0,
      imdAmount: 0,
      daysInMonth: 30
    },
    records: [],
    monthlyMatrix: [],
    signatureReport: []
  });

  // Load 23:00 Audit Status
  const loadAuditStatus = async () => {
    try {
      const res = await API.get2300FineAuditStatus();
      if (res.success) {
        setAuditStatus({
          lastResult: res.lastResult,
          lastAuditedDate: res.lastAuditedDate,
          serverUbTime: res.serverUbTime,
          serverUbDate: (res as any).serverUbDate
        });
      }
    } catch (e) {
      // Non-critical, ignore
    }
  };

  // Trigger 23:00 Nightly Fine Audit manually
  const handleRun2300Audit = async () => {
    setAuditLoading(true);
    try {
      onShowToast("23:00 цагийн торгуулийн шалгалтыг эхлүүлж байна...", "info");
      const res = await API.run2300FineAudit(selectedMonth === getCurMonth() ? getCurDate() : `${selectedMonth}-01`);
      if (res.success) {
        const { scannedVehicles, detectedViolations, newFinesCreated } = res.result;
        onShowToast(
          `Шалгалт амжилттай: ${scannedVehicles} машин шалгаж, ${detectedViolations} зөрчил илрүүлж, ${newFinesCreated} шинэ торгууль бүртгэлээ.`,
          "success"
        );
        // Clear cache and reload report
        reportCacheRef.current.clear();
        loadReport(true);
        loadAuditStatus();
      }
    } catch (err: any) {
      onShowToast(err.message || "23:00 цагийн шалгалт хийхэд алдаа гарлаа", "error");
    } finally {
      setAuditLoading(false);
    }
  };

  const loadReport = async (forceRefresh = false) => {
    const cacheKey = `${selectedMonth}|${selectedDivision}`;
    const cached = reportCacheRef.current.get(cacheKey);
    const now = Date.now();

    // Use client device cache if within 3 minutes and not forced
    if (!forceRefresh && cached && now - cached.timestamp < 3 * 60 * 1000) {
      setReportData(cached.data);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const res = await API.getInternalFineReport({
        month: selectedMonth,
        division: selectedDivision
      });

      const dataToSave = {
        summary: res.summary || {
          totalFines: 0,
          totalAmount: 0,
          imtCount: 0,
          imtAmount: 0,
          imdCount: 0,
          imdAmount: 0,
          daysInMonth: 30
        },
        records: res.records || [],
        monthlyMatrix: res.monthlyMatrix || [],
        signatureReport: res.signatureReport || []
      };

      setReportData(dataToSave);
      reportCacheRef.current.set(cacheKey, { data: dataToSave, timestamp: now });
    } catch (err: any) {
      onShowToast(err.message || "Тайлан татахад алдаа гарлаа", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReport();
    loadAuditStatus();
  }, [selectedMonth, selectedDivision]);

  // Handle print with company division selection
  const handlePrint = (divisionToPrint?: "all" | "IMT" | "IMD") => {
    if (divisionToPrint && divisionToPrint !== selectedDivision) {
      setSelectedDivision(divisionToPrint);
      setTimeout(() => {
        window.print();
      }, 300);
    } else {
      window.print();
    }
  };

  // Filtered matrix rows (client-side high-speed filtering)
  const filteredMatrix = useMemo(() => {
    if (!searchQuery.trim()) return reportData.monthlyMatrix;
    const q = searchQuery.toLowerCase().trim();
    return reportData.monthlyMatrix.filter(row => {
      return (
        (row.driverName || "").toLowerCase().includes(q) ||
        (row.code || "").toLowerCase().includes(q) ||
        (row.vehicle || "").toLowerCase().includes(q) ||
        (row.phone || "").toLowerCase().includes(q)
      );
    });
  }, [reportData.monthlyMatrix, searchQuery]);

  // Filtered records
  const filteredRecords = useMemo(() => {
    if (!searchQuery.trim()) return reportData.records;
    const q = searchQuery.toLowerCase().trim();
    return reportData.records.filter(row => {
      return (
        (row.vehiclePlate || "").toLowerCase().includes(q) ||
        (row.actualDriverName || "").toLowerCase().includes(q) ||
        (row.originalDriverName || "").toLowerCase().includes(q) ||
        (row.routeName || "").toLowerCase().includes(q) ||
        (row.fineReason || "").toLowerCase().includes(q)
      );
    });
  }, [reportData.records, searchQuery]);

  // Filtered signature report
  const filteredSignature = useMemo(() => {
    if (!searchQuery.trim()) return reportData.signatureReport;
    const q = searchQuery.toLowerCase().trim();
    return reportData.signatureReport.filter(row => {
      return (
        (row.driverName || "").toLowerCase().includes(q) ||
        (row.vehiclePlate || "").toLowerCase().includes(q) ||
        (row.explanation || "").toLowerCase().includes(q) ||
        (row.organization || "").toLowerCase().includes(q)
      );
    });
  }, [reportData.signatureReport, searchQuery]);

  const daysArray = Array.from({ length: reportData.summary.daysInMonth || 31 }, (_, i) => i + 1);

  // Company Name depending on active division
  const currentCompanyName = useMemo(() => {
    if (selectedDivision === "IMT") return "АЙСМАРК ТРЕЙД ХХК";
    if (selectedDivision === "IMD") return "АЙСМАРК ДИСТРИБЬЮШН ХХК";
    return "АЙСМАРК ТРЕЙД ХХК & АЙСМАРК ДИСТРИБЬЮШН ХХК";
  }, [selectedDivision]);

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* 23:00 Nightly Traffic Fines Automation Status Banner */}
      <div className="print:hidden bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-indigo-900/60 shadow-md">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-400/20 text-amber-300 flex items-center justify-center shrink-0 border border-amber-400/30">
              <Clock className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm sm:text-base font-black tracking-tight text-white flex items-center gap-1.5">
                  <span>🌙 23:00 Цагийн Торгуулийн Автомат Шүүлт</span>
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold">
                  Автомат тохируулга идэвхтэй
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                Өдөр бүрийн тээвэр дууссаны дараа <strong>23:00 цагт</strong> тухайн өдөр явсан бүх тээврийн хэрэгслийн торгуулийг систем автоматаар шүүж, зөвхөн <strong>төлөөгүй торгуулийг</strong> жолоочийн хариуцлагын суутгалд автоматаар бүртгэнэ (Төлсөн торгуулийг суутгахгүй).
              </p>
              {auditStatus && (
                <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-slate-400">
                  <span>
                    Сервер цаг: <strong className="text-sky-300 font-mono">{auditStatus.serverUbTime}</strong>
                  </span>
                  {auditStatus.lastAuditedDate && (
                    <span>
                      Сүүлд ажилласан огноо: <strong className="text-amber-300 font-mono">{auditStatus.lastAuditedDate}</strong>
                    </span>
                  )}
                  {auditStatus.lastResult && (
                    <span>
                      Сүүлийн үр дүн:{" "}
                      <strong className="text-emerald-300">
                        {auditStatus.lastResult.detectedViolations} зөрчил илэрсэн, {auditStatus.lastResult.newFinesCreated} шинэ бүртгэл
                      </strong>
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 self-start lg:self-center shrink-0">
            <button
              onClick={handleRun2300Audit}
              disabled={auditLoading}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 font-black text-xs transition-all shadow-sm disabled:opacity-50 cursor-pointer"
              title="Өнөөдрийн явсан машинуудын торгуулийг яг одоо серверээс татаж бүртгэх"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${auditLoading ? "animate-spin" : ""}`} />
              <span>{auditLoading ? "Шүүж байна..." : "Одоо гараар шүүх (23:00 шалгалт)"}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Top Controls Banner (Hidden in print) */}
      <div className="print:hidden bg-white/90 backdrop-blur-md p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-slate-200 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#0878bd]"></span>
              <h2 className="text-lg sm:text-xl font-black text-slate-800 tracking-tight">
                Торгуулийн Нэгдсэн Тайлан (IMT & IMD)
              </h2>
            </div>
            <p className="text-xs text-slate-500 font-medium">
              АЙСМАРК ТРЕЙД ХХК болон АЙСМАРК ДИСТРИБЬЮШН ХХК-ийн жолооч нарын торгуулийн сарын matrix, менежерийн тайлан, гарын үсэгтэй суутгалын хэвлэх тайлан.
            </p>
          </div>

          {/* Controls Cluster */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
            {/* Month Selector */}
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl shadow-2xs">
              <Calendar className="w-4 h-4 text-slate-400" />
              <input
                type="month"
                value={selectedMonth}
                onChange={e => setSelectedMonth(e.target.value)}
                className="bg-transparent text-xs sm:text-sm font-black text-slate-800 focus:outline-none cursor-pointer"
              />
            </div>

            {/* Refresh */}
            <button
              onClick={() => loadReport(true)}
              disabled={loading}
              className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 active:scale-95 transition-all cursor-pointer shadow-2xs"
              title="Серверээс шинэчлэн татах"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-[#0878bd]" : ""}`} />
            </button>

            {/* Back to Daily */}
            {onBackToDaily && (
              <button
                onClick={onBackToDaily}
                className="px-3 py-1.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 font-bold text-xs transition-colors cursor-pointer"
              >
                Өдрийн бүртгэл
              </button>
            )}
          </div>
        </div>

        {/* Company / Division Selection Tabs (Prominent for Point 3) */}
        <div className="mt-4 pt-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mr-1">Компани:</span>
            
            <button
              onClick={() => setSelectedDivision("all")}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                selectedDivision === "all"
                  ? "bg-slate-900 text-white shadow-sm"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              Бүгд (Нэгдсэн)
            </button>

            <button
              onClick={() => setSelectedDivision("IMT")}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
                selectedDivision === "IMT"
                  ? "bg-sky-600 text-white shadow-sm ring-2 ring-sky-300"
                  : "bg-sky-50 text-sky-800 hover:bg-sky-100 border border-sky-200"
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>АЙСМАРК ТРЕЙД ХХК (Хот)</span>
            </button>

            <button
              onClick={() => setSelectedDivision("IMD")}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
                selectedDivision === "IMD"
                  ? "bg-amber-600 text-white shadow-sm ring-2 ring-amber-300"
                  : "bg-amber-50 text-amber-900 hover:bg-amber-100 border border-amber-200"
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>АЙСМАРК ДИСТРИБЬЮШН ХХК (Орон нутаг)</span>
            </button>
          </div>

          {/* Dedicated Separate Print Action Buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => handlePrint("IMT")}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-50 hover:bg-sky-100 border border-sky-300 text-sky-900 font-bold text-xs transition-colors cursor-pointer"
              title="АЙСМАРК ТРЕЙД ХХК-ийн тайланг тусдаа хэвлэх"
            >
              <Printer className="w-3.5 h-3.5 text-sky-700" />
              <span>Хэвлэх: ТРЕЙД</span>
            </button>

            <button
              onClick={() => handlePrint("IMD")}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-900 font-bold text-xs transition-colors cursor-pointer"
              title="АЙСМАРК ДИСТРИБЬЮШН ХХК-ийн тайланг тусдаа хэвлэх"
            >
              <Printer className="w-3.5 h-3.5 text-amber-700" />
              <span>Хэвлэх: ДИСТРИБЬЮШН</span>
            </button>

            <button
              onClick={() => handlePrint()}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-black text-xs transition-colors cursor-pointer shadow-xs"
              title="Одоо сонгогдсон тайланг А4 цаасаар хэвлэх"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Хэвлэх (A4)</span>
            </button>
          </div>
        </div>

        {/* Stats Strip */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3.5 mt-4 pt-4 border-t border-slate-100">
          <div className="bg-slate-50 p-3 sm:p-3.5 rounded-2xl border border-slate-200/60">
            <div className="text-[10px] sm:text-[11px] font-bold text-slate-500 uppercase">Нийт Торгууль</div>
            <div className="text-lg sm:text-xl font-black text-slate-800 mt-0.5">
              {reportData.summary.totalFines} удаа
            </div>
            <div className="text-[10px] text-slate-400">Сонгосон хугацаанд</div>
          </div>

          <div className="bg-rose-50/70 p-3 sm:p-3.5 rounded-2xl border border-rose-100">
            <div className="text-[10px] sm:text-[11px] font-bold text-rose-800 uppercase">Нийт Суутгал</div>
            <div className="text-lg sm:text-xl font-black text-rose-900 mt-0.5">
              {reportData.summary.totalAmount.toLocaleString()} ₮
            </div>
            <div className="text-[10px] text-rose-600">Жолоочоос суутгагдах</div>
          </div>

          <div className="bg-sky-50/70 p-3 sm:p-3.5 rounded-2xl border border-sky-100">
            <div className="text-[10px] sm:text-[11px] font-bold text-sky-800 uppercase">АЙСМАРК ТРЕЙД ХХК</div>
            <div className="text-lg sm:text-xl font-black text-sky-900 mt-0.5">
              {reportData.summary.imtAmount.toLocaleString()} ₮
            </div>
            <div className="text-[10px] text-sky-600">{reportData.summary.imtCount} удаагийн бүртгэл</div>
          </div>

          <div className="bg-amber-50/70 p-3 sm:p-3.5 rounded-2xl border border-amber-100">
            <div className="text-[10px] sm:text-[11px] font-bold text-amber-800 uppercase">АЙСМАРК ДИСТРИБЬЮШН ХХК</div>
            <div className="text-lg sm:text-xl font-black text-amber-900 mt-0.5">
              {reportData.summary.imdAmount.toLocaleString()} ₮
            </div>
            <div className="text-[10px] text-amber-600">{reportData.summary.imdCount} удаагийн бүртгэл</div>
          </div>
        </div>

        {/* View Tabs - Mobile friendly horizontal swipe container */}
        <div className="flex items-center gap-1.5 sm:gap-2 mt-5 border-b border-slate-100 pb-2 overflow-x-auto no-scrollbar scroll-smooth">
          <button
            onClick={() => setActiveTab("matrix")}
            className={`flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-xl text-xs font-black transition-all shrink-0 cursor-pointer ${
              activeTab === "matrix"
                ? "bg-[#0878bd] text-white shadow-xs"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <Grid className="w-3.5 h-3.5" />
            <span>1. Сарын Matrix (1..31 өдөр)</span>
          </button>

          <button
            onClick={() => setActiveTab("list")}
            className={`flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-xl text-xs font-black transition-all shrink-0 cursor-pointer ${
              activeTab === "list"
                ? "bg-[#0878bd] text-white shadow-xs"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>2. Өдрийн Менежерийн Тайлан</span>
          </button>

          <button
            onClick={() => setActiveTab("signature")}
            className={`flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-xl text-xs font-black transition-all shrink-0 cursor-pointer ${
              activeTab === "signature"
                ? "bg-[#0878bd] text-white shadow-xs"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>3. Гарын Үсэгтэй Тайлан (Sheet3)</span>
          </button>

          <button
            onClick={() => setActiveTab("print")}
            className={`flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-xl text-xs font-black transition-all shrink-0 cursor-pointer ${
              activeTab === "print"
                ? "bg-slate-900 text-white shadow-xs"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <Printer className="w-3.5 h-3.5" />
            <span>4. Албан ёсны Хэвлэх Загвар</span>
          </button>
        </div>
      </div>

      {/* SEARCH BAR (Hidden in print) */}
      <div className="print:hidden flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Жолооч, машин, кодоор хайх..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-3 py-1.5 text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-sky-500 shadow-2xs"
          />
        </div>
        <div className="text-xs text-slate-500 font-medium flex items-center gap-2">
          <span>Хугацаа: <strong className="font-mono text-slate-800">{selectedMonth}</strong></span>
          <span>•</span>
          <span>Компани: <strong className="text-slate-800">{currentCompanyName}</strong></span>
        </div>
      </div>

      {/* ============================================================== */}
      {/* 1. MONTHLY FINE MATRIX TAB (Torguuli sheet) */}
      {/* ============================================================== */}
      {activeTab === "matrix" && (
        <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200 overflow-hidden shadow-2xs">
          <div className="p-3.5 sm:p-4 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between">
            <div className="font-black text-xs text-slate-700 uppercase tracking-wider flex items-center gap-2">
              <span>САРЫН ТОРГУУЛИЙН MATRIX ХҮСНЭГТ</span>
              <span className="text-[10px] text-slate-400 normal-case font-normal hidden sm:inline">(Torguuli template)</span>
            </div>
            <div className="text-xs text-slate-500">
              Нийт жолооч: <span className="font-black text-slate-800">{filteredMatrix.length}</span>
            </div>
          </div>

          {/* Matrix table with sticky left columns on mobile for smooth horizontal swipe */}
          <div className="overflow-x-auto max-h-[70vh] relative">
            <table className="w-full text-left border-collapse text-[11px] whitespace-nowrap">
              <thead className="sticky top-0 bg-slate-100/95 backdrop-blur-xs z-20 border-b border-slate-200 font-bold text-slate-600 shadow-2xs">
                <tr>
                  <th className="sticky left-0 bg-slate-100 z-30 p-2.5 pl-3 border-r border-slate-200 min-w-[65px]">
                    Код
                  </th>
                  <th className="sticky left-[65px] bg-slate-100 z-30 p-2.5 border-r border-slate-200 min-w-[110px]">
                    Жолооч
                  </th>
                  <th className="p-2.5 border-r border-slate-200 min-w-[85px]">ТХ дугаар</th>
                  <th className="p-2.5 border-r border-slate-200 min-w-[85px] hidden sm:table-cell">Утас</th>
                  {daysArray.map(d => (
                    <th key={d} className="p-1.5 text-center border-r border-slate-200 w-8 min-w-[30px]">
                      {d}
                    </th>
                  ))}
                  <th className="p-2.5 pr-3 text-right font-black text-slate-900 bg-slate-200/80 min-w-[85px]">
                    Нийт
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredMatrix.length === 0 ? (
                  <tr>
                    <td colSpan={daysArray.length + 5} className="p-8 text-center text-slate-400">
                      Жолоочийн мэдээлэл олдсонгүй
                    </td>
                  </tr>
                ) : (
                  filteredMatrix.map(row => {
                    const hasFine = row.totalAmount > 0;
                    return (
                      <tr
                        key={row.code}
                        className={`hover:bg-sky-50/40 transition-colors ${
                          hasFine ? "bg-amber-50/30 font-medium" : ""
                        }`}
                      >
                        <td className="sticky left-0 bg-white group-hover:bg-sky-50/40 z-10 p-2 pl-3 border-r border-slate-100 font-mono font-bold text-slate-800">
                          {row.code}
                        </td>
                        <td className="sticky left-[65px] bg-white group-hover:bg-sky-50/40 z-10 p-2 border-r border-slate-100 font-bold text-slate-900">
                          {row.driverName}
                        </td>
                        <td className="p-2 border-r border-slate-100 font-mono text-slate-700">
                          {row.vehicle}
                        </td>
                        <td className="p-2 border-r border-slate-100 font-mono text-slate-500 hidden sm:table-cell">
                          {row.phone || "—"}
                        </td>

                        {/* 1..31 Days */}
                        {daysArray.map(d => {
                          const amt = row.days[d];
                          return (
                            <td
                              key={d}
                              className={`p-1 text-center border-r border-slate-100 text-[10px] ${
                                amt
                                  ? "bg-rose-100 text-rose-900 font-black"
                                  : "text-slate-300"
                              }`}
                            >
                              {amt ? `${amt.toLocaleString()}` : ""}
                            </td>
                          );
                        })}

                        {/* Total */}
                        <td
                          className={`p-2 pr-3 text-right font-mono font-black border-l border-slate-200 ${
                            hasFine ? "text-rose-700 bg-rose-50/80" : "text-slate-400"
                          }`}
                        >
                          {row.totalAmount > 0 ? `${row.totalAmount.toLocaleString()} ₮` : "0 ₮"}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
              <tfoot className="bg-slate-100 font-black text-slate-800 border-t-2 border-slate-300 sticky bottom-0 z-20">
                <tr>
                  <td colSpan={3} className="sticky left-0 bg-slate-100 z-30 p-2.5 pl-3 text-right border-r border-slate-200">
                    НИЙТ:
                  </td>
                  <td className="hidden sm:table-cell border-r border-slate-200"></td>
                  {daysArray.map(d => {
                    const daySum = filteredMatrix.reduce((s, r) => s + (r.days[d] || 0), 0);
                    return (
                      <td
                        key={d}
                        className={`p-1 text-center border-r border-slate-200 text-[10px] ${
                          daySum > 0 ? "bg-rose-200 text-rose-950 font-black" : "text-slate-400"
                        }`}
                      >
                        {daySum > 0 ? daySum.toLocaleString() : ""}
                      </td>
                    );
                  })}
                  <td className="p-2.5 pr-3 text-right font-mono text-xs font-black text-rose-700 bg-rose-100">
                    {filteredMatrix.reduce((s, r) => s + r.totalAmount, 0).toLocaleString()} ₮
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 2. MANAGER DAILY/MONTHLY LIST TAB */}
      {/* ============================================================== */}
      {activeTab === "list" && (
        <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200 overflow-hidden shadow-2xs">
          <div className="p-3.5 sm:p-4 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between">
            <div className="font-black text-xs text-slate-700 uppercase tracking-wider">
              ӨДРИЙН МЕНЕЖЕРИЙН ТОРГУУЛИЙН БҮРТГЭЛ
            </div>
            <div className="text-xs text-slate-500">
              Нийт бүртгэл: <span className="font-black text-slate-800">{filteredRecords.length}</span>
            </div>
          </div>

          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[11px]">
                <tr>
                  <th className="p-3 pl-5">Огноо</th>
                  <th className="p-3">Харьяалал</th>
                  <th className="p-3">Чиглэл</th>
                  <th className="p-3">Улсын дугаар</th>
                  <th className="p-3">Үндсэн Жолооч</th>
                  <th className="p-3">Явсан Жолооч</th>
                  <th className="p-3">Шалтгаан</th>
                  <th className="p-3 pr-5 text-right">Торгуулийн дүн</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRecords.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-10 text-center text-slate-400">
                      Энэ хугацаанд торгууль үүсээгүй байна
                    </td>
                  </tr>
                ) : (
                  filteredRecords.map(item => (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-3 pl-5 font-mono text-slate-700 font-bold">
                        {item.businessDate}
                      </td>
                      <td className="p-3">
                        {item.vehicleDivision === "IMD" ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-black bg-amber-100 text-amber-900 border border-amber-300">
                            IMD Орон нутаг
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-black bg-sky-100 text-sky-900 border border-sky-300">
                            IMT Хот
                          </span>
                        )}
                      </td>
                      <td className="p-3">
                        <div className="font-bold text-slate-800">{item.routeId || "—"}</div>
                        <div className="text-[10px] text-slate-400 truncate max-w-[140px]">{item.routeName}</div>
                      </td>
                      <td className="p-3 font-mono font-black text-slate-900">
                        {item.vehiclePlate}
                      </td>
                      <td className="p-3">
                        <div className="font-medium text-slate-600">{item.originalDriverName}</div>
                        <div className="text-[10px] text-slate-400 font-mono">Код: {item.originalDriverCode}</div>
                      </td>
                      <td className="p-3">
                        <div className="font-black text-rose-800">{item.actualDriverName}</div>
                        <div className="text-[10px] text-rose-500 font-mono">Код: {item.actualDriverCode}</div>
                      </td>
                      <td className="p-3">
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-800 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                          <AlertTriangle className="w-3 h-3 text-amber-600 shrink-0" />
                          <span className="truncate max-w-[200px]">{item.fineReason || "Жолооч солигдсон"}</span>
                        </span>
                      </td>
                      <td className="p-3 pr-5 text-right font-mono font-black text-rose-700">
                        {(Number(item.fineAmount) || 0).toLocaleString()} ₮
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View (Avoids table collision on phones) */}
          <div className="md:hidden divide-y divide-slate-100">
            {filteredRecords.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                Энэ хугацаанд торгууль үүсээгүй байна
              </div>
            ) : (
              filteredRecords.map(item => (
                <div key={item.id} className="p-3.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-xs text-slate-800">{item.businessDate}</span>
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-black ${
                        item.vehicleDivision === "IMD"
                          ? "bg-amber-100 text-amber-900 border border-amber-200"
                          : "bg-sky-100 text-sky-900 border border-sky-200"
                      }`}>
                        {item.vehicleDivision === "IMD" ? "IMD Орон нутаг" : "IMT Хот"}
                      </span>
                    </div>
                    <span className="font-mono font-black text-xs text-rose-600 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200">
                      {(Number(item.fineAmount) || 0).toLocaleString()} ₮
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <div>
                      <span className="text-[10px] text-slate-400 block uppercase font-bold">ТХ Дугаар</span>
                      <span className="font-mono font-black text-slate-900">{item.vehiclePlate}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 block uppercase font-bold">Хариуцах Жолооч</span>
                      <span className="font-bold text-slate-900">{item.actualDriverName}</span>
                    </div>
                  </div>

                  <div className="text-[11px] bg-slate-50 p-2 rounded-xl border border-slate-100 text-slate-600 flex items-start gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                    <span>{item.fineReason || "Жолооч солигдсон"}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 3. DRIVER SIGNATURE REPORT TAB (Sheet3 format) */}
      {/* ============================================================== */}
      {activeTab === "signature" && (
        <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200 overflow-hidden shadow-2xs">
          <div className="p-3.5 sm:p-4 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between">
            <div className="font-black text-xs text-slate-700 uppercase tracking-wider flex items-center gap-2">
              <span>ЖОЛООЧИЙН ГАРЫН ҮСЭГТЭЙ СУУТГАЛЫН ТАЙЛАН</span>
              <span className="text-[10px] text-slate-400 normal-case font-normal hidden sm:inline">(Sheet3 format)</span>
            </div>
            <div className="text-xs text-slate-500">
              Нийт суутгал: <span className="font-black text-slate-800">{filteredSignature.length}</span>
            </div>
          </div>

          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs whitespace-nowrap">
              <thead className="bg-slate-100 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px]">
                <tr>
                  <th className="p-2.5 pl-4 border-r border-slate-200 text-center w-10">д/д</th>
                  <th className="p-2.5 border-r border-slate-200">Албан тушаал</th>
                  <th className="p-2.5 border-r border-slate-200 font-mono">ТХ дугаар</th>
                  <th className="p-2.5 border-r border-slate-200">Жолооч</th>
                  <th className="p-2.5 border-r border-slate-200 text-right">Торгуулийн дүн</th>
                  <th className="p-2.5 border-r border-slate-200 text-right">Суутгал</th>
                  <th className="p-2.5 border-r border-slate-200">Байгууллага</th>
                  <th className="p-2.5 border-r border-slate-200 font-mono">Огноо</th>
                  <th className="p-2.5 border-r border-slate-200">Тайлбар</th>
                  <th className="p-2.5 pr-4 text-center min-w-[100px]">Гарын үсэг</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredSignature.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="p-10 text-center text-slate-400">
                      Энэ хугацаанд торгуулийн бүртгэл байхгүй байна
                    </td>
                  </tr>
                ) : (
                  filteredSignature.map(row => (
                    <tr key={row.index} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-2 pl-4 border-r border-slate-100 text-center font-bold text-slate-500">
                        {row.index}
                      </td>
                      <td className="p-2 border-r border-slate-100 text-slate-700">
                        {row.jobTitle}
                      </td>
                      <td className="p-2 border-r border-slate-100 font-mono font-bold text-slate-900">
                        {row.vehiclePlate}
                      </td>
                      <td className="p-2 border-r border-slate-100 font-bold text-slate-900">
                        {row.driverName}
                      </td>
                      <td className="p-2 border-r border-slate-100 text-right font-mono font-bold text-rose-700">
                        {row.fineAmount.toLocaleString()} ₮
                      </td>
                      <td className="p-2 border-r border-slate-100 text-right font-mono font-bold text-rose-700">
                        {row.driverDeduction.toLocaleString()} ₮
                      </td>
                      <td className="p-2 border-r border-slate-100 text-slate-600">
                        {row.organization}
                      </td>
                      <td className="p-2 border-r border-slate-100 font-mono text-slate-600">
                        {row.date}
                      </td>
                      <td className="p-2 border-r border-slate-100 text-slate-600 truncate max-w-[180px]">
                        {row.explanation}
                      </td>
                      <td className="p-2 pr-4 border-slate-100 text-center">
                        <span className="inline-block border-b border-slate-300 w-20 h-4"></span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View (Avoids 10-column table crush on mobile screens) */}
          <div className="md:hidden divide-y divide-slate-100">
            {filteredSignature.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                Энэ хугацаанд торгуулийн бүртгэл байхгүй байна
              </div>
            ) : (
              filteredSignature.map(row => (
                <div key={row.index} className="p-3.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-700 font-bold text-[10px] flex items-center justify-center">
                        {row.index}
                      </span>
                      <span className="font-bold text-xs text-slate-900">{row.driverName}</span>
                      <span className="text-[10px] text-slate-500 font-medium">({row.jobTitle})</span>
                    </div>
                    <span className="font-mono font-black text-xs text-rose-700">
                      {row.driverDeduction.toLocaleString()} ₮
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <span className="font-mono font-bold text-slate-800">{row.vehiclePlate}</span>
                    <span className="text-[11px] text-slate-500">{row.organization}</span>
                  </div>

                  <div className="text-[11px] text-slate-600 bg-slate-50 p-2 rounded-xl">
                    <span className="text-slate-400 font-mono block text-[10px] mb-0.5">Огноо: {row.date}</span>
                    <span>{row.explanation}</span>
                  </div>

                  <div className="flex items-center justify-between pt-1 text-[11px] text-slate-400">
                    <span>Гарын үсэг зурах:</span>
                    <span className="border-b border-slate-400 w-24 h-4 inline-block"></span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 4. PRINT A4 VIEW (Both for screen preview and print paper) */}
      {/* ============================================================== */}
      {(activeTab === "print" || true) && (
        <div className={`print-container ${activeTab === "print" ? "block" : "hidden print:block"} bg-white p-6 sm:p-10 rounded-2xl sm:rounded-3xl border border-slate-300 shadow-md text-black print:p-0 print:border-none print:shadow-none print:m-0`}>
          {/* Official Document Header */}
          <div className="border-b-2 border-black pb-4 mb-6">
            <div className="flex justify-between items-start">
              <div>
                <h1 className="text-lg sm:text-xl font-black uppercase tracking-tight">
                  {currentCompanyName}
                </h1>
                <p className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-slate-800 mt-0.5">
                  ТЭЭВРИЙН АЛБА — ЖОЛООЧИЙН ХАРИУЦЛАГЫН ТОРГУУЛЬ, СУУТГАЛЫН НЭГДСЭН ТАЙЛАН
                </p>
              </div>
              <div className="text-right text-[11px] sm:text-xs font-mono">
                <div>Огноо: {new Date().toLocaleDateString("mn-MN")}</div>
                <div>Тайлант сар: <strong>{selectedMonth}</strong></div>
              </div>
            </div>
          </div>

          {/* Report Summary Box */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-4 mb-6 p-3 sm:p-4 bg-slate-50 border border-slate-300 text-xs">
            <div>
              <span className="font-bold">Компани:</span> {currentCompanyName}
            </div>
            <div>
              <span className="font-bold">Нийт зөрчил:</span> {filteredSignature.length} удаа
            </div>
            <div>
              <span className="font-bold">Нийт суутгалын дүн:</span>{" "}
              <strong className="text-sm">
                {filteredSignature.reduce((s, r) => s + (Number(r.driverDeduction) || 0), 0).toLocaleString()} ₮
              </strong>
            </div>
          </div>

          {/* Printable Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse border border-black text-[11px] mb-8 whitespace-nowrap">
              <thead>
                <tr className="bg-slate-200 border-b border-black font-bold">
                  <th className="p-2 border-r border-black text-center w-8">д/д</th>
                  <th className="p-2 border-r border-black">Албан тушаал</th>
                  <th className="p-2 border-r border-black">ТХ дугаар</th>
                  <th className="p-2 border-r border-black">Жолооч</th>
                  <th className="p-2 border-r border-black text-right">Торгуулийн дүн</th>
                  <th className="p-2 border-r border-black text-right">Суутгал</th>
                  <th className="p-2 border-r border-black">Байгууллага</th>
                  <th className="p-2 border-r border-black text-center">Огноо</th>
                  <th className="p-2 border-r border-black">Тайлбар</th>
                  <th className="p-2 text-center w-28">Гарын үсэг</th>
                </tr>
              </thead>
              <tbody>
                {filteredSignature.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="p-6 text-center text-slate-500 italic">
                      Тайлант хугацаанд торгууль бүртгэгдээгүй
                    </td>
                  </tr>
                ) : (
                  filteredSignature.map(row => (
                    <tr key={row.index} className="border-b border-black">
                      <td className="p-1.5 border-r border-black text-center">{row.index}</td>
                      <td className="p-1.5 border-r border-black">{row.jobTitle}</td>
                      <td className="p-1.5 border-r border-black font-bold font-mono">{row.vehiclePlate}</td>
                      <td className="p-1.5 border-r border-black font-bold">{row.driverName}</td>
                      <td className="p-1.5 border-r border-black text-right font-mono">
                        {row.fineAmount.toLocaleString()} ₮
                      </td>
                      <td className="p-1.5 border-r border-black text-right font-mono font-bold">
                        {row.driverDeduction.toLocaleString()} ₮
                      </td>
                      <td className="p-1.5 border-r border-black text-[10px]">{row.organization}</td>
                      <td className="p-1.5 border-r border-black text-center font-mono">{row.date}</td>
                      <td className="p-1.5 border-r border-black truncate max-w-[200px]">{row.explanation}</td>
                      <td className="p-1.5 text-center"></td>
                    </tr>
                  ))
                )}
              </tbody>
              <tfoot>
                <tr className="bg-slate-200 font-bold border-t border-black">
                  <td colSpan={4} className="p-2 text-right border-r border-black">НИЙТ:</td>
                  <td className="p-2 text-right border-r border-black font-mono">
                    {filteredSignature.reduce((s, r) => s + (Number(r.fineAmount) || 0), 0).toLocaleString()} ₮
                  </td>
                  <td className="p-2 text-right border-r border-black font-mono">
                    {filteredSignature.reduce((s, r) => s + (Number(r.driverDeduction) || 0), 0).toLocaleString()} ₮
                  </td>
                  <td colSpan={4} className="p-2"></td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Official Signatures Footer Block */}
          <div className="mt-12 pt-8 border-t border-black text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-8">
              <div className="space-y-4">
                <p className="font-bold">Тайлан гаргасан:</p>
                <div className="border-b border-black h-8"></div>
                <p className="text-[10px] text-slate-600">/ Тээврийн зохицуулагч /</p>
              </div>

              <div className="space-y-4">
                <p className="font-bold">Хянасан:</p>
                <div className="border-b border-black h-8"></div>
                <p className="text-[10px] text-slate-600">/ Тээврийн албаны дарга /</p>
              </div>

              <div className="space-y-4">
                <p className="font-bold">Батлав:</p>
                <div className="border-b border-black h-8"></div>
                <p className="text-[10px] text-slate-600">/ Гүйцэтгэх захирал /</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
