import React, { useState, useEffect } from "react";
import { VehicleFineResult, FineRecord } from "../types";
import { api } from "../services/api";
import {
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Clock,
  ShieldCheck,
  MapPin,
  FileText,
  CreditCard,
  ChevronDown,
  ChevronUp,
  Info
} from "lucide-react";

interface DriverFinesCardProps {
  vehicleNumber: string;
  driverName?: string;
  driverCode?: string;
  compact?: boolean;
}

export const DriverFinesCard: React.FC<DriverFinesCardProps> = ({
  vehicleNumber,
  driverName,
  driverCode,
  compact = false,
}) => {
  const [loading, setLoading] = useState<boolean>(false);
  const [fineResult, setFineResult] = useState<VehicleFineResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  const cleanVehicleNumber = vehicleNumber ? vehicleNumber.trim() : "";

  const loadFines = async (force = false) => {
    if (!cleanVehicleNumber) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api.checkVehicleFines(cleanVehicleNumber, force);
      setFineResult(data);
      if (data?.checkedAt) {
        const d = new Date(data.checkedAt);
        setLastUpdated(
          `${d.getFullYear()}.${("0" + (d.getMonth() + 1)).slice(-2)}.${("0" + d.getDate()).slice(-2)} ${("0" + d.getHours()).slice(-2)}:${("0" + d.getMinutes()).slice(-2)}`
        );
      }
    } catch (err: any) {
      console.warn("Fines fetch error:", err.message);
      setError("Торгуулийн мэдээлэл авахад түр саатал гарлаа.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (cleanVehicleNumber) {
      loadFines(false);
    }
  }, [cleanVehicleNumber]);

  const hasFines = (fineResult?.count || 0) > 0;
  const isClean = fineResult && (fineResult.status === "ЦЭВЭР" || fineResult.count === 0);

  return (
    <div
      id={`driver-fines-card-${cleanVehicleNumber}`}
      className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200 shadow-sm overflow-hidden transition-all duration-200"
    >
      {/* Card Header */}
      <div className="p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-100 bg-gradient-to-r from-slate-50/80 via-white to-sky-50/30">
        <div className="flex items-center gap-3">
          <div
            className={`w-11 h-11 rounded-2xl flex items-center justify-center shadow-xs ${
              hasFines
                ? "bg-amber-500/10 text-amber-600 border border-amber-200"
                : "bg-emerald-500/10 text-emerald-600 border border-emerald-200"
            }`}
          >
            {hasFines ? (
              <AlertTriangle className="w-5 h-5 animate-pulse" />
            ) : (
              <ShieldCheck className="w-6 h-6" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black uppercase tracking-wider text-slate-500">
                Замын Цагдаа • Зөрчил & Торгууль
              </span>
              <span className="px-2 py-0.5 rounded-md bg-sky-50 text-[10px] font-black text-[#0878bd] border border-sky-200 tracking-wider">
                Шалгагдсан
              </span>
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <h3 className="text-base sm:text-lg font-black text-[#123047]">
                {cleanVehicleNumber || "Улсын дугааргүй"}
              </h3>
              {driverCode && (
                <span className="text-xs font-bold text-slate-400">
                  ({driverCode} {driverName ? `• ${driverName}` : ""})
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Action / Refresh Button */}
        <div className="flex items-center gap-2 self-stretch sm:self-auto justify-between sm:justify-end">
          {lastUpdated && (
            <span className="text-[11px] font-medium text-slate-400 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              {lastUpdated}
            </span>
          )}
          <button
            id="driver-refresh-fines-btn"
            onClick={() => loadFines(true)}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 rounded-xl text-xs font-bold transition-all disabled:opacity-60 cursor-pointer"
            title="Серверээс шинэчлэн шүүх"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-[#0878bd]" : ""}`} />
            <span>{loading ? "Шүүж байна..." : "Шинэчлэх"}</span>
          </button>
        </div>
      </div>

      {/* Main Status Body */}
      <div className="p-4 sm:p-5">
        {loading && !fineResult ? (
          <div className="py-6 flex flex-col items-center justify-center gap-2 text-slate-400">
            <RefreshCw className="w-6 h-6 animate-spin text-[#0878bd]" />
            <p className="text-xs font-medium">Тээврийн хэрэгслийн торгуулийн мэдээлэл шалгаж байна...</p>
          </div>
        ) : error && !fineResult ? (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <AlertTriangle className="w-5 h-5 flex-shrink-0" />
              <span className="text-xs font-semibold">{error}</span>
            </div>
            <button
              onClick={() => loadFines(true)}
              className="px-2.5 py-1 bg-rose-600 text-white rounded-lg text-xs font-bold hover:bg-rose-700"
            >
              Дахин оролдох
            </button>
          </div>
        ) : isClean ? (
          /* Clean State */
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center flex-shrink-0 shadow-sm">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black text-emerald-800 uppercase tracking-wide">
                    Төлөв: ЦЭВЭР
                  </span>
                  <span className="px-2 py-0.5 bg-emerald-600/10 text-emerald-700 text-[11px] font-bold rounded-full">
                    0 зөрчил
                  </span>
                </div>
                <p className="text-xs text-emerald-700 mt-0.5 font-medium">
                  Таны тээврийн хэрэгсэлд бүртгэлтэй төлөгдөөгүй торгууль, зөрчил байхгүй байна.
                </p>
              </div>
            </div>
            <div className="text-right self-end sm:self-auto">
              <span className="text-xs text-slate-400 font-semibold block">Нийт дүн</span>
              <span className="text-base font-black text-emerald-700">0 ₮</span>
            </div>
          </div>
        ) : (
          /* Outstanding Fines State */
          <div className="space-y-3">
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center flex-shrink-0 shadow-sm">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-amber-800 uppercase tracking-wide">
                      Төлөв: ТӨЛӨӨГҮЙ ТОРГУУЛЬТАЙ
                    </span>
                    <span className="px-2.5 py-0.5 bg-amber-500 text-white text-[11px] font-black rounded-full shadow-xs">
                      {fineResult?.count || 0} зөрчил
                    </span>
                  </div>
                  <p className="text-xs text-amber-800/80 mt-0.5 font-medium">
                    Замын цагдаагийн бүртгэлд нийт {fineResult?.count} төлөгдөөгүй шийдвэр байна.
                  </p>
                </div>
              </div>
              <div className="text-right self-end sm:self-auto bg-white/80 px-3.5 py-1.5 rounded-xl border border-amber-200">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 block">
                  Нийт төлөх дүн
                </span>
                <span className="text-lg font-black text-rose-600">
                  {Number(fineResult?.amount || 0).toLocaleString()} ₮
                </span>
              </div>
            </div>

            {/* Toggle Detailed Breakdown */}
            {fineResult?.rows && fineResult.rows.length > 0 && (
              <div className="border border-slate-200 rounded-2xl overflow-hidden bg-slate-50/50">
                <button
                  id="driver-toggle-fines-details"
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="w-full px-4 py-3 bg-slate-100/80 hover:bg-slate-200/80 transition-colors flex items-center justify-between text-xs font-bold text-slate-700 cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-[#0878bd]" />
                    Зөрчлийн дэлгэрэнгүй жагсаалт ({fineResult.rows.length})
                  </span>
                  <div className="flex items-center gap-1 text-slate-500">
                    <span>{isExpanded ? "Хураах" : "Харах"}</span>
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </div>
                </button>

                {isExpanded && (
                  <div className="p-3 sm:p-4 space-y-2.5">
                    {fineResult.rows.map((row: FineRecord, idx: number) => (
                      <div
                        key={`${row.no}-${idx}`}
                        className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs space-y-2"
                      >
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1 border-b border-slate-100 pb-2">
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-mono text-xs font-bold">
                              № {row.no}
                            </span>
                            <span className="text-xs font-bold text-slate-500 flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {row.date}
                            </span>
                          </div>
                          <span className="text-sm font-black text-rose-600 bg-rose-50 px-2.5 py-0.5 rounded-lg border border-rose-200">
                            {Number(row.amount || 0).toLocaleString()} ₮
                          </span>
                        </div>

                        <div className="space-y-1 text-xs">
                          <div className="flex items-start gap-1.5 text-slate-800 font-medium">
                            <Info className="w-3.5 h-3.5 text-slate-400 flex-shrink-0 mt-0.5" />
                            <span>{row.violation}</span>
                          </div>
                          {row.location && row.location !== "—" && (
                            <div className="flex items-center gap-1.5 text-slate-500">
                              <MapPin className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                              <span>{row.location}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="px-4 sm:px-5 py-2.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 font-medium">
        <span className="flex items-center gap-1">
          <CreditCard className="w-3.5 h-3.5 text-slate-400" />
          Торгууль төлөх: Тээврийн хэрэгслийн гэрчилгээ эсвэл e-Mongolia
        </span>
        <span className="text-slate-400 font-mono text-[10px]">Бодит цагийн шүүлт</span>
      </div>
    </div>
  );
};
