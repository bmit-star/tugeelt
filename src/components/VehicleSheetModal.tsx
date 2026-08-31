import React, { useState, useEffect } from "react";
import { VehicleSheetData } from "../types";
import { API } from "../services/api";
import { 
  X, 
  Printer, 
  Download, 
  Calendar, 
  Truck, 
  User, 
  FileSpreadsheet, 
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
      "Хянасан/Худалдааны төлөөлөгч/"
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
    link.setAttribute("download", `Veh_${vehicleNumber}_${currentMonth}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    onShowToast("CSV файл татагдлаа", "success");
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto print:p-0 print:bg-white">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden print:max-h-none print:shadow-none print:border-none print:rounded-none">
        
        {/* Modal Top Bar */}
        <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50 flex items-center justify-between flex-shrink-0 print:hidden">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#0878bd] text-white flex items-center justify-center shadow-sm">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-[#123047]">
                Машины сар тутмын цахим дэвтэр (Veh_{vehicleNumber})
              </h2>
              <p className="text-xs text-slate-500">
                Тээврийн хэрэгслийн замын хуудасны нэгдсэн архив ба тайлан
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="month"
              value={currentMonth}
              onChange={(e) => setCurrentMonth(e.target.value)}
              className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs sm:text-sm font-bold bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0878bd]"
            />
            <button
              onClick={handlePrint}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors"
            >
              <Printer className="w-4 h-4" />
              <span>Хэвлэх</span>
            </button>
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-bold transition-colors"
            >
              <Download className="w-4 h-4" />
              <span>CSV</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable & Scrollable Content */}
        <div className="flex-1 overflow-auto p-4 sm:p-6 text-slate-800">
          {loading ? (
            <div className="py-20 text-center flex flex-col items-center justify-center gap-3">
              <RefreshCw className="w-8 h-8 text-[#0878bd] animate-spin" />
              <p className="text-sm font-semibold text-slate-500">Мэдээлэл татаж байна...</p>
            </div>
          ) : sheetData ? (
            <div className="space-y-4">
              {/* Header Info Block */}
              <div className="bg-slate-50/80 border border-slate-200 rounded-xl p-4 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div>
                  <span className="text-slate-500 font-bold block uppercase tracking-wider text-[10px]">Байгууллагын нэр:</span>
                  <span className="text-sm font-black text-slate-900">{sheetData.organization}</span>
                </div>
                <div>
                  <span className="text-slate-500 font-bold block uppercase tracking-wider text-[10px]">Тээврийн хэрэгслийн улсын дугаар:</span>
                  <span className="text-sm font-black text-[#0878bd]">{sheetData.vehicleNumber} ({sheetData.model})</span>
                </div>
                <div>
                  <span className="text-slate-500 font-bold block uppercase tracking-wider text-[10px]">Жолоочийн нэр & Утас:</span>
                  <span className="text-sm font-black text-slate-900">{sheetData.driverName} ({sheetData.driverPhone})</span>
                </div>
              </div>

              {/* Month Total Metric Summary */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="bg-sky-50 border border-sky-100 rounded-xl p-3">
                  <span className="text-[10px] text-sky-800 font-bold uppercase block">Сар:</span>
                  <span className="text-sm font-black text-sky-900">{sheetData.yearMonth}</span>
                </div>
                <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3">
                  <span className="text-[10px] text-emerald-800 font-bold uppercase block">Сарын нийт явсан км:</span>
                  <span className="text-sm font-black text-emerald-900">{sheetData.monthTotalKm.toLocaleString()} км</span>
                </div>
                <div className="bg-amber-50 border border-amber-100 rounded-xl p-3">
                  <span className="text-[10px] text-amber-800 font-bold uppercase block">Нийт хийсэн түлш:</span>
                  <span className="text-sm font-black text-amber-900">{sheetData.monthTotalFuel.toFixed(1)} л</span>
                </div>
                <div className="bg-purple-50 border border-purple-100 rounded-xl p-3">
                  <span className="text-[10px] text-purple-800 font-bold uppercase block">Бүртгэлтэй өдрүүд:</span>
                  <span className="text-sm font-black text-purple-900">
                    {sheetData.days.filter((d) => d.totalKm !== "").length} өдөр
                  </span>
                </div>
              </div>

              {/* 31-Day Official Waybill Table */}
              <div className="overflow-x-auto border border-slate-200 rounded-xl shadow-2xs">
                <table className="w-full text-left text-xs border-collapse min-w-[760px]">
                  <thead>
                    <tr className="bg-[#d9e1f2] text-[#123047] font-black border-b border-slate-300">
                      <th className="p-2 border-r border-slate-300 text-center w-8">№</th>
                      <th className="p-2 border-r border-slate-300 w-24">Он сар</th>
                      <th className="p-2 border-r border-slate-300">Явсан газрын нэр</th>
                      <th className="p-2 border-r border-slate-300">Ажил үүрэг</th>
                      <th className="p-2 border-r border-slate-300 text-right w-24">Эхний км</th>
                      <th className="p-2 border-r border-slate-300 text-right w-24">Эцсийн км</th>
                      <th className="p-2 border-r border-slate-300 text-right w-20 bg-[#c6d3e8]">Нийт км</th>
                      <th className="p-2 border-r border-slate-300 text-right w-20">Түлш (л)</th>
                      <th className="p-2 border-r border-slate-300 text-center w-28">Жолоочийн гарын үсэг</th>
                      <th className="p-2 text-center w-32">Хянасан /Төлөөлөгч/</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {sheetData.days.map((row) => (
                      <tr
                        key={row.day}
                        className={`hover:bg-slate-50 transition-colors ${
                          row.totalKm !== "" ? "bg-emerald-50/20 font-medium" : "text-slate-400"
                        }`}
                      >
                        <td className="p-1.5 border-r border-slate-200 text-center font-bold text-slate-600">
                          {row.day}
                        </td>
                        <td className="p-1.5 border-r border-slate-200 whitespace-nowrap">
                          {row.date}
                        </td>
                        <td className="p-1.5 border-r border-slate-200 truncate max-w-[140px]">
                          {row.zone || "—"}
                        </td>
                        <td className="p-1.5 border-r border-slate-200 truncate max-w-[140px]">
                          {row.task || "—"}
                        </td>
                        <td className="p-1.5 border-r border-slate-200 text-right font-mono">
                          {row.startOdo ? Number(row.startOdo).toLocaleString() : "—"}
                        </td>
                        <td className="p-1.5 border-r border-slate-200 text-right font-mono">
                          {row.endOdo ? Number(row.endOdo).toLocaleString() : "—"}
                        </td>
                        <td className="p-1.5 border-r border-slate-200 text-right font-mono font-bold text-emerald-700 bg-[#f0f4fa]">
                          {row.totalKm ? Number(row.totalKm).toLocaleString() : "—"}
                        </td>
                        <td className="p-1.5 border-r border-slate-200 text-right font-mono">
                          {row.fuelLiters ? `${row.fuelLiters} л` : "—"}
                        </td>
                        <td className="p-1.5 border-r border-slate-200 text-center text-[10px] text-slate-700">
                          {row.driverSignature ? (
                            <span className="text-emerald-700 font-bold">✓ {row.driverSignature}</span>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="p-1.5 text-center text-[10px] text-slate-700">
                          {row.verifierSignature ? (
                            <span className="text-sky-800 font-bold">✓ {row.verifierSignature}</span>
                          ) : (
                            "—"
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-100 font-black text-slate-900 border-t-2 border-slate-300">
                      <td colSpan={6} className="p-2.5 text-right border-r border-slate-300 uppercase tracking-wider text-xs">
                        Сарын нийт дүн:
                      </td>
                      <td className="p-2.5 text-right text-emerald-800 font-mono text-sm border-r border-slate-300 bg-[#dbe3ea]">
                        {sheetData.monthTotalKm.toLocaleString()} км
                      </td>
                      <td className="p-2.5 text-right text-amber-800 font-mono text-sm border-r border-slate-300">
                        {sheetData.monthTotalFuel.toFixed(1)} л
                      </td>
                      <td colSpan={2} className="p-2.5 text-center text-xs text-slate-500">
                        ТЕСО Автотээврийн алба
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-500 print:hidden">
          <span>Сүүлийн синхрончлол: GPSBox FMS2 Realtime</span>
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
