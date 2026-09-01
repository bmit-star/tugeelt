import React from "react";
import { VehicleSheetData } from "../types";

interface WaybillPrintTemplateProps {
  sheetData: VehicleSheetData;
  showBorder?: boolean;
}

export const WaybillPrintTemplate: React.FC<WaybillPrintTemplateProps> = ({
  sheetData,
  showBorder = true
}) => {
  const [yearStr, monthStr] = (sheetData.yearMonth || new Date().toISOString().slice(0, 7)).split("-");

  return (
    <div className={`waybill-sheet-page bg-white text-slate-900 w-full max-w-[1040px] mx-auto p-4 print:p-0 print:max-w-none ${
      showBorder ? "border border-slate-300 print:border-none shadow-sm print:shadow-none" : ""
    }`}>
      
      {/* 1. Official Header (as per image.png) */}
      <div className="flex items-start justify-between pb-1.5 border-b-2 border-slate-800 mb-1.5">
        {/* Left: ICEMARK TRADE logo */}
        <div className="flex items-center gap-2">
          <img 
            src="https://icemark.mn/images/logo_company-icemark.svg" 
            alt="ICEMARK TRADE" 
            className="h-8 sm:h-9 w-auto object-contain"
            onError={(e) => {
              (e.target as HTMLElement).style.display = 'none';
            }}
          />
          <div className="flex flex-col">
            <span className="text-base sm:text-lg font-black tracking-tighter text-[#0878bd] leading-none">
              ICE<span className="text-[#f7a600]">MARK</span>
            </span>
            <span className="text-[8px] font-black tracking-widest text-[#123047] uppercase leading-none mt-0.5">
              TRADE
            </span>
          </div>
        </div>

        {/* Right: Official Index & Appendix (image.png top-right) */}
        <div className="text-right text-[9px] sm:text-[10px] font-medium text-slate-700 leading-tight">
          <p className="font-semibold text-slate-900">"Түгээлтийн албаны журам"-ын хавсралт №13</p>
          <p className="font-bold text-slate-900">Маягтын индекс: <span className="font-mono">BS/C-03-25/ATD-13</span></p>
          <p className="text-slate-600">Хувилбар: 2</p>
        </div>
      </div>

      {/* 2. Main Title (Centered) */}
      <div className="text-center my-1">
        <h1 className="text-sm sm:text-base font-black uppercase tracking-wider text-slate-900">
          Борлуулалтын жолоочийн замын хуудас
        </h1>
        <p className="text-[10px] font-bold text-slate-600 mt-0.5">
          {yearStr} ОНЫ {monthStr} САР
        </p>
      </div>

      {/* 3. Top Form Fields (as per image.png) */}
      <div className="grid grid-cols-12 gap-2 text-[11px] mb-1.5 pb-1 border-b border-slate-300">
        <div className="col-span-4 flex items-baseline gap-1">
          <span className="font-bold text-slate-700 whitespace-nowrap">Байгууллагын нэр:</span>
          <span className="font-black text-slate-900 border-b border-slate-800 flex-1 truncate px-1">
            {sheetData.organization || "АЙСМАРК ТРЕЙД ХХК"}
          </span>
        </div>

        <div className="col-span-4 flex items-baseline gap-1">
          <span className="font-bold text-slate-700 whitespace-nowrap">Тээврийн хэрэгслийн улсын дугаар:</span>
          <span className="font-black font-mono text-[#0878bd] border-b border-slate-800 flex-1 px-1">
            {sheetData.vehicleNumber} {sheetData.model ? `(${sheetData.model})` : ""}
          </span>
        </div>

        <div className="col-span-4 flex items-baseline gap-1">
          <span className="font-bold text-slate-700 whitespace-nowrap">Жолоочийн нэр:</span>
          <span className="font-black text-slate-900 border-b border-slate-800 flex-1 px-1 truncate">
            {sheetData.driverName} {sheetData.driverPhone ? `(${sheetData.driverPhone})` : ""}
          </span>
        </div>
      </div>

      {/* 4. 31-Day Official Table (Exact match with image.png) */}
      <div className="border border-slate-400">
        <table className="w-full text-left text-[10px] border-collapse min-w-[720px] print:min-w-0">
          <thead>
            <tr className="bg-[#0878bd] text-white font-bold text-center border-b border-slate-400">
              <th className="p-1 border-r border-sky-600/60 w-6 text-center">№</th>
              <th className="p-1 border-r border-sky-600/60 w-20">Он сар</th>
              <th className="p-1 border-r border-sky-600/60 min-w-[120px]">Явсан газрын нэр</th>
              <th className="p-1 border-r border-sky-600/60 min-w-[100px]">Ажил үүрэг</th>
              <th className="p-1 border-r border-sky-600/60 w-20">Эхний км заалт</th>
              <th className="p-1 border-r border-sky-600/60 w-20">Эцсийн заалт</th>
              <th className="p-1 border-r border-sky-600/60 w-20 bg-[#065e94]">Нийт явсан км</th>
              <th className="p-1 border-r border-sky-600/60 w-16">Хийсэн түлш</th>
              <th className="p-1 border-r border-sky-600/60 min-w-[100px]">Жолоочийн гарын үсэг</th>
              <th className="p-1 min-w-[110px]">Хянасан /Худалдааны төлөөлөгч/</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-300">
            {sheetData.days.map((row) => (
              <tr
                key={row.day}
                className={`h-[18px] print:h-[16px] border-b border-slate-300/80 transition-colors ${
                  row.totalKm !== "" ? "bg-sky-50/20 font-medium" : "text-slate-600"
                }`}
              >
                <td className="p-0.5 border-r border-slate-300 text-center font-bold text-slate-800 text-[9px]">
                  {row.day}
                </td>
                <td className="p-0.5 border-r border-slate-300 text-center font-mono text-[9px] whitespace-nowrap">
                  {row.date}
                </td>
                <td className="p-0.5 border-r border-slate-300 text-[9px] truncate max-w-[140px]">
                  {row.zone || ""}
                </td>
                <td className="p-0.5 border-r border-slate-300 text-[9px] truncate max-w-[110px]">
                  {row.task || ""}
                </td>
                <td className="p-0.5 border-r border-slate-300 text-right font-mono text-[9px] pr-1">
                  {row.startOdo ? Number(row.startOdo).toLocaleString() : ""}
                </td>
                <td className="p-0.5 border-r border-slate-300 text-right font-mono text-[9px] pr-1">
                  {row.endOdo ? Number(row.endOdo).toLocaleString() : ""}
                </td>
                <td className="p-0.5 border-r border-slate-300 text-right font-mono font-black text-slate-900 bg-slate-50/80 text-[9px] pr-1">
                  {row.totalKm ? Number(row.totalKm).toLocaleString() : ""}
                </td>
                <td className="p-0.5 border-r border-slate-300 text-right font-mono text-[9px] pr-1">
                  {row.fuelLiters ? `${row.fuelLiters}` : ""}
                </td>
                <td className="p-0.5 border-r border-slate-300 text-center text-[9px] text-slate-800">
                  {row.driverSignature ? (
                    <span className="font-semibold text-emerald-800">✓ {row.driverSignature}</span>
                  ) : (
                    ""
                  )}
                </td>
                <td className="p-0.5 text-center text-[9px] text-slate-800">
                  {row.verifierSignature ? (
                    <span className="font-semibold text-[#0878bd]">✓ {row.verifierSignature}</span>
                  ) : (
                    ""
                  )}
                </td>
              </tr>
            ))}
          </tbody>

          {/* Table Summary Footer (Matches image.png) */}
          <tfoot>
            <tr className="border-t-2 border-slate-600 bg-slate-100 font-bold text-slate-900 text-[10px]">
              <td colSpan={6} className="p-1 border-r border-slate-400 text-right font-black uppercase text-[10px]">
                Нийт явсан км:
              </td>
              <td className="p-1 border-r border-slate-400 text-right font-black font-mono text-xs bg-sky-100 text-[#0878bd] pr-1">
                {sheetData.monthTotalKm.toLocaleString()} км
              </td>
              <td className="p-1 border-r border-slate-400 text-right font-black font-mono text-[10px] pr-1">
                {sheetData.monthTotalFuel.toFixed(1)} л
              </td>
              <td colSpan={2} className="p-1 text-left text-[10px] text-slate-700 pl-2">
                <span className="font-bold">Нийт хийсэн түлш:</span> {sheetData.monthTotalFuel.toFixed(1)} л
              </td>
            </tr>
            <tr className="border-t border-slate-300 bg-slate-50 text-[10px]">
              <td colSpan={6} className="p-1 border-r border-slate-400 text-right text-slate-600 font-bold text-[9px]">
                Үлдэгдэл түлш /л/:
              </td>
              <td colSpan={4} className="p-1 text-left font-mono font-bold text-slate-800 text-[10px] pl-3">
                {(sheetData.days.find(d => d.fuelLiters)?.fuelLiters ? "45.0" : "—")} л
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* 5. Bottom 3 Signature Blocks (Exact match with image.png) */}
      <div className="mt-3 pt-2 border-t border-slate-400 grid grid-cols-3 gap-3 text-center text-[10px]">
        <div>
          <div className="border-b border-slate-800 pb-0.5 mb-0.5 min-h-[18px] flex items-end justify-center">
            <span className="font-bold text-slate-800 text-[10px]">{sheetData.driverName}</span>
          </div>
          <span className="text-[9px] text-slate-500 font-medium">нэр албан тушаал / Борлуулалтын жолооч /</span>
        </div>

        <div>
          <div className="border-b border-slate-800 pb-0.5 mb-0.5 min-h-[18px] flex items-end justify-center">
            <span className="font-bold text-slate-800 text-[10px]">{sheetData.days[0]?.salesRep || "Худалдааны төлөөлөгч"}</span>
          </div>
          <span className="text-[9px] text-slate-500 font-medium">нэр албан тушаал / Худалдааны төлөөлөгч /</span>
        </div>

        <div>
          <div className="border-b border-slate-800 pb-0.5 mb-0.5 min-h-[18px] flex items-end justify-center">
            <span className="font-bold text-slate-800 text-[10px]">Түгээлтийн алба</span>
          </div>
          <span className="text-[9px] text-slate-500 font-medium">нэр албан тушаал / Тээвэр зохицуулагч, Нярав /</span>
        </div>
      </div>

    </div>
  );
};
