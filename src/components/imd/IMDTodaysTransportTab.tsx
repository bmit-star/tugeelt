import React, { useState } from "react";
import { 
  Truck, 
  Calendar, 
  Users, 
  MapPin, 
  Layers, 
  CheckCircle2, 
  Clock, 
  Fuel, 
  Gauge, 
  FileSpreadsheet, 
  ExternalLink,
  ChevronRight,
  Filter
} from "lucide-react";
import { IMDAssignment, Driver } from "../../types";

interface Props {
  assignments: IMDAssignment[];
  drivers: Driver[];
  selectedDate: string;
  onDateChange: (date: string) => void;
  onUpdateAssignment: (id: string, data: Partial<IMDAssignment>) => Promise<void>;
  onOpenDriverWaybill?: (driverId: string) => void;
  onShowToast: (msg: string, type: "success" | "error" | "info") => void;
}

export const IMDTodaysTransportTab: React.FC<Props> = ({
  assignments,
  drivers,
  selectedDate,
  onDateChange,
  onUpdateAssignment,
  onOpenDriverWaybill,
  onShowToast
}) => {
  const [activeSubFilter, setActiveSubFilter] = useState<"all" | "in_transit" | "completed">("all");
  const [completeModalAsn, setCompleteModalAsn] = useState<IMDAssignment | null>(null);
  const [endOdoInput, setEndOdoInput] = useState<string>("");
  const [fuelLitersInput, setFuelLitersInput] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  // Filter for the selected day
  const todayAssignments = assignments.filter(a => a.departureDate === selectedDate);

  const filtered = todayAssignments.filter(a => {
    if (activeSubFilter === "in_transit") return a.status === "Тээвэрт гарсан" || a.status === "Төлөвлөсөн";
    if (activeSubFilter === "completed") return a.status === "Дууссан";
    return true;
  });

  const totalBoxes = todayAssignments.reduce((sum, a) => sum + (Number(a.quantity) || 0), 0);
  const totalCompleted = todayAssignments.filter(a => a.status === "Дууссан").length;

  const handleOpenCompleteModal = (asn: IMDAssignment) => {
    setCompleteModalAsn(asn);
    setEndOdoInput(asn.endOdo ? String(asn.endOdo) : (asn.startOdo ? String(asn.startOdo + 500) : ""));
    setFuelLitersInput(asn.fuelLiters ? String(asn.fuelLiters) : "");
  };

  const handleSaveCompletion = async () => {
    if (!completeModalAsn) return;
    setSubmitting(true);
    try {
      const endVal = Number(endOdoInput);
      const startVal = completeModalAsn.startOdo || (endVal > 500 ? endVal - 500 : 0);
      const actualKm = endVal > startVal ? endVal - startVal : undefined;

      await onUpdateAssignment(completeModalAsn.id, {
        status: "Дууссан",
        endOdo: endVal || undefined,
        actualKm,
        fuelLiters: fuelLitersInput ? Number(fuelLitersInput) : undefined
      });

      onShowToast(`Томилолт амжилттай хаагдлаа (${completeModalAsn.vehiclePlate}, ${actualKm || 0} км)`, "success");
      setCompleteModalAsn(null);
    } catch (err: any) {
      onShowToast(err.message, "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Banner with Date Picker & Quick Day Stats */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
            <Truck className="w-5 h-5 text-[#0878bd]" />
            <span>Өнөөдрийн Тээвэр & Хуваарь</span>
            <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 text-xs font-black">
              {todayAssignments.length} томилолт
            </span>
          </h2>
          <p className="text-slate-400 text-xs mt-0.5">
            {selectedDate} өдрийн тээвэрт гарсан машинууд болон замын хуудсын гүйцэтгэл
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold">
            <Calendar className="w-4 h-4 text-blue-600" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => onDateChange(e.target.value)}
              className="bg-transparent font-bold text-slate-800 outline-none cursor-pointer"
            />
          </div>

          {/* Sub Filters */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-bold">
            <button
              onClick={() => setActiveSubFilter("all")}
              className={`px-3 py-1 rounded-lg transition-all ${
                activeSubFilter === "all" ? "bg-white text-slate-900 shadow-2xs" : "text-slate-500"
              }`}
            >
              Бүгд ({todayAssignments.length})
            </button>
            <button
              onClick={() => setActiveSubFilter("in_transit")}
              className={`px-3 py-1 rounded-lg transition-all ${
                activeSubFilter === "in_transit" ? "bg-white text-blue-700 shadow-2xs" : "text-slate-500"
              }`}
            >
              Замд яваа ({todayAssignments.length - totalCompleted})
            </button>
            <button
              onClick={() => setActiveSubFilter("completed")}
              className={`px-3 py-1 rounded-lg transition-all ${
                activeSubFilter === "completed" ? "bg-white text-emerald-700 shadow-2xs" : "text-slate-500"
              }`}
            >
              Дууссан ({totalCompleted})
            </button>
          </div>
        </div>
      </div>

      {/* Summary Chips */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-2xs">
          <span className="text-[11px] font-bold text-slate-400 block">Гарсан машин</span>
          <span className="text-xl font-black text-slate-800 mt-1 block">{todayAssignments.length} машин</span>
        </div>
        <div className="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-2xs">
          <span className="text-[11px] font-bold text-slate-400 block">Нийт ачилт</span>
          <span className="text-xl font-black text-purple-700 mt-1 block">{totalBoxes.toLocaleString()} хайрцаг</span>
        </div>
        <div className="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-2xs">
          <span className="text-[11px] font-bold text-slate-400 block">Гүйцэтгэл</span>
          <span className="text-xl font-black text-emerald-600 mt-1 block">
            {todayAssignments.length > 0 ? Math.round((totalCompleted / todayAssignments.length) * 100) : 0}%
          </span>
        </div>
        <div className="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-2xs">
          <span className="text-[11px] font-bold text-slate-400 block">Бодит явсан км</span>
          <span className="text-xl font-black text-blue-700 mt-1 block">
            {todayAssignments.reduce((s, a) => s + (Number(a.actualKm) || 0), 0).toLocaleString()} км
          </span>
        </div>
      </div>

      {/* Today's Dispatches Cards */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="py-16 text-center bg-white rounded-2xl border border-slate-200 text-slate-400">
            <Clock className="w-10 h-10 mx-auto mb-2 text-slate-300" />
            <p className="font-semibold text-sm">Сонгосон өдөр ({selectedDate}) томилогдсон тээвэр одоогоор алга байна.</p>
          </div>
        ) : (
          filtered.map((dispatch) => (
            <div
              key={dispatch.id}
              className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-xs hover:border-blue-400 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
            >
              <div className="space-y-1.5 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono font-black text-base text-slate-900 bg-slate-100 px-2.5 py-1 rounded-lg">
                    {dispatch.vehiclePlate}
                  </span>
                  <span className="text-xs font-bold text-blue-800 bg-blue-50 px-2 py-0.5 rounded-md">
                    {dispatch.province} ({dispatch.destination})
                  </span>
                  <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                    dispatch.status === "Дууссан"
                      ? "bg-emerald-100 text-emerald-800"
                      : dispatch.status === "Тээвэрт гарсан"
                      ? "bg-blue-100 text-blue-800 animate-pulse"
                      : "bg-amber-100 text-amber-800"
                  }`}>
                    {dispatch.status}
                  </span>
                  <span className="text-xs text-slate-400 font-mono">
                    #{dispatch.orderNo}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-slate-600 pt-1">
                  <span className="flex items-center gap-1 font-bold text-slate-800">
                    <Users className="w-3.5 h-3.5 text-blue-500" />
                    Үндсэн: {dispatch.primaryDriverName}
                  </span>
                  {dispatch.substituteDriverName && (
                    <span className="text-purple-700 font-semibold">
                      Сэлгээ: {dispatch.substituteDriverName}
                    </span>
                  )}
                  <span className="text-slate-600 font-semibold">
                    Ачсан: <strong className="text-slate-900 font-black">{dispatch.quantity.toLocaleString()} хайрцаг</strong>
                  </span>
                  {dispatch.actualKm && (
                    <span className="text-blue-700 font-bold">
                      Бодит км: {dispatch.actualKm.toLocaleString()} км
                    </span>
                  )}
                </div>

                {/* Start / End ODO Info */}
                {(dispatch.startOdo || dispatch.fuelLiters) && (
                  <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-500 bg-slate-50 px-2.5 py-1 rounded-lg w-fit">
                    {dispatch.startOdo && (
                      <span>ODO: {dispatch.startOdo} → {dispatch.endOdo || "..."}</span>
                    )}
                    {dispatch.fuelLiters && (
                      <span>Түлш: {dispatch.fuelLiters}L ({dispatch.fuelStation || "Колонк"})</span>
                    )}
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 self-end md:self-center">
                {dispatch.status !== "Дууссан" && (
                  <button
                    onClick={() => handleOpenCompleteModal(dispatch)}
                    className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-2xs"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Томилолт хаах (ODO)</span>
                  </button>
                )}

                {onOpenDriverWaybill && (
                  <button
                    onClick={() => onOpenDriverWaybill(dispatch.primaryDriverId)}
                    className="px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold flex items-center gap-1.5"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 text-blue-600" />
                    <span>Замын хуудас</span>
                  </button>
                )}

                <a
                  href={`/driver/trip/${dispatch.token}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600"
                  title="Жолоочийн харагдац"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          ))
        )}
      </div>

      {/* COMPLETE TRIP MODAL */}
      {completeModalAsn && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-5 shadow-2xl border border-slate-100 space-y-4">
            <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              <span>Томилолт Хаах & ODO Бүртгэх</span>
            </h3>

            <div className="text-xs text-slate-600 bg-slate-50 p-3 rounded-xl space-y-1">
              <div>Машин: <strong>{completeModalAsn.vehiclePlate}</strong></div>
              <div>Жолооч: <strong>{completeModalAsn.primaryDriverName}</strong></div>
              <div>Чиглэл: <strong>{completeModalAsn.province} ({completeModalAsn.destination})</strong></div>
              <div>Эхлэх ODO: <strong>{completeModalAsn.startOdo || 135400}</strong></div>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Дуусах Odometer заалт *</label>
                <input
                  type="number"
                  required
                  value={endOdoInput}
                  onChange={(e) => setEndOdoInput(e.target.value)}
                  placeholder="Жишээ: 136960"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono font-bold text-sm outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Цэнэглэсэн түлш (литр)</label>
                <input
                  type="number"
                  value={fuelLitersInput}
                  onChange={(e) => setFuelLitersInput(e.target.value)}
                  placeholder="Жишээ: 320"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setCompleteModalAsn(null)}
                className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600"
              >
                Болих
              </button>
              <button
                type="button"
                disabled={submitting || !endOdoInput}
                onClick={handleSaveCompletion}
                className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs disabled:opacity-50"
              >
                {submitting ? "Бүртгэж байна..." : "Хаах & Батлах"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
