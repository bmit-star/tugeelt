import React, { useState, useEffect } from "react";
import { 
  Truck, 
  Search, 
  Filter, 
  Plus, 
  Calendar, 
  Users, 
  MapPin, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  ExternalLink, 
  Edit3, 
  Trash2, 
  Copy, 
  Check,
  CheckSquare,
  Square,
  FileSpreadsheet,
  FileText,
  Download,
  Eye,
  X,
  Box
} from "lucide-react";
import { IMDAssignment, IMDOrder, Driver } from "../../types";
import { OFFICIAL_IMD_ROUTES, getVehicleBoxCapacity, IMD_VEHICLE_BOX_CAPACITIES } from "../../constants/imdConstants";
import { api } from "../../services/api";

interface Props {
  assignments: IMDAssignment[];
  orders: IMDOrder[];
  drivers: Driver[];
  loading: boolean;
  preselectedOrder?: IMDOrder | null;
  onClearPreselectedOrder?: () => void;
  triggerCreateModal?: boolean;
  onResetTriggerCreate?: () => void;
  onRefresh: () => void;
  onCreateAssignment: (data: Partial<IMDAssignment> & { force?: boolean }) => Promise<void>;
  onUpdateAssignment: (id: string, data: Partial<IMDAssignment>) => Promise<void>;
  onDeleteAssignment: (id: string) => Promise<void>;
  onOpenDriverWaybill?: (driverId: string) => void;
  onNavigateToLetters?: () => void;
  onShowToast: (msg: string, type: "success" | "error" | "info") => void;
}

export const IMDAssignmentsTab: React.FC<Props> = ({
  assignments,
  orders,
  drivers,
  loading,
  preselectedOrder,
  onClearPreselectedOrder,
  triggerCreateModal,
  onResetTriggerCreate,
  onRefresh,
  onCreateAssignment,
  onUpdateAssignment,
  onDeleteAssignment,
  onOpenDriverWaybill,
  onNavigateToLetters,
  onShowToast
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<string>("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [letterGeneratingId, setLetterGeneratingId] = useState<string | null>(null);
  const [generatedLetterModal, setGeneratedLetterModal] = useState<{ letter: any; asn: IMDAssignment } | null>(null);

  const handleGenerateLetterForAssignment = async (asn: IMDAssignment, force = false) => {
    setLetterGeneratingId(asn.id);
    try {
      const res = await api.generateIMDOfficialLetter({
        assignmentId: asn.id,
        orderId: asn.orderId,
        forceRegenerate: force
      });
      if (res.success && res.letter) {
        onShowToast(`№ ${res.letter.dugaar} албан бичиг амжилттай үүслээ`, "success");
        setGeneratedLetterModal({ letter: res.letter, asn });
        onRefresh();
      }
    } catch (err: any) {
      onShowToast(err.message || "Албан бичиг үүсгэхэд алдаа гарлаа", "error");
    } finally {
      setLetterGeneratingId(null);
    }
  };

  const handleConfirmAssignment = async (asn: IMDAssignment) => {
    setConfirmingId(asn.id);
    try {
      const res = await api.confirmIMDAssignment(asn.id, {
        actualKm: asn.actualKm,
        startOdo: asn.startOdo,
        endOdo: asn.endOdo
      });
      onShowToast(
        res.message || `Томилолт амжилттай баталгаажлаа. Замын хуудсанд ${asn.departureDate}-ны өдөр чиглэл, одометр бичигдлээ.`,
        "success"
      );
      onRefresh();
    } catch (err: any) {
      onShowToast(err.message || "Томилолт баталгаажуулахад алдаа гарлаа", "error");
    } finally {
      setConfirmingId(null);
    }
  };

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState<IMDAssignment | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [conflictWarning, setConflictWarning] = useState<string | null>(null);
  const [forceSubmit, setForceSubmit] = useState(false);

  // Form Fields
  const [selectedOrderId, setSelectedOrderId] = useState<string>("");
  const [selectedVehiclePlate, setSelectedVehiclePlate] = useState<string>("");
  const [selectedPrimaryDriverId, setSelectedPrimaryDriverId] = useState<string>("");
  const [selectedSubDriverId, setSelectedSubDriverId] = useState<string>("");
  const [departureDate, setDepartureDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [returnDate, setReturnDate] = useState("");
  const [quantity, setQuantity] = useState<number>(1000);
  const [province, setProvince] = useState("Хөвсгөл");
  const [destination, setDestination] = useState("Мөрөн, Хатгал");
  const [routeKm, setRouteKm] = useState<number>(1620);
  const [status, setStatus] = useState<"Төлөвлөсөн" | "Тээвэрт гарсан" | "Дууссан" | "Цуцлагдсан">("Тээвэрт гарсан");
  const [startOdo, setStartOdo] = useState<string>("");
  const [endOdo, setEndOdo] = useState<string>("");
  const [fuelLiters, setFuelLiters] = useState<string>("");
  const [fuelStation, setFuelStation] = useState<string>("");
  const [note, setNote] = useState("");

  // Handle preselected order trigger from external components
  React.useEffect(() => {
    if (preselectedOrder) {
      openCreateModal(preselectedOrder);
      if (onClearPreselectedOrder) onClearPreselectedOrder();
    }
  }, [preselectedOrder]);

  // Handle external trigger for opening create modal
  React.useEffect(() => {
    if (triggerCreateModal) {
      openCreateModal();
      if (onResetTriggerCreate) onResetTriggerCreate();
    }
  }, [triggerCreateModal]);

  const openCreateModal = (orderToAssign?: IMDOrder) => {
    setEditingAssignment(null);
    setConflictWarning(null);
    setForceSubmit(false);

    const order = orderToAssign || orders.find(o => o.status === "Шинэ" || o.status === "Хүлээгдэж буй") || orders[0];
    if (order) {
      setSelectedOrderId(order.id);
      setProvince(order.province);
      setDestination(order.destination);
      setQuantity(order.quantity);
      setDepartureDate(order.deliveryDate || new Date().toISOString().split("T")[0]);
    } else {
      setSelectedOrderId("");
      setProvince("Хөвсгөл");
      setDestination("Мөрөн, Хатгал");
      setQuantity(1000);
      setDepartureDate(new Date().toISOString().split("T")[0]);
    }

    // Primary driver & vehicle: Selecting primary driver automatically populates the driver's vehicle
    setSelectedPrimaryDriverId("");
    setSelectedVehiclePlate("");
    setSelectedSubDriverId("");

    // Resolve initial route KM
    const targetDest = (order?.destination || order?.province || "Мөрөн").toLowerCase();
    const matched = OFFICIAL_IMD_ROUTES.find(r => 
      targetDest.includes(r.destination.toLowerCase()) || 
      targetDest.includes(r.province.toLowerCase()) ||
      r.destination.toLowerCase().includes(targetDest)
    );
    setRouteKm(matched ? matched.roundTripKm : 1620);

    setReturnDate("");
    setStatus("Тээвэрт гарсан");
    setStartOdo("");
    setEndOdo("");
    setFuelLiters("");
    setFuelStation("");
    setNote("");
    setShowModal(true);
  };

  const openEditModal = (asn: IMDAssignment) => {
    setEditingAssignment(asn);
    setConflictWarning(null);
    setForceSubmit(false);

    setSelectedOrderId(asn.orderId);
    setSelectedVehiclePlate(asn.vehiclePlate);
    setSelectedPrimaryDriverId(asn.primaryDriverId);
    setSelectedSubDriverId(asn.substituteDriverId || "");
    setDepartureDate(asn.departureDate);
    setReturnDate(asn.returnDate || "");
    setQuantity(asn.quantity);
    setProvince(asn.province);
    setDestination(asn.destination);
    setStatus(asn.status);
    setStartOdo(asn.startOdo ? String(asn.startOdo) : "");
    setEndOdo(asn.endOdo ? String(asn.endOdo) : "");
    setFuelLiters(asn.fuelLiters ? String(asn.fuelLiters) : "");
    setFuelStation(asn.fuelStation || "");
    setNote(asn.note || "");

    const targetDest = (asn.destination || asn.province || "").toLowerCase();
    const matched = OFFICIAL_IMD_ROUTES.find(r => 
      targetDest.includes(r.destination.toLowerCase()) || 
      targetDest.includes(r.province.toLowerCase()) ||
      r.destination.toLowerCase().includes(targetDest)
    );
    setRouteKm(asn.actualKm || (matched ? matched.roundTripKm : 0));

    setShowModal(true);
  };

  // Watch for conflict in form inputs
  React.useEffect(() => {
    if (!showModal) return;
    
    // Check if primary driver is booked on departureDate
    if (selectedPrimaryDriverId && departureDate) {
      const conflictAsn = assignments.find(
        a => a.departureDate === departureDate &&
        (a.primaryDriverId === selectedPrimaryDriverId || a.substituteDriverId === selectedPrimaryDriverId) &&
        (!editingAssignment || a.id !== editingAssignment.id)
      );
      if (conflictAsn) {
        setConflictWarning(
          `⚠️ Анхаар: Сонгосон жолооч (${conflictAsn.primaryDriverName}) ${departureDate} өдөр өөр томилолттой (${conflictAsn.orderNo}, ${conflictAsn.province}) байна.`
        );
        return;
      }
    }

    // Check if vehicle is booked on departureDate
    if (selectedVehiclePlate && departureDate) {
      const cleanPlate = selectedVehiclePlate.replace(/\s+/g, "").toUpperCase();
      const conflictVeh = assignments.find(
        a => a.departureDate === departureDate &&
        a.vehiclePlate.replace(/\s+/g, "").toUpperCase() === cleanPlate &&
        (!editingAssignment || a.id !== editingAssignment.id)
      );
      if (conflictVeh) {
        setConflictWarning(
          `⚠️ Анхаар: Машин ${selectedVehiclePlate} ${departureDate} өдөр өөр томилолттой (${conflictVeh.orderNo}, ${conflictVeh.province}) байна.`
        );
        return;
      }
    }

    setConflictWarning(null);
  }, [selectedPrimaryDriverId, selectedVehiclePlate, departureDate, showModal]);

  // 8 Official IMD Drivers (Албан ёсны түгээгчид) & isIMD registered drivers
  const isEligibleIMDDriver = (d: Driver) => {
    const OFFICIAL_IMD_CODES = new Set(["775", "141", "9726", "14", "173", "314", "283", "5535"]);
    const dCode = String(d.code || "").trim();
    const dId = String(d.id || "").trim();
    const dName = String(d.name || "").trim();
    return (
      d.isIMD === true ||
      OFFICIAL_IMD_CODES.has(dCode) ||
      OFFICIAL_IMD_CODES.has(dId) ||
      dName.includes("Алтанхуяг") ||
      dName.includes("Доржпалам") ||
      dName.includes("Мөнхгэрэл") ||
      dName.includes("Мөнгөнзул") ||
      dName.includes("Анхбаяр") ||
      dName.includes("Баттогтох") ||
      dName.includes("Баярсайхан") ||
      dName.includes("Отгонсүх")
    );
  };

  const handlePrimaryDriverChange = (driverId: string) => {
    setSelectedPrimaryDriverId(driverId);
    if (!driverId) {
      setSelectedVehiclePlate("");
      return;
    }
    const drv = drivers.find(d => d.id === driverId || d.code === driverId);
    if (drv?.vehicle) {
      const vPlate = drv.vehicle.trim().toUpperCase();
      setSelectedVehiclePlate(vPlate);
      const cap = getVehicleBoxCapacity(vPlate, drivers);
      if (!editingAssignment) {
        setQuantity(cap);
      }
    }
  };

  const handleVehiclePlateChange = (newPlate: string) => {
    const clean = newPlate.toUpperCase();
    setSelectedVehiclePlate(clean);
    const cap = getVehicleBoxCapacity(clean, drivers);
    if (!editingAssignment && cap > 0) {
      setQuantity(cap);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedVehiclePlate || !selectedPrimaryDriverId || !departureDate) {
      onShowToast("Машин, үндсэн жолооч, гарах огноо заавал шаардлагатай", "error");
      return;
    }

    const primaryDriver = drivers.find(d => d.id === selectedPrimaryDriverId);
    const subDriver = selectedSubDriverId ? drivers.find(d => d.id === selectedSubDriverId) : undefined;
    const cleanPlate = selectedVehiclePlate.trim().toUpperCase();
    const detectedCap = getVehicleBoxCapacity(cleanPlate, drivers);
    const finalQuantity = Number(quantity) > 0 ? Number(quantity) : detectedCap;

    setSubmitting(true);
    try {
      const payload: Partial<IMDAssignment> & { force?: boolean } = {
        orderId: selectedOrderId || undefined,
        vehiclePlate: cleanPlate,
        vehicleId: cleanPlate.replace(/\s+/g, ""),
        vehicleCapacity: detectedCap,
        primaryDriverId: selectedPrimaryDriverId,
        primaryDriverName: primaryDriver?.name || selectedPrimaryDriverId,
        primaryDriverPhone: primaryDriver?.phone,
        substituteDriverId: selectedSubDriverId || undefined,
        substituteDriverName: subDriver?.name || undefined,
        substituteDriverPhone: subDriver?.phone,
        departureDate,
        returnDate: returnDate || undefined,
        quantity: finalQuantity,
        province,
        destination,
        status,
        startOdo: startOdo ? Number(startOdo) : undefined,
        endOdo: endOdo ? Number(endOdo) : undefined,
        actualKm: (endOdo && startOdo) 
          ? (Number(endOdo) - Number(startOdo)) 
          : (routeKm > 0 ? routeKm : undefined),
        fuelLiters: fuelLiters ? Number(fuelLiters) : undefined,
        fuelStation: fuelStation || undefined,
        note,
        force: forceSubmit
      };

      if (editingAssignment) {
        await onUpdateAssignment(editingAssignment.id, payload);
        onShowToast("Томилолт амжилттай шинэчлэгдлээ", "success");
      } else {
        await onCreateAssignment(payload);
        onShowToast("Шинэ томилолт амжилттай хуваарилагдаж, замын хуудастай холбогдлоо", "success");
      }
      setShowModal(false);
      onRefresh();
    } catch (err: any) {
      if (err.conflictType) {
        setConflictWarning(err.message);
        onShowToast(err.message, "error");
      } else {
        onShowToast(err.message, "error");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopyDriverLink = (asn: IMDAssignment) => {
    const origin = window.location.origin;
    const driverUrl = `${origin}/driver/trip/${asn.token}`;
    navigator.clipboard.writeText(driverUrl);
    setCopiedId(asn.id);
    onShowToast(`Жолоочийн харагдах линк хуулагдлаа: ${driverUrl}`, "success");
    setTimeout(() => setCopiedId(null), 2500);
  };

  const [clearingMocks, setClearingMocks] = useState(false);

  // Сонгосон томилолтуудын албан бичгийг 1 PDF болгон нэгтгэн татах сонголт
  const [selectedLetterAsnIds, setSelectedLetterAsnIds] = useState<string[]>([]);
  const [downloadingMerged, setDownloadingMerged] = useState(false);

  // Assignments ачаалагдах үед анхдагчаар бүх томилолтыг сонгох
  useEffect(() => {
    if (assignments.length > 0) {
      setSelectedLetterAsnIds((prev) => {
        if (prev.length === 0) {
          return assignments.map((a) => a.id);
        }
        // Байгаа ID-уудыг хадгалах
        const valid = prev.filter((id) => assignments.some((a) => a.id === id));
        return valid.length > 0 ? valid : assignments.map((a) => a.id);
      });
    } else {
      setSelectedLetterAsnIds([]);
    }
  }, [assignments]);

  const handleToggleSelectAllLetters = () => {
    const currentFilteredIds = filteredAssignments.map((a) => a.id);
    const allInFilteredSelected =
      currentFilteredIds.length > 0 &&
      currentFilteredIds.every((id) => selectedLetterAsnIds.includes(id));

    if (allInFilteredSelected) {
      setSelectedLetterAsnIds((prev) => prev.filter((id) => !currentFilteredIds.includes(id)));
    } else {
      setSelectedLetterAsnIds((prev) => Array.from(new Set([...prev, ...currentFilteredIds])));
    }
  };

  const handleToggleLetterAsn = (id: string) => {
    setSelectedLetterAsnIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleDownloadMergedLetters = () => {
    if (selectedLetterAsnIds.length === 0) {
      onShowToast("Та нэгтгэх албан бичгүүдээ чеклэж сонгоно уу!", "info");
      return;
    }
    setDownloadingMerged(true);
    try {
      const a = document.createElement("a");
      const query = `?ids=${encodeURIComponent(selectedLetterAsnIds.join(","))}`;
      a.href = `/api/imd/official-letters/download-all-merged${query}`;
      const dateStr = new Date().toISOString().split("T")[0];
      a.download =
        selectedLetterAsnIds.length === assignments.length
          ? `IMD_Niit_Alban_Bichig_${dateStr}.pdf`
          : `IMD_Songoson_${selectedLetterAsnIds.length}_Alban_Bichig_${dateStr}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      onShowToast(
        selectedLetterAsnIds.length === assignments.length
          ? "Нийт бүх албан бичгийг 1 PDF файл болгон нэгтгэж татаж байна..."
          : `Чеклэж сонгосон ${selectedLetterAsnIds.length} албан бичгийг 1 PDF файл болгон нэгтгэж татаж байна...`,
        "success"
      );
    } catch (err: any) {
      onShowToast("Нэгтгэн татахад алдаа гарлаа: " + err.message, "error");
    } finally {
      setTimeout(() => setDownloadingMerged(false), 1500);
    }
  };

  const handleClearMockAssignments = async () => {
    // Үнэн бодит зохиомол өгөгдөл байгаа эсэхийг тооцоолох
    const mockAssignments = assignments.filter((a: any) => 
      a.isMock === true || a.isSample === true || a.isTest === true ||
      a.token?.includes("khv_0903") || a.token?.includes("dornogovi_0902") ||
      a.id?.startsWith("MOCK-") || a.orderNo?.startsWith("MOCK-") ||
      a.id?.startsWith("asn_ord_imd_260915_") ||
      (a.orderNo && a.orderNo.startsWith("ORD-IMD-260915-") && (a.token?.startsWith("tok_") || a.id?.startsWith("asn_ord_imd_260915_")))
    );

    if (mockAssignments.length === 0) {
      onShowToast(`Системд зохиомол томилолт байхгүй байна. Таны бүртгэсэн үндсэн ${assignments.length} томилолт бүрэн бүтэн хадгалагдсан.`, "info");
      return;
    }

    if (!window.confirm(`Зохиомол (${mockAssignments.length}) томилолтыг устгах уу?\n\nТаны үндсэн бүртгэсэн ${assignments.length - mockAssignments.length} томилолт огт устахгүй, найдвартай үлдэнэ.`)) {
      return;
    }
    setClearingMocks(true);
    try {
      const res = await api.clearIMDMockAssignments();
      onShowToast(res.message || "Зохиомол томилолтууд амжилттай устгагдлаа", "success");
      onRefresh();
    } catch (err: any) {
      onShowToast(err.message || "Цэвэрлэхэд алдаа гарлаа", "error");
    } finally {
      setClearingMocks(false);
    }
  };

  // Filter assignments
  const filteredAssignments = assignments.filter((a) => {
    if (statusFilter !== "all" && a.status !== statusFilter) return false;
    if (dateFilter && a.departureDate !== dateFilter) return false;
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      const match =
        a.orderNo.toLowerCase().includes(q) ||
        a.vehiclePlate.toLowerCase().includes(q) ||
        a.primaryDriverName.toLowerCase().includes(q) ||
        (a.substituteDriverName && a.substituteDriverName.toLowerCase().includes(q)) ||
        a.province.toLowerCase().includes(q) ||
        a.destination.toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });

  return (
    <div className="space-y-4">
      {/* Header Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
            <Truck className="w-5 h-5 text-[#0878bd]" />
            <span>Томилолт Хуваарилалт & Хяналт</span>
            <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 text-xs font-black">
              {filteredAssignments.length}
            </span>
          </h2>
          <p className="text-slate-400 text-xs mt-0.5">
            Захиалгыг машин, үндсэн жолооч, сэлгээ жолоочтой холбож замын хуудсын систем рүү автоматаар дамжуулна
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Sales progress dashboard link */}
          <a
            href="/sales"
            target="_blank"
            rel="noopener noreferrer"
            className="px-3.5 py-2 rounded-xl bg-violet-50 hover:bg-violet-100 border border-violet-200 text-violet-800 text-xs font-bold flex items-center gap-1.5 transition-all shadow-2xs"
            title="Борлуулалтын албаны явцын дашборд руу очих (/sales)"
          >
            <ExternalLink className="w-3.5 h-3.5 text-violet-600" />
            <span>Борлуулалтын дашборд (/sales)</span>
          </a>

          <button
            onClick={() => openCreateModal()}
            className="px-4 py-2 rounded-xl bg-[#0878bd] hover:bg-[#0769a6] text-white text-xs font-bold flex items-center gap-2 shadow-xs transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>+ Шинэ томилолт хуваарилах</span>
          </button>
        </div>
      </div>

      {/* Official Letters Summary & Batch Download Bar */}
      <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 rounded-2xl p-4 text-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-md border border-blue-800/60">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-300 shrink-0">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-bold text-blue-300 uppercase tracking-wider flex items-center gap-2">
              <span>IMD Албан бичиг (Түгээгчийн хоолны мөнгө)</span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-black border border-emerald-500/30">
                {assignments.filter(a => a.albanBichigStatus === "DONE").length} / {assignments.length} бэлэн
              </span>
            </div>
            <div className="text-xs text-slate-300 mt-0.5">
              Томилолт тус бүр дээр автоматаар дугаарлагдаж Google Docs template-ээр PDF үүснэ.
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
          {/* Checkbox select all / toggle */}
          <div className="flex items-center gap-2 bg-white/10 px-3 py-1.5 rounded-xl border border-white/15">
            <label className="flex items-center gap-2 text-white text-xs font-bold cursor-pointer select-none">
              <input
                type="checkbox"
                checked={
                  filteredAssignments.length > 0 &&
                  filteredAssignments.every((a) => selectedLetterAsnIds.includes(a.id))
                }
                onChange={handleToggleSelectAllLetters}
                className="w-4 h-4 rounded text-blue-500 cursor-pointer accent-blue-500"
              />
              <span>
                {filteredAssignments.length > 0 &&
                filteredAssignments.every((a) => selectedLetterAsnIds.includes(a.id))
                  ? "Бүгдийг хасах"
                  : "Бүгдийг сонгох"}
              </span>
            </label>
            <span className="text-blue-300 text-xs font-mono font-bold border-l border-white/20 pl-2">
              {selectedLetterAsnIds.length} / {assignments.length}
            </span>
          </div>

          <button
            onClick={handleDownloadMergedLetters}
            disabled={downloadingMerged || selectedLetterAsnIds.length === 0}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-black flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
            title="Чеклэж сонгосон томилолтуудын албан бичгийг 1 PDF файл болгон нэгтгэж татах"
          >
            <Download className={`w-4 h-4 ${downloadingMerged ? "animate-bounce" : ""}`} />
            <span>
              {selectedLetterAsnIds.length === assignments.length
                ? "Нийтээр нь татах (1 PDF)"
                : selectedLetterAsnIds.length > 0
                ? `Сонгосон (${selectedLetterAsnIds.length}) нэгтгэж татах (1 PDF)`
                : "Албан бичиг сонгоогүй (0)"}
            </span>
          </button>

          {onNavigateToLetters && (
            <button
              onClick={onNavigateToLetters}
              className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 active:bg-white/30 text-white text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer border border-white/20"
              title="Бүх албан бичгийн нэгдсэн жагсаалт руу шилжих"
            >
              <ExternalLink className="w-4 h-4 text-blue-300" />
              <span>Нэгдсэн жагсаалт</span>
            </button>
          )}
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
              placeholder="Машины дугаар, жолооч, аймаг, захиалга..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs font-medium focus:border-blue-500 outline-none"
            />
          </div>

          {/* Status */}
          <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1.5 rounded-xl border border-slate-200">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-transparent text-xs font-bold text-slate-700 outline-none cursor-pointer"
            >
              <option value="all">Бүх төлөв ({assignments.length})</option>
              <option value="Төлөвлөсөн">Төлөвлөсөн</option>
              <option value="Тээвэрт гарсан">Тээвэрт гарсан</option>
              <option value="Дууссан">Дууссан</option>
              <option value="Цуцлагдсан">Цуцлагдсан</option>
            </select>
          </div>

          {/* Date Picker Filter */}
          <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1.5 rounded-xl border border-slate-200">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="bg-transparent text-xs font-bold text-slate-700 outline-none cursor-pointer"
            />
            {dateFilter && (
              <button
                onClick={() => setDateFilter("")}
                className="text-slate-400 hover:text-slate-600 text-[10px] font-bold ml-1"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        <button
          onClick={onRefresh}
          className="text-xs font-bold text-slate-500 hover:text-slate-800 px-3 py-1.5 rounded-xl hover:bg-slate-100"
        >
          Шинэчлэх
        </button>
      </div>

      {/* Assignment Cards / Table */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredAssignments.length === 0 ? (
          <div className="col-span-full py-16 text-center bg-white rounded-3xl border border-slate-200/90 shadow-2xs max-w-lg mx-auto">
            <div className="w-14 h-14 rounded-2xl bg-sky-50 text-[#0878bd] flex items-center justify-center mx-auto mb-3">
              <Truck className="w-7 h-7" />
            </div>
            <h3 className="text-base font-black text-slate-800">
              {searchTerm ? "Хайлтын шалгуурт тохирох томилолт олдсонгүй" : "Бүртгэгдсэн бодит томилолт одоогоор байхгүй байна"}
            </h3>
            <p className="text-xs text-slate-500 mt-1.5 leading-relaxed px-4">
              {searchTerm 
                ? "Хайлтын түлхүүр үгээ шалгана уу."
                : "Зохиомол томилолтуудыг устгасан. Та доорх товчоор бодит захиалга дээр машин, жолооч томилон баталгаажуулж замын хуудас руу автоматаар илгээнэ үү."
              }
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2 mt-5">
              <button
                onClick={() => openCreateModal()}
                className="px-4 py-2.5 rounded-xl bg-[#0878bd] hover:bg-[#076ba8] text-white text-xs font-black shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>+ Бодит томилолт бүртгэх</span>
              </button>
              <a
                href="/sales"
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2.5 rounded-xl bg-violet-50 hover:bg-violet-100 border border-violet-200 text-violet-800 text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5"
              >
                <ExternalLink className="w-3.5 h-3.5 text-violet-600" />
                <span>Борлуулалтын дашборд харах</span>
              </a>
            </div>
          </div>
        ) : (
          filteredAssignments.map((asn) => {
            const isLetterSelected = selectedLetterAsnIds.includes(asn.id);
            return (
              <div
                key={asn.id}
                className={`bg-white rounded-2xl p-4 border transition-all flex flex-col justify-between gap-3 ${
                  isLetterSelected
                    ? "border-blue-400 ring-2 ring-blue-100 shadow-sm"
                    : "border-slate-200/90 shadow-xs hover:border-slate-300"
                }`}
              >
                {/* Card Header */}
                <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-2.5">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <label
                        onClick={(e) => e.stopPropagation()}
                        className="flex items-center gap-1.5 cursor-pointer select-none group"
                        title={isLetterSelected ? "1 PDF-д нэгтгэх сонголтоос хасах" : "1 PDF-д нэгтгэхээр чеклэх"}
                      >
                        <input
                          type="checkbox"
                          checked={isLetterSelected}
                          onChange={() => handleToggleLetterAsn(asn.id)}
                          className="w-4 h-4 rounded text-blue-600 border-slate-300 focus:ring-blue-500 cursor-pointer accent-blue-600"
                        />
                        <span className="font-mono font-black text-sm text-slate-900 bg-slate-100 group-hover:bg-blue-50 px-2 py-0.5 rounded-md transition-colors">
                          {asn.vehiclePlate}
                        </span>
                      </label>
                      <span className="text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md">
                        {asn.province}
                      </span>
                      {isLetterSelected && (
                        <span
                          className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 flex items-center gap-0.5"
                          title="Энэ албан бичиг нэгтгэх PDF файлд багтсан"
                        >
                          <Check className="w-2.5 h-2.5 text-emerald-600" />
                          <span>PDF-д чеклэсэн</span>
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1 font-medium">
                      Захиалга: <strong className="text-slate-700">{asn.orderNo}</strong>
                    </div>
                  </div>

                  <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                    asn.status === "Дууссан"
                      ? "bg-emerald-100 text-emerald-800"
                      : asn.status === "Тээвэрт гарсан"
                      ? "bg-blue-100 text-blue-800 animate-pulse"
                      : asn.status === "Цуцлагдсан"
                      ? "bg-rose-100 text-rose-800"
                      : "bg-amber-100 text-amber-800"
                  }`}>
                    {asn.status}
                  </span>
                </div>

              {/* Drivers & Route Info */}
              <div className="space-y-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Үндсэн жолооч:</span>
                  <span className="font-bold text-slate-800 flex items-center gap-1">
                    <Users className="w-3 h-3 text-blue-500" />
                    {asn.primaryDriverName}
                  </span>
                </div>

                {asn.substituteDriverName && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Сэлгээ жолооч:</span>
                    <span className="font-bold text-purple-700">
                      {asn.substituteDriverName}
                    </span>
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Очих сум/газар:</span>
                  <span className="font-semibold text-slate-700">{asn.destination}</span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-500 flex items-center gap-1">
                    <Box className="w-3.5 h-3.5 text-amber-500" />
                    <span>Ачсан хэмжээ:</span>
                  </span>
                  <div className="flex items-center gap-1.5 font-mono">
                    <span className="font-black text-slate-900">{asn.quantity.toLocaleString()} хайрцаг</span>
                    {asn.vehicleCapacity && (
                      <span className="text-[10px] text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200 font-medium">
                        {asn.vehicleCapacity.toLocaleString()} багт.
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Гарах огноо:</span>
                  <span className="font-bold text-slate-700">{asn.departureDate}</span>
                </div>

                {/* Telemetry / KM Block */}
                {(asn.actualKm || asn.startOdo) && (
                  <div className="mt-2 pt-2 border-t border-slate-100 bg-slate-50/70 p-2 rounded-xl text-[11px] space-y-1">
                    {asn.actualKm && (
                      <div className="flex items-center justify-between font-bold text-blue-800">
                        <span>Бодит явсан км:</span>
                        <span>{asn.actualKm.toLocaleString()} км</span>
                      </div>
                    )}
                    {asn.startOdo && (
                      <div className="flex items-center justify-between text-slate-500">
                        <span>Эхлэх / Дуусах ODO:</span>
                        <span>{asn.startOdo} → {asn.endOdo || "..."}</span>
                      </div>
                    )}
                    {asn.fuelLiters && (
                      <div className="flex items-center justify-between text-slate-500">
                        <span>Түлш:</span>
                        <span>{asn.fuelLiters} литр ({asn.fuelStation || "Колонк"})</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-100 gap-1.5">
                <div className="flex items-center gap-1">
                  {/* Copy Driver link */}
                  <button
                    onClick={() => handleCopyDriverLink(asn)}
                    title="Жолоочийн тусгай холбоос хуулах"
                    className="p-1.5 rounded-lg border border-slate-200 hover:bg-blue-50 text-slate-600 hover:text-blue-600"
                  >
                    {copiedId === asn.id ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>

                  {/* Open Driver View */}
                  <a
                    href={`/driver/trip/${asn.token}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Жолоочийн харагдац нээх"
                    className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>

                  {/* Open Waybill */}
                  {onOpenDriverWaybill && (
                    <button
                      onClick={() => onOpenDriverWaybill(asn.primaryDriverId)}
                      title="Замын хуудас руу очих"
                      className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                    </button>
                  )}

                  {/* Official Letter (Албан бичиг) */}
                  {asn.albanBichigStatus === "DONE" ? (
                    <div className="flex items-center gap-1">
                      <a
                        href={asn.albanBichigPdfUrl || `/api/imd/official-letters/${asn.albanBichigId || asn.id}/view`}
                        target="_blank"
                        rel="noreferrer"
                        title={`Албан бичиг № ${asn.albanBichigDugaar || ""} урьдчилан харах`}
                        className="px-2 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-xs font-bold text-blue-700 flex items-center gap-1 border border-blue-200 transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5 text-blue-600" />
                        <span>№ {asn.albanBichigDugaar || "Бичиг"}</span>
                      </a>
                      <a
                        href={`/api/imd/official-letters/${asn.albanBichigId || asn.id}/download`}
                        download
                        title="Албан бичиг PDF татах"
                        className="px-2 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-xs font-bold text-emerald-700 flex items-center gap-1 border border-emerald-200 transition-colors shadow-2xs"
                      >
                        <Download className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Татах</span>
                      </a>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1">
                      <a
                        href={`/api/imd/official-letters/${asn.id}/download`}
                        download
                        title="Албан бичиг боловсруулан шууд татах"
                        className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-xs font-bold text-white flex items-center gap-1 shadow-2xs transition-colors"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Албан бичиг татах</span>
                      </a>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => openEditModal(asn)}
                    className="px-2.5 py-1 rounded-lg border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50"
                  >
                    Засах
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`Та "${asn.vehiclePlate}" машины томилолтыг цуцлахдаа итгэлтэй байна уу?`)) {
                        onDeleteAssignment(asn.id);
                      }
                    }}
                    className="p-1 rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-600"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          );
        })
      )}
      </div>

      {/* CREATE / EDIT ASSIGNMENT MODAL */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 space-y-4 animate-in fade-in zoom-in duration-150 my-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                <Truck className="w-5 h-5 text-[#0878bd]" />
                <span>{editingAssignment ? "Томилолт засварлах" : "Шинэ томилолт хуваарилах"}</span>
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-600 font-bold text-lg p-1"
              >
                ✕
              </button>
            </div>

            {/* Conflict Warning Banner */}
            {conflictWarning && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-2.5 text-xs text-amber-900">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-bold">{conflictWarning}</p>
                  <label className="flex items-center gap-2 font-semibold text-amber-800 cursor-pointer pt-1">
                    <input
                      type="checkbox"
                      checked={forceSubmit}
                      onChange={(e) => setForceSubmit(e.target.checked)}
                      className="rounded text-blue-600"
                    />
                    <span>Энэ давхардлыг үл тоон хүчээр үүсгэхийг зөвшөөрч байна (Force Override)</span>
                  </label>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
              {/* Order Selection */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Холбогдох Захиалга <span className="font-normal text-slate-500">(Сонголттой - Байхгүй бол өдөр тутмын томилолт шууд үүснэ)</span>
                </label>
                <select
                  value={selectedOrderId}
                  onChange={(e) => {
                    setSelectedOrderId(e.target.value);
                    const o = orders.find(ord => ord.id === e.target.value);
                    if (o) {
                      setProvince(o.province);
                      setDestination(o.destination);
                      setQuantity(o.quantity);
                      setDepartureDate(o.deliveryDate);
                    }
                  }}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 font-bold outline-none focus:border-blue-500 bg-white"
                >
                  <option value="">-- Шууд өдөр тутмын томилолт бүртгэх (Захиалгагүй) --</option>
                  {orders.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.orderNo} • {o.province} ({o.customer}) - {o.quantity} хайрцаг [{o.status}]
                    </option>
                  ))}
                </select>
              </div>

              {/* Driver & Vehicle Selection (Auto-filled Vehicle from Primary Driver) */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Үндсэн жолооч *</label>
                  <select
                    required
                    value={selectedPrimaryDriverId}
                    onChange={(e) => handlePrimaryDriverChange(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 font-bold outline-none focus:border-blue-500 bg-white"
                  >
                    <option value="">-- Үндсэн жолооч сонгох --</option>
                    <optgroup label="⭐ IMD Үндсэн 8 Жолооч (Албан ёсны)">
                      {drivers
                        .filter(isEligibleIMDDriver)
                        .map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.name} ({d.code || d.id}) • {d.vehicle}
                          </option>
                        ))}
                    </optgroup>
                  </select>
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    Жолоочийг сонгоход түүний машин шууд автоматаар бөглөгдөнө
                  </span>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block font-bold text-slate-700">Машины улсын дугаар *</label>
                    {selectedVehiclePlate && (
                      <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                        ✓ Жолоочоос автоматаар
                      </span>
                    )}
                  </div>
                  <input
                    type="text"
                    required
                    value={selectedVehiclePlate}
                    onChange={(e) => handleVehiclePlateChange(e.target.value)}
                    placeholder="Жолооч сонгоход автоматаар гарна"
                    className={`w-full px-3 py-2 rounded-xl border font-mono font-black outline-none focus:border-blue-500 transition-colors ${
                      selectedVehiclePlate 
                        ? "bg-emerald-50/50 border-emerald-300 text-slate-900" 
                        : "bg-slate-50 border-slate-200 text-slate-400"
                    }`}
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    {selectedVehiclePlate 
                      ? `Машины зайрмаг ачих багтаамж: ${getVehicleBoxCapacity(selectedVehiclePlate, drivers).toLocaleString()} хайрцаг` 
                      : "Үндсэн жолоочийг сонгоход түүний машин болон багтаамж автоматаар энд бөглөгдөнө"}
                  </span>
                </div>
              </div>

              {/* Substitute Driver & Status */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Сэлгээ жолооч (Зөвхөн IMD түгээгч)</label>
                  <select
                    value={selectedSubDriverId}
                    onChange={(e) => setSelectedSubDriverId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 outline-none focus:border-blue-500 bg-white"
                  >
                    <option value="">-- Сэлгээ байхгүй --</option>
                    <optgroup label="⭐ IMD Сэлгээ жолооч нар (8 түгээгч & IMD)">
                      {drivers
                        .filter(d => isEligibleIMDDriver(d) && d.id !== selectedPrimaryDriverId)
                        .map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.name} ({d.code || d.id}) • {d.vehicle}
                          </option>
                        ))}
                    </optgroup>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Төлөв</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 font-bold outline-none focus:border-blue-500 bg-white"
                  >
                    <option value="Төлөвлөсөн">Төлөвлөсөн</option>
                    <option value="Тээвэрт гарсан">Тээвэрт гарсан</option>
                    <option value="Дууссан">Дууссан</option>
                    <option value="Цуцлагдсан">Цуцлагдсан</option>
                  </select>
                </div>
              </div>

              {/* Date & Destination */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Тээвэрт гарах огноо *</label>
                  <input
                    type="date"
                    required
                    value={departureDate}
                    onChange={(e) => setDepartureDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 font-bold outline-none focus:border-blue-500"
                  />
                  <span className="text-[10px] text-blue-600 font-semibold mt-0.5 block">
                    Өнгөрсөн огноог нөхөн бүртгэх боломжтой
                  </span>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Буцах / Ирэх огноо</label>
                  <input
                    type="date"
                    value={returnDate}
                    onChange={(e) => setReturnDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 outline-none focus:border-blue-500"
                  />
                  <span className="text-[10px] text-emerald-600 font-semibold mt-0.5 block">
                    Явсан & Ирсэн өдрөөр батлагдсан км-ээр хаагдана
                  </span>
                </div>
              </div>

              {/* Official Route / Province Selection with Auto-KM */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Аймаг / Чиглэл сонгох (24 албан ёсны чиглэлээр км бодох)
                </label>
                <select
                  onChange={(e) => {
                    const idx = Number(e.target.value);
                    if (!isNaN(idx) && OFFICIAL_IMD_ROUTES[idx]) {
                      const r = OFFICIAL_IMD_ROUTES[idx];
                      setProvince(r.province);
                      setDestination(r.destination);
                      setRouteKm(r.roundTripKm);
                    }
                  }}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 font-bold outline-none focus:border-blue-500 bg-sky-50/50"
                >
                  <option value="">-- 24 Албан ёсны маршрутаас сонгох (2 талдаа/км) --</option>
                  {OFFICIAL_IMD_ROUTES.map((r, idx) => (
                    <option key={r.destination + idx} value={idx}>
                      {r.destination} ({r.province}) — 2 талдаа: {r.roundTripKm.toLocaleString()} км
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Аймаг</label>
                  <input
                    type="text"
                    value={province}
                    onChange={(e) => {
                      setProvince(e.target.value);
                      const matched = OFFICIAL_IMD_ROUTES.find(r => r.province.toLowerCase() === e.target.value.toLowerCase());
                      if (matched) setRouteKm(matched.roundTripKm);
                    }}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 font-bold outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Сум / Байршил</label>
                  <input
                    type="text"
                    value={destination}
                    onChange={(e) => {
                      setDestination(e.target.value);
                      const matched = OFFICIAL_IMD_ROUTES.find(r => r.destination.toLowerCase() === e.target.value.toLowerCase());
                      if (matched) setRouteKm(matched.roundTripKm);
                    }}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Calculated KM Preview Card */}
              <div className="p-3 rounded-2xl bg-gradient-to-r from-sky-50 to-blue-50 border border-sky-200 flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-bold text-slate-600 block">Тооцогдох 2 талын албан ёсны зай:</span>
                  <span className="text-[10px] text-slate-400">Маршрутын хүснэгтийн дагуу автомат оруулав</span>
                </div>
                <div className="text-right">
                  <span className="text-base font-black text-[#0878bd] bg-white px-3 py-1 rounded-xl shadow-2xs border border-sky-200 block">
                    {routeKm > 0 ? `${routeKm.toLocaleString()} км` : "-"}
                  </span>
                </div>
              </div>

              {/* Ice Cream Box Quantity & Vehicle Capacity Section */}
              <div className="p-3.5 rounded-2xl bg-amber-50/70 border border-amber-200/90 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-black uppercase text-[#123047] tracking-wide flex items-center gap-1.5">
                    <Box className="w-3.5 h-3.5 text-amber-600" />
                    <span>Ачих зайрмагны тоо хэмжээ (хайрцаг) *</span>
                  </span>
                  {selectedVehiclePlate && (
                    <span className="text-[11px] font-bold text-blue-800 bg-blue-100/80 px-2 py-0.5 rounded-lg border border-blue-200 flex items-center gap-1 font-mono">
                      <span>Машины багтаамж:</span>
                      <strong>{getVehicleBoxCapacity(selectedVehiclePlate, drivers).toLocaleString()} хайрцаг</strong>
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 items-center">
                  <div className="sm:col-span-2">
                    <input
                      type="number"
                      min={0}
                      step={10}
                      required
                      value={quantity || ""}
                      onChange={(e) => setQuantity(Number(e.target.value))}
                      placeholder="Жишээ нь: 700, 1000, 1500"
                      className="w-full px-3 py-2 rounded-xl border border-amber-300 bg-white font-mono font-black text-slate-900 outline-none focus:border-amber-500 text-sm"
                    />
                  </div>

                  <div className="flex items-center">
                    {selectedVehiclePlate && (
                      <button
                        type="button"
                        onClick={() => setQuantity(getVehicleBoxCapacity(selectedVehiclePlate, drivers))}
                        className="w-full py-2 px-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-bold transition-all shadow-xs flex items-center justify-center gap-1 cursor-pointer"
                        title="Машины стандартын дагуу дүүргэх"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Багтаамжаар ({getVehicleBoxCapacity(selectedVehiclePlate, drivers)})</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Quick Presets & Overcapacity Warning */}
                <div className="flex items-center justify-between gap-2 flex-wrap pt-1 border-t border-amber-200/60">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] text-slate-500 font-medium">Сонголт:</span>
                    {[700, 1000, 1500].map((cap) => (
                      <button
                        key={cap}
                        type="button"
                        onClick={() => setQuantity(cap)}
                        className={`px-2 py-0.5 rounded-lg text-[10px] font-bold font-mono transition-colors cursor-pointer ${
                          quantity === cap 
                            ? "bg-amber-600 text-white shadow-2xs" 
                            : "bg-white hover:bg-amber-100 text-amber-900 border border-amber-200"
                        }`}
                      >
                        {cap.toLocaleString()} хайрцаг
                      </button>
                    ))}
                  </div>

                  {selectedVehiclePlate && quantity > getVehicleBoxCapacity(selectedVehiclePlate, drivers) && (
                    <span className="text-[10px] text-rose-600 font-bold flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3 text-rose-500" />
                      Багтаамжаас ({getVehicleBoxCapacity(selectedVehiclePlate, drivers)} хайрцаг) давсан байна!
                    </span>
                  )}
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Томилолтын тэмдэглэл</label>
                <textarea
                  rows={2}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Томилолтын тусгай чиглэл, заавар..."
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
                  {submitting ? "Хадгалж байна..." : editingAssignment ? "Шинэчлэх" : "Томилолт батлах"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Generated Letter Success Popup Modal */}
      {generatedLetterModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 border border-slate-200">
            <div className="p-6 bg-gradient-to-br from-blue-50 to-indigo-50 border-b border-blue-100 flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-md">
                  <FileText className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-xs font-black text-blue-600 uppercase tracking-wide">
                    Албан бичиг амжилттай үүслээ!
                  </div>
                  <h3 className="text-lg font-black text-slate-900 mt-0.5">
                    № {generatedLetterModal.letter.dugaar}
                  </h3>
                </div>
              </div>
              <button
                onClick={() => setGeneratedLetterModal(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-white/80"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-3.5 text-sm">
              <div className="grid grid-cols-2 gap-2.5 bg-slate-50 p-4 rounded-2xl border border-slate-100 text-xs">
                <div>
                  <span className="text-slate-400 block">Чиглэл:</span>
                  <span className="font-bold text-slate-800">{generatedLetterModal.letter.chiglel}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Машины дугаар:</span>
                  <span className="font-mono font-bold text-slate-800">{generatedLetterModal.letter.mashin}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Үндсэн түгээгч:</span>
                  <span className="font-semibold text-slate-800">{generatedLetterModal.letter.tug1}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Сэлгээ түгээгч:</span>
                  <span className="font-semibold text-slate-800">
                    {generatedLetterModal.letter.tug2 || "Сэлгээгүй"}
                  </span>
                </div>
                <div className="col-span-2 pt-2 border-t border-slate-200/80 flex items-center justify-between">
                  <span className="text-slate-500 font-semibold">Олгох хоолны мөнгө:</span>
                  <span className="font-black text-blue-700 text-sm">{generatedLetterModal.letter.niit_mungu}</span>
                </div>
              </div>

              <div className="text-xs text-slate-500 leading-relaxed bg-blue-50/50 p-3 rounded-xl border border-blue-100">
                ✅ Google Docs template-ээр автоматаар үүсч, Google Drive хавтас болон системд хадгалагдлаа. Та одоо PDF-ийг нээж харах, шууд татах эсвэл нэгдсэн жагсаалтаас бүх албан бичгийг нэгтгэн татаж болно.
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row items-center gap-2 pt-2">
                <a
                  href={`/api/imd/official-letters/${generatedLetterModal.letter.id}/view`}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full sm:w-1/2 py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors border border-slate-200"
                >
                  <Eye className="w-4 h-4 text-blue-600" />
                  <span>PDF нээж харах</span>
                </a>

                <a
                  href={`/api/imd/official-letters/${generatedLetterModal.letter.id}/download`}
                  download
                  className="w-full sm:w-1/2 py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-colors shadow-sm"
                >
                  <Download className="w-4 h-4" />
                  <span>PDF шууд татах</span>
                </a>
              </div>

              {onNavigateToLetters && (
                <button
                  onClick={() => {
                    setGeneratedLetterModal(null);
                    onNavigateToLetters();
                  }}
                  className="w-full py-2.5 px-4 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors border border-emerald-200"
                >
                  <ExternalLink className="w-4 h-4 text-emerald-600" />
                  <span>Бүх албан бичгийн нэгдсэн цэс рүү очих</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
