import React, { useState, useEffect } from "react";
import {
  FileText,
  Download,
  Eye,
  RefreshCw,
  CheckCircle,
  Clock,
  AlertCircle,
  ExternalLink,
  Layers,
  Search,
  Settings,
  Copy,
  Check,
  CheckSquare,
  Square,
  FilePlus,
  ArrowUpDown,
  Filter,
  Truck,
  X
} from "lucide-react";
import { IMDOfficialLetter, IMDOrder, IMDAssignment } from "../../types";
import { API } from "../../services/api";

export const OFFICIAL_DRIVERS = [
  "Ул.Мөнгөнзул (9726)",
  "Пи.Доржпалам (14)",
  "Ми.Анхбаяр (141)",
  "Жа.Алтанхуяг (283)",
  "Ор.Тэмүүлэн (9011)",
  "Эн.Отгонсүх (173)",
  "Чү.Мөнхгэрэл (775)",
  "Со.Баярсайхан (5535)"
];

export const OFFICIAL_DESTINATIONS = [
  "Орхон",
  "Дархан",
  "(Завхан) Тосонцэнгэл",
  "Увс",
  "Хэнтий",
  "Хөвсгөл",
  "Ховд",
  "Сүхбаатар",
  "Өмнөговь",
  "Өвөрхангай Арвайхээр",
  "Завхан Улиастай",
  "(Дундговь) Мандал",
  "Дорнод",
  "(Дорнговь) Шанд",
  "Баянхогор",
  "Архангай",
  "Дорнговь Замын үүд",
  "Сэлэнгэ Зүүн хараа",
  "Говь-Алтай",
  "(Сэлэнгэ)",
  "(Өвөрхангай) Хархорин",
  "Улаанбаатар Багнуур",
  "Дорнговь Айраг",
  "Говьсүмбэр"
];

interface Props {
  assignments: IMDAssignment[];
  orders: IMDOrder[];
  onRefreshData?: () => void;
}

export const IMDOfficialLettersTab: React.FC<Props> = ({
  assignments,
  orders,
  onRefreshData
}) => {
  const [letters, setLetters] = useState<IMDOfficialLetter[]>([]);
  const [config, setConfig] = useState<any>({
    templateDocId: "17ebcybwJKnSbowBD6gnT4_ihP3zOc-QTxQGwozSZUMw",
    outputFolderId: "1-FvVPagjch6Ye2V1UlBuP42h_Yzh__gh",
    sheetId: "1BZHX2S2VIl4yI8y-BeIC-9V6YsfT6fHjcCxHRo2_xpg",
    sheetGid: "190727185",
    appsScriptUrl: ""
  });
  const [loading, setLoading] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [selectedLetterIds, setSelectedLetterIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [merging, setMerging] = useState(false);
  const [previewPdfUrl, setPreviewPdfUrl] = useState<string | null>(null);
  const [previewPdfTitle, setPreviewPdfTitle] = useState<string>("");
  const [activeView, setActiveView] = useState<"sheet_admin" | "letters" | "assignments">("sheet_admin");
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [appsScriptUrlInput, setAppsScriptUrlInput] = useState("");
  const [savingConfig, setSavingConfig] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // New Order Entry Form State (matching Google Sheet Columns C, D, E, H, I, J)
  const [newOrderForm, setNewOrderForm] = useState({
    tug1: "Чү.Мөнхгэрэл (775)",
    tug2: "",
    chiglel: "Дархан",
    size: "4.5",
    ognooIrsen: new Date().toISOString().split("T")[0],
    ognooGarsan: new Date().toISOString().split("T")[0]
  });
  const [submittingOrder, setSubmittingOrder] = useState(false);
  const [runningBatch, setRunningBatch] = useState(false);
  const [stats, setStats] = useState({
    totalRange: 80,
    startRow: 10,
    endRow: 89,
    doneCount: 0,
    pendingCount: 0
  });

  // 1-Click Download merged official letters as 1 single PDF (Чеклэж сонгосноор эсвэл Нийтээр нь)
  const handleDownloadAllMerged = () => {
    const a = document.createElement("a");
    const query = selectedLetterIds.length > 0 ? `?ids=${encodeURIComponent(selectedLetterIds.join(","))}` : "";
    a.href = `/api/imd/official-letters/download-all-merged${query}`;
    const dateTag = new Date().toISOString().split("T")[0];
    a.download = selectedLetterIds.length > 0
      ? `IMD_Songoson_${selectedLetterIds.length}_Alban_Bichig_${dateTag}.pdf`
      : `IMD_Niit_Alban_Bichig_${dateTag}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    showNotification(
      "success",
      selectedLetterIds.length > 0
        ? `Чеклэж сонгосон ${selectedLetterIds.length} албан бичгийг 1 PDF файл болгон нэгтгэж татаж байна...`
        : "Нийт бүх албан бичгийг 1 PDF файл болгон нэгтгэж татаж байна..."
    );
  };

  const handleDirectDownloadLetter = (letterId: string, fileName?: string) => {
    const a = document.createElement("a");
    a.href = `/api/imd/official-letters/${encodeURIComponent(letterId)}/download`;
    a.download = fileName || `alban_bichig_${letterId}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    showNotification("success", "Албан бичиг татагдаж байна...");
  };

  useEffect(() => {
    loadOfficialLetters();
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const res = await API.getIMDAppsScriptStats();
      if (res && res.stats) {
        setStats(res.stats);
      }
    } catch (e) {
      console.error("Error loading stats:", e);
    }
  };

  const loadOfficialLetters = async () => {
    try {
      setLoading(true);
      const res = await API.getIMDOfficialLetters();
      if (res && res.letters) {
        setLetters(res.letters);
      }
      if (res && res.config) {
        setConfig(res.config);
        setAppsScriptUrlInput(res.config.appsScriptUrl || "");
      }
    } catch (err: any) {
      console.error("Error loading official letters:", err);
    } finally {
      setLoading(false);
    }
  };

  const showNotification = (type: "success" | "error", text: string) => {
    setStatusMessage({ type, text });
    setTimeout(() => {
      setStatusMessage(null);
    }, 4000);
  };

  const handleCreateNewOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmittingOrder(true);
      const res = await API.addNewIMDOrderFromTemplate(newOrderForm);
      if (res.success) {
        showNotification("success", `Шинэ захиалга амжилттай хадгалагдлаа! Дугаар: № ${res.dugaar}`);
        await loadOfficialLetters();
        await loadStats();
        if (onRefreshData) onRefreshData();
      }
    } catch (err: any) {
      showNotification("error", err.message || "Шинэ захиалга хадгалахад алдаа гарлаа.");
    } finally {
      setSubmittingOrder(false);
    }
  };

  const handleRunPendingBatch = async () => {
    try {
      setRunningBatch(true);
      const res = await API.runPendingIMDGeneration();
      if (res.success) {
        showNotification("success", res.message || `${res.count} албан бичиг амжилттай боловсруулагдлаа.`);
        await loadOfficialLetters();
        await loadStats();
        if (onRefreshData) onRefreshData();
      }
    } catch (err: any) {
      showNotification("error", err.message || "Дараалал боловсруулахад алдаа гарлаа.");
    } finally {
      setRunningBatch(false);
    }
  };

  // Generate Letter for an Assignment or Order
  const handleGenerateLetter = async (
    target: { orderId?: string; assignmentId?: string },
    forceRegenerate = false
  ) => {
    const targetKey = target.assignmentId || target.orderId || "target";
    try {
      setProcessingId(targetKey);
      const res = await API.generateIMDOfficialLetter({
        orderId: target.orderId,
        assignmentId: target.assignmentId,
        forceRegenerate
      });

      if (res.success) {
        showNotification(
          "success",
          `№ ${res.letter.dugaar} албан бичиг амжилттай үүслээ!`
        );
        await loadOfficialLetters();
        if (onRefreshData) onRefreshData();
      }
    } catch (err: any) {
      showNotification("error", err.message || "Албан бичиг үүсгэхэд алдаа гарлаа.");
    } finally {
      setProcessingId(null);
    }
  };

  // Merge selected PDFs
  const handleMergeSelected = async () => {
    if (selectedLetterIds.length < 2) {
      showNotification("error", "Нэгтгэхийн тулд хамгийн багадаа 2 албан бичиг сонгоно уу.");
      return;
    }

    try {
      setMerging(true);
      const res = await API.mergeIMDOfficialLetters(selectedLetterIds);
      if (res.success && res.base64) {
        // Download base64 as PDF
        const byteCharacters = atob(res.base64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: "application/pdf" });
        const url = URL.createObjectURL(blob);

        const a = document.createElement("a");
        a.href = url;
        a.download = res.fileName || "merged_alban_bichig.pdf";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        showNotification(
          "success",
          `${res.totalMerged} албан бичиг нэгтгэгдэж, амжилттай татагдлаа!`
        );
      }
    } catch (err: any) {
      showNotification("error", err.message || "PDF нэгтгэхэд алдаа гарлаа.");
    } finally {
      setMerging(false);
    }
  };

  // Batch generate for all uncreated assignments
  const handleBatchGenerateAll = async () => {
    const uncreatedAssignments = assignments.filter((a) => {
      const existing = letters.find((l) => l.assignmentId === a.id);
      return !existing || existing.status !== "DONE";
    });

    if (uncreatedAssignments.length === 0) {
      showNotification("success", "Бүх томилолтын албан бичиг аль хэдийн үүссэн байна.");
      return;
    }

    setLoading(true);
    let successCount = 0;
    for (const a of uncreatedAssignments) {
      try {
        await API.generateIMDOfficialLetter({
          assignmentId: a.id,
          orderId: a.orderId
        });
        successCount++;
      } catch (e) {
        console.error("Batch generate error for assignment", a.id, e);
      }
    }

    await loadOfficialLetters();
    if (onRefreshData) onRefreshData();
    setLoading(false);
    showNotification("success", `${successCount} томилолтын албан бичиг шинээр үүслээ!`);
  };

  // Selection toggle
  const toggleSelectLetter = (id: string) => {
    setSelectedLetterIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedLetterIds.length === filteredLetters.length) {
      setSelectedLetterIds([]);
    } else {
      setSelectedLetterIds(filteredLetters.map((l) => l.id));
    }
  };

  // Combine letters with assignments to see total coverage
  // Map all assignments and include their letters
  const combinedItems = assignments.map((a) => {
    const letter = letters.find((l) => l.assignmentId === a.id || (l.orderId && l.orderId === a.orderId));
    return {
      assignment: a,
      letter
    };
  });

  // Filter letters
  const filteredLetters = letters.filter((l) => {
    const matchesSearch =
      (l.dugaar && l.dugaar.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (l.chiglel && l.chiglel.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (l.tug1 && l.tug1.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (l.tug2 && l.tug2.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (l.mashin && l.mashin.toLowerCase().includes(searchQuery.toLowerCase()));

    if (!matchesSearch) return false;

    if (statusFilter === "DONE") return l.status === "DONE";
    if (statusFilter === "FAILED") return l.status === "FAILED";
    return true;
  });

  const totalLettersCount = letters.length;
  const doneCount = letters.filter((l) => l.status === "DONE").length;
  const assignmentsCovered = assignments.filter((a) =>
    letters.some((l) => l.assignmentId === a.id && l.status === "DONE")
  ).length;

  const handleSaveConfig = async () => {
    try {
      setSavingConfig(true);
      const res = await API.saveIMDOfficialLetterConfig({
        appsScriptUrl: appsScriptUrlInput.trim()
      });
      if (res.success) {
        setConfig(res.config);
        showNotification("success", "Google Apps Script тохиргоо амжилттай хадгалагдлаа.");
        setShowConfigModal(false);
      }
    } catch (err: any) {
      showNotification("error", "Тохиргоо хадгалахад алдаа: " + err.message);
    } finally {
      setSavingConfig(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Notifications */}
      {statusMessage && (
        <div
          className={`p-4 rounded-xl flex items-center justify-between text-sm font-medium transition-all shadow-sm ${
            statusMessage.type === "success"
              ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
              : "bg-rose-50 text-rose-800 border border-rose-200"
          }`}
        >
          <div className="flex items-center gap-2">
            {statusMessage.type === "success" ? (
              <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            )}
            <span>{statusMessage.text}</span>
          </div>
          <button
            onClick={() => setStatusMessage(null)}
            className="text-gray-400 hover:text-gray-600 ml-4"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header Info & Configuration Bar */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-800">
                  IMD Албан бичиг боловсруулах систем
                </h2>
                <p className="text-sm text-slate-500">
                  Google Docs template-ээр албан бичиг автоматаар үүсгэх, PDF болгох, нэгтгэх
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <a
              href={`https://docs.google.com/document/d/${config.templateDocId}/edit`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors border border-slate-200"
              title="Google Docs Template нээх"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Template нээх</span>
            </a>

            <a
              href={`https://drive.google.com/drive/folders/${config.outputFolderId}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors border border-slate-200"
              title="Google Drive Output Folder нээх"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Drive хавтас</span>
            </a>

            <a
              href={`https://docs.google.com/spreadsheets/d/${config.sheetId}/edit#gid=${config.sheetGid}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors border border-slate-200"
              title="Google Sheets бүртгэл нээх"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Sheet бүртгэл</span>
            </a>

            <button
              onClick={() => setShowConfigModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors border border-blue-200"
            >
              <Settings className="w-3.5 h-3.5" />
              <span>Apps Script холболт</span>
            </button>

            <button
              onClick={loadOfficialLetters}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-600 bg-slate-50 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200"
              title="Шинэчлэх"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              <span>Шинэчлэх</span>
            </button>
          </div>
        </div>

        {/* Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-6 border-t border-slate-100">
          <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-100">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Нийт албан бичиг</span>
            <div className="mt-1 text-2xl font-bold text-slate-800">{totalLettersCount}</div>
          </div>
          <div className="bg-emerald-50/50 p-4 rounded-xl border border-emerald-100">
            <span className="text-xs font-medium text-emerald-600 uppercase tracking-wider">Үүссэн (DONE)</span>
            <div className="mt-1 text-2xl font-bold text-emerald-700">{doneCount}</div>
          </div>
          <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100">
            <span className="text-xs font-medium text-blue-600 uppercase tracking-wider">Томилолтын хангалт</span>
            <div className="mt-1 text-2xl font-bold text-blue-700">
              {assignmentsCovered} / {assignments.length}
            </div>
          </div>
          <div className="bg-amber-50/50 p-4 rounded-xl border border-amber-100">
            <span className="text-xs font-medium text-amber-600 uppercase tracking-wider">Үүсээгүй томилолт</span>
            <div className="mt-1 text-2xl font-bold text-amber-700">
              {Math.max(0, assignments.length - assignmentsCovered)}
            </div>
          </div>
        </div>
      </div>

      {/* Action Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200">
        <div className="flex flex-1 items-center gap-2 max-w-md">
          <div className="relative w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Дугаар, жолооч, машин, чиглэлээр хайх..."
              className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="py-2 px-3 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          >
            <option value="ALL">Бүх статус</option>
            <option value="DONE">DONE (Үүссэн)</option>
            <option value="FAILED">FAILED (Алдаатай)</option>
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleDownloadAllMerged}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-black text-white bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 rounded-xl transition-colors shadow-sm cursor-pointer"
            title="Нийт бүх албан бичгийг 1 PDF файл болгон нэгтгэж татах"
          >
            <Download className="w-4 h-4" />
            <span>Бүх албан бичгийг 1 PDF болгож татах</span>
          </button>

          {selectedLetterIds.length > 0 && (
            <button
              onClick={handleMergeSelected}
              disabled={merging}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded-xl transition-colors shadow-sm disabled:opacity-50"
            >
              <Layers className={`w-4 h-4 ${merging ? "animate-spin" : ""}`} />
              <span>
                {merging
                  ? "Нэгтгэж байна..."
                  : `Сонгосон (${selectedLetterIds.length}) PDF нэгтгэх`}
              </span>
            </button>
          )}

          <button
            onClick={handleBatchGenerateAll}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 rounded-xl transition-colors border border-slate-200"
            title="Үүсээгүй байгаа бүх томилолтод албан бичиг бөөнөөр үүсгэх"
          >
            <FilePlus className="w-4 h-4 text-blue-600" />
            <span>Бүх томилолтод үүсгэх</span>
          </button>
        </div>
      </div>

      {/* View Switcher Tabs */}
      <div className="flex items-center gap-3 border-b border-slate-200 px-1 overflow-x-auto">
        <button
          onClick={() => setActiveView("sheet_admin")}
          className={`pb-3 px-3 text-sm font-bold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
            activeView === "sheet_admin"
              ? "border-blue-600 text-blue-700"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>⚡ Спредшит &amp; Google Docs самбар</span>
        </button>
        <button
          onClick={() => setActiveView("letters")}
          className={`pb-3 px-3 text-sm font-bold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
            activeView === "letters"
              ? "border-blue-600 text-blue-700"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Үүссэн албан бичгүүд ({filteredLetters.length})</span>
        </button>
        <button
          onClick={() => setActiveView("assignments")}
          className={`pb-3 px-3 text-sm font-bold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
            activeView === "assignments"
              ? "border-blue-600 text-blue-700"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          <Truck className="w-4 h-4" />
          <span>Нийт томилолтын нэгдсэн хяналт ({assignments.length})</span>
        </button>
      </div>

      {/* 1. GOOGLE DOCS & SPREADSHEET AUTOMATION ADMIN BOARD */}
      {activeView === "sheet_admin" && (
        <div className="space-y-6 animate-in fade-in duration-150">
          {/* Top Stat Boxes (Exact 10-89 Range) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 text-white shadow-sm relative overflow-hidden">
              <div className="text-xs uppercase tracking-wider text-slate-400 font-bold">Муж дахь нийт мөр (10-89)</div>
              <div className="text-3xl font-extrabold font-mono text-white mt-2">{stats.totalRange}</div>
              <div className="text-[11px] text-slate-500 mt-1">Google Sheet эхний ба эцсийн мөрийн муж</div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 text-white shadow-sm relative overflow-hidden">
              <div className="text-xs uppercase tracking-wider text-emerald-400 font-bold">Бэлэн болсон (DONE)</div>
              <div className="text-3xl font-extrabold font-mono text-emerald-400 mt-2">{letters.length}</div>
              <div className="text-[11px] text-slate-500 mt-1">Google Docs загвараар үүссэн албан бичгүүд</div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 text-white shadow-sm relative overflow-hidden">
              <div className="text-xs uppercase tracking-wider text-amber-400 font-bold">Боловсруулаагүй (Pending)</div>
              <div className="text-3xl font-extrabold font-mono text-amber-400 mt-2">
                {Math.max(0, assignments.length - letters.length)}
              </div>
              <div className="text-[11px] text-slate-500 mt-1">Шинээр PDF хөрвүүлэгдэх дараалал</div>
            </div>
          </div>

          {/* New Order Entry Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-white shadow-sm">
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-800">
              <div className="flex items-center gap-2 text-cyan-400 font-bold text-base">
                <FilePlus className="w-5 h-5 text-cyan-400" />
                <span>Шинэ захиалга бүртгэх</span>
              </div>
              <span className="text-xs text-slate-400">
                F баганад дараагийн дугаар (<span className="text-cyan-400 font-mono font-bold">I-26-XXXX</span>) автоматаар олгогдоно
              </span>
            </div>

            <form onSubmit={handleCreateNewOrder} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                    Түгээгч 1 (Багана C) *
                  </label>
                  <select
                    value={newOrderForm.tug1}
                    onChange={(e) => setNewOrderForm({ ...newOrderForm, tug1: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/30"
                    required
                  >
                    {OFFICIAL_DRIVERS.map((driver) => (
                      <option key={driver} value={driver}>
                        {driver}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                    Түгээгч 2 (Багана D)
                  </label>
                  <select
                    value={newOrderForm.tug2}
                    onChange={(e) => setNewOrderForm({ ...newOrderForm, tug2: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/30"
                  >
                    <option value="">-- Сэлгээгүй / Хоосон --</option>
                    {OFFICIAL_DRIVERS.map((driver) => (
                      <option key={driver} value={driver}>
                        {driver}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                    Томилолт чиглэл (Багана E) *
                  </label>
                  <select
                    value={newOrderForm.chiglel}
                    onChange={(e) => setNewOrderForm({ ...newOrderForm, chiglel: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/30 font-medium"
                    required
                  >
                    {OFFICIAL_DESTINATIONS.map((dest) => (
                      <option key={dest} value={dest}>
                        {dest}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                    Захиалгын хэмжээ (Багана H) - Тн
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={newOrderForm.size}
                    onChange={(e) => setNewOrderForm({ ...newOrderForm, size: e.target.value })}
                    placeholder="Жишээ: 4.5"
                    className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/30"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                    Захиалга ирсэн огноо (Багана I)
                  </label>
                  <input
                    type="date"
                    value={newOrderForm.ognooIrsen}
                    onChange={(e) => setNewOrderForm({ ...newOrderForm, ognooIrsen: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/30"
                    required
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                    Тээвэрт гарсан огноо (Багана J)
                  </label>
                  <input
                    type="date"
                    value={newOrderForm.ognooGarsan}
                    onChange={(e) => setNewOrderForm({ ...newOrderForm, ognooGarsan: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/30"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={submittingOrder}
                className="w-full mt-3 py-3 px-4 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-bold rounded-xl text-sm transition-colors shadow-sm disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
              >
                {submittingOrder ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Шинэ захиалга хадгалж байна...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Шинэ захиалга хадгалах</span>
                  </>
                )}
              </button>
            </form>
          </div>

          {/* 2 Big Action Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-white flex flex-col justify-between">
              <div>
                <h3 className="text-base font-bold text-white mb-2">Дарааллыг Шууд Боловсруулах</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Спредшит болон бүртгэл дээр ирсэн шинэ өгөгдлийг шалгаж, DONE бичигдээгүй байгаа бүх мөрийг бэлэн Google Docs загвараар (<span className="font-mono text-cyan-300">{config.templateDocId}</span>) нэг бүрчлэн уншиж PDF болгон хөрвүүлнэ.
                </p>
              </div>
              <button
                onClick={handleRunPendingBatch}
                disabled={runningBatch}
                className="mt-6 w-full py-3 px-4 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl text-sm border border-slate-700 transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${runningBatch ? "animate-spin text-cyan-400" : "text-cyan-400"}`} />
                <span>{runningBatch ? "Боловсруулж байна..." : "Үлдсэн албан бичгийг боловсруулах"}</span>
              </button>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-white flex flex-col justify-between">
              <div>
                <h3 className="text-base font-bold text-white mb-2">Сонгосон файлуудыг нэгтгэж татах</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Доорх жагсаалтаас чеклэж сонгосон албан бичгүүдийг локал хөтөч дээрээ секундын дотор нэгтгэж, нэг PDF файл болгон шууд татна. Мөн нийт бүх томилолтыг 1 PDF болгон татах боломжтой.
                </p>
              </div>
              <div className="mt-6 flex flex-col sm:flex-row items-center gap-2">
                <button
                  onClick={handleMergeSelected}
                  disabled={merging || selectedLetterIds.length === 0}
                  className="w-full sm:flex-1 py-3 px-4 bg-cyan-500 hover:bg-cyan-400 active:bg-cyan-600 text-slate-950 font-bold rounded-xl text-sm transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40"
                >
                  <Layers className={`w-4 h-4 ${merging ? "animate-spin" : ""}`} />
                  <span>{merging ? "Нэгтгэж байна..." : `Сонгосон (${selectedLetterIds.length}) нэгтгэх`}</span>
                </button>

                <button
                  onClick={handleDownloadAllMerged}
                  className="w-full sm:flex-1 py-3 px-4 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-black rounded-xl text-sm transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                  title="Нийт бүх албан бичгийг 1 PDF болгон татах"
                >
                  <Download className="w-4 h-4" />
                  <span>Нийтээр нь татах (1 PDF)</span>
                </button>
              </div>
            </div>
          </div>

          {/* File Repository / Management Section */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-800">
              <div>
                <h3 className="text-base font-bold text-white">Файлын сан (Удирдлагын хэсэг)</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Боловсруулагдсан нийт <span className="text-cyan-400 font-bold font-mono">{letters.length}</span> албан бичиг бэлэн байна
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={toggleSelectAll}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-300 transition-colors"
                >
                  {selectedLetterIds.length === letters.length && letters.length > 0 ? "Бүгдийг хасах" : "Бүгдийг сонгох"}
                </button>
                <button
                  onClick={loadOfficialLetters}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300"
                  title="Шинэчлэх"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                </button>
              </div>
            </div>

            {letters.length === 0 ? (
              <div className="py-12 text-center text-slate-500">
                <FileText className="w-10 h-10 mx-auto text-slate-600 mb-2" />
                <p className="text-sm font-semibold text-slate-400">Албан бичиг хараахан үүсээгүй байна</p>
                <p className="text-xs text-slate-500 mt-1">
                  Дээрх «Шинэ захиалга хадгалах» эсвэл «Үлдсэн албан бичгийг боловсруулах» товч дээр дарна уу.
                </p>
              </div>
            ) : (
              <div className="mt-4 divide-y divide-slate-800 max-h-[350px] overflow-y-auto border border-slate-800 rounded-xl bg-slate-950/60">
                {letters.map((ltr) => {
                  const isChecked = selectedLetterIds.includes(ltr.id);
                  return (
                    <div
                      key={ltr.id}
                      className={`p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 hover:bg-slate-800/50 transition-colors ${
                        isChecked ? "bg-cyan-950/20" : ""
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => toggleSelectLetter(ltr.id)}
                          className="text-slate-400 hover:text-cyan-400 transition-colors"
                        >
                          {isChecked ? (
                            <CheckSquare className="w-4 h-4 text-cyan-400" />
                          ) : (
                            <Square className="w-4 h-4" />
                          )}
                        </button>

                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-sm text-cyan-400">
                              № {ltr.dugaar}
                            </span>
                            <span className="text-xs font-mono text-slate-400">{ltr.ognoo}</span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-900/50 text-emerald-400 border border-emerald-800">
                              DONE
                            </span>
                          </div>
                          <div className="text-xs text-slate-300 mt-0.5">
                            <span className="font-semibold text-white">{ltr.chiglel}</span> • {ltr.tug1}
                            {ltr.tug2 ? ` / ${ltr.tug2}` : ""} • {ltr.mashin} • {ltr.niit_mungu}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-auto">
                        <button
                          onClick={() => {
                            setPreviewPdfTitle(`Албан бичиг № ${ltr.dugaar}`);
                            setPreviewPdfUrl(`/api/imd/official-letters/${ltr.id}/view`);
                          }}
                          className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-300 flex items-center gap-1 transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5 text-cyan-400" />
                          <span>Нээх</span>
                        </button>

                        <button
                          onClick={() => handleDirectDownloadLetter(ltr.id, ltr.fileName)}
                          className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white flex items-center gap-1 shadow-sm transition-colors"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Татах</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 2. LETTERS TABLE / CARDS VIEW */}
      {activeView === "letters" && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={toggleSelectAll}
              className="flex items-center gap-2 text-xs font-semibold text-slate-600 hover:text-slate-800"
            >
              {selectedLetterIds.length === filteredLetters.length && filteredLetters.length > 0 ? (
                <CheckSquare className="w-4 h-4 text-blue-600" />
              ) : (
                <Square className="w-4 h-4 text-slate-400" />
              )}
              <span>Бүгдийг сонгох ({filteredLetters.length})</span>
            </button>
          </div>
          <span className="text-xs text-slate-500 font-medium">
            Google Sheet: 19 - 33-р мөр
          </span>
        </div>

        {filteredLetters.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <FileText className="w-12 h-12 mx-auto text-slate-300 mb-3" />
            <p className="font-semibold text-slate-700">Албан бичиг одоогоор бүртгэгдээгүй байна</p>
            <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
              Томилолтын жагсаалтаас шууд «Албан бичиг үүсгэх» товч дарж автоматаар Google Docs template-ээр PDF үүсгэх боломжтой.
            </p>
            <button
              onClick={handleBatchGenerateAll}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors shadow-sm"
            >
              <FilePlus className="w-4 h-4" />
              <span>Одоо байгаа томилолтуудад үүсгэх</span>
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500 bg-slate-50/50">
                  <th className="p-3 w-10 text-center"></th>
                  <th className="p-3">Дугаар</th>
                  <th className="p-3">Огноо</th>
                  <th className="p-3">Чиглэл</th>
                  <th className="p-3">Үндсэн түгээгч</th>
                  <th className="p-3">Сэлгээ түгээгч</th>
                  <th className="p-3">Машин</th>
                  <th className="p-3">Нийт дүн</th>
                  <th className="p-3 text-center">Статус</th>
                  <th className="p-3 text-right">Үйлдлүүд</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredLetters.map((letter) => {
                  const isSelected = selectedLetterIds.includes(letter.id);
                  const isProcessing = processingId === letter.id;

                  return (
                    <tr
                      key={letter.id}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        isSelected ? "bg-blue-50/40" : ""
                      }`}
                    >
                      <td className="p-3 text-center">
                        <button
                          onClick={() => toggleSelectLetter(letter.id)}
                          className="text-slate-400 hover:text-blue-600"
                        >
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-blue-600" />
                          ) : (
                            <Square className="w-4 h-4" />
                          )}
                        </button>
                      </td>
                      <td className="p-3 font-semibold text-blue-700 font-mono">
                        {letter.dugaar}
                      </td>
                      <td className="p-3 text-slate-600 text-xs font-mono">{letter.ognoo}</td>
                      <td className="p-3 font-medium text-slate-800">{letter.chiglel}</td>
                      <td className="p-3 text-slate-700">{letter.tug1}</td>
                      <td className="p-3 text-slate-500 text-xs">
                        {letter.tug2 && letter.tug2.trim() !== "" ? (
                          <span className="text-slate-700">{letter.tug2}</span>
                        ) : (
                          <span className="text-slate-400 italic">Сэлгээгүй (Хасагдсан)</span>
                        )}
                      </td>
                      <td className="p-3 font-mono text-xs text-slate-600">{letter.mashin}</td>
                      <td className="p-3 font-semibold text-slate-800">{letter.niit_mungu}</td>
                      <td className="p-3 text-center">
                        {letter.status === "DONE" && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                            <CheckCircle className="w-3 h-3" />
                            <span>DONE</span>
                          </span>
                        )}
                        {letter.status === "FAILED" && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800">
                            <AlertCircle className="w-3 h-3" />
                            <span>FAILED</span>
                          </span>
                        )}
                        {letter.status === "PROCESSING" && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
                            <RefreshCw className="w-3 h-3 animate-spin" />
                            <span>PROCESSING</span>
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            onClick={() => {
                              setPreviewPdfTitle(`Албан бичиг № ${letter.dugaar}`);
                              setPreviewPdfUrl(`/api/imd/official-letters/${letter.id}/view`);
                            }}
                            className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-slate-100 rounded-lg transition-colors"
                            title="PDF харах"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          <a
                            href={`/api/imd/official-letters/${letter.id}/download`}
                            download={letter.fileName}
                            className="p-1.5 text-slate-600 hover:text-emerald-600 hover:bg-slate-100 rounded-lg transition-colors"
                            title="PDF татах"
                          >
                            <Download className="w-4 h-4" />
                          </a>

                          <button
                            onClick={() =>
                              handleGenerateLetter(
                                {
                                  orderId: letter.orderId,
                                  assignmentId: letter.assignmentId
                                },
                                true
                              )
                            }
                            disabled={isProcessing}
                            className="p-1.5 text-slate-600 hover:text-amber-600 hover:bg-slate-100 rounded-lg transition-colors"
                            title="Дахин боловсруулах"
                          >
                            <RefreshCw
                              className={`w-4 h-4 ${isProcessing ? "animate-spin" : ""}`}
                            />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      )}

      {/* 3. Unified Assignments & Letters Coverage View */}
      {activeView === "assignments" && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="font-bold text-slate-800 text-sm">
                Бүх томилолт ба албан бичгийн нэгдсэн хяналт
              </h3>
              <p className="text-xs text-slate-500">
                Томилолт бүрийн албан бичиг үүссэн эсэхийг хянаж, 1 товшилтоор үүсгэх, харах болон татах
              </p>
            </div>
            <button
              onClick={handleBatchGenerateAll}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs"
            >
              <FilePlus className="w-3.5 h-3.5" />
              <span>Үүсээгүй томилолтуудад бөөнөөр үүсгэх</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500 bg-slate-50/50">
                  <th className="p-3">Захиалга / Машин</th>
                  <th className="p-3">Огноо</th>
                  <th className="p-3">Чиглэл & Аймаг</th>
                  <th className="p-3">Үндсэн түгээгч</th>
                  <th className="p-3">Сэлгээ түгээгч</th>
                  <th className="p-3">Томилолтын төлөв</th>
                  <th className="p-3">Албан бичгийн дугаар</th>
                  <th className="p-3 text-right">Үйлдэл</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {combinedItems.map(({ assignment: a, letter }) => {
                  const isProcessing = processingId === a.id;
                  const hasLetter = letter && letter.status === "DONE";

                  return (
                    <tr key={a.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-3">
                        <div className="font-mono font-bold text-slate-900 text-xs">
                          {a.vehiclePlate}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {a.orderNo}
                        </div>
                      </td>
                      <td className="p-3 text-xs font-mono text-slate-600">
                        {a.departureDate}
                      </td>
                      <td className="p-3">
                        <span className="font-bold text-slate-800 text-xs">{a.province}</span>
                        <div className="text-[11px] text-slate-500">{a.destination}</div>
                      </td>
                      <td className="p-3 text-xs font-medium text-slate-700">
                        {a.primaryDriverName}
                      </td>
                      <td className="p-3 text-xs text-slate-500">
                        {a.substituteDriverName ? (
                          <span className="text-slate-700">{a.substituteDriverName}</span>
                        ) : (
                          <span className="text-slate-400 italic">Сэлгээгүй</span>
                        )}
                      </td>
                      <td className="p-3">
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                          a.status === "Дууссан"
                            ? "bg-emerald-100 text-emerald-800"
                            : a.status === "Тээвэрт гарсан"
                            ? "bg-blue-100 text-blue-800"
                            : "bg-amber-100 text-amber-800"
                        }`}>
                          {a.status}
                        </span>
                      </td>
                      <td className="p-3">
                        {hasLetter ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 font-mono text-xs font-bold border border-blue-200">
                            <FileText className="w-3.5 h-3.5 text-blue-600" />
                            <span>№ {letter.dugaar}</span>
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400 italic">
                            Үүсээгүй
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-right">
                        {hasLetter ? (
                          <div className="inline-flex items-center gap-1">
                            <button
                              onClick={() => {
                                setPreviewPdfTitle(`Албан бичиг № ${letter.dugaar}`);
                                setPreviewPdfUrl(`/api/imd/official-letters/${letter.id}/view`);
                              }}
                              className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-slate-100 rounded-lg transition-colors"
                              title="PDF харах"
                            >
                              <Eye className="w-4 h-4" />
                            </button>

                            <a
                              href={`/api/imd/official-letters/${letter.id}/download`}
                              download={letter.fileName}
                              className="p-1.5 text-slate-600 hover:text-emerald-600 hover:bg-slate-100 rounded-lg transition-colors"
                              title="PDF татах"
                            >
                              <Download className="w-4 h-4" />
                            </a>

                            <button
                              onClick={() =>
                                handleGenerateLetter(
                                  {
                                    orderId: a.orderId,
                                    assignmentId: a.id
                                  },
                                  true
                                )
                              }
                              disabled={isProcessing}
                              className="p-1.5 text-slate-600 hover:text-amber-600 hover:bg-slate-100 rounded-lg transition-colors"
                              title="Дахин боловсруулах"
                            >
                              <RefreshCw
                                className={`w-4 h-4 ${isProcessing ? "animate-spin" : ""}`}
                              />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() =>
                              handleGenerateLetter({
                                orderId: a.orderId,
                                assignmentId: a.id
                              })
                            }
                            disabled={isProcessing}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold border border-blue-200 transition-colors disabled:opacity-50"
                          >
                            <FilePlus className="w-3.5 h-3.5 text-blue-600" />
                            <span>{isProcessing ? "Үүсгэж байна..." : "Албан бичиг үүсгэх"}</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* PDF View Modal */}
      {previewPdfUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-4xl h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-600" />
                <h3 className="font-bold text-slate-800">{previewPdfTitle}</h3>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={previewPdfUrl}
                  download="alban_bichig.pdf"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Татах</span>
                </a>
                <button
                  onClick={() => setPreviewPdfUrl(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="flex-1 w-full bg-slate-100 p-2">
              <iframe
                src={previewPdfUrl}
                className="w-full h-full rounded-xl border border-slate-300 shadow-inner bg-white"
                title="PDF Preview"
              />
            </div>
          </div>
        </div>
      )}

      {/* Apps Script Settings & Deployment Guide Modal */}
      {showConfigModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <Settings className="w-5 h-5 text-blue-600" />
                <h3 className="font-bold text-slate-800">
                  Google Apps Script & Drive холболтын тохиргоо
                </h3>
              </div>
              <button
                onClick={() => setShowConfigModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 text-sm text-slate-600">
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-blue-800 text-xs leading-relaxed">
                <p className="font-semibold text-blue-900 mb-1">
                  💡 Системийн ажиллах зарчим:
                </p>
                Энэ систем нь суурилагдсан өндөр нарийвчлалтай PDF хөдөлгүүрээр шууд албан бичиг үүсгэж, нэгтгэн, татах боломжтой бөгөөд хэрэв та Google Apps Script Web App URL оруулбал Google Drive хавтас болон Google Sheet рүү шууд зэрэг синхрончилдог.
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Google Apps Script Web App URL (Сонголттой)
                </label>
                <input
                  type="text"
                  value={appsScriptUrlInput}
                  onChange={(e) => setAppsScriptUrlInput(e.target.value)}
                  placeholder="https://script.google.com/macros/s/.../exec"
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 font-mono"
                />
                <p className="text-xs text-slate-400 mt-1">
                  Deploy as Web App хийсэн URL-аа энд оруулна.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2 text-xs">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="font-semibold text-slate-700">Template Doc ID:</div>
                  <div className="font-mono text-slate-500 truncate mt-0.5">
                    {config.templateDocId}
                  </div>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="font-semibold text-slate-700">Drive Output Folder ID:</div>
                  <div className="font-mono text-slate-500 truncate mt-0.5">
                    {config.outputFolderId}
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-200 pt-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-slate-700 text-xs uppercase">
                    Apps Script Код (apps-script/Code.gs)
                  </span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(
                        `// Google Apps Script код төслийн apps-script/Code.gs файлд бэлэн байгаа болно.`
                      );
                      setCopiedCode(true);
                      setTimeout(() => setCopiedCode(false), 2000);
                    }}
                    className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium"
                  >
                    {copiedCode ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedCode ? "Хуулагдлаа" : "Код хуулах"}</span>
                  </button>
                </div>
                <p className="text-xs text-slate-500">
                  Та <code>apps-script/Code.gs</code> доторх кодыг Google Apps Script төсөлд хуулж, <b>Deploy &gt; New deployment &gt; Web app (Anyone)</b> сонгон байршуулахад хангалттай.
                </p>
              </div>
            </div>

            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-2">
              <button
                onClick={() => setShowConfigModal(false)}
                className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-200/60 rounded-xl transition-colors"
              >
                Хаах
              </button>
              <button
                onClick={handleSaveConfig}
                disabled={savingConfig}
                className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors shadow-sm disabled:opacity-50"
              >
                {savingConfig ? "Хадгалж байна..." : "Хадгалах"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
