import React, { useState } from "react";
import { Database, Download, Upload, ShieldCheck, CheckCircle2, RefreshCw, X, AlertTriangle } from "lucide-react";
import { API } from "../services/api";

interface DatabaseBackupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (msg: string) => void;
  appData?: any;
}

export const DatabaseBackupModal: React.FC<DatabaseBackupModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  appData,
}) => {
  const [downloading, setDownloading] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [restoreStats, setRestoreStats] = useState<any>(null);

  if (!isOpen) return null;

  const handleDownloadBackup = async () => {
    setDownloading(true);
    try {
      const data = await API.backupDatabase();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `fleet_backup_${new Date().toISOString().split("T")[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      onSuccess("Өгөгдлийн сангийн бүтэн нөөц амжилттай татагдлаа.");
    } catch (err: any) {
      alert("Нөөц татахад алдаа гарлаа: " + err.message);
    } finally {
      setDownloading(false);
    }
  };

  const handleFileRestore = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);

        if (!parsed.drivers && !parsed.trips) {
          throw new Error("Файлын бүтэц буруу байна. fleet_backup_*.json файл сонгоно уу.");
        }

        setRestoring(true);
        const res = await API.restoreDatabase(parsed);
        setRestoreStats(res.stats);
        onSuccess(res.message || "Өгөгдлийн сан амжилттай сэргээгдлээ.");
      } catch (err: any) {
        alert("Сэргээхэд алдаа гарлаа: " + err.message);
      } finally {
        setRestoring(false);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
      <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-linear-to-r from-emerald-800 to-teal-700 p-6 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/15 flex items-center justify-center backdrop-blur-xs border border-white/20">
              <Database className="w-5 h-5 text-emerald-200" />
            </div>
            <div>
              <h3 className="text-lg font-black tracking-tight">Өгөгдлийн сан & Замын хуудасны хамгаалалт</h3>
              <p className="text-xs text-emerald-100 font-medium">Нөөц татах, сэргээх, түүх хадгалалт</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          {/* Security Notice */}
          <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-950 text-xs flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-sm text-emerald-950">Давхар түвшний хамгаалалт (Dual-Layer Sync)</p>
              <p className="mt-0.5 text-slate-600 leading-relaxed">
                Шинээр нэмсэн жолооч болон өмнөх өдрүүдийн замын хуудас сервер дээр найдвартай хадгалагддаг. Мөн та хүссэн үедээ нөөц файлыг татаж хадгалах болон сэргээх боломжтой.
              </p>
            </div>
          </div>

          {/* Current System Stats */}
          <div className="grid grid-cols-3 gap-2.5 p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-center">
            <div>
              <span className="text-[10px] font-bold uppercase text-slate-400 block">Бүртгэлтэй жолооч</span>
              <span className="text-base font-black text-slate-800">
                {restoreStats?.totalDrivers || appData?.drivers?.length || 0}
              </span>
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase text-slate-400 block">Замын хуудас</span>
              <span className="text-base font-black text-slate-800">
                {restoreStats?.totalTrips || appData?.trips?.length || 0}
              </span>
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase text-slate-400 block">GPS өдрийн бүртгэл</span>
              <span className="text-base font-black text-slate-800">
                {restoreStats?.totalGPS || 0}
              </span>
            </div>
          </div>

          {/* Backup Action */}
          <div className="p-4 rounded-2xl border border-slate-200 hover:border-slate-300 bg-white space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-black uppercase text-slate-800">1. Нөөц өгөгдөл татах (Backup JSON)</h4>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Бүх жолооч, машин, замын хуудас, GPS км-ийг файл болгон татаж хадгалах
                </p>
              </div>
              <button
                type="button"
                onClick={handleDownloadBackup}
                disabled={downloading}
                className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm disabled:opacity-50 cursor-pointer"
              >
                {downloading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                <span>Татах</span>
              </button>
            </div>
          </div>

          {/* Restore Action */}
          <div className="p-4 rounded-2xl border border-dashed border-emerald-300 bg-emerald-50/50 space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-black uppercase text-emerald-950">2. Нөөц файлаас сэргээх (Restore)</h4>
                <p className="text-[11px] text-slate-600 mt-0.5">
                  Өмнө татсан JSON нөөц файлыг сонгож өгөгдлийг бүрэн сэргээх
                </p>
              </div>
              <label className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm cursor-pointer transition-all">
                {restoring ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                <span>Файл сонгох</span>
                <input
                  type="file"
                  accept=".json"
                  onChange={handleFileRestore}
                  disabled={restoring}
                  className="hidden"
                />
              </label>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
          >
            Хаах
          </button>
        </div>
      </div>
    </div>
  );
};
