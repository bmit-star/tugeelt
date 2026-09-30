import React from "react";
import { VehicleSheetData } from "../types";
import { isIMDProvinceDriver } from "../constants/provinceRoutes";

interface WaybillPrintTemplateProps {
  sheetData: VehicleSheetData;
  showBorder?: boolean;
}

export const WaybillPrintTemplate: React.FC<WaybillPrintTemplateProps> = ({
  sheetData,
  showBorder = true
}) => {
  const [yearStr, monthStr] = (sheetData.yearMonth || new Date().toISOString().slice(0, 7)).split("-");

  const isProvince = Boolean(
    sheetData.isIMD || 
    sheetData.waybillType === "PROVINCE_DISTRIBUTION" ||
    sheetData.organization?.includes("Дистрибьюшн") ||
    sheetData.organization?.toUpperCase().includes("IMD") ||
    isIMDProvinceDriver({
      vehicleNumber: sheetData.vehicleNumber,
      name: sheetData.driverName,
      organization: sheetData.organization,
      isIMD: sheetData.isIMD
    })
  );

  // Extract substitute driver if recorded in days or notes
  const subDriverDay = sheetData.days.find(d => d.salesRep?.includes("Сэлгээ"));
  const subDriverName = subDriverDay 
    ? subDriverDay.salesRep.replace(/^Сэлгээ:\s*/, "") 
    : "";

  const salesRepDay = sheetData.days.find(d => d.salesRep && !d.salesRep.includes("Сэлгээ") && !d.salesRep.includes("IMD"));
  const citySalesRep = salesRepDay?.salesRep || sheetData.days[0]?.salesRep || "Худалдааны төлөөлөгч";

  return (
    <div className={`waybill-sheet-page bg-white text-slate-900 w-full max-w-[1040px] mx-auto p-4 print:p-0 print:max-w-none ${
      showBorder ? "border border-slate-300 print:border-none shadow-sm print:shadow-none" : ""
    }`}>
      
      {/* 1. Official Header */}
      <div className="flex items-start justify-between pb-1.5 border-b-2 border-slate-800 mb-1.5">
        {/* Left: Brand logo & Division */}
        <div className="flex items-center gap-2">
          <img 
            src="https://icemark.mn/images/logo_company-icemark.svg" 
            alt="ICEMARK" 
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
              {isProvince ? "DISTRIBUTION • ОРОН НУТАГ" : "TRADE • ХОТЫН БОРЛУУЛАЛТ"}
            </span>
          </div>
        </div>

        {/* Right: Official Index & Appendix */}
        <div className="text-right text-[9px] sm:text-[10px] font-medium text-slate-700 leading-tight">
          <p className="font-semibold text-slate-900">
            {isProvince 
              ? '"Авто тээвэр, орон нутгийн түгээлтийн үйл ажиллагааны журам"-ын Хавсралт №12'
              : '"Авто тээвэр, түгээлтийн албаны үйл ажиллагааны журам"-ын Хавсралт №12'}
          </p>
          <p className="font-bold text-slate-900">
            Маягтын индекс: <span className="font-mono">{isProvince ? "05/B-09-26/IMD-12" : "05/B-09-26/ATD-12"}</span>
          </p>
          <p className="text-slate-600">
            {isProvince ? "Хувилбар 2.0 (Орон нутаг)" : "Хувилбар 2.0 (Хот дотор)"}
          </p>
        </div>
      </div>

      {/* 2. Main Title (Centered) */}
      <div className="text-center my-1.5">
        <h1 className="text-sm sm:text-base font-black uppercase tracking-wider text-slate-900">
          {isProvince ? "Орон нутгийн түгээгчийн замын хуудас" : "Хотын борлуулалтын жолоочийн замын хуудас"}
        </h1>
        <p className="text-[10px] font-bold text-slate-600 mt-0.5">
          {yearStr} ОНЫ {monthStr} САР
        </p>
      </div>

      {/* 3. Top Form Fields */}
      <div className="grid grid-cols-12 gap-2 text-[11px] mb-2 pb-1.5 border-b border-slate-300">
        <div className="col-span-5 flex items-baseline gap-1">
          <span className="font-bold text-slate-700 whitespace-nowrap">Байгууллагын нэр:</span>
          <span className="font-black text-slate-900 border-b border-slate-800 flex-1 truncate px-1">
            {sheetData.organization || (isProvince ? "Айсмарк Дистрибьюшн ХХК" : "АЙСМАРК ТРЕЙД ХХК")}
          </span>
        </div>

        <div className="col-span-3 flex items-baseline gap-1">
          <span className="font-bold text-slate-700 whitespace-nowrap">Тээврийн хэрэгслийн улсын дугаар:</span>
          <span className="font-black font-mono text-[#0878bd] border-b border-slate-800 flex-1 px-1">
            {sheetData.vehicleNumber}
          </span>
        </div>

        <div className="col-span-4 flex items-baseline gap-1">
          <span className="font-bold text-slate-700 whitespace-nowrap">
            {isProvince ? "Түгээгчийн нэр:" : "Борлуулалтын жолоочийн нэр:"}
          </span>
          <span className="font-black text-slate-900 border-b border-slate-800 flex-1 px-1 truncate">
            {sheetData.driverName}{" "}
            <span className="text-[10px] text-[#0878bd] font-bold">
              {isProvince ? "(ТҮГЭЭГЧ)" : "(БОРЛУУЛАЛТ)"}
            </span>
          </span>
        </div>
      </div>

      {/* 4. 31-Day Official Table */}
      <div className="border border-slate-400">
        <table className="w-full text-left text-[10px] border-collapse min-w-[720px] print:min-w-0">
          <thead>
            <tr className="bg-[#0878bd] text-white font-bold text-center border-b border-slate-400">
              <th className="p-1 border-r border-sky-600/60 w-6 text-center">№</th>
              <th className="p-1 border-r border-sky-600/60 w-20">Он сар</th>
              <th className="p-1 border-r border-sky-600/60 min-w-[120px]">
                {isProvince ? "Явсан чиглэл / Аймаг, сум" : "Явсан бүс, маршрут (Хот дотор)"}
              </th>
              <th className="p-1 border-r border-sky-600/60 min-w-[100px]">
                {isProvince ? "Ажил үүрэг / Томилолт" : "Ажил үүрэг (Борлуулалт, хүргэлт)"}
              </th>
              <th className="p-1 border-r border-sky-600/60 w-20">Эхний км заалт</th>
              <th className="p-1 border-r border-sky-600/60 w-20">Эцсийн заалт</th>
              <th className="p-1 border-r border-sky-600/60 w-20 bg-[#065e94]">Нийт явсан км</th>
              <th className="p-1 border-r border-sky-600/60 w-16">Хийсэн түлш</th>
              <th className="p-1 border-r border-sky-600/60 min-w-[90px]">Жолоочийн гарын үсэг</th>
              <th className="p-1 min-w-[90px]">
                {isProvince ? "Хянасан (Сэлгээ / Менежер)" : "Хянасан (ХТ)"}
              </th>
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
                  {row.zone || (row.status === "REST_DAY" ? "—" : (isProvince ? "Орон нутгийн чиглэл" : "Хот дотор"))}
                </td>
                <td className="p-0.5 border-r border-slate-300 text-[9px] truncate max-w-[110px]">
                  {row.task || (row.status === "REST_DAY" ? "Хуваарьт амралт" : (isProvince ? "Орон нутгийн тээвэр" : "Борлуулалт"))}
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

          {/* Table Summary Footer */}
          <tfoot>
            <tr className="border-t-2 border-slate-600 bg-slate-100 font-bold text-slate-900 text-[10px]">
              <td colSpan={6} className="p-1 border-r border-slate-400 text-right font-black uppercase text-[10px]">
                Нийт явсан км:
              </td>
              <td className="p-1 border-r border-slate-400 text-right font-black font-mono text-xs bg-sky-100 text-[#0878bd] pr-1">
                {sheetData.monthTotalKm.toLocaleString()}
              </td>
              <td className="p-1 border-r border-slate-400 text-right font-black font-mono text-[10px] pr-1">
                {sheetData.monthTotalFuel > 0 ? sheetData.monthTotalFuel.toFixed(1) : ""}
              </td>
              <td colSpan={2} className="p-1 text-left text-[10px] text-slate-700 pl-2">
                <span className="font-bold">Нийт хийсэн түлш:</span> {sheetData.monthTotalFuel > 0 ? `${sheetData.monthTotalFuel.toFixed(1)} л` : "—"}
              </td>
            </tr>
            <tr className="border-t border-slate-300 bg-slate-50 text-[10px]">
              <td colSpan={6} className="p-1 border-r border-slate-400 text-right text-slate-600 font-bold text-[9px]">
                Үлдэгдэл түлш / л /:
              </td>
              <td colSpan={4} className="p-1 text-left font-mono font-bold text-slate-800 text-[10px] pl-3">
                {(sheetData.days.find(d => d.fuelLiters)?.fuelLiters ? "45.0 л" : "—")}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* 5. Bottom 4 Signature Blocks (Differentiated for IMD vs IMT) */}
      <div className="mt-3 pt-2 text-[10px] text-slate-800 space-y-1.5 print:space-y-1">
        {isProvince ? (
          <>
            <div className="flex items-center gap-2">
              <span className="w-44 font-bold">Үндсэн түгээгч:</span>
              <span className="border-b border-dotted border-slate-600 flex-1 px-2 font-medium">
                {sheetData.driverName}
              </span>
              <span className="text-slate-500">/ ............................................ /</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-44 font-bold">Сэлгээ түгээгч / Жолооч:</span>
              <span className="border-b border-dotted border-slate-600 flex-1 px-2 font-medium">
                {subDriverName || "Сэлгээ томилогдоогүй (Ганцаараа)"}
              </span>
              <span className="text-slate-500">/ ............................................ /</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-44 font-bold">Тээвэр, түгээлтийн менежер:</span>
              <span className="border-b border-dotted border-slate-600 flex-1 px-2 font-medium">
                Батлагдсан
              </span>
              <span className="text-slate-500">/ ............................................ /</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-44 font-bold">Тооцооны нягтлан бодогч:</span>
              <span className="border-b border-dotted border-slate-600 flex-1 px-2 font-medium">
                Хянасан
              </span>
              <span className="text-slate-500">/ ............................................ /</span>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <span className="w-44 font-bold">Борлуулалтын жолооч:</span>
              <span className="border-b border-dotted border-slate-600 flex-1 px-2 font-medium">
                {sheetData.driverName}
              </span>
              <span className="text-slate-500">/ ............................................ /</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-44 font-bold">Хариуцсан худалдааны төлөөлөгч (ХТ):</span>
              <span className="border-b border-dotted border-slate-600 flex-1 px-2 font-medium">
                {citySalesRep}
              </span>
              <span className="text-slate-500">/ ............................................ /</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-44 font-bold">Борлуулалт, түгээлтийн менежер:</span>
              <span className="border-b border-dotted border-slate-600 flex-1 px-2 font-medium">
                Батлагдсан
              </span>
              <span className="text-slate-500">/ ............................................ /</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-44 font-bold">Түлшний нягтлан бодогч:</span>
              <span className="border-b border-dotted border-slate-600 flex-1 px-2 font-medium">
                Хянасан
              </span>
              <span className="text-slate-500">/ ............................................ /</span>
            </div>
          </>
        )}
      </div>

    </div>
  );
};
