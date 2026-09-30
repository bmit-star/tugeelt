import React, { useState, useMemo } from "react";
import { 
  Package, 
  Truck, 
  Calendar, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Users, 
  MapPin, 
  ExternalLink, 
  ChevronRight, 
  Sparkles, 
  Layers, 
  ArrowUpRight, 
  Compass, 
  ShieldCheck,
  Search,
  ArrowUpDown,
  Route,
  Gauge,
  Award,
  ChevronDown,
  ChevronUp,
  FileSpreadsheet,
  Plus
} from "lucide-react";
import { IMDDashboardData, IMDOrder, IMDTraveledProvinceItem } from "../../types";
import { PROVINCE_ROUTES, MEAL_RATE_PER_PERSON } from "../../constants/provinceRoutes";

interface Props {
  data: IMDDashboardData | null;
  loading: boolean;
  selectedDate: string;
  onDateChange: (date: string) => void;
  onNavigateTab: (tab: any, openCreate?: boolean) => void;
  onSelectOrderForAssignment: (order: IMDOrder) => void;
}

export const IMDDashboardOverview: React.FC<Props> = ({
  data,
  loading,
  selectedDate,
  onDateChange,
  onNavigateTab,
  onSelectOrderForAssignment
}) => {
  const [provinceSearch, setProvinceSearch] = useState<string>("");
  const [provinceSort, setProvinceSort] = useState<"km_desc" | "trips_desc" | "name_asc">("km_desc");
  const [showAllProvinces, setShowAllProvinces] = useState<boolean>(true);
  const [filterOnlyTraveled, setFilterOnlyTraveled] = useState<boolean>(true);

  // Traveled provinces summary strictly based on real assignments & orders
  const summary = useMemo(() => {
    if (data?.traveledProvincesSummary && data.traveledProvincesSummary.list) {
      return data.traveledProvincesSummary;
    }

    // Clean official routes with ZERO fake trips
    const cleanList: IMDTraveledProvinceItem[] = PROVINCE_ROUTES.map(pr => ({
      province: pr.province,
      destination: pr.destination,
      roundTripKm: pr.roundTripKm,
      tripCount: 0,
      totalKm: 0,
      totalBoxes: 0,
      mealCount: pr.mealCount,
      drivers: [],
      vehicles: [],
      hasActiveTrip: false
    }));

    return {
      totalKm: 0,
      totalProvinces: 0,
      totalTrips: 0,
      totalBoxes: 0,
      list: cleanList
    };
  }, [data]);

  // Filter & sort province list
  const filteredProvinceList = useMemo(() => {
    let list = [...(summary.list || [])];
    
    // Strict real data filter: when enabled, only show destinations where drivers actually traveled
    if (filterOnlyTraveled) {
      list = list.filter(item => item.tripCount > 0);
    }

    const q = provinceSearch.toLowerCase().trim();
    if (q) {
      list = list.filter(item => 
        item.province.toLowerCase().includes(q) ||
        item.destination.toLowerCase().includes(q) ||
        (item.drivers && item.drivers.some(d => d.toLowerCase().includes(q))) ||
        (item.vehicles && item.vehicles.some(v => v.toLowerCase().includes(q)))
      );
    }

    if (provinceSort === "km_desc") {
      list.sort((a, b) => b.totalKm - a.totalKm);
    } else if (provinceSort === "trips_desc") {
      list.sort((a, b) => b.tripCount - a.tripCount);
    } else if (provinceSort === "name_asc") {
      list.sort((a, b) => a.province.localeCompare(b.province));
    }

    return list;
  }, [summary, provinceSearch, provinceSort, filterOnlyTraveled]);

  const displayedProvinces = showAllProvinces 
    ? filteredProvinceList 
    : filteredProvinceList.slice(0, 10);

  if (loading || !data) {
    return (
      <div className="py-20 text-center">
        <div className="inline-block w-8 h-8 border-4 border-[#0878bd] border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-3 text-sm text-slate-500 font-medium">IMD Удирдлагын өгөгдлийг татаж байна...</p>
      </div>
    );
  }

  const { stats, todayDispatches, recentOrders } = data;

  return (
    <div className="space-y-6">
      {/* Top Banner: Date Selector & Context */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 rounded-3xl p-6 text-white shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 text-xs font-bold mb-2">
            <Sparkles className="w-3.5 h-3.5" />
            <span>IMD Томилолт & Захиалга Удирдлагын Нэгдсэн Систем</span>
          </div>
          <h2 className="text-xl md:text-2xl font-black tracking-tight">
            Тээвэр, Томилолтын Хяналтын Самбар
          </h2>
          <p className="text-slate-300 text-xs md:text-sm mt-1">
            Захиалгаас эхлээд томилолт, машин, үндсэн/сэлгээ жолооч, 24 аймгийн нийт явсан км хүртэлх нэгдсэн урсгал
          </p>
        </div>

        <div className="flex items-center gap-3 bg-white/10 backdrop-blur-md px-4 py-2.5 rounded-2xl border border-white/10">
          <Calendar className="w-4 h-4 text-blue-400" />
          <div className="text-left">
            <span className="block text-[10px] text-slate-300 font-semibold uppercase tracking-wider">Шүүх огноо</span>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => onDateChange(e.target.value)}
              className="bg-transparent text-white font-bold text-sm outline-none cursor-pointer"
            />
          </div>
        </div>
      </div>

      {/* KPI Stats Grid - Featuring Traveled KM & Provinces prominently */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
        {/* Card 1: Total Traveled KM (NEW PRIMARY STAT) */}
        <div 
          onClick={() => {
            const el = document.getElementById("imd-traveled-provinces-section");
            if (el) el.scrollIntoView({ behavior: "smooth" });
          }}
          className="col-span-2 sm:col-span-1 bg-gradient-to-br from-blue-900 to-slate-900 text-white rounded-2xl p-4 border border-blue-700/50 shadow-md hover:border-blue-400 hover:shadow-lg transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-blue-200">Нийт явсан км</span>
            <div className="w-8 h-8 rounded-xl bg-blue-500/30 text-blue-300 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Route className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-1.5">
            <span className="text-2xl md:text-3xl font-black tracking-tight text-white font-mono">
              {summary.totalKm.toLocaleString()}
            </span>
            <span className="text-xs font-bold text-blue-300">км</span>
          </div>
          <div className="mt-2 text-[11px] text-blue-200 font-bold flex items-center gap-1">
            <span>{summary.totalProvinces} аймаг, {summary.totalTrips} эргэлт</span>
            <ArrowUpRight className="w-3 h-3 text-blue-300" />
          </div>
        </div>

        {/* Card 2: Today's Orders */}
        <div 
          onClick={() => onNavigateTab("orders")}
          className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs hover:border-blue-400 hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">Өнөөдрийн захиалга</span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-[#0878bd] flex items-center justify-center group-hover:scale-110 transition-transform">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl md:text-3xl font-black text-slate-900">{stats.todayOrders}</span>
            <span className="text-xs font-semibold text-slate-400">захиалга</span>
          </div>
          <div className="mt-2 text-[11px] text-blue-600 font-bold flex items-center gap-1">
            <span>Захиалгын жагсаалт</span>
            <ArrowUpRight className="w-3 h-3" />
          </div>
        </div>

        {/* Card 3: Today's Assignments */}
        <div 
          onClick={() => onNavigateTab("assignments")}
          className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs hover:border-emerald-400 hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">Томилолт гарсан</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Truck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl md:text-3xl font-black text-emerald-700">{stats.todayAssignments}</span>
            <span className="text-xs font-semibold text-slate-400">машин хуваарь</span>
          </div>
          <div className="mt-2 text-[11px] text-emerald-700 font-bold flex items-center gap-1">
            <span>Томилолт харах</span>
            <ArrowUpRight className="w-3 h-3" />
          </div>
        </div>

        {/* Card 4: Today's Boxes */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">Өнөөдрийн ачилт</span>
            <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl md:text-3xl font-black text-slate-900">{stats.todayBoxes.toLocaleString()}</span>
            <span className="text-xs font-semibold text-slate-400">хайрцаг</span>
          </div>
          <div className="mt-2 text-[11px] text-purple-700 font-semibold truncate">
            {stats.substituteDriversCount > 0 ? `${stats.substituteDriversCount} сэлгээ жолоочтой` : "Бүгд үндсэн жолоочтой"}
          </div>
        </div>

        {/* Card 5: Province Report */}
        <div 
          onClick={() => onNavigateTab("province_report" as any)}
          className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs hover:border-sky-400 hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">Аймгийн Тээвэр</span>
            <div className="w-8 h-8 rounded-xl bg-sky-50 text-[#0878bd] flex items-center justify-center group-hover:scale-110 transition-transform">
              <Compass className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl md:text-3xl font-black text-slate-900">{summary.totalProvinces}</span>
            <span className="text-xs font-semibold text-slate-400">аймаг очсон</span>
          </div>
          <div className="mt-2 text-[11px] text-[#0878bd] font-bold flex items-center gap-1">
            <span>Сар, аймгийн тайлан</span>
            <ArrowUpRight className="w-3 h-3" />
          </div>
        </div>
      </div>

      {/* MASTER SECTION: НИЙТ ЯВСАН АЙМГИЙН ЖАГСААЛТ БОЛОН НИЙТ КМ */}
      <div id="imd-traveled-provinces-section" className="bg-white rounded-3xl p-5 md:p-6 border border-slate-200/90 shadow-sm space-y-5">
        {/* Section Header */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-black mb-1">
              <MapPin className="w-3.5 h-3.5 text-[#0878bd]" />
              <span>Орон нутгийн тээврийн нэгдсэн гүйцэтгэл</span>
            </div>
            <h3 className="text-lg md:text-xl font-black text-slate-900 flex items-center gap-2">
              <span>Нийт явсан аймгийн жагсаалт болон нийт км</span>
              <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-800 text-xs font-black">
                {summary.totalProvinces} аймаг
              </span>
            </h3>
            <p className="text-slate-500 text-xs mt-0.5">
              Батлагдсан 24 аймаг, сумын албан ёсны зай, явсан эргэлтийн тоо, хуримтлагдсан нийт км болон хоолны нормын тооцоо
            </p>
          </div>

          {/* Quick Summary Pill Badges */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="px-3 py-2 rounded-2xl bg-blue-50 border border-blue-200/80 text-left">
              <span className="block text-[10px] font-bold text-blue-600 uppercase">Нийт явсан зай</span>
              <span className="text-sm md:text-base font-black text-blue-950 font-mono">
                {summary.totalKm.toLocaleString()} км
              </span>
            </div>
            <div className="px-3 py-2 rounded-2xl bg-emerald-50 border border-emerald-200/80 text-left">
              <span className="block text-[10px] font-bold text-emerald-600 uppercase">Нийт эргэлт</span>
              <span className="text-sm md:text-base font-black text-emerald-950 font-mono">
                {summary.totalTrips} удаа
              </span>
            </div>
            <div className="px-3 py-2 rounded-2xl bg-purple-50 border border-purple-200/80 text-left">
              <span className="block text-[10px] font-bold text-purple-600 uppercase">Нийт ачсан</span>
              <span className="text-sm md:text-base font-black text-purple-950 font-mono">
                {summary.totalBoxes.toLocaleString()} хайрцаг
              </span>
            </div>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-200/80">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={provinceSearch}
              onChange={(e) => setProvinceSearch(e.target.value)}
              placeholder="Аймаг, сум, жолооч, машинаар хайх..."
              className="w-full pl-9 pr-3 py-2 text-xs font-semibold bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
            {provinceSearch && (
              <button 
                onClick={() => setProvinceSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
              >
                ✕
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end flex-wrap">
            {/* Real Traveled vs All Official Routes toggle */}
            <div className="flex items-center bg-slate-200/70 p-0.5 rounded-xl text-xs font-bold">
              <button
                type="button"
                onClick={() => setFilterOnlyTraveled(true)}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  filterOnlyTraveled 
                    ? "bg-[#0878bd] text-white shadow-xs" 
                    : "text-slate-600 hover:text-slate-900"
                }`}
                title="Зөвхөн бодит томилолт явсан аймгуудыг харуулах (Зохиомол тоо байхгүй)"
              >
                ✓ Зөвхөн явсан томилолт
              </button>
              <button
                type="button"
                onClick={() => setFilterOnlyTraveled(false)}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  !filterOnlyTraveled 
                    ? "bg-[#0878bd] text-white shadow-xs" 
                    : "text-slate-600 hover:text-slate-900"
                }`}
                title="Бүх 24 чиглэлийн стандарт зай, хоолны нормын лавлахыг харах"
              >
                Бүх 24 чиглэл
              </button>
            </div>

            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
              <span className="hidden sm:inline">Эрэмбэлэх:</span>
              <select
                value={provinceSort}
                onChange={(e: any) => setProvinceSort(e.target.value)}
                className="bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-700 outline-none cursor-pointer"
              >
                <option value="km_desc">Нийт км-ээр (ихээс бага)</option>
                <option value="trips_desc">Явсан удаагаар (ихээс бага)</option>
                <option value="name_asc">Аймгийн нэрээр (А-Я)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Traveled Provinces Table */}
        <div className="overflow-x-auto rounded-2xl border border-slate-200">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-bold uppercase tracking-wider border-b border-slate-200 text-[11px]">
              <tr>
                <th className="py-3 px-3 w-10 text-center">№</th>
                <th className="py-3 px-3">Аймаг / Сум / Чиглэл</th>
                <th className="py-3 px-3 text-right">1 эргэлтийн км</th>
                <th className="py-3 px-3 text-center">Явсан тоо</th>
                <th className="py-3 px-3 text-right font-black text-blue-900 bg-blue-50/50">Нийт явсан км</th>
                <th className="py-3 px-3 text-right">Хоолны норм</th>
                <th className="py-3 px-3 text-right">Ачсан хэмжээ</th>
                <th className="py-3 px-3">Явсан жолооч нар / Машин</th>
                <th className="py-3 px-3 text-center">Төлөв</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {displayedProvinces.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400 font-medium">
                    <div className="max-w-md mx-auto space-y-2">
                      <div className="w-12 h-12 rounded-2xl bg-blue-50 text-[#0878bd] flex items-center justify-center mx-auto mb-1">
                        <Truck className="w-6 h-6" />
                      </div>
                      <p className="text-sm font-black text-slate-800">Одоогоор орон нутгийн томилолт бүртгэгдээгүй байна</p>
                      <p className="text-xs text-slate-500 leading-relaxed">
                        Системд зохиомол хуурамч тоо харуулахгүй бөгөөд менежер томилолтын гүйцэтгэл хэсэгт томилолт хуваарилан бүртгэсний дараа тухайн очсон аймаг, 1 эргэлтийн км, явсан тоо автоматаар энд гарч ирнэ.
                      </p>
                      <button
                        onClick={() => onNavigateTab("assignments", true)}
                        className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#0878bd] hover:bg-[#076ba8] text-white text-xs font-black transition-all shadow-sm active:scale-95 cursor-pointer"
                      >
                        <Plus className="w-4 h-4" />
                        <span>+ Томилолт хуваарилах / Нөхөн бүртгэх</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                displayedProvinces.map((item, idx) => {
                  const mealRate = (item.mealCount || 3) * MEAL_RATE_PER_PERSON;
                  return (
                    <tr 
                      key={`${item.province}-${item.destination}-${idx}`}
                      className="hover:bg-blue-50/40 transition-colors"
                    >
                      <td className="py-3 px-3 text-center font-bold text-slate-400 text-[11px]">
                        {idx + 1}
                      </td>

                      {/* Province & Destination */}
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-lg bg-blue-100 text-[#0878bd] flex items-center justify-center font-bold text-[10px] shrink-0">
                            {item.province.slice(0, 2)}
                          </div>
                          <div>
                            <span className="font-bold text-slate-900 block">
                              {item.destination}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              {item.province}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Round Trip KM */}
                      <td className="py-3 px-3 text-right font-mono font-bold text-slate-600">
                        {item.roundTripKm.toLocaleString()} км
                      </td>

                      {/* Trip count */}
                      <td className="py-3 px-3 text-center">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-black bg-slate-100 text-slate-800">
                          {item.tripCount} удаа
                        </span>
                      </td>

                      {/* Total KM */}
                      <td className="py-3 px-3 text-right font-mono font-black text-blue-700 bg-blue-50/40 text-sm">
                        {item.totalKm.toLocaleString()} км
                      </td>

                      {/* Meal allowance per person */}
                      <td className="py-3 px-3 text-right">
                        <span className="font-bold text-slate-800 font-mono text-xs block">
                          {mealRate.toLocaleString()}₮
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {item.mealCount || 3} хоол (хүн тус бүр)
                        </span>
                      </td>

                      {/* Total Boxes Delivered */}
                      <td className="py-3 px-3 text-right font-mono text-slate-600 font-bold">
                        {item.totalBoxes > 0 ? `${item.totalBoxes.toLocaleString()} х/ц` : "-"}
                      </td>

                      {/* Drivers & Vehicles */}
                      <td className="py-3 px-3 text-xs">
                        {item.drivers && item.drivers.length > 0 ? (
                          <div className="space-y-0.5">
                            <div className="text-slate-800 font-bold truncate max-w-[160px]" title={item.drivers.join(", ")}>
                              {item.drivers.join(", ")}
                            </div>
                            {item.vehicles && item.vehicles.length > 0 && (
                              <div className="text-[10px] text-slate-400 font-mono truncate max-w-[160px]">
                                {item.vehicles.join(", ")}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400 text-[11px] italic">Албан ёсны чиглэл</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-3 text-center">
                        {item.hasActiveTrip ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-blue-100 text-blue-800 border border-blue-200 animate-pulse">
                            <Truck className="w-3 h-3 text-blue-600" />
                            <span>Тээвэрт гарсан</span>
                          </span>
                        ) : item.tripCount > 0 ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>Гүйцэтгэсэн</span>
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-500">
                            Төлөвлөгдсөн
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            {/* Grand Total Footer */}
            <tfoot className="bg-slate-100 text-slate-900 font-black border-t-2 border-slate-300">
              <tr>
                <td colSpan={2} className="py-3.5 px-4 text-xs uppercase tracking-wider font-black text-slate-800">
                  НИЙТ НЭГДСЭН ДҮН ({displayedProvinces.length} аймаг):
                </td>
                <td className="py-3.5 px-3 text-right font-mono text-xs text-slate-600 font-bold">
                  -
                </td>
                <td className="py-3.5 px-3 text-center text-xs font-black text-slate-900">
                  {summary.totalTrips} эргэлт
                </td>
                <td className="py-3.5 px-3 text-right font-mono text-base font-black text-blue-900 bg-blue-100/60">
                  {summary.totalKm.toLocaleString()} км
                </td>
                <td className="py-3.5 px-3 text-right text-xs text-slate-600 font-mono">
                  -
                </td>
                <td className="py-3.5 px-3 text-right font-mono text-xs font-bold text-slate-800">
                  {summary.totalBoxes.toLocaleString()} х/ц
                </td>
                <td colSpan={2} className="py-3.5 px-3 text-slate-500 text-[11px] font-semibold">
                  24 албан ёсны чиглэлийн нийт бүртгэл
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Grid: Today's Dispatches & Portal/Shortcuts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Today's Active Dispatches */}
        <div className="lg:col-span-2 bg-white rounded-3xl p-5 border border-slate-200/90 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                <Truck className="w-5 h-5 text-[#0878bd]" />
                <span>Өнөөдрийн Томилогдсон Тээвэр</span>
                <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 text-xs font-black">
                  {todayDispatches.length}
                </span>
              </h3>
              <p className="text-slate-400 text-xs mt-0.5">
                {selectedDate} өдөр замд гарсан болон томилогдсон тээврүүд
              </p>
            </div>
            <button
              onClick={() => onNavigateTab("assignments")}
              className="text-xs font-bold text-[#0878bd] hover:underline flex items-center gap-1"
            >
              <span>Бүх томилолт харах</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {todayDispatches.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              <Truck className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-xs font-semibold">{selectedDate} өдөр гарсан томилолт бүртгэгдээгүй байна.</p>
              <button
                onClick={() => onNavigateTab("assignments")}
                className="mt-3 px-4 py-2 rounded-xl bg-blue-50 text-[#0878bd] text-xs font-bold hover:bg-blue-100"
              >
                Шинэ томилолт хуваарилах
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {todayDispatches.map((dispatch) => (
                <div
                  key={dispatch.id}
                  className="p-4 rounded-2xl border border-slate-100 hover:border-slate-200 hover:shadow-xs transition-all bg-slate-50/50 flex flex-col md:flex-row items-start md:items-center justify-between gap-3"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-black text-slate-900 text-sm bg-white px-2 py-0.5 rounded-lg border border-slate-200">
                        {dispatch.vehiclePlate}
                      </span>
                      <span className="text-xs font-bold text-slate-700 flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-[#0878bd]" />
                        <span>{dispatch.province} {dispatch.destination ? `(${dispatch.destination})` : ""}</span>
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                        dispatch.status === "Дууссан" 
                          ? "bg-emerald-100 text-emerald-800"
                          : dispatch.status === "Тээвэрт гарсан"
                          ? "bg-blue-100 text-blue-800 animate-pulse"
                          : "bg-amber-100 text-amber-800"
                      }`}>
                        {dispatch.status}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <Users className="w-3 h-3 text-slate-400" />
                        <span className="font-bold text-slate-700">{dispatch.primaryDriverName}</span>
                        {dispatch.substituteDriverName && (
                          <span className="text-purple-600 font-semibold"> + {dispatch.substituteDriverName} (Сэлгээ)</span>
                        )}
                      </span>
                      <span>•</span>
                      <span>{dispatch.quantity?.toLocaleString()} хайрцаг</span>
                      {dispatch.actualKm ? (
                        <>
                          <span>•</span>
                          <span className="font-mono font-bold text-emerald-600">{dispatch.actualKm} км</span>
                        </>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 w-full md:w-auto justify-end">
                    <button
                      onClick={() => onNavigateTab("assignments")}
                      className="px-3 py-1.5 rounded-xl text-xs font-bold bg-white text-slate-700 border border-slate-200 hover:bg-slate-50"
                    >
                      Засах
                    </button>
                    <a
                      href={`/driver/trip/${dispatch.token}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 rounded-xl text-xs font-bold bg-[#0878bd] text-white hover:bg-[#0769a6] flex items-center gap-1 shadow-2xs"
                    >
                      <span>Жолоочийн харагдац</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right 1 Col: Quick Actions & Province Report */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                <Compass className="w-5 h-5 text-[#0878bd]" />
                <span>Орон нутгийн тээвэр удирдлага</span>
              </h3>
              <p className="text-slate-400 text-xs mt-0.5">Томилолт, хуваарилалт, км тайлан</p>
            </div>
          </div>

          {/* Province Ice Cream Report Banner */}
          <div 
            onClick={() => onNavigateTab("province_report" as any)}
            className="p-4 rounded-2xl bg-amber-50/60 border border-amber-200/80 hover:bg-amber-50 hover:border-amber-300 transition-all cursor-pointer space-y-2 group"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-amber-950 flex items-center gap-1.5">
                <Compass className="w-4 h-4 text-amber-600" />
                <span>Аймгийн Тээвэр & Зайрмаг Дашбоорд</span>
              </span>
              <ArrowUpRight className="w-4 h-4 text-amber-600 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
            </div>
            <p className="text-xs text-slate-600">
              Сар бүрээр аль аймаг хэдэн удаа, ямар жолооч, ямар машинаар хэдэн хайрцаг зайрмаг авсныг харах
            </p>
          </div>

          {/* Quick Shortcuts */}
          <div className="pt-2 border-t border-slate-100 space-y-2">
            <span className="text-[11px] font-black uppercase text-slate-400 tracking-wider block">
              Түргэн үйлдлүүд
            </span>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => onNavigateTab("orders")}
                className="p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-left text-xs font-bold text-slate-700 flex items-center justify-between"
              >
                <span>+ Захиалга нэмэх</span>
                <Package className="w-3.5 h-3.5 text-slate-400" />
              </button>
              <button
                onClick={() => onNavigateTab("assignments")}
                className="p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-left text-xs font-bold text-slate-700 flex items-center justify-between"
              >
                <span>+ Томилолт гаргах</span>
                <Truck className="w-3.5 h-3.5 text-slate-400" />
              </button>
              <button
                onClick={() => onNavigateTab("km_report")}
                className="p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-left text-xs font-bold text-slate-700 flex items-center justify-between"
              >
                <span>КМ Сарын тайлан</span>
                <Sparkles className="w-3.5 h-3.5 text-blue-500" />
              </button>
              <button
                onClick={() => onNavigateTab("sheets")}
                className="p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-left text-xs font-bold text-slate-700 flex items-center justify-between"
              >
                <span>Excel Импорт</span>
                <ArrowUpRight className="w-3.5 h-3.5 text-emerald-500" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

