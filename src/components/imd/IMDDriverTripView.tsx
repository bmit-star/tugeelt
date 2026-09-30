import React, { useEffect, useState } from "react";
import { 
  Truck, 
  MapPin, 
  Calendar, 
  Users, 
  Layers, 
  CheckCircle2, 
  Gauge, 
  Phone, 
  Fuel, 
  ArrowLeft,
  ShieldCheck
} from "lucide-react";
import { api } from "../../services/api";

interface Props {
  token: string;
  onBack?: () => void;
}

export const IMDDriverTripView: React.FC<Props> = ({ token, onBack }) => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // Quick ODO submission state
  const [endOdoInput, setEndOdoInput] = useState("");
  const [fuelLitersInput, setFuelLitersInput] = useState("");
  const [savingOdo, setSavingOdo] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await api.getIMDDriverTrip(token);
        setData(res);
        if (res.assignment?.endOdo) setEndOdoInput(String(res.assignment.endOdo));
        if (res.assignment?.fuelLiters) setFuelLitersInput(String(res.assignment.fuelLiters));
      } catch (err: any) {
        setError(err.message || "Томилолт олдсонгүй");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [token]);

  const handleUpdateTripOdo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!data?.assignment?.id) return;

    setSavingOdo(true);
    try {
      const endVal = Number(endOdoInput);
      const startVal = data.assignment.startOdo || 0;
      const actualKm = endVal > startVal ? endVal - startVal : undefined;

      await api.updateIMDAssignment(data.assignment.id, {
        endOdo: endVal || undefined,
        actualKm,
        fuelLiters: fuelLitersInput ? Number(fuelLitersInput) : undefined
      });

      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSavingOdo(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center p-4">
        <div className="text-center">
          <div className="inline-block w-8 h-8 border-4 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
          <p className="mt-3 text-xs font-bold text-slate-400">Томилолтын хуудас уншиж байна...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center p-4">
        <div className="bg-slate-800 p-6 rounded-3xl max-w-sm w-full text-center border border-slate-700 space-y-3">
          <div className="w-12 h-12 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
            ✕
          </div>
          <h2 className="text-base font-bold">Томилолт олдсонгүй</h2>
          <p className="text-xs text-slate-400">Энэ томилолтын холбоос хүчингүй байна.</p>
        </div>
      </div>
    );
  }

  const { assignment, order } = data;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-6 flex flex-col items-center">
      <div className="max-w-md w-full space-y-4">
        {/* Top Header */}
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-3xl p-5 border border-slate-800 shadow-2xl relative">
          {onBack && (
            <button
              onClick={onBack}
              className="absolute left-4 top-4 p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}

          <div className="text-center space-y-1">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 text-xs font-black">
              <Truck className="w-3.5 h-3.5" />
              <span>IMD ЖОЛООЧИЙН ТОМИЛОЛТ</span>
            </span>
            <div className="text-3xl font-black tracking-tight font-mono text-white pt-2">
              {assignment.vehiclePlate}
            </div>
            <div className="text-sm font-bold text-blue-400 flex items-center justify-center gap-1">
              <MapPin className="w-4 h-4" />
              <span>{assignment.province} ({assignment.destination})</span>
            </div>
          </div>
        </div>

        {/* Status Card */}
        <div className="bg-slate-900 rounded-2xl p-4 border border-slate-800 flex items-center justify-between">
          <span className="text-xs text-slate-400 font-bold">Төлөв:</span>
          <span className={`px-3 py-1 rounded-full text-xs font-black ${
            assignment.status === "Дууссан"
              ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
              : "bg-blue-500/20 text-blue-400 border border-blue-500/30 animate-pulse"
          }`}>
            {assignment.status}
          </span>
        </div>

        {/* Drivers Card */}
        <div className="bg-slate-900 rounded-3xl p-5 border border-slate-800 space-y-3 text-xs">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <span className="text-slate-400">Үндсэн жолооч:</span>
            <span className="font-bold text-white text-sm">{assignment.primaryDriverName}</span>
          </div>

          {assignment.substituteDriverName && (
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="text-slate-400">Сэлгээ жолооч:</span>
              <span className="font-bold text-purple-300">{assignment.substituteDriverName}</span>
            </div>
          )}

          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <span className="text-slate-400">Гарах огноо:</span>
            <span className="font-bold text-white">{assignment.departureDate}</span>
          </div>

          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <span className="text-slate-400">Ачсан тоо хэмжээ:</span>
            <span className="font-black text-white text-sm">{assignment.quantity?.toLocaleString()} хайрцаг</span>
          </div>

          {order && (
            <div className="flex items-center justify-between pt-1">
              <span className="text-slate-400">Харилцагч / Захиалга:</span>
              <span className="font-bold text-blue-300">{order.customer} ({order.orderNo})</span>
            </div>
          )}
        </div>

        {/* Driver ODO / Fuel Self-Record Form */}
        <form onSubmit={handleUpdateTripOdo} className="bg-slate-900 rounded-3xl p-5 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black uppercase text-blue-400 tracking-wider flex items-center gap-1.5">
              <Gauge className="w-4 h-4" />
              <span>ODO & Түлш бүртгэх</span>
            </h3>
            {savedSuccess && (
              <span className="text-[11px] text-emerald-400 font-bold flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                <span>Хадгалагдлаа!</span>
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <label className="block text-slate-400 font-bold mb-1">Эхлэх ODO</label>
              <input
                type="text"
                disabled
                value={assignment.startOdo || 135400}
                className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 font-mono font-bold text-slate-300 outline-none"
              />
            </div>
            <div>
              <label className="block text-slate-400 font-bold mb-1">Дуусах ODO</label>
              <input
                type="number"
                value={endOdoInput}
                onChange={(e) => setEndOdoInput(e.target.value)}
                placeholder="136960"
                className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 font-mono font-bold text-white outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div className="text-xs">
            <label className="block text-slate-400 font-bold mb-1">Цэнэглэсэн түлш (литр)</label>
            <input
              type="number"
              value={fuelLitersInput}
              onChange={(e) => setFuelLitersInput(e.target.value)}
              placeholder="320"
              className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white outline-none focus:border-blue-500"
            />
          </div>

          <button
            type="submit"
            disabled={savingOdo}
            className="w-full py-3 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-black text-xs shadow-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>{savingOdo ? "Хадгалж байна..." : "Бодит заалтыг систем рүү илгээх"}</span>
          </button>
        </form>

        <div className="text-center pt-2 text-[11px] text-slate-500">
          IMD Logistics • Тээврийн Нэгдсэн Систем
        </div>
      </div>
    </div>
  );
};
