import React, { useState } from "react";
import { Driver } from "../types";
import { Truck, ShieldCheck, ArrowRight, Lock, AlertTriangle } from "lucide-react";

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
  const isManagerView = initialMode === "manager";
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
          {isManagerView ? <ShieldCheck className="w-7 h-7" /> : <Truck className="w-7 h-7" />}
        </div>

        <h2 className="text-xl font-black text-[#123047] tracking-tight">
          {isManagerView ? "IMT LOGISTICS • Менежерийн хэсэг" : "IMT LOGISTICS • Системд нэвтрэх"}
        </h2>
        <p className="text-xs font-semibold text-[#0878bd] mt-0.5 mb-1">
          Transportation & Distribution Management System
        </p>
        <p className="text-xs text-slate-500 mb-5 leading-relaxed">
          {isManagerView
            ? "Менежерийн эрхээр нэвтрэх нууц кодыг оруулна уу"
            : "Өөрийн бүсийн кодоо (M16, KA1...) оруулан замын хуудас руу нэвтэрнэ"}
        </p>

        {/* DRIVER LOGIN FORM (Only shown in driver mode) */}
        {!isManagerView ? (
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
                  className="text-xs text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  Хаах
                </button>
              </div>
            )}
          </form>
        ) : (
          /* MANAGER LOGIN FORM (Only shown when accessed via /manager link) */
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

            {!isMandatory && onClose && (
              <div className="pt-1">
                <button
                  type="button"
                  onClick={onClose}
                  className="text-xs text-slate-400 hover:text-slate-700 cursor-pointer"
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
