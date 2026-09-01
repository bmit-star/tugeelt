import React, { useState, useEffect } from "react";
import { Driver } from "../types";
import { API } from "../services/api";
import { 
  X, 
  UserPlus, 
  Save, 
  Trash2, 
  Truck, 
  Phone, 
  User, 
  Check, 
  RefreshCw, 
  Search,
  MapPin,
  Briefcase
} from "lucide-react";

interface DriverManagementModalProps {
  drivers: Driver[];
  initialDriver?: Driver | null;
  initialCreateNew?: boolean;
  onClose: () => void;
  onRefresh: () => void;
  onShowToast: (msg: string, type?: "success" | "error" | "info") => void;
}

export const DriverManagementModal: React.FC<DriverManagementModalProps> = ({
  drivers = [],
  initialDriver = null,
  initialCreateNew = false,
  onClose,
  onRefresh,
  onShowToast
}) => {
  const [selectedDriver, setSelectedDriver] = useState<Driver | null>(initialDriver);
  const [isCreatingNew, setIsCreatingNew] = useState(initialCreateNew || (!initialDriver && drivers.length === 0));
  const [searchFilter, setSearchFilter] = useState("");

  const [formCode, setFormCode] = useState(initialDriver ? initialDriver.code || initialDriver.id : "");
  const [formName, setFormName] = useState(initialDriver ? initialDriver.name : "");
  const [formPhone, setFormPhone] = useState(initialDriver ? initialDriver.phone : "");
  const [formVehicle, setFormVehicle] = useState(initialDriver ? initialDriver.vehicle : "");
  const [formModel, setFormModel] = useState(initialDriver ? initialDriver.model : "Isuzu NPR 75");
  const [formSalesRep, setFormSalesRep] = useState(initialDriver ? initialDriver.salesRep : "До.Дэмбэрэл");
  const [formDefaultRoute, setFormDefaultRoute] = useState(initialDriver ? initialDriver.defaultRoute || "" : "");
  const [formStatus, setFormStatus] = useState<"active" | "inactive">(initialDriver ? initialDriver.status : "active");

  const [loading, setLoading] = useState(false);

  useEffect(() => {
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
    setFormPhone(driver.phone || "");
    setFormVehicle(driver.vehicle || "");
    setFormModel(driver.model || "Isuzu");
    setFormSalesRep(driver.salesRep || "До.Дэмбэрэл");
    setFormDefaultRoute(driver.defaultRoute || "");
    setFormStatus(driver.status || "active");
  };

  const handleStartNew = () => {
    setSelectedDriver(null);
    setIsCreatingNew(true);
    setFormCode("");
    setFormName("");
    setFormPhone("");
    setFormVehicle("");
    setFormModel("Isuzu NPR 75");
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
      const cleanCode = formCode.trim().toUpperCase();
      const payload = {
        id: selectedDriver ? selectedDriver.id : cleanCode,
        code: cleanCode,
        name: formName.trim(),
        phone: formPhone.trim(),
        vehicle: formVehicle.trim().toUpperCase() || "----",
        model: formModel.trim(),
        salesRep: formSalesRep.trim(),
        defaultRoute: formDefaultRoute.trim(),
        status: formStatus,
        isNew: isCreatingNew
      };

      const res = await API.saveDriver(payload);
      onShowToast(
        selectedDriver 
          ? `Жолооч ${payload.name} (${payload.code})-ийн тохиргоо амжилттай хадгалагдлаа` 
          : `Шинэ жолооч ${payload.name} (${payload.code}) амжилттай нэмэгдлээ`, 
        "success"
      );
      
      onRefresh();
      if (res.driver) {
        setSelectedDriver(res.driver);
      }
      setIsCreatingNew(false);
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
      onShowToast("Жолооч амжилттай устгагдлаа", "success");
      setSelectedDriver(null);
      setIsCreatingNew(false);
      onRefresh();
    } catch (err: any) {
      onShowToast("Устгахад алдаа гарлаа", "error");
    } finally {
      setLoading(false);
    }
  };

  const filteredList = (drivers || []).filter(d => 
    d.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
    d.id.toLowerCase().includes(searchFilter.toLowerCase()) ||
    (d.code && d.code.toLowerCase().includes(searchFilter.toLowerCase())) ||
    (d.vehicle && d.vehicle.toLowerCase().includes(searchFilter.toLowerCase())) ||
    (d.salesRep && d.salesRep.toLowerCase().includes(searchFilter.toLowerCase()))
  );

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#0878bd] text-white flex items-center justify-center shadow-sm">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-[#123047]">
                Жолооч & Машин тохируулах төв
              </h2>
              <p className="text-xs text-slate-500">
                Жолоочийн бүртгэл, оноосон машин, утасны дугаар, хариуцсан борлуулалтын төлөөлөгч
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleStartNew}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black transition-all shadow-sm"
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
        <div className="flex-1 overflow-hidden grid grid-cols-1 md:grid-cols-12 divide-y md:divide-y-0 md:divide-x divide-slate-200 min-h-0">
          
          {/* Left Column: Driver List */}
          <div className="md:col-span-5 p-3 sm:p-4 flex flex-col min-h-0 bg-white">
            
            {/* Search filter input */}
            <div className="relative mb-2.5">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Жолооч, машин, код хайх..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="w-full pl-8.5 pr-3 py-1.5 rounded-xl border border-slate-300 text-xs bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0878bd]"
              />
            </div>

            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 px-1 flex items-center justify-between">
              <span>Жагсаалт ({filteredList.length})</span>
              <span className="text-emerald-700 font-bold">
                Нийт: {drivers.length}
              </span>
            </div>

            <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
              {filteredList.map((d) => {
                const isSelected = selectedDriver?.id === d.id && !isCreatingNew;
                return (
                  <button
                    key={d.id}
                    onClick={() => handleSelectDriver(d)}
                    className={`w-full text-left p-2.5 rounded-xl border transition-all flex items-center justify-between gap-2 ${
                      isSelected
                        ? "bg-sky-50 border-[#0878bd] shadow-xs"
                        : "bg-white border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-black text-[11px] px-1.5 py-0.5 rounded bg-slate-100 text-[#123047] font-mono">
                          {d.code || d.id}
                        </span>
                        <span className="font-bold text-xs text-slate-900 truncate">
                          {d.name}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-500 mt-1 flex items-center gap-1.5">
                        <span className="font-bold text-[#0878bd] font-mono">{d.vehicle || "Машингүй"}</span>
                        <span>•</span>
                        <span className="truncate">{d.salesRep || "Төлөөлөгчгүй"}</span>
                      </div>
                    </div>

                    <div className="flex-shrink-0">
                      <span
                        className={`w-2.5 h-2.5 rounded-full inline-block ${
                          d.status === "active" ? "bg-emerald-500" : "bg-slate-300"
                        }`}
                        title={d.status === "active" ? "Идэвхтэй" : "Идэвхгүй"}
                      />
                    </div>
                  </button>
                );
              })}

              {filteredList.length === 0 && (
                <div className="py-8 text-center text-xs text-slate-400">
                  Хайлтад тохирох жолооч олдсонгүй
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Driver Form */}
          <div className="md:col-span-7 p-4 sm:p-6 bg-slate-50/50 overflow-y-auto">
            {selectedDriver || isCreatingNew ? (
              <form onSubmit={handleSave} className="space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                  <div>
                    <h3 className="text-sm font-black text-[#123047] flex items-center gap-1.5">
                      {isCreatingNew ? (
                        <>
                          <UserPlus className="w-4 h-4 text-emerald-600" />
                          <span>Шинэ жолооч бүртгэх</span>
                        </>
                      ) : (
                        <>
                          <User className="w-4 h-4 text-[#0878bd]" />
                          <span>Жолоочийн тохиргоо: {selectedDriver?.name} ({selectedDriver?.id})</span>
                        </>
                      )}
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      {isCreatingNew ? "Шинэ жолоочийн код болон мэдээллийг оруулна уу" : "Оноосон машин, утас, худалдааны төлөөлөгчийг засах"}
                    </p>
                  </div>

                  {selectedDriver && !isCreatingNew && (
                    <button
                      type="button"
                      onClick={() => handleDelete(selectedDriver.id)}
                      className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors"
                      title="Системээс устгах"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Устгах</span>
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                      Жолоочийн код (ID) *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Жишээ: M16, KA1, M26"
                      value={formCode}
                      onChange={(e) => setFormCode(e.target.value.toUpperCase())}
                      disabled={!!selectedDriver && !isCreatingNew}
                      className="w-full h-10 px-3 rounded-xl border border-slate-300 bg-white text-slate-900 text-xs font-black focus:outline-none focus:ring-2 focus:ring-[#0878bd] disabled:bg-slate-100 uppercase font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                      Овог Нэр *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Жишээ: Дэнэ-Чулуун"
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      className="w-full h-10 px-3 rounded-xl border border-slate-300 bg-white text-slate-900 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-[#0878bd]"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                      Утасны дугаар
                    </label>
                    <input
                      type="text"
                      placeholder="Жишээ: 90636371"
                      value={formPhone}
                      onChange={(e) => setFormPhone(e.target.value)}
                      className="w-full h-10 px-3 rounded-xl border border-slate-300 bg-white text-slate-900 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#0878bd]"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                      Машины улсын дугаар
                    </label>
                    <input
                      type="text"
                      placeholder="Жишээ: 2611 УЕВ"
                      value={formVehicle}
                      onChange={(e) => setFormVehicle(e.target.value.toUpperCase())}
                      className="w-full h-10 px-3 rounded-xl border border-slate-300 bg-white text-slate-900 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-[#0878bd] uppercase font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                      Машины марк / загвар
                    </label>
                    <input
                      type="text"
                      placeholder="Жишээ: Isuzu NPR 75"
                      value={formModel}
                      onChange={(e) => setFormModel(e.target.value)}
                      className="w-full h-10 px-3 rounded-xl border border-slate-300 bg-white text-slate-900 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#0878bd]"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                      Хариуцсан борлуулалтын төлөөлөгч
                    </label>
                    <input
                      type="text"
                      placeholder="Жишээ: До.Дэмбэрэл"
                      value={formSalesRep}
                      onChange={(e) => setFormSalesRep(e.target.value)}
                      className="w-full h-10 px-3 rounded-xl border border-slate-300 bg-white text-slate-900 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#0878bd]"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                      Үндсэн чиглэл / Маршрутын бүс
                    </label>
                    <input
                      type="text"
                      placeholder="Жишээ нь: Бэлх, Сэлх, Дамба, Тоосгоны үйлдвэр, Япон цэрэг, Дарь эх"
                      value={formDefaultRoute}
                      onChange={(e) => setFormDefaultRoute(e.target.value)}
                      className="w-full h-10 px-3 rounded-xl border border-slate-300 bg-white text-slate-900 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#0878bd]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                    Төлөв
                  </label>
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-1.5 cursor-pointer text-xs font-bold text-slate-800">
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
                    <label className="flex items-center gap-1.5 cursor-pointer text-xs font-bold text-slate-500">
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
                    className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200 transition-colors"
                  >
                    Болих
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-5 py-2 rounded-xl bg-[#0878bd] hover:bg-[#076ba8] text-white text-xs font-black shadow-md shadow-sky-900/10 flex items-center gap-1.5 disabled:opacity-50 transition-all"
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
                  Зүүн жагсаалтаас засах жолоочоо сонгох эсвэл "Шинэ жолооч нэмэх" товчийг дарж бүртгэл үүсгэнэ үү.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
