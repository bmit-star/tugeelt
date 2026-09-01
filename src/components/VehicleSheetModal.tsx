import React, { useState, useEffect } from "react";
import { VehicleSheetData } from "../types";
import { API } from "../services/api";
import { WaybillPrintTemplate } from "./WaybillPrintTemplate";
import { 
  X, 
  Printer, 
  Download, 
  Calendar, 
  RefreshCw,
  CheckCircle2
} from "lucide-react";

interface VehicleSheetModalProps {
  vehicleNumber: string;
  onClose: () => void;
  onShowToast: (msg: string, type?: "success" | "error" | "info") => void;
}

export const VehicleSheetModal: React.FC<VehicleSheetModalProps> = ({
  vehicleNumber,
  onClose,
  onShowToast
}) => {
  const [currentMonth, setCurrentMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [sheetData, setSheetData] = useState<VehicleSheetData | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await API.getVehicleSheet(vehicleNumber, currentMonth);
      setSheetData(data);
    } catch (err: any) {
      onShowToast("Машины замын хуудас ачаалахад алдаа гарлаа", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [vehicleNumber, currentMonth]);

  const handlePrint = () => {
    window.print();
  };

  const handleExportCSV = () => {
    if (!sheetData) return;
    const headers = [
      "№",
      "Он сар",
      "Явсан газрын нэр",
      "Ажил үүрэг",
      "Эхний км заалт",
      "Эцсийн заалт",
      "Нийт явсан км",
      "Хийсэн түлш",
      "Жолоочийн гарын үсэг",
      "Хянасан /Худалдааны төлөөлөгч/"
    ];

    const rows = sheetData.days.map((d) => [
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

    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Waybill_${vehicleNumber}_${currentMonth}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    onShowToast("Замын хуудасны CSV файл татагдлаа", "success");
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/75 backdrop-blur-xs flex items-center justify-center p-1 sm:p-4 overflow-y-auto print:p-0 print:bg-white print:static print:h-auto print:overflow-visible">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl max-h-[94vh] flex flex-col overflow-hidden print:max-h-none print:shadow-none print:border-none print:rounded-none print:w-full print:block">
        
        {/* Top Control Bar (Hidden when printing) */}
        <div className="p-3.5 sm:p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between flex-shrink-0 print:hidden">
          <div className="flex items-center gap-3">
            <img 
              src="https://icemark.mn/images/logo_company-icemark.svg" 
              alt="Icemark Logo" 
              className="h-7 w-auto object-contain"
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
            <div>
              <h2 className="text-sm sm:text-base font-black text-[#123047] flex items-center gap-2">
                <span>Борлуулалтын жолоочийн замын хуудас</span>
                <span className="px-2 py-0.5 rounded bg-sky-100 text-[#0878bd] text-xs font-bold font-mono">
                  {vehicleNumber}
                </span>
                <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[11px] font-bold">
                  A4 Landscape
                </span>
              </h2>
              <p className="text-[11px] text-slate-500">
                Маягтын индекс: BS/C-03-25/ATD-13 (Хувилбар: 2)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 bg-white border border-slate-300 rounded-lg px-2.5 py-1">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <input
                type="month"
                value={currentMonth}
                onChange={(e) => setCurrentMonth(e.target.value)}
                className="text-xs sm:text-sm font-bold bg-transparent text-slate-800 focus:outline-none cursor-pointer"
              />
            </div>

            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0878bd] hover:bg-[#076ba8] text-white text-xs font-black transition-all shadow-sm active:scale-95"
              title="Албан ёсны загвараар хэвлэх (A4 Landscape)"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Хэвлэх (A4)</span>
            </button>

            <button
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-sm active:scale-95"
              title="Excel / CSV хэлбэрээр татах"
            >
              <Download className="w-3.5 h-3.5" />
              <span>CSV Татах</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Official Waybill Form Container */}
        <div className="flex-1 overflow-auto p-3 sm:p-6 text-slate-900 bg-white print:p-0 print:overflow-visible">
          {loading ? (
            <div className="py-24 text-center flex flex-col items-center justify-center gap-3">
              <RefreshCw className="w-8 h-8 text-[#0878bd] animate-spin" />
              <p className="text-sm font-semibold text-slate-500">Замын хуудасны маягтыг бэлтгэж байна...</p>
            </div>
          ) : sheetData ? (
            <WaybillPrintTemplate sheetData={sheetData} showBorder={true} />
          ) : null}
        </div>

        {/* Modal Bottom Footer (Hidden when printing) */}
        <div className="p-3 sm:p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-500 flex-shrink-0 print:hidden">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>Телематик болон өдрийн замын хуудасны архив автоматаар нэгтгэгдсэн</span>
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

