import React, { useState, useEffect } from "react";
import { Driver, TripLog, Telemetry } from "../types";
import { API } from "../services/api";
import { PETROVIS_GAS_STATIONS } from "../constants/gasStations";
import { getSeasonSchedule, checkScheduleReminders, SeasonScheduleInfo, ReminderStatus } from "../utils/scheduleHelper";
import { DriverFinesCard } from "./DriverFinesCard";
import { 
  Truck, 
  Fuel, 
  Thermometer, 
  Snowflake,
  Calendar, 
  MapPin, 
  UserCheck, 
  CheckCircle2, 
  AlertCircle, 
  AlertTriangle,
  RefreshCw, 
  Clock, 
  Check, 
  FileText,
  Share2,
  Lock,
  ChevronRight,
  Sparkles,
  Gauge,
  CreditCard,
  Receipt,
  Info,
  BellRing,
  ShieldCheck
} from "lucide-react";

interface DriverWaybillProps {
  currentDriver: Driver;
  onOpenVehicleSheet: (vehNumber: string) => void;
  onSwitchDriver: () => void;
  onShowToast: (msg: string, type?: "success" | "error" | "info") => void;
}

export const DriverWaybill: React.FC<DriverWaybillProps> = ({
  currentDriver,
  onOpenVehicleSheet,
  onSwitchDriver,
  onShowToast
}) => {
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    return new Date(today.getTime() - today.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  });

  const [selectedZone, setSelectedZone] = useState(currentDriver.defaultRoute || "УБ Төв салбар");
  const [salesRep, setSalesRep] = useState(currentDriver.salesRep || "До.Дэмбэрэл");
  const [startOdoInput, setStartOdoInput] = useState<string>("");
  const [endOdoInput, setEndOdoInput] = useState<string>("");
  
  // Fuel fields
  const [hasFueled, setHasFueled] = useState<boolean>(false);
  const [fuelLitersInput, setFuelLitersInput] = useState<string>("");
  const [fuelCostInput, setFuelCostInput] = useState<string>("");
  const [fuelPaymentMethod, setFuelPaymentMethod] = useState<string>("Петровис карт");
  const [fuelReceiptNo, setFuelReceiptNo] = useState<string>("");
  const [selectedStationId, setSelectedStationId] = useState<string>("02");
  const [customStationName, setCustomStationName] = useState<string>("");
  const [routeNote, setRouteNote] = useState<string>("Борлуулалт");

  const [loading, setLoading] = useState(false);
  const [tripStatus, setTripStatus] = useState<{
    phase: "started" | "complete" | "none";
    startOdo: number;
    endOdo?: number | null;
    totalKm?: number;
    tripId?: string;
    fuelLiters?: number;
    fuelStation?: string;
    fuelCost?: number;
    fuelPaymentMethod?: string;
  }>({ phase: "none", startOdo: 0 });

  const [telemetry, setTelemetry] = useState<Telemetry | null>(currentDriver.telemetry || null);
  const [isRefreshingTelemetry, setIsRefreshingTelemetry] = useState(false);

  // Time & Seasonal Schedule Tracker
  const [reminderState, setReminderState] = useState<ReminderStatus>(() => checkScheduleReminders());
  const [currentTimeStr, setCurrentTimeStr] = useState(() => new Date().toLocaleTimeString("mn-MN"));

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setReminderState(checkScheduleReminders(now));
      setCurrentTimeStr(now.toLocaleTimeString("mn-MN", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Load app data for the driver and date
  const loadTripData = async () => {
    try {
      const data = await API.getAppData(selectedDate);
      const updatedDriver = data.drivers.find(
        (d) => d.id.toUpperCase() === currentDriver.id.toUpperCase() || d.code.toUpperCase() === currentDriver.code.toUpperCase()
      );

      if (updatedDriver) {
        if (updatedDriver.telemetry) {
          setTelemetry(updatedDriver.telemetry);
        }
        if (updatedDriver.salesRep && !salesRep) {
          setSalesRep(updatedDriver.salesRep);
        }
        if (updatedDriver.defaultRoute && !selectedZone) {
          setSelectedZone(updatedDriver.defaultRoute);
        }
      }

      const status = data.tripStatus[currentDriver.id] || data.tripStatus[currentDriver.code];
      if (status) {
        setTripStatus({
          phase: status.phase,
          startOdo: status.startOdo,
          endOdo: status.endOdo,
          totalKm: status.totalKm,
          tripId: status.tripId
        });
      } else {
        setTripStatus({ phase: "none", startOdo: 0 });
        if (updatedDriver?.apiOdo && !startOdoInput) {
          setStartOdoInput(String(updatedDriver.apiOdo));
        }
      }
    } catch (err: any) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadTripData();
    const interval = setInterval(loadTripData, 20000); // 20s live refresh
    return () => clearInterval(interval);
  }, [currentDriver.id, selectedDate]);

  useEffect(() => {
    if (currentDriver.salesRep) {
      setSalesRep(currentDriver.salesRep);
    }
    if (currentDriver.defaultRoute) {
      setSelectedZone(currentDriver.defaultRoute);
    }
  }, [currentDriver]);

  // Handle Refresh GPS Telemetry Button
  const handleSyncTelemetry = async () => {
    setIsRefreshingTelemetry(true);
    try {
      const res = await API.syncGPSBoxNow();
      await loadTripData();
      onShowToast(`GPSBox-с ${res.count} машины телематик мэдээлэл шинэчлэгдлээ`, "success");
    } catch (err: any) {
      onShowToast("GPSBox холболт шалгах үед алдаа гарлаа", "error");
    } finally {
      setIsRefreshingTelemetry(false);
    }
  };

  // Auto-calculate fuel cost when liters change (using standard diesel avg rate ~3,350₮)
  const handleLitersChange = (val: string) => {
    setFuelLitersInput(val);
    const num = parseFloat(val);
    if (!isNaN(num) && num > 0 && !fuelCostInput) {
      setFuelCostInput(String(Math.round(num * 3350)));
    }
  };

  // Submit Step 1: Start Odometer
  const handleSubmitStartOdo = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = Number(startOdoInput);
    if (!val || isNaN(val) || val <= 0) {
      onShowToast("Эхлэх ODO заалтыг зөв оруулна уу!", "error");
      return;
    }

    setLoading(true);
    try {
      const res = await API.startTrip({
        date: selectedDate,
        driverId: currentDriver.id,
        driverName: currentDriver.name,
        vehicleNumber: currentDriver.vehicle,
        salesRep: salesRep,
        zone: selectedZone,
        startOdo: val,
        routeNote: routeNote
      });
      onShowToast(res.message, "success");
      await loadTripData();
    } catch (err: any) {
      onShowToast(err.message || "Алдаа гарлаа", "error");
    } finally {
      setLoading(false);
    }
  };

  // Submit Step 2: End Odometer & Fuel
  const handleSubmitEndOdo = async (e: React.FormEvent) => {
    e.preventDefault();
    const endVal = Number(endOdoInput);
    if (!endVal || isNaN(endVal) || endVal <= 0) {
      onShowToast("Төгсгөх ODO заалтыг зөв оруулна уу!", "error");
      return;
    }

    if (endVal < tripStatus.startOdo) {
      onShowToast(`Төгсгөх ODO (${endVal} км) нь эхлэх ODO (${tripStatus.startOdo} км)-с бага байж болохгүй!`, "error");
      return;
    }

    let finalStationName = "";
    if (hasFueled) {
      const matchedStation = PETROVIS_GAS_STATIONS.find(s => s.id === selectedStationId);
      if (selectedStationId === "other") {
        finalStationName = customStationName.trim() ? `Бусад - ${customStationName.trim()}` : "Бусад ШТС";
      } else {
        finalStationName = matchedStation ? matchedStation.name : "Петровис ШТС";
      }
    }

    setLoading(true);
    try {
      const res = await API.endTrip({
        date: selectedDate,
        driverId: currentDriver.id,
        endOdo: endVal,
        fuelLiters: hasFueled ? (Number(fuelLitersInput) || 0) : 0,
        fuelStation: hasFueled ? finalStationName : "Цэнэглээгүй",
        fuelCost: hasFueled ? (Number(fuelCostInput) || 0) : 0,
        fuelPaymentMethod: hasFueled ? fuelPaymentMethod : undefined,
        fuelReceiptNo: hasFueled ? fuelReceiptNo : undefined,
        routeNote: routeNote
      });
      onShowToast(res.message, "success");
      await loadTripData();
    } catch (err: any) {
      onShowToast(err.message || "Алдаа гарлаа", "error");
    } finally {
      setLoading(false);
    }
  };

  // Pre-fill end ODO with live GPS ODO or estimated
  const handleAutoFillEndOdo = () => {
    if (telemetry?.odo && telemetry.odo > tripStatus.startOdo) {
      setEndOdoInput(String(telemetry.odo));
    } else {
      setEndOdoInput(String(tripStatus.startOdo + 85));
    }
  };

  const calculatedTotalKm = endOdoInput && tripStatus.startOdo 
    ? Math.max(0, Number(endOdoInput) - tripStatus.startOdo) 
    : 0;

  const { schedule } = reminderState;

  return (
    <div className="w-full max-w-lg mx-auto pb-16 px-3 sm:px-4 antialiased selection:bg-sky-100">
      
      {/* Dynamic Warning Notification for drivers who haven't submitted waybill/odometer */}
      {tripStatus.phase !== "complete" && (
        <div className="mb-3.5 bg-amber-500 text-slate-950 p-3.5 rounded-2xl shadow-sm border border-amber-300 flex items-start gap-2.5">
          <AlertTriangle className="w-5 h-5 text-slate-950 flex-shrink-0 mt-0.5" />
          <div className="text-xs font-bold leading-snug">
            <strong>САНУУЛГА:</strong> Та замын хуудасаа бөглөөгүй байна. Өнөөдөр бөглөөгүй бол нөхөн бөглөх боломжгүй!
          </div>
        </div>
      )}

      {/* 2. Mobile Top Header */}
      <header className="bg-gradient-to-br from-[#0878bd] via-[#096ca9] to-[#123047] text-white rounded-2xl shadow-lg p-4 sm:p-5 mb-3.5 relative overflow-hidden">
        <div className="absolute -right-8 -top-8 w-36 h-36 bg-white/5 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -left-8 -bottom-8 w-32 h-32 bg-sky-400/10 rounded-full blur-xl pointer-events-none" />

        <div className="relative z-10">
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2">
              <div className="h-8 px-2 rounded-lg bg-white/95 backdrop-blur-md flex items-center justify-center border border-white/20 shadow-sm overflow-hidden">
                <img 
                  src="https://icemark.mn/images/logo_company-icemark.svg" 
                  alt="Icemark Logo" 
                  className="h-5 w-auto object-contain"
                  referrerPolicy="no-referrer"
                />
              </div>
              <div>
                <span className="text-xs font-black tracking-wider uppercase text-sky-100/90 block">
                  FLEET DIGITAL
                </span>
                <span className="text-[11px] text-sky-200/80 leading-none">
                  Жолоочийн замын хуудас
                </span>
              </div>
            </div>

            <button
              onClick={onSwitchDriver}
              title="Бүсийн код солих / Гарах"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/15 hover:bg-white/25 active:scale-95 transition-all text-xs font-bold border border-white/20 shadow-sm"
            >
              <span>Код: {currentDriver.code || currentDriver.id}</span>
              <span className="text-[10px] opacity-75 font-normal">Гарах</span>
            </button>
          </div>

          <div className="mt-3 pt-3 border-t border-white/15 flex items-center justify-between">
            <div className="min-w-0 pr-2">
              <h1 className="text-lg sm:text-xl font-black text-white truncate tracking-tight">
                {currentDriver.name} <span className="text-sky-200 font-medium text-sm">({currentDriver.phone || "90636371"})</span>
              </h1>
              <p className="text-xs text-sky-100/80 flex items-center gap-1.5 mt-0.5">
                <span>Код: <strong className="text-white font-bold">{currentDriver.id}</strong></span>
                <span>•</span>
                <span className="truncate">{currentDriver.salesRep || "До.Дэмбэрэл"}</span>
              </p>
            </div>

            <div className="flex-shrink-0">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                Баталгаажсан
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* 4. Card: GPSBox Realtime Telematics Card */}
      <section className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4 sm:p-5 mb-3.5 relative overflow-hidden">
        <div className="flex items-center justify-between mb-3 pb-2.5 border-b border-slate-100">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
            <h2 className="text-sm font-black text-[#123047] truncate">GPSBox Realtime Телематик</h2>
          </div>

          <div className="flex items-center gap-1.5 flex-shrink-0">
            <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
              Шууд холбогдсон
            </span>
            <button
              onClick={handleSyncTelemetry}
              disabled={isRefreshingTelemetry}
              title="Шинэчлэх"
              className="p-1.5 text-slate-400 hover:text-[#0878bd] hover:bg-slate-100 rounded-lg transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingTelemetry ? "animate-spin text-[#0878bd]" : ""}`} />
            </button>
          </div>
        </div>

        {/* Vehicle Badge & Model */}
        <div className="bg-gradient-to-r from-slate-50 to-slate-100/80 rounded-xl p-3.5 border border-slate-200/70 flex items-center justify-between mb-3.5">
          <div>
            <div className="text-lg sm:text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              <span>{currentDriver.vehicle || "2611 УЕВ"}</span>
              <span className="text-xs px-2 py-0.5 rounded bg-slate-200/80 text-slate-700 font-semibold">
                {currentDriver.model || "Isuzu NPR 75"}
              </span>
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1.5">
              <span>Сүүлийн дохио: {telemetry?.lastUpdate || "Дөнгөж сая"}</span>
              {telemetry?.speed !== undefined && telemetry.speed > 0 && (
                <span className="text-sky-700 font-bold">• Хурд: {telemetry.speed} км/ц</span>
              )}
            </div>
          </div>

          <div className="text-right">
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 border border-emerald-200 shadow-2xs">
              ● ИДЭВХТЭЙ
            </span>
          </div>
        </div>

        {/* Telemetry Sensor Row (Fuel & Temp) */}
        <div className="grid grid-cols-2 gap-2.5">
          <div className="bg-sky-50/70 border border-sky-100 rounded-xl p-3 border-l-4 border-l-[#0878bd] flex flex-col justify-between">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-600 mb-1">
              <Fuel className="w-3.5 h-3.5 text-[#0878bd]" />
              <span className="truncate">Fuel level (GPS Түлш)</span>
            </div>
            <div className="text-base sm:text-lg font-black text-[#0878bd] mt-1 tracking-tight">
              {telemetry?.fuel || "45.0 л"}
            </div>
            {telemetry?.fuelPercent !== undefined && (
              <div className="w-full bg-sky-200/60 h-1.5 rounded-full overflow-hidden mt-1.5">
                <div 
                  className="bg-[#0878bd] h-full rounded-full transition-all duration-500" 
                  style={{ width: `${Math.min(100, Math.max(5, telemetry.fuelPercent))}%` }}
                />
              </div>
            )}
          </div>

          {(() => {
            const tempVal = telemetry?.tempNum !== undefined && !isNaN(telemetry.tempNum)
              ? telemetry.tempNum
              : (telemetry?.temp ? parseFloat(String(telemetry.temp).replace(/[^0-9.-]/g, "")) || -20.0 : -20.0);
            
            const isOptimal = tempVal <= -18;
            const isWarning = tempVal > -18 && tempVal <= -15;

            return (
              <div 
                className={`rounded-xl p-3 flex flex-col justify-between transition-colors ${
                  isOptimal
                    ? "bg-cyan-50/70 border border-cyan-200/80 border-l-4 border-l-cyan-600"
                    : isWarning
                    ? "bg-amber-50/80 border border-amber-200 border-l-4 border-l-amber-500"
                    : "bg-rose-50/90 border border-rose-200 border-l-4 border-l-rose-600"
                }`}
              >
                <div className="flex items-center justify-between text-[11px] font-semibold text-slate-600 mb-1">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <Snowflake className={`w-3.5 h-3.5 flex-shrink-0 ${isOptimal ? "text-cyan-600" : isWarning ? "text-amber-600" : "text-rose-600"}`} />
                    <span className="truncate">Зайрмагны хөлдөөгч</span>
                  </div>
                  <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                    isOptimal ? "bg-cyan-100 text-cyan-800" : isWarning ? "bg-amber-100 text-amber-800" : "bg-rose-100 text-rose-800 animate-pulse"
                  }`}>
                    {isOptimal ? "Хэвийн" : isWarning ? "Анхаар" : "Аюултай!"}
                  </span>
                </div>

                <div className={`text-base sm:text-lg font-black mt-0.5 tracking-tight flex items-baseline gap-1 ${
                  isOptimal ? "text-cyan-800" : isWarning ? "text-amber-800" : "text-rose-700"
                }`}>
                  <span>{telemetry?.temp || `${tempVal.toFixed(1)}°C`}</span>
                  <span className="text-[10px] font-medium text-slate-500">(-18°C норм)</span>
                </div>

                <div className="text-[10px] text-slate-500 mt-1 flex items-center gap-1 leading-tight">
                  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                    isOptimal ? "bg-cyan-500" : isWarning ? "bg-amber-500" : "bg-rose-500 animate-ping"
                  }`} />
                  <span className="truncate">
                    {isOptimal
                      ? "Гүн хөлдөөлт хэвийн (≤ -18°C)"
                      : isWarning
                      ? "Хөргөлт суларч байна (-15°C ~ -18°C)"
                      : "Зайрмаг хайлах эрсдэлтэй (> -15°C)"}
                  </span>
                </div>
              </div>
            );
          })()}
        </div>

        {telemetry?.odo ? (
          <div className="mt-2.5 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
            <span className="flex items-center gap-1">
              <Gauge className="w-3.5 h-3.5 text-slate-400" />
              GPS Телематик ODO:
            </span>
            <span className="font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded-md">
              {telemetry.odo.toLocaleString()} км
            </span>
          </div>
        ) : null}
      </section>

      {/* 5. Card: Traffic Violations & Fines Check (erthub.mn) */}
      <div className="mb-3.5">
        <DriverFinesCard
          vehicleNumber={currentDriver.vehicle || "2611УЕВ"}
          driverName={currentDriver.name}
          driverCode={currentDriver.id}
        />
      </div>

      {/* PHASE 1: START ODOMETER CARD */}
      {tripStatus.phase === "none" && (
        <section id="start-card" className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4 sm:p-5 mb-3.5 transition-all">
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-sky-100 text-[#0878bd] font-black text-xs flex items-center justify-center">
                1
              </div>
              <h2 className="text-sm font-black text-[#123047]">Эхлэх ODO заалт бүртгэх</h2>
            </div>
            <span className="text-xs font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md">
              Ажил эхлээгүй
            </span>
          </div>

          <form onSubmit={handleSubmitStartOdo} className="space-y-3.5">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
                  Эхлэх ODO (км)
                </label>
                {telemetry?.odo ? (
                  <button
                    type="button"
                    onClick={() => setStartOdoInput(String(telemetry.odo))}
                    className="text-[11px] font-bold text-[#0878bd] hover:underline flex items-center gap-1"
                  >
                    <Sparkles className="w-3 h-3" />
                    GPS-с авах ({telemetry.odo.toLocaleString()} км)
                  </button>
                ) : null}
              </div>

              <div className="relative">
                <input
                  id="driver-start-odo-input"
                  type="number"
                  placeholder="Жишээ нь: 148230"
                  value={startOdoInput}
                  onChange={(e) => setStartOdoInput(e.target.value)}
                  required
                  min="1"
                  className="w-full h-12 px-4 rounded-xl border border-slate-300 bg-white text-slate-900 text-base font-bold tracking-wide focus:outline-none focus:ring-2 focus:ring-[#0878bd] focus:border-[#0878bd] shadow-2xs"
                />
                <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                  КМ
                </div>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                Ажил үүргийн тэмдэглэл (Сонголттой)
              </label>
              <input
                type="text"
                placeholder="Борлуулалт, хүргэлт..."
                value={routeNote}
                onChange={(e) => setRouteNote(e.target.value)}
                className="w-full h-10 px-3.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 text-xs sm:text-sm font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0878bd]"
              />
            </div>

            <button
              id="submit-start-odo-btn"
              type="submit"
              disabled={loading}
              className="w-full h-12 rounded-xl font-black text-sm sm:text-base text-white bg-[#0878bd] hover:bg-[#076ba8] active:scale-[0.99] transition-all shadow-md shadow-sky-900/10 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <RefreshCw className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <CheckCircle2 className="w-5 h-5 text-emerald-300" />
                  <span>Эхлэх ODO хадгалах</span>
                </>
              )}
            </button>

            <p className="text-[11px] text-slate-500 leading-relaxed text-center px-2">
              Ажил эхлэхдээ ({schedule.startTimeFormatted}-с өмнө) энэ хэсгийг бөглөнө. Орой баазад ирээд төгсгөх заалт, түлшний мэдээллээ бүртгэнэ.
            </p>
          </form>
        </section>
      )}

      {/* PHASE 2: END ODOMETER & COMPREHENSIVE FUEL CARD */}
      {tripStatus.phase === "started" && (
        <section id="end-card" className="bg-white rounded-2xl border-2 border-sky-200 shadow-md p-4 sm:p-5 mb-3.5 relative">
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-amber-100 text-amber-800 font-black text-xs flex items-center justify-center">
                2
              </div>
              <h2 className="text-sm font-black text-[#123047]">Төгсгөх ODO & Түлшний мэдээлэл</h2>
            </div>
            <span className="text-xs font-bold text-amber-700 bg-amber-100/80 px-2.5 py-0.5 rounded-full flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              🟡 ЭХЭЛСЭН
            </span>
          </div>

          <form onSubmit={handleSubmitEndOdo} className="space-y-4">
            {/* Locked Start ODO */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                Эхлэх ODO (Хадгалагдсан)
              </label>
              <div className="relative flex items-center">
                <div className="absolute left-3.5 text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  id="saved-start-odo-display"
                  type="text"
                  readOnly
                  value={`${tripStatus.startOdo.toLocaleString()} км`}
                  className="w-full h-11 pl-10 pr-4 rounded-xl border border-slate-200 bg-slate-100 text-slate-800 text-sm font-black cursor-not-allowed"
                />
              </div>
            </div>

            {/* End ODO Input */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-700">
                  Төгсгөх ODO (км) <span className="text-rose-500">*</span>
                </label>
                {telemetry?.odo && telemetry.odo > tripStatus.startOdo ? (
                  <button
                    type="button"
                    onClick={handleAutoFillEndOdo}
                    className="text-[10px] font-bold text-[#0878bd] hover:underline"
                  >
                    GPS-с авах ({telemetry.odo} км)
                  </button>
                ) : null}
              </div>
              <input
                id="driver-end-odo-input"
                type="number"
                placeholder={`> ${tripStatus.startOdo}`}
                value={endOdoInput}
                onChange={(e) => setEndOdoInput(e.target.value)}
                required
                min={tripStatus.startOdo}
                className="w-full h-11 px-3.5 rounded-xl border border-slate-300 bg-white text-slate-900 text-base font-bold focus:outline-none focus:ring-2 focus:ring-[#0878bd]"
              />
            </div>

            {/* Calculated Distance Preview Banner */}
            {calculatedTotalKm > 0 && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-center justify-between text-xs text-emerald-900 font-bold">
                <span>Нийт гүйлт (Явсан зай):</span>
                <span className="text-base font-black text-emerald-700 bg-white px-3 py-1 rounded-lg shadow-2xs border border-emerald-200">
                  {calculatedTotalKm} км
                </span>
              </div>
            )}

            {/* FUEL SECTION */}
            <div className="pt-2 border-t border-slate-200">
              <div className="flex items-center justify-between mb-2.5">
                <div className="flex items-center gap-1.5 text-xs font-black text-[#123047]">
                  <Fuel className="w-4 h-4 text-[#0878bd]" />
                  <span>Түлш цэнэглэлтийн мэдээлэл</span>
                </div>

                {/* Fuel toggle button */}
                <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs font-bold">
                  <button
                    type="button"
                    onClick={() => {
                      setHasFueled(false);
                      setFuelLitersInput("");
                      setFuelCostInput("");
                    }}
                    className={`px-2.5 py-1 rounded-md transition-all ${
                      !hasFueled ? "bg-white text-slate-800 shadow-2xs" : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    Цэнэглээгүй
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setHasFueled(true);
                      if (!fuelLitersInput) setFuelLitersInput("20");
                      if (!fuelCostInput) setFuelCostInput("67000");
                    }}
                    className={`px-2.5 py-1 rounded-md transition-all ${
                      hasFueled ? "bg-[#0878bd] text-white shadow-2xs" : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    + Түлш авсан
                  </button>
                </div>
              </div>

              {hasFueled ? (
                <div className="bg-sky-50/60 rounded-xl p-3.5 border border-sky-100 space-y-3 animate-in fade-in duration-200">
                  {/* Liters & Cost Row */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Авсан түлш (Литр) <span className="text-rose-500">*</span>
                      </label>
                      <div className="relative">
                        <input
                          id="driver-fuel-liters-input"
                          type="number"
                          step="0.1"
                          min="0.1"
                          required={hasFueled}
                          placeholder="20.0"
                          value={fuelLitersInput}
                          onChange={(e) => handleLitersChange(e.target.value)}
                          className="w-full h-10 px-3 rounded-lg border border-slate-300 bg-white text-slate-900 text-sm font-bold focus:ring-2 focus:ring-[#0878bd]"
                        />
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                          Литр
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Нийт үнийн дүн (₮)
                      </label>
                      <div className="relative">
                        <input
                          id="driver-fuel-cost-input"
                          type="number"
                          placeholder="67000"
                          value={fuelCostInput}
                          onChange={(e) => setFuelCostInput(e.target.value)}
                          className="w-full h-10 px-3 rounded-lg border border-slate-300 bg-white text-slate-900 text-sm font-bold focus:ring-2 focus:ring-[#0878bd]"
                        />
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                          ₮
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Gas Station Selector */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      ШТС / Салбар байршил
                    </label>
                    <select
                      id="driver-fuel-station-select"
                      value={selectedStationId}
                      onChange={(e) => setSelectedStationId(e.target.value)}
                      className="w-full h-10 px-3 rounded-lg border border-slate-300 bg-white text-slate-800 text-xs font-semibold focus:ring-2 focus:ring-[#0878bd]"
                    >
                      {PETROVIS_GAS_STATIONS.map((st) => (
                        <option key={st.id} value={st.id}>
                          {st.display}
                        </option>
                      ))}
                    </select>

                    {selectedStationId === "other" && (
                      <div className="mt-2">
                        <input
                          id="driver-custom-station-input"
                          type="text"
                          value={customStationName}
                          onChange={(e) => setCustomStationName(e.target.value)}
                          placeholder="ШТС-ын нэр, салбар, байршлыг бичнэ үү..."
                          className="w-full h-9 px-3 rounded-lg border border-sky-300 bg-white text-slate-900 text-xs font-medium focus:ring-2 focus:ring-[#0878bd]"
                          autoFocus
                        />
                      </div>
                    )}
                  </div>

                  {/* Payment Method & Receipt */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center gap-1">
                        <CreditCard className="w-3 h-3 text-[#0878bd]" />
                        <span>Төлбөрийн хэлбэр</span>
                      </label>
                      <select
                        value={fuelPaymentMethod}
                        onChange={(e) => setFuelPaymentMethod(e.target.value)}
                        className="w-full h-9 px-2.5 rounded-lg border border-slate-300 bg-white text-slate-800 text-xs font-medium focus:ring-2 focus:ring-[#0878bd]"
                      >
                        <option value="Петровис карт">Петровис карт</option>
                        <option value="Байгууллагын талон">Байгууллагын талон</option>
                        <option value="Бэлэн / Хувийн данс">Бэлэн / Хувийн данс</option>
                        <option value="Бусад">Бусад хэлбэр</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center gap-1">
                        <Receipt className="w-3 h-3 text-[#0878bd]" />
                        <span>Чек / Баримтын дугаар</span>
                      </label>
                      <input
                        type="text"
                        placeholder="Чек № (Сонголттой)"
                        value={fuelReceiptNo}
                        onChange={(e) => setFuelReceiptNo(e.target.value)}
                        className="w-full h-9 px-2.5 rounded-lg border border-slate-300 bg-white text-slate-900 text-xs font-medium focus:ring-2 focus:ring-[#0878bd]"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-2.5 text-center text-xs text-slate-500">
                  Энэ өдөр түлш цэнэглээгүй бол "+ Түлш авсан" товч дарах шаардлагагүй.
                </div>
              )}
            </div>

            <button
              id="submit-end-odo-btn"
              type="submit"
              disabled={loading}
              className="w-full h-12 rounded-xl font-black text-sm sm:text-base text-white bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 active:scale-[0.99] transition-all shadow-md shadow-emerald-900/15 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <RefreshCw className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <Check className="w-5 h-5" />
                  <span>Өдрийн замын хуудсыг хааж баталгаажуулах</span>
                </>
              )}
            </button>

            <p className="text-[11px] text-slate-500 leading-relaxed text-center px-2">
              Ажлын өдрийн эцэст баазад ирээд энэ хэсгийг бүрэн бөглөж замын хуудсаа хаана уу.
            </p>
          </form>
        </section>
      )}

      {/* PHASE 3: COMPLETED WAYBILL CARD */}
      {tripStatus.phase === "complete" && (
        <section id="complete-card" className="bg-white rounded-2xl border-2 border-emerald-300 shadow-md p-5 mb-3.5 text-center">
          <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-3 shadow-inner">
            <CheckCircle2 className="w-7 h-7" />
          </div>

          <h2 className="text-base font-black text-slate-900 mb-1">
            Өнөөдрийн замын хуудас дуусгагдсан байна
          </h2>
          <p className="text-xs text-slate-500 mb-4">
            {selectedDate} өдрийн замын хуудасны бүртгэл амжилттай хаагдаж баталгаажсан.
          </p>

          <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200/80 mb-4 grid grid-cols-3 gap-2 text-left">
            <div>
              <span className="text-[10px] text-slate-500 font-bold block uppercase">Эхлэх</span>
              <span className="text-xs sm:text-sm font-black text-slate-800">
                {tripStatus.startOdo.toLocaleString()} км
              </span>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 font-bold block uppercase">Төгсгөх</span>
              <span className="text-xs sm:text-sm font-black text-slate-800">
                {tripStatus.endOdo?.toLocaleString()} км
              </span>
            </div>
            <div>
              <span className="text-[10px] text-emerald-600 font-bold block uppercase">Нийт км</span>
              <span className="text-xs sm:text-sm font-black text-emerald-700">
                {tripStatus.totalKm || (tripStatus.endOdo ? tripStatus.endOdo - tripStatus.startOdo : 0)} км
              </span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2.5">
            <button
              onClick={() => onOpenVehicleSheet(currentDriver.vehicle)}
              className="flex-1 h-11 px-4 rounded-xl text-xs font-black text-[#0878bd] bg-sky-50 hover:bg-sky-100 border border-sky-200 flex items-center justify-center gap-1.5 transition-colors"
            >
              <FileText className="w-4 h-4" />
              <span>Машины дэвтэр (Veh_{currentDriver.vehicle})</span>
            </button>

            <button
              onClick={() => {
                if (navigator.share) {
                  navigator.share({
                    title: `Замын хуудас • ${currentDriver.name}`,
                    text: `${currentDriver.vehicle} | ${selectedDate} | Явсан: ${tripStatus.totalKm} км`
                  }).catch(() => {});
                } else {
                  onShowToast("Замын хуудасны хураангуй хуулагдлаа", "info");
                }
              }}
              className="h-11 px-4 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 flex items-center justify-center gap-1.5 transition-colors"
            >
              <Share2 className="w-4 h-4" />
              <span>Хуваалцах</span>
            </button>
          </div>
        </section>
      )}

      {/* Quick Navigation Footer */}
      <div className="flex items-center justify-between px-2 pt-1 text-xs text-slate-400">
        <span>FLEET DIGITAL v2.4 • GPSBox FMS2</span>
        <button
          onClick={() => onOpenVehicleSheet(currentDriver.vehicle)}
          className="text-[#0878bd] font-bold hover:underline flex items-center gap-1"
        >
          <span>Сар тутмын замын дэвтэр</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
