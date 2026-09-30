import React, { useState, useEffect } from "react";
import { Driver, TripLog, Telemetry, IMDDriverMonthlyProvinceStats } from "../types";
import { API } from "../services/api";
import { PETROVIS_GAS_STATIONS } from "../constants/gasStations";
import { getSeasonSchedule, checkScheduleReminders, SeasonScheduleInfo, ReminderStatus } from "../utils/scheduleHelper";
import { findProvinceRoute, MEAL_RATE_PER_PERSON, isIMDProvinceDriver } from "../constants/provinceRoutes";
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
  Lock,
  Unlock,
  Eye,
  EyeOff,
  KeyRound,
  Sparkles,
  Gauge,
  CreditCard,
  Receipt,
  Info,
  BellRing,
  ShieldCheck,
  Route,
  Utensils,
  Package,
  Users,
  X,
  BookOpen
} from "lucide-react";

interface DriverWaybillProps {
  currentDriver: Driver;
  onOpenVehicleSheet: (vehNumber: string) => void;
  onSwitchDriver: () => void;
  onShowToast: (msg: string, type?: "success" | "error" | "info") => void;
  onOpenRegulation?: () => void;
}

export const DriverWaybill: React.FC<DriverWaybillProps> = ({
  currentDriver,
  onOpenVehicleSheet,
  onSwitchDriver,
  onShowToast,
  onOpenRegulation
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
  const [imdAssignment, setImdAssignment] = useState<any | null>(null);

  // Check if current driver is one of the authorized 8 IMD province drivers
  const isProvinceDriver = isIMDProvinceDriver(currentDriver);

  // Monthly Province KM Stats for Driver (only for the 8 authorized IMD drivers)
  const [monthlyProvinceStats, setMonthlyProvinceStats] = useState<IMDDriverMonthlyProvinceStats | null>(null);
  const [showProvinceDetailModal, setShowProvinceDetailModal] = useState<boolean>(false);
  const [isLoadingProvinceStats, setIsLoadingProvinceStats] = useState<boolean>(false);

  const loadMonthlyProvinceStats = async () => {
    if (!isProvinceDriver) {
      setMonthlyProvinceStats(null);
      return;
    }
    try {
      setIsLoadingProvinceStats(true);
      const [yearStr, monthStr] = selectedDate.split("-");
      const year = Number(yearStr) || 2026;
      const month = Number(monthStr) || 9;
      const stats = await API.getIMDDriverMonthlyProvinceStats(currentDriver.id, month, year);
      if (stats) {
        setMonthlyProvinceStats(stats);
      }
    } catch (err) {
      console.warn("Could not load driver monthly province stats:", err);
    } finally {
      setIsLoadingProvinceStats(false);
    }
  };

  // KM Privacy Protection States (IMD Түгээгчийн хувийн км хамгаалах нууц код)
  const [hasKmPin, setHasKmPin] = useState<boolean>(() => !!currentDriver.kmPrivacyPin || !!currentDriver.hasKmPin);
  const [isKmUnlocked, setIsKmUnlocked] = useState<boolean>(() => !currentDriver.kmPrivacyPin && !currentDriver.hasKmPin);
  const [kmPinModalMode, setKmPinModalMode] = useState<"setup" | "unlock" | "change" | null>(null);
  const [pinInput, setPinInput] = useState<string>("");
  const [pinConfirmInput, setPinConfirmInput] = useState<string>("");
  const [currentPinInput, setCurrentPinInput] = useState<string>("");
  const [showPinChars, setShowPinChars] = useState<boolean>(false);
  const [pinError, setPinError] = useState<string>("");
  const [isSavingPin, setIsSavingPin] = useState<boolean>(false);

  useEffect(() => {
    const hasPin = !!currentDriver.kmPrivacyPin || !!currentDriver.hasKmPin;
    setHasKmPin(hasPin);
    setIsKmUnlocked(!hasPin);
  }, [currentDriver.id, currentDriver.kmPrivacyPin, currentDriver.hasKmPin]);

  const handleOpenSetupPin = () => {
    setPinInput("");
    setPinConfirmInput("");
    setCurrentPinInput("");
    setPinError("");
    setShowPinChars(false);
    setKmPinModalMode("setup");
  };

  const handleOpenUnlockPin = () => {
    setPinInput("");
    setPinError("");
    setShowPinChars(false);
    setKmPinModalMode("unlock");
  };

  const handleOpenChangePin = () => {
    setPinInput("");
    setPinConfirmInput("");
    setCurrentPinInput("");
    setPinError("");
    setShowPinChars(false);
    setKmPinModalMode("change");
  };

  const handleLockKm = () => {
    setIsKmUnlocked(false);
    onShowToast("Км мэдээлэл нууцлагдлаа.", "info");
  };

  const handleSaveNewPin = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinError("");
    const trimmedPin = pinInput.trim();
    if (!trimmedPin || trimmedPin.length < 4) {
      setPinError("Нууц код хамгийн багадаа 4 оронтой байх ёстой!");
      return;
    }
    if (trimmedPin !== pinConfirmInput.trim()) {
      setPinError("Нууц кодууд тохирохгүй байна! Дахин шалгана уу.");
      return;
    }

    try {
      setIsSavingPin(true);
      const res = await API.setDriverKmPrivacy(currentDriver.id, "set", trimmedPin);
      if (res.success) {
        setHasKmPin(true);
        setIsKmUnlocked(false);
        setKmPinModalMode(null);
        currentDriver.kmPrivacyPin = trimmedPin;
        currentDriver.hasKmPin = true;
        onShowToast("Км нуух нууц код амжилттай тохируулагдлаа. Таны км нууцлагдлаа.", "success");
      }
    } catch (err: any) {
      setPinError(err.message || "Нууц код хадгалахад алдаа гарлаа");
    } finally {
      setIsSavingPin(false);
    }
  };

  const handleVerifyUnlockPin = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinError("");
    const trimmedPin = pinInput.trim();
    if (!trimmedPin) {
      setPinError("Нууц кодоо оруулна уу!");
      return;
    }

    try {
      setIsSavingPin(true);
      const res = await API.setDriverKmPrivacy(currentDriver.id, "verify", trimmedPin);
      if (res.success && res.unlocked) {
        setIsKmUnlocked(true);
        setKmPinModalMode(null);
        onShowToast("Км мэдээлэл амжилттай тайлагдлаа.", "success");
      }
    } catch (err: any) {
      setPinError(err.message || "Нууц код буруу байна!");
    } finally {
      setIsSavingPin(false);
    }
  };

  const handleRemoveOrChangePin = async (action: "remove" | "change") => {
    setPinError("");
    const curPin = currentPinInput.trim();
    if (!curPin) {
      setPinError("Одоогийн нууц кодоо оруулна уу!");
      return;
    }

    if (action === "remove") {
      try {
        setIsSavingPin(true);
        const res = await API.setDriverKmPrivacy(currentDriver.id, "remove", curPin, curPin);
        if (res.success) {
          setHasKmPin(false);
          setIsKmUnlocked(true);
          setKmPinModalMode(null);
          delete currentDriver.kmPrivacyPin;
          currentDriver.hasKmPin = false;
          onShowToast("Км нууцлалыг цуцаллаа. Км ил харагдахаар боллоо.", "info");
        }
      } catch (err: any) {
        setPinError(err.message || "Одоогийн нууц код буруу байна!");
      } finally {
        setIsSavingPin(false);
      }
    } else {
      const newPin = pinInput.trim();
      if (!newPin || newPin.length < 4) {
        setPinError("Шинэ нууц код хамгийн багадаа 4 оронтой байх ёстой!");
        return;
      }
      if (newPin !== pinConfirmInput.trim()) {
        setPinError("Шинэ нууц кодууд тохирохгүй байна!");
        return;
      }
      try {
        setIsSavingPin(true);
        // Verify current pin first
        const vRes = await API.setDriverKmPrivacy(currentDriver.id, "verify", curPin);
        if (!vRes.success || !vRes.unlocked) {
          setPinError("Одоогийн нууц код буруу байна!");
          return;
        }
        // Then set new pin
        const sRes = await API.setDriverKmPrivacy(currentDriver.id, "set", newPin);
        if (sRes.success) {
          setHasKmPin(true);
          setIsKmUnlocked(true);
          setKmPinModalMode(null);
          currentDriver.kmPrivacyPin = newPin;
          currentDriver.hasKmPin = true;
          onShowToast("Нууц код амжилттай шинэчлэгдлээ.", "success");
        }
      } catch (err: any) {
        setPinError(err.message || "Нууц код өөрчлөхөд алдаа гарлаа");
      } finally {
        setIsSavingPin(false);
      }
    }
  };

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

      // Fetch IMD active assignment only if driver is one of the 8 authorized IMD province drivers
      if (isProvinceDriver) {
        try {
          const cleanVeh = (currentDriver.vehicle || "").replace(/\s+/g, "").toUpperCase();
          const todayStr = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
          const targetDay = selectedDate || todayStr;

          let allAssignments: any[] = [];
          try {
            const imdRes = await fetch(`/api/imd/assignments?driverId=${encodeURIComponent(currentDriver.id)}`);
            const ct = imdRes.headers.get("content-type") || "";
            if (imdRes.ok && ct.includes("application/json")) {
              const imdJson = await imdRes.json();
              if (Array.isArray(imdJson.assignments)) {
                allAssignments = imdJson.assignments;
              }
            }
          } catch {
            // Ignore fetch glitch
          }

          if (allAssignments.length === 0 && cleanVeh) {
            try {
              const vehRes = await fetch(`/api/imd/assignments?vehiclePlate=${encodeURIComponent(cleanVeh)}`);
              const ct = vehRes.headers.get("content-type") || "";
              if (vehRes.ok && ct.includes("application/json")) {
                const vehJson = await vehRes.json();
                if (Array.isArray(vehJson.assignments)) {
                  allAssignments = vehJson.assignments;
                }
              }
            } catch {
              // Ignore fetch glitch
            }
          }

          // ЗӨВХӨН тухайн өдөр / өнөөдрийн төлөвлөсөн (Төлөвлөсөн, Тээвэрт гарсан) бодит томилолтыг харуулна.
          // ДУУССАН ("Дууссан"), цуцлагдсан болон зохиомол томилолтыг ХАРУУЛАХГҮЙ!
          const active = allAssignments.find((a: any) => {
            if (!a || a.isMock === true || a.isSample === true) return false;
            const oNo = (a.orderNo || "").toUpperCase();
            if (oNo.startsWith("ORD-IMD-260915-") && (a.id?.startsWith("asn_ord_imd_260915_") || a.token?.startsWith("tok_"))) {
              return false;
            }
            if (a.status === "Дууссан" || a.status === "Цуцлагдсан") {
              return false;
            }
            const isPlannedOrActive = a.status === "Төлөвлөсөн" || a.status === "Тээвэрт гарсан";
            if (!isPlannedOrActive) {
              return false;
            }

            const dep = a.departureDate;
            const ret = a.returnDate;
            if (dep === targetDay) return true;
            if (ret && dep && dep <= targetDay && ret >= targetDay) return true;
            return false;
          });

          setImdAssignment(active || null);
        } catch (e) {
          setImdAssignment(null);
        }
      } else {
        setImdAssignment(null);
      }
    } catch (err: any) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadTripData();
    if (isProvinceDriver) {
      loadMonthlyProvinceStats();
    } else {
      setMonthlyProvinceStats(null);
    }
    const interval = setInterval(() => {
      // Only poll if tab is active/visible to avoid overwhelming Cloud Run / Google Frontend
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        loadTripData();
        if (isProvinceDriver) {
          loadMonthlyProvinceStats();
        }
      }
    }, 60000); // 60s live refresh (prevents 429 Rate Limit)
    return () => clearInterval(interval);
  }, [currentDriver.id, selectedDate, isProvinceDriver]);

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

  // 3-Түгээгч томилолтоо хааж ирсэн үеийн odometr ээ бичиж дараагын томилолтыг хүлээж авах хэсэг нээгдэн
  const handleOpenNextTrip = () => {
    const nextStartOdo = tripStatus.endOdo ? String(tripStatus.endOdo) : (startOdoInput || "0");
    setStartOdoInput(nextStartOdo);
    setEndOdoInput("");
    setFuelLitersInput("");
    setFuelCostInput("");
    setHasFueled(false);
    setTripStatus(prev => ({
      ...prev,
      phase: "none",
      startOdo: tripStatus.endOdo || prev.startOdo,
      endOdo: undefined,
      totalKm: 0,
      fuelLiters: 0
    }));
    onShowToast("Дараагийн томилолтыг хүлээж авах хэсэг нээгдлээ. Эхлэх ODO заалт автоматаар шинэчлэгдсэн.", "success");
  };

  // Pre-fill end ODO with live GPS ODO only if valid
  const handleAutoFillEndOdo = () => {
    if (telemetry?.odo && telemetry.odo >= tripStatus.startOdo) {
      setEndOdoInput(String(telemetry.odo));
    } else {
      onShowToast("GPS ODO заалт олдсонгүй эсвэл эхлэх заалтаас бага байна. Бодит заалтаа гараар оруулна уу.", "info");
    }
  };

  const calculatedTotalKm = endOdoInput && tripStatus.startOdo 
    ? Math.max(0, Number(endOdoInput) - tripStatus.startOdo) 
    : 0;

  const { schedule } = reminderState;

  return (
    <div className="w-full max-w-lg mx-auto pb-16 px-3 sm:px-4 antialiased selection:bg-sky-100">
      
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
                  {isProvinceDriver ? "ТҮГЭЭГЧ (IMD)" : "БОРЛУУЛАЛТ (IMT)"}
                </span>
                <span className="text-[11px] text-sky-200/80 leading-none">
                  {isProvinceDriver ? "Түгээгчийн замын хуудас" : "Жолоочийн замын хуудас"}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              {onOpenRegulation && (
                <button
                  type="button"
                  onClick={onOpenRegulation}
                  title="Авто тээвэр, түгээлтийн үйл ажиллагааны журам (Хавсралт №3) нээх"
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-amber-400/25 hover:bg-amber-400/35 active:scale-95 transition-all text-xs font-black border border-amber-300/40 text-amber-100 shadow-sm cursor-pointer"
                >
                  <BookOpen className="w-3.5 h-3.5 text-amber-300" />
                  <span className="font-mono text-[11px] font-extrabold tracking-wider">//журам//</span>
                </button>
              )}
              <button
                onClick={onSwitchDriver}
                title="Бүсийн код солих / Гарах"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/15 hover:bg-white/25 active:scale-95 transition-all text-xs font-bold border border-white/20 shadow-sm"
              >
                <span>Код: {currentDriver.code || currentDriver.id}</span>
                <span className="text-[10px] opacity-75 font-normal">Гарах</span>
              </button>
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-white/15 flex items-center justify-between gap-2.5">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-lg sm:text-xl font-black text-white tracking-tight flex items-center gap-2">
                  <span>{currentDriver.name}</span>
                  {isProvinceDriver && (
                    <span className="px-2 py-0.5 rounded-md bg-amber-400/30 text-amber-200 border border-amber-300/40 text-[10px] sm:text-[11px] font-black tracking-wider uppercase">
                      ТҮГЭЭГЧ
                    </span>
                  )}
                  <span className="text-sky-200 font-medium text-xs sm:text-sm">({currentDriver.phone || "90636371"})</span>
                </h1>

                {/* Prominent Monthly Province KM & Meal Allowance Badge (Зөвхөн IMD 8 жолоочид томилолттой үед) */}
                {isProvinceDriver && monthlyProvinceStats && monthlyProvinceStats.totalTripsCount > 0 && (
                  hasKmPin && !isKmUnlocked ? (
                    <button
                      type="button"
                      onClick={handleOpenUnlockPin}
                      title="Км мэдээлэл нууцлагдсан байна. Нууц кодоор нээх"
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-900/60 hover:bg-slate-900/80 active:scale-95 border border-amber-400/50 text-amber-200 text-xs font-bold transition-all cursor-pointer shadow-xs"
                    >
                      <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span>
                        {monthlyProvinceStats.monthNum}-р сар: <strong className="text-white font-mono tracking-wider">•••• км</strong>{" "}
                        <span className="text-[10px] text-amber-300 font-normal underline ml-1">Харах</span>
                      </span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setShowProvinceDetailModal(true)}
                      title="Энэ сард явсан аймгуудын км болон хоолны зардал дэлгэрэнгүй харах"
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-400/25 hover:bg-amber-400/35 active:scale-95 border border-amber-300/40 text-amber-100 text-xs font-bold transition-all cursor-pointer shadow-xs"
                    >
                      <MapPin className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                      <span>
                        {monthlyProvinceStats.monthNum}-р сар:{" "}
                        <strong className="text-white font-black">{monthlyProvinceStats.totalKm.toLocaleString()} км</strong>
                        {" • "}
                        <span className="text-amber-200 font-bold">{(monthlyProvinceStats.totalMonthlyMealAllowance || 0).toLocaleString()}₮</span>
                      </span>
                    </button>
                  )
                )}
              </div>

              <p className="text-xs text-sky-100/80 flex items-center gap-1.5 mt-1 flex-wrap">
                <span>Код: <strong className="text-white font-bold">{currentDriver.id}</strong></span>
                <span>•</span>
                <span className="truncate">{currentDriver.salesRep || (isProvinceDriver ? "Орон нутаг тээвэр" : "Борлуулалт")}</span>
                <span>•</span>
                <span className="text-amber-200 font-semibold truncate">
                  {currentDriver.organization || (isProvinceDriver ? "Айсмарк Дистрибьюшн ХХК" : "АЙСМАРК ТРЕЙД ХХК")}
                </span>
              </p>
            </div>

            {/* Right Action Badges & KM Privacy Controls */}
            <div className="flex flex-col sm:flex-row items-end sm:items-center gap-1.5 flex-shrink-0">
              {/* IMD Түгээгчийн Км нуух / хамгаалах товчлуур */}
              {isProvinceDriver && (
                !hasKmPin ? (
                  <button
                    type="button"
                    onClick={handleOpenSetupPin}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-400/20 hover:bg-amber-400/30 text-amber-200 border border-amber-300/40 transition-all cursor-pointer shadow-xs active:scale-95"
                    title="Өөрийн явсан км мэдээллээ бусдаас нуух 4 оронтой нууц код үүсгэх"
                  >
                    <Lock className="w-3 h-3 text-amber-300" />
                    <span>Км нуух</span>
                  </button>
                ) : !isKmUnlocked ? (
                  <button
                    type="button"
                    onClick={handleOpenUnlockPin}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black bg-amber-400 hover:bg-amber-300 text-slate-950 transition-all cursor-pointer shadow-md active:scale-95 animate-pulse"
                    title="Км мэдээлэл нууцлагдсан байна. Нууц кодоор тайлж харах"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Км харах</span>
                  </button>
                ) : (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={handleLockKm}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-500/20 hover:bg-rose-500/35 text-rose-200 border border-rose-400/40 transition-all cursor-pointer shadow-xs active:scale-95"
                      title="Км мэдээллийг шууд дахин нуух"
                    >
                      <Lock className="w-3 h-3 text-rose-300" />
                      <span>Км нуух</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleOpenChangePin}
                      className="p-1 rounded-full bg-white/10 hover:bg-white/20 text-sky-200 hover:text-white transition-all cursor-pointer"
                      title="Нууц код тохиргоо (солих / цуцлах)"
                    >
                      <KeyRound className="w-3 h-3" />
                    </button>
                  </div>
                )
              )}

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
            {isProvinceDriver && hasKmPin && !isKmUnlocked ? (
              <button
                type="button"
                onClick={handleOpenUnlockPin}
                className="font-mono font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200/80 px-2 py-0.5 rounded-md flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                title="Км мэдээлэл нууцлагдсан байна. Нууц кодоор харах"
              >
                <Lock className="w-3 h-3 text-amber-600" />
                <span>•••••• км (Нууцалсан)</span>
              </button>
            ) : (
              <span className="font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded-md">
                {telemetry.odo.toLocaleString()} км
              </span>
            )}
          </div>
        ) : null}
      </section>

      {/* 4.5 IMD Орон нутгийн томилолт & Менежерийн тооцоолол (Батлагдсан 8 жолоочийн бодит өгөгдөл) */}
      {isProvinceDriver && (
        <section id="imd-trip-assignment-card" className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl border-2 border-indigo-400/40 shadow-lg p-4 sm:p-5 mb-3.5 relative overflow-hidden">
          {/* Subtle background glow */}
          <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
          
          <div className="flex items-start justify-between gap-3 mb-4 pb-3 border-b border-indigo-800/60">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300 shadow-inner">
                <Route className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-black text-white tracking-wide">
                    Орон нутгийн томилолтын тооцоолол
                  </h2>
                  <span className="text-[10px] font-black uppercase tracking-wider bg-indigo-500/30 text-indigo-200 border border-indigo-400/30 px-2 py-0.5 rounded-md">
                    IMD Менежер
                  </span>
                </div>
              </div>
            </div>

            {imdAssignment ? (
              <span className="shrink-0 text-[11px] font-bold px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 flex items-center gap-1.5 shadow-sm">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                {imdAssignment.status || "Баталгаажсан"}
              </span>
            ) : (
              <span className="shrink-0 text-[11px] font-bold px-2.5 py-1 rounded-full bg-sky-500/20 text-sky-200 border border-sky-400/30 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-sky-400" />
                Баазад бэлэн байдалд
              </span>
            )}
          </div>

          {imdAssignment ? (
            <div className="space-y-3.5">
              {/* Route & Customer Banner */}
              <div className="bg-indigo-900/40 border border-indigo-700/50 rounded-xl p-3 sm:p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-xs text-indigo-300 font-semibold mb-1">
                    <MapPin className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span>Чиглэл, хүрэх газар:</span>
                    <strong className="text-white font-black text-sm">{imdAssignment.province} • {imdAssignment.destination}</strong>
                  </div>
                  <div className="text-xs text-indigo-200/90 flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span>Захиалга/Томилолт: <strong className="text-white font-bold">{imdAssignment.orderNo || imdAssignment.id}</strong></span>
                    <span>•</span>
                    <span>Харилцагч: <strong className="text-white font-bold">{imdAssignment.customer || "Өдөр тутмын томилолт"}</strong></span>
                    <span>•</span>
                    <span>Гарах: <strong className="text-amber-300 font-bold">{imdAssignment.departureDate}</strong></span>
                  </div>
                </div>

                {/* Quick Apply Button */}
                <button
                  type="button"
                  onClick={() => {
                    const noteText = `Томилолт: ${imdAssignment.province}, ${imdAssignment.destination} (${imdAssignment.orderNo || imdAssignment.id})`;
                    setRouteNote(noteText);
                    setSelectedZone(`${imdAssignment.province}, ${imdAssignment.destination}`);
                    if (!startOdoInput && telemetry?.odo) {
                      setStartOdoInput(String(telemetry.odo));
                    }
                    onShowToast("Томилолтын чиглэл болон бодит заалт замын хуудсанд амжилттай оруулагдлаа.", "success");
                  }}
                  className="shrink-0 px-3 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-black text-xs transition-all shadow-md active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Замын хуудсанд авах</span>
                </button>
              </div>

              {/* Privacy Banner if Locked */}
              {hasKmPin && !isKmUnlocked && (
                <div className="bg-slate-900/90 border border-amber-400/40 rounded-xl p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-md">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-amber-400/20 border border-amber-300/40 flex items-center justify-center text-amber-300 shrink-0">
                      <Lock className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-white flex items-center gap-1.5">
                        <span>Км болон тооцооллын мэдээлэл нууцлагдсан байна</span>
                      </p>
                      <p className="text-[11px] text-slate-300">
                        Таны үүсгэсэн хувийн нууц кодоор түгжигдсэн тул бусад хүн харах боломжгүй.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleOpenUnlockPin}
                    className="shrink-0 px-3.5 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 active:scale-95 text-slate-950 font-black text-xs transition-all shadow cursor-pointer flex items-center gap-1.5"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Нууц кодоор харах</span>
                  </button>
                </div>
              )}

              {/* 4 Core Calculation Cards (Manager Verified) */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {/* 1. Official Distance (Норм км) */}
                <div 
                  onClick={hasKmPin && !isKmUnlocked ? handleOpenUnlockPin : undefined}
                  className={`bg-slate-800/80 border border-slate-700/60 rounded-xl p-3 flex flex-col justify-between ${hasKmPin && !isKmUnlocked ? "cursor-pointer hover:border-amber-400/50" : ""}`}
                >
                  <div className="flex items-center justify-between text-[11px] text-slate-400 font-bold mb-1">
                    <span>Норм / Батлагдсан</span>
                    <Route className="w-3.5 h-3.5 text-sky-400" />
                  </div>
                  <div className="text-lg sm:text-xl font-black text-white font-mono">
                    {hasKmPin && !isKmUnlocked ? (
                      <span className="text-amber-300 tracking-widest">••••</span>
                    ) : (
                      (imdAssignment.actualKm || imdAssignment.roundTripKm || 0).toLocaleString()
                    )}{" "}
                    <span className="text-xs text-sky-300 font-medium">км</span>
                  </div>
                  <div className="text-[10px] text-slate-400 font-medium mt-1">
                    {hasKmPin && !isKmUnlocked ? "Нууцалсан (Дарж тайлах)" : "2 талын албан ёсны зай"}
                  </div>
                </div>

                {/* 2. Meal Allowance (Хоолны тооцоолол) */}
                <div 
                  onClick={hasKmPin && !isKmUnlocked ? handleOpenUnlockPin : undefined}
                  className={`bg-slate-800/80 border border-slate-700/60 rounded-xl p-3 flex flex-col justify-between ${hasKmPin && !isKmUnlocked ? "cursor-pointer hover:border-amber-400/50" : ""}`}
                >
                  <div className="flex items-center justify-between text-[11px] text-amber-300 font-bold mb-1">
                    <span>Хоолны зардал</span>
                    <Utensils className="w-3.5 h-3.5 text-amber-400" />
                  </div>
                  <div className="text-lg sm:text-xl font-black text-amber-300 font-mono">
                    {hasKmPin && !isKmUnlocked ? (
                      <span className="tracking-widest">••••••</span>
                    ) : (
                      (
                        imdAssignment.mealAllowance ||
                        ((imdAssignment.mealCount || 3) * 25000 * (imdAssignment.substituteDriverId ? 2 : 1))
                      ).toLocaleString()
                    )}{" "}
                    <span className="text-xs text-amber-200/80 font-medium">₮</span>
                  </div>
                  <div className="text-[10px] text-slate-300 font-medium mt-1">
                    {hasKmPin && !isKmUnlocked ? "Нууцалсан" : `${imdAssignment.mealCount || 3} удаа хоол (${imdAssignment.substituteDriverId ? "2 жолооч" : "1 жолооч"})`}
                  </div>
                </div>

                {/* 3. Fuel Standard (Шатахууны норм) */}
                <div 
                  onClick={hasKmPin && !isKmUnlocked ? handleOpenUnlockPin : undefined}
                  className={`bg-slate-800/80 border border-slate-700/60 rounded-xl p-3 flex flex-col justify-between ${hasKmPin && !isKmUnlocked ? "cursor-pointer hover:border-amber-400/50" : ""}`}
                >
                  <div className="flex items-center justify-between text-[11px] text-slate-400 font-bold mb-1">
                    <span>Норм түлш</span>
                    <Fuel className="w-3.5 h-3.5 text-emerald-400" />
                  </div>
                  <div className="text-lg sm:text-xl font-black text-emerald-400 font-mono">
                    {hasKmPin && !isKmUnlocked ? (
                      <span className="tracking-widest">•••</span>
                    ) : (
                      Math.round(((imdAssignment.actualKm || imdAssignment.roundTripKm || 0) / 100) * 22)
                    )}{" "}
                    <span className="text-xs text-emerald-200/80 font-medium">л</span>
                  </div>
                  <div className="text-[10px] text-slate-400 font-medium mt-1">
                    {hasKmPin && !isKmUnlocked ? "Нууцалсан" : "Норм 22л/100км (Isuzu)"}
                  </div>
                </div>

                {/* 4. Real GPS Odometer (Бодит одометр) */}
                <div 
                  onClick={hasKmPin && !isKmUnlocked ? handleOpenUnlockPin : undefined}
                  className={`bg-slate-800/80 border border-slate-700/60 rounded-xl p-3 flex flex-col justify-between ${hasKmPin && !isKmUnlocked ? "cursor-pointer hover:border-amber-400/50" : ""}`}
                >
                  <div className="flex items-center justify-between text-[11px] text-cyan-300 font-bold mb-1">
                    <span>Бодит GPS Одо</span>
                    <Gauge className="w-3.5 h-3.5 text-cyan-400" />
                  </div>
                  <div className="text-lg sm:text-xl font-black text-cyan-300 font-mono">
                    {hasKmPin && !isKmUnlocked ? (
                      <span className="tracking-widest">••••••</span>
                    ) : telemetry?.odo ? (
                      telemetry.odo.toLocaleString()
                    ) : currentDriver.apiOdo ? (
                      currentDriver.apiOdo.toLocaleString()
                    ) : (
                      "—"
                    )}{" "}
                    <span className="text-xs text-cyan-200/80 font-medium">км</span>
                  </div>
                  <div className="text-[10px] text-emerald-300 font-bold mt-1 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    {hasKmPin && !isKmUnlocked ? "Нууцалсан" : "GPSBox бодит заалт"}
                  </div>
                </div>
              </div>

              {/* Assignment Team & Rules Note */}
              <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3 text-xs text-slate-300 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1">
                    <UserCheck className="w-3.5 h-3.5 text-indigo-400" />
                    Үндсэн жолооч: <strong className="text-white font-bold">{imdAssignment.primaryDriverName}</strong>
                  </span>
                  {imdAssignment.substituteDriverName && (
                    <span className="flex items-center gap-1">
                      <Users className="w-3.5 h-3.5 text-amber-400" />
                      Сэлгээ жолооч: <strong className="text-amber-200 font-bold">{imdAssignment.substituteDriverName}</strong>
                    </span>
                  )}
                  {imdAssignment.quantity ? (
                    <span className="flex items-center gap-1">
                      <Package className="w-3.5 h-3.5 text-sky-400" />
                      Ачаа: <strong className="text-white font-bold">{imdAssignment.quantity.toLocaleString()} хайрцаг</strong>
                    </span>
                  ) : null}
                </div>

                <div className="text-[11px] text-amber-200/90 font-medium bg-amber-500/10 border border-amber-400/20 px-2.5 py-1 rounded-lg">
                  💡 Дүрэм: 2 жолооч явахад хоолны нийт мөнгийг <strong>ҮНДСЭН ЖОЛООЧИД</strong> олгоно.
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-slate-950/40 border border-slate-800/80 rounded-xl p-3.5 text-center flex flex-col sm:flex-row items-center justify-center gap-2">
              <div className="flex items-center gap-2 text-slate-300">
                <Truck className="w-4 h-4 text-slate-400 shrink-0" />
                <p className="text-xs font-semibold">
                  <span className="font-bold text-amber-300">{selectedDate}</span> өдөрт төлөвлөсөн томилолт байхгүй байна (Баазад бэлэн байдалд).
                </p>
              </div>
              {monthlyProvinceStats && monthlyProvinceStats.totalTripsCount > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    if (hasKmPin && !isKmUnlocked) {
                      handleOpenUnlockPin();
                    } else {
                      setShowProvinceDetailModal(true);
                    }
                  }}
                  className="text-xs text-indigo-300 hover:text-indigo-200 underline cursor-pointer font-medium ml-1"
                >
                  Сарын өмнөх томилолтын түүх харах ({monthlyProvinceStats.totalTripsCount})
                </button>
              )}
            </div>
          )}
        </section>
      )}

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

          <div 
            onClick={isProvinceDriver && hasKmPin && !isKmUnlocked ? handleOpenUnlockPin : undefined}
            className={`bg-slate-50 rounded-xl p-3.5 border border-slate-200/80 mb-4 grid grid-cols-3 gap-2 text-left ${isProvinceDriver && hasKmPin && !isKmUnlocked ? "cursor-pointer hover:border-amber-400" : ""}`}
          >
            <div>
              <span className="text-[10px] text-slate-500 font-bold block uppercase">Эхлэх</span>
              <span className="text-xs sm:text-sm font-black text-slate-800 font-mono">
                {isProvinceDriver && hasKmPin && !isKmUnlocked ? "•••••• км" : `${tripStatus.startOdo.toLocaleString()} км`}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 font-bold block uppercase">Төгсгөх</span>
              <span className="text-xs sm:text-sm font-black text-slate-800 font-mono">
                {isProvinceDriver && hasKmPin && !isKmUnlocked ? "•••••• км" : `${tripStatus.endOdo?.toLocaleString()} км`}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-emerald-600 font-bold block uppercase">Нийт км</span>
              <span className="text-xs sm:text-sm font-black text-emerald-700 font-mono">
                {isProvinceDriver && hasKmPin && !isKmUnlocked ? "•••• км" : `${tripStatus.totalKm || (tripStatus.endOdo ? tripStatus.endOdo - tripStatus.startOdo : 0)} км`}
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-2.5">
            <button
              id="start-next-trip-btn"
              onClick={handleOpenNextTrip}
              className="w-full h-12 rounded-xl font-black text-xs sm:text-sm text-white bg-gradient-to-r from-[#0878bd] to-sky-700 hover:from-[#076ba8] hover:to-sky-800 active:scale-[0.99] transition-all shadow-md shadow-sky-900/15 flex items-center justify-center gap-2 cursor-pointer"
            >
              <Route className="w-4 h-4" />
              <span>Дараагийн томилолтыг хүлээж авах</span>
            </button>

            <button
              onClick={() => onOpenVehicleSheet(currentDriver.vehicle)}
              className="w-full h-10 px-4 rounded-xl text-xs font-black text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <FileText className="w-4 h-4 text-[#0878bd]" />
              <span>Сарын замын хуудас харах / хэвлэх (Хавсралт №12)</span>
            </button>
          </div>
        </section>
      )}

      {/* Хамгийн доорх байгууллагын нэр (Бүдэг) */}
      <div className="pt-4 pb-2 text-center border-t border-slate-200/40 mt-3">
        <p className="text-[11px] font-semibold text-slate-400/50 tracking-widest uppercase">
          АВТО ТЭЭВЭР, ТҮГЭЭЛТИЙН АЛБА
        </p>
      </div>

      {/* Monthly Traveled Provinces & KM Modal (Зөвхөн IMD 8 жолоочид) */}
      {isProvinceDriver && showProvinceDetailModal && monthlyProvinceStats && (
        <div className="fixed inset-0 z-50 bg-[#0c1f2e]/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-xl p-5 sm:p-6 text-left relative overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-start justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-[#0878bd] to-sky-400 text-white flex items-center justify-center shadow-md shadow-sky-900/15">
                  <Route className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-[#123047]">
                    {monthlyProvinceStats.monthName} аймгийн томилолтын тайлан
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {monthlyProvinceStats.driverName} (Код: {monthlyProvinceStats.driverCode}) • Машин: {monthlyProvinceStats.vehiclePlate}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowProvinceDetailModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* KPI Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 my-4">
              <div className="bg-amber-50/80 border border-amber-200/80 rounded-2xl p-2.5 sm:p-3 text-center">
                <span className="text-[10px] sm:text-[11px] font-bold text-amber-800 uppercase tracking-wider block">
                  Нийт явсан км
                </span>
                <span className="text-lg sm:text-2xl font-black text-amber-900 font-mono mt-0.5 block">
                  {monthlyProvinceStats.totalKm.toLocaleString()}
                  <span className="text-xs font-semibold text-amber-700 ml-0.5">км</span>
                </span>
              </div>

              <div className="bg-orange-50/90 border border-orange-200/90 rounded-2xl p-2.5 sm:p-3 text-center">
                <span className="text-[10px] sm:text-[11px] font-bold text-orange-900 uppercase tracking-wider block">
                  Хоолны мөнгө
                </span>
                <span className="text-lg sm:text-2xl font-black text-orange-950 font-mono mt-0.5 block">
                  {(monthlyProvinceStats.totalMonthlyMealAllowance || 0).toLocaleString()}
                  <span className="text-xs font-semibold text-orange-800 ml-0.5">₮</span>
                </span>
              </div>

              <div className="bg-sky-50/80 border border-sky-200/80 rounded-2xl p-2.5 sm:p-3 text-center">
                <span className="text-[10px] sm:text-[11px] font-bold text-sky-800 uppercase tracking-wider block">
                  Аяллын тоо
                </span>
                <span className="text-lg sm:text-2xl font-black text-sky-900 font-mono mt-0.5 block">
                  {monthlyProvinceStats.totalTripsCount}
                  <span className="text-xs font-semibold text-sky-700 ml-0.5">удаа</span>
                </span>
              </div>

              <div className="bg-emerald-50/80 border border-emerald-200/80 rounded-2xl p-2.5 sm:p-3 text-center">
                <span className="text-[10px] sm:text-[11px] font-bold text-emerald-800 uppercase tracking-wider block">
                  Явсан аймаг
                </span>
                <span className="text-lg sm:text-2xl font-black text-emerald-900 font-mono mt-0.5 block">
                  {monthlyProvinceStats.provincesCount}
                  <span className="text-xs font-semibold text-emerald-700 ml-0.5">аймаг</span>
                </span>
              </div>
            </div>

            {/* Visited Provinces Badges */}
            {monthlyProvinceStats.provincesList.length > 0 && (
              <div className="mb-3.5 p-2.5 bg-slate-50 border border-slate-200/70 rounded-xl">
                <span className="text-xs font-bold text-slate-700 block mb-1.5">
                  Хамрагдсан аймгууд:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {monthlyProvinceStats.provincesList.map((p, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-white border border-slate-200 text-slate-800 shadow-2xs"
                    >
                      <MapPin className="w-3 h-3 text-amber-500" />
                      {p}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Detailed Trip Logs Table */}
            <div className="mb-4">
              <h4 className="text-xs font-bold text-slate-700 mb-2 flex items-center justify-between">
                <span>Томилолт, км болон хоолны зардлын нарийвчилсан жагсаалт:</span>
                <span className="text-slate-400 font-normal">{monthlyProvinceStats.trips.length} бичилт</span>
              </h4>

              <div className="max-h-64 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50/50">
                {monthlyProvinceStats.trips.length === 0 ? (
                  <div className="p-6 text-center text-slate-400 text-xs">
                    Энэ сард бүртгэгдсэн аймгийн томилолтын бичилт байхгүй байна.
                  </div>
                ) : (
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-100 text-slate-600 sticky top-0 border-b border-slate-200 font-bold">
                      <tr>
                        <th className="p-2.5 pl-3">Огноо</th>
                        <th className="p-2.5">Аймаг / Чиглэл</th>
                        <th className="p-2.5 text-right">Км</th>
                        <th className="p-2.5 text-right">Хоолны зардал (₮)</th>
                        <th className="p-2.5 text-center">Төлөв</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {monthlyProvinceStats.trips.map((t, idx) => (
                        <tr key={t.id || idx} className="hover:bg-slate-50 transition-colors">
                          <td className="p-2.5 pl-3 font-mono font-medium text-slate-700 whitespace-nowrap">
                            {t.date}
                          </td>
                          <td className="p-2.5 font-semibold text-[#123047]">
                            <div className="flex items-center gap-1">
                              <MapPin className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                              <span>{t.province}</span>
                            </div>
                            {t.destination && t.destination !== t.province && (
                              <span className="text-[11px] text-slate-400 block font-normal">
                                {t.destination}
                              </span>
                            )}
                          </td>
                          <td className="p-2.5 text-right font-mono font-black text-[#0878bd] whitespace-nowrap">
                            {t.km.toLocaleString()} км
                          </td>
                          <td className="p-2.5 text-right whitespace-nowrap">
                            <div className="font-mono font-black text-amber-950">
                              {(t.driverReceivedMealAllowance || 0).toLocaleString()} ₮
                            </div>
                            <span className="text-[10px] text-slate-500 block">
                              {t.driverCount === 2 ? (
                                t.isPrimary ? (
                                  <span className="text-emerald-700 font-bold">Үндсэн (2 жолооч)</span>
                                ) : (
                                  <span className="text-slate-400">Сэлгээ (0₮)</span>
                                )
                              ) : (
                                <span>Үндсэн (1 жолооч)</span>
                              )}
                            </span>
                          </td>
                          <td className="p-2.5 text-center whitespace-nowrap">
                            <span className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-bold ${
                              t.status === "Дууссан" 
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200" 
                                : "bg-sky-50 text-sky-700 border border-sky-200"
                            }`}>
                              {t.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs text-slate-500 flex items-center gap-3">
                <span>Нийт км: <strong className="text-slate-800 font-bold font-mono">{monthlyProvinceStats.totalKm.toLocaleString()} км</strong></span>
                <span>•</span>
                <span>Нийт хоолны мөнгө: <strong className="text-amber-900 font-bold font-mono">{(monthlyProvinceStats.totalMonthlyMealAllowance || 0).toLocaleString()} ₮</strong></span>
              </div>
              <button
                type="button"
                onClick={() => setShowProvinceDetailModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-[#0878bd] hover:bg-[#076aa8] transition-colors cursor-pointer shadow-sm"
              >
                Хаах
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 8. KM Privacy Pin Protection Modal (IMD Түгээгчийн явсан км нуух, нууц үг тохируулах/шалгах) */}
      {kmPinModalMode && (
        <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="px-5 py-4 bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-400/20 border border-amber-300/40 flex items-center justify-center text-amber-300 shadow-inner">
                  {kmPinModalMode === "setup" ? (
                    <Lock className="w-5 h-5" />
                  ) : kmPinModalMode === "unlock" ? (
                    <KeyRound className="w-5 h-5" />
                  ) : (
                    <ShieldCheck className="w-5 h-5" />
                  )}
                </div>
                <div>
                  <h3 className="text-sm font-black tracking-tight text-white">
                    {kmPinModalMode === "setup" && "Км нуух нууц код зохиох"}
                    {kmPinModalMode === "unlock" && "Км мэдээлэл харах (Тайлах)"}
                    {kmPinModalMode === "change" && "Км нууц код удирдах"}
                  </h3>
                  <p className="text-[11px] text-slate-300 font-medium">
                    Түгээгч: <span className="text-amber-300 font-bold">{currentDriver.name}</span> ({currentDriver.id})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setKmPinModalMode(null)}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 space-y-4">
              {pinError && (
                <div className="bg-rose-50 border border-rose-200 text-rose-700 px-3.5 py-2.5 rounded-xl text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>{pinError}</span>
                </div>
              )}

              {/* Mode: SETUP */}
              {kmPinModalMode === "setup" && (
                <form onSubmit={handleSaveNewPin} className="space-y-4">
                  <div className="bg-amber-50/80 border border-amber-200/80 rounded-2xl p-3 text-xs text-amber-900 leading-relaxed">
                    <p className="font-bold flex items-center gap-1.5 mb-1">
                      <Lock className="w-3.5 h-3.5 text-amber-600" />
                      <span>Хувийн нууцлалын тохиргоо</span>
                    </p>
                    Та өөрийн явсан километр, одометр болон хоолны тооцооллын мэдээллийг зөвхөн өөрөө харахын тулд доод тал нь 4 оронтой нууц код зохионо уу.
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Шинэ нууц код зохиох:
                    </label>
                    <div className="relative">
                      <input
                        type={showPinChars ? "text" : "password"}
                        maxLength={8}
                        value={pinInput}
                        onChange={(e) => setPinInput(e.target.value)}
                        placeholder="Жишээ нь: 1234"
                        autoFocus
                        required
                        className="w-full px-3.5 py-2.5 pr-10 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 font-mono text-base font-bold tracking-widest text-slate-900"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPinChars(!showPinChars)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        {showPinChars ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Нууц кодыг давтан оруулах:
                    </label>
                    <input
                      type={showPinChars ? "text" : "password"}
                      maxLength={8}
                      value={pinConfirmInput}
                      onChange={(e) => setPinConfirmInput(e.target.value)}
                      placeholder="Нууц кодоо давтана уу"
                      required
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 font-mono text-base font-bold tracking-widest text-slate-900"
                    />
                  </div>

                  <div className="pt-2 flex items-center justify-end gap-2.5">
                    <button
                      type="button"
                      onClick={() => setKmPinModalMode(null)}
                      className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
                    >
                      Болих
                    </button>
                    <button
                      type="submit"
                      disabled={isSavingPin}
                      className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 active:scale-95 text-slate-950 font-black text-xs transition-all shadow-md cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                    >
                      {isSavingPin ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Хадгалж байна...</span>
                        </>
                      ) : (
                        <>
                          <Lock className="w-3.5 h-3.5" />
                          <span>Хадгалах ба КМ-ийг нуух</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}

              {/* Mode: UNLOCK */}
              {kmPinModalMode === "unlock" && (
                <form onSubmit={handleVerifyUnlockPin} className="space-y-4">
                  <div className="bg-sky-50/80 border border-sky-200/80 rounded-2xl p-3 text-xs text-sky-900 leading-relaxed">
                    <p className="font-bold flex items-center gap-1.5 mb-1">
                      <KeyRound className="w-3.5 h-3.5 text-sky-600" />
                      <span>Км мэдээлэл хамгаалагдсан байна</span>
                    </p>
                    Өөрийн үүсгэсэн нууц кодоо оруулж км-ийн бодит заалт болон тооцооллуудыг харна уу.
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Таны нууц код:
                    </label>
                    <div className="relative">
                      <input
                        type={showPinChars ? "text" : "password"}
                        maxLength={8}
                        value={pinInput}
                        onChange={(e) => setPinInput(e.target.value)}
                        placeholder="Нууц кодоо оруулна уу"
                        autoFocus
                        required
                        className="w-full px-3.5 py-2.5 pr-10 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#0878bd]/20 focus:border-[#0878bd] font-mono text-base font-bold tracking-widest text-slate-900"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPinChars(!showPinChars)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        {showPinChars ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="pt-2 flex items-center justify-between gap-2.5">
                    <button
                      type="button"
                      onClick={() => {
                        handleOpenChangePin();
                      }}
                      className="text-[11px] font-semibold text-slate-500 hover:text-slate-800 underline cursor-pointer"
                    >
                      Кодоо солих / цуцлах
                    </button>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setKmPinModalMode(null)}
                        className="px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
                      >
                        Болих
                      </button>
                      <button
                        type="submit"
                        disabled={isSavingPin}
                        className="px-5 py-2 rounded-xl bg-[#0878bd] hover:bg-[#076aa8] active:scale-95 text-white font-black text-xs transition-all shadow-md cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                      >
                        {isSavingPin ? (
                          <>
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            <span>Шалгаж байна...</span>
                          </>
                        ) : (
                          <>
                            <Unlock className="w-3.5 h-3.5" />
                            <span>Нээх / Харах</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </form>
              )}

              {/* Mode: CHANGE / REMOVE */}
              {kmPinModalMode === "change" && (
                <div className="space-y-4">
                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 text-xs text-slate-700 leading-relaxed">
                    <p className="font-bold flex items-center gap-1.5 mb-1 text-slate-900">
                      <KeyRound className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Нууц код шинэчлэх эсвэл цуцлах</span>
                    </p>
                    Одоогийн нууц кодоо оруулж шинэ кодоор солих эсвэл нууцлалыг бүрэн цуцлах боломжтой.
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Одоогийн нууц код:
                    </label>
                    <input
                      type="password"
                      maxLength={8}
                      value={currentPinInput}
                      onChange={(e) => setCurrentPinInput(e.target.value)}
                      placeholder="Одоогийн кодоо оруулна уу"
                      autoFocus
                      required
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-mono text-sm font-bold tracking-widest text-slate-900"
                    />
                  </div>

                  <div className="border-t border-slate-100 pt-3 space-y-3">
                    <p className="text-xs font-bold text-slate-800">Шинэ нууц кодоор солих (Заавал биш):</p>
                    <input
                      type="password"
                      maxLength={8}
                      value={pinInput}
                      onChange={(e) => setPinInput(e.target.value)}
                      placeholder="Шинэ нууц код"
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-mono text-sm font-bold tracking-widest text-slate-900"
                    />
                    <input
                      type="password"
                      maxLength={8}
                      value={pinConfirmInput}
                      onChange={(e) => setPinConfirmInput(e.target.value)}
                      placeholder="Шинэ нууц код давтах"
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-mono text-sm font-bold tracking-widest text-slate-900"
                    />
                  </div>

                  <div className="pt-2 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100">
                    <button
                      type="button"
                      disabled={isSavingPin || !currentPinInput}
                      onClick={() => handleRemoveOrChangePin("remove")}
                      className="px-3 py-2 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-50 border border-rose-200 transition-colors cursor-pointer disabled:opacity-40"
                    >
                      Нууцлалыг цуцлах
                    </button>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setKmPinModalMode(null)}
                        className="px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
                      >
                        Болих
                      </button>
                      <button
                        type="button"
                        disabled={isSavingPin || !currentPinInput || !pinInput}
                        onClick={() => handleRemoveOrChangePin("change")}
                        className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-black text-xs transition-all shadow-md cursor-pointer disabled:opacity-40"
                      >
                        Шинэчлэх
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
