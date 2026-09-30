import React, { useState } from "react";
import { 
  MapPin, 
  Search, 
  Plus, 
  Edit3, 
  Check, 
  Compass, 
  ShieldCheck, 
  Coffee, 
  Layers, 
  Truck
} from "lucide-react";
import { IMDRoute } from "../../types";

interface Props {
  routes: IMDRoute[];
  loading: boolean;
  onRefresh: () => void;
  onSaveRoute: (route: Partial<IMDRoute>) => Promise<void>;
  onShowToast: (msg: string, type: "success" | "error" | "info") => void;
}

export const IMDRoutesTab: React.FC<Props> = ({
  routes,
  loading,
  onRefresh,
  onSaveRoute,
  onShowToast
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingRoute, setEditingRoute] = useState<IMDRoute | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Form states
  const [code, setCode] = useState("");
  const [province, setProvince] = useState("");
  const [destination, setDestination] = useState("");
  const [roundTripKm, setRoundTripKm] = useState<number>(1000);
  const [roadPosts, setRoadPosts] = useState<number>(2);
  const [meals, setMeals] = useState<number>(3);
  const [notes, setNotes] = useState("");

  const openCreateModal = () => {
    setEditingRoute(null);
    setCode(`R-${routes.length + 1}`);
    setProvince("");
    setDestination("");
    setRoundTripKm(1000);
    setRoadPosts(2);
    setMeals(3);
    setNotes("");
    setShowModal(true);
  };

  const openEditModal = (r: IMDRoute) => {
    setEditingRoute(r);
    setCode(r.code);
    setProvince(r.province);
    setDestination(r.destination);
    setRoundTripKm(r.roundTripKm);
    setRoadPosts(Number(r.roadPosts) || 2);
    setMeals(Number(r.meals) || 3);
    setNotes(r.notes || "");
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!province || !destination) {
      onShowToast("Аймаг, очих чиглэлийн нэр шаардлагатай", "error");
      return;
    }

    setSubmitting(true);
    try {
      await onSaveRoute({
        id: editingRoute?.id,
        code,
        province,
        destination,
        roundTripKm: Number(roundTripKm) || 0,
        roadPosts: Number(roadPosts) || 0,
        meals: Number(meals) || 0,
        notes
      });
      onShowToast("Чиглэл амжилттай хадгалагдлаа", "success");
      setShowModal(false);
      onRefresh();
    } catch (err: any) {
      onShowToast(err.message, "error");
    } finally {
      setSubmitting(false);
    }
  };

  const filteredRoutes = routes.filter((r) => {
    if (!searchTerm) return true;
    const q = searchTerm.toLowerCase();
    return (
      r.province.toLowerCase().includes(q) ||
      r.destination.toLowerCase().includes(q) ||
      r.code.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
            <Compass className="w-5 h-5 text-[#0878bd]" />
            <span>21 Аймаг & Томилолтын Чиглэлийн Мастер Сан</span>
            <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 text-xs font-black">
              {filteredRoutes.length} чиглэл
            </span>
          </h2>
          <p className="text-slate-400 text-xs mt-0.5">
            Аймгуудын тогтоосон дундаж км, замын пост, хоолны норм болон бодит хүргэлтийн статистик
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="px-4 py-2.5 rounded-xl bg-[#0878bd] hover:bg-[#0769a6] text-white text-xs font-bold flex items-center gap-2 shadow-xs transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>+ Шинэ чиглэл нэмэх</span>
        </button>
      </div>

      {/* Search Bar */}
      <div className="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between gap-3">
        <div className="relative min-w-[260px] max-w-md flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Аймаг, сум, чиглэлийн нэрээр хайх..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs font-medium outline-none focus:border-blue-500"
          />
        </div>

        <button
          onClick={onRefresh}
          className="text-xs font-bold text-slate-500 hover:text-slate-800 px-3 py-1.5 rounded-xl hover:bg-slate-100"
        >
          Шинэчлэх
        </button>
      </div>

      {/* Routes Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredRoutes.map((r) => (
          <div
            key={r.id}
            className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-xs hover:border-blue-400 hover:shadow-md transition-all flex flex-col justify-between gap-3"
          >
            <div>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="text-[10px] font-mono font-bold text-slate-400 uppercase">
                    {r.code}
                  </span>
                  <h3 className="text-base font-black text-slate-900 mt-0.5">
                    {r.province}
                  </h3>
                  <span className="text-xs font-bold text-blue-700 block">
                    {r.destination}
                  </span>
                </div>

                <button
                  onClick={() => openEditModal(r)}
                  className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600"
                  title="Засах"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Stats */}
              <div className="mt-3 pt-3 border-t border-slate-100 grid grid-cols-3 gap-2 text-center text-xs">
                <div className="bg-slate-50 p-2 rounded-xl">
                  <span className="text-[10px] text-slate-400 block font-bold">Ирж очих КМ</span>
                  <span className="text-sm font-black text-slate-800">{r.roundTripKm.toLocaleString()}</span>
                </div>
                <div className="bg-slate-50 p-2 rounded-xl">
                  <span className="text-[10px] text-slate-400 block font-bold">Замын пост</span>
                  <span className="text-sm font-black text-slate-800">{r.roadPosts}</span>
                </div>
                <div className="bg-slate-50 p-2 rounded-xl">
                  <span className="text-[10px] text-slate-400 block font-bold">Хоол норм</span>
                  <span className="text-sm font-black text-slate-800">{r.meals}</span>
                </div>
              </div>

              {/* Delivery history stats if any */}
              {(r.totalBoxesDelivered || r.totalTrips) && (
                <div className="mt-2.5 flex items-center justify-between text-[11px] text-slate-500 bg-blue-50/50 px-2.5 py-1.5 rounded-xl">
                  <span className="flex items-center gap-1 font-semibold text-blue-900">
                    <Layers className="w-3.5 h-3.5 text-blue-500" />
                    Нийт хүргэсэн: {r.totalBoxesDelivered?.toLocaleString()} хайрцаг
                  </span>
                  <span className="font-bold text-slate-700">
                    {r.totalTrips || 0} тээвэр
                  </span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* CREATE / EDIT ROUTE MODAL */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                <Compass className="w-5 h-5 text-[#0878bd]" />
                <span>{editingRoute ? "Чиглэл засварлах" : "Шинэ чиглэл бүртгэх"}</span>
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-600 font-bold text-lg p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Код</label>
                  <input
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono font-bold outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Аймаг *</label>
                  <input
                    type="text"
                    required
                    value={province}
                    onChange={(e) => setProvince(e.target.value)}
                    placeholder="Хөвсгөл"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 font-bold outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Очих сум / хот / чиглэл *</label>
                <input
                  type="text"
                  required
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  placeholder="Мөрөн, Хатгал, Тосонцэнгэл"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Ирж очих КМ</label>
                  <input
                    type="number"
                    value={roundTripKm}
                    onChange={(e) => setRoundTripKm(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 font-bold outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Замын пост</label>
                  <input
                    type="number"
                    value={roadPosts}
                    onChange={(e) => setRoadPosts(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Хоол норм</label>
                  <input
                    type="number"
                    value={meals}
                    onChange={(e) => setMeals(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Тэмдэглэл</label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Замын нөхцөл, даваа гүвээ, анхаарах зүйлс..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50"
                >
                  Болих
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-[#0878bd] hover:bg-[#0769a6] text-white font-bold shadow-xs disabled:opacity-50"
                >
                  {submitting ? "Хадгалж байна..." : "Хадгалах"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
