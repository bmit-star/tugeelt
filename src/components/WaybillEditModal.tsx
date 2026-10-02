import React, { useState, useEffect, useMemo } from "react";
import {
  X,
  Save,
  Calendar,
  User,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  FileText,
  Fuel,
  MapPin,
  Lock,
  Radio,
  Clock,
  Sparkles,
  Database,
  Settings,
  Zap,
  ToggleLeft,
  ToggleRight
} from "lucide-react";
import { Driver, VehicleSheetData, DayWaybillStatus } from "../types";
import { api } from "../services/api";
import { isIMTDriver } from "../constants/imtConstants";

interface WaybillEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  drivers: Driver[];
  selectedDriverId?: string;
  selectedMonth?: string;
  onSaved?: () => void;
  onOpenAutoOdoConfig?: (driver: Driver) => void;
}

export const WaybillEditModal: React.FC<WaybillEditModalProps> = ({
  isOpen,
  onClose,
  drivers,
  selectedDriverId: initialDriverId,
  selectedMonth: initialMonth,
  onSaved,
  onOpenAutoOdoConfig,
}) => {
  const todayStr = useMemo(() => new Date().toISOString().split("T")[0], []);
  const currentYearMonth = useMemo(() => todayStr.slice(0, 7), [todayStr]);

  const [selectedDriverId, setSelectedDriverId] = useState<string>(initialDriverId || drivers[0]?.id || "");
  const [selectedMonth, setSelectedMonth] = useState<string>(initialMonth || currentYearMonth);
  const [sheetData, setSheetData] = useState<VehicleSheetData | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [syncingReal, setSyncingReal] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Editable rows state
  const [days, setDays] = useState<
    Array<{
      day: number;
      date: string;
      zone: string;
      task: string;
      startOdo: string | number;
      endOdo: string | number;
      totalKm: string | number;
      fuelLiters: string | number;
      salesRep: string;
      status?: DayWaybillStatus;
      isFuture?: boolean;
      gpsTotalKm?: string | number;
    }>
  >([]);

  const [startOdoInput, setStartOdoInput] = useState<string>("");

  const currentDriver = useMemo(() => {
    return (
      drivers.find(
        (d) => d.id.toUpperCase() === selectedDriverId.toUpperCase() || d.code.toUpperCase() === selectedDriverId.toUpperCase()
      ) || drivers[0]
    );
  }, [drivers, selectedDriverId]);

  useEffect(() => {
    if (initialDriverId) setSelectedDriverId(initialDriverId);
  }, [initialDriverId]);

  useEffect(() => {
    if (initialMonth) setSelectedMonth(initialMonth);
  }, [initialMonth]);

  // Load waybill data for selected driver & month
  const loadSheet = async () => {
    if (!currentDriver) return;
    setLoading(true);
    setStatusMessage(null);
    try {
      const veh = currentDriver.vehicle || currentDriver.id;
      const data = await api.getVehicleSheet(veh, selectedMonth);
      setSheetData(data);

      const mappedDays = data.days.map((d) => {
        const isFuture = d.date > todayStr;
        let dayStatus: DayWaybillStatus = d.status || "CONFIRMED";
        if (isFuture) {
          dayStatus = d.status === "REST_DAY" ? "REST_DAY" : (d.status === "SCHEDULED" ? "SCHEDULED" : "FUTURE_LOCKED");
        }
        return {
          day: d.day,
          date: d.date,
          zone: d.zone || currentDriver.defaultRoute || "",
          task: d.task || (d.startOdo ? "Борлуулалт" : (d.status === "REST_DAY" ? "Хуваарьт амралт" : "Борлуулалт")),
          startOdo: d.startOdo !== "" && !isNaN(Number(d.startOdo)) ? Math.round(Number(d.startOdo)) : (d.startOdo || ""),
          endOdo: d.endOdo !== "" && !isNaN(Number(d.endOdo)) ? Math.round(Number(d.endOdo)) : (d.endOdo || ""),
          totalKm: d.totalKm !== "" && !isNaN(Number(d.totalKm)) ? Math.round(Number(d.totalKm)) : (d.totalKm || ""),
          fuelLiters: d.fuelLiters,
          salesRep: d.salesRep || currentDriver.salesRep || "",
          status: dayStatus,
          isFuture,
          gpsTotalKm: d.gpsTotalKm,
        };
      });
      setDays(mappedDays);

      // Find first non-empty start odo or config
      const firstOdo = mappedDays.find((d) => d.startOdo !== "" && d.startOdo !== undefined)?.startOdo;
      if (firstOdo !== undefined && firstOdo !== "") {
        setStartOdoInput(String(firstOdo));
      } else if (currentDriver.autoOdoConfig?.monthStartOdo) {
        setStartOdoInput(String(currentDriver.autoOdoConfig.monthStartOdo));
      } else if (currentDriver.apiOdo) {
        setStartOdoInput(String(currentDriver.apiOdo));
      } else {
        setStartOdoInput("148000");
      }
    } catch (err: any) {
      setStatusMessage({ type: "error", text: err.message || "Замын хуудас ачаалахад алдаа гарлаа" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && currentDriver) {
      loadSheet();
    }
  }, [isOpen, selectedDriverId, selectedMonth]);

  // Handle single cell change
  const handleCellChange = (index: number, field: string, value: string) => {
    setDays((prev) => {
      const updated = [...prev];
      const row = { ...updated[index], [field]: value };

      if (row.isFuture) return prev; // Cannot edit future

      const isIMT = isIMTDriver(currentDriver);

      // IMT-specific or default calculation:
      // For IMT: End Odo (23:59) - Start Odo (06:00) = Total KM
      if (isIMT) {
        if (field === "startOdo" || field === "endOdo") {
          const start = Math.round(Number(field === "startOdo" ? value : row.startOdo));
          const end = Math.round(Number(field === "endOdo" ? value : row.endOdo));
          if (!isNaN(start) && !isNaN(end) && end >= start) {
            row.startOdo = start;
            row.endOdo = end;
            row.totalKm = end - start;
          }
        } else if (field === "totalKm") {
          const start = Math.round(Number(row.startOdo));
          const km = Math.round(Number(value));
          if (!isNaN(start) && !isNaN(km) && km >= 0) {
            row.totalKm = km;
            row.endOdo = start + km;
          }
        }
      } else {
        // If user changed totalKm or startOdo, re-compute endOdo
        if (field === "startOdo" || field === "totalKm") {
          const start = Math.round(Number(field === "startOdo" ? value : row.startOdo));
          const km = Math.round(Number(field === "totalKm" ? value : row.totalKm));
          if (!isNaN(start) && !isNaN(km) && km >= 0) {
            row.startOdo = start;
            row.totalKm = km;
            row.endOdo = start + km;
          }
        } else if (field === "endOdo") {
          const start = Math.round(Number(row.startOdo));
          const end = Math.round(Number(value));
          if (!isNaN(start) && !isNaN(end) && end >= start) {
            row.endOdo = end;
            row.totalKm = end - start;
          }
        }
      }

      updated[index] = row;

      // Cascading update to subsequent active days if endOdo changed
      if (field === "endOdo" || field === "totalKm" || field === "startOdo") {
        let currentRunning = Math.round(Number(row.endOdo));
        if (!isNaN(currentRunning) && currentRunning > 0) {
          for (let j = index + 1; j < updated.length; j++) {
            if (updated[j].isFuture) break;
            const nextKm = Math.round(Number(updated[j].totalKm) || 0);
            updated[j] = {
              ...updated[j],
              startOdo: currentRunning,
              endOdo: currentRunning + nextKm,
            };
            currentRunning = currentRunning + nextKm;
          }
        }
      }

      return updated;
    });
  };

  // Sync real GPS and Refill Data up to today
  const handleSyncRealData = async () => {
    if (!currentDriver) return;
    setSyncingReal(true);
    setStatusMessage(null);
    try {
      const veh = currentDriver.vehicle || currentDriver.id;
      const res = await api.syncRealWaybillData({
        driverId: currentDriver.id,
        vehicleNumber: veh,
        month: selectedMonth,
      });

      setStatusMessage({
        type: "success",
        text: `📡 ${res.message || "Бодит GPS болон Түлшний өгөгдөл амжилттай синк хийгдлээ"} (${res.syncedDaysCount} өдөр бодогдов)`,
      });
      await loadSheet();
      if (onSaved) onSaved();
    } catch (err: any) {
      setStatusMessage({ type: "error", text: err.message || "Бодит GPS синк хийхэд алдаа гарлаа" });
    } finally {
      setSyncingReal(false);
    }
  };

  // Save changes to backend
  const handleSaveBatch = async () => {
    if (!currentDriver) return;
    setSaving(true);
    setStatusMessage(null);
    try {
      const veh = currentDriver.vehicle || currentDriver.id;
      // Filter only past & today rows for saving
      const activeDays = days.filter((d) => !d.isFuture);

      const res = await api.saveWaybillMonthBatch({
        driverId: currentDriver.id,
        vehicleNumber: veh,
        month: selectedMonth,
        days: activeDays.map((d) => ({
          day: d.day,
          date: d.date,
          zone: d.zone,
          task: d.task,
          startOdo: d.startOdo,
          endOdo: d.endOdo,
          totalKm: d.totalKm,
          fuelLiters: d.fuelLiters,
          salesRep: d.salesRep,
        })),
      });

      setStatusMessage({ type: "success", text: res.message || "Өөрчлөлт амжилттай хадгалагдлаа!" });
      if (onSaved) onSaved();
    } catch (err: any) {
      setStatusMessage({ type: "error", text: err.message || "Хадгалахад алдаа гарлаа" });
    } finally {
      setSaving(false);
    }
  };

  const [isPopulatingGPS, setIsPopulatingGPS] = useState(false);
  const [autoWaybillState, setAutoWaybillState] = useState<boolean>(true);

  useEffect(() => {
    if (currentDriver) {
      setAutoWaybillState(currentDriver.autoWaybillEnabled !== false);
    }
  }, [currentDriver]);

  const handleToggleAutoWaybill = async () => {
    if (!currentDriver) return;
    const nextVal = !autoWaybillState;
    setAutoWaybillState(nextVal);
    try {
      const res = await fetch(`/api/drivers/${currentDriver.id}/auto-waybill`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ autoWaybillEnabled: nextVal }),
      });
      const data = await res.json();
      currentDriver.autoWaybillEnabled = nextVal;
      setStatusMessage({
        type: "success",
        text: data.message || `Жолооч ${currentDriver.name}: Автомат замын хуудас ${nextVal ? "АСААЛТТАЙ" : "УНТРААЛТТАЙ"} боллоо.`,
      });
    } catch (err: any) {
      setAutoWaybillState(!nextVal);
      setStatusMessage({ type: "error", text: "Төлөв солиход алдаа гарлаа" });
    }
  };

  const handleAutoPopulateGPSOdo = async () => {
    if (!currentDriver) return;
    setIsPopulatingGPS(true);
    setStatusMessage(null);
    try {
      const res = await fetch("/api/waybills/auto-populate-gps-odo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          driverId: currentDriver.id,
          month: selectedMonth,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Алдаа гарлаа");

      setStatusMessage({
        type: "success",
        text: data.message || "GPSBox API-аас одометр болон явсан км автоматаар амжилттай бөглөгдлөө!",
      });

      // Reload sheet to show new populated ODO & KM
      await loadSheet();
      if (onSaved) onSaved();
    } catch (err: any) {
      setStatusMessage({ type: "error", text: err.message || "GPS одометр татахад алдаа гарлаа" });
    } finally {
      setIsPopulatingGPS(false);
    }
  };

  // Calculate summary totals for past and today
  const totalMonthKm = useMemo(() => {
    return days.reduce((sum, d) => sum + (Number(d.totalKm) || 0), 0);
  }, [days]);

  const totalMonthFuel = useMemo(() => {
    return days.reduce((sum, d) => sum + (Number(d.fuelLiters) || 0), 0);
  }, [days]);

  const totalWorkDays = useMemo(() => {
    return days.filter((d) => !d.isFuture && Number(d.totalKm) > 0).length;
  }, [days]);

  const renderStatusBadge = (status?: DayWaybillStatus, isFuture?: boolean) => {
    if (status === "REST_DAY") {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-500 border border-slate-200">
          <Calendar className="w-2.5 h-2.5 text-slate-400" /> Хуваарьт амралт
        </span>
      );
    }
    if (status === "SCHEDULED") {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-sky-50 text-sky-800 border border-sky-200">
          <Calendar className="w-2.5 h-2.5 text-sky-600" /> Хуваарьт ажил
        </span>
      );
    }
    if (isFuture || status === "FUTURE_LOCKED") {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-500 border border-slate-200">
          <Lock className="w-2.5 h-2.5" /> Ирээдүй (Цоожтой)
        </span>
      );
    }
    switch (status) {
      case "LIVE":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200 animate-pulse">
            <Radio className="w-2.5 h-2.5 text-blue-600" /> Өнөөдөр Live
          </span>
        );
      case "WAITING_GPS":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-800 border border-amber-200">
            <Clock className="w-2.5 h-2.5 text-amber-600" /> GPS хүлээгдэж буй
          </span>
        );
      case "ODO_REQUIRED":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-orange-100 text-orange-800 border border-orange-200">
            <AlertCircle className="w-2.5 h-2.5 text-orange-600" /> ODO шаардлагатай
          </span>
        );
      case "DATA_ERROR":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
            <AlertCircle className="w-2.5 h-2.5 text-rose-600" /> Зөрүүтэй / Алдаа
          </span>
        );
      case "CONFIRMED":
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
            <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" /> Бодит GPS
          </span>
        );
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-sm overflow-hidden">
      <div className="relative w-full max-w-7xl max-h-[95vh] flex flex-col bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-600/30 border border-blue-400/30 text-blue-400">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white">Замын Хуудас — Бодит GPS & Түлш Бүртгэл</h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Менежер хяналт
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                {currentDriver?.name} ({currentDriver?.vehicle}) • Зөвхөн өнгөрсөн болон өнөөдрийн бодит өгөгдлийг бүртгэнэ (Ирээдүй цоожтой)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-700/50 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toolbar & Selectors */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            {/* Driver Selector */}
            <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-slate-300 shadow-sm">
              <User className="w-4 h-4 text-slate-500" />
              <select
                value={selectedDriverId}
                onChange={(e) => setSelectedDriverId(e.target.value)}
                className="text-sm font-semibold text-slate-800 bg-transparent focus:outline-none cursor-pointer"
              >
                {drivers.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.code} • {d.vehicle} — {d.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Month Selector */}
            <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-slate-300 shadow-sm">
              <Calendar className="w-4 h-4 text-slate-500" />
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="text-sm font-semibold text-slate-800 bg-transparent focus:outline-none cursor-pointer"
              />
            </div>

            {/* Refresh */}
            <button
              onClick={loadSheet}
              disabled={loading}
              className="p-2 text-slate-600 hover:text-blue-600 bg-white hover:bg-blue-50 border border-slate-300 rounded-xl transition-colors shadow-sm"
              title="Дахин ачаалах"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-blue-600" : ""}`} />
            </button>
          </div>

          {/* Sync Real GPS Data Button & Auto-ODO button */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Driver Auto-Waybill Toggle (Request 6) */}
            <button
              onClick={handleToggleAutoWaybill}
              type="button"
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all shadow-2xs cursor-pointer ${
                autoWaybillState
                  ? "bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100"
                  : "bg-slate-100 text-slate-600 border-slate-300 hover:bg-slate-200"
              }`}
              title={autoWaybillState ? "GPS Автомат замын хуудас асаалттай (дарж унтраах)" : "GPS Автомат замын хуудас унтраалттай (дарж асаах)"}
            >
              {autoWaybillState ? (
                <ToggleRight className="w-5 h-5 text-emerald-600" />
              ) : (
                <ToggleLeft className="w-5 h-5 text-slate-400" />
              )}
              <span>
                GPS Автомат: <strong className={autoWaybillState ? "text-emerald-700 font-black" : "text-slate-500 font-bold"}>{autoWaybillState ? "АСААЛТТАЙ" : "УНТРААЛТТАЙ"}</strong>
              </span>
            </button>

            {/* Auto-Populate ODO from GPSBox API (Request 3 - Red Marked Section) */}
            <button
              onClick={handleAutoPopulateGPSOdo}
              disabled={isPopulatingGPS}
              type="button"
              className="flex items-center gap-2 px-3.5 py-2 text-xs font-black text-rose-800 bg-rose-50 hover:bg-rose-100 border border-rose-300 rounded-xl transition-all shadow-xs disabled:opacity-50 cursor-pointer"
              title="GPSBox API-аар машины тухайн өдрийн нийт км гаргаж, одометрийг хүснэгтэд автоматаар байршуулах"
            >
              <Zap className={`w-4 h-4 text-rose-600 ${isPopulatingGPS ? "animate-spin" : ""}`} />
              <span>{isPopulatingGPS ? "GPS Odo татаж байна..." : "GPS ODO & КМ Автомат бөглөх"}</span>
            </button>

            {onOpenAutoOdoConfig && currentDriver && (
              <button
                onClick={() => onOpenAutoOdoConfig(currentDriver)}
                className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-xl transition-all shadow-xs cursor-pointer"
                title="Авто-ODO & API Тохиргоо нээх"
              >
                <Settings className="w-3.5 h-3.5 text-slate-600" />
                <span>Тохиргоо</span>
              </button>
            )}

            <button
              onClick={handleSyncRealData}
              disabled={syncingReal}
              className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 rounded-xl shadow-md shadow-blue-500/20 transition-all disabled:opacity-50 cursor-pointer"
            >
              <Database className={`w-4 h-4 ${syncingReal ? "animate-spin" : ""}`} />
              {syncingReal ? "Синк хийж байна..." : "Бодит GPS & Түлшний синк"}
            </button>
          </div>
        </div>

        {/* Status Notification */}
        {statusMessage && (
          <div
            className={`px-6 py-2.5 flex items-center gap-2 text-sm font-medium ${
              statusMessage.type === "success"
                ? "bg-emerald-50 text-emerald-800 border-b border-emerald-200"
                : "bg-rose-50 text-rose-800 border-b border-rose-200"
            }`}
          >
            {statusMessage.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{statusMessage.text}</span>
          </div>
        )}

        {/* Table Content */}
        <div className="flex-1 overflow-auto p-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-64 gap-3">
              <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
              <p className="text-sm font-medium text-slate-500">Замын хуудасны өгөгдлийг татаж байна...</p>
            </div>
          ) : (
            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-100/90 text-slate-700 font-bold border-b border-slate-300 sticky top-0 z-10 backdrop-blur-xs">
                  <tr>
                    <th className="p-2.5 text-center w-12">Өдөр</th>
                    <th className="p-2.5 w-28">Огноо</th>
                    <th className="p-2.5 w-32">Төлөв</th>
                    <th className="p-2.5 w-36">Чиглэл / Бүс</th>
                    <th className="p-2.5 w-32">Ажил үүрэг</th>
                    <th className="p-2.5 w-28 bg-blue-50/70 text-blue-900 border-x border-blue-200 text-right">Эхний ODO (км)</th>
                    <th className="p-2.5 w-28 bg-blue-50/70 text-blue-900 border-r border-blue-200 text-right">Эцсийн ODO (км)</th>
                    <th className="p-2.5 w-24 bg-emerald-50/70 text-emerald-900 font-extrabold border-r border-emerald-200 text-right">
                      Явсан км
                    </th>
                    <th className="p-2.5 w-24 bg-amber-50/70 text-amber-900 border-r border-amber-200 text-right">Түлш (л)</th>
                    <th className="p-2.5 w-36">Хянасан ХТ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 font-medium text-slate-800">
                  {days.map((row, idx) => {
                    const [year, month] = selectedMonth.split("-").map(Number);
                    const dateObj = new Date(year, month - 1, row.day);
                    const isSunday = dateObj.getDay() === 0;
                    const isFuture = row.isFuture;

                    return (
                      <tr
                        key={row.day}
                        className={`transition-colors ${
                          isFuture
                            ? "bg-slate-50/40 text-slate-400 select-none"
                            : isSunday
                            ? "bg-slate-50/80 text-slate-500 hover:bg-slate-100/60"
                            : "hover:bg-blue-50/40"
                        }`}
                      >
                        {/* Day Number */}
                        <td className="p-2 text-center font-bold text-slate-500 bg-slate-50/50">
                          {row.day}
                        </td>

                        {/* Date */}
                        <td className="p-2 text-slate-600 font-mono text-[11px]">
                          {row.date} {isSunday && <span className="text-[10px] text-rose-500 font-bold">(Ням)</span>}
                        </td>

                        {/* Status Badge */}
                        <td className="p-2">
                          {renderStatusBadge(row.status, isFuture)}
                        </td>

                        {/* Zone / Route */}
                        <td className="p-1.5">
                          <input
                            type="text"
                            disabled={isFuture}
                            value={row.zone}
                            onChange={(e) => handleCellChange(idx, "zone", e.target.value)}
                            placeholder={isFuture ? "—" : currentDriver?.defaultRoute || "Маршрут"}
                            className={`w-full px-2 py-1 text-xs rounded bg-transparent focus:bg-white focus:outline-none ${
                              isFuture
                                ? "cursor-not-allowed text-slate-400 border-none"
                                : "border border-transparent hover:border-slate-300 focus:border-blue-500"
                            }`}
                          />
                        </td>

                        {/* Task */}
                        <td className="p-1.5">
                          <input
                            type="text"
                            disabled={isFuture}
                            value={row.task}
                            onChange={(e) => handleCellChange(idx, "task", e.target.value)}
                            placeholder={isFuture ? "—" : "Борлуулалт"}
                            className={`w-full px-2 py-1 text-xs rounded bg-transparent focus:bg-white focus:outline-none ${
                              isFuture
                                ? "cursor-not-allowed text-slate-400 border-none"
                                : "border border-transparent hover:border-slate-300 focus:border-blue-500"
                            }`}
                          />
                        </td>

                        {/* Start ODO */}
                        <td className="p-1.5 bg-blue-50/20 border-x border-blue-100">
                          <input
                            type="number"
                            disabled={isFuture}
                            value={row.startOdo}
                            onChange={(e) => handleCellChange(idx, "startOdo", e.target.value)}
                            placeholder="—"
                            className={`w-full px-2 py-1 text-xs font-mono font-bold text-blue-900 rounded bg-transparent focus:bg-white focus:outline-none text-right ${
                              isFuture
                                ? "cursor-not-allowed text-slate-400 border-none"
                                : "border border-transparent hover:border-blue-300 focus:border-blue-500"
                            }`}
                          />
                        </td>

                        {/* End ODO */}
                        <td className="p-1.5 bg-blue-50/20 border-r border-blue-100">
                          <input
                            type="number"
                            disabled={isFuture}
                            value={row.endOdo}
                            onChange={(e) => handleCellChange(idx, "endOdo", e.target.value)}
                            placeholder="—"
                            className={`w-full px-2 py-1 text-xs font-mono font-bold text-blue-900 rounded bg-transparent focus:bg-white focus:outline-none text-right ${
                              isFuture
                                ? "cursor-not-allowed text-slate-400 border-none"
                                : "border border-transparent hover:border-blue-300 focus:border-blue-500"
                            }`}
                          />
                        </td>

                        {/* Total KM */}
                        <td className="p-1.5 bg-emerald-50/20 border-r border-emerald-100">
                          <input
                            type="number"
                            disabled={isFuture}
                            value={row.totalKm}
                            onChange={(e) => handleCellChange(idx, "totalKm", e.target.value)}
                            placeholder="—"
                            className={`w-full px-2 py-1 text-xs font-mono font-extrabold text-emerald-800 rounded bg-transparent focus:bg-white focus:outline-none text-right ${
                              isFuture
                                ? "cursor-not-allowed text-slate-400 border-none"
                                : "border border-transparent hover:border-emerald-300 focus:border-emerald-500"
                            }`}
                          />
                        </td>

                        {/* Fuel Liters */}
                        <td className="p-1.5 bg-amber-50/20 border-r border-amber-100">
                          <input
                            type="number"
                            disabled={isFuture}
                            value={row.fuelLiters}
                            onChange={(e) => handleCellChange(idx, "fuelLiters", e.target.value)}
                            placeholder="—"
                            className={`w-full px-2 py-1 text-xs font-mono font-bold text-amber-900 rounded bg-transparent focus:bg-white focus:outline-none text-right ${
                              isFuture
                                ? "cursor-not-allowed text-slate-400 border-none"
                                : "border border-transparent hover:border-amber-300 focus:border-amber-500"
                            }`}
                          />
                        </td>

                        {/* Sales Rep */}
                        <td className="p-1.5">
                          <input
                            type="text"
                            disabled={isFuture}
                            value={row.salesRep}
                            onChange={(e) => handleCellChange(idx, "salesRep", e.target.value)}
                            placeholder={isFuture ? "—" : currentDriver?.salesRep || "ХТ"}
                            className={`w-full px-2 py-1 text-xs rounded bg-transparent focus:bg-white focus:outline-none ${
                              isFuture
                                ? "cursor-not-allowed text-slate-400 border-none"
                                : "border border-transparent hover:border-slate-300 focus:border-blue-500"
                            }`}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer Summary & Actions */}
        <div className="p-4 bg-slate-900 text-white border-t border-slate-800 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-6 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-slate-400">Бодит ажилласан:</span>
              <span className="text-sm font-bold text-white">{totalWorkDays} өдөр</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-slate-400">Гүйсэн бодит км:</span>
              <span className="text-sm font-extrabold text-emerald-400 font-mono">
                {totalMonthKm.toLocaleString()} км
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-slate-400">Цэнэглэсэн түлш:</span>
              <span className="text-sm font-extrabold text-amber-400 font-mono">
                {totalMonthFuel.toLocaleString()} л
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors"
            >
              Хаах
            </button>
            <button
              onClick={handleSaveBatch}
              disabled={saving}
              className="flex items-center gap-2 px-6 py-2.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 rounded-xl shadow-lg shadow-blue-600/30 transition-all disabled:opacity-50"
            >
              <Save className={`w-4 h-4 ${saving ? "animate-spin" : ""}`} />
              {saving ? "Хадгалж байна..." : "Бодит өөрчлөлтийг хадгалах"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
