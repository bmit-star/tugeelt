import React, { useState } from "react";
import { 
  Package, 
  Search, 
  Filter, 
  Plus, 
  Share2, 
  Truck, 
  Edit3, 
  Trash2, 
  Check, 
  Copy, 
  ExternalLink,
  MapPin,
  Calendar,
  Layers,
  AlertCircle,
  FileText,
  Download,
  Box
} from "lucide-react";
import { IMDOrder, IMDOrderStatus, Driver } from "../../types";
import { api } from "../../services/api";
import { 
  PROVINCE_ROUTES_LIST, 
  findProvinceRoute, 
  calculateMealAllowance, 
  MEAL_RATE_PER_PERSON 
} from "../../constants/provinceRoutes";
import { getVehicleBoxCapacity } from "../../constants/imdConstants";

interface Props {
  orders: IMDOrder[];
  drivers?: Driver[];
  loading: boolean;
  onRefresh: () => void;
  onCreateOrder: (order: Partial<IMDOrder>) => Promise<void>;
  onUpdateOrder: (id: string, order: Partial<IMDOrder>) => Promise<void>;
  onDeleteOrder: (id: string) => Promise<void>;
  onAssignOrder: (order: IMDOrder) => void;
  onShowToast: (msg: string, type: "success" | "error" | "info") => void;
}

export const IMDOrdersTab: React.FC<Props> = ({
  orders,
  drivers = [],
  loading,
  onRefresh,
  onCreateOrder,
  onUpdateOrder,
  onDeleteOrder,
  onAssignOrder,
  onShowToast
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [provinceFilter, setProvinceFilter] = useState<string>("all");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [letterGeneratingId, setLetterGeneratingId] = useState<string | null>(null);

  const handleGenerateLetterForOrder = async (order: IMDOrder, force = false) => {
    setLetterGeneratingId(order.id);
    try {
      const res = await api.generateIMDOfficialLetter({
        orderId: order.id,
        assignmentId: order.assignmentId,
        forceRegenerate: force
      });
      if (res.success) {
        onShowToast(`№ ${res.letter.dugaar} албан бичиг амжилттай үүслээ`, "success");
        onRefresh();
      }
    } catch (err: any) {
      onShowToast(err.message || "Албан бичиг үүсгэхэд алдаа гарлаа", "error");
    } finally {
      setLetterGeneratingId(null);
    }
  };

  // 8 Official IMD Eligible Drivers Filter
  const OFFICIAL_IMD_CODES = ["775", "141", "9726", "14", "173", "314", "283", "5535"];
  const imdDrivers = (drivers || []).filter(d => 
    d.isIMD || 
    OFFICIAL_IMD_CODES.includes(String(d.code)) || 
    OFFICIAL_IMD_CODES.includes(String(d.id))
  );

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingOrder, setEditingOrder] = useState<IMDOrder | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Form Fields - Order registration as explicitly specified:
  // Жолооч, машин, хамт явах жолооч, чиглэл (шууд км ба хоол гарна), захиалга ирсэн/гарсан огноо
  const [primaryDriverId, setPrimaryDriverId] = useState("");
  const [primaryDriverName, setPrimaryDriverName] = useState("");
  const [vehiclePlate, setVehiclePlate] = useState("");
  const [substituteDriverId, setSubstituteDriverId] = useState("");
  const [substituteDriverName, setSubstituteDriverName] = useState("");
  const [selectedRouteDest, setSelectedRouteDest] = useState("Эрдэнэт");
  const [roundTripKm, setRoundTripKm] = useState<number>(742);
  const [mealCount, setMealCount] = useState<number>(3);
  const [receivedDate, setReceivedDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [deliveryDate, setDeliveryDate] = useState(() => new Date().toISOString().split("T")[0]);

  // Order Details
  const [orderNo, setOrderNo] = useState("");
  const [customer, setCustomer] = useState("");
  const [customerOrg, setCustomerOrg] = useState("");
  const [province, setProvince] = useState("Орхон");
  const [destination, setDestination] = useState("Эрдэнэт");
  const [quantity, setQuantity] = useState<number>(1000);
  const [unitPrice, setUnitPrice] = useState<number>(1000);
  const [note, setNote] = useState("");
  const [status, setStatus] = useState<IMDOrderStatus>("Шинэ");

  // Calculated meal allowance: mealCount * 25,000₮ * (hasSubstitute ? 2 : 1)
  const driverCount = substituteDriverId ? 2 : 1;
  const calculatedMealAllowance = (mealCount || 3) * MEAL_RATE_PER_PERSON * driverCount;

  const handlePrimaryDriverChange = (driverId: string) => {
    setPrimaryDriverId(driverId);
    const found = imdDrivers.find(d => String(d.id) === driverId || String(d.code) === driverId);
    if (found) {
      setPrimaryDriverName(found.name);
      setVehiclePlate(found.vehicle || "");
      if (found.vehicle) {
        const cap = getVehicleBoxCapacity(found.vehicle, drivers);
        if (!editingOrder && cap > 0) {
          setQuantity(cap);
        }
      }
    }
  };

  const handleSubstituteDriverChange = (driverId: string) => {
    setSubstituteDriverId(driverId);
    const found = imdDrivers.find(d => String(d.id) === driverId || String(d.code) === driverId);
    setSubstituteDriverName(found ? found.name : "");
  };

  const handleRouteChange = (destName: string) => {
    setSelectedRouteDest(destName);
    const matched = findProvinceRoute(destName) || PROVINCE_ROUTES_LIST.find(r => r.destination === destName);
    if (matched) {
      setProvince(matched.province);
      setDestination(matched.destination);
      setRoundTripKm(matched.roundTripKm);
      setMealCount(matched.mealCount);
    } else {
      setDestination(destName);
    }
  };

  const openCreateModal = () => {
    setEditingOrder(null);
    setOrderNo(`IMD-${new Date().getMonth() + 1}${String(Math.floor(Math.random() * 900) + 100)}`);
    setCustomer("");
    setCustomerOrg("");
    setReceivedDate(new Date().toISOString().split("T")[0]);
    setDeliveryDate(new Date().toISOString().split("T")[0]);

    // Default to first IMD driver or 141 (Ми.Анхбаяр, 3147УЕН)
    const firstDrv = imdDrivers[0];
    if (firstDrv) {
      setPrimaryDriverId(String(firstDrv.id || firstDrv.code));
      setPrimaryDriverName(firstDrv.name);
      setVehiclePlate(firstDrv.vehicle || "3147 УЕН");
    } else {
      setPrimaryDriverId("141");
      setPrimaryDriverName("Ми.Анхбаяр");
      setVehiclePlate("3147 УЕН");
    }

    setSubstituteDriverId("");
    setSubstituteDriverName("");

    // Default route: Эрдэнэт (3 хоол, 742 км)
    const defaultRoute = PROVINCE_ROUTES_LIST[0];
    setSelectedRouteDest(defaultRoute.destination);
    setProvince(defaultRoute.province);
    setDestination(defaultRoute.destination);
    setRoundTripKm(defaultRoute.roundTripKm);
    setMealCount(defaultRoute.mealCount);

    setQuantity(1000);
    setUnitPrice(1000);
    setNote("");
    setStatus("Шинэ");
    setShowModal(true);
  };

  const openEditModal = (order: IMDOrder) => {
    setEditingOrder(order);
    setOrderNo(order.orderNo);
    setCustomer(order.customer);
    setCustomerOrg(order.customerOrg || "");
    setReceivedDate(order.receivedDate);
    setDeliveryDate(order.deliveryDate);
    setProvince(order.province);
    setDestination(order.destination);
    setQuantity(order.quantity);
    setUnitPrice(order.unitPrice || 1000);
    setNote(order.note || "");
    setStatus(order.status);

    setPrimaryDriverId(order.primaryDriverId || "");
    setPrimaryDriverName(order.primaryDriverName || "");
    setVehiclePlate(order.vehiclePlate || "");
    setSubstituteDriverId(order.substituteDriverId || "");
    setSubstituteDriverName(order.substituteDriverName || "");

    const matched = findProvinceRoute(order.destination || order.province);
    setSelectedRouteDest(matched ? matched.destination : (order.destination || order.province));
    setRoundTripKm(order.roundTripKm || (matched ? matched.roundTripKm : 0));
    setMealCount(order.mealCount || (matched ? matched.mealCount : 3));

    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderNo || !customer || !destination) {
      onShowToast("Захиалгын дугаар, харилцагч, чиглэл шаардлагатай", "error");
      return;
    }

    setSubmitting(true);
    try {
      const payload: Partial<IMDOrder> = {
        orderNo,
        customer,
        customerOrg,
        receivedDate,
        deliveryDate,
        province,
        destination: destination || province,
        quantity: Number(quantity) || 0,
        unitPrice: Number(unitPrice) || 0,
        note,
        status,
        primaryDriverId: primaryDriverId || undefined,
        primaryDriverName: primaryDriverName || undefined,
        vehiclePlate: vehiclePlate ? vehiclePlate.trim().toUpperCase() : undefined,
        substituteDriverId: substituteDriverId || undefined,
        substituteDriverName: substituteDriverName || undefined,
        roundTripKm: Number(roundTripKm) || undefined,
        mealCount: Number(mealCount) || undefined,
        mealAllowance: calculatedMealAllowance
      };

      if (editingOrder) {
        await onUpdateOrder(editingOrder.id, payload);
        onShowToast("Захиалга амжилттай шинэчлэгдлээ", "success");
      } else {
        await onCreateOrder(payload);
        onShowToast("Шинэ захиалга амжилттай бүртгэгдлээ", "success");
      }
      setShowModal(false);
      onRefresh();
    } catch (err: any) {
      onShowToast(err.message, "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopyShareLink = (order: IMDOrder) => {
    const origin = window.location.origin;
    const shareUrl = `${origin}/order/imd/${order.shareToken}`;
    navigator.clipboard.writeText(shareUrl);
    setCopiedId(order.id);
    onShowToast(`Харилцагчийн хуваалцах линк хуулагдлаа: ${shareUrl}`, "success");
    setTimeout(() => setCopiedId(null), 2500);
  };

  // Provinces List
  const PROVINCES = [
    "Хөвсгөл", "Дорноговь", "Дархан-Уул", "Сэлэнгэ", "Өмнөговь", "Орхон", 
    "Ховд", "Баян-Өлгий", "Увс", "Завхан", "Говь-Алтай", "Баянхонгор", 
    "Архангай", "Өвөрхангай", "Төв", "Сүхбаатар", "Дорнод", "Хэнтий", 
    "Булган", "Дундговь", "Говьсүмбэр"
  ];

  // Filtering
  const filteredOrders = orders.filter((o) => {
    if (statusFilter !== "all" && o.status !== statusFilter) return false;
    if (provinceFilter !== "all" && o.province !== provinceFilter) return false;
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      const match =
        o.orderNo.toLowerCase().includes(q) ||
        o.customer.toLowerCase().includes(q) ||
        (o.customerOrg && o.customerOrg.toLowerCase().includes(q)) ||
        o.province.toLowerCase().includes(q) ||
        o.destination.toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });

  return (
    <div className="space-y-4">
      {/* Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
            <Package className="w-5 h-5 text-[#0878bd]" />
            <span>Захиалгын Нэгдсэн Бүртгэл</span>
            <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 text-xs font-black">
              {filteredOrders.length}
            </span>
          </h2>
          <p className="text-slate-400 text-xs mt-0.5">
            Харилцагчийн захиалга бүртгэх, нэг товшилтоор томилолт хуваарилах, хянах холбоос илгээх
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={openCreateModal}
            className="px-4 py-2.5 rounded-xl bg-[#0878bd] hover:bg-[#0769a6] text-white text-xs font-bold flex items-center gap-2 shadow-xs transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>+ Шинэ захиалга</span>
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 flex-1">
          {/* Search */}
          <div className="relative min-w-[220px] flex-1 max-w-sm">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Захиалгын дугаар, харилцагч, аймаг..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs font-medium focus:border-blue-500 outline-none"
            />
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1.5 rounded-xl border border-slate-200">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-transparent text-xs font-bold text-slate-700 outline-none cursor-pointer"
            >
              <option value="all">Бүх төлөв ({orders.length})</option>
              <option value="Шинэ">Шинэ</option>
              <option value="Хүлээгдэж буй">Хүлээгдэж буй</option>
              <option value="Томилолт хуваарилагдсан">Томилолт хуваарилагдсан</option>
              <option value="Тээвэрт гарсан">Тээвэрт гарсан</option>
              <option value="Дууссан">Дууссан</option>
              <option value="Цуцлагдсан">Цуцлагдсан</option>
            </select>
          </div>

          {/* Province Filter */}
          <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1.5 rounded-xl border border-slate-200">
            <MapPin className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={provinceFilter}
              onChange={(e) => setProvinceFilter(e.target.value)}
              className="bg-transparent text-xs font-bold text-slate-700 outline-none cursor-pointer"
            >
              <option value="all">Бүх аймаг</option>
              {PROVINCES.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
        </div>

        <button
          onClick={onRefresh}
          className="text-xs font-bold text-slate-500 hover:text-slate-800 px-3 py-1.5 rounded-xl hover:bg-slate-100"
        >
          Шинэчлэх
        </button>
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-black uppercase text-slate-500 tracking-wider">
                <th className="py-3 px-4">Захиалгын №</th>
                <th className="py-3 px-4">Харилцагч / Байгууллага</th>
                <th className="py-3 px-4">Аймаг / Чиглэл</th>
                <th className="py-3 px-4 text-right">Хайрцаг</th>
                <th className="py-3 px-4">Огноо (Ирсэн / Хүргэх)</th>
                <th className="py-3 px-4 text-center">Төлөв</th>
                <th className="py-3 px-4 text-right">Үйлдлүүд</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <AlertCircle className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    <p className="font-semibold">Захиалга олдсонгүй</p>
                    <button
                      onClick={openCreateModal}
                      className="mt-2 text-xs font-bold text-[#0878bd] hover:underline"
                    >
                      + Шинэ захиалга нэмэх
                    </button>
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order) => {
                  const isAssigned = order.status === "Томилолт хуваарилагдсан" || order.status === "Тээвэрт гарсан" || order.status === "Дууссан";
                  return (
                    <tr key={order.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4 font-mono font-black text-slate-900">
                        {order.orderNo}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-800">{order.customer}</div>
                        {order.customerOrg && (
                          <div className="text-[11px] text-slate-400">{order.customerOrg}</div>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-blue-800">{order.province}</div>
                        <div className="text-[11px] text-slate-500">{order.destination}</div>
                      </td>
                      <td className="py-3 px-4 text-right font-black text-slate-800">
                        {order.quantity.toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-[11px] text-slate-600">
                        <div>Ирсэн: {order.receivedDate}</div>
                        <div className="text-slate-400">Хүргэх: {order.deliveryDate}</div>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-black ${
                          order.status === "Дууссан"
                            ? "bg-emerald-100 text-emerald-800"
                            : order.status === "Тээвэрт гарсан"
                            ? "bg-blue-100 text-blue-800 animate-pulse"
                            : order.status === "Томилолт хуваарилагдсан"
                            ? "bg-indigo-100 text-indigo-800"
                            : "bg-amber-100 text-amber-800"
                        }`}>
                          {order.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* One-Click Assign Button */}
                          {!isAssigned ? (
                            <button
                              onClick={() => onAssignOrder(order)}
                              title="Нэг товшилтоор томилолт хуваарилах"
                              className="px-2.5 py-1 rounded-lg bg-[#0878bd] hover:bg-[#0769a6] text-white text-[11px] font-bold shadow-2xs flex items-center gap-1"
                            >
                              <Truck className="w-3.5 h-3.5" />
                              <span>Томилох</span>
                            </button>
                          ) : (
                            <button
                              onClick={() => onAssignOrder(order)}
                              title="Томилолт харах"
                              className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold"
                            >
                              Томилогдсон
                            </button>
                          )}

                          {/* Share Link for Customer */}
                          <button
                            onClick={() => handleCopyShareLink(order)}
                            title="Харилцагчид илгээх линк хуулах"
                            className="p-1.5 rounded-lg border border-slate-200 hover:bg-blue-50 text-slate-600 hover:text-blue-600 transition-colors"
                          >
                            {copiedId === order.id ? (
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <Share2 className="w-3.5 h-3.5" />
                            )}
                          </button>

                          {/* Open Customer Public View */}
                          <a
                            href={`/order/imd/${order.shareToken}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Харилцагчийн харагдацыг нээх"
                            className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>

                          {/* Official Letter Button */}
                          {order.albanBichigStatus === "DONE" ? (
                            <div className="flex items-center gap-1">
                              <a
                                href={order.albanBichigPdfUrl || `/api/imd/official-letters/${order.albanBichigId || order.id}/view`}
                                target="_blank"
                                rel="noreferrer"
                                title={`Албан бичиг № ${order.albanBichigDugaar || ""} харах`}
                                className="px-2 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-[11px] font-bold text-blue-700 flex items-center gap-1 border border-blue-200 transition-colors"
                              >
                                <FileText className="w-3 h-3 text-blue-600" />
                                <span>№ {order.albanBichigDugaar || "Бичиг"}</span>
                              </a>
                              <a
                                href={`/api/imd/official-letters/${order.albanBichigId || order.id}/download`}
                                download
                                title="PDF татах"
                                className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600"
                              >
                                <Download className="w-3 h-3 text-slate-600" />
                              </a>
                            </div>
                          ) : (
                            <button
                              onClick={() => handleGenerateLetterForOrder(order)}
                              disabled={letterGeneratingId === order.id}
                              title="Албан бичиг үүсгэх"
                              className="px-2 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 text-[11px] font-bold border border-blue-200 flex items-center gap-1 disabled:opacity-50 transition-colors"
                            >
                              <FileText className={`w-3 h-3 ${letterGeneratingId === order.id ? "animate-spin" : ""}`} />
                              <span>{letterGeneratingId === order.id ? "Үүсгэж байна..." : "Бичиг"}</span>
                            </button>
                          )}

                          {/* Edit */}
                          <button
                            onClick={() => openEditModal(order)}
                            title="Засах"
                            className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>

                          {/* Delete */}
                          <button
                            onClick={() => {
                              if (confirm(`Та "${order.orderNo}" захиалгыг устгахдаа итгэлтэй байна уу?`)) {
                                onDeleteOrder(order.id);
                              }
                            }}
                            title="Устгах"
                            className="p-1.5 rounded-lg border border-slate-200 hover:bg-rose-50 text-slate-400 hover:text-rose-600"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE / EDIT ORDER MODAL */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-xl w-full p-5 sm:p-6 shadow-2xl border border-slate-100 space-y-4 animate-in fade-in zoom-in duration-150 my-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-sky-100 text-[#0878bd] flex items-center justify-center font-bold">
                  <Package className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    {editingOrder ? "Захиалга засварлах" : "Шинэ захиалга бүртгэх"}
                  </h3>
                  <p className="text-[11px] text-slate-500">Жолооч, машин, чиглэл, км болон хоолны нормын тооцоолол</p>
                </div>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="w-8 h-8 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 flex items-center justify-center font-bold text-base transition-colors"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
              {/* 1. Жолооч & Машин & Сэлгээ жолооч */}
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
                <span className="text-[11px] font-black uppercase text-slate-500 tracking-wide flex items-center gap-1.5">
                  <Truck className="w-3.5 h-3.5 text-[#0878bd]" />
                  <span>1. Тээврийн хэрэгсэл & Жолоочийн бүрэлдэхүүн</span>
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Үндсэн жолооч *</label>
                    <select
                      value={primaryDriverId}
                      onChange={(e) => handlePrimaryDriverChange(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 font-bold outline-none focus:border-blue-500 bg-white"
                    >
                      {imdDrivers.length > 0 ? (
                        imdDrivers.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.name} ({d.vehicle || "Машингүй"})
                          </option>
                        ))
                      ) : (
                        <option value="141">Ми.Анхбаяр (3147 УЕН)</option>
                      )}
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Машин (Улсын дугаар) *</label>
                    <input
                      type="text"
                      required
                      value={vehiclePlate}
                      onChange={(e) => setVehiclePlate(e.target.value)}
                      placeholder="Жишээ: 3147 УЕН"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono font-bold outline-none focus:border-blue-500 bg-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Хамт явах жолооч (Сэлгээ) <span className="text-slate-400 font-normal">- сонголттой</span>
                  </label>
                  <select
                    value={substituteDriverId}
                    onChange={(e) => handleSubstituteDriverChange(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 outline-none focus:border-blue-500 bg-white"
                  >
                    <option value="">-- Ганцаараа явах (Сэлгээ жолоочгүй, 1 жолооч) --</option>
                    {imdDrivers
                      .filter((d) => String(d.id) !== primaryDriverId && String(d.code) !== primaryDriverId)
                      .map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name} ({d.code || d.id})
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              {/* 2. Чиглэл, КМ & Хоолны давтамж */}
              <div className="p-3.5 rounded-2xl bg-sky-50/60 border border-sky-200/80 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-black uppercase text-[#123047] tracking-wide flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-[#0878bd]" />
                    <span>2. Чиглэл & Авто замын норм</span>
                  </span>
                  <span className="text-[10px] font-bold text-[#0878bd] bg-white px-2 py-0.5 rounded-md border border-sky-200">
                    24 Албан ёсны чиглэл
                  </span>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Чиглэл сонгох (Аймаг / Сум) *</label>
                  <select
                    value={selectedRouteDest}
                    onChange={(e) => handleRouteChange(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-sky-300 font-bold outline-none focus:border-blue-600 bg-white text-slate-900 shadow-2xs"
                  >
                    {PROVINCE_ROUTES_LIST.map((r) => (
                      <option key={r.id} value={r.destination}>
                        {r.destination} ({r.province}) — {r.roundTripKm} км / {r.mealCount} хоол
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Яваад ирэх албан ёсны зай (Км)</label>
                    <div className="relative">
                      <input
                        type="number"
                        value={roundTripKm}
                        onChange={(e) => setRoundTripKm(Number(e.target.value))}
                        className="w-full pl-3 pr-10 py-2 rounded-xl border border-sky-200 font-mono font-black text-[#123047] bg-white outline-none"
                      />
                      <span className="absolute right-3 top-2 text-slate-400 font-bold">км</span>
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Батлагдсан хоолны давтамж</label>
                    <div className="relative">
                      <input
                        type="number"
                        value={mealCount}
                        onChange={(e) => setMealCount(Number(e.target.value))}
                        className="w-full pl-3 pr-10 py-2 rounded-xl border border-sky-200 font-mono font-black text-[#123047] bg-white outline-none"
                      />
                      <span className="absolute right-3 top-2 text-slate-400 font-bold">удаа</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* 3. Огнооны бүртгэл */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Захиалга ирсэн огноо *</label>
                  <input
                    type="date"
                    required
                    value={receivedDate}
                    onChange={(e) => setReceivedDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 font-bold outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Захиалга гарсан огноо (Хүргэх) *</label>
                  <input
                    type="date"
                    required
                    value={deliveryDate}
                    onChange={(e) => setDeliveryDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 font-bold outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* 4. Амьд Хоолны зардал & КМ бодолтын хураангуй карт */}
              <div className="p-3.5 rounded-2xl bg-gradient-to-br from-amber-50 to-orange-50/60 border border-amber-200/90 space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-amber-950">
                  <span className="flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 text-amber-600" />
                    <span>Хоолны зардал & Замын хуудасны тооцоолол</span>
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-amber-200/80 text-amber-900 text-[11px] font-black">
                    {driverCount} жолооч
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px] pt-1 border-t border-amber-200/60">
                  <div>
                    <span className="text-slate-500 block">Норм / Хүн:</span>
                    <span className="font-bold text-slate-800">
                      {mealCount} удаа x {MEAL_RATE_PER_PERSON.toLocaleString()}₮ = {(mealCount * MEAL_RATE_PER_PERSON).toLocaleString()}₮
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Жолоочийн тоо:</span>
                    <span className="font-bold text-slate-800">
                      {driverCount === 2 ? "2 жолооч (x2 үржигдэнэ)" : "1 жолооч (ганцаараа)"}
                    </span>
                  </div>
                </div>

                <div className="pt-2 border-t border-amber-200/60 flex items-center justify-between">
                  <span className="text-xs font-black text-amber-950">
                    Жолоочийн замын хуудсанд харагдах нийт хоолны мөнгө:
                  </span>
                  <span className="text-sm font-black font-mono text-emerald-700 bg-white px-2.5 py-1 rounded-lg border border-emerald-200 shadow-2xs">
                    {calculatedMealAllowance.toLocaleString()} ₮
                  </span>
                </div>
              </div>

              {/* 5. Захиалгын ерөнхий мэдээлэл (№, Төлөв, Харилцагч, Хайрцаг) */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Захиалгын № *</label>
                  <input
                    type="text"
                    required
                    value={orderNo}
                    onChange={(e) => setOrderNo(e.target.value)}
                    placeholder="Жишээ: IMD-0901"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono font-bold outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Төлөв</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as IMDOrderStatus)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 font-bold outline-none focus:border-blue-500 bg-white"
                  >
                    <option value="Шинэ">Шинэ</option>
                    <option value="Хүлээгдэж буй">Хүлээгдэж буй</option>
                    <option value="Томилолт хуваарилагдсан">Томилолт хуваарилагдсан</option>
                    <option value="Тээвэрт гарсан">Тээвэрт гарсан</option>
                    <option value="Дууссан">Дууссан</option>
                    <option value="Цуцлагдсан">Цуцлагдсан</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Харилцагчийн нэр *</label>
                  <input
                    type="text"
                    required
                    value={customer}
                    onChange={(e) => setCustomer(e.target.value)}
                    placeholder="Жишээ: Хөвсгөл Их Тамир ХХК"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 font-bold outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Салбар нэгж / Байгууллага</label>
                  <input
                    type="text"
                    value={customerOrg}
                    onChange={(e) => setCustomerOrg(e.target.value)}
                    placeholder="Жишээ: Аймгийн Төв Салбар"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block font-bold text-slate-700">Хэмжээ (Хайрцаг) *</label>
                    {vehiclePlate && (
                      <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-1.5 py-0.2 rounded border border-blue-200">
                        {getVehicleBoxCapacity(vehiclePlate, drivers)} багтаамж
                      </span>
                    )}
                  </div>
                  <input
                    type="number"
                    min={1}
                    required
                    value={quantity}
                    onChange={(e) => setQuantity(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono font-bold outline-none focus:border-blue-500"
                  />
                  <div className="flex items-center gap-1 mt-1 flex-wrap">
                    {[700, 1000, 1500].map((cap) => (
                      <button
                        key={cap}
                        type="button"
                        onClick={() => setQuantity(cap)}
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold font-mono transition-colors ${
                          quantity === cap 
                            ? "bg-amber-600 text-white" 
                            : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                        }`}
                      >
                        {cap}
                      </button>
                    ))}
                    {vehiclePlate && (
                      <button
                        type="button"
                        onClick={() => setQuantity(getVehicleBoxCapacity(vehiclePlate, drivers))}
                        className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900 hover:bg-amber-200"
                      >
                        Машинаар
                      </button>
                    )}
                  </div>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Нэгж үнэ (₮)</label>
                  <input
                    type="number"
                    value={unitPrice}
                    onChange={(e) => setUnitPrice(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Тэмдэглэл / Анхааруулга</label>
                <textarea
                  rows={2}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Жишээ: Эмзэг бүтээгдэхүүн, температурын хяналттай"
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
                  {submitting ? "Хадгалж байна..." : editingOrder ? "Шинэчлэх" : "Бүртгэх"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
