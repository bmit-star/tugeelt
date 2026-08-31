import React, { useState } from "react";
import { Driver } from "../types";
import { API } from "../services/api";
import { X, UserPlus, Save, Trash2, Truck, Phone, User, Check, RefreshCw } from "lucide-react";

interface DriverManagementModalProps {
  drivers: Driver[];
  initialDriver?: Driver | null;
  initialCreateNew?: boolean;
  onClose: () => void;
  onRefresh: () => void;
  onShowToast: (msg: string, type?: "success" | "error" | "info") => void;
}

export const DriverManagementModal: React.FC<DriverManagementModalProps> = ({
  drivers,
  initialDriver = null,
  initialCreateNew = false,
  onClose,
  onRefresh,
  onShowToast
}) => {
  const [selectedDriver, setSelectedDriver] = useState<Driver | null>(initialDriver);
  const [isCreatingNew, setIsCreatingNew] = useState(initialCreateNew || (!initialDriver && drivers.length === 0));

  const [formCode, setFormCode] = useState(initialDriver ? initialDriver.code || initialDriver.id : "");
  const [formName, setFormName] = useState(initialDriver ? initialDriver.name : "");
  const [formPhone, setFormPhone] = useState(initialDriver ? initialDriver.phone : "");
  const [formVehicle, setFormVehicle] = useState(initialDriver ? initialDriver.vehicle : "");
  const [formModel, setFormModel] = useState(initialDriver ? initialDriver.model : "Isuzu");
  const [formSalesRep, setFormSalesRep] = useState(initialDriver ? initialDriver.salesRep : "До.Дэмбэрэл");
  const [formDefaultRoute, setFormDefaultRoute] = useState(initialDriver ? initialDriver.defaultRoute || "" : "");
  const [formStatus, setFormStatus] = useState<"active" | "inactive">(initialDriver ? initialDriver.status : "active");

  const [loading, setLoading] = useState(false);

  React.useEffect(() => {
    if (initialDriver) {
      handleSelectDriver(initialDriver);
    } else if (initialCreateNew) {
      handleStartNew();
    }
  }, [initialDriver, initialCreateNew]);

  const handleSelectDriver = (driver: Driver) => {
    setSelectedDriver(driver);
    setIsCreatingNew(false);
    setFormCode(driver.code || driver.id);
    setFormName(driver.name);
    setFormPhone(driver.phone);
    setFormVehicle(driver.vehicle);
    setFormModel(driver.model);
    setFormSalesRep(driver.salesRep);
    setFormDefaultRoute(driver.defaultRoute || "");
    setFormStatus(driver.status);
  };

  const handleStartNew = () => {
    setSelectedDriver(null);
    setIsCreatingNew(true);
    setFormCode("");
    setFormName("");
    setFormPhone("");
    setFormVehicle("");
    setFormModel("Isuzu");
    setFormSalesRep("До.Дэмбэрэл");
    setFormDefaultRoute("");
    setFormStatus("active");
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formCode || !formName) {
      onShowToast("Жолоочийн код болон нэрийг заавал оруулна уу!", "error");
      return;
    }

    setLoading(true);
    try {
      await API.saveDriver({
        id: selectedDriver ? selectedDriver.id : formCode.trim().toUpperCase(),
        code: formCode.trim().toUpperCase(),
        name: formName.trim(),
        phone: formPhone.trim(),
        vehicle: formVehicle.trim().toUpperCase() || "----",
        model: formModel.trim(),
        salesRep: formSalesRep.trim(),
        defaultRoute: formDefaultRoute.trim(),
        status: formStatus,
        isNew: isCreatingNew
      });
      onShowToast(selectedDriver ? "Жолооч, машин, ХТ-ийн тохиргоо амжилттай шинэчлэгдлээ" : "Шинэ жолооч амжилттай нэмэгдлээ", "success");
      onRefresh();
      if (isCreatingNew) {
        setIsCreatingNew(false);
      }
    } catch (err: any) {
      onShowToast(err.message || "Хадгалахад алдаа гарлаа", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (driverId: string) => {
    if (!confirm(`'${driverId}' кодтой жолоочийг системээс хасахдаа итгэлтэй байна уу?`)) return;
    setLoading(true);
    try {
      await API.deleteDriver(driverId);
      onShowToast("Жолооч устгагдлаа", "success");
      setSelectedDriver(null);
      onRefresh();
    } catch (err: any) {
      onShowToast("Устгахад алдаа гарлаа", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#0878bd] text-white flex items-center justify-center">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-[#123047]">
                Жолооч & Хэрэглэгчийн удирдлагын систем
              </h2>
              <p className="text-xs text-slate-500">
                Жолоочдын бүртгэл, оноосон машин болон хариуцсан борлуулалтын төлөөлөгчид
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleStartNew}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#0878bd] hover:bg-[#076ba8] text-white text-xs font-bold transition-all shadow-sm"
            >
              <UserPlus className="w-4 h-4" />
              <span>Шинэ жолооч нэмэх</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Two-Column Grid */}
        <div className="flex-1 overflow-auto grid grid-cols-1 md:grid-cols-12 divide-y md:divide-y-0 md:divide-x divide-slate-200">
          
          {/* Left Column: Driver List */}
          <div className="md:col-span-5 p-3 sm:p-4 overflow-y-auto max-h-[60vh] md:max-h-none">
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 px-1 flex items-center justify-between">
              <span>Нийт жолооч ({drivers.length})</span>
              <span className="text-[11px] text-emerald-600 font-semibold">
                Идэвхтэй: {drivers.filter(d => d.status === "active").length}
              </span>
            </div>

            <div className="space-y-1.5">
              {drivers.map((d) => {
                const isSelected = selectedDriver?.id === d.id;
                return (
                  <button
                    key={d.id}
                    onClick={() => handleSelectDriver(d)}
                    className={`w-full text-left p-3 rounded-xl border transition-all flex items-center justify-between gap-2 ${
                      isSelected
                        ? "bg-sky-50 border-[#0878bd] shadow-xs"
                        : "bg-white border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-black text-xs px-2 py-0.5 rounded bg-slate-100 text-[#123047]">
                          {d.code || d.id}
                        </span>
                        <span className="font-bold text-sm text-slate-900 truncate">
                          {d.name}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-2">
                        <span className="font-medium text-[#0878bd]">{d.vehicle || "Машингүй"}</span>
                        <span>•</span>
                        <span>{d.salesRep || "Төлөөлөгчгүй"}</span>
                      </div>
                    </div>

                    <div className="flex-shrink-0">
                      <span
                        className={`w-2.5 h-2.5 rounded-full inline-block ${
                          d.status === "active" ? "bg-emerald-500" : "bg-slate-300"
                        }`}
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right Column: Driver Form */}
          <div className="md:col-span-7 p-4 sm:p-6 bg-slate-50/50 overflow-y-auto">
            {selectedDriver || isCreatingNew ? (
              <form onSubmit={handleSave} className="space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                  <h3 className="text-sm font-black text-[#123047]">
                    {isCreatingNew ? "➕ Шинэ жолооч бүртгэх" : `✏️ Жолооч засах: ${selectedDriver?.name}`}
                  </h3>
                  {selectedDriver && (
                    <button
                      type="button"
                      onClick={() => handleDelete(selectedDriver.id)}
                      className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>Устгах</span>
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                      Жолоочийн код (ID) *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Жишээ: M16, KA1, M26"
                      value={formCode}
                      onChange={(e) => setFormCode(e.target.value.toUpperCase())}
                      disabled={!!selectedDriver}
                      className="w-full h-11 px-3.5 rounded-xl border border-slate-300 bg-white text-slate-900 text-sm font-black focus:outline-none focus:ring-2 focus:ring-[#0878bd] disabled:bg-slate-100 uppercase"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                      Овог Нэр *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Жишээ: Дэнэ-Чулуун"
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      className="w-full h-11 px-3.5 rounded-xl border border-slate-300 bg-white text-slate-900 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#0878bd]"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                      Утасны дугаар
                    </label>
                    <input
                      type="text"
                      placeholder="Жишээ: 90636371"
                      value={formPhone}
                      onChange={(e) => setFormPhone(e.target.value)}
                      className="w-full h-11 px-3.5 rounded-xl border border-slate-300 bg-white text-slate-900 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#0878bd]"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                      Машины улсын дугаар
                    </label>
                    <input
                      type="text"
                      placeholder="Жишээ: 2611 УЕВ"
                      value={formVehicle}
                      onChange={(e) => setFormVehicle(e.target.value.toUpperCase())}
                      className="w-full h-11 px-3.5 rounded-xl border border-slate-300 bg-white text-slate-900 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#0878bd] uppercase"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                      Машины марк / загвар
                    </label>
                    <input
                      type="text"
                      placeholder="Жишээ: Isuzu NPR 75"
                      value={formModel}
                      onChange={(e) => setFormModel(e.target.value)}
                      className="w-full h-11 px-3.5 rounded-xl border border-slate-300 bg-white text-slate-900 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#0878bd]"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                      Хариуцсан борлуулалтын төлөөлөгч
                    </label>
                    <input
                      type="text"
                      placeholder="Жишээ: До.Дэмбэрэл"
                      value={formSalesRep}
                      onChange={(e) => setFormSalesRep(e.target.value)}
                      className="w-full h-11 px-3.5 rounded-xl border border-slate-300 bg-white text-slate-900 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#0878bd]"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                      Үндсэн чиглэл / Маршрут (Google Sheet)
                    </label>
                    <input
                      type="text"
                      placeholder="Жишээ нь: Бэлх, Сэлх, Дамба, Тоосгоны үйлдвэр, Япон цэрэг, Дарь эх"
                      value={formDefaultRoute}
                      onChange={(e) => setFormDefaultRoute(e.target.value)}
                      className="w-full h-11 px-3.5 rounded-xl border border-slate-300 bg-white text-slate-900 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#0878bd]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                    Төлөв
                  </label>
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-800">
                      <input
                        type="radio"
                        name="status"
                        value="active"
                        checked={formStatus === "active"}
                        onChange={() => setFormStatus("active")}
                        className="text-[#0878bd] focus:ring-[#0878bd]"
                      />
                      <span>● Идэвхтэй (Ажиллаж байгаа)</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-500">
                      <input
                        type="radio"
                        name="status"
                        value="inactive"
                        checked={formStatus === "inactive"}
                        onChange={() => setFormStatus("inactive")}
                        className="text-slate-400 focus:ring-slate-400"
                      />
                      <span>○ Идэвхгүй / Чөлөөтэй</span>
                    </label>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedDriver(null);
                      setIsCreatingNew(false);
                    }}
                    className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200 transition-colors"
                  >
                    Болих
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-5 py-2.5 rounded-xl bg-[#0878bd] hover:bg-[#076ba8] text-white text-xs font-black shadow-md shadow-sky-900/10 flex items-center gap-2 disabled:opacity-50 transition-all"
                  >
                    {loading ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <Save className="w-4 h-4" />
                        <span>Хадгалах</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center p-8 text-slate-400">
                <User className="w-12 h-12 mb-3 text-slate-300 stroke-1" />
                <p className="text-sm font-bold text-slate-600">Жолооч сонгох эсвэл шинээр үүсгэнэ үү</p>
                <p className="text-xs text-slate-400 mt-1 max-w-xs">
                  Зүүн жагсаалтаас засах жолоочоо сонгох эсвэл "Шинэ жолооч нэмэх" товчийг дарна уу.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
