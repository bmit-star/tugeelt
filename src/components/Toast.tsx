import React, { useEffect } from "react";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";

interface ToastProps {
  message: string;
  type?: "success" | "error" | "info";
  onClose: () => void;
}

export const Toast: React.FC<ToastProps> = ({ message, type = "success", onClose }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 3500);
    return () => clearTimeout(timer);
  }, [onClose]);

  const bgStyles = {
    success: "bg-emerald-800 text-white border-emerald-700",
    error: "bg-rose-800 text-white border-rose-700",
    info: "bg-[#123047] text-white border-slate-700"
  }[type];

  const Icon = {
    success: CheckCircle2,
    error: AlertCircle,
    info: Info
  }[type];

  return (
    <div className="fixed bottom-5 right-5 left-5 sm:left-auto sm:w-96 z-50 animate-in slide-in-from-bottom-5 duration-200">
      <div className={`p-4 rounded-2xl shadow-xl border flex items-center justify-between gap-3 ${bgStyles}`}>
        <div className="flex items-center gap-3 min-w-0">
          <Icon className="w-5 h-5 flex-shrink-0" />
          <p className="text-xs sm:text-sm font-bold truncate leading-snug">{message}</p>
        </div>
        <button onClick={onClose} className="p-1 hover:opacity-75 transition-opacity flex-shrink-0">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
