import React, { useState, useEffect } from "react";
import { VehicleSheetData } from "../types";
import { API } from "../services/api";
import { WaybillPrintTemplate } from "./WaybillPrintTemplate";
import { 
  X, 
  Printer, 
  Download, 
  Calendar, 
  Truck, 
  CheckSquare, 
  Square, 
  RefreshCw, 
  FileSpreadsheet,
  CheckCircle2,
  SlidersHorizontal,
  Layers
} from "lucide-react";

interface BatchWaybillPrintModalProps {
  onClose: () => void;
  onShowToast: (msg: string, type?: "success" | "error" | "info") => void;
}

export const BatchWaybillPrintModal: React.FC<BatchWaybillPrintModalProps> = ({
  onClose,
  onShowToast
}) => {
  const [currentMonth, setCurrentMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [allSheets, setAllSheets] = useState<VehicleSheetData[]>([]);
  const [selectedPlates, setSelectedPlates] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [previewMode, setPreviewMode] = useState<"all" | "single">("all");
  const [activeSingleIndex, setActiveSingleIndex] = useState(0);

  const loadAllSheets = async () => {
    setLoading(true);
    try {
      const res = await API.getAllVehicleSheets(currentMonth);
      setAllSheets(res.sheets || []);
      // Select all by default
      const allPlates = new Set((res.sheets || []).map(s => s.vehicleNumber));
      setSelectedPlates(allPlates);
    } catch (err: any) {
      onShowToast("Бүх замын хуудас татахад алдаа гарлаа", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllSheets();
  }, [currentMonth]);

  const handleTogglePlate = (plate: string) => {
    const next = new Set(selectedPlates);
    if (next.has(plate)) {
      next.delete(plate);
    } else {
      next.add(plate);
    }
    setSelectedPlates(next);
  };

  const handleSelectAll = () => {
    if (selectedPlates.size === allSheets.length) {
      setSelectedPlates(new Set());
    } else {
      setSelectedPlates(new Set(allSheets.map(s => s.vehicleNumber)));
    }
  };

  const handleSelectGroup = (group: "KA" | "M") => {
    const next = new Set<string>();
    allSheets.forEach(s => {
      const code = (s as any).driverCode || s.vehicleNumber;
      if (group === "KA" && code.toUpperCase().startsWith("KA")) {
        next.add(s.vehicleNumber);
      } else if (group === "M" && !code.toUpperCase().startsWith("KA")) {
        next.add(s.vehicleNumber);
      }
    });
    setSelectedPlates(next);
  };

  const handlePrint = () => {
    if (selectedPlates.size === 0) {
      onShowToast("Хэвлэх машин сонгоогүй байна!", "error");
      return;
    }
    window.print();
  };

  const handleExportCombinedCSV = () => {
    const sheetsToExport = allSheets.filter(s => selectedPlates.has(s.vehicleNumber));
    if (sheetsToExport.length === 0) {
      onShowToast("Экспортлох машин сонгоогүй байна!", "info");
      return;
    }

    const headers = [
      "Машин",
      "Жолооч",
      "ХТ",
      "№",
      "Он сар",
      "Явсан газрын нэр",
      "Ажил үүрэг",
      "Эхний км заалт",
      "Эцсийн заалт",
      "Нийт явсан км",
      "Хийсэн түлш",
      "Жолоочийн гарын үсэг",
      "Хянасан ХТ"
    ];

    const rows: (string | number)[][] = [];

    sheetsToExport.forEach(sheet => {
      sheet.days.forEach(d => {
        rows.push([
          `"${sheet.vehicleNumber}"`,
          `"${sheet.driverName}"`,
          `"${d.salesRep || ""}"`,
          d.day,
          d.date,
          `"${d.zone || ""}"`,
          `"${d.task || ""}"`,
          d.startOdo || "",
          d.endOdo || "",
          d.totalKm || "",
          d.fuelLiters || "",
          `"${d.driverSignature || ""}"`,
          `"${d.verifierSignature || ""}"`
        ]);
      });
    });

    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `All_Waybills_${currentMonth}_${sheetsToExport.length}cars.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    onShowToast(`Нийт ${sheetsToExport.length} машины замын хуудас CSV татагдлаа`, "success");
  };

  const printableSheets = allSheets.filter(s => selectedPlates.has(s.vehicleNumber));

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-1 sm:p-4 overflow-y-auto print:p-0 print:bg-white print:static print:h-auto print:overflow-visible">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-6xl max-h-[96vh] flex flex-col overflow-hidden print:max-h-none print:shadow-none print:border-none print:rounded-none print:w-full print:block">
        
        {/* Top Control Bar (Hidden when printing) */}
        <div className="p-3.5 sm:p-5 border-b border-slate-200 bg-slate-50 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 flex-shrink-0 print:hidden">
          
          <div className="flex items-center gap-3">
            <img 
              src="https://icemark.mn/images/logo_company-icemark.svg" 
              alt="Icemark" 
              className="h-8 w-auto object-contain"
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
            <div>
              <h2 className="text-base sm:text-lg font-black text-[#123047] flex items-center gap-2">
                <span>1 Даралтаар бүх замын хуудсыг хэвлэх</span>
                <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-xs font-black">
                  A4 Хөндлөн (Landscape)
                </span>
              </h2>
              <p className="text-xs text-slate-500">
                Нийт {allSheets.length} машинаас {selectedPlates.size} машины албан ёсны замын хуудас сонгогдсон байна
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Month Picker */}
            <div className="flex items-center gap-1.5 bg-white border border-slate-300 rounded-xl px-3 py-1.5 shadow-2xs">
              <Calendar className="w-4 h-4 text-slate-400" />
              <input
                type="month"
                value={currentMonth}
                onChange={(e) => setCurrentMonth(e.target.value)}
                className="text-xs sm:text-sm font-bold bg-transparent text-slate-800 focus:outline-none cursor-pointer"
              />
            </div>

            {/* Print 1-Click Button */}
            <button
              onClick={handlePrint}
              disabled={loading || selectedPlates.size === 0}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#0878bd] hover:bg-[#076ba8] text-white text-xs sm:text-sm font-black transition-all shadow-md active:scale-95 disabled:opacity-50"
              title="Сонгосон бүх замын хуудсыг нэгэн зэрэг A4 хөндлөн форматаар хэвлэх"
            >
              <Printer className="w-4 h-4" />
              <span>Хэвлэх ({selectedPlates.size} хуудас A4)</span>
            </button>

            {/* CSV Export */}
            <button
              onClick={handleExportCombinedCSV}
              disabled={loading || selectedPlates.size === 0}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-sm disabled:opacity-50"
              title="Excel / CSV хэлбэрээр татах"
            >
              <Download className="w-3.5 h-3.5" />
              <span>CSV Татах</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Filter & Selection Bar (Hidden when printing) */}
        <div className="p-2.5 sm:px-5 border-b border-slate-200 bg-white flex flex-wrap items-center justify-between gap-2 flex-shrink-0 print:hidden text-xs">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={handleSelectAll}
              className="px-2.5 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-50 font-bold text-slate-700 flex items-center gap-1.5 transition-colors"
            >
              {selectedPlates.size === allSheets.length ? (
                <CheckSquare className="w-3.5 h-3.5 text-[#0878bd]" />
              ) : (
                <Square className="w-3.5 h-3.5 text-slate-400" />
              )}
              <span>{selectedPlates.size === allSheets.length ? "Бүгдийг болих" : `Бүгдийг сонгох (${allSheets.length})`}</span>
            </button>

            <button
              onClick={() => handleSelectGroup("KA")}
              className="px-2.5 py-1.5 rounded-lg bg-sky-50 border border-sky-200 text-[#0878bd] font-bold hover:bg-sky-100 transition-colors"
            >
              KA Бүс (5)
            </button>

            <button
              onClick={() => handleSelectGroup("M")}
              className="px-2.5 py-1.5 rounded-lg bg-sky-50 border border-sky-200 text-[#0878bd] font-bold hover:bg-sky-100 transition-colors"
            >
              M Бүс (25)
            </button>
          </div>

          {/* Quick toggle chips */}
          <div className="flex items-center gap-1 overflow-x-auto max-w-full py-1">
            {allSheets.slice(0, 10).map((s) => {
              const isChecked = selectedPlates.has(s.vehicleNumber);
              return (
                <button
                  key={s.vehicleNumber}
                  onClick={() => handleTogglePlate(s.vehicleNumber)}
                  className={`px-2 py-1 rounded-md text-[10px] font-mono font-bold transition-colors whitespace-nowrap ${
                    isChecked
                      ? "bg-[#0878bd] text-white"
                      : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                  }`}
                >
                  {(s as any).driverCode || s.vehicleNumber}
                </button>
              );
            })}
            {allSheets.length > 10 && (
              <span className="text-[10px] text-slate-400 font-bold px-1">
                +{allSheets.length - 10} бусад
              </span>
            )}
          </div>
        </div>

        {/* Printable Area */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-6 bg-slate-100/70 print:bg-white print:p-0 print:overflow-visible space-y-6 print:space-y-0">
          {loading ? (
            <div className="py-24 text-center flex flex-col items-center justify-center gap-3">
              <RefreshCw className="w-8 h-8 text-[#0878bd] animate-spin" />
              <p className="text-sm font-semibold text-slate-500">Бүх 30 машины замын хуудсыг бэлтгэж байна...</p>
            </div>
          ) : printableSheets.length === 0 ? (
            <div className="py-24 text-center text-slate-500 font-medium">
              Хэвлэх замын хуудас сонгогдоогүй байна. Дээрх товчоор сонголтоо хийнэ үү.
            </div>
          ) : (
            printableSheets.map((sheet, idx) => (
              <div key={sheet.vehicleNumber} className="relative">
                {/* Print Sheet Container with landscape page break */}
                <WaybillPrintTemplate sheetData={sheet} showBorder={true} />
                
                {/* Visual separator on screen only */}
                <div className="text-center py-1 print:hidden text-[10px] font-mono text-slate-400">
                  --- Хуудас {idx + 1} / {printableSheets.length} ({sheet.vehicleNumber} - {sheet.driverName}) ---
                </div>
              </div>
            ))
          )}
        </div>

        {/* Modal Bottom Footer (Hidden when printing) */}
        <div className="p-3 sm:p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-500 flex-shrink-0 print:hidden">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>
              <strong>{printableSheets.length}</strong> хуудас A4 Landscape горимоор хэвлэгдэхэд бэлэн байна.
            </span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-bold transition-colors"
          >
            Хаах
          </button>
        </div>
      </div>
    </div>
  );
};
