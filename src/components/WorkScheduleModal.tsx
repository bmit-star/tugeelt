import React, { useState, useEffect } from "react";
import { Calendar, Clock, CheckCircle2, ShieldCheck, RefreshCw, X, AlertCircle, Sparkles, Check, ChevronRight } from "lucide-react";
import { API } from "../services/api";
import { WeeklyDaySetting, WorkScheduleConfig } from "../types";

interface WorkScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (msg: string) => void;
}

const DEFAULT_DAYS: WeeklyDaySetting[] = [
  { dayOfWeek: 1, dayName: "Даваа", isWork: true, task: "Борлуулалт" },
  { dayOfWeek: 2, dayName: "Мягмар", isWork: true, task: "Борлуулалт" },
  { dayOfWeek: 3, dayName: "Лхагва", isWork: true, task: "Борлуулалт" },
  { dayOfWeek: 4, dayName: "Пүрэв", isWork: true, task: "Борлуулалт" },
  { dayOfWeek: 5, dayName: "Баасан", isWork: true, task: "Борлуулалт" },
  { dayOfWeek: 6, dayName: "Бямба", isWork: true, task: "Борлуулалт" },
  { dayOfWeek: 0, dayName: "Ням", isWork: false, task: "Хуваарьт амралт" }
];

export const WorkScheduleModal: React.FC<WorkScheduleModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [workDaysMode, setWorkDaysMode] = useState<"mon_sat" | "mon_fri" | "all_days" | "custom">("mon_sat");
  const [defaultTask, setDefaultTask] = useState("Борлуулалт");
  const [restDayTask, setRestDayTask] = useState("Хуваарьт амралт");
  const [days, setDays] = useState<WeeklyDaySetting[]>(DEFAULT_DAYS);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    API.getWorkSchedule()
      .then((cfg: WorkScheduleConfig) => {
        if (cfg) {
          if (cfg.workDaysMode) setWorkDaysMode(cfg.workDaysMode);
          if (cfg.defaultTask) setDefaultTask(cfg.defaultTask);
          if (cfg.restDayTask) setRestDayTask(cfg.restDayTask);
          if (cfg.weeklyDaysConfig) {
            const loaded = DEFAULT_DAYS.map(d => {
              const saved = cfg.weeklyDaysConfig?.[d.dayOfWeek];
              return saved ? { ...d, ...saved } : d;
            });
            setDays(loaded);
          } else if (cfg.workDaysMode === "mon_fri") {
            setDays(DEFAULT_DAYS.map(d => ({
              ...d,
              isWork: d.dayOfWeek !== 0 && d.dayOfWeek !== 6,
              task: (d.dayOfWeek === 0 || d.dayOfWeek === 6) ? cfg.restDayTask || "Хуваарьт амралт" : cfg.defaultTask || "Борлуулалт"
            })));
          } else if (cfg.workDaysMode === "all_days") {
            setDays(DEFAULT_DAYS.map(d => ({
              ...d,
              isWork: true,
              task: cfg.defaultTask || "Борлуулалт"
            })));
          }
        }
      })
      .catch((err) => {
        console.error("Failed to load schedule config:", err);
      })
      .finally(() => setLoading(false));
  }, [isOpen]);

  if (!isOpen) return null;

  const toggleDayWork = (dayOfWeek: number) => {
    setDays(prev => prev.map(d => {
      if (d.dayOfWeek === dayOfWeek) {
        const nextIsWork = !d.isWork;
        return {
          ...d,
          isWork: nextIsWork,
          task: nextIsWork ? defaultTask : restDayTask
        };
      }
      return d;
    }));
    setWorkDaysMode("custom");
  };

  const updateDayTask = (dayOfWeek: number, task: string) => {
    setDays(prev => prev.map(d => d.dayOfWeek === dayOfWeek ? { ...d, task } : d));
  };

  const applyPreset = (preset: "mon_sat" | "mon_fri" | "all_days") => {
    setWorkDaysMode(preset);
    if (preset === "mon_sat") {
      setDays(DEFAULT_DAYS.map(d => ({
        ...d,
        isWork: d.dayOfWeek !== 0,
        task: d.dayOfWeek === 0 ? restDayTask : defaultTask
      })));
    } else if (preset === "mon_fri") {
      setDays(DEFAULT_DAYS.map(d => ({
        ...d,
        isWork: d.dayOfWeek !== 0 && d.dayOfWeek !== 6,
        task: (d.dayOfWeek === 0 || d.dayOfWeek === 6) ? restDayTask : defaultTask
      })));
    } else if (preset === "all_days") {
      setDays(DEFAULT_DAYS.map(d => ({
        ...d,
        isWork: true,
        task: defaultTask
      })));
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const weeklyDaysConfig: Record<number, WeeklyDaySetting> = {};
      const customRestDays: number[] = [];
      days.forEach(d => {
        weeklyDaysConfig[d.dayOfWeek] = d;
        if (!d.isWork) {
          customRestDays.push(d.dayOfWeek);
        }
      });

      const res = await API.saveWorkSchedule({
        workDaysMode: workDaysMode || "custom",
        defaultTask,
        restDayTask,
        weeklyDaysConfig,
        customRestDays,
        applyToAllDrivers: true
      });
      onSuccess(res.message || "Албаны 7 өдрийн цагийн хуваарь амжилттай баталгаажлаа. Дараагийн өөрчлөлт ортол энэ хуваарийн дагуу мөрдөгдөнө.");
      onClose();
    } catch (err: any) {
      alert("Алдаа: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const workDaysCount = days.filter(d => d.isWork).length;
  const restDaysCount = days.filter(d => !d.isWork).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
      <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200 max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="bg-linear-to-r from-[#123047] to-[#0878bd] p-5 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/15 flex items-center justify-center backdrop-blur-xs border border-white/20">
              <Calendar className="w-5 h-5 text-sky-200" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black tracking-tight">Албаны 7 өдрийн цагийн хуваарь тохируулах</h3>
              <p className="text-xs text-sky-100 font-medium">7 өдрийг сонгож баталгаажуулснаар дараагийн өөрчлөлт ортол автоматаар мөрдөнө</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {loading ? (
            <div className="py-16 flex flex-col items-center justify-center text-slate-400 gap-3">
              <RefreshCw className="w-6 h-6 animate-spin text-[#0878bd]" />
              <span className="text-sm font-medium">Одоогийн хуваарийг уншиж байна...</span>
            </div>
          ) : (
            <>
              {/* Notice Banner */}
              <div className="p-3.5 rounded-2xl bg-sky-50 border border-sky-200 text-sky-950 text-xs flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-[#0878bd] shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-xs sm:text-sm text-[#123047]">Хуваарь баталгаажуулалтын дүрэм</p>
                  <p className="mt-0.5 text-slate-600 leading-relaxed text-[11px] sm:text-xs">
                    Та доорх 7 өдрөөс ажиллах болон амрах өдрүүдийг сонгож баталгаажуулснаар: <strong>дараагийн өөрчлөлт хийх хүртэл</strong> бүх жолоочийн замын хуудас, сарын ажлын хуваарь энэхүү 7 өдрийн горимоор тасралтгүй автоматаар явна.
                  </p>
                </div>
              </div>

              {/* Quick Presets */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-black uppercase text-slate-700">
                    Түргэн сонголт
                  </label>
                  <span className="text-xs text-slate-500 font-bold">
                    {workDaysCount} ажлын өдөр / {restDaysCount} амралтын өдөр
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => applyPreset("mon_sat")}
                    className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                      workDaysMode === "mon_sat"
                        ? "bg-[#0878bd] text-white border-[#0878bd] shadow-md shadow-sky-500/20 font-bold"
                        : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100 font-medium"
                    }`}
                  >
                    <div className="text-xs font-bold">Даваа - Бямба</div>
                    <div className={`text-[10px] mt-0.5 ${workDaysMode === "mon_sat" ? "text-sky-100" : "text-slate-400"}`}>
                      Нямд амарна (6 хоног)
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => applyPreset("mon_fri")}
                    className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                      workDaysMode === "mon_fri"
                        ? "bg-[#0878bd] text-white border-[#0878bd] shadow-md shadow-sky-500/20 font-bold"
                        : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100 font-medium"
                    }`}
                  >
                    <div className="text-xs font-bold">Даваа - Баасан</div>
                    <div className={`text-[10px] mt-0.5 ${workDaysMode === "mon_fri" ? "text-sky-100" : "text-slate-400"}`}>
                      Бямба, Ням амарна (5 хоног)
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => applyPreset("all_days")}
                    className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                      workDaysMode === "all_days"
                        ? "bg-[#0878bd] text-white border-[#0878bd] shadow-md shadow-sky-500/20 font-bold"
                        : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100 font-medium"
                    }`}
                  >
                    <div className="text-xs font-bold">Өдөр бүр</div>
                    <div className={`text-[10px] mt-0.5 ${workDaysMode === "all_days" ? "text-sky-100" : "text-slate-400"}`}>
                      7 өдөр тасралтгүй
                    </div>
                  </button>
                </div>
              </div>

              {/* 7 Days Interactive Matrix */}
              <div>
                <label className="block text-xs font-black uppercase text-slate-700 mb-2">
                  7 Өдрийн нарийвчилсан сонголт (Өдөр бүр дээр дарж ажлын эсвэл амралтын өдөр болгоно)
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-2">
                  {days.map((day) => (
                    <div
                      key={day.dayOfWeek}
                      className={`p-3 rounded-2xl border transition-all flex flex-col justify-between ${
                        day.isWork
                          ? "bg-emerald-50/60 border-emerald-300/80 shadow-xs"
                          : "bg-slate-100 border-slate-300 text-slate-600"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-black text-xs text-slate-900">{day.dayName}</span>
                        <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-md ${
                          day.isWork ? "bg-emerald-200 text-emerald-900" : "bg-slate-200 text-slate-700"
                        }`}>
                          {day.isWork ? "Ажил" : "Амралт"}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => toggleDayWork(day.dayOfWeek)}
                        className={`w-full py-1 px-2 rounded-xl text-[11px] font-black transition-all cursor-pointer flex items-center justify-center gap-1 ${
                          day.isWork
                            ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                            : "bg-slate-300 hover:bg-slate-400 text-slate-800"
                        }`}
                      >
                        {day.isWork ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                        <span>{day.isWork ? "Ажиллана" : "Амарна"}</span>
                      </button>

                      <div className="mt-2">
                        <input
                          type="text"
                          value={day.task}
                          onChange={(e) => updateDayTask(day.dayOfWeek, e.target.value)}
                          placeholder={day.isWork ? "Борлуулалт" : "Амралт"}
                          className="w-full text-[10px] font-bold px-2 py-1 rounded-lg border border-slate-200 bg-white text-slate-800 focus:outline-hidden focus:border-[#0878bd]"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Default Task Names */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Ажлын өдрийн ерөнхий нэршил
                  </label>
                  <input
                    type="text"
                    value={defaultTask}
                    onChange={(e) => {
                      setDefaultTask(e.target.value);
                      setDays(prev => prev.map(d => d.isWork ? { ...d, task: e.target.value } : d));
                    }}
                    placeholder="Борлуулалт"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-900 focus:outline-hidden focus:border-[#0878bd]"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">Замын хуудсанд автоматаар бичигдэнэ</span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Амралтын өдрийн ерөнхий нэршил
                  </label>
                  <input
                    type="text"
                    value={restDayTask}
                    onChange={(e) => {
                      setRestDayTask(e.target.value);
                      setDays(prev => prev.map(d => !d.isWork ? { ...d, task: e.target.value } : d));
                    }}
                    placeholder="Хуваарьт амралт"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-900 focus:outline-hidden focus:border-[#0878bd]"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">Ням гараг ба амралтын өдрүүдэд тавигдана</span>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <div className="text-xs text-slate-500 font-bold hidden sm:flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-[#0878bd]" />
            <span>Дараагийн өөрчлөлт ортол энэ хуваарийг баримтална</span>
          </div>

          <div className="flex items-center gap-2.5 ml-auto">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200/80 transition-colors cursor-pointer"
            >
              Болих
            </button>

            <button
              type="button"
              onClick={handleSave}
              disabled={saving || loading}
              className="px-5 py-2.5 rounded-xl bg-linear-to-r from-[#123047] to-[#0878bd] hover:opacity-95 text-white text-xs font-black flex items-center gap-2 shadow-md shadow-sky-600/20 disabled:opacity-50 transition-all cursor-pointer"
            >
              {saving ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Баталгаажуулж байна...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                  <span>7 Өдрийн хуваарийг баталгаажуулах</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
