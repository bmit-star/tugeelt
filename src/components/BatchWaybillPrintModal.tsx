import React, { useState, useEffect } from "react";
import * as XLSX from "xlsx";
import { VehicleSheetData } from "../types";
import { API } from "../services/api";
import { WaybillPrintTemplate } from "./WaybillPrintTemplate";
import { isIMDProvinceDriver } from "../constants/provinceRoutes";
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
  Layers,
  FileDown
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

  const handleSelectGroup = (group: "KA" | "M" | "IMT" | "IMD") => {
    const next = new Set<string>();
    allSheets.forEach(s => {
      const isIMD = Boolean(
        s.isIMD || 
        s.waybillType === "PROVINCE_DISTRIBUTION" ||
        s.organization?.includes("Дистрибьюшн") ||
        isIMDProvinceDriver({ vehicleNumber: s.vehicleNumber, name: s.driverName })
      );
      const code = (s as any).driverCode || s.vehicleNumber;

      if (group === "IMD" && isIMD) {
        next.add(s.vehicleNumber);
      } else if (group === "IMT" && !isIMD) {
        next.add(s.vehicleNumber);
      } else if (group === "KA" && code.toUpperCase().startsWith("KA")) {
        next.add(s.vehicleNumber);
      } else if (group === "M" && !code.toUpperCase().startsWith("KA") && !isIMD) {
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

  // Generate structured A4 Landscape worksheet for a single vehicle waybill
  const generateWaybillA4Worksheet = (sheet: VehicleSheetData) => {
    const code = (sheet as any).driverCode || (sheet as any).id || sheet.vehicleNumber;
    const phone = (sheet as any).driverPhone || "";
    const model = sheet.model || "";
    const initialSalesRep = sheet.days.find(d => d.salesRep)?.salesRep || "";

    const isProvince = Boolean(
      sheet.isIMD || 
      sheet.waybillType === "PROVINCE_DISTRIBUTION" ||
      sheet.organization?.includes("Дистрибьюшн") ||
      isIMDProvinceDriver({ vehicleNumber: sheet.vehicleNumber, name: sheet.driverName })
    );

    const title = isProvince
      ? "ОРОН НУТГИЙН ТҮГЭЭГЧИЙН АЛБАН ЁСНЫ ЗАМЫН ХУУДАС (A4 ХӨНДЛӨН)"
      : "ХОТЫН БОРЛУУЛАЛТЫН ЖОЛООЧИЙН АЛБАН ЁСНЫ ЗАМЫН ХУУДАС (A4 ХӨНДЛӨН)";

    const orgName = sheet.organization || (isProvince ? "Айсмарк Дистрибьюшн ХХК" : "АЙСМАРК ТРЕЙД ХХК");
    const driverLabel = isProvince ? "Түгээгчийн нэр:" : "Борлуулалтын жолоочийн нэр:";
    const partnerLabel = isProvince ? "Сэлгээ жолооч / ХТ:" : "Худалдааны төлөөлөгч (ХТ):";

    const aoaData: any[][] = [
      [title],
      [`Байгууллага: ${orgName}`, "", "", "", "Тайлант хугацаа:", currentMonth, "", "Хэвлэсэн огноо:", new Date().toISOString().split("T")[0]],
      ["Машины дугаар:", sheet.vehicleNumber, "Марк:", model, "Бүсийн код:", code, "Утасны дугаар:", phone],
      [driverLabel, `${sheet.driverName} ${isProvince ? '(ТҮГЭЭГЧ)' : '(БОРЛУУЛАЛТ)'}`, partnerLabel, initialSalesRep || (isProvince ? "Сэлгээгүй" : "ХТ"), "Төлөв:", "Батлагдсан"],
      [], // Empty row for visual spacing
      [
        "Өдөр",
        "Огноо",
        partnerLabel,
        isProvince ? "Явсан чиглэл / Аймаг, сум" : "Маршрут / Явсан газар",
        isProvince ? "Ажил үүрэг / Томилолт" : "Гүйцэтгэсэн ажлын утга",
        "Эхлэх заалт (км)",
        "Төгсөх заалт (км)",
        "Явсан км",
        "Авсан түлш (л)",
        "Жолоочийн гарын үсэг",
        isProvince ? "Хянасан (Сэлгээ/Менежер)" : "Хянасан ХТ"
      ]
    ];

    let totalKmSum = 0;
    let totalFuelSum = 0;

    sheet.days.forEach(d => {
      const kmVal = typeof d.totalKm === "number" ? Math.round(d.totalKm) : (Math.round(parseFloat(String(d.totalKm || "0"))) || 0);
      const fuelVal = typeof d.fuelLiters === "number" ? d.fuelLiters : (parseFloat(String(d.fuelLiters || "0")) || 0);
      totalKmSum += kmVal;
      totalFuelSum += fuelVal;

      aoaData.push([
        d.day,
        d.date,
        d.salesRep || initialSalesRep,
        d.zone || "",
        d.task || "",
        d.startOdo !== "" && !isNaN(Number(d.startOdo)) ? Math.round(Number(d.startOdo)) : (d.startOdo || ""),
        d.endOdo !== "" && !isNaN(Number(d.endOdo)) ? Math.round(Number(d.endOdo)) : (d.endOdo || ""),
        kmVal > 0 ? kmVal : (d.totalKm !== "" && !isNaN(Number(d.totalKm)) ? Math.round(Number(d.totalKm)) : (d.totalKm || "")),
        fuelVal > 0 ? fuelVal : (d.fuelLiters || ""),
        d.driverSignature || "",
        d.verifierSignature || ""
      ]);
    });

    // Summary row
    aoaData.push([
      "НИЙТ ДҮН",
      "",
      "",
      "",
      "",
      "",
      "",
      totalKmSum,
      totalFuelSum,
      "",
      ""
    ]);

    aoaData.push([]);
    if (isProvince) {
      aoaData.push([
        "Үндсэн түгээгч: .......................................",
        "",
        "Сэлгээ жолооч: .......................................",
        "",
        "Тээвэр, түгээлтийн менежер: Батлагдсан",
        "",
        "Тооцооны нягтлан бодогч: Хянасан"
      ]);
    } else {
      aoaData.push([
        "Борлуулалтын жолооч: .......................................",
        "",
        "Худалдааны төлөөлөгч (ХТ): .......................................",
        "",
        "Борлуулалт, түгээлтийн менежер: Батлагдсан",
        "",
        "Түлшний нягтлан бодогч: Хянасан"
      ]);
    }

    const ws = XLSX.utils.aoa_to_sheet(aoaData);

    // Optimized column widths for standard A4 landscape print
    ws["!cols"] = [
      { wch: 6 },  // Өдөр
      { wch: 12 }, // Огноо
      { wch: 20 }, // ХТ нэр
      { wch: 28 }, // Маршрут
      { wch: 24 }, // Ажил
      { wch: 15 }, // Эхлэх заалт
      { wch: 15 }, // Төгсөх заалт
      { wch: 14 }, // Явсан км
      { wch: 14 }, // Түлш
      { wch: 18 }, // Жолооч гарын үсэг
      { wch: 18 }  // Хянасан ХТ
    ];

    return ws;
  };

  // Export 1 individual vehicle waybill as standalone A4 Excel (.xlsx)
  const handleExportSingleA4Excel = (sheet: VehicleSheetData) => {
    try {
      const wb = XLSX.utils.book_new();
      const ws = generateWaybillA4Worksheet(sheet);
      const safeSheetName = (sheet.vehicleNumber || "Замын_хуудас").replace(/[:\\/?*\[\]]/g, "_").slice(0, 31);
      XLSX.utils.book_append_sheet(wb, ws, safeSheetName);
      XLSX.writeFile(wb, `Zamiin_Huudas_${safeSheetName}_${currentMonth}_A4.xlsx`);
      onShowToast(`${sheet.vehicleNumber} (${sheet.driverName}) замын хуудас A4 Excel форматаар татагдлаа`, "success");
    } catch (err: any) {
      onShowToast("A4 Excel татахад алдаа гарлаа: " + (err?.message || ""), "error");
    }
  };

  // Export all selected vehicles as separate A4 worksheets in one combined Excel (.xlsx)
  const handleExportAllA4Excel = () => {
    const sheetsToExport = allSheets.filter(s => selectedPlates.has(s.vehicleNumber));
    if (sheetsToExport.length === 0) {
      onShowToast("Экспортлох машин сонгоогүй байна!", "info");
      return;
    }

    try {
      const wb = XLSX.utils.book_new();
      const usedNames = new Set<string>();

      sheetsToExport.forEach((sheet, idx) => {
        const ws = generateWaybillA4Worksheet(sheet);
        let name = (sheet.vehicleNumber || `Машин_${idx + 1}`).replace(/[:\\/?*\[\]]/g, "_").slice(0, 31);
        if (usedNames.has(name)) {
          name = `${name.slice(0, 26)}_${idx + 1}`;
        }
        usedNames.add(name);
        XLSX.utils.book_append_sheet(wb, ws, name);
      });

      XLSX.writeFile(wb, `Bukh_Zamiin_Huudas_A4_${currentMonth}_${sheetsToExport.length}_Mashin.xlsx`);
      onShowToast(`Нийт ${sheetsToExport.length} машины замын хуудас тус бүр А4 хуудастай нэгдсэн Excel файл болж амжилттай татагдлаа`, "success");
    } catch (err: any) {
      onShowToast("A4 Excel татахад алдаа гарлаа: " + (err?.message || ""), "error");
    }
  };

  const handleExportCombinedCSV = () => {
    const sheetsToExport = allSheets.filter(s => selectedPlates.has(s.vehicleNumber));
    if (sheetsToExport.length === 0) {
      onShowToast("Экспортлох машин сонгоогүй байна!", "info");
      return;
    }

    const headers = [
      "Бүсийн код",
      "Машины дугаар",
      "Машины марк",
      "Жолоочийн нэр",
      "Утасны дугаар",
      "Худалдааны төлөөлөгч",
      "Маршрут / Чиглэл",
      "Өдөр (№)",
      "Огноо",
      "Явсан газрын нэр",
      "Ажил үүрэг",
      "Эхний заалт (км)",
      "Эцсийн заалт (км)",
      "Нийт явсан км",
      "Хийсэн түлш (л)",
      "Жолоочийн гарын үсэг",
      "Хянасан ХТ"
    ];

    const rows: (string | number)[][] = [];

    sheetsToExport.forEach(sheet => {
      const code = (sheet as any).driverCode || (sheet as any).id || sheet.vehicleNumber;
      const phone = (sheet as any).driverPhone || "";
      const model = sheet.model || "";
      const route = (sheet as any).defaultRoute || "";

      sheet.days.forEach(d => {
        rows.push([
          `"${code}"`,
          `"${sheet.vehicleNumber}"`,
          `"${model}"`,
          `"${sheet.driverName}"`,
          `"${phone}"`,
          `"${d.salesRep || sheet.days[0]?.salesRep || ""}"`,
          `"${(d.zone || route || "").replace(/"/g, '""')}"`,
          d.day,
          d.date,
          `"${(d.zone || "").replace(/"/g, '""')}"`,
          `"${(d.task || "").replace(/"/g, '""')}"`,
          d.startOdo !== "" && !isNaN(Number(d.startOdo)) ? Math.round(Number(d.startOdo)) : (d.startOdo || ""),
          d.endOdo !== "" && !isNaN(Number(d.endOdo)) ? Math.round(Number(d.endOdo)) : (d.endOdo || ""),
          d.totalKm !== "" && !isNaN(Number(d.totalKm)) ? Math.round(Number(d.totalKm)) : (d.totalKm || ""),
          d.fuelLiters || "",
          `"${d.driverSignature || ""}"`,
          `"${d.verifierSignature || ""}"`
        ]);
      });
    });

    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map(e => e.join(","))].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Zamiin_Huudas_${currentMonth}_${sheetsToExport.length}_Mashin.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    onShowToast(`Нийт ${sheetsToExport.length} машины замын хуудас цэвэр CSV форматаар амжилттай татагдлаа`, "success");
  };

  const printableSheets = allSheets.filter(s => selectedPlates.has(s.vehicleNumber));

  return (
    <div className="batch-waybill-modal-overlay fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-1 sm:p-4 overflow-y-auto print:p-0 print:bg-white print:static print:h-auto print:overflow-visible print:block print:m-0">
      <div className="batch-waybill-modal-content bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-6xl max-h-[96vh] flex flex-col overflow-hidden print:max-h-none print:shadow-none print:border-none print:rounded-none print:w-full print:block print:overflow-visible print:m-0 print:p-0">
        
        {/* Top Control Bar (Hidden when printing) */}
        <div className="p-3.5 sm:p-5 border-b border-slate-200 bg-slate-50 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 flex-shrink-0 print:hidden no-print">
          
          <div className="flex items-center gap-3">
            <img 
              src="https://icemark.mn/favicon.ico" 
              alt="Icemark" 
              className="h-8 w-8 object-contain rounded-lg shadow-xs"
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
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#0878bd] hover:bg-[#076ba8] text-white text-xs sm:text-sm font-black transition-all shadow-md active:scale-95 disabled:opacity-50 cursor-pointer"
              title="Сонгосон бүх замын хуудсыг нэгэн зэрэг A4 хөндлөн форматаар хэвлэх"
            >
              <Printer className="w-4 h-4" />
              <span>Хэвлэх ({selectedPlates.size} A4)</span>
            </button>

            {/* A4 Excel Batch Export (.xlsx) */}
            <button
              onClick={handleExportAllA4Excel}
              disabled={loading || selectedPlates.size === 0}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs sm:text-sm font-black transition-all shadow-md active:scale-95 disabled:opacity-50 cursor-pointer"
              title="Бүх замын хуудсыг нэг нэгээр нь А4 хуудастай Excel (.xlsx) файл болгон татах"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Бүх замын хуудас A4 Excel татах ({selectedPlates.size})</span>
            </button>

            {/* Clean Waybills CSV Export */}
            <button
              onClick={handleExportCombinedCSV}
              disabled={loading || selectedPlates.size === 0}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-white text-xs font-bold transition-all shadow-xs active:scale-95 disabled:opacity-50 cursor-pointer"
              title="Бүх жолоочийн замын хуудсыг CSV жагсаалтаар татах"
            >
              <Download className="w-4 h-4" />
              <span>CSV татах</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Filter & Selection Bar (Hidden when printing) */}
        <div className="p-2.5 sm:px-5 border-b border-slate-200 bg-white flex flex-wrap items-center justify-between gap-2 flex-shrink-0 print:hidden no-print text-xs">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={handleSelectAll}
              className="px-2.5 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-50 font-bold text-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              {selectedPlates.size === allSheets.length ? (
                <CheckSquare className="w-3.5 h-3.5 text-[#0878bd]" />
              ) : (
                <Square className="w-3.5 h-3.5 text-slate-400" />
              )}
              <span>{selectedPlates.size === allSheets.length ? "Бүгдийг болих" : `Бүгдийг сонгох (${allSheets.length})`}</span>
            </button>

            <button
              onClick={() => handleSelectGroup("IMT")}
              className="px-2.5 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 font-bold hover:bg-emerald-100 transition-colors cursor-pointer"
            >
              Хотын борлуулалт (IMT)
            </button>

            <button
              onClick={() => handleSelectGroup("IMD")}
              className="px-2.5 py-1.5 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700 font-bold hover:bg-indigo-100 transition-colors cursor-pointer"
            >
              Орон нутгийн түгээлт (IMD 8)
            </button>

            <button
              onClick={() => handleSelectGroup("KA")}
              className="px-2.5 py-1.5 rounded-lg bg-sky-50 border border-sky-200 text-[#0878bd] font-bold hover:bg-sky-100 transition-colors cursor-pointer"
            >
              KA Бүс (5)
            </button>

            <button
              onClick={() => handleSelectGroup("M")}
              className="px-2.5 py-1.5 rounded-lg bg-sky-50 border border-sky-200 text-[#0878bd] font-bold hover:bg-sky-100 transition-colors cursor-pointer"
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
                  className={`px-2 py-1 rounded-md text-[10px] font-mono font-bold transition-colors whitespace-nowrap cursor-pointer ${
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
        <div className="batch-waybill-print-area flex-1 overflow-y-auto p-3 sm:p-6 bg-slate-100/70 space-y-6 print:p-0 print:m-0 print:overflow-visible print:bg-white print:space-y-0 print:block">
          {loading ? (
            <div className="py-24 text-center flex flex-col items-center justify-center gap-3 no-print">
              <RefreshCw className="w-8 h-8 text-[#0878bd] animate-spin" />
              <p className="text-sm font-semibold text-slate-500">Бүх 30 машины замын хуудсыг бэлтгэж байна...</p>
            </div>
          ) : printableSheets.length === 0 ? (
            <div className="py-24 text-center text-slate-500 font-medium no-print">
              Хэвлэх замын хуудас сонгогдоогүй байна. Дээрх товчоор сонголтоо хийнэ үү.
            </div>
          ) : (
            printableSheets.map((sheet, idx) => (
              <div key={sheet.vehicleNumber} className="relative space-y-2">
                {/* On-screen control bar for single sheet export */}
                <div className="flex items-center justify-between bg-white border border-slate-200 rounded-xl px-4 py-2 text-xs print:hidden no-print shadow-2xs">
                  <div className="flex items-center gap-2 font-bold text-slate-700">
                    <Truck className="w-4 h-4 text-[#0878bd]" />
                    <span>
                      Хуудас {idx + 1}: <strong>{sheet.vehicleNumber}</strong> ({sheet.driverName} - {(sheet as any).driverCode || ""})
                    </span>
                  </div>
                  <button
                    onClick={() => handleExportSingleA4Excel(sheet)}
                    className="px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-emerald-800 text-xs font-black flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer shadow-2xs"
                    title="Энэ машины 1-31 хоногийн замын хуудсыг тусад нь A4 Excel (.xlsx) болгон татах"
                  >
                    <FileDown className="w-3.5 h-3.5 text-emerald-700" />
                    <span>Энэ машины A4 Excel татах</span>
                  </button>
                </div>

                {/* Print Sheet Container with landscape page break */}
                <WaybillPrintTemplate sheetData={sheet} showBorder={true} />
                
                {/* Visual separator on screen only */}
                <div className="text-center py-1 print:hidden no-print text-[10px] font-mono text-slate-400">
                  --- Хуудас {idx + 1} / {printableSheets.length} ({sheet.vehicleNumber} - {sheet.driverName}) ---
                </div>
              </div>
            ))
          )}
        </div>

        {/* Modal Bottom Footer (Hidden when printing) */}
        <div className="p-3 sm:p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-500 flex-shrink-0 print:hidden no-print">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>
              <strong>{printableSheets.length}</strong> хуудас A4 Landscape горимоор хэвлэгдэхэд бэлэн байна.
            </span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-bold transition-colors cursor-pointer"
          >
            Хаах
          </button>
        </div>
      </div>
    </div>
  );
};
