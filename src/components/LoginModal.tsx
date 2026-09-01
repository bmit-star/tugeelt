import React, { useState } from "react";
import { Driver } from "../types";
import { Truck, ShieldCheck, ArrowRight, KeyRound, Lock, AlertTriangle } from "lucide-react";

const MANAGER_PASSWORD = "88051530";
const MANAGER_AUTH_KEY = "fleet_manager_authenticated_session_v1";

interface LoginModalProps {
  drivers: Driver[];
  onSelectDriver: (driver: Driver) => void;
  onAdminLogin: () => void;
  onClose?: () => void;
  isMandatory?: boolean;
  initialMode?: "driver" | "manager";
}

export const LoginModal: React.FC<LoginModalProps> = ({
  drivers,
  onSelectDriver,
  onAdminLogin,
  onClose,
  isMandatory = false,
  initialMode = "driver"
}) => {
  const [activeTab, setActiveTab] = useState<"driver" | "manager">(initialMode);
  const [driverCode, setDriverCode] = useState("");
  const [managerPassword, setManagerPassword] = useState("");
  const [driverError, setDriverError] = useState("");
  const [managerError, setManagerError] = useState("");

  const normalizeId = (str: string) => {
    if (!str) return "";
    return String(str)
      .trim()
      .toUpperCase()
      .replace(/М/g, "M")
      .replace(/К/g, "K");
  };

  const handleDriverSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = normalizeId(driverCode);
    if (!cleanCode) {
      setDriverError("Бүсийн / Чиглэлийн кодоо оруулна уу!");
      return;
    }

    const found = drivers.find(
      (d) => normalizeId(d.id) === cleanCode || normalizeId(d.code) === cleanCode
    );

    if (found) {
      setDriverError("");
      onSelectDriver(found);
    } else {
      setDriverError(`'${driverCode}' гэсэн кодтой жолооч олдсонгүй! (Жишээ нь: M16, KA1, M24 кодоо зөв оруулна уу)`);
    }
  };

  const handleManagerSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!managerPassword) {
      setManagerError("Менежерийн нэвтрэх нууц кодыг оруулна уу!");
      return;
    }

    if (managerPassword.trim() === MANAGER_PASSWORD) {
      setManagerError("");
      localStorage.setItem(MANAGER_AUTH_KEY, "true");
      onAdminLogin();
    } else {
      setManagerError("Менежерийн нэвтрэх код буруу байна!");
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#0c1f2e]/90 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-md p-6 sm:p-7 text-center relative overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Top Header Logo */}
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-[#0878bd] to-sky-400 text-white flex items-center justify-center mx-auto mb-3.5 shadow-lg shadow-sky-900/20">
          {activeTab === "manager" ? <ShieldCheck className="w-7 h-7" /> : <Truck className="w-7 h-7" />}
        </div>

        <h2 className="text-xl font-black text-[#123047] tracking-tight">
          FLEET DIGITAL • Системд нэвтрэх
        </h2>
        <p className="text-xs text-slate-500 mt-1 mb-4 leading-relaxed">
          {activeTab === "manager"
            ? "Парк удирдлага, хяналтын самбар болон нэгдсэн бүртгэл"
            : "Өөрийн бүсийн кодоо (M16, KA1...) оруулан замын хуудас руу нэвтэрнэ"}
        </p>

        {/* 2 Tabs: Driver vs Manager */}
        <div className="flex rounded-2xl bg-slate-100 p-1 mb-5 border border-slate-200">
          <button
            type="button"
            onClick={() => {
              setActiveTab("driver");
              setDriverError("");
              setManagerError("");
            }}
            className={`flex-1 py-2.5 rounded-xl text-xs sm:text-sm font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === "driver"
                ? "bg-white text-[#0878bd] shadow-sm"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <Truck className="w-4 h-4" />
            <span>Жолооч</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab("manager");
              setDriverError("");
              setManagerError("");
            }}
            className={`flex-1 py-2.5 rounded-xl text-xs sm:text-sm font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === "manager"
                ? "bg-[#123047] text-white shadow-sm"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Менежер / Админ</span>
          </button>
        </div>

        {/* TAB 1: DRIVER FORM */}
        {activeTab === "driver" ? (
          <form onSubmit={handleDriverSubmit} className="space-y-3.5">
            <div>
              <div className="relative">
                <input
                  id="login-driver-code-input"
                  type="text"
                  placeholder="Бүсийн код (Жишээ: M16)..."
                  value={driverCode}
                  onChange={(e) => {
                    setDriverCode(e.target.value);
                    setDriverError("");
                  }}
                  autoFocus
                  className="w-full h-13 px-4 text-center rounded-2xl border-2 border-slate-300 bg-slate-50 text-slate-900 text-xl font-black uppercase tracking-wider focus:bg-white focus:outline-none focus:ring-4 focus:ring-[#0878bd]/20 focus:border-[#0878bd] transition-all"
                />
              </div>

              {driverError && (
                <p className="text-xs font-semibold text-rose-600 mt-2 bg-rose-50 p-2.5 rounded-xl border border-rose-200 text-left">
                  ⚠️ {driverError}
                </p>
              )}
            </div>

            <button
              id="login-submit-btn"
              type="submit"
              className="w-full h-12 rounded-2xl bg-[#0878bd] hover:bg-[#076ba8] active:scale-[0.99] text-white text-sm sm:text-base font-black shadow-lg shadow-sky-900/20 flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <span>Жолоочоор нэвтрэх</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <div className="pt-1 flex items-center justify-center gap-2 text-[11px] text-slate-500 font-medium">
              <span className="flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                Замын хуудас
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Truck className="w-3.5 h-3.5 text-[#0878bd]" />
                GPS Телематик
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                Торгуулийн мэдээлэл
              </span>
            </div>

            {!isMandatory && onClose && (
              <div className="pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="text-xs text-slate-400 hover:text-slate-700"
                >
                  Хаах
                </button>
              </div>
            )}
          </form>
        ) : (
          /* TAB 2: MANAGER FORM */
          <form onSubmit={handleManagerSubmit} className="space-y-3.5">
            <div>
              <div className="relative">
                <Lock className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                <input
                  id="login-manager-code-input"
                  type="password"
                  placeholder="Менежерийн нэвтрэх код..."
                  value={managerPassword}
                  onChange={(e) => {
                    setManagerPassword(e.target.value);
                    setManagerError("");
                  }}
                  autoFocus
                  className="w-full h-13 pl-12 pr-4 text-center rounded-2xl border-2 border-slate-300 bg-slate-50 text-slate-900 text-lg font-black tracking-widest focus:bg-white focus:outline-none focus:ring-4 focus:ring-[#123047]/20 focus:border-[#123047] transition-all"
                />
              </div>

              {managerError && (
                <p className="text-xs font-semibold text-rose-600 mt-2 bg-rose-50 p-2.5 rounded-xl border border-rose-200 text-left">
                  ⚠️ {managerError}
                </p>
              )}
            </div>

            <button
              id="login-manager-submit-btn"
              type="submit"
              className="w-full h-12 rounded-2xl bg-[#123047] hover:bg-[#0b2436] active:scale-[0.99] text-white text-sm sm:text-base font-black shadow-lg shadow-slate-950/20 flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <ShieldCheck className="w-5 h-5 text-sky-400" />
              <span>Менежерээр нэвтрэх</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 text-left text-xs text-slate-600">
              <span className="font-bold text-slate-800">Шууд хандах хаяг: </span>
              <span className="font-mono font-bold text-[#0878bd]">tugeelt.site/manager</span>
            </div>

            {!isMandatory && onClose && (
              <div className="pt-1">
                <button
                  type="button"
                  onClick={onClose}
                  className="text-xs text-slate-400 hover:text-slate-700"
                >
                  Хаах
                </button>
              </div>
            )}
          </form>
        )}
      </div>
    </div>
  );
};
