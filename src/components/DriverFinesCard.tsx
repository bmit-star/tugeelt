import React, { useState, useEffect, useMemo } from "react";
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
  ChevronDown,
  ChevronUp,
  Info,
  ExternalLink,
  CheckCircle,
  CreditCard
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
  const [activeFilter, setActiveFilter] = useState<"all" | "unpaid" | "paid">("all");

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
      // If there are unpaid fines, default view to unpaid or expand
      if ((data?.unpaidCount || 0) > 0) {
        setActiveFilter("unpaid");
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

  const unpaidCount = fineResult?.unpaidCount !== undefined
    ? Number(fineResult.unpaidCount)
    : (fineResult?.status === "ТӨЛӨӨГҮЙ" ? Number(fineResult.count || 0) : 0);
  const paidCount = fineResult?.paidCount !== undefined
    ? Number(fineResult.paidCount)
    : Math.max(0, (fineResult?.rows?.length || 0) - unpaidCount);
  const totalCount = fineResult?.totalCount !== undefined
    ? Number(fineResult.totalCount)
    : (fineResult?.rows?.length || (unpaidCount + paidCount));
  const unpaidAmount = fineResult?.unpaidAmount !== undefined
    ? Number(fineResult.unpaidAmount)
    : (unpaidCount > 0 ? Number(fineResult?.amount || 0) : 0);

  const hasUnpaidFines = unpaidCount > 0;
  const isClean = !hasUnpaidFines;

  // Filtered fine rows
  const filteredRows = useMemo(() => {
    if (!fineResult?.rows) return [];
    if (activeFilter === "unpaid") return fineResult.rows.filter(r => !r.isPaid);
    if (activeFilter === "paid") return fineResult.rows.filter(r => r.isPaid);
    return fineResult.rows;
  }, [fineResult?.rows, activeFilter]);

  return (
    <div
      id={`driver-fines-card-${cleanVehicleNumber}`}
      className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200 shadow-xs overflow-hidden transition-all duration-200"
    >
      {/* Card Header */}
      <div className="p-3.5 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-100 bg-gradient-to-r from-slate-50/90 via-white to-sky-50/30">
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 sm:w-11 sm:h-11 rounded-2xl flex items-center justify-center shrink-0 shadow-2xs ${
              hasUnpaidFines
                ? "bg-rose-500/10 text-rose-600 border border-rose-200"
                : "bg-emerald-500/10 text-emerald-600 border border-emerald-200"
            }`}
          >
            {hasUnpaidFines ? (
              <AlertTriangle className="w-5 h-5 animate-pulse" />
            ) : (
              <ShieldCheck className="w-5 h-5 sm:w-6 sm:h-6" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] sm:text-xs font-black uppercase tracking-wider text-slate-500">
                Замын Цагдаагийн Торгууль
              </span>
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <h3 className="text-base sm:text-lg font-black text-[#123047]">
                {cleanVehicleNumber || "Улсын дугааргүй"}
              </h3>
              {totalCount > 0 && (
                <span className="text-[11px] font-bold text-slate-400">
                  ({unpaidCount > 0 ? `Төлөөгүй: ${unpaidCount}` : `Төлөгдсөн: ${paidCount}`})
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Action / Refresh Button */}
        <div className="flex items-center gap-2 self-stretch sm:self-auto justify-between sm:justify-end">
          {lastUpdated && (
            <span className="text-[10px] sm:text-[11px] font-medium text-slate-400 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              <span>{lastUpdated}</span>
            </span>
          )}
          <button
            id="driver-refresh-fines-btn"
            onClick={() => loadFines(true)}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 rounded-xl text-xs font-bold transition-all disabled:opacity-60 cursor-pointer shadow-2xs"
            title="Замын цагдаагийн системээс шинэчлэн шүүх"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-[#0878bd]" : ""}`} />
            <span>{loading ? "Шүүж байна..." : "Шинэчлэх"}</span>
          </button>
        </div>
      </div>

      {/* Main Status Body */}
      <div className="p-3.5 sm:p-5">
        {loading && !fineResult ? (
          <div className="py-6 flex flex-col items-center justify-center gap-2 text-slate-400">
            <RefreshCw className="w-6 h-6 animate-spin text-[#0878bd]" />
            <p className="text-xs font-medium">Тээврийн хэрэгслийн торгуулийн мэдээлэл шалгаж байна...</p>
          </div>
        ) : error && !fineResult ? (
          <div className="p-3.5 sm:p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <span className="text-xs font-semibold">{error}</span>
            </div>
            <button
              onClick={() => loadFines(true)}
              className="px-2.5 py-1 bg-rose-600 text-white rounded-lg text-xs font-bold hover:bg-rose-700 cursor-pointer"
            >
              Дахин оролдох
            </button>
          </div>
        ) : isClean ? (
          /* Clean / All Paid State */
          <div className="space-y-3">
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-3.5 sm:p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-2xs">
                  <CheckCircle2 className="w-5 h-5 sm:w-6 sm:h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-emerald-800 uppercase tracking-wide">
                      Төлөв: ЦЭВЭР
                    </span>
                    <span className="px-2 py-0.5 bg-emerald-600/10 text-emerald-700 text-[11px] font-bold rounded-full">
                      Төлөгдөөгүй зөрчилгүй
                    </span>
                  </div>
                  <p className="text-xs text-emerald-700 mt-0.5 font-medium">
                    {paidCount > 0
                      ? `Энэ машинд бүртгэгдсэн өмнөх бүх (${paidCount}) торгууль бүрэн төлөгдсөн байна.`
                      : "Тээврийн хэрэгсэлд бүртгэлтэй торгуулийн өр төлбөр байхгүй байна."}
                  </p>
                </div>
              </div>
              <div className="text-right self-end sm:self-auto shrink-0">
                <span className="text-[11px] text-slate-400 font-semibold block">Төлөх дүн</span>
                <span className="text-base sm:text-lg font-black text-emerald-700">0 ₮</span>
              </div>
            </div>

            {/* If there are historical paid fines, show toggle to view history */}
            {paidCount > 0 && (
              <div className="flex items-center justify-between pt-1 text-xs">
                <button
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="text-[#0878bd] hover:underline font-bold flex items-center gap-1 cursor-pointer"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Өмнө төлөгдсөн түүх харах ({paidCount} торгууль)</span>
                  {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>
              </div>
            )}
          </div>
        ) : (
          /* Outstanding Fines State */
          <div className="space-y-3">
            <div className="bg-rose-500/10 border border-rose-500/30 rounded-2xl p-3.5 sm:p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-500 text-white flex items-center justify-center shrink-0 shadow-2xs">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-black text-rose-900 uppercase tracking-wide">
                      Төлөв: ТӨЛӨӨГҮЙ ТОРГУУЛЬТАЙ
                    </span>
                    <span className="px-2.5 py-0.5 bg-rose-600 text-white text-[11px] font-black rounded-full shadow-2xs">
                      {unpaidCount} зөрчил төлөөгүй
                    </span>
                  </div>
                  <p className="text-xs text-rose-800/90 mt-0.5 font-medium">
                    Замын цагдаагийн бүртгэлд нийт {unpaidCount} төлөгдөөгүй шийдвэр байна.
                  </p>
                </div>
              </div>

              <div className="flex flex-col sm:items-end gap-2 self-stretch sm:self-auto">
                <div className="bg-white/95 px-3 py-1.5 rounded-xl border border-rose-200 text-right">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 block">
                    Төлөх дүн
                  </span>
                  <span className="text-base sm:text-lg font-black text-rose-600">
                    {Number(unpaidAmount || 0).toLocaleString()} ₮
                  </span>
                </div>
                <a
                  id="driver-emongolia-pay-btn"
                  href="https://e-mongolia.mn/service/64548fa43bccc22aafcb70b8"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#002d72] hover:bg-[#002257] active:scale-95 text-white font-bold text-xs shadow-2xs transition-all cursor-pointer"
                >
                  <img
                    src="https://cache.e-mongolia.mn/files/portal-v5/images/emon-logo-light.svg"
                    alt="e-Mongolia"
                    className="h-3.5 w-auto object-contain"
                    referrerPolicy="no-referrer"
                  />
                  <span>e-Mongolia төлөх</span>
                  <ExternalLink className="w-3 h-3 opacity-80" />
                </a>
              </div>
            </div>

            {/* Toggle Detailed Breakdown Button */}
            <div className="pt-1">
              <button
                id="driver-toggle-fines-details"
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors flex items-center justify-between text-xs font-bold text-slate-700 cursor-pointer"
              >
                <span className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-[#0878bd]" />
                  <span>Зөрчлийн жагсаалт дэлгэх ({fineResult?.rows?.length || 0})</span>
                </span>
                <div className="flex items-center gap-1 text-slate-500">
                  <span>{isExpanded ? "Хураах" : "Харах"}</span>
                  {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </div>
              </button>
            </div>
          </div>
        )}

        {/* Detailed Breakdown List (When Expanded) */}
        {isExpanded && fineResult?.rows && fineResult.rows.length > 0 && (
          <div className="mt-3 border border-slate-200 rounded-2xl overflow-hidden bg-slate-50/60 p-3 sm:p-4 space-y-3">
            {/* Filter Tabs: Бүгд, Төлөөгүй, Төлсөн */}
            <div className="flex items-center gap-1.5 border-b border-slate-200/80 pb-2.5 overflow-x-auto no-scrollbar">
              <button
                onClick={() => setActiveFilter("all")}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer ${
                  activeFilter === "all"
                    ? "bg-slate-900 text-white shadow-2xs"
                    : "bg-white text-slate-600 hover:bg-slate-200 border border-slate-200"
                }`}
              >
                Бүгд ({fineResult.rows.length})
              </button>
              <button
                onClick={() => setActiveFilter("unpaid")}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1 ${
                  activeFilter === "unpaid"
                    ? "bg-rose-600 text-white shadow-2xs"
                    : "bg-white text-rose-700 hover:bg-rose-50 border border-rose-200"
                }`}
              >
                <AlertTriangle className="w-3 h-3" />
                <span>Төлөөгүй ({unpaidCount})</span>
              </button>
              <button
                onClick={() => setActiveFilter("paid")}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1 ${
                  activeFilter === "paid"
                    ? "bg-emerald-600 text-white shadow-2xs"
                    : "bg-white text-emerald-700 hover:bg-emerald-50 border border-emerald-200"
                }`}
              >
                <CheckCircle className="w-3 h-3" />
                <span>Төлөгдсөн ({paidCount})</span>
              </button>
            </div>

            {/* List of items */}
            <div className="space-y-2.5 max-h-[55vh] overflow-y-auto pr-1">
              {filteredRows.length === 0 ? (
                <div className="py-6 text-center text-slate-400 text-xs">
                  Энэ төрөлд хамаарах торгууль олдсонгүй
                </div>
              ) : (
                filteredRows.map((row: FineRecord, idx: number) => {
                  const isRowPaid = row.isPaid === true;
                  return (
                    <div
                      key={`${row.no}-${idx}`}
                      className={`bg-white p-3 sm:p-3.5 rounded-xl border shadow-2xs space-y-2 ${
                        isRowPaid ? "border-slate-200" : "border-rose-200 bg-rose-50/20"
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1.5 border-b border-slate-100 pb-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-mono text-xs font-bold">
                            № {row.no}
                          </span>
                          <span className="text-xs font-bold text-slate-500 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {row.date}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                              isRowPaid
                                ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                                : "bg-rose-100 text-rose-800 border border-rose-200"
                            }`}
                          >
                            {isRowPaid ? "ТӨЛСӨН" : "ТӨЛӨӨГҮЙ"}
                          </span>
                        </div>

                        <span
                          className={`text-sm font-black px-2.5 py-0.5 rounded-lg border font-mono ${
                            isRowPaid
                              ? "text-slate-700 bg-slate-50 border-slate-200"
                              : "text-rose-700 bg-rose-50 border-rose-200"
                          }`}
                        >
                          {Number(row.amount || 0).toLocaleString()} ₮
                        </span>
                      </div>

                      <div className="space-y-1 text-xs">
                        <div className="flex items-start gap-1.5 text-slate-800 font-medium">
                          <Info className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                          <span className="break-words">{row.violation}</span>
                        </div>
                        {row.location && row.location !== "—" && (
                          <div className="flex items-start gap-1.5 text-slate-500">
                            <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                            <span className="break-words">{row.location}</span>
                          </div>
                        )}
                        {row.bankAccount && (
                          <div className="text-[11px] text-slate-400 font-mono pl-5">
                            Данс: {row.bankAccount} ({row.bankName || "Төрийн сан"})
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

      {/* Footer Info when has unpaid fines */}
      {hasUnpaidFines && (
        <div className="px-3.5 sm:px-5 py-2.5 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-[11px] text-slate-500 font-medium">
          <span>Торгуулийг e-Mongolia эсвэл банкны апп-аар төлж болно.</span>
          <a
            id="driver-emongolia-pay-footer-btn"
            href="https://e-mongolia.mn/service/64548fa43bccc22aafcb70b8"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#002d72] hover:bg-[#002257] active:scale-95 text-white font-bold text-xs shadow-2xs transition-all cursor-pointer shrink-0"
          >
            <img
              src="https://cache.e-mongolia.mn/files/portal-v5/images/emon-logo-light.svg"
              alt="e-Mongolia"
              className="h-3.5 w-auto object-contain"
              referrerPolicy="no-referrer"
            />
            <span>e-Mongolia-аар төлөх</span>
            <ExternalLink className="w-3 h-3 opacity-80" />
          </a>
        </div>
      )}
    </div>
  );
};
