import React, { useState, useEffect, useMemo } from "react";
import { 
  Package, 
  Truck, 
  MapPin, 
  Calendar, 
  Download, 
  Search, 
  ArrowUpDown, 
  Users, 
  Box, 
  ChevronDown, 
  ChevronUp, 
  RefreshCw,
  Sparkles,
  Layers,
  FileSpreadsheet
} from "lucide-react";
import { api } from "../../services/api";
import { IMDProvinceReportData, IMDProvinceStat } from "../../types";

interface Props {
  onShowToast?: (msg: string, type: "success" | "error" | "info") => void;
}

export const IMDProvinceIceCreamDashboard: React.FC<Props> = ({ onShowToast }) => {
  const [year, setYear] = useState<number>(2026);
  const [selectedMonth, setSelectedMonth] = useState<number | "all">(9); // Default Sept
  const [data, setData] = useState<IMDProvinceReportData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [sortBy, setSortBy] = useState<"boxes_desc" | "trips_desc" | "name_asc">("boxes_desc");
  const [expandedProvinces, setExpandedProvinces] = useState<Record<string, boolean>>({});

  const fetchReport = async () => {
    setLoading(true);
    try {
      const res = await api.getIMDProvinceIceCreamReport(year, selectedMonth);
      setData(res);
    } catch (err: any) {
      if (onShowToast) onShowToast(err.message || "Тайлан татахад алдаа гарлаа", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [year, selectedMonth]);

  const toggleExpand = (prov: string) => {
    setExpandedProvinces(prev => ({ ...prev, [prov]: !prev[prov] }));
  };

  // Filter & Sort
  const processedProvinces = useMemo(() => {
    if (!data?.provinces) return [];
    let list = data.provinces.filter(p => {
      const q = searchTerm.toLowerCase().trim();
      if (!q) return true;
      const matchName = p.province.toLowerCase().includes(q);
      const matchDriver = p.drivers.some(d => d.toLowerCase().includes(q));
      const matchVehicle = p.vehicles.some(v => v.toLowerCase().includes(q));
      const matchDest = p.destinations.some(dest => dest.toLowerCase().includes(q));
      return matchName || matchDriver || matchVehicle || matchDest;
    });

    if (sortBy === "boxes_desc") {
      list.sort((a, b) => b.totalBoxes - a.totalBoxes);
    } else if (sortBy === "trips_desc") {
      list.sort((a, b) => b.tripCount - a.tripCount);
    } else if (sortBy === "name_asc") {
      list.sort((a, b) => a.province.localeCompare(b.province));
    }

    return list;
  }, [data, searchTerm, sortBy]);

  // Export CSV
  const handleExportCSV = () => {
    if (!processedProvinces || processedProvinces.length === 0) {
      if (onShowToast) onShowToast("Экспортлох өгөгдөл алга", "info");
      return;
    }

    const monthLabel = selectedMonth === "all" ? "Бүх сар" : `${selectedMonth}-р сар`;
    const headers = [
      "Аймаг",
      "Очсон удаа",
      "Нийт хайрцаг зайрмаг",
      "Жолооч нар",
      "Автомашинууд",
      "Хүрсэн сумууд"
    ];

    const rows = processedProvinces.map(p => [
      `"${p.province}"`,
      p.tripCount,
      p.totalBoxes,
      `"${p.drivers.join(", ")}"`,
      `"${p.vehicles.join(", ")}"`,
      `"${p.destinations.join(", ")}"`
    ]);

    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `IMD_Аймгийн_Зайрмаг_Тайлан_${year}_${monthLabel}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    if (onShowToast) onShowToast("CSV тайлан амжилттай татагдлаа", "success");
  };

  const monthNames = [
    { num: 1, name: "1-р сар" },
    { num: 2, name: "2-р сар" },
    { num: 3, name: "3-р сар" },
    { num: 4, name: "4-р сар" },
    { num: 5, name: "5-р сар" },
    { num: 6, name: "6-р сар" },
    { num: 7, name: "7-р сар" },
    { num: 8, name: "8-р сар" },
    { num: 9, name: "9-р сар" },
    { num: 10, name: "10-р сар" },
    { num: 11, name: "11-р сар" },
    { num: 12, name: "12-р сар" },
  ];

  return (
    <div className="space-y-6">
      {/* Top Controls & Month Picker */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-2xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-xl bg-sky-100 text-[#0878bd]">
                <Package className="w-5 h-5" />
              </span>
              <h2 className="text-lg sm:text-xl font-black text-slate-900">
                Аймгийн Тээвэр & Зайрмагны Нэгдсэн Дашбоорд
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Тухайн сард ямар аймаг хэдэн удаа, ямар жолооч машинаар, хэдэн хайрцаг зайрмаг авсны нэгдсэн хяналт
            </p>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-black bg-slate-50 text-slate-800 outline-none"
            >
              <option value={2026}>2026 он</option>
              <option value={2025}>2025 он</option>
            </select>

            <button
              onClick={handleExportCSV}
              className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>CSV Татах</span>
            </button>

            <button
              onClick={fetchReport}
              className="p-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 transition-all cursor-pointer"
              title="Шинэчлэх"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {/* Month Pills Slider */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-2 border-t border-slate-100 scrollbar-none">
          <button
            onClick={() => setSelectedMonth("all")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              selectedMonth === "all"
                ? "bg-[#0878bd] text-white shadow-2xs"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            Бүх сар (Бүтэн жил)
          </button>
          {monthNames.map(m => (
            <button
              key={m.num}
              onClick={() => setSelectedMonth(m.num)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                selectedMonth === m.num
                  ? "bg-[#0878bd] text-white shadow-2xs"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {m.name}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">Нийт зайрмаг</span>
            <div className="w-9 h-9 rounded-2xl bg-indigo-50 text-indigo-700 flex items-center justify-center">
              <Box className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-indigo-950 mt-2">
            {(data?.summary.totalBoxes || 0).toLocaleString()}
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">Хайрцаг зайрмаг авсан</span>
        </div>

        <div className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">Нийт очсон удаа</span>
            <div className="w-9 h-9 rounded-2xl bg-sky-50 text-[#0878bd] flex items-center justify-center">
              <Truck className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-[#0878bd] mt-2">
            {data?.summary.totalTrips || 0} удаа
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">Нийт хийсэн томилолт</span>
        </div>

        <div className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">Хүргэсэн аймаг</span>
            <div className="w-9 h-9 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <MapPin className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-emerald-600 mt-2">
            {data?.summary.totalProvinces || 0} аймаг
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">Хамрагдсан бүс нутаг</span>
        </div>

        <div className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">Жолооч & Машин</span>
            <div className="w-9 h-9 rounded-2xl bg-amber-50 text-amber-700 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-slate-900 mt-2">
            {data?.summary.totalDrivers || 0} жолооч
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">
            {data?.summary.totalVehicles || 0} тээврийн хэрэгслээр
          </span>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Аймаг, жолооч, машинаар хайх..."
            className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#0878bd] bg-slate-50/50"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <span className="text-xs font-bold text-slate-500">Эрэмбэлэх:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 bg-white outline-none"
          >
            <option value="boxes_desc">Хамгийн их зайрмаг авснаар</option>
            <option value="trips_desc">Хамгийн олон очсон удаагаар</option>
            <option value="name_asc">Аймгийн нэрээр (А-Я)</option>
          </select>
        </div>
      </div>

      {/* Province Breakdown Table */}
      {loading ? (
        <div className="py-16 text-center">
          <div className="inline-block w-8 h-8 border-4 border-[#0878bd] border-t-transparent rounded-full animate-spin"></div>
          <p className="mt-3 text-xs font-bold text-slate-500">Аймгийн мэдээлэл нэгтгэж байна...</p>
        </div>
      ) : processedProvinces.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-slate-200/90 shadow-2xs">
          <MapPin className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <h3 className="text-base font-bold text-slate-700">Энэ сард бүртгэгдсэн тээвэр олдсонгүй</h3>
          <p className="text-xs text-slate-400 mt-1">Өөр сар эсвэл 'Бүх сар'-ыг сонгож үзнэ үү.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {processedProvinces.map((prov) => {
            const isExpanded = !!expandedProvinces[prov.province];
            const maxBoxes = data?.summary.totalBoxes || 1;
            const pct = Math.min(100, Math.round((prov.totalBoxes / maxBoxes) * 100));

            return (
              <div
                key={prov.province}
                className="bg-white rounded-2xl border border-slate-200/90 overflow-hidden shadow-2xs transition-all"
              >
                {/* Main Row Header */}
                <div
                  onClick={() => toggleExpand(prov.province)}
                  className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50/70 transition-colors cursor-pointer"
                >
                  {/* Left: Province & Trip count */}
                  <div className="flex items-center gap-3.5">
                    <div className="w-11 h-11 rounded-2xl bg-sky-50 border border-sky-200/80 text-[#0878bd] flex items-center justify-center font-black text-sm shrink-0">
                      <MapPin className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base sm:text-lg font-black text-slate-900">
                          {prov.province}
                        </h3>
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-blue-100 text-blue-800 border border-blue-200">
                          {prov.tripCount} удаа очсон
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5 flex flex-wrap gap-1">
                        <span>Хүрсэн газрууд:</span>
                        <span className="font-semibold text-slate-700">
                          {prov.destinations.join(", ") || prov.province}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Middle: Drivers & Vehicles */}
                  <div className="flex flex-col sm:flex-row gap-3 sm:gap-6 text-xs border-y md:border-y-0 py-2 md:py-0 border-slate-100">
                    <div>
                      <span className="text-slate-400 font-bold block mb-1">Ямар жолооч нар:</span>
                      <div className="flex flex-wrap gap-1">
                        {prov.drivers.map((drv, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-0.5 rounded-lg bg-slate-100 text-slate-800 font-bold text-[11px]"
                          >
                            {drv}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div>
                      <span className="text-slate-400 font-bold block mb-1">Ямар машинаар:</span>
                      <div className="flex flex-wrap gap-1">
                        {prov.vehicles.map((veh, idx) => (
                          <span
                            key={idx}
                            className="font-mono px-2 py-0.5 rounded-lg bg-slate-100 text-slate-900 font-black text-[11px]"
                          >
                            {veh}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Right: Total Boxes & Expand Toggle */}
                  <div className="flex items-center justify-between md:justify-end gap-4 shrink-0">
                    <div className="text-left md:text-right">
                      <div className="text-base sm:text-lg font-black text-slate-900">
                        {prov.totalBoxes.toLocaleString()} <span className="text-xs font-normal text-slate-500">хайрцаг</span>
                      </div>
                      <div className="w-28 bg-slate-100 h-1.5 rounded-full mt-1 overflow-hidden">
                        <div
                          className="bg-[#0878bd] h-full rounded-full transition-all"
                          style={{ width: `${Math.max(5, pct)}%` }}
                        />
                      </div>
                    </div>

                    <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </div>
                  </div>
                </div>

                {/* Expanded Detailed Trip Logs */}
                {isExpanded && (
                  <div className="p-4 bg-slate-50/80 border-t border-slate-200/80 space-y-2">
                    <div className="text-xs font-black text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-[#0878bd]" />
                      <span>{prov.province} чиглэлийн томилолтын дэлгэрэнгүй ({prov.trips.length})</span>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="text-slate-400 font-bold border-b border-slate-200 pb-2">
                            <th className="py-2 px-3">Огноо</th>
                            <th className="py-2 px-3">Захиалга #</th>
                            <th className="py-2 px-3">Хүрэх сум / газар</th>
                            <th className="py-2 px-3">Хариуцсан жолооч</th>
                            <th className="py-2 px-3">Машин</th>
                            <th className="py-2 px-3 text-right">Хайрцаг</th>
                            <th className="py-2 px-3 text-center">Төлөв</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200/60 font-medium">
                          {prov.trips.map((t, idx) => (
                            <tr key={t.id || idx} className="hover:bg-white transition-colors">
                              <td className="py-2 px-3 font-semibold text-slate-700 whitespace-nowrap">
                                {t.date}
                              </td>
                              <td className="py-2 px-3 font-mono font-bold text-slate-900 whitespace-nowrap">
                                {t.orderNo}
                              </td>
                              <td className="py-2 px-3 text-slate-800">
                                {t.destination || prov.province}
                              </td>
                              <td className="py-2 px-3 font-bold text-slate-900">
                                {t.driverName}
                              </td>
                              <td className="py-2 px-3 font-mono font-bold text-slate-800 whitespace-nowrap">
                                {t.vehiclePlate}
                              </td>
                              <td className="py-2 px-3 text-right font-black text-slate-900 whitespace-nowrap">
                                {t.quantity.toLocaleString()}
                              </td>
                              <td className="py-2 px-3 text-center whitespace-nowrap">
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                                  t.status === "Дууссан" || t.status === "Хүргэгдсэн"
                                    ? "bg-emerald-100 text-emerald-800"
                                    : t.status === "Тээвэрт гарсан"
                                    ? "bg-sky-100 text-sky-800"
                                    : "bg-amber-100 text-amber-800"
                                }`}>
                                  {t.status}
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
            );
          })}
        </div>
      )}
    </div>
  );
};
