import React, { useState, useMemo } from "react";
import {
  BookOpen,
  X,
  Search,
  ChevronRight,
  ShieldCheck,
  FileText,
  AlertTriangle,
  Info,
  Layers,
  Table,
  Printer,
  ChevronDown,
  Users,
  Menu,
  CheckCircle2,
  Check,
  ChevronUp,
  SlidersHorizontal,
  Compass,
  Sparkles
} from "lucide-react";
import { Driver } from "../types";
import { IceMarkLogo } from "./IceMarkLogo";
import {
  REGULATION_METADATA,
  REGULATION_SECTIONS,
  TIRE_BATTERY_NORMS,
  FAULT_LIABILITY_ITEMS,
  ANNEX_FORMS,
  MATRIX_ITEMS
} from "../data/regulationData";

interface RegulationModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentDriver?: Driver | null;
  isManager?: boolean;
  onRequireLogin?: () => void;
}

export type TabType =
  | "all"
  | "sec-1"
  | "sec-2"
  | "sec-3"
  | "sec-4"
  | "sec-5"
  | "sec-6"
  | "sec-7"
  | "sec-8"
  | "sec-9"
  | "sec-10"
  | "table-1"
  | "table-2"
  | "matrix"
  | "annexes";

// Distinct color styling for each section on pure white background
export const SECTION_THEMES: Record<
  string,
  {
    borderAccent: string; // Left bold accent border
    badgeBg: string; // Chapter badge background
    badgeText: string; // Chapter badge text
    badgeBorder: string; // Chapter badge border
    pillBg: string; // Quick tab chip pill
    pillText: string; // Quick tab chip text
    clauseBadgeBg: string; // Clause number pill
    clauseBadgeText: string;
    dotColor: string; // Color dot indicator
    accentColor: string;
  }
> = {
  "sec-1": {
    borderAccent: "border-l-[#0878bd]",
    badgeBg: "bg-sky-100",
    badgeText: "text-[#0878bd]",
    badgeBorder: "border-sky-300",
    pillBg: "bg-sky-50 hover:bg-sky-100",
    pillText: "text-[#0878bd]",
    clauseBadgeBg: "bg-sky-50 text-[#0878bd] border-sky-200",
    clauseBadgeText: "text-[#0878bd]",
    dotColor: "bg-[#0878bd]",
    accentColor: "#0878bd"
  },
  "sec-2": {
    borderAccent: "border-l-indigo-600",
    badgeBg: "bg-indigo-100",
    badgeText: "text-indigo-700",
    badgeBorder: "border-indigo-300",
    pillBg: "bg-indigo-50 hover:bg-indigo-100",
    pillText: "text-indigo-700",
    clauseBadgeBg: "bg-indigo-50 text-indigo-700 border-indigo-200",
    clauseBadgeText: "text-indigo-700",
    dotColor: "bg-indigo-600",
    accentColor: "#4f46e5"
  },
  "sec-3": {
    borderAccent: "border-l-teal-600",
    badgeBg: "bg-teal-100",
    badgeText: "text-teal-800",
    badgeBorder: "border-teal-300",
    pillBg: "bg-teal-50 hover:bg-teal-100",
    pillText: "text-teal-800",
    clauseBadgeBg: "bg-teal-50 text-teal-800 border-teal-200",
    clauseBadgeText: "text-teal-800",
    dotColor: "bg-teal-600",
    accentColor: "#0d9488"
  },
  "sec-4": {
    borderAccent: "border-l-purple-600",
    badgeBg: "bg-purple-100",
    badgeText: "text-purple-700",
    badgeBorder: "border-purple-300",
    pillBg: "bg-purple-50 hover:bg-purple-100",
    pillText: "text-purple-700",
    clauseBadgeBg: "bg-purple-50 text-purple-700 border-purple-200",
    clauseBadgeText: "text-purple-700",
    dotColor: "bg-purple-600",
    accentColor: "#7c3aed"
  },
  "sec-5": {
    borderAccent: "border-l-amber-500",
    badgeBg: "bg-amber-100",
    badgeText: "text-amber-800",
    badgeBorder: "border-amber-300",
    pillBg: "bg-amber-50 hover:bg-amber-100",
    pillText: "text-amber-800",
    clauseBadgeBg: "bg-amber-50 text-amber-800 border-amber-200",
    clauseBadgeText: "text-amber-800",
    dotColor: "bg-amber-500",
    accentColor: "#d97706"
  },
  "sec-6": {
    borderAccent: "border-l-cyan-600",
    badgeBg: "bg-cyan-100",
    badgeText: "text-cyan-800",
    badgeBorder: "border-cyan-300",
    pillBg: "bg-cyan-50 hover:bg-cyan-100",
    pillText: "text-cyan-800",
    clauseBadgeBg: "bg-cyan-50 text-cyan-800 border-cyan-200",
    clauseBadgeText: "text-cyan-800",
    dotColor: "bg-cyan-600",
    accentColor: "#0891b2"
  },
  "sec-7": {
    borderAccent: "border-l-rose-600",
    badgeBg: "bg-rose-100",
    badgeText: "text-rose-800",
    badgeBorder: "border-rose-300",
    pillBg: "bg-rose-50 hover:bg-rose-100",
    pillText: "text-rose-800",
    clauseBadgeBg: "bg-rose-50 text-rose-800 border-rose-200",
    clauseBadgeText: "text-rose-800",
    dotColor: "bg-rose-600",
    accentColor: "#e11d48"
  },
  "sec-8": {
    borderAccent: "border-l-blue-600",
    badgeBg: "bg-blue-100",
    badgeText: "text-blue-800",
    badgeBorder: "border-blue-300",
    pillBg: "bg-blue-50 hover:bg-blue-100",
    pillText: "text-blue-800",
    clauseBadgeBg: "bg-blue-50 text-blue-800 border-blue-200",
    clauseBadgeText: "text-blue-800",
    dotColor: "bg-blue-600",
    accentColor: "#2563eb"
  },
  "sec-9": {
    borderAccent: "border-l-slate-600",
    badgeBg: "bg-slate-200",
    badgeText: "text-slate-800",
    badgeBorder: "border-slate-300",
    pillBg: "bg-slate-100 hover:bg-slate-200",
    pillText: "text-slate-800",
    clauseBadgeBg: "bg-slate-100 text-slate-800 border-slate-200",
    clauseBadgeText: "text-slate-800",
    dotColor: "bg-slate-600",
    accentColor: "#475569"
  },
  "sec-10": {
    borderAccent: "border-l-emerald-600",
    badgeBg: "bg-emerald-100",
    badgeText: "text-emerald-800",
    badgeBorder: "border-emerald-300",
    pillBg: "bg-emerald-50 hover:bg-emerald-100",
    pillText: "text-emerald-800",
    clauseBadgeBg: "bg-emerald-50 text-emerald-800 border-emerald-200",
    clauseBadgeText: "text-emerald-800",
    dotColor: "bg-emerald-600",
    accentColor: "#16a34a"
  }
};

export const RegulationModal: React.FC<RegulationModalProps> = ({
  isOpen,
  onClose,
  currentDriver,
  isManager = false
}) => {
  const [activeTab, setActiveTab] = useState<TabType>("all");
  const [searchQuery, setSearchQuery] = useState<string>("" );
  const [faultFilter, setFaultFilter] = useState<string>("all");
  const [matrixPhaseFilter, setMatrixPhaseFilter] = useState<string>("all");
  const [selectedAnnex, setSelectedAnnex] = useState<number | null>(null);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState<boolean>(false);

  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    "sec-1": true,
    "sec-2": true,
    "sec-3": true,
    "sec-4": true,
    "sec-5": true,
    "sec-6": true,
    "sec-7": true,
    "sec-8": true,
    "sec-9": true,
    "sec-10": true
  });

  const toggleSection = (id: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const expandAll = () => {
    const allExpanded: Record<string, boolean> = {};
    REGULATION_SECTIONS.forEach((s) => {
      allExpanded[s.id] = true;
    });
    setExpandedSections(allExpanded);
  };

  const collapseAll = () => {
    const allCollapsed: Record<string, boolean> = {};
    REGULATION_SECTIONS.forEach((s) => {
      allCollapsed[s.id] = false;
    });
    setExpandedSections(allCollapsed);
  };

  // Filter sections & clauses by searchQuery
  const filteredSections = useMemo(() => {
    return REGULATION_SECTIONS.map((sec) => {
      if (!searchQuery.trim()) return sec;
      const q = searchQuery.toLowerCase();
      const matchingClauses = sec.clauses.filter((c) => {
        const matchCode = c.code.toLowerCase().includes(q);
        const matchTitle = c.title ? c.title.toLowerCase().includes(q) : false;
        const matchContent = c.content.toLowerCase().includes(q);
        const matchSubs = c.subItems
          ? c.subItems.some((s) => s.code.toLowerCase().includes(q) || s.text.toLowerCase().includes(q))
          : false;
        return matchCode || matchTitle || matchContent || matchSubs;
      });
      return {
        ...sec,
        clauses: matchingClauses
      };
    }).filter((sec) => {
      if (!searchQuery.trim()) return true;
      return sec.clauses.length > 0;
    });
  }, [searchQuery]);

  // Total matching clauses count when searching
  const searchResultsCount = useMemo(() => {
    if (!searchQuery.trim()) return 0;
    return filteredSections.reduce((acc, sec) => acc + sec.clauses.length, 0);
  }, [filteredSections, searchQuery]);

  // Filtered fault liability items
  const filteredFaults = useMemo(() => {
    return FAULT_LIABILITY_ITEMS.filter((item) => {
      const matchCat = faultFilter === "all" || item.category === faultFilter;
      const matchQuery =
        !searchQuery.trim() ||
        item.partName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.reason.toLowerCase().includes(searchQuery.toLowerCase()) ||
        String(item.no).includes(searchQuery);
      return matchCat && matchQuery;
    });
  }, [faultFilter, searchQuery]);

  // Filtered Matrix rows
  const filteredMatrix = useMemo(() => {
    return MATRIX_ITEMS.filter((row) => {
      const matchPhase = matrixPhaseFilter === "all" || row.phase === matrixPhaseFilter;
      const matchQuery =
        !searchQuery.trim() ||
        row.task.toLowerCase().includes(searchQuery.toLowerCase()) ||
        row.no.includes(searchQuery);
      return matchPhase && matchQuery;
    });
  }, [matrixPhaseFilter, searchQuery]);

  // Filtered Annex Forms
  const filteredAnnexes = useMemo(() => {
    return ANNEX_FORMS.filter((annex) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        annex.name.toLowerCase().includes(q) ||
        annex.code.toLowerCase().includes(q) ||
        annex.maintainer.toLowerCase().includes(q) ||
        annex.reviewer.toLowerCase().includes(q) ||
        (annex.description && annex.description.toLowerCase().includes(q))
      );
    });
  }, [searchQuery]);

  const handlePrint = () => {
    window.print();
  };

  // Early return placed AFTER all hooks
  if (!isOpen) return null;

  const currentTabLabel = () => {
    if (activeTab === "all") return "Бүх журам бүтнээр";
    if (activeTab === "matrix") return "Тав. Эрх үүргийн матриц";
    if (activeTab === "table-1") return "Хүснэгт №1. Дугуй, аккумлятор";
    if (activeTab === "table-2") return "Хүснэгт №2. 100% хариуцах эвдрэл";
    if (activeTab === "annexes") return "Найм. Хавсралт маягтууд";
    const sec = REGULATION_SECTIONS.find((s) => s.id === activeTab);
    return sec ? `${sec.number}. ${sec.title}` : "Журам";
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex flex-col items-center justify-center p-0 sm:p-2 md:p-4 overflow-hidden animate-fadeIn"
    >
      {/* Outer Modal Container: Pure White Paper Theme with High-Contrast Typography */}
      <div className="bg-white border border-slate-200/90 w-full h-full sm:h-[96vh] sm:rounded-2xl flex flex-col shadow-2xl overflow-hidden text-slate-800">
        
        {/* 1. TOP HEADER WITH ICE MARK OFFICIAL BRANDING */}
        <div className="bg-gradient-to-r from-[#0878bd] via-[#096ba7] to-[#123047] px-3 sm:px-6 py-2.5 sm:py-3 flex items-center justify-between gap-2 sm:gap-4 shrink-0 shadow-md text-white">
          {/* Logo & Document Title */}
          <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0">
            {/* Mobile Nav Toggle */}
            <button
              onClick={() => setIsMobileNavOpen(!isMobileNavOpen)}
              className="md:hidden p-2 text-white bg-white/10 hover:bg-white/20 active:scale-95 rounded-xl border border-white/20 shrink-0"
              title="Цэс нээх"
            >
              <Menu className="w-4 h-4" />
            </button>

            {/* Official Logo Container with White Badge */}
            <div className="bg-white px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl shadow-md shrink-0 flex items-center justify-center border border-white/20">
              <IceMarkLogo size="sm" />
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-amber-300 bg-black/25 px-2 py-0.5 rounded-md border border-amber-400/40">
                  {REGULATION_METADATA.documentIndex} • ХУВИЛБАР {REGULATION_METADATA.version}
                </span>
                <span className="text-[10px] text-sky-100 hidden lg:inline">
                  {REGULATION_METADATA.effectiveDate}
                </span>
              </div>
              <h2 className="text-xs sm:text-sm md:text-base font-bold text-white tracking-tight truncate max-w-xs sm:max-w-md md:max-w-xl">
                {REGULATION_METADATA.title}
              </h2>
            </div>
          </div>

          {/* Quick Search & Controls */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Search Input */}
            <div className="relative w-36 sm:w-56 md:w-64">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Журам, сэлбэг, заалт хайх..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white text-slate-800 placeholder:text-slate-400 border border-slate-200 rounded-xl pl-8 pr-6 py-1.5 text-xs shadow-inner focus:outline-none focus:ring-2 focus:ring-[#0878bd] transition-colors"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 text-xs"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Print Button */}
            <button
              onClick={handlePrint}
              title="Хэвлэх"
              className="hidden sm:flex p-2 text-white bg-white/10 hover:bg-white/20 rounded-xl transition-colors border border-white/20 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
            </button>

            {/* Close Button */}
            <button
              onClick={onClose}
              title="Хаах"
              className="p-2 text-white bg-white/15 hover:bg-rose-600 active:scale-95 rounded-xl transition-all border border-white/25 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 2. HORIZONTAL TOPIC QUICK-JUMP CHIP BAR (WHITE BACKGROUND, CLEAN SEPARATION) */}
        <div className="bg-white border-b border-slate-200 px-3 sm:px-6 py-2 flex items-center gap-1.5 overflow-x-auto scrollbar-none shrink-0 shadow-xs">
          <button
            onClick={() => setActiveTab("all")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all flex items-center gap-1.5 ${
              activeTab === "all"
                ? "bg-[#0878bd] text-white shadow-sm"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Бүх сэдэв</span>
          </button>

          <div className="w-px h-5 bg-slate-200 shrink-0 mx-1" />

          {/* Quick Section Chips with Distinct Colors */}
          {REGULATION_SECTIONS.map((sec) => {
            const theme = SECTION_THEMES[sec.id] || SECTION_THEMES["sec-1"];
            const isActive = activeTab === sec.id;
            return (
              <button
                key={sec.id}
                onClick={() => {
                  setActiveTab(sec.id as TabType);
                  setExpandedSections((prev) => ({ ...prev, [sec.id]: true }));
                }}
                className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold shrink-0 transition-all flex items-center gap-1.5 border ${
                  isActive
                    ? `${theme.pillBg} ${theme.pillText} font-bold border-current shadow-xs`
                    : "bg-white text-slate-700 border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${theme.dotColor}`} />
                <span>{sec.number}. {sec.title.split(" ")[0]}</span>
              </button>
            );
          })}

          <div className="w-px h-5 bg-slate-200 shrink-0 mx-1" />

          {/* Special Feature Chips */}
          <button
            onClick={() => setActiveTab("matrix")}
            className={`px-2.5 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all flex items-center gap-1.5 border ${
              activeTab === "matrix"
                ? "bg-amber-500 text-white border-amber-600 shadow-xs"
                : "bg-amber-50 text-amber-900 border-amber-200 hover:bg-amber-100"
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            <span>5. Матриц</span>
          </button>

          <button
            onClick={() => setActiveTab("table-1")}
            className={`px-2.5 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all flex items-center gap-1.5 border ${
              activeTab === "table-1"
                ? "bg-emerald-600 text-white border-emerald-700 shadow-xs"
                : "bg-emerald-50 text-emerald-900 border-emerald-200 hover:bg-emerald-100"
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-600" />
            <span>Хүснэгт №1</span>
          </button>

          <button
            onClick={() => setActiveTab("table-2")}
            className={`px-2.5 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all flex items-center gap-1.5 border ${
              activeTab === "table-2"
                ? "bg-rose-600 text-white border-rose-700 shadow-xs"
                : "bg-rose-50 text-rose-900 border-rose-200 hover:bg-rose-100"
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-rose-600" />
            <span>Хүснэгт №2</span>
          </button>

          <button
            onClick={() => setActiveTab("annexes")}
            className={`px-2.5 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all flex items-center gap-1.5 border ${
              activeTab === "annexes"
                ? "bg-sky-600 text-white border-sky-700 shadow-xs"
                : "bg-sky-50 text-sky-900 border-sky-200 hover:bg-sky-100"
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-sky-600" />
            <span>19 Маягт</span>
          </button>
        </div>

        {/* 3. MAIN BODY: LEFT SIDEBAR + WHITE DOCUMENT CANVAS */}
        <div className="flex-1 flex overflow-hidden relative bg-white">
          
          {/* SIDEBAR NAVIGATION (DESKTOP - PURE WHITE THEME WITH DISTINCT TOPICS) */}
          <aside className="hidden md:flex w-72 lg:w-80 bg-white border-r border-slate-200 flex-col shrink-0 overflow-y-auto p-3 space-y-1.5 scrollbar-thin">
            <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-2 py-1 flex items-center justify-between">
              <span>Сэдвүүд & Бүлгүүд</span>
              <span className="text-[9px] bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded font-bold">10 Бүлэг</span>
            </div>

            {/* All Overview Button */}
            <button
              onClick={() => setActiveTab("all")}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold text-left transition-all ${
                activeTab === "all"
                  ? "bg-[#0878bd] text-white shadow-md shadow-sky-600/30"
                  : "text-slate-700 hover:bg-slate-100"
              }`}
            >
              <span className="flex items-center gap-2">
                <BookOpen className="w-3.5 h-3.5 shrink-0" />
                <span>Бүх журам бүтнээр</span>
              </span>
              <ChevronRight className="w-3.5 h-3.5 opacity-60" />
            </button>

            <div className="h-px bg-slate-200 my-1.5" />

            {/* Key Highlighted Tables */}
            <div className="text-[10px] font-black text-slate-500 uppercase tracking-wider px-2 pt-1 pb-0.5 flex items-center gap-1.5">
              <Table className="w-3 h-3 text-amber-600" />
              Онцлох хүснэгт & Маягт
            </div>

            <button
              onClick={() => setActiveTab("matrix")}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold text-left transition-all ${
                activeTab === "matrix"
                  ? "bg-amber-500 text-white shadow-md shadow-amber-500/30"
                  : "text-amber-900 bg-amber-50/80 border border-amber-200/80 hover:bg-amber-100"
              }`}
            >
              <span className="flex items-center gap-2 truncate">
                <Users className="w-3.5 h-3.5 shrink-0" />
                <span>Тав. Эрх үүргийн матриц</span>
              </span>
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-200 text-amber-900 font-bold shrink-0">
                24 үйл явц
              </span>
            </button>

            <button
              onClick={() => setActiveTab("table-1")}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold text-left transition-all ${
                activeTab === "table-1"
                  ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/30"
                  : "text-emerald-900 bg-emerald-50/80 border border-emerald-200/80 hover:bg-emerald-100"
              }`}
            >
              <span className="flex items-center gap-2 truncate">
                <Layers className="w-3.5 h-3.5 shrink-0" />
                <span>Хүснэгт №1. Дугуй, аккумлятор</span>
              </span>
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-200 text-emerald-900 font-bold shrink-0">
                Норм
              </span>
            </button>

            <button
              onClick={() => setActiveTab("table-2")}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold text-left transition-all ${
                activeTab === "table-2"
                  ? "bg-rose-600 text-white shadow-md shadow-rose-600/30"
                  : "text-rose-900 bg-rose-50/80 border border-rose-200 hover:bg-rose-100"
              }`}
            >
              <span className="flex items-center gap-2 truncate">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                <span>Хүснэгт №2. 100% эвдрэл</span>
              </span>
              <span className="text-[9px] bg-rose-200 text-rose-950 px-1.5 py-0.5 rounded font-black shrink-0">
                39 заалт
              </span>
            </button>

            <button
              onClick={() => setActiveTab("annexes")}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold text-left transition-all ${
                activeTab === "annexes"
                  ? "bg-sky-600 text-white shadow-md shadow-sky-600/30"
                  : "text-sky-900 bg-sky-50/80 border border-sky-200 hover:bg-sky-100"
              }`}
            >
              <span className="flex items-center gap-2 truncate">
                <FileText className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                <span>Найм. Хавсралт маягтууд</span>
              </span>
              <span className="text-[9px] bg-sky-200 text-sky-950 px-1.5 py-0.5 rounded font-black shrink-0">
                19 маягт
              </span>
            </button>

            <div className="h-px bg-slate-200 my-1.5" />

            {/* Chapters list with Distinct Topic Color Badges */}
            <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-2 pt-1 pb-0.5">
              Журмын бүлгүүд
            </div>

            {REGULATION_SECTIONS.map((sec) => {
              const theme = SECTION_THEMES[sec.id] || SECTION_THEMES["sec-1"];
              const isActive = activeTab === sec.id;
              return (
                <button
                  key={sec.id}
                  onClick={() => {
                    setActiveTab(sec.id as TabType);
                    setExpandedSections((prev) => ({ ...prev, [sec.id]: true }));
                  }}
                  className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs transition-all border ${
                    isActive
                      ? "bg-slate-900 text-white font-bold border-slate-900 shadow-sm"
                      : "bg-white text-slate-700 border-slate-100 hover:border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <span className="flex items-center gap-2 truncate pr-1">
                    <span
                      className={`w-5 h-5 rounded-lg flex items-center justify-center font-black text-[10px] shrink-0 border ${
                        isActive
                          ? "bg-white/20 text-white border-white/30"
                          : `${theme.badgeBg} ${theme.badgeText} ${theme.badgeBorder}`
                      }`}
                    >
                      {sec.number}
                    </span>
                    <span className="truncate">{sec.title}</span>
                  </span>
                  <span className={`text-[10px] font-bold ${isActive ? "text-slate-300" : "text-slate-400"}`}>
                    {sec.clauses.length}
                  </span>
                </button>
              );
            })}
          </aside>

          {/* MOBILE DRAWER NAV MODAL (WHITE THEME) */}
          {isMobileNavOpen && (
            <div className="md:hidden fixed inset-0 z-55 bg-black/60 backdrop-blur-sm flex flex-col justify-end animate-fadeIn">
              <div className="bg-white border-t border-slate-200 rounded-t-3xl max-h-[85vh] flex flex-col p-4 shadow-2xl">
                <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                  <span className="text-sm font-black text-slate-900 flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-[#0878bd]" />
                    Сэдэв & Бүлэг сонгох
                  </span>
                  <button
                    onClick={() => setIsMobileNavOpen(false)}
                    className="p-1.5 text-slate-500 hover:text-slate-800 bg-slate-100 rounded-lg"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="overflow-y-auto py-2 space-y-1.5 scrollbar-thin">
                  <button
                    onClick={() => {
                      setActiveTab("all");
                      setIsMobileNavOpen(false);
                    }}
                    className={`w-full p-2.5 rounded-xl text-xs font-bold text-left flex items-center justify-between ${
                      activeTab === "all" ? "bg-[#0878bd] text-white" : "text-slate-800 bg-slate-100"
                    }`}
                  >
                    <span>Бүх журам бүтнээр</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => {
                      setActiveTab("matrix");
                      setIsMobileNavOpen(false);
                    }}
                    className={`w-full p-2.5 rounded-xl text-xs font-bold text-left flex items-center justify-between ${
                      activeTab === "matrix" ? "bg-amber-500 text-white" : "text-amber-900 bg-amber-50 border border-amber-200"
                    }`}
                  >
                    <span>Тав. Эрх үүргийн матриц</span>
                    <span className="text-[10px] bg-amber-200 text-amber-900 px-1.5 py-0.5 rounded">24 үйл явц</span>
                  </button>

                  <button
                    onClick={() => {
                      setActiveTab("table-1");
                      setIsMobileNavOpen(false);
                    }}
                    className={`w-full p-2.5 rounded-xl text-xs font-bold text-left flex items-center justify-between ${
                      activeTab === "table-1" ? "bg-emerald-600 text-white" : "text-emerald-900 bg-emerald-50 border border-emerald-200"
                    }`}
                  >
                    <span>Хүснэгт №1. Дугуй, аккумляторын норм</span>
                    <span className="text-[10px] bg-emerald-200 text-emerald-900 px-1.5 py-0.5 rounded">Норм</span>
                  </button>

                  <button
                    onClick={() => {
                      setActiveTab("table-2");
                      setIsMobileNavOpen(false);
                    }}
                    className={`w-full p-2.5 rounded-xl text-xs font-bold text-left flex items-center justify-between ${
                      activeTab === "table-2" ? "bg-rose-600 text-white" : "text-rose-900 bg-rose-50 border border-rose-200"
                    }`}
                  >
                    <span>Хүснэгт №2. 100% хариуцах эвдрэл</span>
                    <span className="text-[10px] bg-rose-200 text-rose-950 font-black px-1.5 py-0.5 rounded">39 заалт</span>
                  </button>

                  <button
                    onClick={() => {
                      setActiveTab("annexes");
                      setIsMobileNavOpen(false);
                    }}
                    className={`w-full p-2.5 rounded-xl text-xs font-bold text-left flex items-center justify-between ${
                      activeTab === "annexes" ? "bg-[#0878bd] text-white" : "text-sky-900 bg-sky-50 border border-sky-200"
                    }`}
                  >
                    <span>Найм. Хавсралт 19 маягтууд</span>
                    <span className="text-[10px] bg-sky-200 text-sky-950 font-black px-1.5 py-0.5 rounded">19 маягт</span>
                  </button>

                  <div className="h-px bg-slate-200 my-2" />

                  {REGULATION_SECTIONS.map((sec) => (
                    <button
                      key={sec.id}
                      onClick={() => {
                        setActiveTab(sec.id as TabType);
                        setExpandedSections((prev) => ({ ...prev, [sec.id]: true }));
                        setIsMobileNavOpen(false);
                      }}
                      className={`w-full p-2.5 rounded-xl text-xs font-medium text-left flex items-center justify-between ${
                        activeTab === sec.id
                          ? "bg-[#0878bd] text-white font-bold"
                          : "text-slate-800 hover:bg-slate-100"
                      }`}
                    >
                      <span>
                        <span className="font-bold mr-1.5">{sec.number}.</span>
                        {sec.title}
                      </span>
                      <ChevronRight className="w-3.5 h-3.5 opacity-60" />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* MAIN DOCUMENT VIEW PANE: PURE CRISP WHITE BACKGROUND WITH DISTINCT TOPICS */}
          <div className="flex-1 overflow-y-auto p-3 sm:p-6 md:p-8 bg-white scrollbar-thin space-y-6">
            
            {/* OFFICIAL DOCUMENT HERO CARD (CRISP WHITE PAPER WITH LUXURY BORDERS) */}
            <div className="bg-white border-2 border-slate-200 rounded-2xl p-4 sm:p-6 md:p-8 shadow-sm relative overflow-hidden">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 sm:gap-6 border-b border-slate-200 pb-5 mb-5">
                <div>
                  <div className="text-[11px] font-black text-[#0878bd] uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-[#0878bd]" />
                    {REGULATION_METADATA.organization}
                  </div>
                  <h1 className="text-lg sm:text-xl md:text-2xl font-black text-slate-900 tracking-tight leading-snug">
                    {REGULATION_METADATA.title}
                  </h1>
                  <p className="text-xs text-slate-600 mt-2 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>{REGULATION_METADATA.resolutionNo}</span>
                  </p>
                </div>

                {/* Official Logo Banner */}
                <div className="bg-white px-4 py-2.5 rounded-2xl border-2 border-slate-200 shadow-xs shrink-0 flex items-center justify-center self-start sm:self-auto">
                  <IceMarkLogo size="md" />
                </div>
              </div>

              {/* Official Key Badges */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 text-xs">
                <div className="bg-sky-50 border border-sky-200 rounded-xl p-2.5 sm:p-3">
                  <div className="text-[10px] text-[#0878bd] uppercase font-black">Баримтын дугаар</div>
                  <div className="font-bold text-[#0878bd] mt-0.5">{REGULATION_METADATA.documentIndex}</div>
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-2.5 sm:p-3">
                  <div className="text-[10px] text-amber-800 uppercase font-black">Ангилал & Хувилбар</div>
                  <div className="font-bold text-amber-900 mt-0.5">B ангилал • Хувилбар 2</div>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 sm:p-3">
                  <div className="text-[10px] text-slate-600 uppercase font-black">Хэрэгжүүлж эхэлсэн</div>
                  <div className="font-bold text-slate-800 mt-0.5">{REGULATION_METADATA.effectiveDate}</div>
                </div>
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-2.5 sm:p-3">
                  <div className="text-[10px] text-emerald-800 uppercase font-black">Хүчинтэй хугацаа</div>
                  <div className="font-bold text-emerald-800 mt-0.5">{REGULATION_METADATA.validity}</div>
                </div>
              </div>

              {/* Signatures Footer */}
              <div className="mt-4 pt-3.5 border-t border-slate-200 flex flex-wrap items-center justify-between text-xs text-slate-600 gap-2 sm:gap-4">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-slate-400">Боловсруулсан:</span>
                  <span className="font-bold text-slate-900">{REGULATION_METADATA.preparedBy.name}</span>
                  <span className="text-slate-500">({REGULATION_METADATA.preparedBy.role})</span>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-emerald-700">Баталсан:</span>
                  <span className="font-bold text-emerald-800">{REGULATION_METADATA.approvedBy.name}</span>
                  <span className="text-slate-500">({REGULATION_METADATA.approvedBy.role})</span>
                </div>
              </div>
            </div>

            {/* DOCUMENT CONTROL STRIP (VIEW CONTROLS & EXPAND/COLLAPSE ALL) */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 flex items-center justify-between flex-wrap gap-2 text-xs">
              <div className="flex items-center gap-2 text-slate-700 font-semibold">
                <Compass className="w-4 h-4 text-[#0878bd]" />
                <span>
                  {searchQuery ? (
                    <span className="font-bold text-[#0878bd]">
                      «{searchQuery}» хайлтын үр дүн: {searchResultsCount} заалт олдлоо
                    </span>
                  ) : (
                    <span>Нийт 10 үндсэн бүлэг • 3 онцлох хүснэгт • 19 албан маягт</span>
                  )}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={expandAll}
                  className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-[11px] font-bold transition-colors cursor-pointer"
                >
                  Бүгдийг дэлгэх
                </button>
                <button
                  onClick={collapseAll}
                  className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-[11px] font-bold transition-colors cursor-pointer"
                >
                  Бүгдийг хураах
                </button>
              </div>
            </div>

            {/* SECTION: 5. ЭРХ ҮҮРГИЙН МАТРИЦ (WHITE CARD & LIGHT HIGH-CONTRAST TABLE) */}
            {(activeTab === "matrix" || activeTab === "all" || activeTab === "sec-5") && (
              <section id="matrix-section" className="space-y-3.5">
                <div className="bg-white p-4 sm:p-5 rounded-2xl border-l-6 border-l-amber-500 border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-800 border border-amber-300 flex items-center justify-center font-black text-sm shrink-0">
                      5
                    </div>
                    <div>
                      <h3 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
                        <span>Тав. Эрх үүргийн матриц</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 font-bold border border-amber-200">
                          24 үйл явц
                        </span>
                      </h3>
                      <p className="text-xs text-slate-500">
                        Х (Хянах), Г (Гүйцэтгэх), Д (Дэмжих), Б (Батлах), М (Мэдээлэх)
                      </p>
                    </div>
                  </div>

                  {/* Phase Filter Buttons */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {["all", "Төлөвлөлтийн үйл явц", "Хэрэгжүүлэлтийн үйл явц", "Хяналтын үйл явц", "Тайлагналтын үйл явц"].map((phase) => (
                      <button
                        key={phase}
                        onClick={() => setMatrixPhaseFilter(phase)}
                        className={`text-[11px] px-2.5 py-1 rounded-lg border transition-all ${
                          matrixPhaseFilter === phase
                            ? "bg-amber-500 text-white border-amber-600 font-bold shadow-xs"
                            : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                        }`}
                      >
                        {phase === "all" ? "Бүгд" : phase.replace(" үйл явц", "")}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Matrix Table with Clean Borders */}
                <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-sm">
                  <div className="md:hidden bg-amber-50 px-3 py-1.5 text-[11px] text-amber-900 font-semibold flex items-center justify-between border-b border-amber-200">
                    <span>↔ Хүснэгтийг хөндлөн тийш гүйлгэж харна уу</span>
                    <span className="text-[10px] text-amber-800">Х, Г, Д, Б, М</span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse min-w-[700px]">
                      <thead>
                        <tr className="bg-slate-100 text-slate-800 border-b border-slate-200 font-bold">
                          <th className="py-2.5 px-3 w-14">№</th>
                          <th className="py-2.5 px-3 w-28">Үйл явц</th>
                          <th className="py-2.5 px-3 min-w-[180px]">Ажлын агуулга</th>
                          <th className="py-2.5 px-1.5 text-center text-[10px]">Борл. жолооч</th>
                          <th className="py-2.5 px-1.5 text-center text-[10px]">Түгээгч</th>
                          <th className="py-2.5 px-1.5 text-center text-[10px]">Оффис</th>
                          <th className="py-2.5 px-1.5 text-center text-[10px]">Механик</th>
                          <th className="py-2.5 px-1.5 text-center text-[10px]">ТМ</th>
                          <th className="py-2.5 px-1.5 text-center text-[10px]">Инженер</th>
                          <th className="py-2.5 px-1.5 text-center text-[10px]">Албаны дарга</th>
                          <th className="py-2.5 px-1.5 text-center text-[10px]">Захирал</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredMatrix.map((item, idx) => (
                          <tr key={idx} className="hover:bg-amber-50/50 transition-colors odd:bg-slate-50/40">
                            <td className="py-2 px-3 font-mono text-slate-500 text-[11px] font-bold">{item.no}</td>
                            <td className="py-2 px-3 text-slate-600 text-[11px] font-medium">{item.phase}</td>
                            <td className="py-2 px-3 font-bold text-slate-800">{item.task}</td>
                            
                            <td className="py-2 px-1 text-center">{renderRoleBadge(item.roles.driverCity)}</td>
                            <td className="py-2 px-1 text-center">{renderRoleBadge(item.roles.driverProvince)}</td>
                            <td className="py-2 px-1 text-center">{renderRoleBadge(item.roles.driverOffice)}</td>
                            <td className="py-2 px-1 text-center">{renderRoleBadge(item.roles.mechanic)}</td>
                            <td className="py-2 px-1 text-center">{renderRoleBadge(item.roles.dispatchManager)}</td>
                            <td className="py-2 px-1 text-center">{renderRoleBadge(item.roles.autoEngineer)}</td>
                            <td className="py-2 px-1 text-center">{renderRoleBadge(item.roles.departmentHead)}</td>
                            <td className="py-2 px-1 text-center">{renderRoleBadge(item.roles.ceo)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Legend Footer */}
                  <div className="bg-slate-50 p-3 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600 flex-wrap gap-2">
                    <span className="font-bold text-slate-800">Тэмдэглэгээ:</span>
                    <div className="flex items-center gap-3 sm:gap-4 flex-wrap text-[11px]">
                      <span className="inline-flex items-center gap-1.5">
                        <span className="w-5 h-5 rounded bg-rose-100 text-rose-800 font-black flex items-center justify-center text-[10px] border border-rose-300">Х</span>
                        <span>Хянах</span>
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <span className="w-5 h-5 rounded bg-sky-100 text-sky-800 font-black flex items-center justify-center text-[10px] border border-sky-300">Г</span>
                        <span>Гүйцэтгэх</span>
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <span className="w-5 h-5 rounded bg-emerald-100 text-emerald-800 font-black flex items-center justify-center text-[10px] border border-emerald-300">Д</span>
                        <span>Дэмжих</span>
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <span className="w-5 h-5 rounded bg-amber-100 text-amber-800 font-black flex items-center justify-center text-[10px] border border-amber-300">Б</span>
                        <span>Батлах</span>
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <span className="w-5 h-5 rounded bg-indigo-100 text-indigo-800 font-black flex items-center justify-center text-[10px] border border-indigo-300">М</span>
                        <span>Мэдээлэх</span>
                      </span>
                    </div>
                  </div>
                </div>
              </section>
            )}

            {/* SECTION: ХҮСНЭГТ №1 (ДУГУЙ, АККУМЛЯТОР - WHITE CARD THEME) */}
            {(activeTab === "table-1" || activeTab === "all" || activeTab === "sec-6") && (
              <section id="table-1-section" className="space-y-3.5">
                <div className="bg-white p-4 sm:p-5 rounded-2xl border-l-6 border-l-emerald-600 border border-slate-200 shadow-sm flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center justify-center font-black text-sm shrink-0">
                      №1
                    </div>
                    <div>
                      <h3 className="text-sm sm:text-base font-bold text-slate-900">
                        Хүснэгт №1. Тээврийн хэрэгслийн гүйлтээс хамаарсан дугуйн болон аккумуляторын норм
                      </h3>
                      <p className="text-xs text-slate-500">
                        Журмын 6.3.12-р заалтын албан ёсны дагалдах норм
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
                  {TIRE_BATTERY_NORMS.map((item) => (
                    <div
                      key={item.no}
                      className="bg-white border-2 border-slate-200 rounded-2xl p-4 shadow-sm hover:border-emerald-500/50 hover:shadow-md transition-all flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[11px] font-black text-emerald-700 uppercase tracking-wider">
                            Төрөл №{item.no}
                          </span>
                          <span className="text-xs bg-emerald-50 text-emerald-800 font-bold px-2 py-0.5 rounded-lg border border-emerald-200">
                            {item.type.split(" ")[0]}
                          </span>
                        </div>
                        <h4 className="text-sm font-bold text-slate-900 mb-3">{item.type}</h4>
                        
                        <div className="space-y-2 text-xs">
                          <div className="bg-slate-50 p-2.5 rounded-xl flex items-center justify-between border border-slate-200">
                            <span className="text-slate-600 font-medium">Дугуйн гүйлт:</span>
                            <span className="font-black text-emerald-700">{item.tireKm}</span>
                          </div>
                          <div className="bg-slate-50 p-2.5 rounded-xl flex items-center justify-between border border-slate-200">
                            <span className="text-slate-600 font-medium">Дугуйн хугацаа:</span>
                            <span className="font-bold text-slate-800">{item.tireYears}</span>
                          </div>
                          <div className="bg-slate-50 p-2.5 rounded-xl flex items-center justify-between border border-slate-200">
                            <span className="text-slate-600 font-medium">Аккумуляторын хугацаа:</span>
                            <span className="font-black text-amber-700">{item.batteryYears}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* SECTION: ХҮСНЭГТ №2 (100% ЭВДРЭЛ ГЭМТЭЛ - WHITE CARD THEME) */}
            {(activeTab === "table-2" || activeTab === "all" || activeTab === "sec-7") && (
              <section id="table-2-section" className="space-y-3.5">
                <div className="bg-white p-4 sm:p-5 rounded-2xl border-l-6 border-l-rose-600 border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-rose-100 text-rose-800 border border-rose-300 flex items-center justify-center font-black text-sm shrink-0">
                      №2
                    </div>
                    <div>
                      <h3 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2 flex-wrap">
                        <span>Хүснэгт №2. Эвдрэл гэмтлийн шалтгаан ба нөхөн төлбөр олгох хүснэгт</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-300 font-black">
                          100% хариуцах
                        </span>
                      </h3>
                      <p className="text-xs text-slate-500">
                        Журмын 5.1.10 заалтын дагуу жолоочийн 100% хариуцах 39 нэр төрлийн шалгах эд анги
                      </p>
                    </div>
                  </div>

                  {/* Category Pills */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {[
                      { id: "all", label: "Бүгд (39)" },
                      { id: "Цахилгаан", label: "Цахилгаан (1-16)" },
                      { id: "Тэжээлийн систем хөдөлгүүр", label: "Тэжээл ба Хөдөлгүүр (17-22)" },
                      { id: "Өнгө үзэмж, дуу чимээ, дагалдах хэрэгсэл", label: "Өнгө үзэмж, дагалдах (23-39)" }
                    ].map((f) => (
                      <button
                        key={f.id}
                        onClick={() => setFaultFilter(f.id)}
                        className={`text-[11px] px-2.5 py-1 rounded-lg border transition-all ${
                          faultFilter === f.id
                            ? "bg-rose-600 text-white border-rose-600 font-bold shadow-xs"
                            : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* DESKTOP TABLE VIEW */}
                <div className="hidden md:block border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-sm">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-100 text-slate-800 border-b border-slate-200 font-bold">
                        <th className="py-2.5 px-3 w-12 text-center">№</th>
                        <th className="py-2.5 px-3 w-40">Ангилал</th>
                        <th className="py-2.5 px-3 w-48">Шалгах эд анги</th>
                        <th className="py-2.5 px-4">Жолоочийн буруутай үйл ажиллагаа гэж үзэх үндэслэл</th>
                        <th className="py-2.5 px-3 w-24 text-center">Хариуцах %</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredFaults.map((item) => (
                        <tr key={item.no} className="hover:bg-rose-50/50 transition-colors odd:bg-slate-50/40">
                          <td className="py-2.5 px-3 font-mono text-center text-slate-500 text-[11px] font-bold">
                            {item.no}
                          </td>
                          <td className="py-2.5 px-3 text-[11px]">
                            <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-700 font-medium">
                              {item.category}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 font-bold text-slate-900">
                            {item.partName}
                          </td>
                          <td className="py-2.5 px-4 text-slate-700 leading-relaxed">
                            {item.reason}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span className="text-[10px] font-black px-2 py-0.5 rounded bg-rose-100 text-rose-800 border border-rose-300">
                              100%
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* MOBILE CARD VIEW (< md) */}
                <div className="md:hidden space-y-2.5">
                  {filteredFaults.map((item) => (
                    <div
                      key={item.no}
                      className="bg-white border-2 border-slate-200 rounded-xl p-3 shadow-xs space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-md bg-rose-100 text-rose-800 font-black text-xs flex items-center justify-center">
                            {item.no}
                          </span>
                          <span className="font-bold text-slate-900 text-xs">{item.partName}</span>
                        </div>
                        <span className="text-[10px] font-black px-2 py-0.5 rounded bg-rose-100 text-rose-800 border border-rose-300">
                          100% хариуцах
                        </span>
                      </div>

                      <div className="text-[10px] text-slate-500 font-semibold">
                        Ангилал: {item.category}
                      </div>

                      <p className="text-xs text-slate-700 leading-relaxed bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                        {item.reason}
                      </p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* SECTION: НАЙМ. ХАВСРАЛТ 19 МАЯГТ (WHITE CARD THEME) */}
            {(activeTab === "annexes" || activeTab === "all" || activeTab === "sec-8") && (
              <section id="annexes-section" className="space-y-3.5">
                <div className="bg-white p-4 sm:p-5 rounded-2xl border-l-6 border-l-sky-600 border border-slate-200 shadow-sm flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-sky-100 text-sky-800 border border-sky-300 flex items-center justify-center font-black text-sm shrink-0">
                      8
                    </div>
                    <div>
                      <h3 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2 flex-wrap">
                        <span>Найм. Хавсралт маягтууд & бүртгэлүүд</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-100 text-sky-800 border border-sky-300 font-black">
                          19 албан маягт
                        </span>
                      </h3>
                      <p className="text-xs text-slate-500">
                        05/B-09-26/ATD-01-ээс ATD-19 хүртэлх маягтууд (Дарж бүтцийг үзнэ үү)
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-3">
                  {filteredAnnexes.map((annex) => (
                    <div
                      key={annex.no}
                      onClick={() => setSelectedAnnex(annex.no)}
                      className="p-3.5 rounded-2xl border-2 bg-white border-slate-200 hover:border-[#0878bd] hover:shadow-md transition-all cursor-pointer shadow-xs active:scale-98"
                    >
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <span className="text-[10px] font-mono font-bold text-[#0878bd] bg-sky-50 border border-sky-200 px-2 py-0.5 rounded-md">
                          {annex.code}
                        </span>
                        <span className="text-[10px] text-amber-700 font-black">Хавсралт №{annex.no}</span>
                      </div>
                      <h4 className="text-xs font-bold text-slate-900 mb-2 line-clamp-2">{annex.name}</h4>
                      
                      <div className="space-y-1 text-[11px] text-slate-600">
                        <div className="flex items-center justify-between">
                          <span>Хөтлөх:</span>
                          <span className="text-slate-900 font-bold truncate max-w-[140px]">{annex.maintainer}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Хянасан:</span>
                          <span className="text-slate-700 truncate max-w-[140px]">{annex.reviewer}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Давтамж:</span>
                          <span className="text-amber-800 font-bold">{annex.frequency}</span>
                        </div>
                      </div>

                      <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-[#0878bd] font-bold">
                        <span>Маягтын бүтцийг харах</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* SECTIONS LIST (1, 2, 3, 4, 6, 7, 9, 10) WITH DISTINCT TOPIC HIGHLIGHTS ON PURE WHITE */}
            {filteredSections
              .filter((s) => {
                if (activeTab === "all") return true;
                return s.id === activeTab;
              })
              .map((section) => {
                const theme = SECTION_THEMES[section.id] || SECTION_THEMES["sec-1"];
                const isExpanded = expandedSections[section.id] !== false;

                return (
                  <section
                    key={section.id}
                    id={section.id}
                    className={`bg-white border-2 border-slate-200 rounded-2xl p-4 sm:p-6 shadow-sm border-l-6 ${theme.borderAccent} transition-all space-y-4`}
                  >
                    {/* Section Header with Distinct Color Theme */}
                    <div
                      onClick={() => toggleSection(section.id)}
                      className="flex items-center justify-between cursor-pointer border-b border-slate-200 pb-3 select-none"
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className={`w-8 h-8 rounded-xl ${theme.badgeBg} ${theme.badgeText} border ${theme.badgeBorder} flex items-center justify-center font-black text-xs shrink-0`}
                        >
                          {section.number}
                        </span>
                        <div>
                          <h3 className="text-sm sm:text-base md:text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
                            <span>{section.number}. {section.title}</span>
                          </h3>
                          {section.subtitle && (
                            <p className="text-xs text-slate-500 mt-0.5">{section.subtitle}</p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${theme.badgeBg} ${theme.badgeText} hidden sm:inline`}>
                          {section.clauses.length} заалттай
                        </span>
                        <button className="text-slate-400 hover:text-slate-700 p-1">
                          {isExpanded ? (
                            <ChevronDown className="w-5 h-5 text-slate-600" />
                          ) : (
                            <ChevronRight className="w-5 h-5 text-slate-600" />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Section Clauses in Distinct White Cards */}
                    {isExpanded && (
                      <div className="space-y-3 sm:space-y-3.5 pt-1">
                        {section.clauses.map((clause) => {
                          const isHighlighted = clause.highlight;

                          return (
                            <div
                              key={clause.code}
                              className={`p-3.5 sm:p-4 rounded-xl border transition-all ${
                                isHighlighted
                                  ? "bg-amber-50/70 border-amber-300 shadow-xs"
                                  : "bg-white border-slate-200 hover:border-slate-300 hover:shadow-xs"
                              }`}
                            >
                              <div className="flex items-start gap-3">
                                {/* Clause Number Pill with Topic Theme Color */}
                                <span
                                  className={`font-mono text-xs font-black px-2.5 py-1 rounded-lg border shrink-0 mt-0.5 ${
                                    isHighlighted
                                      ? "bg-amber-100 text-amber-900 border-amber-300"
                                      : `${theme.clauseBadgeBg}`
                                  }`}
                                >
                                  {clause.code}
                                </span>

                                <div className="flex-1 space-y-1.5 min-w-0">
                                  {clause.title && (
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <h4 className="text-xs sm:text-sm font-bold text-slate-900">
                                        {clause.title}
                                      </h4>
                                      {isHighlighted && (
                                        <span className="text-[10px] font-black uppercase tracking-wider text-amber-800 bg-amber-200/80 px-1.5 py-0.5 rounded border border-amber-300 flex items-center gap-1">
                                          <AlertTriangle className="w-3 h-3 text-amber-700" />
                                          Анхаарах заалт
                                        </span>
                                      )}
                                    </div>
                                  )}

                                  <p className="text-xs sm:text-[13px] text-slate-700 leading-relaxed whitespace-pre-line">
                                    {clause.content}
                                  </p>

                                  {/* Sub-items formatted clearly with numbering pills */}
                                  {clause.subItems && clause.subItems.length > 0 && (
                                    <div className="mt-2.5 pt-2 border-t border-slate-200 space-y-1.5">
                                      {clause.subItems.map((sub, sIdx) => (
                                        <div
                                          key={sIdx}
                                          className="flex items-start gap-2 text-xs text-slate-700 bg-slate-50/60 p-2 rounded-lg border border-slate-200/70"
                                        >
                                          <span className="font-mono text-[11px] text-[#0878bd] font-bold shrink-0 bg-sky-50 px-1.5 py-0.5 rounded border border-sky-200">
                                            {sub.code}
                                          </span>
                                          <span className="leading-relaxed">{sub.text}</span>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </section>
                );
              })}

            {/* EMPTY SEARCH STATE */}
            {searchQuery && filteredSections.length === 0 && (
              <div className="bg-white border-2 border-slate-200 rounded-2xl p-8 text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
                  <Search className="w-6 h-6" />
                </div>
                <h4 className="text-base font-bold text-slate-800">
                  «{searchQuery}» түлхүүр үгээр заалт олдсонгүй
                </h4>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  Та хайлтын үгээ өөрчлөх эсвэл сэлбэгийн нэр, заалтын дугаар (жишээ нь: «аккумулятор», «хий», «гүйлт»)-аар хайна уу.
                </p>
                <button
                  onClick={() => setSearchQuery("")}
                  className="px-4 py-2 bg-[#0878bd] hover:bg-[#098ad8] text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
                >
                  Бүх заалтыг харах
                </button>
              </div>
            )}

            {/* FOOTER NOTICE */}
            <div className="bg-white border-2 border-slate-200 rounded-2xl p-4 text-center text-xs text-slate-600 leading-relaxed shadow-xs">
              «Айсмарк ХХК», «Айсмарк трейд ХХК», «Айсмарк дистрибьюшн ХХК» албан хэрэгцээнд зориулав.
              Хувилан олшруулахыг хориглоно.
            </div>
          </div>
        </div>

        {/* 4. MODAL FOOTER BAR */}
        <div className="bg-white border-t border-slate-200 px-3 sm:px-5 py-2.5 flex items-center justify-between text-xs text-slate-600 shrink-0">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-600" />
            <span className="text-[11px] sm:text-xs font-semibold text-slate-700">Цахим журам идэвхтэй</span>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={() => {
                setActiveTab("all");
                setSearchQuery("");
              }}
              className="text-[11px] sm:text-xs text-[#0878bd] hover:underline font-bold"
            >
              Эхлэл рүү ↑
            </button>
            <button
              onClick={onClose}
              className="px-4 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl font-bold transition-all shadow-sm text-xs cursor-pointer"
            >
              Хаах
            </button>
          </div>
        </div>

        {/* 5. ANNEX DETAIL MODAL POPUP (CLEAN WHITE THEME) */}
        {selectedAnnex !== null && (
          <AnnexDetailModal
            annexNo={selectedAnnex}
            onClose={() => setSelectedAnnex(null)}
          />
        )}

      </div>
    </div>
  );
};

// Detailed Annex Form Modal (Clean Pure White Theme)
const AnnexDetailModal: React.FC<{ annexNo: number; onClose: () => void }> = ({ annexNo, onClose }) => {
  const annex = ANNEX_FORMS.find((a) => a.no === annexNo);
  if (!annex) return null;

  return (
    <div className="fixed inset-0 z-60 bg-slate-900/70 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 md:p-6 animate-fadeIn">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden text-slate-800">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#0878bd] to-[#123047] px-4 sm:px-5 py-3.5 flex items-center justify-between gap-3 shrink-0 text-white">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-white/20 text-white font-black flex items-center justify-center text-sm border border-white/30 shrink-0">
              {annex.no}
            </div>
            <div className="min-w-0">
              <span className="text-[10px] font-mono text-amber-300 bg-black/25 px-2 py-0.5 rounded border border-amber-400/40 font-bold">
                {annex.code}
              </span>
              <h3 className="text-xs sm:text-sm font-bold text-white truncate mt-1">
                {annex.name}
              </h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 text-xs scrollbar-thin bg-white">
          {/* Metadata Card */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 bg-slate-50 p-3.5 rounded-xl border border-slate-200 shadow-xs">
            <div>
              <span className="text-slate-500 block text-[10px] uppercase font-bold">Хадгалах нэгж:</span>
              <span className="font-black text-[#0878bd]">{annex.storage}</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px] uppercase font-bold">Хөтлөх этгээд:</span>
              <span className="font-bold text-slate-900">{annex.maintainer}</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px] uppercase font-bold">Хянасан:</span>
              <span className="font-bold text-slate-800">{annex.reviewer}</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px] uppercase font-bold">Давтамж:</span>
              <span className="font-black text-amber-800">{annex.frequency}</span>
            </div>
          </div>

          {/* Form Description */}
          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs space-y-1.5">
            <h4 className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5 text-[#0878bd]" />
              Маягтын зориулалт ба агуулга
            </h4>
            <p className="text-slate-600 leading-relaxed">
              {annex.description || "Энэхүү маягтыг тухайн үйл явцын дагуу албаны дүрэм журмын стандартыг баримтлан тогтоосон хугацаанд хөтөлж санхүү, удирдлагад хүлээлгэн өгнө."}
            </p>
          </div>

          {/* Form Detailed Preview */}
          <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-xs">
            <div className="bg-slate-100 px-3.5 py-2 border-b border-slate-200 flex items-center justify-between">
              <span className="font-bold text-slate-800 text-xs">Маягтын хүснэгтийн бүтэц</span>
              <span className="text-[10px] text-slate-500 font-semibold">Албан ёсны загвар</span>
            </div>
            <div className="p-3.5 space-y-3">
              {annexNo === 1 && (
                <div className="space-y-2.5">
                  <div className="text-[11px] text-slate-700">
                    62 шалгах эд ангийн бүлгүүд: Хөдөлгүүр (1-5), Хүч дамжуулах анги (6-9), Явах анги (10-12), Удирдлагын механизм (13-14), Тоормос (15-18), Цахилгаан (19-29), Хянах хэрэгсэл (30-33), Өнгө үзэмж (34-49), Амбаар (50-54), Дагалдах хэрэгсэл (55-62).
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                    <div className="bg-slate-50 p-2 rounded-lg border border-slate-200 text-slate-800 font-medium">1. Хөдөлгүүрийн ерөнхий байдал</div>
                    <div className="bg-slate-50 p-2 rounded-lg border border-slate-200 text-slate-800 font-medium">6. Дискэн холбоо</div>
                    <div className="bg-slate-50 p-2 rounded-lg border border-slate-200 text-slate-800 font-medium">10. Тэнхлэг / гар</div>
                    <div className="bg-slate-50 p-2 rounded-lg border border-slate-200 text-slate-800 font-medium">15. Тоормосны механизм</div>
                    <div className="bg-slate-50 p-2 rounded-lg border border-slate-200 text-slate-800 font-medium">19. Аккумулятор, шон</div>
                    <div className="bg-slate-50 p-2 rounded-lg border border-slate-200 text-slate-800 font-medium">30. Тахометр, хурд</div>
                    <div className="bg-slate-50 p-2 rounded-lg border border-slate-200 text-slate-800 font-medium">36. Салхины шил, толь</div>
                    <div className="bg-slate-50 p-2 rounded-lg border border-slate-200 text-slate-800 font-medium">55. Галын хор, эмийн сан</div>
                  </div>
                </div>
              )}

              {annexNo === 4 && (
                <div className="space-y-2">
                  <div className="text-[11px] text-slate-700">
                    Жолоочийн өдөр тутмын 21 шалгуур (Тоормосны шингэн, тос, хөргөлтийн шингэн, шил толь, нум, паар, түлшний түвшин, суудлын даруулга, дугуйн хий, банкны таг) + Механикийн 7 шалгах цэг бүхий 31 хоногийн хяналтын матриц.
                  </div>
                </div>
              )}

              {annexNo === 11 && (
                <div className="space-y-2">
                  <div className="text-[11px] text-slate-700">
                    Түлшний нэгтгэл тайлан: Машины дугаар, жолоочийн нэр, норм (100км-д), эхний/эцсийн спидометр, нийт явсан км, түлш дүүргэлтийн тоо/литр, GPS зарцуулалт, санхүүгийн баримтын зөрүү, суутгал.
                  </div>
                </div>
              )}

              {annexNo !== 1 && annexNo !== 4 && annexNo !== 11 && (
                <div className="text-[11px] text-slate-600 leading-relaxed">
                  Энэхүү маягт нь Авто тээвэр, түгээлтийн албаны стандарт форматын дагуу тоон болон чанарын үзүүлэлтийг бүртгэж, албаны дарга болон эрх бүхий удирдлагаар баталгаажуулан архивлах үүрэгтэй.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-white px-4 sm:px-5 py-3 border-t border-slate-200 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-[#0878bd] hover:bg-[#098ad8] text-white rounded-xl font-bold transition-colors text-xs cursor-pointer"
          >
            Хаах
          </button>
        </div>
      </div>
    </div>
  );
};

// Helper badge renderer for Matrix
function renderRoleBadge(role?: string) {
  if (!role) return <span className="text-slate-300">-</span>;

  const parts = role.split(",").map((s) => s.trim());
  return (
    <div className="flex items-center justify-center gap-1">
      {parts.map((p, i) => {
        let badgeStyle = "bg-slate-100 text-slate-700 border-slate-200";
        if (p === "Х") badgeStyle = "bg-rose-100 text-rose-800 border-rose-300";
        if (p === "Г") badgeStyle = "bg-sky-100 text-sky-800 border-sky-300";
        if (p === "Д") badgeStyle = "bg-emerald-100 text-emerald-800 border-emerald-300";
        if (p === "Б") badgeStyle = "bg-amber-100 text-amber-800 border-amber-300";
        if (p === "М") badgeStyle = "bg-indigo-100 text-indigo-800 border-indigo-300";

        return (
          <span
            key={i}
            className={`inline-block w-4 h-4 leading-4 sm:w-5 sm:h-5 sm:leading-5 rounded text-[10px] font-black border ${badgeStyle}`}
          >
            {p}
          </span>
        );
      })}
    </div>
  );
}
