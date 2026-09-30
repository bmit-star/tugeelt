import React, { useState, useEffect } from "react";
import { 
  Package, 
  Truck, 
  Calendar, 
  Gauge, 
  Compass, 
  FileSpreadsheet, 
  Layers, 
  RefreshCw,
  Sparkles,
  LayoutDashboard,
  Upload,
  PlusCircle
} from "lucide-react";
import { 
  IMDOrder, 
  IMDAssignment, 
  IMDRoute, 
  IMDDashboardData, 
  Driver 
} from "../../types";
import { api } from "../../services/api";

import { IMDDashboardOverview } from "./IMDDashboardOverview";
import { IMDOrdersTab } from "./IMDOrdersTab";
import { IMDAssignmentsTab } from "./IMDAssignmentsTab";
import { IMDTodaysTransportTab } from "./IMDTodaysTransportTab";
import { IMDMonthlyKmTab } from "./IMDMonthlyKmTab";
import { IMDRoutesTab } from "./IMDRoutesTab";
import { IMDExcelImportModal } from "./IMDExcelImportModal";
import { IMDProvinceIceCreamDashboard } from "./IMDProvinceIceCreamDashboard";
import { IMDOfficialLettersTab } from "./IMDOfficialLettersTab";
import { IMDVehiclesTab } from "./IMDVehiclesTab";
import { Box, ExternalLink, FileText } from "lucide-react";

export type IMDTabType = 
  | "overview" 
  | "orders" 
  | "assignments" 
  | "vehicles"
  | "today_transport" 
  | "km_report" 
  | "routes"
  | "province_report"
  | "alban_bichig";

interface Props {
  drivers: Driver[];
  onOpenDriverWaybill?: (driverId: string) => void;
  onShowToast: (msg: string, type: "success" | "error" | "info") => void;
}

export const IMDManagerView: React.FC<Props> = ({
  drivers,
  onOpenDriverWaybill,
  onShowToast
}) => {
  const [currentTab, setCurrentTab] = useState<IMDTabType>("overview");
  const [selectedDate, setSelectedDate] = useState<string>(() => new Date().toISOString().split("T")[0]);

  // Data states
  const [dashboardData, setDashboardData] = useState<IMDDashboardData | null>(null);
  const [orders, setOrders] = useState<IMDOrder[]>([]);
  const [assignments, setAssignments] = useState<IMDAssignment[]>([]);
  const [routes, setRoutes] = useState<IMDRoute[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Quick action state
  const [preselectedOrderForAssignment, setPreselectedOrderForAssignment] = useState<IMDOrder | null>(null);
  const [triggerCreateAssignment, setTriggerCreateAssignment] = useState<boolean>(false);
  const [showExcelModal, setShowExcelModal] = useState<boolean>(false);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const [dashRes, ordRes, asnRes, rtsRes] = await Promise.all([
        api.getIMDDashboard(selectedDate),
        api.getIMDOrders(),
        api.getIMDAssignments(),
        api.getIMDRoutes()
      ]);
      setDashboardData(dashRes);
      setOrders(ordRes.orders || []);
      setAssignments(asnRes.assignments || []);
      setRoutes(rtsRes.routes || []);
    } catch (err: any) {
      onShowToast(err.message || "Мэдээлэл татахад алдаа гарлаа", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, [selectedDate]);

  // Order actions
  const handleCreateOrder = async (order: Partial<IMDOrder>) => {
    await api.createIMDOrder(order);
    fetchAllData();
  };

  const handleUpdateOrder = async (id: string, order: Partial<IMDOrder>) => {
    await api.updateIMDOrder(id, order);
    fetchAllData();
  };

  const handleDeleteOrder = async (id: string) => {
    await api.deleteIMDOrder(id);
    onShowToast("Захиалга амжилттай устгагдлаа", "info");
    fetchAllData();
  };

  // Assignment actions
  const handleCreateAssignment = async (data: Partial<IMDAssignment> & { force?: boolean }) => {
    await api.createIMDAssignment(data);
    fetchAllData();
  };

  const handleUpdateAssignment = async (id: string, data: Partial<IMDAssignment>) => {
    await api.updateIMDAssignment(id, data);
    fetchAllData();
  };

  const handleDeleteAssignment = async (id: string) => {
    await api.deleteIMDAssignment(id);
    onShowToast("Томилолт амжилттай цуцлагдлаа", "info");
    fetchAllData();
  };

  // Route actions
  const handleSaveRoute = async (route: Partial<IMDRoute>) => {
    await api.saveIMDRoute(route);
    fetchAllData();
  };

  const handleTriggerAssignFromOrder = (order: IMDOrder) => {
    setPreselectedOrderForAssignment(order);
    setCurrentTab("assignments");
  };

  return (
    <div className="space-y-5">
      {/* IMD Sub-navigation Bar */}
      <div className="bg-white rounded-3xl p-3 border border-slate-200/80 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 overflow-x-auto py-1 scrollbar-none">
          <button
            onClick={() => setCurrentTab("overview")}
            className={`px-3.5 py-2 rounded-2xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${
              currentTab === "overview"
                ? "bg-[#0878bd] text-white shadow-xs"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            }`}
          >
            <LayoutDashboard className="w-4 h-4" />
            <span>Хяналтын Самбар</span>
          </button>

          <button
            onClick={() => setCurrentTab("orders")}
            className={`px-3.5 py-2 rounded-2xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${
              currentTab === "orders"
                ? "bg-[#0878bd] text-white shadow-xs"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            }`}
          >
            <Package className="w-4 h-4" />
            <span>Захиалга</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
              currentTab === "orders" ? "bg-white/20 text-white" : "bg-slate-100 text-slate-700"
            }`}>
              {orders.length}
            </span>
          </button>

          <button
            onClick={() => setCurrentTab("assignments")}
            className={`px-3.5 py-2 rounded-2xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${
              currentTab === "assignments"
                ? "bg-[#0878bd] text-white shadow-xs"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            }`}
          >
            <Truck className="w-4 h-4" />
            <span>Томилолт</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
              currentTab === "assignments" ? "bg-white/20 text-white" : "bg-slate-100 text-slate-700"
            }`}>
              {assignments.length}
            </span>
          </button>

          <button
            onClick={() => setCurrentTab("vehicles")}
            className={`px-3.5 py-2 rounded-2xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${
              currentTab === "vehicles"
                ? "bg-[#0878bd] text-white shadow-xs"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            }`}
          >
            <Box className="w-4 h-4 text-amber-500" />
            <span>Машин & Багтаамж</span>
          </button>

          <button
            onClick={() => setCurrentTab("today_transport")}
            className={`px-3.5 py-2 rounded-2xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${
              currentTab === "today_transport"
                ? "bg-[#0878bd] text-white shadow-xs"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span>Өнөөдрийн Тээвэр</span>
            {dashboardData?.todayDispatches && dashboardData.todayDispatches.length > 0 && (
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                currentTab === "today_transport" ? "bg-white/20 text-white" : "bg-blue-100 text-blue-800"
              }`}>
                {dashboardData.todayDispatches.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setCurrentTab("km_report")}
            className={`px-3.5 py-2 rounded-2xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${
              currentTab === "km_report"
                ? "bg-[#0878bd] text-white shadow-xs"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            }`}
          >
            <Gauge className="w-4 h-4" />
            <span>Жолоочийн КМ Тайлан</span>
          </button>

          <button
            onClick={() => setCurrentTab("routes")}
            className={`px-3.5 py-2 rounded-2xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${
              currentTab === "routes"
                ? "bg-[#0878bd] text-white shadow-xs"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            }`}
          >
            <Compass className="w-4 h-4" />
            <span>21 Аймаг & Чиглэл</span>
          </button>

          <button
            onClick={() => setCurrentTab("province_report")}
            className={`px-3.5 py-2 rounded-2xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${
              currentTab === "province_report"
                ? "bg-[#0878bd] text-white shadow-xs"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            }`}
          >
            <Box className="w-4 h-4 text-amber-500" />
            <span>Аймгийн Тээвэр & Зайрмаг</span>
          </button>

          <button
            onClick={() => setCurrentTab("alban_bichig")}
            className={`px-3.5 py-2 rounded-2xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${
              currentTab === "alban_bichig"
                ? "bg-[#0878bd] text-white shadow-xs"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            }`}
          >
            <FileText className="w-4 h-4 text-blue-400" />
            <span>Албан бичиг (PDF)</span>
            {assignments.filter((a) => a.albanBichigStatus === "DONE").length > 0 && (
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                  currentTab === "alban_bichig"
                    ? "bg-white/20 text-white"
                    : "bg-blue-100 text-blue-800"
                }`}
              >
                {assignments.filter((a) => a.albanBichigStatus === "DONE").length}
              </span>
            )}
          </button>
        </div>

        {/* Right Tools: Quick New Assignment & Refresh */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setCurrentTab("assignments");
              setTriggerCreateAssignment(true);
            }}
            className="px-3.5 py-2 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-black flex items-center gap-1.5 transition-all shadow-md shadow-blue-500/20 cursor-pointer active:scale-95"
            title="Өдөр тутмын томилолт хуваарилах болон өнгөрсөн хугацааны томилолтын замын хуудсыг нөхөн бүртгэх"
          >
            <PlusCircle className="w-4 h-4" />
            <span>+ Томилолт хуваарилах / Нөхөн бүртгэх</span>
          </button>

          <button
            onClick={fetchAllData}
            title="Мэдээлэл шинэчлэх"
            className="p-2 rounded-2xl border border-slate-200 hover:bg-slate-100 text-slate-600 cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Main Tab Render */}
      {currentTab === "overview" && (
        <IMDDashboardOverview
          data={dashboardData}
          loading={loading}
          selectedDate={selectedDate}
          onDateChange={setSelectedDate}
          onNavigateTab={(tab: IMDTabType, openCreate?: boolean) => {
            setCurrentTab(tab);
            if (openCreate) setTriggerCreateAssignment(true);
          }}
          onSelectOrderForAssignment={handleTriggerAssignFromOrder}
        />
      )}

      {currentTab === "orders" && (
        <IMDOrdersTab
          orders={orders}
          drivers={drivers}
          loading={loading}
          onRefresh={fetchAllData}
          onCreateOrder={handleCreateOrder}
          onUpdateOrder={handleUpdateOrder}
          onDeleteOrder={handleDeleteOrder}
          onAssignOrder={handleTriggerAssignFromOrder}
          onShowToast={onShowToast}
        />
      )}

      {currentTab === "assignments" && (
        <IMDAssignmentsTab
          assignments={assignments}
          orders={orders}
          drivers={drivers}
          loading={loading}
          preselectedOrder={preselectedOrderForAssignment}
          onClearPreselectedOrder={() => setPreselectedOrderForAssignment(null)}
          triggerCreateModal={triggerCreateAssignment}
          onResetTriggerCreate={() => setTriggerCreateAssignment(false)}
          onRefresh={fetchAllData}
          onCreateAssignment={handleCreateAssignment}
          onUpdateAssignment={handleUpdateAssignment}
          onDeleteAssignment={handleDeleteAssignment}
          onOpenDriverWaybill={onOpenDriverWaybill}
          onNavigateToLetters={() => setCurrentTab("alban_bichig")}
          onShowToast={onShowToast}
        />
      )}

      {currentTab === "vehicles" && (
        <IMDVehiclesTab
          drivers={drivers}
          assignments={assignments}
          onRefresh={fetchAllData}
          onAssignVehicle={(plate) => {
            setCurrentTab("assignments");
            setTriggerCreateAssignment(true);
          }}
          onShowToast={onShowToast}
        />
      )}

      {currentTab === "today_transport" && (
        <IMDTodaysTransportTab
          assignments={assignments}
          drivers={drivers}
          selectedDate={selectedDate}
          onDateChange={setSelectedDate}
          onUpdateAssignment={handleUpdateAssignment}
          onOpenDriverWaybill={onOpenDriverWaybill}
          onShowToast={onShowToast}
        />
      )}

      {currentTab === "km_report" && (
        <IMDMonthlyKmTab onShowToast={onShowToast} />
      )}

      {currentTab === "routes" && (
        <IMDRoutesTab
          routes={routes}
          loading={loading}
          onRefresh={fetchAllData}
          onSaveRoute={handleSaveRoute}
          onShowToast={onShowToast}
        />
      )}

      {currentTab === "province_report" && (
        <IMDProvinceIceCreamDashboard onShowToast={onShowToast} />
      )}

      {currentTab === "alban_bichig" && (
        <IMDOfficialLettersTab
          assignments={assignments}
          orders={orders}
          onRefreshData={fetchAllData}
        />
      )}

      {/* Excel Import Modal */}
      <IMDExcelImportModal
        isOpen={showExcelModal}
        onClose={() => setShowExcelModal(false)}
        onImportSuccess={() => {
          setShowExcelModal(false);
          fetchAllData();
        }}
        onShowToast={onShowToast}
      />
    </div>
  );
};
