import React, { useState, useEffect, useCallback, lazy, Suspense } from "react";
import { Driver, TripLog } from "./types";
import { API } from "./services/api";
import { DriverWaybill } from "./components/DriverWaybill";
import { LoginModal } from "./components/LoginModal";
import { Toast } from "./components/Toast";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { isIMDProvinceDriver } from "./constants/provinceRoutes";
import { 
  Truck, 
  FileSpreadsheet, 
  Smartphone, 
  LayoutDashboard,
  LogOut,
  KeyRound,
  ShieldCheck,
  Lock,
  Building2,
  BookOpen
} from "lucide-react";

// Lazy load heavy views to optimize bundle size, memory, and startup performance
const AdminDashboard = lazy(() =>
  import("./components/AdminDashboard").then((m) => ({ default: m.AdminDashboard }))
);
const IMDClientPortalView = lazy(() =>
  import("./components/imd/IMDClientPortalView").then((m) => ({ default: m.IMDClientPortalView }))
);
const IMDCustomerShareView = lazy(() =>
  import("./components/imd/IMDCustomerShareView").then((m) => ({ default: m.IMDCustomerShareView }))
);
const IMDDriverTripView = lazy(() =>
  import("./components/imd/IMDDriverTripView").then((m) => ({ default: m.IMDDriverTripView }))
);

// Lazy load heavy modals to minimize initial load time and memory usage
const RegulationModal = lazy(() =>
  import("./components/RegulationModal").then((m) => ({ default: m.RegulationModal }))
);
const VehicleSheetModal = lazy(() =>
  import("./components/VehicleSheetModal").then((m) => ({ default: m.VehicleSheetModal }))
);
const DriverManagementModal = lazy(() =>
  import("./components/DriverManagementModal").then((m) => ({ default: m.DriverManagementModal }))
);
const GoogleSheetsModal = lazy(() =>
  import("./components/GoogleSheetsModal").then((m) => ({ default: m.GoogleSheetsModal }))
);

const AUTH_STORAGE_KEY = "fleet_auth_driver_code_v2";
const MANAGER_AUTH_KEY = "fleet_manager_authenticated_session_v1";

export default function App() {
  // Check if URL is customer portal subpage: /sales, /imd, /portal, /customer, /client or ?view=sales / ?view=imd
  const isCustomerPortalPath = () => {
    if (typeof window === "undefined") return false;
    const path = window.location.pathname.toLowerCase();
    const hash = window.location.hash.toLowerCase();
    const search = window.location.search.toLowerCase();
    return (
      path.startsWith("/sales") ||
      path.startsWith("/imd") ||
      path.startsWith("/borluulalt") ||
      path.startsWith("/progress") ||
      path.startsWith("/portal") || 
      path.startsWith("/customer") || 
      path.startsWith("/client") || 
      path.includes("//imd") ||
      path.includes("/sales/imd") ||
      hash.includes("sales") ||
      hash.includes("imd") ||
      hash.includes("portal") || 
      hash.includes("customer") || 
      search.includes("view=sales") ||
      search.includes("view=imd") ||
      search.includes("tab=imd") ||
      search.includes("view=portal") || 
      search.includes("view=customer") ||
      search.includes("portal=true")
    );
  };

  // Check if URL is regulation document: /juram, /regulation or ?view=juram
  const isRegulationPath = () => {
    if (typeof window === "undefined") return false;
    const path = window.location.pathname.toLowerCase();
    const hash = window.location.hash.toLowerCase();
    const search = window.location.search.toLowerCase();
    return (
      path.startsWith("/juram") ||
      path.startsWith("/regulation") ||
      hash.includes("juram") ||
      hash.includes("regulation") ||
      search.includes("view=juram") ||
      search.includes("view=regulation") ||
      search.includes("tab=juram") ||
      search.includes("tab=regulation")
    );
  };

  // Check if initial URL path is /manager or /admin
  const isManagerPath = () => {
    if (typeof window === "undefined") return false;
    const path = window.location.pathname.toLowerCase();
    const hash = window.location.hash.toLowerCase();
    const search = window.location.search.toLowerCase();
    return (
      path.startsWith("/manager") || 
      path.startsWith("/admin") || 
      path.startsWith("/km") || 
      hash.includes("manager") || 
      hash.includes("admin") ||
      hash.includes("km") ||
      search.includes("role=manager") ||
      search.includes("role=admin") ||
      search.includes("tab=km") ||
      search.includes("view=km")
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
    if (match && match[1] && !path.startsWith("/driver/trip/")) {
      return match[1].trim().toUpperCase();
    }
    return null;
  };

  // Check if URL is public customer tracking link: /order/imd/:token
  const getIMDOrderToken = () => {
    if (typeof window === "undefined") return null;
    const path = window.location.pathname;
    const match = path.match(/^\/order\/imd\/([a-zA-Z0-9_-]+)/i);
    if (match && match[1]) return match[1];
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get("order_token") || urlParams.get("imd_order");
  };

  // Check if URL is driver mobile trip link: /driver/trip/:token
  const getIMDDriverTripToken = () => {
    if (typeof window === "undefined") return null;
    const path = window.location.pathname;
    const match = path.match(/^\/driver\/trip\/([a-zA-Z0-9_-]+)/i);
    if (match && match[1]) return match[1];
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get("trip_token") || urlParams.get("imd_trip");
  };

  const [imdOrderToken] = useState<string | null>(getIMDOrderToken());
  const [imdDriverTripToken] = useState<string | null>(getIMDDriverTripToken());
  const [isCustomerPortal, setIsCustomerPortal] = useState<boolean>(isCustomerPortalPath());

  const [currentRole, setCurrentRole] = useState<"driver" | "admin">(
    isManagerPath() ? "admin" : "driver"
  );
  
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [trips, setTrips] = useState<TripLog[]>([]);
  const [currentDriver, setCurrentDriver] = useState<Driver | null>(null);
  const [isDriverAuthenticated, setIsDriverAuthenticated] = useState<boolean>(false);
  const [isManagerLoggedIn, setIsManagerLoggedIn] = useState<boolean>(isManagerAuthenticated());
  const [loginModalMode, setLoginModalMode] = useState<"driver" | "manager">(
    isManagerPath() ? "manager" : "driver"
  );
  
  // Modals
  const [showLoginModal, setShowLoginModal] = useState<boolean>(false);
  const [showVehicleSheetModal, setShowVehicleSheetModal] = useState(false);
  const [selectedVehicleForSheet, setSelectedVehicleForSheet] = useState<string>("2611 УЕВ");
  const [showDriverManagementModal, setShowDriverManagementModal] = useState(false);
  const [selectedDriverForMgmt, setSelectedDriverForMgmt] = useState<Driver | null>(null);
  const [createDriverForMgmt, setCreateDriverForMgmt] = useState(false);
  const [showGoogleSheetsModal, setShowGoogleSheetsModal] = useState(false);
  const [showRegulationModal, setShowRegulationModal] = useState<boolean>(isRegulationPath());

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

  // Sync role with browser URL (e.g. /manager vs / vs /sales)
  const setRoleAndUrl = (role: "driver" | "admin" | "sales") => {
    if (role === "sales") {
      setIsCustomerPortal(true);
      try {
        if (window.location.pathname !== "/sales") {
          window.history.pushState(null, "", "/sales");
        }
      } catch (e) {}
      return;
    }
    setIsCustomerPortal(false);
    setCurrentRole(role);
    try {
      if (role === "admin") {
        if (window.location.pathname !== "/manager") {
          window.history.pushState(null, "", "/manager");
        }
      } else {
        if (window.location.pathname !== "/") {
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
      if (isRegulationPath()) {
        setShowRegulationModal(true);
      }
      if (isCustomerPortalPath()) {
        setIsCustomerPortal(true);
        return;
      }
      setIsCustomerPortal(false);
      if (isManagerPath()) {
        setCurrentRole("admin");
        if (!isManagerAuthenticated()) {
          setLoginModalMode("manager");
          setShowLoginModal(true);
        }
      } else {
        setCurrentRole("driver");
      }
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  // Initial Data Fetch & Authentication Restore
  const loadDriversAndInit = async () => {
    let driversList: Driver[] = [];
    try {
      const data = await API.getAppData();
      driversList = data.drivers || [];
      setDrivers(driversList);
      if (driversList.length > 0) {
        localStorage.setItem("fleet_drivers_cache", JSON.stringify(driversList));
      }
      
      // Dual-Layer Persistence: protect user-added drivers across republish
      try {
        const customDrivers = (driversList || []).filter((d: any) => d.isCustom);
        if (customDrivers.length > 0) {
          localStorage.setItem("fleet_custom_drivers_backup", JSON.stringify(customDrivers));
        } else {
          const savedBackup = localStorage.getItem("fleet_custom_drivers_backup");
          if (savedBackup) {
            const parsed = JSON.parse(savedBackup);
            if (Array.isArray(parsed) && parsed.length > 0) {
              for (const cd of parsed) {
                if (!driversList.some(d => d.id.toUpperCase() === cd.id.toUpperCase())) {
                  API.saveDriver(cd).catch(() => {});
                }
              }
            }
          }
        }
      } catch (e) {
        // Safe failover
      }

      const tripData = await API.getTrips().catch(() => ({ trips: [] }));
      setTrips(tripData.trips || []);

      const inManager = isManagerPath();

      if (inManager) {
        setCurrentRole("admin");
        if (isManagerAuthenticated()) {
          setIsManagerLoggedIn(true);
          setShowLoginModal(false);
        } else {
          setLoginModalMode("manager");
          setShowLoginModal(true);
        }
        return;
      }

      // Check URL parameters first (e.g. tugeelt.site/?code=M16 or tugeelt.site/driver/M16)
      const urlCode = getDriverCodeFromUrl();
      const savedCode = urlCode || localStorage.getItem(AUTH_STORAGE_KEY);

      if (savedCode && driversList.length > 0) {
        const cleanSaved = savedCode.trim().toUpperCase();
        const found = driversList.find(
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

      // If driver not authenticated
      setLoginModalMode("driver");
      setShowLoginModal(true);
      setIsDriverAuthenticated(false);
    } catch (err: any) {
      console.warn("Failed to load initial drivers from API, recovering from cache:", err);
      const cached = localStorage.getItem("fleet_drivers_cache");
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setDrivers(parsed);
            driversList = parsed;
          }
        } catch (e) {}
      }
      // Retry once in background
      setTimeout(() => {
        API.getAppData()
          .then((d) => {
            if (d.drivers && d.drivers.length > 0) {
              setDrivers(d.drivers);
              localStorage.setItem("fleet_drivers_cache", JSON.stringify(d.drivers));
            }
          })
          .catch(() => {});
      }, 1500);
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
    setLoginModalMode("driver");
    setShowLoginModal(true);
    showToast("Бүртгэлээс гарлаа. Өөр бүсийн кодоор нэвтэрнэ үү.", "info");
  };

  const handleOpenVehicleSheet = (vehNumber: string) => {
    setSelectedVehicleForSheet(vehNumber || currentDriver?.vehicle || "2611 УЕВ");
    setShowVehicleSheetModal(true);
  };

  const handleCloseRegulation = () => {
    setShowRegulationModal(false);
    if (isRegulationPath()) {
      try {
        window.history.pushState(null, "", currentRole === "admin" ? "/manager" : "/");
      } catch (e) {}
    }
  };

  // Render Customer Share View directly if /order/imd/:token
  if (imdOrderToken) {
    return (
      <ErrorBoundary>
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-slate-500">Уншиж байна...</div>}>
          <IMDCustomerShareView token={imdOrderToken} onBack={() => { window.location.href = "/"; }} />
        </Suspense>
      </ErrorBoundary>
    );
  }

  // Render Driver Mobile Trip View directly if /driver/trip/:token
  if (imdDriverTripToken) {
    return (
      <ErrorBoundary>
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-slate-500">Уншиж байна...</div>}>
          <IMDDriverTripView token={imdDriverTripToken} onBack={() => { window.location.href = "/"; }} />
        </Suspense>
      </ErrorBoundary>
    );
  }

  // Render Customer Portal Sub-Page: IMD Томилолт & Захиалга Удирдлагын Нэгдсэн Систем
  if (isCustomerPortal) {
    return (
      <ErrorBoundary>
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-slate-500">Портал ачааллаж байна...</div>}>
          <IMDClientPortalView
            onBack={() => {
              setRoleAndUrl("driver");
            }}
            onNavigateToManager={() => {
              setRoleAndUrl("admin");
              if (!isManagerAuthenticated()) {
                setLoginModalMode("manager");
                setShowLoginModal(true);
              }
            }}
            onNavigateToDriver={() => {
              setRoleAndUrl("driver");
            }}
            onShowToast={showToast}
            onOpenRegulation={() => setShowRegulationModal(true)}
          />
        </Suspense>
        {showRegulationModal && (
          <Suspense fallback={null}>
            <RegulationModal
              isOpen={showRegulationModal}
              onClose={handleCloseRegulation}
              currentDriver={currentDriver}
              isManager={false}
              onRequireLogin={() => {
                setLoginModalMode("driver");
                setShowLoginModal(true);
              }}
            />
          </Suspense>
        )}
        {toast && (
          <Toast
            message={toast.message}
            type={toast.type}
            onClose={() => setToast(null)}
          />
        )}
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-[#f3f6f9] text-[#17212b] font-sans antialiased flex flex-col selection:bg-sky-100">
        
        {/* Top Main Navigation Bar */}
        <nav id="header-main-nav" className="site-header navbar-container no-print bg-[#123047] text-white border-b border-[#1b4363] sticky top-0 z-40 shadow-sm">
          <div className="max-w-7xl mx-auto px-3 sm:px-6 h-15 flex items-center justify-between gap-2">
            
            {/* Logo & Brand */}
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-xl bg-white p-1 flex items-center justify-center shadow-md shadow-sky-950/30 overflow-hidden flex-shrink-0">
                <img 
                  src="https://icemark.mn/favicon.ico" 
                  alt="Icemark" 
                  className="h-7 w-7 object-contain"
                  referrerPolicy="no-referrer"
                />
              </div>
              <div>
                <div className="flex items-center gap-1.5 leading-none">
                  <span className="text-sm sm:text-base font-black tracking-tight text-white">
                    {currentDriver && isIMDProvinceDriver(currentDriver) ? "IMD LOGISTICS" : "IMT LOGISTICS"}
                  </span>
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-sky-500/20 text-sky-300 border border-sky-400/30">
                    GPSBox
                  </span>
                </div>
                <span className="text-[10px] text-sky-200/70 hidden sm:block">
                  {currentDriver && isIMDProvinceDriver(currentDriver) ? "Орон нутаг, холын тээврийн удирдлагын систем" : "Transportation & Distribution Management System"}
                </span>
              </div>
            </div>

            {/* Driver & Manager Actions */}
            <div className="flex items-center gap-2">
              {/* Driver Navbar Mode */}
              {currentRole === "driver" ? (
                isDriverAuthenticated && currentDriver ? (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleDriverLogout}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold text-sky-200 transition-all border border-white/15 cursor-pointer"
                      title="Бүсийн кодоос гарах / солих"
                    >
                      <KeyRound className="w-3.5 h-3.5 text-sky-300" />
                      <span className="px-1.5 py-0.5 rounded bg-sky-400/25 text-[10px] font-black text-white">
                        {isIMDProvinceDriver(currentDriver) ? "IMD" : "IMT"}
                      </span>
                      <span>Код: {currentDriver.code || currentDriver.id}</span>
                      <LogOut className="w-3 h-3 ml-0.5 opacity-75" />
                    </button>
                  </div>
                ) : null
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
          </div>
        </nav>

        {/* Main Content Area */}
        <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-6 print:p-0 print:max-w-none print:m-0">
          {currentRole === "driver" ? (
            isDriverAuthenticated && currentDriver ? (
              <DriverWaybill
                currentDriver={currentDriver}
                onOpenVehicleSheet={handleOpenVehicleSheet}
                onSwitchDriver={handleDriverLogout}
                onShowToast={showToast}
                onOpenRegulation={() => setShowRegulationModal(true)}
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
                  onClick={() => {
                    setLoginModalMode("driver");
                    setShowLoginModal(true);
                  }}
                  className="px-6 py-3 rounded-2xl bg-[#0878bd] hover:bg-[#076ba8] text-white font-black text-sm shadow-lg shadow-sky-900/20 cursor-pointer"
                >
                  Бүсийн код оруулах
                </button>
              </div>
            )
          ) : (
            isManagerLoggedIn || isManagerAuthenticated() ? (
              <Suspense fallback={<div className="py-24 text-center text-slate-500 font-bold">Удирдлагын хэсгийг ачааллаж байна...</div>}>
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
                  onOpenRegulation={() => setShowRegulationModal(true)}
                />
              </Suspense>
            ) : (
              <div className="max-w-md mx-auto py-16 text-center">
                <div className="w-16 h-16 rounded-3xl bg-[#123047]/10 border border-[#123047]/20 flex items-center justify-center mx-auto mb-4 text-[#123047]">
                  <Lock className="w-8 h-8" />
                </div>
                <h2 className="text-xl font-black text-[#123047]">Менежерийн удирдлагын хэсэг</h2>
                <p className="text-xs text-slate-500 mt-2 mb-6 leading-relaxed">
                  Автопарк, бүх 30 машины замын хуудас, GPSBox болон Google Sheets удирдлагын системд нэвтрэхийн тулд менежерийн нууц кодыг оруулна уу.
                </p>
                <button
                  onClick={() => {
                    setLoginModalMode("manager");
                    setShowLoginModal(true);
                  }}
                  className="px-6 py-3.5 rounded-2xl bg-[#123047] hover:bg-[#0b2436] text-white font-black text-sm shadow-lg shadow-slate-900/20 cursor-pointer transition-all active:scale-95"
                >
                  Менежерийн код оруулах
                </button>
              </div>
            )
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

        {/* Suspense wrapper for lazy modals */}
        <Suspense fallback={null}>
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

          {/* Official Regulation Document Viewer Modal */}
          {showRegulationModal && (
            <RegulationModal
              isOpen={showRegulationModal}
              onClose={handleCloseRegulation}
              currentDriver={currentDriver}
              isManager={currentRole === "admin"}
              onRequireLogin={() => {
                setLoginModalMode(currentRole === "admin" ? "manager" : "driver");
                setShowLoginModal(true);
              }}
            />
          )}
        </Suspense>

        {/* Toast Notification */}
        {toast && (
          <Toast
            message={toast.message}
            type={toast.type}
            onClose={() => setToast(null)}
          />
        )}
      </div>
    </ErrorBoundary>
  );
}

