import React, { useState, useEffect } from "react";
import { 
  Truck, 
  Plus, 
  Search, 
  Box, 
  Check, 
  AlertTriangle, 
  Phone, 
  User, 
  Calendar, 
  RefreshCw,
  Edit2,
  CheckCircle2,
  Layers,
  ArrowRight
} from "lucide-react";
import { Driver, IMDAssignment } from "../../types";
import { api } from "../../services/api";
import { IMD_VEHICLE_BOX_CAPACITIES, getVehicleBoxCapacity } from "../../constants/imdConstants";

interface Props {
  drivers: Driver[];
  assignments: IMDAssignment[];
  onRefresh: () => void;
  onAssignVehicle?: (plate: string) => void;
  onShowToast: (msg: string, type: "success" | "error" | "info") => void;
}

export const IMDVehiclesTab: React.FC<Props> = ({
  drivers = [],
  assignments = [],
  onRefresh,
  onAssignVehicle,
  onShowToast
}) => {
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [totalCapacity, setTotalCapacity] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [searchFilter, setSearchFilter] = useState("");
  
  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<any | null>(null);

  // Form states for adding/editing a vehicle
  const [formPlate, setFormPlate] = useState("");
  const [formBoxCapacity, setFormBoxCapacity] = useState<number>(1000);
  const [formDriverName, setFormDriverName] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formModel, setFormModel] = useState("Isuzu Forward");
  const [formDefaultRoute, setFormDefaultRoute] = useState("Орон нутаг холын томилолт");
  const [formCode, setFormCode] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchVehicles = async () => {
    setLoading(true);
    try {
      const res = await api.getIMDVehicles();
      setVehicles(res.vehicles || []);
      setTotalCapacity(res.totalFleetCapacity || 0);
    } catch (err: any) {
      // Fallback from drivers if endpoint fails
      const map = new Map<string, any>();
      drivers.forEach(d => {
        if (d.vehicle) {
          const clean = d.vehicle.replace(/\s+/g, "").toUpperCase();
          const cap = d.boxCapacity || getVehicleBoxCapacity(clean, drivers);
          map.set(clean, {
            id: d.id,
            plate: d.vehicle,
            cleanPlate: clean,
            boxCapacity: cap,
            driverName: d.name,
            driverPhone: d.phone,
            model: d.model || "Isuzu",
            status: d.status || "active"
          });
        }
      });
      setVehicles(Array.from(map.values()));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVehicles();
  }, [drivers]);

  const openAddModal = () => {
    setEditingVehicle(null);
    setFormPlate("");
    setFormBoxCapacity(1000);
    setFormDriverName("");
    setFormPhone("");
    setFormModel("Isuzu Forward");
    setFormDefaultRoute("Орон нутаг холын томилолт");
    setFormCode("");
    setShowAddModal(true);
  };

  const openEditModal = (veh: any) => {
    setEditingVehicle(veh);
    setFormPlate(veh.plate);
    setFormBoxCapacity(veh.boxCapacity || 700);
    setFormDriverName(veh.driverName || "");
    setFormPhone(veh.driverPhone || "");
    setFormModel(veh.model || "Isuzu Forward");
    setFormDefaultRoute(veh.defaultRoute || "Орон нутаг холын томилолт");
    setFormCode(veh.driverCode || veh.id || "");
    setShowAddModal(true);
  };

  const handleSaveVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formPlate.trim()) {
      onShowToast("Машины улсын дугаарыг заавал оруулна уу!", "error");
      return;
    }
    if (!formBoxCapacity || formBoxCapacity <= 0) {
      onShowToast("Хэдэн хайрцаг зайрмаг ачих багтаамжийг заавал оруулна уу!", "error");
      return;
    }

    setSubmitting(true);
    try {
      if (editingVehicle) {
        await api.updateIMDVehicle(editingVehicle.cleanPlate || editingVehicle.plate, {
          boxCapacity: Number(formBoxCapacity),
          driverName: formDriverName.trim(),
          phone: formPhone.trim(),
          model: formModel.trim(),
          defaultRoute: formDefaultRoute.trim()
        });
        onShowToast(`Машин ${formPlate.toUpperCase()}-ийн мэдээлэл болон ${formBoxCapacity} хайрцаг багтаамж амжилттай шинэчлэгдлээ`, "success");
      } else {
        await api.saveIMDVehicle({
          plate: formPlate.trim().toUpperCase(),
          boxCapacity: Number(formBoxCapacity),
          driverName: formDriverName.trim() || `Жолооч (${formPlate.trim().toUpperCase()})`,
          phone: formPhone.trim(),
          model: formModel.trim(),
          defaultRoute: formDefaultRoute.trim(),
          code: formCode.trim()
        });
        onShowToast(`Шинэ машин ${formPlate.toUpperCase()} (${formBoxCapacity} хайрцаг зайрмагны багтаамжтай) амжилттай бүртгэгдлээ`, "success");
      }
      setShowAddModal(false);
      onRefresh();
      fetchVehicles();
    } catch (err: any) {
      onShowToast(err.message || "Машин хадгалахад алдаа гарлаа", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const filteredVehicles = vehicles.filter(v => {
    const q = searchFilter.toLowerCase();
    return (
      v.plate?.toLowerCase().includes(q) ||
      v.cleanPlate?.toLowerCase().includes(q) ||
      v.driverName?.toLowerCase().includes(q) ||
      String(v.boxCapacity).includes(q)
    );
  });

  return (
    <div className="space-y-4">
      {/* Header Stat & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <h2 className="text-base font-black text-[#123047] flex items-center gap-2">
            <Truck className="w-5 h-5 text-[#0878bd]" />
            <span>IMD Тээврийн Хэрэгсэл & Багтаамж (Зайрмагны хайрцаг)</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Орон нутгийн холын тээвэрт явдаг машинуудын ачих боломжит хайрцагны норм ба томилолтын хуваарилалт
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchVehicles}
            className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors"
            title="Шинэчлэх"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>

          <button
            onClick={openAddModal}
            className="px-4 py-2 rounded-xl bg-[#0878bd] hover:bg-[#0768a3] text-white text-xs font-black flex items-center gap-1.5 shadow-sm shadow-blue-500/20 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>+ Шинэ Машин Нэмэх</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Бүртгэлтэй Машин</span>
            <span className="text-2xl font-black text-[#123047] font-mono mt-0.5 block">{vehicles.length} машин</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200/60 flex items-center justify-center text-[#0878bd]">
            <Truck className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Нийт Зайрмагны Багтаамж</span>
            <span className="text-2xl font-black text-amber-600 font-mono mt-0.5 block">
              {(totalCapacity || vehicles.reduce((s, v) => s + (v.boxCapacity || 0), 0)).toLocaleString()} хайрцаг
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200/60 flex items-center justify-center text-amber-600">
            <Box className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Дундаж Багтаамж / Машин</span>
            <span className="text-2xl font-black text-emerald-600 font-mono mt-0.5 block">
              {vehicles.length > 0 
                ? Math.round((totalCapacity || vehicles.reduce((s, v) => s + (v.boxCapacity || 0), 0)) / vehicles.length).toLocaleString() 
                : 0} хайрцаг
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200/60 flex items-center justify-center text-emerald-600">
            <Layers className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex items-center gap-3 bg-white p-3 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Машины дугаар, жолооч, эсвэл багтаамжаар хайх..."
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs font-medium outline-none focus:border-blue-500"
          />
        </div>
      </div>

      {/* Vehicle Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {filteredVehicles.map((veh) => {
          const isOfficial = !!IMD_VEHICLE_BOX_CAPACITIES[veh.cleanPlate];
          const hasActiveTrip = !!veh.activeAssignment;

          return (
            <div
              key={veh.cleanPlate || veh.plate}
              className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs hover:border-blue-300 transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <span className="font-mono text-base font-black text-[#123047] block">
                      {veh.plate}
                    </span>
                    <span className="text-[11px] text-slate-500 font-medium">
                      {veh.model || "Isuzu Forward"}
                    </span>
                  </div>

                  {isOfficial ? (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-[#0878bd] border border-blue-200/60">
                      Албан ёсны IMD
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                      Нэмэлт машин
                    </span>
                  )}
                </div>

                {/* Box Capacity Badge */}
                <div className="my-3 p-2.5 rounded-xl bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/80 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Box className="w-4 h-4 text-amber-600" />
                    <span className="text-[11px] font-bold text-amber-900">Зайрмагны багтаамж:</span>
                  </div>
                  <span className="text-sm font-mono font-black text-amber-800 bg-white px-2 py-0.5 rounded-lg border border-amber-200 shadow-2xs">
                    {(veh.boxCapacity || 700).toLocaleString()} хайрцаг
                  </span>
                </div>

                {/* Driver Info */}
                <div className="space-y-1 text-xs text-slate-600 mb-3">
                  <div className="flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-slate-400" />
                    <span className="font-bold text-slate-800">{veh.driverName || "Оноогоогүй"}</span>
                  </div>
                  {veh.driverPhone && (
                    <div className="flex items-center gap-1.5 text-slate-500 font-mono">
                      <Phone className="w-3.5 h-3.5 text-slate-400" />
                      <span>{veh.driverPhone}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Card Footer Actions */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-1.5">
                <button
                  onClick={() => openEditModal(veh)}
                  className="px-2.5 py-1 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <Edit2 className="w-3 h-3 text-slate-500" />
                  <span>Засах</span>
                </button>

                {onAssignVehicle && (
                  <button
                    onClick={() => onAssignVehicle(veh.plate)}
                    className="px-3 py-1 rounded-xl bg-[#0878bd] hover:bg-[#0768a3] text-white text-xs font-bold flex items-center gap-1 transition-colors shadow-2xs cursor-pointer"
                    title="Энэ машинаар шууд томилолт үүсгэх"
                  >
                    <span>Томилолт</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {filteredVehicles.length === 0 && (
          <div className="col-span-full py-12 text-center text-slate-400 text-xs bg-white rounded-2xl border border-slate-200">
            Хайлтад тохирох тээврийн хэрэгсэл олдсонгүй
          </div>
        )}
      </div>

      {/* Add / Edit Vehicle Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-blue-100 text-[#0878bd] flex items-center justify-center">
                  <Truck className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-[#123047]">
                    {editingVehicle ? `Машин засах: ${editingVehicle.plate}` : "Шинээр IMD Тээврийн хэрэгсэл нэмэх"}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Машины улсын дугаар болон хэдэн хайрцаг зайрмаг ачих багтаамжийг бүртгэнэ
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveVehicle} className="p-4 sm:p-5 space-y-4">
              {/* Vehicle Plate */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Машины улсын дугаар *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Жишээ: 8374 УНЕ"
                  value={formPlate}
                  onChange={(e) => {
                    const upper = e.target.value.toUpperCase();
                    setFormPlate(upper);
                    const defaultCap = getVehicleBoxCapacity(upper, drivers);
                    if (defaultCap && defaultCap !== 700 && !editingVehicle) {
                      setFormBoxCapacity(defaultCap);
                    }
                  }}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-black font-mono uppercase focus:outline-none focus:ring-2 focus:ring-[#0878bd]"
                />
              </div>

              {/* Box Capacity Input with Presets */}
              <div className="p-3.5 rounded-2xl bg-amber-50/80 border border-amber-200 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-black text-amber-950 flex items-center gap-1.5">
                    <Box className="w-4 h-4 text-amber-600" />
                    <span>Хэдэн хайрцаг зайрмаг ачих багтаамжтай вэ? *</span>
                  </label>
                  {formBoxCapacity > 0 && (
                    <span className="text-xs font-mono font-black text-amber-800 bg-white px-2 py-0.5 rounded border border-amber-200">
                      {formBoxCapacity.toLocaleString()} хайрцаг
                    </span>
                  )}
                </div>

                <input
                  type="number"
                  min={1}
                  step={10}
                  required
                  placeholder="Жишээ нь: 700, 1000, 1500"
                  value={formBoxCapacity || ""}
                  onChange={(e) => setFormBoxCapacity(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl border border-amber-300 bg-white text-slate-900 text-sm font-black font-mono focus:outline-none focus:ring-2 focus:ring-amber-500"
                />

                <div className="flex items-center gap-1.5 pt-1">
                  <span className="text-[10px] text-slate-500 font-medium">Стандарт сонголтууд:</span>
                  {[700, 1000, 1500].map((cap) => (
                    <button
                      key={cap}
                      type="button"
                      onClick={() => setFormBoxCapacity(cap)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-black font-mono transition-colors cursor-pointer ${
                        formBoxCapacity === cap
                          ? "bg-amber-600 text-white shadow-xs"
                          : "bg-white hover:bg-amber-100 text-amber-900 border border-amber-200"
                      }`}
                    >
                      {cap.toLocaleString()} хайрцаг
                    </button>
                  ))}
                </div>
              </div>

              {/* Driver & Phone */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-750 mb-1">
                    Хариуцсан жолоочийн нэр
                  </label>
                  <input
                    type="text"
                    placeholder="Жишээ: Ми.Анхбаяр"
                    value={formDriverName}
                    onChange={(e) => setFormDriverName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#0878bd]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Утасны дугаар
                  </label>
                  <input
                    type="text"
                    placeholder="Жишээ: 90636371"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#0878bd]"
                  />
                </div>
              </div>

              {/* Model & Default Route */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Машины марк / загвар
                  </label>
                  <input
                    type="text"
                    placeholder="Жишээ: Isuzu Forward"
                    value={formModel}
                    onChange={(e) => setFormModel(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#0878bd]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Үндсэн чиглэл
                  </label>
                  <input
                    type="text"
                    placeholder="Орон нутаг холын томилолт"
                    value={formDefaultRoute}
                    onChange={(e) => setFormDefaultRoute(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#0878bd]"
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50"
                >
                  Болих
                </button>

                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-[#0878bd] hover:bg-[#0768a3] text-white text-xs font-black shadow-md shadow-blue-500/20 transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>{submitting ? "Хадгалж байна..." : (editingVehicle ? "Шинэчлэх" : "Машин бүртгэх")}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
