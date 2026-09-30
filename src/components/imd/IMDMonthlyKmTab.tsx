import React, { useState, useEffect } from "react";
import { 
  Gauge, 
  Calendar, 
  Users, 
  Download, 
  Sparkles, 
  CheckCircle2, 
  FileSpreadsheet, 
  ShieldCheck,
  TrendingUp,
  Award
} from "lucide-react";
import { IMDMonthlyDriverKM } from "../../types";
import { api } from "../../services/api";
import { IMD_MASTER_DRIVERS } from "../../constants/imdConstants";

interface Props {
  onShowToast: (msg: string, type: "success" | "error" | "info") => void;
}

export const IMDMonthlyKmTab: React.FC<Props> = ({ onShowToast }) => {
  const [year, setYear] = useState<number>(2026);
  const [loading, setLoading] = useState<boolean>(true);
  const [report, setReport] = useState<IMDMonthlyDriverKM[]>([]);

  const fetchReport = async () => {
    setLoading(true);
    try {
      const res = await api.getIMDDriverKMReport(year);
      setReport(res.report || []);
    } catch (err: any) {
      onShowToast(err.message, "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [year]);

  // Current month (0-indexed)
  const currentMonthIdx = new Date().getMonth(); // 0 for Jan, 8 for Sept
  const currentMonthNum = currentMonthIdx + 1;
  const currentMonthName = `${currentMonthNum}-р сар`;

  // Total KM for current month
  const currentMonthTotalKM = report.reduce((sum, r) => sum + (r.months[currentMonthNum] || 0), 0);
  const yearTotalKM = report.reduce((sum, r) => sum + r.totalKm, 0);
  const totalTrips = report.reduce((sum, r) => sum + (r.totalTripsCount || r.tripsCount || 0), 0);

  const MONTH_NAMES = [
    "1-р сар", "2-р сар", "3-р сар", "4-р сар", "5-р сар", "6-р сар",
    "7-р сар", "8-р сар", "9-р сар", "10-р сар", "11-р сар", "12-р сар"
  ];

  // 8 Official IMD drivers mapping
  const imdDriversRows = IMD_MASTER_DRIVERS.map((m) => {
    const found = report.find(r => 
      String(r.driverCode) === m.code || 
      String(r.driverId) === m.code || 
      (r.vehiclePlate && r.vehiclePlate.replace(/\s+/g, "").toUpperCase() === m.vehicle.replace(/\s+/g, "").toUpperCase()) ||
      (r.vehicle && r.vehicle.replace(/\s+/g, "").toUpperCase() === m.vehicle.replace(/\s+/g, "").toUpperCase())
    );
    return {
      name: m.name,
      code: m.code,
      vehicle: m.vehicle,
      totalKm: found ? found.totalKm : 0,
      tripsCount: found ? (found.totalTripsCount || found.tripsCount || 0) : 0,
      months: found ? found.months : {},
      found
    };
  });

  const imd8TotalKm = imdDriversRows.reduce((sum, d) => sum + d.totalKm, 0);
  const imd8TotalTrips = imdDriversRows.reduce((sum, d) => sum + d.tripsCount, 0);

  const handleExportCSV = () => {
    const headers = ["Жолооч", "Машин", ...MONTH_NAMES, "Нийт км", "Нийт томилолт"];
    const rows = report.map(r => {
      const monthValues = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(m => r.months[m] || 0);
      return [
        `"${r.driverName}"`,
        `"${r.vehiclePlate || r.vehicle}"`,
        ...monthValues,
        r.totalKm,
        r.totalTripsCount || r.tripsCount || 0
      ];
    });
    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `IMD_Жолоочийн_КМ_Тайлан_${year}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    onShowToast("Жолоочийн км тайлан амжилттай татагдлаа", "success");
  };

  return (
    <div className="space-y-5">
      {/* Header & Guaranteed KM Badge */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-5">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-black flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Баталгаат Өгөгдөл: КМ-ийг таамаглахгүй, замын хуудасны бодит заалтад үндэслэв</span>
            </span>
          </div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Gauge className="w-6 h-6 text-[#0878bd]" />
            <span>Жолоочийн Сар Бүрийн КМ Тайлан ({year} он)</span>
          </h2>
          <p className="text-slate-500 text-xs mt-1 max-w-2xl">
            Бүх томилолт, замын хуудас, odometer эхлэх/дуусах заалтаар бодогдсон албан ёсны гүйцэтгэл. Жолооч бүрийн сарын нийлбэр километр автоматаар нэгтгэгдэнэ.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-50 px-3 py-2 rounded-2xl border border-slate-200 text-xs font-bold">
            <Calendar className="w-4 h-4 text-slate-400" />
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="bg-transparent font-bold text-slate-800 outline-none cursor-pointer"
            >
              <option value={2026}>2026 он</option>
              <option value={2025}>2025 он</option>
              <option value={2024}>2024 он</option>
            </select>
          </div>

          <button
            onClick={handleExportCSV}
            className="px-4 py-2 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-2 shadow-xs transition-all"
          >
            <Download className="w-4 h-4" />
            <span>Excel / CSV татах</span>
          </button>
        </div>
      </div>

      {/* Prominent Verification Banner Required by Master Spec */}
      <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 text-white p-5 rounded-3xl shadow-md flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center shrink-0">
            <Award className="w-6 h-6 text-white" />
          </div>
          <div>
            <span className="text-xs font-bold text-emerald-100 uppercase tracking-wider block">
              🚗 Энэ сарын нэгдсэн гүйцэтгэл ({currentMonthName})
            </span>
            <div className="text-2xl sm:text-3xl font-black tracking-tight mt-0.5">
              Энэ сар нийт явсан км: {currentMonthTotalKM.toLocaleString()} км
            </div>
            <span className="text-xs text-emerald-100 font-medium block mt-0.5">
              (Замын хуудасны бодит ODO бүртгэлд үндэслэв — ямар нэгэн таамаглалгүй)
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4 bg-white/15 backdrop-blur-md px-4 py-2.5 rounded-2xl border border-white/20 self-stretch sm:self-auto justify-around sm:justify-start">
          <div className="text-center">
            <span className="text-[10px] text-emerald-100 uppercase font-bold block">Оны нийт км</span>
            <span className="text-base font-black text-white">{yearTotalKM.toLocaleString()} км</span>
          </div>
          <div className="w-px h-8 bg-white/20" />
          <div className="text-center">
            <span className="text-[10px] text-emerald-100 uppercase font-bold block">Нийт томилолт</span>
            <span className="text-base font-black text-white">{totalTrips} тээвэр</span>
          </div>
        </div>
      </div>

      {/* 8 Official IMD Drivers Summary Section */}
      <div className="bg-gradient-to-br from-[#123047] via-[#094873] to-[#0878bd] text-white p-6 rounded-3xl shadow-lg border border-sky-900/30 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-white/15">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white/15 backdrop-blur-md flex items-center justify-center shrink-0">
              <Users className="w-6 h-6 text-sky-200" />
            </div>
            <div>
              <span className="text-xs font-bold text-sky-200 uppercase tracking-wider block">
                IMD Албан ёсны 8 Жолоочийн Нэгдсэн Гүйцэтгэл
              </span>
              <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                Нийт км: {imd8TotalKm.toLocaleString()} км
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-4 bg-white/10 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/15">
            <div>
              <span className="text-[10px] text-sky-200 uppercase font-bold block">Жолооч нар</span>
              <span className="text-sm font-black text-white">8/8 үндсэн бүртгэл</span>
            </div>
            <div className="w-px h-7 bg-white/15" />
            <div>
              <span className="text-[10px] text-sky-200 uppercase font-bold block">Нийт томилолт</span>
              <span className="text-sm font-black text-white">{imd8TotalTrips} тээвэр</span>
            </div>
          </div>
        </div>

        {/* 8 Driver Individual Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {imdDriversRows.map((d, i) => (
            <div 
              key={d.code}
              className="bg-white/10 hover:bg-white/15 backdrop-blur-md rounded-2xl p-3.5 border border-white/15 transition-all flex flex-col justify-between"
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-4 h-4 rounded-full bg-sky-400/30 text-sky-200 text-[10px] font-black flex items-center justify-center">
                      {i + 1}
                    </span>
                    <span className="text-xs font-black text-white">
                      {d.name}
                    </span>
                  </div>
                  <span className="text-[11px] font-mono text-sky-200 font-bold block mt-0.5">
                    Код: {d.code} • {d.vehicle}
                  </span>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-emerald-400/20 text-emerald-300 text-[10px] font-bold border border-emerald-400/30">
                  {d.tripsCount} тээвэр
                </span>
              </div>

              <div className="pt-2 border-t border-white/10 flex items-center justify-between">
                <span className="text-[10px] text-sky-200">Нийт гүйлт:</span>
                <span className="text-sm font-black text-white tracking-tight">
                  {d.totalKm.toLocaleString()} км
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Driver Matrix Table */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-black uppercase text-slate-500 tracking-wider">
                <th className="py-3 px-4 sticky left-0 bg-slate-50/90 backdrop-blur-xs z-10">Жолооч</th>
                <th className="py-3 px-3">Машин</th>
                {MONTH_NAMES.map((m, idx) => (
                  <th 
                    key={m} 
                    className={`py-3 px-2.5 text-right font-black ${
                      idx === currentMonthIdx ? "bg-emerald-50 text-emerald-800" : ""
                    }`}
                  >
                    {idx + 1}-р сар
                  </th>
                ))}
                <th className="py-3 px-4 text-right bg-blue-50 text-blue-900 font-black">Нийт КМ</th>
                <th className="py-3 px-3 text-center">Томилолт</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={16} className="py-16 text-center text-slate-400">
                    <div className="inline-block w-6 h-6 border-3 border-[#0878bd] border-t-transparent rounded-full animate-spin"></div>
                    <p className="mt-2 text-xs font-medium">КМ тайлан тооцоолж байна...</p>
                  </td>
                </tr>
              ) : report.length === 0 ? (
                <tr>
                  <td colSpan={16} className="py-12 text-center text-slate-400 font-medium">
                    Тайлан олдсонгүй
                  </td>
                </tr>
              ) : (
                report.map((row) => {
                  const isOfficialIMD = ["775", "141", "9726", "14", "173", "314", "283", "5535"].includes(String(row.driverCode)) || row.isIMD;
                  return (
                  <tr key={row.driverId} className={`hover:bg-slate-50/70 transition-colors ${isOfficialIMD ? "bg-sky-50/30 font-medium" : ""}`}>
                    <td className="py-3 px-4 font-bold text-slate-900 sticky left-0 bg-white/95 backdrop-blur-xs z-10 flex items-center gap-2">
                      <div className={`w-6 h-6 rounded-full font-black text-[10px] flex items-center justify-center shrink-0 ${isOfficialIMD ? "bg-[#0878bd] text-white" : "bg-blue-100 text-[#0878bd]"}`}>
                        {row.driverName.charAt(0)}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span>{row.driverName}</span>
                        {isOfficialIMD && (
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-sky-100 text-[#0878bd] border border-sky-200 shrink-0">
                            IMD {row.driverCode ? `(${row.driverCode})` : ""}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-3 font-mono font-bold text-slate-700">
                      {row.vehiclePlate || row.vehicle}
                    </td>
                    {MONTH_NAMES.map((_, idx) => {
                      const km = row.months[idx + 1] || 0;
                      return (
                        <td
                          key={idx}
                          className={`py-3 px-2.5 text-right font-medium ${
                            idx === currentMonthIdx
                              ? "bg-emerald-50/50 font-bold text-emerald-900"
                              : km > 0
                              ? "text-slate-800"
                              : "text-slate-300"
                          }`}
                        >
                          {km > 0 ? km.toLocaleString() : "-"}
                        </td>
                      );
                    })}
                    <td className="py-3 px-4 text-right font-black text-blue-900 bg-blue-50/60 text-sm">
                      {row.totalKm.toLocaleString()} км
                    </td>
                    <td className="py-3 px-3 text-center font-bold text-slate-700">
                      <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-800 text-[11px]">
                        {row.totalTripsCount || row.tripsCount || 0}
                      </span>
                    </td>
                  </tr>
                  );
                })
              )}
            </tbody>
            {/* Summary Footer */}
            {report.length > 0 && (
              <tfoot>
                <tr className="bg-slate-100 font-black text-slate-900 border-t border-slate-200">
                  <td className="py-3 px-4 sticky left-0 bg-slate-100 z-10" colSpan={2}>
                    Нийт нэгтгэл:
                  </td>
                  {MONTH_NAMES.map((_, idx) => {
                    const monthSum = report.reduce((sum, r) => sum + (r.months[idx + 1] || 0), 0);
                    return (
                      <td
                        key={idx}
                        className={`py-3 px-2.5 text-right font-black ${
                          idx === currentMonthIdx ? "bg-emerald-100 text-emerald-900" : ""
                        }`}
                      >
                        {monthSum > 0 ? monthSum.toLocaleString() : "-"}
                      </td>
                    );
                  })}
                  <td className="py-3 px-4 text-right font-black text-blue-900 bg-blue-100 text-sm">
                    {yearTotalKM.toLocaleString()} км
                  </td>
                  <td className="py-3 px-3 text-center font-black">
                    {totalTrips}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
};
