import React, { useState, useEffect, useMemo } from "react";
import { 
  Package, 
  Truck, 
  MapPin, 
  Calendar, 
  CheckCircle2, 
  Search, 
  ExternalLink,
  RefreshCw,
  Copy,
  Check,
  Building2,
  Box,
  AlertTriangle,
  X,
  ChevronUp,
  RotateCcw,
  FileText,
  FileSpreadsheet,
  Phone,
  LayoutGrid,
  List,
  Navigation,
  Sparkles,
  Layers,
  Clock,
  Gauge,
  BookOpen
} from "lucide-react";
import { api } from "../../services/api";
import { 
  IMDClientPortalData, 
  IMDProvinceDeliverySummary,
  IMDUnassignedOrderItem,
  IMDClientShipmentItem,
  IMDCityFleetItem
} from "../../types";
import { VehicleMapModal, VehicleLocationTarget } from "./VehicleMapModal";
import { MonthlyExceptionReportView } from "../MonthlyExceptionReportView";

interface Props {
  onBack?: () => void;
  onNavigateToManager?: () => void;
  onNavigateToDriver?: () => void;
  onShowToast?: (msg: string, type: "success" | "error" | "info") => void;
  onOpenRegulation?: () => void;
}

// Known Regional Truck plates
const REGIONAL_PLATES = new Set([
  "8374УНЕ", "3147УЕН", "3148УЕМ", "3148УЕО", "5909УКО", 
  "6530УКН", "8376УЕН", "8428УНД", "8531УББ", "9988УНБ", "3147УНЭ"
]);

// Known KA Chain delivery plates
const KA_PLATES = new Set([
  "1096УНЗ", "5201УКН", "7841УНА", "1076УЕВ", "1081УЕВ"
]);

export const IMDClientPortalView: React.FC<Props> = ({ 
  onShowToast,
  onOpenRegulation 
}) => {
  const getTodayUb = () => {
    const d = new Date(Date.now() + 8 * 3600 * 1000);
    return d.toISOString().slice(0, 10);
  };

  const isImdUrlInitial = () => {
    if (typeof window === "undefined") return false;
    const path = window.location.pathname.toLowerCase();
    const search = window.location.search.toLowerCase();
    const hash = window.location.hash.toLowerCase();
    return (
      path.startsWith("/imd") ||
      path.includes("//imd") ||
      path.includes("/sales/imd") ||
      hash.includes("imd") ||
      search.includes("view=imd") ||
      search.includes("tab=imd") ||
      search.includes("mode=imd")
    );
  };

  const [portalMode, setPortalMode] = useState<"all" | "imd_only">(isImdUrlInitial() ? "imd_only" : "all");
  const [data, setData] = useState<IMDClientPortalData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<"daily_routes" | "monthly_exceptions" | "imd_fleet" | "assignments" | "city_fleet" | "provinces" | "unassigned">(
    isImdUrlInitial() ? "imd_fleet" : "daily_routes"
  );
  
  // Daily registration status for /sales (30 City Routes + IMD)
  const [salesDailyDate, setSalesDailyDate] = useState<string>(getTodayUb());
  const [salesDailyLoading, setSalesDailyLoading] = useState<boolean>(false);
  const [salesDailyData, setSalesDailyData] = useState<{
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
  } | null>(null);
  const [salesDailyFilter, setSalesDailyFilter] = useState<"all" | "changed" | "driver_issue" | "vehicle_issue" | "cancelled" | "normal">("all");
  const [salesDailySearch, setSalesDailySearch] = useState<string>("");

  const [fleetFilter, setFleetFilter] = useState<"all" | "city" | "regional">("all");
  const [viewLayout, setViewLayout] = useState<"table" | "cards">("table");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<"all" | "in_transit" | "scheduled" | "completed">("all");
  const [provinceFilter, setProvinceFilter] = useState<string>("all");
  const [copiedLink, setCopiedLink] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [isMapModalOpen, setIsMapModalOpen] = useState(false);
  const [mapTargetVehicle, setMapTargetVehicle] = useState<VehicleLocationTarget | null>(null);

  const handleOpenVehicleMap = (vehicle?: VehicleLocationTarget) => {
    setMapTargetVehicle(vehicle || null);
    setIsMapModalOpen(true);
  };

  const fetchSalesDailyStatus = async (date: string) => {
    setSalesDailyLoading(true);
    try {
      const res = await api.getSalesDailyStatus(date);
      setSalesDailyData(res);
    } catch (err: any) {
      if (onShowToast) onShowToast(err.message || "Борлуулалтын өдрийн төлөв татахад алдаа гарлаа", "error");
    } finally {
      setSalesDailyLoading(false);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await api.getIMDClientPortal();
      setData(res);
    } catch (err: any) {
      if (onShowToast) onShowToast(err.message || "Мэдээлэл татахад алдаа гарлаа", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    fetchSalesDailyStatus(salesDailyDate);

    const handleScroll = () => {
      if (window.scrollY > 300) {
        setShowScrollTop(true);
      } else {
        setShowScrollTop(false);
      }
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleCopyPortalLink = () => {
    const isImd = portalMode === "imd_only";
    const url = isImd ? `${window.location.origin}/imd` : `${window.location.origin}/sales`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    if (onShowToast) {
      onShowToast(
        isImd 
          ? "Зөвхөн IMD линк хуулагдлаа: /imd" 
          : "Борлуулалтын дашбордын линк хуулагдлаа (/sales)", 
        "success"
      );
    }
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Unique list of provinces
  const provinces = useMemo(() => {
    const set = new Set<string>();
    if (data?.provinceSummaries) {
      data.provinceSummaries.forEach(p => {
        if (p.province) set.add(p.province.trim());
      });
    }
    const list = data?.assignments || data?.shipments || [];
    list.forEach(s => {
      if (s.province) set.add(s.province.trim());
    });
    if (data?.unassignedOrders) {
      data.unassignedOrders.forEach(u => {
        if (u.province) set.add(u.province.trim());
      });
    }
    return Array.from(set).sort();
  }, [data]);

  // Master list of all assignments / shipments
  const allAssignments: IMDClientShipmentItem[] = useMemo(() => {
    return data?.assignments || data?.shipments || [];
  }, [data]);

  // Filtered Assignments for primary view
  const filteredAssignments = useMemo(() => {
    return allAssignments.filter(asn => {
      const plate = (asn.vehiclePlate || "").trim().toUpperCase();
      const isRegional = REGIONAL_PLATES.has(plate) || 
        (asn.province && !asn.province.includes("Улаанбаатар") && asn.province !== "Улаанбаатар");

      // Fleet Filter
      if (fleetFilter === "regional" && !isRegional) return false;
      if (fleetFilter === "city" && isRegional) return false;

      // Status Filter
      if (statusFilter === "in_transit") {
        if (asn.status !== "Тээвэрт гарсан") return false;
      } else if (statusFilter === "completed") {
        if (asn.status !== "Дууссан" && asn.status !== "Хүргэгдсэн") return false;
      } else if (statusFilter === "scheduled") {
        if (asn.status !== "Төлөвлөсөн" && asn.status !== "Батлагдсан") return false;
      }

      // Province Filter
      if (provinceFilter !== "all" && asn.province !== provinceFilter) return false;

      // Search Filter
      const term = searchTerm.toLowerCase().trim();
      if (!term) return true;

      return (
        (asn.orderNo && asn.orderNo.toLowerCase().includes(term)) ||
        (asn.vehiclePlate && asn.vehiclePlate.toLowerCase().includes(term)) ||
        (asn.primaryDriverName && asn.primaryDriverName.toLowerCase().includes(term)) ||
        (asn.primaryDriverPhone && asn.primaryDriverPhone.toLowerCase().includes(term)) ||
        (asn.province && asn.province.toLowerCase().includes(term)) ||
        (asn.destination && asn.destination.toLowerCase().includes(term)) ||
        (asn.albanBichigDugaar && asn.albanBichigDugaar.toLowerCase().includes(term)) ||
        (asn.customer && asn.customer.toLowerCase().includes(term))
      );
    });
  }, [allAssignments, fleetFilter, statusFilter, provinceFilter, searchTerm]);

  // Filtered Province Summaries
  const filteredProvinceSummaries = useMemo(() => {
    if (!data?.provinceSummaries) return [];
    return data.provinceSummaries.filter(p => {
      const term = searchTerm.toLowerCase().trim();
      const matchSearch = !term || 
        p.province.toLowerCase().includes(term) ||
        p.drivers.some(d => d.toLowerCase().includes(term)) ||
        p.vehicles.some(v => v.toLowerCase().includes(term)) ||
        p.deliveryDates.some(dt => dt.includes(term));

      if (!matchSearch) return false;
      if (provinceFilter !== "all" && p.province !== provinceFilter) return false;

      return true;
    });
  }, [data, searchTerm, provinceFilter]);

  // Filtered Unassigned Orders
  const filteredUnassignedOrders = useMemo(() => {
    if (!data?.unassignedOrders) return [];
    return data.unassignedOrders.filter(u => {
      const term = searchTerm.toLowerCase().trim();
      const matchSearch = !term ||
        u.orderNo.toLowerCase().includes(term) ||
        u.customer.toLowerCase().includes(term) ||
        u.province.toLowerCase().includes(term) ||
        (u.destination && u.destination.toLowerCase().includes(term));

      if (!matchSearch) return false;
      if (provinceFilter !== "all" && u.province !== provinceFilter) return false;

      return true;
    });
  }, [data, searchTerm, provinceFilter]);

  // Filtered City Fleet (30 vehicles)
  const filteredCityFleet = useMemo(() => {
    if (!data?.cityFleet) return [];
    return data.cityFleet.filter(cf => {
      const term = searchTerm.toLowerCase().trim();
      const matchSearch = !term ||
        cf.vehiclePlate.toLowerCase().includes(term) ||
        cf.name.toLowerCase().includes(term) ||
        cf.phone.includes(term) ||
        cf.salesRep.toLowerCase().includes(term) ||
        cf.zone.toLowerCase().includes(term);

      if (!matchSearch) return false;

      const cleanPlate = cf.vehiclePlate.trim().toUpperCase();
      const isKA = KA_PLATES.has(cleanPlate);

      if (fleetFilter === "regional") return false;
      if (fleetFilter === "city" && !isKA) {
        // Keeps all city vehicles
      }

      return true;
    });
  }, [data, searchTerm, fleetFilter]);

  // Filtered IMD Regional Fleet (10 heavy trucks with live GPS)
  const filteredImdFleet = useMemo(() => {
    if (!data?.imdFleet) return [];
    return data.imdFleet.filter(im => {
      const term = searchTerm.toLowerCase().trim();
      if (!term) return true;
      return (
        im.vehiclePlate.toLowerCase().includes(term) ||
        im.name.toLowerCase().includes(term) ||
        (im.phone && im.phone.includes(term)) ||
        (im.zone && im.zone.toLowerCase().includes(term)) ||
        (im.salesRep && im.salesRep.toLowerCase().includes(term))
      );
    });
  }, [data, searchTerm]);

  const getFleetBadge = (plate: string) => {
    const clean = plate.trim().toUpperCase();
    if (REGIONAL_PLATES.has(clean)) {
      return (
        <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-purple-100 text-purple-800 border border-purple-200">
          Орон нутаг
        </span>
      );
    }
    if (KA_PLATES.has(clean)) {
      return (
        <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-sky-100 text-sky-800 border border-sky-200">
          KA Сүлжээ
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200">
        M Цуврал
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-[#f3f6f9] text-slate-900 pb-24 font-sans antialiased">
      {/* 
        TOP HEADER BAR:
        - Responsive: Compact on mobile, spacious on desktop
        - Quick action: Share link (/sales) & Restore 40 assignments button & Refresh
      */}
      <header className="bg-gradient-to-r from-[#0d233a] via-[#0e3b61] to-[#0878bd] text-white shadow-md sticky top-0 z-40 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-3.5 sm:px-6 h-16 sm:h-20 flex items-center justify-between gap-3">
          {/* Brand & Title */}
          <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0">
            <div className="h-9 w-9 sm:h-11 sm:w-11 rounded-xl sm:rounded-2xl bg-white p-1 sm:p-1.5 flex items-center justify-center shadow-md shrink-0">
              <img 
                src="https://icemark.mn/favicon.ico" 
                alt="Icemark" 
                className="h-6 w-6 sm:h-8 sm:w-8 object-contain"
                referrerPolicy="no-referrer"
              />
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <span className="text-[9px] sm:text-[11px] font-black uppercase tracking-wider px-1.5 sm:px-2 py-0.5 rounded-md bg-amber-400/20 text-amber-300 border border-amber-300/30 whitespace-nowrap">
                  Борлуулалт & Түгээлт
                </span>
                <span className="text-[10px] sm:text-xs text-sky-200 truncate hidden xs:inline-block font-medium">
                  Нийт 40 тээврийн хэрэгслийн нэгдсэн хяналт
                </span>
              </div>
              <h1 className="text-sm sm:text-base md:text-xl font-black tracking-tight text-white truncate">
                Орон Нутаг & Хотын Түгээлтийн Томилолтууд
              </h1>
            </div>
          </div>

          {/* Action buttons with touch-friendly targets */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Regulations Button */}
            {onOpenRegulation && (
              <button
                onClick={onOpenRegulation}
                className="h-10 sm:h-11 px-3 sm:px-3.5 rounded-xl bg-gradient-to-r from-amber-500/25 to-sky-500/20 hover:from-amber-500/35 hover:to-sky-500/30 text-amber-200 border border-amber-400/50 text-xs font-black flex items-center gap-1.5 transition-all shadow-xs cursor-pointer select-none active:scale-95 touch-manipulation"
                title="Авто тээвэр, түгээлтийн албаны журам (Хавсралт №3)"
              >
                <BookOpen className="w-4 h-4 text-amber-400 shrink-0" />
                <span className="font-mono tracking-wider font-extrabold">//журам//</span>
              </button>
            )}

            {/* Live Map View Button */}
            <button
              onClick={() => handleOpenVehicleMap()}
              className="h-10 sm:h-11 px-3 sm:px-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-slate-950 text-xs font-black flex items-center gap-1.5 transition-all shadow-xs cursor-pointer touch-manipulation"
              title="Бүх машины GPS байршил газрын зураг дээр харах"
            >
              <Navigation className="w-4 h-4 text-slate-950 shrink-0" />
              <span className="hidden sm:inline">Газрын зураг</span>
              <span className="sm:hidden">Map</span>
            </button>

            {/* Copy Share Link */}
            <button
              onClick={handleCopyPortalLink}
              className="h-10 sm:h-11 px-2.5 sm:px-3 rounded-xl bg-amber-400 hover:bg-amber-300 active:scale-95 text-slate-950 text-xs font-black flex items-center gap-1.5 transition-all shadow-xs cursor-pointer touch-manipulation"
              title="Борлуулалтын дашбордын линк хуулах (/sales)"
            >
              {copiedLink ? <Check className="w-4 h-4 text-slate-950 shrink-0" /> : <Copy className="w-4 h-4 text-slate-950 shrink-0" />}
              <span className="hidden md:inline">{copiedLink ? "Хуулагдлаа!" : "Линк"}</span>
            </button>

            {/* Refresh */}
            <button
              onClick={fetchData}
              className="h-10 w-10 sm:h-11 sm:w-11 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 text-white transition-all flex items-center justify-center cursor-pointer border border-white/15 touch-manipulation"
              title="Мэдээлэл шинэчлэх"
              aria-label="Шинэчлэх"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-3 sm:px-6 pt-4 sm:pt-6 space-y-4 sm:space-y-6">
        
        {/* 
          1. TOP KPI SUMMARY CARDS
        */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
          {/* 1. IMD Regional Fleet GPS (10 trucks) */}
          <div 
            onClick={() => setActiveTab("imd_fleet")}
            className={`rounded-2xl p-3.5 sm:p-5 border transition-all cursor-pointer select-none touch-manipulation ${
              activeTab === "imd_fleet"
                ? "bg-sky-50/90 border-[#0878bd] shadow-sm ring-2 ring-[#0878bd]/25" 
                : "bg-white border-slate-200/90 shadow-2xs hover:border-sky-400"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] sm:text-xs font-bold text-slate-600 uppercase tracking-wider">IMD Машинууд (GPS)</span>
              <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-xl bg-sky-100 text-[#0878bd] flex items-center justify-center shrink-0">
                <Navigation className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-600" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-black text-slate-900 mt-1.5 sm:mt-2">
              {data?.imdFleet?.length || 10} <span className="text-xs text-[#0878bd] font-bold">машин</span>
            </div>
            <div className="flex items-center gap-1.5 mt-0.5 text-[10px] sm:text-[11px] text-slate-500">
              <span className="text-emerald-700 font-bold inline-flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                {data?.imdFleet?.filter(v => (v.speed || 0) > 0).length || 0} хөдөлгөөнд
              </span>
              <span>•</span>
              <span className="text-slate-600 font-bold">10 хүнд даац</span>
            </div>
          </div>

          {/* 2. IMD Regional Assignments */}
          <div 
            onClick={() => { setActiveTab("assignments"); setFleetFilter("all"); }}
            className={`rounded-2xl p-3.5 sm:p-5 border transition-all cursor-pointer select-none touch-manipulation ${
              activeTab === "assignments"
                ? "bg-purple-50/80 border-purple-600 shadow-sm ring-2 ring-purple-600/20" 
                : "bg-white border-slate-200/90 shadow-2xs hover:border-purple-300"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] sm:text-xs font-bold text-slate-600 uppercase tracking-wider">Томилолтууд</span>
              <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-xl bg-purple-100/70 text-purple-700 flex items-center justify-center shrink-0">
                <MapPin className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-black text-purple-950 mt-1.5 sm:mt-2">
              {allAssignments.length} <span className="text-xs text-purple-700 font-bold">томилолт</span>
            </div>
            <div className="flex items-center gap-1.5 mt-0.5 text-[10px] sm:text-[11px] text-slate-500">
              <span className="text-emerald-700 font-bold">{data?.summary.completed || 0} дууссан</span>
              <span>•</span>
              <span className="text-purple-700 font-bold">Орон нутаг</span>
            </div>
          </div>

          {/* 3. City Fleet (30) */}
          <div 
            onClick={() => { setActiveTab("city_fleet"); setFleetFilter("all"); }}
            className={`rounded-2xl p-3.5 sm:p-5 border transition-all cursor-pointer select-none touch-manipulation ${
              activeTab === "city_fleet"
                ? "bg-emerald-50/80 border-emerald-600 shadow-sm ring-2 ring-emerald-600/20" 
                : "bg-white border-slate-200/90 shadow-2xs hover:border-emerald-300"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] sm:text-xs font-bold text-slate-600 uppercase tracking-wider">Хотын түгээлт</span>
              <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-xl bg-emerald-100/70 text-emerald-700 flex items-center justify-center shrink-0">
                <Truck className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-black text-emerald-950 mt-1.5 sm:mt-2">
              {data?.cityFleet?.length || 30} <span className="text-xs text-emerald-700 font-bold">машин</span>
            </div>
            <span className="text-[10px] sm:text-[11px] text-slate-500 mt-0.5 block truncate">
              5 KA сүлжээ + 25 M дүүрэг
            </span>
          </div>

          {/* 4. Unassigned Orders */}
          <div 
            onClick={() => setActiveTab("unassigned")}
            className={`rounded-2xl p-3.5 sm:p-5 border transition-all cursor-pointer select-none touch-manipulation ${
              activeTab === "unassigned"
                ? "bg-amber-50/80 border-amber-500 shadow-sm ring-2 ring-amber-500/20"
                : "bg-white border-slate-200/90 shadow-2xs hover:border-amber-300"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] sm:text-xs font-bold text-slate-600 uppercase tracking-wider">Хуваарилалт хүлээж буй</span>
              <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-xl bg-amber-100/70 text-amber-700 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-black text-amber-950 mt-1.5 sm:mt-2">
              {data?.summary.unassignedOrdersCount || 0} <span className="text-xs text-amber-700 font-bold">захиалга</span>
            </div>
            <span className="text-[10px] sm:text-[11px] text-slate-500 mt-0.5 block truncate">
              Томилолт хуваарилагдаагүй
            </span>
          </div>
        </div>

        {/* 
          2. NAVIGATION TABS:
          - Tab 1: IMD Орон нутгийн томилолт (10 машин) - Primary
          - Tab 2: Хотын борлуулалт & түгээлт (30 машин)
          - Tab 3: Аймгуудын нэгтгэл
          - Tab 4: Хуваарилаагүй захиалга
        */}
        <div className="bg-white rounded-2xl p-1.5 sm:p-2 border border-slate-200/90 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
            {/* Tab 0: Daily Registration Status (Matching image.png) */}
            <button
              onClick={() => setActiveTab("daily_routes")}
              className={`px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 sm:gap-2 shrink-0 cursor-pointer touch-manipulation min-h-[40px] ${
                activeTab === "daily_routes"
                  ? "bg-emerald-600 text-white shadow-xs font-black ring-2 ring-emerald-300"
                  : "text-slate-700 bg-emerald-50/70 hover:bg-emerald-100/80 active:bg-emerald-200"
              }`}
            >
              <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0 text-emerald-400" />
              <span>Өдрийн бүртгэлийн төлөв (30 чиглэл)</span>
              <span className={`px-1.5 sm:px-2 py-0.5 rounded-full text-[10px] font-black ${
                activeTab === "daily_routes" ? "bg-white/25 text-white" : "bg-emerald-200 text-emerald-950"
              }`}>
                {salesDailyData?.summary?.totalCount || 30}
              </span>
            </button>

            {/* Tab 0.5: Monthly Exception Reports (Машин, Жолооч, Бүс) */}
            <button
              onClick={() => setActiveTab("monthly_exceptions")}
              className={`px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 sm:gap-2 shrink-0 cursor-pointer touch-manipulation min-h-[40px] ${
                activeTab === "monthly_exceptions"
                  ? "bg-purple-700 text-white shadow-xs font-black ring-2 ring-purple-300"
                  : "text-slate-700 bg-purple-50/70 hover:bg-purple-100/80 active:bg-purple-200"
              }`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0 text-purple-600" />
              <span>Сар бүрийн тайлан (Машин, Жолооч, Бүс)</span>
            </button>

            {/* Tab 1: IMD Regional Fleet GPS */}
            <button
              onClick={() => setActiveTab("imd_fleet")}
              className={`px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 sm:gap-2 shrink-0 cursor-pointer touch-manipulation min-h-[40px] ${
                activeTab === "imd_fleet"
                  ? "bg-[#0878bd] text-white shadow-xs font-black ring-2 ring-sky-300"
                  : "text-slate-700 bg-sky-50/70 hover:bg-sky-100/80 active:bg-sky-200"
              }`}
            >
              <Navigation className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0 text-emerald-400" />
              <span>IMD Машинууд (GPS Live)</span>
              <span className={`px-1.5 sm:px-2 py-0.5 rounded-full text-[10px] font-black ${
                activeTab === "imd_fleet" ? "bg-white/25 text-white" : "bg-sky-200 text-sky-900"
              }`}>
                {data?.imdFleet?.length || 10}
              </span>
            </button>

            {/* Tab 2: IMD Regional Assignments */}
            <button
              onClick={() => setActiveTab("assignments")}
              className={`px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 sm:gap-2 shrink-0 cursor-pointer touch-manipulation min-h-[40px] ${
                activeTab === "assignments"
                  ? "bg-purple-700 text-white shadow-xs font-black"
                  : "text-slate-600 hover:bg-slate-100 active:bg-slate-200"
              }`}
            >
              <MapPin className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
              <span>Орон нутгийн томилолт</span>
              <span className={`px-1.5 sm:px-2 py-0.5 rounded-full text-[10px] font-black ${
                activeTab === "assignments" ? "bg-white/25 text-white" : "bg-slate-100 text-slate-700"
              }`}>
                {allAssignments.length}
              </span>
            </button>

            {/* Tab 3: City Fleet */}
            <button
              onClick={() => setActiveTab("city_fleet")}
              className={`px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 sm:gap-2 shrink-0 cursor-pointer touch-manipulation min-h-[40px] ${
                activeTab === "city_fleet"
                  ? "bg-emerald-700 text-white shadow-xs font-black"
                  : "text-slate-600 hover:bg-slate-100 active:bg-slate-200"
              }`}
            >
              <Truck className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
              <span>Хотын түгээлт (30)</span>
              <span className={`px-1.5 sm:px-2 py-0.5 rounded-full text-[10px] font-black ${
                activeTab === "city_fleet" ? "bg-white/25 text-white" : "bg-slate-100 text-slate-700"
              }`}>
                {data?.cityFleet?.length || 30}
              </span>
            </button>

            {/* Tab 4: Provinces */}
            <button
              onClick={() => setActiveTab("provinces")}
              className={`px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 sm:gap-2 shrink-0 cursor-pointer touch-manipulation min-h-[40px] ${
                activeTab === "provinces"
                  ? "bg-slate-800 text-white shadow-xs font-black"
                  : "text-slate-600 hover:bg-slate-100 active:bg-slate-200"
              }`}
            >
              <Building2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
              <span>Аймгуудын нэгтгэл</span>
              <span className={`px-1.5 sm:px-2 py-0.5 rounded-full text-[10px] font-black ${
                activeTab === "provinces" ? "bg-white/25 text-white" : "bg-slate-100 text-slate-700"
              }`}>
                {data?.provinceSummaries.length || 0}
              </span>
            </button>

            {/* Tab 5: Unassigned */}
            <button
              onClick={() => setActiveTab("unassigned")}
              className={`px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 sm:gap-2 shrink-0 cursor-pointer touch-manipulation min-h-[40px] ${
                activeTab === "unassigned"
                  ? "bg-amber-400 text-slate-950 shadow-xs font-black"
                  : (data?.summary.unassignedOrdersCount || 0) > 0
                  ? "text-amber-800 bg-amber-50 hover:bg-amber-100"
                  : "text-slate-600 hover:bg-slate-100 active:bg-slate-200"
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-700 shrink-0" />
              <span>Хуваарилаагүй захиалга</span>
              <span className={`px-1.5 sm:px-2 py-0.5 rounded-full text-[10px] font-black ${
                activeTab === "unassigned" 
                  ? "bg-slate-900 text-white" 
                  : (data?.summary.unassignedOrdersCount || 0) > 0 
                  ? "bg-amber-200 text-amber-900" 
                  : "bg-slate-100 text-slate-700"
              }`}>
                {data?.unassignedOrders?.length || 0}
              </span>
            </button>
          </div>

          {/* View toggle (Grid / Table) */}
          {(activeTab === "imd_fleet" || activeTab === "assignments" || activeTab === "city_fleet") && (
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl shrink-0 self-end md:self-auto">
              <button
                onClick={() => setViewLayout("table")}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  viewLayout === "table" ? "bg-white text-slate-900 shadow-2xs" : "text-slate-500 hover:text-slate-800"
                }`}
                title="Хүснэгтээр харах"
              >
                <List className="w-3.5 h-3.5" />
                <span>Хүснэгт</span>
              </button>
              <button
                onClick={() => setViewLayout("cards")}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  viewLayout === "cards" ? "bg-white text-slate-900 shadow-2xs" : "text-slate-500 hover:text-slate-800"
                }`}
                title="Картаар харах"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>Карт</span>
              </button>
            </div>
          )}
        </div>

        {/* 
          3. SEARCH AND FILTERS TOOLBAR
        */}
        <div className="bg-white rounded-2xl p-3 sm:p-4 border border-slate-200/90 shadow-2xs space-y-2.5 sm:space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 sm:gap-3">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Машины дугаар (1096УНЗ...), жолооч, чиглэл, захиалга №..."
                className="w-full pl-9 pr-9 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#0878bd] focus:border-[#0878bd] bg-slate-50/70"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                  aria-label="Цэвэрлэх"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Province selector & Reset button */}
            <div className="flex items-center gap-2">
              <select
                value={provinceFilter}
                onChange={(e) => setProvinceFilter(e.target.value)}
                className="flex-1 sm:flex-none px-3 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 bg-white outline-none focus:border-[#0878bd] min-h-[42px]"
              >
                <option value="all">Бүх Чиглэл / Аймаг ({provinces.length})</option>
                {provinces.map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>

              {(searchTerm || provinceFilter !== "all" || statusFilter !== "all" || fleetFilter !== "all") && (
                <button
                  onClick={() => {
                    setSearchTerm("");
                    setProvinceFilter("all");
                    setStatusFilter("all");
                    setFleetFilter("all");
                  }}
                  className="px-3 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold transition-all cursor-pointer shrink-0 min-h-[42px] touch-manipulation"
                >
                  Цэвэрлэх
                </button>
              )}
            </div>
          </div>

          {/* Fleet and Status chips */}
          {activeTab === "assignments" && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-slate-100">
              {/* Fleet Category filter */}
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                <span className="text-[11px] font-bold text-slate-400 mr-1 shrink-0">Флот:</span>
                {[
                  { id: "all", label: "Бүх 40 машин" },
                  { id: "city", label: "Хотын түгээлт (30)" },
                  { id: "regional", label: "Орон нутаг (10)" },
                ].map(f => (
                  <button
                    key={f.id}
                    onClick={() => setFleetFilter(f.id as any)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap cursor-pointer transition-all ${
                      fleetFilter === f.id
                        ? "bg-slate-900 text-white shadow-2xs"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              {/* Status Filter */}
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                <span className="text-[11px] font-bold text-slate-400 mr-1 shrink-0">Төлөв:</span>
                {[
                  { id: "all", label: "Бүгд" },
                  { id: "in_transit", label: "Тээвэрт гарсан" },
                  { id: "completed", label: "Хүргэгдсэн" },
                  { id: "scheduled", label: "Төлөвлөсөн" },
                ].map(st => (
                  <button
                    key={st.id}
                    onClick={() => setStatusFilter(st.id as any)}
                    className={`px-2.5 py-1.2 rounded-lg text-xs font-bold whitespace-nowrap cursor-pointer transition-all ${
                      statusFilter === st.id
                        ? "bg-[#0878bd] text-white shadow-2xs"
                        : "text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    {st.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* LOADING STATE */}
        {loading ? (
          <div className="py-20 text-center bg-white rounded-3xl border border-slate-200">
            <div className="inline-block w-9 h-9 border-4 border-[#0878bd] border-t-transparent rounded-full animate-spin"></div>
            <p className="mt-3 text-xs font-bold text-slate-600">Орон нутгийн түгээлт, томилолтын мэдээлэл татаж байна...</p>
          </div>
        ) : (
          <>
            {/* ========================================================================= */}
            {/* TAB -1: DAILY ROUTES REGISTRATION STATUS (MATCHING IMAGE.PNG)              */}
            {/* ========================================================================= */}
            {activeTab === "daily_routes" && (
              <div className="space-y-4">
                {/* Header & Date Bar */}
                <div className="bg-white/90 backdrop-blur-md p-5 rounded-3xl border border-slate-200/90 shadow-2xs">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                        <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
                          <Calendar className="w-5 h-5 text-emerald-600 shrink-0" />
                          <span>Өдрийн Жолооч & Машины Бүртгэлийн Төлөв (30 Чиглэл)</span>
                        </h2>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        Өдөр бүр бүртгэгдсэн жолооч, солигдсон машин, чиглэлийн бодит төлөв болон гарсан эсэхийг хянах шууд самбар.
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2.5">
                      {/* Date Picker */}
                      <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl shadow-2xs">
                        <Calendar className="w-4 h-4 text-slate-400" />
                        <input
                          type="date"
                          value={salesDailyDate}
                          onChange={e => setSalesDailyDate(e.target.value)}
                          className="bg-transparent text-sm font-black text-slate-800 focus:outline-none cursor-pointer"
                        />
                      </div>

                      {/* Refresh */}
                      <button
                        onClick={() => fetchSalesDailyStatus(salesDailyDate)}
                        disabled={salesDailyLoading}
                        className="p-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-50 cursor-pointer"
                        title="Шинэчлэх"
                      >
                        <RefreshCw className={`w-4 h-4 ${salesDailyLoading ? "animate-spin" : ""}`} />
                      </button>

                      {/* Link to Monthly Exception Report */}
                      <button
                        onClick={() => setActiveTab("monthly_exceptions")}
                        className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-purple-50 hover:bg-purple-100 border border-purple-200 text-purple-900 text-xs font-bold transition-all cursor-pointer"
                      >
                        <FileSpreadsheet className="w-3.5 h-3.5 text-purple-700" />
                        <span>Сар бүрийн тайлан харах</span>
                      </button>
                    </div>
                  </div>

                  {/* 5 Stats Cards Row matching image.png */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5 mt-5">
                    {/* Card 1: Нийт чиглэл */}
                    <div className="bg-slate-50/80 p-3.5 rounded-2xl border border-slate-200/70 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-slate-200/80 text-slate-700 flex items-center justify-center font-black">
                        <Truck className="w-5 h-5 text-slate-700" />
                      </div>
                      <div>
                        <div className="text-[11px] font-bold text-slate-500 uppercase">Нийт чиглэл</div>
                        <div className="text-xl font-black text-slate-800">
                          {salesDailyData?.summary?.totalCount || 0}
                        </div>
                        <div className="text-[10px] text-slate-400">Нийт хуваарилагдсан</div>
                      </div>
                    </div>

                    {/* Card 2: Жолоочийн асуудал */}
                    <div className={`p-3.5 rounded-2xl border flex items-center gap-3 transition-colors ${
                      (salesDailyData?.summary?.driverIssues || 0) > 0 ? "bg-amber-50/90 border-amber-300" : "bg-slate-50/80 border-slate-200/70"
                    }`}>
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black ${
                        (salesDailyData?.summary?.driverIssues || 0) > 0 ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-400"
                      }`}>
                        <AlertTriangle className="w-5 h-5" />
                      </div>
                      <div>
                        <div className={`text-[11px] font-bold uppercase ${(salesDailyData?.summary?.driverIssues || 0) > 0 ? "text-amber-900" : "text-slate-500"}`}>
                          Жолоочийн асуудал
                        </div>
                        <div className={`text-xl font-black ${(salesDailyData?.summary?.driverIssues || 0) > 0 ? "text-amber-950" : "text-slate-700"}`}>
                          {salesDailyData?.summary?.driverIssues || 0}
                        </div>
                        <div className="text-[10px] text-amber-700 font-medium">Чөлөө, эмнэлэг гэх мэт</div>
                      </div>
                    </div>

                    {/* Card 3: Машины асуудал */}
                    <div className={`p-3.5 rounded-2xl border flex items-center gap-3 transition-colors ${
                      (salesDailyData?.summary?.vehicleIssues || 0) > 0 ? "bg-purple-50/90 border-purple-300" : "bg-slate-50/80 border-slate-200/70"
                    }`}>
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black ${
                        (salesDailyData?.summary?.vehicleIssues || 0) > 0 ? "bg-purple-100 text-purple-800" : "bg-slate-100 text-slate-400"
                      }`}>
                        <Truck className="w-5 h-5" />
                      </div>
                      <div>
                        <div className={`text-[11px] font-bold uppercase ${(salesDailyData?.summary?.vehicleIssues || 0) > 0 ? "text-purple-900" : "text-slate-500"}`}>
                          Машины асуудал
                        </div>
                        <div className={`text-xl font-black ${(salesDailyData?.summary?.vehicleIssues || 0) > 0 ? "text-purple-950" : "text-slate-700"}`}>
                          {salesDailyData?.summary?.vehicleIssues || 0}
                        </div>
                        <div className="text-[10px] text-purple-700 font-medium">Засвар, үйлчилгээтэй</div>
                      </div>
                    </div>

                    {/* Card 4: Гараагүй/Цуцалсан */}
                    <div className={`p-3.5 rounded-2xl border flex items-center gap-3 transition-colors ${
                      (salesDailyData?.summary?.nonDepartures || 0) > 0 ? "bg-rose-50/90 border-rose-300" : "bg-slate-50/80 border-slate-200/70"
                    }`}>
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black ${
                        (salesDailyData?.summary?.nonDepartures || 0) > 0 ? "bg-rose-100 text-rose-800" : "bg-slate-100 text-slate-400"
                      }`}>
                        <X className="w-5 h-5" />
                      </div>
                      <div>
                        <div className={`text-[11px] font-bold uppercase ${(salesDailyData?.summary?.nonDepartures || 0) > 0 ? "text-rose-900" : "text-slate-500"}`}>
                          Гараагүй/Цуцалсан
                        </div>
                        <div className={`text-xl font-black ${(salesDailyData?.summary?.nonDepartures || 0) > 0 ? "text-rose-950" : "text-slate-700"}`}>
                          {salesDailyData?.summary?.nonDepartures || 0}
                        </div>
                        <div className="text-[10px] text-rose-700 font-medium">Ажиллаагүй чиглэл</div>
                      </div>
                    </div>

                    {/* Card 5: Өөрчилсөн */}
                    <div className={`p-3.5 rounded-2xl border flex items-center gap-3 transition-colors ${
                      (salesDailyData?.summary?.changedCount || 0) > 0 ? "bg-sky-50/90 border-sky-300" : "bg-slate-50/80 border-slate-200/70"
                    }`}>
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black ${
                        (salesDailyData?.summary?.changedCount || 0) > 0 ? "bg-sky-100 text-sky-800" : "bg-slate-100 text-slate-400"
                      }`}>
                        <RotateCcw className="w-5 h-5" />
                      </div>
                      <div>
                        <div className={`text-[11px] font-bold uppercase ${(salesDailyData?.summary?.changedCount || 0) > 0 ? "text-sky-900" : "text-slate-500"}`}>
                          Өөрчилсөн
                        </div>
                        <div className={`text-xl font-black ${(salesDailyData?.summary?.changedCount || 0) > 0 ? "text-sky-950" : "text-slate-700"}`}>
                          {salesDailyData?.summary?.changedCount || 0}
                        </div>
                        <div className="text-[10px] text-sky-700 font-medium">Нийт солигдсон</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Filter and Search Bar */}
                <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3">
                  {/* Status Filters */}
                  <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                    {[
                      { id: "all", label: `Бүгд (${salesDailyData?.routes?.length || 0})` },
                      { id: "changed", label: `Солигдсон (${salesDailyData?.summary?.changedCount || 0})` },
                      { id: "driver_issue", label: `Жолоочийн асуудал (${salesDailyData?.summary?.driverIssues || 0})` },
                      { id: "vehicle_issue", label: `Машины асуудал (${salesDailyData?.summary?.vehicleIssues || 0})` },
                      { id: "cancelled", label: `Гараагүй (${salesDailyData?.summary?.nonDepartures || 0})` },
                    ].map(f => (
                      <button
                        key={f.id}
                        onClick={() => setSalesDailyFilter(f.id as any)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap cursor-pointer transition-all ${
                          salesDailyFilter === f.id
                            ? "bg-slate-900 text-white shadow-2xs font-black"
                            : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>

                  {/* Search */}
                  <div className="relative min-w-[240px]">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      placeholder="Машин, жолооч, чиглэл, борлуулагч хайх..."
                      value={salesDailySearch}
                      onChange={e => setSalesDailySearch(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-1.5 text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                {/* Table matching image.png */}
                <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xs">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-50/90 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                          <th className="p-3 pl-4 whitespace-nowrap">Д/д</th>
                          <th className="p-3 whitespace-nowrap">Чиглэл</th>
                          <th className="p-3 min-w-[140px]">Бүсчлэл</th>
                          <th className="p-3 whitespace-nowrap">Үндсэн жолооч</th>
                          <th className="p-3 whitespace-nowrap">Утас</th>
                          <th className="p-3 min-w-[100px]">Төлөв</th>
                          <th className="p-3 min-w-[110px]">Шалтгаан</th>
                          <th className="p-3 min-w-[140px]">Орлон явсан жолооч</th>
                          <th className="p-3 whitespace-nowrap">Борлуулагч</th>
                          <th className="p-3 whitespace-nowrap">Утас</th>
                          <th className="p-3 whitespace-nowrap">СР Код</th>
                          <th className="p-3 whitespace-nowrap">Үндсэн тэрэг</th>
                          <th className="p-3 min-w-[100px]">Төлөв</th>
                          <th className="p-3 min-w-[110px]">Шалтгаан</th>
                          <th className="p-3 min-w-[110px]">Орлон явсан тэрэг</th>
                          <th className="p-3 min-w-[100px] pr-4">Чиглэлийн төлөв</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium">
                        {salesDailyLoading ? (
                          <tr>
                            <td colSpan={16} className="py-16 text-center text-slate-400">
                              <div className="flex items-center justify-center gap-2">
                                <RefreshCw className="w-4 h-4 animate-spin text-emerald-600" />
                                <span>Өдрийн бүртгэлийг уншиж байна...</span>
                              </div>
                            </td>
                          </tr>
                        ) : !salesDailyData?.routes || salesDailyData.routes.length === 0 ? (
                          <tr>
                            <td colSpan={16} className="py-16 text-center text-slate-400">
                              Тухайн өдрийн бүртгэл олдсонгүй
                            </td>
                          </tr>
                        ) : (
                          salesDailyData.routes
                            .filter(item => {
                              // Filter by status
                              if (salesDailyFilter === "changed" && !item.driverChanged && !item.vehicleChanged) return false;
                              if (salesDailyFilter === "driver_issue" && (item.driverStatus === "Идэвхтэй" || !item.driverStatus)) return false;
                              if (salesDailyFilter === "vehicle_issue" && (item.vehicleStatus === "Хэвийн" || !item.vehicleStatus)) return false;
                              if (salesDailyFilter === "cancelled" && item.routeStatus === "Гарсан") return false;
                              if (salesDailyFilter === "normal" && (item.driverChanged || item.vehicleChanged || item.routeStatus !== "Гарсан")) return false;

                              // Search
                              if (salesDailySearch.trim()) {
                                const q = salesDailySearch.toLowerCase().trim();
                                const m1 = (item.routeId || "").toLowerCase().includes(q);
                                const m2 = (item.routeName || "").toLowerCase().includes(q);
                                const m3 = (item.originalDriverName || "").toLowerCase().includes(q) || (item.actualDriverName || "").toLowerCase().includes(q);
                                const m4 = (item.originalVehiclePlate || "").toLowerCase().includes(q) || (item.actualVehiclePlate || "").toLowerCase().includes(q);
                                const m5 = (item.salesRep || "").toLowerCase().includes(q);
                                return m1 || m2 || m3 || m4 || m5;
                              }
                              return true;
                            })
                            .map((row, idx) => {
                              const isDriverChanged = row.driverChanged;
                              const isVehicleChanged = row.vehicleChanged;

                              return (
                                <tr
                                  key={row.routeId || idx}
                                  className={`hover:bg-slate-50/80 transition-colors ${
                                    isDriverChanged || isVehicleChanged ? "bg-amber-50/20" : ""
                                  }`}
                                >
                                  {/* Д/д */}
                                  <td className="p-3 pl-4 text-slate-400 font-mono text-[11px]">{idx + 1}</td>

                                  {/* Чиглэл */}
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
                                  <td className="p-3 font-mono text-slate-600 whitespace-nowrap">
                                    {row.driverPhone || "-"}
                                  </td>

                                  {/* Жолоочийн Төлөв */}
                                  <td className="p-3">
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-black ${
                                      row.driverStatus === "Идэвхтэй" || !row.driverStatus
                                        ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                                        : row.driverStatus === "Солигдсон"
                                        ? "bg-amber-100 text-amber-900 border border-amber-300"
                                        : "bg-rose-100 text-rose-800 border border-rose-300"
                                    }`}>
                                      {row.driverStatus || "Идэвхтэй"}
                                    </span>
                                  </td>

                                  {/* Жолоочийн Шалтгаан */}
                                  <td className="p-3 text-slate-600 max-w-[120px] truncate" title={row.driverReason}>
                                    {row.driverReason || "-"}
                                  </td>

                                  {/* Орлон явсан жолооч */}
                                  <td className="p-3">
                                    {isDriverChanged ? (
                                      <span className="font-bold text-amber-900 bg-amber-100/80 px-2 py-0.5 rounded border border-amber-300 whitespace-nowrap">
                                        {row.actualDriverName}
                                      </span>
                                    ) : (
                                      <span className="text-slate-400">-</span>
                                    )}
                                  </td>

                                  {/* Борлуулагч */}
                                  <td className="p-3 text-slate-800 font-bold whitespace-nowrap">
                                    {row.salesRep || "-"}
                                  </td>

                                  {/* Борлуулагчийн Утас */}
                                  <td className="p-3 font-mono text-slate-600 whitespace-nowrap">
                                    {row.salesRepPhone || "-"}
                                  </td>

                                  {/* СР Код */}
                                  <td className="p-3 font-mono text-slate-500 whitespace-nowrap text-[11px]">
                                    {row.srCode || "-"}
                                  </td>

                                  {/* Үндсэн тэрэг */}
                                  <td className="p-3 font-mono font-bold text-slate-800 whitespace-nowrap">
                                    {row.originalVehiclePlate}
                                  </td>

                                  {/* Машины Төлөв */}
                                  <td className="p-3">
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-black ${
                                      row.vehicleStatus === "Хэвийн" || !row.vehicleStatus
                                        ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                                        : "bg-purple-100 text-purple-900 border border-purple-300"
                                    }`}>
                                      {row.vehicleStatus || "Хэвийн"}
                                    </span>
                                  </td>

                                  {/* Машины Шалтгаан */}
                                  <td className="p-3 text-slate-600 max-w-[120px] truncate" title={row.vehicleReason}>
                                    {row.vehicleReason || "-"}
                                  </td>

                                  {/* Орлон явсан тэрэг */}
                                  <td className="p-3 font-mono font-bold">
                                    {isVehicleChanged ? (
                                      <span className="text-purple-950 bg-purple-100 px-2 py-0.5 rounded border border-purple-300">
                                        {row.actualVehiclePlate}
                                      </span>
                                    ) : (
                                      <span className="text-slate-400">-</span>
                                    )}
                                  </td>

                                  {/* Чиглэлийн төлөв */}
                                  <td className="p-3 pr-4">
                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                                      row.routeStatus === "Гарсан" || !row.routeStatus
                                        ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                                        : "bg-rose-100 text-rose-900 border border-rose-300"
                                    }`}>
                                      {row.routeStatus || "Гарсан"}
                                    </span>
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

            {/* ========================================================================= */}
            {/* TAB -0.5: MONTHLY EXCEPTION REPORTS (Машин, Жолооч, Бүс гараагүй)          */}
            {/* ========================================================================= */}
            {activeTab === "monthly_exceptions" && (
              <MonthlyExceptionReportView onShowToast={onShowToast || (() => {})} />
            )}

            {/* ========================================================================= */}
            {/* TAB 0: IMD REGIONAL HEAVY TRUCKS (GPS LIVE)                               */}
            {/* ========================================================================= */}
            {activeTab === "imd_fleet" && (
              <div className="space-y-3.5 sm:space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gradient-to-r from-[#0878bd]/10 via-sky-50 to-indigo-50/40 p-4 rounded-2xl border border-sky-200">
                  <div>
                    <h2 className="text-sm sm:text-base font-black text-slate-900 flex items-center gap-2">
                      <Navigation className="w-5 h-5 text-[#0878bd] shrink-0" />
                      <span>IMD Орон Нутгийн Тээврийн Парк (GPS Live)</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300">
                        {data?.imdFleet?.filter(v => (v.speed || 0) > 0).length || 0} машин хөдөлгөөнд
                      </span>
                    </h2>
                    <p className="text-[11px] sm:text-xs text-slate-600 mt-1">
                      Орон нутгийн 10 хүнд даацын хөлдөөгчтэй машины GPSBox бодит байршил, одометр, хурд, температур, түлшний шууд мэдээлэл.
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleOpenVehicleMap()}
                      className="px-3.5 py-2 rounded-xl bg-[#0878bd] hover:bg-[#0768a4] active:scale-95 text-white text-xs font-black flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
                      title="Бүх IMD машины байршлыг газрын зураг дээр харах"
                    >
                      <Navigation className="w-4 h-4 text-emerald-300 shrink-0" />
                      <span>Газрын зурагт бүгдийг харах</span>
                    </button>
                    <span className="text-xs font-bold text-slate-700 bg-white px-2.5 py-1.5 rounded-xl border border-slate-200 shadow-2xs">
                      {filteredImdFleet.length} машин
                    </span>
                  </div>
                </div>

                {filteredImdFleet.length === 0 ? (
                  <div className="bg-white rounded-3xl p-8 sm:p-12 text-center border border-slate-200/90 shadow-2xs max-w-md mx-auto">
                    <Truck className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                    <h3 className="text-sm sm:text-base font-bold text-slate-800">Машин олдсонгүй</h3>
                    <p className="text-xs text-slate-500 mt-1">Хайлтын утгаа шалгана уу.</p>
                  </div>
                ) : viewLayout === "table" ? (
                  /* ---------------- TABLE VIEW ---------------- */
                  <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-700 font-bold uppercase text-[10px] tracking-wider">
                            <th className="p-3.5">Машины дугаар</th>
                            <th className="p-3.5">Хариуцсан жолооч</th>
                            <th className="p-3.5">Чиглэл / Бүс</th>
                            <th className="p-3.5 text-center">GPS Төлөв</th>
                            <th className="p-3.5 text-right">Хурд</th>
                            <th className="p-3.5 text-right">Одоогийн ODO</th>
                            <th className="p-3.5 text-center">Температур / Түлш</th>
                            <th className="p-3.5 text-right">Сүүлийн мэдээ</th>
                            <th className="p-3.5 text-right">Үйлдэл</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {filteredImdFleet.map((veh) => {
                            const isMoving = (veh.speed || 0) > 0;
                            return (
                              <tr key={veh.id} className="hover:bg-sky-50/40 transition-colors">
                                <td className="p-3.5 whitespace-nowrap">
                                  <div className="flex items-center gap-2">
                                    <button
                                      onClick={() => handleOpenVehicleMap(veh)}
                                      className="font-mono font-black text-slate-900 hover:text-[#0878bd] text-xs px-2.5 py-1.5 rounded-lg bg-sky-50/80 hover:bg-sky-100 border border-sky-300 text-[#0878bd] transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs"
                                      title="Газрын зураг дээр шууд байршил харах"
                                    >
                                      <Navigation className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                      <span className="font-black">{veh.vehiclePlate}</span>
                                    </button>
                                    <span className="px-1.5 py-0.5 rounded text-[10px] font-black bg-amber-100 text-amber-900 border border-amber-300">
                                      IMD
                                    </span>
                                  </div>
                                  <span className="text-[10px] text-slate-400 block mt-1 font-medium">{veh.model}</span>
                                </td>

                                <td className="p-3.5 whitespace-nowrap">
                                  <div className="font-bold text-slate-900">{veh.name}</div>
                                  {veh.phone && (
                                    <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                                      <Phone className="w-3 h-3 text-slate-400" />
                                      <span>{veh.phone}</span>
                                    </div>
                                  )}
                                </td>

                                <td className="p-3.5">
                                  <div className="flex items-center gap-1.5 font-bold text-slate-800">
                                    <MapPin className="w-3.5 h-3.5 text-[#0878bd] shrink-0" />
                                    <span>{veh.zone || veh.defaultRoute || "Орон нутаг"}</span>
                                  </div>
                                  {veh.activeAssignment && (
                                    <span className="text-[10px] text-purple-700 font-bold block mt-0.5">
                                      Томилолт: {veh.activeAssignment.orderNo}
                                    </span>
                                  )}
                                </td>

                                <td className="p-3.5 text-center whitespace-nowrap">
                                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-black inline-flex items-center gap-1.5 ${
                                    isMoving
                                      ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                                      : "bg-slate-100 text-slate-700 border border-slate-200"
                                  }`}>
                                    <span className={`w-2 h-2 rounded-full ${isMoving ? "bg-emerald-500 animate-ping" : "bg-slate-400"}`} />
                                    <span>{isMoving ? "Хөдөлж байна" : "Зогсож байна"}</span>
                                  </span>
                                </td>

                                <td className="p-3.5 text-right whitespace-nowrap">
                                  <span className={`font-mono font-black text-xs ${isMoving ? "text-emerald-700 text-sm" : "text-slate-500"}`}>
                                    {veh.speed ? `${veh.speed} км/ц` : "0 км/ц"}
                                  </span>
                                </td>

                                <td className="p-3.5 text-right font-mono font-bold text-slate-800 whitespace-nowrap">
                                  {veh.currentOdo ? `${Number(veh.currentOdo).toLocaleString()} км` : "-"}
                                </td>

                                <td className="p-3.5 text-center whitespace-nowrap">
                                  <div className="flex items-center justify-center gap-2">
                                    {veh.temp && veh.temp !== "--°C" && (
                                      <span className="px-2 py-0.5 rounded bg-sky-50 border border-sky-200 text-sky-800 text-[11px] font-bold">
                                        ❄️ {veh.temp}
                                      </span>
                                    )}
                                    {veh.fuel && veh.fuel !== "--" && (
                                      <span className="px-2 py-0.5 rounded bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-bold">
                                        ⛽ {veh.fuel}
                                      </span>
                                    )}
                                    {(!veh.temp || veh.temp === "--°C") && (!veh.fuel || veh.fuel === "--") && (
                                      <span className="text-slate-400 text-[11px]">-</span>
                                    )}
                                  </div>
                                </td>

                                <td className="p-3.5 text-right text-slate-500 text-[11px] whitespace-nowrap font-mono">
                                  {veh.dtTracker ? veh.dtTracker.split(" ")[1] || veh.dtTracker : "Шинэ"}
                                </td>

                                <td className="p-3.5 text-right whitespace-nowrap">
                                  <div className="flex items-center justify-end gap-1.5">
                                    <button
                                      onClick={() => handleOpenVehicleMap(veh)}
                                      className="px-2.5 py-1.5 rounded-lg bg-[#0878bd] hover:bg-[#0768a4] text-white text-xs font-black inline-flex items-center gap-1 transition-all cursor-pointer shadow-xs"
                                      title="Газрын зураг дээр харах"
                                    >
                                      <Navigation className="w-3.5 h-3.5 text-emerald-300" />
                                      <span>Байршил</span>
                                    </button>
                                    <a
                                      href={`/waybill?driver=${encodeURIComponent(veh.code)}`}
                                      className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold inline-flex items-center gap-1 transition-all"
                                      title="Замын хуудас харах"
                                    >
                                      <span>Хуудас</span>
                                      <ExternalLink className="w-3 h-3" />
                                    </a>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  /* ---------------- CARDS VIEW ---------------- */
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
                    {filteredImdFleet.map((veh) => {
                      const isMoving = (veh.speed || 0) > 0;
                      return (
                        <div
                          key={veh.id}
                          className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/90 hover:border-sky-400 hover:shadow-md transition-all flex flex-col justify-between space-y-3"
                        >
                          <div>
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => handleOpenVehicleMap(veh)}
                                  className="font-mono font-black text-slate-900 hover:text-[#0878bd] text-sm px-2.5 py-1 rounded-lg bg-sky-50 border border-sky-300 hover:border-[#0878bd] transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs"
                                  title="Газрын зураг дээр харах"
                                >
                                  <Navigation className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                  <span>{veh.vehiclePlate}</span>
                                </button>
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-black bg-amber-100 text-amber-900 border border-amber-300">
                                  IMD
                                </span>
                              </div>
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black flex items-center gap-1 ${
                                isMoving ? "bg-emerald-100 text-emerald-800 border border-emerald-300" : "bg-slate-100 text-slate-600 border border-slate-200"
                              }`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${isMoving ? "bg-emerald-500 animate-ping" : "bg-slate-400"}`} />
                                {isMoving ? `${veh.speed} км/ц` : "Зогсож байна"}
                              </span>
                            </div>

                            <div className="mt-3 pt-3 border-t border-slate-100 space-y-1.5 text-xs">
                              <div className="flex items-center justify-between">
                                <span className="text-slate-500 font-medium">Жолооч:</span>
                                <span className="font-bold text-slate-900">{veh.name}</span>
                              </div>
                              {veh.phone && (
                                <div className="flex items-center justify-between text-[11px]">
                                  <span className="text-slate-400">Утас:</span>
                                  <span className="text-slate-600 font-medium">{veh.phone}</span>
                                </div>
                              )}
                              <div className="flex items-center justify-between">
                                <span className="text-slate-500 font-medium">Чиглэл:</span>
                                <span className="font-bold text-[#0878bd]">{veh.zone || veh.defaultRoute || "Орон нутаг"}</span>
                              </div>
                              <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                                <span className="text-slate-500 font-medium">Одоогийн ODO:</span>
                                <span className="font-mono font-black text-slate-900">
                                  {veh.currentOdo ? `${Number(veh.currentOdo).toLocaleString()} км` : "-"}
                                </span>
                              </div>
                              {((veh.temp && veh.temp !== "--°C") || (veh.fuel && veh.fuel !== "--")) && (
                                <div className="flex items-center justify-between pt-1 text-[11px]">
                                  <span className="text-slate-400">Хөлдөөгч / Түлш:</span>
                                  <span className="font-bold text-slate-700">
                                    {veh.temp || ""} {veh.fuel ? `• ${veh.fuel}` : ""}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-2 pt-1">
                            <button
                              onClick={() => handleOpenVehicleMap(veh)}
                              className="py-2.5 px-3 rounded-xl bg-[#0878bd] hover:bg-[#0768a4] text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs"
                            >
                              <Navigation className="w-3.5 h-3.5 text-emerald-300" />
                              <span>Байршил</span>
                            </button>
                            <a
                              href={`/waybill?driver=${encodeURIComponent(veh.code)}`}
                              className="py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center justify-center gap-1.5 transition-all"
                            >
                              <span>Замын хуудас</span>
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ========================================================================= */}
            {/* TAB 1: IMD REGIONAL ASSIGNMENTS (10 TRUCKS)                               */}
            {/* ========================================================================= */}
            {activeTab === "assignments" && (
              <div className="space-y-3.5 sm:space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-sm sm:text-base font-black text-slate-900 flex items-center gap-1.5 sm:gap-2">
                      <MapPin className="w-4 h-4 sm:w-5 sm:h-5 text-purple-700" />
                      <span>IMD Орон Нутгийн Томилолтууд (10 Ачааны Машин)</span>
                    </h2>
                    <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5">
                      Зөвхөн орон нутгийн аймгуудын чиглэлд албан бичгээр баталгаажсан холын зайн ачаа тээврийн томилолтууд
                    </p>
                  </div>
                  <span className="text-[11px] sm:text-xs font-bold text-slate-700 bg-white px-2.5 py-1 rounded-xl border border-slate-200 shrink-0">
                    Илэрц: {filteredAssignments.length} / {allAssignments.length}
                  </span>
                </div>

                {filteredAssignments.length === 0 ? (
                  <div className="bg-white rounded-3xl p-8 sm:p-12 text-center border border-slate-200/90 shadow-2xs max-w-md mx-auto">
                    <Package className="w-10 h-10 sm:w-12 sm:h-12 text-slate-300 mx-auto mb-3" />
                    <h3 className="text-sm sm:text-base font-bold text-slate-800">Шалгуурт тохирох томилолт олдсонгүй</h3>
                    <p className="text-xs text-slate-500 mt-1">Хайлтын утга эсвэл шүүлтүүрээ шалгана уу.</p>
                  </div>
                ) : viewLayout === "table" ? (
                  /* ---------------- TABLE VIEW ---------------- */
                  <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-700 font-bold uppercase text-[10px] tracking-wider">
                            <th className="p-3.5">Машин / Төрөл</th>
                            <th className="p-3.5">Хариуцсан жолооч</th>
                            <th className="p-3.5">Чиглэл / Бүс</th>
                            <th className="p-3.5">Томилолтын №</th>
                            <th className="p-3.5">Огноо</th>
                            <th className="p-3.5 text-right">Ачсан тоо</th>
                            <th className="p-3.5 text-center">Төлөв</th>
                            <th className="p-3.5 text-center">Албан бичиг</th>
                            <th className="p-3.5 text-right">Үйлдэл</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {filteredAssignments.map((asn) => {
                            const isInTransit = asn.status === "Тээвэрт гарсан";
                            const isCompleted = asn.status === "Дууссан" || asn.status === "Хүргэгдсэн";

                            return (
                              <tr key={asn.id} className="hover:bg-sky-50/30 transition-colors">
                                {/* Vehicle Plate & Fleet badge */}
                                <td className="p-3.5 whitespace-nowrap">
                                  <div className="flex items-center gap-2">
                                    <button
                                      onClick={() => handleOpenVehicleMap({
                                        vehiclePlate: asn.vehiclePlate,
                                        name: asn.primaryDriverName,
                                        phone: asn.primaryDriverPhone,
                                        zone: asn.province,
                                        currentOdo: asn.endOdo || asn.startOdo,
                                        lat: asn.lat,
                                        lng: asn.lng,
                                        speed: asn.speed,
                                        temp: asn.temp,
                                        fuel: asn.fuel,
                                        dtTracker: asn.dtTracker,
                                        isLive: asn.isLive
                                      })}
                                      className="font-mono font-black text-slate-900 hover:text-[#0878bd] text-xs px-2 py-1 rounded bg-slate-100 hover:bg-sky-50 border border-slate-200 hover:border-[#0878bd] transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs"
                                      title="Газрын зураг дээр байршил харах"
                                    >
                                      <Navigation className="w-3 h-3 text-emerald-600 shrink-0" />
                                      <span>{asn.vehiclePlate}</span>
                                    </button>
                                    {getFleetBadge(asn.vehiclePlate)}
                                  </div>
                                </td>

                                {/* Driver Name & Phone */}
                                <td className="p-3.5 whitespace-nowrap">
                                  <div className="font-bold text-slate-900 flex items-center gap-1.5">
                                    <span>{asn.primaryDriverName}</span>
                                  </div>
                                  {asn.primaryDriverPhone && (
                                    <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                                      <Phone className="w-3 h-3 text-slate-400" />
                                      <span>{asn.primaryDriverPhone}</span>
                                    </div>
                                  )}
                                </td>

                                {/* Destination / Route */}
                                <td className="p-3.5">
                                  <div className="flex items-center gap-1.5 font-bold text-[#0878bd]">
                                    <MapPin className="w-3.5 h-3.5 text-[#0878bd] shrink-0" />
                                    <span>{asn.province}</span>
                                  </div>
                                  {asn.destination && asn.destination !== asn.province && (
                                    <span className="text-[11px] text-slate-500 block truncate max-w-xs">
                                      {asn.destination}
                                    </span>
                                  )}
                                </td>

                                {/* Order No */}
                                <td className="p-3.5 font-mono text-[11px] font-bold text-slate-600 whitespace-nowrap">
                                  {asn.orderNo}
                                </td>

                                {/* Date */}
                                <td className="p-3.5 text-slate-600 whitespace-nowrap">
                                  <div className="flex items-center gap-1 text-[11px]">
                                    <Calendar className="w-3 h-3 text-slate-400" />
                                    <span>{asn.departureDate || asn.deliveryDate || "-"}</span>
                                  </div>
                                </td>

                                {/* Quantity */}
                                <td className="p-3.5 text-right font-black text-slate-900 whitespace-nowrap">
                                  <span className="bg-sky-50 px-2 py-0.5 rounded border border-sky-200 text-[#0878bd]">
                                    {asn.quantity.toLocaleString()} хайрцаг
                                  </span>
                                </td>

                                {/* Status */}
                                <td className="p-3.5 text-center whitespace-nowrap">
                                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-black inline-flex items-center gap-1 ${
                                    isCompleted
                                      ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                                      : isInTransit
                                      ? "bg-sky-100 text-sky-800 border border-sky-300"
                                      : "bg-slate-100 text-slate-700 border border-slate-200"
                                  }`}>
                                    {isInTransit && <span className="w-1.5 h-1.5 rounded-full bg-sky-500 animate-ping" />}
                                    {isCompleted && <CheckCircle2 className="w-3 h-3" />}
                                    <span>{asn.status}</span>
                                  </span>
                                </td>

                                {/* Alban Bichig */}
                                <td className="p-3.5 text-center whitespace-nowrap">
                                  {asn.albanBichigDugaar ? (
                                    <a
                                      href={asn.albanBichigPdfUrl || `/api/imd/official-letters/pdf/${asn.id}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-50 text-[#0878bd] hover:bg-blue-100 border border-blue-200 font-mono text-[10px] font-bold"
                                      title="Албан бичиг татах"
                                    >
                                      <FileText className="w-3 h-3" />
                                      <span>{asn.albanBichigDugaar}</span>
                                    </a>
                                  ) : (
                                    <span className="text-[10px] text-slate-400">-</span>
                                  )}
                                </td>

                                {/* Actions */}
                                <td className="p-3.5 text-right whitespace-nowrap">
                                  <div className="flex items-center justify-end gap-1.5">
                                    <button
                                      onClick={() => handleOpenVehicleMap({
                                        vehiclePlate: asn.vehiclePlate,
                                        name: asn.primaryDriverName,
                                        phone: asn.primaryDriverPhone,
                                        zone: asn.province,
                                        currentOdo: asn.endOdo || asn.startOdo,
                                        lat: asn.lat,
                                        lng: asn.lng,
                                        speed: asn.speed,
                                        temp: asn.temp,
                                        fuel: asn.fuel,
                                        dtTracker: asn.dtTracker,
                                        isLive: asn.isLive
                                      })}
                                      className="px-2.5 py-1.5 rounded-lg bg-sky-50 hover:bg-[#0878bd] text-[#0878bd] hover:text-white text-xs font-bold inline-flex items-center gap-1 transition-all border border-sky-200 hover:border-transparent cursor-pointer"
                                      title="GPS байршил харах"
                                    >
                                      <Navigation className="w-3 h-3" />
                                      <span>Байршил</span>
                                    </button>
                                    <a
                                      href={`/order/imd/${asn.shareToken || asn.id}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-[#0878bd] hover:text-white text-slate-700 text-xs font-bold inline-flex items-center gap-1 transition-all"
                                      title="Хяналтын хуудас харах"
                                    >
                                      <span>Хянах</span>
                                      <ExternalLink className="w-3 h-3" />
                                    </a>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  /* ---------------- CARDS VIEW ---------------- */
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
                    {filteredAssignments.map((shipment) => {
                      const isInTransit = shipment.status === "Тээвэрт гарсан";
                      const isCompleted = shipment.status === "Дууссан" || shipment.status === "Хүргэгдсэн";

                      return (
                        <div
                          key={shipment.id}
                          className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/90 hover:border-sky-300 hover:shadow-md transition-all flex flex-col justify-between space-y-3 sm:space-y-4"
                        >
                          {/* Top: Order No & Status */}
                          <div>
                            <div className="flex items-center justify-between gap-2 mb-2">
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono font-black text-xs text-[#123047] bg-slate-100 px-2 py-1 rounded-lg">
                                  {shipment.orderNo}
                                </span>
                                {getFleetBadge(shipment.vehiclePlate)}
                              </div>
                              <span className={`px-2 sm:px-2.5 py-1 rounded-full text-[10px] sm:text-xs font-black flex items-center gap-1.5 ${
                                isCompleted
                                  ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                                  : isInTransit
                                  ? "bg-sky-100 text-sky-800 border border-sky-300"
                                  : "bg-blue-50 text-blue-800 border border-blue-200"
                              }`}>
                                {isInTransit && <span className="w-2 h-2 rounded-full bg-sky-500 animate-ping" />}
                                {isCompleted && <CheckCircle2 className="w-3.5 h-3.5" />}
                                <span>{shipment.status}</span>
                              </span>
                            </div>

                            {/* Destination Banner */}
                            <div className="mt-2.5 p-2.5 sm:p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between">
                              <div className="flex items-center gap-2 min-w-0">
                                <MapPin className="w-4 h-4 text-[#0878bd] shrink-0" />
                                <div className="min-w-0">
                                  <span className="text-xs font-black text-slate-900 block truncate">
                                    {shipment.province}
                                  </span>
                                  <span className="text-[10px] sm:text-[11px] text-slate-500 font-medium block truncate">
                                    {shipment.destination || shipment.province}
                                  </span>
                                </div>
                              </div>
                              <div className="text-right shrink-0">
                                <span className="text-xs font-black text-[#0878bd] bg-white px-2 py-0.5 rounded shadow-2xs border border-slate-200 block">
                                  {shipment.quantity.toLocaleString()} хайрцаг
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Middle: Vehicle & Driver details */}
                          <div className="space-y-1.5 sm:space-y-2 text-xs border-t border-slate-100 pt-3">
                            <div className="flex items-center justify-between">
                              <span className="text-slate-500 font-medium">Хариуцсан жолооч:</span>
                              <div className="text-right">
                                <span className="font-bold text-slate-900 block">
                                  {shipment.primaryDriverName}
                                </span>
                                {shipment.primaryDriverPhone && (
                                  <span className="text-[11px] text-slate-500 font-mono">
                                    {shipment.primaryDriverPhone}
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center justify-between">
                              <span className="text-slate-500 font-medium">Тээврийн хэрэгсэл:</span>
                              <button
                                onClick={() => handleOpenVehicleMap({
                                  vehiclePlate: shipment.vehiclePlate,
                                  name: shipment.primaryDriverName,
                                  phone: shipment.primaryDriverPhone,
                                  zone: shipment.province,
                                  currentOdo: shipment.endOdo || shipment.startOdo,
                                  lat: shipment.lat,
                                  lng: shipment.lng,
                                  speed: shipment.speed,
                                  temp: shipment.temp,
                                  fuel: shipment.fuel,
                                  dtTracker: shipment.dtTracker,
                                  isLive: shipment.isLive
                                })}
                                className="font-mono font-black text-slate-900 hover:text-[#0878bd] bg-white hover:bg-sky-50 border border-slate-300 hover:border-[#0878bd] px-2 py-0.5 rounded shadow-2xs transition-all cursor-pointer flex items-center gap-1"
                                title="Газрын зураг дээр харах"
                              >
                                <Navigation className="w-3 h-3 text-emerald-600 shrink-0" />
                                <span>{shipment.vehiclePlate}</span>
                              </button>
                            </div>

                            <div className="flex items-center justify-between">
                              <span className="text-slate-500 font-medium">Томилолтын огноо:</span>
                              <span className="font-bold text-slate-800 flex items-center gap-1">
                                <Calendar className="w-3 h-3 text-slate-400" />
                                {shipment.departureDate || shipment.deliveryDate || "-"}
                              </span>
                            </div>

                            {shipment.albanBichigDugaar && (
                              <div className="flex items-center justify-between">
                                <span className="text-slate-500 font-medium">Албан бичиг:</span>
                                <span className="font-mono font-bold text-[#0878bd] bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                                  {shipment.albanBichigDugaar}
                                </span>
                              </div>
                            )}
                          </div>

                          {/* Action Button */}
                          <div className="pt-2 border-t border-slate-100 grid grid-cols-2 gap-2">
                            <button
                              onClick={() => handleOpenVehicleMap({
                                vehiclePlate: shipment.vehiclePlate,
                                name: shipment.primaryDriverName,
                                phone: shipment.primaryDriverPhone,
                                zone: shipment.province,
                                currentOdo: shipment.endOdo || shipment.startOdo,
                                lat: shipment.lat,
                                lng: shipment.lng,
                                speed: shipment.speed,
                                temp: shipment.temp,
                                fuel: shipment.fuel,
                                dtTracker: shipment.dtTracker,
                                isLive: shipment.isLive
                              })}
                              className="py-2.5 px-3 rounded-xl bg-sky-50 hover:bg-[#0878bd] hover:text-white text-[#0878bd] text-xs font-bold flex items-center justify-center gap-1.5 transition-all border border-sky-200 hover:border-transparent cursor-pointer min-h-[44px]"
                            >
                              <Navigation className="w-3.5 h-3.5" />
                              <span>Байршил</span>
                            </button>
                            <a
                              href={`/order/imd/${shipment.shareToken || shipment.id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-[#0878bd] hover:text-white active:bg-[#0878bd] active:text-white text-slate-700 text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer touch-manipulation min-h-[44px]"
                            >
                              <span>Хянах</span>
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ========================================================================= */}
            {/* TAB 2: CITY FLEET (30 VEHICLES: 5 KA + 25 M SERIES)                       */}
            {/* ========================================================================= */}
            {activeTab === "city_fleet" && (
              <div className="space-y-3.5 sm:space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-sm sm:text-base font-black text-slate-900 flex items-center gap-1.5 sm:gap-2">
                      <Navigation className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-700" />
                      <span>Хотын Борлуулалт & Түгээлтийн Автопарк (30 Машин)</span>
                    </h2>
                    <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5">
                      5 KA сүлжээ дэлгүүрийн түгээлт + 25 M дүүргийн борлуулалтын машин. Хотод томилолт бичигдэхгүй бөгөөд өдөр тутмын түгээлт, одометрийн эхлэл төгсгөлийн заалтаар ажиллана.
                    </p>
                  </div>
                  <span className="text-[11px] sm:text-xs font-bold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-xl border border-emerald-200 shrink-0">
                    Илэрц: {filteredCityFleet.length} / {data?.cityFleet?.length || 30}
                  </span>
                </div>

                {filteredCityFleet.length === 0 ? (
                  <div className="bg-white rounded-3xl p-8 sm:p-12 text-center border border-slate-200/90 shadow-2xs max-w-md mx-auto">
                    <Truck className="w-10 h-10 sm:w-12 sm:h-12 text-slate-300 mx-auto mb-3" />
                    <h3 className="text-sm sm:text-base font-bold text-slate-800">Машин олдсонгүй</h3>
                    <p className="text-xs text-slate-500 mt-1">Хайлтын утгаа шалгана уу.</p>
                  </div>
                ) : viewLayout === "table" ? (
                  <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-700 font-bold uppercase text-[10px] tracking-wider">
                            <th className="p-3.5">Машин / Төрөл</th>
                            <th className="p-3.5">Хариуцсан жолооч</th>
                            <th className="p-3.5">Хариуцсан ХТ</th>
                            <th className="p-3.5">Түгээлтийн бүс / Чиглэл</th>
                            <th className="p-3.5 text-right">Даац</th>
                            <th className="p-3.5 text-right">Одоогийн ODO</th>
                            <th className="p-3.5 text-right">Өдрийн гүйлт</th>
                            <th className="p-3.5 text-center">Төлөв</th>
                            <th className="p-3.5 text-right">Үйлдлүүд</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {filteredCityFleet.map((veh) => {
                            const isKA = KA_PLATES.has(veh.vehiclePlate.trim().toUpperCase());
                            return (
                              <tr key={veh.id} className="hover:bg-emerald-50/30 transition-colors">
                                <td className="p-3.5 whitespace-nowrap">
                                  <div className="flex items-center gap-2">
                                    <button
                                      onClick={() => handleOpenVehicleMap(veh)}
                                      className="font-mono font-black text-slate-900 hover:text-[#0878bd] text-xs px-2 py-1 rounded bg-slate-100 hover:bg-sky-50 border border-slate-200 hover:border-[#0878bd] transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs"
                                      title="Газрын зураг дээр байршил харах"
                                    >
                                      <Navigation className="w-3 h-3 text-emerald-600 shrink-0" />
                                      <span>{veh.vehiclePlate}</span>
                                    </button>
                                    {isKA ? (
                                      <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-sky-100 text-sky-800 border border-sky-200">
                                        KA Сүлжээ
                                      </span>
                                    ) : (
                                      <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200">
                                        M Дүүрэг
                                      </span>
                                    )}
                                  </div>
                                  <span className="text-[10px] text-slate-400 block mt-0.5">{veh.model}</span>
                                </td>
                                <td className="p-3.5 whitespace-nowrap">
                                  <div className="font-bold text-slate-900">{veh.name}</div>
                                  {veh.phone && (
                                    <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                                      <Phone className="w-3 h-3 text-slate-400" />
                                      <span>{veh.phone}</span>
                                    </div>
                                  )}
                                </td>
                                <td className="p-3.5 whitespace-nowrap font-medium text-slate-700">
                                  {veh.salesRep}
                                </td>
                                <td className="p-3.5">
                                  <div className="flex items-center gap-1.5 font-bold text-slate-800">
                                    <MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                    <span>{veh.zone || veh.defaultRoute}</span>
                                  </div>
                                </td>
                                <td className="p-3.5 text-right font-black text-slate-700 whitespace-nowrap">
                                  {veh.boxCapacity} хайрцаг
                                </td>
                                <td className="p-3.5 text-right font-mono font-bold text-slate-800 whitespace-nowrap">
                                  {veh.currentOdo ? `${veh.currentOdo.toLocaleString()} км` : "-"}
                                </td>
                                <td className="p-3.5 text-right font-mono font-bold text-emerald-700 whitespace-nowrap">
                                  {veh.todayKm ? `+${veh.todayKm} км` : "0 км"}
                                </td>
                                <td className="p-3.5 text-center whitespace-nowrap">
                                  <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200">
                                    {veh.status}
                                  </span>
                                </td>
                                <td className="p-3.5 text-right whitespace-nowrap">
                                  <div className="flex items-center justify-end gap-1.5">
                                    <button
                                      onClick={() => handleOpenVehicleMap(veh)}
                                      className="px-2.5 py-1.5 rounded-lg bg-sky-50 hover:bg-[#0878bd] text-[#0878bd] hover:text-white text-xs font-bold inline-flex items-center gap-1 transition-all border border-sky-200 hover:border-transparent cursor-pointer"
                                      title="GPS байршил харах"
                                    >
                                      <Navigation className="w-3 h-3" />
                                      <span>Байршил</span>
                                    </button>
                                    <a
                                      href={`/waybill?driver=${encodeURIComponent(veh.code)}`}
                                      className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-emerald-600 hover:text-white text-slate-700 text-xs font-bold inline-flex items-center gap-1 transition-all"
                                    >
                                      <span>Замын хуудас</span>
                                      <ExternalLink className="w-3 h-3" />
                                    </a>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
                    {filteredCityFleet.map((veh) => {
                      const isKA = KA_PLATES.has(veh.vehiclePlate.trim().toUpperCase());
                      return (
                        <div
                          key={veh.id}
                          className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/90 hover:border-emerald-300 hover:shadow-md transition-all flex flex-col justify-between space-y-3"
                        >
                          <div>
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => handleOpenVehicleMap(veh)}
                                  className="font-mono font-black text-slate-900 hover:text-[#0878bd] text-sm px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-sky-50 border border-slate-200 hover:border-[#0878bd] transition-all cursor-pointer flex items-center gap-1.5"
                                  title="Газрын зураг дээр харах"
                                >
                                  <Navigation className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                  <span>{veh.vehiclePlate}</span>
                                </button>
                                {isKA ? (
                                  <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-sky-100 text-sky-800 border border-sky-200">
                                    KA Сүлжээ
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200">
                                    M Дүүрэг
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] font-bold text-slate-400">{veh.model}</span>
                            </div>

                            <div className="mt-3 pt-3 border-t border-slate-100 space-y-1.5 text-xs">
                              <div className="flex items-center justify-between">
                                <span className="text-slate-500 font-medium">Жолооч:</span>
                                <span className="font-bold text-slate-900">{veh.name}</span>
                              </div>
                              {veh.phone && (
                                <div className="flex items-center justify-between text-[11px]">
                                  <span className="text-slate-400">Утас:</span>
                                  <span className="text-slate-600 font-medium">{veh.phone}</span>
                                </div>
                              )}
                              <div className="flex items-center justify-between">
                                <span className="text-slate-500 font-medium">Хариуцсан ХТ:</span>
                                <span className="font-bold text-slate-800">{veh.salesRep}</span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-slate-500 font-medium">Түгээлтийн бүс:</span>
                                <span className="font-bold text-emerald-700">{veh.zone || veh.defaultRoute}</span>
                              </div>
                              <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                                <span className="text-slate-500 font-medium">Одоогийн ODO:</span>
                                <span className="font-mono font-black text-slate-900">
                                  {veh.currentOdo ? `${veh.currentOdo.toLocaleString()} км` : "-"}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-2 pt-1">
                            <button
                              onClick={() => handleOpenVehicleMap(veh)}
                              className="py-2 px-3 rounded-xl bg-sky-50 hover:bg-[#0878bd] hover:text-white text-[#0878bd] text-xs font-bold flex items-center justify-center gap-1.5 transition-all border border-sky-200 hover:border-transparent cursor-pointer"
                            >
                              <Navigation className="w-3.5 h-3.5" />
                              <span>Байршил</span>
                            </button>
                            <a
                              href={`/waybill?driver=${encodeURIComponent(veh.code)}`}
                              className="py-2 px-3 rounded-xl bg-slate-100 hover:bg-emerald-600 hover:text-white text-slate-700 text-xs font-bold flex items-center justify-center gap-1.5 transition-all"
                            >
                              <span>Замын хуудас</span>
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ========================================================================= */}
            {/* TAB 3: PROVINCES SUMMARY                                                  */}
            {/* ========================================================================= */}
            {activeTab === "provinces" && (
              <div className="space-y-3.5 sm:space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-sm sm:text-base font-black text-slate-900 flex items-center gap-1.5 sm:gap-2">
                      <MapPin className="w-4 h-4 sm:w-5 sm:h-5 text-[#0878bd]" />
                      <span>Аймгуудын хүргэлтийн нэгтгэсэн тайлан</span>
                    </h2>
                    <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5">
                      Хэдэн удаа хүргэлт авсан, хэн хэн түгээгч ямар машинтай хэдний өдөр хүргэсэн түүх
                    </p>
                  </div>
                  <span className="text-[11px] sm:text-xs font-bold text-slate-600 bg-white px-2.5 py-1 rounded-xl border border-slate-200 shrink-0">
                    Аймгийн тоо: {filteredProvinceSummaries.length}
                  </span>
                </div>

                {filteredProvinceSummaries.length === 0 ? (
                  <div className="bg-white rounded-3xl p-8 sm:p-12 text-center border border-slate-200/90 shadow-2xs max-w-md mx-auto">
                    <MapPin className="w-10 h-10 sm:w-12 sm:h-12 text-slate-300 mx-auto mb-3" />
                    <h3 className="text-sm sm:text-base font-bold text-slate-800">Мэдээлэл олдсонгүй</h3>
                    <p className="text-xs text-slate-500 mt-1">Хайлтын утга эсвэл шүүлтүүрээ шалгана уу.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
                    {filteredProvinceSummaries.map((summary) => (
                      <div
                        key={summary.province}
                        className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/90 hover:border-sky-300 hover:shadow-md transition-all flex flex-col justify-between space-y-3.5"
                      >
                        {/* Header: Province & Badge */}
                        <div>
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-xl bg-sky-100 text-[#0878bd] flex items-center justify-center font-black text-xs shrink-0">
                                <MapPin className="w-4 h-4" />
                              </div>
                              <h3 className="text-base font-black text-slate-900 tracking-tight">
                                {summary.province}
                              </h3>
                            </div>
                            <span className="px-2.5 py-1 rounded-full text-xs font-black bg-[#0878bd]/10 text-[#0878bd] border border-[#0878bd]/20">
                              {summary.deliveryCount} удаа хүргэгдсэн
                            </span>
                          </div>

                          {/* Stat Highlights */}
                          <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-slate-100 text-xs">
                            <div className="bg-slate-50 p-2 rounded-xl">
                              <span className="text-[10px] text-slate-500 block font-medium">Нийт хайрцаг:</span>
                              <span className="font-black text-slate-900 text-sm">
                                {summary.totalBoxes.toLocaleString()}
                              </span>
                            </div>
                            <div className="bg-slate-50 p-2 rounded-xl">
                              <span className="text-[10px] text-slate-500 block font-medium">Сүүлд хүргэсэн:</span>
                              <span className="font-bold text-slate-800 text-xs flex items-center gap-1 mt-0.5">
                                <Calendar className="w-3 h-3 text-slate-400" />
                                {summary.lastDeliveryDate || "Тодорхойгүй"}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Middle: Drivers & Vehicles */}
                        <div className="space-y-2 text-xs border-t border-slate-100 pt-3">
                          <div>
                            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                              Хүргэсэн түгээгчид:
                            </span>
                            <div className="flex flex-wrap gap-1">
                              {summary.drivers.length > 0 ? (
                                summary.drivers.map((drv, idx) => (
                                  <span 
                                    key={idx} 
                                    className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 font-bold text-[11px]"
                                  >
                                    {drv}
                                  </span>
                                ))
                              ) : (
                                <span className="text-slate-400 italic text-[11px]">Бүртгэгдээгүй</span>
                              )}
                            </div>
                          </div>

                          <div>
                            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                              Тээврийн хэрэгсэл:
                            </span>
                            <div className="flex flex-wrap gap-1">
                              {summary.vehicles.length > 0 ? (
                                summary.vehicles.map((v, idx) => (
                                  <span 
                                    key={idx} 
                                    className="px-2 py-0.5 rounded-md bg-white border border-slate-300 font-mono font-black text-slate-900 text-[11px] shadow-2xs"
                                  >
                                    {v}
                                  </span>
                                ))
                              ) : (
                                <span className="text-slate-400 italic text-[11px]">Бүртгэгдээгүй</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ========================================================================= */}
            {/* TAB 3: UNASSIGNED ORDERS                                                  */}
            {/* ========================================================================= */}
            {activeTab === "unassigned" && (
              <div className="space-y-3.5 sm:space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-sm sm:text-base font-black text-amber-950 flex items-center gap-1.5 sm:gap-2">
                      <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5 text-amber-700" />
                      <span>Хуваарилалт хүлээж буй орон нутгийн захиалгууд</span>
                    </h2>
                    <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5">
                      Эдгээр захиалгуудад одоогоор түгээгч болон машин хуваарилагдаагүй байна
                    </p>
                  </div>
                  <span className="text-[11px] sm:text-xs font-bold text-amber-900 bg-amber-100 px-2.5 py-1 rounded-xl border border-amber-200 shrink-0">
                    Хүлээгдэж буй: {filteredUnassignedOrders.length}
                  </span>
                </div>

                {filteredUnassignedOrders.length === 0 ? (
                  <div className="bg-white rounded-3xl p-8 sm:p-12 text-center border border-emerald-200/90 shadow-2xs max-w-md mx-auto">
                    <CheckCircle2 className="w-10 h-10 sm:w-12 sm:h-12 text-emerald-500 mx-auto mb-3" />
                    <h3 className="text-sm sm:text-base font-bold text-slate-800">Бүх захиалга хуваарилагдсан!</h3>
                    <p className="text-xs text-slate-500 mt-1">Одоогоор томилолт хүлээж буй захиалга байхгүй байна.</p>
                  </div>
                ) : (
                  <div className="bg-white rounded-2xl border border-amber-200/90 shadow-2xs overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-amber-50/70 border-b border-amber-200 text-amber-900 font-bold uppercase text-[10px] tracking-wider">
                            <th className="p-3.5">Захиалгын №</th>
                            <th className="p-3.5">Харилцагч</th>
                            <th className="p-3.5">Хүргэх Аймаг / Сум</th>
                            <th className="p-3.5 text-right">Захиалсан тоо</th>
                            <th className="p-3.5">Хүргэх тов</th>
                            <th className="p-3.5 text-center">Төлөв</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {filteredUnassignedOrders.map((u) => (
                            <tr key={u.id} className="hover:bg-amber-50/30 transition-colors">
                              <td className="p-3.5 font-mono font-black text-slate-900">
                                {u.orderNo}
                              </td>
                              <td className="p-3.5 font-bold text-slate-800">
                                {u.customer}
                              </td>
                              <td className="p-3.5">
                                <div className="flex items-center gap-1.5 font-bold text-[#0878bd]">
                                  <MapPin className="w-3.5 h-3.5 text-[#0878bd] shrink-0" />
                                  <span>{u.province}</span>
                                  {u.destination && u.destination !== u.province && (
                                    <span className="text-[11px] text-slate-400 font-normal">
                                      ({u.destination})
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="p-3.5 text-right font-black text-slate-900">
                                {u.quantity.toLocaleString()} хайрцаг
                              </td>
                              <td className="p-3.5 text-slate-600 font-medium">
                                <div className="flex items-center gap-1">
                                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                                  <span>{u.deliveryDate || u.createdAt || "Тодорхойгүй"}</span>
                                </div>
                              </td>
                              <td className="p-3.5 text-center">
                                <span className="px-2.5 py-1 rounded-full text-[11px] font-black bg-amber-100 text-amber-800 border border-amber-200 inline-block">
                                  Хуваарилалт хүлээж буй
                                </span>
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
          </>
        )}
      </main>

      {/* Floating Scroll to Top button */}
      {showScrollTop && (
        <button
          onClick={scrollToTop}
          className="fixed bottom-6 right-6 w-11 h-11 rounded-full bg-[#0878bd] text-white shadow-lg flex items-center justify-center cursor-pointer z-50 hover:bg-[#0768a4] active:scale-90 transition-all touch-manipulation"
          aria-label="Дээш гүйлгэх"
        >
          <ChevronUp className="w-5 h-5" />
        </button>
      )}

      {/* Interactive Vehicle Map Modal */}
      <VehicleMapModal
        isOpen={isMapModalOpen}
        onClose={() => setIsMapModalOpen(false)}
        selectedVehicle={mapTargetVehicle}
        allCityFleet={data?.cityFleet || []}
        allImdFleet={data?.imdFleet || []}
        allShipments={allAssignments}
        onShowToast={onShowToast}
      />
    </div>
  );
};
