import React, { useState } from "react";
import { 
  FileSpreadsheet, 
  Upload, 
  CheckCircle2, 
  AlertCircle, 
  X, 
  HelpCircle,
  Sparkles,
  ArrowRight
} from "lucide-react";
import { api } from "../../services/api";
import { IMDExcelImportResult } from "../../types";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onImportSuccess: (result: IMDExcelImportResult) => void;
  onShowToast: (msg: string, type: "success" | "error" | "info") => void;
}

export const IMDExcelImportModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onImportSuccess,
  onShowToast
}) => {
  const [inputText, setInputText] = useState("");
  const [parsedRows, setParsedRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [importResult, setImportResult] = useState<IMDExcelImportResult | null>(null);

  if (!isOpen) return null;

  // Simple parser for pasted Excel / TSV / CSV data
  const handleParseText = (text: string) => {
    setInputText(text);
    if (!text.trim()) {
      setParsedRows([]);
      return;
    }

    const lines = text.trim().split("\n");
    if (lines.length === 0) return;

    // Detect delimiter: tab or comma
    const firstLine = lines[0];
    const isTab = firstLine.includes("\t");
    const delimiter = isTab ? "\t" : ",";

    // Header row
    const rawHeaders = lines[0].split(delimiter).map(h => h.trim().replace(/^["']|["']$/g, ""));

    const rows: any[] = [];
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      const cols = line.split(delimiter).map(c => c.trim().replace(/^["']|["']$/g, ""));
      const rowObj: Record<string, any> = {};
      rawHeaders.forEach((h, idx) => {
        rowObj[h] = cols[idx] || "";
      });
      rows.push(rowObj);
    }

    setParsedRows(rows);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      handleParseText(content);
    };
    reader.readAsText(file);
  };

  const handleExecuteImport = async () => {
    if (parsedRows.length === 0) {
      onShowToast("Импортлох мөр олдсонгүй", "error");
      return;
    }

    setLoading(true);
    try {
      const res = await api.importIMDExcel(parsedRows);
      setImportResult(res);
      onImportSuccess(res);
      const ordersCount = res.importedOrders || res.successCount || 0;
      const assignmentsCount = res.importedAssignments?.length || res.successCount || 0;
      onShowToast(
        `Амжилттай: ${ordersCount} захиалга, ${assignmentsCount} томилолт бүртгэгдлээ`,
        "success"
      );
    } catch (err: any) {
      onShowToast(err.message, "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-slate-100 space-y-4 my-8">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
            <span>Excel / CSV Нэгдсэн Импорт (IMD Захиалга & Томилолт)</span>
          </h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 font-bold text-lg p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Instructions */}
        <div className="bg-blue-50/70 border border-blue-200/80 p-3.5 rounded-2xl text-xs text-blue-900 space-y-1.5">
          <div className="font-bold flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-[#0878bd]" />
            <span>Excel-ээс шууд хуулж тавих (Copy & Paste) боломжтой:</span>
          </div>
          <p className="text-slate-600">
            Excel хүснэгтээс мөрүүдээ сонгоод (Ctrl+C), доорх талбарт шууд буулгана (Ctrl+V) уу.
            Баганын нэрс: <code className="bg-white px-1.5 py-0.5 rounded font-bold text-slate-800">Захиалгын №, Аймаг, Харилцагч, Хайрцаг, Машин, Үндсэн жолооч, Сэлгээ жолооч, Огноо, КМ</code>
          </p>
        </div>

        {/* Input Area */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-700">Excel / Текст буулгах талбар:</label>
            <label className="text-xs font-bold text-[#0878bd] hover:underline cursor-pointer flex items-center gap-1">
              <Upload className="w-3.5 h-3.5" />
              <span>Файл сонгох (.csv, .txt)</span>
              <input
                type="file"
                accept=".csv,.txt,.tsv"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
          </div>

          <textarea
            rows={5}
            value={inputText}
            onChange={(e) => handleParseText(e.target.value)}
            placeholder={`Захиалгын №\tАймаг\tХарилцагч\tХайрцаг\tМашин\tҮндсэн жолооч\tСэлгээ жолооч\tОгноо\nIMD-101\tХөвсгөл\tИх Тамир\t1000\t3147УЕН\tМи.Анхбаяр\tЖа.Алтанхуяг\t2026-09-03`}
            className="w-full p-3 rounded-2xl border border-slate-200 text-xs font-mono outline-none focus:border-blue-500 bg-slate-50"
          />
        </div>

        {/* Preview parsed rows */}
        {parsedRows.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-700">
                Уншигдсан: <strong className="text-emerald-700 font-black">{parsedRows.length}</strong> мөр
              </span>
              <span className="text-[11px] text-slate-400">Эхний 3 мөрийг үзүүлж байна</span>
            </div>

            <div className="max-h-40 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 text-[11px]">
              <table className="w-full text-left">
                <thead className="bg-slate-100 text-slate-500 font-bold border-b border-slate-200 sticky top-0">
                  <tr>
                    {Object.keys(parsedRows[0] || {}).slice(0, 6).map((k) => (
                      <th key={k} className="py-2 px-2.5">{k}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {parsedRows.slice(0, 4).map((row, idx) => (
                    <tr key={idx}>
                      {Object.values(row).slice(0, 6).map((v: any, cidx) => (
                        <td key={cidx} className="py-1.5 px-2.5 font-medium text-slate-800">
                          {String(v)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Import Result Feedback */}
        {importResult && (
          <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs space-y-1 text-emerald-900">
            <div className="font-bold flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Импорт амжилттай дууслаа!</span>
            </div>
            <div>Бүртгэгдсэн захиалга: <strong>{importResult.importedOrders || importResult.successCount}</strong></div>
            <div>Хуваарилагдсан томилолт: <strong>{importResult.importedAssignments?.length || importResult.successCount}</strong></div>
            {importResult.errors && importResult.errors.length > 0 && (
              <div className="text-rose-700 pt-1">
                Алдаа гарсан ({importResult.errors.length}): {importResult.errors.slice(0, 2).join(", ")}
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50"
          >
            Хаах
          </button>
          <button
            type="button"
            disabled={loading || parsedRows.length === 0}
            onClick={handleExecuteImport}
            className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs disabled:opacity-50 flex items-center gap-1.5"
          >
            {loading ? "Импортолж байна..." : (
              <>
                <span>Импорт хийх ({parsedRows.length} мөр)</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
