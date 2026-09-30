import React, { useEffect, useState } from "react";
import { 
  Package, 
  Truck, 
  MapPin, 
  Calendar, 
  CheckCircle2, 
  Clock, 
  Phone, 
  Layers, 
  ShieldCheck,
  ArrowLeft
} from "lucide-react";
import { api } from "../../services/api";

interface Props {
  token: string;
  onBack?: () => void;
}

export const IMDCustomerShareView: React.FC<Props> = ({ token, onBack }) => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await api.getIMDPublicOrder(token);
        setData(res);
      } catch (err: any) {
        setError(err.message || "Захиалга олдсонгүй");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="inline-block w-8 h-8 border-4 border-[#0878bd] border-t-transparent rounded-full animate-spin"></div>
          <p className="mt-3 text-xs font-bold text-slate-500">Захиалгын мэдээлэл татаж байна...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white p-6 rounded-3xl max-w-sm w-full text-center border border-slate-200 shadow-sm space-y-3">
          <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
            ✕
          </div>
          <h2 className="text-base font-bold text-slate-900">Захиалга олдсонгүй</h2>
          <p className="text-xs text-slate-500">Холбоос буруу эсвэл хүчингүй болсон байж болзошгүй.</p>
          {onBack && (
            <button
              onClick={onBack}
              className="mt-2 px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold"
            >
              Буцах
            </button>
          )}
        </div>
      </div>
    );
  }

  const { order, assignment } = data;

  return (
    <div className="min-h-screen bg-slate-100/70 p-4 sm:p-6 flex flex-col items-center justify-center">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-xl border border-slate-200/80 overflow-hidden">
        {/* Header */}
        <div className="bg-[#0878bd] p-6 text-white text-center relative">
          {onBack && (
            <button
              onClick={onBack}
              className="absolute left-4 top-4 p-2 rounded-xl bg-white/20 hover:bg-white/30 text-white transition-all"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 text-white text-xs font-bold mb-3 backdrop-blur-md">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>IMD Logistics Шуурхай Тээвэр</span>
          </div>

          <h1 className="text-2xl font-black tracking-tight">{order.orderNo}</h1>
          <p className="text-blue-100 text-xs mt-1">Тээвэр, хүргэлтийн бодит явц</p>
        </div>

        {/* Status Tracker */}
        <div className="p-6 space-y-5">
          <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80">
            <span className="text-xs text-slate-500 font-bold">Одоогийн төлөв:</span>
            <span className={`px-3 py-1 rounded-full text-xs font-black ${
              order.status === "Дууссан"
                ? "bg-emerald-100 text-emerald-800"
                : order.status === "Тээвэрт гарсан"
                ? "bg-blue-100 text-blue-800 animate-pulse"
                : "bg-amber-100 text-amber-800"
            }`}>
              {order.status}
            </span>
          </div>

          {/* Details list */}
          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between py-2 border-b border-slate-100">
              <span className="text-slate-500 font-medium">Харилцагч:</span>
              <span className="font-bold text-slate-900">{order.customer}</span>
            </div>

            <div className="flex items-center justify-between py-2 border-b border-slate-100">
              <span className="text-slate-500 font-medium">Хүрэх газар:</span>
              <span className="font-bold text-blue-700 flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5" />
                {order.province} ({order.destination})
              </span>
            </div>

            <div className="flex items-center justify-between py-2 border-b border-slate-100">
              <span className="text-slate-500 font-medium">Нийт ачаа:</span>
              <span className="font-black text-slate-900 text-sm">
                {order.quantity.toLocaleString()} хайрцаг
              </span>
            </div>

            <div className="flex items-center justify-between py-2 border-b border-slate-100">
              <span className="text-slate-500 font-medium">Хүргэх товлосон огноо:</span>
              <span className="font-bold text-slate-800">{order.deliveryDate}</span>
            </div>

            {assignment && (
              <>
                <div className="flex items-center justify-between py-2 border-b border-slate-100">
                  <span className="text-slate-500 font-medium">Тээврийн хэрэгсэл:</span>
                  <span className="font-mono font-black text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
                    {assignment.vehiclePlate}
                  </span>
                </div>

                <div className="flex items-center justify-between py-2 border-b border-slate-100">
                  <span className="text-slate-500 font-medium">Хариуцсан жолооч:</span>
                  <div className="text-right">
                    <div className="font-bold text-slate-900">{assignment.primaryDriverName}</div>
                    {assignment.primaryDriverPhone && (
                      <a
                        href={`tel:${assignment.primaryDriverPhone}`}
                        className="text-[11px] text-blue-600 font-bold flex items-center justify-end gap-1 mt-0.5"
                      >
                        <Phone className="w-3 h-3" />
                        <span>{assignment.primaryDriverPhone}</span>
                      </a>
                    )}
                  </div>
                </div>

                {assignment.substituteDriverName && (
                  <div className="flex items-center justify-between py-2 border-b border-slate-100">
                    <span className="text-slate-500 font-medium">Сэлгээ жолооч:</span>
                    <span className="font-bold text-purple-700">{assignment.substituteDriverName}</span>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="text-center pt-2">
            <span className="text-[11px] text-slate-400 font-medium">
              IMD Logistics нэгдсэн хяналтын системээр баталгаажив
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
