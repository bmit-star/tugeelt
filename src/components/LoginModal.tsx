import React, { useState } from "react";
import { Driver } from "../types";
import { getSeasonSchedule } from "../utils/scheduleHelper";
import { Truck, ShieldCheck, ArrowRight, Clock, AlertTriangle, KeyRound, CheckCircle2 } from "lucide-react";

interface LoginModalProps {
  drivers: Driver[];
  onSelectDriver: (driver: Driver) => void;
  onAdminLogin: () => void;
  onClose?: () => void;
  isMandatory?: boolean;
}

export const LoginModal: React.FC<LoginModalProps> = ({
  drivers,
  onSelectDriver,
  onAdminLogin,
  onClose,
  isMandatory = false
}) => {
  const [driverCode, setDriverCode] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [adminKey, setAdminKey] = useState("");

  const schedule = getSeasonSchedule();

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
      setErrorMsg("Бүсийн / Чиглэлийн кодоо оруулна уу!");
      return;
    }

    const found = drivers.find(
      (d) => normalizeId(d.id) === cleanCode || normalizeId(d.code) === cleanCode
    );

    if (found) {
      setErrorMsg("");
      onSelectDriver(found);
    } else {
      setErrorMsg(`'${driverCode}' гэсэн кодтой жолооч олдсонгүй! (Жишээ нь: M16, KA1, M24 кодоо зөв оруулна уу)`);
    }
  };

  const handleAdminSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onAdminLogin();
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#0c1f2e]/90 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-md p-6 sm:p-7 text-center relative overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Top Header Logo */}
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-[#0878bd] to-sky-400 text-white flex items-center justify-center mx-auto mb-3.5 shadow-lg shadow-sky-900/20">
          {isAdminMode ? <ShieldCheck className="w-7 h-7" /> : <Truck className="w-7 h-7" />}
        </div>

        <h2 className="text-xl font-black text-[#123047] tracking-tight">
          {isAdminMode ? "Админ удирдлагын хэсэг" : "Бүсийн код баталгаажуулах"}
        </h2>
        <p className="text-xs text-slate-500 mt-1 mb-4 leading-relaxed">
          {isAdminMode 
            ? "Парк удирдлага, GPSBox тохиргоо болон тайлан хүснэгт" 
            : "Өөрийн хариуцсан бүсийн кодоо оруулж замын хуудас, ажил үйлчилгээгээ авна уу"}
        </p>

        {/* Forms */}
        {!isAdminMode ? (
          <form onSubmit={handleDriverSubmit} className="space-y-3.5 mt-2">
            <div>
              <div className="relative">
                <input
                  id="login-driver-code-input"
                  type="text"
                  placeholder="Бүсийн код (Жишээ: M16)..."
                  value={driverCode}
                  onChange={(e) => {
                    setDriverCode(e.target.value);
                    setErrorMsg("");
                  }}
                  autoFocus
                  className="w-full h-13 px-4 text-center rounded-2xl border-2 border-slate-300 bg-slate-50 text-slate-900 text-xl font-black uppercase tracking-wider focus:bg-white focus:outline-none focus:ring-4 focus:ring-[#0878bd]/20 focus:border-[#0878bd] transition-all"
                />
              </div>

              {errorMsg && (
                <p className="text-xs font-semibold text-rose-600 mt-2 bg-rose-50 p-2.5 rounded-xl border border-rose-200 text-left">
                  ⚠️ {errorMsg}
                </p>
              )}
            </div>

            <button
              id="login-submit-btn"
              type="submit"
              className="w-full h-12 rounded-2xl bg-[#0878bd] hover:bg-[#076ba8] active:scale-[0.99] text-white text-sm sm:text-base font-black shadow-lg shadow-sky-900/20 flex items-center justify-center gap-2 transition-all"
            >
              <span>Баталгаажуулж нэвтрэх</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            {!isMandatory && onClose && (
              <div className="pt-2 text-center">
                <button
                  type="button"
                  onClick={onClose}
                  className="text-xs text-slate-500 hover:text-slate-800"
                >
                  Хаах
                </button>
              </div>
            )}
          </form>
        ) : (
          <form onSubmit={handleAdminSubmit} className="space-y-3.5">
            <div className="p-3.5 bg-sky-50 rounded-2xl border border-sky-100 text-left text-xs text-sky-900">
              <p className="font-bold mb-1">Менежер / Админ хэсэгт хандах</p>
              <p className="text-slate-600 leading-relaxed">
                Шууд хандах хаяг: <span className="font-mono font-bold text-[#0878bd]">tugeelt.ai.studio/manager</span>
              </p>
            </div>

            <button
              type="submit"
              className="w-full h-12 rounded-2xl bg-[#123047] hover:bg-[#0b2436] text-white text-sm font-black shadow-lg flex items-center justify-center gap-2 transition-all"
            >
              <ShieldCheck className="w-5 h-5 text-sky-400" />
              <span>Админ самбар луу шилжих</span>
            </button>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => setIsAdminMode(false)}
                className="text-xs font-bold text-slate-500 hover:text-[#0878bd]"
              >
                ← Буцах (Жолооч бүсийн кодоор нэвтрэх)
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
