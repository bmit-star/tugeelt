import React, { useState, useEffect, useCallback } from "react";
import { Driver, TripLog } from "./types";
import { API } from "./services/api";
import { DriverWaybill } from "./components/DriverWaybill";
import { AdminDashboard } from "./components/AdminDashboard";
import { VehicleSheetModal } from "./components/VehicleSheetModal";
import { DriverManagementModal } from "./components/DriverManagementModal";
import { GoogleSheetsModal } from "./components/GoogleSheetsModal";
import { LoginModal } from "./components/LoginModal";
import { Toast } from "./components/Toast";
import { 
  Truck, 
  FileSpreadsheet, 
  Smartphone, 
  LayoutDashboard,
  LogOut,
  KeyRound,
  ShieldCheck
} from "lucide-react";

const AUTH_STORAGE_KEY = "fleet_auth_driver_code_v2";
const MANAGER_AUTH_KEY = "fleet_manager_authenticated_session_v1";

export default function App() {
  // Check if initial URL path is /manager or /admin
  const isManagerPath = () => {
    if (typeof window === "undefined") return false;
    const path = window.location.pathname.toLowerCase();
    const hash = window.location.hash.toLowerCase();
    const search = window.location.search.toLowerCase();
    return (
      path.startsWith("/manager") || 
      path.startsWith("/admin") || 
      hash.includes("manager") || 
      hash.includes("admin") ||
      search.includes("role=manager") ||
      search.includes("role=admin")
    );
  };

  // Check if manager session is authenticated
  const isManagerAuthenticated = () => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(MANAGER_AUTH_KEY) === "true";
  };

  // Get driver code from URL params (e.g. ?code=M16, ?to=M16, ?driver=M16)
  const getDriverCodeFromUrl = () => {
    if (typeof window === "undefined") return null;
    const urlParams = new URLSearchParams(window.location.search);
    const codeParam = urlParams.get("code") || urlParams.get("to") || urlParams.get("driver") || urlParams.get("id");
    if (codeParam) return codeParam.trim().toUpperCase();

    // Check path like /driver/M16
    const path = window.location.pathname;
    const match = path.match(/^\/driver\/([a-zA-Z0-9_-]+)/i);
    if (match && match[1]) {
      return match[1].trim().toUpperCase();
    }
    return null;
  };

  const [currentRole, setCurrentRole] = useState<"driver" | "admin">(
    isManagerPath() ? "admin" : "driver"
  );
  
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [trips, setTrips] = useState<TripLog[]>([]);
  const [currentDriver, setCurrentDriver] = useState<Driver | null>(null);
  const [isDriverAuthenticated, setIsDriverAuthenticated] = useState<boolean>(false);
  const [isManagerLoggedIn, setIsManagerLoggedIn] = useState<boolean>(isManagerAuthenticated());
  const [loginModalMode, setLoginModalMode] = useState<"driver" | "manager">("driver");
  
  // Modals
  const [showLoginModal, setShowLoginModal] = useState<boolean>(false);
  const [showVehicleSheetModal, setShowVehicleSheetModal] = useState(false);
  const [selectedVehicleForSheet, setSelectedVehicleForSheet] = useState<string>("2611 УЕВ");
  const [showDriverManagementModal, setShowDriverManagementModal] = useState(false);
  const [selectedDriverForMgmt, setSelectedDriverForMgmt] = useState<Driver | null>(null);
  const [createDriverForMgmt, setCreateDriverForMgmt] = useState(false);
  const [showGoogleSheetsModal, setShowGoogleSheetsModal] = useState(false);

  // Toast
  const [toast, setToast] = useState<{ message: string; type?: "success" | "error" | "info" } | null>(null);

  const showToast = (message: string, type: "success" | "error" | "info" = "success") => {
    setToast({ message, type });
  };

  const handleOpenDriverManagement = (driver?: Driver, createNew?: boolean) => {
    setSelectedDriverForMgmt(driver || null);
    setCreateDriverForMgmt(!!createNew);
    setShowDriverManagementModal(true);
  };

  // Sync role with browser URL (e.g. /manager vs /)
  const setRoleAndUrl = (role: "driver" | "admin") => {
    setCurrentRole(role);
    try {
      if (role === "admin") {
        if (window.location.pathname !== "/manager") {
          window.history.pushState(null, "", "/manager");
        }
      } else {
        if (window.location.pathname === "/manager") {
          window.history.pushState(null, "", "/");
        }
      }
    } catch (e) {
      // Ignore browser pushState restrictions if any
    }
  };

  // Listen to popstate for back/forward navigation
  useEffect(() => {
    const handlePopState = () => {
      if (isManagerPath()) {
        setCurrentRole("admin");
      } else {
        setCurrentRole("driver");
      }
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  // Initial Data Fetch & Authentication Restore
  const loadDriversAndInit = async () => {
    try {
      const data = await API.getAppData();
      setDrivers(data.drivers);
      
      const tripData = await API.getTrips().catch(() => ({ trips: [] }));
      setTrips(tripData.trips || []);

      // Check URL parameters first (e.g. tugeelt.site/?code=M16 or tugeelt.site/driver/M16)
      const urlCode = getDriverCodeFromUrl();
      const savedCode = urlCode || localStorage.getItem(AUTH_STORAGE_KEY);

      if (savedCode && data.drivers.length > 0) {
        const cleanSaved = savedCode.trim().toUpperCase();
        const found = data.drivers.find(
          (d) => d.id.toUpperCase() === cleanSaved || d.code.toUpperCase() === cleanSaved
        );
        if (found) {
          setCurrentDriver(found);
          setIsDriverAuthenticated(true);
          localStorage.setItem(AUTH_STORAGE_KEY, found.code || found.id);
          setShowLoginModal(false);
          if (urlCode) {
            showToast(`Жолооч ${found.name} (${found.code || found.id}) шууд холбогдлоо`, "success");
          }
          return;
        }
      }

      // If in manager path but not yet authenticated with password 88051530, prompt manager login
      if (isManagerPath() && !isManagerAuthenticated()) {
        setLoginModalMode("manager");
        setShowLoginModal(true);
      } else if (!savedCode && !isManagerPath()) {
        setLoginModalMode("driver");
        setShowLoginModal(true);
        setIsDriverAuthenticated(false);
      }
    } catch (err: any) {
      console.error("Failed to load initial drivers:", err);
    }
  };

  useEffect(() => {
    loadDriversAndInit();
  }, []);

  // Handle successful Driver Login / Code Verification
  const handleSelectDriver = (driver: Driver) => {
    setCurrentDriver(driver);
    setIsDriverAuthenticated(true);
    localStorage.setItem(AUTH_STORAGE_KEY, driver.code || driver.id);
    setShowLoginModal(false);
    showToast(`Жолооч ${driver.name} (${driver.code || driver.id}) амжилттай баталгаажлаа`, "success");
  };

  // Handle Driver Logout / Switch Code
  const handleDriverLogout = () => {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    setIsDriverAuthenticated(false);
    setShowLoginModal(true);
    showToast("Бүртгэлээс гарлаа. Өөр бүсийн кодоор нэвтэрнэ үү.", "info");
  };

  const handleOpenVehicleSheet = (vehNumber: string) => {
    setSelectedVehicleForSheet(vehNumber || currentDriver?.vehicle || "2611 УЕВ");
    setShowVehicleSheetModal(true);
  };

  return (
    <div className="min-h-screen bg-[#f3f6f9] text-[#17212b] font-sans antialiased flex flex-col selection:bg-sky-100">
      
      {/* Top Main Navigation Bar */}
      <nav className="bg-[#123047] text-white border-b border-[#1b4363] sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 h-15 flex items-center justify-between gap-2">
          
          {/* Logo & Brand */}
          <div className="flex items-center gap-2.5">
            <div className="h-9 px-2 rounded-xl bg-white flex items-center justify-center shadow-md shadow-sky-950/30 overflow-hidden">
              <img 
                src="https://icemark.mn/images/logo_company-icemark.svg" 
                alt="Icemark Logo" 
                className="h-6 w-auto object-contain"
                referrerPolicy="no-referrer"
              />
            </div>
            <div>
              <div className="flex items-center gap-1.5 leading-none">
                <span className="text-sm sm:text-base font-black tracking-tight text-white">
                  FLEET DIGITAL
                </span>
                <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-sky-500/20 text-sky-300 border border-sky-400/30">
                  GPSBox
                </span>
              </div>
              <span className="text-[10px] text-sky-200/70 hidden sm:block">
                Замын хуудас & Телематик удирдлагын систем
              </span>
            </div>
          </div>

          {/* Driver Navbar Mode (Clean, focused view without admin clutter) */}
          {currentRole === "driver" ? (
            <div className="flex items-center gap-2">
              {isDriverAuthenticated && currentDriver ? (
                <button
                  onClick={handleDriverLogout}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold text-sky-200 transition-all border border-white/15"
                  title="Бүсийн кодоос гарах / солих"
                >
                  <KeyRound className="w-3.5 h-3.5 text-sky-300" />
                  <span>Код: {currentDriver.code || currentDriver.id}</span>
                  <LogOut className="w-3 h-3 ml-0.5 opacity-75" />
                </button>
              ) : (
                <button
                  onClick={() => {
                    setLoginModalMode("driver");
                    setShowLoginModal(true);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-xs font-black text-slate-950 transition-all shadow-xs cursor-pointer"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>Код оруулах</span>
                </button>
              )}

              <button
                onClick={() => {
                  if (isManagerAuthenticated()) {
                    setRoleAndUrl("admin");
                  } else {
                    setLoginModalMode("manager");
                    setShowLoginModal(true);
                  }
                }}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-semibold text-slate-200 transition-all cursor-pointer"
                title="Менежер / Админ хэсэг рүү шилжих"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-sky-300" />
                <span className="hidden sm:inline">Менежер</span>
              </button>
            </div>
          ) : (
            /* Admin / Manager Mode (tugeelt.site/manager) */
            <div className="flex items-center gap-2">
              <span className="hidden md:inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-sky-500/20 text-sky-300 border border-sky-400/30">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Менежер самбар</span>
              </span>

              <button
                onClick={() => setShowGoogleSheetsModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600/90 hover:bg-emerald-500 text-xs font-bold text-white transition-all shadow-xs border border-emerald-400/30"
                title="Google Sheets-тэй холбох & синхрончлох"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-200" />
                <span>Google Sheets</span>
              </button>

              <button
                onClick={() => setRoleAndUrl("driver")}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-semibold text-slate-300 transition-all cursor-pointer"
                title="Жолоочийн замын хуудас руу шилжих"
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Жолоочийн хуудас</span>
              </button>

              <button
                onClick={() => {
                  localStorage.removeItem(MANAGER_AUTH_KEY);
                  setIsManagerLoggedIn(false);
                  setRoleAndUrl("driver");
                  showToast("Менежерийн системээс гарлаа", "info");
                }}
                className="p-1.5 rounded-xl bg-white/10 hover:bg-rose-500/30 text-slate-300 hover:text-rose-200 transition-all cursor-pointer"
                title="Менежерийн эрхээс гарах"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-6">
        {currentRole === "driver" ? (
          isDriverAuthenticated && currentDriver ? (
            <DriverWaybill
              currentDriver={currentDriver}
              onOpenVehicleSheet={handleOpenVehicleSheet}
              onSwitchDriver={handleDriverLogout}
              onShowToast={showToast}
            />
          ) : (
            <div className="max-w-md mx-auto py-12 text-center">
              <div className="w-16 h-16 rounded-3xl bg-[#0878bd]/10 border border-[#0878bd]/20 flex items-center justify-center mx-auto mb-4 text-[#0878bd]">
                <KeyRound className="w-8 h-8" />
              </div>
              <h2 className="text-xl font-black text-slate-800">Бүсийн код баталгаажуулаагүй байна</h2>
              <p className="text-xs text-slate-500 mt-2 mb-6">
                Замын хуудас бөглөх, түлшний бүртгэл болон GPSBox үйлчилгээ авахын тулд өөрийн бүсийн кодоо (M16, KA1, M24...) оруулан нэвтэрнэ үү.
              </p>
              <button
                onClick={() => setShowLoginModal(true)}
                className="px-6 py-3 rounded-2xl bg-[#0878bd] hover:bg-[#076ba8] text-white font-black text-sm shadow-lg shadow-sky-900/20"
              >
                Бүсийн код оруулах
              </button>
            </div>
          )
        ) : (
          <AdminDashboard
            drivers={drivers}
            onRefreshData={loadDriversAndInit}
            onOpenDriverWaybill={(driver) => {
              setCurrentDriver(driver);
              setIsDriverAuthenticated(true);
              localStorage.setItem(AUTH_STORAGE_KEY, driver.code || driver.id);
              setRoleAndUrl("driver");
            }}
            onOpenVehicleSheet={handleOpenVehicleSheet}
            onOpenDriverManagement={handleOpenDriverManagement}
            onOpenGoogleSheets={() => setShowGoogleSheetsModal(true)}
            onShowToast={showToast}
          />
        )}
      </main>

      {/* MODALS */}

      {/* Code Verification Modal */}
      {showLoginModal && (
        <LoginModal
          drivers={drivers}
          initialMode={loginModalMode}
          onSelectDriver={handleSelectDriver}
          onAdminLogin={() => {
            setIsManagerLoggedIn(true);
            setShowLoginModal(false);
            setRoleAndUrl("admin");
            showToast("Менежерийн удирдлагын самбарт амжилттай нэвтэрлээ", "success");
          }}
          onClose={() => {
            if (isDriverAuthenticated || (currentRole === "admin" && isManagerAuthenticated())) {
              setShowLoginModal(false);
            }
          }}
          isMandatory={(!isDriverAuthenticated && currentRole === "driver") || (!isManagerAuthenticated() && currentRole === "admin")}
        />
      )}

      {/* Vehicle Sheet Monthly Log Modal */}
      {showVehicleSheetModal && (
        <VehicleSheetModal
          vehicleNumber={selectedVehicleForSheet}
          onClose={() => setShowVehicleSheetModal(false)}
          onShowToast={showToast}
        />
      )}

      {/* Driver CRUD Management Modal */}
      {showDriverManagementModal && (
        <DriverManagementModal
          drivers={drivers}
          initialDriver={selectedDriverForMgmt}
          initialCreateNew={createDriverForMgmt}
          onClose={() => setShowDriverManagementModal(false)}
          onRefresh={loadDriversAndInit}
          onShowToast={showToast}
        />
      )}

      {/* Google Sheets Integration Modal */}
      {showGoogleSheetsModal && (
        <GoogleSheetsModal
          drivers={drivers}
          trips={trips}
          onClose={() => setShowGoogleSheetsModal(false)}
          onRefreshData={loadDriversAndInit}
          onShowToast={showToast}
        />
      )}

      {/* Toast Notification */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}
